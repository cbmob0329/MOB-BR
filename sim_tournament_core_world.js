'use strict';

/* =========================================================
   sim_tournament_core_step.world.js（FULL） v1.2
   - sim_tournament_core_step.js から自動読込される world専用 step 分離
   - 親ファイル名は変更しない

   ✅ v1.2（今回）
      - FIX: WORLD FINAL の総合RESULT後、NEXTで停止しやすい問題を修正
      - FIX: 点灯通知（world_final_lit_notice_wait）後に
             match_result_done へ戻さず、そのまま次試合 or 最終処理へ進める
      - FIX: WORLD FINAL の post-result 分岐を一本化して
             同じRESULT/NOTICEループに入りにくくする
      - 既存の WORLD Qual / Losers / Final の大枠仕様は維持
========================================================= */

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){

  const S = window.MOBBR?.sim?._tcoreStepWorldShared;
  if (!S){
    console.error('[tournament_core_step.world] shared not loaded');
    return;
  }

  const {
    T, B,

    getPlayer,
    setRequest,
    setCenter3,
    getAreaInfo,

    fastForwardToMatchEnd,
    finishMatchAndBuildResult,
    startNextMatch,

    _setNationalBanners,
    _getSessionKey,
    _markSessionDone,
    _sessionHasPlayer,
    _autoRunNationalSession,

    ensureMatchResultRows,
    ensureCurrentOverallRows,

    setWorldBanners,
    computeRankedIdsFromTotal,
    swapTeamsToIds,
    initWorldMetaIfNeeded,
    showWorldFinalReservedAndGoMain,

    WORLD_FINAL_MATCH_POINT,
    ensureWorldFinalMP,
    updateWorldFinalLitByTotals,
    checkWorldFinalWinnerByRule,
    getOverallTopId,

    resolveTeamNameById,
    getNewlyLitIdsThisMatch,
    markLitAnnounced,
    buildLitNamesLine,

    _getPlayerOverallRank,
    _showThreeLineNotice
  } = S;

  function _getTeamByIdSafe(state, teamId){
    const id = String(teamId || '');
    if (!id) return null;
    try{
      if (Array.isArray(state?.teams)){
        const t = state.teams.find(x => String(x?.id) === id);
        if (t) return t;
      }
    }catch(_){}
    return null;
  }

  function _getMemberNamesByTeamId(state, teamId){
    const t = _getTeamByIdSafe(state, teamId);
    if (t && Array.isArray(t.members) && t.members.length){
      const names = t.members
        .map(m => String(m?.name || '').trim())
        .filter(Boolean)
        .slice(0, 3);
      if (names.length) return names;
    }
    return [];
  }

  function _buildWorldQualArrivalLines(state){
    const s = state.national || {};
    const si = Number(s.sessionIndex || 0);
    const sc = Number(s.sessionCount || 6);
    const key = String(s.sessions?.[si]?.key || `S${si+1}`);
    return [
      'ワールドファイナル開幕！',
      'とうとう来たね世界大会。まずは予選リーグ突破を目指して頑張ろう！',
      `予選 SESSION ${key} (${si+1}/${sc})`
    ];
  }

  function _buildWorldLosersArrivalLines(){
    return [
      'LOSERSリーグ開幕！',
      'ここからが本当の崖っぷち。',
      '上位10チームが決勝へ！まだまだ諦めないで！'
    ];
  }

  function _buildWorldFinalArrivalLines(state){
    ensureWorldFinalMP(state);
    const mp = Number(state.worldFinalMP?.matchPoint || WORLD_FINAL_MATCH_POINT);
    return [
      'いよいよワールドファイナル決勝！',
      `${mp}ポイントで点灯し、点灯状態のチャンピオンで優勝！`,
      `試合は最大${Number(state.matchCount || 12)}試合続きます！`
    ];
  }

  function _buildWorldQualDropLines(state, info, contested){
    const s = state.national || {};
    const si = Number(s.sessionIndex || 0);
    const sc = Number(s.sessionCount || 6);

    return {
      a: `${info.name}に到着！`,
      b: contested ? '初動から世界の強豪と接触！' : `予選 SESSION ${si+1}/${sc} 開始！`,
      c: contested ? '被った…序盤から勝負だ！' : 'まずは上位10を目指そう！'
    };
  }

  function _buildWorldLosersDropLines(info, contested){
    return {
      a: `${info.name}に到着！`,
      b: contested ? 'LOSERS初動から接敵！' : 'LOSERSリーグ開始！',
      c: contested ? 'ここで負ければ終わりだ！' : '上位10に残って決勝へ進もう！'
    };
  }

  function _buildWorldFinalDropLines(state, info, contested){
    ensureWorldFinalMP(state);
    const mp = Number(state.worldFinalMP?.matchPoint || WORLD_FINAL_MATCH_POINT);

    return {
      a: `${info.name}に到着！`,
      b: contested ? 'FINAL初動から火花が散る！' : 'いよいよ世界王者決定戦！',
      c: contested ? '点灯候補との接触に注意！' : `${mp}pt点灯 → 点灯状態でチャンピオンなら優勝！`
    };
  }

  function _buildWorldQualNoticeByRank(rank){
    if (rank >= 1 && rank <= 10){
      return {
        line1: '決勝確定！',
        line2: '世界一が見えて来た！',
        line3: 'この勢いで最後まで行こう！'
      };
    }
    if (rank >= 11 && rank <= 30){
      return {
        line1: 'LOSERSへ！',
        line2: 'まだまだ諦めないで！',
        line3: 'ここから這い上がろう！'
      };
    }
    return {
      line1: `${rank}位で終了！`,
      line2: `世界${rank}位！自信を持って！`,
      line3: ''
    };
  }

  function _buildWorldLosersNoticeByRank(rank){
    if (rank >= 1 && rank <= 10){
      return {
        line1: '決勝へ！',
        line2: 'これが最後の戦いだよ！',
        line3: 'WORLD FINALへ進出！'
      };
    }
    return {
      line1: '惜しくもここで敗退！',
      line2: '世界の壁は厚いね。',
      line3: 'また頑張ろう！'
    };
  }

  function _buildWorldFinalFinishNotice(state){
    const rank = _getPlayerOverallRank(state);

    if (rank === 1){
      return {
        line1: 'やったね！世界一だよ！世界一！',
        line2: '賞金何に使うのかな？',
        line3: 'とにかくおめでとう！世界王者！'
      };
    }
    if (rank >= 2 && rank <= 9){
      return {
        line1: `今回は${rank}位でフィニッシュ！`,
        line2: `世界${rank}位。`,
        line3: 'よく頑張ったね！'
      };
    }
    return {
      line1: `${rank}位で世界大会終了！`,
      line2: '本当にお疲れ様！',
      line3: ''
    };
  }

  function _goWorldFinalNextMatch(state){
    startNextMatch();

    state.ui.bg = 'tent.png';
    state.ui.squareBg = 'tent.png';
    state.ui.leftImg = S.getPlayerSkin();
    state.ui.rightImg = '';
    state.ui.topLeftName = '';
    state.ui.topRightName = '';

    setWorldBanners(state, '');
    setCenter3('次の試合へ', `FINAL  MATCH ${state.matchIndex} / ${state.matchCount}`, '世界王者を決める戦いは続く！');
    setRequest('nextMatch', { matchIndex: state.matchIndex });
    state.phase = 'coach_done';
    return true;
  }

  function _goWorldFinalTopCandidateNotice(state){
    const topId = getOverallTopId(state);
    if (topId){
      state.worldFinalMP.winnerId = topId;
    }

    const topName = resolveTeamNameById(state, state.worldFinalMP.winnerId || topId || '');
    state._worldFinalWinnerName = topName;
    state._worldFinalWinnerId = String(state.worldFinalMP.winnerId || topId || '');

    _showThreeLineNotice(state, {
      line1: 'WORLD FINAL 終了！',
      line2: `世界一候補：${topName}`,
      line3: 'NEXTで世界一発表！'
    }, { qualified: true });

    state.phase = 'world_final_winner_notice_wait';
    return true;
  }

  function _processWorldFinalAfterResult(state, opts){
    const options = opts || {};
    const skipLitCheck = !!options.skipLitCheck;

    ensureWorldFinalMP(state);
    try{ ensureCurrentOverallRows(state); }catch(_){}
    try{ ensureMatchResultRows(state); }catch(_){}

    updateWorldFinalLitByTotals(state);

    if (!skipLitCheck){
      const newlyLit = getNewlyLitIdsThisMatch(state);
      if (Array.isArray(newlyLit) && newlyLit.length){
        markLitAnnounced(state, newlyLit);

        const lineNames = buildLitNamesLine(state, newlyLit);
        const oneName = resolveTeamNameById(state, newlyLit[0]);

        const line1 = (newlyLit.length === 1)
          ? `${oneName}が点灯！`
          : '複数チームが点灯！';

        const line2 = (newlyLit.length === 1)
          ? `${oneName}が80ptに到達！`
          : `点灯：${lineNames}`;

        const line3 = '点灯した次の試合以降にチャンピオンで優勝！';

        _showThreeLineNotice(state, { line1, line2, line3 }, { qualified: true });
        state.phase = 'world_final_lit_notice_wait';
        return true;
      }
    }

    const winnerId = checkWorldFinalWinnerByRule(state);
    if (winnerId){
      state.worldFinalMP.winnerId = winnerId;

      const wName = resolveTeamNameById(state, winnerId);
      const members = _getMemberNamesByTeamId(state, winnerId);

      state._worldFinalWinnerName = wName;
      state._worldFinalWinnerId = winnerId;

      _showThreeLineNotice(state, {
        line1: `${wName}が点灯状態でチャンピオンを獲得！`,
        line2: 'この瞬間、世界一のチームが決定！',
        line3: members.length ? `メンバーは ${members.join('、')}！` : 'NEXTで世界一発表！'
      }, { qualified: true });

      state.phase = 'world_final_winner_notice_wait';
      return true;
    }

    if (Number(state.matchIndex || 0) < Number(state.matchCount || 0)){
      return _goWorldFinalNextMatch(state);
    }

    return _goWorldFinalTopCandidateNotice(state);
  }

  // =========================================================
  // world intro
  // =========================================================
  function handleWorldIntro(state){
    const wp = String(state.worldPhase || 'qual');
    const s = state.national || {};
    const si = Number(s.sessionIndex || 0);
    const sc = Number(s.sessionCount || 6);
    const key = String(s.sessions?.[si]?.key || `S${si+1}`);

    if (wp === 'qual'){
      const lines = _buildWorldQualArrivalLines(state);
      setCenter3(lines[0], lines[1], lines[2]);

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
        return true;
      }

      setRequest('showIntroText', {});
      state.phase = 'teamList';
      return true;
    }

    if (wp === 'losers'){
      const lines = _buildWorldLosersArrivalLines();
      setCenter3(lines[0], lines[1], lines[2]);
      setRequest('showIntroText', {});
      state.phase = 'teamList';
      return true;
    }

    if (wp === 'eliminated'){
      setCenter3('WORLD 予選 敗退…', '', '');
      setRequest('showIntroText', {});
      state.phase = 'teamList';
      return true;
    }

    const lines = _buildWorldFinalArrivalLines(state);
    setCenter3(lines[0], lines[1], lines[2]);
    setRequest('showIntroText', {});
    state.phase = 'teamList';
    return true;
  }

  function handleWorldTeamListDone(state){
    const wp = String(state.worldPhase || 'qual');

    if (wp === 'qual'){
      setCenter3('それでは試合を開始します！', '上位10が決勝確定、11〜30位はLOSERSへ！', '');
      setRequest('showIntroText', {});
      state.phase = 'coach_done';
      return true;
    }

    if (wp === 'losers'){
      setCenter3('それでは試合を開始します！', '上位10チームがFINALへ！', '');
      setRequest('showIntroText', {});
      state.phase = 'coach_done';
      return true;
    }

    if (wp === 'final'){
      setCenter3('それでは試合を開始します！', '点灯状態のチャンピオンで世界一！', '');
      setRequest('showIntroText', {});
      state.phase = 'coach_done';
      return true;
    }

    return false;
  }

  function handleWorldDropLand(state){
    const p2 = getPlayer();
    const info = getAreaInfo(p2?.areaId || 1);
    const contested = !!state.playerContestedAtDrop;
    const wp = String(state.worldPhase || 'qual');

    if (wp === 'qual'){
      const lines = _buildWorldQualDropLines(state, info, contested);
      setCenter3(lines.a, lines.b, lines.c);
      return true;
    }

    if (wp === 'losers'){
      const lines = _buildWorldLosersDropLines(info, contested);
      setCenter3(lines.a, lines.b, lines.c);
      return true;
    }

    if (wp === 'final'){
      const lines = _buildWorldFinalDropLines(state, info, contested);
      setCenter3(lines.a, lines.b, lines.c);
      return true;
    }

    return false;
  }

  // =========================================================
  // world phase router
  // =========================================================
  function handleWorldPhase(state){

    // ✅ WORLD FINAL 点灯 notice → NEXTでそのまま次試合 or 最終処理へ
    if (state.phase === 'world_final_lit_notice_wait'){
      return _processWorldFinalAfterResult(state, { skipLitCheck:true });
    }

    // ✅ WORLD FINAL 優勝 notice → NEXTで世界一発表(showChampion)
    if (state.phase === 'world_final_winner_notice_wait'){
      const champName = String(state._worldFinalWinnerName || '???');
      const champId = String(state._worldFinalWinnerId || '');
      const members = _getMemberNamesByTeamId(state, champId);
      const memberLine = members.length ? `メンバーは ${members.join('、')}！` : 'おめでとう！';

      state.ui.rightImg = '';
      state.ui.topLeftName = '';
      state.ui.topRightName = '';

      setCenter3('世界王者は', `${champName}！`, memberLine);
      setRequest('showChampion', {
        matchIndex: state.matchIndex,
        championName: champName,
        worldChampion: true,
        isWorldFinal: true,
        log1: `${champName}が点灯状態でチャンピオンを獲得！`,
        log2: 'この瞬間、世界一のチームが決定！',
        log3: memberLine
      });

      state.phase = 'world_final_worldchamp_show';
      return true;
    }

    // ✅ 世界一発表の次 → 総合RESULTへ
    if (state.phase === 'world_final_worldchamp_show'){
      setRequest('showTournamentResult', { total: state.tournamentTotal });
      state.phase = 'world_total_result_wait_post';
      return true;
    }

    // ✅ World FINAL 総合RESULT後 → 最終順位通知 → post
    if (state.phase === 'world_total_result_wait_post'){
      _showThreeLineNotice(
        state,
        _buildWorldFinalFinishNotice(state),
        { qualified: (_getPlayerOverallRank(state) === 1) }
      );
      state.phase = 'world_final_finish_notice_wait_end';
      return true;
    }

    if (state.phase === 'world_final_finish_notice_wait_end'){
      try{
        if (S.P?.onWorldFinalFinished) S.P.onWorldFinalFinished(state, state.tournamentTotal);
        else if (window.MOBBR?.sim?.tournamentCorePost?.onWorldFinalFinished) window.MOBBR.sim.tournamentCorePost.onWorldFinalFinished(state, state.tournamentTotal);
      }catch(e){
        console.error('[tournament_core] world post error:', e);
      }
      state.phase = 'done';
      setRequest('endTournament', {});
      return true;
    }

    // ✅ Losers終了→Final予約表示の次 → 終了
    if (state.phase === 'world_final_reserved_wait_end'){
      state.phase = 'done';
      setRequest('endTournament', {});
      return true;
    }

    // ✅ WORLD予選 31〜40位 敗退表示 → 次のNEXTで終了
    if (state.phase === 'world_eliminated_wait_end'){
      state.phase = 'done';
      setRequest('endTournament', {});
      return true;
    }

    // ✅ WORLD FINAL: 各試合の総合RESULT表示後 → 点灯/優勝判定/次試合
    if (state.phase === 'world_final_match_total_result_wait_next'){
      return _processWorldFinalAfterResult(state, { skipLitCheck:false });
    }

    // ✅ WORLD LOSERS: 各試合の総合RESULT表示後 → 次試合 or Losers終了分岐
    if (state.phase === 'world_losers_match_total_result_wait_next'){
      if (state.matchIndex < state.matchCount){
        startNextMatch();

        state.ui.bg = 'tent.png';
        state.ui.squareBg = 'tent.png';
        state.ui.leftImg = S.getPlayerSkin();
        state.ui.rightImg = '';
        state.ui.topLeftName = '';
        state.ui.topRightName = '';

        setWorldBanners(state, '');
        setCenter3('次の試合へ', `LOSERS  MATCH ${state.matchIndex} / ${state.matchCount}`, 'まだまだ諦めないで！');
        setRequest('nextMatch', { matchIndex: state.matchIndex });
        state.phase = 'coach_done';
        return true;
      }

      state.phase = 'world_losers_total_result_wait_branch';
      setRequest('noop', {});
      return true;
    }

    // ✅ WORLD QUAL: 各試合の総合RESULT表示後 → 次試合 or WORLD予選分岐
    if (state.phase === 'world_qual_match_total_result_wait_next'){
      const nat = state.national || {};
      const si = Number(nat.sessionIndex||0);
      const sc = Number(nat.sessionCount||6);

      if (state.matchIndex < state.matchCount){
        startNextMatch();

        state.ui.bg = 'tent.png';
        state.ui.squareBg = 'tent.png';
        state.ui.leftImg = S.getPlayerSkin();
        state.ui.rightImg = '';
        state.ui.topLeftName = '';
        state.ui.topRightName = '';

        setWorldBanners(state, '');
        setCenter3('次の試合へ', `MATCH ${state.matchIndex} / ${state.matchCount}`, 'まずは予選突破を目指そう！');
        setRequest('nextMatch', { matchIndex: state.matchIndex });
        state.phase = 'coach_done';
        return true;
      }

      const isLastSession = (si >= sc - 1);

      if (isLastSession){
        state.phase = 'world_qual_total_result_wait_branch';
        setRequest('noop', {});
        return true;
      }

      state.phase = 'national_session_total_result_wait_notice';
      setRequest('noop', {});
      return true;
    }

    // ✅ WORLD 予選総合RESULTの次（分岐前に順位通知）
    if (state.phase === 'world_qual_total_result_wait_branch'){
      initWorldMetaIfNeeded(state);

      const ranked = computeRankedIdsFromTotal(state.tournamentTotal);
      const top10 = ranked.slice(0,10);
      const mid20 = ranked.slice(10,30);
      const bot10 = ranked.slice(30,40);

      state.worldMeta.seedTop10 = top10.slice(0,10);
      state.worldMeta.losers20 = mid20.slice(0,20);
      state.worldMeta.eliminated10 = bot10.slice(0,10);

      try{
        if (S.P?.onWorldQualFinished) S.P.onWorldQualFinished(state, state.tournamentTotal);
        else if (window.MOBBR?.sim?.tournamentCorePost?.onWorldQualFinished) window.MOBBR.sim.tournamentCorePost.onWorldQualFinished(state, state.tournamentTotal);
      }catch(e){}

      const playerId = 'PLAYER';
      const pr = ranked.indexOf(playerId) + 1;
      const playerRank = pr > 0 ? pr : 999;

      state._worldQualPlayerRank = playerRank;

      if (playerRank >= 31){
        state.worldPhase = 'eliminated';

        _showThreeLineNotice(state, _buildWorldQualNoticeByRank(playerRank), { qualified: false });
        state.phase = 'world_eliminated_wait_end';
        return true;
      }

      if (playerRank <= 10){
        _showThreeLineNotice(state, _buildWorldQualNoticeByRank(playerRank), { qualified: true });
        state.phase = 'world_qual_top10_notice_wait_branch';
        return true;
      }

      _showThreeLineNotice(state, _buildWorldQualNoticeByRank(playerRank), { qualified: false });
      state.phase = 'world_qual_losers_notice_wait_branch';
      return true;
    }

    // ✅ WORLD予選 1〜10位通知後 → losersをAUTO処理してFinal確定へ
    if (state.phase === 'world_qual_top10_notice_wait_branch'){
      state.worldMeta.losersAuto = true;

      state.worldPhase = 'losers';
      swapTeamsToIds(state, state.worldMeta.losers20);
      state.matchCount = 5;

      try{
        for (let i=0; i<5; i++){
          try{ fastForwardToMatchEnd(); }catch(_){}
          try{ finishMatchAndBuildResult(); }catch(_){}
          try{ ensureMatchResultRows(state); }catch(_){}
          try{ ensureCurrentOverallRows(state); }catch(_){}
          if (i < 4){
            try{ startNextMatch(); }catch(_){}
          }
        }
      }catch(_){}

      setRequest('showTournamentResult', { total: state.tournamentTotal });
      state.phase = 'world_losers_total_result_wait_branch';
      return true;
    }

    // ✅ WORLD予選 11〜30位通知後 → Losersへ（通常進行）
    if (state.phase === 'world_qual_losers_notice_wait_branch'){
      state.worldMeta.losersAuto = false;
      state.worldPhase = 'losers';
      swapTeamsToIds(state, state.worldMeta.losers20);

      state.matchCount = 5;
      state.phase = 'intro';
      setRequest('noop', {});
      return true;
    }

    // ✅ WORLD Losers総合RESULTの次（Final確定前に通知）
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

      const playerRank = ranked.indexOf('PLAYER') + 1;
      state._worldLosersPlayerRank = playerRank > 0 ? playerRank : 999;

      _showThreeLineNotice(state, _buildWorldLosersNoticeByRank(state._worldLosersPlayerRank), {
        qualified: (state._worldLosersPlayerRank >= 1 && state._worldLosersPlayerRank <= 10)
      });
      state.phase = 'world_losers_finish_notice_wait_branch';
      return true;
    }

    if (state.phase === 'world_losers_finish_notice_wait_branch'){
      if (showWorldFinalReservedAndGoMain(state, state.worldMeta.finalIds)){
        return true;
      }

      state.worldPhase = 'final';
      swapTeamsToIds(state, state.worldMeta.finalIds);
      state.matchCount = 12;
      state.phase = 'intro';
      setRequest('noop', {});
      return true;
    }

    return false;
  }

  // =========================================================
  // world match_result_done router
  // =========================================================
  function handleWorldMatchResultDone(state){
    const wp = String(state.worldPhase || 'qual');

    if (wp === 'final'){
      setRequest('showTournamentResult', { total: state.tournamentTotal });
      state.phase = 'world_final_match_total_result_wait_next';
      return true;
    }

    if (wp === 'losers'){
      setRequest('showTournamentResult', { total: state.tournamentTotal });

      if (state.matchIndex < state.matchCount){
        state.phase = 'world_losers_match_total_result_wait_next';
      }else{
        state.phase = 'world_losers_total_result_wait_branch';
      }
      return true;
    }

    if (wp === 'qual'){
      const nat = state.national || {};
      const si = Number(nat.sessionIndex||0);
      const sc = Number(nat.sessionCount||6);
      const isLastSession = (si >= sc - 1);

      setRequest('showTournamentResult', { total: state.tournamentTotal });

      if (state.matchIndex < state.matchCount){
        state.phase = 'world_qual_match_total_result_wait_next';
        return true;
      }

      if (isLastSession){
        state.phase = 'world_qual_total_result_wait_branch';
        return true;
      }

      state.phase = 'national_session_total_result_wait_notice';
      return true;
    }

    return false;
  }

  window.MOBBR.sim._tcoreStepWorld = {
    handleWorldPhase,
    handleWorldIntro,
    handleWorldTeamListDone,
    handleWorldDropLand,
    handleWorldMatchResultDone
  };

  window.MOBBR.sim._tcoreStepWorldLoaded = true;

})();
