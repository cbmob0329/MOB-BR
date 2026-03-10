'use strict';

/*
  sim_tournament_result.js（FULL 修正版 v2.5.0 + 報酬/企業ランク追加 + 戦績保存追加）

  ※ v2.4.2 の内容は削っていません
  ※ v2.5.0 追加修正：
     - 大会終了時、PLAYERの最終順位に応じて賞金を付与
     - 大会終了時、PLAYERの最終順位に応じて企業ランクを加算
     - 二重付与防止（同じ大会結果で何度も加算されない）
     - 保存先：
         mobbr_gold
         mobbr_company_rank
         mobbr_last_reward_signature
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){

  const HISTORY_KEY = 'mobbr_teamHistory_v1';

  // ===== 追加：報酬保存キー =====
  const GOLD_KEY = 'mobbr_gold';
  const COMPANY_RANK_KEY = 'mobbr_company_rank';
  const LAST_REWARD_SIGNATURE_KEY = 'mobbr_last_reward_signature';

  // ==========================================
  // 名前解決（完全版）
  // ==========================================
  function resolveTeamName(state, id){
    const sid = String(id);

    try{
      if (state?.teams){
        const t = state.teams.find(x => String(x?.id) === sid);
        if (t?.name) return String(t.name);
      }
    }catch(_){}

    try{
      if (state?.tournamentTotal){
        const t = state.tournamentTotal[sid];
        if (t?.name) return String(t.name);
      }
    }catch(_){}

    try{
      const allDefs = state?.national?.allTeamDefs;

      if (allDefs){
        if (!Array.isArray(allDefs) && typeof allDefs === 'object'){
          const def = allDefs[sid];
          if (def?.name) return String(def.name);
          if (def && (def.id || def.teamId)){
            const nid = String(def.id || def.teamId);
            if (nid && nid !== sid){
              const def2 = allDefs[nid];
              if (def2?.name) return String(def2.name);
            }
          }
        }
        else if (Array.isArray(allDefs)){
          const def = allDefs.find(x => String(x?.id || x?.teamId) === sid);
          if (def?.name) return String(def.name);
        }
      }
    }catch(_){}

    return sid;
  }

  function calcPlacementPoint(rank){
    if (rank === 1) return 12;
    if (rank === 2) return 9;
    if (rank === 3) return 7;
    if (rank === 4) return 5;
    if (rank === 5) return 4;
    if (rank <= 10) return 2;
    return 0;
  }

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

  // ✅ v2.4.2: rows を “その試合の順位(placement)” で正規化して lastMatchResultRows に保存
  function _normalizeMatchRows(state, rows){
    const arr = Array.isArray(rows) ? rows.slice() : [];

    // placement が無い/壊れてる場合は再計算して保険
    const hasPlacement = arr.length && arr.every(r => Number.isFinite(Number(r?.placement)) && Number(r?.placement) > 0);
    if (!hasPlacement){
      return computeMatchResultTable(state);
    }

    // placement 昇順（#1が先頭）に確定
    arr.sort((a,b)=>{
      const ap = Number(a?.placement || 0);
      const bp = Number(b?.placement || 0);
      if (ap !== bp) return ap - bp;
      // 念のため同順位の安定化（無いはずだけど）
      const at = Number(a?.total || 0);
      const bt = Number(b?.total || 0);
      if (bt !== at) return bt - at;
      return String(a?.name||a?.id).localeCompare(String(b?.name||b?.id));
    });

    // name が欠けているケースに保険
    for (let i=0;i<arr.length;i++){
      const r = arr[i];
      if (!r) continue;
      if (!r.name && r.id){
        r.name = resolveTeamName(state, r.id);
      }
    }

    return arr;
  }

  function buildCurrentOverall(state){
    if (!state) return;

    const ids = Array.isArray(state.teams) ? state.teams.map(t=>String(t?.id)) : [];

    const arr = ids.map(id=>{
      const t = state.tournamentTotal ? state.tournamentTotal[id] : null;
      if (!t) return null;

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
  // 追加：報酬テーブル
  // ==========================================
  function getTournamentReward(mode, rank){
    const m = String(mode || '').toLowerCase();
    const r = Number(rank || 999);

    // Local
    if (m === 'local'){
      if (r === 1) return { gold: 50000, rankUp: 3 };
      if (r === 2) return { gold: 30000, rankUp: 2 };
      if (r === 3) return { gold: 10000, rankUp: 1 };
      if (r >= 4 && r <= 6) return { gold: 3000, rankUp: 0 };
      return { gold: 0, rankUp: 0 };
    }

    // National
    if (m === 'national'){
      if (r === 1) return { gold: 300000, rankUp: 5 };
      if (r === 2) return { gold: 150000, rankUp: 3 };
      if (r === 3) return { gold: 50000, rankUp: 2 };
      if (r >= 4 && r <= 6) return { gold: 10000, rankUp: 1 };
      return { gold: 0, rankUp: 0 };
    }

    // World
    if (m === 'world'){
      if (r === 1) return { gold: 1000000, rankUp: 30 };
      if (r === 2) return { gold: 500000, rankUp: 15 };
      if (r === 3) return { gold: 300000, rankUp: 10 };
      if (r >= 4 && r <= 6) return { gold: 100000, rankUp: 3 };
      if (r >= 7 && r <= 10) return { gold: 50000, rankUp: 1 };
      return { gold: 0, rankUp: 0 };
    }

    // Championship（まだ未実装だが先に対応）
    if (m === 'championship'){
      if (r === 1) return { gold: 3000000, rankUp: 50 };
      if (r === 2) return { gold: 1000000, rankUp: 30 };
      if (r === 3) return { gold: 500000, rankUp: 15 };
      if (r >= 4 && r <= 6) return { gold: 250000, rankUp: 5 };
      return { gold: 0, rankUp: 0 };
    }

    return { gold: 0, rankUp: 0 };
  }

  function getRewardSignature(state, rank){
    const mode = String(state?.mode || '');
    const matchCount = Number(state?.matchCount || 0);
    const split =
      Number(state?.national?.split || 0) ||
      Number(state?.split || 0) ||
      Number((function(){
        try{
          const ts = JSON.parse(localStorage.getItem('mobbr_tour_state') || '{}');
          return ts?.split || 0;
        }catch(_){
          return 0;
        }
      })());

    const worldPhase = String(state?.worldPhase || state?.world?.phase || '');
    return `${mode}|split:${split}|matches:${matchCount}|phase:${worldPhase}|rank:${Number(rank||0)}`;
  }

  function awardTournamentRewardIfNeeded(state){
    try{
      if (!state) return { gold:0, rankUp:0, awarded:false, rank:0 };

      const overall = Array.isArray(state.currentOverallRows) ? state.currentOverallRows : [];
      if (!overall.length) return { gold:0, rankUp:0, awarded:false, rank:0 };

      const playerIndex = overall.findIndex(r => String(r?.id) === 'PLAYER');
      const playerRank = playerIndex >= 0 ? (playerIndex + 1) : 0;
      if (!playerRank) return { gold:0, rankUp:0, awarded:false, rank:0 };

      const reward = getTournamentReward(state.mode, playerRank);
      const sig = getRewardSignature(state, playerRank);
      const lastSig = String(localStorage.getItem(LAST_REWARD_SIGNATURE_KEY) || '');

      // 二重取得防止
      if (lastSig && lastSig === sig){
        return {
          gold: reward.gold || 0,
          rankUp: reward.rankUp || 0,
          awarded: false,
          rank: playerRank
        };
      }

      const addGold = Number(reward.gold || 0);
      const addRank = Number(reward.rankUp || 0);

      if (addGold > 0){
        const curGold = Number(localStorage.getItem(GOLD_KEY) || 0);
        const nextGold = (Number.isFinite(curGold) ? curGold : 0) + addGold;
        localStorage.setItem(GOLD_KEY, String(nextGold));
      }

      if (addRank > 0){
        const curRank = Number(localStorage.getItem(COMPANY_RANK_KEY) || 0);
        const nextRank = (Number.isFinite(curRank) ? curRank : 0) + addRank;
        localStorage.setItem(COMPANY_RANK_KEY, String(nextRank));
      }

      localStorage.setItem(LAST_REWARD_SIGNATURE_KEY, sig);

      // UIや後段で使えるよう state にも残す
      state.lastTournamentReward = {
        mode: String(state.mode || ''),
        rank: playerRank,
        gold: addGold,
        rankUp: addRank,
        awarded: true,
        signature: sig,
        at: Date.now()
      };

      return {
        gold: addGold,
        rankUp: addRank,
        awarded: true,
        rank: playerRank
      };
    }catch(e){
      console.warn('大会報酬付与失敗', e);
      return { gold:0, rankUp:0, awarded:false, rank:0 };
    }
  }

  function addToTournamentTotal(state, rows){
    if (!state) return;
    if (!state.tournamentTotal) state.tournamentTotal = {};

    // ✅ v2.4.2: マッチ結果を “この瞬間の試合結果” として state に確定保存（チャンピオン取り違え防止）
    try{
      state.lastMatchResultRows = _normalizeMatchRows(state, rows);
    }catch(_){}

    const arr = Array.isArray(rows) ? rows : [];

    arr.forEach(r=>{
      const id = String(r?.id);
      if (!id) return;

      if (!state.tournamentTotal[id]){
        state.tournamentTotal[id] = {
          id,
          name: String(r?.name || id),
          sumTotal:0,
          sumPlacementP:0,
          sumKP:0,
          sumAP:0,
          sumTreasure:0,
          sumFlag:0,
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

      t.sumKills        = t.sumKP;
      t.sumAssists      = t.sumAP;

      try{
        const team = state?.teams?.find(x => String(x?.id) === id);
        if (team){
          t.sumDowns += Number(team?.downs_total || 0);
        }
      }catch(_){}

      t.name = String(r?.name || t.name || id);
    });

    buildCurrentOverall(state);

    // ===== PLAYER戦績保存（大会終了時のみ）=====
    try{
      if (state.matchIndex === state.matchCount){
        const overall = state.currentOverallRows || [];
        const playerRow = overall.find(r => String(r.id) === 'PLAYER');
        if (!playerRow) return;

        const history = JSON.parse(localStorage.getItem(HISTORY_KEY) || '[]');

        history.unshift({
          mode: state.mode || '',
          date: Date.now(),
          rank: overall.findIndex(r => r.id === 'PLAYER') + 1,
          total: playerRow.total
        });

        localStorage.setItem(HISTORY_KEY, JSON.stringify(history.slice(0,100)));
      }
    }catch(e){
      console.warn('戦績保存失敗', e);
    }

    // ===== 追加：大会終了時のみ報酬付与 =====
    try{
      if (state.matchIndex === state.matchCount){
        awardTournamentRewardIfNeeded(state);
      }
    }catch(e){
      console.warn('大会報酬付与失敗', e);
    }
  }

  // ✅ v2.4.2 修正：マッチチャンピオンは “その試合結果の1位” だけを見る
  // - currentOverallRows（総合）には絶対フォールバックしない（ここが誤表示の原因）
  function getChampionName(state){
    try{
      // 1) lastMatchResultRows（試合結果の確定値）
      let rows = state?.lastMatchResultRows;

      // 2) 無い/空なら、その場で “試合結果” を計算してトップを出す（保険）
      if (!Array.isArray(rows) || !rows.length){
        rows = computeMatchResultTable(state);
      }

      // 3) 先頭=マッチ1位
      if (Array.isArray(rows) && rows.length){
        // placement昇順で担保（lastMatchResultRows が外部から壊されても安全）
        const top = _normalizeMatchRows(state, rows)[0];
        if (top?.name) return String(top.name);
        if (top?.id) return resolveTeamName(state, top.id);
      }

      return '???';
    }catch(e){
      return '???';
    }
  }

  const api = {
    resolveTeamName,
    calcPlacementPoint,
    computeMatchResultTable,
    addToTournamentTotal,
    computeTournamentResultTable,
    getChampionName,
    getTournamentReward,
    awardTournamentRewardIfNeeded,
    buildMatchResultTable: computeMatchResultTable,
    buildMatchResultRows: computeMatchResultTable,
    addMatchToTotal: addToTournamentTotal,
    addMatchResultToTotal: addToTournamentTotal,
    buildTournamentResultTable: computeTournamentResultTable,
    buildCurrentOverall
  };

  window.MOBBR.sim.tournamentResult = api;

  try{
    if (window.MOBBR?.sim?._tcore){
      window.MOBBR.sim._tcore.R = api;
    }
  }catch(_){}

})();
