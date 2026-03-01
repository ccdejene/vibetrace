import fs from 'fs/promises';
import { INTENT_PATH, INTENT_JSON_PATH, GLOBAL_INTENT_JSON_PATH } from './config.js';

export async function readIntentMessage() {
  const [jsonResult, globalJsonResult, textResult] = await Promise.all([
    readJsonIntent(INTENT_JSON_PATH),
    readJsonIntent(GLOBAL_INTENT_JSON_PATH),
    readTextIntent()
  ]);

  const candidates = [
    jsonResult && { message: jsonResult.message, tool: jsonResult.tool, source: 'json', mtime: jsonResult.mtime },
    globalJsonResult && { message: globalJsonResult.message, tool: globalJsonResult.tool, source: 'global', mtime: globalJsonResult.mtime },
    textResult && { message: textResult.message, tool: null, source: 'text', mtime: textResult.mtime }
  ].filter(Boolean);

  if (!candidates.length) return null;
  return candidates.reduce((best, r) => (r.mtime >= best.mtime ? r : best));
}

export async function clearIntent(source) {
  try {
    if (source === 'json') {
      await fs.writeFile(INTENT_JSON_PATH, '', 'utf8');
      return;
    }
    if (source === 'text') {
      await fs.writeFile(INTENT_PATH, '', 'utf8');
    }
  } catch {
    // ignore
  }
}

const MAX_LENGTH = 72;
const MAX_BODY = 500;

// Patterns that indicate sensitive credentials
const SENSITIVE_PATTERNS = [
  // OpenAI / Anthropic style keys
  /\bsk-[A-Za-z0-9_\-]{20,}/g,
  // AWS access keys
  /\bAKIA[0-9A-Z]{16}\b/g,
  // GitHub tokens
  /\bgh[psorut]_[A-Za-z0-9]{36,}\b/g,
  // npm tokens
  /\bnpm_[A-Za-z0-9]{36,}\b/g,
  // Slack tokens
  /\bxox[baprs]-[A-Za-z0-9\-]+/g,
  // Google API keys
  /\bAIza[A-Za-z0-9_\-]{35}\b/g,
  // Generic key/secret/token/password assignments
  /\b(api[_-]?key|secret[_-]?key?|access[_-]?token|auth[_-]?token|private[_-]?key|password|passwd|pwd)\s*[:=]\s*["']?[A-Za-z0-9_\-\/+.@!]{8,}["']?/gi,
  // Bearer tokens
  /\bBearer\s+[A-Za-z0-9_\-\.]{20,}/gi,
  // JWT tokens
  /\beyJ[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\.[A-Za-z0-9_\-]+\b/g,
  // URLs with embedded credentials
  /https?:\/\/[^:@\s]+:[^@\s]+@[^\s]+/gi,
];

export function scrubSensitiveData(message) {
  let scrubbed = message;
  for (const pattern of SENSITIVE_PATTERNS) {
    scrubbed = scrubbed.replace(pattern, '***');
  }
  return scrubbed;
}

export function normalizeIntentMessage(message, tool) {
  if (!message) return null;
  const trimmed = scrubSensitiveData(message.trim());
  if (!trimmed) return null;
  if (/^\[vibe:(auto|claude|codex|restore)\]\s*/i.test(trimmed)) return trimmed;
  const tag = tool === 'claude' ? 'claude' : tool === 'codex' ? 'codex' : 'auto';
  const subject = `[vibe:${tag}] ${extractIntent(trimmed)}`;
  if (trimmed.length <= MAX_LENGTH) return subject;
  const body = trimmed.length > MAX_BODY
    ? trimmed.slice(0, MAX_BODY).trimEnd() + '... (truncated)'
    : trimmed;
  return `${subject}\n\n${body}`;
}

function extractIntent(text) {
  if (text.length <= MAX_LENGTH) return capitalize(text);

  // 1. First sentence
  const sentence = text.match(/^[^.!?;]+/)?.[0].trim() ?? text;
  if (sentence.length <= MAX_LENGTH) return capitalize(sentence);

  // 2. First clause - split on common multi-action connectors
  const clause = sentence.split(/\s+and also\s+|\s+and then\s+|,\s+and\s+|;\s*/i)[0].trim();
  if (clause.length <= MAX_LENGTH) return capitalize(clause);

  // 3. Word-boundary truncate as last resort
  const idx = clause.lastIndexOf(' ', MAX_LENGTH - 1);
  const cut = idx > 0 ? clause.slice(0, idx) : clause.slice(0, MAX_LENGTH);
  return capitalize(cut) + '...';
}

function capitalize(text) {
  return text.charAt(0).toUpperCase() + text.slice(1);
}

async function readTextIntent() {
  try {
    const raw = await fs.readFile(INTENT_PATH, 'utf8');
    const text = raw.trim();
    if (!text) return null;
    const stat = await fs.stat(INTENT_PATH);
    return { message: text, mtime: stat.mtimeMs };
  } catch {
    return null;
  }
}

async function readJsonIntent(filePath) {
  try {
    const raw = await fs.readFile(filePath, 'utf8');
    if (!raw.trim()) return null;
    let data = null;
    try {
      data = JSON.parse(raw);
    } catch {
      data = { message: raw.trim() };
    }
    if (!data || typeof data !== 'object') return null;
    const message = typeof data.message === 'string' ? data.message.trim() : '';
    if (!message) return null;
    const tool = typeof data.tool === 'string' ? data.tool : null;
    const stat = await fs.stat(filePath);
    return { message, tool, mtime: stat.mtimeMs };
  } catch {
    return null;
  }
}
