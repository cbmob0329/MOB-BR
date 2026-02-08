'use strict';

/*
  MOB BR - tournament_rank.js v1（フル）
  STEP3：ポイント計算・順位決定を完全固定する

  役割：
  - 1試合（最大20チーム）の Result を受け取り、
    各チームの「その試合で得たポイント」を確定計算する
  - 累積（シリーズ/フェーズ/大会）スコアボードを更新する
  - 総合順位（20/40）を同点規則で確定して返す
  - お宝（+1）/ フラッグ（+2）を必ず反映する（抜け防止）
  - 40チーム大会は「同時に2ロビー（20×2）」の結果を同じMatchDayとして合算できる

  ここでは“戦闘ロジック”は扱わない：
  - kills / assists / treasure / flag の数値は、試合処理側が結果として渡す
  - 本ファイルは「与えられた数値を点数化し、順位を出す」だけ

  入力（1ロビー20チームの試合結果）例：
  {
    matchId: "NAT_EARLY_AB_1",
    lobbyKey: "AB",
    teams: [
      {
        teamId: "local07",   // 画像名にも直結するID
        teamName: "Hammers", // 表示用（無くてもOK）
        placement: 1,        // 1..20
        kills: 5,            // 0+
        assists: 3,          // 0+
        treasure: 1,         // 0+
        flag: 0,             // 0+
        // tieBreak 用の追加値（任意）
        avgPlacement: 3.2,   // 無ければ placement を代用
        // memberStats 等が入ってても無視（順位計算に不要）
      },
      ...
    ]
  }

  出力：
  - updatedBoard（累積）
  - matchPoints（各チームがこの試合で得たpt内訳）
  - overallRanking（ソート済み配列）

  同点優先順位（確定）：
  総合ポイント → 総合キル → 平均順位（小さいほど上） → 総合アシスト → ランダム

  注意：
  - ランダムは「seed付き」で再現可能な関数を用意（デフォルトは mulberry32）
  - 既存の storage / data_tournament への依存は持たない（純粋ロジック）
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.tournament = window.MOBBR.tournament || {};

(function(){
  // =========================
  // Constants（確定仕様）
  // =========================
  const PLACEMENT_POINTS = Object.freeze({
    1: 12,
    2: 8,
    3: 6,
    4: 5,
    5: 4,
    6: 3,
    7: 2,
    8: 1,
    9: 1,
    10: 1
    // 11..20 => 0
  });

  const POINTS = Object.freeze({
    kill: 1,
    assist: 1,
    treasure: 1,
    flag: 2
  });

  // =========================
  // Utils
  // =========================
  function n(v, def=0){
    const x = Number(v);
    return Number.isFinite(x) ? x : def;
  }

  function clampInt(v, min, max){
    const x = Math.floor(n(v, 0));
    return Math.max(min, Math.min(max, x));
  }

  // mulberry32：軽量seed RNG（再現性用）
  function mulberry32(seed){
    let a = (seed >>> 0) || 0x12345678;
    return function(){
      a |= 0;
      a = (a + 0x6D2B79F5) | 0;
      let t = Math.imul(a ^ (a >>> 15), 1 | a);
      t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
      return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
    };
  }

  function hash32(str){
    // FNV-1a 32bit（簡易）
    let h = 2166136261;
    const s = String(str || '');
    for (let i=0; i<s.length; i++){
      h ^= s.charCodeAt(i);
      h = Math.imul(h, 16777619);
    }
    return h >>> 0;
  }

  function safeTeamId(t){
    return String(t?.teamId ?? t?.id ?? t?.key ?? '');
  }

  // =========================
  // Board（累積スコア）
  // =========================
  function createEmptyBoard(){
    return {
      // teams[teamId] = stats
      teams: {},
      // 試合数（参考）
      matches: 0
    };
  }

  function ensureTeam(board, teamId){
    if (!teamId) return null;
    if (!board.teams[teamId]){
      board.teams[teamId] = {
        teamId,
        teamName: '',
        // totals
        points: 0,
        placementPoints: 0,
        killPoints: 0,
        assistPoints: 0,
        treasurePoints: 0,
        flagPoints: 0,
        kills: 0,
        assists: 0,
        treasure: 0,
        flag: 0,
        // avg placement
        placementSum: 0,
        placementCount: 0,
        avgPlacement: 9999
      };
    }
    return board.teams[teamId];
  }

  // =========================
  // 1試合の点数計算（20チーム想定）
  // =========================
  function calcMatchPoints(teamResult){
    const placement = clampInt(teamResult?.placement, 1, 20);
    const pp = PLACEMENT_POINTS[placement] || 0;

    const kills = Math.max(0, clampInt(teamResult?.kills, 0, 9999));
    const assists = Math.max(0, clampInt(teamResult?.assists, 0, 9999));
    const treasure = Math.max(0, clampInt(teamResult?.treasure, 0, 9999));
    const flag = Math.max(0, clampInt(teamResult?.flag, 0, 9999));

    const kp = kills * POINTS.kill;
    const ap = assists * POINTS.assist;
    const tp = treasure * POINTS.treasure;
    const fp = flag * POINTS.flag;

    const total = pp + kp + ap + tp + fp;

    return {
      placement,
      placementPoints: pp,
      kills,
      killPoints: kp,
      assists,
      assistPoints: ap,
      treasure,
      treasurePoints: tp,
      flag,
      flagPoints: fp,
      totalPoints: total
    };
  }

  // =========================
  // Board更新（1ロビー分）
  // =========================
  function applyMatchToBoard(board, matchResult){
    const teams = Array.isArray(matchResult?.teams) ? matchResult.teams : [];
    const matchId = String(matchResult?.matchId || '');
    const lobbyKey = String(matchResult?.lobbyKey || '');

    const perTeam = {}; // teamId -> matchPoints

    teams.forEach(t=>{
      const teamId = safeTeamId(t);
      if (!teamId) return;

      const mp = calcMatchPoints(t);
      perTeam[teamId] = mp;

      const row = ensureTeam(board, teamId);
      if (!row) return;

      row.teamName = String(t?.teamName || row.teamName || '');

      row.points += mp.totalPoints;

      row.placementPoints += mp.placementPoints;
      row.killPoints += mp.killPoints;
      row.assistPoints += mp.assistPoints;
      row.treasurePoints += mp.treasurePoints;
      row.flagPoints += mp.flagPoints;

      row.kills += mp.kills;
      row.assists += mp.assists;
      row.treasure += mp.treasure;
      row.flag += mp.flag;

      row.placementSum += mp.placement;
      row.placementCount += 1;
      row.avgPlacement = row.placementCount ? (row.placementSum / row.placementCount) : 9999;
    });

    board.matches += 1;

    return {
      matchId,
      lobbyKey,
      perTeam
    };
  }

  // =========================
  // ランキング生成（board -> sorted array）
  // =========================
  function buildRanking(board, opts){
    const seed = n(opts?.seed, 0);
    const salt = String(opts?.salt || '');
    const rng = mulberry32((seed ^ hash32(salt)) >>> 0);

    const list = Object.values(board?.teams || {});

    // 同点の最終タイブレークに使う「固定乱数値」をチームごとに作る（並び替えのブレを防ぐ）
    // seedが同じなら同じ順になる
    const randCache = {};
    list.forEach(t=>{
      const tid = String(t.teamId);
      // teamId + salt をハッシュ → rng を数回回して混ぜる
      const h = hash32(tid + '|' + salt);
      // rng自体も混ぜる（seed依存）
      randCache[tid] = ((h >>> 0) / 4294967296) * 0.5 + rng() * 0.5;
    });

    // sort（確定ルール）
    list.sort((a,b)=>{
      // 1) 総合ポイント（高い方が上）
      if (a.points !== b.points) return b.points - a.points;

      // 2) 総合キル（高い方が上）
      if (a.kills !== b.kills) return b.kills - a.kills;

      // 3) 平均順位（小さい方が上）
      const ap = n(a.avgPlacement, 9999);
      const bp = n(b.avgPlacement, 9999);
      if (ap !== bp) return ap - bp;

      // 4) 総合アシスト（高い方が上）
      if (a.assists !== b.assists) return b.assists - a.assists;

      // 5) ランダム（seed固定）
      const ra = randCache[String(a.teamId)] ?? 0;
      const rb = randCache[String(b.teamId)] ?? 0;
      if (ra !== rb) return ra < rb ? -1 : 1;

      // 念のため最後は teamId
      return String(a.teamId).localeCompare(String(b.teamId));
    });

    // rank付与（1..N）
    const ranked = list.map((t, i)=>({
      rank: i + 1,
      teamId: t.teamId,
      teamName: t.teamName || '',
      points: t.points,

      kills: t.kills,
      assists: t.assists,
      treasure: t.treasure,
      flag: t.flag,

      avgPlacement: t.avgPlacement,

      // 内訳も出せる（Apex風UIで使う）
      placementPoints: t.placementPoints,
      killPoints: t.killPoints,
      assistPoints: t.assistPoints,
      treasurePoints: t.treasurePoints,
      flagPoints: t.flagPoints
    }));

    return ranked;
  }

  // =========================
  // 40チーム大会：同一MatchDayで2ロビー分まとめて適用する helper
  // =========================
  function applyMatchDayToBoard(board, resultsByLobbyKey){
    // resultsByLobbyKey: { AB: matchResult, CD: matchResult } など
    const out = {
      perLobby: {},   // lobbyKey -> { matchId, lobbyKey, perTeam }
      merged: board   // same reference
    };

    const keys = Object.keys(resultsByLobbyKey || {});
    keys.forEach(k=>{
      const mr = resultsByLobbyKey[k];
      if (!mr) return;

      // lobbyKeyは引数優先で補完
      const fixed = Object.assign({}, mr, { lobbyKey: mr.lobbyKey || k });
      out.perLobby[k] = applyMatchToBoard(board, fixed);
    });

    return out;
  }

  // =========================
  // Public API（flow側が呼びやすい形）
  // =========================
  function createRankEngine(opts){
    const seed = n(opts?.seed, 0);
    const salt = String(opts?.salt || '');

    const board = createEmptyBoard();

    return {
      VERSION: 'v1',

      // 現在の累積を取得
      getBoard(){
        return board;
      },

      // 1ロビー20チームの1試合を適用
      applyMatch(matchResult){
        return applyMatchToBoard(board, matchResult);
      },

      // 40チーム大会用：同一MatchDayの2ロビー分を一気に適用
      applyMatchDay(resultsByLobbyKey){
        return applyMatchDayToBoard(board, resultsByLobbyKey);
      },

      // 総合順位（20/40どちらでも：boardに入ってるチーム数ぶん）
      buildOverall(){
        return buildRanking(board, { seed, salt });
      },

      // リセット（フェーズ切り替えなどに使用）
      reset(){
        const empty = createEmptyBoard();
        board.teams = empty.teams;
        board.matches = 0;
      }
    };
  }

  // =========================
  // export
  // =========================
  window.MOBBR.tournament.rank = {
    VERSION: 'v1',
    PLACEMENT_POINTS,
    POINTS,
    calcMatchPoints,
    createEmptyBoard,
    createRankEngine,
    applyMatchToBoard,
    applyMatchDayToBoard,
    buildRanking
  };
})();
