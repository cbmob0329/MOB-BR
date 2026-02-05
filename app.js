'use strict';

/*
  MOB BR - Phase1 (Main Screen only)
  Files:
    - index.html
    - style.css
    - app.js

  Rules:
    - Background (haikeimain.png) and Player image (P1.png) can overlap.
    - UI elements (frames/buttons/text blocks) must NOT overlap each other.
    - Images are in root (direct) except folders: cpu/, cards/, maps/.
*/

const VERSION = 'v0.1-main';

/** ===== Simple state (Phase1) ===== */
const state = {
  companyName: 'CB Memory',
  companyRank: 'RANK 10',
  teamName: 'PLAYER TEAM',
  gold: 0,
  year: 1989,
  month: 1,
  week: 1,
  nextEvent: '未設定',
};

/** ===== DOM refs ===== */
const $ = (id) => document.getElementById(id);

const UI = {
  ver: $('uiVer'),
  companyName: $('uiCompanyName'),
  companyRank: $('uiCompanyRank'),
  teamName: $('uiTeamName'),

  cardCompanyName: $('uiCardCompanyName'),
  cardCompanyRank: $('uiCardCompanyRank'),
  cardTeamName: $('uiCardTeamName'),
  cardGold: $('uiCardGold'),
  cardWeek: $('uiCardWeek'),
  cardNextEvent: $('uiCardNextEvent'),

  logTitle: $('uiLogTitle'),
  logBody: $('uiLogBody'),

  btnTeam: $('btnTeam'),
  btnTournament: $('btnTournament'),
  btnShop: $('btnShop'),
  btnTraining: $('btnTraining'),
  btnRecord: $('btnRecord'),
  btnCollection: $('btnCollection'),
  btnResults: $('btnResults'),
  btnSchedule: $('btnSchedule'),
  btnNext: $('btnNext'),
  btnAuto: $('btnAuto'),
};

/** ===== Utilities ===== */
function escapeHtml(str){
  return String(str)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#039;');
}

function setText(el, text){
  if (!el) return;
  el.textContent = text;
}

function setLog(title, html){
  if (UI.logTitle) UI.logTitle.textContent = title;
  if (UI.logBody) UI.logBody.innerHTML = html;
}

function formatWeek(){
  return `${state.year}年${state.month}月 第${state.week}週`;
}

/** ===== Apply State to UI ===== */
function render(){
  setText(UI.ver, VERSION);

  setText(UI.companyName, state.companyName);
  setText(UI.companyRank, state.companyRank);
  setText(UI.teamName, state.teamName);

  setText(UI.cardCompanyName, state.companyName);
  setText(UI.cardCompanyRank, state.companyRank);
  setText(UI.cardTeamName, state.teamName);
  setText(UI.cardGold, String(state.gold));
  setText(UI.cardWeek, formatWeek());
  setText(UI.cardNextEvent, state.nextEvent);
}

/** ===== Main Screen Actions (Phase1) ===== */
function showMainGuide(){
  setLog(
    'メイン画面',
    [
      'ここが拠点です。育成・ガチャ・閲覧系などは基本ここから進行します。<br/>',
      '「大会」から大会画面へ進む導線を次フェーズで実装します。<br/>',
      '<br/>',
      '※UI同士（文字/枠/ボタン）は被らない設計で固定。<br/>',
      '※背景とプレイヤー画像は重なってOK。'
    ].join('')
  );
}

function onMenuClick(name){
  const n = escapeHtml(name);
  setLog(
    n,
    [
      `「${n}」を選択しました。<br/>`,
      'この項目は次フェーズで画面/機能を追加します。'
    ].join('')
  );
}

function onTournamentClick(){
  setLog(
    '大会',
    [
      '大会画面へ進みます（次フェーズで実装）。<br/>',
      '<br/>',
      '予定：<br/>',
      '・大会週に入ったら大会開始UI（NEXTのみ）→ 大会画面へ<br/>',
      '・大会中は育成メニューなどのボタンを表示しない<br/>',
      '・大会終了後にメインへ戻るとボタンが復帰'
    ].join('')
  );
}

function onNext(){
  // Phase1: NEXTはガイドに戻す（後で週進行へ変更）
  showMainGuide();
}

let autoTimer = null;
let autoOn = false;

function setAuto(on){
  autoOn = on;
  if (UI.btnAuto) UI.btnAuto.textContent = on ? 'AUTO ON' : 'AUTO';
  if (autoTimer){
    clearInterval(autoTimer);
    autoTimer = null;
  }
  if (on){
    // Phase1: 3秒ごとにガイドへ戻すだけ（挙動確認用）
    autoTimer = setInterval(() => {
      showMainGuide();
    }, 3000);
  }
}

/** ===== Bind ===== */
function bind(){
  if (UI.btnTeam) UI.btnTeam.addEventListener('click', () => onMenuClick('チーム'));
  if (UI.btnTournament) UI.btnTournament.addEventListener('click', onTournamentClick);
  if (UI.btnShop) UI.btnShop.addEventListener('click', () => onMenuClick('ショップ'));
  if (UI.btnTraining) UI.btnTraining.addEventListener('click', () => onMenuClick('修行'));

  if (UI.btnRecord) UI.btnRecord.addEventListener('click', () => onMenuClick('戦績'));
  if (UI.btnCollection) UI.btnCollection.addEventListener('click', () => onMenuClick('コレクション'));

  if (UI.btnResults) UI.btnResults.addEventListener('click', () => onMenuClick('大会結果'));
  if (UI.btnSchedule) UI.btnSchedule.addEventListener('click', () => onMenuClick('スケジュール'));

  if (UI.btnNext) UI.btnNext.addEventListener('click', onNext);

  if (UI.btnAuto){
    UI.btnAuto.addEventListener('click', () => {
      setAuto(!autoOn);
    });
  }

  // Safety: stop auto when tab is hidden
  document.addEventListener('visibilitychange', () => {
    if (document.hidden && autoOn) setAuto(false);
  });
}

/** ===== Init ===== */
(function init(){
  render();
  bind();
  showMainGuide();
})();
