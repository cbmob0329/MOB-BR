// sim_tournament.js (ES Modules)
// Tournament flow runner: SP1 / SP2 / CHAMPIONSHIP
// - Works as DEMO even before sim_match.js exists (has internal lightweight match sim).
// - Later: replace runMatchesInternal() with sim_match.js implementation.
//
// Depends on:
// - data_teams_index.js : team pools
// - state.js : runtime + records
//
// Philosophy:
// - "CPUは裏処理" をこの層で完結（UIは ui.js が読むだけ）
// - 1大会 = 5試合, 各試合で20(または40)チーム全順位を出す
// - 重要シーンは "highlights" に吐く（ui.js がモーダル表示）

import { getState, setRuntime, addRecord, addLeagueTotals } from "./state.js";
import { PHASE, getTeamsForPhase, getTeamById } from "./data_teams_index.js";

// -----------------------------
// Config / Points
// -----------------------------

export const LEAGUE = Object.freeze({
  SP1: "SP1",
  SP2: "SP2",
  CHAMP: "CHAMPIONSHIP",
});

export const STAGE = Object.freeze({
  LOCAL: "LOCAL",
  NATIONAL: "NATIONAL",
  LAST_CHANCE: "LAST_CHANCE",
  WF: "WF",

  // Championship extra brackets
  WINNERS: "WINNERS",
  LOSERS: "LOSERS",
  LOSERS2: "LOSERS2",
  FINAL: "FINAL",
});

// Battle Royale style points (demo default).
// Later: replace with your data_points.js if you have an exact table.
export const DEFAULT_PLACEMENT_POINTS_20 = [
  25, 21, 18, 16, 14,
  12, 11, 10, 9, 8,
  7, 6, 5, 4, 3,
  2, 2, 1, 1, 0
]; // index 0 => rank1

export const DEFAULT_PLACEMENT_POINTS_40 = [
  25, 21, 18, 16, 14,
  12, 11, 10, 9, 8,
  7, 6, 5, 4, 3,
  2, 2, 1, 1, 0,
  // 21-40
  0,0,0,0,0,
  0,0,0,0,0,
  0,0,0,0,0,
  0,0,0,0,0
];

const KILL_POINT = 1;

// -----------------------------
// Public API
// -----------------------------

/**
 * Run full league until completion.
 * Returns: { league, stages:[...], championTeamId, finalStandings }
 */
export function runLeague(leagueKey, options = {}) {
  const league = normalizeLeagueKey(leagueKey);

  const playerTeam = buildPlayerTeamStub(options.playerTeamId || "PLAYER");
  const seed = options.seed ?? Date.now();

  const result = {
    league,
    seed,
    stages: [],
    championTeamId: null,
    finalStandings: [],
  };

  // 1) LOCAL (20)
  const local = runStage({
    league,
    stage: STAGE.LOCAL,
    teams: buildLocalPool(playerTeam),
    matchCount: 5,
    tableSize: 20,
    seedOffset: 1000,
  });
  result.stages.push(local);

  // 2) NATIONAL (40)
  const nationalPool = buildNationalPool(playerTeam, local.finalStandings);
  const national = runStage({
    league,
    stage: STAGE.NATIONAL,
    teams: nationalPool,
    matchCount: 5,
    tableSize: 40,
    seedOffset: 2000,
  });
  result.stages.push(national);

  // 3) LAST CHANCE (9-28位 / 5試合 / 上位2)
  const lastChanceTeams = pickByRankRange(national.finalStandings, 9, 28).map(r => r.team);
  const lastChance = runStage({
    league,
    stage: STAGE.LAST_CHANCE,
    teams: lastChanceTeams,
    matchCount: 5,
    tableSize: lastChanceTeams.length,
    seedOffset: 3000,
  });
  result.stages.push(lastChance);

  const lastChanceTop2 = pickTopN(lastChance.finalStandings, 2).map(r => r.team);

  // 4) WF (40)
  const wfPool = buildWFPool(playerTeam, national.finalStandings, lastChanceTop2);
  const wf = runStage({
    league,
    stage: STAGE.WF,
    teams: wfPool,
    matchCount: 5,
    tableSize: 40,
    seedOffset: 4000,
  });
  result.stages.push(wf);

  // League winner (WF #1)
  const wfChampion = wf.finalStandings[0]?.team?.id || null;

  // Championship special bracket only for CHAMP league
  if (league === LEAGUE.CHAMP) {
    const champ = runChampionshipBracket({
      league,
      wfStandings: wf.finalStandings,
      seedOffset: 5000,
    });
    result.stages.push(...champ.stages);
    result.championTeamId = champ.championTeamId;
    result.finalStandings = champ.finalStandings;
  } else {
    result.championTeamId = wfChampion;
    result.finalStandings = wf.finalStandings;
  }

  // Persist into runtime/records (UI reads from state.runtime)
  commitLeagueToState(result);

  return result;
}

/**
 * Convenience: run SP1 then SP2 then CHAMP using accumulated state.
 * CHAMP uses a fresh run (demo), but records are appended.
 */
export function runSeasonAll(options = {}) {
  const sp1 = runLeague(LEAGUE.SP1, options);
  const sp2 = runLeague(LEAGUE.SP2, options);
  const champ = runLeague(LEAGUE.CHAMP, options);
  return { sp1, sp2, champ };
}

// -----------------------------
// Stage Runner
// -----------------------------

function runStage({ league, stage, teams, matchCount, tableSize, seedOffset }) {
  const seedBase = (getState().year * 1000 + getState().week * 10) + seedOffset;

  const stageResult = {
    league,
    stage,
    matchCount,
    tableSize,
    matches: [],       // each: { index, rows:[{rank,teamId,name,kills,pts}], highlights:[] }
    finalStandings: [],// sorted by totalPts, kills, tieBreak
  };

  const totals = initTotals(teams);

  for (let m = 1; m <= matchCount; m++) {
    const match = runMatchInternal({
      teams,
      tableSize,
      placementPoints: tableSize === 40 ? DEFAULT_PLACEMENT_POINTS_40 : DEFAULT_PLACEMENT_POINTS_20,
      seed: seedBase + m,
    });

    stageResult.matches.push({ index: m, ...match });

    // accumulate totals
    for (const row of match.rows) {
      const t = totals[row.teamId];
      if (!t) continue;
      t.pts += row.pts;
      t.kills += row.kills;
      t.bestRank = Math.min(t.bestRank, row.rank);
    }
  }

  stageResult.finalStandings = buildFinalStandings(totals, teams);

  return stageResult;
}

// -----------------------------
// Championship Bracket (DEMO version)
// -----------------------------

function runChampionshipBracket({ league, wfStandings, seedOffset }) {
  // Based on your design: Winners / Losers / Losers2 / Final.
  // DEMO policy:
  // - Take WF top16 as "Winners"
  // - Next 16 as "Losers"
  // - Next 8 as "Losers2 seed"
  // - Run mini-stages (single 3 matches each) then Final (repeat until one team reaches targetWins=2)
  const seedBase = (getState().year * 1000 + getState().week * 10) + seedOffset;

  const top = wfStandings.map(r => r.team);
  const winnersPool = top.slice(0, 16);
  const losersPool = top.slice(16, 32);
  const losers2Pool = top.slice(32, 40); // 8 teams

  const stages = [];

  const winners = runStage({
    league,
    stage: STAGE.WINNERS,
    teams: winnersPool,
    matchCount: 3,
    tableSize: winnersPool.length,
    seedOffset: seedBase + 100,
  });
  stages.push(winners);

  const losers = runStage({
    league,
    stage: STAGE.LOSERS,
    teams: losersPool,
    matchCount: 3,
    tableSize: losersPool.length,
    seedOffset: seedBase + 200,
  });
  stages.push(losers);

  // losers2: combine losers top4 + losers2Pool (8) => 12, run 3 matches, take top4
  const losersTop4 = pickTopN(losers.finalStandings, 4).map(r => r.team);
  const losers2Teams = [...losersTop4, ...losers2Pool].slice(0, 12);

  const losers2 = runStage({
    league,
    stage: STAGE.LOSERS2,
    teams: losers2Teams,
    matchCount: 3,
    tableSize: losers2Teams.length,
    seedOffset: seedBase + 300,
  });
  stages.push(losers2);

  // Final: winners top4 + losers2 top4 => 8 teams
  const winnersTop4 = pickTopN(winners.finalStandings, 4).map(r => r.team);
  const losers2Top4 = pickTopN(losers2.finalStandings, 4).map(r => r.team);
  const finalPool = [...winnersTop4, ...losers2Top4].slice(0, 8);

  const final = runFinalSeriesInternal({
    league,
    teams: finalPool,
    seed: seedBase + 999,
    targetWins: 2, // DEMO: 2勝で優勝（後で可変にできる）
  });
  stages.push(final.stage);

  return {
    stages,
    championTeamId: final.championTeamId,
    finalStandings: final.stage.finalStandings,
  };
}

function runFinalSeriesInternal({ league, teams, seed, targetWins }) {
  // repeat matches until a team reaches targetWins
  const winCount = Object.fromEntries(teams.map(t => [t.id, 0]));
  const matchLogs = [];

  let iter = 0;
  while (true) {
    iter += 1;
    const match = runMatchInternal({
      teams,
      tableSize: teams.length,
      placementPoints: makePlacementPoints(teams.length),
      seed: seed + iter,
    });

    matchLogs.push({ index: iter, ...match });

    const winnerId = match.rows[0]?.teamId;
    if (winnerId) winCount[winnerId] = (winCount[winnerId] || 0) + 1;

    const champId = Object.keys(winCount).find(id => winCount[id] >= targetWins);
    if (champId) {
      // Build standings from winCount then pts/kills as tiebreakers using last match totals
      const totals = initTotals(teams);
      for (const id of Object.keys(winCount)) {
        totals[id].wins = winCount[id];
      }
      // add pts/kills for flavor from all matches
      for (const m of matchLogs) {
        for (const row of m.rows) {
          totals[row.teamId].pts += row.pts;
          totals[row.teamId].kills += row.kills;
          totals[row.teamId].bestRank = Math.min(totals[row.teamId].bestRank, row.rank);
        }
      }

      const finalStage = {
        league,
        stage: STAGE.FINAL,
        matchCount: matchLogs.length,
        tableSize: teams.length,
        matches: matchLogs,
        finalStandings: buildFinalStandings(totals, teams, { useWinsFirst: true }),
      };

      return { championTeamId: champId, stage: finalStage };
    }

    // safety cap for demo
    if (iter >= 9) {
      // force champion by highest wins
      const champId2 = Object.entries(winCount).sort((a,b)=>b[1]-a[1])[0][0];
      const totals = initTotals(teams);
      for (const id of Object.keys(winCount)) totals[id].wins = winCount[id];
      for (const m of matchLogs) for (const row of m.rows) {
        totals[row.teamId].pts += row.pts;
        totals[row.teamId].kills += row.kills;
        totals[row.teamId].bestRank = Math.min(totals[row.teamId].bestRank, row.rank);
      }
      const forcedStage = {
        league,
        stage: STAGE.FINAL,
        matchCount: matchLogs.length,
        tableSize: teams.length,
        matches: matchLogs,
        finalStandings: buildFinalStandings(totals, teams, { useWinsFirst: true }),
      };
      return { championTeamId: champId2, stage: forcedStage };
    }
  }
}

// -----------------------------
// Internal Match Sim (DEMO)
// -----------------------------

function runMatchInternal({ teams, tableSize, placementPoints, seed }) {
  // Deterministic random with seed
  const rng = mulberry32(hashSeed(seed));

  // Strength score base = powerPct + small passive bonus (very rough)
  const scored = teams.map(t => {
    const power = typeof t.powerPct === "number" ? t.powerPct : 60;
    const passiveBonus = estimatePassiveBonus(t.passive);
    const score = power + passiveBonus + randn(rng) * 3; // mild noise
    return { team: t, score };
  });

  // Rank by score desc
  scored.sort((a,b)=>b.score-a.score);

  // kills distribution: total kills approx 60 for 20 teams (your note), for 40 teams approx 90
  const expectedTotalKills = tableSize <= 20 ? 60 : 90;
  const killWeights = scored.map((s, idx) => {
    // better teams slightly more kills, but not too extreme
    const rankFactor = (tableSize - idx) / tableSize; // 1..small
    return Math.max(0.2, rankFactor * 1.2);
  });
  const killsRaw = multinomial(rng, expectedTotalKills, killWeights);

  const rows = [];
  const highlights = [];

  for (let i=0;i<Math.min(tableSize, scored.length);i++){
    const rank = i + 1;
    const team = scored[i].team;
    const kills = killsRaw[i] ?? 0;
    const pts = (placementPoints[i] ?? 0) + kills * KILL_POINT;

    rows.push({
      rank,
      teamId: team.id,
      name: team.name,
      kills,
      placePts: (placementPoints[i] ?? 0),
      pts,
    });

    // highlight rules (demo)
    if (rank === 1) highlights.push(`WINNER: ${team.name}（${kills}K）`);
    if (kills >= 10) highlights.push(`大量キル: ${team.name}（${kills}K）`);
  }

  return { rows, highlights };
}

// -----------------------------
// Pools (Local/National/WF)
// -----------------------------

function buildPlayerTeamStub(playerTeamId) {
  // player team is not fully defined yet; placeholder is OK for demo
  const t = getTeamById(playerTeamId);
  if (t) return t;

  return {
    id: playerTeamId,
    name: "PLAYER TEAM",
    powerPct: 70,
    tagline: "プレイヤー",
    members: ["P1", "P2", "P3"],
    passive: { name: "プレイヤー補正", raw: "（デモ）味方全員のAim+1", timing: "always", effects: [{ type: "stat_add", stat: "aim", value: 1, target: "ally_all", timing: "always" }] },
    isPlayer: true,
  };
}

function buildLocalPool(playerTeam) {
  // LOCAL pool: 20 teams
  // DEMO: replace one local team with player team to keep 20 total
  const locals = getTeamsForPhase(PHASE.LOCAL_STAGE); // 20 from local data
  const list = locals.slice();

  // ensure player exists once
  // replace the last team (weakest slot) to keep count == 20
  if (!list.find(t => t.id === playerTeam.id)) {
    list[list.length - 1] = playerTeam;
  }
  return list;
}

function buildNationalPool(playerTeam, localStandings) {
  // NATIONAL pool: 40 teams
  // DEMO policy:
  // - take top 10 from local standings as "qualifiers" (includes player if strong)
  // - fill remaining with NATIONAL pool until 40
  const qualifiers = pickTopN(localStandings, 10).map(r => r.team);

  // ensure player is included at least once
  if (!qualifiers.find(t => t.id === playerTeam.id)) {
    qualifiers[qualifiers.length - 1] = playerTeam;
  }

  const nationals = getTeamsForPhase(PHASE.NATIONAL_STAGE); // 40 from national data
  const fill = [];

  for (const t of nationals) {
    if (qualifiers.find(q => q.id === t.id)) continue;
    fill.push(t);
  }

  const combined = [...qualifiers, ...fill].slice(0, 40);
  // if still < 40, pad by repeating best nationals (should not happen with your data)
  while (combined.length < 40) combined.push(nationals[combined.length % nationals.length]);
  return combined;
}

function buildWFPool(playerTeam, nationalStandings, lastChanceTop2) {
  // WF pool: 40 teams
  // DEMO:
  // - base = WORLD pool (40)
  // - ensure lastChanceTop2 are included by replacing the last slots
  const worlds = getTeamsForPhase(PHASE.WORLD_FINAL); // 40 from world data
  const list = worlds.slice();

  const inject = (team) => {
    if (!team) return;
    if (list.find(t => t.id === team.id)) return;
    // replace weakest slot (end)
    list[list.length - 1] = team;
  };

  // ensure player is present somewhere (optional)
  if (!list.find(t => t.id === playerTeam.id)) {
    // if player in national top8, inject, else don't force
    const top8 = pickTopN(nationalStandings, 8).map(r => r.team);
    if (top8.find(t => t.id === playerTeam.id)) inject(playerTeam);
  }

  for (const t of lastChanceTop2) inject(t);

  return list.slice(0, 40);
}

// -----------------------------
// Standings helpers
// -----------------------------

function initTotals(teams) {
  const o = {};
  for (const t of teams) {
    o[t.id] = { teamId: t.id, pts: 0, kills: 0, wins: 0, bestRank: 999 };
  }
  return o;
}

function buildFinalStandings(totalsById, teams, opt = {}) {
  const teamById = Object.fromEntries(teams.map(t => [t.id, t]));
  const rows = Object.values(totalsById).map(r => ({
    team: teamById[r.teamId] || { id: r.teamId, name: r.teamId, powerPct: 60 },
    teamId: r.teamId,
    pts: r.pts,
    kills: r.kills,
    wins: r.wins || 0,
    bestRank: r.bestRank,
  }));

  rows.sort((a,b) => {
    // For FINAL stage: wins first
    if (opt.useWinsFirst) {
      if ((b.wins||0) !== (a.wins||0)) return (b.wins||0) - (a.wins||0);
    }
    if ((b.pts||0) !== (a.pts||0)) return (b.pts||0) - (a.pts||0);
    if ((b.kills||0) !== (a.kills||0)) return (b.kills||0) - (a.kills||0);
    // tie: best single-match rank
    if ((a.bestRank||999) !== (b.bestRank||999)) return (a.bestRank||999) - (b.bestRank||999);
    // final tie: power
    return (b.team.powerPct||0) - (a.team.powerPct||0);
  });

  // attach ranks
  return rows.map((r, i) => ({ ...r, rank: i + 1 }));
}

function pickTopN(standings, n) {
  return standings.slice(0, Math.max(0, n|0));
}

function pickByRankRange(standings, fromRank, toRank) {
  // ranks are 1-based
  return standings.filter(r => r.rank >= fromRank && r.rank <= toRank);
}

// -----------------------------
// State commit (for UI)
// -----------------------------

function commitLeagueToState(leagueResult) {
  const s = getState();

  // Put the latest match/result tables into runtime for ui.js to show
  const lastStage = leagueResult.stages[leagueResult.stages.length - 1];
  const lastMatch = lastStage?.matches?.[lastStage.matches.length - 1];

  setRuntime({
    matchIndex: lastStage?.matches?.length || 1,
    matchTotal: lastStage?.matches?.length || 5,
    round: lastStage?.stage || "R1",
    aliveTeams: lastMatch?.rows?.length || 20,
    lastEvent: lastMatch?.highlights?.[0] || "",
    lastImportantScene: (lastMatch?.highlights || []).slice(0, 3).join(" / "),
    lastMatchResultRows: (lastMatch?.rows || []).map(r => ({
      rank: r.rank,
      teamId: r.teamId,
      name: r.name,
      kills: r.kills,
      pts: r.pts,
    })),
    lastTotalRows: (leagueResult.finalStandings || []).map(r => ({
      rank: r.rank,
      teamId: r.teamId,
      name: r.team.name,
      kills: r.kills,
      pts: r.pts,
    })),
    sim: {
      tournamentId: `${leagueResult.league}_${Date.now()}`,
      teamsCount: (leagueResult.finalStandings || []).length || 0,
      teams: (leagueResult.finalStandings || []).map(r => r.team),
    },
  });

  // Append records (history)
  const champId = leagueResult.championTeamId;
  const champ = champId ? getTeamById(champId) : null;

  addRecord({
    league: leagueResult.league,
    stage: "COMPLETED",
    rank: 1,
    pts: leagueResult.finalStandings?.[0]?.pts ?? 0,
    kills: leagueResult.finalStandings?.[0]?.kills ?? 0,
    winner: champ ? champ.name : champId,
    date: { year: s.year, week: s.week },
  });

  // Totals: demo counts champ win
  if (leagueResult.league === LEAGUE.SP1) addLeagueTotals("SP1", 0, 1);
  if (leagueResult.league === LEAGUE.SP2) addLeagueTotals("SP2", 0, 1);
  if (leagueResult.league === LEAGUE.CHAMP) addLeagueTotals("CHAMPIONSHIP", 0, 1);
}

// -----------------------------
// Passive bonus estimation (very rough)
// -----------------------------

function estimatePassiveBonus(passive) {
  if (!passive) return 0;
  const raw = passive.raw || passive.desc || "";
  let b = 0;
  // mild bonus for common positive keywords
  if (raw.includes("Aim+")) b += 1.5;
  if (raw.includes("Agility+")) b += 1.0;
  if (raw.includes("命中率+")) b += 1.2;
  if (raw.includes("被弾率-")) b += 1.0;
  if (raw.includes("被ダメージ-")) b += 1.2;
  if (raw.includes("ダメージ+")) b += 1.2;
  if (raw.includes("回復")) b += 0.6;
  if (raw.includes("無効")) b += 1.0;
  return b;
}

// -----------------------------
// RNG helpers (deterministic)
// -----------------------------

function hashSeed(x) {
  // int32 hash
  let n = (x | 0) ^ 0x9e3779b9;
  n = Math.imul(n ^ (n >>> 16), 0x85ebca6b);
  n = Math.imul(n ^ (n >>> 13), 0xc2b2ae35);
  return (n ^ (n >>> 16)) >>> 0;
}

function mulberry32(a) {
  return function() {
    let t = (a += 0x6D2B79F5);
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

function randn(rng) {
  // Box-Muller
  let u = 0, v = 0;
  while (u === 0) u = rng();
  while (v === 0) v = rng();
  return Math.sqrt(-2.0 * Math.log(u)) * Math.cos(2.0 * Math.PI * v);
}

function multinomial(rng, total, weights) {
  const n = weights.length;
  const wsum = weights.reduce((a,b)=>a+b,0) || 1;
  const probs = weights.map(w => w / wsum);

  // allocate by roulette for simplicity
  const out = new Array(n).fill(0);
  for (let i=0;i<total;i++){
    const r = rng();
    let acc = 0;
    for (let j=0;j<n;j++){
      acc += probs[j];
      if (r <= acc) { out[j]++; break; }
    }
  }
  return out;
}

function makePlacementPoints(n) {
  // simple descending for small finals
  // 1st:10 then down to 0
  const out = [];
  const top = Math.max(5, Math.min(10, n + 2));
  for (let i=0;i<n;i++){
    out.push(Math.max(0, top - i));
  }
  return out;
}

function normalizeLeagueKey(k) {
  if (k === LEAGUE.SP1 || k === "SP1") return LEAGUE.SP1;
  if (k === LEAGUE.SP2 || k === "SP2") return LEAGUE.SP2;
  return LEAGUE.CHAMP;
}
