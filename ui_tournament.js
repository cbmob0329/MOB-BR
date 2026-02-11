'use strict';

/*
  ui_tournament.js v4（フル）
  - 大会UI：mobbrTui（overlay）
  - チーム行は「押せるボタン」扱い（当たり判定を行全体へ）
  - チーム名タップで「チーム画像プレビュー」
    ・プレイヤー：P1.png（将来P2/P3対応余地）
    ・CPU：DataCPU.getAssetBase() + '/' + teamId + '.png'
  - sim_tournament_flow.js の state を描画して進行
  - ✅交戦演出（UI側）
      * brbattle.png を表示
      * 10ログ高速切替（順番）
      * brwin.png / brlose.png を表示
      * 最後に勝敗セリフ → NEXT復帰
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

  // ===== Image Preview (fullscreen) =====
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

  // ===== Battle lines (順番固定) =====
  const BATTLE_LINES = [
    'やってやんべ！',
    '裏取るぞ！',
    '展開する！',
    'サポートするぞ！',
    'うわあー！',
    'ミスった！',
    '一気に行くぞ！',
    '今のうちに回復だ！',
    '絶対勝つぞ！',
    '撃て―！'
  ];

  const WIN_LINES = [
    'よし！次に備えるぞ！',
    'やったー！勝ったぞ！',
    'ナイスー！'
  ];

  const LOSE_LINES = [
    'やられた..',
    '次だ次！',
    '負けちまった..'
  ];

  function pickOne(list){
    if (!Array.isArray(list) || list.length === 0) return '';
    return list[(Math.random()*list.length)|0] || '';
  }

  // ===== UI Root =====
  let root = null;
  let lastState = null;
  let animating = false;
  let animTimer = null;

  function clearAnimTimer(){
    if (animTimer){
      clearInterval(animTimer);
      animTimer = null;
    }
  }

  function ensureRoot(){
    if (root) return root;

    root = el('div', 'mobbrTui');
    root.classList.add('isOpen');
    root.setAttribute('aria-hidden', 'false');

    const bg = el('div', 'tuiBg');
    // 大会背景（なければ黒でOK）
    bg.style.backgroundImage = `url("neonmain.png")`;
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

    // ✅ battle stage block
    const stage = el('div', 'tuiStage');
    stage.style.display = 'none';

    const leftSide = el('div', 'tuiSide');
    const leftName = el('div', 'tuiSideName');
    const leftImg = document.createElement('img');
    leftImg.className = 'tuiSideImg';
    leftImg.alt = 'player';
    leftImg.draggable = false;
    leftSide.appendChild(leftName);
    leftSide.appendChild(leftImg);

    const rightSide = el('div', 'tuiSide');
    const rightName = el('div', 'tuiSideName');
    const rightImg = document.createElement('img');
    rightImg.className = 'tuiSideImg';
    rightImg.alt = 'enemy';
    rightImg.draggable = false;
    rightSide.appendChild(rightName);
    rightSide.appendChild(rightImg);

    // brbattle (top)
    const battleTop = el('div', 'tuiBattleTop');
    const battleTopImg = document.createElement('img');
    battleTopImg.alt = 'battle';
    battleTopImg.draggable = false;
    battleTopImg.src = 'brbattle.png';
    battleTop.appendChild(battleTopImg);

    // brwin/lose (center)
    const battleResult = el('div', 'tuiBattleResult');
    const battleResultImg = document.createElement('img');
    battleResultImg.alt = 'result';
    battleResultImg.draggable = false;
    battleResult.appendChild(battleResultImg);

    stage.appendChild(leftSide);
    stage.appendChild(rightSide);
    stage.appendChild(battleTop);
    stage.appendChild(battleResult);

    // scroll list (teams)
    const scroll = el('div', 'tuiScroll');

    // central log (3段対応：Main / Mid / Sub)
    const log = el('div', 'tuiLog');
    const logMain = el('div', 'tuiLogMain');
    const logMid  = el('div', 'tuiLogMid');
    const logSub  = el('div', 'tuiLogSub');
    log.appendChild(logMain);
    log.appendChild(logMid);
    log.appendChild(logSub);

    // battle log box (高速切替用)
    const bLog = el('div', 'tuiBattleLog');
    const bLine = el('div', 'tuiBattleLine');
    bLog.appendChild(bLine);

    inner.appendChild(banner);
    inner.appendChild(stage);
    inner.appendChild(scroll);
    inner.appendChild(log);
    inner.appendChild(bLog);

    square.appendChild(inner);
    center.appendChild(square);

    // BOTTOM
    const bottom = el('div', 'tuiBottom');

    const btnNext = el('button', 'tuiBtn');
    btnNext.type = 'button';
    btnNext.textContent = '次へ';

    const btnGhost = el('button', 'tuiBtn tuiBtnGhost');
    btnGhost.type = 'button';
    btnGhost.textContent = 'チーム画像（プレイヤー）';
    btnGhost.addEventListener('click', ()=>{
      openPreview(root, guessPlayerImage());
    });

    btnNext.addEventListener('click', async ()=>{
      if (animating) return;

      const Flow = window.MOBBR?.sim?.tournamentFlow;
      if (!Flow || typeof Flow.step !== 'function'){
        alert('大会進行が見つかりません（sim_tournament_flow.js 読み込みを確認）');
        return;
      }

      // 直前state
      const before = Flow.getState?.() || null;

      // 進行
      Flow.step();

      // 直後state
      const after = Flow.getState?.() || null;

      // 描画（いったん）
      render();

      // ✅プレイヤー交戦ログが増えたタイミングだけ演出
      try{
        await maybePlayBattleAnimation(before, after);
      }catch(e){
        // 演出失敗しても進行は落とさない
        console.warn(e);
      }finally{
        render();
      }
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

  function getUiNodes(){
    const r = ensureRoot();
    return {
      r,
      bg: r.querySelector('.tuiBg'),
      meta: r.querySelector('.tuiMeta'),
      bL: r.querySelector('.tuiBanner .left'),
      bR: r.querySelector('.tuiBanner .right'),
      squareBg: r.querySelector('.tuiSquareBg'),
      scroll: r.querySelector('.tuiScroll'),
      logMain: r.querySelector('.tuiLogMain'),
      logMid: r.querySelector('.tuiLogMid'),
      logSub: r.querySelector('.tuiLogSub'),
      stage: r.querySelector('.tuiStage'),
      leftName: r.querySelector('.tuiStage .tuiSide:nth-child(1) .tuiSideName'),
      leftImg: r.querySelector('.tuiStage .tuiSide:nth-child(1) img'),
      rightName: r.querySelector('.tuiStage .tuiSide:nth-child(2) .tuiSideName'),
      rightImg: r.querySelector('.tuiStage .tuiSide:nth-child(2) img'),
      battleTop: r.querySelector('.tuiBattleTop'),
      battleResult: r.querySelector('.tuiBattleResult'),
      battleResultImg: r.querySelector('.tuiBattleResult img'),
      battleLog: r.querySelector('.tuiBattleLog'),
      battleLine: r.querySelector('.tuiBattleLine'),
      btnNext: r.querySelector('.tuiBottom .tuiBtn')
    };
  }

  function extractOpponentNameFromSub(sub){
    // 例：`相手：TEAM（相手生存2）/ 自軍生存3`
    const s = String(sub || '');
    const m = s.match(/相手：([^（/]+)\s*/);
    if (m && m[1]) return m[1].trim();
    return '';
  }

  function findCpuTeamByName(state, nm){
    if (!state || !Array.isArray(state.teams)) return null;
    const s = String(nm || '');
    if (!s) return null;
    // name完全一致優先
    let t = state.teams.find(x => String(x.name||'') === s);
    if (t) return t;
    // 部分一致
    t = state.teams.find(x => String(x.name||'').includes(s));
    return t || null;
  }

  function isPlayerFightLog(entry){
    const main = String(entry?.main || '');
    return (main === 'ファイト勝利！' || main === 'ファイト敗北…');
  }

  function maybeGetNewLastLog(before, after){
    const b = (before?.logs && before.logs.length) ? before.logs[before.logs.length-1] : null;
    const a = (after?.logs && after.logs.length) ? after.logs[after.logs.length-1] : null;
    if (!a) return null;
    // beforeと同一参照っぽい場合でも main/sub で差分判定
    if (!b) return a;
    if (String(a.main||'') !== String(b.main||'') || String(a.sub||'') !== String(b.sub||'')) return a;
    return null;
  }

  async function maybePlayBattleAnimation(before, after){
    const newLast = maybeGetNewLastLog(before, after);
    if (!newLast) return;

    if (!isPlayerFightLog(newLast)) return;

    const ui = getUiNodes();

    const player = (after?.teams || []).find(t => t.isPlayer) || null;
    const enemyName = extractOpponentNameFromSub(newLast.sub);
    const enemy = findCpuTeamByName(after, enemyName);

    // 画像セット（無くても落とさない）
    ui.stage.style.display = 'grid';
    safeText(ui.leftName, player?.name ? `★ ${player.name}` : '★ PLAYER');
    safeText(ui.rightName, enemy?.name || enemyName || 'ENEMY');

    ui.leftImg.onerror = ()=>{ ui.leftImg.onerror=null; };
    ui.rightImg.onerror = ()=>{ ui.rightImg.onerror=null; };

    ui.leftImg.src = guessPlayerImage();
    ui.rightImg.src = enemy ? getTeamImageSrc(enemy) : (enemyName ? `${getCpuBase}/${enemyName}.png` : '');

    // battle overlay on
    ui.battleTop.classList.add('show');
    ui.battleResult.classList.remove('show');
    ui.battleLog.classList.add('show');

    // NEXT無効化（連打防止）
    animating = true;
    if (ui.btnNext) ui.btnNext.disabled = true;

    // 戦闘ログ高速切替（順番で10個）
    let idx = 0;
    safeText(ui.battleLine, BATTLE_LINES[0] || '');
    clearAnimTimer();

    await new Promise((resolve)=>{
      animTimer = setInterval(()=>{
        idx++;
        if (idx >= BATTLE_LINES.length){
          clearAnimTimer();
          resolve();
          return;
        }
        safeText(ui.battleLine, BATTLE_LINES[idx]);
      }, 140); // 高速
    });

    // 少し間
    await new Promise(r=>setTimeout(r, 220));

    // 勝敗
    const won = (String(newLast.main||'') === 'ファイト勝利！');
    ui.battleTop.classList.remove('show');
    ui.battleResultImg.src = won ? 'brwin.png' : 'brlose.png';
    ui.battleResult.classList.add('show');

    // 最終セリフ
    await new Promise(r=>setTimeout(r, 280));
    safeText(ui.battleLine, won ? pickOne(WIN_LINES) : pickOne(LOSE_LINES));

    // しばらく見せる
    await new Promise(r=>setTimeout(r, 520));

    // battle UI off（結果はログ枠に残る）
    ui.battleResult.classList.remove('show');
    ui.battleLog.classList.remove('show');
    ui.stage.style.display = 'none';

    animating = false;
    if (ui.btnNext) ui.btnNext.disabled = false;
  }

  function render(){
    const ui = getUiNodes();

    const Flow = window.MOBBR?.sim?.tournamentFlow;
    const state = Flow?.getState?.() || null;
    lastState = state;

    if (!state){
      safeText(ui.meta, '');
      safeText(ui.bL, '大会');
      safeText(ui.bR, '');
      if (ui.scroll) ui.scroll.innerHTML = '';
      safeText(ui.logMain, '大会データなし');
      safeText(ui.logMid, '');
      safeText(ui.logSub, 'BATTLEから開始してください');
      return;
    }

    // meta
    const round = state.round ?? 1;
    const phase = state.phase ?? 'start';
    safeText(ui.meta, `R${round} / ${phase}`);

    // banner
    safeText(ui.bL, state.bannerLeft || `ROUND ${round}`);
    safeText(ui.bR, state.bannerRight || '');

    // square bg（Flow側が差し込めるように）
    // 例：state.squareBg = 'tent.png' / 'maps/xxx.png' / 'ido.png'
    if (ui.squareBg && state.squareBg){
      ui.squareBg.style.backgroundImage = `url("${state.squareBg}")`;
    }

    // central log（3段対応。無ければ従来の main/sub を使う）
    const last = (state.logs && state.logs.length) ? state.logs[state.logs.length - 1] : null;

    // event v2（log1/log2/log3）にも後で対応できるよう、state.currentEvent を見に行く
    if (state.currentEvent && (state.currentEvent.log1 || state.currentEvent.log2 || state.currentEvent.log3)){
      safeText(ui.logMain, state.currentEvent.log1 || 'イベント発生！');
      safeText(ui.logMid,  state.currentEvent.log2 || '');
      safeText(ui.logSub,  state.currentEvent.log3 || '');
    }else{
      safeText(ui.logMain, last?.main || state.logMain || '大会開始');
      safeText(ui.logMid,  ''); // v2では中段が無いので空
      safeText(ui.logSub,  last?.sub || state.logSub || '');
    }

    // list
    if (ui.scroll){
      ui.scroll.innerHTML = '';

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
          if (src) openPreview(ui.r, src);
        }, { passive:true });

        const name = el('div', 'name');
        const tag = el('div', 'tag');

        const alive = (t.alive ?? 0);
        const status = t.eliminated ? '全滅' : `生存${alive}`;

        const nm = (t.isPlayer ? '★ ' : '') + (t.name || t.id || `TEAM ${idx+1}`);
        safeText(name, nm);

        const treasure = t.treasure || 0;
        const flag = t.flag || 0;

        let extra = '';
        if (treasure || flag) extra += ` / お宝${treasure} フラッグ${flag}`;

        safeText(tag, `${status}${extra}`);

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
        ui.scroll.appendChild(row);
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
    clearAnimTimer();
    animating = false;
  }

  // expose
  window.MOBBR.ui.tournament = { open, close, render };

  // app.js から呼べる初期化口（v17.6が呼ぶ）
  window.MOBBR.initTournamentUI = function(){
    ensureRoot();
    close();
  };

  // init（ロードされたら作るだけ。表示はFlow.startで）
  document.addEventListener('DOMContentLoaded', ()=> {
    ensureRoot();
    close();
  });

})();
