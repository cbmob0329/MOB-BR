'use strict';

/*
  MOB BR - app.js v19（フル）
  役割：
  - タイトル → メイン遷移制御
  - 分割JSの順序ロード
  - 各UI init の一元管理

  v19 変更点：
  - タイトルのNEXTが不安定な時の原因を特定できるように
    「失敗したファイル名」をalert表示
  - タイトルに「ローカル大会（テスト）」ボタンを追加した場合、
    そのボタンでも必ず modules を先にロードしてから大会開始する
    （Flow未ロード事故を根絶）
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

    // TOURNAMENT UI（★追加：大会UI）
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

  // どのファイルで落ちたか特定できるようにする
  for (const f of files){
    try{
      await loadScript(f);
    }catch(err){
      err._mobbrFile = f;
      throw err;
    }
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

  // tournament UI / flow はロードされていれば使える（init不要）
}

// ===== global events =====
function bindGlobalEvents(){
  window.addEventListener('mobbr:goTitle', () => {
    showTitle();
  });
}

// ===== util: safe alert =====
function alertLoadError(err){
  const f = err?._mobbrFile || '';
  const msg = f
    ? `読み込みに失敗しました\n${f}\n\n（ファイル不足/名前違い/場所違い/大文字小文字）`
    : '読み込みに失敗しました（ファイル不足の可能性）';
  console.error(err);
  alert(msg);
}

// ===== boot =====
document.addEventListener('DOMContentLoaded', () => {
  bindGlobalEvents();
  showTitle();

  const btnNext = $('btnTitleNext');
  const btnTestLocal = $('btnTitleLocalTest'); // ★タイトルのテスト大会ボタン（index側で用意）

  // NEXT
  if (btnNext){
    btnNext.addEventListener('click', async () => {
      btnNext.disabled = true;
      if (btnTestLocal) btnTestLocal.disabled = true;

      try{
        await bootAfterNext();
        showMain();
      }catch(err){
        alertLoadError(err);
        showTitle();
      }finally{
        const title = $('titleScreen');
        if (title && title.style.display !== 'none'){
          btnNext.disabled = false;
          if (btnTestLocal) btnTestLocal.disabled = false;
        }
      }
    });
  }

  // ★タイトルから「ローカル大会（テスト）」
  if (btnTestLocal){
    btnTestLocal.addEventListener('click', async () => {
      btnTestLocal.disabled = true;
      if (btnNext) btnNext.disabled = true;

      try{
        // 重要：先にロード＆初期化
        await bootAfterNext();

        // メイン表示は “しない” でもOK（大会UIはoverlayで出る）
        // showMain(); ← テストでメインも見たいならコメント解除

        const Flow = window.MOBBR?.sim?.tournamentFlow;
        if (!Flow || typeof Flow.startLocalTournament !== 'function'){
          throw new Error('tournamentFlow missing after boot');
        }
        Flow.startLocalTournament();
      }catch(err){
        alertLoadError(err);
        showTitle();
      }finally{
        const title = $('titleScreen');
        if (title && title.style.display !== 'none'){
          btnTestLocal.disabled = false;
          if (btnNext) btnNext.disabled = false;
        }
      }
    });
  }
});
