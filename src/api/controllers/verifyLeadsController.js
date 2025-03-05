const { parseCSV } = require('../../utils/csvParser');
const { success, error } = require('../../utils/apiResponse');
const {
  startVerificationJob,
  getJobStatus,
  getJobResultsPath
} = require('../../services/verificationService');
const fs = require('fs');

// Handle POST /verify-leads
const submitLeads = async (req, res) => {
  try {
    let leads = [];

    // Handle CSV file upload
    if (req.file) {
      leads = await parseCSV(req.file.path);
      fs.unlinkSync(req.file.path); // Delete temporary file after parsing
    }
    // Handle JSON payload
    else if (req.body.leads && Array.isArray(req.body.leads)) {
      leads = req.body.leads.map(lead => ({
        phoneNumber: lead.phoneNumber,
        firstName: lead.firstName,
        lastName: lead.lastName,
        company: lead.company
      }));
    } else {
      return error(res, 'Invalid input: Provide a CSV file or JSON array of leads', 400);
    }

    // Validate leads
    if (leads.length === 0 || !leads.every(l => l.phoneNumber && l.firstName && l.lastName)) {
      return error(res, 'Invalid leads: Each lead must have phoneNumber, firstName, and lastName', 400);
    }

    // Start verification job
    const jobId = await startVerificationJob(leads);
    success(res, { jobId }, 202); // 202 Accepted since processing is async
  } catch (err) {
    error(res, err.message || 'Failed to start verification job', 500);
  }
};

// Handle GET /verify-leads/:jobId/status
const getStatus = (req, res) => {
  const jobId = req.params.jobId;
  const status = getJobStatus(jobId);

  if (!status) {
    return error(res, 'Job not found', 404);
  }

  success(res, status);
};

// Handle GET /verify-leads/:jobId/result
const getResult = (req, res) => {
  const jobId = req.params.jobId;
  const status = getJobStatus(jobId);
  const filePath = getJobResultsPath(jobId);

  if (!status || !filePath || status.status !== 'completed') {
    return error(res, 'Job not found or not completed', 404);
  }

  // Send CSV file as download
  res.download(filePath, `verification-results-${jobId}.csv`, (err) => {
    if (err) {
      error(res, 'Failed to send results', 500);
    }
  });
};

module.exports = { submitLeads, getStatus, getResult };