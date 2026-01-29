/* =========================================================
   data_teams_index.js (FULL)
   - ローカル/ナショナル/ワールドのチームデータを統合して
     参照しやすい索引（index）を提供する
   - 依存：data_teams_local.js / data_teams_national.js / data_teams_world.js
   ========================================================= */

(() => {
  'use strict';

  const CONST = window.DATA_CONST;
  if (!CONST) throw new Error('DATA_CONST not found. Load data_const.js before data_teams_index.js');

  const LOCAL = window.DATA_TEAMS_LOCAL;
  const NATIONAL = window.DATA_TEAMS_NATIONAL;
  const WORLD = window.DATA_TEAMS_WORLD;

  if (!LOCAL || !LOCAL.list) throw new Error('DATA_TEAMS_LOCAL not found. Load data_teams_local.js before data_teams_index.js');
  if (!NATIONAL || !NATIONAL.list) throw new Error('DATA_TEAMS_NATIONAL not found. Load data_teams_national.js before data_teams_index.js');
  if (!WORLD || !WORLD.list) throw new Error('DATA_TEAMS_WORLD not found. Load data_teams_world.js before data_teams_index.js');

  // ---------------------------------------------------------
  // ユーティリティ
  // ---------------------------------------------------------
  function deepFreeze(obj) {
    if (!obj || typeof obj !== 'object') return obj;
    Object.freeze(obj);
    for (const k of Object.keys(obj)) {
      const v = obj[k];
      if (v && typeof v === 'object' && !Object.isFrozen(v)) deepFreeze(v);
    }
    return obj;
  }

  function normalizeGroup(g) {
    const x = String(g || '').toUpperCase();
    if (x === 'LOCAL' || x === 'NATIONAL' || x === 'WORLD') return x;
    return 'LOCAL';
  }

  function teamKey(team) {
    // 表示/UI用の安定キー（ID優先）
    return team?.id || `${team?.group || 'X'}_${team?.name || 'NONAME'}`;
  }

  // ---------------------------------------------------------
  // 統合
  // ---------------------------------------------------------
  const allTeams = []
    .concat(LOCAL.list || [])
    .concat(NATIONAL.list || [])
    .concat(WORLD.list || []);

  // group を正規化（データ側に group が無い場合も念のため）
  for (const t of allTeams) {
    if (!t.group) t.group = 'LOCAL';
    t.group = normalizeGroup(t.group);
    if (!t.id) {
      // id未設定は避けたいが、万一の保険
      t.id = teamKey(t);
    }
  }

  // ID衝突チェック（衝突したら末尾に連番を付与して回避）
  const seen = new Map();
  for (const t of allTeams) {
    const base = String(t.id);
    if (!seen.has(base)) {
      seen.set(base, 1);
      continue;
    }
    const n = seen.get(base) + 1;
    seen.set(base, n);
    t.id = `${base}__${n}`; // ここは内部用の衝突回避
  }

  const byId = Object.create(null);
  const byName = Object.create(null);
  const byGroup = { LOCAL: [], NATIONAL: [], WORLD: [] };

  for (const t of allTeams) {
    byId[t.id] = t;
    (byGroup[t.group] || (byGroup[t.group] = [])).push(t);

    const nm = String(t.name || '');
    if (!byName[nm]) byName[nm] = [];
    byName[nm].push(t);
  }

  // パワー順リスト（降順）
  const allSortedByPower = allTeams.slice().sort((a, b) => {
    const ap = Number(a.powerPct || 0);
    const bp = Number(b.powerPct || 0);
    if (bp !== ap) return bp - ap;
    // 同率は名前で安定化
    return String(a.name || '').localeCompare(String(b.name || ''), 'ja');
  });

  // group別のパワー順
  const groupSortedByPower = {
    LOCAL: (byGroup.LOCAL || []).slice().sort((a, b) => (Number(b.powerPct || 0) - Number(a.powerPct || 0))),
    NATIONAL: (byGroup.NATIONAL || []).slice().sort((a, b) => (Number(b.powerPct || 0) - Number(a.powerPct || 0))),
    WORLD: (byGroup.WORLD || []).slice().sort((a, b) => (Number(b.powerPct || 0) - Number(a.powerPct || 0))),
  };

  // ---------------------------------------------------------
  // 公開API
  // ---------------------------------------------------------
  function getTeamById(id) {
    return byId[String(id)] || null;
  }

  function findTeamsByName(name) {
    const key = String(name || '');
    return (byName[key] || []).slice();
  }

  function getTeamsByGroup(group) {
    const g = normalizeGroup(group);
    return (byGroup[g] || []).slice();
  }

  function getAllTeams() {
    return allTeams.slice();
  }

  function getAllTeamsSortedByPower() {
    return allSortedByPower.slice();
  }

  function getGroupTeamsSortedByPower(group) {
    const g = normalizeGroup(group);
    return (groupSortedByPower[g] || []).slice();
  }

  // ---------------------------------------------------------
  // Freezeして公開（参照の安全性）
  // ---------------------------------------------------------
  const exportObj = {
    list: allTeams.slice(),
    byId,
    byName,
    byGroup,

    // 参照ヘルパ
    getTeamById,
    findTeamsByName,
    getTeamsByGroup,
    getAllTeams,
    getAllTeamsSortedByPower,
    getGroupTeamsSortedByPower,
  };

  deepFreeze(exportObj);

  window.DATA_TEAMS_INDEX = exportObj;
})();
