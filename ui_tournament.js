'use strict';

/*
  MOB BR - ui_tournament.js v3（フル）
  追加：
  - 出場20チーム一覧の「行タップ」で画像プレビュー
    * PLAYER: P1.png
    * CPU: cpu/<teamId>.png（participantsの img を優先）
  - 透明フタ事故防止：modalBack は使わず、TUI内モーダルで完結
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){
  const $ = (id) => document.getElementById(id);

  const TS_KEY = 'mobbr_tournamentState';

  // ※背景は現状維持（あとで最新版仕様の見た目に寄せる）
  const IMG_BG  = 'neonmain.png';
  const IMG_SQ  = 'tent.png';

  let ui = null;
  let step = 'arrival';

  function safeParse(raw, fallback){
    try{ return JSON.parse(raw); }catch{ return fallback; }
  }

  function loadTournamentState(){
    const st = safeParse(localStorage.getItem(TS_KEY) || 'null', null);
    return st && typeof st === 'object' ? st : null;
  }

  function hardHideModalBack(){
    const back = $('modalBack');
    if (back){
      back.style.display = 'none';
      back.style.pointerEvents = 'none';
      back.setAttribute('aria-hidden', 'true');
    }
  }

  // ===== DOM build =====
  function ensureDOM(){
    if (ui) return ui;

    const root = document.createElement('div');
    root.className = 'mobbrTui';
    root.setAttribute('aria-hidden', 'true');

    const bg = document.createElement('div');
    bg.className = 'tuiBg';
    root.appendChild(bg);

    const wrap = document.createElement('div');
    wrap.className = 'tuiWrap';

    const top = document.createElement('div');
    top.className = 'tuiTop';

    const title = document.createElement('div');
    title.className = 'tuiTitle';
    title.textContent = '大会（ローカル）';
    top.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'tuiMeta';
    meta.textContent = '文章演出のみ';
    top.appendChild(meta);

    const close = document.createElement('button');
    close.className = 'tuiClose';
    close.type = 'button';
    close.textContent = '戻る';
    close.addEventListener('click', () => closeUI());
    top.appendChild(close);

    const center = document.createElement('div');
    center.className = 'tuiCenter';

    const sq = document.createElement('div');
    sq.className = 'tuiSquare';

    const sqBg = document.createElement('div');
    sqBg.className = 'tuiSquareBg';
    sq.appendChild(sqBg);

    const inner = document.createElement('div');
    inner.className = 'tuiSquareInner';

    const banner = document.createElement('div');
    banner.className = 'tuiBanner';
    banner.innerHTML = `<div class="left" id="tuiBannerLeft">大会到着</div><div class="right" id="tuiBannerRight">NEXTで進行</div>`;
    inner.appendChild(banner);

    const scroll = document.createElement('div');
    scroll.className = 'tuiScroll';
    scroll.id = 'tuiScroll';
    inner.appendChild(scroll);

    const log = document.createElement('div');
    log.className = 'tuiLog';
    log.innerHTML = `<div class="tuiLogMain" id="tuiLogMain"></div><div class="tuiLogSub" id="tuiLogSub"></div>`;
    inner.appendChild(log);

    sq.appendChild(inner);
    center.appendChild(sq);

    const bottom = document.createElement('div');
    bottom.className = 'tuiBottom';

    const btnNext = document.createElement('button');
    btnNext.className = 'tuiBtn';
    btnNext.type = 'button';
    btnNext.id = 'tuiNext';
    btnNext.textContent = 'NEXT';
    bottom.appendChild(btnNext);

    wrap.appendChild(top);
    wrap.appendChild(center);
    wrap.appendChild(bottom);

    root.appendChild(wrap);

    // ===== プレビュー用モーダル（TUI内完結）=====
    const pvBack = document.createElement('div');
    pvBack.className = 'tuiPvBack';
    pvBack.style.display = 'none';
    pvBack.style.pointerEvents = 'none';

    const pvCard = document.createElement('div');
    pvCard.className = 'tuiPvCard';
    pvCard.style.display = 'none';
    pvCard.style.pointerEvents = 'none';

    pvCard.innerHTML = `
      <div class="tuiPvTitle" id="tuiPvTitle">TEAM</div>
      <div class="tuiPvImgWrap">
        <img id="tuiPvImg" alt="team" draggable="false" />
      </div>
      <button class="tuiPvClose" id="tuiPvClose" type="button">閉じる</button>
    `;

    root.appendChild(pvBack);
    root.appendChild(pvCard);

    document.body.appendChild(root);

    ui = {
      root,
      bg,
      sqBg,
      bannerLeft: root.querySelector('#tuiBannerLeft'),
      bannerRight: root.querySelector('#tuiBannerRight'),
      scroll,
      logMain: root.querySelector('#tuiLogMain'),
      logSub: root.querySelector('#tuiLogSub'),
      btnNext,
      pvBack,
      pvCard,
      pvTitle: root.querySelector('#tuiPvTitle'),
      pvImg: root.querySelector('#tuiPvImg'),
      pvClose: root.querySelector('#tuiPvClose')
    };

    ui.btnNext.addEventListener('click', () => next());

    // プレビュー閉じ
    ui.pvBack.addEventListener('click', () => hidePreview());
    ui.pvClose.addEventListener('click', () => hidePreview());

    return ui;
  }

  function setBG(img){ ensureDOM().bg.style.backgroundImage = `url(${img})`; }
  function setSquareBG(img){ ensureDOM().sqBg.style.backgroundImage = `url(${img})`; }

  function setBanner(left, right){
    const d = ensureDOM();
    d.bannerLeft.textContent = String(left ?? '');
    d.bannerRight.textContent = String(right ?? '');
  }

  function setLog(main, sub){
    const d = ensureDOM();
    d.logMain.textContent = String(main ?? '');
    d.logSub.textContent = String(sub ?? '');
  }

  function setScrollHTML(html){
    ensureDOM().scroll.innerHTML = html || '';
  }

  function escapeHTML(s){
    return String(s ?? '').replace(/[&<>"']/g, (m) => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
  }

  // ===== Preview =====
  function showPreview(teamName, imgSrc){
    const d = ensureDOM();
    d.pvTitle.textContent = String(teamName || 'TEAM');

    if (d.pvImg){
      d.pvImg.src = imgSrc || '';
      d.pvImg.onerror = () => {
        // 画像が無い場合でも落とさない
        d.pvImg.onerror = null;
        d.pvImg.src = '';
      };
    }

    d.pvBack.style.display = 'block';
    d.pvBack.style.pointerEvents = 'auto';
    d.pvCard.style.display = 'block';
    d.pvCard.style.pointerEvents = 'auto';
  }

  function hidePreview(){
    const d = ensureDOM();
    d.pvBack.style.display = 'none';
    d.pvBack.style.pointerEvents = 'none';
    d.pvCard.style.display = 'none';
    d.pvCard.style.pointerEvents = 'none';
  }

  // ===== screens =====
  function showArrival(){
    step = 'arrival';
    hidePreview();

    setBG(IMG_BG);
    setSquareBG(IMG_SQ);

    setBanner('大会到着', 'NEXTで進行');
    setScrollHTML(
      `<div class="tuiNote">
        本日のローカル大会が始まります。<br>
        NEXTで「出場20チーム」を紹介します。
      </div>`
    );
    setLog('本日の出場チームをご紹介！', '');
    ensureDOM().btnNext.textContent = 'NEXT';
  }

  function showTeams(){
    step = 'teams';
    hidePreview();

    setBanner('出場チーム', '20チーム（タップで画像）');

    const st = loadTournamentState();
    const ps = Array.isArray(st?.participants) ? st.participants : [];

    const dbg = st?.debug || {};
    const dbgLine = (dbg && typeof dbg === 'object')
      ? `CPU:${dbg.cpuOk ? 'OK' : 'NG'} / pool:${escapeHTML(String(dbg.pickedFrom || '-'))} / local:${escapeHTML(String(dbg.localCount ?? '-'))}`
      : '';

    let html = '';
    if (ps.length === 0){
      html = `<div class="tuiNote">参加チームデータがありません。</div>`;
    }else{
      for (let i=0;i<ps.length;i++){
        const p = ps[i];
        const tag = (p.kind === 'player') ? 'PLAYER' : 'CPU';
        const nm = escapeHTML(p.name || p.id || 'TEAM');
        const img = escapeHTML(p.img || '');
        const pid = escapeHTML(p.id || '');

        html += `
          <button class="tuiRowBtn" type="button"
            data-idx="${i}"
            data-name="${nm}"
            data-img="${img}"
            data-id="${pid}"
            data-kind="${tag}">
            <div class="name">${nm}</div>
            <div class="tag">${tag}</div>
          </button>
        `;
      }
      html += `<div class="tuiNote">（debug）${dbgLine}</div>`;
    }

    setScrollHTML(html);

    // 行タップ bind（scroll内だけ）
    const d = ensureDOM();
    const btns = d.scroll.querySelectorAll('.tuiRowBtn');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        const name = btn.getAttribute('data-name') || 'TEAM';
        const img = btn.getAttribute('data-img') || '';
        const kind = btn.getAttribute('data-kind') || '';
        const id = btn.getAttribute('data-id') || '';

        // imgが無い場合のフォールバック
        let src = img;
        if (!src){
          if (kind === 'PLAYER') src = 'P1.png';
          else if (id) src = `cpu/${id}.png`;
        }
        showPreview(name, src);
      });
    });

    setLog('出場チーム一覧', '※タップで画像プレビュー');
    d.btnNext.textContent = 'OK';
  }

  function next(){
    if (step === 'arrival') return showTeams();
    if (step === 'teams') return closeUI();
  }

  // ===== open/close =====
  function openUI(){
    const d = ensureDOM();
    hardHideModalBack();

    d.root.style.display = 'block';
    d.root.style.pointerEvents = 'auto';
    d.root.classList.add('isOpen');
    d.root.setAttribute('aria-hidden', 'false');

    showArrival();
  }

  function closeUI(){
    const d = ensureDOM();
    hidePreview();
    d.root.classList.remove('isOpen');
    d.root.style.display = 'none';
    d.root.style.pointerEvents = 'none';
    d.root.setAttribute('aria-hidden', 'true');
    hardHideModalBack();
  }

  function initTournamentUI(){
    ensureDOM();
    closeUI();
  }

  window.MOBBR.initTournamentUI = initTournamentUI;
  window.MOBBR.ui.tournament = { open: openUI, close: closeUI };
})();
