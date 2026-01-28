// sim_tournament.js
// Minimum working tournament simulator for demo

export function runLeague(leagueKey = "SP1", opts = {}) {
  const teams = make20Teams();

  // simple random ranking
  const shuffled = [...teams].sort(() => Math.random() - 0.5);

  const finalStandings = shuffled.map((t, i) => ({
    rank: i + 1,
    teamId: t.id,
    team: { id: t.id, name: t.name },
    kills: randInt(0, 8),
    points: calcPoints(i + 1, randInt(0, 8)),
  }));

  const championTeamId = finalStandings[0].teamId;

  return {
    leagueKey,
    championTeamId,
    finalStandings,
    stages: [
      {
        stageName: leagueKey,
        matches: [
          {
            matchName: "Match1",
            highlights: [
              `${finalStandings[0].team.name} が優勢！`,
              `${finalStandings[1].team.name} が追い上げ！`,
              `${finalStandings[2].team.name} が大暴れ！`,
            ],
          },
        ],
      },
    ],
  };
}

function make20Teams() {
  const arr = [];
  for (let i = 1; i <= 20; i++) {
    arr.push({ id: `T${i}`, name: `TEAM ${i}` });
  }
  return arr;
}

function calcPoints(rank, kills) {
  // simple points: high placement matters + kills
  const place = Math.max(0, 21 - rank); // 20->1, 1->20
  return place * 2 + kills;
}

function randInt(min, max) {
  return Math.floor(Math.random() * (max - min + 1)) + min;
}
