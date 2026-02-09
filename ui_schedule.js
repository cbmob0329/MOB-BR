'use strict';

/*
  MOB BR - ui_schedule.js v2（フル）
  - 年間スケジュール画面
  - 次の大会を赤文字で強調
  - ★追加：次の大会（nextTour / nextTourW）を storage に set する
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

  const dom = {
    screen: $('scheduleScreen'),
    close: $('btnCloseSchedule'),
    list: $('scheduleList')
  };

  const SCHEDULE = [
    { split:'スプリット1', m:2, w:1, name:'ローカル大会' },
    { split:'スプリット1', m:3, w:1, name:'ナショナル大会' },
    { split:'スプリット1', m:3, w:2, name:'ナショナル大会後半' },
    { split:'スプリット1', m:3, w:3, name:'ナショナルラストチャンス' },
    { split:'スプリット1', m:4, w:1, name:'ワールドファイナル' },

    { split:'スプリット2', m:7, w:1, name:'ローカル大会' },
    { split:'スプリット2', m:8, w:1, name:'ナショナル大会' },
    { split:'スプリット2', m:8, w:2, name:'ナショナル大会後半' },
    { split:'スプリット2', m:8, w:3, name:'ナショナルラストチャンス' },
    { split:'スプリット2', m:9, w:1, name:'ワールドファイナル' },

    { split:'チャンピオンシップリーグ', m:11, w:1, name:'ローカル大会' },
    { split:'チャンピオンシップリーグ', m:12, w:1, name:'ナショナル大会' },
    { split:'チャンピオンシップリーグ', m:12, w:2, name:'ナショナル大会後半' },
    { split:'チャンピオンシップリーグ', m:12, w:3, name:'ナショナルラストチャンス' },
    { split:'チャンピオンシップリーグ', m:1,  w:2, name:'チャンピオンシップ ワールドファイナル' }
  ];

  function getNow(){
    return {
      m: S.getNum(K.month, 1),
      w: S.getNum(K.week, 1)
    };
  }

  // 「今の週以降で最初の1件」を次の大会として赤くする
  function isFutureOrNow(item, now){
    if (item.m < now.m) return false;
    if (item.m === now.m && item.w < now.w) return false;
    return true;
  }

  // ★次の大会を storage に保存
  function setNextTournamentToStorage(item){
    if (!item) return;

    // nextTour：大会名
    try{ S.setStr(K.nextTour, String(item.name || '未定')); }catch(e){}

    // nextTourW： "m-w" 形式（例: "2-1"）
    const mw = `${Number(item.m || 0)}-${Number(item.w || 0)}`;
    try{ S.setStr(K.nextTourW, mw); }catch(e){}
  }

  // ★「今が大会週かどうか」を判定するため、今週が大会ならそれを next にする
  //    （＝isFutureOrNow の仕様上、今週が大会なら最初に選ばれる）
  function render(){
    if (!dom.list) return;

    dom.list.innerHTML = '';

    const now = getNow();
    let currentSplit = '';
    let nextFound = false;
    let nextItem = null;

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
      row.style.alignItems = 'baseline';
      row.style.gap = '10px';
      row.style.padding = '6px 4px';
      row.style.borderBottom = '1px solid rgba(255,255,255,.12)';
      row.style.fontSize = '14px';

      const left = document.createElement('div');
      left.textContent = `${item.m}月 第${item.w}週`;

      const right = document.createElement('div');
      right.textContent = item.name;

      // 次の大会（今週含む）を赤く＆1件だけ確定
      if (!nextFound && isFutureOrNow(item, now)){
        row.style.color = '#ff3b30';
        row.style.fontWeight = '1000';
        nextFound = true;
        nextItem = item;
      }

      row.appendChild(left);
      row.appendChild(right);
      dom.list.appendChild(row);
    });

    // ★レンダーの最後に nextTour / nextTourW を確定で保存
    //   （次が無い場合は未定にする）
    if (nextItem){
      setNextTournamentToStorage(nextItem);
    }else{
      try{ S.setStr(K.nextTour, '未定'); }catch(e){}
      try{ S.setStr(K.nextTourW, '未定'); }catch(e){}
    }
  }

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

  let bound = false;
  function bind(){
    if (bound) return;
    bound = true;

    if (dom.close){
      dom.close.addEventListener('click', close);
    }
  }

  function initScheduleUI(){
    bind();
  }

  window.MOBBR.initScheduleUI = initScheduleUI;
  window.MOBBR.ui.schedule = { open, close, render };

  document.addEventListener('DOMContentLoaded', initScheduleUI);
})();
