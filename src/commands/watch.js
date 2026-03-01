import fs from 'fs/promises';
import { spawn } from 'child_process';
import path from 'path';
import chalk from 'chalk';
import chokidar from 'chokidar';
import { readConfig, RESTORE_LOCK_PATH, WATCH_PID_PATH, ensureVibeDir } from '../lib/config.js';
import { autoCommitIfNeeded } from '../lib/auto-commit.js';
import { readIntentMessage, normalizeIntentMessage } from '../lib/intent.js';

export async function watchCommand(options) {
  try {
    await ensureVibeDir();

    if (options.stop) {
      await stopDaemon();
      return;
    }

    if (options.daemon) {
      await startDaemon();
      return;
    }

    await startWatcher({ verbose: options.verbose });
  } catch (error) {
    console.error(chalk.red('ERROR: Failed to start watcher.'), error.message);
    process.exit(1);
  }
}

async function startDaemon() {
  try {
    const pid = await readPid();
    if (pid) {
      console.log(`Watcher already running (pid ${pid}).`);
      return;
    }
  } catch {
    // ignore
  }

  const binPath = path.resolve(process.argv[1]);
  const logPath = path.join(process.cwd(), '.vibe', 'watcher.log');
  const logFd = await fs.open(logPath, 'a');
  const child = spawn(process.execPath, [binPath, 'watch', '--foreground'], {
    detached: true,
    stdio: ['ignore', logFd.fd, logFd.fd],
    cwd: process.cwd()
  });
  await logFd.close();
  child.unref();
  await fs.writeFile(WATCH_PID_PATH, String(child.pid), 'utf8');
  console.log(chalk.green(`OK: Watcher running in background (pid ${child.pid}).`));
}

async function stopDaemon() {
  const pid = await readPid();
  if (!pid) {
    console.log('No watcher is running.');
    return;
  }
  try {
    process.kill(pid);
    await fs.unlink(WATCH_PID_PATH);
    console.log(chalk.green('OK: Watcher stopped.'));
  } catch (error) {
    console.error(chalk.red('ERROR: Failed to stop watcher.'), error.message);
  }
}

async function readPid() {
  try {
    const raw = await fs.readFile(WATCH_PID_PATH, 'utf8');
    const pid = Number(raw.trim());
    if (!pid) return null;
    return pid;
  } catch {
    return null;
  }
}

async function startWatcher({ verbose }) {
  const config = await readConfig();
  if (!config.auto_commit.enabled) {
    console.log('Auto-commit is disabled in .vibe/config.yaml.');
    return;
  }

  const watcher = chokidar.watch('.', {
    ignored: config.ignore,
    ignoreInitial: true,
    persistent: true
  });

  let timer = null;
  const debounceMs = Number(config.auto_commit.debounce_ms) || 2000;

  const scheduleCommit = () => {
    if (timer) clearTimeout(timer);
    timer = setTimeout(async () => {
      const restoring = await isRestoring();
      if (restoring) return;
      const intent = await readIntentMessage();
      let resolved = intent?.message ?? null;
      if (resolved && config.intent_summary) {
        const { summarizeIntent } = await import('../lib/summarize.js');
        resolved = await summarizeIntent(resolved);
      }
      const intentMessage = resolved ? normalizeIntentMessage(resolved) : null;
      const result = await autoCommitIfNeeded(intentMessage || undefined);
      if (result.committed && verbose) {
        const cleaned = result.message.replace(/^\[vibe:auto\]\s*/i, '');
        console.log(chalk.gray(`AUTO-SAVED: ${cleaned}`));
      }
    }, debounceMs);
  };

  watcher.on('all', (_event, _path) => scheduleCommit());

  console.log(chalk.green('OK: Watching for changes...'));
}

async function isRestoring() {
  try {
    await fs.access(RESTORE_LOCK_PATH);
    return true;
  } catch {
    return false;
  }
}
