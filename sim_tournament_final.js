/* =========================================================
   MOB BR - sim_tournament_final.js (FULL)
   FINAL 専用（20チーム）
   ---------------------------------------------------------
   仕様（確定）：
   ・20チームで最大5試合
   ・各試合ごとに result(20) を返す
   ・総合ポイントを加算
   ・いずれかのチームが【80pt 到達】した瞬間に終了
   ・80pt 到達者が複数の場合：
       1) 総合キル
       2) 平均順位
       3) ランダム
   ・80pt未達のまま5試合終了した場合：
       → 総合順位1位がチャンピオン
   ---------------------------------------------------------
   依存：
   ・SimMatch.runMatch（あれば使用）
========================================================= */

(function(){
  'use strict';

  const SimTournamentFinal = {};
  window.SimTournamentFinal = SimTournamentFinal;

  const MAX_MATCHES = 5;
  const WIN_PT = 80;

  /* =========================
     順位ポイント（確定）
  ========================== */
  function placementPoint(p){
    if (p === 1) return 12;
    if (p === 2) return 8;
    if (p === 3) return 6;
    if (p === 4) return 5;
    if (p === 5) return 4;
    if (p === 6) return 3;
    if (p === 7) return 2;
    if (p === 8) return 1;
    if (p === 9) return 1;
    if (p === 10) return 1;
    return 0;
  }

  /* =========================
     初期化
  ========================== */
  SimTournamentFinal.init = function(teamObjects20){
    const map = {};
    for (const t of teamObjects20){
      map[t.teamId] = {
        teamId: t.teamId,
        name: t.name,
        isPlayer: !!t.isPlayer,

        totalPts: 0,
        totalKills: 0,
        totalAssists: 0,
        totalTreasure: 0,
        totalFlag: 0,

        sumPlace: 0,
        matches: 0,
        avgPlace: 0,

        rank: 0
      };
    }

    return {
      teams20: teamObjects20.slice(),
      overallMap: map,
      matchIndex: 0,
      done: false,
      champion: null,
      lastMatch: null
    };
  };

  /* =========================
     1試合進行
  ========================== */
  SimTournamentFinal.playNext = function(state){
    if (!state || state.done) return null;
    if (state.matchIndex >= MAX_MATCHES){
      finalizeByPoints(state);
      return buildDoneResult(state);
    }

    const out = runOneMatch(state.teams20, {
      phase: 'final',
      matchNo: state.matchIndex + 1
    });

    const rows = out.rows || [];
    applyMatch(state.overallMap, rows);

    state.lastMatch = {
      matchNo: state.matchIndex + 1,
      rows
    };

    state.matchIndex += 1;

    const winners = checkWinners(state.overallMap);
    if (winners.length > 0){
      state.champion = resolveChampion(winners, state.overallMap);
      state.done = true;
      return buildDoneResult(state);
    }

    if (state.matchIndex >= MAX_MATCHES){
      finalizeByPoints(state);
      return buildDoneResult(state);
    }

    return {
      phase: 'final',
      matchNo: state.lastMatch.matchNo,
      resultRows20: rows,
      overall20: sortOverall(Object.values(state.overallMap))
    };
  };

  /* =========================
     判定
  ========================== */
  function checkWinners(map){
    return Object.values(map).filter(t => t.totalPts >= WIN_PT);
  }

  function resolveChampion(candidates, map){
    const list = candidates.slice();

    list.sort((a,b)=>{
      if (b.totalPts !== a.totalPts) return b.totalPts - a.totalPts;
      if (b.totalKills !== a.totalKills) return b.totalKills - a.totalKills;
      if (a.avgPlace !== b.avgPlace) return a.avgPlace - b.avgPlace;
      return Math.random() < 0.5 ? -1 : 1;
    });

    return map[list[0].teamId];
  }

  function finalizeByPoints(state){
    const rows = sortOverall(Object.values(state.overallMap));
    state.champion = rows[0];
    state.done = true;
  }

  /* =========================
     集計
  ========================== */
  function applyMatch(map, rows){
    for (const r of rows){
      const t = map[r.teamId];
      if (!t) continue;

      const pp = placementPoint(r.place);
      const kp = r.kp || 0;
      const ap = r.ap || 0;
      const tr = r.treasure || 0;
      const fl = r.flag || 0;

      const total = pp + kp + ap + tr + (fl * 2);

      t.totalPts += total;
      t.totalKills += kp;
      t.totalAssists += ap;
      t.totalTreasure += tr;
      t.totalFlag += fl;

      t.sumPlace += r.place;
      t.matches += 1;
      t.avgPlace = t.sumPlace / t.matches;
    }
  }

  function sortOverall(rows){
    const a = rows.slice();
    a.sort((x,y)=>{
      if (y.totalPts !== x.totalPts) return y.totalPts - x.totalPts;
      if (y.totalKills !== x.totalKills) return y.totalKills - x.totalKills;
      if (x.avgPlace !== y.avgPlace) return x.avgPlace - y.avgPlace;
      return Math.random() < 0.5 ? -1 : 1;
    });
    for (let i=0;i<a.length;i++) a[i].rank = i + 1;
    return a;
  }

  /* =========================
     Match 実行
  ========================== */
  function runOneMatch(teams20, opt){
    const runner =
      window.SimMatch?.runMatch ||
      window.MOBBR?.simMatch?.runMatch ||
      null;

    if (typeof runner === 'function'){
      const out = runner(teams20, opt || {});
      return { rows: out.rows || out.result || [] };
    }

    // 仮ロジック（UI確認用）
    const list = teams20.slice();
    list.sort((a,b)=>{
      const pa = a.basePower || 50;
      const pb = b.basePower || 50;
      return (pb + Math.random()*20) - (pa + Math.random()*20);
    });

    const rows = [];
    for (let i=0;i<list.length;i++){
      rows.push({
        place: i + 1,
        teamId: list[i].teamId,
        name: list[i].name,
        kp: Math.floor(Math.random()*4),
        ap: Math.floor(Math.random()*3),
        treasure: Math.random()<0.1 ? 1 : 0,
        flag: Math.random()<0.05 ? 1 : 0
      });
    }
    return { rows };
  }

  /* =========================
     終了時返却
  ========================== */
  function buildDoneResult(state){
    return {
      phase: 'final',
      done: true,
      champion: state.champion,
      overall20: sortOverall(Object.values(state.overallMap))
    };
  }

})();
