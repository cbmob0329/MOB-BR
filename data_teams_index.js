// data_teams_index.js
// Teams index / unified accessors (ES Modules)
// - merges local / national / world
// - provides helpers to fetch & sort teams consistently

import { LOCAL_TEAMS } from './data_teams_local.js';
import { TEAMS_NATIONAL } from './data_teams_national.js';
import { TEAMS_WORLD } from './data_teams_world.js';

export const TEAM_TIER = Object.freeze({
  LOCAL: 'local',
  NATIONAL: 'national',
  WORLD: 'world',
});

export const TEAMS_ALL = Object.freeze([
  ...LOCAL_TEAMS.map((t) => ({ ...t, tier: t.tier || TEAM_TIER.LOCAL })),
  ...TEAMS_NATIONAL.map((t) => ({ ...t, tier: t.tier || TEAM_TIER.NATIONAL })),
  ...TEAMS_WORLD.map((t) => ({ ...t, tier: t.tier || TEAM_TIER.WORLD })),
]);

// --------------------
// Internal helpers
// --------------------
function getTeamStrengthLike(team) {
  // local: powerPct / national+world: strength
  const v =
    (typeof team.strength === 'number' ? team.strength : null) ??
    (typeof team.powerPct === 'number' ? team.powerPct : null) ??
    0;
  return v;
}

function normId(x) {
  return String(x || '').trim();
}

// --------------------
// Public helpers
// --------------------
export function listAllTeams() {
  return TEAMS_ALL.slice();
}

export function listTeamsByTier(tier) {
  const t = String(tier || '').toLowerCase();
  return TEAMS_ALL.filter((x) => String(x.tier || '').toLowerCase() === t);
}

export function getTeamById(id) {
  const key = normId(id);
  if (!key) return null;
  return TEAMS_ALL.find((t) => t.id === key) || null;
}

export function getTeamByName(name) {
  const n = String(name || '').trim();
  if (!n) return null;
  return TEAMS_ALL.find((t) => t.name === n) || null;
}

export function listAllTeamsSortedByStrengthDesc() {
  return TEAMS_ALL
    .slice()
    .sort((a, b) => (getTeamStrengthLike(b) - getTeamStrengthLike(a)) || a.name.localeCompare(b.name, 'ja'));
}

export function pickRandomTeam(rng = Math.random, tier = null) {
  const pool = tier ? listTeamsByTier(tier) : TEAMS_ALL.slice();
  if (!pool.length) return null;
  const i = Math.floor(rng() * pool.length);
  return pool[i] || null;
}

/**
 * 20チーム用のCPUプール生成（重複なし）
 * - 既にプレイヤーチームが別枠なら cpuCount=19 で呼ぶ想定
 */
export function pickUniqueTeams(count, rng = Math.random, tier = null, excludeIds = []) {
  const ex = new Set((excludeIds || []).map(normId));
  const base = (tier ? listTeamsByTier(tier) : TEAMS_ALL.slice()).filter((t) => !ex.has(t.id));
  const pool = base.slice();

  // Fisher–Yates shuffle
  for (let i = pool.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const tmp = pool[i];
    pool[i] = pool[j];
    pool[j] = tmp;
  }

  return pool.slice(0, Math.max(0, count | 0));
}

/**
 * シミュレーター側で使いやすいように、チーム情報を「最低限の共通形」に整形
 */
export function normalizeTeam(team) {
  if (!team) return null;
  const t = { ...team };

  // members: localは members あり、national/worldも members あり
  t.members = Array.isArray(t.members) ? t.members.slice() : [];

  // passive: 両方あるが表現が違うので最低限揃える
  if (t.passive && typeof t.passive === 'object') {
    t.passive = {
      name: t.passive.name || '',
      desc: t.passive.desc || t.passive.description || '',
      // raw / effects はそのまま保持（エンジン側で解釈）
      raw: t.passive.raw ?? null,
      effects: t.passive.effects ?? null,
    };
  } else {
    t.passive = { name: '', desc: '', raw: null, effects: null };
  }

  // strengthLike: 比較・表示用
  t.strengthLike = getTeamStrengthLike(t);

  return t;
}
