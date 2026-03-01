import { loadPins, findPinsByLabel, pickBestPinBySimilarity } from '../../lib/pins.js';
import { revParse } from '../../lib/git.js';
import { promptChoice } from './prompt.js';

export async function resolvePin(reference) {
  const pins = await loadPins();
  const matches = findPinsByLabel(pins, reference);
  if (matches.length === 1) return matches[0];
  if (matches.length > 1) {
    const index = await promptChoice('Multiple pins match. Choose one:', matches.map((pin) => `${pin.label} (${pin.hash.slice(0, 7)})`));
    if (index === null) throw new Error('No pin selected.');
    return matches[index];
  }
  const best = pickBestPinBySimilarity(pins, reference);
  if (best) return best;
  throw new Error(`No pin found for "${reference}".`);
}

export async function resolveReference(reference) {
  if (!reference) return null;
  if (reference.startsWith('~')) {
    const count = Number(reference.slice(1));
    if (!Number.isInteger(count) || count <= 0) {
      throw new Error('Relative pin reference must be like ~1, ~2, etc.');
    }
    const pins = await loadPins();
    const sorted = [...pins].sort((a, b) => new Date(b.timestamp) - new Date(a.timestamp));
    const pin = sorted[count - 1];
    if (!pin) throw new Error(`Only ${pins.length} pins exist.`);
    return { hash: pin.hash, label: pin.label, pin };
  }

  const looksLikeHash = /^[0-9a-f]{4,40}$/i.test(reference);
  if (looksLikeHash) {
    try {
      const hash = await revParse(reference);
      return { hash, label: reference, pin: null };
    } catch {
      // fall through to pin matching
    }
  }

  const pins = await loadPins();
  const matches = findPinsByLabel(pins, reference);
  if (matches.length === 1) return { hash: matches[0].hash, label: matches[0].label, pin: matches[0] };
  if (matches.length > 1) {
    const index = await promptChoice('Multiple pins match. Choose one:', matches.map((pin) => `${pin.label} (${pin.hash.slice(0, 7)})`));
    if (index === null) throw new Error('No pin selected.');
    const pin = matches[index];
    return { hash: pin.hash, label: pin.label, pin };
  }
  if (pins.length) {
    const best = pickBestPinBySimilarity(pins, reference);
    if (best) return { hash: best.hash, label: best.label, pin: best };
  }

  const hash = await revParse(reference);
  return { hash, label: reference, pin: null };
}
