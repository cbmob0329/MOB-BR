/* =========================================================
   MOB BR - app.js (FULL)
   - 起動処理
   - メイン画面
   - 週進行
   - 画面遷移の司令塔
   ---------------------------------------------------------
   重要ルール（厳守）：
   ・数値（%/勝率/内部補正）はUIに出さない
   ・表示は ui.js、試合進行は sim.js に委譲
   ・9ファイル構成・名前変更禁止
========================================================= */

(function(){
  'use strict';

  /* =========================
     DOM
  ========================== */
  const el = {
    dateText: document.getElementById('dateText'),
    bgImage: document.getElementById('bgImage'),
    playerImage: document.getElementById('playerImage'),
    enemyImage: document.getElementById('enemyImage'),
    playerTeamName: document.getElementById('playerTeamName'),
    enemyTeamName: document.getElementById('enemyTeamName'),
    autoBtn: document.getElementById('autoBtn'),
    nextBtn: document.getElementById('nextBtn'),
  };

  /* =========================
     APP STATE
  ========================== */
  const AppState = {
    mode: 'main',          // 'main' | 'training' | 'shop' | 'tournament' | 'match'
    auto: false,
    busy: false,           // 処理中ロック
    initialized: false,
  };

  /* =========================
     CONSTANTS
  ========================== */
  const ASSETS = {
    main: 'assets/main1.png',
    ido: 'assets/ido.png',
    battle: 'assets/battle.png',
    winner: 'assets/winner.png',
    map: 'assets/map.png',
    shop: 'assets/shop.png',
  };

  /* =========================
     INIT
  ========================== */
  function init(){
    // Storage 初期化
    Storage.init();

    // 初期データの整合
    ensureInitialState();

    // UI 初期描画
    renderMain();

    // イベント
    bindEvents();

    AppState.initialized = true;

    // 初回メッセージ
    UI.setMessage('準備完了。次の行動を選ぼう。');
  }

  /* =========================
     STATE ENSURE
  ========================== */
  function ensureInitialState(){
    const s = Storage.getState();

    // 初回起動時
    if(!s || !s.current){
      Storage.reset();
    }

    // 表示用の初期画像
    setBackground(ASSETS.main);
    setPlayerImage(Storage.getPlayerTeamImage());
    hideEnemy();
  }

  /* =========================
     RENDER
  ========================== */
  function renderMain(){
    AppState.mode = 'main';

    // 日付表示
    el.dateText.textContent = formatDate(Storage.getCurrentDate());

    // 背景
    setBackground(ASSETS.main);

    // プレイヤー
    setPlayerImage(Storage.getPlayerTeamImage());
    el.playerTeamName.textContent = Storage.getTeamName();
    el.playerTeamName.style.opacity = 1;

    hideEnemy();

    // ボタン
    el.nextBtn.classList.remove('is-disabled');
  }

  /* =========================
     EVENTS
  ========================== */
  function bindEvents(){
    el.nextBtn.addEventListener('click', onNext);
    el.autoBtn.addEventListener('click', onToggleAuto);
  }

  function onNext(){
    if(AppState.busy) return;

    if(AppState.mode === 'main'){
      proceedWeek();
      return;
    }

    // 他モードは ui/sim 側に委譲
    UI.next();
  }

  function onToggleAuto(){
    AppState.auto = !AppState.auto;
    el.autoBtn.classList.toggle('is-on', AppState.auto);
    UI.setAuto(AppState.auto);
  }

  /* =========================
     WEEK PROGRESSION
  ========================== */
  function proceedWeek(){
    AppState.busy = true;

    // 週切り替え
    Storage.nextWeek();

    // 週ポップ表示
    const d = Storage.getCurrentDate();
    UI.showPopup([
      `${d.year}年${d.month}月 第${d.week}週`,
      getWeeklyGText()
    ], () => {
      // 大会チェック
      if(Storage.isTournamentWeek()){
        startTournamentWeek();
      }else{
        // 通常週
        renderMain();
        AppState.busy = false;
      }
    });
  }

  function getWeeklyGText(){
    const g = Storage.calcWeeklyG();
    return `企業ランクにより ${g}G 獲得！`;
  }

  /* =========================
     TOURNAMENT
  ========================== */
  function startTournamentWeek(){
    AppState.mode = 'tournament';

    // 開始メッセージ（大会種別ごと）
    const msg = Storage.getTournamentStartMessage();
    UI.showPopup([msg], () => {
      // 試合画面へ
      startMatch();
    });
  }

  /* =========================
     MATCH
  ========================== */
  function startMatch(){
    AppState.mode = 'match';

    // 背景：降下前
    setBackground(ASSETS.main);

    // 敵非表示
    hideEnemy();

    // sim に試合開始を委譲
    Sim.startMatch({
      onUpdate: handleSimUpdate,
      onEnd: handleMatchEnd
    });
  }

  function handleSimUpdate(update){
    // 表示のみを ui.js に委譲
    UI.applySimUpdate(update);
  }

  function handleMatchEnd(result){
    // result 表示後、メインへ戻す
    UI.showResult(result, () => {
      renderMain();
      AppState.busy = false;
    });
  }

  /* =========================
     VIEW HELPERS
  ========================== */
  function setBackground(src){
    el.bgImage.src = src;
  }

  function setPlayerImage(src){
    el.playerImage.src = src;
  }

  function showEnemy(team){
    if(!team) return;
    el.enemyImage.src = `assets/${team.teamId}.png`;
    el.enemyImage.style.opacity = 1;
    el.enemyTeamName.textContent = team.name;
    el.enemyTeamName.style.opacity = 1;
  }

  function hideEnemy(){
    el.enemyImage.style.opacity = 0;
    el.enemyTeamName.style.opacity = 0;
    el.enemyImage.src = '';
    el.enemyTeamName.textContent = '';
  }

  /* =========================
     UTIL
  ========================== */
  function formatDate(d){
    if(!d) return '----';
    return `${d.year}年${d.month}月 第${d.week}週`;
  }

  /* =========================
     BOOT
  ========================== */
  window.addEventListener('DOMContentLoaded', init);

  /* =========================
     EXPOSE (UI/Sim から呼ばれる)
  ========================== */
  window.App = {
    showEnemy,
    hideEnemy,
    setBackground,
    setPlayerImage,
    renderMain,
  };

})();
