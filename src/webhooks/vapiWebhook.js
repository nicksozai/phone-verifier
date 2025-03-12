const express = require('express');
const router = express.Router();
const { handleCallResult } = require('../services/verificationService');
const { callResults } = require('../utils/callResults');
const { error } = require('../utils/apiResponse');

router.post('/vapi-end-call', (req, res) => {
  const message = req.body?.message || {};

  if (message.type !== 'end-of-call-report' && !(message.type === 'status-update' && message.status === 'ended')) {
    return res.status(200).json({ success: true });
  }

  const callData = message.call || {};
  const callId = callData.id || 'unknown';

  console.log(`Webhook received (${message.type}):`, {
    callId,
    summary: message.analysis?.summary || 'N/A',
    endedReason: message.endedReason || 'unknown'
  });

  try {
    const jobId = callData.metadata?.jobId;
    const phoneNumberId = callData.phoneNumberId || 'unknown';
    const lead = callData.metadata?.lead;

    if (!jobId || !lead) {
      console.warn('Webhook missing critical data:', { jobId, lead });
      return error(res, 'Missing jobId or lead in webhook payload', 400);
    }

    const result = { id: callId, status: 'ended', endedReason: message.endedReason || 'unknown', analysis: message.analysis || {} };

    if (message.type === 'status-update') {
      callResults.set(callId, result);
    } else if (message.type === 'end-of-call-report') {
      callResults.delete(callId); // Clear pending status-update
      handleCallResult(jobId, result, lead, phoneNumberId);
    }

    res.status(200).json({ success: true });
  } catch (err) {
    console.error('Webhook error:', err.message, err.stack);
    error(res, 'Failed to process webhook', 500);
  }
});

module.exports = router;