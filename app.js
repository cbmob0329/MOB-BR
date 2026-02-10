'use strict';

/*
  MOB BR - app.js v17.1（フル：復旧用）
  目的：
  - タイトル → メイン遷移を「確実」にする（ロード成功後に showMain）
  - 分割JSを順序ロード（重複ロードしない）
  - shop は「分割版のみ採用」：ui_shop.js（単体）は読み込まない
  - 大会系は一旦読み込まない（復旧優先）
*/

const APP_VER = 17;

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

// ===== hint（任意：DOMが無ければ何もしない）=====
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
    - storage / data → ui
    - 「同系統UIの重複ロード」は事故るので絶対しない
  */
  const files = [
    // core
    `storage.js${v}`,
    `data_player.js${v}`,
    `data_cards.js${v}`,

    // UI
    `ui_main.js?v=18`,        // ui_main は v18 を使ってる前提（あなたの貼ったものが v18）
    `ui_team.js${v}`,
    `ui_training.js${v}`,
    `ui_card.js${v}`,

    // shop（分割版のみ採用：ここが超重要）
    `ui_shop.core.js${v}`,
    `ui_shop.gacha.js${v}`,
    `ui_shop.catalog.js${v}`,

    // schedule
    `ui_schedule.js${v}`

    // 大会系は復旧完了まで読み込まない
    // `ui_tournament.js?...`
    // `sim_tournament_...`
  ];

  for (const f of files){
    await loadScript(f);
  }
}

// ===== boot after NEXT =====
let modulesLoaded = false;

async function bootAfterNext(){
  if (!modulesLoaded){
    setTitleHint('読み込み中...');
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

  setTitleHint('');
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
      // 連打・二重起動防止
      btn.disabled = true;

      try{
        // ★ここが重要：ロード＆initが成功してから showMain
        await bootAfterNext();
        showMain();
      }catch(err){
        console.error(err);
        alert('読み込みに失敗しました（ファイル不足 or 読み込み順の不整合の可能性）');
        setTitleHint('');
        showTitle();
      }finally{
        btn.disabled = false;
      }
    });
  }
});
