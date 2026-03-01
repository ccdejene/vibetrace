export function generateRestoreContext({
  targetLabel,
  targetHash,
  restoredAt,
  filesAtState,
  commitsAfter,
  pinsByHash
}) {
  const restoredTime = formatTime(restoredAt);
  const header = `# Vibe Restore Context\n\n` +
    `> Paste this into your AI coding assistant so it knows what happened.\n` +
    `> If you're using a supported AI tool integration with Vibe, this is\n` +
    `> loaded automatically.\n\n` +
    `## Current State\n\n` +
    `Project restored to: **"${targetLabel || 'Unknown'}"**  \n` +
    `Restored at: ${restoredTime}  \n` +
    `Commit: ${shortHash(targetHash)}  \n\n` +
    `## What Was Working at This Point\n\n` +
    `(Generated from the pinned commit's message and the files present)\n\n` +
    `Files in project at this state:\n` +
    `${filesAtState.map((file) => `- ${file}`).join('\n')}\n\n` +
    `## What Was Attempted After This Point\n\n`;

  const sections = buildAttemptedSections(commitsAfter, pinsByHash);
  const summary = buildSummary(commitsAfter, pinsByHash, targetLabel);
  const instructions = `## Instructions for AI\n\n` +
    `The codebase is now at the "${targetLabel || 'target'}" state. All files have been\n` +
    `reset to this point. The changes listed above have been undone.\n` +
    `Do NOT re-attempt the same approaches that failed unless the user\n` +
    `specifically asks. Consider alternative strategies for any features\n` +
    `that were attempted but failed after this restore point.\n`;

  return header + sections + summary + '\n' + instructions;
}

function buildAttemptedSections(commitsAfter, pinsByHash) {
  if (!commitsAfter.length) {
    return `No commits were made after this point.\n\n`;
  }

  const lines = [];
  let buffer = [];

  const flushPinned = (pin, commits) => {
    if (!commits.length) return;
    lines.push(`### PIN: "${pin.label}" - ${formatTime(pin.timestamp)} (${shortHash(pin.hash)} to ${shortHash(commits[commits.length - 1].hash)})`);
    lines.push('The following changes were made and verified working by the user:\n');
    for (const commit of commits) {
      lines.push(formatCommit(commit));
    }
    lines.push('');
  };

  const flushUnpinned = (commits) => {
    if (!commits.length) return;
    lines.push('### After last pin (UNPINNED - user did NOT verify these worked):\n');
    for (const commit of commits) {
      lines.push(formatCommit(commit));
    }
    lines.push('');
  };

  for (const commit of commitsAfter) {
    buffer.push(commit);
    const pin = pinsByHash.get(commit.hash);
    if (pin) {
      flushPinned(pin, buffer);
      buffer = [];
    }
  }

  flushUnpinned(buffer);
  return lines.join('\n');
}

function formatCommit(commit) {
  const time = formatTime(commit.date);
  const files = commit.files && commit.files.length
    ? commit.files.map((file) => `  - ${file}`).join('\n')
    : '  - (files unavailable)';
  return `- [vibe:auto] ${stripAutoPrefix(commit.message)} (${time})\n${files}`;
}

function buildSummary(commitsAfter, pinsByHash, targetLabel) {
  if (!commitsAfter.length) {
    return `## Summary\n\nNo changes were made after "${targetLabel || 'this point'}".\n\n`;
  }

  const pinsAfter = commitsAfter.map((commit) => pinsByHash.get(commit.hash)).filter(Boolean);
  const lastPin = pinsAfter.length ? pinsAfter[pinsAfter.length - 1] : null;
  const unpinned = commitsAfter.filter((commit) => !pinsByHash.has(commit.hash));
  const firstProblem = unpinned[0];

  let summary = `## Summary\n\n`;
  if (lastPin) {
    summary += `The project was stable through the "${lastPin.label}" pin.\n`;
  }
  if (firstProblem) {
    summary += `Problems started with \"${stripAutoPrefix(firstProblem.message)}\" at ${formatTime(firstProblem.date)} and continued through ${unpinned.length} attempt${unpinned.length === 1 ? '' : 's'} to fix the issue.\n`;
  }
  if (targetLabel) {
    summary += `The user chose to restore to "${targetLabel}" which is before the changes listed above.\n`;
  }
  summary += '\n';
  return summary;
}

function stripAutoPrefix(message) {
  return message.replace(/^\[vibe:auto\]\s*/i, '').trim();
}

function shortHash(hash) {
  return hash ? hash.slice(0, 7) : 'unknown';
}

function formatTime(value) {
  const date = value instanceof Date ? value : new Date(value);
  return date.toLocaleTimeString('en-US', { hour: 'numeric', minute: '2-digit' });
}
