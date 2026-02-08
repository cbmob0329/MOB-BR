/* =========================================================
   MOB BR - sim_event.js (FULL)
   - ラウンドごとの「非交戦イベント」を処理
   - お宝 / フラッグ / 回復 / 強化 など
   ---------------------------------------------------------
   依存：
   - sim-map.js（任意）：エリア名取得に使用
   - RULES（任意）：イベント率などを外部定義できる
========================================================= */

(function(){
  'use strict';

  const SimEvent = {};
  window.SimEvent = SimEvent;

  /* =========================
     設定（外部上書き可）
  ========================== */
  const CONF = {
    treasureRate: 0.25, // お宝発生率（チームごと）
    flagRate:     0.10, // フラッグ取得率（チームごと）
    healRate:     0.20, // 回復イベント率
    buffRate:     0.15  // 一時強化率
  };

  // 外部 RULES があれば上書き
  if (window.RULES?.EVENT){
    Object.assign(CONF, window.RULES.EVENT);
  }

  /* =========================
     公開API
  ========================== */

  /**
   * ラウンドイベント適用
   * @param {Object} state  match state（sim_round.js）
   * @param {Number} round  現在ラウンド
   * @return {Array} イベントログ配列
   */
  SimEvent.applyRoundEvents = function(state, round){
    const logs = [];
    const teams = (state.teams || []).filter(t => t && !t.eliminated);

    for (const team of teams){
      // お宝
      if (roll(CONF.treasureRate)){
        addPoint(team, 'treasure', 1);
        logs.push(makeLog(team, 'TREASURE', `お宝を発見！ +1pt`));
      }

      // フラッグ
      if (roll(CONF.flagRate)){
        addPoint(team, 'flag', 2);
        logs.push(makeLog(team, 'FLAG', `フラッグを取得！ +2pt`));
      }

      // 回復（ノック無し前提のため簡易）
      if (roll(CONF.healRate)){
        team.healed = true; // フラグだけ立てる（戦闘側で参照可）
        logs.push(makeLog(team, 'HEAL', `体勢を立て直した`));
      }

      // 一時強化
      if (roll(CONF.buffRate)){
        const buff = randInt(3,7); // +3〜+7%
        team.tempBuff = (team.tempBuff || 0) + buff;
        logs.push(makeLog(team, 'BUFF', `士気上昇 +${buff}%`));
      }
    }

    return logs;
  };

  /* =========================
     内部ユーティリティ
  ========================== */

  function roll(rate){
    return Math.random() < rate;
  }

  function randInt(min,max){
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function addPoint(team, key, val){
    team.points = team.points || {
      placement:0,
      kill:0,
      assist:0,
      treasure:0,
      flag:0
    };
    team.points[key] = (team.points[key] || 0) + val;
  }

  function makeLog(team, type, text){
    const areaName =
      window.SimMap && SimMap.getAreaName
        ? SimMap.getAreaName(team.areaId)
        : `Area${team.areaId}`;

    return {
      type,                // TREASURE / FLAG / HEAL / BUFF
      teamId: team.teamId,
      teamName: team.name,
      areaId: team.areaId,
      areaName,
      text
    };
  }

})();
