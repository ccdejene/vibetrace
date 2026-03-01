import chalk from 'chalk';
import { raw, getLog } from '../lib/git.js';
import { loadPins } from '../lib/pins.js';
import { resolveReference } from './shared/resolve.js';

export async function showCommand(reference) {
  try {
    const target = await resolveReference(reference);
    const pins = await loadPins();
    const pin = pins.find((p) => p.hash === target.hash);

    const commit = await getCommitDetails(target.hash);
    const files = await getFilesChanged(target.hash);
    const time = formatDate(commit.date || new Date());

    if (pin) {
      const changes = await countChangesSincePreviousPin(pin, pins);
      console.log('');
      console.log(`  ${chalk.yellowBright('PIN')} ${chalk.yellowBright.bold(pin.label)}`);
      console.log(`  ${chalk.dim('-'.repeat(58))}`);
      console.log(`  ${chalk.dim('Hash')}   ${chalk.cyan(pin.hash)}`);
      console.log(`  ${chalk.dim('Time')}   ${chalk.white(time)}`);
      console.log('');
      console.log(`  ${chalk.dim('Message')}`);
      console.log(`  ${chalk.white(commit.subject)}`);
      if (commit.body) {
        console.log('');
        console.log(`  ${chalk.dim('Full prompt')}`);
        for (const line of commit.body.split('\n')) {
          console.log(`  ${chalk.white(line)}`);
        }
      }
      console.log('');
      console.log(`  ${chalk.dim('Files changed')}`);
      for (const file of files) {
        console.log(`  ${chalk.dim('-')} ${chalk.white(file)}`);
      }
      console.log('');
      console.log(`  ${chalk.dim(`${changes} auto-commit${changes === 1 ? '' : 's'} since previous pin`)}`);
      console.log('');
      return;
    }

    console.log('');
    console.log(`  ${chalk.hex('#FF8C00')('-')} ${chalk.white.bold(commit.subject)}`);
    console.log(`  ${chalk.dim('-'.repeat(58))}`);
    console.log(`  ${chalk.dim('Hash')}   ${chalk.yellow(target.hash)}`);
    console.log(`  ${chalk.dim('Time')}   ${chalk.white(time)}`);
    if (commit.body) {
      console.log('');
      console.log(`  ${chalk.dim('Full prompt')}`);
      for (const line of commit.body.split('\n')) {
        console.log(`  ${chalk.white(line)}`);
      }
    }
    console.log('');
    console.log(`  ${chalk.dim('Files changed')}`);
    for (const file of files) {
      console.log(`  ${chalk.dim('-')} ${chalk.white(file)}`);
    }
    console.log('');
  } catch (error) {
    console.error(chalk.red('ERROR: Failed to show commit.'), error.message);
    process.exit(1);
  }
}

async function getFilesChanged(hash) {
  const output = await raw(['show', '--name-only', '--pretty=format:', hash]);
  return output.split('\n').map((line) => line.trim()).filter(Boolean);
}

async function getCommitDetails(hash) {
  const output = await raw(['show', '-s', '--format=%H%x00%ad%x00%B', hash]);
  const [commitHash, date, ...bodyParts] = output.trim().split('\x00');
  const full = bodyParts.join('').trim();
  const lines = full.split('\n');
  const subject = lines[0].replace(/^\[vibe:[^\]]+\]\s*/i, '').trim();
  const body = lines.slice(2).join('\n').trim() || null; // body starts after blank line
  return { hash: commitHash, date, subject, body };
}

async function countChangesSincePreviousPin(pin, pins) {
  const sorted = [...pins].sort((a, b) => new Date(a.timestamp) - new Date(b.timestamp));
  const index = sorted.findIndex((p) => p.hash === pin.hash);
  if (index <= 0) return 0;
  const previous = sorted[index - 1];
  const log = await getLog({ from: previous.hash, to: pin.hash });
  return log.all.filter((commit) => commit.message.startsWith('[vibe:auto]') && commit.hash !== previous.hash).length;
}

function formatDate(value) {
  const date = new Date(value);
  return date.toLocaleString('en-US', { hour: 'numeric', minute: '2-digit', month: 'short', day: 'numeric', year: 'numeric' });
}
