'use strict';

/* =========================================================
   sim_tournament_core_step_base.js（FULL） v5.4b
   - sim_tournament_core_step.js を2分割するための “base(共通/ヘルパー)” 側
   - 既存仕様維持（Local / LastChance / National / WORLD Qual+Losers+Final を壊さない）
   - ✅ resultの件（途中経過の総合RESULT currentOverallRows が空/更新されない問題）を安全に補強
     -> tournamentResult 側の総合テーブル生成関数を自動検出し、存在すれば currentOverallRows を毎回更新
========================================================= */

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){

  const T = window.MOBBR?.sim?._tcore;
  if (!T){
    console.error('[tournament_core_step_base] shared not loaded: window.MOBBR.sim._tcore missing');
    return;
  }

  const L = T.L;
  const P = T.P;

  // step内で元の関数名を保つためのショートカット（base側でも使う）
  function getPlayer(){ return T.getPlayer(); }
  function aliveTeams(){ return T.aliveTeams(); }

  function ensureTeamRuntimeShape(t){ return T.ensureTeamRuntimeShape(t); }

  function setRequest(type, payload){ return T.setRequest(type, payload); }
  function setCenter3(a,b,c){ return T.setCenter3(a,b,c); }

  function getPlayerSkin(){ return T.getPlayerSkin(); }
  function getAreaInfo(areaId){ return T.getAreaInfo(areaId); }

  function applyEventForTeam(team){ return T.applyEventForTeam(team); }
  function initMatchDrop(){ return T.initMatchDrop(); }

  function fastForwardToMatchEnd(){ return T.fastForwardToMatchEnd(); }
  function finishMatchAndBuildResult(){ return T.finishMatchAndBuildResult(); }
  function startNextMatch(){ return T.startNextMatch(); }
  function resolveOneBattle(A,B,round){ return T.resolveOneBattle(A,B,round); }

  function _setNationalBanners(){ return T._setNationalBanners(); }
  function _getSessionKey(idx){ return T._getSessionKey(idx); }
  function _markSessionDone(key){ return T._markSessionDone(key); }
  function _sessionHasPlayer(sessionIndex){ return T._sessionHasPlayer(sessionIndex); }
  function _autoRunNationalSession(){ return T._autoRunNationalSession(); }

  // =========================================================
  // ✅ localStorage helper（壊さない・参照/更新のみ）
  // =========================================================
  const K_TS = 'mobbr_tour_state';
  function getJSON(key, def){
    try{
      const raw = localStorage.getItem(key);
      if (!raw) return def;
      return JSON.parse(raw);
    }catch(e){ return def; }
  }
  function setJSON(key, val){
    try{ localStorage.setItem(key, JSON.stringify(val)); }catch(e){}
  }

  // =========================================================
  // ✅ total init（リーグ切り替え時の合算枠）
  // =========================================================
  function initTotalForIds(ids){
    const total = {};
    for (const id0 of (ids||[])){
      const id = String(id0||'');
      if (!id) continue;
      total[id] = total[id] || {
        id,
        sumTotal: 0,
        sumPlacementP: 0,
        sumKP: 0,
        sumAP: 0,
        sumTreasure: 0,
        sumFlag: 0,
        // internal
        sumKills: 0,
        sumAssists: 0,
        sumDowns: 0
      };
    }
    return total;
  }

  // =========================
  // ✅ CPU Loot Roll（Treasure/Flag）
  // =========================
  function cpuLootRollOncePerRound(state, round){
    try{
      const r = Number(round||0);
      if (!Number.isFinite(r) || r <= 0) return;

      if (!state._cpuLootRolled) state._cpuLootRolled = {};
      if (state._cpuLootRolled[String(r)] === true) return;

      state._cpuLootRolled[String(r)] = true;

      const teams = Array.isArray(state.teams) ? state.teams : [];
      for (const t of teams){
        if (!t) continue;
        ensureTeamRuntimeShape(t);
        if (t.eliminated) continue;
        if (t.isPlayer) continue;

        if (Math.random() < 0.08){
          t.treasure = (Number(t.treasure||0) + 1);
        }
        if (Math.random() < 0.04){
          t.flag = (Number(t.flag||0) + 1);
        }
      }
    }catch(e){}
  }

  // =========================
  // ✅ Champion Name Safe（NEXT死防止の核）
  // =========================
  function getChampionNameSafe(state){
    const R2 = (T.getR && typeof T.getR === 'function') ? T.getR() : (window.MOBBR?.sim?.tournamentResult || null);

    try{
      if (R2 && typeof R2.getChampionName === 'function'){
        const name = R2.getChampionName(state);
        if (name) return String(name);
      }
    }catch(e){
      console.warn('[tournament_core_step_base] getChampionName error:', e);
    }

    // fallback1: lastMatchResultRows
    try{
      const rows = state?.lastMatchResultRows;
      if (Array.isArray(rows) && rows.length){
        const top = rows[0];
        if (top?.name) return String(top.name);
        if (top?.id && typeof R2?.resolveTeamName === 'function'){
          return String(R2.resolveTeamName(state, top.id));
        }
        if (top?.id) return String(top.id);
      }
    }catch(_){}

    // fallback2: teams（簡易推定）
    try{
      const teams = (state?.teams ? state.teams.slice() : []);
      if (teams.length){
        teams.sort((a,b)=>{
          if (!!a.eliminated !== !!b.eliminated) return a.eliminated ? 1 : -1;
          const ar = Number(a.eliminatedRound || 0);
          const br = Number(b.eliminatedRound || 0);
          if (ar !== br) return br - ar;
          const ak = Number(a.kills_total || 0);
          const bk = Number(b.kills_total || 0);
          if (ak !== bk) return bk - ak;
          return String(a.name||a.id).localeCompare(String(b.name||b.id));
        });
        const best = teams[0];
        if (best?.name) return String(best.name);
        if (best?.id && typeof R2?.resolveTeamName === 'function'){
          return String(R2.resolveTeamName(state, best.id));
        }
        if (best?.id) return String(best.id);
      }
    }catch(_){}

    return '???';
  }

  // =========================
  // ✅ MatchResult rows Safe（result 0行バグ潰し）
  // =========================
  function ensureMatchResultRows(state){
    try{
      const rows = state?.lastMatchResultRows;
      if (Array.isArray(rows) && rows.length > 0) return true;

      const R2 = (T.getR && typeof T.getR === 'function') ? T.getR() : (window.MOBBR?.sim?.tournamentResult || null);
      if (!R2 || typeof R2.computeMatchResultTable !== 'function' || typeof R2.addToTournamentTotal !== 'function'){
        console.error('[tournament_core_step_base] ensureMatchResultRows: tournamentResult missing methods', {
          hasR: !!R2,
          computeMatchResultTable: !!R2?.computeMatchResultTable,
          addToTournamentTotal: !!R2?.addToTournamentTotal
        });
        state.lastMatchResultRows = [];
        return false;
      }

      const rows2 = R2.computeMatchResultTable(state) || [];
      R2.addToTournamentTotal(state, rows2);
      state.lastMatchResultRows = rows2;

      return Array.isArray(rows2) && rows2.length > 0;
    }catch(e){
      console.error('[tournament_core_step_base] ensureMatchResultRows error:', e);
      try{ state.lastMatchResultRows = []; }catch(_){}
      return false;
    }
  }

  // =========================
  // ✅ resultの件：currentOverallRows Safe（途中経過の総合RESULTを毎回更新）
  // - tournamentResult側の実装差を吸収（複数候補を自動検出）
  // =========================
  function ensureCurrentOverallRows(state){
    try{
      if (!state) return false;

      const R2 = (T.getR && typeof T.getR === 'function') ? T.getR() : (window.MOBBR?.sim?.tournamentResult || null);
      if (!R2){
        state.currentOverallRows = Array.isArray(state.currentOverallRows) ? state.currentOverallRows : [];
        return false;
      }

      // 候補（プロジェクトの差分吸収用）
      const candidates = [
        'computeTournamentOverallTable',
        'computeOverallTable',
        'computeOverallResultTable',
        'computeTournamentTotalTable',
        'buildOverallTable',
        'buildOverallRows',
        'getOverallRows',
        'getCurrentOverallRows'
      ];

      let fn = null;
      let fnName = '';
      for (const name of candidates){
        if (typeof R2[name] === 'function'){
          fn = R2[name];
          fnName = name;
          break;
        }
      }

      if (!fn){
        state.currentOverallRows = Array.isArray(state.currentOverallRows) ? state.currentOverallRows : [];
        return false;
      }

      const rows = fn.call(R2, state);
      if (Array.isArray(rows)){
        state.currentOverallRows = rows;
        return true;
      }

      // 返り値がオブジェクト形式などの場合に備えた最小限の保険
      if (rows && Array.isArray(rows.rows)){
        state.currentOverallRows = rows.rows;
        return true;
      }

      state.currentOverallRows = Array.isArray(state.currentOverallRows) ? state.currentOverallRows : [];
      console.warn('[tournament_core_step_base] ensureCurrentOverallRows: unexpected return from', fnName, rows);
      return false;

    }catch(e){
      console.error('[tournament_core_step_base] ensureCurrentOverallRows error:', e);
      try{ state.currentOverallRows = Array.isArray(state.currentOverallRows) ? state.currentOverallRows : []; }catch(_){}
      return false;
    }
  }

  // =========================================================
  // ✅ v4.7: プレイヤー敗北後も “残りCPU戦 + 残りラウンド” を必ず全解決
  // =========================================================
  function resolveAllRemainingCpuBattlesFromCursor(state, round, fromCursor){
    try{
      const list = Array.isArray(state._roundMatches) ? state._roundMatches : [];
      let cur = Number(fromCursor||0);

      while (cur < list.length){
        const pair = list[cur];
        const A = state.teams.find(t=>t.id===pair.aId);
        const B = state.teams.find(t=>t.id===pair.bId);
        if (!A || !B){
          cur++;
          continue;
        }
        if (A.isPlayer || B.isPlayer){
          cur++;
          continue;
        }
        resolveOneBattle(A, B, round);
        cur++;
      }
    }catch(e){}
  }

  function resolveFullMatchToEndAfterPlayerEliminated(state){
    try{
      const r0 = Number(state.round||1);
      const cur0 = Number(state._matchCursor||0);
      resolveAllRemainingCpuBattlesFromCursor(state, r0, cur0 + 1);

      let r = r0;
      while (r <= 6){
        cpuLootRollOncePerRound(state, r);

        let matches = null;
        try{
          matches = L.buildMatchesForRound(state, r, getPlayer, aliveTeams) || [];
        }catch(_){
          matches = [];
        }

        state._roundMatches = matches.map(([A,B])=>({ aId:A.id, bId:B.id }));
        for (const [A,B] of matches){
          if (!A || !B) continue;
          if (A.isPlayer || B.isPlayer) continue;
          resolveOneBattle(A, B, r);
        }

        if (r >= 6) break;

        try{ L.moveAllTeamsToNextRound(state, r); }catch(_){}
        r++;
        state.round = r;
      }
    }catch(e){
      console.error('[tournament_core_step_base] resolveFullMatchToEndAfterPlayerEliminated error:', e);
    }
  }

  // =========================
  // ✅ WORLD banner helper（MATCH常時）
  // =========================
  function setWorldBanners(state, rightText){
    const s = state.national || {};
    const si = Number(s.sessionIndex||0);
    const sc = Number(s.sessionCount||6);
    const key = String(s.sessions?.[si]?.key || `S${si+1}`);
    const ph = String(state.worldPhase||'qual').toUpperCase();

    state.bannerLeft = `WORLD ${ph} ${key} (${si+1}/${sc})  MATCH ${state.matchIndex} / ${state.matchCount}`;
    state.bannerRight = String(rightText||'');
  }

  // =========================================================
  // ✅ WORLD（Qual→Losers→Final） helpers
  // =========================================================
  function computeRankedIdsFromTotal(total){
    const list = Object.values(total||{}).filter(Boolean);
    list.sort((a,b)=>{
      const at = Number(a.sumTotal||0), bt = Number(b.sumTotal||0);
      if (bt !== at) return bt - at;

      const ap = Number(a.sumPlacementP||0), bp = Number(b.sumPlacementP||0);
      if (bp !== ap) return bp - ap;

      const ak = Number(a.sumKP||0), bk = Number(b.sumKP||0);
      if (bk !== ak) return bk - ak;

      const aa = Number(a.sumAP||0), ba = Number(b.sumAP||0);
      if (ba !== aa) return ba - aa;

      const an = String(a.id||''), bn = String(b.id||'');
      return an.localeCompare(bn);
    });
    return list.map(x=>String(x.id||'')).filter(Boolean);
  }

  // ✅ defsに存在しないIDを受けても「0チーム化」しないための補完生成
  function buildFallbackTeamDef(id){
    const tid = String(id||'');
    const isPlayer = (tid === 'PLAYER');
    const baseMembers = isPlayer
      ? (()=>{
          try{
            const raw = localStorage.getItem('mobbr_playerTeam');
            if (raw){
              const j = JSON.parse(raw);
              if (j && Array.isArray(j.members) && j.members.length){
                return j.members.slice(0,3).map((m,idx)=>({
                  slot: Number(m.slot||idx+1),
                  name: String(m.name||['A','B','C'][idx]||'A')
                }));
              }
            }
          }catch(_){}
          return [{slot:1,name:'A'},{slot:2,name:'B'},{slot:3,name:'C'}];
        })()
      : [{slot:1,name:'CPU-1'},{slot:2,name:'CPU-2'},{slot:3,name:'CPU-3'}];

    return {
      id: tid,
      name: isPlayer ? (localStorage.getItem('mobbr_team') || 'PLAYER TEAM') : tid,
      power: isPlayer ? Number(localStorage.getItem('mobbr_team_power')||66) : 55,
      members: baseMembers,
      isPlayer: !!isPlayer,

      alive: true,
      eliminated: false,
      treasure: 0,
      flag: 0
    };
  }

  function swapTeamsToIds(state, ids){
    try{
      const defs = state?.national?.allTeamDefs || {};
      const arr = (ids||[]).map(x=>String(x||'')).filter(Boolean);

      const teams = [];
      for (const id of arr){
        let t = defs[id];
        if (!t){
          t = buildFallbackTeamDef(id);
          defs[id] = t;
          if (state?.national && state.national.allTeamDefs) state.national.allTeamDefs = defs;
        }
        teams.push(t);
      }

      state.teams = teams.slice(0, arr.length);
      for (const t of state.teams) ensureTeamRuntimeShape(t);

      state.tournamentTotal = initTotalForIds(state.teams.map(t=>t.id));

      state.matchIndex = 1;
      state.round = 1;

      // coach廃止：状態は残すが常にnull/空で運用（互換）
      state.selectedCoachSkill = null;
      state.selectedCoachQuote = '';

      state._cpuLootRolled = {};
      state._roundMatches = null;
      state._matchCursor = 0;
      state.lastMatchResultRows = [];
      state.currentOverallRows = [];

      try{
        if (state.mode === 'world' && String(state.worldPhase||'') === 'final'){
          state.worldFinalMP = {
            litAtMatch: {},
            winnerId: '',
            matchPoint: 80
          };
        }
      }catch(_){}

    }catch(e){}
  }

  function initWorldMetaIfNeeded(state){
    try{
      if (state.worldMeta && state.worldMeta._inited) return;

      state.worldMeta = {
        _inited: true,
        seedTop10: [],
        losers20: [],
        eliminated10: [],
        finalIds: [],
        losersAuto: false
      };
    }catch(e){}
  }

  function writeWorldFinalReservationToTourState(finalIds){
    try{
      const ts = getJSON(K_TS, {}) || {};
      if (!ts.world || typeof ts.world !== 'object') ts.world = {};
      ts.world.phase = 'final';
      ts.world.finalIds = (finalIds||[]).map(x=>String(x||'')).filter(Boolean).slice(0,20);
      ts.world.finalReadyAt = Date.now();
      setJSON(K_TS, ts);
      return true;
    }catch(e){
      return false;
    }
  }

  function showWorldFinalReservedAndGoMain(state, finalIds){
    try{
      writeWorldFinalReservationToTourState(finalIds);

      state.ui.rightImg = '';
      state.ui.topLeftName = '';
      state.ui.topRightName = '';

      setCenter3('FINAL進出チームが確定！', '決勝戦は来週開始！', 'NEXTでメインへ戻ります');

      try{
        if (P?.onWorldLosersFinished) P.onWorldLosersFinished(state, state.tournamentTotal);
        else if (P?.onWorldWLFinished) P.onWorldWLFinished(state, state.tournamentTotal);
        else if (window.MOBBR?.sim?.tournamentCorePost?.onWorldLosersFinished) window.MOBBR.sim.tournamentCorePost.onWorldLosersFinished(state, state.tournamentTotal);
        else if (window.MOBBR?.sim?.tournamentCorePost?.onWorldWLFinished) window.MOBBR.sim.tournamentCorePost.onWorldWLFinished(state, state.tournamentTotal);
      }catch(_){}

      setRequest('showNationalNotice', {
        qualified: true,
        line1: 'FINAL進出チームが確定！',
        line2: '決勝戦は来週開始！',
        line3: 'NEXTでメインへ'
      });

      state.phase = 'world_final_reserved_wait_end';
      return true;
    }catch(e){
      return false;
    }
  }

  // =========================================================
  // ✅ WORLD FINAL マッチポイント（80pt点灯→次試合以降のチャンピオンで優勝）
  // =========================================================
  const WORLD_FINAL_MATCH_POINT = 80;

  function ensureWorldFinalMP(state){
    try{
      if (!state.worldFinalMP || typeof state.worldFinalMP !== 'object'){
        state.worldFinalMP = { litAtMatch:{}, winnerId:'', matchPoint: WORLD_FINAL_MATCH_POINT };
      }
      if (!state.worldFinalMP.litAtMatch || typeof state.worldFinalMP.litAtMatch !== 'object'){
        state.worldFinalMP.litAtMatch = {};
      }
      if (!Number.isFinite(Number(state.worldFinalMP.matchPoint))){
        state.worldFinalMP.matchPoint = WORLD_FINAL_MATCH_POINT;
      }
    }catch(_){}
  }

  function getThisMatchChampionId(state){
    try{
      const rows = state?.lastMatchResultRows;
      if (Array.isArray(rows) && rows.length){
        const top = rows[0];
        if (top && top.id) return String(top.id);
        if (top && top.teamId) return String(top.teamId);
      }
    }catch(_){}
    return '';
  }

  function updateWorldFinalLitByTotals(state){
    try{
      ensureWorldFinalMP(state);
      const mp = Number(state.worldFinalMP.matchPoint||WORLD_FINAL_MATCH_POINT);
      const mIdx = Number(state.matchIndex||1);

      const total = state.tournamentTotal || {};
      for (const k of Object.keys(total)){
        const t = total[k];
        if (!t) continue;
        const id = String(t.id||k||'');
        if (!id) continue;

        const sum = Number(t.sumTotal||0);
        if (sum >= mp){
          if (state.worldFinalMP.litAtMatch[id] == null){
            state.worldFinalMP.litAtMatch[id] = mIdx;
          }
        }
      }
    }catch(_){}
  }

  function checkWorldFinalWinnerByRule(state){
    try{
      ensureWorldFinalMP(state);

      const champId = getThisMatchChampionId(state);
      if (!champId) return '';

      const litAt = state.worldFinalMP.litAtMatch[champId];
      const mIdx = Number(state.matchIndex||1);

      if (litAt != null && Number.isFinite(Number(litAt)) && mIdx > Number(litAt)){
        return champId;
      }
      return '';
    }catch(_){
      return '';
    }
  }

  function getOverallTopId(state){
    try{
      const list = Object.values(state.tournamentTotal||{}).filter(Boolean);
      list.sort((a,b)=>{
        const at = Number(a.sumTotal||0), bt = Number(b.sumTotal||0);
        if (bt !== at) return bt - at;
        const ap = Number(a.sumPlacementP||0), bp = Number(b.sumPlacementP||0);
        if (bp !== ap) return bp - ap;
        const ak = Number(a.sumKP||0), bk = Number(b.sumKP||0);
        if (bk !== ak) return bk - ak;
        const aa = Number(a.sumAP||0), ba = Number(b.sumAP||0);
        if (ba !== aa) return ba - aa;
        return String(a.id||'').localeCompare(String(b.id||''));
      });
      return list[0]?.id ? String(list[0].id) : '';
    }catch(_){
      return '';
    }
  }

  // =========================================================
  // ✅ v5.4: WORLD FINAL ログ強化 helpers
  // =========================================================
  function resolveTeamNameById(state, id){
    const tid = String(id||'');
    if (!tid) return '???';

    try{
      const teams = Array.isArray(state?.teams) ? state.teams : [];
      for (const t of teams){
        if (!t) continue;
        if (String(t.id||'') === tid){
          if (t.name) return String(t.name);
          return tid;
        }
      }
    }catch(_){}

    try{
      const defs = state?.national?.allTeamDefs || null;
      if (defs && defs[tid]){
        const d = defs[tid];
        if (d?.name) return String(d.name);
      }
    }catch(_){}

    return tid;
  }

  function getNewlyLitIdsThisMatch(state){
    try{
      ensureWorldFinalMP(state);
      const mIdx = Number(state.matchIndex||1);

      if (!state._worldFinalLitAnnounced || typeof state._worldFinalLitAnnounced !== 'object'){
        state._worldFinalLitAnnounced = {};
      }

      const out = [];
      const lit = state.worldFinalMP.litAtMatch || {};
      for (const id of Object.keys(lit)){
        const at = Number(lit[id]);
        if (!Number.isFinite(at)) continue;
        if (at !== mIdx) continue;

        if (state._worldFinalLitAnnounced[id] === true) continue;
        out.push(String(id));
      }

      return out;
    }catch(_){
      return [];
    }
  }

  function markLitAnnounced(state, ids){
    try{
      if (!state._worldFinalLitAnnounced || typeof state._worldFinalLitAnnounced !== 'object'){
        state._worldFinalLitAnnounced = {};
      }
      for (const id of (ids||[])){
        const s = String(id||'');
        if (!s) continue;
        state._worldFinalLitAnnounced[s] = true;
      }
    }catch(_){}
  }

  function buildLitNamesLine(state, ids){
    const names = (ids||[]).map(id=>resolveTeamNameById(state, id)).filter(Boolean);
    if (!names.length) return '';
    if (names.length <= 3) return names.join(' / ');
    return `${names.slice(0,3).join(' / ')} / …`;
  }

  // =========================================================
  // ✅ base を T に公開（step側が参照）
  // =========================================================
  T._stepBase = {
    // core refs
    T, L, P,

    // shortcuts
    getPlayer, aliveTeams,
    ensureTeamRuntimeShape,
    setRequest, setCenter3,
    getPlayerSkin, getAreaInfo,
    applyEventForTeam, initMatchDrop,
    fastForwardToMatchEnd, finishMatchAndBuildResult, startNextMatch, resolveOneBattle,

    _setNationalBanners, _getSessionKey, _markSessionDone, _sessionHasPlayer, _autoRunNationalSession,

    // helpers
    K_TS, getJSON, setJSON,
    initTotalForIds,
    cpuLootRollOncePerRound,
    getChampionNameSafe,
    ensureMatchResultRows,
    ensureCurrentOverallRows,

    resolveFullMatchToEndAfterPlayerEliminated,
    setWorldBanners,

    computeRankedIdsFromTotal,
    buildFallbackTeamDef,
    swapTeamsToIds,
    initWorldMetaIfNeeded,
    writeWorldFinalReservationToTourState,
    showWorldFinalReservedAndGoMain,

    WORLD_FINAL_MATCH_POINT,
    ensureWorldFinalMP,
    updateWorldFinalLitByTotals,
    checkWorldFinalWinnerByRule,
    getOverallTopId,

    resolveTeamNameById,
    getNewlyLitIdsThisMatch,
    markLitAnnounced,
    buildLitNamesLine
  };

})();
