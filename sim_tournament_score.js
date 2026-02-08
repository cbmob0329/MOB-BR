/* =========================================================
   MOB BR - sim_tournament_score.js (FULL / SPEC COMPLETE)
   ---------------------------------------------------------
   役割：
   ・1大会につき「5試合分」の resultRows を合算
   ・20チーム大会 / 40チーム大会 両対応
   ・総合順位（ポイント→同点規則）を確定
   ・大会種別ごとの突破判定を返却
   ---------------------------------------------------------
   前提：
   ・各試合の resultRows は sim_result.js の形式
     {
       place, teamId, name,
       placementP, kp, ap, treasure, flag, total
     }
========================================================= */

(function(){
  'use strict';

  const SimTournamentScore = {};
  window.SimTournamentScore = SimTournamentScore;

  /* =========================
     PUBLIC API
  ========================== */

  /**
   * 大会の合算結果を作成
   * @param {Array<Array>} matches
   *   - 1試合ごとの resultRows 配列（length=5想定）
   * @param {Object} opt
   *   - mode: 'local' | 'national' | 'lastchance' | 'world' | 'championship'
   *   - teamCount: 20 | 40
   * @returns {Object}
   *   {
   *     rows: [{ rank, teamId, name, total, detail }],
   *     advance: { qualifiedIds:[], messageByTeamId:{} }
   *   }
   */
  SimTournamentScore.build = function(matches, opt){
    opt = opt || {};
    const mode = opt.mode || 'local';
    const teamCount = opt.teamCount || 20;

    // 1) 合算
    const table = aggregate(matches);

    // 2) 並び替え（総合順位）
    const rows = sortRows(table);

    // 3) 順位付与
    rows.forEach((r,i)=>{ r.rank = i + 1; });

    // 4) 突破判定
    const advance = buildAdvance(rows, mode, teamCount);

    return { rows, advance };
  };

  /* =========================
     AGGREGATE（5試合合算）
  ========================== */

  function aggregate(matches){
    const map = new Map();

    for(const match of matches || []){
      for(const r of match || []){
        if(!map.has(r.teamId)){
          map.set(r.teamId, {
            teamId: r.teamId,
            name: r.name,
            placementP: 0,
            kp: 0,
            ap: 0,
            treasure: 0,
            flag: 0,
            total: 0,
            places: [] // 平均順位用
          });
        }
        const t = map.get(r.teamId);
        t.placementP += r.placementP || 0;
        t.kp += r.kp || 0;
        t.ap += r.ap || 0;
        t.treasure += r.treasure || 0;
        t.flag += r.flag || 0;
        t.total += r.total || 0;
        t.places.push(r.place);
      }
    }

    // 平均順位
    for(const t of map.values()){
      if(t.places.length){
        t.avgPlace =
          t.places.reduce((a,b)=>a+b,0) / t.places.length;
      }else{
        t.avgPlace = 99;
      }
    }

    return Array.from(map.values());
  }

  /* =========================
     SORT（同点規則 確定）
     優先順：
     1) 総合ポイント
     2) 総合キル
     3) 平均順位
     4) 総合アシスト
     5) ランダム
  ========================== */

  function sortRows(list){
    const a = list.slice();
    a.sort((x,y)=>{
      if(x.total !== y.total) return y.total - x.total;
      if(x.kp !== y.kp) return y.kp - x.kp;
      if(x.avgPlace !== y.avgPlace) return x.avgPlace - y.avgPlace;
      if(x.ap !== y.ap) return y.ap - x.ap;
      return Math.random() < 0.5 ? -1 : 1;
    });
    return a;
  }

  /* =========================
     ADVANCE（大会別）
  ========================== */

  function buildAdvance(rows, mode, teamCount){
    const qualifiedIds = [];
    const messageByTeamId = {};

    rows.forEach(r=>{
      messageByTeamId[r.teamId] = '';
    });

    if(mode === 'local'){
      // 上位10 → ナショナル
      rows.forEach(r=>{
        if(r.rank <= 10){
          qualifiedIds.push(r.teamId);
          messageByTeamId[r.teamId] =
            `${r.rank}位通過でナショナル大会へ！頑張ろうね！`;
        }else{
          messageByTeamId[r.teamId] =
            `総合${r.rank}位となり敗退…次に向けて頑張ろう！`;
        }
      });
    }

    if(mode === 'national'){
      // 上位8 → ワールド
      // 9〜28 → ラストチャンス
      rows.forEach(r=>{
        if(r.rank <= 8){
          qualifiedIds.push(r.teamId);
          messageByTeamId[r.teamId] =
            `${r.rank}位でワールドファイナル確定！`;
        }else if(r.rank <= 28){
          qualifiedIds.push(r.teamId);
          messageByTeamId[r.teamId] =
            `${r.rank}位でラストチャンスへ進出！`;
        }else{
          messageByTeamId[r.teamId] =
            `${r.rank}位で敗退…次に向けて頑張ろう！`;
        }
      });
    }

    if(mode === 'lastchance'){
      // 上位2 → ワールド
      rows.forEach(r=>{
        if(r.rank <= 2){
          qualifiedIds.push(r.teamId);
          messageByTeamId[r.teamId] =
            `${r.rank}位通過！ワールドファイナル進出！`;
        }else{
          messageByTeamId[r.teamId] =
            `${r.rank}位で敗退…ここまで本当によく戦った！`;
        }
      });
    }

    if(mode === 'world'){
      // 上位20 → Winners / 下位20 → Losers
      rows.forEach(r=>{
        if(r.rank <= 20){
          qualifiedIds.push(r.teamId);
          messageByTeamId[r.teamId] = 'Winners進出！';
        }else{
          qualifiedIds.push(r.teamId);
          messageByTeamId[r.teamId] = 'Losersへ！まだまだここから！';
        }
      });
    }

    if(mode === 'championship'){
      // FINAL条件決着後
      rows.forEach(r=>{
        if(r.rank === 1){
          messageByTeamId[r.teamId] =
            '優勝おめでとう!! 最高の結果だね！';
        }else{
          messageByTeamId[r.teamId] =
            `最終${r.rank}位！よく頑張ったね！`;
        }
      });
    }

    return { qualifiedIds, messageByTeamId };
  }

})();
