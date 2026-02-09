/* =========================================================
   MOB BR - sim_tournament_world.js (FULL)
   - ワールドファイナル（40チーム）専用フェーズ
   - グループ予選(AB/CD→AC/BD→AD/BC) 各5試合
   - 予選総合40位まで確定 → 上位20=Winners / 下位20=Losers
   - Winners(20) 5試合 → 上位10=FINAL / 下位10=Losers2へ
   - Losers(20)  5試合 → 上位10=Losers2 / 下位10=敗退
   - Losers2(20) 5試合 → 上位10=FINAL / 下位10=敗退
   ---------------------------------------------------------
   1試合ごとに：
   ・result(20) を返す
   ・そのブロックの「現在( n/5 )総合順位(20)」を返す
   ---------------------------------------------------------
   依存（あれば使う）：
   - window.DataCPU.getById(teamId)
   - window.DataPlayer.getTeam() / window.MOBBR.data.player 等（プレイヤーチーム取得）
   - window.SimMatch.runMatch(teams, opt)  ※あれば優先
========================================================= */

(function(){
  'use strict';

  const SimTournamentWorld = {};
  window.SimTournamentWorld = SimTournamentWorld;

  const GROUP_MATCHES_PER_BLOCK = 5;
  const STAGE_MATCHES = 5;

  // ===== 順位ポイント（ユーザー確定）=====
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
  function resolvePlayerTeam(){
    return (
      window.DataPlayer?.getTeam?.() ||
      window.MOBBR?.data?.player?.team ||
      window.MOBBR?.data?.playerTeam ||
      null
    );
  }

  function resolveTeamById(teamId){
    const id = String(teamId || '');

    // player
    const p = resolvePlayerTeam();
    if (p && String(p.teamId) === id){
      return cloneTeam(p, true);
    }

    // cpu
    const cpu = window.DataCPU?.getById?.(id) || null;
    if (cpu) return cloneTeam(cpu, false);

    // fallback
    return {
      isPlayer: false,
      teamId: id,
      name: id || 'TEAM',
      image: `cpu/${id}.png`,
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

    // CPU画像は cpu/（ユーザー構成）
    if (!t.isPlayer){
      const id = t.teamId;
      t.image = `cpu/${id}.png`;
    }
    return t;
  }

  // ===== Overall helpers =====
  function newOverallRow(team){
    return {
      teamId: String(team.teamId),
      name: team.name,
      isPlayer: !!team.isPlayer,

      totalPts: 0,
      totalPlacementPts: 0,
      totalKills: 0,
      totalAssists: 0,
      totalTreasure: 0,
      totalFlag: 0,

      sumPlace: 0,
      matches: 0,
      avgPlace: 0,

      rank: 0
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
      if (x.avgPlace !== y.avgPlace) return x.avgPlace - y.avgPlace; // 小さいほど上
      if (y.totalAssists !== x.totalAssists) return y.totalAssists - x.totalAssists;
      return Math.random() < 0.5 ? -1 : 1;
    });

    for (let i=0; i<a.length; i++) a[i].rank = i + 1;
    return a;
  }

  function buildOverall20(overallMap, teamIds20){
    const rows = [];
    for (const id of teamIds20){
      const r = overallMap[String(id)];
      if (r) rows.push(r);
    }
    return sortOverallRows(rows);
  }

  // ===== Match runner adapter =====
  function runOneMatch(teams20, opt){
    const runner =
      window.SimMatch?.runMatch ||
      window.MOBBR?.simMatch?.runMatch ||
      null;

    if (typeof runner === 'function'){
      const out = runner(teams20, opt || {});
      const rows = out?.rows || out?.result || out?.matchRows || [];
      const champion = out?.champion || rows?.[0]?.name || '';
      return { rows, champion, raw: out };
    }

    // 暫定（UI確認用）
    const list = teams20.slice();
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

      const kp = Math.max(0, Math.floor((Math.random() * 3) + (place <= 5 ? 1 : 0) - (place >= 15 ? 1 : 0)));
      const ap = Math.max(0, Math.floor(Math.random() * 3));
      const treasure = (Math.random() < 0.12) ? 1 : 0;
      const flag = (Math.random() < 0.06) ? 1 : 0;

      rows.push({ place, teamId: t.teamId, name: t.name, kp, ap, treasure, flag });
    }

    return { rows, champion: rows[0]?.name || '', raw: null };
  }

  // ===== Grouping =====
  function shuffleInPlace(a){
    for (let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      const t=a[i]; a[i]=a[j]; a[j]=t;
    }
  }

  function makeGroups40(allTeams40){
    const player = allTeams40.find(t => t.isPlayer) || null;
    if (!player){
      console.warn('[world] プレイヤーチームが40内にいません（teamId指定を確認）');
    }

    const others = allTeams40.filter(t => !t.isPlayer);
    shuffleInPlace(others);

    // Aはプレイヤー固定 +9
    const A = [];
    if (player) A.push(player);
    while (A.length < 10 && others.length) A.push(others.shift());

    const B = others.splice(0,10);
    const C = others.splice(0,10);
    const D = others.splice(0,10);

    // 念のため（不足時）埋める
    while (B.length < 10 && others.length) B.push(others.shift());
    while (C.length < 10 && others.length) C.push(others.shift());
    while (D.length < 10 && others.length) D.push(others.shift());

    return { A, B, C, D };
  }

  function idsOf(list){ return (list||[]).map(t=>String(t.teamId)); }

  // ===== Schedule =====
  const GROUP_BLOCKS = [
    { stage:'groups', label:'予選リーグ1', matchup:'A&B', left:'A', right:'B', matches: GROUP_MATCHES_PER_BLOCK },
    { stage:'groups', label:'予選リーグ1', matchup:'C&D', left:'C', right:'D', matches: GROUP_MATCHES_PER_BLOCK },

    { stage:'groups', label:'予選リーグ2', matchup:'A&C', left:'A', right:'C', matches: GROUP_MATCHES_PER_BLOCK },
    { stage:'groups', label:'予選リーグ2', matchup:'B&D', left:'B', right:'D', matches: GROUP_MATCHES_PER_BLOCK },

    { stage:'groups', label:'予選リーグ3', matchup:'A&D', left:'A', right:'D', matches: GROUP_MATCHES_PER_BLOCK },
    { stage:'groups', label:'予選リーグ3', matchup:'B&C', left:'B', right:'C', matches: GROUP_MATCHES_PER_BLOCK },
  ];

  // ===== PUBLIC API =====
  /**
   * initWorld
   * @param {Object} ctx
   *   - qualifiedTeamIds: 10チーム（ナショナル代表10） teamId配列
   *   - worldPoolIds: 30チーム（world01〜world40等） teamId配列
   *   - playerTeamId(optional): 明示したい場合
   *   - teamResolver(optional): (teamId)=>team
   */
  SimTournamentWorld.initWorld = function(ctx){
    const resolver = (typeof ctx?.teamResolver === 'function') ? ctx.teamResolver : resolveTeamById;

    const q10 = Array.isArray(ctx?.qualifiedTeamIds) ? ctx.qualifiedTeamIds.map(String) : [];
    const w30 = Array.isArray(ctx?.worldPoolIds) ? ctx.worldPoolIds.map(String) : [];

    const allIds = q10.concat(w30);
    if (allIds.length !== 40){
      console.warn(`[world] 40チーム必要です（現在 ${allIds.length}） qualified10 + world30 を確認してください`);
    }

    // チーム生成
    const teams40 = allIds.slice(0,40).map(id => resolver(id));

    // プレイヤー固定（teamId指定があれば優先）
    const explicitPlayerId = ctx?.playerTeamId ? String(ctx.playerTeamId) : null;
    if (explicitPlayerId){
      for (const t of teams40){
        t.isPlayer = (String(t.teamId) === explicitPlayerId);
      }
    }else{
      // 既に player チームが resolver で isPlayer=true になってる想定
      // もし無いなら、resolvePlayerTeam が含まれてるかだけは確認
      const p = resolvePlayerTeam();
      if (p){
        const pid = String(p.teamId);
        for (const t of teams40){
          if (String(t.teamId) === pid) t.isPlayer = true;
        }
      }
    }

    const groups = makeGroups40(teams40);

    // 予選の総合（40）は全員同じテーブルで積む
    const overall40Map = {};
    for (const t of teams40){
      overall40Map[String(t.teamId)] = newOverallRow(t);
    }

    const state = {
      phase: 'world',

      // 40
      teams40,
      groups,                 // {A,B,C,D} each team objects
      overall40Map,

      // グループ予選進行
      blockIndex: 0,          // 0..GROUP_BLOCKS-1
      matchInBlock: 0,        // 0..4
      matchGlobal: 0,         // 累計

      // 現在ブロックの20IDs
      currentBlockTeamIds: [],

      // 勝ち上がりフェーズ
      subPhase: 'groups',     // groups -> winners -> losers -> losers2 -> done
      stage20: null,          // { name, teamIds20, overallMap20, matchIndex }
      winnersSeed: null,      // { winners20Ids, losers20Ids }
      finalTeams20: null,     // teamId[20]

      lastMatch: null,
      done: false
    };

    // 初期ブロックセット
    setCurrentGroupBlock20(state);

    return state;
  };

  function setCurrentGroupBlock20(state){
    const blk = GROUP_BLOCKS[state.blockIndex];
    if (!blk) { state.currentBlockTeamIds = []; return; }

    const leftTeams = state.groups[blk.left] || [];
    const rightTeams = state.groups[blk.right] || [];
    const ids20 = idsOf(leftTeams).concat(idsOf(rightTeams));
    state.currentBlockTeamIds = ids20;
  }

  function getCurrentGroupTeams20(state){
    const ids20 = state.currentBlockTeamIds || [];
    const byId = new Map(state.teams40.map(t => [String(t.teamId), t]));
    return ids20.map(id => byId.get(String(id))).filter(Boolean);
  }

  function getStageTeams20(state){
    const ids20 = state.stage20?.teamIds20 || [];
    const byId = new Map(state.teams40.map(t => [String(t.teamId), t]));
    return ids20.map(id => byId.get(String(id))).filter(Boolean);
  }

  function initStage20(state, name, teamIds20){
    const byId = new Map(state.teams40.map(t => [String(t.teamId), t]));
    const map20 = {};
    for (const id of teamIds20){
      const t = byId.get(String(id));
      if (t) map20[String(id)] = newOverallRow(t);
    }
    state.stage20 = {
      name,
      teamIds20: teamIds20.slice(),
      overallMap20: map20,
      matchIndex: 0
    };
  }

  function finalizeStage20(state){
    const st = state.stage20;
    if (!st) return [];
    const rows = sortOverallRows(Object.values(st.overallMap20 || {}));
    return rows;
  }

  /**
   * playNext
   * - 1試合進める（world全体を通して）
   * return:
   *  {
   *    subPhase,
   *    blockLabel, matchup,
   *    matchNoInBlock, matchesInBlock,
   *    matchNoGlobal,
   *    resultRows20,
   *    blockOverall20,
   *    overall40(optional),
   *    stageOverall20(optional),
   *  }
   */
  SimTournamentWorld.playNext = function(state){
    if (!state || state.done) return null;

    // ===== グループ予選 =====
    if (state.subPhase === 'groups'){
      const blk = GROUP_BLOCKS[state.blockIndex];
      if (!blk){
        // 予選終了→Winners/Losersへ
        const overall40 = SimTournamentWorld.getOverall40(state);
        const winners20 = overall40.slice(0,20).map(r=>r.teamId);
        const losers20 = overall40.slice(20).map(r=>r.teamId);
        state.winnersSeed = { winners20Ids: winners20, losers20Ids: losers20 };

        initStage20(state, 'Winners', winners20);
        state.subPhase = 'winners';
        return SimTournamentWorld.playNext(state);
      }

      const teams20 = getCurrentGroupTeams20(state);
      const out = runOneMatch(teams20, {
        phase:'world',
        subPhase:'groups',
        block: blk.matchup,
        blockLabel: blk.label,
        matchNoInBlock: state.matchInBlock + 1,
        matchNoGlobal: state.matchGlobal + 1
      });

      const rows20 = Array.isArray(out.rows) ? out.rows : [];

      // 予選は overall40Map に積む
      applyMatchToOverall(state.overall40Map, rows20);

      state.lastMatch = {
        subPhase:'groups',
        blockLabel: blk.label,
        matchup: blk.matchup,
        matchNoInBlock: state.matchInBlock + 1,
        matchesInBlock: blk.matches,
        matchNoGlobal: state.matchGlobal + 1,
        rows: rows20
      };

      state.matchInBlock += 1;
      state.matchGlobal += 1;

      // ブロックの現在総合（20）
      const blockOverall20 = buildOverall20(state.overall40Map, state.currentBlockTeamIds);

      // ブロック終了→次ブロックへ
      if (state.matchInBlock >= blk.matches){
        state.blockIndex += 1;
        state.matchInBlock = 0;
        setCurrentGroupBlock20(state);
      }

      return {
        subPhase: 'groups',
        blockLabel: blk.label,
        matchup: blk.matchup,
        matchNoInBlock: state.lastMatch.matchNoInBlock,
        matchesInBlock: blk.matches,
        matchNoGlobal: state.lastMatch.matchNoGlobal,
        resultRows20: rows20,
        blockOverall20,
        overall40: SimTournamentWorld.getOverall40(state)
      };
    }

    // ===== Winners / Losers / Losers2（各20チーム）=====
    if (state.subPhase === 'winners' || state.subPhase === 'losers' || state.subPhase === 'losers2'){
      const st = state.stage20;
      if (!st){
        state.done = true;
        return null;
      }

      if (st.matchIndex >= STAGE_MATCHES){
        // この20ステージを締める
        const stageRows = finalizeStage20(state);

        if (state.subPhase === 'winners'){
          const top10 = stageRows.slice(0,10).map(r=>r.teamId);
          const bottom10 = stageRows.slice(10).map(r=>r.teamId);

          // 次は Losers（別20を5試合）
          initStage20(state, 'Losers', state.winnersSeed?.losers20Ids || []);
          state._winnersToFinal10 = top10;
          state._winnersToLosers2_10 = bottom10;
          state.subPhase = 'losers';
          return SimTournamentWorld.playNext(state);
        }

        if (state.subPhase === 'losers'){
          const top10 = stageRows.slice(0,10).map(r=>r.teamId);
          const bottom10 = stageRows.slice(10).map(r=>r.teamId);

          // Losers2 20チーム = Winners下位10 + Losers上位10
          const losers2Ids = (state._winnersToLosers2_10 || []).concat(top10);

          initStage20(state, 'Losers2', losers2Ids);
          state._losersEliminated10 = bottom10;
          state.subPhase = 'losers2';
          return SimTournamentWorld.playNext(state);
        }

        if (state.subPhase === 'losers2'){
          const top10 = stageRows.slice(0,10).map(r=>r.teamId);
          const bottom10 = stageRows.slice(10).map(r=>r.teamId);

          // FINAL 20 = Winners上位10 + Losers2上位10
          const final20 = (state._winnersToFinal10 || []).concat(top10);
          state.finalTeams20 = final20;

          state._losers2Eliminated10 = bottom10;
          state.subPhase = 'done';
          state.done = true;

          return {
            subPhase: 'done',
            finalTeams20: final20.slice(),
            eliminated: {
              losers10: (state._losersEliminated10 || []).slice(),
              losers2_10: bottom10.slice()
            },
            note: 'FINALは sim_tournament_final.js で処理'
          };
        }
      }

      // 1試合
      const teams20 = getStageTeams20(state);
      const out = runOneMatch(teams20, {
        phase:'world',
        subPhase: state.subPhase,
        stage: st.name,
        matchNoInStage: st.matchIndex + 1
      });

      const rows20 = Array.isArray(out.rows) ? out.rows : [];

      // stage20Map に積む（この20内の総合）
      applyMatchToOverall(st.overallMap20, rows20);

      const stageOverall20 = buildOverall20(st.overallMap20, st.teamIds20);

      const matchNoInBlock = st.matchIndex + 1;
      st.matchIndex += 1;

      return {
        subPhase: state.subPhase,
        blockLabel: st.name,
        matchup: st.name,
        matchNoInBlock,
        matchesInBlock: STAGE_MATCHES,
        matchNoGlobal: null,
        resultRows20: rows20,
        blockOverall20: stageOverall20,
        overall40: (state.subPhase === 'winners' || state.subPhase === 'losers' || state.subPhase === 'losers2')
          ? null
          : null
      };
    }

    // done
    state.done = true;
    return null;
  };

  SimTournamentWorld.getOverall40 = function(state){
    if (!state) return [];
    return sortOverallRows(Object.values(state.overall40Map || {}));
  };

  SimTournamentWorld.getFinalTeams20 = function(state){
    return (state?.finalTeams20 || []).slice();
  };

  SimTournamentWorld.getGroups = function(state){
    if (!state?.groups) return null;
    return {
      A: idsOf(state.groups.A),
      B: idsOf(state.groups.B),
      C: idsOf(state.groups.C),
      D: idsOf(state.groups.D),
    };
  };

  SimTournamentWorld.getUiHints = function(state){
    if (!state) return { title:'ワールドファイナル', phase:'world' };

    if (state.subPhase === 'groups'){
      const blk = GROUP_BLOCKS[state.blockIndex] || null;
      return {
        title: 'ワールドファイナル',
        phase: 'world',
        subPhase: 'groups',
        label: blk ? blk.label : '予選リーグ',
        matchup: blk ? blk.matchup : '',
        progressText: blk ? `第${Math.min(state.matchInBlock+1, blk.matches)}試合 / ${blk.matches}` : ''
      };
    }

    if (state.subPhase === 'winners'){
      return { title:'ワールドファイナル', phase:'world', subPhase:'winners', label:'Winners', progressText:`第${Math.min(state.stage20.matchIndex+1,5)}試合 / 5` };
    }
    if (state.subPhase === 'losers'){
      return { title:'ワールドファイナル', phase:'world', subPhase:'losers', label:'Losers', progressText:`第${Math.min(state.stage20.matchIndex+1,5)}試合 / 5` };
    }
    if (state.subPhase === 'losers2'){
      return { title:'ワールドファイナル', phase:'world', subPhase:'losers2', label:'Losers2', progressText:`第${Math.min(state.stage20.matchIndex+1,5)}試合 / 5` };
    }

    return { title:'ワールドファイナル', phase:'world', subPhase:'done', label:'FINAL待ち' };
  };

})();

