'use strict';

/*
  ui_tournament.js v4（フル）
  ✅追加：
  - state.battleView があれば「戦闘演出レイヤー」を表示（brbattle/brwin/brlose）
  - state.matchResult があれば「1試合result表」を表示
  - state.tournamentResult があれば「大会result表」を表示
  - state.bgImage を正方形背景に反映（maps/* / tent / ido / battle.png）
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

  function guessPlayerImage(){
    return 'P1.png';
  }
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
    const base = getCpuBase();
    return `${base}/${team.id}.png`;
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

    const log = el('div', 'tuiBattleLog');
    const logLine = el('div', 'tuiBattleLine');
    log.appendChild(logLine);

    const resultImg = document.createElement('img');
    resultImg.className = 'tuiBattleResultImg';
    resultImg.alt = 'battle result';
    resultImg.draggable = false;

    lay.appendChild(top);
    lay.appendChild(mid);
    lay.appendChild(resultImg);
    lay.appendChild(log);

    root.appendChild(lay);
    return lay;
  }

  let battleTimer = null;
  function stopBattleAnim(){
    if (battleTimer){
      clearInterval(battleTimer);
      battleTimer = null;
    }
  }

  function renderBattleLayer(root, state){
    const lay = ensureBattleLayer(root);
    const bv = state?.battleView;

    if (!bv){
      stopBattleAnim();
      lay.classList.remove('show');
      lay.setAttribute('aria-hidden', 'true');
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

    // bg は squareBg が担当（Flow側で state.bgImage が maps に入ってる）
    if (topImg) topImg.src = 'brbattle.png';

    safeText(leftName, bv.playerTeamName || 'PLAYER');
    safeText(rightName, bv.enemyTeamName || 'ENEMY');

    if (leftImg) leftImg.src = guessPlayerImage();
    if (rightImg) rightImg.src = `${getCpuBase()}/${bv.enemyTeamId}.png`;

    // 戦闘中は結果非表示
    if (resultImg){
      resultImg.style.opacity = '0';
      resultImg.src = '';
    }

    // ランダム高速切り替え（10個）
    stopBattleAnim();
    const lines = Array.isArray(bv.chatter) ? bv.chatter.slice() : [];
    let idx = 0;

    // ウルトは厳密実装前なので「ランダムで1回だけ混ぜる」だけ（ログ演出要件を先に満たす）
    if (lines.length >= 6 && Math.random() < 0.35){
      lines[(Math.random()*lines.length)|0] = 'ウルト行くぞ！';
    }

    if (logLine) safeText(logLine, lines[0] || '交戦中…');

    battleTimer = setInterval(()=>{
      idx++;
      if (idx < lines.length){
        if (logLine) safeText(logLine, lines[idx]);
        return;
      }

      // 終了
      stopBattleAnim();

      const res = bv.result;
      if (resultImg){
        if (res === 'win' || res === 'champ') resultImg.src = 'brwin.png';
        else resultImg.src = 'brlose.png';
        resultImg.style.opacity = '1';
      }

      if (logLine) safeText(logLine, bv.afterLine || '');
    }, 180);
  }

  // ========= results table =========
  function buildTableRow(cells, cls){
    const tr = document.createElement('tr');
    if (cls) tr.className = cls;
    for (const c of cells){
      const td = document.createElement('td');
      td.textContent = String(c ?? '');
      tr.appendChild(td);
    }
    return tr;
  }

  function renderResultPanel(root, state){
    const box = root.querySelector('.tuiResult');
    if (!box) return;

    const mr = state?.matchResult;
    const tr = state?.tournamentResult;

    // 何も無いなら隠す
    if (!mr && !tr){
      box.classList.remove('show');
      box.setAttribute('aria-hidden', 'true');
      box.innerHTML = '';
      return;
    }

    box.classList.add('show');
    box.setAttribute('aria-hidden', 'false');
    box.innerHTML = '';

    const title = el('div', 'tuiResultTitle');
    const tableWrap = el('div', 'tuiResultTableWrap');

    const table = document.createElement('table');
    table.className = 'tuiTable';

    const thead = document.createElement('thead');
    const tbody = document.createElement('tbody');

    if (mr){
      safeText(title, `RESULT（試合 ${mr.matchIndex}/5）`);

      thead.appendChild(buildTableRow(
        ['Placement','Squad','KP','AP','Treasure','Flag','Total','PlacementP'],
        'head'
      ));

      for (const r of (mr.rows || [])){
        tbody.appendChild(buildTableRow(
          [r.placement, r.squad, r.kp, r.ap, r.treasure, r.flag, r.total, r.placementP],
          r.teamId === 'PLAYER' ? 'me' : ''
        ));
      }
    }else{
      safeText(title, 'TOURNAMENT RESULT（5試合合算）');

      thead.appendChild(buildTableRow(
        ['Rank','Squad','総合P','総合順位P','KP','AP','Treasure','Flag'],
        'head'
      ));

      const rows = (tr.rows || []);
      rows.forEach((r, i)=>{
        tbody.appendChild(buildTableRow(
          [i+1, r.squad, r.totalP, r.sumPlacementP, r.kp, r.ap, r.treasure, r.flag],
          r.teamId === 'PLAYER' ? 'me' : ''
        ));
      });
    }

    table.appendChild(thead);
    table.appendChild(tbody);
    tableWrap.appendChild(table);

    box.appendChild(title);
    box.appendChild(tableWrap);
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

    // result panel（同じ枠内に表示）
    const resultBox = el('div', 'tuiResult');
    resultBox.setAttribute('aria-hidden', 'true');

    const log = el('div', 'tuiLog');
    const log1 = el('div', 'tuiLogL1');
    const log2 = el('div', 'tuiLogL2');
    const log3 = el('div', 'tuiLogL3');
    log.appendChild(log1);
    log.appendChild(log2);
    log.appendChild(log3);

    inner.appendChild(banner);
    inner.appendChild(scroll);
    inner.appendChild(resultBox);
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

  function render(){
    const r = ensureRoot();
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
      renderBattleLayer(r, null);
      renderResultPanel(r, null);
      return;
    }

    safeText(title, state.mode === 'local' ? 'ローカル大会' : '大会');

    const round = state.round ?? 1;
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

    // 戦闘レイヤー
    renderBattleLayer(r, state);

    // result panel
    renderResultPanel(r, state);

    // list（result表示中は隠す）
    const showingResult = !!(state.matchResult || state.tournamentResult);
    if (scroll){
      scroll.style.display = showingResult ? 'none' : 'block';
      scroll.innerHTML = '';

      if (!showingResult){
        const teams = Array.isArray(state.teams) ? state.teams.slice() : [];
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
          const tag  = el('div', 'tag');

          const alive = (t.alive ?? 0);
          const status = t.eliminated ? '全滅' : `生存${alive}`;
          const nm = (t.isPlayer ? '★ ' : '') + (t.name || t.id || `TEAM ${idx+1}`);
          safeText(name, nm);

          const treasure = t.treasure || 0;
          const flag = t.flag || 0;
          const pwr = Number.isFinite(Number(t.power)) ? Math.round(Number(t.power)) : 0;
          let extra = ` / 総合力${pwr}`;
          if (treasure || flag) extra += ` / お宝${treasure} フラッグ${flag}`;
          safeText(tag, `${status}${extra}`);

          if (t.eliminated) row.style.opacity = '0.55';
          else row.style.opacity = '1';

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
