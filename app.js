'use strict';

/*
  MOB BR - Main Screen (Main UI + Team Screen skeleton)
  - Left menu: loop scroll (only inside the button column) with stronger anti-bug handling
  - Members: creates a banner-like button under team image (if not in HTML) + popup to rename
  - Team button: opens "チーム管理" modal (UI骨組み)
  - Mobile:
      * prevent double-tap zoom (iOS)
      * long-press callout suppression is CSS (-webkit-touch-callout/user-select)
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
  hint: $('uiHint'),

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
  rogWrap: $('rogWrap'),

  btnTeam: $('btnTeam'),
  btnBattle: $('btnBattle'),
  btnTraining: $('btnTraining'),
  btnShop: $('btnShop'),
  btnSchedule: $('btnSchedule'),
  btnCard: $('btnCard'),

  loopScroll: $('loopScroll'),
  loopInner: $('loopInner'),

  app: $('app'),
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

function formatRank(rank){ return `RANK ${rank}`; }

function ensureInitialInput(){
  if (!localStorage.getItem(K.y)) setNum(K.y, 1989);
  if (!localStorage.getItem(K.m)) setNum(K.m, 1);
  if (!localStorage.getItem(K.w)) setNum(K.w, 1);
  if (!localStorage.getItem(K.rank)) setNum(K.rank, 10);
  if (!localStorage.getItem(K.gold)) setNum(K.gold, 0);
  if (!localStorage.getItem(K.recent)) setStr(K.recent, '未定');
  if (!localStorage.getItem(K.nextTour)) setStr(K.nextTour, '未定');
  if (!localStorage.getItem(K.nextTourW)) setStr(K.nextTourW, '未定');

  // 初回入力（仕様）
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
  if (!el) return;
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

/* ===== Week pop (表示だけ)
   ※NEXTは「週を跨ぐためのボタンではない」ため、ここでは「閉じる」用途に限定
*/
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

/* ===== Recent label remove (「最近の出来事：」を消す) ===== */
function removeRecentLabelText(){
  const el = ui.recent?.closest('.recentLog');
  if (!el) return;
  for (const node of Array.from(el.childNodes)){
    if (node.nodeType === Node.TEXT_NODE){
      node.textContent = '';
    }
  }
}

/* ===== Members banner button + popup ===== */
function ensureMembersButton(){
  const membersWrap = document.querySelector('.members');
  if (!membersWrap) return null;

  let btn = membersWrap.querySelector('.membersBtn');
  if (btn) return btn;

  btn = document.createElement('button');
  btn.type = 'button';
  btn.className = 'membersBtn';
  btn.id = 'btnMembers';
  btn.setAttribute('aria-label', 'メンバー名');
  btn.textContent = 'メンバー名';
  membersWrap.appendChild(btn);
  return btn;
}

function createModalShell(id){
  let back = document.getElementById(`${id}_back`);
  let modal = document.getElementById(`${id}_modal`);
  if (back && modal) return { back, modal };

  back = document.createElement('div');
  back.id = `${id}_back`;
  back.style.position = 'absolute';
  back.style.inset = '0';
  back.style.background = 'rgba(0,0,0,.55)';
  back.style.zIndex = '60';
  back.style.display = 'none';

  modal = document.createElement('div');
  modal.id = `${id}_modal`;
  modal.style.position = 'absolute';
  modal.style.left = '50%';
  modal.style.top = '50%';
  modal.style.transform = 'translate(-50%,-50%)';
  modal.style.zIndex = '61';
  modal.style.width = 'min(560px, 88vw)';
  modal.style.maxHeight = '80svh';
  modal.style.overflow = 'hidden';
  modal.style.display = 'none';
  modal.style.pointerEvents = 'auto';

  const card = document.createElement('div');
  card.style.width = '100%';
  card.style.maxHeight = '80svh';
  card.style.overflow = 'auto';
  card.style.background = 'rgba(0,0,0,.78)';
  card.style.border = '2px solid rgba(255,255,255,.35)';
  card.style.borderRadius = '16px';
  card.style.boxShadow = '0 18px 40px rgba(0,0,0,.45)';
  card.style.padding = '16px';
  card.style.color = '#fff';
  card.style.textShadow = '0 3px 0 rgba(0,0,0,.55)';
  card.style.webkitOverflowScrolling = 'touch';

  modal.appendChild(card);
  ui.app.appendChild(back);
  ui.app.appendChild(modal);

  back.addEventListener('click', () => {
    hideCustomModal(id);
  });

  return { back, modal };
}

function showCustomModal(id){
  const { back, modal } = createModalShell(id);
  back.style.display = 'block';
  modal.style.display = 'block';
}

function hideCustomModal(id){
  const back = document.getElementById(`${id}_back`);
  const modal = document.getElementById(`${id}_modal`);
  if (back) back.style.display = 'none';
  if (modal) modal.style.display = 'none';
}

function buildMembersPopup(){
  const { modal } = createModalShell('members');
  const card = modal.firstElementChild;
  card.innerHTML = '';

  const title = document.createElement('div');
  title.textContent = 'メンバー名';
  title.style.fontSize = '22px';
  title.style.fontWeight = '1000';
  title.style.marginBottom = '12px';
  card.appendChild(title);

  const info = document.createElement('div');
  info.textContent = '変更したいメンバーを選んでください';
  info.style.fontSize = '14px';
  info.style.opacity = '.92';
  info.style.marginBottom = '10px';
  card.appendChild(info);

  const list = document.createElement('div');
  list.style.display = 'grid';
  list.style.gap = '10px';
  card.appendChild(list);

  const makeBtn = (label, key) => {
    const b = document.createElement('button');
    b.type = 'button';
    b.textContent = label;
    b.style.width = '100%';
    b.style.padding = '12px 12px';
    b.style.borderRadius = '14px';
    b.style.border = '2px solid rgba(255,255,255,.28)';
    b.style.background = 'rgba(255,255,255,.08)';
    b.style.color = '#fff';
    b.style.fontWeight = '1000';
    b.style.fontSize = '16px';
    b.style.textAlign = 'left';
    b.style.cursor = 'pointer';
    b.style.touchAction = 'manipulation';
    b.addEventListener('click', () => {
      const cur = getStr(key, '○○○');
      const v = prompt('メンバー名を変更', cur);
      if (v === null) return;
      const nv = v.trim();
      if (!nv) return;
      setStr(key, nv);
      render();
      buildMembersPopup();
    });
    return b;
  };

  list.appendChild(makeBtn(`1人目：${getStr(K.m1,'○○○')}`, K.m1));
  list.appendChild(makeBtn(`2人目：${getStr(K.m2,'○○○')}`, K.m2));
  list.appendChild(makeBtn(`3人目：${getStr(K.m3,'○○○')}`, K.m3));

  const foot = document.createElement('div');
  foot.style.display = 'flex';
  foot.style.justifyContent = 'flex-end';
  foot.style.gap = '10px';
  foot.style.marginTop = '14px';
  card.appendChild(foot);

  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '閉じる';
  close.style.padding = '10px 12px';
  close.style.borderRadius = '12px';
  close.style.border = '2px solid rgba(255,255,255,.35)';
  close.style.background = 'rgba(0,0,0,.35)';
  close.style.color = '#fff';
  close.style.fontWeight = '1000';
  close.style.cursor = 'pointer';
  close.style.touchAction = 'manipulation';
  close.addEventListener('click', () => hideCustomModal('members'));
  foot.appendChild(close);
}

function openMembersPopup(){
  buildMembersPopup();
  showCustomModal('members');
}
/* ===== Team Screen (チーム管理：中身入り・第1段階) ===== */
function buildTeamPopup(){
  const { modal } = createModalShell('team');
  const card = modal.firstElementChild;
  card.innerHTML = '';

  const title = document.createElement('div');
  title.textContent = 'チーム管理';
  title.style.fontSize = '22px';
  title.style.fontWeight = '1000';
  title.style.marginBottom = '12px';
  card.appendChild(title);

  const teamName = document.createElement('div');
  teamName.textContent = `チーム名：${getStr(K.team,'PLAYER TEAM')}`;
  teamName.style.fontSize = '16px';
  teamName.style.marginBottom = '10px';
  card.appendChild(teamName);

  const membersTitle = document.createElement('div');
  membersTitle.textContent = 'メンバー';
  membersTitle.style.fontSize = '18px';
  membersTitle.style.fontWeight = '1000';
  membersTitle.style.margin = '12px 0 8px';
  card.appendChild(membersTitle);

  const list = document.createElement('div');
  list.style.display = 'grid';
  list.style.gap = '8px';
  card.appendChild(list);

  const makeRow = (name) => {
    const row = document.createElement('div');
    row.style.padding = '10px 12px';
    row.style.borderRadius = '12px';
    row.style.border = '2px solid rgba(255,255,255,.25)';
    row.style.background = 'rgba(255,255,255,.06)';
    row.style.fontWeight = '900';
    row.textContent = name;
    return row;
  };

  list.appendChild(makeRow(getStr(K.m1,'○○○')));
  list.appendChild(makeRow(getStr(K.m2,'○○○')));
  list.appendChild(makeRow(getStr(K.m3,'○○○')));

  const note = document.createElement('div');
  note.textContent = '※能力・パッシブ・ウルトは次フェーズで追加';
  note.style.fontSize = '14px';
  note.style.opacity = '.85';
  note.style.marginTop = '12px';
  card.appendChild(note);

  const foot = document.createElement('div');
  foot.style.display = 'flex';
  foot.style.justifyContent = 'flex-end';
  foot.style.marginTop = '14px';
  card.appendChild(foot);

  const close = document.createElement('button');
  close.type = 'button';
  close.textContent = '閉じる';
  close.style.padding = '10px 12px';
  close.style.borderRadius = '12px';
  close.style.border = '2px solid rgba(255,255,255,.35)';
  close.style.background = 'rgba(0,0,0,.35)';
  close.style.color = '#fff';
  close.style.fontWeight = '1000';
  close.style.cursor = 'pointer';
  close.style.touchAction = 'manipulation';
  close.addEventListener('click', () => hideCustomModal('team'));
  foot.appendChild(close);
}

function openTeamPopup(){
  buildTeamPopup();
  showCustomModal('team');
}

/* ===== Left menu binding ===== */
function bindMenus(){
  ui.btnTeam.addEventListener('click', () => {
    openTeamPopup();
  });

  ui.btnBattle.addEventListener('click', () => {
    setStr(K.recent, '大会：未実装');
    render();
  });
  ui.btnTraining.addEventListener('click', () => {
    setStr(K.recent, '育成：未実装');
    render();
  });
  ui.btnShop.addEventListener('click', () => {
    setStr(K.recent, 'ショップ：未実装');
    render();
  });
  ui.btnSchedule.addEventListener('click', () => {
    setStr(K.recent, 'スケジュール：未実装');
    render();
  });
  ui.btnCard.addEventListener('click', () => {
    setStr(K.recent, 'カードコレクション：未実装');
    render();
  });
}

/* ===== Loop scroll (bug-resistant) ===== */
function setupLoopScroll(){
  const scroller = ui.loopScroll;
  const inner = ui.loopInner;
  const originalButtons = Array.from(inner.querySelectorAll('button.imgBtn'));
  if (!originalButtons.length) return;

  const spacer = document.createElement('div');
  spacer.style.height = '2px';
  inner.appendChild(spacer);

  const clones = originalButtons.map((btn) => {
    const clone = btn.cloneNode(true);
    clone.id = '';
    clone.addEventListener('click', () => btn.click());
    return clone;
  });
  clones.forEach(n => inner.appendChild(n));

  let oneSetHeight = 0;
  const calcHeights = () => {
    oneSetHeight = originalButtons.reduce((s,b)=>s+b.getBoundingClientRect().height,0);
    oneSetHeight += 14 * (originalButtons.length - 1);
  };

  requestAnimationFrame(() => {
    calcHeights();
    scroller.scrollTop = 2;
  });

  window.addEventListener('resize', calcHeights);

  scroller.addEventListener('scroll', () => {
    if (oneSetHeight <= 0) return;
    if (scroller.scrollTop >= oneSetHeight) {
      scroller.scrollTop -= oneSetHeight;
    } else if (scroller.scrollTop <= 0) {
      scroller.scrollTop += oneSetHeight;
    }
  }, { passive:true });
}

/* ===== Render ===== */
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
}

/* ===== Boot ===== */
document.addEventListener('DOMContentLoaded', () => {
  ensureInitialInput();

  bindRename(ui.tapCompany, K.company, '企業名', 'CB Memory');
  bindRename(ui.tapTeam, K.team, 'チーム名', 'PLAYER TEAM');

  const membersBtn = ensureMembersButton();
  if (membersBtn){
    membersBtn.addEventListener('click', openMembersPopup);
  }

  bindMenus();
  setupLoopScroll();
  removeRecentLabelText();
  render();
});
