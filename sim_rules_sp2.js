/* =========================================================
   sim_rules_sp2.js (FULL)
   - スプリット2（SP2）大会ルール定義
   - 依存：
     sim_tournament_core.js -> window.SIM_TOURNAMENT_CORE
     state.js               -> window.STATE
     data_const.js          -> window.DATA_CONST
     data_teams_local.js    -> window.DATA_TEAMS_LOCAL
     data_teams_national.js -> window.DATA_TEAMS_NATIONAL
     data_teams_world.js    -> window.DATA_TEAMS_WORLD
   - このファイルの役割：
     ・SP2の「開催週」「進出条件」「進行シーケンス」をまとめる
     ・実際の試合シミュレーションは SIM_TOURNAMENT_CORE に委譲
   ========================================================= */

(() => {
  'use strict';

  const CORE = window.SIM_TOURNAMENT_CORE;
  const CONST = window.DATA_CONST;

  if (!CORE) throw new Error('SIM_TOURNAMENT_CORE not found. Load sim_tournament_core.js before sim_rules_sp2.js');

  // ---------------------------------------------
  // ヘルパ
  // ---------------------------------------------
  function safeNum(v, fb = 0) { return Number.isFinite(Number(v)) ? Number(v) : fb; }

  function getState() {
    return window.STATE || {};
  }

  function ensureTournamentStore(state, key) {
    if (!state.tournaments) state.tournaments = {};
    if (!state.tournaments[key]) {
      state.tournaments[key] = {
        lastResult: null,
        history: [],
        flags: {},
      };
    }
    return state.tournaments[key];
  }

  // ---------------------------------------------
  // 参加チーム構成（SP2）
  //
  // 7月第1週  ローカル大会（20/5試合） → 上位10がナショナルへ
  // 8月第1週  ナショナル大会（40/複数試合）→ 上位8 WF確定 / 9〜28 LC / 29〜40 敗退
  // 8月第3週  ラストチャンス（9〜28の20/5試合）→ 上位2 WFへ
  // 9月第1週  ワールドファイナル（40/複数ステージ）→ Final
  // ---------------------------------------------

  function buildLocal20TeamsForPlayer(state) {
    const playerTeam = CORE.buildPlayerTeamFromState(state);

    const locals = CORE.getLocalTeams();
    const picked = locals.slice(0, 19);

    const teamList = [playerTeam, ...picked];

    while (teamList.length < 20) {
      const idx = teamList.length;
      teamList.push({
        id: `LOCAL2_FILL_${idx}`,
        name: `ローカル補欠${idx}`,
        powerPct: 50,
        players: [],
        passive: null,
      });
    }

    return teamList.slice(0, 20);
  }

  function buildNational40TeamsForPlayer(state, qualifiedLocalTop10Names) {
    const nationals = CORE.getNationalTeams();
    const locals = CORE.getLocalTeams();
    const playerTeam = CORE.buildPlayerTeamFromState(state);

    let localQualified = [];

    if (Array.isArray(qualifiedLocalTop10Names) && qualifiedLocalTop10Names.length >= 10) {
      for (const nm of qualifiedLocalTop10Names.slice(0, 10)) {
        if (nm === playerTeam.name) {
          localQualified.push(playerTeam);
          continue;
        }
        const found = locals.find(t => t.name === nm);
        if (found) localQualified.push(found);
      }
    } else {
      localQualified = [playerTeam, ...locals.slice(0, 9)];
    }

    const national30 = nationals.slice(0, 30);

    const all = [...localQualified.slice(0, 10), ...national30];

    while (all.length < 40) {
      const idx = all.length;
      all.push({
        id: `NAT2_FILL_${idx}`,
        name: `ナショナル補欠${idx}`,
        powerPct: 55,
        players: [],
        passive: null,
      });
    }

    return all.slice(0, 40);
  }

  function buildLastChanceTeamsFromNationalRanking(nationalRanking40) {
    if (!Array.isArray(nationalRanking40) || nationalRanking40.length < 28) {
      return (Array.isArray(nationalRanking40) ? nationalRanking40.slice(0, 20) : []).map(x => ({
        id: x.teamId || x.id,
        name: x.teamName || x.name,
        powerPct: safeNum(x.powerPct, 60),
        players: [],
        passive: null,
      }));
    }

    const slice = nationalRanking40.slice(8, 28); // 9..28
    return slice.map(x => ({
      id: x.teamId || x.id,
      name: x.teamName || x.name,
      powerPct: safeNum(x.powerPct, 60),
      players: [],
      passive: null,
    }));
  }

  function buildWorldFinal40Teams(state, nationalQualifiedTop10Names) {
    const worlds = CORE.getWorldTeams();      // 30
    const nationals = CORE.getNationalTeams();// 30
    const playerTeam = CORE.buildPlayerTeamFromState(state);

    let nationalRep10 = [];

    if (Array.isArray(nationalQualifiedTop10Names) && nationalQualifiedTop10Names.length >= 10) {
      for (const nm of nationalQualifiedTop10Names.slice(0, 10)) {
        if (nm === playerTeam.name) {
          nationalRep10.push(playerTeam);
          continue;
        }
        const found = nationals.find(t => t.name === nm);
        if (found) nationalRep10.push(found);
      }
    } else {
      nationalRep10 = [playerTeam, ...nationals.slice(0, 9)];
    }

    const world30 = worlds.slice(0, 30);

    const all = [...nationalRep10.slice(0, 10), ...world30];

    while (all.length < 40) {
      const idx = all.length;
      all.push({
        id: `WF2_FILL_${idx}`,
        name: `WF補欠${idx}`,
        powerPct: 65,
        players: [],
        passive: null,
      });
    }

    return all.slice(0, 40);
  }

  function findTeamRank(ranking, teamName) {
    if (!Array.isArray(ranking)) return null;
    const row = ranking.find(r => r && r.teamName === teamName);
    return row ? safeNum(row.rank, null) : null;
  }

  // ---------------------------------------------
  // 実行API（SP2）
  // ---------------------------------------------
  function runSP2_LocalTournament(state) {
    const teams20 = buildLocal20TeamsForPlayer(state);

    const res = CORE.runTournamentGames(teams20, 5, {
      brawlChance: 0.18,
    });

    const top10 = res.ranking.slice(0, 10).map(r => r.teamName);

    const playerTeam = CORE.buildPlayerTeamFromState(state);
    const playerRank = findTeamRank(res.ranking, playerTeam.name);

    return {
      kind: 'SP2_LOCAL',
      teamsCount: 20,
      gamesCount: 5,
      ranking: res.ranking,
      topQualifiedNames: top10,
      playerRank,
      logs: res.logs,
    };
  }

  function runSP2_NationalTournament(state, localTop10Names) {
    // SP2は仕様上、SP1と同じ「6試合相当」でまとめる
    const teams40 = buildNational40TeamsForPlayer(state, localTop10Names);

    const res = CORE.runTournamentGames(teams40, 6, {
      brawlChance: 0.22,
    });

    const top8 = res.ranking.slice(0, 8).map(r => r.teamName);
    const rank9to28 = res.ranking.slice(8, 28).map(r => r.teamName);

    const playerTeam = CORE.buildPlayerTeamFromState(state);
    const playerRank = findTeamRank(res.ranking, playerTeam.name);

    let status = 'ELIMINATED';
    if (playerRank !== null) {
      if (playerRank <= 8) status = 'WORLD_FINAL_QUALIFIED';
      else if (playerRank <= 28) status = 'LAST_CHANCE_QUALIFIED';
      else status = 'ELIMINATED';
    }

    return {
      kind: 'SP2_NATIONAL',
      teamsCount: 40,
      gamesCount: 6,
      ranking: res.ranking,
      worldFinalQualifiedNames: top8,
      lastChanceQualifiedNames: rank9to28,
      playerRank,
      playerStatus: status,
      logs: res.logs,
    };
  }

  function runSP2_LastChance(state, nationalRanking40) {
    const lcTeams20 = buildLastChanceTeamsFromNationalRanking(nationalRanking40);

    const res = CORE.runTournamentGames(lcTeams20, 5, {
      brawlChance: 0.25,
    });

    const top2 = res.ranking.slice(0, 2).map(r => r.teamName);

    return {
      kind: 'SP2_LAST_CHANCE',
      teamsCount: 20,
      gamesCount: 5,
      ranking: res.ranking,
      worldFinalQualifiedNames: top2,
      logs: res.logs,
    };
  }

  function runSP2_WorldFinal(state, nationalRep10Names) {
    // SP2 WFもSP1と同様の段階式（現状は簡易Final確定まで）
    const teams40 = buildWorldFinal40Teams(state, nationalRep10Names);

    const resStage1 = CORE.runTournamentGames(teams40, 6, {
      brawlChance: 0.26,
    });

    const top20 = resStage1.ranking.slice(0, 20).map(r => r.teamName);
    const bottom20 = resStage1.ranking.slice(20, 40).map(r => r.teamName);

    const winnersTeams20 = resStage1.ranking.slice(0, 20).map(r => ({
      id: r.teamId,
      name: r.teamName,
      powerPct: 65,
      players: [],
      passive: null,
    }));

    const losersTeams20 = resStage1.ranking.slice(20, 40).map(r => ({
      id: r.teamId,
      name: r.teamName,
      powerPct: 62,
      players: [],
      passive: null,
    }));

    const resWinners = CORE.runTournamentGames(winnersTeams20, 5, {
      brawlChance: 0.28,
    });

    const resLosers = CORE.runTournamentGames(losersTeams20, 5, {
      brawlChance: 0.28,
    });

    const finalLocked10 = resWinners.ranking.slice(0, 10).map(r => r.teamName);
    const toLosers2_FromWinners10 = resWinners.ranking.slice(10, 20).map(r => r.teamName);

    const toLosers2_FromLosers10 = resLosers.ranking.slice(0, 10).map(r => r.teamName);
    const eliminated10 = resLosers.ranking.slice(10, 20).map(r => r.teamName);

    const losers2Teams20 = [...toLosers2_FromWinners10, ...toLosers2_FromLosers10].map((nm, i) => ({
      id: `SP2_L2_${i}_${nm}`,
      name: nm,
      powerPct: 63,
      players: [],
      passive: null,
    }));

    const resLosers2 = CORE.runTournamentGames(losers2Teams20, 5, {
      brawlChance: 0.30,
    });

    const toFinal10 = resLosers2.ranking.slice(0, 10).map(r => r.teamName);

    const finalTeams20 = [...finalLocked10, ...toFinal10].map((nm, i) => ({
      id: `SP2_FIN_${i}_${nm}`,
      name: nm,
      powerPct: 70,
      players: [],
      passive: null,
    }));

    const resFinal = CORE.runTournamentGames(finalTeams20, 5, {
      brawlChance: 0.32,
    });

    const champion = resFinal.ranking[0] ? resFinal.ranking[0].teamName : 'Unknown';

    return {
      kind: 'SP2_WORLD_FINAL',
      stage1: {
        teamsCount: 40,
        gamesCount: 6,
        ranking: resStage1.ranking,
        winnersNames: top20,
        losersNames: bottom20,
      },
      winners: {
        teamsCount: 20,
        gamesCount: 5,
        ranking: resWinners.ranking,
        finalLockedNames: finalLocked10,
        toLosers2Names: toLosers2_FromWinners10,
      },
      losers: {
        teamsCount: 20,
        gamesCount: 5,
        ranking: resLosers.ranking,
        toLosers2Names: toLosers2_FromLosers10,
        eliminatedNames: eliminated10,
      },
      losers2: {
        teamsCount: 20,
        gamesCount: 5,
        ranking: resLosers2.ranking,
        toFinalNames: toFinal10,
      },
      final: {
        teamsCount: 20,
        gamesCount: 5,
        ranking: resFinal.ranking,
        champion,
      },
    };
  }

  // ---------------------------------------------
  // STATEへの反映
  // ---------------------------------------------
  function saveResultToState(key, resultObj) {
    const st = getState();
    const store = ensureTournamentStore(st, key);
    store.lastResult = resultObj;
    store.history.push({
      at: Date.now(),
      result: resultObj,
    });
  }

  // ---------------------------------------------
  // Public API
  // ---------------------------------------------
  const api = {
    runLocal: () => {
      const st = getState();
      const res = runSP2_LocalTournament(st);
      saveResultToState('SP2_LOCAL', res);
      return res;
    },

    runNational: (localTop10Names) => {
      const st = getState();
      const res = runSP2_NationalTournament(st, localTop10Names);
      saveResultToState('SP2_NATIONAL', res);
      return res;
    },

    runLastChance: (nationalRanking40) => {
      const st = getState();
      const res = runSP2_LastChance(st, nationalRanking40);
      saveResultToState('SP2_LAST_CHANCE', res);
      return res;
    },

    runWorldFinal: (nationalRep10Names) => {
      const st = getState();
      const res = runSP2_WorldFinal(st, nationalRep10Names);
      saveResultToState('SP2_WORLD_FINAL', res);
      return res;
    },

    _internal: {
      runSP2_LocalTournament,
      runSP2_NationalTournament,
      runSP2_LastChance,
      runSP2_WorldFinal,
    }
  };

  Object.freeze(api);
  window.SIM_RULES_SP2 = api;
})();
