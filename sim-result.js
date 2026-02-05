/* =========================================================
   MOB BR - sim-result.js (FULL / SPEC COMPLETE)
   試合の流れ.txt 完全準拠
   ---------------------------------------------------------
   ・順位確定（ラウンド別脱落順）
   ・Placement Point 固定
   ・Total Point 計算式固定
   ・同ラウンド脱落のタイブレーク実装
========================================================= */

(function(){
  'use strict';

  const SimResult = {};
  window.SimResult = SimResult;

  /* =========================
     PUBLIC
  ========================== */
  SimResult.finalizeTournament = function(teams){
    // place 未確定を整理
    assignPlacesByElimination(teams);

    // result rows 生成
    const rows = buildRows(teams);

    // チャンピオン
    const champion = rows[0]?.name || '';

    return { champion, rows };
  };

  /* =========================
     PLACE ASSIGN
  ========================== */
  function assignPlacesByElimination(teams){
    // place が付いている＝脱落済み
    const decided = teams.filter(t => t.place != null);
    const undecided = teams.filter(t => t.place == null);

    // 生存しているチーム（最後まで）
    if(undecided.length === 1){
      undecided[0].place = 1;
      return;
    }

    // 同ラウンド脱落の tie-break
    decided.sort(compareTeams);

    // 下位から順位を振り直す
    let place = teams.length;
    for(const t of decided){
      t.place = place;
      place--;
    }

    // 残り（生存）を上位に
    undecided.sort(compareTeams).reverse();
    for(const t of undecided){
      t.place = place;
      place--;
    }
  }

  /* =========================
     RESULT ROWS
  ========================== */
  function buildRows(teams){
    const list = teams.slice().sort((a,b)=>a.place-b.place);
    return list.map(t => ({
      place: t.place,
      name: t.name,
      teamId: t.teamId,
      placementP: placementPoint(t.place),
      kp: t.kp || 0,
      ap: t.ap || 0,
      treasure: t.treasure || 0,
      flag: t.flag || 0,
      total: calcTotal(t),
      members: t.isPlayer ? summarizeMembers(t) : null
    }));
  }

  /* =========================
     TIE BREAK
     1) KP 多い
     2) DB 少ない
     3) 総合力低い方寄り（60:40）
     4) ランダム
  ========================== */
  function compareTeams(a,b){
    if((a.kp||0) !== (b.kp||0)) return (b.kp||0)-(a.kp||0);
    if((a.deathBoxes||0) !== (b.deathBoxes||0)) return (a.deathBoxes||0)-(b.deathBoxes||0);

    const pa = a._avgPower || 0;
    const pb = b._avgPower || 0;
    if(pa !== pb){
      return Math.random() < 0.6 ? pa-pb : pb-pa;
    }
    return Math.random()<0.5 ? -1 : 1;
  }

  /* =========================
     POINTS
  ========================== */
  function placementPoint(p){
    if(p===1) return 12;
    if(p===2) return 8;
    if(p===3) return 5;
    if(p===4) return 3;
    if(p===5) return 2;
    if(p>=6 && p<=10) return 1;
    return 0;
  }

  function calcTotal(t){
    return (
      placementPoint(t.place) +
      (t.kp||0) +
      (t.ap||0) +
      (t.treasure||0) +
      (t.flag||0)*2
    );
  }

  /* =========================
     PLAYER DETAIL
  ========================== */
  function summarizeMembers(team){
    return team.members.map(m=>({
      name: m.name,
      kills: m.kills||0,
      assists: m.assists||0
    }));
  }

})();
