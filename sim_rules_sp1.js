/* =========================================================
   sim_rules_sp1.js (FULL)
   - スプリット1（SP1）大会ルール定義
   - 依存：
     sim_tournament_core.js -> window.SIM_TOURNAMENT_CORE
     state.js               -> window.STATE
     data_const.js          -> window.DATA_CONST
     data_teams_local.js    -> window.DATA_TEAMS_LOCAL
     data_teams_national.js -> window.DATA_TEAMS_NATIONAL
     data_teams_index.js    -> window.DATA_TEAMS_INDEX
   - このファイルの役割：
     ・SP1の「開催週」「進出条件」「進行シーケンス」をまとめる
     ・実際の試合シミュレーションは SIM_TOURNAMENT_CORE に委譲
   ========================================================= */

(() => {
  'use strict';

  const CORE = window.SIM_TOURNAMENT_CORE;
  const CONST = window.DATA_CONST;

  if (!CORE) throw new Error('SIM_TOURNAMENT_CORE not found. Load sim_tournament_core.js before sim_rules_sp1.js');

  // ---------------------------------------------
  // SP1 スケジュール（ユーザー仕様）
  //
  // 2月 第1週  ローカル大会（20チーム / 5試合）→ 総合上位10がナショナルへ
  // 3月 第1週  ナショナル大会（40チーム / 複数回戦）→ 総合上位8 WF確定 / 9〜28 LC / 29〜40 敗退
  // 3月 第3週  ラストチャンス（40チーム中 9〜28の20チームで5試合）→ 上位2がWFへ
  // 4月 第1週  スプリット1 ワールドファイナル（40チーム / 複数ステージ）
  //
  // NOTE:
  // - 本実装では「複数回戦の組み合わせ」を再現したいが、
  //   まずは「その週に大会がある/結果を返す」ことを完成させる。
  // ---------------------------------------------

  // ---------------------------------------------
  // ヘルパ
  // ---------------------------------------------
  function clamp(v, a, b) { return Math.max(a, Math.min(b, v)); }
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
  // 参加チーム構成
  // ---------------------------------------------
  function buildLocal20TeamsForPlayer(state) {
    // プレイヤー + ローカル枠から19チーム
    const playerTeam = CORE.buildPlayerTeamFromState(state);

    const locals = CORE.getLocalTeams();
    // ローカルに19居ない場合もあり得るので保険
    const picked = locals.slice(0, 19);

    const teamList = [playerTeam, ...picked];

    // もし不足なら埋め
    while (teamList.length < 20) {
      const idx = teamList.length;
      teamList.push({
        id: `LOCAL_FILL_${idx}`,
        name: `ローカル補欠${idx}`,
        powerPct: 50,
        players: [],
        passive: null,
      });
    }

    return teamList.slice(0, 20);
  }

  function buildNational40TeamsForPlayer(state, qualifiedLocalTop10Names) {
    // 仕様：
    // ナショナル大会 =
    //   ローカル総合上位10チーム
    // + ナショナル固定30チーム
    //
    // qualifiedLocalTop10Names は「ローカル結果の上位10」を想定
    const nationals = CORE.getNationalTeams();
    const localTeams = CORE.getLocalTeams();

    // ローカル上位10が渡ってきていなければ
    // プレイヤー＋ローカルから9を補う（最低限動く）
    const playerTeam = CORE.buildPlayerTeamFromState(state);

    let localQualified = [];

    if (Array.isArray(qualifiedLocalTop10Names) && qualifiedLocalTop10Names.length >= 10) {
      // 名前から探す（プレイヤー含む可能性あり）
      for (const nm of qualifiedLocalTop10Names.slice(0, 10)) {
        if (nm === playerTeam.name) {
          localQualified.push(playerTeam);
          continue;
        }
        const found = localTeams.find(t => t.name === nm);
        if (found) localQualified.push(found);
      }
    } else {
      // プレイヤーを含めた簡易枠
      localQualified = [playerTeam, ...localTeams.slice(0, 9)];
    }

    // 30ナショナル
    const national30 = nationals.slice(0, 30);

    const all = [...localQualified.slice(0, 10), ...national30];

    while (all.length < 40) {
      const idx = all.length;
      all.push({
        id: `NAT_FILL_${idx}`,
        name: `ナショナル補欠${idx}`,
        powerPct: 55,
        players: [],
        passive: null,
      });
    }

    return all.slice(0, 40);
  }

  // ラストチャンス：ナショナル総合9位〜28位（20チーム）
  function buildLastChanceTeamsFromNationalRanking(nationalRanking40) {
    if (!Array.isArray(nationalRanking40) || nationalRanking40.length < 28) {
      // fallback：上位から20
      return (Array.isArray(nationalRanking40) ? nationalRanking40.slice(0, 20) : []).map(x => ({
        id: x.teamId || x.id,
        name: x.teamName || x.name,
        powerPct: safeNum(x.powerPct, 60),
        players: [],
        passive: null,
      }));
    }

    const slice = nationalRanking40.slice(8, 28); // rank 9..28 (0-index 8..27)
    return slice.map(x => ({
      id: x.teamId || x.id,
      name: x.teamName || x.name,
      powerPct: safeNum(x.powerPct, 60),
      players: [],
      passive: null,
    }));
  }

  // ワールドファイナル：40チーム（ナショナル代表10 + ワールド30）
  function buildWorldFinal40Teams(state, nationalQualifiedTop10Names) {
    const worlds = CORE.getWorldTeams();      // 30
    const nationals = CORE.getNationalTeams();// 30（だが代表10だけ使う）

    const playerTeam = CORE.buildPlayerTeamFromState(state);

    // nationalQualifiedTop10Names はナショナル大会後に決まる想定だが、
    // 無ければ player+上位9で埋める
    let nationalRep10 = [];

    if (Array.isArray(nationalQualifiedTop10Names) && nationalQualifiedTop10Names.length >= 10) {
      // 名前→nationalTeamsから引く（プレイヤー名もありえる）
      for (const nm of nationalQualifiedTop10Names.slice(0, 10)) {
        if (nm === playerTeam.name) {
          nationalRep10.push(playerTeam);
          continue;
        }
        const foundN = nationals.find(t => t.name === nm);
        if (foundN) nationalRep10.push(foundN);
      }
    } else {
      nationalRep10 = [playerTeam, ...nationals.slice(0, 9)];
    }

    const world30 = worlds.slice(0, 30);

    const all = [...nationalRep10.slice(0, 10), ...world30];

    while (all.length < 40) {
      const idx = all.length;
      all.push({
        id: `WF_FILL_${idx}`,
        name: `WF補欠${idx}`,
        powerPct: 65,
        players: [],
        passive: null,
      });
    }

    return all.slice(0, 40);
  }

  // ---------------------------------------------
  // 進出判定
  // ---------------------------------------------
  function findTeamRank(ranking, teamName) {
    if (!Array.isArray(ranking)) return null;
    const row = ranking.find(r => r && r.teamName === teamName);
    return row ? safeNum(row.rank, null) : null;
  }

  // ---------------------------------------------
  // 実行API（SP1）
  // ---------------------------------------------
  function runSP1_LocalTournament(state) {
    // 20チーム 5試合
    const teams20 = buildLocal20TeamsForPlayer(state);

    const res = CORE.runTournamentGames(teams20, 5, {
      brawlChance: 0.18,
    });

    // 上位10
    const top10 = res.ranking.slice(0, 10).map(r => r.teamName);

    // プレイヤーの順位
    const playerTeam = CORE.buildPlayerTeamFromState(state);
    const playerRank = findTeamRank(res.ranking, playerTeam.name);

    return {
      kind: 'SP1_LOCAL',
      teamsCount: 20,
      gamesCount: 5,
      ranking: res.ranking,
      topQualifiedNames: top10,
      playerRank,
      logs: res.logs,
    };
  }

  function runSP1_NationalTournament(state, localTop10Names) {
    // 40チーム “ナショナル大会”
    // 本来は複数の組（A&B etc）だが、まず「大会全体7試合相当」でまとめる。
    // ユーザー仕様：
    // A&B / C&D / A&C / (第2週) B&C / A&D / B&D
    // = 6試合
    // さらに、ここで結果確定
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
      kind: 'SP1_NATIONAL',
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

  function runSP1_LastChance(state, nationalRanking40) {
    // 出場：9〜28位の20チーム
    const lcTeams20 = buildLastChanceTeamsFromNationalRanking(nationalRanking40);

    const res = CORE.runTournamentGames(lcTeams20, 5, {
      brawlChance: 0.25,
    });

    const top2 = res.ranking.slice(0, 2).map(r => r.teamName);
    return {
      kind: 'SP1_LAST_CHANCE',
      teamsCount: 20,
      gamesCount: 5,
      ranking: res.ranking,
      worldFinalQualifiedNames: top2,
      logs: res.logs,
    };
  }

  function runSP1_WorldFinal(state, nationalRep10Names) {
    // 40チーム
    // 本来の流れ：
    // 20チームずつ A&B / C&D / A&C / B&D / A&D / B&C （6試合）
    // →上位20 Winners/下位20 Losers
    // →Winners 5試合 / Losers 5試合 / Losers2 5試合
    // →Final（50点灯/チャンピオン獲得で優勝確定）
    //
    // 現状は「段階を分けて返せる設計」にしておき、
    // 最低限は 6試合+各5試合+Final無限 を後で拡張できるようにする。
    const teams40 = buildWorldFinal40Teams(state, nationalRep10Names);

    // まず「予選6試合」
    const resStage1 = CORE.runTournamentGames(teams40, 6, {
      brawlChance: 0.26,
    });

    const top20 = resStage1.ranking.slice(0, 20).map(r => r.teamName);
    const bottom20 = resStage1.ranking.slice(20, 40).map(r => r.teamName);

    // Winners / Losers をそれぞれ 5試合
    // NOTE: 本当は同じ40チームから振り分けた上でその中だけで再度20チーム戦
    // ただしCOREは20/40対応なので、ここでは Winners 20 / Losers 20 で回す

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

    // Winners上位10 = Final確定
    const finalLocked10 = resWinners.ranking.slice(0, 10).map(r => r.teamName);
    // Winners下位10 = Losers2へ
    const toLosers2_FromWinners10 = resWinners.ranking.slice(10, 20).map(r => r.teamName);

    // Losers上位10 = Losers2へ
    const toLosers2_FromLosers10 = resLosers.ranking.slice(0, 10).map(r => r.teamName);
    // Losers下位10 = 敗退
    const eliminated10 = resLosers.ranking.slice(10, 20).map(r => r.teamName);

    // Losers2 20チーム（Winners下位10 + Losers上位10）
    const losers2Teams20 = [...toLosers2_FromWinners10, ...toLosers2_FromLosers10].map((nm, i) => ({
      id: `L2_${i}_${nm}`,
      name: nm,
      powerPct: 63,
      players: [],
      passive: null,
    }));

    const resLosers2 = CORE.runTournamentGames(losers2Teams20, 5, {
      brawlChance: 0.30,
    });

    // Losers2上位10 = Finalへ
    const toFinal10 = resLosers2.ranking.slice(0, 10).map(r => r.teamName);

    // Finalは「50点灯＋チャンピオン獲得で優勝」だが、
    // 現時点は未実装のため、Final参加20をまとめて5試合で仮決定
    const finalTeams20 = [...finalLocked10, ...toFinal10].map((nm, i) => ({
      id: `FIN_${i}_${nm}`,
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
      kind: 'SP1_WORLD_FINAL',
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
      // ログは肥大するので必要時のみ
    };
  }

  // ---------------------------------------------
  // STATEへの反映（共通）
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
    // Local / National / LastChance / WF
    runLocal: () => {
      const st = getState();
      const res = runSP1_LocalTournament(st);
      saveResultToState('SP1_LOCAL', res);
      return res;
    },

    runNational: (localTop10Names) => {
      const st = getState();
      const res = runSP1_NationalTournament(st, localTop10Names);
      saveResultToState('SP1_NATIONAL', res);
      return res;
    },

    runLastChance: (nationalRanking40) => {
      const st = getState();
      const res = runSP1_LastChance(st, nationalRanking40);
      saveResultToState('SP1_LAST_CHANCE', res);
      return res;
    },

    runWorldFinal: (nationalRep10Names) => {
      const st = getState();
      const res = runSP1_WorldFinal(st, nationalRep10Names);
      saveResultToState('SP1_WORLD_FINAL', res);
      return res;
    },

    // low-level
    _internal: {
      runSP1_LocalTournament,
      runSP1_NationalTournament,
      runSP1_LastChance,
      runSP1_WorldFinal,
    }
  };

  Object.freeze(api);
  window.SIM_RULES_SP1 = api;
})();
