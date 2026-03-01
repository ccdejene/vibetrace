import { autoCommitIfNeeded } from '../lib/auto-commit.js';
import { readIntentMessage, normalizeIntentMessage, clearIntent } from '../lib/intent.js';

export async function commitCommand(options = {}) {
  const intent = await readIntentMessage();
  const tool = options.tool || intent?.tool || null;
  const intentMessage = intent ? normalizeIntentMessage(intent.message, tool) : null;
  const result = await autoCommitIfNeeded(intentMessage || undefined);
  if (result.committed && intent?.source) {
    await clearIntent(intent.source);
  }
}
