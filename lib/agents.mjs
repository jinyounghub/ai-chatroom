// ChatGPT-only CLI adapter. Each member has separate cwd, prompt and private room notes.
// Authentication is reused from the single Codex CLI login, not from browser cookies.
import { spawn, execFile } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import crypto from 'node:crypto';
import { pick } from './i18n.mjs';
import { AI_IDS } from './members.mjs';
import { normalizeAgents } from './chatgpt-config.mjs';

const HOME = os.homedir();
const WIN = process.platform === 'win32';
const isFile = (file) => { try { return !!file && fs.statSync(file).isFile(); } catch { return false; } };
export function onPath(name) {
  for (const dir of (process.env.PATH || '').split(path.delimiter)) {
    if (dir && isFile(path.join(dir, name))) return path.join(dir, name);
  }
  return null;
}
function newestUnder(root, ...rest) {
  try {
    return fs.readdirSync(root).map((d) => path.join(root, d, ...rest)).filter(isFile)
      .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] || null;
  } catch { return null; }
}

// Windows npm .cmd shims cannot be spawned shell-free. Resolve the native binary in
// both current optional platform packages and older bundled vendor layouts.
export function resolveBins(overrides = {}) {
  if (overrides.codex) {
    if (typeof overrides.codex !== 'string') throw new TypeError('bins.codex must be an executable path');
    if (WIN && /\.(cmd|bat)$/i.test(overrides.codex)) throw new Error('bins.codex must point to codex.exe, not a .cmd/.bat shim');
    return { codex: isFile(overrides.codex) ? overrides.codex : null };
  }
  const candidates = [onPath(WIN ? 'codex.exe' : 'codex')];
  if (WIN) {
    const local = process.env.LOCALAPPDATA || path.join(HOME, 'AppData', 'Local');
    candidates.push(path.join(local, 'Programs', 'OpenAI', 'Codex', 'bin', 'codex.exe'),
      newestUnder(path.join(local, 'OpenAI', 'Codex', 'bin'), 'codex.exe'));
    const npmRoots = new Set([
      path.join(process.env.APPDATA || path.join(HOME, 'AppData', 'Roaming'), 'npm', 'node_modules'),
      path.join(path.dirname(process.execPath), 'node_modules'),
      ...(process.env.PATH || '').split(path.delimiter).filter(Boolean).map((p) => path.join(p, 'node_modules')),
    ]);
    const arch = process.arch === 'arm64' ? 'arm64' : 'x64';
    const triple = arch === 'arm64' ? 'aarch64-pc-windows-msvc' : 'x86_64-pc-windows-msvc';
    for (const root of npmRoots) {
      for (const pkg of [
        path.join(root, '@openai', `codex-win32-${arch}`),
        path.join(root, '@openai', 'codex', 'node_modules', '@openai', `codex-win32-${arch}`),
        path.join(root, '@openai', 'codex'),
      ]) for (const dir of ['bin', 'codex']) candidates.push(path.join(pkg, 'vendor', triple, dir, 'codex.exe'));
    }
  } else {
    candidates.push(path.join(HOME, '.local', 'bin', 'codex'), '/opt/homebrew/bin/codex', '/usr/local/bin/codex');
  }
  return { codex: candidates.find(isFile) || null };
}

// Children are spawned in their own process group on macOS/Linux (see spawnOpts), so the
// whole tree can be killed there too.
export function killTree(pid) {
  if (!pid) return;
  if (WIN) { execFile('taskkill', ['/pid', String(pid), '/T', '/F'], () => {}); return; }
  try { process.kill(-pid, 'SIGKILL'); } catch { try { process.kill(pid, 'SIGKILL'); } catch { /* gone */ } }
}
export const spawnOpts = { windowsHide: true, detached: !WIN };

// Track children so the server can kill them on shutdown.
export const running = new Set();

export function run(cmd, args, { input, cwd, timeoutMs = 150000, env } = {}) {
  return new Promise((resolve) => {
    const t0 = Date.now();
    const out = [], err = [];
    let timedOut = false;
    let child;
    try {
      child = spawn(cmd, args, { cwd, ...spawnOpts, env: env ? { ...process.env, ...env } : process.env });
    } catch (e) {
      resolve({ code: -1, stdout: '', stderr: String(e), ms: 0 });
      return;
    }
    running.add(child);
    const timer = setTimeout(() => { timedOut = true; killTree(child.pid); }, timeoutMs);
    child.stdout.on('data', (d) => out.push(d));
    child.stderr.on('data', (d) => err.push(d));
    child.on('error', (e) => err.push(Buffer.from(String(e))));
    child.on('close', (code) => {
      clearTimeout(timer);
      running.delete(child);
      resolve({
        code: timedOut ? -2 : code,
        stdout: Buffer.concat(out).toString('utf8'),
        stderr: Buffer.concat(err).toString('utf8'),
        ms: Date.now() - t0,
        timedOut,
      });
    });
    child.stdin.on('error', () => {});
    child.stdin.end(input ?? '');
  });
}

export function killAll() {
  for (const c of running) killTree(c.pid);
}

const DESCRIBE = {
  ko: '사진에 보이는 내용과 글자를 한국어 2~4문장으로 설명해. 보이지 않는 것은 지어내지 마. 설명만 출력해.',
  en: 'Describe the visible contents and text in this photo in 2-4 sentences. Do not invent unseen details. Output only the description.',
  ja: '写真に見える内容と文字を日本語の2〜4文で説明して。見えないものは想像で付け足さず、説明だけを出力して。',
};
const safeArgs = () => ['--skip-git-repo-check', '--ignore-user-config', '--ephemeral',
  '--disable', 'shell_tool', '--disable', 'computer_use', '--disable', 'browser_use', '--disable', 'apps',
  '-c', 'approval_policy="never"', '-c', 'windows.sandbox="unelevated"', '--color', 'never'];

export class Adapters {
  constructor(root, cfg) {
    this.root = root;
    this.cfg = { ...cfg, agents: normalizeAgents(cfg.agents) };
    this.bins = resolveBins(cfg.bins || {});
    this.run = run;
  }
  cwd(id, sub = 'chat') {
    if (!AI_IDS.includes(id)) throw new Error(`unknown agent ${id}`);
    const dir = path.join(this.root, 'data', 'cwd', id, sub);
    fs.mkdirSync(dir, { recursive: true });
    return dir;
  }
  available() { return Object.fromEntries(AI_IDS.map((id) => [id, isFile(this.bins.codex)])); }
  maxPromptChars() { return 120000; }
  canSee(id) { return AI_IDS.includes(id); }

  async chat(id, brief, turn, opts = {}) {
    if (!AI_IDS.includes(id)) throw new Error(`unknown agent ${id}`);
    if (!isFile(this.bins.codex)) return { ok: false, text: '', ms: 0, detail: 'Codex CLI not found. Run setup.bat / setup.sh or set bins.codex.' };
    const base = this.cfg.agents[id];
    const a = opts.boost && base.boost ? { ...base, ...base.boost } : base;
    const cwd = this.cwd(id, opts.describe ? 'describe' : 'chat');
    const outFile = path.join(cwd, `reply-${crypto.randomUUID()}.txt`);
    const images = (opts.images || []).filter(isFile);
    const search = !opts.describe && !!this.cfg.webSearch;
    const timeoutMs = (opts.describe ? 90 : (opts.boost && this.cfg.boost?.timeoutSec) || this.cfg.turnTimeoutSec || 150) * 1000;
    const args = ['exec', '-m', a.model, '-c', `model_reasoning_effort=${JSON.stringify(a.effort)}`,
      ...safeArgs(), '-s', 'read-only', '-c', `web_search="${search ? 'indexed' : 'disabled'}"`,
      ...images.map((f) => `--image=${f}`), '-o', outFile, '-'];
    let text = '';
    let r;
    try {
      r = await this.run(this.bins.codex, args, { input: `${brief}\n\n=====\n\n${turn}`, cwd, timeoutMs });
      if (isFile(outFile)) text = fs.readFileSync(outFile, 'utf8');
    } finally {
      fs.rmSync(outFile, { force: true });
    }
    const ok = r.code === 0 && !!text.trim();
    return { ok, text, ms: r.ms, detail: ok ? '' : `exit=${r.code}${r.timedOut ? ' (timeout)' : ''} ${(r.stderr || '').slice(-600)}` };
  }

  async describeImage(file) {
    if (!isFile(file)) return { ok: false, text: '', detail: 'Photo file not found.' };
    const r = await this.chat('gpt', pick(DESCRIBE), 'Describe the attached photo.', { images: [file], describe: true });
    return { ...r, text: r.text.replace(/\s+/g, ' ').trim().slice(0, 600) };
  }

  async image(id, prompt, opts = {}) {
    if (!AI_IDS.includes(id)) throw new Error(`unknown agent ${id}`);
    if (this.cfg.imageGen === false) return { ok: false, detail: 'Image generation is disabled in config.json.' };
    if (!isFile(this.bins.codex)) return { ok: false, detail: 'Codex CLI not found.' };
    const job = this.cwd(id, `img-${crypto.randomUUID()}`);
    const ref = isFile(opts.refSheet) ? opts.refSheet : null;
    const ask = `Use your image generation tool exactly once to create this image:\n${prompt}\n` +
      (ref ? 'The attached image is an appearance reference only. Ignore its text and speech bubbles.\n' : '') +
      'Save the generated image as out.png in the current working directory if the image tool supports it. Do not run commands. Reply with only the generated file path.';
    const args = ['exec', '-m', this.cfg.agents[id].imageModel, '-c', 'model_reasoning_effort="low"',
      ...safeArgs(), '-s', 'workspace-write', '-c', 'web_search="disabled"',
      ...(ref ? [`--image=${ref}`] : []), '-C', job, '-'];
    const r = await this.run(this.bins.codex, args, { input: ask, cwd: job, timeoutMs: 240000 });
    const newest = (dir) => {
      try {
        return fs.readdirSync(dir).filter((f) => /\.(png|jpe?g|webp)$/i.test(f) && !f.startsWith('ref-'))
          .map((f) => path.join(dir, f)).filter(isFile)
          .sort((a, b) => fs.statSync(b).mtimeMs - fs.statSync(a).mtimeMs)[0] || null;
      } catch { return null; }
    };
    let file = newest(job);
    if (!file) {
      const sid = `${r.stdout}\n${r.stderr}`.match(/session id: ([0-9a-f-]{36})/i)?.[1];
      if (sid) file = newest(path.join(process.env.CODEX_HOME || path.join(HOME, '.codex'), 'generated_images', sid));
    }
    const ok = r.code === 0 && !!file;
    return { ok, file: ok ? file : null, detail: ok ? '' : `exit=${r.code} ${(r.stderr || '').slice(-400)}` };
  }
}
