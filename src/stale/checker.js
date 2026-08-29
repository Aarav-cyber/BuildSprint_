import { fetchPRReviewStatus, getPRDetails } from '../github/client.js';
import { buildStaleEscalationSlackCard, sendSlackNotification } from '../slack/notifier.js';
import { loadPRState, updatePREntry } from './state.js';

/**
 * Periodically or on-demand checks tracked PRs for staleness.
 * Focuses on unreviewed open PRs exceeding age thresholds.
 * High-risk PRs escalate faster than normal PRs.
 */
export async function checkStalePRs(options = {}) {
  const {
    highRiskThresholdHours = parseFloat(process.env.STALE_THRESHOLD_HOURS_HIGH) || 6,
    normalThresholdHours = parseFloat(process.env.STALE_THRESHOLD_HOURS_NORMAL) || 24,
    stateFilePath,
  } = options;

  console.log('[Stale Checker] Starting stale PR assessment scan...');
  const state = loadPRState(stateFilePath);
  const now = new Date();
  const reports = [];

  for (const [key, entry] of Object.entries(state)) {
    if (!entry || entry.status !== 'open') continue;

    // Check review activity via GitHub API if owner/repo present
    let reviewStatus = { hasBeenReviewed: entry.hasBeenReviewed || false, lastReviewAt: entry.lastReviewAt || null };

    if (entry.owner && entry.repo && entry.number) {
      try {
        const freshDetails = await getPRDetails(entry.owner, entry.repo, entry.number);
        if (freshDetails.state !== 'open') {
          console.log(`[Stale Checker] PR ${key} is now closed/merged. Updating state.`);
          updatePREntry(key, { status: freshDetails.state }, stateFilePath);
          continue;
        }

        const freshReviewStatus = await fetchPRReviewStatus(entry.owner, entry.repo, entry.number);
        if (freshReviewStatus.hasBeenReviewed) {
          reviewStatus = freshReviewStatus;
          updatePREntry(key, { hasBeenReviewed: true, lastReviewAt: freshReviewStatus.lastReviewAt }, stateFilePath);
        }
      } catch (err) {
        console.warn(`[Stale Checker] Could not refresh PR ${key} details:`, err.message);
      }
    }

    // Skip stale escalation if PR has already received review activity
    if (reviewStatus.hasBeenReviewed) {
      console.log(`[Stale Checker] PR ${key} has already received review activity. Skipping escalation.`);
      continue;
    }

    // Measure unreviewed duration from creation/triage timestamp
    const referenceTime = new Date(entry.triagedAt || entry.createdAt || entry.lastActivityAt);
    const diffMs = now.getTime() - referenceTime.getTime();
    const hoursUnreviewed = diffMs / (1000 * 60 * 60);

    const threshold = entry.riskLevel === 'HIGH' ? highRiskThresholdHours : normalThresholdHours;

    if (hoursUnreviewed >= threshold && !entry.staleNudgeSent) {
      console.log(
        `[Stale Checker] PR ${key} is unreviewed (${hoursUnreviewed.toFixed(1)} hrs vs threshold ${threshold} hrs). Triggering escalation.`
      );

      const prDetails = {
        number: entry.number,
        title: entry.title || `PR #${entry.number}`,
        htmlUrl: entry.htmlUrl || '#',
        author: entry.author || 'unknown',
      };

      const card = buildStaleEscalationSlackCard(prDetails, entry, Math.round(hoursUnreviewed * 10) / 10);
      const notifyResult = await sendSlackNotification(card);

      if (notifyResult.success) {
        updatePREntry(
          key,
          {
            staleNudgeSent: true,
            lastNudgeAt: new Date().toISOString(),
          },
          stateFilePath
        );
      }

      reports.push({
        key,
        hoursUnreviewed: Math.round(hoursUnreviewed * 10) / 10,
        riskLevel: entry.riskLevel,
        escalated: notifyResult.success,
      });
    }
  }

  console.log(`[Stale Checker] Scan completed. ${reports.length} escalation(s) triggered.`);
  return reports;
}

// Allow CLI execution if called directly
if (process.argv.includes('--run-once')) {
  checkStalePRs().catch(console.error);
}
