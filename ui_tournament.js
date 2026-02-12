'use strict';

/*
  ui_tournament.js v3.4.5（フル）
  ✅ 接敵2段階：
      1) 「〇〇チームと接敵！」（敵枠/敵名/敵画像は出さない）
      2) NEXT → 敵名/敵画像を表示（ここでもまだ交戦開始しない）
      3) NEXT → 交戦開始
  ✅ NEW：showBattle を強制ブロック＆保管
      - core が勝手に showBattle を投げても UIは絶対に開始しない
      - その間、Win/Loseスタンプ等が混ざらないよう “毎回クリア”
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

  // ✅ NEXT を「flow.step」ではなく UI 内で処理したい時のフック
  let localNextAction = null;

  // ✅ 接敵ゲート
  // 0:ゲート無し / 1:接敵文のみ（敵枠無し） / 2:敵表示（まだ交戦開始しない）
  let encounterGatePhase = 0;

  // ✅ core が先に showBattle を投げた場合に保管する
  let pendingBattleReq = null;

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

  // ===== CSS loader =====
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

          <img class="eventIcon" id="mobbrTourEventIcon" alt="event" />

          <div class="chars">
            <div class="char left">
              <div class="name" id="mobbrTourNameL"></div>
              <img id="mobbrTourImgL" alt="player" />
            </div>
            <div class="char right">
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
      eventIcon: overlay.querySelector('#mobbrTourEventIcon'),
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

  // ✅交戦時だけ enemy枠を出す（CSSで isBattle を使う前提）
  function setBattleMode(on){
    ensureDom();
    dom.overlay.classList.toggle('isBattle', !!on);
    if (!on){
      dom.nameR.textContent = '';
      dom.imgR.src = '';
    }
  }

  function open(){
    ensureDom();
    dom.overlay.classList.add('isOpen');
    clearLocalNext();
    resetEncounterGate();
    setBattleMode(false);
  }

  function close(){
    clearAutoTimer();
    clearLocalNext();
    resetEncounterGate();
    if (!dom) return;
    dom.overlay.classList.remove('isOpen');
    dom.overlay.classList.remove('isBattle');
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
  }
  function setNames(l, r){
    ensureDom();
    dom.nameL.textContent = String(l || '');
    dom.nameR.textContent = String(r || '');
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
  }

  function mkReqKey(req){
    try{ return JSON.stringify(req || {}); }
    catch{ return String(req?.type || ''); }
  }

  function setNextEnabled(v){
    ensureDom();
    dom.nextBtn.disabled = !v;
    dom.nextBtn.classList.toggle('isDisabled', !v);
  }

  function onNext(){
    if (busy) return;

    // ✅ 接敵段階やUI内NEXT処理がある場合は flow.step しない
    if (typeof localNextAction === 'function'){
      const fn = localNextAction;
      localNextAction = null;
      try{ fn(); }catch(e){ console.error('[ui_tournament] localNextAction error:', e); }
      return;
    }

    const flow = getFlow();
    if (!flow) return;
    flow.step();
    render();
  }

  // ===== image helpers =====
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
    const arr = [];
    arr.push(`${id}.png`);
    arr.push(`cpu/${id}.png`);
    arr.push(`teams/${id}.png`);
    return arr;
  }

  async function resolveFirstExisting(cands){
    const list = (cands || []).filter(Boolean);
    for (const src of list){
      const ok = await imgExists(src);
      if (ok) return src;
    }
    return '';
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

  function escapeHtml(s){
    return String(s || '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'","&#39;");
  }

  // ===== handlers =====

  async function handleShowIntroText(){
    hidePanels(); hideSplash(); showCenterStamp(''); setEventIcon('');
    resetEncounterGate();
    setBattleMode(false);

    const st = getState();
    if (!st) return;

    setBackdrop(TOURNEY_BACKDROP);
    const sq = await resolveFirstExisting([st.ui?.squareBg || ASSET.tent]);
    setSquareBg(sq || ASSET.tent);

    const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st.ui?.leftImg || 'P1.png'));
    setChars(leftResolved, '');
    setNames('', '');

    setBanners(st.bannerLeft, st.bannerRight);
    setLines(st.ui?.center3?.[0] || 'ローカル大会開幕！', st.ui?.center3?.[1] || '', st.ui?.center3?.[2] || '');
    await preloadMany([TOURNEY_BACKDROP, sq, leftResolved]);
    setNextEnabled(true);
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
    hidePanels(); hideSplash(); showCenterStamp(''); setEventIcon('');
    resetEncounterGate();
    setBattleMode(false);

    const st = getState();
    if (!st) return;

    setBackdrop(TOURNEY_BACKDROP);
    const sq = await resolveFirstExisting([st.ui?.squareBg || ASSET.tent]);
    setSquareBg(sq || ASSET.tent);

    const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st.ui?.leftImg || 'P1.png'));
    setChars(leftResolved, '');
    setNames('', '');

    setBanners(st.bannerLeft, st.bannerRight);

    const teams = Array.isArray(payload?.teams) ? payload.teams : (Array.isArray(st.teams) ? st.teams : []);
    const node = buildTeamListTable(teams);
    showPanel('参加チーム', node);

    setLines('本日のチームをご紹介！', '（NEXTで進行）', '');
    await preloadMany([TOURNEY_BACKDROP, sq, leftResolved]);
    setNextEnabled(true);
  }

  async function handleShowDropStart(payload){
    hidePanels(); hideSplash(); showCenterStamp(''); setEventIcon('');
    resetEncounterGate();
    setBattleMode(false);

    const st = getState();
    if (!st) return;

    setBackdrop(TOURNEY_BACKDROP);
    const sq = await resolveFirstExisting([ASSET.tent, st.ui?.squareBg || ASSET.tent]);
    setSquareBg(sq || ASSET.tent);

    setBanners(st.bannerLeft, st.bannerRight);
    setNames('', '');

    const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st.ui?.leftImg || 'P1.png'));
    setChars(leftResolved, '');

    setLines(st.ui?.center3?.[0] || 'バトルスタート！', st.ui?.center3?.[1] || '降下開始…！', st.ui?.center3?.[2] || '');
    await preloadMany([TOURNEY_BACKDROP, ASSET.tent, leftResolved]);
    setNextEnabled(true);
  }

  async function handleShowDropLanded(payload){
    hidePanels(); hideSplash(); showCenterStamp(''); setEventIcon('');
    resetEncounterGate();
    setBattleMode(false);

    const st = getState();
    if (!st) return;

    setBackdrop(TOURNEY_BACKDROP);

    const areaBg = String(payload?.bg || st.ui?.bg || '');
    const areaResolved = await resolveFirstExisting([areaBg]);
    if (areaResolved) setSquareBg(areaResolved);

    setNames('', '');

    const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st.ui?.leftImg || 'P1.png'));
    setChars(leftResolved, '');

    setLines(st.ui?.center3?.[0] || '', st.ui?.center3?.[1] || '', st.ui?.center3?.[2] || '');
    await preloadMany([TOURNEY_BACKDROP, areaResolved, leftResolved]);
    setNextEnabled(true);
  }

  async function handleShowRoundStart(payload){
    hidePanels(); hideSplash(); showCenterStamp(''); setEventIcon('');
    resetEncounterGate();
    setBattleMode(false);

    const st = getState();
    if (!st) return;

    setBackdrop(TOURNEY_BACKDROP);

    setNames('', '');
    const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st.ui?.leftImg || 'P1.png'));
    setChars(leftResolved, '');

    setBanners(st.bannerLeft, st.bannerRight);
    setLines(`Round ${payload?.round || st.round} 開始！`, '', '');
    setNextEnabled(true);
  }

  async function handleShowEvent(payload){
    hidePanels(); hideSplash(); showCenterStamp('');
    resetEncounterGate();
    setBattleMode(false);

    const st = getState();
    setBackdrop(TOURNEY_BACKDROP);

    setNames('', '');
    const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st?.ui?.leftImg || 'P1.png'));
    setChars(leftResolved, '');

    const icon = payload?.icon ? String(payload.icon) : '';
    setEventIcon(icon);

    if (st?.ui?.center3){
      setLines(st.ui.center3[0], st.ui.center3[1], st.ui.center3[2]);
    }else{
      setLines(payload?.log1 || 'イベント発生！', payload?.log2 || '', payload?.log3 || '');
    }

    await preloadMany([icon, leftResolved]);
    setNextEnabled(true);
  }

  // ✅ showEncounter：段階1→NEXT→段階2→NEXT→交戦開始
  async function handleShowEncounter(payload){
    hidePanels(); setEventIcon('');

    const st = getState();
    if (!st) return;

    // ✅ 接敵に入った瞬間に「混ざり」を全消し
    showCenterStamp('');
    hideSplash();
    pendingBattleReq = null;
    encounterGatePhase = 1;

    setBackdrop(TOURNEY_BACKDROP);
    setBanners(st.bannerLeft, st.bannerRight);

    const meName  = payload?.meName || '';
    const foeName = payload?.foeName || '';
    const foeId   = payload?.foeTeamId || '';

    const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st.ui?.leftImg || 'P1.png'));
    const rightResolved = await resolveFirstExisting(
      guessPlayerImageCandidates(st.ui?.rightImg || '').concat(guessTeamImageCandidates(foeId))
    );

    // ===== 段階1：敵枠を出さない（＝右側の枠も出ないように）
    setBattleMode(false);
    setNames('', '');
    setChars(leftResolved, '');

    showSplash('接敵‼︎', `${foeName}チームと接敵！`);
    setLines('接敵‼︎', `${foeName}チームと接敵！`, 'NEXTで敵を表示');

    await preloadMany([leftResolved, rightResolved, ASSET.brbattle, ASSET.brwin, ASSET.brlose]);

    // NEXT → 段階2（敵名/敵画像を表示）
    localNextAction = ()=>{
      encounterGatePhase = 2;

      showCenterStamp(''); // ✅混ざり防止
      hideSplash();

      setBattleMode(true);
      setNames(meName, foeName);
      setChars(leftResolved, rightResolved);
      setLines('接敵‼︎', `${meName} vs ${foeName}‼︎`, 'NEXTで交戦開始');
      setNextEnabled(true);

      // 段階2の次のNEXT：交戦開始（ここで初めて showBattle を通す）
      localNextAction = ()=>{
        // core が既に showBattle を投げてた場合：それを再生
        if (pendingBattleReq){
          const req = pendingBattleReq;
          pendingBattleReq = null;
          encounterGatePhase = 0;
          (async()=>{ await handleShowBattle(req); })();
          return;
        }

        // core がまだ showEncounter のままなら：ここで step して showBattle を取りに行く
        const flow = getFlow();
        if (!flow) return;
        encounterGatePhase = 0;
        flow.step();
        render();
      };
    };

    setNextEnabled(true);
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
    hidePanels(); hideSplash(); setEventIcon('');

    const st = getState();
    if (!st) return;

    setBattleMode(true);

    setBackdrop(TOURNEY_BACKDROP);

    showCenterStamp(ASSET.brbattle);
    setNextEnabled(false);
    busy = true;

    const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st.ui?.leftImg || 'P1.png'));
    const foeId = payload?.foeTeamId || '';
    const rightResolved = await resolveFirstExisting(
      guessPlayerImageCandidates(st.ui?.rightImg || '').concat(guessTeamImageCandidates(foeId))
    );

    const meName = payload?.meName || '';
    const foeName = payload?.foeName || '';
    setNames(meName, foeName);
    setChars(leftResolved, rightResolved);

    await preloadMany([leftResolved, rightResolved, ASSET.brbattle]);

    const chats = pickChats(10);
    for (let i=0;i<chats.length;i++){
      setLines(chats[i], '', '');
      await sleep(140);
      setLines('', '', '');
      await sleep(90);
    }

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

    busy = false;
    setNextEnabled(true);
  }

  // ===== main render =====
  async function render(){
    ensureDom();

    const st = getState();
    const req = st?.request || null;

    // ✅【最重要】接敵ゲート中は showBattle を絶対に通さない
    //   さらに、混ざり防止で stamp をクリアして保管だけする
    if (req?.type === 'showBattle' && encounterGatePhase > 0){
      pendingBattleReq = req;
      showCenterStamp(''); // ✅Lose/Win混ざり根絶
      setNextEnabled(true);
      return; // lastReqKey は更新しない（接敵画面を固定）
    }

    const key = mkReqKey(req);
    if (key === lastReqKey) return;
    lastReqKey = key;

    clearAutoTimer();
    clearLocalNext();

    if (!req || !req.type){
      if (encounterGatePhase === 0) setBattleMode(false);
      setNextEnabled(!busy);
      return;
    }

    try{
      switch(req.type){
        case 'showIntroText': await handleShowIntroText(); break;
        case 'showTeamList': await handleShowTeamList(req); break;

        case 'showDropStart': await handleShowDropStart(req); break;
        case 'showDropLanded': await handleShowDropLanded(req); break;

        case 'showRoundStart': await handleShowRoundStart(req); break;
        case 'showEvent': await handleShowEvent(req); break;

        case 'showEncounter': await handleShowEncounter(req); break;
        case 'showBattle': await handleShowBattle(req); break;

        default:
          // 他のタイプはあなたの既存実装に合わせてここに追加してOK
          setNextEnabled(!busy);
          break;
      }
    }catch(e){
      console.error('[ui_tournament] request handler error:', e);
      busy = false;
      if (encounterGatePhase === 0) setBattleMode(false);
      setNextEnabled(true);
    }
  }

  function initTournamentUI(){
    ensureDom();
  }

  window.MOBBR.ui.tournament = { open, close, render };
  window.MOBBR.initTournamentUI = initTournamentUI;

})();
