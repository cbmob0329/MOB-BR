'use strict';

/*
  ui_tournament.js v3.1.1（フル）
  ✅ sim_tournament_flow.js v3.1 の state.request に対応
  ✅ HTMLを触れない前提：このJSがUI DOMとCSSを自動生成
  ✅ 要件
   - 「本日のチームをご紹介！」→チーム一覧スクロール→NEXTで進む（逆転バグ防止）
   - 試合開始後はチーム紹介UIを消す（以後出さない）
   - 交戦前：接敵演出中に画像プリロード → 完了後に自動で交戦開始
   - 交戦ログ（高速切替）終了後に勝敗演出→2秒→NEXT
   - 移動：ido.png → 次エリア背景が読み込めてから到着
   - 画像：背景/左プレイヤー/右敵/中央ログ枠
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){

  const $ = (sel, root=document) => root.querySelector(sel);

  const ASSET = {
    // square backgrounds (root)
    tent: 'tent.png',
    ido: 'ido.png',

    // battle overlays (center top)
    brbattle: 'brbattle.png',
    brwin: 'brwin.png',
    brlose: 'brlose.png',

    // event icons
    bup: 'bup.png',
    bdeba: 'bdeba.png',
    bgeta: 'bgeta.png',
    bgetb: 'bgetb.png'
  };

  // battle chatter (10 picks, sequential fast display)
  const BATTLE_CHAT = [
    'やってやんべ！','裏取るぞ！','展開する！','サポートするぞ！','うわあー！',
    'ミスった！','一気に行くぞ！','今のうちに回復だ！','絶対勝つぞ！','撃て―！',
    'なんて動きだ！','撃ちまくれ！','グレ使う！','グレ投げろ！','リロードする！',
    '被弾した！','カバー頼む！','大丈夫か!?','走れーー！','耐えるぞー！'
  ];

  // ===== helpers（★v3.1 で不足してた分を内蔵）=====
  function clamp(n, lo, hi){
    n = Number(n);
    if (!Number.isFinite(n)) n = lo;
    return Math.max(lo, Math.min(hi, n));
  }
  function shuffle(arr){
    const a = (arr || []).slice();
    for (let i=a.length-1;i>0;i--){
      const j = (Math.random()*(i+1))|0;
      [a[i],a[j]] = [a[j],a[i]];
    }
    return a;
  }

  // UI runtime
  let dom = null;
  let lastReqKey = '';
  let busy = false;
  let autoTimer = null;

  function clearAutoTimer(){
    if (autoTimer){
      clearTimeout(autoTimer);
      autoTimer = null;
    }
  }

  function ensureCss(){
    if ($('#mobbrTournamentCss')) return;
    const st = document.createElement('style');
    st.id = 'mobbrTournamentCss';
    st.textContent = `
      :root{
        --mobbr-ui-bg: rgba(0,0,0,.55);
        --mobbr-ui-line: rgba(255,255,255,.18);
        --mobbr-ui-white: #fff;
      }
      #mobbrTournamentOverlay{
        position: fixed; inset: 0;
        display: none;
        z-index: 9999;
        background: rgba(0,0,0,.65);
        -webkit-tap-highlight-color: transparent;
      }
      #mobbrTournamentOverlay.isOpen{ display:block; }
      #mobbrTournamentOverlay .stage{
        position:absolute; inset:0;
        display:flex; align-items:center; justify-content:center;
        padding: 12px;
      }
      #mobbrTournamentOverlay .backdrop{
        position:absolute; inset:0;
        background-size: cover;
        background-position: center;
        opacity: 1;
        filter: saturate(1.05) contrast(1.05);
      }
      #mobbrTournamentOverlay .fadeIn{
        animation: mobbrFadeIn .28s ease-out both;
      }
      @keyframes mobbrFadeIn{ from{opacity:0} to{opacity:1} }

      #mobbrTournamentOverlay .hud{
        position:relative;
        width:min(92vw, 420px);
        aspect-ratio: 1 / 1;
        border-radius: 18px;
        overflow:hidden;
        box-shadow: 0 14px 40px rgba(0,0,0,.55);
        border: 1px solid rgba(255,255,255,.12);
        background: rgba(0,0,0,.25);
      }
      #mobbrTournamentOverlay .squareBg{
        position:absolute; inset:0;
        background-size: cover;
        background-position: center;
        opacity: 1;
      }

      #mobbrTournamentOverlay .banner{
        position:absolute; left:0; right:0; top:0;
        display:flex; justify-content:space-between; gap:10px;
        padding: 10px 12px;
        font-weight: 800;
        letter-spacing:.04em;
        color: rgba(255,255,255,.95);
        text-shadow: 0 2px 8px rgba(0,0,0,.6);
        pointer-events:none;
      }
      #mobbrTournamentOverlay .banner .left{ font-size:14px; }
      #mobbrTournamentOverlay .banner .right{ font-size:13px; opacity:.92; }

      #mobbrTournamentOverlay .fighters{
        position:absolute; left:0; right:0; top:46px; bottom:102px;
        display:flex; align-items:flex-end; justify-content:space-between;
        padding: 0 10px;
      }
      #mobbrTournamentOverlay .fighter{
        width: 42%;
        height: 100%;
        position:relative;
        display:flex; flex-direction:column;
        justify-content:flex-end;
        gap:6px;
      }
      #mobbrTournamentOverlay .fighter.right{ align-items:flex-end; }
      #mobbrTournamentOverlay .nameTag{
        font-weight: 900;
        font-size: 12px;
        color: rgba(255,255,255,.96);
        text-shadow: 0 2px 8px rgba(0,0,0,.65);
        max-width: 100%;
        white-space: nowrap;
        overflow:hidden;
        text-overflow: ellipsis;
      }
      #mobbrTournamentOverlay .charImg{
        width: 100%;
        max-height: 92%;
        object-fit: contain;
        image-rendering: pixelated;
        filter: drop-shadow(0 6px 10px rgba(0,0,0,.55));
      }

      #mobbrTournamentOverlay .centerOver{
        position:absolute; left:0; right:0; top:52px;
        display:flex; align-items:center; justify-content:center;
        pointer-events:none;
      }
      #mobbrTournamentOverlay .centerOver img{
        width: 46%;
        max-width: 220px;
        image-rendering: pixelated;
        filter: drop-shadow(0 6px 10px rgba(0,0,0,.6));
        opacity: 0;
        transform: translateY(-8px) scale(.96);
        transition: opacity .18s ease, transform .18s ease;
      }
      #mobbrTournamentOverlay .centerOver img.show{
        opacity: 1;
        transform: translateY(0) scale(1);
      }

      #mobbrTournamentOverlay .dialog{
        position:absolute; left:10px; right:10px; bottom:10px;
        border-radius: 16px;
        background: rgba(0,0,0,.55);
        border: 1px solid rgba(255,255,255,.14);
        padding: 10px 12px 12px;
        color: rgba(255,255,255,.95);
      }
      #mobbrTournamentOverlay .dialog .lines{
        min-height: 56px;
        display:flex; flex-direction:column; gap:4px;
      }
      #mobbrTournamentOverlay .dialog .line{
        font-weight: 800;
        font-size: 14px;
        letter-spacing:.02em;
        text-shadow: 0 2px 8px rgba(0,0,0,.65);
        line-height: 1.22;
        word-break: keep-all;
      }
      #mobbrTournamentOverlay .dialog .mini{
        font-weight: 700;
        opacity: .95;
      }

      #mobbrTournamentOverlay .controls{
        display:flex; justify-content:flex-end; margin-top:8px;
      }
      #mobbrTournamentOverlay .btnNext{
        appearance:none; border:0;
        background: rgba(255,255,255,.92);
        color: #111;
        font-weight: 900;
        border-radius: 14px;
        padding: 10px 14px;
        font-size: 14px;
        letter-spacing:.06em;
        box-shadow: 0 10px 24px rgba(0,0,0,.35);
      }
      #mobbrTournamentOverlay .btnNext:disabled{
        opacity:.45;
      }

      /* Panels (team list / coach select / result) */
      #mobbrTournamentOverlay .panel{
        position:absolute; left:10px; right:10px; top:58px; bottom:108px;
        border-radius: 16px;
        background: rgba(0,0,0,.55);
        border: 1px solid rgba(255,255,255,.14);
        overflow:hidden;
        display:none;
      }
      #mobbrTournamentOverlay .panel.isOn{ display:block; }
      #mobbrTournamentOverlay .panel .panelHead{
        padding: 10px 12px;
        font-weight: 900;
        color: rgba(255,255,255,.96);
        border-bottom: 1px solid rgba(255,255,255,.14);
        background: rgba(255,255,255,.06);
      }
      #mobbrTournamentOverlay .panel .panelBody{
        position:absolute; left:0; right:0; top:42px; bottom:0;
        overflow:hidden;
      }

      /* team list scroll */
      #mobbrTournamentOverlay .teamScroll{
        position:absolute; left:0; right:0; top:0; bottom:0;
        overflow:hidden;
      }
      #mobbrTournamentOverlay .teamList{
        position:absolute; left:0; right:0; top:0;
        padding: 10px 10px 18px;
      }
      #mobbrTournamentOverlay .teamRow{
        display:flex; justify-content:space-between; gap:8px;
        padding: 10px 10px;
        border-bottom: 1px solid rgba(255,255,255,.12);
        color: rgba(255,255,255,.95);
        font-weight: 900;
      }
      #mobbrTournamentOverlay .teamRow .nm{
        flex:1;
        overflow:hidden; white-space:nowrap; text-overflow: ellipsis;
      }
      #mobbrTournamentOverlay .teamRow .pw{
        width: 56px;
        text-align:right;
        opacity:.95;
      }

      /* coach */
      #mobbrTournamentOverlay .coachGrid{
        padding: 10px;
        display:flex; flex-direction:column; gap:8px;
        overflow:auto;
        height:100%;
        -webkit-overflow-scrolling: touch;
      }
      #mobbrTournamentOverlay .coachBtn{
        display:flex; justify-content:space-between; gap:10px;
        border: 1px solid rgba(255,255,255,.16);
        background: rgba(255,255,255,.08);
        border-radius: 14px;
        padding: 10px 12px;
        color: rgba(255,255,255,.96);
        font-weight: 900;
      }
      #mobbrTournamentOverlay .coachBtn .id{ opacity:.95; }
      #mobbrTournamentOverlay .coachBtn .tag{ opacity:.85; font-weight:800; }

      /* result table */
      #mobbrTournamentOverlay .resultWrap{
        width:100%;
        height:100%;
        overflow:auto;
        -webkit-overflow-scrolling: touch;
      }
      #mobbrTournamentOverlay table{
        width:100%;
        border-collapse: collapse;
        font-size: 12px;
        color: rgba(255,255,255,.95);
      }
      #mobbrTournamentOverlay th, #mobbrTournamentOverlay td{
        padding: 8px 8px;
        border-bottom: 1px solid rgba(255,255,255,.12);
        text-align: left;
        white-space: nowrap;
      }
      #mobbrTournamentOverlay th{
        position: sticky;
        top: 0;
        background: rgba(0,0,0,.55);
        z-index: 1;
        font-weight: 900;
      }
      #mobbrTournamentOverlay td.num{ text-align:right; }

      /* event icon */
      #mobbrTournamentOverlay .eventIcon{
        position:absolute; left:14px; top:64px;
        width:44px; height:44px;
        image-rendering: pixelated;
        filter: drop-shadow(0 6px 10px rgba(0,0,0,.65));
        display:none;
        opacity: .98;
      }
      #mobbrTournamentOverlay .eventIcon.isOn{ display:block; }

      /* big splash text (encounter) */
      #mobbrTournamentOverlay .splash{
        position:absolute; inset:0;
        display:none;
        align-items:center;
        justify-content:center;
        flex-direction:column;
        gap:10px;
        background: rgba(0,0,0,.35);
        pointer-events:none;
      }
      #mobbrTournamentOverlay .splash.isOn{ display:flex; }
      #mobbrTournamentOverlay .splash .t1{
        font-size: 28px;
        font-weight: 1000;
        letter-spacing:.08em;
        color: rgba(255,255,255,.98);
        text-shadow: 0 6px 18px rgba(0,0,0,.65);
      }
      #mobbrTournamentOverlay .splash .t2{
        font-size: 16px;
        font-weight: 1000;
        letter-spacing:.06em;
        color: rgba(255,255,255,.98);
        text-shadow: 0 6px 18px rgba(0,0,0,.65);
      }
    `;
    document.head.appendChild(st);
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

          <div class="fighters">
            <div class="fighter left">
              <div class="nameTag" id="mobbrTourNameL"></div>
              <img class="charImg" id="mobbrTourImgL" alt="player" />
            </div>
            <div class="fighter right">
              <div class="nameTag" id="mobbrTourNameR"></div>
              <img class="charImg" id="mobbrTourImgR" alt="enemy" />
            </div>
          </div>

          <div class="centerOver">
            <img id="mobbrTourCenterStamp" alt="center" />
          </div>

          <div class="panel" id="mobbrTourPanel">
            <div class="panelHead" id="mobbrTourPanelHead"></div>
            <div class="panelBody" id="mobbrTourPanelBody"></div>
          </div>

          <div class="splash" id="mobbrTourSplash">
            <div class="t1" id="mobbrTourSplash1"></div>
            <div class="t2" id="mobbrTourSplash2"></div>
          </div>

          <div class="dialog">
            <div class="lines">
              <div class="line" id="mobbrTourLine1"></div>
              <div class="line mini" id="mobbrTourLine2"></div>
              <div class="line mini" id="mobbrTourLine3"></div>
            </div>
            <div class="controls">
              <button class="btnNext" id="mobbrTourNext">NEXT</button>
            </div>
          </div>
        </div>
      </div>
    `;
    document.body.appendChild(overlay);

    dom = {
      overlay,
      backdrop: $('#mobbrTourBackdrop', overlay),
      squareBg: $('#mobbrTourSquareBg', overlay),
      bannerL: $('#mobbrTourBannerL', overlay),
      bannerR: $('#mobbrTourBannerR', overlay),
      nameL: $('#mobbrTourNameL', overlay),
      nameR: $('#mobbrTourNameR', overlay),
      imgL: $('#mobbrTourImgL', overlay),
      imgR: $('#mobbrTourImgR', overlay),
      line1: $('#mobbrTourLine1', overlay),
      line2: $('#mobbrTourLine2', overlay),
      line3: $('#mobbrTourLine3', overlay),
      next: $('#mobbrTourNext', overlay),
      centerStamp: $('#mobbrTourCenterStamp', overlay),
      panel: $('#mobbrTourPanel', overlay),
      panelHead: $('#mobbrTourPanelHead', overlay),
      panelBody: $('#mobbrTourPanelBody', overlay),
      eventIcon: $('#mobbrTourEventIcon', overlay),
      splash: $('#mobbrTourSplash', overlay),
      splash1: $('#mobbrTourSplash1', overlay),
      splash2: $('#mobbrTourSplash2', overlay)
    };

    dom.next.addEventListener('click', onNext);

    return dom;
  }

  function getFlow(){
    return window.MOBBR?.sim?.tournamentFlow || null;
  }

  function getState(){
    const flow = getFlow();
    return flow ? flow.getState() : null;
  }

  function open(){
    const d = ensureDom();
    d.overlay.classList.add('isOpen');
    d.backdrop.classList.add('fadeIn');
    busy = false;
    clearAutoTimer();
  }

  function close(){
    if (!dom) return;
    dom.overlay.classList.remove('isOpen');
    busy = false;
    clearAutoTimer();
  }

  function setNextEnabled(on){
    ensureDom();
    dom.next.disabled = !on;
  }

  function setLines(a,b,c){
    ensureDom();
    dom.line1.textContent = String(a || '');
    dom.line2.textContent = String(b || '');
    dom.line3.textContent = String(c || '');
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

  function setBackdrop(img){
    ensureDom();
    const v = String(img || '');
    dom.backdrop.style.backgroundImage = v ? `url("${v}")` : '';
  }

  function setSquareBg(img){
    ensureDom();
    const v = String(img || '');
    dom.squareBg.style.backgroundImage = v ? `url("${v}")` : '';
  }

  function showCenterStamp(src){
    ensureDom();
    const v = String(src || '');
    dom.centerStamp.src = v || '';
    dom.centerStamp.classList.toggle('show', !!v);
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

  // ===== image preload =====
  function preloadOne(src){
    return new Promise((resolve)=>{
      if (!src){ resolve(true); return; }
      const img = new Image();
      img.onload = ()=> resolve(true);
      img.onerror = ()=> resolve(false);
      img.src = src;
    });
  }

  async function preloadMany(list){
    const uniq = Array.from(new Set((list||[]).map(x=>String(x||'')).filter(Boolean)));
    if (!uniq.length) return;
    await Promise.all(uniq.map(preloadOne));
  }

  function setChars(leftSrc, rightSrc){
    ensureDom();
    dom.imgL.src = leftSrc ? String(leftSrc) : '';
    dom.imgR.src = rightSrc ? String(rightSrc) : '';
  }

  function mkReqKey(req){
    try{
      return JSON.stringify(req || {});
    }catch{
      return String(req?.type || '');
    }
  }

  function onNext(){
    if (busy) return;

    const flow = getFlow();
    if (!flow) return;

    // UI側は「次へ押下」＝ step() で進める
    flow.step();
    render();
  }

  // ===== request handlers =====
  async function handleShowIntroText(){
    hidePanels();
    hideSplash();
    showCenterStamp('');
    setEventIcon('');

    const st = getState();
    if (!st) return;

    setBackdrop(st.ui?.bg || 'maps/neonmain.png');
    setSquareBg(st.ui?.squareBg || ASSET.tent);

    setBanners(st.bannerLeft, st.bannerRight);
    setNames('', '');
    setChars(st.ui?.leftImg || '', '');
    setLines(st.ui?.center3?.[0] || '本日のチームをご紹介！', st.ui?.center3?.[1] || '', st.ui?.center3?.[2] || '');

    await preloadMany([st.ui?.bg, st.ui?.squareBg, st.ui?.leftImg]);
    setNextEnabled(true);
  }

  async function handleShowTeamList(payload){
    hideSplash();
    showCenterStamp('');
    setEventIcon('');

    const st = getState();
    if (!st) return;

    // panel: scroll list
    const wrap = document.createElement('div');
    wrap.className = 'teamScroll';

    const list = document.createElement('div');
    list.className = 'teamList';

    const teams = Array.isArray(payload?.teams)
      ? payload.teams
      : (st.teams || []).map(t=>({ id:t.id, name:t.name, power:t.power, isPlayer:t.isPlayer }));

    for (const t of teams){
      const row = document.createElement('div');
      row.className = 'teamRow';
      const nm = document.createElement('div');
      nm.className = 'nm';
      nm.textContent = t.isPlayer ? `★ ${t.name}` : `${t.name}`;
      const pw = document.createElement('div');
      pw.className = 'pw';
      pw.textContent = `${Math.round(Number(t.power||0))}%`;
      row.appendChild(nm);
      row.appendChild(pw);
      list.appendChild(row);
    }

    wrap.appendChild(list);
    showPanel('出場チーム（スクロール）', wrap);

    // start auto scroll
    busy = true;
    setNextEnabled(false);

    await new Promise(r=>requestAnimationFrame(r));

    const viewH = wrap.clientHeight || 1;
    const contentH = list.scrollHeight || 1;
    const maxY = Math.max(0, contentH - viewH);
    const duration = clamp(6500 + maxY * 6, 6500, 14000); // 6ms/px
    const start = performance.now();

    function tick(now){
      const t = clamp((now - start) / duration, 0, 1);
      const y = Math.round(maxY * t);
      list.style.transform = `translateY(${-y}px)`;
      if (t < 1){
        requestAnimationFrame(tick);
      }else{
        busy = false;
        setNextEnabled(true);
      }
    }
    requestAnimationFrame(tick);
  }

  async function handleShowCoachSelect(payload){
    hideSplash();
    showCenterStamp('');
    setEventIcon('');

    const st = getState();
    if (!st) return;

    const equipped = Array.isArray(payload?.equipped) ? payload.equipped : [];
    const master = payload?.master || {};

    const box = document.createElement('div');
    box.className = 'coachGrid';

    function addBtn(id, label, tag){
      const b = document.createElement('button');
      b.type = 'button';
      b.className = 'coachBtn';
      b.innerHTML = `<span class="id">${label}</span><span class="tag">${tag||''}</span>`;
      b.addEventListener('click', async ()=>{
        if (busy) return;
        busy = true;
        setNextEnabled(false);

        const flow = getFlow();
        if (flow?.setCoachSkill) flow.setCoachSkill(id);

        const quote = master?.[id]?.quote || (id ? '了解！' : '今回は使わない');
        setLines('コーチスキル発動！', quote, '');
        hidePanels();

        await sleep(900);
        busy = false;

        if (flow?.step){
          flow.step();
          render();
        }
      });
      box.appendChild(b);
    }

    addBtn('', '使わない', '');

    for (const id of equipped){
      const m = master?.[id];
      const tag = m?.endgame ? 'R5/R6のみ' : '常時';
      addBtn(id, id, tag);
    }

    showPanel('コーチスキル選択', box);
    setNextEnabled(false);
  }

  async function handleShowDropStart(){
    hidePanels();
    hideSplash();
    showCenterStamp('');
    setEventIcon('');

    const st = getState();
    if (!st) return;

    setBackdrop('maps/neonmain.png');
    setSquareBg(ASSET.tent);

    setBanners(st.bannerLeft, st.bannerRight);
    setNames('', '');
    setChars(st.ui?.leftImg || '', '');
    setLines(st.ui?.center3?.[0] || 'バトルスタート！', st.ui?.center3?.[1] || '降下開始…！', st.ui?.center3?.[2] || '');

    await preloadMany(['maps/neonmain.png', ASSET.tent, st.ui?.leftImg]);
    setNextEnabled(true);
  }

  async function handleShowDropLanded(payload){
    hidePanels();
    hideSplash();
    showCenterStamp('');
    setEventIcon('');

    const st = getState();
    if (!st) return;

    const bg = payload?.bg || st.ui?.bg || '';
    setBackdrop(bg);
    setSquareBg('');
    setChars(st.ui?.leftImg || '', '');
    setNames('', '');

    setLines(st.ui?.center3?.[0] || '', st.ui?.center3?.[1] || '', st.ui?.center3?.[2] || '');
    await preloadMany([bg, st.ui?.leftImg]);
    setNextEnabled(true);
  }

  async function handleShowRoundStart(payload){
    hidePanels();
    hideSplash();
    showCenterStamp('');
    setEventIcon('');

    const st = getState();
    if (!st) return;

    setBanners(st.bannerLeft, st.bannerRight);
    setLines(`Round ${payload?.round || st.round} 開始！`, '', '');
    setNextEnabled(true);
  }

  async function handleShowEvent(payload){
    hidePanels();
    hideSplash();
    showCenterStamp('');

    const icon = payload?.icon ? String(payload.icon) : '';
    setEventIcon(icon);

    const st = getState();
    if (st?.ui?.center3){
      setLines(st.ui.center3[0], st.ui.center3[1], st.ui.center3[2]);
    }else{
      setLines(payload?.log1 || 'イベント発生！', payload?.log2 || '', payload?.log3 || '');
    }

    await preloadMany([icon]);
    setNextEnabled(true);
  }

  async function handlePrepareBattles(){
    setNextEnabled(true);
  }

  async function handleCpuBattleSilent(){
    const flow = getFlow();
    if (!flow) return;
    flow.step();
    render();
  }

  async function handleShowEncounter(payload){
    hidePanels();
    showCenterStamp('');
    setEventIcon('');

    const st = getState();
    if (!st) return;

    setBanners(st.bannerLeft, st.bannerRight);

    const meName = payload?.meName || '';
    const foeName = payload?.foeName || '';
    setNames(meName, foeName);

    const leftSrc = st.ui?.leftImg || '';
    const rightSrc = st.ui?.rightImg || (payload?.foeTeamId ? `${payload.foeTeamId}.png` : '');

    setChars(leftSrc, rightSrc);

    showSplash('接敵‼︎', `${meName} vs ${foeName}‼︎`);
    setLines('接敵‼︎', `${meName} vs ${foeName}‼︎`, 'ロード中…');
    setNextEnabled(false);
    busy = true;

    await preloadMany([
      leftSrc, rightSrc,
      ASSET.brbattle, ASSET.brwin, ASSET.brlose
    ]);

    setLines('接敵‼︎', `${meName} vs ${foeName}‼︎`, '交戦スタート‼︎');
    await sleep(520);
    hideSplash();

    busy = false;

    const flow = getFlow();
    if (flow?.step){
      flow.step();
      render();
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
    hidePanels();
    hideSplash();
    setEventIcon('');

    const st = getState();
    if (!st) return;

    showCenterStamp(ASSET.brbattle);
    setNextEnabled(false);
    busy = true;

    const leftSrc = st.ui?.leftImg || '';
    const rightSrc = st.ui?.rightImg || '';
    await preloadMany([leftSrc, rightSrc, ASSET.brbattle]);

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

  async function handlePlayerEliminatedFastForward(){
    setNextEnabled(false);
    busy = true;
    setLines('全滅…', 'この試合はここで終了！', '残りは自動で進行します');
    await sleep(600);

    const flow = getFlow();
    if (!flow) { busy=false; return; }

    flow.step();
    busy = false;
    render();
  }

  async function handleShowMove(payload){
    hidePanels();
    hideSplash();
    showCenterStamp('');
    setEventIcon('');

    const st = getState();
    if (!st) return;

    setBackdrop(ASSET.ido);
    setSquareBg('');
    setNames('', '');
    setChars(st.ui?.leftImg || '', '');
    setLines('安置が縮む…移動開始！', 'ルート変更。急げ！', '');
    setNextEnabled(false);
    busy = true;

    const toBg = String(payload?.toBg || '');
    await preloadMany([ASSET.ido, toBg, st.ui?.leftImg]);

    setBackdrop(toBg);
    setLines(`${payload?.toAreaName || '到着！'}へ到着！`, '', '');
    busy = false;
    setNextEnabled(true);
  }

  async function handleShowArrive(payload){
    hidePanels();
    hideSplash();
    showCenterStamp('');
    setEventIcon('');

    const st = getState();
    const bg = payload?.bg || st?.ui?.bg || '';
    if (bg){
      await preloadMany([bg]);
      setBackdrop(bg);
    }
    setLines(`${payload?.areaName || '到着！'}へ到着！`, '', '');
    setNextEnabled(true);
  }

  async function handleShowMatchResult(payload){
    hideSplash();
    showCenterStamp('');
    setEventIcon('');

    const st = getState();
    if (!st) return;

    setBackdrop('battle.png');
    setSquareBg('');

    const rows = Array.isArray(payload?.rows) ? payload.rows : (st.lastMatchResultRows || []);
    const wrap = document.createElement('div');
    wrap.className = 'resultWrap';

    const table = document.createElement('table');
    table.innerHTML = `
      <thead>
        <tr>
          <th>Placement</th>
          <th>Squad</th>
          <th class="num">KP</th>
          <th class="num">AP</th>
          <th class="num">Treasure</th>
          <th class="num">Flag</th>
          <th class="num">Total</th>
          <th class="num">PlacementP</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tb = table.querySelector('tbody');

    for (const r of rows){
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${r.placement}</td>
        <td>${escapeHtml(r.squad || '')}</td>
        <td class="num">${r.KP}</td>
        <td class="num">${r.AP}</td>
        <td class="num">${r.Treasure}</td>
        <td class="num">${r.Flag}</td>
        <td class="num">${r.Total}</td>
        <td class="num">${r.PlacementP}</td>
      `;
      tb.appendChild(tr);
    }

    wrap.appendChild(table);
    showPanel(`RESULT（MATCH ${payload?.matchIndex || st.matchIndex} / ${payload?.matchCount || st.matchCount}）`, wrap);

    setLines('結果', 'NEXTで次へ', '');
    setNextEnabled(true);
  }

  async function handleShowTournamentResult(payload){
    hideSplash();
    showCenterStamp('');
    setEventIcon('');

    const total = payload?.total || {};
    const arr = Object.values(total);

    arr.sort((a,b)=>{
      const at = Number(a.sumTotal||0);
      const bt = Number(b.sumTotal||0);
      if (bt !== at) return bt - at;
      return String(a.squad||'').localeCompare(String(b.squad||''), 'ja');
    });

    const wrap = document.createElement('div');
    wrap.className = 'resultWrap';

    const table = document.createElement('table');
    table.innerHTML = `
      <thead>
        <tr>
          <th>Rank</th>
          <th>Squad</th>
          <th class="num">総合P</th>
          <th class="num">総合順位P</th>
          <th class="num">KP</th>
          <th class="num">AP</th>
          <th class="num">お宝</th>
          <th class="num">フラッグ</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tb = table.querySelector('tbody');

    arr.forEach((r, idx)=>{
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${idx+1}</td>
        <td>${escapeHtml(r.squad || '')}</td>
        <td class="num">${Number(r.sumTotal||0)}</td>
        <td class="num">${Number(r.sumPlacementP||0)}</td>
        <td class="num">${Number(r.KP||0)}</td>
        <td class="num">${Number(r.AP||0)}</td>
        <td class="num">${Number(r.Treasure||0)}</td>
        <td class="num">${Number(r.Flag||0)}</td>
      `;
      tb.appendChild(tr);
    });

    wrap.appendChild(table);
    showPanel('大会RESULT（総合）', wrap);

    setLines('大会終了！', 'おつかれさまでした！', '');
    setNextEnabled(true);
  }

  async function handleNextMatch(payload){
    hidePanels();
    hideSplash();
    showCenterStamp('');
    setEventIcon('');

    setLines('次の試合へ', `MATCH ${payload?.matchIndex || ''} / 5`, '');
    await sleep(260);
    setNextEnabled(true);
  }

  function escapeHtml(s){
    return String(s||'')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'","&#39;");
  }

  function sleep(ms){
    ms = Number(ms || 0);
    return new Promise(r=>setTimeout(r, ms));
  }

  // ===== main render =====
  async function render(){
    ensureDom();
    const st = getState();
    if (!st) return;

    setBanners(st.bannerLeft, st.bannerRight);

    if (st.ui?.bg) setBackdrop(st.ui.bg);
    if (st.ui?.squareBg) setSquareBg(st.ui.squareBg);

    if (st.ui?.leftImg || st.ui?.rightImg){
      setChars(st.ui?.leftImg || '', st.ui?.rightImg || '');
    }
    setNames(st.ui?.topLeftName || '', st.ui?.topRightName || '');

    if (Array.isArray(st.ui?.center3)){
      setLines(st.ui.center3[0], st.ui.center3[1], st.ui.center3[2]);
    }

    const req = st.request || null;
    const key = mkReqKey(req);
    if (key === lastReqKey) return;
    lastReqKey = key;

    clearAutoTimer();

    if (!req || !req.type){
      setNextEnabled(!busy);
      return;
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
        case 'cpuBattleSilent': await handleCpuBattleSilent(req); break;

        case 'showEncounter': await handleShowEncounter(req); break;
        case 'showBattle': await handleShowBattle(req); break;

        case 'playerEliminatedFastForward': await handlePlayerEliminatedFastForward(req); break;

        case 'showMove': await handleShowMove(req); break;
        case 'showArrive': await handleShowArrive(req); break;

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
      setNextEnabled(true);
    }
  }

  function initTournamentUI(){
    ensureDom();
  }

  window.MOBBR.ui.tournament = {
    open,
    close,
    render
  };

  window.MOBBR.initTournamentUI = initTournamentUI;

})();
