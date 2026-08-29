import { Octokit } from '@octokit/rest';

/**
 * Creates an Octokit instance if GITHUB_TOKEN is available.
 */
export function getOctokit() {
  const token = process.env.GITHUB_TOKEN;
  if (!token) {
    return new Octokit(); // Unauthenticated client
  }
  return new Octokit({ auth: token });
}

/**
 * Fetches comprehensive PR details including metadata, changed files, and raw diff.
 */
export async function getPRDetails(owner, repo, pullNumber) {
  const octokit = getOctokit();

  // Fetch PR metadata
  const { data: pr } = await octokit.pulls.get({
    owner,
    repo,
    pull_number: pullNumber,
  });

  // Fetch files changed
  const { data: files } = await octokit.pulls.listFiles({
    owner,
    repo,
    pull_number: pullNumber,
    per_page: 100,
  });

  // Fetch PR raw diff
  let rawDiff = '';
  try {
    const { data: diffData } = await octokit.pulls.get({
      owner,
      repo,
      pull_number: pullNumber,
      headers: { accept: 'application/vnd.github.v3.diff' },
    });
    rawDiff = typeof diffData === 'string' ? diffData : '';
  } catch (err) {
    console.warn('Could not fetch raw diff:', err.message);
  }

  return {
    number: pr.number,
    title: pr.title,
    body: pr.body || '',
    author: pr.user?.login || 'unknown',
    state: pr.state,
    draft: pr.draft || false,
    htmlUrl: pr.html_url,
    createdAt: pr.created_at,
    updatedAt: pr.updated_at,
    baseBranch: pr.base.ref,
    headBranch: pr.head.ref,
    additions: pr.additions,
    deletions: pr.deletions,
    changedFilesCount: pr.changed_files,
    files: files.map((f) => ({
      filename: f.filename,
      status: f.status,
      additions: f.additions,
      deletions: f.deletions,
      changes: f.changes,
      patch: f.patch || '',
    })),
    rawDiff,
  };
}

/**
 * Fetches CODEOWNERS content from repository root or .github/ folder.
 */
export async function fetchCodeowners(owner, repo) {
  const octokit = getOctokit();
  const possiblePaths = ['CODEOWNERS', '.github/CODEOWNERS', 'docs/CODEOWNERS'];

  for (const path of possiblePaths) {
    try {
      const { data } = await octokit.repos.getContent({ owner, repo, path });
      if (data && data.content) {
        return Buffer.from(data.content, 'base64').toString('utf-8');
      }
    } catch {
      // Ignore 404s
    }
  }
  return null;
}

/**
 * Fetches recent review history for given files.
 */
export async function fetchRecentReviewHistory(owner, repo, changedFilePaths = []) {
  const octokit = getOctokit();
  const reviewerCounts = {};

  try {
    // Fetch last 15 closed/merged PRs
    const { data: prs } = await octokit.pulls.list({
      owner,
      repo,
      state: 'closed',
      per_page: 15,
      sort: 'updated',
      direction: 'desc',
    });

    for (const pr of prs) {
      if (!pr.merged_at) continue;

      // Fetch reviews for merged PR
      const { data: reviews } = await octokit.pulls.listReviews({
        owner,
        repo,
        pull_number: pr.number,
      });

      // Fetch files in this PR
      const { data: files } = await octokit.pulls.listFiles({
        owner,
        repo,
        pull_number: pr.number,
      });

      const prFilePaths = files.map((f) => f.filename);
      const touchesSameFiles = changedFilePaths.some((p) => prFilePaths.includes(p));

      if (touchesSameFiles || changedFilePaths.length === 0) {
        for (const review of reviews) {
          if (review.user && review.user.login) {
            const user = review.user.login;
            reviewerCounts[user] = (reviewerCounts[user] || 0) + 1;
          }
        }
      }
    }
  } catch (err) {
    console.warn('Failed to fetch recent review history:', err.message);
  }

  return reviewerCounts;
}

/**
 * Parses CODEOWNERS text into rule objects.
 */
export function parseCodeowners(codeownersText) {
  if (!codeownersText) return [];
  const lines = codeownersText.split('\n');
  const rules = [];

  for (const line of lines) {
    const trimmed = line.trim();
    if (!trimmed || trimmed.startsWith('#')) continue;

    const parts = trimmed.split(/\s+/);
    if (parts.length >= 2) {
      const pattern = parts[0];
      const owners = parts.slice(1).map((o) => o.replace(/^@/, ''));
      rules.push({ pattern, owners });
    }
  }
  return rules;
}

/**
 * Matches changed file paths against CODEOWNERS rules.
 */
export function matchCodeowners(filePaths, rules) {
  const matches = new Map();

  for (const filePath of filePaths) {
    for (const rule of rules) {
      const pattern = rule.pattern.replace(/\*/g, '.*');
      const regex = new RegExp(`^${pattern}`);
      if (regex.test(filePath) || filePath.includes(rule.pattern.replace(/\//g, ''))) {
        for (const owner of rule.owners) {
          matches.set(owner, (matches.get(owner) || 0) + 1);
        }
      }
    }
  }

  return Array.from(matches.entries()).map(([owner, count]) => ({
    username: owner,
    reason: `CODEOWNER rule matched for ${count} changed file(s)`,
  }));
}
