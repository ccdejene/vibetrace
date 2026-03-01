import fs from 'fs/promises';
import chalk from 'chalk';
import { getGit, getUserIdentity } from '../lib/git.js';
import { CONFIG_PATH, PINS_PATH, RESTORE_LOCK_PATH, WATCH_PID_PATH, VIBE_DIR } from '../lib/config.js';

export async function doctorCommand() {
  let hasError = false;

  const results = [];

  const git = getGit();
  const isRepo = await git.checkIsRepo();
  if (isRepo) {
    results.push(ok('Git repo detected.'));
  } else {
    results.push(err('Git repo not found. Run `git init` or `vibe init`.'));
    hasError = true;
  }

  const identity = await getUserIdentity().catch(() => ({ name: '', email: '' }));
  if (identity.name && identity.email) {
    results.push(ok('Git user identity set.'));
  } else {
    results.push(err('Git user identity missing. Set user.name and user.email.'));
    hasError = true;
  }

  const vibeDirExists = await exists(VIBE_DIR);
  if (vibeDirExists) {
    results.push(ok('Vibe metadata directory found.'));
  } else {
    results.push(warn('Vibe metadata directory missing. Run `vibe init`.'));
  }

  if (await exists(CONFIG_PATH)) {
    results.push(ok('Config file found.'));
  } else {
    results.push(warn('Config file missing. Run `vibe init`.'));
  }

  if (await exists(PINS_PATH)) {
    results.push(ok('Pins file found.'));
  } else {
    results.push(warn('Pins file missing. Run `vibe init`.'));
  }

  const restoring = await exists(RESTORE_LOCK_PATH);
  if (restoring) {
    results.push(warn('Restore lock present. A restore may be in progress.'));
  } else {
    results.push(ok('No restore lock present.'));
  }

  const watcherStatus = await getWatcherStatus();
  if (watcherStatus.running) {
    results.push(ok(`Watcher running (pid ${watcherStatus.pid}).`));
  } else if (watcherStatus.pid) {
    results.push(warn('Watcher PID file found, but process is not running.'));
  } else {
    results.push(warn('Watcher not running.'));
  }

  for (const line of results) {
    console.log(line);
  }

  if (hasError) {
    process.exit(1);
  }
}

function ok(message) {
  return chalk.green(`OK: ${message}`);
}

function warn(message) {
  return chalk.yellow(`WARN: ${message}`);
}

function err(message) {
  return chalk.red(`ERROR: ${message}`);
}

async function exists(path) {
  try {
    await fs.access(path);
    return true;
  } catch {
    return false;
  }
}

async function getWatcherStatus() {
  try {
    const raw = await fs.readFile(WATCH_PID_PATH, 'utf8');
    const pid = Number(raw.trim());
    if (!pid) return { running: false, pid: null };
    try {
      process.kill(pid, 0);
      return { running: true, pid };
    } catch {
      return { running: false, pid };
    }
  } catch {
    return { running: false, pid: null };
  }
}
