import { raw, stageAll } from './git.js';

const MAX_SUBJECT = 72;
const MAX_DIFF = 3000;
const TIMEOUT_MS = 8000;

const SYSTEM_PROMPT = 'You convert code changes into concise git commit subject lines. Output ONLY the commit message text — no prefix tags, no punctuation at end, no quotes, no explanation. Use imperative mood. Maximum 72 characters.';

// Used by watch.js to summarize long intent prompts
export async function summarizeIntent(prompt) {
  if (!prompt) return null;
  const trimmed = prompt.trim();
  if (!trimmed) return null;
  if (trimmed.length <= MAX_SUBJECT) return trimmed;

  const summary = await callApi(trimmed);
  return summary ?? truncate(trimmed);
}

// Used by commit.js to generate a summary from the staged diff when no intent is set
export async function summarizeDiff(tool) {
  await stageAll();

  let diff = '';
  try {
    const stat = await raw(['diff', '--cached', '--stat']);
    const patch = await raw(['diff', '--cached', '--unified=1']);
    diff = (stat + '\n' + patch).trim().slice(0, MAX_DIFF);
  } catch {
    return null;
  }

  if (!diff) return null;

  const summary = await callApi(diff);
  if (!summary) return null;

  const tag = tool === 'claude' ? 'claude' : tool === 'codex' ? 'codex' : 'auto';
  return `[vibe:${tag}] ${summary}`;
}

async function callApi(content) {
  const anthropicKey = process.env.ANTHROPIC_API_KEY;
  if (anthropicKey) {
    try {
      const result = await callAnthropic(content, anthropicKey);
      if (result) return result;
    } catch {}
  }

  const openaiKey = process.env.OPENAI_API_KEY;
  if (openaiKey) {
    try {
      const result = await callOpenAI(content, openaiKey);
      if (result) return result;
    } catch {}
  }

  return null;
}

async function callAnthropic(content, apiKey) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 80,
        system: SYSTEM_PROMPT,
        messages: [{ role: 'user', content }]
      }),
      signal: controller.signal
    });
    if (!response.ok) return null;
    const data = await response.json();
    const text = data?.content?.[0]?.text?.trim();
    return text ? (text.length > MAX_SUBJECT ? truncate(text) : text) : null;
  } finally {
    clearTimeout(timer);
  }
}

async function callOpenAI(content, apiKey) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);
  try {
    const response = await fetch('https://api.openai.com/v1/chat/completions', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${apiKey}`
      },
      body: JSON.stringify({
        model: 'gpt-4o-mini',
        max_tokens: 80,
        messages: [
          { role: 'system', content: SYSTEM_PROMPT },
          { role: 'user', content }
        ]
      }),
      signal: controller.signal
    });
    if (!response.ok) return null;
    const data = await response.json();
    const text = data?.choices?.[0]?.message?.content?.trim();
    return text ? (text.length > MAX_SUBJECT ? truncate(text) : text) : null;
  } finally {
    clearTimeout(timer);
  }
}

function truncate(text) {
  return text.slice(0, MAX_SUBJECT).trimEnd() + '...';
}
