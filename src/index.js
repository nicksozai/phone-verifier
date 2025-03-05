const express = require('express');
const config = require('./config');
const verifyLeadsRoutes = require('./api/routes/verifyLeadsRoutes');
const vapiWebhook = require('./webhooks/vapiWebhook');
const fs = require('fs');

// Initialize Express app
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Create uploads directory if it doesn’t exist
if (!fs.existsSync('uploads')) {
  fs.mkdirSync('uploads');
}

// Mount routes
app.use('/', verifyLeadsRoutes);           // API routes (e.g., /verify-leads)
app.use('/webhook', vapiWebhook);          // Webhook routes (e.g., /webhook/vapi-end-call)

// Start the server
const PORT = config.PORT;
app.listen(PORT, () => {
  console.log(`Server running on port ${PORT}`);
});