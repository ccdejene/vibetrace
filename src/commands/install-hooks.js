import fs from 'fs/promises';
import path from 'path';
import os from 'os';
import chalk from 'chalk';

const CLAUDE_COMMIT_HOOK_COMMAND =
  `node -e "const {execFileSync}=require('child_process');const fs=require('fs');const path=require('path');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);const root=j.cwd||process.env.CLAUDE_PROJECT_DIR||process.cwd();if(fs.existsSync(path.join(root,'.vibe'))){execFileSync('vibe',['commit'],{cwd:root,stdio:'ignore'});}}catch(e){}});"`;

const CLAUDE_STOP_HOOK_COMMAND =
  `node -e "const {execFileSync}=require('child_process');const fs=require('fs');const path=require('path');let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);const root=j.cwd||process.env.CLAUDE_PROJECT_DIR||process.cwd();if(fs.existsSync(path.join(root,'.vibe'))){execFileSync('vibe',['commit'],{cwd:root,stdio:'ignore'});}}catch(e){}});"`;

const SCRUB_FN = `function scrub(s){return s.replace(/\\bsk-[A-Za-z0-9_\\-]{20,}/g,'***').replace(/\\bAKIA[0-9A-Z]{16}\\b/g,'***').replace(/\\bgh[psorut]_[A-Za-z0-9]{36,}\\b/g,'***').replace(/\\bnpm_[A-Za-z0-9]{36,}\\b/g,'***').replace(/\\bxox[baprs]-[A-Za-z0-9\\-]+/g,'***').replace(/\\bAIza[A-Za-z0-9_\\-]{35}\\b/g,'***').replace(/\\b(api[_-]?key|secret[_-]?key?|access[_-]?token|auth[_-]?token|private[_-]?key|password|passwd|pwd)\\s*[:=]\\s*[\\x22']?[A-Za-z0-9_\\-\\/+.@!]{8,}[\\x22']?/gi,'***').replace(/\\bBearer\\s+[A-Za-z0-9_\\-.]{20,}/gi,'***').replace(/\\beyJ[A-Za-z0-9_\\-]+\\.[A-Za-z0-9_\\-]+\\.[A-Za-z0-9_\\-]+\\b/g,'***').replace(/https?:\\/\\/[^:@\\s]+:[^@\\s]+@[^\\s]+/gi,'***');}`;

const CLAUDE_HOOK_COMMAND =
  `node -e "const fs=require('fs');const path=require('path');const os=require('os');${SCRUB_FN}let d='';process.stdin.on('data',c=>d+=c);process.stdin.on('end',()=>{try{const j=JSON.parse(d);const msg=scrub((j.prompt||'').trim());if(!msg)return;const root=j.cwd||process.env.CLAUDE_PROJECT_DIR||process.cwd();const dir=path.join(root,'.vibe');fs.mkdirSync(dir,{recursive:true});fs.writeFileSync(path.join(dir,'intent.json'),JSON.stringify({message:msg,tool:'claude'}));const gdir=path.join(os.homedir(),'.vibe');fs.mkdirSync(gdir,{recursive:true});fs.writeFileSync(path.join(gdir,'intent.json'),JSON.stringify({message:msg,tool:'claude'}));}catch(e){}});"`;

const CODEX_SCRUB_FN = `function scrub(s){return s.replace(/\bsk-[A-Za-z0-9_-]{20,}/g,'***').replace(/\bAKIA[0-9A-Z]{16}\b/g,'***').replace(/\bgh[psorut]_[A-Za-z0-9]{36,}\b/g,'***').replace(/\bnpm_[A-Za-z0-9]{36,}\b/g,'***').replace(/\bxox[baprs]-[A-Za-z0-9-]+/g,'***').replace(/\bAIza[A-Za-z0-9_-]{35}\b/g,'***').replace(/\b(api_?key|secret_?key?|access_?token|auth_?token|private_?key|password|passwd|pwd)\s*[:=]\s*[A-Za-z0-9_\-\/+.@!]{8,}/gi,'***').replace(/\bBearer\s+[A-Za-z0-9_.\\-]{20,}/gi,'***').replace(/\beyJ[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\.[A-Za-z0-9_-]+\b/g,'***').replace(/https?:\/\/[^:@\s]+:[^@\s]+@[^\s]+/gi,'***');}`;

const CODEX_HOOK_MARKER = '# vibe: codex hook';
const CODEX_SHELL_FUNCTION = `
${CODEX_HOOK_MARKER}
codex() {
  local __vibe_prompt="\${1:-}"
  if [[ -n "$__vibe_prompt" && -d "$(pwd)/.vibe" ]]; then
    node -e '${CODEX_SCRUB_FN}const fs=require("fs"),path=require("path");try{fs.writeFileSync(path.join(process.cwd(),".vibe","intent.json"),JSON.stringify({message:scrub(process.argv[1]),tool:"codex"}));}catch(e){}' -- "$__vibe_prompt" 2>/dev/null
  fi
  command codex "$@"
}
`;

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

function hasManagedCodexHook(content) {
  return /^# [A-Za-z-]+: codex hook$/m.test(content);
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

export async function installCodexShellHook() {
  const shell = process.env.SHELL ?? '';
  const rcFile = shell.includes('zsh')
    ? path.join(os.homedir(), '.zshrc')
    : path.join(os.homedir(), '.bashrc');

  let content = '';
  try {
    content = await fs.readFile(rcFile, 'utf8');
  } catch {
    // rc file doesn't exist yet - we'll create it
  }

  if (hasManagedCodexHook(content)) {
    return { rcFile, alreadyInstalled: true };
  }

  await fs.appendFile(rcFile, CODEX_SHELL_FUNCTION, 'utf8');
  return { rcFile, alreadyInstalled: false };
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

async function uninstallCodexShellHook() {
  const shell = process.env.SHELL ?? '';
  const rcFile = shell.includes('zsh')
    ? path.join(os.homedir(), '.zshrc')
    : path.join(os.homedir(), '.bashrc');

  let content = '';
  try {
    content = await fs.readFile(rcFile, 'utf8');
  } catch {
    return { rcFile, wasInstalled: false };
  }

  if (!content.includes(CODEX_HOOK_MARKER)) {
    return { rcFile, wasInstalled: false };
  }

  // Remove from marker line through the closing } of the function
  const updated = content.replace(
    /\n# [A-Za-z-]+: codex hook\ncodex\(\) \{[\s\S]*?\n\}\n/,
    '\n'
  );

  await fs.writeFile(rcFile, updated, 'utf8');
  return { rcFile, wasInstalled: true };
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

  let rcFile = '~/.zshrc';
  try {
    const codexResult = await uninstallCodexShellHook();
    rcFile = codexResult.rcFile.replace(os.homedir(), '~');
    if (codexResult.wasInstalled) {
      console.log(`  ${chalk.green('OK')} Codex hook: removed from ${rcFile}`);
    } else {
      console.log(`  ${chalk.gray('INFO')} Codex hook: not found in ${rcFile}`);
    }
  } catch (err) {
    console.log(`  ${chalk.red('ERROR')} Codex hook: failed - ${err.message}`);
  }

  console.log('');
  console.log(`  Run this to apply now:  source ${rcFile}`);
  console.log('');
  console.log(chalk.green('OK: Done. Hooks removed.'));
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

  let rcFile = '~/.zshrc';
  try {
    const codexResult = await installCodexShellHook();
    rcFile = codexResult.rcFile.replace(os.homedir(), '~');
    if (codexResult.alreadyInstalled) {
      console.log(`  ${chalk.gray('INFO')} Codex hook: already installed in ${rcFile}`);
    } else {
      console.log(`  ${chalk.green('OK')} Codex hook: added to ${rcFile}`);
    }
  } catch (err) {
    console.log(`  ${chalk.red('ERROR')} Codex hook: failed - ${err.message}`);
  }

  console.log('');
  console.log(`  Run this to activate now:  source ${rcFile}`);
  console.log('');
  console.log(chalk.green('OK: Done. Prompts will now be used as commit intent messages.'));
}
