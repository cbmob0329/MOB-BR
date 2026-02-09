'use strict';

/* =========================================================
   MOB BR - ui_tournament.js（FULL v1.0 / CSS前提整理）
   ---------------------------------------------------------
   前提：
   - tournament.css（共通CSS）を使う
   - “大会画面”は overlay として固定表示（body直下）
   - 背景は body.tournament-mode + neonmain.png（CSS側）
   - 中央：正方形ステージ画像（既定 tent.png）
   - 前面：プレイヤー画像（P1.png 等）
   - RESULT/OVERALL/メッセージは HUD パネルで表示
   ---------------------------------------------------------
   公開API（sim_tournament_flow.js から呼ばれる前提）：
   window.MOBBR.ui.tournament = {
     open(scene),
     close(),
     setScene(scene),
     showMessage(title, lines, nextLabel),
     showResult({title, sub, rows, highlightTeamId}),
     setNextHandler(fn),
     setNextEnabled(bool)
   }
========================================================= */

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){
  const T = {};
  window.MOBBR.ui.tournament = T;

  // -----------------------------
  // INTERNAL
  // -----------------------------
  const DEFAULT_BG = 'neonmain.png';
  const DEFAULT_STAGE = 'tent.png';
  const DEFAULT_PLAYER = 'P1.png';

  let dom = null;
  let nextHandler = null;
  let nextEnabled = true;

  function $(id){ return document.getElementById(id); }

  function ensureDom(){
    if (dom) return dom;

    // root
    const root = document.createElement('div');
    root.className = 'mobbrTourRoot';
    root.id = 'mobbrTournamentUI';
    root.setAttribute('aria-label', '大会');
    root.style.display = 'none';

    // stage area
    const stage = document.createElement('div');
    stage.className = 'mobbrTourStage';
    stage.id = 'mobbrTourStage';

    const stageImg = document.createElement('img');
    stageImg.className = 'mobbrTourStageImg';
    stageImg.id = 'mobbrTourStageImg';
    stageImg.alt = '';
    stageImg.draggable = false;

    const playerImg = document.createElement('img');
    playerImg.className = 'mobbrTourPlayerImg';
    playerImg.id = 'mobbrTourPlayerImg';
    playerImg.alt = 'PLAYER';
    playerImg.draggable = false;

    const enemyImg = document.createElement('img');
    enemyImg.className = 'mobbrTourEnemyImg';
    enemyImg.id = 'mobbrTourEnemyImg';
    enemyImg.alt = 'ENEMY';
    enemyImg.draggable = false;

    const overlay = document.createElement('div');
    overlay.className = 'mobbrTourOverlay';
    overlay.id = 'mobbrTourOverlay';

    stage.appendChild(stageImg);
    stage.appendChild(playerImg);
    stage.appendChild(enemyImg);
    stage.appendChild(overlay);

    // HUD
    const hud = document.createElement('div');
    hud.className = 'mobbrTourHud';
    hud.id = 'mobbrTourHud';

    const hudHead = document.createElement('div');
    hudHead.className = 'mobbrTourHudHead';

    const ttl = document.createElement('div');
    ttl.className = 'mobbrTourTitle';
    ttl.id = 'mobbrTourTitle';
    ttl.textContent = '大会';

    const sub = document.createElement('div');
    sub.className = 'mobbrTourSub';
    sub.id = 'mobbrTourSub';
    sub.textContent = '';

    hudHead.appendChild(ttl);
    hudHead.appendChild(sub);

    const hudBody = document.createElement('div');
    hudBody.className = 'mobbrTourHudBody';
    hudBody.id = 'mobbrTourBody';

    const nextRow = document.createElement('div');
    nextRow.className = 'mobbrTourNextRow';

    const btnNext = document.createElement('button');
    btnNext.className = 'mobbrTourNextBtn';
    btnNext.id = 'mobbrTourNextBtn';
    btnNext.type = 'button';
    btnNext.textContent = 'NEXT';

    btnNext.addEventListener('click', (e)=>{
      e.preventDefault();
      if (!nextEnabled) return;
      if (typeof nextHandler === 'function') nextHandler();
    });

    nextRow.appendChild(btnNext);

    hud.appendChild(hudHead);
    hud.appendChild(hudBody);
    hud.appendChild(nextRow);

    // mount
    root.appendChild(stage);
    root.appendChild(hud);

    document.body.appendChild(root);

    // iOS: prevent double tap zoom on next button area (念のため)
    root.addEventListener('touchend', ()=>{}, { passive:true });

    dom = {
      root,
      stage,
      stageImg,
      playerImg,
      enemyImg,
      overlay,
      hud,
      ttl,
      sub,
      body: hudBody,
      btnNext
    };

    return dom;
  }

  function setBodyTournamentMode(on){
    try{
      document.body.classList.toggle('tournament-mode', !!on);
    }catch(e){}
  }

  function setBg(bg){
    const b = String(bg || DEFAULT_BG);

    // tournament.css は :root --tour-bg を見てる想定
    // CSS変数で差し替え（bodyにセット）
    try{
      document.documentElement.style.setProperty('--tour-bg', b);
    }catch(e){}
  }

  function setStageImage(src){
    const d = ensureDom();
    const s = String(src || DEFAULT_STAGE);
    d.stageImg.src = s;
  }

  function setPlayerImage(src){
    const d = ensureDom();
    const s = String(src || DEFAULT_PLAYER);
    d.playerImg.src = s;
  }

  function setEnemyImage(src){
    const d = ensureDom();
    const s = String(src || '').trim();
    if (!s){
      d.enemyImg.style.display = 'none';
      d.enemyImg.src = '';
      return;
    }
    d.enemyImg.src = s;
    d.enemyImg.style.display = 'block';
  }

  function clearBody(){
    const d = ensureDom();
    d.body.innerHTML = '';
  }

  function putMessageLines(lines){
    const d = ensureDom();
    clearBody();

    const arr = Array.isArray(lines) ? lines : [String(lines || '')];
    for (const line of arr){
      const div = document.createElement('div');
      div.className = 'mobbrTourMsgLine';
      div.textContent = String(line ?? '');
      d.body.appendChild(div);
    }
  }

  function normalizeRows(rows){
    const arr = Array.isArray(rows) ? rows : [];
    return arr.map((r, idx)=>{
      const rank = Number(r.rank ?? r.place ?? (idx+1));
      const teamId = String(r.teamId ?? '');
      const teamName = String(r.teamName ?? r.name ?? teamId ?? '');
      const points = Number(r.points ?? r.total ?? 0);

      const kills = Number(r.kills ?? r.kp ?? 0);
      const assists = Number(r.assists ?? r.ap ?? 0);
      const treasure = Number(r.treasure ?? 0);
      const flag = Number(r.flag ?? 0);

      return { rank, teamId, teamName, points, kills, assists, treasure, flag };
    });
  }

  function renderResultTable(rows, highlightTeamId){
    const d = ensureDom();
    clearBody();

    const table = document.createElement('table');
    table.className = 'mobbrTourTable';

    const thead = document.createElement('thead');
    const trh = document.createElement('tr');

    const headers = [
      { key:'rank', label:'#' },
      { key:'teamName', label:'TEAM' },
      { key:'points', label:'PT' },
      { key:'kills', label:'K' },
      { key:'assists', label:'A' },
      { key:'treasure', label:'TR' },
      { key:'flag', label:'FLAG' }
    ];

    for (const h of headers){
      const th = document.createElement('th');
      th.textContent = h.label;
      trh.appendChild(th);
    }
    thead.appendChild(trh);

    const tbody = document.createElement('tbody');

    const arr = normalizeRows(rows);
    const hi = String(highlightTeamId || '').trim();

    for (const r of arr){
      const tr = document.createElement('tr');
      if (hi && r.teamId && String(r.teamId) === hi){
        tr.className = 'mobbrTourRowHi';
      }

      const tdRank = document.createElement('td');
      tdRank.textContent = String(r.rank ?? '');
      tr.appendChild(tdRank);

      const tdName = document.createElement('td');
      tdName.textContent = String(r.teamName ?? '');
      tr.appendChild(tdName);

      const tdPt = document.createElement('td');
      tdPt.textContent = String(r.points ?? 0);
      tr.appendChild(tdPt);

      const tdK = document.createElement('td');
      tdK.textContent = String(r.kills ?? 0);
      tr.appendChild(tdK);

      const tdA = document.createElement('td');
      tdA.textContent = String(r.assists ?? 0);
      tr.appendChild(tdA);

      const tdTr = document.createElement('td');
      tdTr.textContent = String(r.treasure ?? 0);
      tr.appendChild(tdTr);

      const tdF = document.createElement('td');
      tdF.textContent = String(r.flag ?? 0);
      tr.appendChild(tdF);

      tbody.appendChild(tr);
    }

    table.appendChild(thead);
    table.appendChild(tbody);
    d.body.appendChild(table);
  }

  function setTitle(title, sub){
    const d = ensureDom();
    d.ttl.textContent = String(title || '');
    d.sub.textContent = String(sub || '');
  }

  function setNextLabel(label){
    const d = ensureDom();
    d.btnNext.textContent = String(label || 'NEXT');
  }

  function setNextEnabledInternal(on){
    nextEnabled = !!on;
    const d = ensureDom();
    d.btnNext.disabled = !nextEnabled;
  }

  // -----------------------------
  // PUBLIC API
  // -----------------------------

  /**
   * open(scene)
   * scene:
   *  - bg: neonmain.png 等（省略可）
   *  - stageImage: tent.png 等（省略可 / 既定 tent.png）
   *  - playerImage: P1.png 等
   *  - enemyImage: 任意（空なら非表示）
   *  - title: 見出し
   *  - messageLines: 配列
   *  - nextLabel: 文字
   *  - nextEnabled: bool
   *  - onNext: function
   *  - highlightTeamId: （showResultで使うが、保持してもOK）
   */
  T.open = function(scene){
    const d = ensureDom();
    const s = scene || {};

    setBodyTournamentMode(true);
    setBg(s.bg || DEFAULT_BG);
    setStageImage(s.stageImage || DEFAULT_STAGE);
    setPlayerImage(s.playerImage || DEFAULT_PLAYER);
    setEnemyImage(s.enemyImage || '');

    // scene title + message
    setTitle(s.title || '大会', '');
    putMessageLines(Array.isArray(s.messageLines) ? s.messageLines : ['NEXTで進行します']);

    // next
    if (typeof s.onNext === 'function') nextHandler = s.onNext;
    setNextLabel(s.nextLabel || 'NEXT');
    setNextEnabledInternal(s.nextEnabled !== false);

    d.root.style.display = 'grid';
    d.root.setAttribute('aria-hidden','false');
  };

  T.close = function(){
    const d = ensureDom();

    d.root.style.display = 'none';
    d.root.setAttribute('aria-hidden','true');

    // overlayなども消す
    d.overlay.classList.remove('is-on');
    d.overlay.innerHTML = '';

    setBodyTournamentMode(false);

    // next handler は残してもいいが、事故防止でnullに寄せる
    nextHandler = null;
    setNextEnabledInternal(true);
  };

  /**
   * setScene(scene)
   * open後に差し替える（フェーズ切替など）
   */
  T.setScene = function(scene){
    const d = ensureDom();
    const s = scene || {};

    // 表示してなければopen相当
    if (d.root.style.display === 'none'){
      T.open(scene);
      return;
    }

    setBodyTournamentMode(true);
    if (s.bg) setBg(s.bg);
    if (s.stageImage) setStageImage(s.stageImage);
    if (s.playerImage) setPlayerImage(s.playerImage);
    if ('enemyImage' in s) setEnemyImage(s.enemyImage);

    if (s.title) setTitle(s.title, '');
    if (Array.isArray(s.messageLines)) putMessageLines(s.messageLines);

    if (typeof s.onNext === 'function') nextHandler = s.onNext;
    if (s.nextLabel) setNextLabel(s.nextLabel);
    if ('nextEnabled' in s) setNextEnabledInternal(s.nextEnabled !== false);
  };

  /**
   * showMessage(title, lines, nextLabel)
   */
  T.showMessage = function(title, lines, nextLabel){
    const d = ensureDom();

    // openされてない場合も、最低限見せる（既定シーンで）
    if (d.root.style.display === 'none'){
      T.open({
        bg: DEFAULT_BG,
        stageImage: DEFAULT_STAGE,
        playerImage: DEFAULT_PLAYER,
        title: '大会',
        messageLines: ['NEXTで進行します'],
        nextLabel: 'NEXT',
        nextEnabled: true
      });
    }

    setTitle(String(title || '大会'), '');
    putMessageLines(lines);
    if (nextLabel) setNextLabel(nextLabel);
  };

  /**
   * showResult({title, sub, rows, highlightTeamId})
   */
  T.showResult = function(opt){
    const d = ensureDom();
    const o = opt || {};

    // openされてない場合も、最低限見せる（既定シーンで）
    if (d.root.style.display === 'none'){
      T.open({
        bg: DEFAULT_BG,
        stageImage: DEFAULT_STAGE,
        playerImage: DEFAULT_PLAYER,
        title: '大会',
        messageLines: ['NEXTで進行します'],
        nextLabel: 'NEXT',
        nextEnabled: true
      });
    }

    setTitle(String(o.title || 'RESULT'), String(o.sub || ''));
    renderResultTable(o.rows || [], o.highlightTeamId || '');
  };

  /**
   * setNextHandler(fn)
   */
  T.setNextHandler = function(fn){
    nextHandler = (typeof fn === 'function') ? fn : null;
  };

  /**
   * setNextEnabled(bool)
   */
  T.setNextEnabled = function(on){
    setNextEnabledInternal(!!on);
  };

})();
