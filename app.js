'use strict';

/*
  MOB BR - Main Screen v12
  FIX:
  - Text always stays inside frames (handled mainly by CSS clamp/wrap)
  - Bottom panel never goes off-screen (rightCol grid rows + rog svh height)
  - NEXT is NOT for week progression -> week-advance logic removed
  - Mobile zoom suppression:
      * user-scalable=no in meta viewport
      * iOS gesture events prevented
      * double-tap zoom prevented
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
  tapTeam: $('tapTeam'),
  tapM1: $('tapM1'),
  tapM2: $('tapM2'),
  tapM3: $('tapM3'),

  btnTeam: $('btnTeam'),
  btnBattle: $('btnBattle'),
  btnTraining: $('btnTraining'),
  btnShop: $('btnShop'),
  btnSchedule: $('btnSchedule'),
  btnCard: $('btnCard'),

  loopScroll: $('loopScroll'),
  loopInner: $('loopInner'),

  btnPopupNext: $('btnPopupNext'),
};

(function suppressZoomIOS(){
  // iOS pinch zoom gesture suppression
  const prevent = (e) => { e.preventDefault(); };
  document.addEventListener('gesturestart', prevent, { passive:false });
  document.addEventListener('gesturechange', prevent, { passive:false });
  document.addEventListener('gestureend', prevent, { passive:false });

  // double-tap zoom suppression (iOS Safari)
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

function formatRank(rank){ return `RANK ${rank}`; }

function render(){
  ui.company.textContent = getStr(K.company, 'CB Memory');
  ui.team.textContent = getStr(K.team, 'PLAYER TEAM');
  ui.gold.textContent = String(getNum(K.gold, 0));
  ui.rank.textContent = formatRank(getNum(K.rank, 10));

  ui.y.textContent = String(getNum(K.y, 1989));
  ui.m.textContent = String(getNum(K.m, 1));
  ui.w.textContent = String(getNum(K.w, 1));

  ui.nextTour.textContent = getStr(K.nextTour, '未定');
  ui.nextTourW.textContent = getStr(K.nextTourW, '未定');
  ui.recent.textContent = getStr(K.recent, '未定');

  ui.tapM1.textContent = getStr(K.m1, '○○○');
  ui.tapM2.textContent = getStr(K.m2, '○○○');
  ui.tapM3.textContent = getStr(K.m3, '○○○');
}

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

function bindRename(el, key, label, defVal){
  el.addEventListener('click', () => {
    const cur = getStr(key, defVal);
    const v = prompt(`${label}を変更`, cur);
    if (v === null) return;
    const nv = v.trim();
    if (nv === '') return;
    setStr(key, nv);
    render();
  });
}

// ===== Left menu placeholders (導線のみ) =====
function setRecent(text){
  setStr(K.recent, text);
  render();
}

function bindMenus(){
  ui.btnTeam.addEventListener('click', () => setRecent('チーム：未実装（次フェーズ）'));
  ui.btnBattle.addEventListener('click', () => setRecent('大会：未実装（次フェーズ）'));
  ui.btnTraining.addEventListener('click', () => setRecent('育成：未実装（次フェーズ）'));
  ui.btnShop.addEventListener('click', () => setRecent('ショップ：未実装（次フェーズ）'));
  ui.btnSchedule.addEventListener('click', () => setRecent('スケジュール：未実装（次フェーズ）'));
  ui.btnCard.addEventListener('click', () => setRecent('カードコレクション：未実装（次フェーズ）'));

  // NEXTはポップアップ専用（今は未実装）。誤タップ防止で基本非表示。
  ui.btnPopupNext.classList.remove('show');
}

// ===== Loop scroll (infinite) for left menu =====
function setupLoopScroll(){
  const scroller = ui.loopScroll;
  const inner = ui.loopInner;

  const originalButtons = Array.from(inner.querySelectorAll('button.imgBtn'));

  // clones set (avoid duplicated IDs)
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

  const spacer = document.createElement('div');
  spacer.style.height = '2px';
  inner.appendChild(spacer);
  clones.forEach(n => inner.appendChild(n));

  let oneSetHeight = 0;
  const calcHeights = () => {
    // gapはCSSの12px（loopInner gap）
    const gap = 12;
    oneSetHeight = originalButtons.reduce((sum, b) => sum + b.getBoundingClientRect().height, 0);
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

  bindRename(ui.tapCompany, K.company, '企業名', 'CB Memory');
  bindRename(ui.tapTeam, K.team, 'チーム名', 'PLAYER TEAM');
  bindRename(ui.tapM1, K.m1, 'メンバー名（1人目）', '○○○');
  bindRename(ui.tapM2, K.m2, 'メンバー名（2人目）', '○○○');
  bindRename(ui.tapM3, K.m3, 'メンバー名（3人目）', '○○○');

  bindMenus();
  setupLoopScroll();
  render();
});
