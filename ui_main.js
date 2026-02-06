'use strict';

/*
  ui_main.js (v13)
  - app.js の loadScript() で NEXT後に読み込まれる前提
  - rog(右下ログ)タップでNEXTを出す機能は廃止
  - 左メニューはループしない（上下スクロールのみ）
  - メンバー名変更時、ui_team側にも再描画通知
*/

window.MOBBR = window.MOBBR || {};

(function(){
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
  };

  const $ = (id) => document.getElementById(id);

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

      // next (※rogタップで出すのは廃止)
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

      // team overlay
      teamScreen: $('teamScreen'),
      btnCloseTeam: $('btnCloseTeam'),
      tCompany: $('tCompany'),
      tTeam: $('tTeam'),
      tM1: $('tM1'),
      tM2: $('tM2'),
      tM3: $('tM3')
    };
  }

  function render(){
    if (!ui) collectDom();

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

    // member popup values
    if (ui.uiM1) ui.uiM1.textContent = m1;
    if (ui.uiM2) ui.uiM2.textContent = m2;
    if (ui.uiM3) ui.uiM3.textContent = m3;

    // team overlay quick header
    if (ui.tCompany) ui.tCompany.textContent = company;
    if (ui.tTeam) ui.tTeam.textContent = team;
    if (ui.tM1) ui.tM1.textContent = m1;
    if (ui.tM2) ui.tM2.textContent = m2;
    if (ui.tM3) ui.tM3.textContent = m3;

    // NEXTボタンはここでは使わない（常に隠す）
    if (ui.btnWeekNext) ui.btnWeekNext.classList.remove('show');
  }

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

  function showMembersPop(){
    showBack();
    if (ui.membersPop) ui.membersPop.style.display = 'block';
  }
  function hideMembersPop(){
    if (ui.membersPop) ui.membersPop.style.display = 'none';
    hideBack();
  }

  function notifyTeamNameSync(){
    // メインで名前変えたら、チーム画面側も必ず追従させる
    if (window.MOBBR?.ui?.team?.render) window.MOBBR.ui.team.render();
  }

  function renamePrompt(key, label, defVal){
    const cur = getStr(key, defVal);
    const v = prompt(`${label}を変更`, cur);
    if (v === null) return;
    const nv = v.trim();
    if (nv === '') return;

    setStr(key, nv);
    render();
    notifyTeamNameSync();
  }

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

        // ここでもNEXTは出さない
        if (ui.btnWeekNext) ui.btnWeekNext.classList.remove('show');
      };
    }
  }

  function showTeamScreen(){
    if (!ui.teamScreen) return;
    ui.teamScreen.classList.add('show');
    ui.teamScreen.setAttribute('aria-hidden', 'false');
    if (window.MOBBR?.ui?.team?.render) window.MOBBR.ui.team.render();
  }
  function hideTeamScreen(){
    if (!ui.teamScreen) return;
    ui.teamScreen.classList.remove('show');
    ui.teamScreen.setAttribute('aria-hidden', 'true');
  }

  function setRecent(text){
    setStr(K.recent, text);
    render();
  }

  // ループスクロール廃止：何もしない（通常の上下スクロールだけ）
  function setupLoopScroll(){
    // 以前の clone / scroll巻き戻しを完全撤去
    // CSS側で overflow-y: auto; になっていれば普通に上下スクロールできる
    return;
  }

  let bound = false;
  function bind(){
    if (bound) return;
    bound = true;

    if (ui.modalBack){
      ui.modalBack.addEventListener('click', (e) => e.preventDefault(), { passive:false });
    }

    if (ui.tapCompany){
      ui.tapCompany.addEventListener('click', () => renamePrompt(K.company, '企業名', 'CB Memory'));
    }
    if (ui.tapTeamName){
      ui.tapTeamName.addEventListener('click', () => renamePrompt(K.team, 'チーム名', 'PLAYER TEAM'));
    }

    if (ui.btnMembers){
      ui.btnMembers.addEventListener('click', () => { render(); showMembersPop(); });
    }
    if (ui.btnCloseMembers){
      ui.btnCloseMembers.addEventListener('click', hideMembersPop);
    }

    if (ui.rowM1) ui.rowM1.addEventListener('click', () => renamePrompt(K.m1, 'メンバー名（1人目）', '○○○'));
    if (ui.rowM2) ui.rowM2.addEventListener('click', () => renamePrompt(K.m2, 'メンバー名（2人目）', '○○○'));
    if (ui.rowM3) ui.rowM3.addEventListener('click', () => renamePrompt(K.m3, 'メンバー名（3人目）', '○○○'));

    // rogタップでNEXT表示 → 廃止（何も付けない）
    // if (ui.rogWrap) ...

    // btnWeekNext はここでは使わないので、クリックも無効化（誤爆防止）
    // 週進行は必要なら別UIで決める。今は weekPop の NEXT( btnPopNext )のみ。
    if (ui.btnWeekNext){
      ui.btnWeekNext.onclick = null;
      ui.btnWeekNext.classList.remove('show');
    }

    if (ui.btnTeam) ui.btnTeam.addEventListener('click', () => { render(); showTeamScreen(); });
    if (ui.btnBattle) ui.btnBattle.addEventListener('click', () => setRecent('大会：未実装（次フェーズ）'));
    if (ui.btnTraining) ui.btnTraining.addEventListener('click', () => setRecent('育成：未実装（次フェーズ）'));
    if (ui.btnShop) ui.btnShop.addEventListener('click', () => setRecent('ショップ：未実装（次フェーズ）'));
    if (ui.btnSchedule) ui.btnSchedule.addEventListener('click', () => setRecent('スケジュール：未実装（次フェーズ）'));
    if (ui.btnCard) ui.btnCard.addEventListener('click', () => setRecent('カードコレクション：未実装（次フェーズ）'));

    if (ui.btnCloseTeam) ui.btnCloseTeam.addEventListener('click', hideTeamScreen);

    setupLoopScroll();
  }

  function initMainUI(){
    collectDom();
    bind();
    render();
  }

  window.MOBBR.initMainUI = initMainUI;

  // 動的ロードでも確実に起動
  initMainUI();
})();
