/**
 * Ranks reviewer candidates using multi-factor evidence:
 * 1. CODEOWNERS matches
 * 2. Recent review activity on the touched files/modules
 * 3. PR author exclusion (cannot review own PR)
 */
export function rankReviewerCandidates(codeownerMatches = [], reviewHistory = {}, prAuthor = '') {
  const scores = new Map();
  const rationale = new Map();

  // Helper to add score
  const addScore = (username, points, reason) => {
    if (!username || username.toLowerCase() === prAuthor.toLowerCase()) return;

    scores.set(username, (scores.get(username) || 0) + points);
    if (!rationale.has(username)) {
      rationale.set(username, []);
    }
    rationale.get(username).push(reason);
  };

  // Factor 1: CODEOWNERS (highest weight)
  for (const match of codeownerMatches) {
    addScore(match.username, 50, match.reason);
  }

  // Factor 2: Review history
  for (const [reviewer, count] of Object.entries(reviewHistory)) {
    const points = Math.min(40, count * 10);
    addScore(reviewer, points, `Reviewed ${count} recent PR(s) touching related files`);
  }

  // Convert map to sorted array
  const candidates = Array.from(scores.keys()).map((username) => ({
    username,
    score: scores.get(username),
    reasons: rationale.get(username) || [],
    reason: (rationale.get(username) || []).join('; '),
  }));

  candidates.sort((a, b) => b.score - a.score);

  return candidates;
}
