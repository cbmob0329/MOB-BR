'use strict';

/*
  ui_tournament.js v3.4.1（フル）
  ✅ sim_tournament_flow.js v3.2.0 / 3分割core の state.request に対応
  ✅ HTMLを触れない前提：このJSがUI DOMを自動生成／CSSは tournament.css を自動読込

  v3.4.1 変更点（今回）
  ✅ showMatchResult：payload.rows / payload.result の両対応（coreはrows）
  ✅ showTournamentResult：payload.total の sumTotal/KP/Treasure/Flag を表示できるよう対応
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

  // ===== CSS loader =====
  function ensureCss(){
    if (document.getElementById('mobbrTournamentCssLink')) return;

    // tournament.css を読み込む（HTMLは触らない前提）
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

    // iOS double-tap zoom & callout suppression
    overlay.addEventListener('touchstart', (e)=>{
      if (e.touches && e.touches.length>1) e.preventDefault();
    }, { passive:false });

    return dom;
  }

  function open(){
    ensureDom();
    dom.overlay.classList.add('isOpen');
  }
  function close(){
    clearAutoTimer();
    if (!dom) return;
    dom.overlay.classList.remove('isOpen');
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
    const flow = getFlow();
    if (!flow) return;
    flow.step();
    render();
  }

  // ===== team image candidates =====
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

  // ===== handlers =====

  async function handleShowIntroText(){
    hidePanels(); hideSplash(); showCenterStamp(''); setEventIcon('');
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

  function escapeHtml(s){
    return String(s || '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'","&#39;");
  }

  async function handleShowTeamList(payload){
    hidePanels(); hideSplash(); showCenterStamp(''); setEventIcon('');
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

  async function handleShowCoachSelect(payload){
    hidePanels(); hideSplash(); showCenterStamp(''); setEventIcon('');
    const st = getState();
    if (!st) return;

    setBackdrop(TOURNEY_BACKDROP);
    const sq = await resolveFirstExisting([st.ui?.squareBg || ASSET.tent]);
    setSquareBg(sq || ASSET.tent);

    const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st.ui?.leftImg || 'P1.png'));
    setChars(leftResolved, '');
    setNames('', '');

    setBanners(st.bannerLeft, st.bannerRight);

    const equipped = Array.isArray(payload?.equipped) ? payload.equipped : [];
    const master = Array.isArray(payload?.master) ? payload.master : [];

    const wrap = document.createElement('div');
    wrap.className = 'coachWrap';
    const p = document.createElement('div');
    p.className = 'coachHint';
    p.textContent = '装備中のコーチスキル（最大3）から1つ選択（NEXTで進行）';
    wrap.appendChild(p);

    const ul = document.createElement('div');
    ul.className = 'coachList';

    equipped.forEach(id=>{
      const item = master.find(x=>String(x.id)===String(id)) || null;
      const btn = document.createElement('button');
      btn.className = 'coachBtn';
      btn.type = 'button';
      btn.textContent = item ? `${item.name}（${item.price}G）` : String(id);
      btn.addEventListener('click', ()=>{
        const flow = getFlow();
        if (!flow || !flow.selectCoachSkill) return;
        flow.selectCoachSkill(String(id));
        setLines('コーチスキル決定！', item?.quote || '', 'NEXTで進行');
      });
      ul.appendChild(btn);
    });

    wrap.appendChild(ul);
    showPanel('コーチスキル', wrap);

    setLines(st.ui?.center3?.[0] || 'それでは試合を開始します！', st.ui?.center3?.[1] || '使用するコーチスキルを選択してください！', st.ui?.center3?.[2] || '');
    await preloadMany([TOURNEY_BACKDROP, sq, leftResolved]);
    setNextEnabled(true);
  }

  async function handleShowDropStart(){
    hidePanels(); hideSplash(); showCenterStamp(''); setEventIcon('');
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
    const st = getState();
    if (!st) return;

    setBackdrop(TOURNEY_BACKDROP);

    const areaBg = String(payload?.bg || st.ui?.bg || '');
    const areaResolved = await resolveFirstExisting([areaBg]);
    if (areaResolved) setSquareBg(areaResolved);

    // 交戦以外は右側クリア
    setNames('', '');

    const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st.ui?.leftImg || 'P1.png'));
    setChars(leftResolved, '');

    setLines(st.ui?.center3?.[0] || '', st.ui?.center3?.[1] || '', st.ui?.center3?.[2] || '');
    await preloadMany([TOURNEY_BACKDROP, areaResolved, leftResolved]);
    setNextEnabled(true);
  }

  async function handleShowRoundStart(payload){
    hidePanels(); hideSplash(); showCenterStamp(''); setEventIcon('');
    const st = getState();
    if (!st) return;

    setBackdrop(TOURNEY_BACKDROP);

    // 交戦以外は右側クリア
    setNames('', '');
    const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st.ui?.leftImg || 'P1.png'));
    setChars(leftResolved, '');

    setBanners(st.bannerLeft, st.bannerRight);
    setLines(`Round ${payload?.round || st.round} 開始！`, '', '');
    setNextEnabled(true);
  }

  async function handleShowEvent(payload){
    hidePanels(); hideSplash(); showCenterStamp('');
    const st = getState();
    setBackdrop(TOURNEY_BACKDROP);

    // 交戦以外は右側クリア
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

  async function handlePrepareBattles(){
    setBackdrop(TOURNEY_BACKDROP);
    setNextEnabled(true);
  }

  // ✅ showEncounter：自動step禁止（NEXTで進める）
  async function handleShowEncounter(payload){
    hidePanels(); showCenterStamp(''); setEventIcon('');
    const st = getState();
    if (!st) return;

    setBackdrop(TOURNEY_BACKDROP);
    setBanners(st.bannerLeft, st.bannerRight);

    const meName = payload?.meName || '';
    const foeName = payload?.foeName || '';
    setNames(meName, foeName);

    const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st.ui?.leftImg || 'P1.png'));

    const foeId = payload?.foeTeamId || '';
    const rightResolved = await resolveFirstExisting(
      guessPlayerImageCandidates(st.ui?.rightImg || '').concat(guessTeamImageCandidates(foeId))
    );

    setChars(leftResolved, rightResolved);

    showSplash('接敵‼︎', `${meName} vs ${foeName}‼︎`);
    setLines('接敵‼︎', `${meName} vs ${foeName}‼︎`, '交戦スタート‼︎');

    await preloadMany([leftResolved, rightResolved, ASSET.brbattle, ASSET.brwin, ASSET.brlose]);
    await sleep(520);
    hideSplash();

    // ✅ここで止める：NEXT待ち
    busy = false;
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

  // ✅ showMove：移動→到着（中央のみ）→NEXT待ち
  async function handleShowMove(payload){
    hidePanels(); hideSplash(); showCenterStamp(''); setEventIcon('');
    const st = getState();
    if (!st) return;

    setBackdrop(TOURNEY_BACKDROP);

    // 移動中は ido を正方形で
    setSquareBg(ASSET.ido);

    // 交戦以外は右側クリア
    setNames('', '');

    const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st.ui?.leftImg || 'P1.png'));
    setChars(leftResolved, '');

    setNextEnabled(false);
    busy = true;

    const toBg = String(payload?.toBg || '');
    const toResolved = await resolveFirstExisting([toBg]);

    // 移動ログ（中央）
    setLines(payload?.log1 || '移動中…', payload?.log2 || '', payload?.log3 || '');
    await preloadMany([ASSET.ido, leftResolved]);
    await sleep(520);

    // 到着（中央だけで演出）
    if (toResolved){
      setSquareBg(toResolved);
    }
    setLines(payload?.arrive1 || '到着！', payload?.arrive2 || (payload?.toName ? String(payload.toName) : ''), payload?.arrive3 || '');
    await preloadMany([toResolved]);

    busy = false;
    setNextEnabled(true);
  }

  async function handleShowChampion(payload){
    hidePanels(); hideSplash(); setEventIcon('');
    const st = getState();
    if (!st) return;

    setBackdrop(TOURNEY_BACKDROP);

    const bg = String(payload?.bg || st.ui?.bg || '');
    const bgResolved = await resolveFirstExisting([bg]);
    if (bgResolved) setSquareBg(bgResolved);

    const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st.ui?.leftImg || 'P1.png'));
    setChars(leftResolved, '');

    setNames('', '');
    setBanners(st.bannerLeft, st.bannerRight);

    setLines(payload?.line1 || 'この試合のチャンピオンは…', payload?.line2 || String(payload?.championName || ''), payload?.line3 || 'だった！');
    setNextEnabled(true);
  }

  // ✅ここが今回のズレ修正ポイント：rows/result両対応＋core形式対応
  async function handleShowMatchResult(payload){
    hidePanels(); hideSplash(); showCenterStamp(''); setEventIcon('');
    const st = getState();
    if (!st) return;

    setBackdrop(TOURNEY_BACKDROP);
    const sq = await resolveFirstExisting([ASSET.tent, st.ui?.squareBg || ASSET.tent]);
    setSquareBg(sq || ASSET.tent);

    const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st.ui?.leftImg || 'P1.png'));
    setChars(leftResolved, '');

    setNames('', '');
    setBanners(st.bannerLeft, st.bannerRight);

    // coreは rows（{ placement, squad, KP, Treasure, Flag ... }）
    const srcRows =
      Array.isArray(payload?.rows) ? payload.rows :
      Array.isArray(payload?.result) ? payload.result :
      [];

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
      const rank = (r.placement ?? r.rank ?? '');
      const name = (r.squad ?? r.name ?? r.id ?? '');
      const k = (r.KP ?? r.kills_total ?? 0);
      const tre = (r.Treasure ?? r.treasure ?? 0);
      const flg = (r.Flag ?? r.flag ?? 0);

      const tr = document.createElement('tr');
      const isPlayer =
        !!r.isPlayer ||
        (String(r.id||'') === 'PLAYER') ||
        (String(name||'').toUpperCase().includes('PLAYER'));

      if (isPlayer) tr.classList.add('isPlayer');

      tr.innerHTML = `
        <td>${escapeHtml(String(rank))}</td>
        <td>${escapeHtml(String(name))}</td>
        <td class="num">${escapeHtml(String(k))}</td>
        <td class="num">${escapeHtml(String(tre))}</td>
        <td class="num">${escapeHtml(String(flg))}</td>
      `;
      tb.appendChild(tr);
    });

    wrap.appendChild(table);

    showPanel(`MATCH ${payload?.matchIndex || st.matchIndex} 結果`, wrap);

    setLines('試合結果', '（NEXTで次へ）', '');
    setNextEnabled(true);
  }

  // ✅ここもズレ修正：total(sumTotal/KP/Treasure/Flag)対応
  async function handleShowTournamentResult(payload){
    hidePanels(); hideSplash(); showCenterStamp(''); setEventIcon('');
    const st = getState();
    if (!st) return;

    setBackdrop(TOURNEY_BACKDROP);
    const sq = await resolveFirstExisting([ASSET.tent, st.ui?.squareBg || ASSET.tent]);
    setSquareBg(sq || ASSET.tent);

    const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st.ui?.leftImg || 'P1.png'));
    setChars(leftResolved, '');

    setNames('', '');
    setBanners('大会結果', '');

    const total = payload?.total || {};
    const arr = Object.values(total);

    // points は sumTotal / points / score の順で見る（coreはsumTotal）
    arr.sort((a,b)=>{
      const pa = Number(a.sumTotal ?? a.points ?? a.score ?? 0);
      const pb = Number(b.sumTotal ?? b.points ?? b.score ?? 0);
      if (pb !== pa) return pb - pa;

      const ka = Number(a.KP ?? a.kills_total ?? 0);
      const kb = Number(b.KP ?? b.kills_total ?? 0);
      if (kb !== ka) return kb - ka;

      const ta = Number(a.Treasure ?? a.treasure ?? 0);
      const tb2 = Number(b.Treasure ?? b.treasure ?? 0);
      return tb2 - ta;
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

    arr.forEach((r, i)=>{
      const tr = document.createElement('tr');

      const isPlayer =
        !!r.isPlayer ||
        (String(r.id||'') === 'PLAYER') ||
        (String(r.squad||'').toUpperCase().includes('PLAYER'));

      if (isPlayer) tr.classList.add('isPlayer');

      const name = (r.squad ?? r.name ?? r.id ?? '');
      const pt = (r.sumTotal ?? r.points ?? r.score ?? 0);
      const k = (r.KP ?? r.kills_total ?? 0);
      const tre = (r.Treasure ?? r.treasure ?? 0);
      const flg = (r.Flag ?? r.flag ?? 0);

      tr.innerHTML = `
        <td>${escapeHtml(String(i+1))}</td>
        <td>${escapeHtml(String(name))}</td>
        <td class="num">${escapeHtml(String(pt))}</td>
        <td class="num">${escapeHtml(String(k))}</td>
        <td class="num">${escapeHtml(String(tre))}</td>
        <td class="num">${escapeHtml(String(flg))}</td>
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
    const st = getState();
    if (!st) return;

    setBackdrop(TOURNEY_BACKDROP);
    const sq = await resolveFirstExisting([ASSET.tent, st.ui?.squareBg || ASSET.tent]);
    setSquareBg(sq || ASSET.tent);

    const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st.ui?.leftImg || 'P1.png'));
    setChars(leftResolved, '');

    setNames('', '');
    setBanners('次の試合へ', `MATCH ${payload?.matchIndex || st.matchIndex} / 5`);

    setLines('準備を整えよう', 'NEXTでコーチ選択へ', '');
    setNextEnabled(true);
  }

  // ===== main render =====

  async function render(){
    ensureDom();

    const st = getState();
    const req = st?.request || null;
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
      setNextEnabled(true);
    }
  }

  function initTournamentUI(){
    ensureDom();
  }

  window.MOBBR.ui.tournament = { open, close, render };
  window.MOBBR.initTournamentUI = initTournamentUI;

})();
