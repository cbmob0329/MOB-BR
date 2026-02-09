/* =========================================================
   MOB BR - sim_tournament_lastchance.js (FULL)
   - ラストチャンス（ナショナル9〜28位）専用フェーズ
   - 20チーム / 5試合
   - 1試合ごとに「result(20)」→「現在の総合順位(20)」を更新
   ---------------------------------------------------------
   依存（あれば使う）：
   - window.DataCPU.getById(teamId)
   - window.DataPlayer.getTeam() / window.MOBBR.data.player 等（プレイヤーチーム取得）
   - window.SimMatch.runMatch(teams, opt)  ※あればそれを優先
     （無い場合は暫定で簡易シミュレーションで result を作る）
========================================================= */

(function(){
  'use strict';

  const SimTournamentLastChance = {};
  window.SimTournamentLastChance = SimTournamentLastChance;

  // ===== 固定 =====
  const MATCHES = 5;

  // 順位ポイント（ユーザー確定）
  function placementPoint(p){
    if (p === 1) return 12;
    if (p === 2) return 8;
    if (p === 3) return 6;
    if (p === 4) return 5;
    if (p === 5) return 4;
    if (p === 6) return 3;
    if (p === 7) return 2;
    if (p === 8) return 1;
    if (p === 9) return 1;
    if (p === 10) return 1;
    return 0;
  }

  // ===== Team resolve =====
  function resolveTeamById(teamId){
    // 1) プレイヤー（存在すれば）
    const p =
      window.DataPlayer?.getTeam?.() ||
      window.MOBBR?.data?.player?.team ||
      window.MOBBR?.data?.playerTeam ||
      null;
    if (p && p.teamId === teamId){
      return cloneTeam(p, true);
    }

    // 2) CPU
    const cpu = window.DataCPU?.getById?.(teamId) || null;
    if (cpu) return cloneTeam(cpu, false);

    // 3) 最低限フォールバック（IDだけでも進める）
    return {
      isPlayer: false,
      teamId: String(teamId),
      name: String(teamId),
      image: `cpu/${teamId}.png`,
      basePower: 50,
      members: [
        { role:'IGL', name:'IGL', powerMin:50, powerMax:50 },
        { role:'ATTACKER', name:'ATK', powerMin:50, powerMax:50 },
        { role:'SUPPORT', name:'SUP', powerMin:50, powerMax:50 },
      ]
    };
  }

  function cloneTeam(src, isPlayer){
    const t = JSON.parse(JSON.stringify(src));
    t.isPlayer = !!isPlayer;

    // 画像パス：CPUは cpu/ にある前提（ユーザー構成）
    // ※player画像は別管理のはずなのでここでは触らない
    if (!t.isPlayer){
      const id = t.teamId;
      t.image = `cpu/${id}.png`;
    }
    return t;
  }

  // ===== Overall table (lastchance 20 teams) =====
  function newOverallRow(team){
    return {
      teamId: team.teamId,
      name: team.name,
      isPlayer: !!team.isPlayer,

      // 累計
      totalPts: 0,
      totalPlacementPts: 0,
      totalKills: 0,
      totalAssists: 0,
      totalTreasure: 0,
      totalFlag: 0,

      // 平均順位用
      sumPlace: 0,
      matches: 0,
      avgPlace: 0,
    };
  }

  function applyMatchToOverall(overallMap, matchRows){
    for (const r of (matchRows || [])){
      const key = String(r.teamId);
      const o = overallMap[key];
      if (!o) continue;

      const pp = placementPoint(Number(r.place) || 99);
      const kp = Number(r.kp || 0);
      const ap = Number(r.ap || 0);
      const tr = Number(r.treasure || 0);
      const fl = Number(r.flag || 0);

      const total = pp + kp + ap + tr + (fl * 2);

      o.totalPts += total;
      o.totalPlacementPts += pp;
      o.totalKills += kp;
      o.totalAssists += ap;
      o.totalTreasure += tr;
      o.totalFlag += fl;

      o.sumPlace += (Number(r.place) || 20);
      o.matches += 1;
      o.avgPlace = o.matches ? (o.sumPlace / o.matches) : 0;
    }
  }

  function sortOverallRows(rows){
    const a = rows.slice();

    // 同点優先順位（ユーザー確定）
    // 総合ポイント → 総合キル → 平均順位 → 総合アシスト → ランダム
    a.sort((x,y)=>{
      if (y.totalPts !== x.totalPts) return y.totalPts - x.totalPts;
      if (y.totalKills !== x.totalKills) return y.totalKills - x.totalKills;

      // avgPlace は小さい方が上
      if (x.avgPlace !== y.avgPlace) return x.avgPlace - y.avgPlace;

      if (y.totalAssists !== x.totalAssists) return y.totalAssists - x.totalAssists;

      return Math.random() < 0.5 ? -1 : 1;
    });

    // 表示順位付与
    for (let i=0; i<a.length; i++){
      a[i].rank = i + 1;
    }
    return a;
  }

  // ===== Match runner adapter =====
  function runOneMatch(teams20, opt){
    // 1) 公式の試合シミュレータがあればそれを使う
    const runner =
      window.SimMatch?.runMatch ||
      window.MOBBR?.simMatch?.runMatch ||
      null;

    if (typeof runner === 'function'){
      // 期待：{ rows:[{place,teamId,name,kp,ap,treasure,flag,...}], champion, ... }
      const out = runner(teams20, opt || {});
      const rows = out?.rows || out?.result || out?.matchRows || [];
      const champion = out?.champion || rows?.[0]?.name || '';
      return { rows, champion, raw: out };
    }

    // 2) 無い場合の暫定（UI確認用）：basePowerで重み付けして順位を作る
    const list = teams20.slice();

    // 強いほど上に来やすいシャッフル
    list.sort((a,b)=>{
      const pa = Number(a.basePower||0);
      const pb = Number(b.basePower||0);
      const wa = pa + (Math.random()*18 - 9);
      const wb = pb + (Math.random()*18 - 9);
      return wb - wa;
    });

    const rows = [];
    for (let i=0;i<list.length;i++){
      const t = list[i];
      const place = i + 1;

      // ざっくり（後で sim_match に置換される想定）
      const kp = Math.max(0, Math.floor((Math.random() * 3) + (place <= 5 ? 1 : 0) - (place >= 15 ? 1 : 0)));
      const ap = Math.max(0, Math.floor(Math.random() * 3));
      const treasure = (Math.random() < 0.12) ? 1 : 0;
      const flag = (Math.random() < 0.06) ? 1 : 0;

      rows.push({
        place,
        teamId: t.teamId,
        name: t.name,
        kp, ap, treasure, flag
      });
    }

    return { rows, champion: rows[0]?.name || '', raw: null };
  }

  // ===== PUBLIC API =====
  /**
   * initLastChance
   * @param {Object} ctx
   *   - nationalOverallRows: ナショナル最終総合（40）rows（必須）
   *       期待：[{rank or place, teamId, name, ...}]
   *   - teamResolver(optional): (teamId)=>team
   */
  SimTournamentLastChance.initLastChance = function(ctx){
    const nationalRows = ctx?.nationalOverallRows || ctx?.rows40 || ctx?.overall40 || null;
    if (!Array.isArray(nationalRows) || nationalRows.length < 28){
      console.warn('[lastchance] nationalOverallRows(40) が不足しています');
    }

    // 9〜28位 抽出（rank優先 / 無ければ place / 無ければ配列順）
    const sorted = (nationalRows || []).slice().sort((a,b)=>{
      const ra = num(a.rank ?? a.place ?? 999999);
      const rb = num(b.rank ?? b.place ?? 999999);
      return ra - rb;
    });

    const picked = sorted.slice(8, 28); // 9..28 (20 teams)
    const ids = picked.map(x => String(x.teamId || x.id || '')).filter(Boolean);

    const resolver = (typeof ctx?.teamResolver === 'function')
      ? ctx.teamResolver
      : resolveTeamById;

    const teams = ids.map(id => resolver(id));

    // overall map
    const overallMap = {};
    for (const t of teams){
      overallMap[String(t.teamId)] = newOverallRow(t);
    }

    const state = {
      phase: 'lastchance',
      matchIndex: 0,          // 0..4
      matchesTotal: MATCHES,

      teams20: teams,         // チームの固定参加者（20）
      overallMap,

      lastMatch: null,        // {rows, champion}
      done: false
    };

    return state;
  };

  /**
   * playNextMatch
   * - 1試合進める（result rows20 を返す）
   */
  SimTournamentLastChance.playNextMatch = function(state){
    if (!state || state.done) return null;

    const idx = state.matchIndex;
    if (idx >= state.matchesTotal){
      state.done = true;
      return null;
    }

    // 1試合
    const out = runOneMatch(state.teams20, { phase:'lastchance', matchIndex: idx+1 });
    const rows = Array.isArray(out.rows) ? out.rows : [];

    // 累計へ反映
    applyMatchToOverall(state.overallMap, rows);

    state.lastMatch = {
      matchNo: idx + 1,
      rows,
      champion: out.champion || ''
    };

    state.matchIndex += 1;
    if (state.matchIndex >= state.matchesTotal){
      state.done = true;
    }

    return state.lastMatch;
  };

  /**
   * getOverallRows
   * - 現在の総合順位（20）を返す
   */
  SimTournamentLastChance.getOverallRows = function(state){
    if (!state) return [];
    const rows = Object.values(state.overallMap || {});
    return sortOverallRows(rows);
  };

  /**
   * finalizeLastChance
   * - 5試合終了後の確定結果
   * - 上位2チーム（world進出）を返す
   */
  SimTournamentLastChance.finalizeLastChance = function(state){
    if (!state) return { qualified: [], eliminated: [], overall: [] };

    const overall = SimTournamentLastChance.getOverallRows(state);
    const qualified = overall.slice(0,2).map(r=>({ teamId:r.teamId, name:r.name, rank:r.rank }));
    const eliminated = overall.slice(2).map(r=>({ teamId:r.teamId, name:r.name, rank:r.rank }));

    return { qualified, eliminated, overall };
  };

  /**
   * getUiHints (任意)
   * - UI側が使う用のテキスト
   */
  SimTournamentLastChance.getUiHints = function(state){
    const m = state?.matchIndex || 0;
    const total = state?.matchesTotal || MATCHES;
    return {
      title: 'ラストチャンス',
      phase: 'lastchance',
      progressText: `第${Math.min(m+1,total)}試合 / ${total}`,
      announce: '世界への最後のチャンス！夢を掴むのは2チームのみ！'
    };
  };

  function num(v){
    const n = Number(v);
    return Number.isFinite(n) ? n : 999999;
  }

})();

