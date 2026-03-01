import chalk from 'chalk';
import { diff as gitDiff } from '../lib/git.js';
import { loadPins, getLatestPin } from '../lib/pins.js';
import { resolveReference } from './shared/resolve.js';

export async function diffCommand(ref1, ref2) {
  try {
    const pins = await loadPins();

    if (!ref1 && !ref2) {
      const latest = getLatestPin(pins);
      if (!latest) {
        console.log('No pins yet.');
        return;
      }
      const output = await gitDiff([`${latest.hash}..HEAD`]);
      process.stdout.write(output);
      return;
    }

    if (ref1 && !ref2) {
      const target = await resolveReference(ref1);
      if (target.pin) {
        const output = await gitDiff([`${target.hash}..HEAD`]);
        process.stdout.write(output);
      } else {
        const output = await gitDiff([`${target.hash}^!`]);
        process.stdout.write(output);
      }
      return;
    }

    if (ref1 && ref2) {
      const target1 = await resolveReference(ref1);
      const target2 = await resolveReference(ref2);
      const output = await gitDiff([`${target1.hash}..${target2.hash}`]);
      process.stdout.write(output);
    }
  } catch (error) {
    console.error(chalk.red('ERROR: Failed to show diff.'), error.message);
    process.exit(1);
  }
}
