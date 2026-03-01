import fs from 'fs/promises';
import { execSync, spawn } from 'child_process';
import chalk from 'chalk';
import {
  hasUncommittedChanges,
  getHeadHash,
  getLog,
  raw,
  checkoutTree,
  stageAll,
  commit
} from '../lib/git.js';
import { autoCommitIfNeeded } from '../lib/auto-commit.js';
import {
  RESTORE_LOCK_PATH,
  RESTORE_CONTEXT_PATH,
  ensureVibeDir
} from '../lib/config.js';
import { loadPins } from '../lib/pins.js';
import { resolveReference } from './shared/resolve.js';
import { promptChoice } from './shared/prompt.js';
import { generateRestoreContext } from '../lib/context-generator.js';

export async function restoreCommand(reference, options) {
  try {
    await ensureVibeDir();
    if (await hasUncommittedChanges()) {
      await autoCommitIfNeeded('[vibe:auto] Pre-restore safety net');
    }

    const currentHead = await getHeadHash();

    const target = options.search
      ? await resolveBySearch(options.search)
      : await resolveReference(reference || '~1');

    await fs.writeFile(RESTORE_LOCK_PATH, 'restoring', 'utf8');

    const commitsAfter = await collectCommitsBetween(target.hash, currentHead);
    const pins = await loadPins();
    const pinsByHash = new Map(pins.map((pin) => [pin.hash, pin]));

    await checkoutTree(target.hash);
    await stageAll();
    const label = target.label || target.hash.slice(0, 7);
    await commit(`[vibe:restore] Restored to "${label}"`);

    const filesAtState = await listFiles();

    const context = generateRestoreContext({
      targetLabel: target.label,
      targetHash: target.hash,
      restoredAt: new Date(),
      filesAtState,
      commitsAfter,
      pinsByHash
    });

    await fs.writeFile(RESTORE_CONTEXT_PATH, context, 'utf8');
    await fs.unlink(RESTORE_LOCK_PATH).catch(() => {});

    console.log(chalk.blue(`RESTORED: "${target.label || target.hash.slice(0, 7)}" (${target.hash.slice(0, 7)})`));
    console.log('');
    console.log(`   Skipped past ${commitsAfter.length} commit${commitsAfter.length === 1 ? '' : 's'} (history preserved)`);
    console.log('');
    console.log(`   ${chalk.dim('Context auto-loaded by Claude Code and Codex.')}`);
    console.log('');
    console.log(`   To undo this restore: ${chalk.cyan(`vibe restore ${currentHead.slice(0, 7)}`)}`);
    console.log(`   To continue from here: just start prompting.`);

    await restartDevServer();
  } catch (error) {
    await fs.unlink(RESTORE_LOCK_PATH).catch(() => {});
    console.error(chalk.red('ERROR: Failed to restore.'), error.message);
    process.exit(1);
  }
}

async function resolveBySearch(query) {
  const log = await getLog({ maxCount: 200 });
  const matches = log.all.filter((commit) => commit.message.toLowerCase().includes(query.toLowerCase()));
  if (!matches.length) {
    throw new Error('No commits match that search.');
  }
  if (matches.length === 1) {
    return { hash: matches[0].hash, label: matches[0].message };
  }
  const index = await promptChoice('Multiple commits match. Choose one:', matches.map((commit) => `${commit.hash.slice(0, 7)} ${commit.message}`));
  if (index === null) throw new Error('No commit selected.');
  return { hash: matches[index].hash, label: matches[index].message };
}

async function collectCommitsBetween(fromHash, toHash) {
  const log = await getLog({ from: fromHash, to: toHash });
  const commits = log.all.filter((commit) => commit.hash !== fromHash).reverse();
  const detailed = [];
  for (const commit of commits) {
    const files = await getFilesChanged(commit.hash);
    detailed.push({
      hash: commit.hash,
      message: commit.message,
      date: commit.date,
      files
    });
  }
  return detailed;
}

async function getFilesChanged(hash) {
  const output = await raw(['show', '--name-only', '--pretty=format:', hash]);
  return output.split('\n').map((line) => line.trim()).filter(Boolean);
}

async function listFiles() {
  const output = await raw(['ls-files']);
  return output.split('\n').map((line) => line.trim()).filter(Boolean);
}

async function restartDevServer() {
  const cwd = process.cwd();

  const { pid, cmd } = await findRunningServer(cwd);
  if (!pid) return;

  try { execSync(`kill ${pid} 2>/dev/null || true`, { shell: true }); } catch {}
  await new Promise(r => setTimeout(r, 800));

  const [bin, ...args] = cmd.trim().split(/\s+/);
  const child = spawn(bin, args, { cwd, detached: true, stdio: 'ignore' });
  child.unref();

  console.log('');
  console.log(`   ${chalk.green('↺')} Server restarted ${chalk.dim('(' + cmd + ')')}`);
}

async function findRunningServer(cwd) {
  const NOISE = /\b(git|vim|nvim|nano|code|cursor|claude|vibe|vibetrace|grep|bash|zsh|fish|sh)\b/i;
  const pids = getPidsWithCwd(cwd);
  for (const pid of pids) {
    try {
      const args = execSync(`ps -p ${pid} -o args= 2>/dev/null`, { encoding: 'utf8' }).trim();
      if (!args || NOISE.test(args)) continue;
      return { pid, cmd: normalizeServerCmd(args) };
    } catch {}
  }
  return { pid: null, cmd: null };
}

function getPidsWithCwd(cwd) {
  // Use lsof to find processes whose working directory is exactly this project
  try {
    const out = execSync('lsof -a -d cwd -Fpn 2>/dev/null', { shell: true, encoding: 'utf8' });
    const pids = [];
    let currentPid = null;
    for (const line of out.split('\n')) {
      const t = line.trim();
      if (t.startsWith('p')) {
        currentPid = t.slice(1);
      } else if (t.startsWith('n') && t.slice(1) === cwd && currentPid) {
        pids.push(currentPid);
        currentPid = null;
      }
    }
    return pids;
  } catch {
    return [];
  }
}

function normalizeServerCmd(args) {
  // Detect package manager: "node /path/to/pnpm.cjs dev" → "pnpm dev"
  const pmMatch = args.match(/\b(pnpm|npm|yarn|bun)\b.*?\b((?:run\s+)?(?:dev|start|serve))\b/);
  if (pmMatch) return `${pmMatch[1]} ${pmMatch[2]}`;
  // Strip node_modules paths for other processes (python, go, ruby, etc. are already clean)
  return args.replace(/\S*\/node_modules\/\S*\//g, '').replace(/\s+/g, ' ').trim();
}
