import simpleGit from 'simple-git';

export function getGit() {
  return simpleGit({ baseDir: process.cwd() });
}

export async function ensureGitRepo() {
  const git = getGit();
  const isRepo = await git.checkIsRepo();
  if (!isRepo) {
    await git.init();
  }
}

export async function hasUncommittedChanges() {
  const git = getGit();
  const status = await git.status();
  return status.files.length > 0;
}

export async function stageAll() {
  const git = getGit();
  await git.add(['-A']);
}

export async function commit(message) {
  const git = getGit();
  return git.commit(message);
}

export async function getHeadHash() {
  const git = getGit();
  const hash = await git.revparse(['HEAD']);
  return hash.trim();
}

export async function revParse(ref) {
  const git = getGit();
  const hash = await git.revparse([ref]);
  return hash.trim();
}

export async function getLog(options = {}) {
  const git = getGit();
  return git.log(options);
}

export async function getStatMap(hashes) {
  if (!hashes.length) return new Map();
  const args = ['log', '--format=COMMIT:%H', '--shortstat', ...hashes.map(h => `${h}^!`)];
  const output = await raw(args);
  const map = new Map();
  let current = null;
  for (const line of output.split('\n')) {
    if (line.startsWith('COMMIT:')) {
      current = line.slice(7).trim();
    } else if (current && line.includes('changed')) {
      const ins = parseInt(line.match(/(\d+) insertion/)?.[1] ?? '0');
      const del = parseInt(line.match(/(\d+) deletion/)?.[1] ?? '0');
      map.set(current, { ins, del });
      current = null;
    }
  }
  return map;
}

export async function addTag(tag, hash) {
  const git = getGit();
  await git.raw(['tag', tag, hash]);
}

export async function listTags() {
  const git = getGit();
  const tags = await git.tags();
  return tags.all;
}

export async function diff(args = []) {
  const git = getGit();
  return git.diff(args);
}

export async function raw(args) {
  const git = getGit();
  return git.raw(args);
}

export async function resetHard(ref) {
  const git = getGit();
  await git.raw(['reset', '--hard', ref]);
}

export async function checkoutTree(ref) {
  const git = getGit();
  await git.raw(['checkout', ref, '--', '.']);
}

export async function getUserIdentity() {
  const git = getGit();
  const name = (await git.raw(['config', '--get', 'user.name'])).trim();
  const email = (await git.raw(['config', '--get', 'user.email'])).trim();
  return { name, email };
}
