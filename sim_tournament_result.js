'use strict';

/*
  sim_tournament_result.js（FULL 修正版 v2.4.1）

  ✅ 修正/保証
  - ✅ R.getChampionName を必ず提供（core_step / core_shared 互換）
  - ✅ 互換aliasを追加（実装差で total が 0 になるのを防ぐ）
  - ✅ チーム名解決を完全保証（ID表示根絶）
      - ✅ national.allTeamDefs が「配列」でも「MAP(object)」でも対応（←今回の本丸）
  - ✅ Treasure=3 / Flag=5
  - ✅ 1試合終了ごと currentOverallRows 更新
  - ✅ ソート安定化（同点時のブレ抑制）
  - ✅ 重要：window.MOBBR.sim._tcore.R にも必ず注入（分割/ロード順ズレで total=0 を根絶）
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){

  // ==========================================
  // 名前解決（完全版）
  // ==========================================
  function resolveTeamName(state, id){
    const sid = String(id);

    // ① 現在の20チーム
    try{
      if (state?.teams){
        const t = state.teams.find(x => String(x?.id) === sid);
        if (t?.name) return String(t.name);
      }
    }catch(_){}

    // ② tournamentTotal（全体）
    try{
      if (state?.tournamentTotal){
        const t = state.tournamentTotal[sid];
        if (t?.name) return String(t.name);
      }
    }catch(_){}

    // ③ national / world allTeamDefs（安全弁）
    //    - entry/core 実装差で allTeamDefs が「配列」or「MAP(object)」になり得るので両対応
    try{
      const allDefs = state?.national?.allTeamDefs;

      if (allDefs){
        // ▼ MAP(object) 形式: { TEAMID: {id/name/...}, ... }
        if (!Array.isArray(allDefs) && typeof allDefs === 'object'){
          const def = allDefs[sid];
          if (def?.name) return String(def.name);
          // defがCPU素体で name が無いケースもあるので、id/teamIdも拾う
          if (def && (def.id || def.teamId)){
            const nid = String(def.id || def.teamId);
            if (nid && nid !== sid){
              const def2 = allDefs[nid];
              if (def2?.name) return String(def2.name);
            }
          }
        }
        // ▼ 配列形式: [{id/teamId,name,...}, ...]
        else if (Array.isArray(allDefs)){
          const def = allDefs.find(x => String(x?.id || x?.teamId) === sid);
          if (def?.name) return String(def.name);
        }
      }
    }catch(_){}

    return sid;
  }

  // ==========================================
  // Apex Placement
  // ==========================================
  function calcPlacementPoint(rank){
    if (rank === 1) return 12;
    if (rank === 2) return 9;
    if (rank === 3) return 7;
    if (rank === 4) return 5;
    if (rank === 5) return 4;
    if (rank <= 10) return 2;
    return 0;
  }

  // ==========================================
  // Match Result Table（1試合）
  // ==========================================
  function computeMatchResultTable(state){
    const teams = (state?.teams ? state.teams.slice() : []);

    teams.sort((a,b)=>{
      if (!!a?.eliminated !== !!b?.eliminated) return a.eliminated ? 1 : -1;

      const ar = Number(a?.eliminatedRound || 0);
      const br = Number(b?.eliminatedRound || 0);
      if (ar !== br) return br - ar;

      const ak = Number(a?.kills_total || 0);
      const bk = Number(b?.kills_total || 0);
      if (ak !== bk) return bk - ak;

      const ad = Number(a?.downs_total || 0);
      const bd = Number(b?.downs_total || 0);
      if (ad !== bd) return ad - bd;

      const apow = Number(a?.power || 0);
      const bpow = Number(b?.power || 0);
      if (apow !== bpow) return bpow - apow;

      return String(a?.name||a?.id).localeCompare(String(b?.name||b?.id));
    });

    const rows = [];

    teams.forEach((t, index)=>{
      const placement = index + 1;
      const placementP = calcPlacementPoint(placement);

      const kp = Number(t?.kills_total || 0);
      const ap = Number(t?.assists_total || 0);

      const treasureCount = Number(t?.treasure || 0);
      const flagCount     = Number(t?.flag || 0);

      const treasureP = treasureCount * 3;
      const flagP     = flagCount * 5;

      const total = placementP + kp + ap + treasureP + flagP;

      rows.push({
        id: t?.id,
        name: resolveTeamName(state, t?.id),
        placement,
        placementP,
        kp,
        ap,
        treasure: treasureCount,
        flag: flagCount,
        total
      });
    });

    return rows;
  }

  // ==========================================
  // Tournament Total（累積）
  // ==========================================
  function addToTournamentTotal(state, rows){
    if (!state) return;
    if (!state.tournamentTotal) state.tournamentTotal = {};

    const arr = Array.isArray(rows) ? rows : [];

    arr.forEach(r=>{
      const id = String(r?.id);

      if (!id) return;

      if (!state.tournamentTotal[id]){
        state.tournamentTotal[id] = {
          id,
          name: String(r?.name || id),

          // 表示用（累積）
          sumTotal:0,
          sumPlacementP:0,
          sumKP:0,
          sumAP:0,
          sumTreasure:0,
          sumFlag:0,

          // internal（将来/互換）
          sumKills:0,
          sumAssists:0,
          sumDowns:0
        };
      }

      const t = state.tournamentTotal[id];

      t.sumTotal       += Number(r?.total || 0);
      t.sumPlacementP  += Number(r?.placementP || 0);
      t.sumKP          += Number(r?.kp || 0);
      t.sumAP          += Number(r?.ap || 0);
      t.sumTreasure    += Number(r?.treasure || 0);
      t.sumFlag        += Number(r?.flag || 0);

      // 互換：別名参照されても破綻しないように同期
      t.sumKills        = t.sumKP;
      t.sumAssists      = t.sumAP;

      // downs_total は rows からは来ないこともあるので、state.teams から拾えるときだけ拾う
      try{
        const team = state?.teams?.find(x => String(x?.id) === id);
        if (team){
          t.sumDowns += Number(team?.downs_total || 0);
        }
      }catch(_){}

      t.name = String(r?.name || t.name || id);
    });

    buildCurrentOverall(state);
  }

  // ==========================================
  // 現在の20チーム総合順位（currentOverallRows）
  // ==========================================
  function buildCurrentOverall(state){
    if (!state) return;

    const ids = Array.isArray(state.teams) ? state.teams.map(t=>String(t?.id)) : [];

    const arr = ids.map(id=>{
      const t = state.tournamentTotal ? state.tournamentTotal[id] : null;
      if (!t) return null;

      return {
        id,
        name: resolveTeamName(state, id),

        // UI（総合RESULT）向け
        total: Number(t.sumTotal || 0),
        placementP: Number(t.sumPlacementP || 0),
        kp: Number(t.sumKP || 0),
        ap: Number(t.sumAP || 0),
        treasure: Number(t.sumTreasure || 0),
        flag: Number(t.sumFlag || 0)
      };
    }).filter(Boolean);

    arr.sort((a,b)=>{
      if (a.total !== b.total) return b.total - a.total;
      if (a.placementP !== b.placementP) return b.placementP - a.placementP;
      if (a.kp !== b.kp) return b.kp - a.kp;
      if (a.ap !== b.ap) return b.ap - a.ap;
      if (a.treasure !== b.treasure) return b.treasure - a.treasure;
      if (a.flag !== b.flag) return b.flag - a.flag;
      return String(a.name||a.id).localeCompare(String(b.name||b.id));
    });

    state.currentOverallRows = arr;
  }

  // ==========================================
  // 総合RESULT用：全体テーブル化
  // ==========================================
  function computeTournamentResultTable(state){
    if (!state) return [];
    const total = state.tournamentTotal || {};
    const ids = Object.keys(total);

    const rows = ids.map(id=>{
      const t = total[id] || {};
      return {
        id,
        name: resolveTeamName(state, id),

        total: Number(t.sumTotal || 0),
        placementP: Number(t.sumPlacementP || 0),
        kp: Number(t.sumKP || 0),
        ap: Number(t.sumAP || 0),
        treasure: Number(t.sumTreasure || 0),
        flag: Number(t.sumFlag || 0)
      };
    });

    rows.sort((a,b)=>{
      if (a.total !== b.total) return b.total - a.total;
      if (a.placementP !== b.placementP) return b.placementP - a.placementP;
      if (a.kp !== b.kp) return b.kp - a.kp;
      if (a.ap !== b.ap) return b.ap - a.ap;
      if (a.treasure !== b.treasure) return b.treasure - a.treasure;
      if (a.flag !== b.flag) return b.flag - a.flag;
      return String(a.name||a.id).localeCompare(String(b.name||b.id));
    });

    return rows;
  }

  // ==========================================
  // ✅ Champion Name（必須互換）
  // ==========================================
  function getChampionName(state){
    try{
      // 1) 直近の match result rows があれば 1位を採用
      const rows = state?.lastMatchResultRows;
      if (Array.isArray(rows) && rows.length){
        const top = rows[0];
        if (top?.name) return String(top.name);
        if (top?.id) return resolveTeamName(state, top.id);
      }

      // 2) teamsから推定
      const teams = (state?.teams ? state.teams.slice() : []);
      if (!teams.length) return '???';

      teams.sort((a,b)=>{
        if (!!a?.eliminated !== !!b?.eliminated) return a.eliminated ? 1 : -1;
        const ar = Number(a?.eliminatedRound || 0);
        const br = Number(b?.eliminatedRound || 0);
        if (ar !== br) return br - ar;
        const ak = Number(a?.kills_total || 0);
        const bk = Number(b?.kills_total || 0);
        if (ak !== bk) return bk - ak;
        return String(a?.name||a?.id).localeCompare(String(b?.name||b?.id));
      });

      const best = teams[0];
      return resolveTeamName(state, best?.id || best?.name || '???');
    }catch(e){
      return '???';
    }
  }

  // ==========================================
  // Export（＋互換alias）
  // ==========================================
  const api = {
    resolveTeamName,
    calcPlacementPoint,

    computeMatchResultTable,
    addToTournamentTotal,
    computeTournamentResultTable,
    getChampionName,

    // alias（過去版/別実装吸収）
    buildMatchResultTable: computeMatchResultTable,
    buildMatchResultRows: computeMatchResultTable,
    addMatchToTotal: addToTournamentTotal,
    addMatchResultToTotal: addToTournamentTotal,
    buildTournamentResultTable: computeTournamentResultTable,
    buildCurrentOverall
  };

  // ① 通常の公開先
  window.MOBBR.sim.tournamentResult = api;

  // ✅ ② 重要：core_shared が掴む参照（T.R）も確実に更新
  //   - 分割/ロード順が前後しても total=0 を起こさない
  try{
    if (window.MOBBR?.sim?._tcore){
      window.MOBBR.sim._tcore.R = api;
    }
  }catch(_){}

})();
