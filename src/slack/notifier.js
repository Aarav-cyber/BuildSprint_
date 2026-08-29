/**
 * Generates Slack Block Kit payload for PR triage analysis.
 */
export function buildTriageSlackCard(prData, analysis) {
  const { number, title, htmlUrl, author, headBranch, baseBranch } = prData;
  const { summary, risk, reviewers } = analysis;

  const riskEmoji = risk.level === 'HIGH' ? '🔴' : risk.level === 'MEDIUM' ? '🟡' : '🟢';
  const headerText = `🚦 PR TRIAGE — #${number}: ${title}`;

  const topReviewer = reviewers && reviewers.length > 0 ? reviewers[0] : null;

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: headerText.slice(0, 150),
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Author:* \`@${author}\` | *Branch:* \`${headBranch}\` ➔ \`${baseBranch}\``,
      },
    },
    {
      type: 'divider',
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*📝 Plain-English Intent Summary*\n${summary}`,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*⚠️ Risk Classification*\n${riskEmoji} *${risk.level}* (${risk.score}/100)`,
        },
        {
          type: 'mrkdwn',
          text: `*👤 Suggested Reviewer*\n${topReviewer ? `\`@${topReviewer.username}\`` : '_No direct match_'}`,
        },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Why this risk level?*\n${
          risk.reasons && risk.reasons.length > 0
            ? risk.reasons.map((r) => `• ${r}`).join('\n')
            : '• Standard changes with minimal risk signals'
        }`,
      },
    },
  ];

  if (topReviewer) {
    blocks.push({
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `*Why suggested \`@${topReviewer.username}\`?*\n${
          topReviewer.reason ? `• ${topReviewer.reason}` : '• Recommended based on repository ownership and history'
        }`,
      },
    });
  }

  blocks.push(
    {
      type: 'divider',
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '🔗 View Pull Request',
            emoji: true,
          },
          url: htmlUrl,
          style: 'primary',
        },
      ],
    }
  );

  return { blocks };
}

/**
 * Generates Slack Block Kit payload for stale PR escalation.
 */
export function buildStaleEscalationSlackCard(prData, stateEntry, hoursUnreviewed) {
  const { number, title, htmlUrl, author } = prData;
  const { riskLevel, assignedReviewer } = stateEntry;

  const isHighRisk = riskLevel === 'HIGH';
  const headerText = isHighRisk
    ? `🚨 HIGH-RISK PR STALE ESCALATION — #${number}`
    : `⏰ PR REVIEW OVERDUE — #${number}`;

  const blocks = [
    {
      type: 'header',
      text: {
        type: 'plain_text',
        text: headerText.slice(0, 150),
        emoji: true,
      },
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: `Pull request *<${htmlUrl}|#${number}: ${title}>* by \`@${author}\` has been waiting for review for *${hoursUnreviewed} hours*.`,
      },
    },
    {
      type: 'section',
      fields: [
        {
          type: 'mrkdwn',
          text: `*Risk Level:* ${isHighRisk ? '🔴 *HIGH*' : riskLevel === 'MEDIUM' ? '🟡 *MEDIUM*' : '🟢 *LOW*'}`,
        },
        {
          type: 'mrkdwn',
          text: `*Assigned Reviewer:* ${assignedReviewer ? `\`@${assignedReviewer}\`` : 'Unassigned'}`,
        },
      ],
    },
    {
      type: 'section',
      text: {
        type: 'mrkdwn',
        text: isHighRisk
          ? '⚡ *Action Needed:* High-risk changes require urgent review to avoid blocking deployment queues.'
          : '📌 Please review when you have a moment to keep PR queues moving smoothly.',
      },
    },
    {
      type: 'actions',
      elements: [
        {
          type: 'button',
          text: {
            type: 'plain_text',
            text: '⚡ Review PR Now',
            emoji: true,
          },
          url: htmlUrl,
          style: isHighRisk ? 'danger' : 'primary',
        },
      ],
    },
  ];

  return { blocks };
}

/**
 * Sends a Slack payload via Incoming Webhook.
 */
export async function sendSlackNotification(payload) {
  const webhookUrl = process.env.SLACK_WEBHOOK_URL;

  if (!webhookUrl || webhookUrl.includes('YOUR/WEBHOOK/URL')) {
    console.warn('[Slack Notifier] SLACK_WEBHOOK_URL not configured. Card payload preview:');
    console.log(JSON.stringify(payload, null, 2));
    return { success: false, reason: 'Webhook URL not configured' };
  }

  try {
    const res = await fetch(webhookUrl, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload),
    });

    if (res.ok) {
      console.log('[Slack Notifier] Slack notification sent successfully.');
      return { success: true };
    } else {
      const errText = await res.text();
      console.error('[Slack Notifier] Slack notification failed:', res.status, errText);
      return { success: false, reason: errText };
    }
  } catch (err) {
    console.error('[Slack Notifier] Error posting to Slack:', err.message);
    return { success: false, reason: err.message };
  }
}
