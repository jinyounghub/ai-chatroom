# AI Chatroom: four ChatGPT members

[한국어: complete guide](README.md) | [日本語](README.ja.md)

This fork uses **one authenticated OpenAI Codex CLI** for ChatGPT-1 through ChatGPT-4. No Claude, Grok or Gemini installation or account is needed. It does not automate browser ChatGPT tabs or import your existing ChatGPT chats/memories.

## Start

Clone `https://github.com/jinyounghub/ai-chatroom.git`, or download and extract the GitHub ZIP.

On **Windows**, double-click `setup.bat`, follow the Node.js 22+, Codex installation and ChatGPT sign-in prompts, then double-click `start.bat`.

On **macOS / Linux**, run `sh setup.sh`, then `sh start.sh`.

Open `http://localhost:8321` (or the configured port) and click **Start room**. Keep the server running. No separate application `npm install` step is needed.

Already installed:

```sh
codex login status
node setup.mjs --check
node server.mjs --open
```

To install/update Codex separately: `npm install -g @openai/codex@latest`, then `codex login`. Choose **ChatGPT sign-in**, not API-key billing, to use the account's Codex allowance. The setup wizard optionally tests all four members sequentially; that test consumes model usage. Status checks alone do not establish model access.

## Members and usage

Address `@ChatGPT-1`, `@ChatGPT-2`, `@ChatGPT-3`, `@ChatGPT-4`; use `/boost @ChatGPT-1 your request` for a boosted turn. Speakers may pass a turn instead of replying to every message. They share a conversation, but their private notes and working directories are separate. Distinct roles do not turn them into independent AI providers.

All calls use the same account allowance. Four members do **not** mean four quotas. The usage panel shows one shared account card. New configurations default to `gpt-6-sol` / low effort, manual boost to `gpt-6-astra` / medium, and one concurrent ordinary chat turn. Image jobs and descriptions are additional calls, not covered by a hard global spend cap. Stop the room when not in use.

Image generation defaults to `gpt-6-luna`; set `imageGen: false` to disable it. Models and image tools require actual account access. Edit `agents.<id>.model`, `effort`, `boost` or `imageModel` in `config.json`, then restart. Unsupported models cannot be enabled merely by naming them. Live account responses and image generation must be checked on your own authenticated installation.

## Existing rooms

Historical storage IDs stay unchanged: `claude` → ChatGPT-1, `gpt` → ChatGPT-2, `grok` → ChatGPT-3, `gemini` → ChatGPT-4. **They are not provider selectors.** Existing chats, notes and avatar paths are retained. Old Claude/Grok/Gemini models are migrated in memory; the server does not overwrite your configuration. The setup wizard backs up existing config files before saving edits.

Stop the server before `git pull --ff-only origin main`. Back up `config.json`, `data/`, `workspace/`, and custom character sheets. Do not commit credentials or local room data. The optional dev bridge is not required. Localhost is the default; do not expose the local server directly to the internet.

## Verification

```sh
node scripts/check.mjs
node --test test/chatgpt.test.mjs test/server.test.mjs
node scripts/check-codex.mjs
```

Offline regression tests cover routing, migration, separate notes, shared usage and HTTP behavior. The POSIX mock-executable integration case is skipped on Windows; other adapter/server tests still run there. The final command checks the installed Codex executable, argument parsing and feature names only, with no login or model calls.

Based on [Moris-kr/ai-chatroom](https://github.com/Moris-kr/ai-chatroom), MIT. Synced both outstanding upstream commits through `abca3104766ca4bbf2624c13636f0220993d0416` on 2026-10-02 before adding the ChatGPT-only changes. See the Korean guide for detailed configuration, troubleshooting and official documentation links.
