import chalk from 'chalk';
import { getLog, getStatMap } from '../lib/git.js';
import { loadPins, getLatestPin } from '../lib/pins.js';
import { resolvePin } from './shared/resolve.js';

const MSG_MAX = 52;

export async function logCommand(options) {
  try {
    const pins = await loadPins();
    const limit = options.limit ? Number(options.limit) : null;

    if (options.between) {
      const [a, b] = options.between;
      if (!a || !b) {
        throw new Error('Provide two pin labels for --between.');
      }
      await showBetweenPins(a, b, limit);
      return;
    }

    if (options.unpinned) {
      await showUnpinned(pins, limit);
      return;
    }

    if (options.all) {
      await showAll(pins, limit);
      return;
    }

    if (options.pinned) {
      await showPinsOnly(pins, limit);
      return;
    }

    await showAll(pins, limit ?? 10);
  } catch (error) {
    console.error(chalk.red('ERROR: Failed to load log.'), error.message);
    process.exit(1);
  }
}

async function showPinsOnly(pins, limit) {
  if (!pins.length) {
    console.log('No pins yet.');
    return;
  }
  const sorted = [...pins].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  const display = limit ? sorted.slice(0, limit) : sorted;

  const rows = await Promise.all(display.map(async (pin) => {
    const count = await countAutoCommitsBeforePin(pin, pins);
    const suffix = count ? ` (${count} auto-save${count === 1 ? '' : 's'})` : '';
    return {
      hash: pin.hash.slice(0, 7),
      message: truncate(`${pin.label}${suffix}`, MSG_MAX),
      date: new Date(pin.timestamp),
      isPin: true,
    };
  }));

  printGrouped(rows);
}

async function showAll(pins, limit) {
  const log = await getLog(limit ? { maxCount: limit } : {});
  const pinMap = new Map(pins.map((pin) => [pin.hash, pin]));
  const statMap = await getStatMap(log.all.map(c => c.hash));

  const rows = log.all.map((commit) => {
    const pin = pinMap.get(commit.hash);
    const tagMatch = commit.message.match(/^\[vibe:([^\]]+)\]/i);
    const tag = tagMatch ? tagMatch[1].toLowerCase() : null;
    const raw = pin
      ? pin.label
      : commit.message.replace(/^\[vibe:[^\]]+\]\s*/i, '');
    return {
      hash: commit.hash.slice(0, 7),
      message: truncate(raw, MSG_MAX),
      date: new Date(commit.date),
      isPin: !!pin,
      isManual: !pin && !tag,
      tool: tag && tag !== 'auto' && tag !== 'restore' ? tag : null,
      stat: statMap.get(commit.hash) ?? null,
    };
  });

  printGrouped(rows);
}

async function showBetweenPins(labelA, labelB, limit) {
  const pinA = await resolvePin(labelA);
  const pinB = await resolvePin(labelB);
  let log = await getLog({ from: pinA.hash, to: pinB.hash });
  if (!log.all.length) {
    log = await getLog({ from: pinB.hash, to: pinA.hash });
  }
  const commits = log.all.filter((c) => c.hash !== pinA.hash);
  const filtered = commits.filter((c) => c.message.startsWith('[vibe:auto]'));
  const display = limit ? filtered.slice(0, limit) : filtered;

  const rows = display.map((commit) => ({
    hash: commit.hash.slice(0, 7),
    message: truncate(commit.message.replace(/^\[vibe:auto\]\s*/i, ''), MSG_MAX),
    date: new Date(commit.date),
    isPin: false,
  }));

  printGrouped(rows);
}

async function showUnpinned(pins, limit) {
  const latest = getLatestPin(pins);
  if (!latest) {
    console.log('No pins yet.');
    return;
  }
  const log = await getLog({ from: latest.hash, to: 'HEAD' });
  const commits = log.all.filter((c) => c.hash !== latest.hash);
  const filtered = commits.filter((c) => c.message.startsWith('[vibe:auto]'));
  const display = limit ? filtered.slice(0, limit) : filtered;

  const rows = display.map((commit) => ({
    hash: commit.hash.slice(0, 7),
    message: truncate(commit.message.replace(/^\[vibe:auto\]\s*/i, ''), MSG_MAX),
    date: new Date(commit.date),
    isPin: false,
  }));

  printGrouped(rows);
}

function printGrouped(rows) {
  if (!rows.length) {
    console.log(chalk.gray('  No entries.'));
    return;
  }

  let lastDay = null;

  for (const row of rows) {
    const day = formatDay(row.date);

    if (day !== lastDay) {
      if (lastDay !== null) console.log('');
      console.log(chalk.dim('  ' + day));
      console.log(chalk.dim('  ' + '-'.repeat(58)));
      lastDay = day;
    }

    const hash = chalk.yellow(row.hash);
    const bullet = row.isPin ? chalk.yellowBright('*') : chalk.dim('-');
    const msg = row.isPin ? chalk.yellowBright(row.message) : chalk.white(row.message);
    const time = chalk.dim(formatTime(row.date));

    const rawLabel = row.tool ? `[${row.tool}]` : row.isManual ? '[git]' : '';
    const LABEL_WIDTH = 9;
    const labelColor = row.tool === 'claude'
      ? chalk.hex('#FF8C00')
      : row.tool === 'codex'
        ? chalk.blueBright
        : chalk.dim;
    const toolLabel = rawLabel
      ? labelColor(rawLabel.padEnd(LABEL_WIDTH))
      : ' '.repeat(LABEL_WIDTH);

    const stat = row.stat;
    const statStr = stat
      ? [
          stat.ins ? chalk.green(`+${stat.ins}`) : '',
          stat.del ? chalk.red(`-${stat.del}`) : '',
        ].filter(Boolean).join(' ')
      : '';
    const STAT_WIDTH = 10;
    const statPadded = statStr
      ? statStr + ' '.repeat(Math.max(0, STAT_WIDTH - visibleLength(statStr)))
      : ' '.repeat(STAT_WIDTH);

    const left = `  ${hash}  ${toolLabel}${bullet} ${msg}`;
    const targetCol = 80;
    const pad = Math.max(2, targetCol - visibleLength(left));
    console.log(`${left}${' '.repeat(pad)}${statPadded}${time}`);
  }

  console.log('');
}

async function countAutoCommitsBeforePin(pin, pins) {
  const sorted = [...pins].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const index = sorted.findIndex((item) => item.hash === pin.hash);
  if (index === -1) return 0;
  const previous = sorted[index - 1];
  if (!previous) {
    const log = await getLog({ to: pin.hash });
    return log.all.filter((c) => c.message.startsWith('[vibe:auto]') && c.hash !== pin.hash).length;
  }
  const log = await getLog({ from: previous.hash, to: pin.hash });
  return log.all.filter((c) => c.message.startsWith('[vibe:auto]') && c.hash !== previous.hash).length;
}

function truncate(text, max) {
  const cleaned = text.replace(/\s+/g, ' ').trim();
  return cleaned.length > max ? cleaned.slice(0, max - 3) + '...' : cleaned;
}

function formatDay(date) {
  return date.toLocaleString('en-US', { month: 'short', day: 'numeric', year: 'numeric' });
}

function formatTime(date) {
  return date.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit' });
}

function visibleLength(text) {
  return text.replace(/\u001b\[[0-9;]*m/g, '').length;
}
