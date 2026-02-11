'use strict';

/*
  ui_tournament.js v4（フル）
  ✅ 紙芝居UI対応（最新版.txt の骨格に寄せる）
  - 背景：neonmain.png をフェードイン（大会画面の背面）
  - 正方形：tent / area / ido を切替（Flow state から推定）
  - 左：プレイヤー（装備中P?.png。現状は P1.png）
  - 右：敵（プレイヤー交戦時のみ）
  - 中央：ログ3段固定表示（main/sub から整形）
  - 20チーム一覧：紹介フェーズでのみ表示（以降は非表示）
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
    // 将来：P2/P3/P4/P5（装備中）へ
    return 'P1.png';
  }

  function getTeamImageSrc(team){
    if (!team) return '';
    if (team.isPlayer) return guessPlayerImage();
    const base = getCpuBase();
    return `${base}/${team.id}.png`;
  }

  // ===== Area画像（暫定：maps/Area{n}.png を探す → 無ければ maps/area{n}.png → 無ければ maps/neonfinal.png 等）=====
  // ※実プロジェクトの命名が確定したらここだけ差し替えればOK
  function getAreaBg(areaId){
    const a = areaId|0;
    // よくある想定：maps/area1.png のような形。無ければ今は黒背景でも成立する
    return `maps/area${a}.png`;
  }

  function getRoundBg(state){
    // フェーズにより正方形背景を切替
    // - 初期：tent.png
    // - move：ido.png
    // - battle/ready：プレイヤー areaId の背景
    if (!state) return 'tent.png';

    if (state.phase === 'move') return 'ido.png';

    const p = (state.teams || []).find(t => t && t.isPlayer);
    if (p && !p.eliminated){
      const a = p.areaId|0;
      if (a === 25) return 'maps/neonfinal.png'; // 確定素材名
      return getAreaBg(a);
    }
    return 'tent.png';
  }

  // ===== ログ 3段化（「中央ログは必ず3段」）=====
  function normalize3Lines(main, sub){
    const l1 = String(main || '').trim();
    const l2raw = String(sub || '').trim();

    if (!l1 && !l2raw) return { l1:'', l2:'', l3:'' };

    // sub が「（イベント名）：（セリフ）」の形なら split
    const idx = l2raw.indexOf('：');
    if (idx >= 0){
      const a = l2raw.slice(0, idx).trim();
      const b = l2raw.slice(idx+1).trim();
      return { l1, l2: a, l3: b };
    }

    // sub が「A / B / C」みたいに長い場合は分割
    const parts = l2raw.split(' / ').map(s=>s.trim()).filter(Boolean);
    if (parts.length >= 2){
      return { l1, l2: parts[0], l3: parts.slice(1).join(' / ') };
    }

    return { l1, l2: l2raw, l3: '' };
  }

  // ===== 画像プレビュー（フルスクリーン）=====
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
    root.classList.add('isOpen');
    root.setAttribute('aria-hidden', 'false');

    const bg = el('div', 'tuiBg');
    // ✅ 大会背景（背面）
    bg.style.backgroundImage = `url("maps/neonmain.png")`;
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

    // 紙芝居レイヤー（左右キャラ）
    const stage = el('div', 'tuiStage');

    const left = el('div', 'tuiSide left');
    const leftName = el('div', 'tuiSideName');
    const leftImg = document.createElement('img');
    leftImg.className = 'tuiSideImg';
    leftImg.alt = 'player';
    leftImg.draggable = false;
    left.appendChild(leftName);
    left.appendChild(leftImg);

    const right = el('div', 'tuiSide right');
    const rightName = el('div', 'tuiSideName');
    const rightImg = document.createElement('img');
    rightImg.className = 'tuiSideImg';
    rightImg.alt = 'enemy';
    rightImg.draggable = false;
    right.appendChild(rightName);
    right.appendChild(rightImg);

    stage.appendChild(left);
    stage.appendChild(right);

    // スクロール（チーム紹介用：必要な時だけ表示）
    const scroll = el('div', 'tuiScroll');

    // ログ（3段）
    const log = el('div', 'tuiLog');
    const log1 = el('div', 'tuiLogMain');
    const log2 = el('div', 'tuiLogMid');
    const log3 = el('div', 'tuiLogSub');
    log.appendChild(log1);
    log.appendChild(log2);
    log.appendChild(log3);

    inner.appendChild(banner);
    inner.appendChild(stage);
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

    const btnPlayer = el('button', 'tuiBtn tuiBtnGhost');
    btnPlayer.type = 'button';
    btnPlayer.textContent = 'プレイヤー画像';
    btnPlayer.addEventListener('click', ()=>{
      openPreview(root, guessPlayerImage());
    });

    bottom.appendChild(btnNext);
    bottom.appendChild(btnPlayer);

    wrap.appendChild(top);
    wrap.appendChild(center);
    wrap.appendChild(bottom);

    root.appendChild(wrap);
    document.body.appendChild(root);

    return root;
  }

  function renderTeamIntroList(r, scroll, s){
    if (!scroll) return;
    scroll.innerHTML = '';

    const teams = Array.isArray(s?.teams) ? s.teams.slice() : [];
    if (!teams.length) return;

    // 紹介中は「全滅はほぼ出ない想定」だが一応
    teams.sort((a,b)=>{
      const aa = (a.eliminated ? -999 : (a.alive||0));
      const bb = (b.eliminated ? -999 : (b.alive||0));
      if (bb !== aa) return bb - aa;
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

      const nm = (t.isPlayer ? '★ ' : '') + (t.name || t.id || `TEAM ${idx+1}`);
      safeText(name, nm);

      const power = Number.isFinite(Number(t.power)) ? Math.round(Number(t.power)) : '';
      const alive = (t.alive ?? 0);
      const status = t.eliminated ? '全滅' : `生存${alive}`;

      // 総合戦闘力は表示OK（仕様：代表値）
      safeText(tag, `${status} / 総合${power}`);

      if (t.eliminated) row.style.opacity = '0.55';
      if (t.isPlayer){
        row.style.border = '1px solid rgba(255,59,48,.55)';
        row.style.background = 'rgba(255,59,48,.10)';
      }

      row.appendChild(name);
      row.appendChild(tag);
      scroll.appendChild(row);
    });
  }

  function render(){
    const r = ensureRoot();
    state = window.MOBBR?.sim?.tournamentFlow?.getState?.() || state;

    const meta = r.querySelector('.tuiMeta');
    const bL = r.querySelector('.tuiBanner .left');
    const bR = r.querySelector('.tuiBanner .right');
    const squareBg = r.querySelector('.tuiSquareBg');

    const stage = r.querySelector('.tuiStage');
    const leftName = r.querySelector('.tuiSide.left .tuiSideName');
    const leftImg  = r.querySelector('.tuiSide.left .tuiSideImg');
    const rightBox = r.querySelector('.tuiSide.right');
    const rightName= r.querySelector('.tuiSide.right .tuiSideName');
    const rightImg = r.querySelector('.tuiSide.right .tuiSideImg');

    const scroll = r.querySelector('.tuiScroll');
    const log1 = r.querySelector('.tuiLogMain');
    const log2 = r.querySelector('.tuiLogMid');
    const log3 = r.querySelector('.tuiLogSub');

    if (!state){
      safeText(meta, '');
      safeText(bL, '大会');
      safeText(bR, '');
      if (squareBg) squareBg.style.backgroundImage = `url("tent.png")`;
      if (scroll) scroll.style.display = 'none';
      safeText(log1, '大会データなし');
      safeText(log2, '');
      safeText(log3, 'BATTLEから開始してください');
      return;
    }

    // meta
    safeText(meta, `R${state.round ?? 1} / ${state.phase ?? ''}`);

    // banner
    safeText(bL, state.bannerLeft || `ROUND ${state.round ?? 1}`);
    safeText(bR, state.bannerRight || '');

    // square bg
    const bg = getRoundBg(state);
    if (squareBg) squareBg.style.backgroundImage = `url("${bg}")`;

    // 左（プレイヤー）
    const p = (state.teams || []).find(t => t && t.isPlayer) || null;
    if (p){
      safeText(leftName, p.name || 'PLAYER');
      if (leftImg){
        leftImg.onerror = () => { leftImg.onerror = null; };
        leftImg.src = guessPlayerImage();
      }
    }else{
      safeText(leftName, 'PLAYER');
      if (leftImg) leftImg.src = guessPlayerImage();
    }

    // 右（敵）：基本は隠す（現状は tournamentFlow が「敵チーム」をstateに保持してないため）
    // ここは後で「直近のプレイヤー交戦相手」を state.lastEnemy に積むようにすると完全対応できる
    const enemy = state.lastEnemy || null;
    if (enemy){
      rightBox.style.display = 'grid';
      safeText(rightName, enemy.name || enemy.id || 'ENEMY');
      rightImg.onerror = () => { rightImg.onerror = null; };
      rightImg.src = getTeamImageSrc(enemy);
    }else{
      rightBox.style.display = 'none';
    }

    // チーム紹介リスト：大会開始〜降下前（logsが浅い時）だけ表示
    // ※完全に仕様通りにするなら「紹介フェーズ/開始フェーズ」を state.phase で分けるが、
    // いまは既存Flowを壊さないため推定で出す
    const showList = (state.round === 1) && (state.phase === 'ready') && (state.logs && state.logs.length <= 4);
    if (scroll){
      scroll.style.display = showList ? 'block' : 'none';
      if (showList) renderTeamIntroList(r, scroll, state);
    }

    // log（プレイヤー視点ログのみ）
    const last = (state.logs && state.logs.length) ? state.logs[state.logs.length - 1] : null;

    const main = last?.main || state.logMain || '';
    const sub  = last?.sub  || state.logSub  || '';

    const t = normalize3Lines(main, sub);
    safeText(log1, t.l1);
    safeText(log2, t.l2);
    safeText(log3, t.l3);

    // stage の表示（常に見せて紙芝居感）
    if (stage) stage.style.display = 'grid';
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

  // init
  document.addEventListener('DOMContentLoaded', ()=> {
    ensureRoot();
    close();
  });

})();
