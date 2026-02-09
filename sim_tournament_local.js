/* =========================================================
   MOB BR - sim_tournament_local.js (FULL)
   ---------------------------------------------------------
   役割：
   ・ローカル大会（20チーム / 5試合）の“大会進行データ”を管理
   ・1試合ごとに result（20チーム）を生成
   ・試合後に「現在(1/5)の総合順位」を更新（20チーム）
   ・戦闘ロジックは持たない（ここでは簡易シムで result を作るだけ）
   ---------------------------------------------------------
   依存（あれば使う / 無くても動く）：
   ・window.MOBBR.data.tournament（data_tournament.js）
   ・window.MOBBR.ui.matchResult（ui_match_result.js）
   ・window.DataCPU（data_cpu_teams.js）
   ・window.DataPlayer（任意：プレイヤーチーム取得用）
========================================================= */

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){
  'use strict';

  const Local = {};
  window.MOBBR.sim.tournamentLocal = Local;

  // ---------------------------------------------------------
  // CONFIG / KEYS
  // ---------------------------------------------------------
  const LS_KEY = 'mobbr_tournament_local_state_v1';

  // 画像フォルダ（ユーザー構成）
  const CPU_IMG_BASE = 'cpu/';

  // ---------------------------------------------------------
  // PUBLIC API
  // ---------------------------------------------------------
  /**
   * ローカル大会セッション作成（20チーム / 5試合）
   * @param {object} opt
   *  - seed (number) : 乱数シード（任意）
   *  - teams (array) : 20チームを外部から渡す（任意）
   *  - keepStorage (boolean) : 既存保存を優先して復帰（任意 / true推奨）
   */
  Local.create = function(opt){
    const o = opt || {};
    if (o.keepStorage !== false){
      const saved = readState();
      if (saved && saved.kind === 'local' && saved.matchIndex < saved.matchTotal){
        return saved;
      }
    }

    const matchTotal = 5;
    const teams = normalizeTeams(o.teams || buildDefaultTeams20());

    const state = {
      kind: 'local',
      version: 1,
      seed: Number.isFinite(Number(o.seed)) ? Number(o.seed) : Math.floor(Math.random()*1e9),
      rngI: 0,

      matchIndex: 0,
      matchTotal,

      teams: teams.map(t => ({
        isPlayer: !!t.isPlayer,
        teamId: String(t.teamId),
        name: String(t.name),
        image: String(t.image || (t.teamId ? (CPU_IMG_BASE + t.teamId + '.png') : '')),
      })),

      // 累積（総合順位用）
      agg: initAgg(teams),

      // 最後に生成した表示用データ
      last: null
    };

    writeState(state);
    return state;
  };

  /**
   * 次の試合を進める（1試合分だけ）
   * @param {object} state Local.create の戻り
   * @param {object} opt
   *  - openUI (boolean) : result UI を開く（既定 true）
   *  - title/subtitle : UI文言
   * @returns {object} updated state
   */
  Local.playNextMatch = function(state, opt){
    const st = state || readState();
    if (!st || st.kind !== 'local') return null;

    if (st.matchIndex >= st.matchTotal){
      // 既に終了
      return st;
    }

    const o = opt || {};
    const matchNo = st.matchIndex + 1;

    // 1試合の result を生成
    const matchRows = simulateOneMatch(st);

    // 累積更新（総合順位）
    applyAgg(st, matchRows);

    // 総合順位（20チーム）
    const overallRows = buildOverallRows(st);

    // 表示用まとめ
    const championRow = matchRows.slice().sort((a,b)=>a.place-b.place)[0] || null;
    const championName = championRow ? championRow.name : '';

    st.matchIndex = matchNo;
    st.last = {
      matchNo,
      matchRows,
      overallRows,
      championName
    };

    writeState(st);

    // UI表示（このファイルだけでも動くように“あれば”開く）
    if (o.openUI !== false){
      const ui = window.MOBBR?.ui?.matchResult;
      if (ui && typeof ui.open === 'function'){
        ui.open({
          title: String(o.title || 'RESULT'),
          subtitle: String(o.subtitle || `ローカル大会 第${matchNo}試合`),
          matchIndex: matchNo,
          matchTotal: st.matchTotal,
          rows: matchRows,
          championName
        });
      }
    }

    return st;
  };

  /**
   * 総合順位を UI で出したい場合（20チーム）
   */
  Local.openOverallUI = function(state, opt){
    const st = state || readState();
    if (!st || st.kind !== 'local') return;

    const o = opt || {};
    const ui = window.MOBBR?.ui?.matchResult;
    if (!ui || typeof ui.open !== 'function') return;

    const overallRows = buildOverallRows(st);

    ui.open({
      title: String(o.title || 'OVERALL'),
      subtitle: String(o.subtitle || `ローカル大会 総合順位（${st.matchIndex}/${st.matchTotal}）`),
      matchIndex: st.matchIndex,
      matchTotal: st.matchTotal,
      rows: overallRows,
      championName: overallRows[0]?.name || ''
    });
  };

  /**
   * 大会終了判定
   */
  Local.isFinished = function(state){
    const st = state || readState();
    return !!(st && st.kind === 'local' && st.matchIndex >= st.matchTotal);
  };

  /**
   * 終了時の総合順位（20チーム）を返す
   */
  Local.getFinalOverall = function(state){
    const st = state || readState();
    if (!st || st.kind !== 'local') return null;
    return buildOverallRows(st);
  };

  /**
   * リセット（保存も消す）
   */
  Local.reset = function(){
    try{ localStorage.removeItem(LS_KEY); }catch{}
  };

  // ---------------------------------------------------------
  // CORE: One match simulation (簡易)
  // ---------------------------------------------------------
  function simulateOneMatch(st){
    const teams = st.teams.slice();

    // place 1..20 をシャッフルで割り当て
    const order = shuffleWithSeed(teams.map(t=>t.teamId), st);
    const placeById = {};
    for (let i=0;i<order.length;i++){
      placeById[order[i]] = i + 1;
    }

    // 1試合の各チームスコア（簡易）
    const rows = teams.map(t=>{
      const place = placeById[t.teamId] || 20;

      // 簡易：上位ほど少しKP出やすい
      const kpBase = place <= 3 ? 3 : place <= 10 ? 2 : 1;
      const kp = randInt(st, 0, kpBase + 3);

      // アシスト：KP同程度〜少し多いこともある（上限なし）
      const ap = randInt(st, 0, Math.max(0, kp + 3));

      // お宝：たまに
      const treasure = (rand01(st) < 0.18) ? 1 : 0;

      // フラッグ：さらにレア
      const flag = (rand01(st) < 0.08) ? 1 : 0;

      const placementP = getPlacementPoint(place);
      const total = placementP + kp + ap + treasure + flag*2;

      return {
        place,
        teamId: t.teamId,
        name: t.name,
        image: t.image || (CPU_IMG_BASE + t.teamId + '.png'),
        placementP,
        kp,
        ap,
        treasure,
        flag,
        total
      };
    });

    // place昇順
    rows.sort((a,b)=>a.place-b.place);
    return rows;
  }

  // ---------------------------------------------------------
  // AGGREGATION
  // ---------------------------------------------------------
  function initAgg(teams){
    const agg = {};
    for (const t of teams){
      agg[t.teamId] = {
        teamId: t.teamId,
        name: t.name,
        image: t.image || (CPU_IMG_BASE + t.teamId + '.png'),

        matches: 0,
        sumPlace: 0,

        totalPts: 0,
        totalKP: 0,
        totalAP: 0,
        totalTreasure: 0,
        totalFlag: 0
      };
    }
    return agg;
  }

  function applyAgg(st, matchRows){
    for (const r of matchRows){
      const a = st.agg[r.teamId];
      if (!a) continue;

      a.matches += 1;
      a.sumPlace += (Number(r.place)||20);

      a.totalPts += (Number(r.total)||0);
      a.totalKP += (Number(r.kp)||0);
      a.totalAP += (Number(r.ap)||0);
      a.totalTreasure += (Number(r.treasure)||0);
      a.totalFlag += (Number(r.flag)||0);
    }
  }

  function buildOverallRows(st){
    const list = Object.values(st.agg || {});
    const rows = list.map(a=>{
      const avgPlace = a.matches ? (a.sumPlace / a.matches) : 99;
      return {
        teamId: a.teamId,
        name: a.name,
        image: a.image,

        // “結果UI”が受け取る形に寄せる
        // place は並べた後に付け直す
        place: 0,

        placementP: 0, // 総合では使わない（表示上0）
        kp: a.totalKP,
        ap: a.totalAP,
        treasure: a.totalTreasure,
        flag: a.totalFlag,
        total: a.totalPts,

        _avgPlace: avgPlace
      };
    });

    // 同点時の優先順位：
    // 総合ポイント → 総合キル → 平均順位（小さいほど上） → 総合アシスト → ランダム
    rows.sort((x,y)=>{
      if (y.total !== x.total) return y.total - x.total;
      if (y.kp !== x.kp) return y.kp - x.kp;
      if (x._avgPlace !== y._avgPlace) return x._avgPlace - y._avgPlace;
      if (y.ap !== x.ap) return y.ap - x.ap;
      return (rand01(st) < 0.5) ? -1 : 1;
    });

    // place 付与（1..20）
    for (let i=0;i<rows.length;i++){
      rows[i].place = i + 1;
    }

    // 表示に不要な内部値を掃除
    rows.forEach(r=>{ delete r._avgPlace; });

    return rows;
  }

  // ---------------------------------------------------------
  // TEAMS: build default 20 (player + 19 local CPU)
  // ---------------------------------------------------------
  function buildDefaultTeams20(){
    const out = [];

    const player = getPlayerTeamOrNull();
    if (player) out.push(player);

    const cpuLocals = getLocalCpuTeams();
    // プレイヤーが居るなら19、居ないなら20
    const need = 20 - out.length;

    const picked = pickUnique(cpuLocals, need);
    out.push(...picked);

    // まだ足りない場合（念のため）
    while (out.length < 20){
      out.push({
        isPlayer: false,
        teamId: 'cpu_dummy_' + out.length,
        name: 'CPU',
        image: ''
      });
    }

    return out.slice(0,20);
  }

  function getPlayerTeamOrNull(){
    // 任意：DataPlayer があるなら使う
    const DP = window.DataPlayer || window.MOBBR?.data?.player || null;
    if (DP){
      if (typeof DP.getTeam === 'function'){
        const t = DP.getTeam();
        if (t && t.teamId) return normalizeTeam(t, true);
      }
      if (typeof DP.getPlayerTeam === 'function'){
        const t = DP.getPlayerTeam();
        if (t && t.teamId) return normalizeTeam(t, true);
      }
      if (DP.team && DP.team.teamId){
        return normalizeTeam(DP.team, true);
      }
    }

    // fallback：最低限のプレイヤーチーム
    // ※実プロジェクト側の player データに差し替わる想定
    return {
      isPlayer: true,
      teamId: 'player',
      name: 'プレイヤーチーム',
      image: '' // 試合UI側で P?.png を重ねるので、ここは空でもOK
    };
  }

  function getLocalCpuTeams(){
    const DC = window.DataCPU || null;
    let all = [];
    if (DC && typeof DC.getAllTeams === 'function'){
      all = DC.getAllTeams() || [];
    }
    // local01〜local20 に寄せる（teamId prefix）
    const locals = all.filter(t => String(t.teamId||'').startsWith('local'));
    // 画像パスが assets/ の場合 cpu/ に寄せる
    return locals.map(t=>normalizeTeam(t,false));
  }

  function normalizeTeams(arr){
    const list = Array.isArray(arr) ? arr : [];
    const out = [];
    const seen = new Set();
    for (const t of list){
      const nt = normalizeTeam(t, !!t.isPlayer);
      if (!nt || !nt.teamId) continue;
      if (seen.has(nt.teamId)) continue;
      seen.add(nt.teamId);
      out.push(nt);
      if (out.length >= 20) break;
    }
    // 足りないなら補完
    while (out.length < 20){
      out.push({
        isPlayer: false,
        teamId: 'cpu_dummy_' + out.length,
        name: 'CPU',
        image: ''
      });
    }
    return out.slice(0,20);
  }

  function normalizeTeam(t, forcePlayer){
    if (!t) return null;
    const teamId = String(t.teamId || t.id || t.key || '');
    if (!teamId) return null;
    const name = String(t.name || t.teamName || teamId);
    let image = String(t.image || t.img || '');
    if (image.startsWith('assets/')) image = 'cpu/' + image.slice('assets/'.length);
    if (!image && !forcePlayer) image = CPU_IMG_BASE + teamId + '.png';

    return {
      isPlayer: !!forcePlayer || !!t.isPlayer,
      teamId,
      name,
      image
    };
  }

  function pickUnique(arr, n){
    const a = (arr || []).slice();
    // 雑シャッフル
    for (let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      const tmp=a[i]; a[i]=a[j]; a[j]=tmp;
    }
    return a.slice(0, Math.max(0,n));
  }

  // ---------------------------------------------------------
  // POINT TABLE（ユーザー確定）
  // ---------------------------------------------------------
  function getPlacementPoint(place){
    const p = Number(place)||20;
    if (p === 1) return 12;
    if (p === 2) return 8;
    if (p === 3) return 6;
    if (p === 4) return 5;
    if (p === 5) return 4;
    if (p === 6) return 3;
    if (p === 7) return 2;
    if (p >= 8 && p <= 10) return 1;
    return 0;
  }

  // ---------------------------------------------------------
  // RNG (seeded) — 再現性のため state.seed を使う
  // ---------------------------------------------------------
  function rand01(st){
    // xorshift32
    let x = (st.seed >>> 0) ^ ((st.rngI + 1) * 0x9e3779b9);
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17; x >>>= 0;
    x ^= x << 5;  x >>>= 0;
    st.rngI = (st.rngI + 1) >>> 0;
    // 0..1
    return (x >>> 0) / 4294967296;
  }
  function randInt(st, min, max){
    const a = Number(min)||0;
    const b = Number(max)||0;
    if (b <= a) return a;
    return a + Math.floor(rand01(st) * (b - a + 1));
  }

  function shuffleWithSeed(arr, st){
    const a = (arr || []).slice();
    for (let i=a.length-1;i>0;i--){
      const j = Math.floor(rand01(st) * (i+1));
      const tmp=a[i]; a[i]=a[j]; a[j]=tmp;
    }
    return a;
  }

  // ---------------------------------------------------------
  // STORAGE
  // ---------------------------------------------------------
  function readState(){
    try{
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : null;
    }catch{
      return null;
    }
  }
  function writeState(st){
    try{
      localStorage.setItem(LS_KEY, JSON.stringify(st));
    }catch{}
  }

})();
