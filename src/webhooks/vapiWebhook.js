const express = require('express');
const router = express.Router();
const { handleCallResult } = require('../services/verificationService');
const { error } = require('../utils/apiResponse');

router.post('/vapi-end-call', (req, res) => {
  const message = req.body?.message || {};

  // Only process end-of-call-report or status-update with status "ended"
  if (message.type !== 'end-of-call-report' && !(message.type === 'status-update' && message.status === 'ended')) {
    return res.status(200).json({ success: true }); // Silently ignore other messages
  }

  // Log minimal data for both types
  console.log(`Webhook received (${message.type}):`, {
    summary: message.analysis?.summary || 'N/A',
    endedReason: message.endedReason || 'unknown'
  });

  try {
    const callData = message.call || {};
    const id = callData.id || 'unknown';
    const endedReason = message.endedReason || callData.endedReason || 'unknown';
    const analysis = message.analysis || {}; // Empty if status-update, has summary if end-of-call-report
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