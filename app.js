'use strict';

/*
  MOB BR - Main Screen (based on your "唯一の正" spec)
  - First boot: ask company/team/member names
  - Tap to rename anytime
  - Week advance with NEXT button -> show week popup and G gain (by rank)
  - Mobile:
      - prevent double-tap zoom (iOS)
      - (CSS handles long-press callout/selection UI suppression)
  - NOTE: Tournament/training/shop/schedule/card are placeholders now (log only)
*/

// ======= Storage keys =======
const K = {
  company: 'mobbr_company',
  team: 'mobbr_team',
  m1: 'mobbr_m1',
  m2: 'mobbr_m2',
  m3: 'mobbr_m3',
  gold: 'mobbr_gold',
  rank: 'mobbr_rank', // number
  y: 'mobbr_y',
  m: 'mobbr_m',
  w: 'mobbr_w',
  nextTour: 'mobbr_nextTour',
  nextTourW: 'mobbr_nextTourW',
  recent: 'mobbr_recent'
};

const $ = (id) => document.getElementById(id);

const ui = {
  ver: $('uiVer'),
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
  btnWeekNext: $('btnWeekNext'),

  btnTeam: $('btnTeam'),
  btnBattle: $('btnBattle'),
  btnTraining: $('btnTraining'),
  btnShop: $('btnShop'),
  btnSchedule: $('btnSchedule'),
  btnCard: $('btnCard'),
};

// ======= iOS double-tap zoom guard =======
(function preventDoubleTapZoom(){
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });
})();

// ======= Defaults =======
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

// rank -> weekly gold gain (your table)
function weeklyGoldByRank(rank){
  if (rank >= 1 && rank <= 5) return 500;
  if (rank >= 6 && rank <= 10) return 800;
  if (rank >= 11 && rank <= 20) return 1000;
  if (rank >= 21 && rank <= 30) return 2000;
  return 3000; // 31～
}

function formatRank(rank){
  // 表示は RANK 10 の形式で固定
  return `RANK ${rank}`;
}

function render(){
  ui.company.textContent = getStr(K.company, 'CB Memory');
  ui.team.textContent = getStr(K.team, 'PLAYER TEAM');

  const gold = getNum(K.gold, 0);
  ui.gold.textContent = String(gold);

  const rank = getNum(K.rank, 10);
  ui.rank.textContent = formatRank(rank);

  const y = getNum(K.y, 1989);
  const m = getNum(K.m, 1);
  const w = getNum(K.w, 1);
  ui.y.textContent = String(y);
  ui.m.textContent = String(m);
  ui.w.textContent = String(w);

  ui.nextTour.textContent = getStr(K.nextTour, '未定');
  ui.nextTourW.textContent = getStr(K.nextTourW, '未定');
  ui.recent.textContent = getStr(K.recent, '未定');

  ui.tapM1.textContent = getStr(K.m1, '○○○');
  ui.tapM2.textContent = getStr(K.m2, '○○○');
  ui.tapM3.textContent = getStr(K.m3, '○○○');
}

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

// ======= First boot prompts =======
function ensureInitialInput(){
  const hasCompany = !!localStorage.getItem(K.company);
  const hasTeam = !!localStorage.getItem(K.team);
  const hasM1 = !!localStorage.getItem(K.m1);
  const hasM2 = !!localStorage.getItem(K.m2);
  const hasM3 = !!localStorage.getItem(K.m3);

  // 初期週設定（無ければ）
  if (!localStorage.getItem(K.y)) setNum(K.y, 1989);
  if (!localStorage.getItem(K.m)) setNum(K.m, 1);
  if (!localStorage.getItem(K.w)) setNum(K.w, 1);
  if (!localStorage.getItem(K.rank)) setNum(K.rank, 10);
  if (!localStorage.getItem(K.gold)) setNum(K.gold, 0);
  if (!localStorage.getItem(K.recent)) setStr(K.recent, '未定');
  if (!localStorage.getItem(K.nextTour)) setStr(K.nextTour, '未定');
  if (!localStorage.getItem(K.nextTourW)) setStr(K.nextTourW, '未定');

  // 入力は「初回のみ」だが、未設定なら聞く
  if (!hasCompany){
    const v = prompt('企業名を入力してください', 'CB Memory');
    if (v !== null && v.trim() !== '') setStr(K.company, v.trim());
  }
  if (!hasTeam){
    const v = prompt('チーム名を入力してください', 'PLAYER TEAM');
    if (v !== null && v.trim() !== '') setStr(K.team, v.trim());
  }
  if (!hasM1){
    const v = prompt('メンバー名（1人目）を入力してください', '○○○');
    if (v !== null && v.trim() !== '') setStr(K.m1, v.trim());
  }
  if (!hasM2){
    const v = prompt('メンバー名（2人目）を入力してください', '○○○');
    if (v !== null && v.trim() !== '') setStr(K.m2, v.trim());
  }
  if (!hasM3){
    const v = prompt('メンバー名（3人目）を入力してください', '○○○');
    if (v !== null && v.trim() !== '') setStr(K.m3, v.trim());
  }
}

// ======= Tap to rename anytime =======
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

// ======= Week progression =======
// Here: NEXT corner advances week -> pop shows gain -> closing pop adds gold and updates recent log
function advanceWeek(){
  const y = getNum(K.y, 1989);
  const m = getNum(K.m, 1);
  const w = getNum(K.w, 1);

  // next week calc: 1ヶ月=4週（あなたの仕様群で使ってる前提に合わせる）
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

  // 表示：週切り替えポップ（中央）
  showWeekPop(`${ny}年${nm}月 第${nw}週`, `企業ランクにより ${gain}G 獲得！`);

  // 一旦、確定はポップNEXTで行う（仕様どおり）
  ui.btnPopNext.onclick = () => {
    // commit
    setNum(K.y, ny);
    setNum(K.m, nm);
    setNum(K.w, nw);

    const gold = getNum(K.gold, 0);
    setNum(K.gold, gold + gain);

    // 最近ログ（未定欄のままでもOKだが、週進行は確実に書く）
    setStr(K.recent, `週が進んだ（+${gain}G）`);

    hideWeekPop();
    render();
  };
}

// ======= Menu placeholders =======
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

  ui.btnWeekNext.addEventListener('click', advanceWeek);

  // ポップ背景押下は閉じない（誤操作防止）
  ui.popBack.addEventListener('click', (e) => e.preventDefault());
}

// ======= boot =======
document.addEventListener('DOMContentLoaded', () => {
  ensureInitialInput();

  bindRename(ui.tapCompany, K.company, '企業名', 'CB Memory');
  bindRename(ui.tapTeam, K.team, 'チーム名', 'PLAYER TEAM');
  bindRename(ui.tapM1, K.m1, 'メンバー名（1人目）', '○○○');
  bindRename(ui.tapM2, K.m2, 'メンバー名（2人目）', '○○○');
  bindRename(ui.tapM3, K.m3, 'メンバー名（3人目）', '○○○');

  bindMenus();
  render();
});
