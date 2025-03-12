const axios = require('axios');
const config = require('../config');
const { buildAssistantPrompt, buildSummaryPrompt } = require('../utils/promptBuilder');
const fs = require('fs');

const jobs = new Map();
const MAX_CONCURRENT_CALLS = 8; // Match your 8 numbers

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

const startVerificationJob = async (leads) => {
  const jobId = Date.now().toString();
  const phoneNumbers = await fetchPhoneNumbers();

  if (phoneNumbers.length === 0) {
    throw new Error('No Twilio numbers available');
  }

  jobs.set(jobId, {
    leads: leads.slice(),
    results: [],
    phoneNumbers,
    total: leads.length,
    completed: 0,
    activeCalls: 0
  });

  processNextLeads(jobId);
  return jobId;
};

const processNextLeads = (jobId) => {
  const job = jobs.get(jobId);
  if (!job || job.leads.length === 0) return;

  const availableNumbers = job.phoneNumbers.filter(p => !p.inUse);
  while (job.activeCalls < MAX_CONCURRENT_CALLS && job.leads.length > 0 && availableNumbers.length > 0) {
    const lead = job.leads.shift();
    const phone = availableNumbers.shift();
    phone.inUse = true;
    job.activeCalls++;
    makeVerificationCall(jobId, lead, phone.id);
  }
};

const makeVerificationCall = async (jobId, lead, phoneNumberId) => {
  const assistantPrompt = buildAssistantPrompt(lead);
  const summaryPrompt = buildSummaryPrompt(lead);

  if (!lead.phoneNumber.match(/^\+[1-9]\d{9,14}$/)) {
    throw new Error(`Invalid phone number: ${lead.phoneNumber}. Must be E.164 (e.g., +12345678901)`);
  }

  let callId;
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
            messages: [{ role: "system", content: assistantPrompt }],
            tools: [{ type: "endCall", function: { name: "endCall", description: "Ends call when verified", parameters: { type: "object", properties: {} } } }]
          },
          transcriber: { provider: config.TRANSCRIBER_PROVIDER, model: "nova-2" },
          voice: { provider: config.VOICE_PROVIDER, voiceId: config.VOICE_ID },
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
          server: { url: config.WEBHOOK_URL }
        },
        maxDurationSeconds: config.MAX_DURATION,
        metadata: { jobId, lead }
      },
      { headers: { Authorization: `Bearer ${config.VAPI_API_KEY}` } }
    );
    callId = response.data.id;
    console.log(`Started call ${callId} for ${lead.phoneNumber}`);

    const timeoutMs = (2 * config.MAX_DURATION + 60) * 1000;
    setTimeout(() => {
      const job = jobs.get(jobId);
      if (!job || !job.phoneNumbers.find(p => p.id === phoneNumberId)?.inUse) return;

      const { callResults } = require('../webhooks/vapiWebhook');
      const pendingResult = callResults.get(callId);
      if (pendingResult) {
        handleCallResult(jobId, pendingResult, lead, phoneNumberId);
        callResults.delete(callId);
      } else {
        console.warn(`Timeout: No webhook received for call ${callId} to ${lead.phoneNumber}`);
        handleCallResult(jobId, { id: callId, status: 'ended', endedReason: 'timeout', analysis: { summary: '' } }, lead, phoneNumberId);
      }
    }, timeoutMs);
  } catch (error) {
    console.error(`Error calling ${lead.phoneNumber}:`, error.response?.data || error.message);
    const job = jobs.get(jobId);
    if (job) {
      job.activeCalls--;
      const phone = job.phoneNumbers.find(p => p.id === phoneNumberId);
      if (phone) phone.inUse = false;
      job.results.push({ ...lead, verificationStatus: error.response?.data?.message || 'error' });
      job.completed++;
      processNextLeads(jobId);
      if (job.completed === job.total) saveResultsToCSV(jobId);
    }
  }
};

const handleCallResult = (jobId, callData, lead, phoneNumberId) => {
  const job = jobs.get(jobId);
  if (!job) return;

  const verificationStatus = callData.analysis?.summary || callData.endedReason || 'unknown';
  job.results.push({ ...lead, verificationStatus });
  job.completed++;
  job.activeCalls--;

  const phone = job.phoneNumbers.find(p => p.id === phoneNumberId);
  if (phone) phone.inUse = false;

  processNextLeads(jobId);

  if (job.completed === job.total) {
    saveResultsToCSV(jobId);
  }
};

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

const getJobStatus = (jobId) => {
  const job = jobs.get(jobId);
  if (!job) return null;
  return {
    total: job.total,
    completed: job.completed,
    status: job.completed === job.total ? 'completed' : 'processing'
  };
};

const getJobResultsPath = (jobId) => {
  return jobs.get(jobId) ? `results-${jobId}.csv` : null;
};

module.exports = {
  startVerificationJob,
  handleCallResult,
  getJobStatus,
  getJobResultsPath
};