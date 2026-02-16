'use strict';

/*
  sim_tournament_core_post.js（ローカル終了処理：Split制御 + 権利付与 + 次大会更新）

  目的（今回の不具合の根治）：
  - TOP10入りしたのに「ナショナル権利が無い」扱いになる問題を解消
  - メイン画面の「次の大会」が更新されない問題を解消
  - スケジュール(ui_schedule.js) が参照する mobbr_tour_state を必ず更新する

  仕様（ユーザー指定）：
  - 2月第1週：ローカル大会
    * TOP10 → 3月第1週〜3週のナショナルへ
    * 11位以下 → Split1敗退
  - ローカル終了後：
    * 1週進行
    * メインへ戻す
    * 次大会(nextTour/nextTourW)を更新
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){

  // ===== Storage Keys（storage.js と合わせる）=====
  const K = {
    year: 'mobbr_year',
    month: 'mobbr_month',
    week: 'mobbr_week',
    nextTour: 'mobbr_nextTour',
    nextTourW: 'mobbr_nextTourW',
    recent: 'mobbr_recent',

    // 進行状態（ui_schedule.js が参照）
    tourState: 'mobbr_tour_state',

    // 互換：昔の単発フラグ（残しても害はない）
    qualifyLegacy: 'mobbr_national_qualified',

    // デバッグ/表示に使えるログ用
    split1Top10: 'mobbr_split1_local_top10'
  };

  // ===== 安全な localStorage helper =====
  function getNum(key, def){
    try{
      const v = Number(localStorage.getItem(key));
      return Number.isFinite(v) ? v : def;
    }catch(e){
      return def;
    }
  }
  function setNum(key, val){
    try{ localStorage.setItem(key, String(Number(val))); }catch(e){}
  }
  function getStr(key, def){
    try{
      const v = localStorage.getItem(key);
      return (v === null || v === undefined || v === '') ? def : v;
    }catch(e){
      return def;
    }
  }
  function setStr(key, val){
    try{ localStorage.setItem(key, String(val)); }catch(e){}
  }
  function getJSON(key, def){
    try{
      const raw = localStorage.getItem(key);
      if (!raw) return def;
      return JSON.parse(raw);
    }catch(e){
      return def;
    }
  }
  function setJSON(key, val){
    try{ localStorage.setItem(key, JSON.stringify(val)); }catch(e){}
  }

  // ===== dispatch helper =====
  function dispatch(name, detail){
    try{
      window.dispatchEvent(new CustomEvent(name, { detail: detail || {} }));
    }catch(e){}
  }

  // ===== 1週進行（UIポップ無し・確実にストレージ更新）=====
  // ※月=4週のゲーム仕様
  function advanceWeekStorage(weeks){
    const add = Number(weeks || 1);
    if (add <= 0) return;

    let y = getNum(K.year, 1989);
    let m = getNum(K.month, 1);
    let w = getNum(K.week, 1);

    for (let i=0;i<add;i++){
      w += 1;
      if (w >= 5){
        w = 1;
        m += 1;
        if (m >= 13){
          m = 1;
          y += 1;
        }
      }
    }

    setNum(K.year, y);
    setNum(K.month, m);
    setNum(K.week, w);

    return { y, m, w };
  }

  // ===== Split1 スケジュール（nextTour算出に最低限必要な分だけ）=====
  // ui_schedule.js と整合する名称に寄せる
  const SCHEDULE = [
    // Split 1
    { split: 1, m: 2, w: 1, name: 'ローカル大会', phase: 'local' },
    { split: 1, m: 3, w: 1, name: 'ナショナル大会', phase: 'national' },
    { split: 1, m: 3, w: 2, name: 'ナショナル大会後半', phase: 'national' },
    { split: 1, m: 3, w: 3, name: 'ナショナルラストチャンス', phase: 'lastchance' },
    { split: 1, m: 4, w: 1, name: 'ワールドファイナル', phase: 'world' },

    // Split 2（参考：今はSplit1だけでOKだが、次大会更新のため残す）
    { split: 2, m: 7, w: 1, name: 'ローカル大会', phase: 'local' },
    { split: 2, m: 8, w: 1, name: 'ナショナル大会', phase: 'national' },
    { split: 2, m: 8, w: 2, name: 'ナショナル大会後半', phase: 'national' },
    { split: 2, m: 8, w: 3, name: 'ナショナルラストチャンス', phase: 'lastchance' },
    { split: 2, m: 9, w: 1, name: 'ワールドファイナル', phase: 'world' },

    // Championship League
    { split: 3, m: 11, w: 1, name: 'ローカル大会', phase: 'local' },
    { split: 3, m: 12, w: 1, name: 'ナショナル大会', phase: 'national' },
    { split: 3, m: 12, w: 2, name: 'ナショナル大会後半', phase: 'national' },
    { split: 3, m: 12, w: 3, name: 'ナショナルラストチャンス', phase: 'lastchance' },
    { split: 3, m: 1,  w: 2, name: 'チャンピオンシップ ワールドファイナル', phase: 'world' },
  ];

  // ===== eligibility（ui_schedule.js と同じ思想：誤ロック防止）=====
  function isEligible(item, tourState){
    if (item.phase === 'local') return true;

    if (!tourState) return false;

    const qN = !!tourState.qualifiedNational;
    const qW = !!tourState.qualifiedWorld;
    const clearedN = !!tourState.clearedNational;

    if (item.phase === 'national') return qN;

    if (item.phase === 'lastchance'){
      if (clearedN) return false;
      if (qW) return false;
      // “ナショナル出場権が無い時だけ”ラストチャンス対象
      return !qN;
    }

    if (item.phase === 'world') return qW;

    return false;
  }

  function calcDistanceWeeks(now, item){
    let dm = item.m - now.m;
    if (dm < 0) dm += 12; // 年跨ぎ
    const dw = item.w - now.w;
    return (dm * 4) + dw;
  }

  function isFutureOrNow(item, now){
    if (item.m === now.m) return item.w >= now.w;
    if (item.m > now.m) return true;
    // 年跨ぎ未来扱い
    return true;
  }

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

  function setNextTourFromState(){
    const now = {
      y: getNum(K.year, 1989),
      m: getNum(K.month, 1),
      w: getNum(K.week, 1)
    };
    const tourState = getJSON(K.tourState, null);

    const next = pickNextEligible(now, tourState);
    if (!next){
      setStr(K.nextTour, '未定');
      setStr(K.nextTourW, '未定');
      return null;
    }

    const ww = `${next.m}-${next.w}`;
    setStr(K.nextTour, next.name);
    setStr(K.nextTourW, ww);
    return { next, ww };
  }

  // ===== legacy qualified key（互換）=====
  function setNationalQualifiedLegacy(v){
    try{ localStorage.setItem(K.qualifyLegacy, v ? '1' : '0'); }catch(e){}
  }

  // ============================================
  // ローカル大会終了処理（Split1：TOP10→National）
  // ============================================
  function onLocalTournamentFinished(state, total){
    if (!state || !total) return;

    const playerId = 'PLAYER';

    // ---- 総合順位計算（sumTotal → sumPlacementP の順）----
    const list = Object.values(total || []);
    list.sort((a,b)=>{
      if ((b.sumTotal||0) !== (a.sumTotal||0)) return (b.sumTotal||0)-(a.sumTotal||0);
      if ((b.sumPlacementP||0) !== (a.sumPlacementP||0)) return (b.sumPlacementP||0)-(a.sumPlacementP||0);
      // 以降は UI/仕様に任せる（ここは権利判定のため最小）
      return 0;
    });

    const rank = list.findIndex(x => x && x.id === playerId) + 1;

    // ---- TOP10判定 ----
    const qualifiedNational = (rank > 0 && rank <= 10);

    // ---- TOP10のチームIDを保存（ローカル勝ち上がり10チーム）----
    const top10Ids = list.slice(0,10).map(x => String(x.id || '')).filter(Boolean);
    setJSON(K.split1Top10, top10Ids);

    // ---- ツアー状態（ui_schedule.js が参照する本命）----
    // Split1：ローカル終了直後
    const tourState = getJSON(K.tourState, null) || {};
    tourState.split = 1;

    // stage は “現在地” として扱う（次の大会表示・ロック制御に使う）
    // TOP10 → 次は national
    // 11位以下 → Split1敗退（done）
    tourState.stage = qualifiedNational ? 'national' : 'done';

    tourState.qualifiedNational = qualifiedNational;
    // world/lastchance はこの時点で未確定
    if (typeof tourState.qualifiedWorld !== 'boolean') tourState.qualifiedWorld = false;
    if (typeof tourState.clearedNational !== 'boolean') tourState.clearedNational = false;

    // 参考情報（なくても良いが便利）
    tourState.lastLocalRank = rank;
    tourState.lastLocalTop10 = top10Ids;

    setJSON(K.tourState, tourState);

    // ---- legacy flag（互換）----
    setNationalQualifiedLegacy(qualifiedNational);

    // ---- 1週進行（確実にストレージ更新）----
    advanceWeekStorage(1);

    // ---- 次の大会（nextTour / nextTourW）を確定更新 ----
    setNextTourFromState();

    // ---- recent更新（メイン画面に出る）----
    if (qualifiedNational){
      setStr(K.recent, `ローカル大会 ${rank}位：ナショナル出場権獲得！`);
    }else{
      setStr(K.recent, `ローカル大会 ${rank}位：スプリット1敗退…`);
    }

    // ---- メインへ戻す（既存のUI側ハンドラがあればそれで遷移）----
    dispatch('mobbr:goMain', {
      localFinished: true,
      rank,
      qualified: qualifiedNational
    });

    // ---- 念のため：週進行イベント（既存が使っていれば活きる／使ってなくても害なし）----
    dispatch('mobbr:advanceWeek', { weeks: 1 });
  }

  // ============================================
  // ナショナル終了処理（今後：Split1の結果を反映）
  // ※ 今は雛形（ここは次の段階で作り込む）
  // ============================================
  function onNationalTournamentFinished(state, total){
    dispatch('mobbr:goMain', { nationalFinished: true });
  }

  window.MOBBR.sim.tournamentCorePost = {
    onLocalTournamentFinished,
    onNationalTournamentFinished
  };

})();
