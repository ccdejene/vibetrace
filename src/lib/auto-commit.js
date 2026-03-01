import { stageAll, raw, commit } from './git.js';
import { generateCommitMessage } from './commit-message.js';

export async function autoCommitIfNeeded(fallbackMessage) {
  await stageAll();
  const nameStatus = await raw(['diff', '--name-status', '--cached']);
  const lines = nameStatus.split('\n').filter(Boolean);
  if (!lines.length) return { committed: false, message: null };
  const message = fallbackMessage || generateCommitMessage(lines);
  await commit(message);
  return { committed: true, message };
}
