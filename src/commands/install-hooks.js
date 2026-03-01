import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import chalk from 'chalk';
import { fileURLToPath } from 'url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const CODEX_SKILL_DEST = path.join(os.homedir(), '.codex', 'skills', 'vibetrace');
const CODEX_SKILL_SRC = path.join(__dirname, '..', 'skills', 'vibetrace');

const CLAUDE_COMMIT_HOOK_COMMAND =
  `node -e "const {execFileSync}=require('child_process');const fs=require('fs');const path=require('path');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);const root=j.cwd||process.env.CLAUDE_PROJECT_DIR||process.cwd();if(fs.existsSync(path.join(root,'.vibe'))){execFileSync('vibe',['commit'],{cwd:root,stdio:'ignore'});}}catch(e){}});"`;

const CLAUDE_STOP_HOOK_COMMAND =
  `node -e "const {execFileSync}=require('child_process');const fs=require('fs');const path=require('path');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);const root=j.cwd||process.env.CLAUDE_PROJECT_DIR||process.cwd();if(fs.existsSync(path.join(root,'.vibe'))){execFileSync('vibe',['commit'],{cwd:root,stdio:'ignore'});}}catch(e){}});"`;

const SCRUB_FN = `function scrub(s){return s.replace(/\\bsk-[A-Za-z0-9_\\-]{20,}/g,'***').replace(/\\bAKIA[0-9A-Z]{16}\\b/g,'***').replace(/\\bgh[psorut]_[A-Za-z0-9]{36,}\\b/g,'***').replace(/\\bnpm_[A-Za-z0-9]{36,}\\b/g,'***').replace(/\\bxox[baprs]-[A-Za-z0-9\\-]+/g,'***').replace(/\\bAIza[A-Za-z0-9_\\-]{35}\\b/g,'***').replace(/\\b(api[_-]?key|secret[_-]?key?|access[_-]?token|auth[_-]?token|private[_-]?key|password|passwd|pwd)\\s*[:=]\\s*[\\x22']?[A-Za-z0-9_\\-\\/+.@!]{8,}[\\x22']?/gi,'***').replace(/\\bBearer\\s+[A-Za-z0-9_\\-.]{20,}/gi,'***').replace(/\\beyJ[A-Za-z0-9_\\-]+\\.[A-Za-z0-9_\\-]+\\.[A-Za-z0-9_\\-]+\\b/g,'***').replace(/https?:\\/\\/[^:@\\s]+:[^@\\s]+@[^\\s]+/gi,'***');}`;

const CLAUDE_HOOK_COMMAND =
  `node -e "const fs=require('fs');const path=require('path');const os=require('os');${SCRUB_FN}let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);const msg=scrub((j.prompt||'').trim());if(!msg)return;const root=j.cwd||process.env.CLAUDE_PROJECT_DIR||process.cwd();const dir=path.join(root,'.vibe');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'intent.json'),JSON.stringify({message:msg,tool:'claude'}));const gdir=path.join(os.homedir(),'.vibe');fs.mkdirSync(gdir,{recursive:true});fs.writeFileSync(path.join(gdir,'intent.json'),JSON.stringify({message:msg,tool:'claude'}));}catch(e){}});"`;

function isManagedClaudeIntentHook(hook) {
  const command = hook?.command ?? '';
  return hook?.type === 'command'
    && command.includes("path.join(root,'.vibe')")
    && command.includes("path.join(dir,'intent.json')");
}

function isManagedClaudeCommitHook(hook) {
  const command = hook?.command ?? '';
  return hook?.type === 'command'
    && command.includes("path.join(root,'.vibe')")
    && command.includes("execFileSync(")
    && command.includes("['commit']");
}


export async function installClaudeHook() {
  const claudeDir = path.join(process.cwd(), '.claude');
  const settingsPath = path.join(claudeDir, 'settings.local.json');

  await fs.mkdir(claudeDir, { recursive: true });

  let settings = {};
  try {
    const raw = await fs.readFile(settingsPath, 'utf8');
    settings = JSON.parse(raw);
  } catch {
    // file doesn't exist or is invalid - start fresh
  }

  // Merge hooks into settings
  if (!settings.hooks) settings.hooks = {};

  // UserPromptSubmit: save intent + commit previous
  if (!settings.hooks.UserPromptSubmit) settings.hooks.UserPromptSubmit = [];
  let matcherEntry = settings.hooks.UserPromptSubmit.find(e => e.matcher === '*');
  if (!matcherEntry) {
    matcherEntry = { matcher: '*', hooks: [] };
    settings.hooks.UserPromptSubmit.push(matcherEntry);
  }
  if (!matcherEntry.hooks) matcherEntry.hooks = [];
  const hadCurrentPromptHook = matcherEntry.hooks.some(h => h?.command === CLAUDE_HOOK_COMMAND);
  matcherEntry.hooks = matcherEntry.hooks.filter(h => !isManagedClaudeIntentHook(h));
  matcherEntry.hooks.push({ type: 'command', command: CLAUDE_HOOK_COMMAND });

  // Stop: commit as soon as Claude finishes responding
  if (!settings.hooks.Stop) settings.hooks.Stop = [];
  let stopEntry = settings.hooks.Stop.find(e => e.matcher === '*');
  if (!stopEntry) {
    stopEntry = { matcher: '*', hooks: [] };
    settings.hooks.Stop.push(stopEntry);
  }
  if (!stopEntry.hooks) stopEntry.hooks = [];
  const hadCurrentStopHook = stopEntry.hooks.some(h => h?.command === CLAUDE_STOP_HOOK_COMMAND);
  stopEntry.hooks = stopEntry.hooks.filter(h => !isManagedClaudeCommitHook(h));
  stopEntry.hooks.push({ type: 'command', command: CLAUDE_STOP_HOOK_COMMAND });

  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  return { alreadyInstalled: hadCurrentPromptHook && hadCurrentStopHook };
}

export async function installCodexSkill() {
  const marker = path.join(CODEX_SKILL_DEST, 'SKILL.md');
  let alreadyInstalled = false;
  try {
    await fs.access(marker);
    alreadyInstalled = true;
  } catch {}

  await fs.mkdir(path.join(CODEX_SKILL_DEST, 'agents'), { recursive: true });
  await fs.cp(CODEX_SKILL_SRC, CODEX_SKILL_DEST, { recursive: true });
  return { alreadyInstalled };
}

async function uninstallClaudeHook() {
  const settingsPath = path.join(process.cwd(), '.claude', 'settings.local.json');

  let settings = {};
  try {
    const raw = await fs.readFile(settingsPath, 'utf8');
    settings = JSON.parse(raw);
  } catch {
    return { wasInstalled: false };
  }

  const entries = settings?.hooks?.UserPromptSubmit;
  if (!entries) return { wasInstalled: false };

  let removed = false;
  for (const entry of entries) {
    const before = entry.hooks?.length ?? 0;
    entry.hooks = (entry.hooks ?? []).filter(h => !isManagedClaudeIntentHook(h) && h?.command !== CLAUDE_COMMIT_HOOK_COMMAND);
    if (entry.hooks.length < before) removed = true;
  }

  // Clean up Stop hook
  const stopEntries = settings?.hooks?.Stop ?? [];
  for (const entry of stopEntries) {
    const before = entry.hooks?.length ?? 0;
    entry.hooks = (entry.hooks ?? []).filter(h => !isManagedClaudeCommitHook(h));
    if (entry.hooks.length < before) removed = true;
  }
  settings.hooks.Stop = stopEntries.filter(e => e.hooks?.length > 0);
  if (settings.hooks.Stop.length === 0) delete settings.hooks.Stop;

  if (!removed) return { wasInstalled: false };

  // Clean up empty matcher entries
  settings.hooks.UserPromptSubmit = entries.filter(e => e.hooks?.length > 0);
  if (settings.hooks.UserPromptSubmit.length === 0) delete settings.hooks.UserPromptSubmit;
  if (Object.keys(settings.hooks).length === 0) delete settings.hooks;

  await fs.writeFile(settingsPath, JSON.stringify(settings, null, 2) + '\n', 'utf8');
  return { wasInstalled: true };
}

async function uninstallCodexSkill() {
  try {
    await fs.access(CODEX_SKILL_DEST);
    await fs.rm(CODEX_SKILL_DEST, { recursive: true, force: true });
    return { wasInstalled: true };
  } catch {
    return { wasInstalled: false };
  }
}

export async function uninstallHooksCommand() {
  console.log('Uninstalling vibe hooks...');
  console.log('');

  try {
    const claudeResult = await uninstallClaudeHook();
    if (claudeResult.wasInstalled) {
      console.log(`  ${chalk.green('OK')} Claude hook: removed from .claude/settings.local.json`);
    } else {
      console.log(`  ${chalk.gray('INFO')} Claude hook: not found`);
    }
  } catch (err) {
    console.log(`  ${chalk.red('ERROR')} Claude hook: failed - ${err.message}`);
  }

  try {
    const codexResult = await uninstallCodexSkill();
    if (codexResult.wasInstalled) {
      console.log(`  ${chalk.green('OK')} Codex skill: removed from ~/.codex/skills/vibetrace`);
    } else {
      console.log(`  ${chalk.gray('INFO')} Codex skill: not found`);
    }
  } catch (err) {
    console.log(`  ${chalk.red('ERROR')} Codex skill: failed - ${err.message}`);
  }

  console.log('');
  console.log(chalk.green('OK: Done.'));
}

export async function installHooksCommand() {
  console.log('Installing vibe hooks...');
  console.log('');

  try {
    const claudeResult = await installClaudeHook();
    if (claudeResult.alreadyInstalled) {
      console.log(`  ${chalk.gray('INFO')} Claude hook: already installed`);
    } else {
      console.log(`  ${chalk.green('OK')} Claude hook: .claude/settings.local.json updated`);
    }
  } catch (err) {
    console.log(`  ${chalk.red('ERROR')} Claude hook: failed - ${err.message}`);
  }

  try {
    const codexResult = await installCodexSkill();
    if (codexResult.alreadyInstalled) {
      console.log(`  ${chalk.gray('INFO')} Codex skill: already installed at ~/.codex/skills/vibetrace`);
    } else {
      console.log(`  ${chalk.green('OK')} Codex skill: installed at ~/.codex/skills/vibetrace`);
    }
  } catch (err) {
    console.log(`  ${chalk.red('ERROR')} Codex skill: failed - ${err.message}`);
  }

  console.log('');
  console.log(chalk.green('OK: Done.'));
}
