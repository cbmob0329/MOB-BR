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

  recent: 'mobbr_recent',

  // ★追加：リセット後に「名称入力」を必ずやり直すためのフラグ
  forceNameSetup: 'mobbr_force_name_setup'
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
  // ★スタート時は必ずこの日付
  setNum(KEYS.year, 1989);
  setNum(KEYS.month, 1);
  setNum(KEYS.week, 1);

  setNum(KEYS.gold, 0);
  setNum(KEYS.rank, 10);

  setStr(KEYS.nextTour, '未定');
  setStr(KEYS.nextTourW, '未定');

  setStr(KEYS.recent, '未定');

  // 名称は defaults を入れるが、forceNameSetup が立ってたら必ず入力させる
  if (!localStorage.getItem(KEYS.company)) setStr(KEYS.company, 'CB Memory');
  if (!localStorage.getItem(KEYS.team)) setStr(KEYS.team, 'PLAYER TEAM');
  if (!localStorage.getItem(KEYS.m1)) setStr(KEYS.m1, 'A');
  if (!localStorage.getItem(KEYS.m2)) setStr(KEYS.m2, 'B');
  if (!localStorage.getItem(KEYS.m3)) setStr(KEYS.m3, 'C');
}

// ===== name setup (prompt) =====
function promptNameSetupIfNeeded(){
  const force = localStorage.getItem(KEYS.forceNameSetup) === '1';

  // 初回 or リセット直後は必ず入力させる
  if (!force) return;

  const company = prompt('企業名を入力してください', getStr(KEYS.company, 'CB Memory'));
  if (company !== null && company.trim() !== '') setStr(KEYS.company, company.trim());

  const team = prompt('チーム名を入力してください', getStr(KEYS.team, 'PLAYER TEAM'));
  if (team !== null && team.trim() !== '') setStr(KEYS.team, team.trim());

  const m1 = prompt('メンバー名（1人目）を入力してください', getStr(KEYS.m1, 'A'));
  if (m1 !== null && m1.trim() !== '') setStr(KEYS.m1, m1.trim());

  const m2 = prompt('メンバー名（2人目）を入力してください', getStr(KEYS.m2, 'B'));
  if (m2 !== null && m2.trim() !== '') setStr(KEYS.m2, m2.trim());

  const m3 = prompt('メンバー名（3人目）を入力してください', getStr(KEYS.m3, 'C'));
  if (m3 !== null && m3.trim() !== '') setStr(KEYS.m3, m3.trim());

  // 入力が終わったら解除
  localStorage.removeItem(KEYS.forceNameSetup);
}

// ===== init (called from app.js after NEXT) =====
function initStorage(){
  // 初回起動：yearが無ければ作る（=1989/1/1週から）
  if (!localStorage.getItem(KEYS.year)){
    setDefaults();
    // 初回は名前入力させたいならここを1にしてもOKだが、
    // 今回は「リセット後のみ必ず入力」なので初回は強制しない
    return;
  }

  // リセット後に戻ってきた場合：フラグが立ってれば必ず入力
  promptNameSetupIfNeeded();
}

// ===== full reset =====
function resetAll(){
  // ★他プロジェクトを巻き込まない：mobbr_ だけ消す
  const del = [];
  for (let i=0; i<localStorage.length; i++){
    const k = localStorage.key(i);
    if (k && k.startsWith('mobbr_')) del.push(k);
  }
  del.forEach(k => localStorage.removeItem(k));

  // ★次回NEXTで名称入力を必ずやり直す
  localStorage.setItem(KEYS.forceNameSetup, '1');

  // ★タイトルへ戻す（app.js が受け取る）
  window.dispatchEvent(new CustomEvent('mobbr:goTitle'));
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
