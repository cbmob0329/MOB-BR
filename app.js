'use strict';

/*
  MOB BR - app.js v17.8（フル：ローカル大会 1本 / 3分割対応）
  - 重要：全モジュールを APP_VER で統一してキャッシュ差分を確実に潰す
  - 重要：読み込み確認ログを追加（どれが読めてない/古いか即判定）
*/

const APP_VER = 18; // ★ここを上げる（キャッシュ強制更新の核）

const $ = (id) => document.getElementById(id);

window.MOBBR = window.MOBBR || {};
window.MOBBR.ver = APP_VER;

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

function setTitleHint(text){
  const el = $('titleHint');
  if (!el) return;
  el.textContent = String(text || '');
  el.style.display = text ? 'block' : 'none';
}

function hardResetOverlays(){
  const back = $('modalBack');
  if (back){
    back.style.display = 'none';
    back.style.pointerEvents = 'none';
    back.setAttribute('aria-hidden', 'true');
  }

  const members = $('membersPop');
  if (members){
    members.style.display = 'none';
    members.setAttribute('aria-hidden', 'true');
  }

  const title = $('titleScreen');
  if (title && title.style.display === 'none'){
    title.style.pointerEvents = 'none';
  }

  const overlay = document.getElementById('mobbrTournamentOverlay');
  if (overlay){
    overlay.classList.remove('isOpen');
  }
}

function showTitle(){
  const title = $('titleScreen');
  const app = $('app');

  if (title){
    title.style.display = 'block';
    title.style.pointerEvents = 'auto';
  }
  if (app) app.style.display = 'none';

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

  hardResetOverlays();
  requestAnimationFrame(() => hardResetOverlays());
}

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

// ★読み込み状況を“必ず”見える化（原因切り分け用）
function logLoaded(tag){
  try{ console.log(`[LOADED] ${tag} (APP_VER=${APP_VER})`); }catch(e){}
}

async function loadModules(){
  const v = `?v=${APP_VER}`;

  // ★ここが最重要：固定vを一切残さない（全部APP_VERで統一）
  const files = [
    // core
    `storage.js${v}`,
    `data_player.js${v}`,
    `data_cards.js${v}`,
    `data_cpu_teams.js${v}`,

    // UI
    `ui_main.js${v}`,
    `ui_team.js${v}`,
    `ui_training.js${v}`,
    `ui_card.js${v}`,

    // shop（分割版のみ）
    `ui_shop.core.js${v}`,
    `ui_shop.gacha.js${v}`,
    `ui_shop.catalog.js${v}`,

    // schedule
    `ui_schedule.js${v}`,

    // tournament core（依存順が重要）
    `sim_match_events.js${v}`,
    `sim_match_flow.js${v}`,

    // tournament 3分割（依存順：logic -> result -> core）
    `sim_tournament_logic.js${v}`,
    `sim_tournament_result.js${v}`,
    `sim_tournament_core.js${v}`,

    // UI
    `ui_tournament.js${v}`,
  ];

  for (const f of files){
    await loadScript(f);
  }
}

let modulesLoaded = false;

async function bootAfterNext(){
  if (!modulesLoaded){
    setTitleHint('読み込み中...');
    logLoaded('app.js boot start');

    // ★ServiceWorkerが居ると古いJSを配ることがあるので存在だけログ出す
    try{
      if (navigator.serviceWorker && navigator.serviceWorker.getRegistrations){
        const regs = await navigator.serviceWorker.getRegistrations();
        if (regs && regs.length){
          console.warn('[SW] serviceWorker registrations exist:', regs);
        }
      }
    }catch(e){}

    await loadModules();
    modulesLoaded = true;

    // ★分割側が読めてるかチェック（最低限）
    try{
      const ok = !!(window.MOBBR && window.MOBBR.sim &&
        window.MOBBR.sim.tournamentFlow &&
        window.MOBBR.sim.tournamentLogic &&
        window.MOBBR.sim.tournamentResult &&
        window.MOBBR.sim.matchFlow &&
        window.MOBBR.sim.matchEvents);
      console.log('[CHECK] sim modules ready =', ok, {
        tournamentFlow: !!window.MOBBR?.sim?.tournamentFlow,
        tournamentLogic: !!window.MOBBR?.sim?.tournamentLogic,
        tournamentResult: !!window.MOBBR?.sim?.tournamentResult,
        matchFlow: !!window.MOBBR?.sim?.matchFlow,
        matchEvents: !!window.MOBBR?.sim?.matchEvents
      });
    }catch(e){}
  }

  if (window.MOBBR?.initStorage) window.MOBBR.initStorage();
  if (window.MOBBR?.initMainUI) window.MOBBR.initMainUI();
  if (window.MOBBR?.initTeamUI) window.MOBBR.initTeamUI();
  if (window.MOBBR?.initTrainingUI) window.MOBBR.initTrainingUI();
  if (window.MOBBR?.initCardUI) window.MOBBR.initCardUI();
  if (window.MOBBR?.initShopUI) window.MOBBR.initShopUI();
  if (window.MOBBR?.initScheduleUI) window.MOBBR.initScheduleUI();

  // tournament
  if (window.MOBBR?.initTournamentUI) window.MOBBR.initTournamentUI();

  setTitleHint('');
  hardResetOverlays();
  logLoaded('app.js boot done');
}

function bindGlobalEvents(){
  window.addEventListener('mobbr:goTitle', () => {
    showTitle();
  });
}

document.addEventListener('DOMContentLoaded', () => {
  bindGlobalEvents();
  showTitle();

  // ★起動確認（これが出ないなら app.js 自体が古い/読まれてない）
  logLoaded('app.js DOMContentLoaded');

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
