import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import net from 'node:net';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';
import { once } from 'node:events';
import { AI_IDS } from '../lib/members.mjs';
import { Store } from '../lib/store.mjs';

const ROOT = path.dirname(path.dirname(fileURLToPath(import.meta.url)));
async function until(fn, timeout = 12000) {
  const end = Date.now() + timeout;
  while (Date.now() < end) {
    const value = await fn(); if (value) return value;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`Condition not met within ${timeout} ms`);
}
async function start(t, { mock = false, rawConfig } = {}) {
  const home = fs.mkdtempSync(path.join(os.tmpdir(), 'room-server-test-'));
  t.after(() => fs.rmSync(home, { recursive: true, force: true }));
  const probe = net.createServer(); probe.listen(0, '127.0.0.1'); await once(probe, 'listening');
  const port = probe.address().port; await new Promise((resolve) => probe.close(resolve));
  const config = path.join(home, 'config.json');
  let bin = path.join(home, 'not-installed');
  if (mock) {
    bin = path.join(home, 'codex-fixture');
    // A local, deterministic CLI double. It does not contact a model or read credentials.
    fs.writeFileSync(bin, `#!/usr/bin/env node
const fs = require('node:fs'), path = require('node:path'), readline = require('node:readline');
const args = process.argv.slice(2);
if (args[0] === 'app-server') {
 const rl = readline.createInterface({input: process.stdin});
 rl.on('line', line => {
  const m = JSON.parse(line); if (m.id == null) return;
  const result = m.method === 'account/rateLimits/read' ? {rateLimits:{planType:'pro',primary:{windowDurationMins:300,usedPercent:25}}} : {};
  console.log(JSON.stringify({jsonrpc:'2.0',id:m.id,result}));
 });
} else if (args[0] === 'exec') {
 let input = ''; process.stdin.setEncoding('utf8'); process.stdin.on('data', d => input += d);
 process.stdin.on('end', () => {
  const id = path.basename(path.dirname(process.cwd()));
  const action = {action:'say',messages:['mock reply from ' + id],note_add:'private note ' + id};
  fs.writeFileSync(args[args.indexOf('-o')+1],JSON.stringify(action));
 });
} else process.exit(1);
`, { mode: 0o755 });
  }
  fs.writeFileSync(config, rawConfig ?? JSON.stringify({ port, host: '127.0.0.1', language: 'en', bins: { codex: bin }, imageGen: false, speed: 'fast', maxInFlight: 1, dev: { enabled: false }, spark: { enabled: false }, agents: { claude: { model: 'sonnet' }, grok: { model: 'grok-4.7' }, gemini: { model: 'gemini-3.8-flash-medium' } } }));
  // Seed old data to verify migration does not clear it.
  const old = new Store(home);
  old.addMessage({ from: 'claude', text: 'preexisting conversation' });
  old.writeNote('gemini', 'preexisting private note');
  const child = spawn(process.execPath, ['server.mjs'], { cwd: ROOT, env: { ...process.env, PORT: String(port), CHATROOM_HOME: home, CHATROOM_CONFIG: config }, stdio: ['ignore', 'pipe', 'pipe'] });
  let log = ''; child.stdout.on('data', (d) => log += d); child.stderr.on('data', (d) => log += d);
  t.after(async () => {
    if (child.exitCode == null && child.signalCode == null) {
      const closed = once(child, 'exit'); child.kill('SIGTERM'); await closed;
    }
  });
  const base = `http://127.0.0.1:${port}`;
  async function get(p) { const r = await fetch(base + p); assert.equal(r.status, 200, p); return r.json(); }
  async function post(p, body) { const r = await fetch(base + p, { method: 'POST', headers: { 'content-type': 'application/json', Origin: base }, body: JSON.stringify(body) }); assert.equal(r.status, 200, `${p} ${await r.clone().text()}`); return r.json(); }
  if (rawConfig) return { child, log: () => log };
  await until(async () => {
    if (child.exitCode != null) throw new Error(log);
    try { return (await fetch(base + '/api/state')).ok; } catch { return false; }
  });
  return { get, post, base, home, log: () => log };
}

test('HTTP server runs without Codex, shows four members, and preserves old data', async (t) => {
  const s = await start(t);
  const state = await s.get('/api/state');
  assert.equal(state.members.length, 4); assert.equal(state.room.boostMode, 'manual');
  for (const [i, m] of state.members.entries()) {
    assert.equal(m.name, `ChatGPT-${i + 1}`); assert.equal(m.provider, 'codex');
    assert.equal(m.model, 'gpt-6-sol'); assert.equal(m.available, false);
    assert.ok(m.aliases.includes(`chatgpt-${i + 1}`));
  }
  assert.ok(state.messages.some((m) => m.text === 'preexisting conversation'));
  assert.equal((await s.get('/api/notes')).gemini, 'preexisting private note');
  for (const p of ['/', '/app.js', '/i18n.js', '/world.html']) assert.equal((await fetch(s.base + p)).status, 200, p);
  await s.post('/api/send', { text: '@ChatGPT-1 hello' });
  assert.ok((await s.get('/api/state')).messages.some((m) => m.text === '@ChatGPT-1 hello'));
});

test('malformed config fails loudly rather than silently using defaults', async (t) => {
  const s = await start(t, { rawConfig: '{ invalid json' });
  await until(() => s.child.exitCode != null);
  assert.notEqual(s.child.exitCode, 0); assert.match(s.log(), /config/i);
});

test('real server + mock CLI: four speakers, separate notes, one shared quota', { skip: process.platform === 'win32' ? 'POSIX executable fixture; Windows adapter and server smoke tests run separately' : false, timeout: 40000 }, async (t) => {
  const s = await start(t, { mock: true });
  await until(async () => (await s.get('/api/state')).usage.gpt?.ok);
  const before = await s.get('/api/state');
  for (const m of before.members) assert.equal(m.available, true);
  for (const id of AI_IDS) {
    assert.equal(before.usage[id].sharedAccount, 'codex');
    assert.equal(before.usage[id].windows[0].remainingPct, 75);
  }
  await s.post('/api/room', { running: true });
  await s.post('/api/send', { text: '@ChatGPT-1 @ChatGPT-2 @ChatGPT-3 @ChatGPT-4 say hello' });
  const state = await until(async () => {
    const v = await s.get('/api/state');
    return AI_IDS.every((id) => v.messages.some((m) => m.from === id && m.text === `mock reply from ${id}`)) && v;
  }, 30000);
  await s.post('/api/room', { running: false });
  assert.ok(state.members.every((m) => m.calls >= 1));
  const notes = await s.get('/api/notes');
  for (const id of AI_IDS) {
    assert.ok(notes[id].includes(`private note ${id}`));
    for (const other of AI_IDS.filter((x) => x !== id)) assert.ok(!notes[id].includes(`private note ${other}`));
  }
  assert.ok(notes.gemini.includes('preexisting private note'));
});
