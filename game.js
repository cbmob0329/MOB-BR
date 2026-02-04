/* game.js (FULL)
   MOB BR
   VERSION: v1
   目的:
   - 起動 → メイン画面初期化
   - 修行バー（ダミー）生成
   - 週進行（ポップ表示）
   - 「大会へ」→ 紙芝居（map→ido→battle→winner）最小導線
   ※ 仕様確定前なので“最小で必ず動く”ことだけを保証
*/

(() => {
  'use strict';

  /* =========================
     ユーティリティ
  ========================= */
  const $ = (sel) => document.querySelector(sel);
  const $$ = (sel) => Array.from(document.querySelectorAll(sel));
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));

  /* =========================
     DOM 参照
  ========================= */
  const dom = {
    // top
    companyName: $('#companyName'),
    teamName: $('#teamName'),
    weekText: $('#weekText'),
    rankText: $('#rankText'),
    nextTournamentText: $('#nextTournamentText'),
    nextTournamentDateText: $('#nextTournamentDateText'),

    // main
    logo: $('#logo'),
    mainSquareImg: $('#mainSquareImg'),
    playerTeamImg: $('#playerTeamImg'),

    // buttons
    btnAdvanceWeek: $('#btnAdvanceWeek'),
    btnGoMatch: $('#btnGoMatch'),

    // training
    trainingScroller: $('#trainingScroller'),

    // log
    logBody: $('#logBody'),

    // overlay
    overlayRoot: $('#overlayRoot'),
    weekPopup: $('#weekPopup'),
    weekPopupTitle: $('#weekPopupTitle'),
    weekPopupText: $('#weekPopupText'),
    btnWeekPopupNext: $('#btnWeekPopupNext'),

    // story
    storyScreen: $('#storyScreen'),
    storyImg: $('#storyImg'),
    storyTeamImg: $('#storyTeamImg'),
  };

  /* =========================
     状態（最小）
  ========================= */
  const state = {
    year: 1989,
    month: 1,
    week: 1,
    companyRank: '--',
    nextTournament: 'ローカル大会',
    nextTournamentDate: '1989/01',

    storyIndex: 0,
    storySeq: ['map', 'ido', 'battle', 'winner'],
  };

  /* =========================
     初期アセット設定（存在しなくても落ちない）
  ========================= */
  const IMG = {
    bgMain: './img/haikeimain.png',
    logo: './img/rogo.png',
    main: './img/main1.png',
    team: './img/P1.png',
    story: {
      map: './img/map.png',
      ido: './img/ido.png',
      battle: './img/battle.png',
      winner: './img/winner.png',
    }
  };

  function safeImg(el, src){
    if (!el) return;
    el.onerror = () => { /* フォールバックはCSS背景に任せる */ };
    el.src = src;
  }

  /* =========================
     表示更新
  ========================= */
  function updateTop(){
    dom.weekText.textContent = `${state.year}年${state.month}月 第${state.week}週`;
    dom.rankText.textContent = `企業ランク ${state.companyRank}`;
    dom.nextTournamentText.textContent = `次の大会：${state.nextTournament}`;
    dom.nextTournamentDateText.textContent = `日程：${state.nextTournamentDate}`;
  }

  function log(text, muted=false){
    const p = document.createElement('div');
    p.className = 'logLine' + (muted ? ' muted' : '');
    p.textContent = text;
    dom.logBody.appendChild(p);
    dom.logBody.scrollTop = dom.logBody.scrollHeight;
  }

  /* =========================
     修行バー（ダミー）
  ========================= */
  const TRAINING_ITEMS = [
    { id:'shoot', label:'射撃' },
    { id:'run',   label:'走力' },
    { id:'aim',   label:'索敵' },
    { id:'team',  label:'連携' },
    { id:'rest',  label:'休養' },
  ];

  function buildTraining(){
    dom.trainingScroller.innerHTML = '';
    TRAINING_ITEMS.forEach(it => {
      const d = document.createElement('div');
      d.className = 'trainingItem';
      d.dataset.id = it.id;
      d.innerHTML = `<div class="label">${it.label}</div>`;
      d.addEventListener('click', () => {
        log(`修行：${it.label} を実行（仮）`);
      });
      dom.trainingScroller.appendChild(d);
    });
    requestAnimationFrame(updateTrainingCenter);
  }

  function updateTrainingCenter(){
    const items = $$('.trainingItem');
    const rect = dom.trainingScroller.getBoundingClientRect();
    const cx = rect.left + rect.width / 2;
    items.forEach(it => {
      const r = it.getBoundingClientRect();
      const ix = r.left + r.width / 2;
      const dist = Math.abs(ix - cx);
      it.classList.toggle('isCenter', dist < r.width * 0.35);
    });
    requestAnimationFrame(updateTrainingCenter);
  }

  /* =========================
     週進行
  ========================= */
  function advanceWeek(){
    state.week++;
    if (state.week > 4){
      state.week = 1;
      state.month++;
    }
    dom.weekPopupTitle.textContent = `${state.year}年${state.month}月 第${state.week}週`;
    dom.weekPopupText.textContent = `企業ランクにより 0G 獲得！（仮）`;
    dom.overlayRoot.classList.add('isOpen','isWeekPopupOpen');
  }

  dom.btnWeekPopupNext.addEventListener('click', () => {
    dom.overlayRoot.classList.remove('isWeekPopupOpen','isOpen');
    updateTop();
    log('1週が経過した。', true);
  });

  /* =========================
     紙芝居（最小）
  ========================= */
  function startStory(){
    state.storyIndex = 0;
    dom.overlayRoot.classList.add('isOpen','isStoryOpen');
    nextStory();
  }

  function nextStory(){
    const key = state.storySeq[state.storyIndex];
    if (!key){
      dom.overlayRoot.classList.remove('isStoryOpen','isOpen');
      log('大会が終了した。（仮）');
      return;
    }
    safeImg(dom.storyImg, IMG.story[key]);
    safeImg(dom.storyTeamImg, IMG.team);
    log(`シーン：${key}`, true);
    state.storyIndex++;
    // AUTO 代替：1.2秒で次
    setTimeout(nextStory, 1200);
  }

  /* =========================
     イベント配線
  ========================= */
  dom.btnAdvanceWeek.addEventListener('click', advanceWeek);
  dom.btnGoMatch.addEventListener('click', startStory);

  /* =========================
     初期化
  ========================= */
  function init(){
    safeImg(dom.logo, IMG.logo);
    safeImg(dom.mainSquareImg, IMG.main);
    safeImg(dom.playerTeamImg, IMG.team);
    updateTop();
    buildTraining();
    log('準備完了。');
  }

  document.addEventListener('DOMContentLoaded', init);
})();
