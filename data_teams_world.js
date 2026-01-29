/* =====================================================
   data_teams_world.js  (FULL)
   MOB Tournament Simulation
   ワールド大会：40チーム枠（A/B/C/D グループ）
   - 今は「枠」を先に用意（後で実データを差し替え可能）
   - 3人1チーム固定
   - passive.effects は sim 側で解釈して適用
   ===================================================== */

window.DATA_TEAMS_WORLD = (function () {

  const TEAMS = [];

  function makeTeam(group, index, powerPct) {
    const n = String(index).padStart(2, '0');
    const id = `W_${group}_${n}`;
    const name = `ワールド${group}-${index}`;
    return {
      id,
      tier: "WORLD",
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
  // A: 85→67 / B: 84→66 / C: 83→65 / D: 82→64
  const base = {
    A: 85,
    B: 84,
    C: 83,
    D: 82
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
