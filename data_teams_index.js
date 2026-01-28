// data_teams_index.js
// Unified team access layer.
// - Local(20), National(40), World(40) を統一取得できる入口
// - sim側はここだけ見ればよい（データの分割数が増えてもsimは影響を受けない）

import { LOCAL_TEAMS } from "./data_teams_local.js";
import { NATIONAL_TEAMS } from "./data_teams_national.js";
import { WORLD_TEAMS } from "./data_teams_world.js";

// 取得カテゴリ（大会進行が増えてもここを増やすだけ）
export const TEAM_POOL = Object.freeze({
  LOCAL: "LOCAL",
  NATIONAL: "NATIONAL",
  WORLD: "WORLD",
});

// 安全：重複IDチェック（開発用）
function assertUniqueIds(all) {
  const seen = new Set();
  const dup = [];
  for (const t of all) {
    if (!t || !t.id) continue;
    if (seen.has(t.id)) dup.push(t.id);
    else seen.add(t.id);
  }
  if (dup.length) {
    console.warn("[TeamData] Duplicate team ids:", dup);
  }
}

// normalized accessor helpers
export function getLocalTeams() {
  return LOCAL_TEAMS.slice();
}
export function getNationalTeams() {
  return NATIONAL_TEAMS.slice();
}
export function getWorldTeams() {
  return WORLD_TEAMS.slice();
}

// 20/40など「枠」で選ぶ（大会側で使う）
export function getTeamsByPool(pool) {
  switch (pool) {
    case TEAM_POOL.LOCAL: return getLocalTeams();
    case TEAM_POOL.NATIONAL: return getNationalTeams();
    case TEAM_POOL.WORLD: return getWorldTeams();
    default: return [];
  }
}

// よく使う：指定数に丸める（データが多い/少ない時の保険）
export function takeTeams(teams, n) {
  const arr = teams.slice();
  return arr.slice(0, Math.max(0, n|0));
}

// よく使う：ID検索（local/national/world横断）
export function getTeamById(id) {
  const all = [...LOCAL_TEAMS, ...NATIONAL_TEAMS, ...WORLD_TEAMS];
  return all.find(t => t.id === id) || null;
}

// よく使う：大会フェーズ別（現仕様の最小セット）
// - SP1/ SP2/ CHAMP の「ローカル戦」: LOCAL(20)
// - 「ナショナル戦」: NATIONAL(40)
// - 「WF」: WORLD(40)（※必要なら later: WORLD+NATIONAL混在なども可能）
export const PHASE = Object.freeze({
  LOCAL_STAGE: "LOCAL_STAGE",
  NATIONAL_STAGE: "NATIONAL_STAGE",
  WORLD_FINAL: "WORLD_FINAL",
});

// phase -> teams
export function getTeamsForPhase(phase) {
  switch (phase) {
    case PHASE.LOCAL_STAGE:
      return takeTeams(getLocalTeams(), 20);
    case PHASE.NATIONAL_STAGE:
      return takeTeams(getNationalTeams(), 40);
    case PHASE.WORLD_FINAL:
      return takeTeams(getWorldTeams(), 40);
    default:
      return [];
  }
}

// call once at module load for sanity
assertUniqueIds([...LOCAL_TEAMS, ...NATIONAL_TEAMS, ...WORLD_TEAMS]);
