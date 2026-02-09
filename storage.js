'use strict';

/*
  MOB BR - storage.js v16（フル）
  役割：
  - localStorage の読み書き一元管理
  - 初期データ生成
  - セーブ削除（＝完全リセット）
  - リセット後にタイトル画面へ戻す

  v16 追加：
  - startYear（ゲーム開始年）を保存
    mobbr_startYear : 1989 など
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

  // ★追加：開始年
  startYear: 'mobbr_startYear',

  nextTour: 'mobbr_nextTour',
  nextTourW: 'mobbr_nextTourW',

  recent: 'mobbr_recent',

  // team details
  playerTeam: 'mobbr_playerTeam',

  // coach skills
  coachOwned: 'mobbr_coachSkillsOwned',        // { id: count }
  coachEquipped: 'mobbr_coachSkillsEquipped'   // [id|null, id|null, id|null]
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

// JSON helpers（必要なら使う）
function getJSON(key, def){
  try{
    const raw = localStorage.getItem(key);
    if (!raw) return def;
    return JSON.parse(raw);
  }catch{
    return def;
  }
}
function setJSON(key, val){
  localStorage.setItem(key, JSON.stringify(val));
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

  // ★開始年を固定（新規開始の基準）
  setNum(KEYS.startYear, 1989);

  setStr(KEYS.nextTour, '未定');
  setStr(KEYS.nextTourW, '未定');

  setStr(KEYS.recent, '未定');

  // coach skill defaults
  if (!localStorage.getItem(KEYS.coachOwned)){
    setJSON(KEYS.coachOwned, {});
  }
  if (!localStorage.getItem(KEYS.coachEquipped)){
    setJSON(KEYS.coachEquipped, [null, null, null]);
  }
}

// ===== init (called from app.js after NEXT) =====
function initStorage(){
  // “初回起動”判定は year を軸に維持
  if (!localStorage.getItem(KEYS.year)){
    setDefaults();
    return;
  }

  // 既存ユーザー向け：startYear が無ければ「現在year」を開始年として補完
  if (!localStorage.getItem(KEYS.startYear)){
    const y = getNum(KEYS.year, 1989);
    setNum(KEYS.startYear, y);
  }

  // 既存ユーザー向け：v15で追加したキーだけ補完
  if (!localStorage.getItem(KEYS.coachOwned)){
    setJSON(KEYS.coachOwned, {});
  }
  if (!localStorage.getItem(KEYS.coachEquipped)){
    setJSON(KEYS.coachEquipped, [null, null, null]);
  }
}

// ===== full reset =====
function resetAll(){
  localStorage.clear();
  window.dispatchEvent(new CustomEvent('mobbr:goTitle'));
}

// ===== expose API =====
window.MOBBR.storage = {
  KEYS,
  getNum,
  getStr,
  setNum,
  setStr,
  getJSON,
  setJSON,
  resetAll
};

window.MOBBR.initStorage = initStorage;
