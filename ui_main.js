'use strict';

/*
  ui_main.js (v13)
  - Title -> Main switch
  - Main UI render
  - Member popup rename
  - Week progression popup
  - Rog tap shows NEXT temporarily
  - Left menu infinite loop scroll
  - TEAM opens team overlay (contents in ui_team.js later)
*/

const K = {
  // basic
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
  recent: 'mobbr_recent',

  // optional flags
  bootedOnce: 'mobbr_booted_once'
};

const $ = (id) => document.getElementById(id);

const ui = {
  // screens
  titleScreen: $('titleScreen'),
  btnTitleNext: $('btnTitleNext'),
  app: $('app'),

  // top info
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

  // modal back (shared)
  modalBack: $('modalBack'),

  // week pop
  weekPop: $('weekPop'),
  popTitle: $('popTitle'),
  popSub: $('popSub'),
  btnPopNext: $('btnPopNext'),

  // next
  btnWeekNext: $('btnWeekNext'),
  rogWrap: $('rogWrap'),

  // left menu
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

  // team overlay (intro only)
  teamScreen: $('teamScreen'),
  btnCloseTeam: $('btnCloseTeam'),
  tCompany: $('tCompany'),
  tTeam: $('tTeam'),
  tM1: $('tM1'),
  tM2: $('tM2'),
  tM3: $('tM3')
};

// -------------------------
// mobile: prevent double-tap zoom (iOS)
// -------------------------
(function preventDoubleTapZoom(){
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });
})();

// -------------------------
// storage helpers
// -------------------------
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

// -------------------------
// rules
// -------------------------
function weeklyGoldByRank(rank){
  if (rank >= 1 && rank <= 5) return 500;
  if (rank >= 6 && rank <= 10) return 800;
  if (rank >= 11 && rank <= 20) return 1000;
  if (rank >= 21 && rank <= 30) return 2000;
  return 3000;
}
function formatRank(rank){ return `RANK ${rank}`; }

// -------------------------
// screen switch
// -------------------------
function showTitle(){
  if (ui.titleScreen) ui.titleScreen.style.display = 'block';
  if (ui.app) ui.app.style.display = 'none';
}
function showMain(){
  if (ui.titleScreen) ui.titleScreen.style.display = 'none';
  if (ui.app) ui.app.style.display = 'grid'; // #app is grid layout
}

// -------------------------
// initial input (ONLY when entering main via NEXT)
// -------------------------
function ensureInitialInput(){
  // base numbers
  if (!localStorage.getItem(K.y)) setNum(K.y, 1989);
  if (!localStorage.getItem(K.m)) setNum(K.m, 1);
  if (!localStorage.getItem(K.w)) setNum(K.w, 1);
  if (!localStorage.getItem(K.rank)) setNum(K.rank, 10);
  if (!localStorage.getItem(K.gold)) setNum(K.gold, 0);
  if (!localStorage.getItem(K.recent)) setStr(K.recent, '未定');
  if (!localStorage.getItem(K.nextTour)) setStr(K.nextTour, '未定');
  if (!localStorage.getItem(K.nextTourW)) setStr(K.nextTourW, '未定');

  // names (prompt)
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

  // boot flag
  setStr(K.bootedOnce, '1');
}

// -------------------------
// render
// -------------------------
function render(){
  const company = getStr(K.company, 'CB Memory');
  const team = getStr(K.team, 'PLAYER TEAM');
  const m1 = getStr(K.m1, '○○○');
  const m2 = getStr(K.m2, '○○○');
  const m3 = getStr(K.m3, '○○○');

  if (ui.company) ui.company.textContent = company;
  if (ui.team) ui.team.textContent = team;

  if (ui.gold) ui.gold.textContent = String(getNum(K.gold, 0));
  if (ui.rank) ui.rank.textContent = formatRank(getNum(K.rank, 10));

  if (ui.y) ui.y.textContent = String(getNum(K.y, 1989));
  if (ui.m) ui.m.textContent = String(getNum(K.m, 1));
  if (ui.w) ui.w.textContent = String(getNum(K.w, 1));

  if (ui.nextTour) ui.nextTour.textContent = getStr(K.nextTour, '未定');
  if (ui.nextTourW) ui.nextTourW.textContent = getStr(K.nextTourW, '未定');

  if (ui.recent) ui.recent.textContent = getStr(K.recent, '未定');

  // member popup
  if (ui.uiM1) ui.uiM1.textContent = m1;
  if (ui.uiM2) ui.uiM2.textContent = m2;
  if (ui.uiM3) ui.uiM3.textContent = m3;

  // team overlay (intro)
  if (ui.tCompany) ui.tCompany.textContent = company;
  if (ui.tTeam) ui.tTeam.textContent = team;
  if (ui.tM1) ui.tM1.textContent = m1;
  if (ui.tM2) ui.tM2.textContent = m2;
  if (ui.tM3) ui.tM3.textContent = m3;
}

// -------------------------
// modal back helper
// -------------------------
function showBack(){
  if (!ui.modalBack) return;
  ui.modalBack.style.display = 'block';
  ui.modalBack.setAttribute('aria-hidden', 'false');
}
function hideBack(){
  if (!ui.modalBack) return;
  ui.modalBack.style.display = 'none';
  ui.modalBack.setAttribute('aria-hidden', 'true');
}

// -------------------------
// week popup
// -------------------------
function showWeekPop(title, sub){
  if (ui.popTitle) ui.popTitle.textContent = title;
  if (ui.popSub) ui.popSub.textContent = sub;
  showBack();
  if (ui.weekPop) ui.weekPop.style.display = 'block';
}
function hideWeekPop(){
  if (ui.weekPop) ui.weekPop.style.display = 'none';
  hideBack();
}

// -------------------------
// member popup
// -------------------------
function showMembersPop(){
  showBack();
  if (ui.membersPop) ui.membersPop.style.display = 'block';
}
function hideMembersPop(){
  if (ui.membersPop) ui.membersPop.style.display = 'none';
  hideBack();
}

function renamePrompt(key, label, defVal){
  const cur = getStr(key, defVal);
  const v = prompt(`${label}を変更`, cur);
  if (v === null) return;
  const nv = v.trim();
  if (nv === '') return;
  setStr(key, nv);
  render();
}

// -------------------------
// NEXT (not always)
// -------------------------
let nextHideTimer = null;
function showNextTemporarily(ms=3000){
  if (!ui.btnWeekNext) return;
  ui.btnWeekNext.classList.add('show');
  if (nextHideTimer) clearTimeout(nextHideTimer);
  nextHideTimer = setTimeout(() => {
    if (ui.btnWeekNext) ui.btnWeekNext.classList.remove('show');
  }, ms);
}

function bindRogNextReveal(){
  if (!ui.rogWrap) return;
  ui.rogWrap.addEventListener('click', () => showNextTemporarily(3200));
}

// -------------------------
// week progression
// -------------------------
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

  if (ui.btnPopNext){
    ui.btnPopNext.onclick = () => {
      setNum(K.y, ny);
      setNum(K.m, nm);
      setNum(K.w, nw);

      const gold = getNum(K.gold, 0);
      setNum(K.gold, gold + gain);

      setStr(K.recent, `週が進んだ（+${gain}G）`);

      hideWeekPop();
      render();

      if (ui.btnWeekNext) ui.btnWeekNext.classList.remove('show');
    };
  }
}

// -------------------------
// TEAM overlay (intro only)
// -------------------------
function showTeamScreen(){
  if (!ui.teamScreen) return;
  ui.teamScreen.classList.add('show');
  ui.teamScreen.setAttribute('aria-hidden', 'false');
}
function hideTeamScreen(){
  if (!ui.teamScreen) return;
  ui.teamScreen.classList.remove('show');
  ui.teamScreen.setAttribute('aria-hidden', 'true');
}

// -------------------------
// left menu placeholders
// -------------------------
function setRecent(text){
  setStr(K.recent, text);
  render();
}

function bindTopRename(){
  if (ui.tapCompany){
    ui.tapCompany.addEventListener('click', () => renamePrompt(K.company, '企業名', 'CB Memory'));
  }
  if (ui.tapTeamName){
    ui.tapTeamName.addEventListener('click', () => renamePrompt(K.team, 'チーム名', 'PLAYER TEAM'));
  }
}

function bindMembers(){
  if (ui.btnMembers){
    ui.btnMembers.addEventListener('click', () => {
      render();
      showMembersPop();
    });
  }
  if (ui.btnCloseMembers){
    ui.btnCloseMembers.addEventListener('click', hideMembersPop);
  }

  // 背景押しで閉じない（誤爆防止）
  if (ui.modalBack){
    ui.modalBack.addEventListener('click', (e) => e.preventDefault());
  }

  if (ui.rowM1) ui.rowM1.addEventListener('click', () => renamePrompt(K.m1, 'メンバー名（1人目）', '○○○'));
  if (ui.rowM2) ui.rowM2.addEventListener('click', () => renamePrompt(K.m2, 'メンバー名（2人目）', '○○○'));
  if (ui.rowM3) ui.rowM3.addEventListener('click', () => renamePrompt(K.m3, 'メンバー名（3人目）', '○○○'));
}

function bindMenus(){
  if (ui.btnTeam){
    ui.btnTeam.addEventListener('click', () => {
      render();
      showTeamScreen();
    });
  }
  if (ui.btnBattle) ui.btnBattle.addEventListener('click', () => setRecent('大会：未実装（次フェーズ）'));
  if (ui.btnTraining) ui.btnTraining.addEventListener('click', () => setRecent('育成：未実装（次フェーズ）'));
  if (ui.btnShop) ui.btnShop.addEventListener('click', () => setRecent('ショップ：未実装（次フェーズ）'));
  if (ui.btnSchedule) ui.btnSchedule.addEventListener('click', () => setRecent('スケジュール：未実装（次フェーズ）'));
  if (ui.btnCard) ui.btnCard.addEventListener('click', () => setRecent('カードコレクション：未実装（次フェーズ）'));

  if (ui.btnWeekNext) ui.btnWeekNext.addEventListener('click', advanceWeek);

  if (ui.btnCloseTeam) ui.btnCloseTeam.addEventListener('click', hideTeamScreen);
}

// -------------------------
// loop scroll (infinite) for left menu
// -------------------------
function setupLoopScroll(){
  if (!ui.loopScroll || !ui.loopInner) return;

  const scroller = ui.loopScroll;
  const inner = ui.loopInner;

  const originalButtons = Array.from(inner.querySelectorAll('button.imgBtn'));
  if (!originalButtons.length) return;

  // spacer
  const spacer = document.createElement('div');
  spacer.style.height = '2px';
  inner.appendChild(spacer);

  // clones without duplicated IDs
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
    oneSetHeight = 0;
    for (const b of originalButtons){
      oneSetHeight += b.getBoundingClientRect().height;
    }
    // gap (CSS is 14px)
    const gap = 14;
    oneSetHeight += gap * (originalButtons.length - 1);
  };

  requestAnimationFrame(() => {
    calcHeights();
    scroller.scrollTop = 1; // avoid sticking at 0
  });

  window.addEventListener('resize', () => calcHeights());

  scroller.addEventListener('scroll', () => {
    if (oneSetHeight <= 0) return;
    if (scroller.scrollTop >= oneSetHeight) scroller.scrollTop -= oneSetHeight;
    if (scroller.scrollTop <= 0) scroller.scrollTop += oneSetHeight;
  }, { passive: true });
}

// -------------------------
// title -> main
// -------------------------
function bindTitle(){
  // 起動時は必ずタイトル
  showTitle();

  if (ui.btnTitleNext){
    ui.btnTitleNext.addEventListener('click', () => {
      showMain();
      ensureInitialInput();

      // 初回メイン表示の最低ログ
      if (!localStorage.getItem(K.recent) || getStr(K.recent, '') === ''){
        setStr(K.recent, '未定');
      }

      render();
    });
  }
}

// -------------------------
// boot
// -------------------------
document.addEventListener('DOMContentLoaded', () => {
  // title always first
  bindTitle();

  // main bindings (even if hidden)
  bindTopRename();
  bindMenus();
  bindRogNextReveal();
  bindMembers();
  setupLoopScroll();

  // render is safe even before init
  render();
});
