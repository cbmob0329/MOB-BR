'use strict';

/*
  MOB BR - app.js v15（フル）

  役割：
  - タイトル → メイン遷移制御
  - 分割JSの順序ロード
  - 各UI init の一元管理

  v15 変更点：
  - data_cards.js / ui_card.js / ui_shop.js を loadModules に追加
*/

const APP_VER = 15;

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
    - storage / data → ui
  */
  const files = [
    // core
    `storage.js${v}`,
    `data_player.js${v}`,

    // cards (NEW)
    `data_cards.js${v}`,

    // UI
    `ui_main.js${v}`,
    `ui_team.js${v}`,
    `ui_training.js${v}`,

    // cards UI (NEW)
    `ui_card.js${v}`,
    `ui_shop.js${v}`
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

  // shop
  if (window.MOBBR?.initShopUI){
    window.MOBBR.initShopUI();
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

  const btn = $('btnTitleNext');
  if (btn){
    btn.addEventListener('click', async () => {
      try{
        showMain();
        await bootAfterNext();
      }catch(err){
        console.error(err);
        alert('読み込みに失敗しました（ファイル不足の可能性）');
        showTitle();
      }
    });
  }
});
