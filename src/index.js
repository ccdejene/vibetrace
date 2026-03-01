import { Command } from 'commander';
import { initCommand } from './commands/init.js';
import { pinCommand } from './commands/pin.js';
import { logCommand } from './commands/log.js';
import { restoreCommand } from './commands/restore.js';
import { showCommand } from './commands/show.js';
import { diffCommand } from './commands/diff.js';
import { watchCommand } from './commands/watch.js';
import { doctorCommand } from './commands/doctor.js';
import { intentCommand } from './commands/intent.js';
import { commitCommand } from './commands/commit.js';
import { runCommand } from './commands/run.js';
import { installHooksCommand, uninstallHooksCommand } from './commands/install-hooks.js';

export function runCli(argv) {
  const program = new Command();

  program
    .name('vibe')
    .description('Session-aware state management for AI-assisted coding')
    .version('1.0.0');

  program
    .command('init')
    .description('Initialize vibe checkpoints in the current project')
    .action(initCommand);

  program
    .command('pin')
    .description('Pin the current state as a known-good checkpoint')
    .argument('[label]', 'Label for the pin')
    .action(pinCommand);

  program
    .command('log')
    .description('Show the session timeline')
    .option('--all', 'Show all commits')
    .option('--pinned', 'Show pinned checkpoints only')
    .option('--between <pins...>', 'Show commits between two pins')
    .option('--unpinned', 'Show commits since last pin')
    .option('-n, --limit <count>', 'Limit number of entries', parseInt)
    .action(logCommand);

  program
    .command('restore')
    .description('Restore to a previous state and generate context for the AI')
    .argument('[reference]', 'Pin label, hash, or ~N')
    .option('--search <query>', 'Search commit messages and pick one')
    .action(restoreCommand);

  program
    .command('show')
    .description('Show details about a specific commit or pin')
    .argument('<reference>', 'Pin label or commit hash')
    .action(showCommand);

  program
    .command('diff')
    .description('Show what changed between two points')
    .argument('[ref1]', 'Pin label or hash')
    .argument('[ref2]', 'Pin label or hash')
    .action(diffCommand);

  program
    .command('watch')
    .description('Start the auto-commit file watcher daemon')
    .option('--daemon', 'Run in background')
    .option('--stop', 'Stop background watcher')
    .option('--foreground', 'Run in foreground (internal)')
    .option('--verbose', 'Show verbose output')
    .action(watchCommand);

  program
    .command('doctor')
    .description('Check your environment and vibe setup')
    .action(doctorCommand);

  program
    .command('commit')
    .description('Commit pending changes using the saved intent message')
    .action(commitCommand);

  program
    .command('intent')
    .description('Set a one-line intent for the next auto-commit')
    .argument('<message>', 'Intent message to use for the next auto-commit')
    .action(intentCommand);

  program
    .command('run')
    .description('Run an AI tool and capture the prompt as intent')
    .argument('<prompt>', 'Prompt to send to the AI tool')
    .option('--tool <tool>', 'AI tool to run: claude or codex', 'claude')
    .action(runCommand);

  program
    .command('install-hooks')
    .description('Set up Claude and Codex intent hooks for this project')
    .action(installHooksCommand);

  program
    .command('uninstall-hooks')
    .description('Remove Claude and Codex intent hooks')
    .action(uninstallHooksCommand);

  program.parse(argv);
}
