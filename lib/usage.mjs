// All four room members share one Codex account allowance. Poll and persist it once.
import { spawn } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { killTree, running, spawnOpts } from './agents.mjs';
import { pick } from './i18n.mjs';

const KEEP_MS = 8 * 24 * 3600 * 1000;

// Send JSON-RPC requests one after another over a child's stdio (newline-delimited),
// collect the results, then kill the child. `steps`: {method, params} or {notify, params}.
export function rpcOnce(cmd, args, steps, { cwd, timeoutMs = 30000 } = {}) {
  return new Promise((resolve, reject) => {
    let child;
    try { child = spawn(cmd, args, { cwd, ...spawnOpts, env: process.env }); } catch (e) { reject(e); return; }
    running.add(child);
    const results = [];
    let i = 0, nextId = 1, waiting = null, done = false, buf = '';
    const finish = (err) => {
      if (done) return;
      done = true;
      clearTimeout(timer);
      running.delete(child);
      try { child.stdin.end(); } catch { /* closed */ }
      killTree(child.pid);
      if (err) reject(err); else resolve(results);
    };
    const timer = setTimeout(() => finish(new Error(`timeout after ${timeoutMs}ms`)), timeoutMs);
    const write = (obj) => { try { child.stdin.write(JSON.stringify({ jsonrpc: '2.0', ...obj }) + '\n'); } catch { /* closed */ } };
    const sendNext = () => {
      while (i < steps.length) {
        const s = steps[i++];
        if (s.notify) { write({ method: s.notify, ...(s.params ? { params: s.params } : {}) }); continue; }
        waiting = nextId++;
        write({ id: waiting, method: s.method, params: s.params ?? {} });
        return;
      }
      finish();
    };
    child.stdout.setEncoding('utf8');
    child.stdout.on('data', (d) => {
      buf += d;
      let nl;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let msg;
        try { msg = JSON.parse(line); } catch { continue; }
        if (msg.id != null && msg.method) {
          // A request from the other side (permissions etc.): we support none.
          write({ id: msg.id, error: { code: -32601, message: 'not supported' } });
        } else if (msg.id === waiting) {
          if (msg.error) { finish(new Error(msg.error.message || 'rpc error')); return; }
          results.push(msg.result);
          waiting = null;
          sendNext();
        }
      }
    });
    child.stderr.on('data', () => {});
    child.stdin.on('error', () => {});
    child.on('error', (e) => finish(e));
    child.on('close', () => finish(done ? null : new Error('process exited early')));
    sendNext();
  });
}

// Labels and notes shown in the usage panel.
const T = {
  ko: {
    h5: '5시간',
    week: '주간',
    days: (n) => `${n}일`,
    hours: (n) => `${n}시간`,
    subscription: '구독',
    spendCap: '지출 한도 도달',
    limitHit: '한도 도달',
    weekCredits: '주간 크레딧',
    monthCredits: '월간 크레딧',
    credits: '크레딧',
    payg: (used, cap) => `종량제 ${used} / ${cap}`,
  },
  en: {
    h5: '5h',
    week: 'Weekly',
    days: (n) => `${n}d`,
    hours: (n) => `${n}h`,
    subscription: 'Subscription',
    spendCap: 'Spend limit reached',
    limitHit: 'Limit reached',
    weekCredits: 'Weekly credits',
    monthCredits: 'Monthly credits',
    credits: 'Credits',
    payg: (used, cap) => `Pay as you go ${used} / ${cap}`,
  },
  ja: {
    h5: '5時間',
    week: '週間',
    days: (n) => `${n}日`,
    hours: (n) => `${n}時間`,
    subscription: 'サブスク',
    spendCap: '支出上限に到達',
    limitHit: '上限に到達',
    weekCredits: '週間クレジット',
    monthCredits: '月間クレジット',
    credits: 'クレジット',
    payg: (used, cap) => `従量課金 ${used} / ${cap}`,
  },
};
const tx = () => pick(T);

function windowLabel(mins) {
  const t = tx();
  if (mins === 300) return t.h5;
  if (mins === 10080) return t.week;
  if (mins >= 1440 && mins % 1440 === 0) return t.days(mins / 1440);
  return t.hours(Math.round(mins / 60));
}

const round1 = (x) => Math.round(x * 10) / 10;

export class UsageMonitor {
  constructor(root, bins, { onUpdate } = {}) {
    this.bins = bins;
    this.onUpdate = onUpdate || (() => {});
    this.file = path.join(root, 'data', 'usage.jsonl');
    this.cwd = path.join(root, 'data', 'cwd', 'usage');
    fs.mkdirSync(this.cwd, { recursive: true });
    this.latest = {};
    this.hist = { gpt: [] };
    this.polling = false;
    this.lastPoll = 0;
    this.load();
  }

  load() {
    if (!fs.existsSync(this.file)) return;
    const cutoff = Date.now() - KEEP_MS;
    const kept = [];
    for (const line of fs.readFileSync(this.file, 'utf8').split('\n')) {
      if (!line.trim()) continue;
      let rec;
      try { rec = JSON.parse(line); } catch { continue; }
      if (rec.at < cutoff || !this.hist[rec.id]) continue;
      this.hist[rec.id].push(rec);
      kept.push(line);
    }
    fs.writeFileSync(this.file, kept.length ? kept.join('\n') + '\n' : '');
    // Show the last known numbers right away; they are marked stale by their timestamp.
    for (const [id, list] of Object.entries(this.hist)) {
      const last = list[list.length - 1];
      if (last?.snap) this.latest[id] = { ...last.snap, restored: true };
    }
  }

  // ---- fetchers: each returns {plan, windows: [{id, label, usedPct, resetsAt}], note} ----

  async gpt() {
    const res = await rpcOnce(this.bins.codex, ['app-server'], [
      { method: 'initialize', params: { clientInfo: { name: 'ai-chatroom', title: 'AI chatroom', version: '0.1.0' } } },
      { notify: 'initialized' },
      { method: 'account/rateLimits/read' },
    ], { cwd: this.cwd, timeoutMs: 30000 });
    const rl = res[1]?.rateLimits;
    if (!rl) throw new Error('no rate limit data');
    const windows = [];
    for (const [key, w] of [['primary', rl.primary], ['secondary', rl.secondary]]) {
      if (!w) continue;
      const mins = w.windowDurationMins;
      windows.push({ id: mins === 300 ? '5h' : mins === 10080 ? 'week' : key, label: windowLabel(mins), usedPct: Number(w.usedPercent), resetsAt: w.resetsAt ? w.resetsAt * 1000 : null });
    }
    windows.sort((a, b) => (a.id === '5h' ? -1 : b.id === '5h' ? 1 : 0));
    const plan = { prolite: 'Pro Lite', pro: 'Pro', plus: 'Plus', team: 'Team', business: 'Business', enterprise: 'Enterprise', free: 'Free' }[rl.planType] || rl.planType || null;
    const note = rl.spendControlReached ? tx().spendCap : rl.rateLimitReachedType ? tx().limitHit : null;
    return { plan, windows, note };
  }

  // ---- polling ----

  async pollOne(id) {
    const at = Date.now();
    try {
      const snap = await this[id]();
      this.latest[id] = { ok: true, at, ...snap };
      const rec = { at, id, w: Object.fromEntries(snap.windows.map((w) => [w.id, w.usedPct])), snap: this.latest[id] };
      this.hist[id].push(rec);
      fs.appendFileSync(this.file, JSON.stringify(rec) + '\n');
    } catch (e) {
      const prev = this.latest[id];
      this.latest[id] = { ...(prev || {}), ok: false, errorAt: at, error: String(e.message || e).slice(0, 200) };
    }
  }

  async pollAll(ids = ['claude', 'gpt', 'grok', 'gemini']) {
    if (this.polling) return;
    this.polling = true;
    this.lastPoll = Date.now();
    try {
      if (ids.length) await this.pollOne('gpt');
    } finally {
      this.polling = false;
    }
    this.onUpdate(this.view());
  }

  // Sum of increases of window `key` over the last `spanMs`. A drop means the window
  // reset, so the new value counts as fresh usage.
  delta(id, key, spanMs, now = Date.now()) {
    const list = this.hist[id].filter((r) => r.w[key] != null);
    if (!list.length) return null;
    const from = now - spanMs;
    let startIdx = list.findIndex((r) => r.at >= from);
    if (startIdx === -1) return { pct: 0, coveredMs: spanMs };
    const base = startIdx > 0 ? startIdx - 1 : startIdx;
    let sum = 0;
    for (let i = base + 1; i < list.length; i++) {
      const d = list[i].w[key] - list[i - 1].w[key];
      sum += d >= 0 ? d : list[i].w[key];
    }
    const coveredMs = now - list[base].at;
    return { pct: round1(sum), coveredMs: Math.min(coveredMs, spanMs), partial: coveredMs < spanMs * 0.9 };
  }

  series(id, key, spanMs, now = Date.now(), maxPoints = 72) {
    const pts = this.hist[id].filter((r) => r.at >= now - spanMs && r.w[key] != null).map((r) => [r.at, r.w[key]]);
    if (pts.length <= maxPoints) return pts;
    const step = pts.length / maxPoints;
    const out = [];
    for (let i = 0; i < maxPoints; i++) out.push(pts[Math.floor(i * step)]);
    out.push(pts[pts.length - 1]);
    return out;
  }

  view() {
    const now = Date.now();
    const out = {};
    for (const id of Object.keys(this.hist)) {
      const l = this.latest[id];
      if (!l) { out[id] = null; continue; }
      out[id] = {
        ok: l.ok, at: l.at, error: l.error, errorAt: l.errorAt, plan: l.plan, note: l.note, restored: !!l.restored,
        windows: (l.windows || []).map((w) => ({
          ...w,
          remainingPct: round1(Math.max(0, 100 - w.usedPct)),
          delta30: this.delta(id, w.id, 30 * 60000, now),
          series: w.minor ? [] : this.series(id, w.id, 3 * 3600000, now),
        })),
      };
    }
    return Object.fromEntries(['claude', 'gpt', 'grok', 'gemini'].map((id) =>
      [id, out.gpt ? { ...out.gpt, sharedAccount: 'codex' } : null]));
  }
}
