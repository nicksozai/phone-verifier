const axios = require('axios');
const config = require('../config');
const { buildAssistantPrompt, buildSummaryPrompt } = require('../utils/promptBuilder');
const fs = require('fs');

// In-memory storage for jobs
const jobs = new Map();

// Fetch available Twilio numbers from vapi.ai
const fetchPhoneNumbers = async () => {
  try {
    const response = await axios.get('https://api.vapi.ai/phone-number', {
      headers: { Authorization: `Bearer ${config.VAPI_API_KEY}` }
    });
    return response.data.map(phone => ({
      id: phone.id,
      number: phone.number,
      inUse: false
    }));
  } catch (error) {
    console.error('Error fetching phone numbers:', error.message);
    return [];
  }
};

// Start a new verification job
const startVerificationJob = async (leads) => {
  const jobId = Date.now().toString(); // Simple unique ID based on timestamp
  const phoneNumbers = await fetchPhoneNumbers();

  if (phoneNumbers.length === 0) {
    throw new Error('No Twilio numbers available');
  }

  // Initialize job
  jobs.set(jobId, {
    leads: leads.slice(), // Queue of leads to process
    results: [],          // Completed leads with verification status
    phoneNumbers,         // Available Twilio numbers
    total: leads.length,  // Total leads for progress tracking
    completed: 0          // Completed leads count
  });

  // Start processing with available phone numbers
  processNextLeads(jobId);
  return jobId;
};

// Process the next leads in the queue
const processNextLeads = (jobId) => {
  const job = jobs.get(jobId);
  if (!job || job.leads.length === 0) return;

  const availableNumbers = job.phoneNumbers.filter(p => !p.inUse);
  availableNumbers.forEach(phone => {
    if (job.leads.length > 0) {
      const lead = job.leads.shift(); // Remove and get the next lead
      phone.inUse = true;
      makeVerificationCall(jobId, lead, phone.id);
    }
  });
};

const makeVerificationCall = async (jobId, lead, phoneNumberId) => {
  const assistantPrompt = buildAssistantPrompt(lead);
  const summaryPrompt = buildSummaryPrompt(lead);

  if (!lead.phoneNumber.match(/^\+[1-9]\d{9,14}$/)) {
    throw new Error(`Invalid phone number: ${lead.phoneNumber}. Must be E.164 (e.g., +12345678901)`);
  }

  try {
    const response = await axios.post(
      "https://api.vapi.ai/call",
      {
        phoneNumberId,
        customer: { number: lead.phoneNumber },
        assistant: {
          model: {
            provider: config.MODEL_PROVIDER,
            model: config.MODEL_NAME,
            messages: [{ role: "system", content: assistantPrompt }]
          },
          transcriber: {
            provider: config.TRANSCRIBER_PROVIDER,
            model: "nova-2"
          },
          voice: {
            provider: config.VOICE_PROVIDER,
            voiceId: config.VOICE_ID
          },
          firstMessageMode: "assistant-waits-for-user",
          endCallMessage: config.END_CALL_MESSAGE,
          analysisPlan: {
            summaryPlan: {
              enabled: true,
              messages: [
                { role: "system", content: summaryPrompt },
                { role: "user", content: "Transcript: {{transcript}}" }
              ]
            }
          },
          server: {
            url: config.WEBHOOK_URL
          },
          tools: [
            {
              type: "endCall",
              function: {
                name: "endCall",
                description: "Ends the call immediately when verification status is determined.",
                parameters: {}
              }
            }
          ]
        },
        maxDurationSeconds: config.MAX_DURATION,
        metadata: { jobId, lead }
      },
      {
        headers: { Authorization: `Bearer ${config.VAPI_API_KEY}` }
      }
    );
    console.log(`Started call ${response.data.id} for ${lead.phoneNumber}`);
  } catch (error) {
    console.error(`Error calling ${lead.phoneNumber}:`, error.response?.data || error.message);
    handleCallResult(jobId, {
      id: "error-" + Date.now(),
      status: "ended",
      endedReason: "error",
      analysis: { summary: "" }
    }, lead, phoneNumberId);
  }
};

// Handle call result from webhook
const handleCallResult = (jobId, callData, lead, phoneNumberId) => {
  const job = jobs.get(jobId);
  if (!job) return;

  // Determine verification status
  let verificationStatus = callData.analysis?.summary || '';
  if (!verificationStatus) {
    switch (callData.endedReason) {
      case 'customer-did-not-answer':
        verificationStatus = 'No Answer';
        break;
      case 'busy':
        verificationStatus = 'Busy';
        break;
      case 'voicemail':
        verificationStatus = 'Voicemail';
        break;
      default:
        verificationStatus = 'Error';
    }
  }

  // Add result to job
  job.results.push({ ...lead, verificationStatus });
  job.completed++;

  // Free the phone number
  const phone = job.phoneNumbers.find(p => p.id === phoneNumberId);
  if (phone) phone.inUse = false;

  // Process next lead
  processNextLeads(jobId);

  // Clean up if job is complete
  if (job.completed === job.total) {
    saveResultsToCSV(jobId);
  }
};

// Save results to CSV
const saveResultsToCSV = (jobId) => {
  const job = jobs.get(jobId);
  if (!job) return;

  const csvContent = [
    'firstName,lastName,phoneNumber,company,verificationStatus',
    ...job.results.map(lead =>
      `${lead.firstName},${lead.lastName},${lead.phoneNumber},${lead.company || ''},${lead.verificationStatus}`
    )
  ].join('\n');

  fs.writeFileSync(`results-${jobId}.csv`, csvContent);
  console.log(`Results saved for job ${jobId}`);
};

// Get job status
const getJobStatus = (jobId) => {
  const job = jobs.get(jobId);
  if (!job) return null;
  return {
    total: job.total,
    completed: job.completed,
    status: job.completed === job.total ? 'completed' : 'processing'
  };
};

// Get job results file path
const getJobResultsPath = (jobId) => {
  return jobs.get(jobId) ? `results-${jobId}.csv` : null;
};

module.exports = {
  startVerificationJob,
  handleCallResult,
  getJobStatus,
  getJobResultsPath
};