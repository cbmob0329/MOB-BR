'use strict';

/*
  MOB BR - app.js v14
  役割：
  - 起動時：タイトル画面を表示、メイン(#app)は非表示
  - NEXTでメイン表示 → 分割JSを読み込み → 初期化を呼ぶ
  - 「セーブ削除 → タイトルへ戻る」用の共通口も用意（イベントで戻す）
*/

const APP_VER = 14;

// ===== DOM helpers =====
const $ = (id) => document.getElementById(id);

// ===== global namespace =====
window.MOBBR = window.MOBBR || {};
window.MOBBR.ver = APP_VER;

// ===== iOS: prevent double-tap zoom (global) =====
(function preventDoubleTapZoom(){
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });
})();

// ===== show/hide screens =====
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
  if (app) app.style.display = 'grid'; // 元の#appがgridなので
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

async function loadModules(){
  const v = `?v=${APP_VER}`;

  const files = [
    `storage.js${v}`,
    `data_player.js${v}`,
    `ui_main.js${v}`,
    `ui_team.js${v}`,
    `ui_training.js${v}`,
  ];

  for (const f of files) {
    await loadScript(f);
  }
}

// ===== boot main after NEXT =====
let modulesLoaded = false;

async function bootAfterNext(){
  if (!modulesLoaded) {
    await loadModules();
    modulesLoaded = true;
  }

  if (window.MOBBR && typeof window.MOBBR.initStorage === 'function') {
    window.MOBBR.initStorage();
  }

  if (window.MOBBR && typeof window.MOBBR.initMainUI === 'function') {
    window.MOBBR.initMainUI();
  }

  if (window.MOBBR && typeof window.MOBBR.initTeamUI === 'function') {
    window.MOBBR.initTeamUI();
  }

  if (window.MOBBR && typeof window.MOBBR.initTrainingUI === 'function') {
    window.MOBBR.initTrainingUI();
  }
}

// ===== "go title" event (for save-delete reset) =====
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
  if (btn) {
    btn.addEventListener('click', async () => {
      try {
        showMain();
        await bootAfterNext();
      } catch (err) {
        console.error(err);
        alert('読み込みに失敗しました（ファイル不足の可能性）。');
        showTitle();
      }
    });
  }
});
