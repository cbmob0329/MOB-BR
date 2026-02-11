'use strict';

/*
  ui_tournament.js v3（フル）
  - 大会UI：mobbrTui（overlay）
  - チーム行は「押せるボタン」扱い（行全体が当たり判定）
  - チーム名タップで「チーム画像プレビュー」
    ・プレイヤー：P1.png
    ・CPU：DataCPU.getAssetBase() + '/' + teamId + '.png'
  - 中央ログは必ず3段固定（log1/log2/log3）
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){
  const $ = (id) => document.getElementById(id);

  function el(tag, cls){
    const d = document.createElement(tag);
    if (cls) d.className = cls;
    return d;
  }

  function safeText(node, t){
    if (!node) return;
    node.textContent = String(t ?? '');
  }

  function getCpuBase(){
    try{
      if (window.DataCPU && typeof window.DataCPU.getAssetBase === 'function'){
        return window.DataCPU.getAssetBase() || 'cpu';
      }
    }catch(e){}
    return 'cpu';
  }

  function guessPlayerImage(){
    return 'P1.png';
  }

  function getTeamImageSrc(team){
    if (!team) return '';
    if (team.isPlayer) return guessPlayerImage();
    const base = getCpuBase();
    return `${base}/${team.id}.png`;
  }

  // 画像プレビュー（フルスクリーン）
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

  // ===== UI Root =====
  let root = null;
  let state = null;

  function ensureRoot(){
    if (root) return root;

    root = el('div', 'mobbrTui');
    root.setAttribute('aria-hidden', 'true');

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
    squareBg.style.backgroundImage = `url("tent.png")`;
    square.appendChild(squareBg);

    const inner = el('div', 'tuiSquareInner');

    const banner = el('div', 'tuiBanner');
    const bL = el('div', 'left');
    const bR = el('div', 'right');
    banner.appendChild(bL);
    banner.appendChild(bR);

    const scroll = el('div', 'tuiScroll');

    const log = el('div', 'tuiLog');
    const log1 = el('div', 'tuiLogLine tuiLogL1');
    const log2 = el('div', 'tuiLogLine tuiLogL2');
    const log3 = el('div', 'tuiLogLine tuiLogL3');
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

    const btnGhost = el('button', 'tuiBtn tuiBtnGhost');
    btnGhost.type = 'button';
    btnGhost.textContent = 'プレイヤー画像';
    btnGhost.addEventListener('click', ()=>{
      openPreview(root, guessPlayerImage());
    });

    bottom.appendChild(btnNext);
    bottom.appendChild(btnGhost);

    wrap.appendChild(top);
    wrap.appendChild(center);
    wrap.appendChild(bottom);

    root.appendChild(wrap);
    document.body.appendChild(root);

    ensurePreview(root);
    return root;
  }

  function render(){
    const r = ensureRoot();

    state = window.MOBBR?.sim?.tournamentFlow?.getState?.() || state;

    const meta = r.querySelector('.tuiMeta');
    const bL = r.querySelector('.tuiBanner .left');
    const bR = r.querySelector('.tuiBanner .right');
    const scroll = r.querySelector('.tuiScroll');
    const log1 = r.querySelector('.tuiLogL1');
    const log2 = r.querySelector('.tuiLogL2');
    const log3 = r.querySelector('.tuiLogL3');

    if (!state){
      safeText(meta, '');
      safeText(bL, '大会');
      safeText(bR, '');
      if (scroll) scroll.innerHTML = '';
      safeText(log1, '大会データなし');
      safeText(log2, '');
      safeText(log3, 'BATTLEから開始してください');
      return;
    }

    const round = state.round ?? 1;
    const phase = state.phase ?? 'start';
    safeText(meta, `R${round} / ${phase}`);

    safeText(bL, state.bannerLeft || `ROUND ${round}`);
    safeText(bR, state.bannerRight || '');

    // ログ：最後のログ（3段固定）
    const last = (state.logs && state.logs.length) ? state.logs[state.logs.length - 1] : null;

    safeText(log1, last?.log1 || state.log1 || '大会開始');
    safeText(log2, last?.log2 || state.log2 || '');
    safeText(log3, last?.log3 || state.log3 || '');

    // list
    if (scroll){
      scroll.innerHTML = '';

      const teams = Array.isArray(state.teams) ? state.teams.slice() : [];
      teams.sort((a,b)=>{
        const aa = (a.eliminated ? -999 : (a.alive||0));
        const bb = (b.eliminated ? -999 : (b.alive||0));
        if (bb !== aa) return bb - aa;

        const ta = a.treasure || 0;
        const tb = b.treasure || 0;
        if (tb !== ta) return tb - ta;

        const fa = a.flag || 0;
        const fb = b.flag || 0;
        if (fb !== fa) return fb - fa;

        return String(a.name||'').localeCompare(String(b.name||''), 'ja');
      });

      teams.forEach((t, idx)=>{
        const row = el('div', 'tuiRow');

        row.addEventListener('click', ()=>{
          const src = getTeamImageSrc(t);
          if (src) openPreview(r, src);
        }, { passive:true });

        const name = el('div', 'name');
        const tag = el('div', 'tag');

        const alive = (t.alive ?? 0);
        const status = t.eliminated ? '全滅' : `生存${alive}`;

        const nm = (t.isPlayer ? '★ ' : '') + (t.name || t.id || `TEAM ${idx+1}`);
        safeText(name, nm);

        const treasure = t.treasure || 0;
        const flag = t.flag || 0;
        const extra = `お宝${treasure} / フラッグ${flag}`;

        safeText(tag, `${status} / ${extra}`);

        if (t.eliminated){
          row.style.opacity = '0.55';
        }else{
          row.style.opacity = '1';
        }

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
