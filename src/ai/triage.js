import { processDiffAndMetadata } from '../github/diff.js';

/**
 * Returns whether Gemini is configured.
 */
export function hasGeminiClient() {
  return Boolean(process.env.GEMINI_API_KEY);
}

/**
 * Calls Gemini using the REST API.
 *
 * We use the REST API directly instead of adding another SDK dependency.
 */
async function callGemini(prompt, model = 'gemini-2.5-flash') {
  const apiKey = process.env.GEMINI_API_KEY;

  if (!apiKey) {
    return null;
  }

  const url =
    `https://generativelanguage.googleapis.com/v1beta/models/` +
    `${model}:generateContent?key=${apiKey}`;

  const response = await fetch(url, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
    },
    body: JSON.stringify({
      contents: [
        {
          role: 'user',
          parts: [
            {
              text: prompt,
            },
          ],
        },
      ],
      generationConfig: {
        temperature: 0.2,
        responseMimeType: 'application/json',
      },
    }),
  });

  if (!response.ok) {
    const errorText = await response.text();
    throw new Error(`Gemini API ${response.status}: ${errorText}`);
  }

  const data = await response.json();

  const content =
    data.candidates?.[0]?.content?.parts
      ?.map((part) => part.text || '')
      .join('')
      .trim();

  if (!content) {
    throw new Error('Gemini returned an empty response');
  }

  return content;
}

/**
 * Main AI Analysis function using Gemini.
 *
 * Kept under the old function name so existing webhook/test imports
 * continue working without requiring changes elsewhere.
 */
export async function analyzePRWithGroq(
  prData,
  deterministicRisk,
  reviewerCandidates = []
) {
  return analyzePRWithGemini(
    prData,
    deterministicRisk,
    reviewerCandidates
  );
}

/**
 * Main AI Analysis function using Gemini.
 */
export async function analyzePRWithGemini(
  prData,
  deterministicRisk,
  reviewerCandidates = []
) {
  // Process diff via dedicated diff processing layer
  const {
    summaryHeader,
    fileListStr,
    processedDiff,
  } = processDiffAndMetadata(prData, 7000);

  if (!hasGeminiClient()) {
    console.warn(
      'GEMINI_API_KEY not set. Using fallback mock AI analysis.'
    );

    return generateFallbackAIAnalysis(
      prData,
      deterministicRisk,
      reviewerCandidates
    );
  }

  const prompt = `
You are an expert AI PR Triage Assistant.

Analyze the following pull request and return ONLY a valid JSON object.

### Pull Request Metadata
${summaryHeader}
Author: ${prData.author}
Branch: ${prData.headBranch} -> ${prData.baseBranch}
Is Draft: ${prData.draft}

### Changed Files
${fileListStr || '(No files specified)'}

### Code Changes / Diff
${processedDiff}

### Deterministic Risk Pre-Assessment
Calculated Level: ${deterministicRisk.level}
Calculated Score: ${deterministicRisk.score}/100
Detected Signals: ${
    deterministicRisk.reasons.join('; ') || 'None'
}

### Available Reviewer Candidates
${
  reviewerCandidates.length > 0
    ? reviewerCandidates
        .map((r) => `- ${r.username}: ${r.reason}`)
        .join('\n')
    : 'No candidates matched automatically.'
}

### Instructions

Analyze the PR carefully.

Return ONLY a JSON object with exactly this structure:

{
  "summary": "1-2 sentence plain English explanation of what this PR does",
  "risk": {
    "level": "LOW",
    "score": 0,
    "reasons": ["Reason 1", "Reason 2"]
  },
  "suggested_reviewer_username": null
}

Rules:

1. risk.level MUST be exactly one of:
   LOW
   MEDIUM
   HIGH

2. risk.score MUST be a number from 0 to 100.

3. risk.reasons MUST be an array of strings.

4. suggested_reviewer_username MUST either:
   - be one of the usernames listed in Available Reviewer Candidates, or
   - be null.

5. NEVER invent a reviewer username.

6. If there are no strong reviewer candidates, use null.

7. Do not include Markdown.

8. Do not include code fences.

9. Return valid JSON only.
`;

  // Primary Gemini model
  const models = [
    'gemini-2.5-flash',
    'gemini-2.0-flash',
  ];

  for (const model of models) {
    try {
      console.log(`[Gemini] Calling model ${model}...`);

      const content = await callGemini(prompt, model);

      const parsed = JSON.parse(content);

      if (!parsed.summary || !parsed.risk) {
        throw new Error('Gemini response missing summary or risk');
      }

      // -----------------------------
      // Validate risk
      // -----------------------------

      const validLevel = ['LOW', 'MEDIUM', 'HIGH'].includes(
        parsed.risk.level
      )
        ? parsed.risk.level
        : deterministicRisk.level;

      const numericScore = Number(parsed.risk.score);

      const validScore =
        Number.isFinite(numericScore) &&
        numericScore >= 0 &&
        numericScore <= 100
          ? numericScore
          : deterministicRisk.score;

      const validReasons = Array.isArray(parsed.risk.reasons)
        ? parsed.risk.reasons
        : deterministicRisk.reasons;

      // -----------------------------
      // Validate reviewer
      // -----------------------------

      let finalReviewers = reviewerCandidates;

      if (
        parsed.suggested_reviewer_username &&
        reviewerCandidates.length > 0
      ) {
        const suggestedUsername =
          String(parsed.suggested_reviewer_username).toLowerCase();

        const matchedCandidate = reviewerCandidates.find(
          (candidate) =>
            candidate.username.toLowerCase() === suggestedUsername
        );

        // IMPORTANT:
        // Only accept reviewers that already exist in the
        // evidence-backed candidate list.
        if (matchedCandidate) {
          finalReviewers = [
            matchedCandidate,
            ...reviewerCandidates.filter(
              (candidate) =>
                candidate.username !== matchedCandidate.username
            ),
          ];
        } else {
          console.warn(
            `[Gemini] Ignoring unsupported reviewer suggestion: ${parsed.suggested_reviewer_username}`
          );
        }
      }

      console.log(
        `[Gemini] Analysis successful using ${model}`
      );

      return {
        summary: parsed.summary,
        risk: {
          level: validLevel,
          score: validScore,
          reasons: validReasons,
        },
        reviewers: finalReviewers,
      };
    } catch (err) {
      console.warn(
        `[Gemini] API call failed with model ${model}:`,
        err.message
      );
    }
  }

  console.warn(
    '[Gemini] All configured models failed. Using deterministic fallback.'
  );

  return generateFallbackAIAnalysis(
    prData,
    deterministicRisk,
    reviewerCandidates
  );
}

/**
 * Generates structured analysis if Gemini is unavailable or fails.
 */
export function generateFallbackAIAnalysis(
  prData,
  deterministicRisk,
  reviewerCandidates = []
) {
  let summary = `Modifies ${
    prData.changedFilesCount ||
    prData.files?.length ||
    0
  } file(s) (+${prData.additions || 0} -${
    prData.deletions || 0
  }).`;

  if (prData.title) {
    summary = `PR "${prData.title}": ${
      prData.body
        ? prData.body.slice(0, 120) + '...'
        : 'Updates repository code.'
    }`;
  }

  return {
    summary,

    risk: {
      level: deterministicRisk.level,
      score: deterministicRisk.score,
      reasons:
        deterministicRisk.reasons.length > 0
          ? deterministicRisk.reasons
          : ['Standard code change'],
    },

    reviewers: reviewerCandidates,
  };
}