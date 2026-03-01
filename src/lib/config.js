import fs from 'fs/promises';
import os from 'os';
import path from 'path';
import yaml from 'js-yaml';

export const VIBE_DIR = '.vibe';
export const CONFIG_PATH = path.join(process.cwd(), VIBE_DIR, 'config.yaml');
export const PINS_PATH = path.join(process.cwd(), VIBE_DIR, 'pins.yaml');
export const RESTORE_CONTEXT_PATH = path.join(process.cwd(), VIBE_DIR, 'restore-context.md');
export const RESTORE_LOCK_PATH = path.join(process.cwd(), VIBE_DIR, '.restoring');
export const WATCH_PID_PATH = path.join(process.cwd(), VIBE_DIR, 'watch.pid');
export const INTENT_PATH = path.join(process.cwd(), VIBE_DIR, 'intent.txt');
export const INTENT_JSON_PATH = path.join(process.cwd(), VIBE_DIR, 'intent.json');
export const GLOBAL_INTENT_JSON_PATH = path.join(os.homedir(), '.vibe', 'intent.json');

export const DEFAULT_CONFIG = {
  auto_commit: {
    enabled: true,
    debounce_ms: 2000
  },
  intent_summary: false,
  ignore: [
    'node_modules/',
    '.git/',
    '.vibe/',
    '.next/',
    'dist/',
    'build/',
    '__pycache__/',
    '*.pyc',
    '.env',
    '.env.local',
    '.DS_Store',
    'coverage/',
    '.cache/'
  ]
};

export async function ensureVibeDir() {
  const dir = path.join(process.cwd(), VIBE_DIR);
  await fs.mkdir(dir, { recursive: true });
}

export async function writeDefaultConfig() {
  await ensureVibeDir();
  try {
    await fs.access(CONFIG_PATH);
  } catch {
    const content = yaml.dump(DEFAULT_CONFIG, { lineWidth: 120 });
    await fs.writeFile(CONFIG_PATH, content, 'utf8');
  }
}

export async function readConfig() {
  try {
    const raw = await fs.readFile(CONFIG_PATH, 'utf8');
    const data = yaml.load(raw);
    return normalizeConfig(data);
  } catch {
    await writeDefaultConfig();
    return { ...DEFAULT_CONFIG };
  }
}

function normalizeConfig(data) {
  if (!data || typeof data !== 'object') return { ...DEFAULT_CONFIG };
  const config = { ...DEFAULT_CONFIG, ...data };
  config.intent_summary = Boolean(config.intent_summary);
  if (!config.auto_commit || typeof config.auto_commit !== 'object') {
    config.auto_commit = { ...DEFAULT_CONFIG.auto_commit };
  } else {
    config.auto_commit = {
      ...DEFAULT_CONFIG.auto_commit,
      ...config.auto_commit
    };
  }
  if (!Array.isArray(config.ignore)) {
    config.ignore = [...DEFAULT_CONFIG.ignore];
  }
  return config;
}

export async function writeDefaultPins() {
  await ensureVibeDir();
  try {
    await fs.access(PINS_PATH);
  } catch {
    const content = yaml.dump({ pins: [] }, { lineWidth: 120 });
    await fs.writeFile(PINS_PATH, content, 'utf8');
  }
}
