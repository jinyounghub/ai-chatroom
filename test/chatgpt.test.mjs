import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { AI_IDS, MEMBERS, mentions, atMentions, withJosa } from '../lib/members.mjs';
import { normalizeAgents, DEFAULT_MODEL, DEFAULT_BOOST_MODEL } from '../lib/chatgpt-config.mjs';
import { Adapters, resolveBins, run } from '../lib/agents.mjs';
import { UsageMonitor } from '../lib/usage.mjs';
import { buildBrief, buildTurn } from '../lib/prompt.mjs';
import { Router } from '../lib/router.mjs';
import { Store } from '../lib/store.mjs';
import { setLang } from '../lib/i18n.mjs';

const temp = (t) => {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'chatgpt-test-'));
  t.after(() => fs.rmSync(dir, { recursive: true, force: true }));
  return dir;
};
function adapter(t, agents = {}) {
  return new Adapters(temp(t), { bins: { codex: process.execPath }, agents, imageGen: true, boost: { timeoutSec: 360 } });
}
function spy(ad, response = 'OK') {
  const calls = [];
  ad.run = async (cmd, args, opts) => {
    calls.push({ cmd, args, opts });
    if (args.includes('-o')) fs.writeFileSync(args[args.indexOf('-o') + 1], response);
    return { code: 0, stdout: 'not the reply', stderr: '', ms: 3 };
  };
  return calls;
}

test('four independent configurations use Codex defaults', () => {
  const a = normalizeAgents();
  assert.deepEqual(Object.keys(a), AI_IDS);
  for (const id of AI_IDS) { assert.equal(a[id].model, DEFAULT_MODEL); assert.equal(a[id].boost.model, DEFAULT_BOOST_MODEL); }
  a.claude.boost.effort = 'high';
  assert.equal(a.gpt.boost.effort, 'medium');
  assert.equal(normalizeAgents().claude.boost.effort, 'medium');
});
test('legacy models migrate without changing the supplied config', () => {
  const input = { claude: { model: 'sonnet', boost: { model: 'opus' } }, grok: { model: 'grok-4.7', effort: 'high' }, gemini: { model: 'gemini-3.8-flash-medium' } };
  const saved = JSON.stringify(input);
  const a = normalizeAgents(input);
  assert.ok(AI_IDS.every((id) => a[id].model === DEFAULT_MODEL));
  assert.equal(a.grok.effort, 'high');
  assert.equal(JSON.stringify(input), saved);
});
test('custom models, image models and disabled/legacy boosts survive', () => {
  const a = normalizeAgents({ claude: { model: 'gpt-6-luna', imageModel: 'gpt-6-astra', boost: null }, gpt: { deepModel: 'gpt-6-astra', deepEffort: 'high' }, grok: { boost: false } });
  assert.equal(a.claude.model, 'gpt-6-luna');
  assert.equal(a.claude.imageModel, 'gpt-6-astra');
  assert.equal(a.claude.boost, null);
  assert.equal(a.grok.boost, null);
  assert.equal(a.gpt.boost.effort, 'high');
});
test('malformed configuration is rejected', () => {
  for (const input of [[], 'bad', { claude: [] }, { gpt: { model: 2 } }, { grok: { effort: 'invalid' } }, { gemini: { boost: 'high' } }]) assert.throws(() => normalizeAgents(input));
});
for (const [i, id] of AI_IDS.entries()) {
  test(`${id}: identity, mention and boost routing select one member`, () => {
    assert.equal(MEMBERS[id].name, `ChatGPT-${i + 1}`);
    assert.equal(MEMBERS[id].maker, 'OpenAI');
    for (const text of [`@ChatGPT-${i + 1}`, `@GPT${i + 1}`, `@지피티${i + 1}야`]) {
      assert.deepEqual(AI_IDS.filter((x) => atMentions(text, x)), [id], text);
    }
    assert.ok(mentions(MEMBERS[id].name, id));
    assert.deepEqual(Router.parseCommand(`/boost @ChatGPT-${i + 1} hello`).ids, [id]);
  });
  test(`${id}: all chat calls use Codex, with isolated workdirs and tool restrictions`, async (t) => {
    const ad = adapter(t);
    const calls = spy(ad);
    const photo = path.join(ad.root, 'photo.png'); fs.writeFileSync(photo, 'test fixture');
    const result = await ad.chat(id, 'member-specific brief', 'hello', { images: [photo] });
    assert.equal(result.text, 'OK'); assert.equal(result.ok, true);
    assert.equal(calls.length, 1);
    const { cmd, args, opts } = calls[0];
    assert.equal(cmd, process.execPath);
    assert.equal(args[0], 'exec'); assert.equal(args[args.indexOf('-m') + 1], DEFAULT_MODEL);
    assert.equal(args[args.indexOf('-s') + 1], 'read-only');
    for (const value of ['shell_tool', 'computer_use', 'browser_use', 'apps', '--ignore-user-config', '--ephemeral', 'approval_policy="never"', 'web_search="disabled"', `--image=${photo}`]) assert.ok(args.includes(value), value);
    assert.equal(opts.cwd, path.join(ad.root, 'data', 'cwd', id, 'chat'));
    assert.ok(opts.input.includes('member-specific brief')); assert.ok(opts.input.includes('hello'));
    assert.ok(!fs.existsSync(args[args.indexOf('-o') + 1]));
    assert.ok(ad.canSee(id)); assert.equal(ad.maxPromptChars(id), 120000);
  });
  test(`${id}: image generation uses that member's Codex model`, async (t) => {
    const ad = adapter(t, { [id]: { imageModel: 'gpt-6-astra' } });
    ad.run = async (cmd, args, opts) => {
      assert.equal(cmd, process.execPath);
      assert.equal(args[args.indexOf('-m') + 1], 'gpt-6-astra');
      assert.equal(args[args.indexOf('-s') + 1], 'workspace-write');
      assert.ok(args.includes('shell_tool'));
      fs.writeFileSync(path.join(opts.cwd, 'out.png'), 'mock image, not a generated picture');
      return { code: 0, stdout: '', stderr: '' };
    };
    const result = await ad.image(id, 'a test image');
    assert.ok(result.ok); assert.ok(result.file.includes(path.join(id, 'img-')));
  });
}
test('numbered mentions never partially match another member', () => {
  for (const s of ['@ChatGPT-10', '@GPT10', '@지피티10', 'notgpt1', '@ChatGPT-1-more']) assert.ok(!mentions(s, 'claude'), s);
  assert.ok(atMentions('@Claude', 'claude')); assert.ok(atMentions('@그록', 'grok'));
  assert.equal(withJosa('claude', 'me', '이/가'), 'ChatGPT-1이');
  assert.equal(withJosa('gpt', 'me', '이/가'), 'ChatGPT-2가');
});
test('boosts change only the addressed member model and timeout', async (t) => {
  const ad = adapter(t, { gemini: { boost: { model: 'gpt-6-astra', effort: 'high' } } });
  const calls = spy(ad);
  await ad.chat('gemini', 'brief', 'turn', { boost: true });
  assert.equal(calls[0].args[2], 'gpt-6-astra');
  assert.ok(calls[0].args.includes('model_reasoning_effort="high"'));
  assert.equal(calls[0].opts.timeoutMs, 360000);
});
test('four simultaneous adapter requests have separate output files', async (t) => {
  const ad = adapter(t); const calls = spy(ad);
  await Promise.all(AI_IDS.map((id) => ad.chat(id, id, 'hello')));
  assert.equal(new Set(calls.map((c) => c.opts.cwd)).size, 4);
  assert.equal(new Set(calls.map((c) => c.args[c.args.indexOf('-o') + 1])).size, 4);
});
test('missing Codex affects all four and does not launch another provider', async (t) => {
  const ad = adapter(t); ad.bins = { codex: null };
  ad.run = () => assert.fail('must not call any provider');
  assert.ok(Object.values(ad.available()).every((x) => !x));
  for (const id of AI_IDS) assert.equal((await ad.chat(id, '', '')).ok, false);
  assert.deepEqual(Object.keys(resolveBins({ codex: process.execPath, claude: process.execPath })), ['codex']);
});
test('errors and empty replies are not mistaken for successful answers', async (t) => {
  const ad = adapter(t); let out;
  ad.run = async (_, args) => { out = args[args.indexOf('-o') + 1]; fs.writeFileSync(out, 'partial'); return { code: -2, stderr: 'expired', timedOut: true, ms: 1 }; };
  const r = await ad.chat('gpt', '', '');
  assert.equal(r.ok, false); assert.match(r.detail, /timeout/); assert.ok(!fs.existsSync(out));
  spy(ad, ''); assert.equal((await ad.chat('gpt', '', '')).ok, false);
  await assert.rejects(() => ad.chat('invalid', '', ''), /unknown agent/);
});
test('photo descriptions use Codex only, with no web search', async (t) => {
  const ad = adapter(t); ad.cfg.webSearch = true;
  const calls = spy(ad, 'a  photo\n caption');
  const photo = path.join(ad.root, 'photo.png'); fs.writeFileSync(photo, 'test fixture');
  assert.equal((await ad.describeImage(photo)).text, 'a photo caption');
  assert.ok(calls[0].args.includes('web_search="disabled"'));
  assert.equal(calls[0].opts.timeoutMs, 90000);
  assert.equal((await ad.describeImage(path.join(ad.root, 'missing.png'))).ok, false);
  assert.equal(calls.length, 1);
});
test('image generation opt-out prevents a model call', async (t) => {
  const ad = adapter(t); ad.cfg.imageGen = false;
  ad.run = () => assert.fail('images disabled');
  assert.equal((await ad.image('claude', 'test')).ok, false);
});
test('shared account usage is fetched once, including when ChatGPT-2 is disabled', async (t) => {
  const u = new UsageMonitor(temp(t), { codex: process.execPath }); let calls = 0;
  u.gpt = async () => { calls++; return { plan: 'Pro', windows: [{ id: '5h', label: '5h', usedPct: 20 }] }; };
  await u.pollAll(AI_IDS); assert.equal(calls, 1);
  await u.pollAll(['claude', 'gemini']); assert.equal(calls, 2);
  assert.deepEqual(Object.keys(u.hist), ['gpt']);
  for (const id of AI_IDS) { assert.equal(u.view()[id].sharedAccount, 'codex'); assert.equal(u.view()[id].windows[0].remainingPct, 80); }
  const restored = new UsageMonitor(path.dirname(path.dirname(u.file)), { codex: process.execPath });
  assert.equal(restored.view().gemini.restored, true);
});
test('overlapping quota polls coalesce; stale snapshots survive errors', async (t) => {
  const u = new UsageMonitor(temp(t), {}); let calls = 0;
  u.gpt = async () => { calls++; await new Promise((r) => setTimeout(r, 5)); return { windows: [] }; };
  await Promise.all([u.pollAll(), u.pollAll()]); assert.equal(calls, 1);
  const at = u.latest.gpt.at;
  u.gpt = async () => { throw new Error('not logged in'); };
  await u.pollAll(); assert.equal(u.latest.gpt.at, at); assert.equal(u.view().claude.ok, false);
});
test('multilingual briefs identify four ChatGPT members and honor image opt-out', () => {
  for (const lang of ['ko', 'en', 'ja']) {
    setLang(lang);
    for (const id of AI_IDS) {
      const brief = buildBrief(id, { agents: normalizeAgents(), imageGen: false, userName: 'Test', roomName: 'Room' }, { mode: 'manual', canSee: true });
      for (const m of Object.values(MEMBERS)) assert.ok(brief.includes(`${m.name} (OpenAI)`));
      assert.ok(!brief.includes('"image":'));
      assert.ok(!brief.includes('a Claude that'));
    }
  }
  setLang('en');
});
test('existing IDs preserve chat and separate private notes', (t) => {
  setLang('en'); const root = temp(t); const store = new Store(root);
  for (const id of AI_IDS) { store.writeNote(id, `private-secret-${id}`); store.addMessage({ from: id, text: `old-${id}` }); }
  const restored = new Store(root);
  assert.equal(restored.messages.length, 4);
  for (const id of AI_IDS) {
    assert.equal(restored.readNote(id), `private-secret-${id}`);
    const turn = buildTurn(id, { store: restored, cfg: { userName: 'Test', historyForPrompt: 40 }, agent: { seen: 0 }, reason: 'new' });
    assert.ok(turn.includes(`private-secret-${id}`));
    for (const other of AI_IDS.filter((x) => x !== id)) assert.ok(!turn.includes(`private-secret-${other}`));
  }
});
test('process runner reports failures and kills timed out children', async () => {
  const r = await run(process.execPath, ['-e', 'setTimeout(() => {}, 10000)'], { timeoutMs: 100 });
  assert.equal(r.code, -2); assert.equal(r.timedOut, true);
});
