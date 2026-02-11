'use strict';

/*
  ui_tournament.js v5（フル）
  ✅修正：
  1) チーム紹介は intro のみ表示（試合開始後はリストを消す）
  2) 交戦：ログ(10個)が終わってから結果表示。ログ中はNEXT無効化
  3) 移動：ido.png中に次エリア画像をプリロードし、ロード完了後に arrive() を呼んで到着
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){
  function el(tag, cls){
    const d = document.createElement(tag);
    if (cls) d.className = cls;
    return d;
  }
  function safeText(node, t){
    if (!node) return;
    node.textContent = String(t ?? '');
  }

  function guessPlayerImage(){ return 'P1.png'; }

  function getCpuBase(){
    try{
      if (window.DataCPU && typeof window.DataCPU.getAssetBase === 'function'){
        return window.DataCPU.getAssetBase() || 'cpu';
      }
    }catch(e){}
    return 'cpu';
  }

  function getTeamImageSrc(team){
    if (!team) return '';
    if (team.isPlayer) return guessPlayerImage();
    return `${getCpuBase()}/${team.id}.png`;
  }

  // ========= image preview =========
  function ensurePreview(root){
    let pv = root.querySelector('.tuiPreview');
    if (pv) return pv;

    pv = el('div', 'tuiPreview');
    pv.setAttribute('aria-hidden', 'true');

    const img = document.createElement('img');
    img.alt = 'team image';
    img.draggable = false;

    pv.appendChild(img);

    pv.addEventListener('click', ()=>{
      pv.classList.remove('show');
      pv.setAttribute('aria-hidden', 'true');
    });

    root.appendChild(pv);
    return pv;
  }

  function openPreview(root, src){
    const pv = ensurePreview(root);
    const img = pv.querySelector('img');
    if (!img) return;

    img.onerror = () => {
      img.onerror = null;
      img.alt = '画像が見つかりません';
    };
    img.src = src;

    pv.classList.add('show');
    pv.setAttribute('aria-hidden', 'false');
  }

  // ========= preload helper =========
  function preloadImage(src){
    return new Promise((resolve)=>{
      const im = new Image();
      im.onload = ()=> resolve(true);
      im.onerror = ()=> resolve(false);
      im.src = src;
    });
  }

  // ========= battle overlay =========
  function ensureBattleLayer(root){
    let lay = root.querySelector('.tuiBattle');
    if (lay) return lay;

    lay = el('div', 'tuiBattle');
    lay.setAttribute('aria-hidden', 'true');

    const top = el('div', 'tuiBattleTop');
    const topImg = document.createElement('img');
    topImg.className = 'tuiBattleTopImg';
    topImg.alt = 'battle banner';
    topImg.draggable = false;
    top.appendChild(topImg);

    const mid = el('div', 'tuiBattleMid');

    const left = el('div', 'tuiBattleSide left');
    const leftName = el('div', 'tuiBattleName');
    const leftImg = document.createElement('img');
    leftImg.className = 'tuiBattleImg';
    leftImg.alt = 'player team';
    leftImg.draggable = false;
    left.appendChild(leftName);
    left.appendChild(leftImg);

    const right = el('div', 'tuiBattleSide right');
    const rightName = el('div', 'tuiBattleName');
    const rightImg = document.createElement('img');
    rightImg.className = 'tuiBattleImg';
    rightImg.alt = 'enemy team';
    rightImg.draggable = false;
    right.appendChild(rightName);
    right.appendChild(rightImg);

    mid.appendChild(left);
    mid.appendChild(right);

    const resultImg = document.createElement('img');
    resultImg.className = 'tuiBattleResultImg';
    resultImg.alt = 'battle result';
    resultImg.draggable = false;

    const log = el('div', 'tuiBattleLog');
    const logLine = el('div', 'tuiBattleLine');
    log.appendChild(logLine);

    lay.appendChild(top);
    lay.appendChild(mid);
    lay.appendChild(resultImg);
    lay.appendChild(log);

    root.appendChild(lay);
    return lay;
  }

  let battleTimer = null;
  let battleRunning = false;

  function stopBattleAnim(){
    if (battleTimer){
      clearInterval(battleTimer);
      battleTimer = null;
    }
    battleRunning = false;
  }

  function renderBattleLayer(root, state, btnNext){
    const lay = ensureBattleLayer(root);
    const bv = state?.battleView;

    if (!bv){
      stopBattleAnim();
      lay.classList.remove('show');
      lay.setAttribute('aria-hidden', 'true');
      if (btnNext) btnNext.disabled = false;
      return;
    }

    lay.classList.add('show');
    lay.setAttribute('aria-hidden', 'false');

    const topImg = lay.querySelector('.tuiBattleTopImg');
    const leftName = lay.querySelector('.tuiBattleSide.left .tuiBattleName');
    const rightName = lay.querySelector('.tuiBattleSide.right .tuiBattleName');
    const leftImg = lay.querySelector('.tuiBattleSide.left .tuiBattleImg');
    const rightImg = lay.querySelector('.tuiBattleSide.right .tuiBattleImg');
    const resultImg = lay.querySelector('.tuiBattleResultImg');
    const logLine = lay.querySelector('.tuiBattleLine');

    if (topImg) topImg.src = 'brbattle.png';

    safeText(leftName, bv.playerTeamName || 'PLAYER');
    safeText(rightName, bv.enemyTeamName || 'ENEMY');

    if (leftImg) leftImg.src = guessPlayerImage();
    if (rightImg) rightImg.src = `${getCpuBase()}/${bv.enemyTeamId}.png`;

    // ✅ログ中は結果を絶対に出さない
    if (resultImg){
      resultImg.style.opacity = '0';
      resultImg.src = '';
    }

    // ✅ログ中はNEXT無効化（「結果が先に出る」事故も防ぐ）
    if (btnNext) btnNext.disabled = true;

    // すでに動作中なら二重起動しない（render連打対策）
    if (battleRunning) return;
    battleRunning = true;

    const lines = Array.isArray(bv.chatter) ? bv.chatter.slice() : [];
    let idx = 0;
    safeText(logLine, lines[0] || '交戦中…');

    stopBattleAnim();
    battleTimer = setInterval(()=>{
      idx++;
      if (idx < lines.length){
        safeText(logLine, lines[idx] || '');
        return;
      }

      // ✅ログが全部終わった「後」に結果表示
      stopBattleAnim();

      const res = bv.result;
      if (resultImg){
        if (res === 'win' || res === 'champ') resultImg.src = 'brwin.png';
        else resultImg.src = 'brlose.png';
        resultImg.style.opacity = '1';
      }
      safeText(logLine, bv.afterLine || '');

      // ✅結果が出たらNEXTを有効化
      if (btnNext) btnNext.disabled = false;

    }, 180);
  }

  // ========= UI root =========
  let root = null;
  let state = null;

  function ensureRoot(){
    if (root) return root;

    root = el('div', 'mobbrTui');
    root.classList.add('isOpen');
    root.setAttribute('aria-hidden', 'false');

    const bg = el('div', 'tuiBg');
    root.appendChild(bg);

    const wrap = el('div', 'tuiWrap');

    // TOP
    const top = el('div', 'tuiTop');
    const title = el('div', 'tuiTitle');
    title.textContent = 'ローカル大会';
    const meta = el('div', 'tuiMeta');
    meta.textContent = '';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'tuiClose';
    closeBtn.textContent = '閉じる';
    closeBtn.addEventListener('click', close);

    top.appendChild(title);
    top.appendChild(meta);
    top.appendChild(closeBtn);

    // CENTER
    const center = el('div', 'tuiCenter');
    const square = el('div', 'tuiSquare');

    const squareBg = el('div', 'tuiSquareBg');
    square.appendChild(squareBg);

    const inner = el('div', 'tuiSquareInner');

    const banner = el('div', 'tuiBanner');
    const bL = el('div', 'left');
    const bR = el('div', 'right');
    banner.appendChild(bL);
    banner.appendChild(bR);

    const scroll = el('div', 'tuiScroll');

    // LOG（3段固定）
    const log = el('div', 'tuiLog');
    const log1 = el('div', 'tuiLogL1');
    const log2 = el('div', 'tuiLogL2');
    const log3 = el('div', 'tuiLogL3');
    log.appendChild(log1);
    log.appendChild(log2);
    log.appendChild(log3);

    inner.appendChild(banner);
    inner.appendChild(scroll);
    inner.appendChild(log);

    square.appendChild(inner);
    center.appendChild(square);

    // BOTTOM
    const bottom = el('div', 'tuiBottom');

    const btnNext = el('button', 'tuiBtn');
    btnNext.type = 'button';
    btnNext.textContent = '次へ';
    btnNext.addEventListener('click', ()=>{
      const Flow = window.MOBBR?.sim?.tournamentFlow;
      if (!Flow || typeof Flow.step !== 'function'){
        alert('大会進行が見つかりません（sim_tournament_flow.js 読み込みを確認）');
        return;
      }
      Flow.step();
      render();
    });

    const btnPlayerImg = el('button', 'tuiBtn tuiBtnGhost');
    btnPlayerImg.type = 'button';
    btnPlayerImg.textContent = 'チーム画像（プレイヤー）';
    btnPlayerImg.addEventListener('click', ()=>{
      openPreview(root, guessPlayerImage());
    });

    bottom.appendChild(btnNext);
    bottom.appendChild(btnPlayerImg);

    wrap.appendChild(top);
    wrap.appendChild(center);
    wrap.appendChild(bottom);

    root.appendChild(wrap);

    // battle layer
    ensureBattleLayer(root);

    document.body.appendChild(root);
    return root;
  }

  async function handlePendingArrivalIfAny(){
    const Flow = window.MOBBR?.sim?.tournamentFlow;
    if (!Flow || typeof Flow.arrive !== 'function') return;

    state = Flow.getState ? Flow.getState() : state;
    if (!state || !state.pendingArrival || !state.pendingArrival.bgImage) return;

    // ✅次エリア画像が読めてから到着
    const src = state.pendingArrival.bgImage;
    await preloadImage(src);

    // 到着確定
    Flow.arrive();
  }

  async function render(){
    const r = ensureRoot();

    // 先に pendingArrival を処理（到着確定した上で描画）
    await handlePendingArrivalIfAny();

    state = window.MOBBR?.sim?.tournamentFlow?.getState?.() || state;

    const title = r.querySelector('.tuiTitle');
    const meta  = r.querySelector('.tuiMeta');
    const bL    = r.querySelector('.tuiBanner .left');
    const bR    = r.querySelector('.tuiBanner .right');
    const scroll= r.querySelector('.tuiScroll');
    const bg    = r.querySelector('.tuiSquareBg');

    const log1 = r.querySelector('.tuiLogL1');
    const log2 = r.querySelector('.tuiLogL2');
    const log3 = r.querySelector('.tuiLogL3');

    const btnNext = r.querySelector('.tuiBtn');

    if (!state){
      safeText(title, '大会');
      safeText(meta, '');
      safeText(bL, '大会');
      safeText(bR, '');
      if (bg) bg.style.backgroundImage = '';
      if (scroll) scroll.innerHTML = '';
      safeText(log1, '大会データなし');
      safeText(log2, 'BATTLEから開始してください');
      safeText(log3, '');
      renderBattleLayer(r, null, btnNext);
      return;
    }

    safeText(title, state.mode === 'local' ? 'ローカル大会' : '大会');

    const round = state.round ?? 0;
    const phase = state.phase ?? '';
    const matchIndex = state.matchIndex ?? 1;
    safeText(meta, `試合${matchIndex}/5  /  R${round}  /  ${phase}`);

    safeText(bL, state.bannerLeft || '');
    safeText(bR, state.bannerRight || '');

    const bgSrc = state.bgImage || 'tent.png';
    if (bg) bg.style.backgroundImage = `url("${bgSrc}")`;

    const last = (state.logs && state.logs.length) ? state.logs[state.logs.length - 1] : null;
    safeText(log1, last?.l1 || '');
    safeText(log2, last?.l2 || '');
    safeText(log3, last?.l3 || '');

    // ✅戦闘レイヤー（ログ→結果順 / NEXTロック）
    renderBattleLayer(r, state, btnNext);

    // ✅チーム紹介は intro の時だけ（試合が始まったら消す）
    const showRoster = (state.phase === 'intro');
    if (scroll){
      scroll.style.display = showRoster ? 'block' : 'none';
      scroll.innerHTML = '';

      if (showRoster){
        const teams = Array.isArray(state.teams) ? state.teams.slice() : [];
        teams.sort((a,b)=>{
          return String(a.name||'').localeCompare(String(b.name||''), 'ja');
        });

        teams.forEach((t, idx)=>{
          const row = el('div', 'tuiRow');
          row.addEventListener('click', ()=>{
            const src = getTeamImageSrc(t);
            if (src) openPreview(r, src);
          }, { passive:true });

          const name = el('div', 'name');
          const tag  = el('div', 'tag');

          const nm = (t.isPlayer ? '★ ' : '') + (t.name || t.id || `TEAM ${idx+1}`);
          safeText(name, nm);

          const pwr = Number.isFinite(Number(t.power)) ? Math.round(Number(t.power)) : 0;
          safeText(tag, `総合力${pwr}`);

          if (t.isPlayer){
            row.style.border = '1px solid rgba(255,59,48,.55)';
            row.style.background = 'rgba(255,59,48,.10)';
          }

          row.appendChild(name);
          row.appendChild(tag);
          scroll.appendChild(row);
        });
      }
    }
  }

  function open(){
    const r = ensureRoot();
    r.classList.add('isOpen');
    r.style.display = 'block';
    r.style.pointerEvents = 'auto';
    r.setAttribute('aria-hidden', 'false');
    render();
  }

  function close(){
    if (!root) return;
    stopBattleAnim();
    root.classList.remove('isOpen');
    root.style.display = 'none';
    root.style.pointerEvents = 'none';
    root.setAttribute('aria-hidden', 'true');
  }

  window.MOBBR.ui.tournament = { open, close, render };

  document.addEventListener('DOMContentLoaded', ()=> {
    ensureRoot();
    close();
  });

})();
