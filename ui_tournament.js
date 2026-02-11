'use strict';

/*
  ui_tournament.js v2（フル）
  - 大会UI：mobbrTui（overlay）
  - チーム行は「押せるボタン」扱い（当たり判定を行全体へ）
  - チーム名タップで「チーム画像プレビュー」
    ・プレイヤー：P1.png（将来P2/P3対応余地）
    ・CPU：DataCPU.getAssetBase() + '/' + teamId + '.png'（例：cpu/TEAM_01.png）
  - sim_tournament_flow.js が持つ state を描画して進行
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
    // 今は P1.png を採用（仕様の「前面にプレイヤーチーム画像」）
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

    // 失敗しても落とさない
    img.onerror = () => {
      // 404でも真っ黒にならないよう、閉じずに「無い」だけで済ませる
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
    root.classList.add('isOpen');
    root.setAttribute('aria-hidden', 'false');

    const bg = el('div', 'tuiBg');
    // 背景は真っ黒でOK（必要なら画像に差し替え）
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
    // 大会到着レイアウト：テント背景などがあるなら tent.png
    // 無くても黒で成立する
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
    const logMain = el('div', 'tuiLogMain');
    const logSub = el('div', 'tuiLogSub');
    log.appendChild(logMain);
    log.appendChild(logSub);

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
    btnGhost.textContent = 'チーム画像（プレイヤー）';
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

    return root;
  }

  function render(){
    const r = ensureRoot();

    state = window.MOBBR?.sim?.tournamentFlow?.getState?.() || state;

    const meta = r.querySelector('.tuiMeta');
    const bL = r.querySelector('.tuiBanner .left');
    const bR = r.querySelector('.tuiBanner .right');
    const scroll = r.querySelector('.tuiScroll');
    const logMain = r.querySelector('.tuiLogMain');
    const logSub = r.querySelector('.tuiLogSub');

    if (!state){
      safeText(meta, '');
      safeText(bL, '大会');
      safeText(bR, '');
      if (scroll) scroll.innerHTML = '';
      safeText(logMain, '大会データなし');
      safeText(logSub, 'BATTLEから開始してください');
      return;
    }

    // meta
    const round = state.round ?? 1;
    const phase = state.phase ?? 'start';
    safeText(meta, `R${round} / ${phase}`);

    // banner
    safeText(bL, state.bannerLeft || `ROUND ${round}`);
    safeText(bR, state.bannerRight || '');

    // log（プレイヤー視点ログのみ）
    const last = (state.logs && state.logs.length) ? state.logs[state.logs.length - 1] : null;
    safeText(logMain, last?.main || state.logMain || '大会開始');
    safeText(logSub, last?.sub || state.logSub || '');

    // list
    if (scroll){
      scroll.innerHTML = '';

      const teams = Array.isArray(state.teams) ? state.teams.slice() : [];
      // 表示：aliveが多い順→名前
      teams.sort((a,b)=>{
        const aa = (a.eliminated? -999 : (a.alive||0));
        const bb = (b.eliminated? -999 : (b.alive||0));
        if (bb !== aa) return bb - aa;
        return String(a.name||'').localeCompare(String(b.name||''), 'ja');
      });

      teams.forEach((t, idx)=>{
        const row = el('div', 'tuiRow');

        // 押しやすく：行全体でタップOK
        row.addEventListener('click', ()=>{
          const src = getTeamImageSrc(t);
          if (src) openPreview(r, src);
        }, { passive:true });

        const name = el('div', 'name');
        const tag = el('div', 'tag');

        const alive = (t.alive ?? 0);
        const status = t.eliminated ? '全滅' : `生存${alive}`;

        // プレイヤー強調
        const nm = (t.isPlayer ? '★ ' : '') + (t.name || t.id || `TEAM ${idx+1}`);
        safeText(name, nm);

        // 追加情報（宝/旗/downs_total）
        const treasure = t.treasure || 0;
        const flag = t.flag || 0;
        const downs = t.downs_total || 0;

        let extra = '';
        if (treasure || flag) extra += ` / お宝${treasure} フラッグ${flag}`;
        extra += ` / downs${downs}`;

        safeText(tag, `${status}${extra}`);

        // eliminatedなら薄く
        if (t.eliminated){
          row.style.opacity = '0.55';
        }else{
          row.style.opacity = '1';
        }

        // プレイヤーは枠色で目立たせる
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

  // expose
  window.MOBBR.ui.tournament = { open, close, render };

  // init（ロードされたら作るだけ。表示はFlow.startで）
  document.addEventListener('DOMContentLoaded', ()=> {
    ensureRoot();
    close();
  });

})();
