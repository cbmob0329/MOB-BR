'use strict';

/* =========================================================
   app.js（FULL） v19.2
   - v19.1 の全機能維持（削除なし）
   - ✅ CHANGE: ui_team.js を 2分割ロードに変更
     -> ui_team.core.js / ui_team.training.js
   - ✅ KEEP: sim_tournament_core_step_base.js をロード（step 2分割の前提）
========================================================= */

const APP_VER = 19.2; // ★ここを上げる（キャッシュ強制更新の核）

const $ = (id) => document.getElementById(id);

window.MOBBR = window.MOBBR || {};
window.MOBBR.ver = APP_VER;

// =========================================================
// ✅ MOBBR namespace hard-guard（最重要）
// - どこかのファイルが window.MOBBR.sim = {} / window.MOBBR.ui = {} しても壊れない
// - 破壊的上書きは拒否し「マージ」に矯正
// =========================================================
(function mobbrNamespaceHardGuard(){
  const root = window.MOBBR;

  // --- sim guard ---
  const keepSim = root.sim || {};
  Object.defineProperty(root, 'sim', {
    configurable: false,
    enumerable: true,
    get(){ return keepSim; },
    set(v){
      if (v && typeof v === 'object'){
        for (const k of Object.keys(v)){
          keepSim[k] = v[k];
        }
      }
    }
  });

  // --- ui guard ---
  const keepUi = root.ui || {};
  Object.defineProperty(root, 'ui', {
    configurable: false,
    enumerable: true,
    get(){ return keepUi; },
    set(v){
      if (v && typeof v === 'object'){
        for (const k of Object.keys(v)){
          keepUi[k] = v[k];
        }
      }
    }
  });
})();

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

    // ✅ ui_team 分割ロード（順番厳守：core -> training）
    `ui_team_core.js${v}`,
    `ui_team_training.js${v}`,

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

    // tournament 3分割（依存順：logic -> result -> core_shared -> core_step_base -> core_step -> core(entry)）
    `sim_tournament_logic.js${v}`,
    `sim_tournament_result.js${v}`,
    `sim_tournament_core_shared.js${v}`,
    `sim_tournament_core_step_base.js${v}`, // ✅ 追加（2分割対応）
    `sim_tournament_core_step.js${v}`,
    `sim_tournament_core.js${v}`, // entry

    // ★ローカル/ナショナル大会終了後処理（状態更新 + 次大会算出API）
    `sim_tournament_core_post.js${v}`,

    // =====================================================
    // ✅ UI tournament 3分割（依存順：core -> handlers -> entry）
    // =====================================================
    `ui_tournament.core.js${v}`,
    `ui_tournament.handlers.js${v}`,
    `ui_tournament.js${v}`, // entry
  ];

  for (const f of files){
    await loadScript(f);
  }
}

let modulesLoaded = false;

// ==========================================
// 大会開始ブリッジ（v18.8）
// - UIはこれだけ呼べばOK（または mobbr:startTournament を投げる）
// ==========================================

// storage keys（core_post / ui_schedule.js と合わせる）
const KTS = {
  tourState: 'mobbr_tour_state',
  nextTour: 'mobbr_nextTour',
  nextTourW: 'mobbr_nextTourW'
};

function getJSONSafe(key, def){
  try{
    const raw = localStorage.getItem(key);
    if (!raw) return def;
    return JSON.parse(raw);
  }catch(e){
    return def;
  }
}

function ensureModulesOrThrow(){
  const ok = !!(window.MOBBR && window.MOBBR.sim &&
    window.MOBBR.sim.tournamentFlow &&
    window.MOBBR.sim.tournamentLogic &&
    window.MOBBR.sim.tournamentResult &&
    window.MOBBR.sim.matchFlow &&
    window.MOBBR.sim.matchEvents);

  if (!ok){
    const info = {
      tournamentFlow: !!window.MOBBR?.sim?.tournamentFlow,
      tournamentLogic: !!window.MOBBR?.sim?.tournamentLogic,
      tournamentResult: !!window.MOBBR?.sim?.tournamentResult,
      matchFlow: !!window.MOBBR?.sim?.matchFlow,
      matchEvents: !!window.MOBBR?.sim?.matchEvents,
      tournamentCorePost: !!window.MOBBR?.sim?.tournamentCorePost
    };
    console.error('[TOUR] sim modules not ready:', info);
    throw new Error('Tournament modules not ready');
  }
}

function getTourState(){
  return getJSONSafe(KTS.tourState, null);
}

// =========================================================
// ✅ WORLD phase 正規化（v18.8）
// - 最新：qual / losers / final
// - 互換：wl / winners / (old) losers などは losers に吸収
// =========================================================
function normalizeWorldPhase(phase){
  const p = String(phase || '').trim().toLowerCase();

  // 最新
  if (p === 'qual' || p === 'losers' || p === 'final') return p;

  // 互換：旧UI/旧スケジュール/旧保存値
  if (p === 'wl' || p === 'winners' || p === 'winner' || p === 'w/l' || p === 'winnerslosers'){
    return 'losers';
  }

  // 文字列に losers/wl が含まれる場合も吸収（安全側）
  if (p.includes('loser') || p.includes('wl') || p.includes('winner')){
    return 'losers';
  }

  return 'qual';
}

// ✅ v19.0：必ず「sim開始→（初期request生成）→UI open(state)→UI render(state)」
// - simStartFn が Promise を返す構成にも対応
function startTournamentPipeline(simStartFn, uiOpenArg){
  ensureModulesOrThrow();

  const flow = window.MOBBR?.sim?.tournamentFlow;

  const doInitialStep = () => {
    // 初期request生成：openTournament は ui が処理しないので step を1回回す（robust）
    try{
      if (flow && typeof flow.step === 'function'){
        flow.step();
      }else if (window.MOBBR?.sim?._tcore?.step){
        // ✅ flow.step が無い構成でも必ず初期reqを作る
        window.MOBBR.sim._tcore.step();
      }else{
        console.warn('[TOUR] initial step: no flow.step and no _tcore.step');
      }
    }catch(e){
      console.warn('[TOUR] initial step failed (continue):', e);
    }
  };

  const doUiOpenRender = (state) => {
    const s = (state && typeof state === 'object') ? state : {};
    const arg = Object.assign({}, s, (uiOpenArg && typeof uiOpenArg === 'object') ? uiOpenArg : {});

    // 3) UI open（オーバーレイを確実に開く）
    try{
      if (window.MOBBR?.ui?.tournament?.open){
        window.MOBBR.ui.tournament.open(arg);
      }
    }catch(e){
      console.warn('[TOUR] ui.open failed (continue):', e);
    }

    // 4) UI render（初回描画）
    try{
      if (window.MOBBR?.ui?.tournament?.render){
        window.MOBBR.ui.tournament.render(arg);
      }
    }catch(e){
      console.warn('[TOUR] ui.render failed:', e);
    }

    return arg;
  };

  // 1) sim開始（state生成）
  let ret;
  try{
    if (typeof simStartFn === 'function'){
      ret = simStartFn(); // ★ここで state を受ける（重要）
    }else{
      throw new Error('simStartFn missing');
    }
  }catch(e){
    console.error('[TOUR] sim start failed:', e);
    throw e;
  }

  // Promise 対応（national/world が async 化しても壊れない）
  if (ret && typeof ret.then === 'function'){
    return ret.then((state) => {
      doInitialStep();
      return doUiOpenRender(state);
    }).catch((e) => {
      console.error('[TOUR] sim start promise rejected:', e);
      throw e;
    });
  }

  // sync
  doInitialStep();
  return doUiOpenRender(ret);
}

function startLocalTournament(){
  const flow = window.MOBBR?.sim?.tournamentFlow;
  // 新API（sim_tournament_core.js v4.3+）
  if (flow && typeof flow.startLocalTournament === 'function'){
    startTournamentPipeline(() => flow.startLocalTournament(), { mode:'local' });
    return;
  }
  // 旧fallback
  if (flow && typeof flow.start === 'function'){
    startTournamentPipeline(() => flow.start({ mode:'local' }), { mode:'local' });
    return;
  }
  console.error('[TOUR] startLocalTournament: no sim start entry found');
}

function startNationalTournament(){
  const flow = window.MOBBR?.sim?.tournamentFlow;
  if (flow && typeof flow.startNationalTournament === 'function'){
    startTournamentPipeline(() => flow.startNationalTournament(), { mode:'national' });
    return;
  }
  if (flow && typeof flow.start === 'function'){
    startTournamentPipeline(() => flow.start({ mode:'national' }), { mode:'national' });
    return;
  }
  console.error('[TOUR] startNationalTournament: no sim start entry found');
}

function startLastChanceTournament(){
  const flow = window.MOBBR?.sim?.tournamentFlow;
  if (flow && typeof flow.startLastChanceTournament === 'function'){
    startTournamentPipeline(() => flow.startLastChanceTournament(), { mode:'lastchance' });
    return;
  }
  if (flow && typeof flow.start === 'function'){
    startTournamentPipeline(() => flow.start({ mode:'lastchance' }), { mode:'lastchance' });
    return;
  }
  console.error('[TOUR] startLastChanceTournament: no sim start entry found');
}

function startWorldTournament(phase){
  const flow = window.MOBBR?.sim?.tournamentFlow;
  const p = normalizeWorldPhase(phase);

  // ✅ v18.8：UIへ渡す openArg.phase も最新へ統一（qual/losers/final）
  if (flow && typeof flow.startWorldTournament === 'function'){
    startTournamentPipeline(() => flow.startWorldTournament(p), { mode:'world', phase:p });
    return;
  }
  if (flow && typeof flow.start === 'function'){
    startTournamentPipeline(() => flow.start({ mode:'world', phase:p }), { mode:'world', phase:p });
    return;
  }
  console.error('[TOUR] startWorldTournament: no sim start entry found');
}

function startTournamentByState(detail){
  // detail 優先：UIから明示指定できる
  const d = detail || {};
  const explicitType = String(d.type || d.mode || '').trim().toLowerCase();
  const explicitPhase = d.phase;

  if (explicitType){
    if (explicitType === 'local') return startLocalTournament();
    if (explicitType === 'national') return startNationalTournament();
    if (explicitType === 'lastchance') return startLastChanceTournament();
    if (explicitType === 'world') return startWorldTournament(explicitPhase);
  }

  const ts = getTourState();
  const stage = String(ts?.stage || '').trim().toLowerCase(); // 'local'|'national'|'lastchance'|'world'|'done'
  const wphaseRaw = String(ts?.world?.phase || '').trim().toLowerCase(); // 保存値（旧: wl / 新: losers など）
  const wphase = normalizeWorldPhase(wphaseRaw);

  if (stage === 'local' || !stage){
    return startLocalTournament();
  }
  if (stage === 'national'){
    return startNationalTournament();
  }
  if (stage === 'lastchance'){
    return startLastChanceTournament();
  }
  if (stage === 'world'){
    if (wphase === 'final') return startWorldTournament('final');
    if (wphase === 'losers') return startWorldTournament('losers');
    return startWorldTournament('qual');
  }

  console.warn('[TOUR] startTournamentByState: not eligible', { stage, wphase, ts });
  alert('大会を開始できません（出場条件未達 or 進行状態が未設定の可能性）');
}

function exposeTournamentAPI(){
  window.MOBBR = window.MOBBR || {};
  window.MOBBR.startTournament = {
    local: startLocalTournament,
    national: startNationalTournament,
    lastchance: startLastChanceTournament,
    world: startWorldTournament,
    byState: startTournamentByState
  };

  // =====================================================
  // ✅ 追加（壊さないalias）
  // - 旧UI/呼び出し側が window.MOBBR.ui.startTournament.local() を呼んでも落ちないように
  // - hard-guard により ui を破壊せず「マージ」される
  // =====================================================
  window.MOBBR.ui = window.MOBBR.ui || {};
  window.MOBBR.ui.startTournament = window.MOBBR.startTournament;

  try{
    console.log('[TOUR] startTournament API exposed:', Object.keys(window.MOBBR.startTournament || {}));
  }catch(e){}
}

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

      console.log('[CHECK] tcore split =', {
        core_shared: !!window.MOBBR?.sim?._tcore,
        core_step: !!window.MOBBR?.sim?._tcore?.step
      });

      console.log('[CHECK] ui_tournament split =', {
        core: !!window.MOBBR?.ui?._tournamentCore,
        handlers: !!window.MOBBR?.ui?._tournamentHandlers,
        entry: !!window.MOBBR?.ui?.tournament
      });

      console.log('[CHECK] ui_team split =', {
        core: !!window.MOBBR?.ui?._teamCore,
        training: !!window.MOBBR?.ui?._teamTraining,
        initTeamUI: !!window.MOBBR?.initTeamUI
      });
    }catch(e){}

    // ✅ 大会開始APIを公開
    try{ exposeTournamentAPI(); }catch(e){}
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
// 大会post用：週進行＆メイン復帰（責務一本化）
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

// ✅ 週進行の実処理（ストレージ更新）は app.js のみ
// - setRecent は goMain 側で統一するので、ここでは基本触らない
function advanceWeekBy(weeks){
  const add = Math.max(1, Number(weeks || 1) | 0);

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
  const gainPer = weeklyGoldByRank(rank);
  const totalGain = gainPer * add;
  const gold = getNumLS(KLS.gold, 0);

  setNumLS(KLS.year, y);
  setNumLS(KLS.month, m);
  setNumLS(KLS.week, w);
  setNumLS(KLS.gold, gold + totalGain);

  return { y, m, w, gainPer, totalGain, weeks: add };
}

function closeTournamentOverlayHard(){
  try{
    if (window.MOBBR?.ui?.tournament?.close){
      window.MOBBR.ui.tournament.close();
      return;
    }
  }catch(e){}

  const overlay = document.getElementById('mobbrTournamentOverlay');
  if (overlay){
    overlay.classList.remove('isOpen');
    overlay.style.display = 'none';
  }
}

function buildTournamentRecent(detail, weekInfo){
  const d = detail || {};
  const w = weekInfo || null;

  let base = '';
  if (d.localFinished){
    const r = Number(d.rank || 0);
    const q = !!d.qualified;
    base = `ローカル大会終了：${r ? r+'位' : ''}${q ? ' / ナショナル出場権獲得' : ''}`;
  }else if (d.nationalFinished){
    base = 'ナショナル大会終了';
  }else if (d.worldFinished){
    base = 'ワールドファイナル終了';
  }else if (d.tournamentFinished){
    base = '大会終了';
  }

  if (!base) base = d.recent || '';

  if (w && w.totalGain){
    const gainText = `週が進んだ（+${w.totalGain}G）`;
    if (base && base.trim()) return `${base} / ${gainText}`;
    return gainText;
  }

  return base || getNumLS(KLS.week, 1) ? '' : '';
}

function bindGlobalEvents(){
  window.addEventListener('mobbr:goTitle', () => {
    showTitle();
  });

  // ✅ 大会開始（UI→appの疎結合）
  window.addEventListener('mobbr:startTournament', (e) => {
    try{
      const detail = e?.detail || {};
      startTournamentByState(detail);
    }catch(err){
      console.error(err);
      alert('大会開始に失敗しました（読み込み不足 or 進行状態の不整合の可能性）');
    }
  });

  // ✅ 大会post：メイン復帰（週進行もここでのみ実処理）
  window.addEventListener('mobbr:goMain', (e) => {
    try{
      const detail = e?.detail || {};
      const weeks = Math.max(0, Number(detail.advanceWeeks || 0) | 0);

      // 1) 大会オーバーレイ閉じる（見た目の確実化）
      showMain();
      hardResetOverlays();
      closeTournamentOverlayHard();

      // 2) 週進行（必要な時だけ）＋ gold 加算
      let weekInfo = null;
      if (weeks > 0){
        weekInfo = advanceWeekBy(weeks);

        // ✅ 次大会更新（週進行後に必ず計算）
        try{
          if (window.MOBBR?.sim?.tournamentCorePost?.setNextTourFromState){
            window.MOBBR.sim.tournamentCorePost.setNextTourFromState();
          }
        }catch(_){}

        // ✅ UIに「週進行ポップ」を出したい（表示のみ）
        try{
          if (window.MOBBR?.ui?.main?.showWeekAdvancePop){
            window.MOBBR.ui.main.showWeekAdvancePop(weekInfo);
          }
        }catch(_){}
      }

      // 3) recent を1回だけ決める（ここが最終責務）
      const recent = buildTournamentRecent(detail, weekInfo);
      if (recent && recent.trim()){
        setStrLS(KLS.recent, recent);
      }

      // 4) メインUI再描画
      if (window.MOBBR?.initMainUI) window.MOBBR.initMainUI();
    }catch(err){
      console.error(err);
    }
  });
}

document.addEventListener('DOMContentLoaded', () => {
  bindGlobalEvents();
  showTitle();

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
