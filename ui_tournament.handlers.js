'use strict';

/* =========================================================
   ui_tournament.handlers.js（v3.7.0 split-2a）FULL
   - battle / move / intro / teamlist / champion など本体
   - result系は ui_tournament.handlers.result.js へ分離
   - ✅ app.js を触らずに済むよう、result側はこのファイルから自動読込
   - ✅ 既存の関数名は維持
========================================================= */

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){

  const MOD = window.MOBBR.ui._tournamentMod;
  if (!MOD){
    console.error('[ui_tournament.handlers] core module missing');
    return;
  }

  const {
    TOURNEY_BACKDROP, ASSET, BATTLE_CHAT,

    getFlow, getState,
    sleep, shuffle,

    lockUI, unlockUI,

    setChampionMode, setResultStampMode,
    hidePanels, hideSplash,
    setEventIcon, showCenterStamp,
    resetEncounterGate, clearHold, setHold,
    setBattleMode,

    setBackdrop, setSquareBg, setChars, setNames, setNamesRich,
    setBanners, setLines,
    showSplash, showPanel, escapeHtml,
    syncSessionBar,
    preloadEventIcons,
    guessPlayerImageCandidates,
    guessEnemyImageCandidates,
    guessTeamImageCandidates,
    resolveFirstExisting,

    getMatchTotalFromState
  } = MOD;

  // =========================================================
  // shared helper export（result split からも参照）
  // =========================================================
  const SHARED = window.MOBBR.ui._tournamentHandlersShared = window.MOBBR.ui._tournamentHandlersShared || {};

  // =========================================================
  // ✅ app.js 責務（週進行/メイン復帰）へ必ず戻すヘルパ
  // =========================================================
  function dispatchGoMainFromPayload(payload, fallbackAdvanceWeeks){
    const p = payload && typeof payload === 'object' ? payload : {};
    const adv = Number(p.advanceWeeks ?? p.weeks ?? fallbackAdvanceWeeks ?? 1);
    const advanceWeeks = Math.max(0, Number.isFinite(adv) ? (adv|0) : 1);

    const detail = Object.assign({}, p, { advanceWeeks });

    try{
      window.dispatchEvent(new CustomEvent('mobbr:goMain', { detail }));
      return true;
    }catch(e){
      console.error('[ui_tournament.handlers] dispatch mobbr:goMain failed:', e);
      return false;
    }
  }

  function pickChats(n){
    const a = shuffle(BATTLE_CHAT);
    const out = a.slice(0, Math.max(1, n|0));
    if (out.length >= 6){
      const idx = 3 + ((Math.random()*3)|0);
      out[idx] = 'ウルト行くぞ！';
    }
    return out;
  }

  function buildTeamListTable(teams){
    const wrap = document.createElement('div');
    wrap.className = 'teamListWrap';

    const table = document.createElement('table');
    table.className = 'teamTable';
    table.innerHTML = `
      <thead>
        <tr>
          <th>TEAM</th>
          <th class="num">POWER</th>
          <th class="num">ALIVE</th>
          <th class="num">TRE</th>
          <th class="num">FLG</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tb = table.querySelector('tbody');

    (teams||[]).forEach(t=>{
      const tr = document.createElement('tr');
      if (t.isPlayer) tr.classList.add('isPlayer');
      tr.innerHTML = `
        <td>${escapeHtml(t.name || t.id || '')}</td>
        <td class="num">${escapeHtml(String(t.power ?? ''))}</td>
        <td class="num">${escapeHtml(String(t.alive ?? ''))}</td>
        <td class="num">${escapeHtml(String(t.treasure ?? 0))}</td>
        <td class="num">${escapeHtml(String(t.flag ?? 0))}</td>
      `;
      tb.appendChild(tr);
    });

    wrap.appendChild(table);
    return wrap;
  }

  function findChampionTeam(state, payload){
    const teams = Array.isArray(state?.teams) ? state.teams : [];
    const name = String(payload?.championName || payload?.line2 || '').trim();

    let t = null;

    if (payload?.championTeamId){
      const id = String(payload.championTeamId);
      t = teams.find(x=>String(x?.id||'') === id) || null;
      if (t) return t;
    }

    if (name){
      t = teams.find(x=>String(x?.name||'') === name) || null;
      if (t) return t;

      t = teams.find(x=>String(x?.name||'').includes(name)) || null;
      if (t) return t;
    }

    return null;
  }

  function normMode(st){
    return String(st?.mode || '').trim().toLowerCase();
  }

  function normWorldPhase(st){
    return String(st?.worldPhase || st?.world?.phase || st?.phase || '').trim().toLowerCase();
  }

  function getPlayerRankFromPayloadRows(rows){
    const arr = Array.isArray(rows) ? rows : [];
    const row = arr.find(r => String(r?.id || '') === 'PLAYER');
    if (!row) return 0;
    const p = Number(row.placement ?? row.Placement ?? 0);
    return Number.isFinite(p) ? p : 0;
  }

  function getPlayerMemberNames(st){
    const fallback = ['A','B','C'];

    try{
      const p = (st?.teams || []).find(x => String(x?.id || '') === 'PLAYER');
      if (Array.isArray(p?.members) && p.members.length >= 3){
        return [
          String(p.members[0]?.name || fallback[0]),
          String(p.members[1]?.name || fallback[1]),
          String(p.members[2]?.name || fallback[2]),
        ];
      }
    }catch(_){}

    try{
      const defs = st?.national?.allTeamDefs;
      const p = defs?.PLAYER;
      if (Array.isArray(p?.members) && p.members.length >= 3){
        return [
          String(p.members[0]?.name || fallback[0]),
          String(p.members[1]?.name || fallback[1]),
          String(p.members[2]?.name || fallback[2]),
        ];
      }
    }catch(_){}

    try{
      const raw = localStorage.getItem('mobbr_playerTeam');
      if (raw){
        const obj = JSON.parse(raw);
        const members = Array.isArray(obj?.members) ? obj.members : [];
        const a = members.find(x => String(x?.id || '') === 'A');
        const b = members.find(x => String(x?.id || '') === 'B');
        const c = members.find(x => String(x?.id || '') === 'C');
        return [
          String(a?.name || fallback[0]),
          String(b?.name || fallback[1]),
          String(c?.name || fallback[2]),
        ];
      }
    }catch(_){}

    return fallback.slice();
  }

  function buildArrivalLinesByState(st){
    const mode = normMode(st);
    const wp = normWorldPhase(st);

    if (mode === 'local'){
      return {
        line1: 'いよいよ今シーズンのローカル大会が開幕！',
        line2: '10位までに入ればナショナル大会へ！',
        line3: '1戦1戦大事にしよう！'
      };
    }

    if (mode === 'national'){
      return {
        line1: 'ナショナル大会が開幕！',
        line2: '上位8チームがワールドファイナルへ！',
        line3: '全国の猛者と決戦だ！'
      };
    }

    if (mode === 'lastchance'){
      return {
        line1: 'ラストチャンスが開幕！',
        line2: 'ナショナル9位〜28位が闘志を燃やす！',
        line3: '1位か2位でワールドファイナルへ進出出来る！ 全部出し切るぞ！'
      };
    }

    if (mode === 'world'){
      if (wp === 'losers'){
        return {
          line1: 'ワールドファイナル losers 開幕！',
          line2: 'ここで負ければ終わり、上位10だけが決勝へ！',
          line3: 'まだまだ諦めないで！'
        };
      }
      if (wp === 'final'){
        return {
          line1: 'いよいよワールドファイナル決勝！',
          line2: '80ポイントで点灯し、点灯状態のチャンピオンで優勝！',
          line3: '試合は最大12試合続きます！'
        };
      }
      return {
        line1: 'ワールドファイナル開幕！',
        line2: 'とうとう来たね世界大会。まずは予選リーグ突破を目指して頑張ろう！',
        line3: '予選リーグは上位10チームが決勝確定！ 11〜30位はlosersへ / 31位以下は敗退！'
      };
    }

    return {
      line1: '大会会場へ到着！',
      line2: '観客の熱気が一気に押し寄せる…！',
      line3: 'NEXTで開幕演出へ'
    };
  }

  function buildIntroLinesByState(st){
    const mode = normMode(st);
    const wp = normWorldPhase(st);

    if (mode === 'local'){
      return {
        line1: 'ローカル大会開幕！',
        line2: 'ここからシーズンの第一歩！',
        line3: 'NEXTでチーム紹介'
      };
    }

    if (mode === 'national'){
      return {
        line1: 'ナショナル大会開幕！',
        line2: '上位8チームが世界へ！',
        line3: 'NEXTでチーム紹介'
      };
    }

    if (mode === 'lastchance'){
      return {
        line1: 'ラストチャンス開幕！',
        line2: '狙うはたった2枠！',
        line3: 'NEXTでチーム紹介'
      };
    }

    if (mode === 'world'){
      if (wp === 'qual'){
        return {
          line1: 'ワールドファイナル予選 開幕！',
          line2: '上位10チームが決勝確定！',
          line3: 'NEXTでチーム紹介'
        };
      }
      if (wp === 'losers'){
        return {
          line1: 'losers 開幕！',
          line2: '上位10が決勝へ進出！',
          line3: 'NEXTでチーム紹介'
        };
      }
      if (wp === 'final'){
        return {
          line1: 'FINAL ROUND 開始！',
          line2: '点灯状態のチャンピオンで世界一！',
          line3: 'NEXTでチーム紹介'
        };
      }
    }

    return {
      line1: 'ローカル大会開幕！',
      line2: '本日の戦場へ——',
      line3: 'NEXTでチーム紹介'
    };
  }

  function getNoticeLines(payload, st){
    const p1 = String(payload?.line1 || '').trim();
    const p2 = String(payload?.line2 || '').trim();
    const p3 = String(payload?.line3 || '').trim();

    if (p1 || p2 || p3){
      return {
        line1: p1,
        line2: p2,
        line3: p3 || 'NEXTで進行'
      };
    }

    const mode = normMode(st);
    const wp = normWorldPhase(st);

    if (mode === 'world' && wp === 'final'){
      return {
        line1: 'WORLD FINAL',
        line2: '決戦の時だ！',
        line3: 'NEXTで進行'
      };
    }

    return {
      line1: '',
      line2: '',
      line3: 'NEXTで進行'
    };
  }

  Object.assign(SHARED, {
    dispatchGoMainFromPayload,
    pickChats,
    buildTeamListTable,
    findChampionTeam,
    normMode,
    normWorldPhase,
    getPlayerRankFromPayloadRows,
    getPlayerMemberNames,
    buildArrivalLinesByState,
    buildIntroLinesByState,
    getNoticeLines
  });

  // =========================================================
  // result split autoload
  // =========================================================
  let resultHandlersReadyPromise = null;

  function getVersionSuffixFromCurrentScript(){
    try{
      const cur = document.currentScript;
      if (cur && cur.src){
        const u = new URL(cur.src, window.location.href);
        return u.search || '';
      }
    }catch(_){}
    return '';
  }

  function ensureResultHandlersReady(){
    if (window.MOBBR.ui._tournamentResultHandlersLoaded){
      return Promise.resolve(window.MOBBR.ui._tournamentResultHandlers || {});
    }

    if (resultHandlersReadyPromise) return resultHandlersReadyPromise;

    resultHandlersReadyPromise = new Promise((resolve, reject)=>{
      try{
        const existing = document.querySelector('script[data-mobbr="ui_tournament.handlers.result"]');
        if (existing){
          existing.addEventListener('load', ()=>resolve(window.MOBBR.ui._tournamentResultHandlers || {}), { once:true });
          existing.addEventListener('error', reject, { once:true });
          return;
        }

        const suffix = getVersionSuffixFromCurrentScript();
        const s = document.createElement('script');
        s.src = `ui_tournament.handlers.result.js${suffix}`;
        s.defer = true;
        s.dataset.mobbr = 'ui_tournament.handlers.result';

        s.onload = ()=>{
          window.MOBBR.ui._tournamentResultHandlersLoaded = true;
          resolve(window.MOBBR.ui._tournamentResultHandlers || {});
        };
        s.onerror = (e)=>{
          console.error('[ui_tournament.handlers] failed to load ui_tournament.handlers.result.js');
          reject(e);
        };

        document.head.appendChild(s);
      }catch(e){
        reject(e);
      }
    });

    return resultHandlersReadyPromise;
  }

  async function callResultHandler(name, payload){
    try{
      await ensureResultHandlersReady();
      const api = window.MOBBR.ui._tournamentResultHandlers || {};
      const fn = api[name] || MOD[name];
      if (typeof fn === 'function'){
        return await fn(payload);
      }
      console.warn(`[ui_tournament.handlers] result handler missing: ${name}`);
    }catch(e){
      console.error(`[ui_tournament.handlers] result handler failed: ${name}`, e);
    }
  }

  // =========================================================
  // non-result handlers
  // =========================================================
  async function handleShowArrival(payload){
    lockUI();
    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels();
      setEventIcon('');
      showCenterStamp('');
      resetEncounterGate();
      clearHold();
      setBattleMode(false);

      const st = getState() || {};
      const auto = buildArrivalLinesByState(st);

      const line1 = String(payload?.line1 || '').trim() || auto.line1;
      const line2 = String(payload?.line2 || '').trim() || auto.line2;
      const line3 = String(payload?.line3 || '').trim() || auto.line3;

      setBackdrop(TOURNEY_BACKDROP);
      setSquareBg('');
      setChars('', '');
      setNames('', '');
      hideSplash();

      showSplash(line1, line2);
      setLines(line1, line2, line3);
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handleShowIntroText(){
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

      const st = getState();
      if (!st) return;

      setBackdrop(TOURNEY_BACKDROP);
      const sq = await resolveFirstExisting([st.ui?.squareBg || ASSET.tent, ASSET.tent]);
      setSquareBg(sq || ASSET.tent);

      const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st.ui?.leftImg || 'P1.png'));
      setChars(leftResolved, '');
      setNames('', '');

      setBanners(st.bannerLeft, st.bannerRight);

      const auto = buildIntroLinesByState(st);
      const l1 = st.ui?.center3?.[0] || auto.line1;
      const l2 = st.ui?.center3?.[1] || auto.line2;
      const l3 = st.ui?.center3?.[2] || auto.line3;
      setLines(l1, l2, l3);

      preloadEventIcons();
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handleShowAutoSession(payload){
    lockUI();
    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels();
      setEventIcon('');
      showCenterStamp('');
      resetEncounterGate();
      clearHold();
      setBattleMode(false);

      setBackdrop(TOURNEY_BACKDROP);
      setSquareBg('');
      setChars('', '');
      setNames('', '');
      hideSplash();

      const t1 = payload?.title || payload?.line1 || '';
      const t2 = payload?.sub || payload?.line2 || '';

      showSplash(t1, t2);
      setLines(payload?.line1 || t1 || '', payload?.line2 || t2 || '', payload?.line3 || 'NEXTで進行');
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handleShowAutoSessionDone(payload){
    lockUI();
    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels();
      setEventIcon('');
      showCenterStamp('');
      resetEncounterGate();
      clearHold();
      setBattleMode(false);

      setBackdrop(TOURNEY_BACKDROP);
      setSquareBg('');
      setChars('', '');
      setNames('', '');
      hideSplash();

      const t1 = payload?.title || payload?.line1 || '全試合終了！';
      const t2 = payload?.sub || payload?.line2 || '現在の総合ポイントはこちら！';

      showSplash(t1, t2);
      setLines(payload?.line1 || t1, payload?.line2 || t2, payload?.line3 || 'NEXTでRESULT表示');
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handleShowTeamList(payload){
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

      const st = getState();
      if (!st) return;

      setBackdrop(TOURNEY_BACKDROP);
      const sq = await resolveFirstExisting([st.ui?.squareBg || ASSET.tent, ASSET.tent]);
      setSquareBg(sq || ASSET.tent);

      const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st.ui?.leftImg || 'P1.png'));
      setChars(leftResolved, '');
      setNames('', '');

      setBanners(st.bannerLeft, st.bannerRight);

      const teams = Array.isArray(payload?.teams) ? payload.teams : (Array.isArray(st.teams) ? st.teams : []);
      showPanel('参加チーム', buildTeamListTable(teams));

      setLines('✨ 本日のチームをご紹介！', '（NEXTで進行）', '');
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handleShowCoachSelect(){
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

      const st = getState();
      if (!st) return;

      setBackdrop(TOURNEY_BACKDROP);
      const sq = await resolveFirstExisting([st.ui?.squareBg || ASSET.tent, ASSET.tent]);
      setSquareBg(sq || ASSET.tent);

      const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st.ui?.leftImg || 'P1.png'));
      setChars(leftResolved, '');
      setNames('', '');

      setBanners(st.bannerLeft, st.bannerRight);

      const wrap = document.createElement('div');
      wrap.className = 'coachWrap';

      const hint = document.createElement('div');
      hint.className = 'coachHint';
      hint.textContent = 'コーチスキルは現在廃止（未使用）です。NEXTで進行します。';
      wrap.appendChild(hint);

      showPanel('コーチ', wrap);

      setLines(
        st.ui?.center3?.[0] || 'それでは試合を開始します！',
        st.ui?.center3?.[1] || '（コーチスキル無し）',
        st.ui?.center3?.[2] || 'NEXTで進行'
      );
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handleShowDropStart(){
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

      const st = getState();
      if (!st) return;

      setBackdrop(TOURNEY_BACKDROP);
      setSquareBg(ASSET.tent);

      setBanners(st.bannerLeft, st.bannerRight);
      setNames('', '');

      const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st.ui?.leftImg || 'P1.png'));
      setChars(leftResolved, '');

      setLines(
        st.ui?.center3?.[0] || '🚀 バトルスタート！',
        st.ui?.center3?.[1] || '降下開始…！',
        st.ui?.center3?.[2] || 'NEXTで着地'
      );
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handleShowDropLanded(payload){
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

      const st = getState();
      if (!st) return;

      setBackdrop(TOURNEY_BACKDROP);

      const areaBg = String(payload?.bg || st.ui?.bg || '');
      const areaResolved = await resolveFirstExisting([areaBg]);
      if (areaResolved) setSquareBg(areaResolved);

      const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st.ui?.leftImg || 'P1.png'));
      setChars(leftResolved, '');
      setNames('', '');

      setLines(st.ui?.center3?.[0] || '', st.ui?.center3?.[1] || '', st.ui?.center3?.[2] || '');
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handleShowRoundStart(payload){
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

      const st = getState();
      if (!st) return;

      setBackdrop(TOURNEY_BACKDROP);

      const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st.ui?.leftImg || 'P1.png'));
      setChars(leftResolved, '');
      setNames('', '');

      setBanners(st.bannerLeft, st.bannerRight);
      setLines(`⚔️ Round ${payload?.round || st.round} 開始！`, '油断するな。ここからが勝負だ。', '');
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handleShowEvent(payload){
    lockUI();
    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels();
      hideSplash();
      showCenterStamp('');
      resetEncounterGate();
      clearHold();
      setBattleMode(false);

      const st = getState();
      setBackdrop(TOURNEY_BACKDROP);

      const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st?.ui?.leftImg || 'P1.png'));
      setChars(leftResolved, '');
      setNames('', '');

      preloadEventIcons();
      setEventIcon(payload?.icon ? String(payload.icon) : '');

      setBanners(st?.bannerLeft || '', st?.bannerRight || '');

      if (st?.ui?.center3){
        setLines(st.ui.center3[0] || 'イベント発生！', st.ui.center3[1] || '', st.ui.center3[2] || '');
      }else{
        setLines(payload?.log1 || 'イベント発生！', payload?.log2 || '', payload?.log3 || '');
      }
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handlePrepareBattles(){
    lockUI();
    try{
      setChampionMode(false);
      setResultStampMode(false);
      setBattleMode(false);
      setBackdrop(TOURNEY_BACKDROP);
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handleShowEncounter(payload){
    lockUI();
    try{
      setChampionMode(false);
      setResultStampMode(false);

      MOD._setEncounterGatePhase(1);
      MOD._setPendingBattleReq(null);
      clearHold();

      hidePanels();
      setEventIcon('');
      showCenterStamp('');
      hideSplash();

      setBattleMode(false);

      const st = getState();
      if (!st) return;

      setBackdrop(TOURNEY_BACKDROP);
      setBanners(st.bannerLeft, st.bannerRight);

      const meName = payload?.meName || '';
      const foeName = payload?.foeName || '';
      const foeId = payload?.foeTeamId || '';

      const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st.ui?.leftImg || 'P1.png'));

      const rightCands = []
        .concat(guessEnemyImageCandidates(st.ui?.rightImg || ''))
        .concat(guessTeamImageCandidates(foeId));

      const rightResolved = await resolveFirstExisting(rightCands);

      setNames('', '');
      setChars(leftResolved, '');

      showSplash('⚠️ 接敵‼︎', `${foeName}チームを発見！`);
      setLines('⚠️ 接敵‼︎', `${foeName}チームを発見！`, 'NEXTで敵を表示');

      MOD._setLocalNextAction(()=>{
        lockUI();
        try{
          MOD._setEncounterGatePhase(2);

          showCenterStamp('');
          hideSplash();

          setBattleMode(true);

          setNamesRich(
            meName, payload?.meMembers,
            foeName, payload?.foeMembers
          );

          setChars(leftResolved, rightResolved);
          setLines('⚠️ 接敵‼︎', `${meName} vs ${foeName}‼︎`, 'NEXTで交戦開始');

          MOD._setLocalNextAction(()=>{
            lockUI();
            try{
              const pend = MOD._getPendingBattleReq();
              if (pend){
                MOD._setPendingBattleReq(null);
                MOD._setEncounterGatePhase(0);
                (async()=>{ await handleShowBattle(pend); })();
                return;
              }
              const flow = getFlow();
              if (!flow) return;
              MOD._setEncounterGatePhase(0);
              flow.step();
              MOD.render();
            }finally{
              unlockUI();
            }
          });
        }finally{
          unlockUI();
        }
      });

      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handleShowBattle(payload){
    lockUI();
    MOD._setBusy(true);
    MOD.setNextEnabled(false);

    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels();
      hideSplash();
      setEventIcon('');
      clearHold();

      const st = getState();
      if (!st) return;

      setBattleMode(true);
      setBackdrop(TOURNEY_BACKDROP);

      setResultStampMode(false);
      showCenterStamp(ASSET.brbattle);

      const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st.ui?.leftImg || 'P1.png'));

      const foeId = payload?.foeTeamId || '';
      const rightCands = []
        .concat(guessEnemyImageCandidates(st.ui?.rightImg || ''))
        .concat(guessTeamImageCandidates(foeId));

      const rightResolved = await resolveFirstExisting(rightCands);

      const meName = payload?.meName || '';
      const foeName = payload?.foeName || '';

      setNamesRich(
        meName, payload?.meMembers,
        foeName, payload?.foeMembers
      );

      setChars(leftResolved, rightResolved);

      setLines('交戦開始‼︎', '一瞬で決めるぞ！', '');
      await sleep(420);

      const chats = pickChats(10);
      for (let i=0;i<chats.length;i++){
        setLines(chats[i], '', '');
        await sleep(140);
        setLines('', '', '');
        await sleep(90);
      }

      setResultStampMode(true);
      showCenterStamp(payload?.win ? ASSET.brwin : ASSET.brlose);

      if (payload?.win){
        const winLines = payload?.final
          ? ['チャンピオンだ―！！','みんなよくやった！！','獲ったぞー！！']
          : ['よし！次に備えるぞ！','やったー！勝ったぞ！','ナイスー！'];
        setLines('✅ 勝利！', winLines[(Math.random()*winLines.length)|0], '');
      }else{
        const loseLines = ['やられた..','次だ次！','負けちまった..'];
        setLines('❌ 敗北…', loseLines[(Math.random()*loseLines.length)|0], '');
      }

      await sleep(Number(payload?.holdMs || 2000));

      setResultStampMode(false);
      syncSessionBar();
    }finally{
      MOD._setBusy(false);
      unlockUI();
      MOD.setNextEnabled(true);
    }
  }

  async function handleShowMove(payload){
    lockUI();
    MOD._setBusy(true);
    MOD.setNextEnabled(false);

    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels();
      hideSplash();
      showCenterStamp('');
      setEventIcon('');
      resetEncounterGate();
      clearHold();

      const st = getState();
      if (!st) return;

      setBattleMode(false);

      setBackdrop(TOURNEY_BACKDROP);
      setSquareBg(ASSET.ido);

      const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st.ui?.leftImg || 'P1.png'));
      setChars(leftResolved, '');
      setNames('', '');

      const toBg = String(payload?.toBg || '');
      const toResolved = await resolveFirstExisting([toBg]);

      setLines(payload?.log1 || '移動中…', payload?.log2 || '', payload?.log3 || '');
      await sleep(360);

      if (toResolved) setSquareBg(toResolved);

      setLines(
        payload?.arrive1 || (payload?.toAreaName ? `📍 ${String(payload.toAreaName)}に到着！` : '📍 到着！'),
        payload?.arrive2 || '周囲を警戒しろ。',
        payload?.arrive3 || ''
      );

      syncSessionBar();
    }finally{
      MOD._setBusy(false);
      unlockUI();
      MOD.setNextEnabled(true);
    }
  }

  async function handleShowChampion(payload){
    lockUI();
    try{
      setChampionMode(true);
      setResultStampMode(false);
      hidePanels();
      hideSplash();
      setEventIcon('');
      resetEncounterGate();
      clearHold();
      setBattleMode(false);

      setBackdrop(TOURNEY_BACKDROP);
      showCenterStamp('');
      setResultStampMode(false);

      const st = getState();
      const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st?.ui?.leftImg || 'P1.png'));

      const champTeam = findChampionTeam(st, payload);
      const champName = String(payload?.championName || champTeam?.name || payload?.line2 || '').trim();

      let champImg = '';
      if (champTeam?.id){
        const cands = []
          .concat(guessEnemyImageCandidates(champTeam?.img || ''))
          .concat(guessTeamImageCandidates(champTeam.id));
        champImg = await resolveFirstExisting(cands);
      }

      setChars(leftResolved, champImg || '');
      setNames('', champName || '');

      const isWorldChampion = !!payload?.worldChampion || !!payload?.isWorldFinal;
      if (isWorldChampion){
        const members = champTeam?.members && Array.isArray(champTeam.members)
          ? champTeam.members.slice(0,3).map(m=>String(m?.name || '')).filter(Boolean)
          : getPlayerMemberNames(st);

        const memberLine = members.length ? `メンバーは ${members.join('、')}！` : 'おめでとう！';

        setLines(
          `${champName}が点灯状態でチャンピオンを獲得！`,
          `世界王者は ${champName}！`,
          memberLine
        );
      }else{
        setLines(
          payload?.line1 || '🏆 この試合のチャンピオンは…',
          champName || '',
          payload?.line3 || '‼︎'
        );
      }

      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  // =========================================================
  // wrappers for split result handlers
  // =========================================================
  async function handleShowMatchResult(payload){
    return callResultHandler('handleShowMatchResult', payload);
  }

  async function handleShowTournamentResult(payload){
    return callResultHandler('handleShowTournamentResult', payload);
  }

  async function handleShowNationalNotice(payload){
    return callResultHandler('handleShowNationalNotice', payload);
  }

  async function handleEndTournament(payload){
    return callResultHandler('handleEndTournament', payload);
  }

  async function handleEndNationalWeek(payload){
    return callResultHandler('handleEndNationalWeek', payload);
  }

  async function handleNextMatch(payload){
    return callResultHandler('handleNextMatch', payload);
  }

  // preload result split immediately
  ensureResultHandlersReady().catch((e)=>{
    console.error('[ui_tournament.handlers] result split preload failed:', e);
  });

  Object.assign(MOD, {
    handleShowArrival,
    handleShowIntroText,
    handleShowAutoSession,
    handleShowAutoSessionDone,
    handleShowTeamList,
    handleShowCoachSelect,
    handleShowDropStart,
    handleShowDropLanded,
    handleShowRoundStart,
    handleShowEvent,
    handlePrepareBattles,
    handleShowEncounter,
    handleShowBattle,
    handleShowMove,
    handleShowChampion,
    handleShowMatchResult,
    handleShowTournamentResult,
    handleShowNationalNotice,
    handleEndTournament,
    handleEndNationalWeek,
    handleNextMatch
  });

})();

// ✅ splitロード検知（app.js の [CHECK] ui_tournament split 用）
window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};
window.MOBBR.ui._tournamentHandlers = true;
