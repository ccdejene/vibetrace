import fs from 'fs';
import path from 'path';
import { spawnSync } from 'child_process';

const PROJECT_ROOT = path.resolve(import.meta.dirname, '..');
const VIBE_BIN = path.join(PROJECT_ROOT, 'bin', 'vibe.js');
const TMP_DIR = '/tmp/vibe-test-project';

function run(cmd, args, cwd) {
  const result = spawnSync(cmd, args, { cwd, stdio: 'inherit' });
  if (result.status !== 0) {
    throw new Error(`Command failed: ${cmd} ${args.join(' ')}`);
  }
}

function sleep(ms) {
  return new Promise((resolve) => setTimeout(resolve, ms));
}

async function main() {
  fs.rmSync(TMP_DIR, { recursive: true, force: true });
  fs.mkdirSync(TMP_DIR, { recursive: true });

  run('git', ['init', '-q'], TMP_DIR);
  run('git', ['config', 'user.email', 'test@example.com'], TMP_DIR);
  run('git', ['config', 'user.name', 'Vibe Test'], TMP_DIR);

  run(process.execPath, [VIBE_BIN, 'init'], TMP_DIR);
  run(process.execPath, [VIBE_BIN, 'watch', '--daemon'], TMP_DIR);

  fs.writeFileSync(path.join(TMP_DIR, 'README.md'), '# Test Project\n', 'utf8');
  fs.mkdirSync(path.join(TMP_DIR, 'src'), { recursive: true });
  fs.writeFileSync(path.join(TMP_DIR, 'src', 'app.js'), "console.log('hello');\n", 'utf8');

  await sleep(3000);
  run(process.execPath, [VIBE_BIN, 'pin', 'Initial feature'], TMP_DIR);

  fs.writeFileSync(path.join(TMP_DIR, 'src', 'app.js'), "console.log('hello world');\n", 'utf8');
  fs.writeFileSync(path.join(TMP_DIR, 'src', 'util.js'), 'export function sum(a,b){return a+b;}\n', 'utf8');

  await sleep(3000);
  run(process.execPath, [VIBE_BIN, 'pin', 'Second feature'], TMP_DIR);

  fs.writeFileSync(path.join(TMP_DIR, 'src', 'app.js'), "throw new Error('broken');\n", 'utf8');

  await sleep(3000);
  run(process.execPath, [VIBE_BIN, 'log'], TMP_DIR);
  run(process.execPath, [VIBE_BIN, 'log', '--all'], TMP_DIR);

  run(process.execPath, [VIBE_BIN, 'restore', 'Initial feature'], TMP_DIR);

  run(process.execPath, [VIBE_BIN, 'watch', '--stop'], TMP_DIR);

  const contextPath = path.join(TMP_DIR, '.vibe', 'restore-context.md');
  if (!fs.existsSync(contextPath)) {
    throw new Error('restore-context.md was not created.');
  }

  console.log('OK: Smoke test completed.');
}

main().catch((error) => {
  console.error('ERROR:', error.message);
  try {
    run(process.execPath, [VIBE_BIN, 'watch', '--stop'], TMP_DIR);
  } catch {
    // ignore
  }
  process.exit(1);
});
