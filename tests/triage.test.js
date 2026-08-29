import assert from 'node:assert';
import { test } from 'node:test';
import { parseCodeowners, matchCodeowners } from '../src/github/client.js';
import { rankReviewerCandidates } from '../src/reviewer/ranking.js';
import { calculateDeterministicRisk } from '../src/risk/scoring.js';
import { buildTriageSlackCard, buildStaleEscalationSlackCard } from '../src/slack/notifier.js';

test('Risk Scoring - Low Risk Documentation PR', () => {
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

test('Risk Scoring - High Risk Auth & Payments PR', () => {
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

test('CODEOWNERS Parsing and Matching', () => {
  const codeownersText = `
  # Global owners
  * @global-owner

  # Module owners
  src/payments/ @alex-payments @fin-team
  src/auth/ @sarah-auth
  `;

  const rules = parseCodeowners(codeownersText);
  assert.strictEqual(rules.length, 3);

  const matched = matchCodeowners(['src/payments/webhook.js', 'src/auth/token.js'], rules);
  const owners = matched.map((m) => m.username);

  assert.ok(owners.includes('alex-payments'));
  assert.ok(owners.includes('sarah-auth'));
});

test('Reviewer Ranking Engine', () => {
  const codeownerMatches = [
    { username: 'alex-payments', reason: 'CODEOWNER rule matched' },
  ];
  const reviewHistory = {
    'alex-payments': 4,
    'jordan-dev': 2,
  };

  const ranked = rankReviewerCandidates(codeownerMatches, reviewHistory, 'pr-author-bob');
  assert.strictEqual(ranked[0].username, 'alex-payments');
  assert.ok(ranked[0].score > ranked[1].score);
});

test('Slack Card Builder Formats Block Kit Correctly', () => {
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
  assert.ok(card.blocks.length >= 6);
  assert.strictEqual(card.blocks[0].type, 'header');
});
