'use strict';

/*
  MOB BR - storage.js v17（フル・tour_state正式対応版）
*/

window.MOBBR = window.MOBBR || {};

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

  startYear: 'mobbr_startYear',

  nextTour: 'mobbr_nextTour',
  nextTourW: 'mobbr_nextTourW',

  recent: 'mobbr_recent',

  playerTeam: 'mobbr_playerTeam',

  coachOwned: 'mobbr_coachSkillsOwned',
  coachEquipped: 'mobbr_coachSkillsEquipped',

  // ★正式採用
  tourState: 'mobbr_tour_state'
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

// ===== tour state =====
function getTourState(){
  return getJSON(KEYS.tourState, {
    split: 1,
    stage: 'local',
    qualifiedNational: false,
    qualifiedWorld: false,
    clearedNational: false
  });
}

function setTourState(obj){
  setJSON(KEYS.tourState, obj);
}

// ★TOP10時に呼ぶ
function grantNationalQualification(){
  const state = getTourState();
  state.qualifiedNational = true;
  setTourState(state);
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

  setNum(KEYS.startYear, 1989);

  setStr(KEYS.nextTour, '未定');
  setStr(KEYS.nextTourW, '未定');
  setStr(KEYS.recent, '未定');

  setJSON(KEYS.coachOwned, {});
  setJSON(KEYS.coachEquipped, [null,null,null]);

  // ★初期tour_state
  setTourState({
    split: 1,
    stage: 'local',
    qualifiedNational: false,
    qualifiedWorld: false,
    clearedNational: false
  });
}

// ===== init =====
function initStorage(){
  if (!localStorage.getItem(KEYS.year)){
    setDefaults();
    return;
  }

  if (!localStorage.getItem(KEYS.startYear)){
    const y = getNum(KEYS.year, 1989);
    setNum(KEYS.startYear, y);
  }

  if (!localStorage.getItem(KEYS.coachOwned)){
    setJSON(KEYS.coachOwned, {});
  }

  if (!localStorage.getItem(KEYS.coachEquipped)){
    setJSON(KEYS.coachEquipped, [null,null,null]);
  }

  // ★旧データ救済
  if (!localStorage.getItem(KEYS.tourState)){
    setTourState({
      split: 1,
      stage: 'local',
      qualifiedNational: false,
      qualifiedWorld: false,
      clearedNational: false
    });
  }
}

function resetAll(){
  localStorage.clear();
  window.dispatchEvent(new CustomEvent('mobbr:goTitle'));
}

// ===== expose =====
window.MOBBR.storage = {
  KEYS,
  getNum,
  getStr,
  setNum,
  setStr,
  getJSON,
  setJSON,
  resetAll,
  getTourState,
  setTourState,
  grantNationalQualification
};

window.MOBBR.initStorage = initStorage;
