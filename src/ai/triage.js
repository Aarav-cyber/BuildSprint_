import Groq from 'groq-sdk';

/**
 * Creates Groq SDK client if API key is present.
 */
export function getGroqClient() {
  const apiKey = process.env.GROQ_API_KEY;
  if (!apiKey) {
    return null;
  }
  return new Groq({ apiKey });
}

/**
 * Main AI Analysis function using Groq Llama 3.3 70B (with Llama 3.1 8B fallback).
 */
export async function analyzePRWithGroq(prData, deterministicRisk, reviewerCandidates = []) {
  const client = getGroqClient();

  if (!client) {
    console.warn('GROQ_API_KEY not set. Using fallback mock AI analysis.');
    return generateFallbackAIAnalysis(prData, deterministicRisk, reviewerCandidates);
  }

  const prompt = `
You are an expert AI PR Triage Assistant.
Analyze the following pull request details and return ONLY a valid JSON object.

### Pull Request Metadata
Title: ${prData.title}
Description: ${prData.body || '(No description)'}
Author: ${prData.author}
Branch: ${prData.headBranch} -> ${prData.baseBranch}
Stats: +${prData.additions} -${prData.deletions} in ${prData.changedFilesCount} files
Is Draft: ${prData.draft}

### Changed Files
${prData.files.map((f) => `- ${f.filename} (+${f.additions} -${f.deletions})`).join('\n')}

### Sample Diff / Patches
${prData.rawDiff.substring(0, 6000) || '(No diff available)'}

### Deterministic Risk Pre-Assessment
Calculated Level: ${deterministicRisk.level} (Score: ${deterministicRisk.score}/100)
Detected Signals: ${deterministicRisk.reasons.join('; ') || 'None'}

### Available Reviewer Candidates (from CODEOWNERS / History)
${
  reviewerCandidates.length > 0
    ? reviewerCandidates.map((r) => `- ${r.username}: ${r.reason}`).join('\n')
    : 'No candidates matched automatically.'
}

### Instructions
Return ONLY a JSON object with this exact structure:
{
  "summary": "1-2 sentence plain English explanation of what this PR does",
  "risk": {
    "level": "LOW" | "MEDIUM" | "HIGH",
    "score": number (0-100),
    "reasons": ["Reason 1", "Reason 2"]
  },
  "reviewers": [
    {
      "username": "suggested_username",
      "reason": "Clear justification based on CODEOWNERS, blame, or module knowledge"
    }
  ]
}
`;

  const models = ['llama-3.3-70b-versatile', 'llama-3.1-8b-instant'];

  for (const model of models) {
    try {
      const response = await client.chat.completions.create({
        messages: [
          {
            role: 'system',
            content:
              'You are a strict JSON PR triage generator. Output valid JSON only without markdown code blocks or additional text.',
          },
          { role: 'user', content: prompt },
        ],
        model,
        temperature: 0.2,
        response_format: { type: 'json_object' },
      });

      const content = response.choices[0]?.message?.content?.trim();
      if (content) {
        const parsed = JSON.parse(content);
        if (parsed.summary && parsed.risk && Array.isArray(parsed.reviewers)) {
          return parsed;
        }
      }
    } catch (err) {
      console.warn(`Groq API call failed with model ${model}:`, err.message);
    }
  }

  return generateFallbackAIAnalysis(prData, deterministicRisk, reviewerCandidates);
}

/**
 * Generates structured analysis if Groq is unavailable or fails.
 */
export function generateFallbackAIAnalysis(prData, deterministicRisk, reviewerCandidates) {
  let summary = `Modifies ${prData.changedFilesCount} file(s) (+${prData.additions} -${prData.deletions}).`;
  if (prData.title) {
    summary = `PR "${prData.title}": ${prData.body ? prData.body.slice(0, 120) + '...' : 'Updates repository code.'}`;
  }

  const reviewers = reviewerCandidates.length > 0
    ? reviewerCandidates.slice(0, 2)
    : [
        {
          username: 'team-lead',
          reason: 'Default fallback assignment (no explicit ownership found)',
        },
      ];

  return {
    summary,
    risk: {
      level: deterministicRisk.level,
      score: deterministicRisk.score,
      reasons: deterministicRisk.reasons.length > 0 ? deterministicRisk.reasons : ['Standard code change'],
    },
    reviewers,
  };
}
