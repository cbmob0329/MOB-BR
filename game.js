/* =========================================================
   game.js (FULL)
   MOB Battle Royale Simulator (Apex-like tournament sim)
   - index.html から script 1本で読み込まれる前提
   - 19ファイル構成の中心オーケストレーター
   - まだ未実装のモジュール(UI/ASSETS/STATE等)があっても落ちないよう保険実装
   ========================================================= */

(() => {
  'use strict';

  const VERSION = 'v0.1-proto';

  // ---------------------------------------------------------
  // DOM
  // ---------------------------------------------------------
  const canvas = document.getElementById('game');
  const ctx = canvas.getContext('2d', { alpha: false });

  // “ui.js で必ず作る予定”の要素が無い場合も落ちないように取得しておく
  const uiRoot = document.getElementById('ui');
  const elCompany = document.getElementById('hud_company');
  const elRank = document.getElementById('hud_rank');
  const elTeam = document.getElementById('hud_team');
  const elLogText = document.getElementById('logText');

  // ---------------------------------------------------------
  // Basic util
  // ---------------------------------------------------------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const randInt = (a, b) => (a + Math.floor(Math.random() * (b - a + 1)));
  const now = () => performance.now();

  function fitRectContain(srcW, srcH, dstW, dstH) {
    const s = Math.min(dstW / srcW, dstH / srcH);
    const w = srcW * s;
    const h = srcH * s;
    return { x: (dstW - w) * 0.5, y: (dstH - h) * 0.5, w, h, s };
  }

  function drawPlaceholderBG(title, sub = '') {
    // 背景が無い場合の簡易表示（色＋文字）
    ctx.fillStyle = '#1a1a1a';
    ctx.fillRect(0, 0, canvas.width, canvas.height);

    ctx.fillStyle = 'rgba(255,255,255,0.10)';
    ctx.fillRect(20, 20, canvas.width - 40, canvas.height - 40);

    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 22px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(title, canvas.width / 2, canvas.height / 2 - 10);

    if (sub) {
      ctx.fillStyle = 'rgba(255,255,255,0.70)';
      ctx.font = 'bold 14px system-ui, sans-serif';
      ctx.fillText(sub, canvas.width / 2, canvas.height / 2 + 18);
    }
  }

  function logSet(text) {
    if (elLogText) elLogText.textContent = text;
    // ui.js のログ制御が来たらそっち優先
    if (window.UI && typeof window.UI.setLog === 'function') {
      window.UI.setLog(text);
    }
  }

  function hudSet({ company, rank, team }) {
    if (elCompany && company != null) elCompany.textContent = String(company);
    if (elRank && rank != null) elRank.textContent = String(rank);
    if (elTeam && team != null) elTeam.textContent = String(team);

    if (window.UI && typeof window.UI.setHUD === 'function') {
      window.UI.setHUD({ company, rank, team });
    }
  }

  // ---------------------------------------------------------
  // ASSET LOADER (temporary)
  // - 本命は assets.js で window.ASSETS が提供する
  // - ここは “無い画像もある” を前提に、無くても成立させる
  // ---------------------------------------------------------
  const Img = {
    main: new Image(),
    ido: new Image(),
    map: new Image(),
    shop: new Image(),
    heal: new Image(),
    battle: new Image(),
    winner: new Image(),
    p1: new Image(),
  };

  const ImgLoaded = {
    main: false, ido: false, map: false, shop: false, heal: false, battle: false, winner: false, p1: false
  };

  function loadImage(key, src) {
    return new Promise((resolve) => {
      const im = Img[key];
      im.onload = () => { ImgLoaded[key] = true; resolve(true); };
      im.onerror = () => { ImgLoaded[key] = false; resolve(false); };
      im.src = src;
    });
  }

  async function preloadCoreImages() {
    // ユーザー指定の固定名。変更禁止。
    // ここは “そのまま” 読みに行く（存在しなければプレースホルダ描画へ）
    await Promise.all([
      loadImage('p1', 'P1.png'),
      loadImage('main', 'main.png'),
      loadImage('ido', 'ido.png'),
      loadImage('map', 'map.png'),
      loadImage('shop', 'shop.png'),
      loadImage('heal', 'heal.png'),
      loadImage('battle', 'battle.png'),
      loadImage('winner', 'winner.png'),
    ]);

    // assets.js が出来たら、ここで window.ASSETS 側のプレロードにも寄せる
    if (window.ASSETS && typeof window.ASSETS.preload === 'function') {
      try { await window.ASSETS.preload(); } catch(e) { /* ignore */ }
    }
  }

  // ---------------------------------------------------------
  // GAME STATE (temporary)
  // - 本命は state.js で window.STATE を作る
  // ---------------------------------------------------------
  const Phase = {
    MAIN: 'MAIN',
    SHOP: 'SHOP',
    HEAL: 'HEAL',
    DROP: 'DROP',         // 降下前（マップ表示）
    MOVE: 'MOVE',         // 移動フェーズ（ido）
    BATTLE: 'BATTLE',     // 戦闘フェーズ（battle）
    RESULT: 'RESULT',     // 1試合結果
    TOURNAMENT: 'TOURNAMENT', // 大会進行（週・グループ・順位）
    WINNER: 'WINNER',     // 優勝演出（winner）
  };

  const Game = {
    version: VERSION,
    t0: now(),
    phase: Phase.MAIN,

    // input
    btnLocked: false,

    // quick settings
    companyName: 'MOB COMPANY',
    companyRank: 10,
    teamName: 'PLAYER TEAM',

    // “現状できることは全てやってみたい”のための土台（のちに state.js に移す）
    week: 1,
    month: 2,
    year: 1989,
    split: 1,
    seasonLabel: 'Split 1',
    inTournamentDay: false,

    // player team image control
    playerImgScale: 1,

    // step-by-step / skip
    allowSkip: true,

    // minimal placeholders
    lastMessage: '',
    winnerTeamName: '',
    winnerTeamIsPlayer: false,
  };

  window.GAME = Game; // デバッグ用（後で残してOK）

  // ---------------------------------------------------------
  // Buttons wiring (UI is in ui.js later)
  // - ここでは index.html のボタンIDを前提にする
  // ---------------------------------------------------------
  const btnTeam = document.getElementById('btnTeam');
  const btnScout = document.getElementById('btnScout');
  const btnTournament = document.getElementById('btnTournament');
  const btnNext = document.getElementById('btnNext');
  const btnSkip = document.getElementById('btnSkip');

  function safeOn(el, ev, fn) {
    if (!el) return;
    el.addEventListener(ev, (e) => {
      if (Game.btnLocked) return;
      fn(e);
    });
  }

  function lockButtons(ms = 250) {
    Game.btnLocked = true;
    setTimeout(() => Game.btnLocked = false, ms);
  }

  function gotoPhase(p) {
    Game.phase = p;
    // phase遷移を ui.js に通知
    if (window.UI && typeof window.UI.onPhaseChange === 'function') {
      window.UI.onPhaseChange(p, Game);
    }
  }

  // メインコマンド
  safeOn(btnTeam, 'click', () => {
    lockButtons();
    // “未実装でも現状できることは見せる”：モーダル等は ui.js で
    logSet('チーム編成（未実装）\n今はデータ土台のみ。次で実装していく。');
    if (window.UI && typeof window.UI.openModal === 'function') {
      window.UI.openModal('チーム編成', '（未実装）\n今後：選手一覧／装備／連携／企業ランク等を表示。');
    }
  });

  safeOn(btnScout, 'click', () => {
    lockButtons();
    logSet('勧誘（未実装）\n今後：オファーキャラ購入／加入処理。');
    if (window.UI && typeof window.UI.openModal === 'function') {
      window.UI.openModal('勧誘', '（未実装）\n今後：オファーキャラ（企業ランク適正）を購入・加入。');
    }
  });

  safeOn(btnTournament, 'click', () => {
    lockButtons();
    // 大会の日メッセージは tournamentルール側で詳細化（sim_rules_*.js）
    gotoPhase(Phase.DROP);
    logSet('降下フェーズ（MAP）\nNEXTで移動へ / SKIPで結果まで（プロト）。');
  });

  // NEXT / SKIP
  safeOn(btnNext, 'click', () => {
    lockButtons();
    onNext();
  });

  safeOn(btnSkip, 'click', () => {
    lockButtons();
    if (!Game.allowSkip) return;
    onSkip();
  });

  function onNext() {
    // プロト段階：フェーズを順に回す（後で state.js + sim_* で本格化）
    switch (Game.phase) {
      case Phase.MAIN:
        gotoPhase(Phase.DROP);
        logSet('降下フェーズ（MAP）\nNEXTで移動へ / SKIPで結果まで。');
        break;

      case Phase.DROP:
        gotoPhase(Phase.MOVE);
        logSet('移動フェーズ（IDO）\nプレイヤーチーム画像を前面に表示。\nNEXTで戦闘へ。');
        break;

      case Phase.MOVE:
        gotoPhase(Phase.BATTLE);
        logSet('戦闘開始！\n（プロト：まだ簡易）\nNEXTで結果へ。');
        break;

      case Phase.BATTLE:
        gotoPhase(Phase.RESULT);
        logSet('結果（プロト）\nNEXTでメインへ戻る。');
        // 仮の勝敗
        Game.winnerTeamIsPlayer = Math.random() < 0.35;
        Game.winnerTeamName = Game.winnerTeamIsPlayer ? Game.teamName : 'ENEMY TEAM';
        break;

      case Phase.RESULT:
        gotoPhase(Phase.WINNER);
        logSet(`WINNER!\n${Game.winnerTeamName}`);
        break;

      case Phase.WINNER:
      default:
        gotoPhase(Phase.MAIN);
        logSet('メイン画面\n大会ボタンで開始（プロト）。');
        break;
    }
  }

  function onSkip() {
    // プロト段階：一気にWINNERまで飛ばす
    if (Game.phase === Phase.MAIN) {
      gotoPhase(Phase.DROP);
    }
    // “結果まで一気に可能”
    Game.winnerTeamIsPlayer = Math.random() < 0.35;
    Game.winnerTeamName = Game.winnerTeamIsPlayer ? Game.teamName : 'ENEMY TEAM';
    gotoPhase(Phase.WINNER);
    logSet(`SKIP結果\nWINNER: ${Game.winnerTeamName}`);
  }

  // ---------------------------------------------------------
  // Draw helpers
  // ---------------------------------------------------------
  function drawImageOrPlaceholder(key, title) {
    const im = Img[key];
    const ok = ImgLoaded[key] && im && im.naturalWidth > 0;
    if (ok) {
      ctx.drawImage(im, 0, 0, canvas.width, canvas.height);
    } else {
      drawPlaceholderBG(title, `missing: ${key}.png`);
    }
  }

  function drawOverlayPlayerImage() {
    // ido.png の前面に P1.png を表示（大きい場合は最適化）
    const ok = ImgLoaded.p1 && Img.p1.naturalWidth > 0;
    if (!ok) return;

    // 表示枠（画面右側のメイン枠を想定：おおよそ center-right）
    const frameX = 160;
    const frameY = 110;
    const frameW = 240;
    const frameH = 260;

    // 枠内に収める（contain）
    const f = fitRectContain(Img.p1.naturalWidth, Img.p1.naturalHeight, frameW, frameH);
    const dx = frameX + f.x;
    const dy = frameY + f.y;
    ctx.drawImage(Img.p1, dx, dy, f.w, f.h);
  }

  function drawOverlayWinnerImage() {
    // winner.png の前面に “優勝チーム画像” を表示
    // 現時点：プレイヤー優勝ならP1.png、敵なら簡易絵（未実装）
    if (Game.winnerTeamIsPlayer && ImgLoaded.p1 && Img.p1.naturalWidth > 0) {
      const frameX = 90;
      const frameY = 140;
      const frameW = 240;
      const frameH = 240;

      const f = fitRectContain(Img.p1.naturalWidth, Img.p1.naturalHeight, frameW, frameH);
      ctx.drawImage(Img.p1, frameX + f.x, frameY + f.y, f.w, f.h);
      return;
    }

    // 敵優勝：簡易的な絵（色＋文字）
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(90, 170, 240, 180);
    ctx.fillStyle = 'rgba(255,255,255,0.9)';
    ctx.font = 'bold 18px system-ui, sans-serif';
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText('ENEMY WIN', canvas.width / 2, 250);

    ctx.font = 'bold 14px system-ui, sans-serif';
    ctx.fillStyle = 'rgba(255,255,255,0.8)';
    ctx.fillText('（敵画像 未実装）', canvas.width / 2, 280);
  }

  function drawTopDebug() {
    // バージョン表示（UI側に出す想定だが、保険でCanvasにも）
    ctx.fillStyle = 'rgba(0,0,0,0.45)';
    ctx.fillRect(6, 6, 120, 22);
    ctx.fillStyle = 'rgba(255,255,255,0.85)';
    ctx.font = 'bold 12px system-ui, sans-serif';
    ctx.textAlign = 'left';
    ctx.textBaseline = 'middle';
    ctx.fillText(`VER ${VERSION}`, 12, 17);
  }

  // ---------------------------------------------------------
  // Main render
  // ---------------------------------------------------------
  function render() {
    switch (Game.phase) {
      case Phase.MAIN:
        drawImageOrPlaceholder('main', 'MAIN');
        break;
      case Phase.SHOP:
        drawImageOrPlaceholder('shop', 'SHOP');
        break;
      case Phase.HEAL:
        drawImageOrPlaceholder('heal', 'HEAL');
        break;
      case Phase.DROP:
        drawImageOrPlaceholder('map', 'MAP');
        break;
      case Phase.MOVE:
        drawImageOrPlaceholder('ido', 'IDO');
        drawOverlayPlayerImage(); // ✅ ido前面にP1
        break;
      case Phase.BATTLE:
        drawImageOrPlaceholder('battle', 'BATTLE');
        break;
      case Phase.RESULT:
        // いったんbattle背景の上に結果文字（のちにUI/演出へ）
        drawImageOrPlaceholder('battle', 'BATTLE');
        ctx.fillStyle = 'rgba(0,0,0,0.55)';
        ctx.fillRect(40, 210, canvas.width - 80, 140);
        ctx.fillStyle = 'rgba(255,255,255,0.92)';
        ctx.font = 'bold 18px system-ui, sans-serif';
        ctx.textAlign = 'center';
        ctx.textBaseline = 'middle';
        ctx.fillText('RESULT (PROTO)', canvas.width / 2, 245);
        ctx.font = 'bold 16px system-ui, sans-serif';
        ctx.fillText(`Winner: ${Game.winnerTeamName || '---'}`, canvas.width / 2, 280);
        break;
      case Phase.WINNER:
        drawImageOrPlaceholder('winner', 'WINNER');
        drawOverlayWinnerImage(); // ✅ winner前面に優勝チーム（P1 or 簡易）
        break;
      default:
        drawPlaceholderBG('UNKNOWN', Game.phase);
        break;
    }

    drawTopDebug();
  }

  // ---------------------------------------------------------
  // Tick
  // ---------------------------------------------------------
  let raf = 0;
  function loop() {
    render();
    raf = requestAnimationFrame(loop);
  }

  // ---------------------------------------------------------
  // Boot
  // ---------------------------------------------------------
  async function boot() {
    // HUD
    hudSet({
      company: Game.companyName,
      rank: `RANK ${Game.companyRank}`,
      team: Game.teamName,
    });

    // 初期ログ
    logSet('メイン画面\n「大会」ボタンでプロト開始。\n（今は流れだけ、次で実装を詰める）');

    // 画像プリロード（無くてもOK）
    await preloadCoreImages();

    // ui.js が来たら、UI初期化へ寄せる
    if (window.UI && typeof window.UI.init === 'function') {
      try { window.UI.init(Game); } catch(e) { /* ignore */ }
    }

    // 開始
    gotoPhase(Phase.MAIN);
    loop();
  }

  // start
  boot();

  // ---------------------------------------------------------
  // Cleanup (optional)
  // ---------------------------------------------------------
  window.addEventListener('beforeunload', () => {
    if (raf) cancelAnimationFrame(raf);
  });

})();
