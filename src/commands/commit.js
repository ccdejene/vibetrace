import { autoCommitIfNeeded } from '../lib/auto-commit.js';
import { readIntentMessage, normalizeIntentMessage, clearIntent } from '../lib/intent.js';

export async function commitCommand() {
  const intent = await readIntentMessage();
  const intentMessage = intent ? normalizeIntentMessage(intent.message, intent.tool) : null;
  const result = await autoCommitIfNeeded(intentMessage || undefined);
  if (result.committed && intent?.source) {
    await clearIntent(intent.source);
  }
}
