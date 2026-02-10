'use strict';

/*
  MOB BR - app.js v17-stable（フル）
  役割：
  - タイトル → メイン遷移制御（安定化）
  - 分割JSの順序ロード
  - 各UI init の一元管理

  方針（重要）：
  - 「大会系は一度全部削除」前提で、tournament系の読み込みを完全に外す
    （ファイル不足で loadModules が落ちて、画面が壊れるのを防ぐ）
  - NEXTが不安定：連打/多重起動/ロード中の状態ずれを防止
    1) NEXT押下中はボタン無効化
    2) 先にモジュールを確実に初期化 → 成功したらメイン表示
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
    - storage / data → ui → (sim)
    ※大会系は「一旦全部削除」方針なので読み込まない
  */
  const files = [
    // core
    `storage.js${v}`,
    `data_player.js${v}`,

    // cards data
    `data_cards.js${v}`,

    // UI（メイン系）
    `ui_main.js${v}`,
    `ui_team.js${v}`,
    `ui_training.js${v}`,

    // cards UI
    `ui_card.js${v}`,

    // shop UI（SPLIT）
    `ui_shop.core.js${v}`,
    `ui_shop.gacha.js${v}`,
    `ui_shop.catalog.js${v}`,

    // schedule UI
    `ui_schedule.js${v}`,

    // いまは大会系は読み込まない（ファイル不足で落ちる原因になる）
    // `ui_tournament.js${v}`,
    // `sim_battle.js${v}`,
    // `sim_tournament_local.js${v}`,
    // `sim_tournament_national.js${v}`,
    // `sim_tournament_lastchance.js${v}`,
    // `sim_tournament_world.js${v}`,
    // `sim_tournament_final.js${v}`,
    // `sim_tournament_flow.js${v}`
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

  // shop（coreが initShopUI を持つ）
  if (window.MOBBR?.initShopUI){
    window.MOBBR.initShopUI();
  }

  // schedule
  if (window.MOBBR?.initScheduleUI){
    window.MOBBR.initScheduleUI();
  }
}

// ===== global events =====
function bindGlobalEvents(){
  window.addEventListener('mobbr:goTitle', () => {
    showTitle();
  });
}

// ===== NEXT 安定化 =====
let isBooting = false;

async function onPressNext(btn){
  if (isBooting) return;
  isBooting = true;

  if (btn){
    btn.disabled = true;
    btn.style.pointerEvents = 'none';
    btn.style.opacity = '0.85';
  }

  try{
    // 先にロード＆初期化を確実に完了させる（成功したらメイン表示）
    await bootAfterNext();
    showMain();
  }catch(err){
    console.error(err);
    alert('読み込みに失敗しました（ファイル不足の可能性）');
    showTitle();
  }finally{
    isBooting = false;
    if (btn){
      btn.disabled = false;
      btn.style.pointerEvents = 'auto';
      btn.style.opacity = '';
    }
  }
}

// ===== boot =====
document.addEventListener('DOMContentLoaded', () => {
  bindGlobalEvents();
  showTitle();

  const btn = $('btnTitleNext');
  if (btn){
    btn.addEventListener('click', () => onPressNext(btn));
  }
});
