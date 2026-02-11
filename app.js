'use strict';

/*
  MOB BR - app.js v17.4（フル：復旧用 + 大会Flow/UI 読み込み）
  目的：
  - タイトル→メイン遷移を確実にする（ロード成功後に showMain）
  - 「透明フタ（modalBack 等）が残って全タップが死ぬ」事故を強制復旧
  - shop は分割版のみ想定（ui_shop.js 単体は読み込まない）
  - 大会：ui_main.js(v18) が tournamentFlow を呼ぶので、
          sim_tournament_flow.js を必ず読み込む
          UIがある場合は ui_tournament.js が open される
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

// ===== hint（任意）=====
function setTitleHint(text){
  const el = $('titleHint');
  if (!el) return;
  el.textContent = String(text || '');
  el.style.display = text ? 'block' : 'none';
}

// ===== 「透明フタ」事故の強制復旧 =====
function hardResetOverlays(){
  // 1) modalBack が残っていたら強制的に無効化（最重要）
  const back = $('modalBack');
  if (back){
    back.style.display = 'none';
    back.style.pointerEvents = 'none';
    back.setAttribute('aria-hidden', 'true');
  }

  // 2) membersPop 等のモーダルも念のため閉じる
  const members = $('membersPop');
  if (members){
    members.style.display = 'none';
    members.setAttribute('aria-hidden', 'true');
  }

  // 3) タイトルが「消えてるのに残骸がクリックを吸う」事故を防ぐ
  const title = $('titleScreen');
  if (title && title.style.display === 'none'){
    title.style.pointerEvents = 'none';
  }

  // 4) tournament UI（もし残ってたら）も最前面事故になるので閉じる
  const tui = document.querySelector('.mobbrTui');
  if (tui){
    tui.classList.remove('isOpen');
    tui.style.display = 'none';
    tui.style.pointerEvents = 'none';
    tui.setAttribute('aria-hidden', 'true');
  }
}

// ===== show / hide =====
function showTitle(){
  const title = $('titleScreen');
  const app = $('app');

  if (title){
    title.style.display = 'block';
    title.style.pointerEvents = 'auto';
  }
  if (app) app.style.display = 'none';

  // タイトルへ戻す時もフタ事故を消す
  hardResetOverlays();
}

function showMain(){
  const title = $('titleScreen');
  const app = $('app');

  if (title){
    title.style.display = 'none';
    title.style.pointerEvents = 'none';
  }
  if (app) app.style.display = 'grid';

  // メイン表示直後に必ず「フタ事故」掃除
  hardResetOverlays();

  // さらに 1フレーム後にも掃除（JS初期化タイミングのズレ対策）
  requestAnimationFrame(() => hardResetOverlays());
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

  // ※ここで重要：同じ系統を二重ロードしない
  const files = [
    // core
    `storage.js${v}`,
    `data_player.js${v}`,
    `data_cards.js${v}`,

    // UI
    `ui_main.js?v=18`,
    `ui_team.js${v}`,
    `ui_training.js${v}`,
    `ui_card.js${v}`,

    // shop（分割版のみ）
    `ui_shop.core.js${v}`,
    `ui_shop.gacha.js${v}`,
    `ui_shop.catalog.js${v}`,

    // schedule
    `ui_schedule.js${v}`,

    // tournament flow + UI
    `sim_tournament_flow.js?v=1`,
    `ui_tournament.js?v=1`
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

  // shop
  if (window.MOBBR?.initShopUI){
    window.MOBBR.initShopUI();
  }

  // schedule
  if (window.MOBBR?.initScheduleUI){
    window.MOBBR.initScheduleUI();
  }

  // tournament UI
  if (window.MOBBR?.initTournamentUI){
    window.MOBBR.initTournamentUI();
  }

  setTitleHint('');

  // init 後にも念のため掃除（modalBack事故の最終保険）
  hardResetOverlays();
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
      btn.disabled = true;

      try{
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
