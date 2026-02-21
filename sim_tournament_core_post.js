/* =========================================================
   sim_tournament_core_post.js（FULL） v4.4
   - ローカル/ナショナル/ラストチャンス/ワールド終了処理：
     権利付与 + tourState更新 + 次大会算出API
   - ✅ 週進行（year/month/week/gold/recent）は一切しない（app.jsに一本化）
   - ✅ mobbr:advanceWeek は投げない
   - ✅ 大会終了は mobbr:goMain(detail.advanceWeeks=1) で統一
   - ✅ nextTour更新は app.js が週進行後に呼ぶ（setNextTourFromState を公開）

   v4.4 変更点（重要）
   - ✅ LastChance 終了時に lastChanceSortedIds(20) を保存（World権利/デバッグ/再現用）
   - ✅ World開始に備え、worldRosterIds/worldGroups は core側が作るが、
      post側は “壊さない” ため触らない（存在しても保持）
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

    // Split1/2 ローカルトップ10（National編成に使う）
    split1Top10: 'mobbr_split1_local_top10',
    split2Top10: 'mobbr_split2_local_top10',

    // デバッグ：直近結果
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

    { split:1, m:4,  w:4, name:'SP1 ワールドファイナル 予選リーグ', phase:'world_qual' },
    { split:1, m:5,  w:1, name:'SP1 ワールドファイナル WL',         phase:'world_wl' },
    { split:1, m:5,  w:2, name:'SP1 ワールドファイナル 決勝戦',      phase:'world_final' },

    // ===== SP2 =====
    { split:2, m:7,  w:1, name:'SP2 ローカル大会', phase:'local' },
    { split:2, m:8,  w:1, name:'SP2 ナショナル大会', phase:'national' },
    { split:2, m:8,  w:2, name:'SP2 ラストチャンス', phase:'lastchance' },

    { split:2, m:9,  w:4, name:'SP2 ワールドファイナル 予選リーグ', phase:'world_qual' },
    { split:2, m:10, w:1, name:'SP2 ワールドファイナル WL',         phase:'world_wl' },
    { split:2, m:10, w:2, name:'SP2 ワールドファイナル 決勝戦',      phase:'world_final' },

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

    const worldPhase = String(tourState?.world?.phase || '').trim(); // 'qual'|'wl'|'final'|'done' or ''
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

    if (phase === 'world_qual' || phase === 'world_wl' || phase === 'world_final'){
      if (!qW) return false;

      if (worldPhase){
        if (phase === 'world_qual')  return worldPhase === 'qual';
        if (phase === 'world_wl')    return worldPhase === 'wl';
        if (phase === 'world_final') return worldPhase === 'final';
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
    return true; // 年跨ぎで未来扱い
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

  // =========================================================
  // 共通：total からプレイヤー順位を取る
  // total は state.tournamentTotal を想定（sumTotal 等）
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
    tourState.worldQualifiedIds = []; // 権利10をここで空に
    tourState.lastNationalSortedIds = []; // ロスター元も空に
    tourState.lastChanceSortedIds = [];   // ✅ v4.4: 追加（安全）
    tourState.worldRosterIds = [];        // ✅ v4.4: 追加（coreが作るがここで空に）
    tourState.worldGroups = null;         // ✅ v4.4: 追加
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
  // - TOP8：World権利（8）
  // - 9〜28：LastChance解放
  // - 29↓：敗退
  // - ✅ lastNationalSortedIds(40) 保存（LastChance roster用）
  // - ✅ worldQualifiedIds に TOP8 を保存（後でLC TOP2を足して10へ）
  // ============================================
  function onNationalTournamentFinished(state, total){
    const { rank, list } = getRankFromTotal(total);

    const tourState = getJSON(K.tourState, null) || {};
    if (!Number.isFinite(Number(tourState.split))) tourState.split = inferSplitFromMonth();

    tourState.nationalPlayed = true;

    // ✅ 40並び保存（PLAYER含む想定）
    const sortedIds40 = list.map(x => String(x?.id||'')).filter(Boolean);
    tourState.lastNationalSortedIds = sortedIds40;

    // 判定
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

      // ✅ 権利8保存
      const top8 = sortedIds40.slice(0,8);
      tourState.worldQualifiedIds = top8.slice();

      // ✅ 既存のworldRoster/groupsがあっても “この時点では” 作り直しを強制しない
      // （core側が startWorldTournament 時に必要なら作る）
    }else if (lastChanceUnlocked){
      tourState.qualifiedWorld = false; // まだ権利無し（LCで取る）
      tourState.clearedNational = false;
      tourState.lastChanceUnlocked = true;
      tourState.stage = 'lastchance';

      // ✅ 権利8はまだ無いので空
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
  // - 参加：National 9〜28位の20チーム（core側で生成）
  // - 賞金無し / 企業ランク変動無し（ここでは触らない）
  // - ✅ TOP2 を worldQualifiedIds に追加して合計10を確定
  // - ✅ v4.4: lastChanceSortedIds(20) を保存
  // ============================================
  function onLastChanceTournamentFinished(state, total){
    const { rank, list } = getRankFromTotal(total);

    const tourState = getJSON(K.tourState, null) || {};
    if (!Number.isFinite(Number(tourState.split))) tourState.split = inferSplitFromMonth();

    tourState.lastLastChanceRank = rank;

    // ✅ v4.4: 20並び保存（PLAYER含む可能性あり）
    const sortedIds20 = list.map(x => String(x?.id||'')).filter(Boolean);
    tourState.lastChanceSortedIds = sortedIds20;

    const qualifiedWorld = (rank > 0 && rank <= 2); // ✅ TOP2固定

    if (qualifiedWorld){
      tourState.qualifiedWorld = true;
      tourState.stage = 'world';
      tourState.lastChanceUnlocked = false;

      ensureWorldObj(tourState);
      tourState.world.phase = 'qual';

      // ✅ LCのTOP2 ids を取得（PLAYER含む可能性あり）
      const top2 = list.slice(0,2).map(x => String(x?.id||'')).filter(Boolean);

      // ✅ 既にNationalのTOP8が入っている場合は維持し、無い場合でも「LC TOP2だけ」は入る
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

      // World権利は「合計10（National8 + LC2）」が理想。
      // National8が無いケースは本来起きないが、安全弁でそのまま保存。
      tourState.worldQualifiedIds = merged.slice(0,10);

      // ✅ roster/groups が既に存在しても “壊さない” ためここでは触らない
      // （core側 startWorldTournament で必要なら作り直し/保存する）
    }else{
      tourState.qualifiedWorld = false;
      tourState.stage = 'done';
      tourState.lastChanceUnlocked = false;

      // 権利なし
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
  //   world.phase : 'qual' → 'wl' → 'final' → 'done'
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

    tourState.stage = 'world';
    tourState.world.phase = 'wl';
    tourState.world.qualDoneAt = Date.now();

    setJSON(K.tourState, tourState);

    setJSON(K.lastResult, {
      type: 'world_qual',
      split: tourState.split || 0,
      at: Date.now()
    });

    dispatch('mobbr:goMain', {
      worldQualFinished: true,
      tournamentFinished: true,
      advanceWeeks: 1
    });
  }

  function onWorldWLFinished(state, total){
    const tourState = getJSON(K.tourState, null) || {};
    if (!Number.isFinite(Number(tourState.split))) tourState.split = inferSplitFromMonth();

    ensureWorldObj(tourState);

    if (!tourState.qualifiedWorld){
      setJSON(K.lastResult, { type:'world_wl_blocked', split:tourState.split||0, at:Date.now() });
      dispatch('mobbr:goMain', { worldWLFinished:false, blocked:true, advanceWeeks:1 });
      return;
    }

    tourState.stage = 'world';
    tourState.world.phase = 'final';
    tourState.world.wlDoneAt = Date.now();

    setJSON(K.tourState, tourState);

    setJSON(K.lastResult, {
      type: 'world_wl',
      split: tourState.split || 0,
      at: Date.now()
    });

    dispatch('mobbr:goMain', {
      worldWLFinished: true,
      tournamentFinished: true,
      advanceWeeks: 1
    });
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

    // split終了なので world権利は消す（次splitへ）
    tourState.qualifiedWorld = false;
    tourState.worldQualifiedIds = [];

    // ✅ roster/groups は残しても害はないが、次splitで混乱しやすいのでここで掃除（壊さない範囲）
    //   - ただし「再現したい」場合は lastResult で追えるのでOK
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
    onWorldWLFinished,
    onWorldFinalFinished,

    setNextTourFromState
  };

})();
