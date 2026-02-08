'use strict';

/*
  match_result.js
  ----------------------------
  役割：
  ・1試合のresult（順位1〜20）を確定
  ・各種ポイント加算
  ・大会用の累積データを更新
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.matchResult = (function(){

  /* ===========================
     順位ポイント表（確定）
  ============================*/
  const RANK_POINTS = {
    1: 12,
    2: 8,
    3: 6,
    4: 5,
    5: 4,
    6: 3,
    7: 2,
    8: 1,
    9: 1,
    10: 1
    // 11〜20：0
  };

  /* ===========================
     ソート用
  ============================*/

  function sortTeamsForResult(teams){

    return [...teams].sort((a, b) => {

      // 生存優先
      if (a.eliminated !== b.eliminated){
        return a.eliminated ? 1 : -1;
      }

      // ポイント
      if (b.matchPoints !== a.matchPoints){
        return b.matchPoints - a.matchPoints;
      }

      // キル
      if (b.kills_total !== a.kills_total){
        return b.kills_total - a.kills_total;
      }

      // アシスト
      if (b.assists_total !== a.assists_total){
        return b.assists_total - a.assists_total;
      }

      // ランダム
      return Math.random() - 0.5;
    });
  }

  /* ===========================
     ポイント計算
  ============================*/

  function calcMatchPoints(team, rank){

    let pt = 0;

    // 順位ポイント
    pt += RANK_POINTS[rank] || 0;

    // キル / アシスト
    pt += team.kills_total || 0;
    pt += team.assists_total || 0;

    // 宝 / 旗
    pt += team.treasure || 0;
    pt += (team.flag || 0) * 2;

    return pt;
  }

  /* ===========================
     大会累積反映
  ============================*/

  function applyTournamentTotal(team, matchPt){

    team.tournament = team.tournament || {
      points: 0,
      kills: 0,
      assists: 0,
      matches: 0
    };

    team.tournament.points += matchPt;
    team.tournament.kills += team.kills_total || 0;
    team.tournament.assists += team.assists_total || 0;
    team.tournament.matches += 1;
  }

  /* ===========================
     メイン処理
  ============================*/

  function processMatchResult(teams){

    // teams：20チーム配列
    const result = [];

    // ソート
    const sorted = sortTeamsForResult(teams);

    sorted.forEach((team, index) => {

      const rank = index + 1;
      const matchPt = calcMatchPoints(team, rank);

      // 保存用
      team.matchRank = rank;
      team.matchPoints = matchPt;

      applyTournamentTotal(team, matchPt);

      result.push({
        rank,
        teamId: team.teamId,
        points: matchPt,
        kills: team.kills_total || 0,
        assists: team.assists_total || 0,
        treasure: team.treasure || 0,
        flag: team.flag || 0
      });
    });

    return {
      result,       // UI表示用
      updatedTeams: teams // 大会継続用
    };
  }

  return {
    processMatchResult
  };

})();
