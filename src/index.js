const express = require('express');
const config = require('./config');
const verifyLeadsRoutes = require('./api/routes/verifyLeadsRoutes');
const vapiWebhook = require('./webhooks/vapiWebhook');
const fs = require('fs');
const cors = require('cors');

// Initialize Express app
const app = express();

// Middleware to parse JSON bodies
app.use(express.json());

// Configure CORS
app.use(cors({
  origin: (origin, callback) => {
    const allowedOrigin = 'https://lead-verification-master.vercel.app/';
    if (!origin || origin === allowedOrigin) {
      callback(null, allowedOrigin);
    } else {
      callback(new Error('Not allowed by CORS'));
    }
  },
  methods: ['GET', 'POST', 'OPTIONS'], // Explicitly allow these methods
  allowedHeaders: ['Content-Type'],    // Allow JSON content type
  credentials: false                   // No cookies/auth needed
}));

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