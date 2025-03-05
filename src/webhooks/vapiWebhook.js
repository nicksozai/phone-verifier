const express = require('express');
const router = express.Router();
const { handleCallResult } = require('../services/verificationService');
const { error } = require('../utils/apiResponse');

// Handle POST /webhook/vapi-end-call
router.post('/vapi-end-call', (req, res) => {
  try {
    const callData = req.body;
    if (!callData || !callData.id) {
      return error(res, 'Invalid webhook payload: Missing call ID', 400);
    }

    // Extract relevant fields from webhook payload
    const { id, status, endedReason, analysis } = callData;
    const jobId = callData.metadata?.jobId; // We'll add this metadata when making the call
    const phoneNumberId = callData.phoneNumberId;
    const lead = callData.metadata?.lead;

    if (!jobId || !phoneNumberId || !lead) {
      return error(res, 'Invalid webhook payload: Missing jobId, phoneNumberId, or lead', 400);
    }

    // Process the call result
    handleCallResult(jobId, { id, status, endedReason, analysis }, lead, phoneNumberId);

    // Respond to vapi.ai to acknowledge receipt
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Webhook error:', err.message);
    error(res, 'Failed to process webhook', 500);
  }
});

module.exports = router;