'use strict';

/*
  MOB BR - Main Screen v12 (SAFE EXTENDED)
  - v12の全機能を保持
  - 無限スクロール安定化（強く引っ張っても消えない）
  - チーム画面：戦闘力表示（平均値）
  - カード効果補正は赤字表示（数値は仮・拡張前提）
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
  tM1: $('tM1'),
  tM2: $('tM2'),
  tM3: $('tM3'),
  teamPower: $('teamPower')
};

/* ===== iOS ダブルタップ防止 ===== */
(function preventDoubleTapZoom(){
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  }, { passive:false });
})();

/* ===== Storage helpers ===== */
function getNum(key, def){
  const v = Number(localStorage.getItem(key));
  return Number.isFinite(v) ? v : def;
}
function getStr(key, def){
  const v = localStorage.getItem(key);
  return (v === null || v === undefined || v === '') ? def : v;
}
function setStr(key, val){ localStorage.setItem(key, String(val)); }
function setNum(key, val){ localStorage.setItem(key, String(Number(val))); }

/* ===== Rank / Gold ===== */
function weeklyGoldByRank(rank){
  if (rank <= 5) return 500;
  if (rank <= 10) return 800;
  if (rank <= 20) return 1000;
  if (rank <= 30) return 2000;
  return 3000;
}
function formatRank(rank){ return `RANK ${rank}`; }

/* ===== 戦闘力（仮） ===== */
function getCharacterPower(){
  // 将来：育成・カード・装備で拡張
  return 70; // %
}
function getCardBonus(){
  return 0.5; // %
}
function calcTeamPower(){
  const base = (getCharacterPower() * 3) / 3;
  return base.toFixed(1);
}

/* ===== Render ===== */
function render(){
  const company = getStr(K.company,'CB Memory');
  const team = getStr(K.team,'PLAYER TEAM');
  const m1 = getStr(K.m1,'○○○');
  const m2 = getStr(K.m2,'○○○');
  const m3 = getStr(K.m3,'○○○');

  ui.company.textContent = company;
  ui.team.textContent = team;
  ui.gold.textContent = getNum(K.gold,0);
  ui.rank.textContent = formatRank(getNum(K.rank,10));
  ui.y.textContent = getNum(K.y,1989);
  ui.m.textContent = getNum(K.m,1);
  ui.w.textContent = getNum(K.w,1);
  ui.nextTour.textContent = getStr(K.nextTour,'未定');
  ui.nextTourW.textContent = getStr(K.nextTourW,'未定');
  ui.recent.textContent = getStr(K.recent,'未定');

  ui.uiM1.textContent = m1;
  ui.uiM2.textContent = m2;
  ui.uiM3.textContent = m3;

  ui.tM1.textContent = m1;
  ui.tM2.textContent = m2;
  ui.tM3.textContent = m3;

  if (ui.teamPower){
    ui.teamPower.textContent = calcTeamPower();
  }
}

/* ===== Backdrop ===== */
function showBack(){ ui.popBack.style.display='block'; }
function hideBack(){ ui.popBack.style.display='none'; }

/* ===== Week popup ===== */
function showWeekPop(title, sub){
  ui.popTitle.textContent = title;
  ui.popSub.textContent = sub;
  showBack();
  ui.weekPop.style.display='block';
}
function hideWeekPop(){
  ui.weekPop.style.display='none';
  hideBack();
}

/* ===== Members popup ===== */
function showMembersPop(){ showBack(); ui.membersPop.style.display='block'; }
function hideMembersPop(){ ui.membersPop.style.display='none'; hideBack(); }

/* ===== Team screen ===== */
function showTeamScreen(){
  render();
  ui.teamScreen.classList.add('show');
}
function hideTeamScreen(){
  ui.teamScreen.classList.remove('show');
}

/* ===== Initial ===== */
function ensureInitialInput(){
  if (!localStorage.getItem(K.y)) setNum(K.y,1989);
  if (!localStorage.getItem(K.m)) setNum(K.m,1);
  if (!localStorage.getItem(K.w)) setNum(K.w,1);
  if (!localStorage.getItem(K.rank)) setNum(K.rank,10);
  if (!localStorage.getItem(K.gold)) setNum(K.gold,0);
  if (!localStorage.getItem(K.recent)) setStr(K.recent,'未定');

  if (!localStorage.getItem(K.company)){
    const v = prompt('企業名','CB Memory');
    if (v) setStr(K.company,v);
  }
  if (!localStorage.getItem(K.team)){
    const v = prompt('チーム名','PLAYER TEAM');
    if (v) setStr(K.team,v);
  }
  if (!localStorage.getItem(K.m1)){
    const v = prompt('メンバー1','○○○');
    if (v) setStr(K.m1,v);
  }
  if (!localStorage.getItem(K.m2)){
    const v = prompt('メンバー2','○○○');
    if (v) setStr(K.m2,v);
  }
  if (!localStorage.getItem(K.m3)){
    const v = prompt('メンバー3','○○○');
    if (v) setStr(K.m3,v);
  }
}

/* ===== Rename ===== */
function bindRenamePrompt(key,label,def){
  const cur = getStr(key,def);
  const v = prompt(label,cur);
  if (v) setStr(key,v);
  render();
}

/* ===== NEXT ===== */
let nextHideTimer=null;
function showNextTemporarily(ms=3000){
  ui.btnWeekNext.classList.add('show');
  clearTimeout(nextHideTimer);
  nextHideTimer=setTimeout(()=>ui.btnWeekNext.classList.remove('show'),ms);
}

/* ===== Week advance ===== */
function advanceWeek(){
  let y=getNum(K.y,1989), m=getNum(K.m,1), w=getNum(K.w,1)+1;
  if (w>=5){ w=1; m++; if (m>=13){ m=1; y++; } }
  const gain = weeklyGoldByRank(getNum(K.rank,10));

  showWeekPop(`${y}年${m}月 第${w}週`,`企業ランクにより ${gain}G 獲得！`);

  ui.btnPopNext.onclick=()=>{
    setNum(K.y,y); setNum(K.m,m); setNum(K.w,w);
    setNum(K.gold,getNum(K.gold,0)+gain);
    setStr(K.recent,`週が進んだ（+${gain}G）`);
    hideWeekPop();
    render();
    ui.btnWeekNext.classList.remove('show');
  };
}

/* ===== Bindings ===== */
function bindAll(){
  ui.btnMembers.onclick=showMembersPop;
  ui.btnCloseMembers.onclick=hideMembersPop;

  ui.rowM1.onclick=()=>bindRenamePrompt(K.m1,'メンバー1','○○○');
  ui.rowM2.onclick=()=>bindRenamePrompt(K.m2,'メンバー2','○○○');
  ui.rowM3.onclick=()=>bindRenamePrompt(K.m3,'メンバー3','○○○');

  ui.tapCompany.onclick=()=>bindRenamePrompt(K.company,'企業名','CB Memory');
  ui.tapTeamName.onclick=()=>bindRenamePrompt(K.team,'チーム名','PLAYER TEAM');

  ui.btnTeam.onclick=showTeamScreen;
  ui.btnCloseTeam.onclick=hideTeamScreen;

  ui.btnWeekNext.onclick=advanceWeek;
  ui.rogWrap.onclick=()=>showNextTemporarily(3200);
}

/* ===== 無限スクロール安定版 ===== */
function setupLoopScroll(){
  const sc = ui.loopScroll;
  const inner = ui.loopInner;
  const items = Array.from(inner.children);

  items.forEach(el=>{
    const c = el.cloneNode(true);
    c.onclick=el.onclick;
    inner.appendChild(c);
  });

  const half = inner.scrollHeight/2;
  sc.scrollTop = half/2;

  sc.addEventListener('scroll',()=>{
    if (sc.scrollTop < 10) sc.scrollTop += half;
    if (sc.scrollTop > half*1.5) sc.scrollTop -= half;
  },{passive:true});
}

/* ===== Boot ===== */
document.addEventListener('DOMContentLoaded',()=>{
  ensureInitialInput();
  bindAll();
  setupLoopScroll();
  render();
});
