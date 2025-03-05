require('dotenv').config();

module.exports = {
  VAPI_API_KEY: process.env.VAPI_API_KEY,
  WEBHOOK_URL: process.env.WEBHOOK_URL,
  PORT: process.env.PORT || 3000,
  MODEL_PROVIDER: 'openai',
  MODEL_NAME: 'gpt-4o-mini',
  TRANSCRIBER_PROVIDER: 'deepgram',
  TRANSCRIBER_MODEL: 'nova-3',
  VOICE_PROVIDER: 'deepgram',
  VOICE_ID: 'asteria',
  SILENCE_TIMEOUT: 10,
  MAX_DURATION: 30,
  END_CALL_MESSAGE: "The reason I'm"
};