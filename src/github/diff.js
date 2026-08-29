/**
 * Preprocesses PR diffs and metadata before passing to LLM.
 * Safely handles missing raw diffs, large diffs, empty diffs, deleted/renamed/binary files.
 */
export function processDiffAndMetadata(prData, maxDiffLength = 8000) {
  const { title, body, files = [], rawDiff = '', additions = 0, deletions = 0, changedFilesCount = 0 } = prData;

  const summaryHeader = `Title: ${title || 'Untitled PR'}\nDescription: ${body || '(No description provided)'}\nStats: +${additions} -${deletions} across ${changedFilesCount || files.length} file(s)\n`;

  const fileListStr = files
    .map((f) => `- ${f.filename} (${f.status || 'modified'}, +${f.additions || 0} -${f.deletions || 0})`)
    .join('\n');

  let processedDiff = rawDiff || '';

  // If rawDiff is missing or empty, reconstruct diff representation from file patches
  if (!processedDiff.trim() && files.length > 0) {
    processedDiff = files
      .map((f) => {
        if (f.patch) {
          return `--- a/${f.filename}\n+++ b/${f.filename}\n${f.patch}`;
        }
        if (f.status === 'removed') {
          return `--- a/${f.filename}\n+++ /dev/null\n(File deleted)`;
        }
        if (f.status === 'added') {
          return `--- /dev/null\n+++ b/${f.filename}\n(New file added)`;
        }
        if (f.status === 'renamed') {
          return `--- a/${f.previous_filename || f.filename}\n+++ b/${f.filename}\n(File renamed)`;
        }
        return `--- a/${f.filename}\n+++ b/${f.filename}\n(Binary file or patch not available)`;
      })
      .join('\n\n');
  }

  if (!processedDiff.trim()) {
    processedDiff = '(No code changes or diff available)';
  }

  const originalLength = processedDiff.length;
  const isTruncated = originalLength > maxDiffLength;

  if (isTruncated) {
    processedDiff =
      processedDiff.substring(0, maxDiffLength) +
      `\n\n... [Diff truncated: total size ${originalLength} characters. Prioritizing initial changes.]`;
  }

  return {
    summaryHeader,
    fileListStr,
    processedDiff,
    isTruncated,
    originalLength,
  };
}
