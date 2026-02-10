'use strict';

/*
  MOB BR - app.js v20（フル）
  目的：
  - タイトル→メイン遷移を確実化
  - 分割JSロードを「今あるファイルだけ」に絞って404停止を根絶
  - タイトルから「ローカル大会（テスト）」で即開始

  v20:
  ✅ 404で途中停止しない（存在前提ファイルのみロード）
  ✅ 必須2本（ui_tournament.js / sim_tournament_flow.js）が無い場合は原因を表示
  ✅ タイトル表示中に先読み（preload）
*/

const APP_VER = 20;

window.MOBBR = window.MOBBR || {};
window.MOBBR.ver = APP_VER;

const $ = (id) => document.getElementById(id);

// iOS: prevent double-tap zoom
(function preventDoubleTapZoom(){
  let last = 0;
  document.addEventListener('touchend', (e)=>{
    const now = Date.now();
    if (now - last <= 300) e.preventDefault();
    last = now;
  }, { passive:false });
})();

function showTitle(){
  const t = $('titleScreen');
  const a = $('app');
  if (t) t.style.display = 'block';
  if (a) a.style.display = 'none';
}
function showMain(){
  const t = $('titleScreen');
  const a = $('app');
  if (t) t.style.display = 'none';
  if (a) a.style.display = 'grid';
}

function setTitleHint(text){
  const el = $('titleHint');
  if (!el) return;
  el.textContent = String(text || '');
  el.style.display = text ? 'block' : 'none';
}

function loadScript(src){
  return new Promise((resolve, reject)=>{
    const s = document.createElement('script');
    s.src = src;
    s.defer = true;
    s.onload = () => resolve();
    s.onerror = () => reject(new Error(`Failed to load: ${src}`));
    document.head.appendChild(s);
  });
}

/**
 * ✅ 今このプロジェクトで「確実に存在している」想定のファイルだけ
 * ※あなたが index.html に書いてた構成（ui_shop.js 1本など）に合わせる
 */
async function loadModules(){
  const v = `?v=${APP_VER}`;

  const files = [
    // storage / data
    `storage.js${v}`,
    `data_player.js${v}`,

    // UI（あなたの現行）
    `ui_team.js${v}`,
    `ui_training.js${v}`,
    `ui_shop.js${v}`,
    `ui_card.js${v}`,
    `ui_schedule.js${v}`,
    `ui_main.js${v}`,

    // tournament UI（今回追加）
    `ui_tournament.js${v}`,

    // sim（大会）
    `sim_tournament_flow.js${v}`,
    `sim_tournament_local.js${v}`,
    // national/world/final は後で追加でOK（無ければFlow側が警告する）
    // `sim_tournament_national.js${v}`,
    // `sim_tournament_world.js${v}`,
    // `sim_tournament_final.js${v}`,
  ];

  for (const f of files){
    await loadScript(f);
  }
}

let modulesLoaded = false;
let preloadPromise = null;
let bootBusy = false;

async function bootModulesIfNeeded(){
  if (modulesLoaded) return;

  if (preloadPromise){
    await preloadPromise;
    modulesLoaded = true;
    return;
  }

  await loadModules();
  modulesLoaded = true;
}

function initAll(){
  // storage
  if (window.MOBBR?.initStorage) window.MOBBR.initStorage();

  // ui_main は自分で init してる場合もあるが、あっても安全
  if (window.MOBBR?.initMainUI) window.MOBBR.initMainUI();

  // 既存UI
  if (window.MOBBR?.initTeamUI) window.MOBBR.initTeamUI();
  if (window.MOBBR?.initTrainingUI) window.MOBBR.initTrainingUI();
  if (window.MOBBR?.initShopUI) window.MOBBR.initShopUI();
  if (window.MOBBR?.initCardUI) window.MOBBR.initCardUI();
  if (window.MOBBR?.initScheduleUI) window.MOBBR.initScheduleUI();
}

function assertTournamentReady(){
  const tUI = window.MOBBR?.ui?.tournament;
  const Flow = window.MOBBR?.sim?.tournamentFlow;

  if (!tUI){
    return { ok:false, msg:'ui_tournament.js が読み込めていません（ファイル名/置き場所/大文字小文字）' };
  }
  if (!Flow){
    return { ok:false, msg:'sim_tournament_flow.js が読み込めていません（ファイル名/置き場所/大文字小文字）' };
  }
  if (typeof Flow.startLocalTournament !== 'function'){
    return { ok:false, msg:'tournamentFlow.startLocalTournament がありません（Flowの定義を確認）' };
  }
  return { ok:true, msg:'' };
}

async function goMain(){
  await bootModulesIfNeeded();
  initAll();
  showMain();
}

async function goLocalTournamentFromTitle(){
  await goMain();

  const chk = assertTournamentReady();
  if (!chk.ok){
    alert(`大会が開始できません\n${chk.msg}`);
    return;
  }

  // 開始
  window.MOBBR.sim.tournamentFlow.startLocalTournament();
}

document.addEventListener('DOMContentLoaded', ()=>{
  showTitle();

  const btnNext  = $('btnTitleNext');
  const btnLocal = $('btnTitleLocal');

  // ✅ タイトル表示中に先読み
  setTitleHint('読み込み中…');
  preloadPromise = loadModules()
    .then(()=>{
      modulesLoaded = true;
      setTitleHint('');
    })
    .catch((err)=>{
      console.error(err);
      preloadPromise = null;
      // 失敗理由をタイトルに出す（ユーザーが気付ける）
      setTitleHint('読み込み失敗：ファイル名/パス/大文字小文字を確認');
    });

  async function guarded(fn){
    if (bootBusy) return;
    bootBusy = true;
    if (btnNext) btnNext.disabled = true;
    if (btnLocal) btnLocal.disabled = true;

    try{
      await fn();
    }catch(e){
      console.error(e);
      alert('起動に失敗しました（Console確認）');
      showTitle();
    }finally{
      const t = $('titleScreen');
      if (t && t.style.display !== 'none'){
        if (btnNext) btnNext.disabled = false;
        if (btnLocal) btnLocal.disabled = false;
      }
      bootBusy = false;
    }
  }

  // NEXT
  if (btnNext){
    const h = ()=>guarded(goMain);
    btnNext.addEventListener('click', h);
    btnNext.addEventListener('touchstart', (e)=>{ e.preventDefault(); h(); }, { passive:false });
  }

  // ローカル大会（テスト）
  if (btnLocal){
    const h = ()=>guarded(goLocalTournamentFromTitle);
    btnLocal.addEventListener('click', h);
    btnLocal.addEventListener('touchstart', (e)=>{ e.preventDefault(); h(); }, { passive:false });
  }
});
