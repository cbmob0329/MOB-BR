'use strict';

/*
  MOB BR - app.js v19（フル）
  役割：
  - タイトル → メイン遷移制御
  - 分割JSの順序ロード
  - 各UI init の一元管理

  v19 変更点（今回）：
  ✅ タイトル表示中にモジュールを先読み（preload）して「NEXT押しても開かない」体感を根絶
  ✅ タイトルに「ローカル大会（テスト）」専用ボタンを追加して、タイトルから直で開始できる
  ✅ 連打/二重起動防止を強化（NEXT/TESTどちらも共通ガード）
*/

const APP_VER = 19;

// ===== DOM helpers =====
const $ = (id) => document.getElementById(id);

// ===== global namespace =====
window.MOBBR = window.MOBBR || {};
window.MOBBR.ver = APP_VER;

// ===== iOS: prevent double-tap zoom =====
(function preventDoubleTapZoom(){
  let lastTouchEnd = 0;
  document.addEventListener(
    'touchend',
    (e) => {
      const now = Date.now();
      if (now - lastTouchEnd <= 300) e.preventDefault();
      lastTouchEnd = now;
    },
    { passive: false }
  );
})();

// ===== show / hide =====
function showTitle(){
  const title = $('titleScreen');
  const app = $('app');
  if (title) title.style.display = 'block';
  if (app) app.style.display = 'none';
}

function showMain(){
  const title = $('titleScreen');
  const app = $('app');
  if (title) title.style.display = 'none';
  if (app) app.style.display = 'grid';
}

// ===== title loading hint =====
function setTitleHint(text){
  const el = $('titleHint');
  if (!el) return;
  el.textContent = String(text || '');
  el.style.display = text ? 'block' : 'none';
}

// ===== dynamic script loader =====
function loadScript(src){
  return new Promise((resolve, reject) => {
    const s = document.createElement('script');
    s.src = src;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load: ${src}`));
    document.head.appendChild(s);
  });
}

// ===== load all modules =====
async function loadModules(){
  const v = `?v=${APP_VER}`;

  /*
    読み込み順は超重要
    - storage / data → ui → sim
    - Flow は最後
  */
  const files = [
    // core
    `storage.js${v}`,
    `data_player.js${v}`,

    // cards data
    `data_cards.js${v}`,

    // UI（メイン系）
    `ui_main.js${v}`,
    `ui_team.js${v}`,
    `ui_training.js${v}`,

    // cards UI
    `ui_card.js${v}`,

    // shop UI（SPLIT）
    `ui_shop.core.js${v}`,
    `ui_shop.gacha.js${v}`,
    `ui_shop.catalog.js${v}`,

    // schedule UI
    `ui_schedule.js${v}`,

    // TOURNAMENT UI（CSS前提）
    `ui_tournament.js${v}`,

    // SIM
    `sim_battle.js${v}`,

    // 5大会シム
    `sim_tournament_local.js${v}`,
    `sim_tournament_national.js${v}`,
    `sim_tournament_lastchance.js${v}`,
    `sim_tournament_world.js${v}`,
    `sim_tournament_final.js${v}`,

    // Flow（最後）
    `sim_tournament_flow.js${v}`
  ];

  for (const f of files){
    await loadScript(f);
  }
}

// ===== boot sequence =====
let modulesLoaded = false;
let preloadPromise = null;
let bootBusy = false;

async function bootModulesIfNeeded(){
  if (modulesLoaded) return;

  // preload が走ってるならそれを待つ
  if (preloadPromise){
    await preloadPromise;
    modulesLoaded = true;
    return;
  }

  // なければ通常ロード
  await loadModules();
  modulesLoaded = true;
}

function initAll(){
  // storage
  if (window.MOBBR?.initStorage){
    window.MOBBR.initStorage();
  }

  // main UI
  if (window.MOBBR?.initMainUI){
    window.MOBBR.initMainUI();
  }

  // team
  if (window.MOBBR?.initTeamUI){
    window.MOBBR.initTeamUI();
  }

  // training
  if (window.MOBBR?.initTrainingUI){
    window.MOBBR.initTrainingUI();
  }

  // card
  if (window.MOBBR?.initCardUI){
    window.MOBBR.initCardUI();
  }

  // shop（coreが initShopUI を持つ）
  if (window.MOBBR?.initShopUI){
    window.MOBBR.initShopUI();
  }

  // schedule
  if (window.MOBBR?.initScheduleUI){
    window.MOBBR.initScheduleUI();
  }

  // tournament UI / flow：ロードされていれば使える状態（init不要）
}

async function goMain(){
  await bootModulesIfNeeded();
  initAll();
  showMain();
}

async function goLocalTournamentFromTitle(){
  await goMain();

  const Flow = window.MOBBR?.sim?.tournamentFlow;
  if (Flow && typeof Flow.startLocalTournament === 'function'){
    Flow.startLocalTournament();
  }else{
    console.warn('[app] tournamentFlow missing');
    alert('大会が開始できません（sim_tournament_flow.js / ui_tournament.js の読み込みを確認）');
  }
}

// ===== global events =====
function bindGlobalEvents(){
  window.addEventListener('mobbr:goTitle', () => {
    showTitle();
  });
}

// ===== boot =====
document.addEventListener('DOMContentLoaded', () => {
  bindGlobalEvents();
  showTitle();

  const btnNext = $('btnTitleNext');
  const btnLocal = $('btnTitleLocal');

  // ✅ v19: タイトル表示中に裏で先読み開始（体感無反応を消す）
  setTitleHint('読み込み中…');
  preloadPromise = loadModules()
    .then(() => {
      modulesLoaded = true;
      setTitleHint('');
    })
    .catch((err) => {
      console.error(err);
      // 先読み失敗しても「押した時に再トライ」できるようにする
      preloadPromise = null;
      setTitleHint('読み込みに失敗（通信/キャッシュ確認）');
    });

  async function guardedRun(fn){
    if (bootBusy) return;
    bootBusy = true;

    // 連打事故防止
    if (btnNext) btnNext.disabled = true;
    if (btnLocal) btnLocal.disabled = true;

    try{
      await fn();
    }catch(err){
      console.error(err);
      alert('読み込みに失敗しました（ファイル不足の可能性）');
      showTitle();
    }finally{
      // タイトルに戻っているなら押せるように戻す
      const title = $('titleScreen');
      if (title && title.style.display !== 'none'){
        if (btnNext) btnNext.disabled = false;
        if (btnLocal) btnLocal.disabled = false;
      }
      bootBusy = false;
    }
  }

  // NEXT → メインへ
  if (btnNext){
    const handler = () => guardedRun(goMain);
    btnNext.addEventListener('click', handler);
    // iOSでclick遅延が出る環境向け
    btnNext.addEventListener('touchstart', (e)=>{ e.preventDefault(); handler(); }, { passive:false });
  }

  // ✅ テスト用：タイトルからローカル大会開始
  if (btnLocal){
    const handler = () => guardedRun(goLocalTournamentFromTitle);
    btnLocal.addEventListener('click', handler);
    btnLocal.addEventListener('touchstart', (e)=>{ e.preventDefault(); handler(); }, { passive:false });
  }
});
