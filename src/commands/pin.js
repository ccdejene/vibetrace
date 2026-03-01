import chalk from 'chalk';
import { hasUncommittedChanges, getHeadHash, getLog, addTag } from '../lib/git.js';
import { loadPins, savePins, getLatestPin } from '../lib/pins.js';
import { autoCommitIfNeeded } from '../lib/auto-commit.js';

export async function pinCommand(label) {
  try {
    const hasChanges = await hasUncommittedChanges();
    if (hasChanges) {
      await autoCommitIfNeeded();
    }

    const hash = await getHeadHash();
    const timestamp = new Date().toISOString();
    const tag = `vibe-pin-${formatTimestamp(new Date())}`;
    const pins = await loadPins();

    const resolvedLabel = label || await generateLabelFromLastCommit();
    const autoCommitsSinceLastPin = await countAutoCommitsSinceLastPin(pins);

    await addTag(tag, hash);

    pins.push({
      label: resolvedLabel,
      hash,
      timestamp,
      tag,
      auto_commits_since_last_pin: autoCommitsSinceLastPin
    });

    await savePins(pins);

    console.log(chalk.yellow(`PINNED: "${resolvedLabel}" (${hash.slice(0, 7)})`));
  } catch (error) {
    console.error(chalk.red('ERROR: Failed to pin current state.'), error.message);
    process.exit(1);
  }
}

async function generateLabelFromLastCommit() {
  const log = await getLog({ maxCount: 1 });
  const message = log.latest?.message || 'Checkpoint';
  const cleaned = message.replace(/^\[vibe:auto\]\s*/i, '').trim();
  return cleaned || 'Checkpoint';
}

function formatTimestamp(date) {
  const pad = (n) => String(n).padStart(2, '0');
  return `${date.getUTCFullYear()}${pad(date.getUTCMonth() + 1)}${pad(date.getUTCDate())}T${pad(date.getUTCHours())}${pad(date.getUTCMinutes())}${pad(date.getUTCSeconds())}`;
}

async function countAutoCommitsSinceLastPin(pins) {
  if (!pins.length) {
    const log = await getLog();
    return log.all.filter((commit) => commit.message.startsWith('[vibe:auto]')).length;
  }
  const latest = getLatestPin(pins);
  const log = await getLog({ from: latest.hash, to: 'HEAD' });
  return log.all.filter((commit) => commit.message.startsWith('[vibe:auto]') && commit.hash !== latest.hash).length;
}
