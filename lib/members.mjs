// Static facts about the room members. Personality and speech style are deliberately
// absent: they are supposed to emerge from the conversation itself (see prompt.mjs).

import { pick } from './i18n.mjs';

// Legacy IDs are storage keys, not provider names. All four use the same Codex login.
export const AI_IDS = ['claude', 'gpt', 'grok', 'gemini'];

// aliases: every spelling that calls the member, in any room language (lower case).
// look: the default avatar, per language (config.json members.<id>.look overrides it).
export const MEMBERS = {
  claude: {
    name: 'ChatGPT-1',
    maker: 'OpenAI',
    color: '#d97a3a',
    aliases: ['chatgpt-1', 'chatgpt1', 'gpt-1', 'gpt1', '지피티1', '챗지피티1', 'チャットgpt1', 'claude', '클로드', 'クロード'],
    look: {
      ko: '긴 회갈색 머리(안쪽은 주황빛), 보라색 눈, 검은 리본, 크림색 블라우스에 짙은 조끼',
      en: 'long grey-brown hair with an orange underlayer, purple eyes, a black ribbon, a cream blouse under a dark vest',
      ja: '長い灰茶色の髪(内側はオレンジ)、紫の瞳、黒いリボン、クリーム色のブラウスに濃い色のベスト',
    },
    imageGen: true,
  },
  gpt: {
    name: 'ChatGPT-2',
    maker: 'OpenAI',
    color: '#2f7cf6',
    aliases: ['chatgpt-2', 'chatgpt2', 'gpt-2', 'gpt2', '지피티2', '챗지피티2', 'チャットgpt2', 'chatgpt', 'gpt', '지피티', '챗지피티', '쳇지피티', 'チャットgpt', 'チャッピー', 'ジーピーティー'],
    look: {
      ko: '은발 단발, 파란 눈, 삼각형 머리핀, 흰 테크 후드 재킷',
      en: 'short silver bob, blue eyes, a triangle hairpin, a white tech hooded jacket',
      ja: '銀髪のボブ、青い瞳、三角のヘアピン、白いテック系フードジャケット',
    },
    imageGen: true,
  },
  grok: {
    name: 'ChatGPT-3',
    maker: 'OpenAI',
    color: '#b8912a',
    aliases: ['chatgpt-3', 'chatgpt3', 'gpt-3', 'gpt3', '지피티3', '챗지피티3', 'チャットgpt3', 'grok', '그록', 'グロック', 'グロク'],
    look: {
      ko: '긴 금발, 회색 눈, 검은 X 머리핀, 검은 오버사이즈 재킷과 초커',
      en: 'long blonde hair, grey eyes, a black X hairpin, an oversized black jacket and a choker',
      ja: '長い金髪、灰色の瞳、黒いXのヘアピン、黒いオーバーサイズジャケットとチョーカー',
    },
    imageGen: true,
  },
  gemini: {
    name: 'ChatGPT-4',
    maker: 'OpenAI',
    color: '#5b6cf0',
    aliases: ['chatgpt-4', 'chatgpt4', 'gpt-4', 'gpt4', '지피티4', '챗지피티4', 'チャットgpt4', 'gemini', '제미나이', '제미니', 'ジェミニ', 'ジェミナイ'],
    look: {
      ko: '끝이 분홍·보라로 물든 금발 트윈테일, 파란 눈, 청록 리본, 멜빵',
      en: 'blonde twin tails with pink-purple tips, blue eyes, a teal ribbon, suspenders',
      ja: '毛先がピンクと紫に染まった金髪ツインテール、青い瞳、青緑のリボン、サスペンダー',
    },
    imageGen: true,
  },
};

export function defaultLook(id) {
  return MEMBERS[id] ? pick(MEMBERS[id].look) : '';
}

// The optional external development session. It is not
// scheduled like the AIs: it joins through the dev bridge (lib/dev.mjs) only while the
// user has connected it, and its messages are authored by the server from the bridge token.
const DEV_NAMES = { ko: '개발자', en: 'Dev', ja: '開発者' };
export const DEV = {
  id: 'dev',
  get name() { return pick(DEV_NAMES); },
  color: '#0f766e',
  aliases: ['개발자', '개발 세션', '개발세션', '빌더', 'dev', 'developer', '開発者', 'デベロッパー'],
};

const SYSTEM_NAMES = { ko: '시스템', en: 'System', ja: 'システム' };

// Latin aliases must stand alone ("dev" is not "device"); Korean and Japanese have no
// word spaces to rely on, so those match anywhere.
function escapeRe(text) { return text.replace(/[.*+?^${}()|[\]\\]/g, '\\$&'); }
function hasAlias(t, a, at = false) {
  const latin = /^[a-z0-9 _-]+$/.test(a);
  const start = at ? '@' : latin ? '(^|[^a-z0-9_-])' : '';
  // Numbered aliases must not match a different member (gpt1 != gpt10), including Korean.
  const end = '(?![a-z0-9_-])';
  return new RegExp(`${start}${escapeRe(a)}${end}`).test(t);
}

// Does `text` call the dev session (@Dev, 개발자, 開発者 ...)?
export function mentionsDev(text) {
  const t = (text || '').toLowerCase();
  return DEV.aliases.some((a) => hasAlias(t, a));
}

export function displayName(id, userName) {
  if (id === 'user') return userName;
  if (id === 'system') return pick(SYSTEM_NAMES);
  if (id === DEV.id) return DEV.name;
  return MEMBERS[id]?.name ?? id;
}

// Korean particles use the spoken member numbers: 일 / 이 / 삼 / 사.
const FINAL_CONSONANT = { claude: true, gpt: false, grok: true, gemini: false }; // 1=일, 2=이, 3=삼, 4=사
function endsWithBatchim(word) {
  const c = word.charCodeAt(word.length - 1);
  return c >= 0xac00 && c <= 0xd7a3 && (c - 0xac00) % 28 !== 0;
}
// withJosa('grok', '방장', '이/가') -> 'ChatGPT-3이'. `id` may also be a plain word.
export function withJosa(id, userName, pair) {
  const [withFinal, without] = pair.split('/');
  const word = MEMBERS[id] || id === 'user' || id === 'system' || id === DEV.id ? displayName(id, userName) : id;
  const fin = id in FINAL_CONSONANT ? FINAL_CONSONANT[id] : endsWithBatchim(word);
  return word + (fin ? withFinal : without);
}

// Does `text` address member `id`? Matches @Name and bare names/aliases.
export function mentions(text, id) {
  const t = (text || '').toLowerCase();
  const m = MEMBERS[id];
  if (!m) return false;
  return m.aliases.some((a) => hasAlias(t, a, true) || hasAlias(t, a));
}

// Stricter: only an explicit @Name counts as calling someone.
export function atMentions(text, id) {
  const t = (text || '').toLowerCase();
  return !!MEMBERS[id]?.aliases.some((a) => hasAlias(t, a, true));
}
