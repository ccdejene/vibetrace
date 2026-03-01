import fs from 'fs/promises';
import path from 'path';
import chalk from 'chalk';
import { ensureGitRepo, stageAll, commit, hasUncommittedChanges, getUserIdentity } from '../lib/git.js';
import { ensureVibeDir, writeDefaultConfig, writeDefaultPins, VIBE_DIR } from '../lib/config.js';
import { installClaudeHook, installCodexSkill } from './install-hooks.js';

const VIBE_DENY_RULES = [
  'Edit(.vibe/**)',
  'Write(.vibe/**)',
  'Bash(rm * .vibe/*)',
  'Bash(rm -rf .vibe*)',
  'Bash(mv * .vibe/*)',
  'Bash(cp * .vibe/*)',
];

const CLAUDE_MD_MARKER = '<!-- vibe: protection -->';
const CLAUDE_MD_BLOCK = `${CLAUDE_MD_MARKER}
## Protected Directories

**Do NOT read, edit, write, move, delete, or otherwise modify any files inside the \`.vibe/\` directory.**

The \`.vibe/\` folder is managed exclusively by the \`vibe\` CLI. Modifying it will corrupt project state tracking.
<!-- vibe: end -->`;

const AGENTS_MD_MARKER = '<!-- vibe: protection -->';
const AGENTS_MD_BLOCK = `${AGENTS_MD_MARKER}
## Protected Directories

**Do NOT read, edit, write, move, delete, or otherwise modify any files inside the \`.vibe/\` directory.**

The \`.vibe/\` folder is managed exclusively by the \`vibe\` CLI. Modifying it will corrupt project state tracking.
<!-- vibe: end -->`;

export async function initCommand() {
  try {
    await ensureGitRepo();
    await ensureVibeDir();
    await writeDefaultConfig();
    await writeDefaultPins();

    await ensureGitignore();
    await ensureVibeProtection();
    await installClaudeHook();
    const codexResult = await installCodexSkill();

    const identity = await getUserIdentity();
    if (!identity.name || !identity.email) {
      console.log('Git user identity is not set.');
      console.log('Set it once with:');
      console.log('  git config --global user.name "Your Name"');
      console.log('  git config --global user.email "you@example.com"');
      console.log('');
      console.log('Or set it just for this repo:');
      console.log('  git config user.name "Your Name"');
      console.log('  git config user.email "you@example.com"');
      process.exit(1);
    }

    const hasChanges = await hasUncommittedChanges();
    if (hasChanges) {
      await stageAll();
      await commit('[vibe:auto] Initial state');
    }

    console.log(chalk.green('OK: vibe initialized.'));
    console.log('');
    if (!codexResult.alreadyInstalled) {
      console.log(`  ${chalk.dim('Codex skill installed at ~/.codex/skills/vibetrace')}`);
      console.log('');
    }
    console.log('Quick start:');
    console.log('  vibe watch     Start auto-commits');
    console.log('  vibe pin "My checkpoint"');
  } catch (error) {
    console.error(chalk.red('ERROR: Failed to initialize vibe.'), error.message);
    process.exit(1);
  }
}

async function ensureGitignore() {
  const gitignorePath = path.join(process.cwd(), '.gitignore');
  let content = '';
  try {
    content = await fs.readFile(gitignorePath, 'utf8');
  } catch {
    content = '';
  }

  let updated = content;
  const next = (s) => s.endsWith('\n') || s.length === 0 ? s : s + '\n';
  if (!updated.includes(`${VIBE_DIR}/`)) {
    updated = next(updated) + `${VIBE_DIR}/\n`;
  }
  if (!updated.includes('.claude/')) {
    updated = next(updated) + `.claude/\n`;
  }
  if (!updated.includes('.tsbuildinfo')) {
    updated = next(updated) + `*.tsbuildinfo\n`;
  }
  if (updated !== content) {
    await fs.writeFile(gitignorePath, updated, 'utf8');
  }
}

async function ensureVibeProtection() {
  await ensureClaudeDenyRules();
  await ensureClaudeMd();
  await ensureAgentsMd();
}

async function ensureClaudeDenyRules() {
  const claudeDir = path.join(process.cwd(), '.claude');
  const settingsPath = path.join(claudeDir, 'settings.local.json');

  await fs.mkdir(claudeDir, { recursive: true });

  let settings = {};
  try {
    const raw = await fs.readFile(settingsPath, 'utf8');
    settings = JSON.parse(raw);
  } catch {
    // file doesn't exist or invalid - start fresh
  }

  if (!settings.permissions) settings.permissions = {};
  if (!Array.isArray(settings.permissions.deny)) settings.permissions.deny = [];

  const existing = new Set(settings.permissions.deny);
  let added = false;
  for (const rule of VIBE_DENY_RULES) {
    if (!existing.has(rule)) {
      settings.permissions.deny.push(rule);
      added = true;
    }
  }

  if (added) {
    await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  }
}

async function ensureClaudeMd() {
  const filePath = path.join(process.cwd(), 'CLAUDE.md');
  let content = '';
  try {
    content = await fs.readFile(filePath, 'utf8');
  } catch {
    content = '';
  }

  if (/<!--\s*[^>]*vibe protection\s*-->/.test(content)) return;

  const separator = content.length > 0 && !content.endsWith('\n\n')
    ? (content.endsWith('\n') ? '\n' : '\n\n')
    : '';
  await fs.writeFile(filePath, `${content}${separator}${CLAUDE_MD_BLOCK}\n`, 'utf8');
}

async function ensureAgentsMd() {
  const filePath = path.join(process.cwd(), 'AGENTS.md');
  let content = '';
  try {
    content = await fs.readFile(filePath, 'utf8');
  } catch {
    content = '';
  }

  if (/<!--\s*[^>]*vibe protection\s*-->/.test(content)) return;

  const separator = content.length > 0 && !content.endsWith('\n\n')
    ? (content.endsWith('\n') ? '\n' : '\n\n')
    : '';
  await fs.writeFile(filePath, `${content}${separator}${AGENTS_MD_BLOCK}\n`, 'utf8');
}
