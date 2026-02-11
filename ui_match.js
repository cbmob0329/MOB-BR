'use strict';

/*
  ui_match.js v1（FULL）
  - 試合UI（紙芝居風） overlay
  - 手動進行（A）：NEXTボタンでのみ進む（AUTOなし）
  - 画像ロード待ち：
      * 背景(Area/ido/tent)が読み込めてから「到着」表示へ
      * 交戦前に「接敵!!」「○○ vs ○○!!」演出中に敵画像をロード
  - 交戦ログは“演出が終わってから”結果を出す設計（呼び出し側で制御）
  - public API:
      open(), close()
      setPlayerTeamName(name)
      setPlayerImage(src)
      setEnemy(teamName, teamIdOrSrc)
      setBackground(src) -> Promise
      showCenterLog3(l1,l2,l3, {icon}) -> Promise(next)
      showArrival(tentBg, line1, line2) -> Promise(next)
      showTeamIntroStart() -> Promise(next)  // 「本日の出場チームをご紹介！」
      showTeamList(teams) -> Promise(next)   // スクロール一覧
      showContactIntro(playerName, enemyName) -> Promise(派手演出完了)
      playBattleChatter(lines, ms) -> Promise(ログ演出完了)
      showBattleBanner(type) -> Promise(2秒後にNEXT出す)
      showMoveStart() -> Promise(next)
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){

  const $ = (sel, root=document) => root.querySelector(sel);

  function el(tag, cls){
    const d = document.createElement(tag);
    if (cls) d.className = cls;
    return d;
  }

  function sleep(ms){
    return new Promise(r => setTimeout(r, ms));
  }

  function safeText(node, t){
    if (!node) return;
    node.textContent = String(t ?? '');
  }

  // 画像ロードを待つ（失敗しても一定時間で抜ける）
  function preloadImage(src, timeoutMs=2500){
    return new Promise((resolve) => {
      if (!src) return resolve({ ok:false, src:'' });

      const img = new Image();
      let done = false;

      const finish = (ok) => {
        if (done) return;
        done = true;
        resolve({ ok, src });
      };

      const t = setTimeout(() => finish(false), timeoutMs);

      img.onload = () => { clearTimeout(t); finish(true); };
      img.onerror = () => { clearTimeout(t); finish(false); };
      img.src = src;
    });
  }

  // ===== root =====
  let root = null;

  // state
  const UI = {
    isOpen: false,
    playerName: 'PLAYER TEAM',
    playerImg: 'P1.png',
    enemyName: '',
    enemyImg: '',
    bgSrc: '',
    nextResolver: null,
    nextEnabled: false
  };

  function ensureRoot(){
    if (root) return root;

    root = el('div', 'mobbrMui');
    root.setAttribute('aria-hidden', 'true');

    // BG（フェード用）
    const bg = el('div', 'muiBg');
    root.appendChild(bg);

    // WRAP
    const wrap = el('div', 'muiWrap');

    // TOP
    const top = el('div', 'muiTop');
    const title = el('div', 'muiTitle');
    title.textContent = 'MATCH';
    const meta = el('div', 'muiMeta');
    meta.textContent = '';
    const closeBtn = el('button', 'muiClose');
    closeBtn.type = 'button';
    closeBtn.textContent = '閉じる';
    closeBtn.addEventListener('click', close);

    top.appendChild(title);
    top.appendChild(meta);
    top.appendChild(closeBtn);

    // CENTER (Square)
    const center = el('div', 'muiCenter');
    const square = el('div', 'muiSquare');

    const squareBg = el('div', 'muiSquareBg');
    square.appendChild(squareBg);

    // battle overlay assets
    const battleTop = el('img', 'muiBattleTop');
    battleTop.alt = 'battle';
    battleTop.draggable = false;
    battleTop.style.display = 'none';
    square.appendChild(battleTop);

    const resultStamp = el('img', 'muiResultStamp');
    resultStamp.alt = 'result';
    resultStamp.draggable = false;
    resultStamp.style.display = 'none';
    square.appendChild(resultStamp);

    // fighters
    const left = el('div', 'muiFighter left');
    const leftName = el('div', 'muiName left');
    const leftImg = document.createElement('img');
    leftImg.className = 'muiChar';
    leftImg.alt = 'player';
    leftImg.draggable = false;
    left.appendChild(leftName);
    left.appendChild(leftImg);

    const right = el('div', 'muiFighter right');
    const rightName = el('div', 'muiName right');
    const rightImg = document.createElement('img');
    rightImg.className = 'muiChar';
    rightImg.alt = 'enemy';
    rightImg.draggable = false;
    right.appendChild(rightName);
    right.appendChild(rightImg);

    square.appendChild(left);
    square.appendChild(right);

    // center log (3 lines fixed)
    const logBox = el('div', 'muiLog');
    const l1 = el('div', 'muiLogL1');
    const l2 = el('div', 'muiLogL2');
    const l3 = el('div', 'muiLogL3');
    const icon = el('img', 'muiIcon');
    icon.alt = 'icon';
    icon.draggable = false;
    icon.style.display = 'none';

    logBox.appendChild(icon);
    logBox.appendChild(l1);
    logBox.appendChild(l2);
    logBox.appendChild(l3);

    square.appendChild(logBox);

    center.appendChild(square);

    // BOTTOM
    const bottom = el('div', 'muiBottom');
    const nextBtn = el('button', 'muiNext');
    nextBtn.type = 'button';
    nextBtn.textContent = 'NEXT';
    nextBtn.addEventListener('click', () => {
      if (!UI.nextEnabled) return;
      UI.nextEnabled = false;
      nextBtn.disabled = true;
      nextBtn.classList.remove('show');

      const r = UI.nextResolver;
      UI.nextResolver = null;
      if (typeof r === 'function') r();
    });

    bottom.appendChild(nextBtn);

    wrap.appendChild(top);
    wrap.appendChild(center);
    wrap.appendChild(bottom);

    root.appendChild(wrap);
    document.body.appendChild(root);

    return root;
  }

  function applyStateToDom(){
    const r = ensureRoot();
    const bg = $('.muiBg', r);
    const squareBg = $('.muiSquareBg', r);

    const leftName = $('.muiName.left', r);
    const rightName = $('.muiName.right', r);
    const leftImg = $('.muiFighter.left img', r);
    const rightImg = $('.muiFighter.right img', r);

    safeText(leftName, UI.playerName || '');
    safeText(rightName, UI.enemyName || '');

    if (leftImg) leftImg.src = UI.playerImg || 'P1.png';
    if (rightImg) rightImg.src = UI.enemyImg || '';

    if (bg) bg.style.backgroundImage = UI.bgSrc ? `url("${UI.bgSrc}")` : '';
    if (squareBg) squareBg.style.backgroundImage = UI.bgSrc ? `url("${UI.bgSrc}")` : '';

    // battle top / stamp hidden by default
    const battleTop = $('.muiBattleTop', r);
    const resultStamp = $('.muiResultStamp', r);
    if (battleTop) battleTop.style.display = 'none';
    if (resultStamp) resultStamp.style.display = 'none';
  }

  function open(){
    const r = ensureRoot();
    UI.isOpen = true;
    r.classList.add('isOpen');
    r.style.display = 'block';
    r.style.pointerEvents = 'auto';
    r.setAttribute('aria-hidden', 'false');
    applyStateToDom();
  }

  function close(){
    if (!root) return;
    UI.isOpen = false;
    root.classList.remove('isOpen');
    root.style.display = 'none';
    root.style.pointerEvents = 'none';
    root.setAttribute('aria-hidden', 'true');
    UI.nextResolver = null;
    UI.nextEnabled = false;
  }

  function waitNext(){
    const r = ensureRoot();
    const nextBtn = $('.muiNext', r);
    if (!nextBtn) return Promise.resolve();

    UI.nextEnabled = true;
    nextBtn.disabled = false;
    nextBtn.classList.add('show');

    return new Promise((resolve) => {
      UI.nextResolver = resolve;
    });
  }

  function hideNext(){
    const r = ensureRoot();
    const nextBtn = $('.muiNext', r);
    UI.nextEnabled = false;
    if (nextBtn){
      nextBtn.disabled = true;
      nextBtn.classList.remove('show');
    }
    UI.nextResolver = null;
  }

  // ===== public setters =====
  function setPlayerTeamName(name){
    UI.playerName = String(name || 'PLAYER TEAM');
    if (UI.isOpen) applyStateToDom();
  }

  function setPlayerImage(src){
    UI.playerImg = String(src || 'P1.png');
    if (UI.isOpen) applyStateToDom();
  }

  // enemySrc は「画像直指定」でも「teamId」でもOK
  function setEnemy(teamName, teamIdOrSrc){
    UI.enemyName = String(teamName || '');
    UI.enemyImg = String(teamIdOrSrc || '');
    if (UI.isOpen) applyStateToDom();
  }

  async function setBackground(src){
    UI.bgSrc = String(src || '');
    // 背景ロード待ち（読み込めてから切替）
    await preloadImage(UI.bgSrc, 2500);
    if (UI.isOpen) applyStateToDom();
  }

  // ===== UI building blocks =====
  function setLog3(l1, l2, l3, iconSrc){
    const r = ensureRoot();
    const a = $('.muiLogL1', r);
    const b = $('.muiLogL2', r);
    const c = $('.muiLogL3', r);
    const icon = $('.muiIcon', r);

    safeText(a, l1 || '');
    safeText(b, l2 || '');
    safeText(c, l3 || '');

    if (iconSrc){
      icon.style.display = 'block';
      icon.src = iconSrc;
    }else{
      icon.style.display = 'none';
      icon.removeAttribute('src');
    }
  }

  async function showCenterLog3(l1, l2, l3, opt={}){
    hideNext();
    setLog3(l1, l2, l3, opt.icon || '');
    return waitNext();
  }

  // 会場到着（tent）
  async function showArrival(tentBg='tent.png', line1='バトルスタート！', line2='降下開始…！'){
    await setBackground(tentBg);
    hideNext();
    setLog3(line1, line2, '');
    return waitNext();
  }

  // チーム紹介開始文
  async function showTeamIntroStart(){
    hideNext();
    setLog3('本日の出場チームをご紹介！', '', '');
    return waitNext();
  }

  // チーム一覧スクロール（ここではUIだけ）
  async function showTeamList(teams){
    // log欄に「一覧表示中」を出し、右下NEXTで抜ける
    hideNext();

    const r = ensureRoot();
    const square = $('.muiSquare', r);

    // list overlay
    let list = $('.muiTeamList', r);
    if (!list){
      list = el('div', 'muiTeamList');
      square.appendChild(list);
    }
    list.innerHTML = '';

    const head = el('div', 'muiTeamListHead');
    head.textContent = 'Teams';
    list.appendChild(head);

    const sc = el('div', 'muiTeamListScroll');
    list.appendChild(sc);

    (Array.isArray(teams) ? teams : []).forEach((t) => {
      const row = el('div', 'muiTeamRow');
      const n = el('div', 'n');
      const m = el('div', 'm');

      safeText(n, t?.name || t?.teamName || t?.id || '');
      // 表示は「総合力（代表値）」＋メンバー名だけ（%は出さない）
      const rep = (t?.power_rep != null) ? `総合力:${t.power_rep}` : (t?.power != null ? `総合力:${t.power}` : '');
      const mem = Array.isArray(t?.members) ? t.members.map(x => x?.name).filter(Boolean).slice(0,3).join(' / ') : '';
      safeText(m, `${rep}${mem ? ` / ${mem}` : ''}`);

      row.appendChild(n);
      row.appendChild(m);
      sc.appendChild(row);
    });

    setLog3('スクロールで確認', 'NEXTで進行', '');

    // NEXTで閉じる
    await waitNext();

    list.remove();
    setLog3('', '', '');
  }

  // 交戦前の「接敵→VS」派手演出中に敵画像ロードを完了させる
  async function showContactIntro(playerName, enemyName){
    hideNext();

    const r = ensureRoot();
    const battleTop = $('.muiBattleTop', r);
    const resultStamp = $('.muiResultStamp', r);

    if (resultStamp) resultStamp.style.display = 'none';

    // battleTop は brbattle.png を一瞬だけ使う（派手な帯）
    if (battleTop){
      battleTop.src = 'brbattle.png';
      battleTop.style.display = 'block';
      battleTop.classList.add('flash');
    }

    // まず「接敵!!」
    setLog3('接敵‼︎', '', '');
    // この間に敵画像ロード
    await preloadImage(UI.enemyImg, 2500);
    // 少し余韻
    await sleep(700);

    // 次に「○○ vs ○○!!」
    const p = String(playerName || UI.playerName || '');
    const e = String(enemyName || UI.enemyName || '');
    setLog3(`${p} vs ${e}‼︎`, '', '');
    await sleep(900);

    if (battleTop){
      battleTop.classList.remove('flash');
      // 交戦中は表示し続けたいならここで残す。いったん消す。
      battleTop.style.display = 'none';
    }
  }

  // 交戦中ログ（高速切替）※この関数が終わった“後”に結果を出す
  async function playBattleChatter(lines, ms=180){
    hideNext();
    const list = Array.isArray(lines) ? lines : [];
    const n = Math.max(1, Math.min(30, list.length || 10));

    for (let i=0;i<n;i++){
      const t = list[i % list.length] || '';
      setLog3('', t, '');
      await sleep(ms);
      setLog3('', '', '');
      await sleep(Math.max(40, ms * 0.45));
    }
  }

  // 勝敗スタンプを2秒見せてからNEXTを出す
  async function showBattleBanner(type){
    // type: 'win'|'lose'|'finalwin' etc
    hideNext();

    const r = ensureRoot();
    const stamp = $('.muiResultStamp', r);
    if (stamp){
      if (type === 'win' || type === 'finalwin'){
        stamp.src = 'brwin.png';
      }else{
        stamp.src = 'brlose.png';
      }
      stamp.style.display = 'block';
      stamp.classList.add('pop');
    }

    await sleep(2000);

    if (stamp){
      stamp.classList.remove('pop');
    }

    return waitNext();
  }

  async function showMoveStart(){
    await setBackground('ido.png');
    hideNext();
    setLog3('安置が縮む…移動開始！', 'ルート変更。急げ！', '');
    return waitNext();
  }

  // expose
  window.MOBBR.ui.match = {
    open,
    close,

    setPlayerTeamName,
    setPlayerImage,
    setEnemy,
    setBackground,

    showCenterLog3,
    showArrival,
    showTeamIntroStart,
    showTeamList,

    showContactIntro,
    playBattleChatter,
    showBattleBanner,

    showMoveStart
  };

})();
