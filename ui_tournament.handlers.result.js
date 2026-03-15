'use strict';

/* =========================================================
   ui_tournament.handlers.result.js（v3.7.2 split-2b）FULL
   - result / notice / end / nextMatch 専用
   - ui_tournament.handlers.js から自動読込される前提
   - ✅ v3.6.17 の「途中総合RESULTで報酬/結果コメントが出ない」修正を維持
   - ✅ v3.7.1
      - FIX: ワールドファイナル予選リーグ / losers で賞金が表示されるバグを修正
      - 対応: 賞金・最終大会結果コメントは「大会終了時のみ」表示
      - WORLD予選 / losers の途中分岐 result では報酬表示しない
   - ✅ v3.7.2（今回）
      - FIX: ラストチャンスで賞金が表示されるバグを修正
      - 対応: 賞金表示は Local / National / WORLD FINAL の大会終了時のみ
      - LastChance は順位コメントのみ表示、報酬表示なし
========================================================= */

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){

  const MOD = window.MOBBR.ui._tournamentMod;
  const SHARED = window.MOBBR.ui._tournamentHandlersShared;

  if (!MOD){
    console.error('[ui_tournament.handlers.result] core module missing');
    return;
  }
  if (!SHARED){
    console.error('[ui_tournament.handlers.result] shared module missing');
    return;
  }

  const {
    lockUI, unlockUI,
    setChampionMode, setResultStampMode,
    hidePanels, hideSplash,
    setEventIcon, showCenterStamp,
    resetEncounterGate, clearHold, setHold,
    setBattleMode,
    setBackdrop, setSquareBg,
    setLines, showSplash, showPanel, escapeHtml,
    syncSessionBar,
    getState,
    getMatchTotalFromState,
    TOURNEY_BACKDROP, ASSET
  } = MOD;

  const {
    dispatchGoMainFromPayload,
    normMode,
    normWorldPhase,
    getPlayerRankFromPayloadRows,
    getNoticeLines
  } = SHARED;

  // =========================================================
  // helpers
  // =========================================================
  function buildCurrentOverallTable(rows){
    const wrap = document.createElement('div');
    wrap.className = 'overallWrap';

    const table = document.createElement('table');
    table.className = 'tourneyTable';
    table.innerHTML = `
      <thead>
        <tr>
          <th>RANK</th>
          <th>TEAM</th>
          <th class="num">PT</th>
          <th class="num">PP</th>
          <th class="num">K</th>
          <th class="num">A</th>
          <th class="num">TRE</th>
          <th class="num">FLG</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tb = table.querySelector('tbody');

    (rows||[]).forEach((r,i)=>{
      const tr = document.createElement('tr');
      const isPlayer = (String(r.id||'') === 'PLAYER') || !!r.isPlayer;
      if (isPlayer) tr.classList.add('isPlayer');

      tr.innerHTML = `
        <td>${escapeHtml(String(i+1))}</td>
        <td>${escapeHtml(String(r.name || r.squad || r.id || ''))}</td>
        <td class="num">${escapeHtml(String(r.total ?? 0))}</td>
        <td class="num">${escapeHtml(String(r.placementP ?? 0))}</td>
        <td class="num">${escapeHtml(String(r.kp ?? 0))}</td>
        <td class="num">${escapeHtml(String(r.ap ?? 0))}</td>
        <td class="num">${escapeHtml(String(r.treasure ?? 0))}</td>
        <td class="num">${escapeHtml(String(r.flag ?? 0))}</td>
      `;
      tb.appendChild(tr);
    });

    wrap.appendChild(table);
    return wrap;
  }

  function getPlayerRankFromTotalRows(totalArr){
    const arr = Array.isArray(totalArr) ? totalArr : [];
    const idx = arr.findIndex(r => String(r?.id || '') === 'PLAYER');
    return idx >= 0 ? (idx + 1) : 0;
  }

  function isStageEndTournamentResult(st){
    const phase = String(st?.phase || '').trim().toLowerCase();

    // ローカル大会終了
    if (phase === 'local_total_result_wait_post') return true;

    // ナショナル大会終了
    if (phase === 'national_total_result_wait_post') return true;

    // WORLD FINAL のみ大会終了扱い
    if (phase === 'world_total_result_wait_post') return true;

    return false;
  }

  function shouldShowRewardBox(st){
    const phase = String(st?.phase || '').trim().toLowerCase();

    if (phase === 'local_total_result_wait_post') return true;
    if (phase === 'national_total_result_wait_post') return true;
    if (phase === 'world_total_result_wait_post') return true;

    return false;
  }

  function shouldShowTournamentMessageBox(st){
    return isStageEndTournamentResult(st);
  }

  function getQualLineByState(st){
    const mode = String(st?.mode || '').toLowerCase();
    const wp = String(st?.worldPhase || st?.phase || '').toLowerCase();

    if (mode === 'local') return { line: 10, label: 'TOP10通過' };
    if (mode === 'national') return { line: 8, label: 'TOP8通過' };
    if (mode === 'lastchance') return { line: 2, label: 'TOP2通過' };

    if (mode === 'world'){
      if (wp === 'qual') return { line: 10, label: 'TOP10通過' };
      if (wp === 'losers') return { line: 10, label: 'TOP10通過' };
      if (wp === 'final') return { line: 0, label: '' };
      if (wp === 'eliminated') return { line: 0, label: '' };
    }
    return { line: 0, label: '' };
  }

  function getWorldFinalLitSet(st){
    try{
      const mp = st?.worldFinalMP;
      const lit = mp?.litAtMatch;
      if (!lit || typeof lit !== 'object') return new Set();
      const s = new Set();
      for (const k of Object.keys(lit)){
        const id = String(k||'');
        if (!id) continue;
        s.add(id);
      }
      return s;
    }catch(_){
      return new Set();
    }
  }

  function applyRowHighlight(tr, opts){
    if (!tr) return;

    if (opts?.qualified){
      tr.classList.add('isQualified');
      tr.style.background = 'rgba(80, 200, 120, 0.12)';
    }
    if (opts?.cut){
      tr.classList.add('isCut');
      tr.style.opacity = '0.72';
    }
    if (opts?.lit){
      tr.classList.add('isLit');
      tr.style.background = 'rgba(255, 215, 0, 0.14)';
      tr.style.boxShadow = 'inset 0 0 0 1px rgba(255, 215, 0, 0.35)';
    }
  }

  function fmtGold(n){
    const v = Number(n || 0);
    return `${v.toLocaleString('ja-JP')}G`;
  }

  function fmtRankUp(n){
    const v = Number(n || 0);
    return `+${v}`;
  }

  function resolvePlayerFinalRankFromTotal(total){
    const arr = Array.isArray(total) ? total : Object.values(total || {});
    const idx = arr.findIndex(r => String(r?.id || '') === 'PLAYER');
    return idx >= 0 ? (idx + 1) : 0;
  }

  function getRewardInfoFromState(st, totalArr){
    try{
      const last = st?.lastTournamentReward;
      if (last && typeof last === 'object'){
        const gold = Number(last.gold || 0);
        const rankUp = Number(last.rankUp || 0);
        const rank = Number(last.rank || 0) || resolvePlayerFinalRankFromTotal(totalArr);
        return { rank, gold, rankUp };
      }
    }catch(_){}

    try{
      const rank = resolvePlayerFinalRankFromTotal(totalArr);
      const R = window.MOBBR?.sim?.tournamentResult;
      if (R && typeof R.getTournamentReward === 'function'){
        const rw = R.getTournamentReward(st?.mode, rank) || {};
        return {
          rank,
          gold: Number(rw.gold || 0),
          rankUp: Number(rw.rankUp || 0)
        };
      }
    }catch(_){}

    return { rank:0, gold:0, rankUp:0 };
  }

  function buildRewardBox(st, totalArr){
    if (!shouldShowRewardBox(st)) return null;

    const info = getRewardInfoFromState(st, totalArr);
    const rank = Number(info.rank || 0);
    const gold = Number(info.gold || 0);
    const rankUp = Number(info.rankUp || 0);

    const isRewarded = (gold > 0 || rankUp > 0);
    if (!isRewarded) return null;

    const wrap = document.createElement('div');
    wrap.className = 'coachHint';
    wrap.style.marginTop = '10px';
    wrap.style.padding = '12px';
    wrap.style.borderRadius = '12px';
    wrap.style.border = '1px solid rgba(255,255,255,.14)';
    wrap.style.background = 'rgba(255,215,0,.08)';
    wrap.style.lineHeight = '1.45';

    const title = document.createElement('div');
    title.style.fontWeight = '1000';
    title.style.fontSize = '13px';
    title.textContent = 'PLAYER 報酬';
    wrap.appendChild(title);

    const body = document.createElement('div');
    body.style.marginTop = '6px';
    body.style.fontSize = '12px';
    body.style.opacity = '0.95';
    body.innerHTML = `
      最終順位：${escapeHtml(String(rank))}位<br>
      賞金：${escapeHtml(fmtGold(gold))}<br>
      企業ランク：${escapeHtml(fmtRankUp(rankUp))}
    `;
    wrap.appendChild(body);

    return wrap;
  }

  function buildTournamentResultMessage(st, totalArr){
    const mode = normMode(st);
    const wp = normWorldPhase(st);
    const rank = getPlayerRankFromTotalRows(totalArr);

    if (!rank) return null;

    if (mode === 'local'){
      if (rank === 1){
        return {
          title: 'ローカル大会結果',
          lines: [
            'やったね！1位でナショナル大会へ進出を決めたよ！',
            '自信を持って次へ備えよう！'
          ]
        };
      }
      if (rank >= 2 && rank <= 5){
        return {
          title: 'ローカル大会結果',
          lines: [
            '上位で突破！',
            '次はナショナル大会！',
            'しっかり準備しよう！'
          ]
        };
      }
      if (rank >= 6 && rank <= 9){
        return {
          title: 'ローカル大会結果',
          lines: [
            'なんとかナショナル出場権を獲得！',
            '頑張るぞ！'
          ]
        };
      }
      if (rank === 10){
        return {
          title: 'ローカル大会結果',
          lines: [
            'ボーダーでナショナル出場権を獲得！',
            '危なかった..'
          ]
        };
      }
      return {
        title: 'ローカル大会結果',
        lines: [
          `今回のローカル大会は${rank}位で終了。`,
          '次のシーズンに備えよう！'
        ]
      };
    }

    if (mode === 'national'){
      if (rank === 1){
        return {
          title: 'ナショナル大会結果',
          lines: [
            'やったー！1位でワールドファイナル進出を決めたよ！',
            '最高の形で世界へ！'
          ]
        };
      }
      if (rank >= 2 && rank <= 8){
        return {
          title: 'ナショナル大会結果',
          lines: [
            '世界大会決定！',
            'やったね！'
          ]
        };
      }
      if (rank >= 9 && rank <= 28){
        return {
          title: 'ナショナル大会結果',
          lines: [
            '突破ならず。',
            'でもラストチャンスの権利を手に入れた！',
            '最後まで諦めないで！'
          ]
        };
      }
      return {
        title: 'ナショナル大会結果',
        lines: [
          `今回のナショナル大会は${rank}位で終了。`,
          '次のシーズンに備えよう！'
        ]
      };
    }

    if (mode === 'lastchance'){
      if (rank === 1){
        return {
          title: 'ラストチャンス結果',
          lines: [
            'やったー！1位でワールドファイナル進出を決めたよ！',
            '世界一が見えて来た！'
          ]
        };
      }
      if (rank === 2){
        return {
          title: 'ラストチャンス結果',
          lines: [
            '2位で突破！',
            'やったね！',
            '帰ってトレーニングだ！'
          ]
        };
      }
      return {
        title: 'ラストチャンス結果',
        lines: [
          `${rank}位で終了。`,
          'また次のシーズンで頑張ろう！'
        ]
      };
    }

    if (mode === 'world' && wp === 'final'){
      if (rank === 1){
        return {
          title: 'WORLD FINAL 結果',
          lines: [
            'やったね！世界一だよ！世界一！',
            '賞金何に使うのかな？',
            'とにかくおめでとう！',
            '世界王者！'
          ]
        };
      }
      if (rank >= 2 && rank <= 9){
        return {
          title: 'WORLD FINAL 結果',
          lines: [
            `今回は${rank}位でフィニッシュ！`,
            `世界${rank}位。`,
            'よく頑張ったね！'
          ]
        };
      }
      return {
        title: 'WORLD FINAL 結果',
        lines: [
          `${rank}位で世界大会終了！`,
          '本当にお疲れ様！'
        ]
      };
    }

    return null;
  }

  function buildTournamentMessageBox(st, totalArr){
    if (!shouldShowTournamentMessageBox(st)) return null;

    const info = buildTournamentResultMessage(st, totalArr);
    if (!info) return null;

    const wrap = document.createElement('div');
    wrap.className = 'coachHint';
    wrap.style.marginTop = '10px';
    wrap.style.padding = '12px';
    wrap.style.borderRadius = '12px';
    wrap.style.border = '1px solid rgba(255,255,255,.14)';
    wrap.style.background = 'rgba(255,255,255,.07)';
    wrap.style.lineHeight = '1.55';

    const title = document.createElement('div');
    title.style.fontWeight = '1000';
    title.style.fontSize = '13px';
    title.style.marginBottom = '6px';
    title.textContent = String(info.title || '大会結果');
    wrap.appendChild(title);

    const body = document.createElement('div');
    body.style.fontSize = '12px';
    body.style.opacity = '0.97';
    body.innerHTML = (Array.isArray(info.lines) ? info.lines : [])
      .map(x => escapeHtml(String(x || '')))
      .join('<br>');
    wrap.appendChild(body);

    return wrap;
  }

  // =========================================================
  // handlers
  // =========================================================
  async function handleShowMatchResult(payload){
    lockUI();
    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels();
      hideSplash();
      showCenterStamp('');
      setEventIcon('');
      resetEncounterGate();
      setHold('showMatchResult');
      setBattleMode(false);

      setBackdrop(TOURNEY_BACKDROP);
      setSquareBg(ASSET.tent);

      const srcRows = Array.isArray(payload?.rows) ? payload.rows : [];

      const wrap = document.createElement('div');
      wrap.className = 'resultWrap';

      const table = document.createElement('table');
      table.className = 'resultTable';
      table.innerHTML = `
        <thead>
          <tr>
            <th>TEAM</th>
            <th class="num">PP</th>
            <th class="num">K</th>
            <th class="num">A</th>
            <th class="num">TRE</th>
            <th class="num">FLG</th>
            <th class="num">TOTAL</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;
      const tb = table.querySelector('tbody');

      srcRows.forEach(r=>{
        const tr = document.createElement('tr');
        const isPlayer = (String(r.id||'') === 'PLAYER') || !!r.isPlayer;
        if (isPlayer) tr.classList.add('isPlayer');

        const place = Number(r.placement ?? r.Placement ?? 0);
        const name = String(r.name ?? r.squad ?? r.id ?? '');

        const PlacementP = Number(r.PlacementP ?? r.placementP ?? 0);
        const KP = Number(r.KP ?? r.kp ?? 0);
        const AP = Number(r.AP ?? r.ap ?? 0);
        const Treasure = Number(r.Treasure ?? r.treasure ?? 0);
        const Flag = Number(r.Flag ?? r.flag ?? 0);
        const Total = Number(r.Total ?? r.total ?? 0);

        const teamLabel = `${place ? `#${place} ` : ''}${name}`;

        tr.innerHTML = `
          <td>${escapeHtml(teamLabel)}</td>
          <td class="num">${escapeHtml(String(PlacementP))}</td>
          <td class="num">${escapeHtml(String(KP))}</td>
          <td class="num">${escapeHtml(String(AP))}</td>
          <td class="num">${escapeHtml(String(Treasure))}</td>
          <td class="num">${escapeHtml(String(Flag))}</td>
          <td class="num">${escapeHtml(String(Total))}</td>
        `;
        tb.appendChild(tr);
      });

      wrap.appendChild(table);

      const playerPlace = getPlayerRankFromPayloadRows(srcRows);
      if (playerPlace > 0){
        const note = document.createElement('div');
        note.className = 'coachHint';
        note.style.marginTop = '10px';
        note.textContent = `PLAYER 今回の順位：${playerPlace}位`;
        wrap.appendChild(note);
      }

      showPanel(`MATCH ${payload?.matchIndex || ''} RESULT`, wrap);

      setLines('📊 試合結果', 'NEXTで総合RESULTへ', '');
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handleShowTournamentResult(payload){
    lockUI();
    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels();
      hideSplash();
      showCenterStamp('');
      setEventIcon('');
      resetEncounterGate();
      setHold('showTournamentResult');
      setBattleMode(false);

      setBackdrop(TOURNEY_BACKDROP);
      setSquareBg(ASSET.tent);

      const st = getState() || {};
      const total = payload?.total || {};
      const arr = Object.values(total);

      arr.sort((a,b)=>{
        const pa = Number(a.sumTotal ?? a.total ?? 0);
        const pb = Number(b.sumTotal ?? b.total ?? 0);
        if (pb !== pa) return pb - pa;

        const ka = Number(a.sumKP ?? a.KP ?? a.kp ?? 0);
        const kb = Number(b.sumKP ?? b.KP ?? b.kp ?? 0);
        if (kb !== ka) return kb - ka;

        const ppa = Number(a.sumPlacementP ?? a.PP ?? a.placementP ?? 0);
        const ppb = Number(b.sumPlacementP ?? b.PP ?? b.placementP ?? 0);
        if (ppb !== ppa) return ppb - ppa;

        return String(a.name || a.squad || a.id || '').localeCompare(String(b.name || b.squad || b.id || ''));
      });

      const q = getQualLineByState(st);
      const litSet = getWorldFinalLitSet(st);
      const isWorldFinal = (String(st.mode||'').toLowerCase()==='world' && String(st.worldPhase||st.phase||'').toLowerCase()==='final');

      const wrap = document.createElement('div');
      wrap.className = 'tourneyWrap';

      const hint = document.createElement('div');
      hint.className = 'coachHint';

      if (isWorldFinal){
        const mp = Number(st?.worldFinalMP?.matchPoint ?? 80);
        hint.textContent = `WORLD FINAL：${mp}pt点灯チーム（次試合以降のチャンピオンで優勝）`;
      }else if (q.line > 0){
        hint.textContent = `通過ライン：${q.label}`;
      }else{
        hint.textContent = '総合ポイント';
      }
      wrap.appendChild(hint);

      const rewardBox = buildRewardBox(st, arr);
      if (rewardBox) wrap.appendChild(rewardBox);

      const messageBox = buildTournamentMessageBox(st, arr);
      if (messageBox) wrap.appendChild(messageBox);

      const table = document.createElement('table');
      table.className = 'tourneyTable';
      table.innerHTML = `
        <thead>
          <tr>
            <th>TEAM</th>
            <th class="num">PT</th>
            <th class="num">PP</th>
            <th class="num">K</th>
            <th class="num">A</th>
            <th class="num">TRE</th>
            <th class="num">FLG</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;
      const tb = table.querySelector('tbody');

      arr.forEach((r,i)=>{
        const rank = i + 1;

        const tr = document.createElement('tr');
        const id = String(r.id ?? '');
        const isPlayer = (id === 'PLAYER') || !!r.isPlayer;
        if (isPlayer) tr.classList.add('isPlayer');

        const teamName = String(r.name ?? r.squad ?? r.id ?? '');
        let teamLabel = `#${rank} ${teamName}`;

        const lit = isWorldFinal && litSet.has(id);
        if (lit){
          teamLabel = `🟡 ${teamLabel}`;
        }

        const PT = Number(r.sumTotal ?? r.total ?? 0);
        const PP = Number(r.sumPlacementP ?? r.PP ?? r.placementP ?? 0);
        const K  = Number(r.sumKP ?? r.KP ?? r.kp ?? 0);
        const A  = Number(r.sumAP ?? r.AP ?? r.ap ?? 0);
        const TRE = Number(r.sumTreasure ?? r.Treasure ?? r.treasure ?? 0);
        const FLG = Number(r.sumFlag ?? r.Flag ?? r.flag ?? 0);

        tr.innerHTML = `
          <td>${escapeHtml(teamLabel)}</td>
          <td class="num">${escapeHtml(String(PT))}</td>
          <td class="num">${escapeHtml(String(PP))}</td>
          <td class="num">${escapeHtml(String(K))}</td>
          <td class="num">${escapeHtml(String(A))}</td>
          <td class="num">${escapeHtml(String(TRE))}</td>
          <td class="num">${escapeHtml(String(FLG))}</td>
        `;

        const qualified = (!isWorldFinal && q.line > 0 && rank <= q.line);
        const cut = (!isWorldFinal && q.line > 0 && rank > q.line);

        applyRowHighlight(tr, { qualified, cut, lit });
        tb.appendChild(tr);
      });

      wrap.appendChild(table);

      // 既存互換で必要なら currentOverall table 生成関数も残す
      wrap._buildCurrentOverallTable = buildCurrentOverallTable;

      showPanel('TOURNAMENT RESULT', wrap);

      setLines('🏁 総合RESULT', '（NEXTで進行）', '');
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handleShowNationalNotice(payload){
    lockUI();
    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels();
      setEventIcon('');
      resetEncounterGate();
      clearHold();
      setBattleMode(false);

      const st = getState() || {};
      const lines = getNoticeLines(payload, st);

      setBackdrop(TOURNEY_BACKDROP);
      setSquareBg('');
      showCenterStamp('');
      showSplash(lines.line1 || '', lines.line2 || '');

      setLines(lines.line1 || '', lines.line2 || '', lines.line3 || 'NEXTで進行');
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handleEndTournament(payload){
    lockUI();
    try{
      MOD.close();
    }finally{
      unlockUI();
    }

    try{
      const ok = dispatchGoMainFromPayload(payload, 1);
      if (!ok){
        window.dispatchEvent(new CustomEvent('mobbr:goMain', {
          detail:{ advanceWeeks:1, tournamentFinished:true }
        }));
      }
    }catch(e){
      console.error('[ui_tournament.handlers.result] handleEndTournament goMain failed:', e);
    }
  }

  async function handleEndNationalWeek(payload){
    lockUI();
    try{
      MOD.close();
    }finally{
      unlockUI();
    }

    try{
      const weeks = Number(payload?.weeks ?? payload?.advanceWeeks ?? 1) || 1;

      dispatchGoMainFromPayload(Object.assign({}, payload || {}, {
        nationalFinished: payload?.nationalFinished ?? true,
        tournamentFinished: payload?.tournamentFinished ?? true,
        advanceWeeks: weeks
      }), weeks);
    }catch(e){
      console.error('[ui_tournament.handlers.result] endNationalWeek notify error:', e);
      try{
        window.dispatchEvent(new CustomEvent('mobbr:goMain', {
          detail:{ advanceWeeks:1, tournamentFinished:true, nationalFinished:true }
        }));
      }catch(_){}
    }
  }

  async function handleNextMatch(payload){
    lockUI();
    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels();
      hideSplash();
      showCenterStamp('');
      setEventIcon('');
      resetEncounterGate();
      clearHold();
      setBattleMode(false);

      setBackdrop(TOURNEY_BACKDROP);
      setSquareBg(ASSET.tent);

      const st = getState() || {};
      const total = getMatchTotalFromState(st);
      const mi = Number(payload?.matchIndex ?? st.matchIndex ?? st.match ?? 0) || 0;

      setLines('➡️ 次の試合へ', `MATCH ${mi} / ${total}`, 'NEXTで進行');
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  const API = {
    handleShowMatchResult,
    handleShowTournamentResult,
    handleShowNationalNotice,
    handleEndTournament,
    handleEndNationalWeek,
    handleNextMatch
  };

  window.MOBBR.ui._tournamentResultHandlers = API;
  window.MOBBR.ui._tournamentResultHandlersLoaded = true;

  Object.assign(MOD, API);

})();

// ✅ splitロード検知
window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};
window.MOBBR.ui._tournamentHandlersResult = true;
