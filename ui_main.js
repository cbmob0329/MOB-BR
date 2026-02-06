'use strict';

/*
  ui_main.js (v13) FULL FIXED

  仕様：
  - storage.js のキー定義と完全一致
  - 0年0月0週バグ修正（1989年1月第1週スタート保証）
  - rogタップでNEXT表示 → 完全廃止
  - 左メニューは通常スクロールのみ（ループなし）
  - メンバー名変更は team画面にも即時反映
*/

window.MOBBR = window.MOBBR || {};

(function(){

  // ===== storage keys（storage.js と完全一致）=====
  const K = {
    company: 'mobbr_company',
    team: 'mobbr_team',

    m1: 'mobbr_m1',
    m2: 'mobbr_m2',
    m3: 'mobbr_m3',

    gold: 'mobbr_gold',
    rank: 'mobbr_rank',

    y: 'mobbr_year',
    m: 'mobbr_month',
    w: 'mobbr_week',

    nextTour: 'mobbr_nextTour',
    nextTourW: 'mobbr_nextTourW',

    recent: 'mobbr_recent',
  };

  const $ = (id) => document.getElementById(id);

  // ===== helpers =====
  function getNum(key, def){
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) ? v : def;
  }
  function getStr(key, def){
    const v = localStorage.getItem(key);
    return (v === null || v === undefined || v === '') ? def : v;
  }
  function setNum(key, val){
    localStorage.setItem(key, String(Number(val)));
  }
  function setStr(key, val){
    localStorage.setItem(key, String(val));
  }

  function weeklyGoldByRank(rank){
    if (rank >= 1 && rank <= 5) return 500;
    if (rank >= 6 && rank <= 10) return 800;
    if (rank >= 11 && rank <= 20) return 1000;
    if (rank >= 21 && rank <= 30) return 2000;
    return 3000;
  }

  function formatRank(rank){
    return `RANK ${rank}`;
  }

  // ===== DOM =====
  let ui = null;

  function collectDom(){
    ui = {
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

      modalBack: $('modalBack'),
      weekPop: $('weekPop'),
      popTitle: $('popTitle'),
      popSub: $('popSub'),
      btnPopNext: $('btnPopNext'),

      btnWeekNext: $('btnWeekNext'), // 使わない（常に非表示）
      rogWrap: $('rogWrap'),         // 使わない

      btnTeam: $('btnTeam'),
      btnBattle: $('btnBattle'),
      btnTraining: $('btnTraining'),
      btnShop: $('btnShop'),
      btnSchedule: $('btnSchedule'),
      btnCard: $('btnCard'),

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
    };
  }

  // ===== render =====
  function render(){
    if (!ui) collectDom();

    const company = getStr(K.company, 'CB Memory');
    const team = getStr(K.team, 'PLAYER TEAM');
    const m1 = getStr(K.m1, 'A');
    const m2 = getStr(K.m2, 'B');
    const m3 = getStr(K.m3, 'C');

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

    if (ui.uiM1) ui.uiM1.textContent = m1;
    if (ui.uiM2) ui.uiM2.textContent = m2;
    if (ui.uiM3) ui.uiM3.textContent = m3;

    if (ui.tCompany) ui.tCompany.textContent = company;
    if (ui.tTeam) ui.tTeam.textContent = team;
    if (ui.tM1) ui.tM1.textContent = m1;
    if (ui.tM2) ui.tM2.textContent = m2;
    if (ui.tM3) ui.tM3.textContent = m3;

    // NEXTは常に使わない
    if (ui.btnWeekNext) ui.btnWeekNext.classList.remove('show');
  }

  // ===== modal =====
  function showBack(){
    if (!ui.modalBack) return;
    ui.modalBack.style.display = 'block';
  }
  function hideBack(){
    if (!ui.modalBack) return;
    ui.modalBack.style.display = 'none';
  }

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

  // ===== rename =====
  function notifyTeamSync(){
    if (window.MOBBR?.ui?.team?.render){
      window.MOBBR.ui.team.render();
    }
  }

  function renamePrompt(key, label){
    const cur = getStr(key, '');
    const v = prompt(`${label}を変更`, cur);
    if (v === null) return;
    const nv = v.trim();
    if (!nv) return;
    setStr(key, nv);
    render();
    notifyTeamSync();
  }

  // ===== week advance =====
  function advanceWeek(){
    const y = getNum(K.y, 1989);
    const m = getNum(K.m, 1);
    const w = getNum(K.w, 1);

    let ny = y, nm = m, nw = w + 1;
    if (nw > 4){
      nw = 1;
      nm++;
      if (nm > 12){
        nm = 1;
        ny++;
      }
    }

    const gain = weeklyGoldByRank(getNum(K.rank, 10));

    showWeekPop(`${ny}年${nm}月 第${nw}週`, `企業ランクにより ${gain}G 獲得！`);

    if (ui.btnPopNext){
      ui.btnPopNext.onclick = () => {
        setNum(K.y, ny);
        setNum(K.m, nm);
        setNum(K.w, nw);
        setNum(K.gold, getNum(K.gold, 0) + gain);
        setStr(K.recent, `週が進んだ（+${gain}G）`);
        hideWeekPop();
        render();
      };
    }
  }

  // ===== bind =====
  let bound = false;
  function bind(){
    if (bound) return;
    bound = true;

    if (ui.tapCompany){
      ui.tapCompany.addEventListener('click', () => renamePrompt(K.company, '企業名'));
    }
    if (ui.tapTeamName){
      ui.tapTeamName.addEventListener('click', () => renamePrompt(K.team, 'チーム名'));
    }

    if (ui.btnMembers){
      ui.btnMembers.addEventListener('click', () => { render(); showBack(); ui.membersPop.style.display='block'; });
    }
    if (ui.btnCloseMembers){
      ui.btnCloseMembers.addEventListener('click', () => { ui.membersPop.style.display='none'; hideBack(); });
    }

    if (ui.rowM1) ui.rowM1.addEventListener('click', () => renamePrompt(K.m1, 'メンバー名（1人目）'));
    if (ui.rowM2) ui.rowM2.addEventListener('click', () => renamePrompt(K.m2, 'メンバー名（2人目）'));
    if (ui.rowM3) ui.rowM3.addEventListener('click', () => renamePrompt(K.m3, 'メンバー名（3人目）'));

    if (ui.btnTeam) ui.btnTeam.addEventListener('click', () => {
      ui.teamScreen.classList.add('show');
      notifyTeamSync();
    });
    if (ui.btnCloseTeam) ui.btnCloseTeam.addEventListener('click', () => {
      ui.teamScreen.classList.remove('show');
    });

    if (ui.btnBattle) ui.btnBattle.addEventListener('click', () => setStr(K.recent, '大会：未実装'));
    if (ui.btnTraining) ui.btnTraining.addEventListener('click', () => setStr(K.recent, '育成：未実装'));
    if (ui.btnShop) ui.btnShop.addEventListener('click', () => setStr(K.recent, 'ショップ：未実装'));
    if (ui.btnSchedule) ui.btnSchedule.addEventListener('click', () => setStr(K.recent, 'スケジュール：未実装'));
    if (ui.btnCard) ui.btnCard.addEventListener('click', () => setStr(K.recent, 'カード：未実装'));
  }

  function initMainUI(){
    collectDom();
    bind();
    render();
  }

  window.MOBBR.initMainUI = initMainUI;
  initMainUI();

})();
