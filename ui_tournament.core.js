'use strict';

/* =========================================================
   ui_tournament.core.js（v3.6.10 split-1 FULL）
   - DOM生成 / 共通ユーティリティ / 状態 / 共通UI操作
   - ✅ SKIPボタン廃止（DOMにもロジックにも存在しない）

   ✅ v3.6.10 変更
   - FIX: WORLD FINAL 表記の「AB(1/6)」「MATCH 1/5」ズレを安全に矯正
     * final のときはグループ表記(AB/1/6等)を消す
     * MATCH x/y の y を state.totalMatches 等に合わせる（無ければ world final=12）
   - FIX: result後NEXTが進まない事がある問題のUI側フェイルセーフ
     * flow.step() 前に lastReqKey を必ずクリアして再描画ガードで止まらないようにする
========================================================= */

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){

  // 共有モジュール（他splitから参照）
  const MOD_KEY = '_tournamentMod';
  const MOD = window.MOBBR.ui[MOD_KEY] = window.MOBBR.ui[MOD_KEY] || {};

  // ===== constants =====
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

  // ===== state =====
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

  // ===== getters =====
  function getFlow(){
    return window.MOBBR?.sim?.tournamentFlow || window.MOBBR?.tournamentFlow || null;
  }
  function getState(){
    const f = getFlow();
    return f?.getState ? f.getState() : (f?.state || null);
  }

  // ===== util =====
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

    // イベントバインドは entry 側で行う（splitの責務分離）
    overlay.addEventListener('touchstart', (e)=>{
      if (e.touches && e.touches.length>1) e.preventDefault();
    }, { passive:false });

    return dom;
  }

  // ===== National progress bar =====
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

  // ===== visibility helpers =====
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

  function setBackdrop(src){
    ensureDom();
    dom.backdrop.style.backgroundImage = src ? `url(${src})` : 'none';
  }
  function setSquareBg(src){
    ensureDom();
    dom.squareBg.style.backgroundImage = src ? `url(${src})` : 'none';
  }

  // ===== match total helpers =====
  function getMatchTotalFromState(st){
    const s = st || {};
    const mode = String(s.mode || '').toLowerCase();
    const phase = String(s.phase || s.worldPhase || s.world?.phase || '').toLowerCase();

    const n =
      Number(s.totalMatches ?? s.matchTotal ?? s.matchCount ?? s.matchesTotal ?? s.matchesPerTournament ?? s.maxMatches);

    if (Number.isFinite(n) && n > 0) return n;

    // 補助：logic側があれば使う
    try{
      const g = window.MOBBR?.sim?.tournamentLogic?.guessTotalMatchesByModePhase;
      if (typeof g === 'function'){
        const v = Number(g(mode, phase));
        if (Number.isFinite(v) && v > 0) return v;
      }
    }catch(e){}

    // 最低限の安全デフォルト
    if (mode === 'world' && phase === 'final') return 12;
    return 5;
  }

  function sanitizeWorldFinalBannerText(text, st){
    let s = String(text || '');

    const mode = String(st?.mode || '').toLowerCase();
    const phase = String(st?.phase || st?.worldPhase || st?.world?.phase || '').toLowerCase();
    const isWorldFinal = (mode === 'world' && phase === 'final');

    // finalならグループ表記を出さない（AB / (1/6) 等）
    if (isWorldFinal){
      s = s.replace(/\bAB\b/gi, '').trim();
      // (1/6) / （1/6） / [1/6] などを削除
      s = s.replace(/[\(\（\[]\s*\d+\s*\/\s*\d+\s*[\)\）\]]/g, '').trim();
      // 余分な二重スペース
      s = s.replace(/\s{2,}/g, ' ').trim();
    }

    // MATCH x / y の y を正しい total に合わせる
    const total = getMatchTotalFromState(st);
    s = s.replace(/(MATCH)\s*(\d+)\s*\/\s*(\d+)/i, (m, a, x)=>{
      return `${a} ${x} / ${total}`;
    });

    return s;
  }

  function setBanners(l, r){
    ensureDom();
    const st = getState();

    const left = sanitizeWorldFinalBannerText(l, st);
    const right = sanitizeWorldFinalBannerText(r, st);

    dom.bannerL.textContent = String(left || '');
    dom.bannerR.textContent = String(right || '');
    syncSessionBar();
  }

  function escapeHtml(s){
    return String(s || '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'","&#39;");
  }

  // ===== members formatting =====
  function normalizeRole(role){
    const r = String(role||'').toUpperCase();
    if (r === 'IGL') return 'IGL';
    if (r === 'ATTACKER') return 'ATK';
    if (r === 'SUPPORT') return 'SUP';
    return r ? r.slice(0,3) : 'MEM';
  }

  function formatMembers(members){
    const mem = Array.isArray(members) ? members.slice(0,3) : [];
    if (!mem.length) return '';
    const parts = mem.map((m,i)=>{
      const role = normalizeRole(m?.role || (i===0?'IGL':(i===1?'ATTACKER':'SUPPORT')));
      const name = String(m?.name || '').trim();
      return name ? `${role}:${name}` : '';
    }).filter(Boolean);
    return parts.join(' / ');
  }

  function setNames(l, r){
    ensureDom();
    dom.nameL.textContent = String(l || '');
    dom.nameR.textContent = String(r || '');
    syncEnemyVisibility();
  }

  function setNamesRich(leftTeamName, leftMembers, rightTeamName, rightMembers){
    ensureDom();
    const lTeam = String(leftTeamName||'');
    const rTeam = String(rightTeamName||'');
    const lMem = formatMembers(leftMembers);
    const rMem = formatMembers(rightMembers);

    if (lMem){
      dom.nameL.innerHTML = `<div class="team">${escapeHtml(lTeam)}</div><div class="members">${escapeHtml(lMem)}</div>`;
    }else{
      dom.nameL.textContent = lTeam;
    }

    if (rMem){
      dom.nameR.innerHTML = `<div class="team">${escapeHtml(rTeam)}</div><div class="members">${escapeHtml(rMem)}</div>`;
    }else{
      dom.nameR.textContent = rTeam;
    }

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
    if (t === 'showAutoSession'){
      return `showAutoSession|k:${String(req?.sessionKey||req?.key||'')}`;
    }
    if (t === 'showAutoSessionDone'){
      return `showAutoSessionDone|k:${String(req?.sessionKey||req?.key||'')}`;
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

  function onNextCore(){
    const now = Date.now();
    if (now < nextCooldownUntil) return { consumed:true };
    nextCooldownUntil = now + 220;

    if (isLocked() || rendering || busy) return { consumed:true };

    if (typeof localNextAction === 'function'){
      const fn = localNextAction;
      localNextAction = null;
      try{ fn(); }catch(e){ console.error('[ui_tournament] localNextAction error:', e); }
      return { consumed:true };
    }

    if (holdScreenType){
      if (pendingReqAfterHold){
        holdScreenType = null;
        pendingReqAfterHold = null;
        lastReqKey = '';
        return { consumed:false, shouldRender:true };
      }
      holdScreenType = null;
    }

    const flow = getFlow();
    if (!flow) return { consumed:true };

    // ✅ フェイルセーフ：同じrequestが返っても描画ガードで止まらないようにする
    lastReqKey = '';

    flow.step();
    return { consumed:false, shouldRender:true };
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

  // ===== open/close (core) =====
  function openCore(){
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

    dom.nameR.textContent = '';
    dom.imgR.src = '';
    syncEnemyVisibility();

    preloadBasics();
    preloadEventIcons();

    syncSessionBar();
  }

  function closeCore(){
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

  // ===== expose to module =====
  Object.assign(MOD, {
    // consts
    TOURNEY_BACKDROP,
    ASSET,
    BATTLE_CHAT,

    // state accessors (mutables)
    _getDom: ()=>dom,
    _setDom: (v)=>{ dom=v; },

    // state flags
    _getFlags: ()=>({
      busy, lastReqKey, autoTimer, localNextAction,
      encounterGatePhase, pendingBattleReq,
      holdScreenType, pendingReqAfterHold,
      nextCooldownUntil,
      preloadedBasics, preloadedEventIcons,
      uiLockCount, rendering
    }),
    _setBusy: (v)=>{ busy=!!v; },
    _getBusy: ()=>busy,

    _setLastReqKey: (v)=>{ lastReqKey=String(v||''); },
    _getLastReqKey: ()=>lastReqKey,

    _setAutoTimer: (t)=>{ autoTimer=t; },
    _getAutoTimer: ()=>autoTimer,

    _setLocalNextAction: (fn)=>{ localNextAction=fn||null; },
    _getLocalNextAction: ()=>localNextAction,

    _setEncounterGatePhase: (v)=>{ encounterGatePhase = Number(v||0)|0; },
    _getEncounterGatePhase: ()=>encounterGatePhase,

    _setPendingBattleReq: (v)=>{ pendingBattleReq=v||null; },
    _getPendingBattleReq: ()=>pendingBattleReq,

    _setHoldScreenType: (v)=>{ holdScreenType=v||null; },
    _getHoldScreenType: ()=>holdScreenType,

    _setPendingReqAfterHold: (v)=>{ pendingReqAfterHold=v||null; },
    _getPendingReqAfterHold: ()=>pendingReqAfterHold,

    _setNextCooldownUntil: (v)=>{ nextCooldownUntil=Number(v||0); },
    _getNextCooldownUntil: ()=>nextCooldownUntil,

    _setPreloadedBasics: (v)=>{ preloadedBasics=!!v; },
    _getPreloadedBasics: ()=>preloadedBasics,

    _setPreloadedEventIcons: (v)=>{ preloadedEventIcons=!!v; },
    _getPreloadedEventIcons: ()=>preloadedEventIcons,

    _setUiLockCount: (v)=>{ uiLockCount=Number(v||0)|0; },
    _getUiLockCount: ()=>uiLockCount,

    _setRendering: (v)=>{ rendering=!!v; },
    _getRendering: ()=>rendering,

    // core functions
    getFlow,
    getState,
    sleep,
    shuffle,

    clearAutoTimer,
    clearLocalNext,
    resetEncounterGate,
    setHold,
    clearHold,

    imgExists,
    preloadMany,
    preloadBasics,
    preloadEventIcons,

    lockUI,
    unlockUI,
    isLocked,

    ensureCss,
    ensureDom,

    syncSessionBar,
    syncEnemyVisibility,

    setBattleMode,
    setChampionMode,
    setResultStampMode,

    openCore,
    closeCore,

    setBackdrop,
    setSquareBg,
    setBanners,
    escapeHtml,

    setNames,
    setNamesRich,
    setLines,
    showCenterStamp,
    hidePanels,
    showPanel,
    setEventIcon,
    showSplash,
    hideSplash,
    setChars,

    mkReqKey,
    setNextEnabled,
    onNextCore,

    guessPlayerImageCandidates,
    guessTeamImageCandidates,
    resolveFirstExisting,

    clampNum,
    buffMultiplierFromEventBuffs,
    getPlayerTeam,
    computeEventPowerLine,

    // helpers export（handlers側でも使えるように）
    getMatchTotalFromState,
    sanitizeWorldFinalBannerText
  });

})();
