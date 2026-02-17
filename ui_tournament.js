'use strict';

/*
  ui_tournament.js v3.6.6（FULL）
  ✅ v3.6.5 の全機能維持
  追加：
  - ✅ ナショナル進捗バー（AB CD AC AD BC BD）を上部に常時表示
  - ✅ 終了済みセッションを赤表示（state.national.doneSessions）
  - ✅ 現在セッションを強調表示（state.national.sessionIndex）
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){

  const TOURNEY_BACKDROP = 'haikeimain.png';

  const ASSET = {
    tent: 'tent.png',
    ido: 'ido.png',
    brbattle: 'brbattle.png',
    brwin: 'brwin.png',
    brlose: 'brlose.png'
  };

  const BATTLE_CHAT = [
    'やってやんべ！','裏取るぞ！','展開する！','サポートするぞ！','うわあー！','ミスった！','一気に行くぞ！','今のうちに回復だ！','絶対勝つぞ！','撃て―！',
    'なんて動きだ！','撃ちまくれ！','グレ使う！','グレ投げろ！','リロードする！','被弾した！','カバー頼む！','大丈夫か!?','走れーー！','耐えるぞー！'
  ];

  let dom = null;

  let busy = false;
  let lastReqKey = '';
  let autoTimer = null;

  let localNextAction = null;

  let encounterGatePhase = 0; // 0:なし / 1:接敵ログ / 2:敵表示
  let pendingBattleReq = null;

  let holdScreenType = null;
  let pendingReqAfterHold = null;

  let nextCooldownUntil = 0;

  let preloadedBasics = false;
  let preloadedEventIcons = false;

  let uiLockCount = 0;
  let rendering = false;

  function getFlow(){
    return window.MOBBR?.sim?.tournamentFlow || window.MOBBR?.tournamentFlow || null;
  }
  function getState(){
    const f = getFlow();
    return f?.getState ? f.getState() : (f?.state || null);
  }

  function sleep(ms){ return new Promise(r=>setTimeout(r, ms|0)); }

  function shuffle(a){
    const arr = (a || []).slice();
    for (let i=arr.length-1;i>0;i--){
      const j = (Math.random()*(i+1))|0;
      const t = arr[i]; arr[i]=arr[j]; arr[j]=t;
    }
    return arr;
  }

  function clearAutoTimer(){
    if (autoTimer){ clearTimeout(autoTimer); autoTimer = null; }
  }

  function clearLocalNext(){
    localNextAction = null;
  }

  function resetEncounterGate(){
    encounterGatePhase = 0;
    pendingBattleReq = null;
  }

  function setHold(type){
    holdScreenType = type || null;
    pendingReqAfterHold = null;
  }
  function clearHold(){
    holdScreenType = null;
    pendingReqAfterHold = null;
  }

  function imgExists(src){
    return new Promise((resolve)=>{
      if (!src){ resolve(false); return; }
      const im = new Image();
      im.onload = ()=>resolve(true);
      im.onerror = ()=>resolve(false);
      im.src = src;
    });
  }

  async function preloadMany(list){
    const arr = (list || []).filter(Boolean);
    if (!arr.length) return;
    await Promise.all(arr.map(s=>imgExists(s)));
  }

  async function preloadBasics(){
    if (preloadedBasics) return;
    preloadedBasics = true;
    await preloadMany([
      TOURNEY_BACKDROP,
      ASSET.tent,
      ASSET.ido,
      ASSET.brbattle,
      ASSET.brwin,
      ASSET.brlose
    ]);
  }

  function collectEventIconCandidates(){
    const list = [];

    try{
      const flow = getFlow();
      if (flow?.getEventIconList){
        const a = flow.getEventIconList();
        if (Array.isArray(a)) list.push(...a);
      }
    }catch(e){}

    try{
      const st = getState();
      const a = st?.eventIconList;
      if (Array.isArray(a)) list.push(...a);
      const b = st?.ui?.eventIconList;
      if (Array.isArray(b)) list.push(...b);
    }catch(e){}

    try{
      const me = window.MOBBR?.sim?.matchEvents;
      if (me?.getAllEventIcons){
        const a = me.getAllEventIcons();
        if (Array.isArray(a)) list.push(...a);
      }
      if (Array.isArray(me?.EVENTS)){
        for (const ev of me.EVENTS){
          if (ev?.icon) list.push(ev.icon);
          if (ev?.iconPath) list.push(ev.iconPath);
        }
      }
      if (Array.isArray(me?._EVENTS)){
        for (const ev of me._EVENTS){
          if (ev?.icon) list.push(ev.icon);
          if (ev?.iconPath) list.push(ev.iconPath);
        }
      }
    }catch(e){}

    const seen = new Set();
    const out = [];
    for (const s of list){
      const v = String(s||'').trim();
      if (!v) continue;
      if (seen.has(v)) continue;
      seen.add(v);
      out.push(v);
    }
    return out;
  }

  async function preloadEventIcons(){
    if (preloadedEventIcons) return;
    preloadedEventIcons = true;
    const icons = collectEventIconCandidates();
    if (icons.length) await preloadMany(icons);
  }

  function lockUI(){
    uiLockCount++;
    setNextEnabled(false);
  }
  function unlockUI(){
    uiLockCount = Math.max(0, uiLockCount - 1);
    if (uiLockCount === 0 && !busy){
      setNextEnabled(true);
    }else{
      setNextEnabled(false);
    }
  }
  function isLocked(){
    return uiLockCount > 0;
  }

  function ensureCss(){
    if (document.getElementById('mobbrTournamentCssLink')) return;

    const link = document.createElement('link');
    link.id = 'mobbrTournamentCssLink';
    link.rel = 'stylesheet';
    link.href = 'tournament.css';
    document.head.appendChild(link);
  }

  function ensureDom(){
    if (dom) return dom;
    ensureCss();

    const overlay = document.createElement('div');
    overlay.id = 'mobbrTournamentOverlay';
    overlay.innerHTML = `
      <div class="backdrop" id="mobbrTourBackdrop"></div>
      <div class="stage">
        <div class="hud" id="mobbrTourHud" role="dialog" aria-label="tournament">
          <div class="squareBg" id="mobbrTourSquareBg"></div>

          <div class="banner">
            <div class="left" id="mobbrTourBannerL"></div>
            <div class="right" id="mobbrTourBannerR"></div>
          </div>

          <!-- ✅ National Session Progress -->
          <div class="sessionBar" id="mobbrTourSessionBar" aria-label="national-progress"></div>

          <img class="eventIcon" id="mobbrTourEventIcon" alt="event" />

          <div class="chars">
            <div class="char left" id="mobbrTourCharL">
              <div class="name" id="mobbrTourNameL"></div>
              <img id="mobbrTourImgL" alt="player" />
            </div>
            <div class="char right" id="mobbrTourCharR">
              <div class="name" id="mobbrTourNameR"></div>
              <img id="mobbrTourImgR" alt="enemy" />
            </div>
          </div>

          <div class="centerStamp">
            <img id="mobbrTourStamp" alt="stamp" />
          </div>

          <div class="logBox">
            <div class="line" id="mobbrTourLine1"></div>
            <div class="line" id="mobbrTourLine2"></div>
            <div class="line" id="mobbrTourLine3"></div>
          </div>

          <div class="panel" id="mobbrTourPanel">
            <div class="panelHead" id="mobbrTourPanelHead"></div>
            <div class="panelBody" id="mobbrTourPanelBody"></div>
          </div>

          <div class="splash" id="mobbrTourSplash">
            <div class="t1" id="mobbrTourSplash1"></div>
            <div class="t2" id="mobbrTourSplash2"></div>
          </div>

          <button class="nextBtn" id="mobbrTourNextBtn" type="button">NEXT</button>
          <button class="closeBtn" id="mobbrTourCloseBtn" type="button">×</button>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    dom = {
      overlay,
      backdrop: overlay.querySelector('#mobbrTourBackdrop'),
      squareBg: overlay.querySelector('#mobbrTourSquareBg'),
      bannerL: overlay.querySelector('#mobbrTourBannerL'),
      bannerR: overlay.querySelector('#mobbrTourBannerR'),
      sessionBar: overlay.querySelector('#mobbrTourSessionBar'),
      eventIcon: overlay.querySelector('#mobbrTourEventIcon'),
      charL: overlay.querySelector('#mobbrTourCharL'),
      charR: overlay.querySelector('#mobbrTourCharR'),
      nameL: overlay.querySelector('#mobbrTourNameL'),
      nameR: overlay.querySelector('#mobbrTourNameR'),
      imgL: overlay.querySelector('#mobbrTourImgL'),
      imgR: overlay.querySelector('#mobbrTourImgR'),
      stamp: overlay.querySelector('#mobbrTourStamp'),
      line1: overlay.querySelector('#mobbrTourLine1'),
      line2: overlay.querySelector('#mobbrTourLine2'),
      line3: overlay.querySelector('#mobbrTourLine3'),
      panel: overlay.querySelector('#mobbrTourPanel'),
      panelHead: overlay.querySelector('#mobbrTourPanelHead'),
      panelBody: overlay.querySelector('#mobbrTourPanelBody'),
      splash: overlay.querySelector('#mobbrTourSplash'),
      splash1: overlay.querySelector('#mobbrTourSplash1'),
      splash2: overlay.querySelector('#mobbrTourSplash2'),
      nextBtn: overlay.querySelector('#mobbrTourNextBtn'),
      closeBtn: overlay.querySelector('#mobbrTourCloseBtn')
    };

    dom.nextBtn.addEventListener('click', onNext);
    dom.closeBtn.addEventListener('click', close);

    overlay.addEventListener('touchstart', (e)=>{
      if (e.touches && e.touches.length>1) e.preventDefault();
    }, { passive:false });

    return dom;
  }

  // ✅ National progress bar
  function syncSessionBar(){
    ensureDom();
    const st = getState();
    if (!st || st.mode !== 'national' || !st.national || !dom.sessionBar){
      dom.sessionBar.style.display = 'none';
      dom.sessionBar.innerHTML = '';
      return;
    }

    const sessions = Array.isArray(st.national.sessions) ? st.national.sessions : [];
    const si = Number(st.national.sessionIndex || 0);
    const done = Array.isArray(st.national.doneSessions) ? st.national.doneSessions : [];

    if (!sessions.length){
      dom.sessionBar.style.display = 'none';
      dom.sessionBar.innerHTML = '';
      return;
    }

    dom.sessionBar.style.display = '';
    dom.sessionBar.innerHTML = '';

    sessions.forEach((s, idx)=>{
      const key = String(s?.key || '');
      const el = document.createElement('div');
      el.className = 'seg';
      el.textContent = key || `S${idx+1}`;

      if (idx === si) el.classList.add('isCurrent');
      if (done.includes(key)) el.classList.add('isDone');

      dom.sessionBar.appendChild(el);
    });
  }

  // ✅ 右キャラ枠を「中身が空なら」自動で消す（枠だけ残る問題の決定打）
  function syncEnemyVisibility(){
    ensureDom();

    const hasImg = !!(dom.imgR && dom.imgR.src && String(dom.imgR.src).trim());
    const hasName = !!(dom.nameR && String(dom.nameR.textContent||'').trim());

    const on = (hasImg || hasName);
    dom.charR.style.display = on ? '' : 'none';
  }

  function setBattleMode(on){
    ensureDom();
    dom.overlay.classList.toggle('isBattle', !!on);

    if (!on){
      setResultStampMode(false);
      showCenterStamp('');
      dom.nameR.textContent = '';
      dom.imgR.src = '';
      syncEnemyVisibility();
    }
  }

  function setChampionMode(on){
    ensureDom();
    dom.overlay.classList.toggle('isChampion', !!on);
  }

  function setResultStampMode(on){
    ensureDom();
    dom.overlay.classList.toggle('isResultStamp', !!on);
  }

  function open(){
    ensureDom();
    dom.overlay.classList.add('isOpen');

    clearLocalNext();
    resetEncounterGate();
    clearHold();
    setBattleMode(false);
    setChampionMode(false);
    setResultStampMode(false);
    showCenterStamp('');
    setEventIcon('');
    hidePanels();
    hideSplash();

    // 初期は右枠を隠しておく
    dom.nameR.textContent = '';
    dom.imgR.src = '';
    syncEnemyVisibility();

    preloadBasics();
    preloadEventIcons();

    syncSessionBar();
  }

  function close(){
    clearAutoTimer();
    clearLocalNext();
    resetEncounterGate();
    clearHold();
    uiLockCount = 0;
    busy = false;
    rendering = false;

    if (!dom) return;
    dom.overlay.classList.remove('isOpen');
    dom.overlay.classList.remove('isBattle');
    dom.overlay.classList.remove('isChampion');
    dom.overlay.classList.remove('isResultStamp');

    showCenterStamp('');
    setEventIcon('');
    dom.nameR.textContent = '';
    dom.imgR.src = '';
    syncEnemyVisibility();

    if (dom.sessionBar){
      dom.sessionBar.style.display = 'none';
      dom.sessionBar.innerHTML = '';
    }
  }

  function setBackdrop(src){
    ensureDom();
    dom.backdrop.style.backgroundImage = src ? `url(${src})` : 'none';
  }
  function setSquareBg(src){
    ensureDom();
    dom.squareBg.style.backgroundImage = src ? `url(${src})` : 'none';
  }
  function setBanners(l, r){
    ensureDom();
    dom.bannerL.textContent = String(l || '');
    dom.bannerR.textContent = String(r || '');
    syncSessionBar();
  }
  function setNames(l, r){
    ensureDom();
    dom.nameL.textContent = String(l || '');
    dom.nameR.textContent = String(r || '');
    syncEnemyVisibility();
  }
  function setLines(a, b, c){
    ensureDom();
    dom.line1.textContent = String(a || '');
    dom.line2.textContent = String(b || '');
    dom.line3.textContent = String(c || '');
  }

  function showCenterStamp(src){
    ensureDom();
    if (!src){
      dom.stamp.src = '';
      dom.stamp.classList.remove('isOn');
      return;
    }
    dom.stamp.src = src;
    dom.stamp.classList.add('isOn');
  }

  function hidePanels(){
    ensureDom();
    dom.panel.classList.remove('isOn');
    dom.panelHead.textContent = '';
    dom.panelBody.innerHTML = '';
  }

  function showPanel(title, node){
    ensureDom();
    dom.panel.classList.add('isOn');
    dom.panelHead.textContent = String(title || '');
    dom.panelBody.innerHTML = '';
    dom.panelBody.appendChild(node);
  }

  function setEventIcon(iconPath){
    ensureDom();
    const v = String(iconPath || '');
    if (!v){
      dom.eventIcon.classList.remove('isOn');
      dom.eventIcon.src = '';
      return;
    }
    dom.eventIcon.src = v;
    dom.eventIcon.classList.add('isOn');
  }

  function showSplash(t1, t2){
    ensureDom();
    dom.splash1.textContent = String(t1 || '');
    dom.splash2.textContent = String(t2 || '');
    dom.splash.classList.add('isOn');
  }
  function hideSplash(){
    ensureDom();
    dom.splash.classList.remove('isOn');
    dom.splash1.textContent = '';
    dom.splash2.textContent = '';
  }

  function setChars(leftSrc, rightSrc){
    ensureDom();
    dom.imgL.src = leftSrc ? String(leftSrc) : '';
    dom.imgR.src = rightSrc ? String(rightSrc) : '';
    syncEnemyVisibility();
  }

  function mkReqKey(req){
    const t = String(req?.type || '');
    if (!t) return '';

    const st = getState() || {};
    const matchIndex = (req?.matchIndex ?? st?.matchIndex ?? st?.match ?? '');
    const round = (req?.round ?? st?.round ?? '');
    const foeId = (req?.foeTeamId ?? req?.foeId ?? '');
    const meId = (req?.meTeamId ?? 'PLAYER');

    if (t === 'showBattle'){
      return `showBattle|m:${matchIndex}|r:${round}|me:${meId}|foe:${foeId}|win:${req?.win?1:0}|final:${req?.final?1:0}`;
    }
    if (t === 'showEncounter'){
      return `showEncounter|m:${matchIndex}|r:${round}|me:${meId}|foe:${foeId}`;
    }
    if (t === 'showEvent'){
      return `showEvent|m:${matchIndex}|r:${round}|id:${String(req?.eventId||req?.id||req?.icon||'')}`;
    }
    if (t === 'showChampion'){
      return `showChampion|m:${matchIndex}|name:${String(req?.championName||'')}`;
    }
    if (t === 'showMatchResult'){
      return `showMatchResult|m:${matchIndex}`;
    }
    if (t === 'showTournamentResult'){
      return `showTournamentResult`;
    }
    if (t === 'showArrival'){
      return `showArrival|m:${matchIndex}|r:${round}`;
    }
    if (t === 'showNationalNotice'){
      return `showNationalNotice|q:${req?.qualified?1:0}|p:${String(req?.line2||'')}`;
    }
    if (t === 'endTournament'){
      return `endTournament`;
    }
    if (t === 'endNationalWeek'){
      return `endNationalWeek|w:${String(req?.weeks ?? 1)}`;
    }

    return `${t}|m:${matchIndex}|r:${round}`;
  }

  function setNextEnabled(v){
    ensureDom();
    const can = !!v && !busy && !isLocked() && !rendering;
    dom.nextBtn.disabled = !can;
    dom.nextBtn.classList.toggle('isDisabled', !can);
  }

  function onNext(){
    const now = Date.now();
    if (now < nextCooldownUntil) return;
    nextCooldownUntil = now + 220;

    if (isLocked() || rendering || busy) return;

    if (typeof localNextAction === 'function'){
      const fn = localNextAction;
      localNextAction = null;
      try{ fn(); }catch(e){ console.error('[ui_tournament] localNextAction error:', e); }
      return;
    }

    if (holdScreenType){
      if (pendingReqAfterHold){
        holdScreenType = null;
        pendingReqAfterHold = null;
        lastReqKey = '';
        render();
        return;
      }
      holdScreenType = null;
    }

    const flow = getFlow();
    if (!flow) return;

    flow.step();
    render();
  }

  function guessPlayerImageCandidates(src){
    const base = (src && String(src)) ? String(src) : 'P1.png';
    const arr = [];
    arr.push(base);
    if (!/\.png$/i.test(base)) arr.push(base + '.png');
    return arr;
  }

  function guessTeamImageCandidates(teamId){
    const id = String(teamId || '');
    if (!id) return [];
    return [`${id}.png`, `cpu/${id}.png`, `teams/${id}.png`];
  }

  async function resolveFirstExisting(cands){
    const list = (cands || []).filter(Boolean);
    for (const src of list){
      const ok = await imgExists(src);
      if (ok) return src;
    }
    return '';
  }

  function escapeHtml(s){
    return String(s || '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'","&#39;");
  }

  function clampNum(n, lo, hi){
    const v = Number(n);
    if (!Number.isFinite(v)) return lo;
    return Math.max(lo, Math.min(hi, v));
  }

  function buffMultiplierFromEventBuffs(team){
    const eb = (team && team.eventBuffs && typeof team.eventBuffs === 'object') ? team.eventBuffs : {};
    const aim = clampNum(eb.aim ?? 0, -99, 99);
    const mental = clampNum(eb.mental ?? 0, -99, 99);
    const agi = clampNum(eb.agi ?? 0, -99, 99);

    const mAim = 1 + (aim / 100);
    const mMental = 1 + (mental / 120);
    const mAgi = 1 + (agi / 140);

    return clampNum(mAim * mMental * mAgi, 0.70, 1.35);
  }

  function getPlayerTeam(state){
    const teams = Array.isArray(state?.teams) ? state.teams : [];
    let t = teams.find(x=>!!x?.isPlayer);
    if (!t) t = teams.find(x=>String(x?.id||'') === 'PLAYER');
    if (!t) t = teams.find(x=>String(x?.name||'').toUpperCase().includes('PLAYER'));
    return t || null;
  }

  function computeEventPowerLine(state, payload){
    const pb0 = Number(payload?.powerBefore);
    const pa0 = Number(payload?.powerAfter);
    if (Number.isFinite(pb0) && Number.isFinite(pa0)){
      const d = pa0 - pb0;
      const sign = d >= 0 ? `(+${d}%)` : `(${d}%)`;
      return { before: pb0, after: pa0, delta: d, line: `${pb0}%→${pa0}% ${sign}` };
    }

    const pt = getPlayerTeam(state);
    if (!pt) return { before: null, after: null, delta: null, line: '' };

    const base = clampNum(pt.power ?? 0, 0, 999);
    const mult = buffMultiplierFromEventBuffs(pt);
    const eff = Math.round(base * mult);

    const d = eff - base;
    const sign = d >= 0 ? `(+${d}%)` : `(${d}%)`;

    return { before: base, after: eff, delta: d, line: `${base}%→${eff}% ${sign}` };
  }

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

      setBackdrop(TOURNEY_BACKDROP);
      setSquareBg('');
      setChars('', '');
      setNames('', '');
      hideSplash();

      showSplash(payload?.line1 || '大会会場へ到着！', '');
      setLines(payload?.line1 || '大会会場へ到着！', '', 'NEXTで進行');
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
      hidePanels(); hideSplash(); showCenterStamp(''); setEventIcon('');
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
      setLines(st.ui?.center3?.[0] || 'ローカル大会開幕！', st.ui?.center3?.[1] || '', st.ui?.center3?.[2] || '');

      preloadEventIcons();
      syncSessionBar();
    }finally{
      unlockUI();
    }
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

  async function handleShowTeamList(payload){
    lockUI();
    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels(); hideSplash(); showCenterStamp(''); setEventIcon('');
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

      setLines('本日のチームをご紹介！', '（NEXTで進行）', '');
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handleShowCoachSelect(payload){
    lockUI();
    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels(); hideSplash(); showCenterStamp(''); setEventIcon('');
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

      const equipped = Array.isArray(payload?.equipped) ? payload.equipped : [];
      const master = (payload?.master && typeof payload.master === 'object') ? payload.master : {};

      const wrap = document.createElement('div');
      wrap.className = 'coachWrap';

      const hint = document.createElement('div');
      hint.className = 'coachHint';
      hint.textContent = '装備中のコーチスキルから1つ選択（NEXTで進行）';
      wrap.appendChild(hint);

      const list = document.createElement('div');
      list.className = 'coachList';

      equipped.forEach(id=>{
        const m = master[String(id)] || null;
        const btn = document.createElement('button');
        btn.className = 'coachBtn';
        btn.type = 'button';
        btn.textContent = m ? `${String(id)} / x${m.mult}` : String(id);

        btn.addEventListener('click', ()=>{
          const flow = getFlow();
          if (flow?.setCoachSkill) flow.setCoachSkill(String(id));
          setLines('コーチスキル決定！', m?.quote || '', 'NEXTで進行');
        });

        list.appendChild(btn);
      });

      wrap.appendChild(list);
      showPanel('コーチスキル', wrap);

      setLines(st.ui?.center3?.[0] || 'それでは試合を開始します！', st.ui?.center3?.[1] || '使用するコーチスキルを選択してください！', st.ui?.center3?.[2] || '');
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
      hidePanels(); hideSplash(); showCenterStamp(''); setEventIcon('');
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

      setLines(st.ui?.center3?.[0] || 'バトルスタート！', st.ui?.center3?.[1] || '降下開始…！', st.ui?.center3?.[2] || '');
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
      hidePanels(); hideSplash(); showCenterStamp(''); setEventIcon('');
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
      hidePanels(); hideSplash(); showCenterStamp(''); setEventIcon('');
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
      setLines(`Round ${payload?.round || st.round} 開始！`, '', '');
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
      hidePanels(); hideSplash(); showCenterStamp('');
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
        const l1 = st.ui.center3[0] || 'イベント発生！';
        const l2 = st.ui.center3[1] || '';
        const l3 = st.ui.center3[2] || '';
        setLines(l1, l2, l3);
      }else{
        const l1 = payload?.log1 || 'イベント発生！';
        const l2 = payload?.log2 || '';
        const l3 = payload?.log3 || '';
        setLines(l1, l2, l3);
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
      encounterGatePhase = 1;
      pendingBattleReq = null;
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
      const rightResolved = await resolveFirstExisting(
        guessPlayerImageCandidates(st.ui?.rightImg || '').concat(guessTeamImageCandidates(foeId))
      );

      setNames('', '');
      setChars(leftResolved, '');

      showSplash('接敵‼︎', `${foeName}チームと接敵！`);
      setLines('接敵‼︎', `${foeName}チームと接敵！`, 'NEXTで敵を表示');

      localNextAction = ()=>{
        lockUI();
        try{
          encounterGatePhase = 2;

          showCenterStamp('');
          hideSplash();

          setBattleMode(true);
          setNames(meName, foeName);
          setChars(leftResolved, rightResolved);
          setLines('接敵‼︎', `${meName} vs ${foeName}‼︎`, 'NEXTで交戦開始');

          localNextAction = ()=>{
            lockUI();
            try{
              if (pendingBattleReq){
                const req = pendingBattleReq;
                pendingBattleReq = null;
                encounterGatePhase = 0;
                (async()=>{ await handleShowBattle(req); })();
                return;
              }
              const flow = getFlow();
              if (!flow) return;
              encounterGatePhase = 0;
              flow.step();
              render();
            }finally{
              unlockUI();
            }
          };
        }finally{
          unlockUI();
        }
      };

      syncSessionBar();
    }finally{
      unlockUI();
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

  async function handleShowBattle(payload){
    lockUI();
    busy = true;
    setNextEnabled(false);

    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels(); hideSplash(); setEventIcon('');
      clearHold();

      const st = getState();
      if (!st) return;

      setBattleMode(true);
      setBackdrop(TOURNEY_BACKDROP);

      setResultStampMode(false);
      showCenterStamp(ASSET.brbattle);

      const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st.ui?.leftImg || 'P1.png'));
      const foeId = payload?.foeTeamId || '';
      const rightResolved = await resolveFirstExisting(
        guessPlayerImageCandidates(st.ui?.rightImg || '').concat(guessTeamImageCandidates(foeId))
      );

      const meName = payload?.meName || '';
      const foeName = payload?.foeName || '';
      setNames(meName, foeName);
      setChars(leftResolved, rightResolved);

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
        const winLines = (payload?.final)
          ? ['チャンピオンだ―！！','みんなよくやった！！','獲ったぞー！！']
          : ['よし！次に備えるぞ！','やったー！勝ったぞ！','ナイスー！'];
        setLines('勝利！', winLines[(Math.random()*winLines.length)|0], '');
      }else{
        const loseLines = ['やられた..','次だ次！','負けちまった..'];
        setLines('敗北…', loseLines[(Math.random()*loseLines.length)|0], '');
      }

      await sleep(Number(payload?.holdMs || 2000));

      setResultStampMode(false);

      syncSessionBar();
    }finally{
      busy = false;
      unlockUI();
      setNextEnabled(true);
    }
  }

  async function handleShowMove(payload){
    lockUI();
    busy = true;
    setNextEnabled(false);

    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels(); hideSplash(); showCenterStamp(''); setEventIcon('');
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
        payload?.arrive1 || (payload?.toAreaName ? `${String(payload.toAreaName)}に到着！` : '到着！'),
        payload?.arrive2 || '',
        payload?.arrive3 || ''
      );

      syncSessionBar();
    }finally{
      busy = false;
      unlockUI();
      setNextEnabled(true);
    }
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

  async function handleShowChampion(payload){
    lockUI();
    try{
      setChampionMode(true);
      setResultStampMode(false);
      hidePanels(); hideSplash(); setEventIcon('');
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
        champImg = await resolveFirstExisting(
          guessTeamImageCandidates(champTeam.id).concat(guessPlayerImageCandidates(champTeam?.img || ''))
        );
      }

      setChars(leftResolved, champImg || '');
      setNames('', champName || '');

      setLines(
        payload?.line1 || 'この試合のチャンピオンは…',
        champName || '',
        payload?.line3 || '‼︎'
      );

      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handleShowMatchResult(payload){
    lockUI();
    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels(); hideSplash(); showCenterStamp(''); setEventIcon('');
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

        const place = Number(r.placement ?? 0);
        const teamLabel = `${place ? `#${place} ` : ''}${String(r.squad ?? r.id ?? '')}`;

        tr.innerHTML = `
          <td>${escapeHtml(teamLabel)}</td>
          <td class="num">${escapeHtml(String(r.PlacementP ?? 0))}</td>
          <td class="num">${escapeHtml(String(r.KP ?? 0))}</td>
          <td class="num">${escapeHtml(String(r.AP ?? 0))}</td>
          <td class="num">${escapeHtml(String(r.Treasure ?? 0))}</td>
          <td class="num">${escapeHtml(String(r.Flag ?? 0))}</td>
          <td class="num">${escapeHtml(String(r.Total ?? 0))}</td>
        `;
        tb.appendChild(tr);
      });

      wrap.appendChild(table);
      showPanel(`MATCH ${payload?.matchIndex || ''} RESULT`, wrap);

      setLines('試合結果', '（NEXTで進行）', '');
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
      hidePanels(); hideSplash(); showCenterStamp(''); setEventIcon('');
      resetEncounterGate();
      setHold('showTournamentResult');
      setBattleMode(false);

      setBackdrop(TOURNEY_BACKDROP);
      setSquareBg(ASSET.tent);

      const total = payload?.total || {};
      const arr = Object.values(total);

      arr.sort((a,b)=>{
        const pa = Number(a.sumTotal ?? 0);
        const pb = Number(b.sumTotal ?? 0);
        if (pb !== pa) return pb - pa;
        const ka = Number(a.KP ?? 0), kb = Number(b.KP ?? 0);
        return kb - ka;
      });

      const wrap = document.createElement('div');
      wrap.className = 'tourneyWrap';

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
        const tr = document.createElement('tr');
        const isPlayer = (String(r.id||'') === 'PLAYER') || !!r.isPlayer;
        if (isPlayer) tr.classList.add('isPlayer');

        const teamLabel = `#${i+1} ${String(r.squad ?? r.id ?? '')}`;

        tr.innerHTML = `
          <td>${escapeHtml(teamLabel)}</td>
          <td class="num">${escapeHtml(String(r.sumTotal ?? 0))}</td>
          <td class="num">${escapeHtml(String(r.sumPlacementP ?? 0))}</td>
          <td class="num">${escapeHtml(String(r.KP ?? 0))}</td>
          <td class="num">${escapeHtml(String(r.AP ?? 0))}</td>
          <td class="num">${escapeHtml(String(r.Treasure ?? 0))}</td>
          <td class="num">${escapeHtml(String(r.Flag ?? 0))}</td>
        `;
        tb.appendChild(tr);
      });

      wrap.appendChild(table);
      showPanel('TOURNAMENT RESULT', wrap);

      setLines('大会結果', '（NEXTで進行）', '');
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
      hidePanels(); setEventIcon('');
      resetEncounterGate();
      clearHold();
      setBattleMode(false);

      setBackdrop(TOURNEY_BACKDROP);
      setSquareBg('');

      setChars('', '');
      setNames('', '');
      showCenterStamp('');
      showSplash(payload?.line1 || '', payload?.line2 || '');

      setLines(payload?.line1 || '', payload?.line2 || '', payload?.line3 || 'NEXTで進行');
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handleEndTournament(){
    lockUI();
    try{
      close();
    }finally{
      unlockUI();
    }
  }

  async function handleEndNationalWeek(payload){
    lockUI();
    try{
      close();
    }finally{
      unlockUI();
    }

    try{
      const weeks = Number(payload?.weeks ?? 1) || 1;

      if (window.MOBBR?.ui?.main?.advanceWeeks && typeof window.MOBBR.ui.main.advanceWeeks === 'function'){
        window.MOBBR.ui.main.advanceWeeks(weeks);
        return;
      }
      if (window.MOBBR?.advanceWeeks && typeof window.MOBBR.advanceWeeks === 'function'){
        window.MOBBR.advanceWeeks(weeks);
        return;
      }

      window.dispatchEvent(new CustomEvent('mobbr:endNationalWeek', { detail:{ weeks } }));
    }catch(e){
      console.error('[ui_tournament] endNationalWeek notify error:', e);
    }
  }

  async function handleNextMatch(payload){
    lockUI();
    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels(); hideSplash(); showCenterStamp(''); setEventIcon('');
      resetEncounterGate();
      clearHold();
      setBattleMode(false);

      setBackdrop(TOURNEY_BACKDROP);
      setSquareBg(ASSET.tent);

      setLines('次の試合へ', `MATCH ${payload?.matchIndex || ''} / 5`, 'NEXTで進行');
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function render(){
    ensureDom();

    if (rendering) return;
    rendering = true;
    lockUI();

    try{
      const st = getState();
      const req = st?.request || null;

      syncSessionBar();

      if (holdScreenType){
        if (req && req.type && req.type !== holdScreenType){
          pendingReqAfterHold = req;
          return;
        }
      }

      if (req?.type === 'showBattle' && encounterGatePhase > 0){
        pendingBattleReq = req;
        showCenterStamp('');
        return;
      }

      const key = mkReqKey(req);
      if (key === lastReqKey) return;
      lastReqKey = key;

      clearAutoTimer();
      clearLocalNext();

      if (req?.type !== 'showBattle'){
        setResultStampMode(false);
        showCenterStamp('');
      }

      if (!req || !req.type){
        if (encounterGatePhase === 0) setBattleMode(false);
        setChampionMode(false);
        setResultStampMode(false);
        syncSessionBar();
        return;
      }

      if (req.type === 'showEncounter'){
        setBattleMode(false);
        hidePanels();
        showCenterStamp('');
        hideSplash();
        setChampionMode(false);
        setResultStampMode(false);
      }else{
        const isBattleReq = (req.type === 'showBattle');
        if (encounterGatePhase === 0) setBattleMode(isBattleReq);
        if (req.type !== 'showChampion') setChampionMode(false);
        if (req.type !== 'showBattle') setResultStampMode(false);
      }

      switch(req.type){
        case 'showArrival': await handleShowArrival(req); break;

        case 'showIntroText': await handleShowIntroText(); break;
        case 'showTeamList': await handleShowTeamList(req); break;
        case 'showCoachSelect': await handleShowCoachSelect(req); break;

        case 'showDropStart': await handleShowDropStart(req); break;
        case 'showDropLanded': await handleShowDropLanded(req); break;

        case 'showRoundStart': await handleShowRoundStart(req); break;
        case 'showEvent': await handleShowEvent(req); break;

        case 'prepareBattles': await handlePrepareBattles(req); break;

        case 'showEncounter': await handleShowEncounter(req); break;
        case 'showBattle': await handleShowBattle(req); break;

        case 'showMove': await handleShowMove(req); break;
        case 'showChampion': await handleShowChampion(req); break;

        case 'showMatchResult': await handleShowMatchResult(req); break;
        case 'showTournamentResult': await handleShowTournamentResult(req); break;

        case 'showNationalNotice': await handleShowNationalNotice(req); break;

        case 'endTournament': await handleEndTournament(req); break;
        case 'endNationalWeek': await handleEndNationalWeek(req); break;

        case 'nextMatch': await handleNextMatch(req); break;

        case 'noop':
        default:
          break;
      }

      syncSessionBar();

    }catch(e){
      console.error('[ui_tournament] request handler error:', e);
      busy = false;
      setChampionMode(false);
      setResultStampMode(false);
      if (encounterGatePhase === 0) setBattleMode(false);
      syncSessionBar();
    }finally{
      rendering = false;
      unlockUI();
      setNextEnabled(true);
    }
  }

  window.MOBBR.ui.tournament = { open, close, render };
  window.MOBBR.initTournamentUI = function(){ ensureDom(); };

})();
