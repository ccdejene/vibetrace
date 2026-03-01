import fs from 'fs/promises';
import chalk from 'chalk';
import { ensureVibeDir, INTENT_PATH } from '../lib/config.js';
import { scrubSensitiveData } from '../lib/intent.js';

export async function intentCommand(message) {
  try {
    await ensureVibeDir();
    if (!message || !message.trim()) {
      console.log('Provide a short intent message.');
      console.log('Example: vibe intent "Change UI because the layout feels crowded"');
      process.exit(1);
    }
    await fs.writeFile(INTENT_PATH, scrubSensitiveData(message.trim()), 'utf8');
    console.log(chalk.green('OK: Intent captured for next auto-commit.'));
  } catch (error) {
    console.error(chalk.red('ERROR: Failed to save intent.'), error.message);
    process.exit(1);
  }
}
