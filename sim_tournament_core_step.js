/* =========================================================
   sim_tournament_core_step.js（FULL） v4.8
   - v4.7 の全機能維持（削除なし）
   - ✅ v4.8 追加（WORLD WL/Losers2/Final）
     1) worldPhase='wl' で Winners/Losers/Losers2 を順番に実行（各5試合）
        - Winners：上位10→Final / 下位10→Losers2
        - Losers ：上位10→Losers2 / 下位10→敗退
        - Losers2：上位10→Final / 下位10→敗退
        - 3リーグ完了後：state.phase='world_total_result_wait_post' で onWorldWLFinished へ
     2) worldPhase='final' で MatchPoint制（80pt到達で点灯）
        - 点灯状態でチャンピオン獲得 → 即優勝 → world_total_result_wait_post へ
   ========================================================= */
'use strict';

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
  // ✅ v4.8: localStorage helper（壊さない・参照のみ）
  // =========================================================
  const K_TS = 'mobbr_tour_state';
  function getJSON(key, def){
    try{
      const raw = localStorage.getItem(key);
      if (!raw) return def;
      return JSON.parse(raw);
    }catch(e){ return def; }
  }

  // =========================================================
  // ✅ v4.8: total init（WL/Finalでリーグごとに20チーム合算を持つ）
  // - 既存仕様の total shape に合わせる（sumTotal等）
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
    // ✅ v4.6: R は固定参照しない（差し替え耐性）
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
      // ✅ ここで総合にも必ず加算（finishMatchAndBuildResult と同等の責務を再保証）
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
        // プレイヤー戦は既に終わってる前提（ここではCPU戦のみ消化する）
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
      // この関数は「プレイヤーが eliminated 確定した直後」に呼ばれる想定
      // 目的：KP/順位/チャンピオンの整合が必ず取れる状態まで CPU戦を完全に回す

      // ① まず現在ラウンドの残りCPU戦を全部解決
      const r0 = Number(state.round||1);
      const cur0 = Number(state._matchCursor||0);
      resolveAllRemainingCpuBattlesFromCursor(state, r0, cur0 + 1);

      // ② 残りラウンド（r0〜6）を最後まで回す
      //    - move → 次round → buildMatches → 全戦 resolve
      //    - イベントはプレイヤーのみなので回さない（仕様通り）
      //    - CPU Loot は従来通り入れる
      let r = r0;

      while (r <= 6){
        // r の CPU Loot（既存仕様）
        cpuLootRollOncePerRound(state, r);

        // r の battles を全消化（player除外）
        let matches = null;
        try{
          matches = L.buildMatchesForRound(state, r, getPlayer, aliveTeams) || [];
        }catch(_){
          matches = [];
        }

        // state._roundMatches を更新しておく（整合のため）
        state._roundMatches = matches.map(([A,B])=>({ aId:A.id, bId:B.id }));

        // 全戦解決（プレイヤーはもう居ないので全てCPU）
        for (const [A,B] of matches){
          if (!A || !B) continue;
          if (A.isPlayer || B.isPlayer) continue;
          resolveOneBattle(A, B, r);
        }

        if (r >= 6) break;

        // move（既存ロジックに合わせて）
        try{
          L.moveAllTeamsToNextRound(state, r);
        }catch(_){}

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
  // ✅ v4.8: WORLD WL / FINAL helpers
  // =========================================================
  function getWorldWLLeagueLabel(state){
    const wl = state.worldWL;
    if (!wl || !wl.leagues) return '';
    const idx = Number(wl.leagueIndex||0);
    const nm = String(wl.leagues?.[idx]?.name || '');
    return nm ? `${nm}リーグ` : '';
  }

  function initWorldWLStateIfNeeded(state){
    try{
      if (state.worldWL && state.worldWL._inited) return;

      // tourState から取得できるなら優先（将来拡張用）
      const ts = getJSON(K_TS, {}) || {};
      const w = ts.world || {};
      const preset = w && typeof w === 'object' ? (w.wlPreset || null) : null;

      // 予選（qual）の総合40順位がどこかに保存されていればそれを使う想定だが、
      // ここでは「壊さない」ために、無ければ現stateの allTeamDefs から basePower で暫定分割。
      let ranked40 = [];

      if (preset && Array.isArray(preset.ranked40) && preset.ranked40.length >= 40){
        ranked40 = preset.ranked40.map(x=>String(x||'')).filter(Boolean).slice(0,40);
      }else{
        // fallback: 現在の allTeamDefs から power でソート
        const defs = state?.national?.allTeamDefs || {};
        const ids = Object.keys(defs).filter(id=>id && id !== '__proto__');
        ids.sort((a,b)=>{
          const A = defs[a], B = defs[b];
          const ap = Number(A?.power || 0);
          const bp = Number(B?.power || 0);
          if (bp !== ap) return bp - ap;
          return String(a).localeCompare(String(b));
        });
        // PLAYER を含めて40に揃える（不足時はそのまま）
        ranked40 = ids.slice(0,40);
      }

      // Winners/Losers 20/20
      const winnersIds = ranked40.slice(0,20);
      const losersIds  = ranked40.slice(20,40);

      state.worldWL = {
        _inited: true,
        leagueIndex: 0, // 0:winners 1:losers 2:losers2
        leagues: [
          { key:'winners', name:'Winners', ids: winnersIds.slice(0,20) },
          { key:'losers',  name:'Losers',  ids: losersIds.slice(0,20)  },
          { key:'losers2', name:'Losers2', ids: [] } // 後で詰める
        ],
        winnersTop10: [],
        winnersBottom10: [],
        losersTop10: [],
        losersBottom10: [],
        losers2Top10: [],
        losers2Bottom10: [],
        finalIds: []
      };
    }catch(e){}
  }

  function swapTeamsToLeague20(state, ids20){
    try{
      const defs = state?.national?.allTeamDefs || {};
      const ids = (ids20||[]).map(x=>String(x||'')).filter(Boolean).slice(0,20);

      const teams = [];
      for (const id of ids){
        const t = defs[id];
        if (t) teams.push(t);
      }
      state.teams = teams.slice(0,20);
      for (const t of state.teams) ensureTeamRuntimeShape(t);

      // WLはリーグ毎に合算をリセットする（仕様：各リーグ5試合）
      state.tournamentTotal = initTotalForIds(state.teams.map(t=>t.id));

      state.matchIndex = 1;
      state.matchCount = 5;
      state.round = 1;

      state.selectedCoachSkill = null;
      state.selectedCoachQuote = '';

      // ラウンド内ロール等も安全にリセット
      state._cpuLootRolled = {};
      state._roundMatches = null;
      state._matchCursor = 0;
      state.lastMatchResultRows = [];
      state.currentOverallRows = [];
    }catch(e){}
  }

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

  function initWorldFinalStateIfNeeded(state){
    try{
      if (state.worldFinal && state.worldFinal._inited) return;

      const ts = getJSON(K_TS, {}) || {};
      const w = ts.world || {};

      let finalIds = [];
      if (w && Array.isArray(w.finalIds) && w.finalIds.length){
        finalIds = w.finalIds.map(x=>String(x||'')).filter(Boolean).slice(0,20);
      }else if (state.worldWL && Array.isArray(state.worldWL.finalIds) && state.worldWL.finalIds.length){
        finalIds = state.worldWL.finalIds.slice(0,20);
      }else{
        // fallback: 現 roster の上位20（壊さない）
        const defs = state?.national?.allTeamDefs || {};
        const ids = Object.keys(defs).filter(Boolean);
        ids.sort((a,b)=>{
          const ap = Number(defs[a]?.power||0);
          const bp = Number(defs[b]?.power||0);
          if (bp !== ap) return bp - ap;
          return String(a).localeCompare(String(b));
        });
        finalIds = ids.slice(0,20);
      }

      state.worldFinal = {
        _inited: true,
        threshold: 80,
        lit: {}, // id=>true
        finalIds: finalIds.slice(0,20),
        championId: ''
      };

      // Final は roster 20 に切り替え、合算をリセット
      swapTeamsToLeague20(state, state.worldFinal.finalIds);

      // Finalは「試合数固定ではない」ので matchCount を大きめにしておき、
      // 実際の終了は matchPoint優勝で判定する
      state.matchCount = 99;
    }catch(e){}
  }

  function updateMatchPointLit(state){
    try{
      const wf = state.worldFinal;
      if (!wf) return;

      const total = state.tournamentTotal || {};
      for (const id in total){
        const v = total[id];
        if (!v) continue;
        const sum = Number(v.sumTotal||0);
        if (sum >= Number(wf.threshold||80)){
          wf.lit[String(id)] = true;
        }
      }
    }catch(e){}
  }

  function isFinalChampionDetermined(state){
    try{
      const wf = state.worldFinal;
      if (!wf) return false;

      // 点灯更新
      updateMatchPointLit(state);

      // 今試合の1位（match result の先頭）が点灯していれば優勝
      const rows = state.lastMatchResultRows;
      if (!Array.isArray(rows) || !rows.length) return false;

      const top = rows[0];
      const topId = String(top?.id || '');
      if (!topId) return false;

      if (wf.lit[topId]){
        wf.championId = topId;
        return true;
      }
      return false;
    }catch(e){
      return false;
    }
  }

  // =========================================================
  // ===== main step machine ====
  // =========================================================
  function step(){
    const state = T.getState();
    if (!state) return;

    const p = getPlayer();

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

    // ✅ World: 予選/ WL / 決勝 の総合RESULT後 → 次のNEXTで post へ
    if (state.phase === 'world_total_result_wait_post'){
      const wp = String(state.worldPhase||'qual');
      try{
        if (wp === 'qual'){
          if (P?.onWorldQualFinished) P.onWorldQualFinished(state, state.tournamentTotal);
          else if (window.MOBBR?.sim?.tournamentCorePost?.onWorldQualFinished) window.MOBBR.sim.tournamentCorePost.onWorldQualFinished(state, state.tournamentTotal);
        }else if (wp === 'wl'){
          if (P?.onWorldWLFinished) P.onWorldWLFinished(state, state.tournamentTotal);
          else if (window.MOBBR?.sim?.tournamentCorePost?.onWorldWLFinished) window.MOBBR.sim.tournamentCorePost.onWorldWLFinished(state, state.tournamentTotal);
        }else{
          if (P?.onWorldFinalFinished) P.onWorldFinalFinished(state, state.tournamentTotal);
          else if (window.MOBBR?.sim?.tournamentCorePost?.onWorldFinalFinished) window.MOBBR.sim.tournamentCorePost.onWorldFinalFinished(state, state.tournamentTotal);
        }
      }catch(e){
        console.error('[tournament_core] world post error:', e);
      }
      state.phase = 'done';
      setRequest('endTournament', {});
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

      // =========================================================
      // ✅ v4.8: WORLD WL のリーグ間遷移（Winners→Losers→Losers2）
      // ここは「worldもnationalと同じ phase を流用している」ため、分岐で吸収する
      // =========================================================
      if (state.mode === 'world' && String(state.worldPhase||'') === 'wl'){

        // ここに入るのは「リーグ5試合終了 → showTournamentResult → このphaseへ」ルート
        initWorldWLStateIfNeeded(state);

        const wl = state.worldWL || null;
        const idx = Number(wl?.leagueIndex||0);

        if (!wl || !wl.leagues){
          // safety: 何も無ければWL終了扱い
          state.phase = 'world_total_result_wait_post';
          setRequest('noop', {});
          return;
        }

        // 直前リーグの順位を確定
        const ranked = computeRankedIdsFromTotal(state.tournamentTotal);

        if (idx === 0){
          wl.winnersTop10 = ranked.slice(0,10);
          wl.winnersBottom10 = ranked.slice(10,20);
          // Winners下位10 → Losers2 seed
          wl.leagues[2].ids = wl.winnersBottom10.slice(0,10);
        }else if (idx === 1){
          wl.losersTop10 = ranked.slice(0,10);
          wl.losersBottom10 = ranked.slice(10,20);
          // Losers上位10 → Losers2へ追加（合計20）
          const cur = Array.isArray(wl.leagues[2].ids) ? wl.leagues[2].ids.slice() : [];
          const add = wl.losersTop10.slice(0,10);
          const merged = [];
          const pushU = (id)=>{
            const s = String(id||'');
            if (!s) return;
            if (merged.includes(s)) return;
            merged.push(s);
          };
          for (const id of cur) pushU(id);
          for (const id of add) pushU(id);
          wl.leagues[2].ids = merged.slice(0,20);
        }else if (idx === 2){
          wl.losers2Top10 = ranked.slice(0,10);
          wl.losers2Bottom10 = ranked.slice(10,20);

          // Final 20 = Winners上位10 + Losers2上位10
          const finalIds = [];
          const pushU = (id)=>{
            const s = String(id||'');
            if (!s) return;
            if (finalIds.includes(s)) return;
            finalIds.push(s);
          };
          for (const id of (wl.winnersTop10||[])) pushU(id);
          for (const id of (wl.losers2Top10||[])) pushU(id);
          wl.finalIds = finalIds.slice(0,20);

          // WL全体が終わったので、ここでWL大会終了（postへ）
          state.worldWL = wl;
          state.phase = 'world_total_result_wait_post';
          setRequest('noop', {});
          return;
        }

        // 次リーグへ
        const nextIdx = idx + 1;
        wl.leagueIndex = nextIdx;
        state.worldWL = wl;

        const next = wl.leagues[nextIdx];
        const label = next ? `${next.name}` : '';

        // 次リーグの20へ切り替え
        swapTeamsToLeague20(state, next?.ids || []);

        // introへ戻して豪華演出
        state.phase = 'intro';
        setRequest('noop', {});
        return;
      }

      // =========================================================
      // 既存：National / World(qualなど)のセッション進行
      // =========================================================
      if (isLastSession){
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
      if (state.mode === 'national'){
        _setNationalBanners(); // ✅ MATCHは左上に常駐
      }else if (state.mode === 'lastchance'){
        state.bannerLeft = 'ラストチャンス';
        state.bannerRight = '20チーム';
      }else if (state.mode === 'world'){
        // ✅ MATCHは左上に常駐（WORLDも統一）
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

        // ✅ v4.8: WL / FINAL の intro 演出
        if (wp === 'wl'){
          initWorldWLStateIfNeeded(state);
          const lbl = getWorldWLLeagueLabel(state);
          const phaseTitle = lbl ? `${lbl}開始！` : 'Winnersリーグ開始！';
          setCenter3(phaseTitle, `SESSION ${key} (${si+1}/${sc})`, '上位を掴め！');
        }else if (wp === 'final'){
          initWorldFinalStateIfNeeded(state);
          setCenter3('FINAL ROUND 開始！', '80ptで点灯（マッチポイント）', '点灯→チャンピオンで優勝‼︎');
        }else{
          setCenter3('ワールドファイナル開幕！', `SESSION ${key} (${si+1}/${sc})`, '');
        }

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

        // ✅ v4.7:
        // lastMatchResultRows が前試合のまま残ると「チャンピオン名誤参照」するので必ず無効化
        try{ state.lastMatchResultRows = []; }catch(_){}
        try{ state.currentOverallRows = Array.isArray(state.currentOverallRows) ? state.currentOverallRows : []; }catch(_){}

        // ✅ v4.7:
        // ここで fastForward に丸投げせず、残りCPU戦 + 残りラウンドを確実に全解決して KP 不足を根絶
        resolveFullMatchToEndAfterPlayerEliminated(state);

        // ✅ 念のため既存fastForwardも呼ぶ（内部が他のフラグを整理している場合に備える）
        try{ fastForwardToMatchEnd(); }catch(_){}

        // ✅ ここで落ちると NEXT が死ぬので絶対に落とさない
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
      // 1) 通常の集計（既存）
      finishMatchAndBuildResult();

      // ✅ 2) v4.6: rows が空なら、その場で必ず再計算して確定（result 0行バグ潰し）
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

      // =========================================================
      // ✅ v4.8: WORLD FINAL（match point）
      // - matchCount固定ではなく、優勝条件で終了
      // - showMatchResult を見た次のNEXTがここなので、ここで判定して
      //   優勝なら showChampion → showTournamentResult → postへ
      // =========================================================
      if (state.mode === 'world' && String(state.worldPhase||'') === 'final'){
        initWorldFinalStateIfNeeded(state);

        const wf = state.worldFinal || null;
        if (wf){
          const decided = isFinalChampionDetermined(state);

          if (decided){
            // champion表示（この大会の優勝）
            const champId = String(wf.championId || '');
            const defs = state?.national?.allTeamDefs || {};
            const champName = defs[champId]?.name || champId || '???';

            // 次のNEXT死防止：lastMatchResultRows 誤参照を避ける
            try{ state.lastMatchResultRows = []; }catch(_){}
            try{ state.currentOverallRows = Array.isArray(state.currentOverallRows) ? state.currentOverallRows : []; }catch(_){}

            state.ui.rightImg = '';
            state.ui.topLeftName = '';
            state.ui.topRightName = '';

            setCenter3('WORLD FINAL 優勝‼︎', String(champName), '‼︎');
            setRequest('showChampion', {
              matchIndex: state.matchIndex,
              championName: String(champName || '')
            });

            // FINAL はここで大会終了へ
            setRequest('showTournamentResult', { total: state.tournamentTotal });
            state.phase = 'world_total_result_wait_post';
            return;
          }

          // まだ優勝者無し → 次の試合へ（matchIndex増）
          startNextMatch();

          state.ui.bg = 'tent.png';
          state.ui.squareBg = 'tent.png';
          state.ui.leftImg = getPlayerSkin();
          state.ui.rightImg = '';
          state.ui.topLeftName = '';
          state.ui.topRightName = '';

          // MATCH表示更新
          setWorldBanners(state, '');

          // 点灯状況ログ（軽い表示：UI側が未対応でも壊さない）
          const litCount = Object.keys(wf.lit||{}).length;
          setCenter3(`次の試合へ`, `MATCH ${state.matchIndex}`, litCount ? `点灯：${litCount}チーム` : 'まだ点灯なし');
          setRequest('nextMatch', { matchIndex: state.matchIndex });
          state.phase = 'coach_done';
          return;
        }
      }

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
        const nat = state.national || {};
        const si = Number(nat.sessionIndex||0);
        const sc = Number(nat.sessionCount||6);

        // =========================================================
        // ✅ v4.8: WORLD WL（各リーグ5試合固定）
        // - matchIndex=5終了 → showTournamentResult → league遷移（上のphaseで処理）
        // =========================================================
        if (wp === 'wl'){
          initWorldWLStateIfNeeded(state);

          if (state.matchIndex < state.matchCount){
            startNextMatch();

            state.ui.bg = 'tent.png';
            state.ui.squareBg = 'tent.png';
            state.ui.leftImg = getPlayerSkin();
            state.ui.rightImg = '';
            state.ui.topLeftName = '';
            state.ui.topRightName = '';

            // ✅ 次試合へ進むタイミングで bannerLeft を必ず更新（MATCH表記の正確性保証）
            setWorldBanners(state, '');

            const lbl = getWorldWLLeagueLabel(state);
            setCenter3(`次の試合へ`, lbl ? `${lbl}  MATCH ${state.matchIndex} / ${state.matchCount}` : `MATCH ${state.matchIndex} / ${state.matchCount}`, '');
            setRequest('nextMatch', { matchIndex: state.matchIndex });
            state.phase = 'coach_done';
            return;
          }

          // リーグ5試合終了 → RESULTへ
          setRequest('showTournamentResult', { total: state.tournamentTotal });
          state.phase = 'national_session_total_result_wait_notice';
          return;
        }

        // =========================================================
        // 既存：WORLD qual（ナショナル同様のセッション進行）
        // =========================================================
        if (state.matchIndex < state.matchCount){
          startNextMatch();

          state.ui.bg = 'tent.png';
          state.ui.squareBg = 'tent.png';
          state.ui.leftImg = getPlayerSkin();
          state.ui.rightImg = '';
          state.ui.topLeftName = '';
          state.ui.topRightName = '';

          // ✅ 次試合へ進むタイミングで bannerLeft を必ず更新（MATCH表記の正確性保証）
          setWorldBanners(state, '');

          setCenter3(`次の試合へ`, `MATCH ${state.matchIndex} / ${state.matchCount}`, '');
          setRequest('nextMatch', { matchIndex: state.matchIndex });
          state.phase = 'coach_done';
          return;
        }

        const isLastSession = (si >= sc - 1);

        setRequest('showTournamentResult', { total: state.tournamentTotal });

        if (isLastSession){
          state.phase = 'world_total_result_wait_post';
          return;
        }

        state.phase = 'national_session_total_result_wait_notice';
        return;
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
