/* =========================================================
   MOB BR - sim_result.js (FULL / SPEC FIXED)
   ---------------------------------------------------------
   役割：
   ・1試合の result（1〜20位）を確定する
   ・順位ポイント / KP / AP / お宝 / フラッグを合算
   ・同点時タイブレークは「確定仕様」通り
   ---------------------------------------------------------
   前提：
   ・teams[] には以下が入っている
     - teamId
     - name
     - eliminatedRound（R1〜R6で脱落。優勝は null）
     - kp / ap / treasure / flag
     - avgPlace（大会用だが、ここでは tie-break 用に使用）
========================================================= */

(function(){
  'use strict';

  const SimResult = {};
  window.SimResult = SimResult;

  /* =========================
     PUBLIC
  ========================== */
  SimResult.buildMatchResult = function(teams){
    // 1. 順位確定
    const ranked = assignPlaces(teams);

    // 2. result rows
    const rows = ranked.map(t => ({
      place: t.place,
      teamId: t.teamId,
      name: t.name,

      placementPt: placementPoint(t.place),
      killPt: t.kp || 0,
      assistPt: t.ap || 0,
      treasurePt: t.treasure || 0,
      flagPt: (t.flag || 0) * 2,

      totalPt: calcTotal(t)
    }));

    return rows;
  };

  /* =========================
     PLACE ASSIGN
     ・R6脱落 → 2位
     ・最後まで生存 → 1位
     ・同Round脱落は tie-break
  ========================== */
  function assignPlaces(teams){
    const alive = [];
    const deadByRound = {};

    for(const t of teams){
      if(t.eliminatedRound == null){
        alive.push(t);
      }else{
        const r = t.eliminatedRound;
        if(!deadByRound[r]) deadByRound[r] = [];
        deadByRound[r].push(t);
      }
    }

    // 最後まで生存（1チーム）
    if(alive.length === 1){
      alive[0].place = 1;
    }

    let place = teams.length;

    // R1 → R6 の順で下位から付与
    for(let r=1; r<=6; r++){
      const list = deadByRound[r];
      if(!list) continue;

      list.sort(compareTeams); // 同Round脱落 tie-break

      for(const t of list){
        t.place = place;
        place--;
      }
    }

    // 残り（優勝）
    for(const t of alive){
      if(t.place == null){
        t.place = place;
        place--;
      }
    }

    // 念のため place 昇順で返す
    return teams.slice().sort((a,b)=>a.place-b.place);
  }

  /* =========================
     TIE BREAK（確定仕様）
     1. 総合ポイント（仮）
     2. 総合キル
     3. 平均順位
     4. 総合アシスト
     5. ランダム
  ========================== */
  function compareTeams(a,b){
    const ta = calcTotal(a);
    const tb = calcTotal(b);
    if(ta !== tb) return tb - ta;

    if((a.kp||0) !== (b.kp||0)) return (b.kp||0) - (a.kp||0);

    if((a.avgPlace||99) !== (b.avgPlace||99)){
      return (a.avgPlace||99) - (b.avgPlace||99);
    }

    if((a.ap||0) !== (b.ap||0)) return (b.ap||0) - (a.ap||0);

    return Math.random() < 0.5 ? -1 : 1;
  }

  /* =========================
     POINT TABLE（確定）
  ========================== */
  function placementPoint(p){
    if(p === 1) return 12;
    if(p === 2) return 8;
    if(p === 3) return 6;
    if(p === 4) return 5;
    if(p === 5) return 4;
    if(p === 6) return 3;
    if(p === 7) return 2;
    if(p === 8) return 1;
    if(p === 9) return 1;
    if(p === 10) return 1;
    return 0;
  }

  function calcTotal(t){
    return (
      placementPoint(t.place || 99) +
      (t.kp || 0) +
      (t.ap || 0) +
      (t.treasure || 0) +
      (t.flag || 0) * 2
    );
  }

})();
