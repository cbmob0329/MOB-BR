'use strict';

/* =========================================================
   sim_tournament_core_step.js（FULL） v5.2
   - v5.1 の全機能維持（Local / LastChance / National / WORLD Qual+Losers は壊さない）
   - ✅ v5.1: WORLD FINAL をマッチポイント形式で成立（80pt点灯→次試合以降でCHAMP優勝）
   - ✅ v5.2: National と WORLD Qual の “A〜Dグループ戦” を 5→3試合に短縮（あなた指定）
     - National: session中の matchCount を常に 3
     - World Qual: session中の matchCount を常に 3
     - それ以外（Local/LastChance/Losers/Final）は既存通り
========================================================= */

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){

  const T = window.MOBBR?.sim?._tcore;
  if (!T){
    console.error('[tournament_core_step] shared not loaded: window.MOBBR.sim._tcore missing');
    return;
  }

  const L = T.L;
  const P = T.P;

  // step内で元の関数名を保つためのショートカット
  function getPlayer(){ return T.getPlayer(); }
  function aliveTeams(){ return T.aliveTeams(); }

  function ensureTeamRuntimeShape(t){ return T.ensureTeamRuntimeShape(t); }
  function computeCtx(){ return T.computeCtx(); }

  function setRequest(type, payload){ return T.setRequest(type, payload); }
  function setCenter3(a,b,c){ return T.setCenter3(a,b,c); }

  function getEquippedCoachList(){ return T.getEquippedCoachList(); }
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
      console.warn('[tournament_core_step] getChampionName error:', e);
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
        console.error('[tournament_core_step] ensureMatchResultRows: tournamentResult missing methods', {
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
      console.error('[tournament_core_step] ensureMatchResultRows error:', e);
      try{ state.lastMatchResultRows = []; }catch(_){}
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
      console.error('[tournament_core_step] resolveFullMatchToEndAfterPlayerEliminated error:', e);
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

  // ✅ NEW: defsに存在しないIDを受けても「0チーム化」しないための補完生成
  function buildFallbackTeamDef(id){
    const tid = String(id||'');
    const isPlayer = (tid === 'PLAYER');
    const baseMembers = isPlayer
      ? (()=>{
          try{
            // 既存のPLAYER team保存があるなら、それを尊重（壊さない）
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
      power: isPlayer ? Number(localStorage.getItem('mobbr_team_power')||66) : 55, // 無ければ55
      members: baseMembers,
      isPlayer: !!isPlayer,

      // runtime相当の初期値（ensureTeamRuntimeShapeが上書きする前提）
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

        // ✅ ここが v5.0 の核：defsに無いIDでも必ず補完して入れる
        if (!t){
          t = buildFallbackTeamDef(id);
          defs[id] = t; // 後続の resolveTeamName などでも使えるように登録
          if (state?.national && state.national.allTeamDefs) state.national.allTeamDefs = defs;
        }

        teams.push(t);
      }

      state.teams = teams.slice(0, arr.length);
      for (const t of state.teams) ensureTeamRuntimeShape(t);

      state.tournamentTotal = initTotalForIds(state.teams.map(t=>t.id));

      state.matchIndex = 1;
      state.round = 1;

      state.selectedCoachSkill = null;
      state.selectedCoachQuote = '';

      state._cpuLootRolled = {};
      state._roundMatches = null;
      state._matchCursor = 0;
      state.lastMatchResultRows = [];
      state.currentOverallRows = [];

      // ✅ v5.1: WORLD FINAL マッチポイント用の状態を初期化（壊さない：final時だけ）
      try{
        if (state.mode === 'world' && String(state.worldPhase||'') === 'final'){
          state.worldFinalMP = {
            litAtMatch: {},   // { teamId: matchIndexWhenLit }
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
        // v5.0: Top10のときLosersをAUTOで処理したか
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
    // Losers終了 → Final20確定 → 来週Final
    try{
      writeWorldFinalReservationToTourState(finalIds);

      state.ui.rightImg = '';
      state.ui.topLeftName = '';
      state.ui.topRightName = '';

      setCenter3('FINAL進出チームが確定！', '決勝戦は来週開始！', 'NEXTでメインへ戻ります');

      // post hook（互換：WLをLosersとして吸収）
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
  // ✅ v5.1: WORLD FINAL マッチポイント（80pt点灯→次試合以降のチャンピオンで優勝）
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

      // ✅ 点灯した「同じ試合」では優勝しない → mIdx > litAt
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
  // ✅ 追加: MATCH SKIP（外部から呼ぶAPI）
  // =========================================================
  function skipCurrentMatch(){
    const state = T.getState();
    if (!state) return;
    if (state.phase === 'match_result' || state.phase === 'match_result_done') return;
    state.phase = 'match_skip_fast';
  }
  T.skipCurrentMatch = skipCurrentMatch;

  // =========================================================
  // ===== main step machine ====
  // =========================================================
  function step(){
    const state = T.getState();
    if (!state) return;

    const p = getPlayer();

    // =========================================================
    // ✅ match skip fast
    // =========================================================
    if (state.phase === 'match_skip_fast'){
      try{
        const pt = getPlayer();
        if (pt){
          ensureTeamRuntimeShape(pt);
          pt.eventBuffs = { aim:-20, mental:-20, agi:-20 };
          pt.treasure = 0;
          pt.flag = 0;
        }
      }catch(_){}

      try{ fastForwardToMatchEnd(); }catch(_){}
      try{ finishMatchAndBuildResult(); }catch(_){}
      try{ ensureMatchResultRows(state); }catch(_){}

      state.ui.rightImg = '';
      state.ui.topLeftName = '';
      state.ui.topRightName = '';

      setRequest('showMatchResult', {
        matchIndex: state.matchIndex,
        matchCount: state.matchCount,
        rows: state.lastMatchResultRows,
        currentOverall: Array.isArray(state.currentOverallRows) ? state.currentOverallRows : []
      });

      state.phase = 'match_result_done';
      return;
    }

    // ✅ Local: 総合RESULTを見せたあと、次のNEXTで終了後処理 → UI閉じる
    if (state.phase === 'local_total_result_wait_post'){
      try{
        if (P?.onLocalTournamentFinished){
          P.onLocalTournamentFinished(state, state.tournamentTotal);
        }else if (window.MOBBR?.sim?.tournamentCorePost?.onLocalTournamentFinished){
          window.MOBBR.sim.tournamentCorePost.onLocalTournamentFinished(state, state.tournamentTotal);
        }
      }catch(e){
        console.error('[tournament_core] onLocalTournamentFinished error:', e);
      }
      state.phase = 'done';
      setRequest('endTournament', {});
      return;
    }

    // ✅ LastChance: 総合RESULTを見せたあと、次のNEXTで終了後処理 → UI閉じる
    if (state.phase === 'lastchance_total_result_wait_post'){
      try{
        if (P?.onLastChanceTournamentFinished){
          P.onLastChanceTournamentFinished(state, state.tournamentTotal);
        }else if (window.MOBBR?.sim?.tournamentCorePost?.onLastChanceTournamentFinished){
          window.MOBBR.sim.tournamentCorePost.onLastChanceTournamentFinished(state, state.tournamentTotal);
        }
      }catch(e){
        console.error('[tournament_core] onLastChanceTournamentFinished error:', e);
      }
      state.phase = 'done';
      setRequest('endTournament', {});
      return;
    }

    // ✅ World: FINAL後の総合RESULT → 次のNEXTで post へ
    if (state.phase === 'world_total_result_wait_post'){
      try{
        if (P?.onWorldFinalFinished) P.onWorldFinalFinished(state, state.tournamentTotal);
        else if (window.MOBBR?.sim?.tournamentCorePost?.onWorldFinalFinished) window.MOBBR.sim.tournamentCorePost.onWorldFinalFinished(state, state.tournamentTotal);
      }catch(e){
        console.error('[tournament_core] world post error:', e);
      }
      state.phase = 'done';
      setRequest('endTournament', {});
      return;
    }

    // ✅ v5.0: Losers終了→Final予約表示の次 → 終了
    if (state.phase === 'world_final_reserved_wait_end'){
      state.phase = 'done';
      setRequest('endTournament', {});
      return;
    }

    // ✅ v4.9.1: WORLD予選 31〜40位 敗退表示 → 次のNEXTで終了
    if (state.phase === 'world_eliminated_wait_end'){
      state.phase = 'done';
      setRequest('endTournament', {});
      return;
    }

    // ✅ v4.9: WORLD 予選総合RESULTの次（分岐）
    if (state.phase === 'world_qual_total_result_wait_branch'){
      initWorldMetaIfNeeded(state);

      const ranked = computeRankedIdsFromTotal(state.tournamentTotal);
      const top10 = ranked.slice(0,10);
      const mid20 = ranked.slice(10,30);  // 11-30
      const bot10 = ranked.slice(30,40);  // 31-40

      state.worldMeta.seedTop10 = top10.slice(0,10);
      state.worldMeta.losers20 = mid20.slice(0,20);
      state.worldMeta.eliminated10 = bot10.slice(0,10);

      // hook（保存用：壊さない）
      try{
        if (P?.onWorldQualFinished) P.onWorldQualFinished(state, state.tournamentTotal);
        else if (window.MOBBR?.sim?.tournamentCorePost?.onWorldQualFinished) window.MOBBR.sim.tournamentCorePost.onWorldQualFinished(state, state.tournamentTotal);
      }catch(e){}

      const playerId = 'PLAYER';
      const pr = ranked.indexOf(playerId) + 1;
      const playerRank = pr > 0 ? pr : 999;

      // 31〜40位 → 敗退（終了）
      if (playerRank >= 31){
        state.worldPhase = 'eliminated';

        state.ui.rightImg = '';
        state.ui.topLeftName = '';
        state.ui.topRightName = '';

        setCenter3('WORLD 予選 敗退…', `総合順位：${playerRank}位`, '31〜40位は敗退');
        setRequest('showNationalNotice', {
          qualified: false,
          line1: 'WORLD 予選 敗退…',
          line2: `総合順位：${playerRank}位`,
          line3: 'NEXTで終了'
        });

        state.phase = 'world_eliminated_wait_end';
        return;
      }

      // ✅ v5.0: 1-10でも「この週はLosersをAUTO処理してFinal確定」へ
      if (playerRank <= 10){
        state.worldMeta.losersAuto = true;

        // Losers roster 20（11-30を採用）で切替だけ行う（表示はしない）
        state.worldPhase = 'losers';
        swapTeamsToIds(state, state.worldMeta.losers20);
        state.matchCount = 5;

        // AUTOで5試合を即解決→総合resultへ
        try{
          for (let i=0; i<5; i++){
            try{ fastForwardToMatchEnd(); }catch(_){}
            try{ finishMatchAndBuildResult(); }catch(_){}
            try{ ensureMatchResultRows(state); }catch(_){}
            if (i < 4){
              try{ startNextMatch(); }catch(_){}
            }
          }
        }catch(_){}

        setRequest('showTournamentResult', { total: state.tournamentTotal });
        state.phase = 'world_losers_total_result_wait_branch';
        return;
      }

      // 11〜30位 → Losersへ（通常進行）
      state.worldMeta.losersAuto = false;
      state.worldPhase = 'losers';
      swapTeamsToIds(state, state.worldMeta.losers20);

      state.matchCount = 5;
      state.phase = 'intro';
      setRequest('noop', {});
      return;
    }

    // ✅ v5.0: WORLD Losers総合RESULTの次（Final確定→来週予約）
    if (state.phase === 'world_losers_total_result_wait_branch'){
      initWorldMetaIfNeeded(state);

      const ranked = computeRankedIdsFromTotal(state.tournamentTotal);
      const top10 = ranked.slice(0,10);

      const finalIds = [];
      const pushU = (id)=>{
        const s = String(id||'');
        if (!s) return;
        if (finalIds.includes(s)) return;
        finalIds.push(s);
      };
      for (const id of (state.worldMeta.seedTop10||[])) pushU(id);
      for (const id of top10) pushU(id);

      state.worldMeta.finalIds = finalIds.slice(0,20);

      if (showWorldFinalReservedAndGoMain(state, state.worldMeta.finalIds)){
        return;
      }

      state.worldPhase = 'final';
      swapTeamsToIds(state, state.worldMeta.finalIds);
      state.matchCount = 12;
      state.phase = 'intro';
      setRequest('noop', {});
      return;
    }

    // ✅ National: 最終総合RESULT後 → 次のNEXTで post（あれば）→ 無ければ endNationalWeek
    if (state.phase === 'national_total_result_wait_post'){
      let handled = false;

      try{
        if (P?.onNationalTournamentFinished){
          P.onNationalTournamentFinished(state, state.tournamentTotal);
          handled = true;
        }else if (window.MOBBR?.sim?.tournamentCorePost?.onNationalTournamentFinished){
          window.MOBBR.sim.tournamentCorePost.onNationalTournamentFinished(state, state.tournamentTotal);
          handled = true;
        }
      }catch(e){
        console.error('[tournament_core] onNationalTournamentFinished error:', e);
      }

      state.phase = 'done';

      if (handled){
        setRequest('endTournament', {});
      }else{
        setRequest('endNationalWeek', { weeks: 1 });
      }
      return;
    }

    // ✅ National: AUTOセッション開始表示
    if (state.phase === 'national_auto_session_wait_run'){
      const nat = state.national || {};
      const si = Number(nat.sessionIndex||0);
      const key = _getSessionKey(si) || `S${si+1}`;

      _autoRunNationalSession();
      _markSessionDone(key);

      const label = String((nat.sessions?.[si]?.groups || []).join(' & ') || key);
      setRequest('showAutoSessionDone', {
        sessionKey: key,
        line1: '全試合終了！',
        line2: '現在の総合ポイントはこちら！',
        line3: 'NEXTでRESULT表示',
        title: '全試合終了！',
        sub: '現在の総合ポイントはこちら！',
        sessionLabel: label
      });
      state.phase = 'national_auto_session_done_wait_result';
      return;
    }

    // ✅ National: AUTOセッション完了表示の次 → 総合RESULT表示
    if (state.phase === 'national_auto_session_done_wait_result'){
      const nat = state.national || {};
      const si = Number(nat.sessionIndex||0);
      const sc = Number(nat.sessionCount||6);
      const isLastSession = (si >= sc - 1);

      setRequest('showTournamentResult', { total: state.tournamentTotal });

      if (state.mode === 'world' && String(state.worldPhase||'qual') === 'qual' && isLastSession){
        state.phase = 'world_qual_total_result_wait_branch';
        return;
      }

      if (isLastSession){
        state.phase = 'national_total_result_wait_post';
      }else{
        state.phase = 'national_session_total_result_wait_notice';
      }
      return;
    }

    // ✅ National: セッションごとの総合RESULT表示後
    if (state.phase === 'national_session_total_result_wait_notice'){
      const nat = state.national || {};
      const si = Number(nat.sessionIndex||0);
      const sc = Number(nat.sessionCount||6);

      const curKey  = String(nat.sessions?.[si]?.key || `S${si+1}`);
      const isLastSession = (si >= sc - 1);

      if (isLastSession){
        if (state.mode === 'world' && String(state.worldPhase||'qual') === 'qual'){
          state.phase = 'world_qual_total_result_wait_branch';
          setRequest('noop', {});
          return;
        }

        state.phase = 'national_total_result_wait_post';
        setRequest('noop', {});
        return;
      }

      const nextKey = String(nat.sessions?.[si+1]?.key || `S${si+2}`);

      _markSessionDone(curKey);

      setRequest('showNationalNotice', {
        qualified: false,
        line1: `SESSION ${curKey} 終了！`,
        line2: `次：SESSION ${nextKey} へ`,
        line3: 'NEXTで進行'
      });
      state.phase = 'national_notice_wait_next_session';
      return;
    }

    // ✅ National: Notice後 → 次セッションへ組み替え
    if (state.phase === 'national_notice_wait_next_session'){
      const nat = state.national || {};
      const si = Number(nat.sessionIndex||0);
      const sc = Number(nat.sessionCount||6);

      if (si >= sc - 1){
        state.phase = 'national_total_result_wait_post';
        setRequest('noop', {});
        return;
      }

      const nextIndex = si + 1;
      nat.sessionIndex = nextIndex;
      state.national = nat;

      const plan = nat.plan;
      const defs = nat.allTeamDefs;

      state.teams = T._buildTeamsForNationalSession(defs, plan, nextIndex);

      state.matchIndex = 1;
      state.round = 1;

      state.selectedCoachSkill = null;
      state.selectedCoachQuote = '';

      state.phase = 'intro';
      setRequest('noop', {});
      return;
    }

    if (state.phase === 'done'){
      setRequest('noop', {});
      return;
    }

    // ===== intro =====
    if (state.phase === 'intro'){

      // ===========================
      // ✅ v5.2: matchCount 固定（壊さない：introでだけ上書き）
      // ===========================
      // National（A〜D）: 3試合
      if (state.mode === 'national'){
        state.matchCount = 3;
      }
      // World Qual（A〜D）: 3試合
      if (state.mode === 'world' && String(state.worldPhase||'qual') === 'qual'){
        state.matchCount = 3;
      }
      // それ以外は触らない（Local=5 / LastChance=5 / Losers=5 / Final=12）

      if (state.mode === 'national'){
        _setNationalBanners();
      }else if (state.mode === 'lastchance'){
        state.bannerLeft = 'ラストチャンス';
        state.bannerRight = '20チーム';
      }else if (state.mode === 'world'){
        setWorldBanners(state, '');
      }else{
        state.bannerLeft = 'ローカル大会';
        state.bannerRight = '20チーム';
      }

      state.ui.bg = 'maps/neonmain.png';
      state.ui.squareBg = 'tent.png';

      state.ui.leftImg = getPlayerSkin();
      state.ui.rightImg = '';
      state.ui.topLeftName = '';
      state.ui.topRightName = '';

      if (state.mode === 'national'){
        const s = state.national || {};
        const si = Number(s.sessionIndex||0);
        const sc = Number(s.sessionCount||6);
        const key = String(s.sessions?.[si]?.key || `S${si+1}`);
        setCenter3('ナショナルリーグ開幕！', `SESSION ${key} (${si+1}/${sc})`, '');

        if (!_sessionHasPlayer(si)){
          _setNationalBanners();
          state.bannerRight = `AUTO SESSION ${key}`;

          const groups = s.sessions?.[si]?.groups || [];
          const label = groups.length === 2 ? `${groups[0]} & ${groups[1]}` : key;

          setRequest('showAutoSession', {
            sessionKey: key,
            line1: `${label} 試合進行中..`,
            line2: '',
            line3: 'NEXTで進行',
            title: `${label} 試合進行中..`,
            sub: ''
          });
          state.phase = 'national_auto_session_wait_run';
          return;
        }
      }else if (state.mode === 'world'){
        const wp = String(state.worldPhase||'qual');
        const s = state.national || {};
        const si = Number(s.sessionIndex||0);
        const sc = Number(s.sessionCount||6);
        const key = String(s.sessions?.[si]?.key || `S${si+1}`);

        if (wp === 'qual'){
          setCenter3('ワールドファイナル予選 開幕！', `SESSION ${key} (${si+1}/${sc})`, '総合順位で決着！');
        }else if (wp === 'losers'){
          setCenter3('LOSERSリーグ 開幕！', '20チーム / 5試合', '上位10がFINALへ！');
        }else if (wp === 'eliminated'){
          setCenter3('WORLD 予選 敗退…', '', '');
        }else{
          ensureWorldFinalMP(state);
          const mp = Number(state.worldFinalMP?.matchPoint||WORLD_FINAL_MATCH_POINT);
          setCenter3('FINAL ROUND 開始！', `${mp}ptで点灯（マッチポイント）`, '点灯した次の試合以降にチャンピオンで優勝‼︎');
        }

        if (wp === 'qual'){
          if (!_sessionHasPlayer(si)){
            setWorldBanners(state, `AUTO SESSION ${key}`);

            const groups = s.sessions?.[si]?.groups || [];
            const label = groups.length === 2 ? `${groups[0]} & ${groups[1]}` : key;

            setRequest('showAutoSession', {
              sessionKey: key,
              line1: `${label} 試合進行中..`,
              line2: '',
              line3: 'NEXTで進行',
              title: `${label} 試合進行中..`,
              sub: ''
            });
            state.phase = 'national_auto_session_wait_run';
            return;
          }
        }
      }else if (state.mode === 'lastchance'){
        setCenter3('ラストチャンス開幕！', '上位2チームがワールド出場！', '');
      }else{
        setCenter3('本日のチームをご紹介！', '', '');
      }

      setRequest('showIntroText', {});
      state.phase = 'teamList';
      return;
    }

    // ===== team list =====
    if (state.phase === 'teamList'){
      setCenter3('', '', '');
      setRequest('showTeamList', { teams: state.teams.map(t=>( {
        id:t.id, name:t.name, power:t.power, alive:t.alive, eliminated:t.eliminated, treasure:t.treasure, flag:t.flag, isPlayer:!!t.isPlayer
      }))});
      state.phase = 'teamList_done';
      return;
    }

    // ===== coach select =====
    if (state.phase === 'teamList_done'){
      setCenter3('それでは試合を開始します！', '使用するコーチスキルを選択してください！', '');
      setRequest('showCoachSelect', {
        equipped: getEquippedCoachList(),
        master: L.COACH_MASTER
      });
      state.phase = 'coach_done';
      return;
    }

    // ===== match start =====
    if (state.phase === 'coach_done'){
      initMatchDrop();

      if (state.mode === 'national'){
        _setNationalBanners();
        state.bannerRight = '降下';
      }else if (state.mode === 'world'){
        setWorldBanners(state, '降下');
      }else{
        state.bannerLeft = `MATCH ${state.matchIndex} / 5`;
        state.bannerRight = '降下';
      }

      state.ui.leftImg = getPlayerSkin();
      state.ui.rightImg = '';
      state.ui.topLeftName = '';
      state.ui.topRightName = '';

      state.ui.bg = 'tent.png';
      state.ui.squareBg = 'tent.png';

      setCenter3('バトルスタート！', '降下開始…！', '');
      setRequest('showDropStart', {});
      state.phase = 'drop_land';
      return;
    }

    // ===== landed =====
    if (state.phase === 'drop_land'){
      const p2 = getPlayer();
      const info = getAreaInfo(p2?.areaId || 1);
      state.ui.bg = info.img;

      const contested = !!state.playerContestedAtDrop;
      setCenter3(`${info.name}に降下完了。周囲を確認…`, contested ? '被った…敵影がいる！' : '周囲は静かだ…', 'IGLがコール！戦闘準備！');

      state.ui.rightImg = '';
      state.ui.topLeftName = '';
      state.ui.topRightName = '';

      setRequest('showDropLanded', { areaId: info.id, areaName: info.name, bg: info.img, contested });
      state.phase = 'round_start';
      state.round = 1;
      return;
    }

    // ===== round start =====
    if (state.phase === 'round_start'){
      const r = state.round;

      if (state.mode === 'national'){
        _setNationalBanners();
        state.bannerRight = `ROUND ${r}`;
      }else if (state.mode === 'world'){
        setWorldBanners(state, `ROUND ${r}`);
      }else{
        state.bannerLeft = `MATCH ${state.matchIndex} / 5`;
        state.bannerRight = `ROUND ${r}`;
      }

      state.ui.rightImg = '';
      state.ui.topLeftName = '';
      state.ui.topRightName = '';

      setCenter3(`Round ${r} 開始！`, '', '');
      setRequest('showRoundStart', { round: r });

      state.phase = 'round_events';
      state._eventsToShow = L.eventCount(r);
      return;
    }

    // ===== events =====
    if (state.phase === 'round_events'){
      const r = state.round;

      cpuLootRollOncePerRound(state, r);

      if (L.eventCount(r) === 0){
        state.phase = 'round_battles';
        return step();
      }

      if (!p || p.eliminated){
        state.phase = 'round_battles';
        return step();
      }

      const remain = Number(state._eventsToShow||0);
      if (remain <= 0){
        state.phase = 'round_battles';
        return step();
      }

      const ev = applyEventForTeam(p);
      state._eventsToShow = remain - 1;

      state.ui.rightImg = '';
      state.ui.topLeftName = '';
      state.ui.topRightName = '';

      if (ev){
        setCenter3(ev.log1, ev.log2, ev.log3);
        setRequest('showEvent', { icon: ev.icon, log1: ev.log1, log2: ev.log2, log3: ev.log3 });
      }else{
        setCenter3('イベント発生！', '……', '');
        setRequest('showEvent', { icon: '', log1:'イベント発生！', log2:'……', log3:'' });
      }
      return;
    }

    // ===== prepare battles =====
    if (state.phase === 'round_battles'){
      const r = state.round;

      const matches = L.buildMatchesForRound(state, r, getPlayer, aliveTeams);
      state._roundMatches = matches.map(([A,B])=>({ aId:A.id, bId:B.id }));
      state._matchCursor = 0;

      setRequest('prepareBattles', { round: r, slots: L.battleSlots(r), matches: state._roundMatches });
      state.phase = 'battle_one';
      return;
    }

    // ===== battle loop =====
    if (state.phase === 'battle_one'){
      const r = state.round;
      const list = Array.isArray(state._roundMatches) ? state._roundMatches : [];
      let cur = Number(state._matchCursor||0);

      while (cur < list.length){
        const pair = list[cur];
        const A = state.teams.find(t=>t.id===pair.aId);
        const B = state.teams.find(t=>t.id===pair.bId);

        if (!A || !B){
          cur++;
          continue;
        }

        const playerIn = (A.isPlayer || B.isPlayer);
        if (playerIn){
          state._matchCursor = cur;

          const me = A.isPlayer ? A : B;
          const foe = A.isPlayer ? B : A;

          state.ui.leftImg = getPlayerSkin();
          state.ui.rightImg = `${foe.id}.png`;
          state.ui.topLeftName = me.name;
          state.ui.topRightName = foe.name;

          setCenter3('接敵‼︎', `${me.name} vs ${foe.name}‼︎`, '交戦スタート‼︎');
          setRequest('showEncounter', {
            meId: me.id, foeId: foe.id,
            meName: me.name, foeName: foe.name,
            foeTeamId: foe.id,
            foePower: Number(foe.power||0),
            round: r,
            matchIndex: state.matchIndex,

            meMembers: Array.isArray(me.members) ? me.members.slice(0,3) : [],
            foeMembers: Array.isArray(foe.members) ? foe.members.slice(0,3) : []
          });

          state.phase = 'battle_resolve';
          return;
        }

        resolveOneBattle(A, B, r);
        cur++;
      }

      state._matchCursor = cur;
      state.phase = (r <= 5) ? 'round_move' : 'match_result';
      return step();
    }

    // ===== resolve player battle =====
    if (state.phase === 'battle_resolve'){
      const r = state.round;
      const list = Array.isArray(state._roundMatches) ? state._roundMatches : [];
      const cur = Number(state._matchCursor||0);
      const pair = list[cur];

      if (!pair){
        state.phase = (r <= 5) ? 'round_move' : 'match_result';
        return step();
      }

      const A = state.teams.find(t=>t.id===pair.aId);
      const B = state.teams.find(t=>t.id===pair.bId);

      if (!A || !B){
        state._matchCursor = cur + 1;
        state.phase = 'battle_one';
        return step();
      }

      const playerIn = (A.isPlayer || B.isPlayer);
      if (!playerIn){
        resolveOneBattle(A, B, r);
        state._matchCursor = cur + 1;
        state.phase = 'battle_one';
        return step();
      }

      const me = A.isPlayer ? A : B;
      const foe = A.isPlayer ? B : A;

      const res = resolveOneBattle(A, B, r);
      const iWon = res ? (res.winnerId === me.id) : false;

      state.ui.leftImg = getPlayerSkin();
      state.ui.rightImg = `${foe.id}.png`;
      state.ui.topLeftName = me.name;
      state.ui.topRightName = foe.name;

      setRequest('showBattle', {
        round: r,
        meId: me.id, foeId: foe.id,
        meName: me.name, foeName: foe.name,
        foeTeamId: foe.id,
        foePower: Number(foe.power||0),
        win: iWon,
        final: (r===6),
        holdMs: 2000,

        meMembers: Array.isArray(me.members) ? me.members.slice(0,3) : [],
        foeMembers: Array.isArray(foe.members) ? foe.members.slice(0,3) : []
      });

      if (!iWon && me.eliminated){
        try{ state.lastMatchResultRows = []; }catch(_){}
        try{ state.currentOverallRows = Array.isArray(state.currentOverallRows) ? state.currentOverallRows : []; }catch(_){}

        resolveFullMatchToEndAfterPlayerEliminated(state);
        try{ fastForwardToMatchEnd(); }catch(_){}

        const championName = getChampionNameSafe(state);

        state._afterBattleGo = { type:'champion', championName };
        state.phase = 'battle_after';
        return;
      }

      state._afterBattleGo = { type:'nextBattle' };
      state.phase = 'battle_after';
      return;
    }

    // ===== after battle =====
    if (state.phase === 'battle_after'){
      const cur = Number(state._matchCursor||0);
      const go = state._afterBattleGo || { type:'nextBattle' };
      state._afterBattleGo = null;

      if (go.type === 'champion'){
        state.ui.rightImg = '';
        state.ui.topLeftName = '';
        state.ui.topRightName = '';

        setCenter3(`この試合のチャンピオンは`, String(go.championName || '???'), '‼︎');
        setRequest('showChampion', {
          matchIndex: state.matchIndex,
          championName: String(go.championName || '')
        });

        state.phase = 'match_result';
        return;
      }

      state._matchCursor = cur + 1;
      state.phase = 'battle_one';
      setRequest('noop', {});
      return;
    }

    // ===== move =====
    if (state.phase === 'round_move'){
      const r = state.round;

      const p3 = getPlayer();
      const before = p3 ? getAreaInfo(p3.areaId) : null;

      L.moveAllTeamsToNextRound(state, r);

      const p4 = getPlayer();
      const after = p4 ? getAreaInfo(p4.areaId) : null;

      state.ui.bg = 'ido.png';
      state.ui.leftImg = getPlayerSkin();

      state.ui.rightImg = '';
      state.ui.topLeftName = '';
      state.ui.topRightName = '';

      setCenter3('', '', '');
      setRequest('showMove', {
        fromAreaId: before?.id || 0,
        toAreaId: after?.id || 0,
        toAreaName: after?.name || '',
        toBg: after?.img || '',
        holdMs: 0
      });

      state.phase = 'round_move_done';
      return;
    }

    if (state.phase === 'round_move_done'){
      state.round += 1;
      state.phase = (state.round <= 6) ? 'round_start' : 'match_result';
      setRequest('noop', {});
      return;
    }

    // ===== match result =====
    if (state.phase === 'match_result'){
      finishMatchAndBuildResult();
      ensureMatchResultRows(state);

      state.ui.rightImg = '';
      state.ui.topLeftName = '';
      state.ui.topRightName = '';

      setRequest('showMatchResult', {
        matchIndex: state.matchIndex,
        matchCount: state.matchCount,
        rows: state.lastMatchResultRows,
        currentOverall: Array.isArray(state.currentOverallRows) ? state.currentOverallRows : []
      });

      state.phase = 'match_result_done';
      return;
    }

    // ===== match result done =====
    if (state.phase === 'match_result_done'){

      // LOCAL
      if (state.mode === 'local'){
        if (state.matchIndex >= state.matchCount){
          setRequest('showTournamentResult', { total: state.tournamentTotal });
          state.phase = 'local_total_result_wait_post';
          return;
        }

        startNextMatch();

        state.ui.bg = 'tent.png';
        state.ui.squareBg = 'tent.png';
        state.ui.leftImg = getPlayerSkin();
        state.ui.rightImg = '';
        state.ui.topLeftName = '';
        state.ui.topRightName = '';

        setCenter3(`次の試合へ`, `MATCH ${state.matchIndex} / 5`, '');
        setRequest('nextMatch', { matchIndex: state.matchIndex });
        state.phase = 'coach_done';
        return;
      }

      // LAST CHANCE
      if (state.mode === 'lastchance'){
        if (state.matchIndex >= state.matchCount){
          setRequest('showTournamentResult', { total: state.tournamentTotal });
          state.phase = 'lastchance_total_result_wait_post';
          return;
        }

        startNextMatch();

        state.ui.bg = 'tent.png';
        state.ui.squareBg = 'tent.png';
        state.ui.leftImg = getPlayerSkin();
        state.ui.rightImg = '';
        state.ui.topLeftName = '';
        state.ui.topRightName = '';

        setCenter3(`次の試合へ`, `MATCH ${state.matchIndex} / 5`, '');
        setRequest('nextMatch', { matchIndex: state.matchIndex });
        state.phase = 'coach_done';
        return;
      }

      // NATIONAL
      if (state.mode === 'national'){
        const nat = state.national || {};
        const si = Number(nat.sessionIndex||0);
        const sc = Number(nat.sessionCount||6);

        if (state.matchIndex < state.matchCount){
          startNextMatch();

          state.ui.bg = 'tent.png';
          state.ui.squareBg = 'tent.png';
          state.ui.leftImg = getPlayerSkin();
          state.ui.rightImg = '';
          state.ui.topLeftName = '';
          state.ui.topRightName = '';

          _setNationalBanners();
          setCenter3(`次の試合へ`, `MATCH ${state.matchIndex} / ${state.matchCount}`, '');
          setRequest('nextMatch', { matchIndex: state.matchIndex });
          state.phase = 'coach_done';
          return;
        }

        const isLastSession = (si >= sc - 1);

        setRequest('showTournamentResult', { total: state.tournamentTotal });

        if (isLastSession){
          state.phase = 'national_total_result_wait_post';
          return;
        }

        state.phase = 'national_session_total_result_wait_notice';
        return;
      }

      // WORLD
      if (state.mode === 'world'){
        const wp = String(state.worldPhase||'qual');

        // ✅ FINAL（マッチポイント制）
        if (wp === 'final'){
          ensureWorldFinalMP(state);
          updateWorldFinalLitByTotals(state);
          const winnerId = checkWorldFinalWinnerByRule(state);

          if (winnerId){
            state.worldFinalMP.winnerId = winnerId;
            setRequest('showTournamentResult', { total: state.tournamentTotal });
            state.phase = 'world_total_result_wait_post';
            return;
          }

          if (state.matchIndex < state.matchCount){
            startNextMatch();

            state.ui.bg = 'tent.png';
            state.ui.squareBg = 'tent.png';
            state.ui.leftImg = getPlayerSkin();
            state.ui.rightImg = '';
            state.ui.topLeftName = '';
            state.ui.topRightName = '';

            setWorldBanners(state, '');

            setCenter3(`次の試合へ`, `FINAL  MATCH ${state.matchIndex} / ${state.matchCount}`, '');
            setRequest('nextMatch', { matchIndex: state.matchIndex });
            state.phase = 'coach_done';
            return;
          }

          const topId = getOverallTopId(state);
          if (topId){
            state.worldFinalMP.winnerId = topId;
          }

          setRequest('showTournamentResult', { total: state.tournamentTotal });
          state.phase = 'world_total_result_wait_post';
          return;
        }

        // Losers（5試合固定）
        if (wp === 'losers'){
          if (state.matchIndex < state.matchCount){
            startNextMatch();

            state.ui.bg = 'tent.png';
            state.ui.squareBg = 'tent.png';
            state.ui.leftImg = getPlayerSkin();
            state.ui.rightImg = '';
            state.ui.topLeftName = '';
            state.ui.topRightName = '';

            setWorldBanners(state, '');

            setCenter3(`次の試合へ`, `LOSERS  MATCH ${state.matchIndex} / ${state.matchCount}`, '');
            setRequest('nextMatch', { matchIndex: state.matchIndex });
            state.phase = 'coach_done';
            return;
          }

          setRequest('showTournamentResult', { total: state.tournamentTotal });
          state.phase = 'world_losers_total_result_wait_branch';
          return;
        }

        // qual（セッション進行：v5.2で matchCount=3 に固定済み）
        if (wp === 'qual'){
          const nat = state.national || {};
          const si = Number(nat.sessionIndex||0);
          const sc = Number(nat.sessionCount||6);

          if (state.matchIndex < state.matchCount){
            startNextMatch();

            state.ui.bg = 'tent.png';
            state.ui.squareBg = 'tent.png';
            state.ui.leftImg = getPlayerSkin();
            state.ui.rightImg = '';
            state.ui.topLeftName = '';
            state.ui.topRightName = '';

            setWorldBanners(state, '');

            setCenter3(`次の試合へ`, `MATCH ${state.matchIndex} / ${state.matchCount}`, '');
            setRequest('nextMatch', { matchIndex: state.matchIndex });
            state.phase = 'coach_done';
            return;
          }

          const isLastSession = (si >= sc - 1);

          setRequest('showTournamentResult', { total: state.tournamentTotal });

          if (isLastSession){
            state.phase = 'world_qual_total_result_wait_branch';
            return;
          }

          state.phase = 'national_session_total_result_wait_notice';
          return;
        }
      }

      setRequest('showTournamentResult', { total: state.tournamentTotal });
      state.phase = 'done';
      return;
    }

    setRequest('noop', {});
  }

  // register
  T.step = step;

})();
