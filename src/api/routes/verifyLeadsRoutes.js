const express = require('express');
const router = express.Router();
const multer = require('multer');
const { submitLeads, getStatus, getResult } = require('../controllers/verifyLeadsController');

// Set up multer for file uploads
const upload = multer({ dest: 'uploads/' });

// Routes
router.post('/verify-leads', upload.single('file'), submitLeads);
router.get('/verify-leads/:jobId/status', getStatus);
router.get('/verify-leads/:jobId/result', getResult);

module.exports = router;