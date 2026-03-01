import fs from 'fs/promises';
import yaml from 'js-yaml';
import { PINS_PATH, writeDefaultPins } from './config.js';

export async function loadPins() {
  try {
    const raw = await fs.readFile(PINS_PATH, 'utf8');
    const data = yaml.load(raw);
    if (!data || typeof data !== 'object' || !Array.isArray(data.pins)) {
      return [];
    }
    return data.pins;
  } catch {
    await writeDefaultPins();
    return [];
  }
}

export async function savePins(pins) {
  const content = yaml.dump({ pins }, { lineWidth: 120 });
  await fs.writeFile(PINS_PATH, content, 'utf8');
}

export function getLatestPin(pins) {
  if (!pins.length) return null;
  const sorted = [...pins].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
  return sorted[0];
}

export function getPinByHash(pins, hash) {
  return pins.find((pin) => pin.hash.startsWith(hash));
}

export function findPinsByLabel(pins, label) {
  const query = label.toLowerCase();
  return pins.filter((pin) => pin.label.toLowerCase().includes(query));
}

export function pickBestPinBySimilarity(pins, label) {
  if (!pins.length) return null;
  const query = label.toLowerCase();
  let best = null;
  let bestScore = -Infinity;
  for (const pin of pins) {
    const score = similarityScore(query, pin.label.toLowerCase());
    if (score > bestScore) {
      bestScore = score;
      best = pin;
    }
  }
  return best;
}

function similarityScore(a, b) {
  if (a === b) return 1;
  const distance = levenshtein(a, b);
  const maxLen = Math.max(a.length, b.length) || 1;
  return 1 - distance / maxLen;
}

function levenshtein(a, b) {
  const matrix = Array.from({ length: a.length + 1 }, () => Array(b.length + 1).fill(0));
  for (let i = 0; i <= a.length; i++) matrix[i][0] = i;
  for (let j = 0; j <= b.length; j++) matrix[0][j] = j;
  for (let i = 1; i <= a.length; i++) {
    for (let j = 1; j <= b.length; j++) {
      const cost = a[i - 1] === b[j - 1] ? 0 : 1;
      matrix[i][j] = Math.min(
        matrix[i - 1][j] + 1,
        matrix[i][j - 1] + 1,
        matrix[i - 1][j - 1] + cost
      );
    }
  }
  return matrix[a.length][b.length];
}
