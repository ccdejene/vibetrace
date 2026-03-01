const MAX_LENGTH = 72;
const API_URL = 'https://api.anthropic.com/v1/messages';
const TIMEOUT_MS = 5000;

export async function summarizeIntent(prompt) {
  if (!prompt) return null;
  const trimmed = prompt.trim();
  if (!trimmed) return null;

  // Short enough - no need to call AI
  if (trimmed.length <= MAX_LENGTH) return trimmed;

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (apiKey) {
    try {
      const summary = await callClaude(trimmed, apiKey);
      if (summary) return summary;
    } catch {
      // fall through to truncation
    }
  }

  return truncate(trimmed);
}

async function callClaude(prompt, apiKey) {
  const controller = new AbortController();
  const timer = setTimeout(() => controller.abort(), TIMEOUT_MS);

  try {
    const response = await fetch(API_URL, {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-haiku-4-5-20251001',
        max_tokens: 80,
        system: 'You convert user requests into concise git commit messages. Output ONLY the commit message text - no punctuation at the end, no quotes, no explanation. Use imperative mood. Maximum 72 characters.',
        messages: [{ role: 'user', content: prompt }]
      }),
      signal: controller.signal
    });

    if (!response.ok) return null;

    const data = await response.json();
    const text = data?.content?.[0]?.text?.trim();
    if (!text) return null;

    return text.length > MAX_LENGTH ? truncate(text) : text;
  } finally {
    clearTimeout(timer);
  }
}

function truncate(text) {
  return text.slice(0, MAX_LENGTH).trimEnd() + '...';
}
