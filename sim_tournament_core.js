/* =========================================================
   sim_tournament_core.js (FULL)
   - 大会シミュレーション共通コア（ローカル/ナショナル/ワールドファイナル）
   - 依存：
     state.js                 -> window.STATE (最低限の参照)
     data_const.js            -> window.DATA_CONST
     data_teams_index.js      -> window.DATA_TEAMS_INDEX（チーム名→所属カテゴリ等）
     data_teams_local.js      -> window.DATA_TEAMS_LOCAL
     data_teams_national.js   -> window.DATA_TEAMS_NATIONAL
     data_teams_world.js      -> window.DATA_TEAMS_WORLD
     data_players.js          -> window.DATA_PLAYERS
     sim_battle.js            -> window.SIM_BATTLE.runBattle
   - NOTE:
     ・ここは「大会の枠組み」と「総合順位計算」を担う
     ・ラストチャンスやWinners/Losers等のルール詳細は sim_rules_sp1/sp2/champ 側に寄せる
     ・ただし「5試合終了後に総合順位を出す」等の共通操作はここでも提供
   ========================================================= */

(() => {
  'use strict';

  const CONST = window.DATA_CONST;
  const SIM_BATTLE = window.SIM_BATTLE;
  const TEAMS_LOCAL = window.DATA_TEAMS_LOCAL;
  const TEAMS_NATIONAL = window.DATA_TEAMS_NATIONAL;
  const TEAMS_WORLD = window.DATA_TEAMS_WORLD;
  const TEAMS_INDEX = window.DATA_TEAMS_INDEX;
  const PLAYERS = window.DATA_PLAYERS;

  if (!CONST) throw new Error('DATA_CONST not found. Load data_const.js before sim_tournament_core.js');
  if (!SIM_BATTLE || !SIM_BATTLE.runBattle) throw new Error('SIM_BATTLE.runBattle not found. Load sim_battle.js before sim_tournament_core.js');

  // TEAMS_* は「未実装でも起動はできる」ように、存在しない場合は空にしておく
  // ただし本番では必須
  const SAFE_LOCAL = TEAMS_LOCAL || { teams: [] };
  const SAFE_NATIONAL = TEAMS_NATIONAL || { teams: [] };
  const SAFE_WORLD = TEAMS_WORLD || { teams: [] };
  const SAFE_INDEX = TEAMS_INDEX || {};

  // --------------------------
  // Utils
  // --------------------------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rInt = (a, b) => (a + Math.floor(Math.random() * (b - a + 1)));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];
  const safeNum = (v, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback);

  function shuffle(arr) {
    const a = arr.slice();
    for (let i = a.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [a[i], a[j]] = [a[j], a[i]];
    }
    return a;
  }

  function deepCopy(obj) {
    return JSON.parse(JSON.stringify(obj));
  }

  // --------------------------
  // Team definitions normalize
  // --------------------------
  // 期待するチーム構造（最低限）
  // {
  //   id: 'TEAM_xxx',
  //   name: 'ハンマーズ',
  //   powerPct: 79,   // 強さ%（UI用）
  //   roster: ['キスケ','ヅッチー','ブラウン'] または players:[{...},...]
  //   passive: {...} optional
  // }
  function normalizeTeamDef(teamDef, fallbackPrefix = 'TEAM') {
    const t = teamDef || {};
    const id = t.id || `${fallbackPrefix}_${t.name || 'UNKNOWN'}_${rInt(1000, 9999)}`;
    const name = t.name || 'Unknown Team';

    // roster resolving
    // data_teams_xxx.js 側が rosterName 配列でも良いし、players配列でも良い
    let rosterDefs = [];
    if (Array.isArray(t.players) && t.players.length > 0) {
      rosterDefs = t.players;
    } else if (Array.isArray(t.roster) && t.roster.length > 0) {
      // roster が string 名なら data_players から引く
      rosterDefs = t.roster.map(nm => resolvePlayerByName(nm));
    } else {
      // もし無い場合は placeholder 3人
      rosterDefs = [
        makePlaceholderPlayer(`${name} A`),
        makePlaceholderPlayer(`${name} B`),
        makePlaceholderPlayer(`${name} C`),
      ];
    }

    return {
      id,
      name,
      powerPct: safeNum(t.powerPct, safeNum(t.pct, 50)),
      passive: t.passive || null,
      players: rosterDefs,
      // category
      category: t.category || null,
    };
  }

  function resolvePlayerByName(name) {
    if (!PLAYERS) return makePlaceholderPlayer(name);

    // 想定：
    // DATA_PLAYERS.byName[name] があれば使う
    if (PLAYERS.byName && PLAYERS.byName[name]) return PLAYERS.byName[name];

    // もしくは配列から検索
    if (Array.isArray(PLAYERS.players)) {
      const found = PLAYERS.players.find(p => p && p.name === name);
      if (found) return found;
    }

    // 無ければ placeholder
    return makePlaceholderPlayer(name);
  }

  function makePlaceholderPlayer(name) {
    // 戦闘が成立する最低限 stats
    return {
      id: `PL_${String(name).replace(/\s+/g, '_')}_${rInt(1000, 9999)}`,
      name,
      stats: {
        HP: 100,
        Armor: 100,
        Mental: 50,
        Move: 2,
        Aim: 70,
        Agility: 30,
        Technique: 10,
        Support: 3,
        Hunt: 3,
      },
      passive: null,
      ability: null,
      ult: null,
    };
  }

  // --------------------------
  // Scoring model for tournament
  // --------------------------
  // APEX風だが「未実装部分もある」前提で、現状は「順位＋キルpt」で総合を決める。
  // ※仕様が固まり次第 data_const に寄せることも可能
  const DEFAULT_PLACEMENT_POINTS_20 = [
    // 20チーム順位ポイント（仮）
    // 1位50pt点灯ルールはファイナル向けだが、通常はもっと低いでもOK。
    // ここは「大会総合順位を出すための土台」。強すぎない設計にしておく。
    12, 9, 7, 5, 4,
    3, 3, 2, 2, 2,
    1, 1, 1, 0, 0,
    0, 0, 0, 0, 0,
  ];

  const DEFAULT_PLACEMENT_POINTS_40 = [
    // 40チーム順位ポイント（仮）
    12, 9, 7, 6, 5,
    4, 4, 3, 3, 3,
    2, 2, 2, 2, 2,
    1, 1, 1, 1, 1,
    0, 0, 0, 0, 0,
    0, 0, 0, 0, 0,
    0, 0, 0, 0, 0,
    0, 0, 0, 0, 0,
  ];

  // キルポイント：戦闘仕様と同じ 1キル=2pt、アシスト=1pt
  // 大会の「キルpt」は基本キルのみで良いが、ここは合計にしておく
  function calcKillPointsFromBattlePoints(battlePointsObj) {
    // battlePointsObj = { kill:{name:points}, assist:{name:points} }
    // ただし、sim_battleは「キル2pt/アシスト1pt」を既に pointとして返す
    // ここはチーム合計で足す
    const kill = battlePointsObj && battlePointsObj.kill ? battlePointsObj.kill : {};
    const assist = battlePointsObj && battlePointsObj.assist ? battlePointsObj.assist : {};

    let sum = 0;
    for (const k in kill) sum += safeNum(kill[k], 0);
    for (const a in assist) sum += safeNum(assist[a], 0);
    return sum;
  }

  // --------------------------
  // Match simulation (one "game" of BR)
  // --------------------------
  // BR本来は全20チームが同時に戦って順位が決まるが、
  // 現時点（簡易版）では「複数戦闘ログを積んで最後に生存順位を作る」方式にする。
  //
  // ここでは
  // 1) 初期生存：全チーム alive
  // 2) ランダムに同エリア遭遇→戦闘（2 or 3チーム）
  // 3) 戦闘で負けたチームは脱落
  // 4) これを繰り返し最終順位を作る
  //
  // ※マップ移動やアンチ等の詳細は game.js 側で演出する想定。
  function simulateOneBRGame(teamList, options = {}) {
    const maxBrawlChance = clamp(safeNum(options.brawlChance, 0.18), 0, 0.35); // 乱戦頻度
    const maxLoop = 200;

    const gameLog = [];
    const aliveTeams = teamList.map(t => ({
      ...t,
      eliminated: false,
      elimOrder: null, // 1が最初に落ちた等
    }));

    // チームの累計キルpt（この1試合内）
    const teamKillPts = Object.create(null);

    for (const t of aliveTeams) {
      teamKillPts[t.id] = 0;
    }

    let eliminatedCount = 0;

    function log(s) {
      gameLog.push(String(s));
    }

    // 簡易遭遇ループ
    for (let step = 1; step <= maxLoop; step++) {
      const survivors = aliveTeams.filter(t => !t.eliminated);
      if (survivors.length <= 1) break;

      // 2 or 3チーム抽選
      const doBrawl = (survivors.length >= 3) && (Math.random() < maxBrawlChance);

      const involved = shuffle(survivors).slice(0, doBrawl ? 3 : 2);

      log(`遭遇！ ${involved.map(t => t.name).join(' / ')} が交戦！`);

      // rosters build
      const rosterMap = {};
      for (const tm of involved) {
        rosterMap[tm.id] = tm.players;
      }

      const battleRes = SIM_BATTLE.runBattle(
        involved.map(x => ({ id: x.id, name: x.name, passive: x.passive })),
        rosterMap,
        {
          // 武器/インベントリはここでは未固定（game側で注入可能）
        }
      );

      // 生存判定：battleRes.fighters の alive をもとにチーム全滅を落とす
      // winnerTeamId が null の場合は、両者が残ってる可能性もあるので fighters を確認
      const aliveByTeam = Object.create(null);
      for (const f of battleRes.fighters) {
        if (!aliveByTeam[f.teamId]) aliveByTeam[f.teamId] = 0;
        if (f.alive) aliveByTeam[f.teamId] += 1;
      }

      // この戦闘のキルptを各チームに加算（簡易）
      // sim_battle の points は fighterベースなので、チームに寄せる
      // ※ここは後で「誰がどのチームか」を持たせたらより正確にできる
      // 今回は battleRes.points を「戦闘全体の熱量」として勝者側に多め付与するのは禁止
      // → fighterIDまで追えないため、ここでは「戦闘発生＝小pt加算」ではなく 0 にする手もある。
      // ただ、総合にキル要素が必要なので、ここは battleRes.points の合計を involved 全員に均等配分しない。
      // 代わりに、各戦闘の結果で「落とした側」が存在するなら勝者だけ加算。
      const battleKillPts = calcKillPointsFromBattlePoints(battleRes.points);

      if (battleRes.winnerTeamId) {
        teamKillPts[battleRes.winnerTeamId] = safeNum(teamKillPts[battleRes.winnerTeamId], 0) + battleKillPts;
      }

      // elimination
      for (const tm of involved) {
        const cnt = safeNum(aliveByTeam[tm.id], 0);
        if (cnt <= 0 && !tm.eliminated) {
          tm.eliminated = true;
          eliminatedCount += 1;
          tm.elimOrder = eliminatedCount;
          log(`${tm.name} チーム全滅！`);
        }
      }
    }

    // 最終順位作成
    const survivors = aliveTeams.filter(t => !t.eliminated);
    if (survivors.length === 1) {
      log(`勝者：${survivors[0].name}！`);
    } else if (survivors.length > 1) {
      // 引き分け的に複数残った場合：powerPctで決める（簡易）
      survivors.sort((a, b) => (b.powerPct - a.powerPct));
      log(`時間切れ：暫定勝者 ${survivors[0].name}`);
    }

    // ranking: last survivor is rank 1
    // eliminatedOrder: 1 = first eliminated => rank = N
    // survivors: those not eliminated are top ranks
    const N = aliveTeams.length;
    const ranking = [];

    // survivors first (higher placement)
    if (survivors.length > 0) {
      // survivorsを強さ順で並べて上位扱い
      const srt = survivors.slice().sort((a, b) => (b.powerPct - a.powerPct));
      for (const t of srt) ranking.push(t);
    }

    // eliminated teams: last eliminated is better (higher placement)
    const eliminated = aliveTeams.filter(t => t.eliminated);
    eliminated.sort((a, b) => (b.elimOrder - a.elimOrder)); // later elimination is higher rank
    for (const t of eliminated) ranking.push(t);

    // assign final placements
    const placements = [];
    for (let i = 0; i < ranking.length; i++) {
      const t = ranking[i];
      placements.push({
        teamId: t.id,
        teamName: t.name,
        place: i + 1,
        killPts: safeNum(teamKillPts[t.id], 0),
      });
    }

    return {
      log: gameLog,
      placements,
      teamsCount: N,
    };
  }

  // --------------------------
  // Tournament runner
  // --------------------------
  // runTournamentGames:
  // - teamList: 20 or 40 team defs
  // - gamesCount: 5 etc
  function runTournamentGames(teamList, gamesCount, options = {}) {
    const teams = teamList.map(t => normalizeTeamDef(t, 'TEAM'));

    const total = Object.create(null); // teamId -> score object

    for (const t of teams) {
      total[t.id] = {
        teamId: t.id,
        teamName: t.name,
        totalPoints: 0,
        placementPoints: 0,
        killPoints: 0,
        games: [],
      };
    }

    const allLogs = [];

    const placementTable = (teams.length === 40)
      ? (options.placementPoints40 || DEFAULT_PLACEMENT_POINTS_40)
      : (options.placementPoints20 || DEFAULT_PLACEMENT_POINTS_20);

    for (let g = 1; g <= gamesCount; g++) {
      allLogs.push(`===== GAME ${g} START =====`);

      const one = simulateOneBRGame(teams, options);

      // scoring
      for (const row of one.placements) {
        const placeIndex = row.place - 1;
        const placePts = safeNum(placementTable[placeIndex], 0);
        const killPts = safeNum(row.killPts, 0);

        const s = total[row.teamId];
        if (!s) continue;

        s.placementPoints += placePts;
        s.killPoints += killPts;
        s.totalPoints += (placePts + killPts);

        s.games.push({
          game: g,
          place: row.place,
          placementPoints: placePts,
          killPoints: killPts,
          total: placePts + killPts,
        });
      }

      // logs
      for (const line of one.log) allLogs.push(line);
      allLogs.push(`===== GAME ${g} END =====`);
    }

    // final ranking
    const final = Object.values(total).sort((a, b) => {
      if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
      if (b.placementPoints !== a.placementPoints) return b.placementPoints - a.placementPoints;
      return b.killPoints - a.killPoints;
    });

    const finalRanked = final.map((x, idx) => ({
      rank: idx + 1,
      teamId: x.teamId,
      teamName: x.teamName,
      totalPoints: x.totalPoints,
      placementPoints: x.placementPoints,
      killPoints: x.killPoints,
    }));

    return {
      teamsCount: teams.length,
      gamesCount,
      ranking: finalRanked,
      detailByTeam: total,
      logs: allLogs,
    };
  }

  // --------------------------
  // Helpers for building tournament team lists
  // --------------------------
  function getLocalTeams() {
    const src = SAFE_LOCAL.teams || SAFE_LOCAL.list || [];
    return (Array.isArray(src) ? src : []).map(t => normalizeTeamDef(t, 'L'));
  }

  function getNationalTeams() {
    const src = SAFE_NATIONAL.teams || SAFE_NATIONAL.list || [];
    return (Array.isArray(src) ? src : []).map(t => normalizeTeamDef(t, 'N'));
  }

  function getWorldTeams() {
    const src = SAFE_WORLD.teams || SAFE_WORLD.list || [];
    return (Array.isArray(src) ? src : []).map(t => normalizeTeamDef(t, 'W'));
  }

  // プレイヤーチームを含める用
  function buildPlayerTeamFromState(stateObj) {
    // stateObj.playerTeam を想定。
    // いま state.js が未実装でも動くように保険。
    const st = stateObj || window.STATE || {};
    const pt = st.playerTeam || st.player || null;

    // 形式はまだ揺れてるので、できる範囲で吸う
    const name = (pt && pt.name) ? pt.name : 'PLAYER TEAM';
    const id = (pt && pt.id) ? pt.id : 'TEAM_PLAYER';

    let players = [];
    if (pt && Array.isArray(pt.players) && pt.players.length > 0) {
      // すでにplayerDefの配列なら使う
      players = pt.players.map(p => (typeof p === 'string') ? resolvePlayerByName(p) : p);
    } else if (st.playerRoster && Array.isArray(st.playerRoster)) {
      players = st.playerRoster.map(p => (typeof p === 'string') ? resolvePlayerByName(p) : p);
    } else {
      // 初期キャラ 3体（名前固定があるならここを合わせる）
      players = [
        resolvePlayerByName('ウニチー'),
        resolvePlayerByName('ネコクー'),
        resolvePlayerByName('ドオー'),
      ];
    }

    // powerPct：プレイヤーは企業ランク等で変動予定。今は50で固定。
    return normalizeTeamDef({
      id,
      name,
      powerPct: safeNum(pt && pt.powerPct, 50),
      players,
      passive: pt && pt.passive ? pt.passive : null,
      category: 'player',
    }, 'P');
  }

  // --------------------------
  // Export
  // --------------------------
  const api = {
    runTournamentGames,

    // expose helpers
    getLocalTeams,
    getNationalTeams,
    getWorldTeams,
    buildPlayerTeamFromState,
  };

  Object.freeze(api);
  window.SIM_TOURNAMENT_CORE = api;
})();
