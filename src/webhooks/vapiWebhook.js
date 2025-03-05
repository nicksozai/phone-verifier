const express = require('express');
const router = express.Router();
const { handleCallResult } = require('../services/verificationService');
const { error } = require('../utils/apiResponse');

router.post('/vapi-end-call', (req, res) => {
  console.log('Webhook received:', {
    headers: req.headers,
    body: req.body
  });
  try {
    const message = req.body?.message || {};
    if (message.type !== 'end-of-call-report') {
      console.log('Ignoring non-end-of-call-report message:', message.type);
      return res.status(200).json({ success: true });
    }

    const callData = message.call || {};
    const id = callData.id || 'unknown';
    const endedReason = message.endedReason || callData.endedReason;
    const analysis = callData.analysis || {};
    const jobId = callData.metadata?.jobId;
    const phoneNumberId = callData.phoneNumberId || 'unknown';
    const lead = callData.metadata?.lead;

    if (!jobId || !lead) {
      console.warn('Webhook missing critical data:', { jobId, lead });
      return error(res, 'Missing jobId or lead in webhook payload', 400);
    }

    handleCallResult(jobId, { id, status: 'ended', endedReason, analysis }, lead, phoneNumberId);
    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Webhook error:', err.message, err.stack);
    error(res, 'Failed to process webhook', 500);
  }
});

module.exports = router;