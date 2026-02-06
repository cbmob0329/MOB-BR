'use strict';

/*
  MOB BR - storage.js v13
  役割：
  - localStorage の読み書き一元管理
  - 初期データ生成
  - セーブ削除（＝完全リセット）
  - リセット後にタイトル画面へ戻す
*/

window.MOBBR = window.MOBBR || {};

// ===== storage keys =====
const KEYS = {
  company: 'mobbr_company',
  team: 'mobbr_team',

  m1: 'mobbr_m1',
  m2: 'mobbr_m2',
  m3: 'mobbr_m3',

  gold: 'mobbr_gold',
  rank: 'mobbr_rank',

  year: 'mobbr_year',
  month: 'mobbr_month',
  week: 'mobbr_week',

  nextTour: 'mobbr_nextTour',
  nextTourW: 'mobbr_nextTourW',

  recent: 'mobbr_recent'
};

// ===== helpers =====
function getNum(key, def){
  const v = Number(localStorage.getItem(key));
  return Number.isFinite(v) ? v : def;
}

function getStr(key, def){
  const v = localStorage.getItem(key);
  if (v === null || v === undefined || v === '') return def;
  return v;
}

function setNum(key, val){
  localStorage.setItem(key, String(Number(val)));
}

function setStr(key, val){
  localStorage.setItem(key, String(val));
}

// ===== defaults =====
function setDefaults(){
  setStr(KEYS.company, 'CB Memory');
  setStr(KEYS.team, 'PLAYER TEAM');

  setStr(KEYS.m1, 'A');
  setStr(KEYS.m2, 'B');
  setStr(KEYS.m3, 'C');

  setNum(KEYS.gold, 0);
  setNum(KEYS.rank, 10);

  setNum(KEYS.year, 1989);
  setNum(KEYS.month, 1);
  setNum(KEYS.week, 1);

  setStr(KEYS.nextTour, '未定');
  setStr(KEYS.nextTourW, '未定');

  setStr(KEYS.recent, '未定');
}

// ===== init (called from app.js after NEXT) =====
function initStorage(){
  // 既にセーブがあれば何もしない
  if (localStorage.getItem(KEYS.year)) return;

  // 初回起動のみ初期データ作成
  setDefaults();
}

// ===== full reset =====
function resetAll(){
  localStorage.clear();

  // タイトルへ戻す（app.js が受け取る）
  window.dispatchEvent(
    new CustomEvent('mobbr:goTitle')
  );
}

// ===== expose API =====
window.MOBBR.storage = {
  KEYS,
  getNum,
  getStr,
  setNum,
  setStr,
  resetAll
};

window.MOBBR.initStorage = initStorage;
