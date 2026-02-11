'use strict';

/*
  MOB BR - ui_tournament.js v2（フル）
  - tournamentFlow が保存する mobbr_tournamentState を読み、参加20チームを表示
  - 画面は「到着 → チーム紹介」まで（今はA/B範囲）
  - btnBattle は触らない（ui_main.js が握ってる）

  ※画像は仮：neonmain.png / tent.png（ここは後で最新版UIに合わせて差し替え可能）
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){
  const $ = (id) => document.getElementById(id);

  const TS_KEY = 'mobbr_tournamentState';

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
      btnNext
    };

    ui.btnNext.addEventListener('click', () => next());

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

  // ===== screens =====
  function showArrival(){
    step = 'arrival';
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
  }

  function showTeams(){
    step = 'teams';
    setBanner('出場チーム', '20チーム');

    const st = loadTournamentState();
    const ps = Array.isArray(st?.participants) ? st.participants : [];

    // A：CPU読み込みの結果（debug）を表示（見えるログは軽く）
    const dbg = st?.debug || {};
    const dbgLine = (dbg && typeof dbg === 'object')
      ? `CPU:${dbg.cpuOk ? 'OK' : 'NG'} / pool:${escapeHTML(String(dbg.pickedFrom || '-'))} / local:${escapeHTML(String(dbg.localCount ?? '-'))}`
      : '';

    let html = '';
    if (ps.length === 0){
      html = `<div class="tuiNote">参加チームデータがありません。</div>`;
    }else{
      for (const p of ps){
        const tag = (p.kind === 'player') ? 'PLAYER' : 'CPU';
        const nm = escapeHTML(p.name || p.id || 'TEAM');
        html += `
          <div class="tuiRow">
            <div class="name">${nm}</div>
            <div class="tag">${tag}</div>
          </div>
        `;
      }
      html += `<div class="tuiNote">（debug）${dbgLine}</div>`;
    }

    setScrollHTML(html);
    setLog('出場チーム一覧', '※ローカル大会（抽選済み）');
    ui.btnNext.textContent = 'OK';
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

    // 毎回 “到着” から
    ui.btnNext.textContent = 'NEXT';
    showArrival();
  }

  function closeUI(){
    const d = ensureDOM();
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
