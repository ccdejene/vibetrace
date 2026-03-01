import { autoCommitIfNeeded } from '../lib/auto-commit.js';
import { readIntentMessage, normalizeIntentMessage, clearIntent } from '../lib/intent.js';
import { summarizeDiff } from '../lib/summarize.js';

export async function commitCommand(options = {}) {
  const intent = await readIntentMessage();
  const tool = options.tool || intent?.tool || null;
  let intentMessage = intent ? normalizeIntentMessage(intent.message, tool) : null;

  // No intent saved — try to generate a summary from the diff using available API
  if (!intentMessage && tool) {
    intentMessage = await summarizeDiff(tool);
  }

  const result = await autoCommitIfNeeded(intentMessage || undefined);
  if (result.committed && intent?.source) {
    await clearIntent(intent.source);
  }
}
