/* =====================================================
   data_teams_index.js
   - TEAMS_LOCAL / TEAMS_NATIONAL / TEAMS_WORLD を束ねる
   - 参照API: getTeam(id), listByTier('local'|'national'|'world')
   ===================================================== */

(() => {

  function safeArr(x){ return Array.isArray(x) ? x : []; }

  const LOCAL = safeArr(window.TEAMS_LOCAL);
  const NATIONAL = safeArr(window.TEAMS_NATIONAL);
  const WORLD = safeArr(window.TEAMS_WORLD);

  const ALL = [...LOCAL, ...NATIONAL, ...WORLD];
  const byId = Object.fromEntries(ALL.map(t => [t.id, t]));

  function getTierById(id){
    const s = String(id || '');
    if (s.startsWith('local')) return 'local';
    if (s.startsWith('national')) return 'national';
    if (s.startsWith('world')) return 'world';
    return 'unknown';
  }

  const TEAMS_INDEX = {
    local: LOCAL,
    national: NATIONAL,
    world: WORLD,
    all: ALL,
    byId,

    getTeam(id){
      return byId[String(id || '')] || null;
    },

    listByTier(tier){
      const k = String(tier || '');
      if (k === 'local') return LOCAL;
      if (k === 'national') return NATIONAL;
      if (k === 'world') return WORLD;
      return [];
    },

    getTierById,
  };

  window.TEAMS_INDEX = TEAMS_INDEX;

})();
