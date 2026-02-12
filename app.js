'use strict';

/*
  MOB BR - app.js v17.8（フル：ローカル大会 1本 / 3分割対応）
  - data_cpu_teams.js をロード（CPUチームデータ）
  - sim_match_events.js v2 をロード（イベント：rollForTeam / eventBuffs）
  - sim_match_flow.js v2 をロード（交戦解決：resolveBattle）
  - sim_tournament_flow を 3分割ロード（順番厳守）
      1) sim_tournament_logic.js
      2) sim_tournament_result.js
      3) sim_tournament_core.js
    ※ 3つ読み込み後に window.MOBBR.sim.tournamentFlow が完成する前提
  - ui_tournament.js をロード（大会UI：state.request を読む）
*/

const APP_VER = 17;

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

  const tui = document.querySelector('.mobbrTui');
  if (tui){
    tui.classList.remove('isOpen');
    tui.style.display = 'none';
    tui.style.pointerEvents = 'none';
    tui.setAttribute('aria-hidden', 'true');
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

async function loadModules(){
  const v = `?v=${APP_VER}`;

  // ✅ 大会だけは分割＆キャッシュ回避を別にかける（必要なら数字を上げる）
  const TV = `?v=1`;

  const files = [
    // core
    `storage.js${v}`,
    `data_player.js${v}`,
    `data_cards.js${v}`,
    `data_cpu_teams.js${v}`,

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

    // tournament core（★依存順が重要）
    `sim_match_events.js?v=2`,
    `sim_match_flow.js?v=2`,

    // tournament（★3分割：順番厳守）
    `sim_tournament_logic.js${TV}`,
    `sim_tournament_result.js${TV}`,
    `sim_tournament_core.js${TV}`,

    // tournament UI（state.request を読む）
    `ui_tournament.js${TV}`
  ];

  for (const f of files){
    await loadScript(f);
  }
}

let modulesLoaded = false;

async function bootAfterNext(){
  if (!modulesLoaded){
    setTitleHint('読み込み中...');
    await loadModules();
    modulesLoaded = true;
  }

  if (window.MOBBR?.initStorage) window.MOBBR.initStorage();
  if (window.MOBBR?.initMainUI) window.MOBBR.initMainUI();
  if (window.MOBBR?.initTeamUI) window.MOBBR.initTeamUI();
  if (window.MOBBR?.initTrainingUI) window.MOBBR.initTrainingUI();
  if (window.MOBBR?.initCardUI) window.MOBBR.initCardUI();
  if (window.MOBBR?.initShopUI) window.MOBBR.initShopUI();
  if (window.MOBBR?.initScheduleUI) window.MOBBR.initScheduleUI();

  // 大会UIは ui_tournament.js 側で window.MOBBR.ui.tournament を公開するだけなので
  // ここは「存在すれば呼ぶ」運用のままでOK（無ければ何もしない）
  if (window.MOBBR?.initTournamentUI) window.MOBBR.initTournamentUI();

  setTitleHint('');
  hardResetOverlays();
}

function bindGlobalEvents(){
  window.addEventListener('mobbr:goTitle', () => {
    showTitle();
  });
}

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
