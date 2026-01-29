/* =====================================================
   data_teams_national.js  (FULL)
   MOB Tournament Simulation
   ナショナル大会：40チーム枠（A/B/C/D グループ）
   - 今は「枠」を先に用意（後で実データを差し替え可能）
   - 3人1チーム固定
   - passive.effects は sim 側で解釈して適用
   ===================================================== */

window.DATA_TEAMS_NATIONAL = (function () {

  const TEAMS = [];

  function makeTeam(group, index, powerPct) {
    const n = String(index).padStart(2, '0');
    const id = `N_${group}_${n}`;
    const name = `ナショナル${group}-${index}`;
    return {
      id,
      tier: "NATIONAL",
      group, // "A" / "B" / "C" / "D"
      name,
      powerPct,
      style: "未設定",
      members: [
        `${name}メンバー1`,
        `${name}メンバー2`,
        `${name}メンバー3`
      ],
      passive: {
        name: "未設定",
        desc: "後で設定",
        effects: []
      }
    };
  }

  // 40チーム：各グループ10
  // powerPct は“仮”で、強弱の並びだけ作ってあります（後で差し替え前提）。
  // A: 80→62 / B: 79→61 / C: 78→60 / D: 77→59
  const base = {
    A: 80,
    B: 79,
    C: 78,
    D: 77
  };

  ["A", "B", "C", "D"].forEach((g) => {
    for (let i = 1; i <= 10; i++) {
      TEAMS.push(makeTeam(g, i, base[g] - (i - 1) * 2));
    }
  });

  function getAll() { return TEAMS.slice(); }
  function getById(id) { return TEAMS.find(t => t.id === id) || null; }
  function listByGroup(group) { return TEAMS.filter(t => t.group === group); }

  return {
    teams: TEAMS,
    getAll,
    getById,
    listByGroup
  };

})();
