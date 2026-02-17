/* =========================================================
   sim_tournament_core_post.js（FULL） v3.0
   - ローカル/ナショナル終了処理：権利付与 + tourState更新 + 次大会算出API

   ✅ v3.0 修正（最重要）：
   ✅ 週進行（year/month/week/gold/recent）は一切しない（app.jsに一本化）
   ✅ mobbr:advanceWeek は投げない
   ✅ 大会終了は mobbr:goMain(detail.advanceWeeks=1) で統一
   ✅ nextTour更新は app.js が週進行後に呼ぶ（setNextTourFromState を公開）
========================================================= */
'use strict';

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

  // ===== safe localStorage helper =====
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

  // ===== schedule（nextTour算出の最低限）=====
  const SCHEDULE = [
    // Split 1
    { split: 1, m: 2, w: 1, name: 'ローカル大会', phase: 'local' },
    { split: 1, m: 3, w: 1, name: 'ナショナル大会', phase: 'national' },
    { split: 1, m: 3, w: 2, name: 'ナショナル大会後半', phase: 'national' },
    { split: 1, m: 3, w: 3, name: 'ナショナルラストチャンス', phase: 'lastchance' },
    { split: 1, m: 4, w: 1, name: 'ワールドファイナル', phase: 'world' },

    // Split 2
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

  // ✅ ラストチャンスは「ナショナルを実際にプレイして落ちた場合」のみ
  function isEligible(item, tourState){
    if (item.phase === 'local') return true;
    if (!tourState) return false;

    const qN = !!tourState.qualifiedNational;
    const qW = !!tourState.qualifiedWorld;
    const clearedN = !!tourState.clearedNational;
    const nationalPlayed = !!tourState.nationalPlayed;

    if (item.phase === 'national') return qN;

    if (item.phase === 'lastchance'){
      if (clearedN) return false;
      if (qW) return false;
      return nationalPlayed === true;
    }

    if (item.phase === 'world') return qW;

    return false;
  }

  function calcDistanceWeeks(now, item){
    let dm = item.m - now.m;
    if (dm < 0) dm += 12;
    const dw = item.w - now.w;
    return (dm * 4) + dw;
  }

  function isFutureOrNow(item, now){
    if (item.m === now.m) return item.w >= now.w;
    if (item.m > now.m) return true;
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

  // ✅ app.js が「週進行した後」に呼ぶ想定
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

  function setNationalQualifiedLegacy(v){
    try{ localStorage.setItem(K.qualifyLegacy, v ? '1' : '0'); }catch(e){}
  }

  // ============================================
  // ローカル大会終了処理（Split1：TOP10→National）
  // ============================================
  function onLocalTournamentFinished(state, total){
    if (!state || !total) return;

    const playerId = 'PLAYER';

    const list = Object.values(total || []);
    list.sort((a,b)=>{
      if ((b.sumTotal||0) !== (a.sumTotal||0)) return (b.sumTotal||0)-(a.sumTotal||0);
      if ((b.sumPlacementP||0) !== (a.sumPlacementP||0)) return (b.sumPlacementP||0)-(a.sumPlacementP||0);
      return 0;
    });

    const rank = list.findIndex(x => x && x.id === playerId) + 1;
    const qualifiedNational = (rank > 0 && rank <= 10);

    const top10Ids = list.slice(0,10).map(x => String(x.id || '')).filter(Boolean);
    setJSON(K.split1Top10, top10Ids);

    const tourState = getJSON(K.tourState, null) || {};
    tourState.split = 1;

    // ✅ ローカル終了時点ではナショナル未プレイ
    tourState.nationalPlayed = false;

    tourState.stage = qualifiedNational ? 'national' : 'done';
    tourState.qualifiedNational = qualifiedNational;

    if (typeof tourState.qualifiedWorld !== 'boolean') tourState.qualifiedWorld = false;
    if (typeof tourState.clearedNational !== 'boolean') tourState.clearedNational = false;

    tourState.lastLocalRank = rank;
    tourState.lastLocalTop10 = top10Ids;

    setJSON(K.tourState, tourState);
    setNationalQualifiedLegacy(qualifiedNational);

    // ✅ 週進行は app.js がやる
    // ✅ nextTour更新も app.js が「週進行後」に setNextTourFromState() を呼ぶ

    dispatch('mobbr:goMain', {
      localFinished: true,
      tournamentFinished: true,
      rank,
      qualified: qualifiedNational,
      advanceWeeks: 1
    });
  }

  // ============================================
  // ナショナル終了処理（✅ 1週進行は app.js に委譲）
  // ============================================
  function onNationalTournamentFinished(state, total){
    // ✅ 最低限：ナショナルをプレイした事実を保存（ラストチャンス判定の材料）
    const tourState = getJSON(K.tourState, null) || {};
    tourState.nationalPlayed = true;

    // stageは「ナショナル終了」扱いに進める（ワールド等の権利判定は次段で確定）
    // ここで雑に lastchance/world を決めない（壊れる原因になるため）
    tourState.stage = 'national_done';

    // 既存の値が無ければfalseで初期化
    if (typeof tourState.qualifiedWorld !== 'boolean') tourState.qualifiedWorld = false;
    if (typeof tourState.clearedNational !== 'boolean') tourState.clearedNational = false;

    setJSON(K.tourState, tourState);

    // ✅ 週進行は app.js がやる
    dispatch('mobbr:goMain', {
      nationalFinished: true,
      tournamentFinished: true,
      advanceWeeks: 1
    });
  }

  window.MOBBR.sim.tournamentCorePost = {
    onLocalTournamentFinished,
    onNationalTournamentFinished,

    // ✅ app.js が週進行後に呼ぶ
    setNextTourFromState
  };

})();
