'use strict';

/*
  MOB BR - ui_schedule.js v15（フル）

  役割：
  - スケジュール画面の制御
  - 年間スケジュールを表示
  - 現在の「月/週」から “次の大会” を自動判定して赤で強調

  方針：
  - DOMが無くても落とさない（未実装でもrecentに書くだけで復帰）
  - storage.js があれば優先、無ければ localStorage 直読み

  期待DOM（次のindex.htmlで追加予定）：
  - btnSchedule（既にある）
  - scheduleScreen
  - btnCloseSchedule
  - scheduleList（一覧描画先）
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){
  const $ = (id) => document.getElementById(id);

  const S = window.MOBBR?.storage || null;
  const KEYS = S?.KEYS || {
    year: 'mobbr_year',
    month: 'mobbr_month',
    week: 'mobbr_week',
    recent: 'mobbr_recent'
  };

  // ===== schedule master（確定：演出用テキスト）=====
  // month: 1..12, week: 1..4
  const SCHEDULE = [
    { section:'【スプリット1】', month:2,  week:1, title:'ローカル大会' },
    { section:'【スプリット1】', month:3,  week:1, title:'ナショナル大会' },
    { section:'【スプリット1】', month:3,  week:2, title:'ナショナル大会後半' },
    { section:'【スプリット1】', month:3,  week:3, title:'ナショナルラストチャンス' },
    { section:'【スプリット1】', month:4,  week:1, title:'ワールドファイナル' },

    { section:'【スプリット2】', month:7,  week:1, title:'ローカル大会' },
    { section:'【スプリット2】', month:8,  week:1, title:'ナショナル大会' },
    { section:'【スプリット2】', month:8,  week:2, title:'ナショナル大会後半' },
    { section:'【スプリット2】', month:8,  week:3, title:'ナショナルラストチャンス' },
    { section:'【スプリット2】', month:9,  week:1, title:'ワールドファイナル' },

    { section:'【チャンピオンシップリーグ】', month:11, week:1, title:'ローカル大会' },
    { section:'【チャンピオンシップリーグ】', month:12, week:1, title:'ナショナル大会' },
    { section:'【チャンピオンシップリーグ】', month:12, week:2, title:'ナショナル大会後半' },
    { section:'【チャンピオンシップリーグ】', month:12, week:3, title:'ナショナルラストチャンス' },
    { section:'【チャンピオンシップリーグ】', month:1,  week:2, title:'チャンピオンシップ ワールドファイナル' }
  ];

  // ===== DOM =====
  const dom = {
    btnSchedule: $('btnSchedule'),

    screen: $('scheduleScreen'),
    btnClose: $('btnCloseSchedule'),
    list: $('scheduleList')
  };

  // ===== storage helpers =====
  function getNum(key, def){
    if (S?.getNum) return S.getNum(key, def);
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) ? v : def;
  }
  function setStr(key, val){
    if (S?.setStr) return S.setStr(key, val);
    localStorage.setItem(key, String(val));
  }

  function getCurrent(){
    return {
      y: getNum(KEYS.year, 1989),
      m: getNum(KEYS.month, 1),
      w: getNum(KEYS.week, 1)
    };
  }

  // ===== next event logic =====
  // “今の週を含む”かどうか：仕様的に「次の大会」は “現在週以降で最も近い” にする
  // 例：今が3月第1週なら、3月第1週のイベントが次に表示される
  function scoreFromNow(curM, curW, evM, evW){
    // 月差（12ヶ月循環）
    let dm = (evM >= curM) ? (evM - curM) : (evM + 12 - curM);

    // 同月で、イベント週が過去なら「来年の同月扱い」にする
    if (dm === 0 && evW < curW){
      dm = 12;
    }

    // 同月なら週差を優先
    const dw = (dm === 0) ? (evW - curW) : 0;

    // 比較用スコア（小さいほど近い）
    return dm * 10 + dw;
  }

  function findNextIndex(){
    const cur = getCurrent();
    let bestIdx = 0;
    let bestScore = Infinity;

    for (let i=0;i<SCHEDULE.length;i++){
      const ev = SCHEDULE[i];
      const sc = scoreFromNow(cur.m, cur.w, ev.month, ev.week);
      if (sc < bestScore){
        bestScore = sc;
        bestIdx = i;
      }
    }
    return bestIdx;
  }

  // ===== render =====
  function clearList(){
    if (dom.list) dom.list.innerHTML = '';
  }

  function render(){
    if (!dom.list) return;

    clearList();

    // 次の大会を決定
    const nextIdx = findNextIndex();

    // セクションごとに描画
    let currentSection = '';
    SCHEDULE.forEach((ev, idx)=>{
      if (ev.section !== currentSection){
        currentSection = ev.section;

        const h = document.createElement('div');
        h.className = 'scheduleSectionTitle';
        h.textContent = currentSection;
        dom.list.appendChild(h);
      }

      const row = document.createElement('div');
      row.className = 'scheduleRow';
      if (idx === nextIdx) row.classList.add('isNext');

      const left = document.createElement('div');
      left.className = 'scheduleWhen';
      left.textContent = `${ev.month}月 第${ev.week}週：`;

      const right = document.createElement('div');
      right.className = 'scheduleWhat';
      right.textContent = ev.title;

      row.appendChild(left);
      row.appendChild(right);
      dom.list.appendChild(row);
    });
  }

  // ===== open / close =====
  function open(){
    // DOM未実装でも落とさない
    if (!dom.screen || !dom.list){
      setStr(KEYS.recent, 'スケジュールを確認した（画面未実装）');
      if (window.MOBBR.initMainUI) window.MOBBR.initMainUI();
      return;
    }

    render();
    dom.screen.classList.add('show');
    dom.screen.setAttribute('aria-hidden', 'false');
  }

  function close(){
    if (!dom.screen) return;
    dom.screen.classList.remove('show');
    dom.screen.setAttribute('aria-hidden', 'true');
  }

  // ===== bind =====
  let bound = false;
  function bind(){
    if (bound) return;
    bound = true;

    // 左メニュー
    if (dom.btnSchedule) dom.btnSchedule.addEventListener('click', open);

    // 閉じる
    if (dom.btnClose) dom.btnClose.addEventListener('click', close);
  }

  function initScheduleUI(){
    bind();
  }

  window.MOBBR.initScheduleUI = initScheduleUI;
  window.MOBBR.ui.schedule = { open, close, render };

  document.addEventListener('DOMContentLoaded', initScheduleUI);
})();
