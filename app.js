'use strict';

/*
  MOB BR - Main Screen v12
  - Left menu: loop scroll (only inside the button column)
  - NEXT not always visible:
      * Week popup shows NEXT
      * Rog panel tap shows NEXT temporarily (3 sec)
  - Mobile:
      * prevent double-tap zoom (iOS)
      * long-press callout suppression is CSS (-webkit-touch-callout/user-select)
  - Member names:
      * "メンバー名" button opens popup
      * tap row to rename
  - Team button:
      * opens team screen (intro)
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

  // member popup
  btnMembers: $('btnMembers'),
  membersPop: $('membersPop'),
  rowM1: $('rowM1'),
  rowM2: $('rowM2'),
  rowM3: $('rowM3'),
  uiM1: $('uiM1'),
  uiM2: $('uiM2'),
  uiM3: $('uiM3'),
  btnCloseMembers: $('btnCloseMembers'),

  // team screen
  teamScreen: $('teamScreen'),
  btnCloseTeam: $('btnCloseTeam'),
  tCompany: $('tCompany'),
  tTeam: $('tTeam'),
  tM1: $('tM1'),
  tM2: $('tM2'),
  tM3: $('tM3')
};

(function preventDoubleTapZoom(){
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });
})();

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

function weeklyGoldByRank(rank){
  if (rank >= 1 && rank <= 5) return 500;
  if (rank >= 6 && rank <= 10) return 800;
  if (rank >= 11 && rank <= 20) return 1000;
  if (rank >= 21 && rank <= 30) return 2000;
  return 3000;
}
function formatRank(rank){ return `RANK ${rank}`; }

function render(){
  const company = getStr(K.company, 'CB Memory');
  const team = getStr(K.team, 'PLAYER TEAM');
  const m1 = getStr(K.m1, '○○○');
  const m2 = getStr(K.m2, '○○○');
  const m3 = getStr(K.m3, '○○○');

  ui.company.textContent = company;
  ui.team.textContent = team;

  ui.gold.textContent = String(getNum(K.gold, 0));
  ui.rank.textContent = formatRank(getNum(K.rank, 10));

  ui.y.textContent = String(getNum(K.y, 1989));
  ui.m.textContent = String(getNum(K.m, 1));
  ui.w.textContent = String(getNum(K.w, 1));

  ui.nextTour.textContent = getStr(K.nextTour, '未定');
  ui.nextTourW.textContent = getStr(K.nextTourW, '未定');

  // 「最近の出来事」ラベルは消し、本文だけ
  ui.recent.textContent = getStr(K.recent, '未定');

  // member popup values
  ui.uiM1.textContent = m1;
  ui.uiM2.textContent = m2;
  ui.uiM3.textContent = m3;

  // team screen values
  ui.tCompany.textContent = company;
  ui.tTeam.textContent = team;
  ui.tM1.textContent = m1;
  ui.tM2.textContent = m2;
  ui.tM3.textContent = m3;
}

function showBack(){
  ui.popBack.style.display = 'block';
  ui.popBack.setAttribute('aria-hidden', 'false');
}
function hideBack(){
  ui.popBack.style.display = 'none';
  ui.popBack.setAttribute('aria-hidden', 'true');
}

function showWeekPop(title, sub){
  ui.popTitle.textContent = title;
  ui.popSub.textContent = sub;
  showBack();
  ui.weekPop.style.display = 'block';
}
function hideWeekPop(){
  ui.weekPop.style.display = 'none';
  hideBack();
}

function showMembersPop(){
  showBack();
  ui.membersPop.style.display = 'block';
}
function hideMembersPop(){
  ui.membersPop.style.display = 'none';
  hideBack();
}

function showTeamScreen(){
  ui.teamScreen.classList.add('show');
  ui.teamScreen.setAttribute('aria-hidden', 'false');
  // 背景タップで閉じる誤爆防止のため、teamScreen自体は閉じない。ボタンで閉じる。
}
function hideTeamScreen(){
  ui.teamScreen.classList.remove('show');
  ui.teamScreen.setAttribute('aria-hidden', 'true');
}

// ===== initial =====
function ensureInitialInput(){
  if (!localStorage.getItem(K.y)) setNum(K.y, 1989);
  if (!localStorage.getItem(K.m)) setNum(K.m, 1);
  if (!localStorage.getItem(K.w)) setNum(K.w, 1);
  if (!localStorage.getItem(K.rank)) setNum(K.rank, 10);
  if (!localStorage.getItem(K.gold)) setNum(K.gold, 0);
  if (!localStorage.getItem(K.recent)) setStr(K.recent, '未定');
  if (!localStorage.getItem(K.nextTour)) setStr(K.nextTour, '未定');
  if (!localStorage.getItem(K.nextTourW)) setStr(K.nextTourW, '未定');

  if (!localStorage.getItem(K.company)){
    const v = prompt('企業名を入力してください', 'CB Memory');
    if (v !== null && v.trim() !== '') setStr(K.company, v.trim());
  }
  if (!localStorage.getItem(K.team)){
    const v = prompt('チーム名を入力してください', 'PLAYER TEAM');
    if (v !== null && v.trim() !== '') setStr(K.team, v.trim());
  }
  if (!localStorage.getItem(K.m1)){
    const v = prompt('メンバー名（1人目）を入力してください', '○○○');
    if (v !== null && v.trim() !== '') setStr(K.m1, v.trim());
  }
  if (!localStorage.getItem(K.m2)){
    const v = prompt('メンバー名（2人目）を入力してください', '○○○');
    if (v !== null && v.trim() !== '') setStr(K.m2, v.trim());
  }
  if (!localStorage.getItem(K.m3)){
    const v = prompt('メンバー名（3人目）を入力してください', '○○○');
    if (v !== null && v.trim() !== '') setStr(K.m3, v.trim());
  }
}

function bindRenamePrompt(key, label, defVal){
  const cur = getStr(key, defVal);
  const v = prompt(`${label}を変更`, cur);
  if (v === null) return;
  const nv = v.trim();
  if (nv === '') return;
  setStr(key, nv);
  render();
}

// ===== NEXT (not always) =====
let nextHideTimer = null;
function showNextTemporarily(ms=3000){
  ui.btnWeekNext.classList.add('show');
  if (nextHideTimer) clearTimeout(nextHideTimer);
  nextHideTimer = setTimeout(() => ui.btnWeekNext.classList.remove('show'), ms);
}
function bindRogNextReveal(){
  ui.rogWrap.addEventListener('click', () => {
    showNextTemporarily(3200);
  });
}

// ===== Week progression =====
function advanceWeek(){
  const y = getNum(K.y, 1989);
  const m = getNum(K.m, 1);
  const w = getNum(K.w, 1);

  let ny = y, nm = m, nw = w + 1;
  if (nw >= 5){
    nw = 1;
    nm = m + 1;
    if (nm >= 13){
      nm = 1;
      ny = y + 1;
    }
  }

  const rank = getNum(K.rank, 10);
  const gain = weeklyGoldByRank(rank);

  showWeekPop(`${ny}年${nm}月 第${nw}週`, `企業ランクにより ${gain}G 獲得！`);

  ui.btnPopNext.onclick = () => {
    setNum(K.y, ny);
    setNum(K.m, nm);
    setNum(K.w, nw);

    const gold = getNum(K.gold, 0);
    setNum(K.gold, gold + gain);

    setStr(K.recent, `週が進んだ（+${gain}G）`);

    hideWeekPop();
    render();
    ui.btnWeekNext.classList.remove('show');
  };
}

// ===== Members popup =====
function bindMembers(){
  ui.btnMembers.addEventListener('click', () => {
    render();
    showMembersPop();
  });

  ui.btnCloseMembers.addEventListener('click', hideMembersPop);

  // 背景押しは閉じない（誤爆防止）→ closeボタンのみ
  ui.popBack.addEventListener('click', (e) => e.preventDefault());

  ui.rowM1.addEventListener('click', () => bindRenamePrompt(K.m1, 'メンバー名（1人目）', '○○○'));
  ui.rowM2.addEventListener('click', () => bindRenamePrompt(K.m2, 'メンバー名（2人目）', '○○○'));
  ui.rowM3.addEventListener('click', () => bindRenamePrompt(K.m3, 'メンバー名（3人目）', '○○○'));
}

// ===== Top rename =====
function bindTopRename(){
  ui.tapCompany.addEventListener('click', () => bindRenamePrompt(K.company, '企業名', 'CB Memory'));
  ui.tapTeamName.addEventListener('click', () => bindRenamePrompt(K.team, 'チーム名', 'PLAYER TEAM'));
}

// ===== Left menu placeholders + TEAM screen =====
function setRecent(text){
  setStr(K.recent, text);
  render();
}

function bindMenus(){
  ui.btnTeam.addEventListener('click', () => {
    render();
    showTeamScreen();
  });
  ui.btnBattle.addEventListener('click', () => setRecent('大会：未実装（次フェーズ）'));
  ui.btnTraining.addEventListener('click', () => setRecent('育成：未実装（次フェーズ）'));
  ui.btnShop.addEventListener('click', () => setRecent('ショップ：未実装（次フェーズ）'));
  ui.btnSchedule.addEventListener('click', () => setRecent('スケジュール：未実装（次フェーズ）'));
  ui.btnCard.addEventListener('click', () => setRecent('カードコレクション：未実装（次フェーズ）'));

  ui.btnWeekNext.addEventListener('click', advanceWeek);

  ui.btnCloseTeam.addEventListener('click', hideTeamScreen);
}

// ===== Loop scroll (infinite) for left menu =====
function setupLoopScroll(){
  const scroller = ui.loopScroll;
  const inner = ui.loopInner;

  const originalButtons = Array.from(inner.querySelectorAll('button.imgBtn'));

  const spacer = document.createElement('div');
  spacer.style.height = '2px';
  inner.appendChild(spacer);

  const clones = originalButtons.map((btn) => {
    const clone = document.createElement('button');
    clone.type = 'button';
    clone.className = btn.className;
    clone.setAttribute('aria-label', btn.getAttribute('aria-label') || 'menu');
    clone.dataset.ref = btn.id;

    const img = btn.querySelector('img');
    const img2 = document.createElement('img');
    img2.src = img.getAttribute('src');
    img2.alt = img.getAttribute('alt');
    img2.draggable = false;
    clone.appendChild(img2);

    clone.addEventListener('click', () => {
      const ref = document.getElementById(clone.dataset.ref);
      if (ref) ref.click();
    });

    return clone;
  });

  clones.forEach(n => inner.appendChild(n));

  let oneSetHeight = 0;
  const calcHeights = () => {
    oneSetHeight = originalButtons.reduce((sum, b) => sum + b.getBoundingClientRect().height, 0);
    const gap = 14;
    oneSetHeight += gap * (originalButtons.length - 1);
  };

  requestAnimationFrame(() => {
    calcHeights();
    scroller.scrollTop = 1;
  });

  window.addEventListener('resize', () => {
    calcHeights();
  });

  scroller.addEventListener('scroll', () => {
    if (oneSetHeight <= 0) return;
    if (scroller.scrollTop >= oneSetHeight) scroller.scrollTop -= oneSetHeight;
    if (scroller.scrollTop <= 0) scroller.scrollTop += oneSetHeight;
  }, { passive: true });
}

// ===== boot =====
document.addEventListener('DOMContentLoaded', () => {
  ensureInitialInput();
  bindTopRename();
  bindMenus();
  bindRogNextReveal();
  bindMembers();
  setupLoopScroll();
  render();
});
