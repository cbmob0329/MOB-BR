'use strict';

/*
  MOB BR - app.js v13
  役割：
  - 起動時：タイトル画面を表示、メイン(#app)は非表示
  - NEXTでメイン表示 → 分割JSを読み込み → 初期化を呼ぶ
  - 「セーブ削除 → タイトルへ戻る」用の共通口も用意（イベントで戻す）
*/

const APP_VER = 13;

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

  // 画面戻りでポップ類が残っても大丈夫なように
  // （ui_main/ui_team側で必要に応じて閉じる）
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
  // app.js 1本のまま、残りの分割JSを順番に読み込む
  // キャッシュ対策：?v=13
  const v = `?v=${APP_VER}`;

  // まだ無いファイルを参照しても困るので、
  // ここで読み込む順番だけ固定（次のメッセージで順に生成していく）
  const files = [
    `storage.js${v}`,
    `data_player.js${v}`,
    `ui_main.js${v}`,
    `ui_team.js${v}`,
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

  // storage初期化（NEXT後に初期入力/初期データを作る）
  if (window.MOBBR && typeof window.MOBBR.initStorage === 'function') {
    window.MOBBR.initStorage();
  }

  // メイン画面初期化（UI更新、メンバー名ポップ、週進行、左メニュー等）
  if (window.MOBBR && typeof window.MOBBR.initMainUI === 'function') {
    window.MOBBR.initMainUI();
  }

  // チーム画面初期化（中身実装）
  if (window.MOBBR && typeof window.MOBBR.initTeamUI === 'function') {
    window.MOBBR.initTeamUI();
  }
}

// ===== "go title" event (for save-delete reset) =====
function bindGlobalEvents(){
  // ui_team.js から「全リセットしてタイトルへ戻る」をしたい時に使う
  // dispatch例：window.dispatchEvent(new CustomEvent('mobbr:goTitle'));
  window.addEventListener('mobbr:goTitle', () => {
    showTitle();
  });
}

// ===== boot =====
document.addEventListener('DOMContentLoaded', () => {
  bindGlobalEvents();

  // 起動時は必ずタイトル
  showTitle();

  // NEXTでメインへ
  const btn = $('btnTitleNext');
  if (btn) {
    btn.addEventListener('click', async () => {
      try {
        showMain();
        await bootAfterNext();
      } catch (err) {
        // もし分割JSがまだ揃ってない段階でも、
        // 画面が止まるよりはタイトルに戻す
        console.error(err);
        alert('読み込みに失敗しました（ファイル不足の可能性）。');
        showTitle();
      }
    });
  }
});
