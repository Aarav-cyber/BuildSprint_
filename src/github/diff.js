/**
 * Preprocesses PR diffs and metadata before passing to LLM.
 * Handles truncation for large diffs to keep within token limits.
 */
export function processDiffAndMetadata(prData, maxDiffLength = 8000) {
  const { title, body, files, rawDiff, additions, deletions, changedFilesCount } = prData;

  const summaryHeader = `Title: ${title}\nDescription: ${body || '(No description provided)'}\nStats: +${additions} -${deletions} across ${changedFilesCount} file(s)\n`;

  const fileListStr = files
    .map((f) => `- ${f.filename} (${f.status}, +${f.additions} -${f.deletions})`)
    .join('\n');

  let processedDiff = rawDiff;

  if (!processedDiff && files.length > 0) {
    // Reconstruct lightweight diff from patches
    processedDiff = files
      .map((f) => `--- a/${f.filename}\n+++ b/${f.filename}\n${f.patch || '(No patch available)'}`)
      .join('\n\n');
  }

  const isTruncated = processedDiff.length > maxDiffLength;
  if (isTruncated) {
    processedDiff =
      processedDiff.substring(0, maxDiffLength) +
      `\n\n... [Diff truncated: total length was ${rawDiff.length} chars. Prioritizing top modified files.]`;
  }

  return {
    summaryHeader,
    fileListStr,
    processedDiff,
    isTruncated,
  };
}
