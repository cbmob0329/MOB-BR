/* =====================================================
   data_teams_index.js  (FULL)
   MOB Tournament Simulation
   チームデータ統合インデックス
   - tier(LOCAL/NATIONAL/WORLD)で取得
   - group(A/B/C/D 等)で絞り込み
   ===================================================== */

window.DATA_TEAMS = (function () {

  function assertLoaded() {
    const okLocal = window.DATA_TEAMS_LOCAL && Array.isArray(window.DATA_TEAMS_LOCAL.teams);
    const okNat   = window.DATA_TEAMS_NATIONAL && Array.isArray(window.DATA_TEAMS_NATIONAL.teams);
    const okWorld = window.DATA_TEAMS_WORLD && Array.isArray(window.DATA_TEAMS_WORLD.teams);

    if (!okLocal) console.warn('[DATA_TEAMS] DATA_TEAMS_LOCAL not loaded');
    if (!okNat)   console.warn('[DATA_TEAMS] DATA_TEAMS_NATIONAL not loaded');
    if (!okWorld) console.warn('[DATA_TEAMS] DATA_TEAMS_WORLD not loaded');

    return okLocal && okNat && okWorld;
  }

  function getPoolByTier(tier) {
    if (!assertLoaded()) {
      // 最低限：落ちないための返却
      if (window.DATA_TEAMS_LOCAL && Array.isArray(window.DATA_TEAMS_LOCAL.teams)) {
        return window.DATA_TEAMS_LOCAL.teams;
      }
      return [];
    }

    if (tier === 'LOCAL') return window.DATA_TEAMS_LOCAL.teams;
    if (tier === 'NATIONAL') return window.DATA_TEAMS_NATIONAL.teams;
    if (tier === 'WORLD') return window.DATA_TEAMS_WORLD.teams;

    return [];
  }

  function getAll(tier) {
    return getPoolByTier(tier).slice();
  }

  function getById(id) {
    const pools = [];
    if (window.DATA_TEAMS_LOCAL && Array.isArray(window.DATA_TEAMS_LOCAL.teams)) pools.push(window.DATA_TEAMS_LOCAL.teams);
    if (window.DATA_TEAMS_NATIONAL && Array.isArray(window.DATA_TEAMS_NATIONAL.teams)) pools.push(window.DATA_TEAMS_NATIONAL.teams);
    if (window.DATA_TEAMS_WORLD && Array.isArray(window.DATA_TEAMS_WORLD.teams)) pools.push(window.DATA_TEAMS_WORLD.teams);

    for (const p of pools) {
      const found = p.find(t => t.id === id);
      if (found) return found;
    }
    return null;
  }

  function listByGroup(tier, group) {
    return getPoolByTier(tier).filter(t => t.group === group);
  }

  function pickTeamsForTournament(tier, options) {
    // options:
    // - includePlayerTeam (default true)
    // - teamCountOverride (number)
    // - group (A/B/C/D etc) optional
    const opt = options || {};
    const includePlayerTeam = opt.includePlayerTeam !== false;
    const group = opt.group || null;

    let pool = getPoolByTier(tier);

    if (group) pool = pool.filter(t => t.group === group);

    // ローカル：通常20
    let count = (tier === 'LOCAL')
      ? (window.DATA_CONST?.CONST?.LOCAL_TEAM_COUNT || 20)
      : (window.DATA_CONST?.CONST?.MAX_TEAM_COUNT || 40);

    if (typeof opt.teamCountOverride === 'number' && opt.teamCountOverride > 0) {
      count = opt.teamCountOverride;
    }

    // データが少ない場合でも落ちない
    const selected = pool.slice(0, Math.min(count, pool.length));

    // プレイヤーチーム（State）をチーム一覧に差し込む（先頭固定）
    if (includePlayerTeam && window.State && State.playerTeam) {
      const pt = State.playerTeam;
      // 同名IDを避ける
      const normalizedPlayerTeam = {
        id: pt.id || 'PLAYER_TEAM',
        tier,
        group: pt.group || 'PLAYER',
        name: pt.name || 'PLAYER TEAM',
        powerPct: pt.powerPct || 0,
        style: pt.style || 'プレイヤーチーム',
        members: (pt.members || []).map(m => (m.name || m)),

        // プレイヤーチーム側のパッシブ/スキルは data_players.js に依存するためここでは空
        passive: pt.passive || { name: 'プレイヤー', desc: 'プレイヤーチーム', effects: [] },

        // 参照用に元オブジェクトを保持（battle側で使える）
        _isPlayer: true,
        _playerTeamRef: pt
      };

      // 既存と差し替え（ID一致があれば置換）
      const idx = selected.findIndex(t => t.id === normalizedPlayerTeam.id);
      if (idx >= 0) selected[idx] = normalizedPlayerTeam;
      else selected.unshift(normalizedPlayerTeam);
    }

    return selected;
  }

  return {
    getAll,
    getById,
    listByGroup,
    pickTeamsForTournament
  };

})();
