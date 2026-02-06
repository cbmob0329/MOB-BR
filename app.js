'use strict';

/*
  MOB BR - Main Screen v13 (Team Screen: full spec intro)
  - Keeps your v12 layout behavior (loop scroll / week NEXT / member popup / iOS zoom block)
  - Team screen (btnTeam):
      1) 現在のメンバー（3人分：名前/能力/パッシブ/ウルト。%/勝率/補正値は出さない）
      2) コーチスキル（装備枠 最大5：装備/解除のみ。数値は出さない＝文章だけ）
      3) 戦績（終了した大会のみ表示）
      4) セーブ（手動セーブ / セーブ削除）
  ※HTMLは今のままでOK。teamPanelの中身はJSで差し替えて構築します（レイアウト崩れ防止）。
*/

/* ===== Keys ===== */
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
  recent: 'mobbr_recent',

  // stats (A/B/C)
  A_hp: 'mobbr_A_hp', A_ment: 'mobbr_A_ment', A_aim: 'mobbr_A_aim', A_agi: 'mobbr_A_agi', A_tech: 'mobbr_A_tech', A_sup: 'mobbr_A_sup', A_scan: 'mobbr_A_scan',
  B_hp: 'mobbr_B_hp', B_ment: 'mobbr_B_ment', B_aim: 'mobbr_B_aim', B_agi: 'mobbr_B_agi', B_tech: 'mobbr_B_tech', B_sup: 'mobbr_B_sup', B_scan: 'mobbr_B_scan',
  C_hp: 'mobbr_C_hp', C_ment: 'mobbr_C_ment', C_aim: 'mobbr_C_aim', C_agi: 'mobbr_C_agi', C_tech: 'mobbr_C_tech', C_sup: 'mobbr_C_sup', C_scan: 'mobbr_C_scan',

  // coach slots (json array length 5)
  coachSlots: 'mobbr_coachSlots',

  // records (json array)
  records: 'mobbr_records',

  // save
  save1: 'mobbr_save1'
};

const $ = (id) => document.getElementById(id);

/* ===== UI (existing IDs) ===== */
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

  // team screen overlay (existing wrapper)
  teamScreen: $('teamScreen'),
};

/* ===== iOS: prevent double tap zoom ===== */
(function preventDoubleTapZoom(){
  let lastTouchEnd = 0;
  document.addEventListener('touchend', (e) => {
    const now = Date.now();
    if (now - lastTouchEnd <= 300) e.preventDefault();
    lastTouchEnd = now;
  }, { passive: false });
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

function getJSON(key, def){
  try{
    const raw = localStorage.getItem(key);
    if (!raw) return def;
    return JSON.parse(raw);
  }catch(_e){
    return def;
  }
}
function setJSON(key, obj){
  localStorage.setItem(key, JSON.stringify(obj));
}

/* ===== Rank / week ===== */
function weeklyGoldByRank(rank){
  if (rank >= 1 && rank <= 5) return 500;
  if (rank >= 6 && rank <= 10) return 800;
  if (rank >= 11 && rank <= 20) return 1000;
  if (rank >= 21 && rank <= 30) return 2000;
  return 3000;
}
function formatRank(rank){ return `RANK ${rank}`; }

/* ===== Fixed roles / passive / ult ===== */
const ROLE = {
  A: { role: 'A（IGL）', passive: 'チームのアーマー+5', ult: 'FightBoost +2' },
  B: { role: 'B（アタッカー）', passive: 'チームの敏捷性+5', ult: 'FightBoost +2' },
  C: { role: 'C（サポーター）', passive: 'チームの探知+5', ult: 'FightBoost +2' }
};

/* ===== Render main ===== */
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

  // recent label removed: body only
  ui.recent.textContent = getStr(K.recent, '未定');

  // member popup values
  if (ui.uiM1) ui.uiM1.textContent = m1;
  if (ui.uiM2) ui.uiM2.textContent = m2;
  if (ui.uiM3) ui.uiM3.textContent = m3;

  // if team screen is open, refresh it too
  if (teamScreenState.isBuilt) {
    teamScreenRender();
  }
}

/* ===== Backdrop shared (week + members) ===== */
function showBack(){
  ui.popBack.style.display = 'block';
  ui.popBack.setAttribute('aria-hidden', 'false');
}
function hideBack(){
  ui.popBack.style.display = 'none';
  ui.popBack.setAttribute('aria-hidden', 'true');
}

/* ===== Week popup ===== */
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

/* ===== Members popup ===== */
function showMembersPop(){
  showBack();
  ui.membersPop.style.display = 'block';
}
function hideMembersPop(){
  ui.membersPop.style.display = 'none';
  hideBack();
}

/* ===== Initial values ===== */
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

  // default stats (only numeric display)
  const def = (key, val) => { if (!localStorage.getItem(key)) setNum(key, val); };

  // A(IGL) balanced
  def(K.A_hp, 55); def(K.A_ment, 55); def(K.A_aim, 50); def(K.A_agi, 48); def(K.A_tech, 55); def(K.A_sup, 50); def(K.A_scan, 55);
  // B(attacker) aim/agi
  def(K.B_hp, 52); def(K.B_ment, 50); def(K.B_aim, 60); def(K.B_agi, 58); def(K.B_tech, 48); def(K.B_sup, 45); def(K.B_scan, 45);
  // C(support) sup/scan/ment
  def(K.C_hp, 50); def(K.C_ment, 60); def(K.C_aim, 45); def(K.C_agi, 46); def(K.C_tech, 50); def(K.C_sup, 60); def(K.C_scan, 60);

  // coach slots
  if (!localStorage.getItem(K.coachSlots)) setJSON(K.coachSlots, [null, null, null, null, null]);

  // records
  if (!localStorage.getItem(K.records)) setJSON(K.records, []);
}

/* ===== Prompt rename ===== */
function bindRenamePrompt(key, label, defVal){
  const cur = getStr(key, defVal);
  const v = prompt(`${label}を変更`, cur);
  if (v === null) return;
  const nv = v.trim();
  if (nv === '') return;
  setStr(key, nv);
  render();
}

/* ===== NEXT (not always) ===== */
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

/* ===== Week progression ===== */
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

/* ===== Members popup bindings ===== */
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

/* ===== Top rename ===== */
function bindTopRename(){
  ui.tapCompany.addEventListener('click', () => bindRenamePrompt(K.company, '企業名', 'CB Memory'));
  ui.tapTeamName.addEventListener('click', () => bindRenamePrompt(K.team, 'チーム名', 'PLAYER TEAM'));
}

/* ===== Left menu placeholders ===== */
function setRecent(text){
  setStr(K.recent, text);
  render();
}

/* ===== Loop scroll ===== */
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

  window.addEventListener('resize', () => { calcHeights(); });

  scroller.addEventListener('scroll', () => {
    if (oneSetHeight <= 0) return;
    if (scroller.scrollTop >= oneSetHeight) scroller.scrollTop -= oneSetHeight;
    if (scroller.scrollTop <= 0) scroller.scrollTop += oneSetHeight;
  }, { passive: true });
}

/* =========================================================
   TEAM SCREEN (JS builds the content inside .teamPanel)
========================================================= */
const teamScreenState = {
  isBuilt: false,
  root: null,
  panel: null,
  closeBtn: null,

  tabMembers: null,
  tabCoach: null,
  tabRecord: null,
  tabSave: null,

  secMembers: null,
  secCoach: null,
  secRecord: null,
  secSave: null,

  // dynamic refs
  refs: {}
};

function teamScreenShow(){
  if (!ui.teamScreen) return;

  if (!teamScreenState.isBuilt) teamScreenBuild();
  teamScreenRender();

  ui.teamScreen.classList.add('show');
  ui.teamScreen.setAttribute('aria-hidden', 'false');
}
function teamScreenHide(){
  if (!ui.teamScreen) return;
  ui.teamScreen.classList.remove('show');
  ui.teamScreen.setAttribute('aria-hidden', 'true');
}

function el(tag, cls, text){
  const n = document.createElement(tag);
  if (cls) n.className = cls;
  if (text !== undefined) n.textContent = text;
  return n;
}

function teamScreenBuild(){
  teamScreenState.root = ui.teamScreen;

  // existing .teamPanel を拾って中身を差し替える（HTMLをいじらなくてもOK）
  let panel = teamScreenState.root.querySelector('.teamPanel');
  if (!panel) {
    // 念のため無ければ作る
    panel = el('div', 'teamPanel');
    teamScreenState.root.appendChild(panel);
  }
  teamScreenState.panel = panel;

  // clear and rebuild
  panel.innerHTML = '';

  const title = el('div', 'teamTitle', 'チーム');
  panel.appendChild(title);

  // tabs
  const tabs = el('div', 'teamTabs');
  const tabMembers = el('button', 'teamTab isActive', 'メンバー');
  tabMembers.type = 'button';
  const tabCoach = el('button', 'teamTab', 'コーチスキル');
  tabCoach.type = 'button';
  const tabRecord = el('button', 'teamTab', '戦績');
  tabRecord.type = 'button';
  const tabSave = el('button', 'teamTab', 'セーブ');
  tabSave.type = 'button';

  tabs.appendChild(tabMembers);
  tabs.appendChild(tabCoach);
  tabs.appendChild(tabRecord);
  tabs.appendChild(tabSave);
  panel.appendChild(tabs);

  teamScreenState.tabMembers = tabMembers;
  teamScreenState.tabCoach = tabCoach;
  teamScreenState.tabRecord = tabRecord;
  teamScreenState.tabSave = tabSave;

  // top info
  const topInfo = el('div', 'teamTopInfo');
  const lineCompany = el('div', 'teamLine');
  lineCompany.innerHTML = `企業名：<span id="team_company_val"></span>`;
  const lineTeam = el('div', 'teamLine');
  lineTeam.innerHTML = `チーム名：<span id="team_team_val"></span>`;
  topInfo.appendChild(lineCompany);
  topInfo.appendChild(lineTeam);
  panel.appendChild(topInfo);

  // sections wrapper
  const secMembers = el('div', 'teamSection show');
  const secCoach = el('div', 'teamSection');
  const secRecord = el('div', 'teamSection');
  const secSave = el('div', 'teamSection');

  teamScreenState.secMembers = secMembers;
  teamScreenState.secCoach = secCoach;
  teamScreenState.secRecord = secRecord;
  teamScreenState.secSave = secSave;

  // ---- Members section ----
  const memTitle = el('div', 'teamSectionTitle', '現在のメンバー');
  secMembers.appendChild(memTitle);
  const memHint = el('div', 'teamHint', '※％ / 勝率 / 補正値 は表示しません');
  secMembers.appendChild(memHint);

  secMembers.appendChild(buildMemberCard('A', 1));
  secMembers.appendChild(buildMemberCard('B', 2));
  secMembers.appendChild(buildMemberCard('C', 3));

  // ---- Coach section ----
  const coachTitle = el('div', 'teamSectionTitle', 'コーチスキル（装備枠）');
  secCoach.appendChild(coachTitle);
  const coachHint = el('div', 'teamHint', '最大5枠。できるのは「装備／解除」だけ（数値は表示しません）。');
  secCoach.appendChild(coachHint);

  const slotsWrap = el('div', 'coachSlots');
  for (let i = 0; i < 5; i++){
    slotsWrap.appendChild(buildCoachSlot(i));
  }
  secCoach.appendChild(slotsWrap);

  // ---- Record section ----
  const recTitle = el('div', 'teamSectionTitle', '戦績（終了した大会のみ）');
  secRecord.appendChild(recTitle);
  const recList = el('div', 'recordList');
  recList.id = 'record_list';
  secRecord.appendChild(recList);

  const recSummary = el('div', 'recordSummary');
  recSummary.id = 'record_summary';
  recSummary.style.display = 'none';
  secRecord.appendChild(recSummary);

  // ---- Save section ----
  const saveTitle = el('div', 'teamSectionTitle', 'セーブ');
  secSave.appendChild(saveTitle);
  const saveBox = el('div', 'saveBox');

  const btnSave = el('button', 'saveBtn', '手動セーブ');
  btnSave.type = 'button';

  const btnDelete = el('button', 'saveBtn danger', 'セーブ削除');
  btnDelete.type = 'button';

  const saveHint = el('div', 'saveHint', '※セーブは1枠（save1）です');
  saveBox.appendChild(btnSave);
  saveBox.appendChild(btnDelete);
  saveBox.appendChild(saveHint);
  secSave.appendChild(saveBox);

  // add sections to panel
  panel.appendChild(secMembers);
  panel.appendChild(secCoach);
  panel.appendChild(secRecord);
  panel.appendChild(secSave);

  // close button (keep id = btnCloseTeam)
  const closeBtn = el('button', 'closeBtn', '閉じる');
  closeBtn.type = 'button';
  closeBtn.id = 'btnCloseTeam';
  panel.appendChild(closeBtn);

  teamScreenState.closeBtn = closeBtn;

  // store dynamic refs
  teamScreenState.refs.companyVal = panel.querySelector('#team_company_val');
  teamScreenState.refs.teamVal = panel.querySelector('#team_team_val');
  teamScreenState.refs.recordList = panel.querySelector('#record_list');
  teamScreenState.refs.recordSummary = panel.querySelector('#record_summary');
  teamScreenState.refs.btnSave = btnSave;
  teamScreenState.refs.btnDelete = btnDelete;

  // bindings: tabs
  tabMembers.addEventListener('click', () => teamTabSelect('members'));
  tabCoach.addEventListener('click', () => teamTabSelect('coach'));
  tabRecord.addEventListener('click', () => teamTabSelect('record'));
  tabSave.addEventListener('click', () => teamTabSelect('save'));

  // close
  closeBtn.addEventListener('click', teamScreenHide);

  // save actions
  btnSave.addEventListener('click', saveNow);
  btnDelete.addEventListener('click', deleteSave);

  teamScreenState.isBuilt = true;
}

function teamTabSelect(which){
  const S = teamScreenState;

  // tabs
  const setActive = (tab, on) => {
    if (on) tab.classList.add('isActive');
    else tab.classList.remove('isActive');
  };
  setActive(S.tabMembers, which === 'members');
  setActive(S.tabCoach, which === 'coach');
  setActive(S.tabRecord, which === 'record');
  setActive(S.tabSave, which === 'save');

  // sections
  const setShow = (sec, on) => {
    if (on) sec.classList.add('show');
    else sec.classList.remove('show');
  };
  setShow(S.secMembers, which === 'members');
  setShow(S.secCoach, which === 'coach');
  setShow(S.secRecord, which === 'record');
  setShow(S.secSave, which === 'save');

  teamScreenRender();
}

function buildMemberCard(letter, idx){
  const card = el('div', 'memberCard');

  const head = el('div', 'memberHead');
  const role = el('div', 'memberRole', ROLE[letter].role);

  const btnName = el('button', 'memberNameBtn');
  btnName.type = 'button';

  const spanName = el('span', 'memberName');
  spanName.id = `team_name_${letter}`;

  btnName.appendChild(spanName);
  head.appendChild(role);
  head.appendChild(btnName);
  card.appendChild(head);

  // stats (numeric)
  const grid = el('div', 'statsGrid');
  const addStat = (keyLbl, spanId) => {
    const s = el('div', 'stat');
    const k = el('div', 'k', keyLbl);
    const v = el('div', 'v');
    v.id = spanId;
    s.appendChild(k);
    s.appendChild(v);
    return s;
  };

  grid.appendChild(addStat('体力', `stat_${letter}_hp`));
  grid.appendChild(addStat('メンタル', `stat_${letter}_ment`));
  grid.appendChild(addStat('エイム', `stat_${letter}_aim`));
  grid.appendChild(addStat('敏捷性', `stat_${letter}_agi`));
  grid.appendChild(addStat('技術', `stat_${letter}_tech`));
  grid.appendChild(addStat('サポート', `stat_${letter}_sup`));
  grid.appendChild(addStat('探知', `stat_${letter}_scan`));
  card.appendChild(grid);

  // passive / ult (text only)
  const passive = el('div', 'textBlock');
  passive.appendChild(el('div', 'lbl', 'パッシブ'));
  const passiveVal = el('div', 'val', ROLE[letter].passive);
  passiveVal.id = `passive_${letter}`;
  passive.appendChild(passiveVal);

  const ult = el('div', 'textBlock');
  ult.appendChild(el('div', 'lbl', 'ウルト'));
  const ultVal = el('div', 'val', ROLE[letter].ult);
  ultVal.id = `ult_${letter}`;
  ult.appendChild(ultVal);

  card.appendChild(passive);
  card.appendChild(ult);

  // name click -> rename
  btnName.addEventListener('click', () => {
    const key = (letter === 'A') ? K.m1 : (letter === 'B') ? K.m2 : K.m3;
    const label = `メンバー名（${idx}人目）`;
    bindRenamePrompt(key, label, '○○○');
  });

  return card;
}

function buildCoachSlot(i){
  const row = el('div', 'slotRow');

  const label = el('div', 'slotLabel', `スロット ${i+1}`);
  const text = el('div', 'slotText');
  text.id = `coach_text_${i}`;

  const btns = el('div', 'slotBtns');
  const btnEquip = el('button', 'slotBtn', '装備');
  btnEquip.type = 'button';
  const btnUnequip = el('button', 'slotBtn', '解除');
  btnUnequip.type = 'button';

  btns.appendChild(btnEquip);
  btns.appendChild(btnUnequip);

  row.appendChild(label);
  row.appendChild(text);
  row.appendChild(btns);

  btnEquip.addEventListener('click', () => {
    const slots = getCoachSlots();
    const cur = slots[i] || '';
    const v = prompt('コーチスキル（文章）を入力\n※数値は書かない', cur || '例：初動で安全なルートを優先する');
    if (v === null) return;
    const nv = v.trim();
    if (!nv) return;
    slots[i] = nv;
    setCoachSlots(slots);
    teamScreenRender();
  });

  btnUnequip.addEventListener('click', () => {
    const slots = getCoachSlots();
    slots[i] = null;
    setCoachSlots(slots);
    teamScreenRender();
  });

  return row;
}

function getCoachSlots(){
  const a = getJSON(K.coachSlots, [null, null, null, null, null]);
  // 安全に長さを保証
  while (a.length < 5) a.push(null);
  return a.slice(0, 5);
}
function setCoachSlots(arr){
  const a = Array.isArray(arr) ? arr.slice(0, 5) : [null, null, null, null, null];
  while (a.length < 5) a.push(null);
  setJSON(K.coachSlots, a);
}

function teamScreenRender(){
  if (!teamScreenState.isBuilt) return;

  const company = getStr(K.company, 'CB Memory');
  const team = getStr(K.team, 'PLAYER TEAM');
  const m1 = getStr(K.m1, '○○○');
  const m2 = getStr(K.m2, '○○○');
  const m3 = getStr(K.m3, '○○○');

  // top
  teamScreenState.refs.companyVal.textContent = company;
  teamScreenState.refs.teamVal.textContent = team;

  // names
  const nA = teamScreenState.panel.querySelector('#team_name_A');
  const nB = teamScreenState.panel.querySelector('#team_name_B');
  const nC = teamScreenState.panel.querySelector('#team_name_C');
  if (nA) nA.textContent = m1;
  if (nB) nB.textContent = m2;
  if (nC) nC.textContent = m3;

  // stats
  setText(`#stat_A_hp`, getNum(K.A_hp, 0));
  setText(`#stat_A_ment`, getNum(K.A_ment, 0));
  setText(`#stat_A_aim`, getNum(K.A_aim, 0));
  setText(`#stat_A_agi`, getNum(K.A_agi, 0));
  setText(`#stat_A_tech`, getNum(K.A_tech, 0));
  setText(`#stat_A_sup`, getNum(K.A_sup, 0));
  setText(`#stat_A_scan`, getNum(K.A_scan, 0));

  setText(`#stat_B_hp`, getNum(K.B_hp, 0));
  setText(`#stat_B_ment`, getNum(K.B_ment, 0));
  setText(`#stat_B_aim`, getNum(K.B_aim, 0));
  setText(`#stat_B_agi`, getNum(K.B_agi, 0));
  setText(`#stat_B_tech`, getNum(K.B_tech, 0));
  setText(`#stat_B_sup`, getNum(K.B_sup, 0));
  setText(`#stat_B_scan`, getNum(K.B_scan, 0));

  setText(`#stat_C_hp`, getNum(K.C_hp, 0));
  setText(`#stat_C_ment`, getNum(K.C_ment, 0));
  setText(`#stat_C_aim`, getNum(K.C_aim, 0));
  setText(`#stat_C_agi`, getNum(K.C_agi, 0));
  setText(`#stat_C_tech`, getNum(K.C_tech, 0));
  setText(`#stat_C_sup`, getNum(K.C_sup, 0));
  setText(`#stat_C_scan`, getNum(K.C_scan, 0));

  // coach slots (text only)
  const slots = getCoachSlots();
  for (let i = 0; i < 5; i++){
    const t = teamScreenState.panel.querySelector(`#coach_text_${i}`);
    if (!t) continue;
    t.textContent = slots[i] ? slots[i] : '（未装備）';
  }

  // records: finished only
  renderRecords();

  // save existence indicator (not required, but helpful)
  // (no extra UI text added)
}

function setText(sel, val){
  const n = teamScreenState.panel.querySelector(sel);
  if (n) n.textContent = String(val);
}

function renderRecords(){
  const list = teamScreenState.refs.recordList;
  const sum = teamScreenState.refs.recordSummary;
  if (!list || !sum) return;

  list.innerHTML = '';
  sum.innerHTML = '';
  sum.style.display = 'none';

  const all = getJSON(K.records, []);
  const finished = Array.isArray(all) ? all.filter(r => r && r.finished === true) : [];

  if (finished.length === 0){
    const empty = el('div', 'recordEmpty', 'まだ終了した大会がありません');
    list.appendChild(empty);
    return;
  }

  // list items
  finished.forEach((r) => {
    const box = el('div', 'recordEmpty'); // reuse same style
    const tn = safeText(r.tournamentName || '大会');
    const rank = (r.totalRank != null) ? String(r.totalRank) : '—';
    const pt = (r.totalPoints != null) ? String(r.totalPoints) : '—';
    box.textContent = `${tn} / 総合順位：${rank} / 総合ポイント：${pt}`;
    list.appendChild(box);
  });

  // summary (annual totals + year-end rank)
  const curYear = getNum(K.y, 1989);

  let killA = 0, killB = 0, killC = 0;
  let astA = 0, astB = 0, astC = 0;
  let yearEndRank = null;

  finished.forEach((r) => {
    // 年で絞る（r.year が無い場合は現在年扱いしない＝集計しない）
    if (r.year != null && Number(r.year) !== Number(curYear)) return;

    const k = r.kills || {};
    const a = r.assists || {};
    killA += Number(k.A || 0);
    killB += Number(k.B || 0);
    killC += Number(k.C || 0);
    astA += Number(a.A || 0);
    astB += Number(a.B || 0);
    astC += Number(a.C || 0);

    if (r.yearEndRank != null) yearEndRank = r.yearEndRank;
  });

  // show summary
  sum.style.display = 'block';

  const title = el('div', null, `${curYear}年 集計`);
  title.style.fontWeight = '1000';
  title.style.marginBottom = '6px';
  sum.appendChild(title);

  const addRow = (k, v) => {
    const row = el('div', 'sumRow');
    row.appendChild(el('div', null, k));
    row.appendChild(el('div', null, v));
    sum.appendChild(row);
  };

  addRow('年間キル数（全員）', `A:${killA} / B:${killB} / C:${killC}`);
  addRow('年間アシスト数（全員）', `A:${astA} / B:${astB} / C:${astC}`);
  addRow('年末企業ランク', yearEndRank != null ? String(yearEndRank) : '—');
}

function safeText(v){
  return String(v).replace(/\s+/g, ' ').trim();
}

/* ===== Save ===== */
function snapshotState(){
  // 必要最小限（今ある要素だけ）
  const snap = {
    at: Date.now(),
    company: getStr(K.company, 'CB Memory'),
    team: getStr(K.team, 'PLAYER TEAM'),
    m1: getStr(K.m1, '○○○'),
    m2: getStr(K.m2, '○○○'),
    m3: getStr(K.m3, '○○○'),
    gold: getNum(K.gold, 0),
    rank: getNum(K.rank, 10),
    y: getNum(K.y, 1989),
    m: getNum(K.m, 1),
    w: getNum(K.w, 1),
    nextTour: getStr(K.nextTour, '未定'),
    nextTourW: getStr(K.nextTourW, '未定'),
    recent: getStr(K.recent, '未定'),
    stats: {
      A: { hp:getNum(K.A_hp,0), ment:getNum(K.A_ment,0), aim:getNum(K.A_aim,0), agi:getNum(K.A_agi,0), tech:getNum(K.A_tech,0), sup:getNum(K.A_sup,0), scan:getNum(K.A_scan,0) },
      B: { hp:getNum(K.B_hp,0), ment:getNum(K.B_ment,0), aim:getNum(K.B_aim,0), agi:getNum(K.B_agi,0), tech:getNum(K.B_tech,0), sup:getNum(K.B_sup,0), scan:getNum(K.B_scan,0) },
      C: { hp:getNum(K.C_hp,0), ment:getNum(K.C_ment,0), aim:getNum(K.C_aim,0), agi:getNum(K.C_agi,0), tech:getNum(K.C_tech,0), sup:getNum(K.C_sup,0), scan:getNum(K.C_scan,0) },
    },
    coachSlots: getCoachSlots(),
    records: getJSON(K.records, [])
  };
  return snap;
}

function saveNow(){
  const snap = snapshotState();
  setJSON(K.save1, snap);
  setRecent('手動セーブしました');
  // 表示更新
  teamScreenRender();
}

function deleteSave(){
  const ok = confirm('セーブを削除しますか？（元に戻せません）');
  if (!ok) return;
  localStorage.removeItem(K.save1);
  setRecent('セーブを削除しました');
  teamScreenRender();
}

/* ===== Menus ===== */
function bindMenus(){
  ui.btnTeam.addEventListener('click', () => {
    render();
    teamScreenShow();
  });

  ui.btnBattle.addEventListener('click', () => setRecent('大会：未実装（次フェーズ）'));
  ui.btnTraining.addEventListener('click', () => setRecent('育成：未実装（次フェーズ）'));
  ui.btnShop.addEventListener('click', () => setRecent('ショップ：未実装（次フェーズ）'));
  ui.btnSchedule.addEventListener('click', () => setRecent('スケジュール：未実装（次フェーズ）'));
  ui.btnCard.addEventListener('click', () => setRecent('カードコレクション：未実装（次フェーズ）'));

  ui.btnWeekNext.addEventListener('click', advanceWeek);
}

/* ===== boot ===== */
document.addEventListener('DOMContentLoaded', () => {
  ensureInitialInput();

  bindTopRename();
  bindMenus();
  bindRogNextReveal();
  bindMembers();
  setupLoopScroll();

  render();
});
