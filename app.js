'use strict';

/*
  MOB BR - Main Screen v12
  - Left menu: loop scroll (only inside the button column)
  - NEXT usage:
      * ONLY inside popup flows (week popup / training / shop etc.)
      * NOT used as "advance week" button on main screen
  - Week progression:
      * Tap rog panel to advance week (shows week popup)
      * Confirm/close by popup NEXT
  - Mobile hardening (iOS):
      * prevent double-tap zoom
      * prevent pinch zoom (gesture events)
      * suppress long-press callout via CSS (-webkit-touch-callout/user-select)
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

  popBack: $('modalBack'),
  weekPop: $('weekPop'),
  popTitle: $('popTitle'),
  popSub: $('popSub'),
  btnPopNext: $('btnPopNext'),

  // NOTE: btnWeekNext は “週進行用に使わない”
  // HTMLに残っていても、ここでは一切使わない（表示もさせない）
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
};

/* ===== iOS zoom hardening ===== */
(function hardPreventZoom(){
  // 1) pinch (iOS Safari)
  const stop = (e) => { e.preventDefault(); };

  document.addEventListener('gesturestart', stop, { passive:false });
  document.addEventListener('gesturechange', stop, { passive:false });
  document.addEventListener('gestureend', stop, { passive:false });

  // 2) dblclick zoom (some browsers)
  document.addEventListener('dblclick', stop, { passive:false });

  // 3) double-tap zoom fallback
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  }, { passive:false });

  // 4) multi-touch move (extra safety)
  document.addEventListener('touchmove', (e) => {
    if (e.touches && e.touches.length > 1) e.preventDefault();
  }, { passive:false });
})();

/* ===== storage helpers ===== */
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

/* ===== render ===== */
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

  // 週進行用NEXTは出さない（安全に常に非表示）
  if (ui.btnWeekNext) ui.btnWeekNext.classList.remove('show');
}

/* ===== modal ===== */
function showWeekPop(title, sub){
  ui.popTitle.textContent = title;
  ui.popSub.textContent = sub;
  ui.popBack.style.display = 'block';
  ui.weekPop.style.display = 'block';
  ui.popBack.setAttribute('aria-hidden', 'false');
}
function hideWeekPop(){
  ui.popBack.style.display = 'none';
  ui.weekPop.style.display = 'none';
  ui.popBack.setAttribute('aria-hidden', 'true');
}

/* ===== initial ===== */
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

/* ===== week progression (NO main NEXT button) ===== */
function computeNextWeek(y, m, w){
  let ny = y, nm = m, nw = w + 1;
  if (nw >= 5){
    nw = 1;
    nm = m + 1;
    if (nm >= 13){
      nm = 1;
      ny = y + 1;
    }
  }
  return { ny, nm, nw };
}

function advanceWeekByTap(){
  const y = getNum(K.y, 1989);
  const m = getNum(K.m, 1);
  const w = getNum(K.w, 1);

  const { ny, nm, nw } = computeNextWeek(y, m, w);

  const rank = getNum(K.rank, 10);
  const gain = weeklyGoldByRank(rank);

  // 週ポップ表示（確定＆閉じるのはポップ内NEXTのみ）
  showWeekPop(`${ny}年${nm}月 第${nw}週`, `企業ランクにより ${gain}G 獲得！`);

  // ここが「NEXTの正しい役割」：ポップ内で次へ
  ui.btnPopNext.onclick = () => {
    setNum(K.y, ny);
    setNum(K.m, nm);
    setNum(K.w, nw);

    const gold = getNum(K.gold, 0);
    setNum(K.gold, gold + gain);

    setStr(K.recent, `週が進んだ（+${gain}G）`);

    hideWeekPop();
    render();
  };
}

/* rogをタップしたら週進行（ただしポップ内NEXTで確定） */
function bindWeekByRogTap(){
  ui.rogWrap.addEventListener('click', () => {
    // ポップ表示中に連打で重ならないようにガード
    if (ui.weekPop && ui.weekPop.style.display === 'block') return;
    advanceWeekByTap();
  });
}

/* ===== Left menu placeholders ===== */
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

  // ポップ背景押下は閉じない（誤操作防止）
  ui.popBack.addEventListener('click', (e) => e.preventDefault());
}

/* ===== Loop scroll (infinite) for left menu ===== */
function setupLoopScroll(){
  const scroller = ui.loopScroll;
  const inner = ui.loopInner;

  const originalButtons = Array.from(inner.querySelectorAll('button.imgBtn'));

  // already duplicated? (hot reload safety)
  if (inner.dataset.loopReady === '1') return;
  inner.dataset.loopReady = '1';

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
    const gap = 14;
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

    if (scroller.scrollTop >= oneSetHeight) {
      scroller.scrollTop -= oneSetHeight;
    }
    if (scroller.scrollTop <= 0) {
      scroller.scrollTop += oneSetHeight;
    }
  }, { passive: true });
}

/* ===== boot ===== */
document.addEventListener('DOMContentLoaded', () => {
  ensureInitialInput();

  bindRename(ui.tapCompany, K.company, '企業名', 'CB Memory');
  bindRename(ui.tapTeam, K.team, 'チーム名', 'PLAYER TEAM');
  bindRename(ui.tapM1, K.m1, 'メンバー名（1人目）', '○○○');
  bindRename(ui.tapM2, K.m2, 'メンバー名（2人目）', '○○○');
  bindRename(ui.tapM3, K.m3, 'メンバー名（3人目）', '○○○');

  bindMenus();
  bindWeekByRogTap();
  setupLoopScroll();

  render();
});
