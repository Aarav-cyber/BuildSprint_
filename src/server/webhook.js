import crypto from 'crypto';
import express from 'express';
import { analyzePRWithGroq } from '../ai/triage.js';
import { fetchCodeowners, fetchRecentReviewHistory, getPRDetails, matchCodeowners, parseCodeowners } from '../github/client.js';
import { rankReviewerCandidates } from '../reviewer/ranking.js';
import { blendRiskAssessments, calculateDeterministicRisk } from '../risk/scoring.js';
import { buildTriageSlackCard, sendSlackNotification } from '../slack/notifier.js';
import { updatePREntry } from '../stale/state.js';

/**
 * Validates GitHub HMAC SHA256 webhook signature.
 */
export function verifyGitHubWebhookSignature(req, secret) {
  if (!secret) return true; // Skip if no secret set
  const signature = req.headers['x-hub-signature-256'];
  if (!signature) return false;

  const hmac = crypto.createHmac('sha256', secret);
  const digest = 'sha256=' + hmac.update(req.rawBody || JSON.stringify(req.body)).digest('hex');
  try {
    return crypto.timingSafeEqual(Buffer.from(signature), Buffer.from(digest));
  } catch {
    return false;
  }
}

/**
 * Orchestrates full triage pipeline for a given PR.
 */
export async function triagePullRequest(owner, repo, pullNumber) {
  console.log(`[Triage Engine] Starting analysis for ${owner}/${repo}#${pullNumber}...`);

  // 1. Fetch metadata & diffs
  const prData = await getPRDetails(owner, repo, pullNumber);

  if (prData.draft) {
    console.log(`[Triage Engine] PR #${pullNumber} is draft. Triaging but flagging draft status.`);
  }

  // 2. Deterministic Risk Assessment
  const deterministicRisk = calculateDeterministicRisk(prData);

  // 3. Reviewer candidate gathering from repository evidence
  const filePaths = prData.files.map((f) => f.filename);
  const codeownersText = await fetchCodeowners(owner, repo);
  const parsedCodeowners = parseCodeowners(codeownersText);
  const codeownerMatches = matchCodeowners(filePaths, parsedCodeowners);

  const reviewHistory = await fetchRecentReviewHistory(owner, repo, filePaths);

  const rankedCandidates = rankReviewerCandidates(codeownerMatches, reviewHistory, prData.author);

  // 4. AI Analysis via Groq (with strict candidate validation)
  const aiAnalysis = await analyzePRWithGroq(prData, deterministicRisk, rankedCandidates);

  // 5. Blend risk assessments
  const finalRisk = blendRiskAssessments(deterministicRisk, aiAnalysis.risk);

  const finalAnalysis = {
    summary: aiAnalysis.summary,
    risk: finalRisk,
    reviewers: aiAnalysis.reviewers,
  };

  // 6. Send Slack notification
  const slackCard = buildTriageSlackCard(prData, finalAnalysis);
  const slackResult = await sendSlackNotification(slackCard);

  // 7. Update State Store
  const key = `${owner}/${repo}#${pullNumber}`;
  const topReviewer = finalAnalysis.reviewers && finalAnalysis.reviewers.length > 0 ? finalAnalysis.reviewers[0].username : null;

  updatePREntry(key, {
    owner,
    repo,
    number: pullNumber,
    title: prData.title,
    author: prData.author,
    htmlUrl: prData.htmlUrl,
    status: prData.state,
    draft: prData.draft,
    riskLevel: finalRisk.level,
    riskScore: finalRisk.score,
    assignedReviewer: topReviewer,
    triagedAt: new Date().toISOString(),
    lastActivityAt: prData.updatedAt || new Date().toISOString(),
    hasBeenReviewed: false,
    staleNudgeSent: false,
  });

  console.log(`[Triage Engine] Completed triage for ${key}: Risk=${finalRisk.level} (${finalRisk.score}/100)`);
  return { prData, analysis: finalAnalysis, slackResult };
}

/**
 * Express router for GitHub webhooks.
 */
export function createWebhookRouter() {
  const router = express.Router();

  router.post('/github', async (req, res) => {
    const secret = process.env.GITHUB_WEBHOOK_SECRET;
    if (secret && !verifyGitHubWebhookSignature(req, secret)) {
      console.warn('[Webhook Server] Invalid signature on incoming webhook');
      return res.status(401).json({ error: 'Invalid webhook signature' });
    }

    const event = req.headers['x-github-event'];
    const payload = req.body;

    if (event === 'ping') {
      console.log('[Webhook Server] Received GitHub ping event.');
      return res.status(200).json({ msg: 'pong' });
    }

    if (event === 'pull_request') {
      const action = payload.action;
      const pullNumber = payload.pull_request?.number;
      const repo = payload.repository?.name;
      const owner = payload.repository?.owner?.login;

      console.log(`[Webhook Server] PR Event received: ${action} on ${owner}/${repo}#${pullNumber}`);

      if (['opened', 'synchronize', 'reopened'].includes(action) && owner && repo && pullNumber) {
        // Trigger triage asynchronously so webhook responds fast (under 3s)
        res.status(202).json({ status: 'Processing PR triage asynchronously', owner, repo, pullNumber });

        setImmediate(async () => {
          try {
            await triagePullRequest(owner, repo, pullNumber);
          } catch (err) {
            console.error(`[Webhook Server] Error triaging PR #${pullNumber}:`, err.message);
          }
        });
        return;
      }
    }

    res.status(200).json({ status: 'Event ignored or unhandled action' });
  });

  return router;
}
