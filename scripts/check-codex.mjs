// Checks installation, argument parsing and feature names only. No login or model calls.
import assert from 'node:assert/strict';
import { execFileSync } from 'node:child_process';
import { resolveBins, Adapters } from '../lib/agents.mjs';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
const { codex } = resolveBins();
assert.ok(codex, 'Codex executable not found. Install/update @openai/codex first.');
const home = fs.mkdtempSync(path.join(os.tmpdir(), 'room-cli-check-'));
try {
  const options = { encoding: 'utf8', timeout: 30000, windowsHide: true, env: { ...process.env, CODEX_HOME: home } };
  console.log(`Resolved Codex: ${codex}`);
  console.log(execFileSync(codex, ['--version'], options).trim());
  const help = execFileSync(codex, ['exec', '--help'], options);
  for (const flag of ['--ignore-user-config', '--ephemeral', '--sandbox', '--output-last-message', '--image']) assert.ok(help.includes(flag), `Update Codex; missing ${flag}`);
  const features = execFileSync(codex, ['features', 'list'], options);
  for (const feature of ['shell_tool', 'computer_use', 'browser_use', 'apps']) assert.match(features, new RegExp(`\\b${feature}\\b`));
  const ad = new Adapters(home, { bins: { codex } });
  let checked = 0;
  ad.run = async (_, args) => {
    // --help checks clap arguments but never submits a prompt to a model.
    const helpArgs = args.filter((a) => a !== '-'); helpArgs.push('--help');
    execFileSync(codex, helpArgs, options); checked++;
    return { code: 0, stdout: '', stderr: '', ms: 0 };
  };
  await ad.chat('claude', '', ''); await ad.image('gemini', '');
  assert.equal(checked, 2);
  console.log('Codex compatibility: chat/image CLI arguments and required feature names passed (no model calls).');
} finally { fs.rmSync(home, { recursive: true, force: true }); }
