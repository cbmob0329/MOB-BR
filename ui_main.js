'use strict';

/*
  MOB BR - ui_main.js v18（フル）
  目的：
  - メイン画面の表示/タップ処理
  - TEAM/TRAINING/SHOP/CARD/SCHEDULE のルーティングを「各UIの open() 優先」に統一
  - modalBack（透明フタ）が残ってボタンが押せなくなる事故を徹底排除
  - メンバー名変更は「全画面に反映」：localStorage + mobbr_playerTeam のmembers名も同期

  v18 変更点（今回）：
  - BATTLE（大会）ボタンで、tournamentFlow.startLocalTournament() を呼ぶ
    （大会UIが存在すればそちらで進行。無ければログのみ）

  v17 変更点：
  - schedule ルート追加（ui_schedule.js が open を持てばそれを優先）
*/

window.MOBBR = window.MOBBR || {};

(function(){
  const VERSION = 'v18';

  // ===== Storage Keys（storage.js / ui_team.js と揃える）=====
  const K = {
    company: 'mobbr_company',
    team: 'mobbr_team',
    m1: 'mobbr_m1',
    m2: 'mobbr_m2',
    m3: 'mobbr_m3',
    gold: 'mobbr_gold',
    rank: 'mobbr_rank',

    year: 'mobbr_year',
    month: 'mobbr_month',
    week: 'mobbr_week',

    nextTour: 'mobbr_nextTour',
    nextTourW: 'mobbr_nextTourW',
    recent: 'mobbr_recent',

    playerTeam: 'mobbr_playerTeam'
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

  // ===== DOM cache =====
  let ui = null;

  function collectDom(){
    ui = {
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

      // week pop（無い場合もある）
      weekPop: $('weekPop'),
      popTitle: $('popTitle'),
      popSub: $('popSub'),
      btnPopNext: $('btnPopNext'),

      // NEXT（この画面では使わない＝常に隠す）
      btnWeekNext: $('btnWeekNext'),

      // left menu
      btnTeam: $('btnTeam'),
      btnBattle: $('btnBattle'),
      btnTraining: $('btnTraining'),
      btnShop: $('btnShop'),
      btnSchedule: $('btnSchedule'),
      btnCard: $('btnCard'),

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

      // screens (DOM直開き保険)
      teamScreen: $('teamScreen'),
      btnCloseTeam: $('btnCloseTeam'),

      trainingScreen: $('trainingScreen'),
      btnCloseTraining: $('btnCloseTraining'),

      shopScreen: $('shopScreen'),
      btnCloseShop: $('btnCloseShop'),

      cardScreen: $('cardScreen'),
      btnCloseCard: $('btnCloseCard'),

      scheduleScreen: $('scheduleScreen'),
      btnCloseSchedule: $('btnCloseSchedule')
    };
  }

  // ===== 全画面の名前同期（mobbr_playerTeam を更新）=====
  function syncPlayerTeamNamesFromStorage(){
    try{
      const raw = localStorage.getItem(K.playerTeam);
      if (!raw) return;

      const team = JSON.parse(raw);
      if (!team || !Array.isArray(team.members)) return;

      const nm1 = getStr(K.m1, 'A');
      const nm2 = getStr(K.m2, 'B');
      const nm3 = getStr(K.m3, 'C');

      const bySlot = [...team.members].sort((a,b)=> (a.slot||0)-(b.slot||0));
      if (bySlot[0]) bySlot[0].name = nm1;
      if (bySlot[1]) bySlot[1].name = nm2;
      if (bySlot[2]) bySlot[2].name = nm3;

      localStorage.setItem(K.playerTeam, JSON.stringify(team));
    }catch(e){}
  }

  function notifyTeamRender(){
    if (window.MOBBR?.ui?.team?.render) window.MOBBR.ui.team.render();
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

    if (ui.y) ui.y.textContent = String(getNum(K.year, 1989));
    if (ui.m) ui.m.textContent = String(getNum(K.month, 1));
    if (ui.w) ui.w.textContent = String(getNum(K.week, 1));

    if (ui.nextTour) ui.nextTour.textContent = getStr(K.nextTour, '未定');
    if (ui.nextTourW) ui.nextTourW.textContent = getStr(K.nextTourW, '未定');
    if (ui.recent) ui.recent.textContent = getStr(K.recent, '未定');

    // member popup values
    if (ui.uiM1) ui.uiM1.textContent = m1;
    if (ui.uiM2) ui.uiM2.textContent = m2;
    if (ui.uiM3) ui.uiM3.textContent = m3;

    // NEXTボタンはここでは使わない（常に隠す）
    if (ui.btnWeekNext) ui.btnWeekNext.classList.remove('show');
  }

  // ===== modal back helper（pointer-events まで制御）=====
  function showBack(){
    if (!ui.modalBack) return;
    ui.modalBack.style.display = 'block';
    ui.modalBack.style.pointerEvents = 'auto';
    ui.modalBack.setAttribute('aria-hidden', 'false');
  }
  function hideBack(){
    if (!ui.modalBack) return;
    ui.modalBack.style.display = 'none';
    ui.modalBack.style.pointerEvents = 'none';
    ui.modalBack.setAttribute('aria-hidden', 'true');
  }

  // ===== week popup =====
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

  // ===== member popup =====
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

    // メンバー名は playerTeam にも同期して「全画面反映」
    if (key === K.m1 || key === K.m2 || key === K.m3){
      syncPlayerTeamNamesFromStorage();
    }

    render();
    notifyTeamRender();
  }

  // ===== week progression（必要なら呼ぶ）=====
  function advanceWeek(){
    const y = getNum(K.year, 1989);
    const m = getNum(K.month, 1);
    const w = getNum(K.week, 1);

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
        setNum(K.year, ny);
        setNum(K.month, nm);
        setNum(K.week, nw);

        const gold = getNum(K.gold, 0);
        setNum(K.gold, gold + gain);

        setStr(K.recent, `週が進んだ（+${gain}G）`);

        hideWeekPop();
        render();

        if (ui.btnWeekNext) ui.btnWeekNext.classList.remove('show');
      };
    }
  }

  // ===== screen open/close helpers =====
  function openScreenEl(el, name){
    if (!el){
      console.warn(`[ui_main ${VERSION}] ${name} DOM not found`);
      return false;
    }
    el.classList.add('show');
    el.setAttribute('aria-hidden', 'false');
    return true;
  }
  function closeScreenEl(el){
    if (!el) return;
    el.classList.remove('show');
    el.setAttribute('aria-hidden', 'true');
  }

  // ===== safe open（open()優先→DOM直開き）=====
  function safeOpenByUI(key){
    // 透明フタ事故防止：何か開く前に必ず閉じる
    hideBack();

    const u = window.MOBBR?.ui || null;

    if (key === 'team'){
      if (u?.team?.open){ u.team.open(); return true; }
      return openScreenEl(ui.teamScreen, 'teamScreen');
    }

    if (key === 'training'){
      if (u?.training?.open){ u.training.open(); return true; }
      return openScreenEl(ui.trainingScreen, 'trainingScreen');
    }

    if (key === 'shop'){
      if (u?.shop?.open){ u.shop.open(); return true; }
      return openScreenEl(ui.shopScreen, 'shopScreen');
    }

    if (key === 'card'){
      if (u?.card?.open){ u.card.open(); return true; }
      return openScreenEl(ui.cardScreen, 'cardScreen');
    }

    if (key === 'schedule'){
      if (u?.schedule?.open){ u.schedule.open(); return true; }
      return openScreenEl(ui.scheduleScreen, 'scheduleScreen');
    }

    console.warn(`[ui_main ${VERSION}] unknown route: ${key}`);
    return false;
  }

  function setRecent(text){
    setStr(K.recent, text);
    render();
  }

  // ===== bind =====
  let bound = false;
  function bind(){
    if (bound) return;
    bound = true;

    // modalBack：押して閉じない
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

    if (ui.rowM1) ui.rowM1.addEventListener('click', () => renamePrompt(K.m1, 'メンバー名（1人目）', 'A'));
    if (ui.rowM2) ui.rowM2.addEventListener('click', () => renamePrompt(K.m2, 'メンバー名（2人目）', 'B'));
    if (ui.rowM3) ui.rowM3.addEventListener('click', () => renamePrompt(K.m3, 'メンバー名（3人目）', 'C'));

    // btnWeekNext はこの画面では使わない（誤爆防止）
    if (ui.btnWeekNext){
      ui.btnWeekNext.onclick = null;
      ui.btnWeekNext.classList.remove('show');
    }

    // ===== 左メニュー =====
    if (ui.btnTeam) ui.btnTeam.addEventListener('click', () => {
      render();
      if (!safeOpenByUI('team')) setRecent('TEAM：画面DOMが見つかりません（index.htmlを確認）');
      else notifyTeamRender();
    });

    if (ui.btnTraining) ui.btnTraining.addEventListener('click', () => {
      render();
      if (!safeOpenByUI('training')) setRecent('育成：画面DOMが見つかりません（index.htmlを確認）');
    });

    if (ui.btnShop) ui.btnShop.addEventListener('click', () => {
      render();
      if (!safeOpenByUI('shop')) setRecent('ショップ：画面DOMが見つかりません（index.htmlを確認）');
    });

    if (ui.btnCard) ui.btnCard.addEventListener('click', () => {
      render();
      if (!safeOpenByUI('card')) setRecent('カード：画面DOMが見つかりません（index.htmlを確認）');
    });

    if (ui.btnSchedule) ui.btnSchedule.addEventListener('click', () => {
      render();
      if (!safeOpenByUI('schedule')) setRecent('スケジュール：画面DOMが見つかりません（index.html / ui_schedule.js を確認）');
    });

    // ★★★ BATTLE（大会）実装：Flow を呼ぶ ★★★
    if (ui.btnBattle) ui.btnBattle.addEventListener('click', () => {
      hideBack();
      render();

      const Flow = window.MOBBR?.sim?.tournamentFlow;
      if (Flow && typeof Flow.startLocalTournament === 'function'){
        setRecent('大会：ローカル大会を開始！');
        try{
          Flow.startLocalTournament();
        }catch(err){
          console.error(err);
          setRecent('大会：開始に失敗（コンソール確認）');
        }
        return;
      }

      // Flowが無い場合（読み込み漏れ）
      setRecent('大会：未実装（sim_tournament_flow.js の読み込みを確認）');
    });

    // ===== DOM直開き保険の閉じる =====
    if (ui.btnCloseTeam && ui.teamScreen){
      ui.btnCloseTeam.addEventListener('click', () => closeScreenEl(ui.teamScreen));
    }
    if (ui.btnCloseTraining && ui.trainingScreen){
      ui.btnCloseTraining.addEventListener('click', () => closeScreenEl(ui.trainingScreen));
    }
    if (ui.btnCloseShop && ui.shopScreen){
      ui.btnCloseShop.addEventListener('click', () => closeScreenEl(ui.shopScreen));
    }
    if (ui.btnCloseCard && ui.cardScreen){
      ui.btnCloseCard.addEventListener('click', () => closeScreenEl(ui.cardScreen));
    }
    if (ui.btnCloseSchedule && ui.scheduleScreen){
      ui.btnCloseSchedule.addEventListener('click', () => closeScreenEl(ui.scheduleScreen));
    }
  }

  function initMainUI(){
    collectDom();
    bind();

    // 起動時点で playerTeam があるなら、storageの名前に寄せる
    syncPlayerTeamNamesFromStorage();

    // 透明フタ事故の保険
    hideBack();

    render();
  }

  // expose
  window.MOBBR.initMainUI = initMainUI;

  // 動的ロードでも確実に起動
  initMainUI();
})();
