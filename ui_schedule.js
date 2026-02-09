'use strict';

/*
  MOB BR - ui_schedule.js v2（フル）
  - 年間スケジュール画面
  - 「次の大会」を nextTour / nextTourW に保存（storageキー）
  - “出場権がない大会” は nextTour に採用しない（誤ロック防止の土台）

  重要：
  - ui_training.js の「大会週ロック」は、固定スケジュール表ではなく
    nextTour/nextTourW を参照する形にすると、誤ロックが消える。

  出場判定のための状態（任意・あれば使う）：
  - localStorage 'mobbr_tour_state' (JSON)
    例：
    {
      "split": 1,                 // 1 / 2 / 3(チャンピオンシップリーグ)
      "stage": "local",           // "local"|"national"|"lastchance"|"world"|"done"
      "qualifiedNational": false, // ナショナル出場権
      "qualifiedWorld": false,    // ワールド出場権
      "clearedNational": false    // ナショナル通過（lastchance不要）
    }

  ※このキーが無い場合は「最低限の安全運用」：
    - localは出場対象（次大会候補にする）
    - national/world/lastchance は出場権が無いと判断し、候補にしない
      （＝“出場権が無いのにロック”を起こさない方向に倒す）
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

  // ===== スケジュール定義 =====
  // month/week は “カレンダー上の開催週”
  // split は表示用（ロジックにも使う）
  const SCHEDULE = [
    // Split 1
    { split:'スプリット1', m:2,  w:1, name:'ローカル大会',           phase:'local' },
    { split:'スプリット1', m:3,  w:1, name:'ナショナル大会',         phase:'national' },
    { split:'スプリット1', m:3,  w:2, name:'ナショナル大会後半',     phase:'national' },
    { split:'スプリット1', m:3,  w:3, name:'ナショナルラストチャンス', phase:'lastchance' },
    { split:'スプリット1', m:4,  w:1, name:'ワールドファイナル',     phase:'world' },

    // Split 2
    { split:'スプリット2', m:7,  w:1, name:'ローカル大会',           phase:'local' },
    { split:'スプリット2', m:8,  w:1, name:'ナショナル大会',         phase:'national' },
    { split:'スプリット2', m:8,  w:2, name:'ナショナル大会後半',     phase:'national' },
    { split:'スプリット2', m:8,  w:3, name:'ナショナルラストチャンス', phase:'lastchance' },
    { split:'スプリット2', m:9,  w:1, name:'ワールドファイナル',     phase:'world' },

    // Championship League
    { split:'チャンピオンシップリーグ', m:11, w:1, name:'ローカル大会',           phase:'local' },
    { split:'チャンピオンシップリーグ', m:12, w:1, name:'ナショナル大会',         phase:'national' },
    { split:'チャンピオンシップリーグ', m:12, w:2, name:'ナショナル大会後半',     phase:'national' },
    { split:'チャンピオンシップリーグ', m:12, w:3, name:'ナショナルラストチャンス', phase:'lastchance' },
    { split:'チャンピオンシップリーグ', m:1,  w:2, name:'チャンピオンシップ ワールドファイナル', phase:'world' }
  ];

  // ===== 現在日時（ゲーム内） =====
  function getNow(){
    return {
      y: S.getNum(K.year, 1989),
      m: S.getNum(K.month, 1),
      w: S.getNum(K.week, 1)
    };
  }

  // ===== tour state（あれば） =====
  function readTourState(){
    try{
      const raw = localStorage.getItem('mobbr_tour_state');
      if (!raw) return null;
      const obj = JSON.parse(raw);
      if (!obj || typeof obj !== 'object') return null;
      return obj;
    }catch{
      return null;
    }
  }

  // ===== “出場対象か？”判定 =====
  // ここが誤ロック防止の核
  function isEligible(item, tourState){
    // local は常に出場対象（最小保証）
    if (item.phase === 'local') return true;

    // tourState が無い場合は “誤ロックしない” を優先して false
    // （＝出場権の無い大会で修行が止まる事故を防ぐ）
    if (!tourState) return false;

    const qN = !!tourState.qualifiedNational;
    const qW = !!tourState.qualifiedWorld;
    const clearedN = !!tourState.clearedNational;

    if (item.phase === 'national'){
      return qN; // 出場権がある時だけ
    }

    if (item.phase === 'lastchance'){
      // ナショナル通過してたら不要、ワールド出てるなら不要
      if (clearedN) return false;
      if (qW) return false;
      // “ナショナル出場権が無い時だけ”ラストチャンス対象
      return !qN;
    }

    if (item.phase === 'world'){
      return qW;
    }

    return false;
  }

  // ===== “未来 or 現在” 判定（年跨ぎ対応） =====
  // month が今より小さい = 翌年扱いで「未来」とみなす
  function isFutureOrNow(item, now){
    // 同月
    if (item.m === now.m){
      return item.w >= now.w;
    }
    // 今より後ろの月
    if (item.m > now.m) return true;
    // 今より前の月（年跨ぎで未来扱い）
    return true;
  }

  // ===== 候補の中から「次の大会」を決める =====
  // 条件：
  // 1) 今週以降（isFutureOrNow）
  // 2) 出場対象（isEligible）
  // 3) 最も近い日付
  //
  // “最も近い”の比較は、(month,week)を「相対距離」に変換して比較する
  function pickNextEligible(now, tourState){
    let best = null;
    let bestDist = Infinity;

    for (const it of SCHEDULE){
      if (!isFutureOrNow(it, now)) continue;
      if (!isEligible(it, tourState)) continue;

      const dist = calcDistanceWeeks(now, it);
      if (dist < bestDist){
        bestDist = dist;
        best = it;
      }
    }

    return best;
  }

  // ざっくり距離：月差 * 4 + 週差（このゲームは1ヶ月=4週前提）
  // year跨ぎ：monthが小さい場合は +12ヶ月扱い
  function calcDistanceWeeks(now, item){
    let dm = item.m - now.m;
    if (dm < 0) dm += 12; // 年跨ぎ
    const dw = item.w - now.w;
    return (dm * 4) + dw;
  }

  // ===== nextTour / nextTourW を保存 =====
  function setNextTourFromSchedule(){
    const now = getNow();
    const tourState = readTourState();

    const next = pickNextEligible(now, tourState);

    if (!next){
      S.setStr(K.nextTour, '未定');
      S.setStr(K.nextTourW, '未定');
      return null;
    }

    // 例：2-1（2月第1週）
    const ww = `${next.m}-${next.w}`;

    S.setStr(K.nextTour, next.name);
    S.setStr(K.nextTourW, ww);

    return { next, ww };
  }

  // ===== 一覧描画 =====
  // 次の大会（出場対象として選ばれた nextTourW）を赤
  function render(){
    if (!dom.list) return;

    const now = getNow();
    const tourState = readTourState();

    // ここで nextTour / nextTourW を確定させる（表示のたびに最新化）
    const picked = setNextTourFromSchedule();
    const nextW = picked?.ww || S.getStr(K.nextTourW, '未定');
    const nextName = picked?.next?.name || S.getStr(K.nextTour, '未定');

    dom.list.innerHTML = '';

    let currentSplit = '';

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

      // 出場対象じゃない大会は薄く（誤解防止）
      const eligible = isEligible(item, tourState);
      if (!eligible){
        row.style.opacity = '0.45';
      }

      // “次の大会（出場対象として確定したもの）”だけ赤
      const ww = `${item.m}-${item.w}`;
      if (eligible && ww === nextW && item.name === nextName){
        row.style.color = '#ff3b30';
        row.style.fontWeight = '1000';
        row.style.opacity = '1';
      }

      row.appendChild(left);
      row.appendChild(right);
      dom.list.appendChild(row);
    });
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

    // 起動時にも nextTour を更新しておく（メイン画面表示用）
    // ※DOM未準備でも storage 更新だけ走るので安全
    try{ setNextTourFromSchedule(); }catch(e){}
  }

  window.MOBBR.initScheduleUI = initScheduleUI;
  window.MOBBR.ui.schedule = { open, close, render };

  document.addEventListener('DOMContentLoaded', initScheduleUI);
})();
