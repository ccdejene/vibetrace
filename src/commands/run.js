import fs from 'fs/promises';
import { spawn } from 'child_process';
import chalk from 'chalk';
import { ensureVibeDir, INTENT_JSON_PATH } from '../lib/config.js';

export async function runCommand(prompt, options) {
  try {
    if (!prompt || !prompt.trim()) {
      console.log('Provide a prompt to run.');
      console.log('Example: vibe run --tool claude "Refactor the UI layout"');
      process.exit(1);
    }

    const tool = (options.tool || 'claude').toLowerCase();
    const cmd = resolveToolCommand(tool);

    await ensureVibeDir();
    const payload = { message: prompt.trim() };
    await fs.writeFile(INTENT_JSON_PATH, JSON.stringify(payload), 'utf8');

    const child = spawn(cmd, [prompt], {
      stdio: 'inherit'
    });

    child.on('exit', (code) => {
      process.exit(code ?? 0);
    });
  } catch (error) {
    console.error(chalk.red('ERROR: Failed to run AI tool.'), error.message);
    process.exit(1);
  }
}

function resolveToolCommand(tool) {
  if (tool === 'claude') return 'claude';
  if (tool === 'codex') return 'codex';
  throw new Error(`Unknown tool: ${tool}. Use --tool claude or --tool codex.`);
}
