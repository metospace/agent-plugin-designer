const { spawnSync } = require('node:child_process');
const { mkdtempSync, readFileSync, rmSync } = require('node:fs');
const { join, resolve } = require('node:path');
const { tmpdir } = require('node:os');
if (process.platform !== 'win32') throw Error('Run this packaged-app test on Windows');
const root = mkdtempSync(join(tmpdir(), 'agent-studio-test-'));
try {
  for (const mode of ['write', 'read']) {
    const result = join(root, `${mode}.json`);
    const child = spawnSync(resolve('release/win-unpacked/Agent Studio.exe'), [], {
      timeout: 45000,
      env: { ...process.env, AGENT_STUDIO_SMOKE_MODE: mode, AGENT_STUDIO_SMOKE_DIR: join(root, 'profile'), AGENT_STUDIO_SMOKE_RESULT: result },
    });
    if (child.error || child.status !== 0) throw child.error || Error(`Desktop exited ${child.status}`);
    const evidence = JSON.parse(readFileSync(result, 'utf8'));
    if (evidence.error || !evidence.persisted || evidence.nodes < 1) throw Error(JSON.stringify(evidence));
    console.log(JSON.stringify(evidence));
  }
} finally { rmSync(root, { recursive: true, force: true }); }
