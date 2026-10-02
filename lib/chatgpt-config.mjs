// One provider, four independent room members. Keep historical IDs so saved rooms survive.
import { AI_IDS } from './members.mjs';

export const DEFAULT_MODEL = 'gpt-6-sol';
export const DEFAULT_BOOST_MODEL = 'gpt-6-astra';
export const DEFAULT_IMAGE_MODEL = 'gpt-6-luna';
const EFFORTS = new Set(['none', 'minimal', 'low', 'medium', 'high', 'xhigh']);

function object(value, label) {
  if (value == null) return {};
  if (typeof value !== 'object' || Array.isArray(value)) throw new TypeError(`${label} must be an object`);
  return value;
}
function model(value, fallback) {
  if (value == null || value === '') return fallback;
  if (typeof value !== 'string') throw new TypeError('model must be a string');
  // Migrate models in an existing upstream config in memory; never rewrite user files here.
  if (/^(sonnet|opus|haiku|claude|grok|gemini)(?:$|[-.])/i.test(value)) return fallback;
  return value;
}
function effort(value, fallback) {
  if (value == null) return fallback;
  if (!EFFORTS.has(value)) throw new TypeError(`Unsupported reasoning effort: ${value}`);
  return value;
}
export function normalizeAgents(input = {}) {
  const source = object(input, 'agents');
  return Object.fromEntries(AI_IDS.map((id) => {
    const a = object(source[id], `agents.${id}`);
    const legacy = !('boost' in a) && a.deepModel ? { model: a.deepModel, effort: a.deepEffort } : undefined;
    const b = object(a.boost === false ? null : a.boost ?? legacy, `agents.${id}.boost`);
    return [id, {
      model: model(a.model, DEFAULT_MODEL),
      effort: effort(a.effort, 'low'),
      boost: a.boost === null || a.boost === false ? null : {
        model: model(b.model, DEFAULT_BOOST_MODEL),
        effort: effort(b.effort, 'medium'),
      },
      imageModel: model(a.imageModel, DEFAULT_IMAGE_MODEL),
    }];
  }));
}
