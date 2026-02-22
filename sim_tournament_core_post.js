/* =========================================================
   sim_tournament_core_post.js（FULL） v4.5
   - ローカル/ナショナル/ラストチャンス/ワールド終了処理：
     権利付与 + tourState更新 + 次大会算出API
   - ✅ 週進行（year/month/week/gold/recent）は一切しない（app.jsに一本化）
   - ✅ mobbr:advanceWeek は投げない
   - ✅ 大会終了は mobbr:goMain(detail.advanceWeeks=1) で統一
   - ✅ nextTour更新は app.js が週進行後に呼ぶ（setNextTourFromState を公開）

   v4.5 変更点（WORLD整合・WL吸収）
   - ✅ SCHEDULE の world_wl を廃止運用し、互換として losers に吸収
   - ✅ tourState.world.phase を 'qual'|'losers'|'final'|'done' に統一（WLはlosersへ）
   - ✅ Losers終了時点で tourState.world.phase='final' を立てる前提に対応
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

    tourState: 'mobbr_tour_state',

    qualifyLegacy: 'mobbr_national_qualified',

    split1Top10: 'mobbr_split1_local_top10',
    split2Top10: 'mobbr_split2_local_top10',

    lastResult: 'mobbr_last_tournament_result'
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

  // =========================================================
  // 新スケジュール（nextTour算出用）
  // =========================================================
  const SCHEDULE = [
    // ===== SP1 =====
    { split:1, m:2,  w:1, name:'SP1 ローカル大会', phase:'local' },
    { split:1, m:3,  w:1, name:'SP1 ナショナル大会', phase:'national' },
    { split:1, m:3,  w:2, name:'SP1 ラストチャンス', phase:'lastchance' },

    // ✅ v4.5: 4月4週＝WORLD予選+Losers（同週内で確定）
    { split:1, m:4,  w:4, name:'SP1 ワールドファイナル 予選リーグ', phase:'world_qual' },
    // ✅ v4.5: WLはLosers扱いへ（互換維持のため name/phase を変更）
    { split:1, m:4,  w:4, name:'SP1 ワールドファイナル Losersリーグ', phase:'world_losers' },
    // ✅ v4.5: 5月1週＝決勝戦
    { split:1, m:5,  w:1, name:'SP1 ワールドファイナル 決勝戦', phase:'world_final' },

    // ===== SP2 =====
    { split:2, m:7,  w:1, name:'SP2 ローカル大会', phase:'local' },
    { split:2, m:8,  w:1, name:'SP2 ナショナル大会', phase:'national' },
    { split:2, m:8,  w:2, name:'SP2 ラストチャンス', phase:'lastchance' },

    // ✅ v4.5: 9月4週＝WORLD予選+Losers（同週内で確定）
    { split:2, m:9,  w:4, name:'SP2 ワールドファイナル 予選リーグ', phase:'world_qual' },
    { split:2, m:9,  w:4, name:'SP2 ワールドファイナル Losersリーグ', phase:'world_losers' },
    // ✅ v4.5: 10月1週＝決勝戦
    { split:2, m:10, w:1, name:'SP2 ワールドファイナル 決勝戦', phase:'world_final' },

    // ===== Championship =====
    { split:0, m:12, w:4, name:'チャンピオンシップ', phase:'championship' }
  ];

  // ===== 誤ロック防止の出場判定 =====
  function isEligible(item, tourState){
    const phase = String(item?.phase || '');

    if (phase === 'local') return true;
    if (!tourState) return false;

    const qN = !!tourState.qualifiedNational;
    const qW = !!tourState.qualifiedWorld;
    const clearedN = !!tourState.clearedNational;
    const lastChanceUnlocked = !!tourState.lastChanceUnlocked;

    const worldPhaseRaw = String(tourState?.world?.phase || '').trim(); // 'qual'|'losers'|'final'|'done' or ''
    // ✅ 互換：'wl' は 'losers' として扱う
    const worldPhase = (worldPhaseRaw === 'wl') ? 'losers' : worldPhaseRaw;

    const qChamp = !!tourState.qualifiedChampionship;
    const companyRank = Number(tourState.playerCompanyRank ?? tourState.companyRank ?? 0);

    if (phase === 'national'){
      return qN;
    }

    if (phase === 'lastchance'){
      if (qW) return false;
      if (clearedN) return false;
      return !!lastChanceUnlocked;
    }

    if (phase === 'world_qual' || phase === 'world_losers' || phase === 'world_final'){
      if (!qW) return false;

      if (worldPhase){
        if (phase === 'world_qual')    return worldPhase === 'qual';
        if (phase === 'world_losers')  return worldPhase === 'losers';
        if (phase === 'world_final')   return worldPhase === 'final';
        return false;
      }

      // worldPhase 未保存なら誤ロック防止で予選だけ候補
      return phase === 'world_qual';
    }

    if (phase === 'championship'){
      if (!qChamp) return false;
      if (!Number.isFinite(companyRank) || companyRank <= 0) return false;
      return companyRank >= 100;
    }

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

  // =========================================================
  // 共通：total からプレイヤー順位を取る
  // =========================================================
  function getRankFromTotal(total){
    const playerId = 'PLAYER';
    const list = Object.values(total || {}).filter(Boolean);

    list.sort((a,b)=>{
      const at = Number(a.sumTotal||0), bt = Number(b.sumTotal||0);
      if (bt !== at) return bt - at;

      const ap = Number(a.sumPlacementP||0), bp = Number(b.sumPlacementP||0);
      if (bp !== ap) return bp - ap;

      const ak = Number(a.sumKP||0), bk = Number(b.sumKP||0);
      if (bk !== ak) return bk - ak;

      const aa = Number(a.sumAP||0), ba = Number(b.sumAP||0);
      if (ba !== aa) return ba - aa;

      const an = String(a.id||''), bn = String(b.id||'');
      return an.localeCompare(bn);
    });

    const rank = list.findIndex(x => x && String(x.id) === playerId) + 1;
    return { rank, list };
  }

  function inferSplitFromMonth(){
    const nowM = getNum(K.month, 1);
    if (nowM >= 7 && nowM <= 10) return 2;
    return 1;
  }

  function ensureWorldObj(tourState){
    if (!tourState.world || typeof tourState.world !== 'object'){
      tourState.world = { phase: 'qual' };
    }
    if (!tourState.world.phase) tourState.world.phase = 'qual';
    // ✅ 互換：wlはlosersへ
    if (tourState.world.phase === 'wl') tourState.world.phase = 'losers';
  }

  // ============================================
  // ローカル大会終了処理（TOP10→National）
  // ============================================
  function onLocalTournamentFinished(state, total){
    if (!state || !total) return;

    const { rank, list } = getRankFromTotal(total);
    const qualifiedNational = (rank > 0 && rank <= 10);
    const split = Number(getJSON(K.tourState, {})?.split) || inferSplitFromMonth();

    const top10Ids = list.slice(0,10).map(x => String(x.id || '')).filter(Boolean);

    if (split === 2){
      setJSON(K.split2Top10, top10Ids);
    }else{
      setJSON(K.split1Top10, top10Ids);
    }

    const tourState = getJSON(K.tourState, null) || {};
    tourState.split = split;

    tourState.stage = qualifiedNational ? 'national' : 'done';
    tourState.qualifiedNational = qualifiedNational;

    tourState.nationalPlayed = false;

    tourState.clearedNational = false;
    tourState.lastChanceUnlocked = false;

    // Split単位：ローカル開始でWorld権利はリセット
    tourState.qualifiedWorld = false;
    tourState.worldQualifiedIds = [];
    tourState.lastNationalSortedIds = [];
    tourState.lastChanceSortedIds = [];
    tourState.worldRosterIds = [];
    tourState.worldGroups = null;
    tourState.world = { phase: 'qual' };

    tourState.lastLocalRank = rank;
    tourState.lastLocalTop10 = top10Ids;

    setJSON(K.tourState, tourState);
    setNationalQualifiedLegacy(qualifiedNational);

    setJSON(K.lastResult, {
      type: 'local',
      split,
      rank,
      qualifiedNational,
      at: Date.now()
    });

    dispatch('mobbr:goMain', {
      localFinished: true,
      tournamentFinished: true,
      split,
      rank,
      qualified: qualifiedNational,
      advanceWeeks: 1
    });
  }

  // ============================================
  // ✅ ナショナル終了処理
  // ============================================
  function onNationalTournamentFinished(state, total){
    const { rank, list } = getRankFromTotal(total);

    const tourState = getJSON(K.tourState, null) || {};
    if (!Number.isFinite(Number(tourState.split))) tourState.split = inferSplitFromMonth();

    tourState.nationalPlayed = true;

    const sortedIds40 = list.map(x => String(x?.id||'')).filter(Boolean);
    tourState.lastNationalSortedIds = sortedIds40;

    const qualifiedWorld = (rank > 0 && rank <= 8);
    const lastChanceUnlocked = (rank >= 9 && rank <= 28);

    tourState.lastNationalRank = rank;

    if (qualifiedWorld){
      tourState.qualifiedWorld = true;
      tourState.clearedNational = true;
      tourState.lastChanceUnlocked = false;
      tourState.stage = 'world';

      ensureWorldObj(tourState);
      tourState.world.phase = 'qual';

      const top8 = sortedIds40.slice(0,8);
      tourState.worldQualifiedIds = top8.slice();

    }else if (lastChanceUnlocked){
      tourState.qualifiedWorld = false;
      tourState.clearedNational = false;
      tourState.lastChanceUnlocked = true;
      tourState.stage = 'lastchance';

      tourState.worldQualifiedIds = [];
    }else{
      tourState.qualifiedWorld = false;
      tourState.clearedNational = false;
      tourState.lastChanceUnlocked = false;
      tourState.stage = 'done';

      tourState.worldQualifiedIds = [];
    }

    setJSON(K.tourState, tourState);

    setJSON(K.lastResult, {
      type: 'national',
      split: tourState.split || 0,
      rank,
      qualifiedWorld,
      lastChanceUnlocked,
      at: Date.now()
    });

    dispatch('mobbr:goMain', {
      nationalFinished: true,
      tournamentFinished: true,
      rank,
      qualifiedWorld,
      lastChanceUnlocked,
      advanceWeeks: 1
    });
  }

  // ============================================
  // ✅ ラストチャンス終了処理（TOP2 → World権利）
  // ============================================
  function onLastChanceTournamentFinished(state, total){
    const { rank, list } = getRankFromTotal(total);

    const tourState = getJSON(K.tourState, null) || {};
    if (!Number.isFinite(Number(tourState.split))) tourState.split = inferSplitFromMonth();

    tourState.lastLastChanceRank = rank;

    const sortedIds20 = list.map(x => String(x?.id||'')).filter(Boolean);
    tourState.lastChanceSortedIds = sortedIds20;

    const qualifiedWorld = (rank > 0 && rank <= 2);

    if (qualifiedWorld){
      tourState.qualifiedWorld = true;
      tourState.stage = 'world';
      tourState.lastChanceUnlocked = false;

      ensureWorldObj(tourState);
      tourState.world.phase = 'qual';

      const top2 = list.slice(0,2).map(x => String(x?.id||'')).filter(Boolean);

      const base = Array.isArray(tourState.worldQualifiedIds) ? tourState.worldQualifiedIds.slice() : [];

      const merged = [];
      const pushU = (id)=>{
        const s = String(id||'');
        if (!s) return;
        if (merged.includes(s)) return;
        merged.push(s);
      };

      for (const id of base) pushU(id);
      for (const id of top2) pushU(id);

      tourState.worldQualifiedIds = merged.slice(0,10);

    }else{
      tourState.qualifiedWorld = false;
      tourState.stage = 'done';
      tourState.lastChanceUnlocked = false;

      tourState.worldQualifiedIds = [];
    }

    setJSON(K.tourState, tourState);

    setJSON(K.lastResult, {
      type: 'lastchance',
      split: tourState.split || 0,
      rank,
      qualifiedWorld,
      at: Date.now()
    });

    dispatch('mobbr:goMain', {
      lastChanceFinished: true,
      tournamentFinished: true,
      rank,
      qualifiedWorld,
      advanceWeeks: 1
    });
  }

  // =========================================================
  // ✅ ワールド三段階の終了処理
  //   world.phase : 'qual' → 'losers' → 'final' → 'done'
  // =========================================================
  function onWorldQualFinished(state, total){
    const tourState = getJSON(K.tourState, null) || {};
    if (!Number.isFinite(Number(tourState.split))) tourState.split = inferSplitFromMonth();

    ensureWorldObj(tourState);

    if (!tourState.qualifiedWorld){
      setJSON(K.lastResult, { type:'world_qual_blocked', split:tourState.split||0, at:Date.now() });
      dispatch('mobbr:goMain', { worldQualFinished:false, blocked:true, advanceWeeks:1 });
      return;
    }

    // ✅ v4.5: 予選は“同週でLosersに続く”ので phase は losers へ
    tourState.stage = 'world';
    tourState.world.phase = 'losers';
    tourState.world.qualDoneAt = Date.now();

    setJSON(K.tourState, tourState);

    setJSON(K.lastResult, {
      type: 'world_qual',
      split: tourState.split || 0,
      at: Date.now()
    });

    // ここではメインへ戻す責務は持たない（step側が続行する）
  }

  // ✅ v4.5: 互換名 “WL” は losers と同義（Losers終了時のハンドラ）
  function onWorldWLFinished(state, total){
    const tourState = getJSON(K.tourState, null) || {};
    if (!Number.isFinite(Number(tourState.split))) tourState.split = inferSplitFromMonth();

    ensureWorldObj(tourState);

    if (!tourState.qualifiedWorld){
      setJSON(K.lastResult, { type:'world_losers_blocked', split:tourState.split||0, at:Date.now() });
      dispatch('mobbr:goMain', { worldLosersFinished:false, blocked:true, advanceWeeks:1 });
      return;
    }

    // ✅ Losers終了＝Finalは「来週開始」なので phase を final にする
    tourState.stage = 'world';
    tourState.world.phase = 'final';
    tourState.world.losersDoneAt = Date.now();

    // ✅ step側が finalIds を tour_state.world.finalIds に保存する前提（壊さない）
    setJSON(K.tourState, tourState);

    setJSON(K.lastResult, {
      type: 'world_losers',
      split: tourState.split || 0,
      at: Date.now()
    });

    dispatch('mobbr:goMain', {
      worldLosersFinished: true,
      tournamentFinished: true,
      advanceWeeks: 1
    });
  }

  // ✅ v4.5: 明示名（stepがこちらを呼べるように追加）
  function onWorldLosersFinished(state, total){
    return onWorldWLFinished(state, total);
  }

  function onWorldFinalFinished(state, total){
    const { rank } = getRankFromTotal(total);

    const tourState = getJSON(K.tourState, null) || {};
    if (!Number.isFinite(Number(tourState.split))) tourState.split = inferSplitFromMonth();

    ensureWorldObj(tourState);

    if (!tourState.qualifiedWorld){
      setJSON(K.lastResult, { type:'world_final_blocked', split:tourState.split||0, at:Date.now() });
      dispatch('mobbr:goMain', { worldFinalFinished:false, blocked:true, advanceWeeks:1 });
      return;
    }

    tourState.stage = 'done';
    tourState.world.phase = 'done';
    tourState.world.finalRank = rank;
    tourState.world.finalDoneAt = Date.now();

    tourState.qualifiedWorld = false;
    tourState.worldQualifiedIds = [];

    tourState.worldRosterIds = [];
    tourState.worldGroups = null;

    setJSON(K.tourState, tourState);

    setJSON(K.lastResult, {
      type: 'world_final',
      split: tourState.split || 0,
      rank,
      at: Date.now()
    });

    dispatch('mobbr:goMain', {
      worldFinalFinished: true,
      tournamentFinished: true,
      rank,
      advanceWeeks: 1
    });
  }

  window.MOBBR.sim.tournamentCorePost = {
    onLocalTournamentFinished,
    onNationalTournamentFinished,
    onLastChanceTournamentFinished,

    onWorldQualFinished,
    onWorldWLFinished,        // 互換（=Losers終了）
    onWorldLosersFinished,    // ✅ 追加（明示）
    onWorldFinalFinished,

    setNextTourFromState
  };

})();
