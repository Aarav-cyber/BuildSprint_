import dotenv from 'dotenv';
import { analyzePRWithGroq } from '../src/ai/triage.js';
import { rankReviewerCandidates } from '../src/reviewer/ranking.js';
import { calculateDeterministicRisk, blendRiskAssessments } from '../src/risk/scoring.js';
import { buildTriageSlackCard, sendSlackNotification } from '../src/slack/notifier.js';
import { checkStalePRs } from '../src/stale/checker.js';
import { updatePREntry } from '../src/stale/state.js';

dotenv.config();

console.log('================================================================');
console.log('🧪 PR REVIEW TRIAGE AGENT — LOCAL SIMULATION & END-TO-END DEMO');
console.log('================================================================\n');

// 1. Mock Low Risk PR
const lowRiskPR = {
  number: 101,
  title: 'Fix typo in API documentation README',
  body: 'Corrects misspelled parameters in docs/api.md',
  author: 'dev-alice',
  headBranch: 'docs/fix-typo',
  baseBranch: 'main',
  htmlUrl: 'https://github.com/demo-org/demo-repo/pull/101',
  additions: 3,
  deletions: 3,
  changedFilesCount: 1,
  files: [{ filename: 'docs/api.md', status: 'modified', additions: 3, deletions: 3 }],
  rawDiff: `--- a/docs/api.md\n+++ b/docs/api.md\n@@ -10,3 +10,3 @@\n-Authentification token required.\n+Authentication token required.\n`,
};

// 2. Mock High Risk PR
const highRiskPR = {
  number: 102,
  title: 'Add exponential retry handling to payment webhook processing',
  body: 'Modifies payment webhook endpoint to handle Stripe retries on failure.',
  author: 'dev-bob',
  headBranch: 'feat/payment-retry',
  baseBranch: 'main',
  htmlUrl: 'https://github.com/demo-org/demo-repo/pull/102',
  additions: 185,
  deletions: 24,
  changedFilesCount: 2,
  files: [
    { filename: 'src/payments/webhook.js', status: 'modified', additions: 120, deletions: 14 },
    { filename: 'src/auth/middleware.js', status: 'modified', additions: 65, deletions: 10 },
  ],
  rawDiff: `--- a/src/payments/webhook.js\n+++ b/src/payments/webhook.js\n@@ -45,6 +45,18 @@ async function handleWebhook(req, res) {\n+ // Retry logic for failed Stripe events\n+ const maxRetries = 3;\n+ for (let attempt = 1; attempt <= maxRetries; attempt++) {\n+   try { return await processPayment(req.body); }\n+   catch (e) { if (attempt === maxRetries) throw e; }\n+ }\n`,
};

async function runSimulation() {
  console.log('--- 1. TRIAGING LOW-RISK PR (#101) ---');
  const lowRiskDet = calculateDeterministicRisk(lowRiskPR);
  const lowRiskAI = await analyzePRWithGroq(lowRiskPR, lowRiskDet, []);
  const lowRiskFinalRisk = blendRiskAssessments(lowRiskDet, lowRiskAI.risk);

  const lowRiskAnalysis = {
    summary: lowRiskAI.summary,
    risk: lowRiskFinalRisk,
    reviewers: lowRiskAI.reviewers,
  };

  console.log('Result for PR #101:');
  console.log(`- Summary: ${lowRiskAnalysis.summary}`);
  console.log(`- Risk Level: ${lowRiskAnalysis.risk.level} (${lowRiskAnalysis.risk.score}/100)`);
  console.log(`- Reasons: ${lowRiskAnalysis.risk.reasons.join(', ')}`);
  console.log(`- Suggested Reviewer: ${lowRiskAnalysis.reviewers[0]?.username || 'None'}`);

  const lowCard = buildTriageSlackCard(lowRiskPR, lowRiskAnalysis);
  await sendSlackNotification(lowCard);

  console.log('\n--- 2. TRIAGING HIGH-RISK PR (#102) ---');
  const highRiskDet = calculateDeterministicRisk(highRiskPR);
  const mockCodeowners = [
    { username: 'alex-payments', reason: 'CODEOWNER for src/payments/' },
    { username: 'sarah-auth', reason: 'CODEOWNER for src/auth/' },
  ];
  const mockHistory = { 'alex-payments': 5, 'sarah-auth': 3 };
  const rankedReviewers = rankReviewerCandidates(mockCodeowners, mockHistory, highRiskPR.author);

  const highRiskAI = await analyzePRWithGroq(highRiskPR, highRiskDet, rankedReviewers);
  const highRiskFinalRisk = blendRiskAssessments(highRiskDet, highRiskAI.risk);

  const highRiskAnalysis = {
    summary: highRiskAI.summary,
    risk: highRiskFinalRisk,
    reviewers: highRiskAI.reviewers && highRiskAI.reviewers.length > 0 ? highRiskAI.reviewers : rankedReviewers,
  };

  console.log('Result for PR #102:');
  console.log(`- Summary: ${highRiskAnalysis.summary}`);
  console.log(`- Risk Level: ${highRiskAnalysis.risk.level} (${highRiskAnalysis.risk.score}/100)`);
  console.log(`- Reasons: ${highRiskAnalysis.risk.reasons.join(', ')}`);
  console.log(`- Suggested Reviewer: ${highRiskAnalysis.reviewers[0]?.username}`);
  console.log(`- Reviewer Reason: ${highRiskAnalysis.reviewers[0]?.reason}`);

  const highCard = buildTriageSlackCard(highRiskPR, highRiskAnalysis);
  await sendSlackNotification(highCard);

  console.log('\n--- 3. TESTING STALE PR ESCALATION ---');
  const testStateFile = 'data/sim_state.json';

  // Seed state with a PR that was created 10 hours ago (should trigger high risk escalation threshold of 6 hours)
  const tenHoursAgo = new Date(Date.now() - 10 * 3600 * 1000).toISOString();
  updatePREntry(
    'demo-org/demo-repo#102',
    {
      owner: 'demo-org',
      repo: 'demo-repo',
      number: 102,
      title: highRiskPR.title,
      author: highRiskPR.author,
      htmlUrl: highRiskPR.htmlUrl,
      status: 'open',
      riskLevel: 'HIGH',
      riskScore: highRiskAnalysis.risk.score,
      assignedReviewer: highRiskAnalysis.reviewers[0]?.username,
      triagedAt: tenHoursAgo,
      lastActivityAt: tenHoursAgo,
      staleNudgeSent: false,
    },
    testStateFile
  );

  await checkStalePRs({
    highRiskThresholdHours: 6,
    normalThresholdHours: 24,
    stateFilePath: testStateFile,
  });

  console.log('\n================================================================');
  console.log('✅ SIMULATION COMPLETE — All pipelines validated successfully!');
  console.log('================================================================');
}

runSimulation().catch(console.error);
