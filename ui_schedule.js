'use strict';

/*
  MOB BR - ui_schedule.js v1（フル）

  役割：
  - 年間スケジュール画面の制御
  - 次の大会を赤文字で強調表示
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){
  const $ = (id) => document.getElementById(id);

  const S = window.MOBBR?.storage;
  if (!S || !S.KEYS){
    console.warn('[ui_schedule] storage.js not found');
    return;
  }

  const K = S.KEYS;

  /* =========================
     DOM
  ========================= */
  const dom = {
    screen: $('scheduleScreen'),
    close: $('btnCloseSchedule'),
    list: $('scheduleList')
  };

  /* =========================
     年間スケジュール定義（確定）
  ========================= */
  const SCHEDULE = [
    { split:'スプリット1', y:null, m:2, w:1, name:'ローカル大会' },
    { split:'スプリット1', y:null, m:3, w:1, name:'ナショナル大会' },
    { split:'スプリット1', y:null, m:3, w:2, name:'ナショナル大会後半' },
    { split:'スプリット1', y:null, m:3, w:3, name:'ナショナルラストチャンス' },
    { split:'スプリット1', y:null, m:4, w:1, name:'ワールドファイナル' },

    { split:'スプリット2', y:null, m:7, w:1, name:'ローカル大会' },
    { split:'スプリット2', y:null, m:8, w:1, name:'ナショナル大会' },
    { split:'スプリット2', y:null, m:8, w:2, name:'ナショナル大会後半' },
    { split:'スプリット2', y:null, m:8, w:3, name:'ナショナルラストチャンス' },
    { split:'スプリット2', y:null, m:9, w:1, name:'ワールドファイナル' },

    { split:'チャンピオンシップリーグ', y:null, m:11, w:1, name:'ローカル大会' },
    { split:'チャンピオンシップリーグ', y:null, m:12, w:1, name:'ナショナル大会' },
    { split:'チャンピオンシップリーグ', y:null, m:12, w:2, name:'ナショナル大会後半' },
    { split:'チャンピオンシップリーグ', y:null, m:12, w:3, name:'ナショナルラストチャンス' },
    { split:'チャンピオンシップリーグ', y:null, m:1,  w:2, name:'チャンピオンシップ ワールドファイナル' }
  ];

  /* =========================
     現在日時
  ========================= */
  function getNow(){
    return {
      y: S.getNum(K.year, 1989),
      m: S.getNum(K.month, 1),
      w: S.getNum(K.week, 1)
    };
  }

  function isNextTournament(item, now){
    if (item.m < now.m) return false;
    if (item.m === now.m && item.w < now.w) return false;
    return true;
  }

  /* =========================
     render
  ========================= */
  function render(){
    if (!dom.list) return;

    dom.list.innerHTML = '';

    const now = getNow();
    let currentSplit = '';
    let nextFound = false;

    SCHEDULE.forEach(item=>{
      if (item.split !== currentSplit){
        const h = document.createElement('div');
        h.textContent = `【${item.split}】`;
        h.style.fontWeight = '1000';
        h.style.margin = '12px 0 6px';
        dom.list.appendChild(h);
        currentSplit = item.split;
      }

      const row = document.createElement('div');
      row.style.display = 'flex';
      row.style.justifyContent = 'space-between';
      row.style.padding = '6px 4px';
      row.style.borderBottom = '1px solid rgba(255,255,255,.12)';
      row.style.fontSize = '14px';

      const left = document.createElement('div');
      left.textContent = `${item.m}月 第${item.w}週`;

      const right = document.createElement('div');
      right.textContent = item.name;

      // 次の大会を赤強調（最初の1件だけ）
      if (!nextFound && isNextTournament(item, now)){
        row.style.color = '#ff3b30';
        row.style.fontWeight = '1000';
        nextFound = true;
      }

      row.appendChild(left);
      row.appendChild(right);
      dom.list.appendChild(row);
    });
  }

  /* =========================
     open / close
  ========================= */
  function open(){
    if (!dom.screen) return;
    render();
    dom.screen.classList.add('show');
    dom.screen.setAttribute('aria-hidden', 'false');
  }

  function close(){
    if (!dom.screen) return;
    dom.screen.classList.remove('show');
    dom.screen.setAttribute('aria-hidden', 'true');
  }

  /* =========================
     bind
  ========================= */
  function bind(){
    if (dom.close){
      dom.close.addEventListener('click', close);
    }
  }

  function init(){
    bind();
  }

  // expose
  window.MOBBR.ui.schedule = { open, close };

  document.addEventListener('DOMContentLoaded', init);
})();
