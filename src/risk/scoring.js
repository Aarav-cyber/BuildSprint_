/**
 * Evaluates PR risk using deterministic signals:
 * - Sensitive file paths (auth, payments, migrations, infrastructure)
 * - Diff size (lines added/deleted, file count)
 * - Test presence (added/modified tests vs total changes)
 * - Feature flags or security impact keywords
 */
export function calculateDeterministicRisk(prData) {
  let score = 10; // Baseline
  const reasons = [];

  const sensitivePaths = [
    { pattern: /auth|jwt|security|password/i, label: 'Authentication / Security', points: 30 },
    { pattern: /payment|stripe|billing|checkout/i, label: 'Payments / Billing', points: 35 },
    { pattern: /migration|schema|db\/|prisma|migrate/i, label: 'Database Schema / Migration', points: 30 },
    { pattern: /\.env|config|secrets|infra\/|k8s\/|docker/i, label: 'Infrastructure / Secrets / Config', points: 25 },
  ];

  const files = prData.files || [];
  const fileNames = files.map((f) => f.filename);

  // 1. Path-based risk signals
  for (const pathCheck of sensitivePaths) {
    const matchedFiles = fileNames.filter((f) => pathCheck.pattern.test(f));
    if (matchedFiles.length > 0) {
      score += pathCheck.points;
      reasons.push(`Touches ${pathCheck.label} (${matchedFiles.length} file(s))`);
    }
  }

  // 2. Diff size risk signals
  const totalChanges = (prData.additions || 0) + (prData.deletions || 0);
  if (totalChanges > 1000) {
    score += 25;
    reasons.push(`Large diff size (${totalChanges} total lines changed)`);
  } else if (totalChanges > 300) {
    score += 15;
    reasons.push(`Moderate diff size (${totalChanges} total lines changed)`);
  }

  if (files.length > 15) {
    score += 15;
    reasons.push(`Touches many files (${files.length} files)`);
  }

  // 3. Test presence signals
  const hasTests = fileNames.some((f) => /\btest\b|\bspec\b|__tests__/i.test(f));
  if (!hasTests && totalChanges > 50 && !fileNames.every((f) => f.endsWith('.md') || f.endsWith('.txt'))) {
    score += 20;
    reasons.push('No tests added or updated for non-trivial code changes');
  } else if (hasTests) {
    score = Math.max(0, score - 10);
  }

  // 4. Docs/Trivial changes
  const isOnlyDocs = fileNames.every((f) => f.endsWith('.md') || f.endsWith('.txt') || f.startsWith('docs/'));
  if (isOnlyDocs) {
    score = 5;
    reasons.length = 0;
    reasons.push('Documentation/markdown only changes');
  }

  // Cap score at 0 - 100
  const finalScore = Math.min(100, Math.max(0, score));

  let level = 'LOW';
  if (finalScore >= 65) {
    level = 'HIGH';
  } else if (finalScore >= 35) {
    level = 'MEDIUM';
  }

  return {
    score: finalScore,
    level,
    reasons,
  };
}

/**
 * Blends deterministic risk assessment with AI risk assessment.
 */
export function blendRiskAssessments(deterministicRisk, aiRisk) {
  if (!aiRisk) return deterministicRisk;

  const combinedScore = Math.round(
    deterministicRisk.score * 0.5 + (aiRisk.score || deterministicRisk.score) * 0.5
  );

  const combinedReasons = Array.from(
    new Set([...deterministicRisk.reasons, ...(aiRisk.reasons || [])])
  );

  let combinedLevel = 'LOW';
  if (combinedScore >= 65) {
    combinedLevel = 'HIGH';
  } else if (combinedScore >= 35) {
    combinedLevel = 'MEDIUM';
  }

  return {
    score: combinedScore,
    level: combinedLevel,
    reasons: combinedReasons,
  };
}
