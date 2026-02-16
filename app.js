'use strict';

/*
  MOB BR - app.js v18.0（フル：ローカル大会 1本 / 3分割対応 + post対応）
  - 重要：全モジュールを APP_VER で統一してキャッシュ差分を確実に潰す
  - 重要：読み込み確認ログを追加（どれが読めてない/古いか即判定）

  v18.0 追加：
  - sim_tournament_core_post.js をロード（ローカル大会終了後：週進行→メイン復帰）
  - mobbr:advanceWeek / mobbr:goMain を app.js 側で受けて実処理する
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

    // ★ローカル大会終了後処理（週進行→メイン復帰 / TOP10でナショナル権）
    `sim_tournament_core_post.js${v}`,

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
        matchEvents: !!window.MOBBR?.sim?.matchEvents,
        tournamentCorePost: !!window.MOBBR?.sim?.tournamentCorePost
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

// ==========================================
// 大会post用：週進行＆メイン復帰イベント受け
// ==========================================

// storage keys（ui_main.js と同じ）
const KLS = {
  year:'mobbr_year',
  month:'mobbr_month',
  week:'mobbr_week',
  gold:'mobbr_gold',
  rank:'mobbr_rank',
  recent:'mobbr_recent'
};

function weeklyGoldByRank(rank){
  if (rank >= 1 && rank <= 5) return 500;
  if (rank >= 6 && rank <= 10) return 800;
  if (rank >= 11 && rank <= 20) return 1000;
  if (rank >= 21 && rank <= 30) return 2000;
  return 3000;
}

function getNumLS(key, def){
  const v = Number(localStorage.getItem(key));
  return Number.isFinite(v) ? v : def;
}
function setNumLS(key, val){ localStorage.setItem(key, String(Number(val))); }
function setStrLS(key, val){ localStorage.setItem(key, String(val)); }

function advanceWeekBy(weeks){
  const add = Math.max(1, Number(weeks || 1));
  let y = getNumLS(KLS.year, 1989);
  let m = getNumLS(KLS.month, 1);
  let w = getNumLS(KLS.week, 1);

  for (let i=0;i<add;i++){
    w += 1;
    if (w >= 5){
      w = 1;
      m += 1;
      if (m >= 13){
        m = 1;
        y += 1;
      }
    }
  }

  const rank = getNumLS(KLS.rank, 10);
  const gain = weeklyGoldByRank(rank);
  const gold = getNumLS(KLS.gold, 0);

  setNumLS(KLS.year, y);
  setNumLS(KLS.month, m);
  setNumLS(KLS.week, w);
  setNumLS(KLS.gold, gold + gain);
  setStrLS(KLS.recent, `週が進んだ（+${gain}G）`);
}

function closeTournamentOverlayHard(){
  // 大会UIがcloseを持つなら優先
  try{
    if (window.MOBBR?.ui?.tournament?.close){
      window.MOBBR.ui.tournament.close();
      return;
    }
  }catch(e){}

  // フォールバック：DOM直落とし
  const overlay = document.getElementById('mobbrTournamentOverlay');
  if (overlay){
    overlay.classList.remove('isOpen');
    overlay.style.display = 'none';
  }
}

function bindGlobalEvents(){
  window.addEventListener('mobbr:goTitle', () => {
    showTitle();
  });

  // ★大会post：週進行
  window.addEventListener('mobbr:advanceWeek', (e) => {
    try{
      const weeks = e?.detail?.weeks || 1;
      advanceWeekBy(weeks);
    }catch(err){
      console.error(err);
    }
  });

  // ★大会post：メイン復帰
  window.addEventListener('mobbr:goMain', (e) => {
    try{
      showMain();
      hardResetOverlays();
      closeTournamentOverlayHard();

      // メインUI再描画（initMainUIは二重bind防止が入ってる前提）
      if (window.MOBBR?.initMainUI) window.MOBBR.initMainUI();
    }catch(err){
      console.error(err);
    }
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
