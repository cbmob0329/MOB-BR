'use strict';

/*
  ui_main.js (v13)
  app.js の loadScript() で「NEXT後に読み込まれる」前提。
  → DOMContentLoaded に依存せず、initMainUI() を公開して即実行できる形にする。
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

  // ---- DOM refs (毎回取り直してもいいが、安定のため init でまとめる) ----
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

    if (ui.uiM1) ui.uiM1.textContent = m1;
    if (ui.uiM2) ui.uiM2.textContent = m2;
    if (ui.uiM3) ui.uiM3.textContent = m3;

    if (ui.tCompany) ui.tCompany.textContent = company;
    if (ui.tTeam) ui.tTeam.textContent = team;
    if (ui.tM1) ui.tM1.textContent = m1;
    if (ui.tM2) ui.tM2.textContent = m2;
    if (ui.tM3) ui.tM3.textContent = m3;
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

  function renamePrompt(key, label, defVal){
    const cur = getStr(key, defVal);
    const v = prompt(`${label}を変更`, cur);
    if (v === null) return;
    const nv = v.trim();
    if (nv === '') return;
    setStr(key, nv);
    render();
  }

  let nextHideTimer = null;
  function showNextTemporarily(ms=3000){
    if (!ui.btnWeekNext) return;
    ui.btnWeekNext.classList.add('show');
    if (nextHideTimer) clearTimeout(nextHideTimer);
    nextHideTimer = setTimeout(() => {
      if (ui.btnWeekNext) ui.btnWeekNext.classList.remove('show');
    }, ms);
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

        if (ui.btnWeekNext) ui.btnWeekNext.classList.remove('show');
      };
    }
  }

  function showTeamScreen(){
    if (!ui.teamScreen) return;
    ui.teamScreen.classList.add('show');
    ui.teamScreen.setAttribute('aria-hidden', 'false');

    // ui_team 側が居れば中身更新
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

  // infinite loop scroll（あなたの現仕様のまま）
  function setupLoopScroll(){
    if (!ui.loopScroll || !ui.loopInner) return;

    const scroller = ui.loopScroll;
    const inner = ui.loopInner;

    const originalButtons = Array.from(inner.querySelectorAll('button.imgBtn'));
    if (!originalButtons.length) return;

    // 既にクローン作成済みなら二重にしない
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
      oneSetHeight = 0;
      for (const b of originalButtons){
        oneSetHeight += b.getBoundingClientRect().height;
      }
      const gap = 14;
      oneSetHeight += gap * (originalButtons.length - 1);
    };

    requestAnimationFrame(() => {
      calcHeights();
      scroller.scrollTop = 1;
    });

    window.addEventListener('resize', () => calcHeights());

    scroller.addEventListener('scroll', () => {
      if (oneSetHeight <= 0) return;
      if (scroller.scrollTop >= oneSetHeight) scroller.scrollTop -= oneSetHeight;
      if (scroller.scrollTop <= 0) scroller.scrollTop += oneSetHeight;
    }, { passive: true });
  }

  // ---- bind (二重バインド防止) ----
  let bound = false;
  function bind(){
    if (bound) return;
    bound = true;

    // modalBack は「閉じない」仕様のまま。ただし表示を残すと操作不能になるので「隠す」のはUI側で確実にやる。
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

    if (ui.rogWrap){
      ui.rogWrap.addEventListener('click', () => showNextTemporarily(3200));
    }
    if (ui.btnWeekNext){
      ui.btnWeekNext.addEventListener('click', advanceWeek);
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

  // ---- public init ----
  function initMainUI(){
    collectDom();
    bind();
    render();
  }

  window.MOBBR.initMainUI = initMainUI;

  // 「動的ロード」でも確実に起動
  initMainUI();
})();
