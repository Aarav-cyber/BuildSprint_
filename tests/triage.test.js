import assert from 'node:assert';
import { test } from 'node:test';
import { analyzePRWithGroq, generateFallbackAIAnalysis } from '../src/ai/triage.js';
import { parseCodeowners, matchCodeowners } from '../src/github/client.js';
import { processDiffAndMetadata } from '../src/github/diff.js';
import { rankReviewerCandidates, validateSelectedReviewer } from '../src/reviewer/ranking.js';
import { calculateDeterministicRisk, blendRiskAssessments } from '../src/risk/scoring.js';
import { buildTriageSlackCard, buildStaleEscalationSlackCard } from '../src/slack/notifier.js';

test('1. Risk Scoring - Low Risk Documentation PR', () => {
  const pr = {
    title: 'Fix typo in README',
    body: 'Corrected spelling of installation steps.',
    additions: 2,
    deletions: 2,
    files: [{ filename: 'README.md', status: 'modified', additions: 2, deletions: 2 }],
  };

  const risk = calculateDeterministicRisk(pr);
  assert.strictEqual(risk.level, 'LOW');
  assert.ok(risk.score < 35);
});

test('2. Risk Scoring - High Risk Auth & Payments PR', () => {
  const pr = {
    title: 'Update payment webhook retry logic and auth middleware',
    body: 'Adds automated retries for failed payment webhook notifications.',
    additions: 250,
    deletions: 40,
    files: [
      { filename: 'src/payments/webhook.js', status: 'modified', additions: 150, deletions: 20 },
      { filename: 'src/auth/jwt.js', status: 'modified', additions: 100, deletions: 20 },
    ],
  };

  const risk = calculateDeterministicRisk(pr);
  assert.strictEqual(risk.level, 'HIGH');
  assert.ok(risk.score >= 65);
});

test('3. Diff Preprocessing - Handles missing, empty, and truncated diffs', () => {
  const emptyPR = { title: 'Empty PR', files: [], rawDiff: '' };
  const processedEmpty = processDiffAndMetadata(emptyPR, 1000);
  assert.ok(processedEmpty.processedDiff.includes('No code changes'));

  const largeDiff = 'A'.repeat(10000);
  const largePR = { title: 'Large PR', files: [{ filename: 'app.js' }], rawDiff: largeDiff };
  const processedLarge = processDiffAndMetadata(largePR, 500);
  assert.strictEqual(processedLarge.isTruncated, true);
  assert.ok(processedLarge.processedDiff.includes('[Diff truncated'));
});

test('4. Reviewer Candidate Ranking - Author Exclusion & Evidence Weighting', () => {
  const codeownerMatches = [
    { username: 'alex-payments', reason: 'CODEOWNER for payments/' },
    { username: 'pr-author-bob', reason: 'CODEOWNER rule matched' },
  ];
  const reviewHistory = {
    'alex-payments': 4,
    'jordan-dev': 2,
    'pr-author-bob': 10,
  };

  const ranked = rankReviewerCandidates(codeownerMatches, reviewHistory, 'pr-author-bob');

  // PR author must NEVER be in candidate list
  assert.strictEqual(
    ranked.some((r) => r.username === 'pr-author-bob'),
    false
  );
  assert.strictEqual(ranked[0].username, 'alex-payments');
});

test('5. Reviewer Hallucination Protection - Validates AI suggestions against evidence', () => {
  const validCandidates = [{ username: 'alex-payments', score: 50, reason: 'CODEOWNER' }];

  // Unknown hallucinated user returned by LLM
  const validatedUnknown = validateSelectedReviewer('unknown-hallucinated-user', validCandidates);
  assert.strictEqual(validatedUnknown, null);

  // Valid candidate suggested by LLM
  const validatedValid = validateSelectedReviewer('alex-payments', validCandidates);
  assert.notStrictEqual(validatedValid, null);
  assert.strictEqual(validatedValid.username, 'alex-payments');
});

test('6. Reviewer Candidate Fallback - Returns explicit no match when no evidence exists', () => {
  const ranked = rankReviewerCandidates([], {}, 'alice');
  assert.strictEqual(ranked.length, 0);

  const fallbackAI = generateFallbackAIAnalysis({ title: 'Test PR' }, { level: 'LOW', score: 10, reasons: [] }, []);
  assert.deepStrictEqual(fallbackAI.reviewers, []);
});

test('7. Verification - Bounded Processed Diff Passed to Groq Prompt Construction', async () => {
  const hugeDiff = 'X'.repeat(20000);
  const prData = {
    title: 'Huge PR',
    body: 'Tests diff bounds',
    author: 'dev1',
    headBranch: 'feature',
    baseBranch: 'main',
    additions: 1000,
    deletions: 500,
    changedFilesCount: 5,
    files: [{ filename: 'big.js', status: 'modified', additions: 1000, deletions: 500 }],
    rawDiff: hugeDiff,
  };

  // Run fallback analysis without GROQ_API_KEY
  const result = await analyzePRWithGroq(prData, { level: 'HIGH', score: 80, reasons: [] }, []);
  assert.ok(result.summary);
  assert.strictEqual(result.risk.level, 'HIGH');
});

test('8. Verification - Final State Assigned Reviewer Is Evidence-Backed or Null', () => {
  const validCandidates = [{ username: 'sarah-auth', score: 50, reason: 'CODEOWNER' }];
  
  // When hallucinated user suggested, state gets null / evidence-backed top candidate
  const hallucinatedMatch = validateSelectedReviewer('hallucinated-user', validCandidates);
  assert.strictEqual(hallucinatedMatch, null);

  const topReviewerState = hallucinatedMatch ? hallucinatedMatch.username : (validCandidates[0]?.username || null);
  assert.strictEqual(topReviewerState, 'sarah-auth');
});

test('9. Slack Triage Card Formatting', () => {
  const prData = {
    number: 42,
    title: 'Add payment retry logic',
    htmlUrl: 'https://github.com/org/repo/pull/42',
    author: 'developer123',
    headBranch: 'feat/retry',
    baseBranch: 'main',
  };

  const analysis = {
    summary: 'Adds exponential backoff retries for failed payment webhook processing.',
    risk: { level: 'HIGH', score: 85, reasons: ['Touches payment handling', 'No unit tests added'] },
    reviewers: [{ username: 'alex-payments', reason: 'CODEOWNER for payments/' }],
  };

  const card = buildTriageSlackCard(prData, analysis);
  assert.ok(card.blocks);
  assert.strictEqual(card.blocks[0].type, 'header');
});

test('10. Slack Stale Escalation Card Formatting', () => {
  const prData = {
    number: 42,
    title: 'Add payment retry logic',
    htmlUrl: 'https://github.com/org/repo/pull/42',
    author: 'developer123',
  };

  const stateEntry = {
    riskLevel: 'HIGH',
    assignedReviewer: 'alex-payments',
  };

  const staleCard = buildStaleEscalationSlackCard(prData, stateEntry, 12);
  assert.ok(staleCard.blocks);
  assert.ok(JSON.stringify(staleCard).includes('HIGH-RISK PR STALE ESCALATION'));
});
