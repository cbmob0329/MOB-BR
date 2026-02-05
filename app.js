'use strict';

/*
  MOB BR - Main Screen v12 + FIX
*/

const K = {
  company: 'mobbr_company',
  team: 'mobbr_team',
  m1: 'mobbr_m1',
  m2: 'mobbr_m2',
  m3: 'mobbr_m3',
  gold: 'mobbr_gold',
  rank: 'mobbr_rank',
  y: 'mobbr_y',
  m: 'mobbr_m',
  w: 'mobbr_w',
  nextTour: 'mobbr_nextTour',
  nextTourW: 'mobbr_nextTourW',
  recent: 'mobbr_recent'
};

const $ = (id) => document.getElementById(id);

const ui = {
  company: $('uiCompany'),
  team: $('uiTeam'),
  gold: $('uiGold'),
  rank: $('uiRank'),
  y: $('uiY'),
  m: $('uiM'),
  w: $('uiW'),
  nextTour: $('uiNextTour'),
  nextTourW: $('uiNextTourW'),
  recent: $('uiRecent'),

  tapCompany: $('tapCompany'),
  tapTeamName: $('tapTeamName'),

  popBack: $('modalBack'),
  weekPop: $('weekPop'),
  popTitle: $('popTitle'),
  popSub: $('popSub'),
  btnPopNext: $('btnPopNext'),

  btnWeekNext: $('btnWeekNext'),
  rogWrap: $('rogWrap'),

  btnTeam: $('btnTeam'),
  btnBattle: $('btnBattle'),
  btnTraining: $('btnTraining'),
  btnShop: $('btnShop'),
  btnSchedule: $('btnSchedule'),
  btnCard: $('btnCard'),

  loopScroll: $('loopScroll'),
  loopInner: $('loopInner'),

  btnMembers: $('btnMembers'),
  membersPop: $('membersPop'),
  rowM1: $('rowM1'),
  rowM2: $('rowM2'),
  rowM3: $('rowM3'),
  uiM1: $('uiM1'),
  uiM2: $('uiM2'),
  uiM3: $('uiM3'),
  btnCloseMembers: $('btnCloseMembers'),

  teamScreen: $('teamScreen'),
  btnCloseTeam: $('btnCloseTeam'),
  tCompany: $('tCompany'),
  tTeam: $('tTeam'),
  tM1: $('tM1'),
  tM2: $('tM2'),
  tM3: $('tM3'),

  teamPower: $('uiTeamPower'),
  teamPowerBonus: $('uiTeamPowerBonus')
};

/* ===== iOS double tap zoom prevent ===== */
(function preventDoubleTapZoom(){
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });
})();

/* ===== storage helpers ===== */
function getNum(key, def){
  const v = Number(localStorage.getItem(key));
  return Number.isFinite(v) ? v : def;
}
function getStr(key, def){
  const v = localStorage.getItem(key);
  return (v === null || v === '') ? def : v;
}
function setStr(key, val){ localStorage.setItem(key, String(val)); }
function setNum(key, val){ localStorage.setItem(key, String(Number(val))); }

function weeklyGoldByRank(rank){
  if (rank <= 5) return 500;
  if (rank <= 10) return 800;
  if (rank <= 20) return 1000;
  if (rank <= 30) return 2000;
  return 3000;
}

function formatRank(rank){ return `RANK ${rank}`; }

/* ===== render ===== */
function render(){
  const company = getStr(K.company, 'CB Memory');
  const team = getStr(K.team, 'PLAYER TEAM');
  const m1 = getStr(K.m1, '○○○');
  const m2 = getStr(K.m2, '○○○');
  const m3 = getStr(K.m3, '○○○');

  ui.company.textContent = company;
  ui.team.textContent = team;
  ui.gold.textContent = getNum(K.gold, 0);
  ui.rank.textContent = formatRank(getNum(K.rank, 10));

  ui.y.textContent = getNum(K.y, 1989);
  ui.m.textContent = getNum(K.m, 1);
  ui.w.textContent = getNum(K.w, 1);

  ui.nextTour.textContent = getStr(K.nextTour, '未定');
  ui.nextTourW.textContent = getStr(K.nextTourW, '未定');
  ui.recent.textContent = getStr(K.recent, '未定');

  ui.uiM1.textContent = m1;
  ui.uiM2.textContent = m2;
  ui.uiM3.textContent = m3;

  ui.tCompany.textContent = company;
  ui.tTeam.textContent = team;
  ui.tM1.textContent = m1;
  ui.tM2.textContent = m2;
  ui.tM3.textContent = m3;
}

/* ===== Team Power (ADD ONLY) ===== */
function calcTeamPower(){
  // 仮ステータス（後で data / card と接続）
  const base = [
    { aim:70, men:65, agi:68, tec:66, sup:60, det:64 },
    { aim:72, men:64, agi:66, tec:67, sup:62, det:63 },
    { aim:69, men:66, agi:67, tec:65, sup:61, det:62 }
  ];
  const bonus = [0.5, 0.3, 0.4];

  const avg = base.reduce((s,b)=>{
    return s + (b.aim+b.men+b.agi+b.tec+b.sup+b.det)/6;
  },0)/3;

  ui.teamPower.textContent = `${avg.toFixed(1)}%`;
  ui.teamPowerBonus.textContent = `+${(bonus.reduce((a,b)=>a+b,0)/3).toFixed(1)}%（カード効果）`;
}

/* ===== show / hide ===== */
function showTeamScreen(){
  ui.teamScreen.classList.add('show');
  ui.teamScreen.setAttribute('aria-hidden','false');
  calcTeamPower(); // ★追加
}
function hideTeamScreen(){
  ui.teamScreen.classList.remove('show');
  ui.teamScreen.setAttribute('aria-hidden','true');
}

/* ===== menus ===== */
function setRecent(text){
  setStr(K.recent,text);
  render();
}
function bindMenus(){
  ui.btnTeam.addEventListener('click',()=>{ render(); showTeamScreen(); });
  ui.btnBattle.addEventListener('click',()=>setRecent('大会：未実装'));
  ui.btnTraining.addEventListener('click',()=>setRecent('育成：未実装'));
  ui.btnShop.addEventListener('click',()=>setRecent('ショップ：未実装'));
  ui.btnSchedule.addEventListener('click',()=>setRecent('スケジュール：未実装'));
  ui.btnCard.addEventListener('click',()=>setRecent('カード：未実装'));
  ui.btnWeekNext.addEventListener('click',advanceWeek);
  ui.btnCloseTeam.addEventListener('click',hideTeamScreen);
}

/* ===== FIXED loop scroll ===== */
function setupLoopScroll(){
  const scroller = ui.loopScroll;
  const inner = ui.loopInner;
  const items = Array.from(inner.children);

  items.forEach(n=>{
    const c = n.cloneNode(true);
    c.onclick = n.onclick;
    inner.appendChild(c);
  });

  requestAnimationFrame(()=>{
    scroller.scrollTop = inner.scrollHeight/3;
  });

  scroller.addEventListener('scroll',()=>{
    const h = inner.scrollHeight/2;
    if(scroller.scrollTop<h*0.25) scroller.scrollTop+=h*0.25;
    if(scroller.scrollTop>h*0.75) scroller.scrollTop-=h*0.25;
  },{passive:true});
}

/* ===== boot ===== */
document.addEventListener('DOMContentLoaded',()=>{
  if(!localStorage.getItem(K.y)) setNum(K.y,1989);
  if(!localStorage.getItem(K.m)) setNum(K.m,1);
  if(!localStorage.getItem(K.w)) setNum(K.w,1);
  if(!localStorage.getItem(K.rank)) setNum(K.rank,10);
  if(!localStorage.getItem(K.gold)) setNum(K.gold,0);

  render();
  bindMenus();
  setupLoopScroll();
});
