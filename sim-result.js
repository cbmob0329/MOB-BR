/* =========================================================
   MOB BR - sim-result.js (FULL)
   - 順位算出（20→1）
   - Result rows 生成（順位 / KP / AP / Treasure / Flag / Total）
   - プレイヤー脱落後の高速処理（ログ省略）
   ---------------------------------------------------------
   依存：
   - data_rules.js (RULES)
   ---------------------------------------------------------
   提供：window.SimResult
   - sortTeamsByResult(teams)
   - buildResultRows(teams)
   - finalizeTournament(teams)
========================================================= */

(function(){
  'use strict';

  const SimResult = {};
  window.SimResult = SimResult;

  /* =========================
     SORT / RANKING
  ========================== */

  // 仕様：
  // 1) 生存順位（place 小さいほど上位）
  // 2) Total Point
  // 3) KP
  // 4) AP
  // 5) Treasure
  // 6) Flag
  SimResult.sortTeamsByResult = function(teams){
    const list = (teams || []).slice();

    list.sort((a,b)=>{
      // place（数値が小さいほど上）
      if(a.place != null && b.place != null && a.place !== b.place){
        return a.place - b.place;
      }
      if(a.place != null && b.place == null) return -1;
      if(a.place == null && b.place != null) return 1;

      // Total
      const ta = calcTotal(a);
      const tb = calcTotal(b);
      if(ta !== tb) return tb - ta;

      // KP / AP / Treasure / Flag
      if((a.kp||0) !== (b.kp||0)) return (b.kp||0) - (a.kp||0);
      if((a.ap||0) !== (b.ap||0)) return (b.ap||0) - (a.ap||0);
      if((a.treasure||0) !== (b.treasure||0)) return (b.treasure||0) - (a.treasure||0);
      if((a.flag||0) !== (b.flag||0)) return (b.flag||0) - (a.flag||0);

      return 0;
    });

    return list;
  };

  /* =========================
     RESULT ROWS
  ========================== */
  SimResult.buildResultRows = function(teams){
    const sorted = SimResult.sortTeamsByResult(teams);
    const rows = [];

    let rank = 1;
    for(const t of sorted){
      const place = t.place ?? rank;
      const row = {
        rank: rank,
        teamId: t.teamId,
        name: t.name,
        place: place,
        kp: t.kp || 0,
        ap: t.ap || 0,
        treasure: t.treasure || 0,
        flag: t.flag || 0,
        total: calcTotal({ ...t, place })
      };
      rows.push(row);
      rank++;
    }
    return rows;
  };

  /* =========================
     FINALIZE
  ========================== */
  // チャンピオン確定・place確定
  SimResult.finalizeTournament = function(teams){
    const alive = teams.filter(t => !t.eliminated);

    // 最後まで生存しているチームが1つ
    if(alive.length === 1){
      alive[0].place = 1;
    }

    // place未確定のチームに順位を振る（下位から）
    const sorted = SimResult.sortTeamsByResult(teams);
    let p = 1;
    for(const t of sorted){
      if(t.place == null){
        t.place = p;
      }
      p++;
    }

    const champion = sorted[0];
    return {
      champion: champion?.name || '',
      rows: SimResult.buildResultRows(sorted)
    };
  };

  /* =========================
     INTERNAL
  ========================== */
  function calcTotal(t){
    const r = window.RULES?.RESULT;
    if(!r) return 0;
    return r.totalOf({
      place: t.place,
      kp: t.kp || 0,
      ap: t.ap || 0,
      treasure: t.treasure || 0,
      flag: t.flag || 0
    });
  }

})();
