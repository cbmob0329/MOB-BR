'use strict';

/*
  MOB BR - ui_schedule.js v3（フル）
  - 年間スケジュール画面
  - 「次の大会」を nextTour / nextTourW に保存（storageキー）
  - “出場権がない大会” は nextTour に採用しない（誤ロック防止）

  更新点（あなたの新スケジュールに合わせて完全置換）
  - ✅ 旧「ナショナル大会後半」を撤去（1週開催に統一）
  - ✅ World を 3段階（予選 / WL / 決勝）に分割
  - ✅ SP1 / SP2 / チャンピオンシップ の固定日程に変更
  - ✅ 誤ロック防止：tourState が無い/不足なら local 以外は候補にしない

  出場判定のための状態（任意・あれば使う）：
  - localStorage 'mobbr_tour_state' (JSON)
    例（最低限の想定）：
    {
      "split": 1,                    // 1 / 2
      "stage": "local"|"national"|"lastchance"|"world"|"done",

      "qualifiedNational": false,    // ナショナル出場権（ローカルTOP10でtrue）
      "clearedNational": false,      // ナショナルでワールド確定（TOP8）
      "lastChanceUnlocked": false,   // ラストチャンス出場権（ナショナル9-28など）
      "qualifiedWorld": false,       // ワールド出場権（ナショナルTOP8 or LC成功でtrue）

      "world": { "phase":"qual"|"wl"|"final" },   // 週跨ぎワールドの現在地（任意）
      "qualifiedChampionship": false,             // チャンピオンシップ出場権（SP1+SP2決勝の条件満たし）
      "playerCompanyRank": 0                      // プレイヤー企業ランク（任意：100以上条件用）
    }

  ※このキーが無い/足りない場合は「最低限の安全運用」：
    - local は出場対象（次大会候補にする）
    - national / lastchance / world / championship は “出場権なし” 扱いで候補にしない
      （＝出場権が無いのにロック事故を起こさない）
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
  // splitLabel は表示用
  // phase はロジック用（出場判定）
  const SCHEDULE = [
    // ===== SP1 =====
    { splitLabel:'SP1', m:2,  w:1, name:'SP1 ローカル大会', phase:'local',     meta:{ split:1 } },
    { splitLabel:'SP1', m:3,  w:1, name:'SP1 ナショナル大会', phase:'national', meta:{ split:1 } },
    { splitLabel:'SP1', m:3,  w:2, name:'SP1 ラストチャンス', phase:'lastchance', meta:{ split:1 } },

    { splitLabel:'SP1', m:4,  w:4, name:'SP1 ワールドファイナル 予選リーグ', phase:'world_qual', meta:{ split:1 } },
    { splitLabel:'SP1', m:5,  w:1, name:'SP1 ワールドファイナル WL',         phase:'world_wl',   meta:{ split:1 } },
    { splitLabel:'SP1', m:5,  w:2, name:'SP1 ワールドファイナル 決勝戦',      phase:'world_final', meta:{ split:1 } },

    // ===== SP2 =====
    { splitLabel:'SP2', m:7,  w:1, name:'SP2 ローカル大会', phase:'local',     meta:{ split:2 } },
    { splitLabel:'SP2', m:8,  w:1, name:'SP2 ナショナル大会', phase:'national', meta:{ split:2 } },
    { splitLabel:'SP2', m:8,  w:2, name:'SP2 ラストチャンス', phase:'lastchance', meta:{ split:2 } },

    { splitLabel:'SP2', m:9,  w:4, name:'SP2 ワールドファイナル 予選リーグ', phase:'world_qual', meta:{ split:2 } },
    { splitLabel:'SP2', m:10, w:1, name:'SP2 ワールドファイナル WL',         phase:'world_wl',   meta:{ split:2 } },
    { splitLabel:'SP2', m:10, w:2, name:'SP2 ワールドファイナル 決勝戦',      phase:'world_final', meta:{ split:2 } },

    // ===== Championship =====
    { splitLabel:'CHAMP', m:12, w:4, name:'チャンピオンシップ', phase:'championship', meta:{ split:0 } }
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
    const phase = String(item?.phase || '');

    // local は常に出場対象（最小保証）
    if (phase === 'local') return true;

    // tourState が無い場合は “誤ロックしない” を優先して false
    if (!tourState) return false;

    const qN = !!tourState.qualifiedNational;
    const clearedN = !!tourState.clearedNational;

    const lastChanceUnlocked = !!tourState.lastChanceUnlocked;
    const qW = !!tourState.qualifiedWorld;

    const worldPhase = String(tourState?.world?.phase || '').trim(); // 'qual'|'wl'|'final' or ''
    const qChamp = !!tourState.qualifiedChampionship;

    // 企業ランク条件（チャンピオンシップ：プレイヤーのみ 100以上）
    const companyRank = Number(tourState.playerCompanyRank ?? tourState.companyRank ?? 0);

    if (phase === 'national'){
      // ローカルTOP10などで出場権がある時だけ
      return qN;
    }

    if (phase === 'lastchance'){
      // “ラストチャンス権が明示されてる時だけ” 出す（誤ロック防止）
      // （ナショナル前に出てきちゃう事故を防ぐ）
      return !!lastChanceUnlocked && !qW && !clearedN;
    }

    if (phase === 'world_qual' || phase === 'world_wl' || phase === 'world_final'){
      // ワールド出場権がある時だけ
      if (!qW) return false;

      // 週跨ぎワールドをやる場合：tourState.world.phase があるなら一致した段階だけを候補にする
      // 無い場合：最初（予選）だけ候補にして安全側へ
      if (worldPhase){
        if (phase === 'world_qual')  return worldPhase === 'qual';
        if (phase === 'world_wl')    return worldPhase === 'wl';
        if (phase === 'world_final') return worldPhase === 'final';
        return false;
      }

      // worldPhase が無い（未実装/未保存）なら、予選のみ候補（誤ロック防止）
      return phase === 'world_qual';
    }

    if (phase === 'championship'){
      // 出場権がある時だけ（＋プレイヤー企業ランク条件を tourState で満たしてる場合のみ）
      // ※tourState に companyRank が入ってないなら、誤ロック防止で false（=候補にしない）
      if (!qChamp) return false;
      if (!Number.isFinite(companyRank) || companyRank <= 0) return false;
      return companyRank >= 100;
    }

    return false;
  }

  // ===== “未来 or 現在” 判定（年跨ぎ対応） =====
  // month が今より小さい = 翌年扱いで「未来」とみなす
  function isFutureOrNow(item, now){
    if (item.m === now.m){
      return item.w >= now.w;
    }
    if (item.m > now.m) return true;
    return true; // 年跨ぎで未来扱い
  }

  // ===== 候補の中から「次の大会」を決める =====
  // 条件：
  // 1) 今週以降（isFutureOrNow）
  // 2) 出場対象（isEligible）
  // 3) 最も近い日付
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
    if (dm < 0) dm += 12;
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

    // 表示のたびに nextTour / nextTourW を最新化
    const picked = setNextTourFromSchedule();
    const nextW = picked?.ww || S.getStr(K.nextTourW, '未定');
    const nextName = picked?.next?.name || S.getStr(K.nextTour, '未定');

    dom.list.innerHTML = '';

    let currentLabel = '';

    SCHEDULE.forEach(item=>{
      if (item.splitLabel !== currentLabel){
        const h = document.createElement('div');
        h.textContent = `【${item.splitLabel}】`;
        h.style.fontWeight = '1000';
        h.style.margin = '12px 0 6px';
        dom.list.appendChild(h);
        currentLabel = item.splitLabel;
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

      // 出場対象じゃない大会は薄く
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
    try{ setNextTourFromSchedule(); }catch(e){}
  }

  window.MOBBR.initScheduleUI = initScheduleUI;
  window.MOBBR.ui.schedule = { open, close, render };

  document.addEventListener('DOMContentLoaded', initScheduleUI);
})();
