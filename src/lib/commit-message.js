import path from 'path';

export function generateCommitMessage(nameStatusLines) {
  const files = parseNameStatus(nameStatusLines);
  if (!files.length) {
    return '[vibe:auto] Updated project files';
  }

  if (files.length === 1) {
    const file = files[0];
    if (file.status === 'A') return `[vibe:auto] Created ${file.file}`;
    if (file.status === 'D') return `[vibe:auto] Deleted ${file.file}`;
    return `[vibe:auto] Modified ${file.file}`;
  }

  const dirs = new Set(files.map((file) => path.dirname(file.file)));
  if (dirs.size === 1) {
    const dir = [...dirs][0];
    if (dir === '.') {
      return `[vibe:auto] Changes in project root (${files.length} files)`;
    }
    return `[vibe:auto] Updated ${dir}/ (${files.length} files)`;
  }

  const primary = files[0].file;
  return `[vibe:auto] Modified ${primary} and ${files.length - 1} other files`;
}

function parseNameStatus(lines) {
  return lines
    .filter(Boolean)
    .map((line) => line.trim())
    .map((line) => {
      const parts = line.split('\t');
      if (!parts.length) return null;
      const status = parts[0][0];
      if (status === 'R' && parts.length >= 3) {
        return { status: 'R', file: parts[2] };
      }
      const file = parts[1] || parts[0].slice(1).trim();
      return { status, file };
    })
    .filter(Boolean);
}
