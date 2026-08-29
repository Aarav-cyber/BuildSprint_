import dotenv from 'dotenv';
import express from 'express';
import { checkStalePRs } from './stale/checker.js';
import { createWebhookRouter } from './server/webhook.js';

dotenv.config();

const app = express();
const port = process.env.PORT || 3000;

// Save raw body for HMAC signature verification
app.use(
  express.json({
    verify: (req, res, buf) => {
      req.rawBody = buf;
    },
  })
);

// Health check endpoint
app.get('/health', (req, res) => {
  res.json({ status: 'ok', timestamp: new Date().toISOString() });
});

// Attach Webhook router
app.use('/webhooks', createWebhookRouter());

// Start server
app.listen(port, () => {
  console.log(`====================================================`);
  console.log(`🚀 PR Review Triage Agent is running on port ${port}`);
  console.log(`   Webhook endpoint: POST http://localhost:${port}/webhooks/github`);
  console.log(`   Health check:     GET  http://localhost:${port}/health`);
  console.log(`====================================================`);

  // Start periodic stale check timer (every X minutes)
  const intervalMinutes = parseFloat(process.env.STALE_CHECK_INTERVAL_MINUTES) || 30;
  console.log(`[Stale PR Checker] Cron initialized. Running every ${intervalMinutes} minutes.`);

  setInterval(() => {
    checkStalePRs().catch((err) => console.error('[Stale PR Checker] Error during scan:', err));
  }, intervalMinutes * 60 * 1000);
});
