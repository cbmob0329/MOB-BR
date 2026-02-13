'use strict';

/*
  ui_tournament.js v3.5.0（フル）
  ✅ 大会画面オープン時に主要画像を事前ロード（ido.png遅延対策）
  ✅ result/総合result中に別requestが割り込まないホールド
  ✅ showEncounter 2段階（NEXTで敵表示→NEXTで交戦開始）
  ✅ NEXT連打デバウンス（220ms）
  ✅ showBattle 取りこぼし対策（Flow側の「1step=1request化」とセット）
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

  // UI内NEXT段階処理
  let localNextAction = null;

  // showBattle を接敵中に通さないゲート
  let encounterGatePhase = 0; // 0:なし / 1:接敵ログ / 2:敵表示
  let pendingBattleReq = null;

  // result等ホールド
  let holdScreenType = null;
  let pendingReqAfterHold = null;

  // NEXT連打デバウンス
  let nextCooldownUntil = 0;

  // 画像プリロード済みフラグ
  let preloadedBasics = false;

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
    // ✅ ここでido.pngを先に温める
    await preloadMany([
      TOURNEY_BACKDROP,
      ASSET.tent,
      ASSET.ido,
      ASSET.brbattle,
      ASSET.brwin,
      ASSET.brlose
    ]);
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

  // 交戦フラグ（CSSで右枠を出す/消す）
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
    clearHold();
    setBattleMode(false);

    // ✅ ここで事前ロード（idoが遅い件の本命）
    preloadBasics();
  }

  function close(){
    clearAutoTimer();
    clearLocalNext();
    resetEncounterGate();
    clearHold();
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
    const now = Date.now();
    if (now < nextCooldownUntil) return;
    nextCooldownUntil = now + 220;

    if (busy) return;

    // UI内部段階があるなら flow.step しない
    if (typeof localNextAction === 'function'){
      const fn = localNextAction;
      localNextAction = null;
      try{ fn(); }catch(e){ console.error('[ui_tournament] localNextAction error:', e); }
      return;
    }

    // ホールド画面中：保管があれば stepせず描画へ
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

  function escapeHtml(s){
    return String(s || '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'","&#39;");
  }

  async function handleShowIntroText(){
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
    setNextEnabled(true);
  }

  async function handleShowCoachSelect(payload){
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
    setNextEnabled(true);
  }

  async function handleShowDropStart(){
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
    setNextEnabled(true);
  }

  async function handleShowDropLanded(payload){
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
    setNextEnabled(true);
  }

  async function handleShowRoundStart(payload){
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
    setNextEnabled(true);
  }

  async function handleShowEvent(payload){
    hidePanels(); hideSplash(); showCenterStamp('');
    resetEncounterGate();
    clearHold();
    setBattleMode(false);

    const st = getState();
    setBackdrop(TOURNEY_BACKDROP);

    const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st?.ui?.leftImg || 'P1.png'));
    setChars(leftResolved, '');
    setNames('', '');

    setEventIcon(payload?.icon ? String(payload.icon) : '');

    if (st?.ui?.center3){
      setLines(st.ui.center3[0], st.ui.center3[1], st.ui.center3[2]);
    }else{
      setLines(payload?.log1 || 'イベント発生！', payload?.log2 || '', payload?.log3 || '');
    }

    setNextEnabled(true);
  }

  async function handlePrepareBattles(){
    // ここは表示用の地ならしだけ
    setBattleMode(false);
    setBackdrop(TOURNEY_BACKDROP);
    setNextEnabled(true);
  }

  // ✅ showEncounter：2段階
  async function handleShowEncounter(payload){
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

    // 段階1：敵を出さない
    setNames('', '');
    setChars(leftResolved, '');

    showSplash('接敵‼︎', `${foeName}チームと接敵！`);
    setLines('接敵‼︎', `${foeName}チームと接敵！`, 'NEXTで敵を表示');

    // 段階2へ
    localNextAction = ()=>{
      encounterGatePhase = 2;

      showCenterStamp('');
      hideSplash();

      setBattleMode(true);
      setNames(meName, foeName);
      setChars(leftResolved, rightResolved);
      setLines('接敵‼︎', `${meName} vs ${foeName}‼︎`, 'NEXTで交戦開始');

      // 段階3：交戦開始（ここでflow.step→showBattleを受け取る）
      localNextAction = ()=>{
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
    clearHold();

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

  async function handleShowMove(payload){
    hidePanels(); hideSplash(); showCenterStamp(''); setEventIcon('');
    resetEncounterGate();
    clearHold();

    const st = getState();
    if (!st) return;

    setBattleMode(false);

    setBackdrop(TOURNEY_BACKDROP);

    // ✅ 事前ロード済みのidoを即出し
    setSquareBg(ASSET.ido);

    const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st.ui?.leftImg || 'P1.png'));
    setChars(leftResolved, '');
    setNames('', '');

    setNextEnabled(false);
    busy = true;

    const toBg = String(payload?.toBg || '');
    const toResolved = await resolveFirstExisting([toBg]);

    setLines(payload?.log1 || '移動中…', payload?.log2 || '', payload?.log3 || '');
    await sleep(380);

    if (toResolved) setSquareBg(toResolved);

    setLines(
      payload?.arrive1 || '到着！',
      payload?.arrive2 || (payload?.toName ? String(payload.toName) : ''),
      payload?.arrive3 || ''
    );

    busy = false;
    setNextEnabled(true);
  }

  async function handleShowChampion(payload){
    hidePanels(); hideSplash(); setEventIcon('');
    resetEncounterGate();
    clearHold();
    setBattleMode(false);

    setBackdrop(TOURNEY_BACKDROP);
    setLines(payload?.line1 || 'この試合のチャンピオンは…', payload?.line2 || String(payload?.championName || ''), payload?.line3 || '‼︎');
    setNextEnabled(true);
  }

  async function handleShowMatchResult(payload){
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
          <th>RANK</th>
          <th>TEAM</th>
          <th class="num">K</th>
          <th class="num">TRE</th>
          <th class="num">FLG</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tb = table.querySelector('tbody');

    srcRows.forEach(r=>{
      const tr = document.createElement('tr');
      const isPlayer = (String(r.id||'') === 'PLAYER') || !!r.isPlayer;
      if (isPlayer) tr.classList.add('isPlayer');

      tr.innerHTML = `
        <td>${escapeHtml(String(r.placement ?? ''))}</td>
        <td>${escapeHtml(String(r.squad ?? r.id ?? ''))}</td>
        <td class="num">${escapeHtml(String(r.KP ?? 0))}</td>
        <td class="num">${escapeHtml(String(r.Treasure ?? 0))}</td>
        <td class="num">${escapeHtml(String(r.Flag ?? 0))}</td>
      `;
      tb.appendChild(tr);
    });

    wrap.appendChild(table);
    showPanel(`MATCH ${payload?.matchIndex || ''} 結果`, wrap);

    setLines('試合結果', '（NEXTで進行）', '');
    setNextEnabled(true);
  }

  async function handleShowTournamentResult(payload){
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
          <th>RANK</th>
          <th>TEAM</th>
          <th class="num">PT</th>
          <th class="num">K</th>
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

      tr.innerHTML = `
        <td>${escapeHtml(String(i+1))}</td>
        <td>${escapeHtml(String(r.squad ?? r.id ?? ''))}</td>
        <td class="num">${escapeHtml(String(r.sumTotal ?? 0))}</td>
        <td class="num">${escapeHtml(String(r.KP ?? 0))}</td>
        <td class="num">${escapeHtml(String(r.Treasure ?? 0))}</td>
        <td class="num">${escapeHtml(String(r.Flag ?? 0))}</td>
      `;
      tb.appendChild(tr);
    });

    wrap.appendChild(table);
    showPanel('トーナメント総合', wrap);

    setLines('大会結果', 'お疲れ様！', '');
    setNextEnabled(true);
  }

  async function handleNextMatch(payload){
    hidePanels(); hideSplash(); showCenterStamp(''); setEventIcon('');
    resetEncounterGate();
    clearHold();
    setBattleMode(false);

    setBackdrop(TOURNEY_BACKDROP);
    setSquareBg(ASSET.tent);

    setLines('次の試合へ', `MATCH ${payload?.matchIndex || ''} / 5`, 'NEXTで進行');
    setNextEnabled(true);
  }

  async function render(){
    ensureDom();

    const st = getState();
    const req = st?.request || null;

    // ✅ ホールド中は別requestを描画しない（保管）
    if (holdScreenType){
      if (req && req.type && req.type !== holdScreenType){
        pendingReqAfterHold = req;
        setNextEnabled(true);
        return;
      }
    }

    // ✅ 接敵中はshowBattleを通さない（保管）
    if (req?.type === 'showBattle' && encounterGatePhase > 0){
      pendingBattleReq = req;
      showCenterStamp('');
      setNextEnabled(true);
      return;
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

    if (req.type === 'showEncounter'){
      setBattleMode(false);
      hidePanels();
      showCenterStamp('');
      hideSplash();
    }else{
      const isBattleReq = (req.type === 'showBattle');
      if (encounterGatePhase === 0) setBattleMode(isBattleReq);
    }

    try{
      switch(req.type){
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

        case 'nextMatch': await handleNextMatch(req); break;

        case 'noop':
        default:
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

  window.MOBBR.ui.tournament = { open, close, render };
  window.MOBBR.initTournamentUI = function(){ ensureDom(); };

})();
