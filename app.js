'use strict';

/*
  MOB BR - app.js v18（フル）
  役割：
  - タイトル → メイン遷移制御
  - 分割JSの順序ロード
  - 各UI init の一元管理

  v18 変更点（今回）：
  - 「NEXT押下→メイン表示」をやめて、
    ①モジュールを先にロード＆初期化 → ②成功したらメイン表示
    に変更（BATTLE押下が早すぎて「未実装」になる事故を根絶）
*/

const APP_VER = 18;

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
    - Flow は「sim_tournament_local.js」等に依存するので最後
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

    // TOURNAMENT UI
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

// ===== boot after NEXT =====
let modulesLoaded = false;

async function bootAfterNext(){
  if (!modulesLoaded){
    await loadModules();
    modulesLoaded = true;
  }

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

  // tournament UI / flow は「ロードされていれば」使える状態になる（initは不要）
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

  const btn = $('btnTitleNext');
  if (btn){
    btn.addEventListener('click', async () => {
      // 連打事故防止（読み込み中に二重起動しない）
      btn.disabled = true;

      try{
        // ★v18: 先にロード＆初期化 → 成功したらメイン表示
        await bootAfterNext();
        showMain();
      }catch(err){
        console.error(err);
        alert('読み込みに失敗しました（ファイル不足の可能性）');
        showTitle();
      }finally{
        // タイトルに戻った場合のみ押せるようにする（メインに行けたら不要）
        // showTitle() が表示されているなら再有効化
        const title = $('titleScreen');
        if (title && title.style.display !== 'none'){
          btn.disabled = false;
        }
      }
    });
  }
});
