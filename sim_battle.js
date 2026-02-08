/* =========================================================
   MOB BR - sim_battle.js (FULL)
   - 交戦処理（必ず枠数ぶん成立）
   - 勝敗 / 脱落 / DB（deathBoxes）/ キル&アシスト配分
   - お宝/フラッグは sim_event.js が points に加算済み（ここでは触らない）
   ---------------------------------------------------------
   依存：なし（あれば使う）
   - SimMap（任意）：areaName 表示用
   - RULES（任意）：外部設定
========================================================= */

(function(){
  'use strict';

  const SimBattle = {};
  window.SimBattle = SimBattle;

  /* =========================
     設定（外部上書き可）
  ========================== */
  const CONF = {
    // ラウンドごとの交戦枠（確定）
    fightsPerRound: { 1:4, 2:4, 3:4, 4:4, 5:2, 6:1 },

    // プレイヤー戦の確率（確定）
    playerFightRate: { 1:1.00, 2:0.70, 3:0.75, 4:0.80, 5:0.85, 6:1.00 },

    // 勝率式：clamp(50 + diff*1.8, 22, 78)
    winrateK: 1.8,
    winrateMin: 22,
    winrateMax: 78,

    // 2人の時の総合力補正（内部）
    twoAliveBoost: 40, // +40%

    // 勝者側DB（勝者も削れる）
    winnerDbDist: { db0:0.55, db1:0.35, db2:0.10 },

    // キル配分（個人）
    roleWeight: { ATTACKER:50, IGL:30, SUPPORT:20 },

    // アシスト発生確率（接戦ほど上がる）
    assistBase: 0.35,     // 基本
    assistCloseAdd: 0.30, // 接戦加算

    // チーム獲得キル枠（交戦ごと）
    winnerKillRange: [0,3],
    loserKillRange:  [0,2],
  };

  if (window.RULES?.BATTLE){
    Object.assign(CONF, window.RULES.BATTLE);
  }

  /* =========================
     順位ポイント（確定）
  ========================== */
  const PLACEMENT_PT = {
    1:12, 2:8, 3:6, 4:5, 5:4, 6:3, 7:2,
    8:1, 9:1, 10:1
    // 11〜20 は 0
  };

  function getPlacementPt(rank){
    return PLACEMENT_PT[rank] || 0;
  }

  /* =========================
     公開API
  ========================== */

  /**
   * ラウンドの交戦を実行
   * @param {Object} state match state（推奨：state.teams / state.playerTeamId）
   * @param {Number} round 1..6
   * @param {Object} opt   任意：{ forcedFights, overlappedAreasR1 }
   * @returns {Object} { fights, logs, eliminatedThisRound, isFinished, championId }
   */
  SimBattle.runRound = function(state, round, opt){
    const logs = [];
    const fights = [];
    const eliminatedThisRound = [];

    if (!state || !Array.isArray(state.teams)) return { fights, logs, eliminatedThisRound, isFinished:false };

    const r = Number(round) || 1;
    const maxFights = (opt && Number(opt.forcedFights)) || (CONF.fightsPerRound[r] || 0);

    // elimOrder を保持（最終順位確定用）
    if (!Array.isArray(state.elimOrder)) state.elimOrder = [];

    // ラウンド開始時点の生存チーム
    const aliveTeams = state.teams.filter(t => t && !t.eliminated);

    // R6は「残り2チーム」前提で1戦＝決勝
    if (r === 6){
      const still = aliveTeams.slice();
      if (still.length <= 1){
        const champ = still[0]?.teamId || null;
        return { fights, logs, eliminatedThisRound, isFinished:true, championId: champ };
      }
      const pair = pickFinalPair(still, state.playerTeamId);
      const res = resolveFight(state, pair[0], pair[1], r, logs);
      fights.push(res);
      if (res.loserEliminatedId) eliminatedThisRound.push(res.loserEliminatedId);

      // チャンピオン決定
      const champId = res.winnerId;
      return { fights, logs, eliminatedThisRound, isFinished:true, championId: champId };
    }

    // 交戦ペアを作る（必ず枠数ぶん）
    const pairs = buildFightPairs(state, r, maxFights, opt);
    for (const [a,b] of pairs){
      const res = resolveFight(state, a, b, r, logs);
      fights.push(res);
      if (res.loserEliminatedId) eliminatedThisRound.push(res.loserEliminatedId);
    }

    return { fights, logs, eliminatedThisRound, isFinished:false, championId:null };
  };

  /**
   * 試合が終わった後（生存1）に「1〜20位の result」を作る
   * @param {Object} state
   * @returns {Array|null} result rows（rank昇順） or null
   */
  SimBattle.buildMatchResult = function(state){
    if (!state || !Array.isArray(state.teams)) return null;

    const alive = state.teams.filter(t => t && !t.eliminated);
    if (alive.length !== 1) return null; // まだ終わってない

    // 1位＝最後に残ったチーム
    const champion = alive[0];

    // elimOrder は「脱落した順」に溜まっているので
    // 最終順位は「最後に脱落したほど上位」
    const elim = Array.isArray(state.elimOrder) ? state.elimOrder.slice() : [];

    // 念のため eliminated=true の中で elimOrder に無い分も拾う
    const missing = state.teams
      .filter(t => t && t.eliminated)
      .filter(t => !elim.find(e => e.teamId === t.teamId))
      .map(t => ({ teamId:t.teamId, atRound:null, note:'missing' }));
    elim.push(...missing);

    // 上位側（rank小さいほど強い）
    // 20チームの場合：1位 champion、2位＝最後に落ちた、…、20位＝最初に落ちた
    const ranked = [];

    ranked.push(makeResultRow(champion, 1));

    // elim を「脱落が遅い順」に並べる
    const elimReverse = elim.slice().reverse();
    let rank = 2;
    for (const e of elimReverse){
      const t = state.teams.find(x => x.teamId === e.teamId);
      if (!t) continue;
      ranked.push(makeResultRow(t, rank));
      rank++;
    }

    // 念のため 1〜20 を満たす（不足時）
    if (ranked.length < state.teams.length){
      const used = new Set(ranked.map(x => x.teamId));
      const rest = state.teams.filter(t => t && !used.has(t.teamId));
      for (const t of rest){
        ranked.push(makeResultRow(t, ranked.length + 1));
      }
    }

    // 順位ポイント付与（placement）
    for (const row of ranked){
      const pt = getPlacementPt(row.rank);
      row.placementPt = pt;
      row.points.placement = pt;
      row.totalPt = sumPoints(row.points);
    }

    // totalPt などは「この試合の結果表示用」なのでここで確定
    // ※大会の総合は sim_score.js 側で加算する想定
    return ranked.sort((a,b)=>a.rank-b.rank);
  };

  /* =========================
     交戦ペア生成
  ========================== */

  function buildFightPairs(state, round, count, opt){
    const pairs = [];
    const teams = state.teams || [];
    const alive = teams.filter(t => t && !t.eliminated);

    // 交戦枠が0なら何もしない
    const need = Math.max(0, Number(count) || 0);
    if (need === 0) return pairs;

    // プレイヤー戦の扱い（確率で寄せる）
    const pId = state.playerTeamId || null;
    const pTeam = pId ? alive.find(t => t.teamId === pId) : null;
    const wantPlayerFight = !!pTeam && roll(CONF.playerFightRate[round] ?? 0);

    // R1は「被り4箇所」優先（opt.overlappedAreasR1 があれば利用）
    if (round === 1){
      const overlapped = (opt && Array.isArray(opt.overlappedAreasR1)) ? opt.overlappedAreasR1.slice() : null;
      if (overlapped && overlapped.length){
        const used = new Set();
        // まず被りエリアからペア化
        for (const aId of overlapped){
          if (pairs.length >= need) break;
          const inArea = alive.filter(t => !used.has(t.teamId) && t.areaId === aId);
          if (inArea.length >= 2){
            const a = inArea[0];
            const b = inArea[1];
            used.add(a.teamId); used.add(b.teamId);
            pairs.push([a,b]);
          }
        }
      }
    }

    // プレイヤー戦を優先して1枠確保（ただし既に入ってたらスキップ）
    if (wantPlayerFight && pairs.length < need){
      const already = pairs.some(([a,b]) => a.teamId === pId || b.teamId === pId);
      if (!already){
        const enemy = pickEnemyForPlayer(alive, pTeam);
        if (enemy){
          pairs.push([pTeam, enemy]);
        }
      }
    }

    // 残りは「同エリア優先」→足りなければランダム
    const usedIds = new Set();
    for (const [a,b] of pairs){ usedIds.add(a.teamId); usedIds.add(b.teamId); }

    // 同エリアから作れるだけ作る
    while (pairs.length < need){
      const pool = alive.filter(t => !usedIds.has(t.teamId));
      if (pool.length < 2) break;

      // 同エリア候補を探す
      let found = null;
      for (let i=0; i<pool.length; i++){
        const a = pool[i];
        const same = pool.filter(t => t.teamId !== a.teamId && t.areaId === a.areaId);
        if (same.length){
          found = [a, same[Math.floor(Math.random()*same.length)]];
          break;
        }
      }

      if (!found){
        // ランダムに2つ取る
        const a = pool[Math.floor(Math.random()*pool.length)];
        const rest = pool.filter(t => t.teamId !== a.teamId);
        const b = rest[Math.floor(Math.random()*rest.length)];
        found = [a,b];
      }

      usedIds.add(found[0].teamId); usedIds.add(found[1].teamId);
      pairs.push(found);
    }

    // もし不足なら（同じチームが複数戦になるのを許可して）埋める
    while (pairs.length < need){
      const aliveNow = state.teams.filter(t => t && !t.eliminated);
      if (aliveNow.length < 2) break;
      const a = aliveNow[Math.floor(Math.random()*aliveNow.length)];
      const rest = aliveNow.filter(t => t.teamId !== a.teamId);
      const b = rest[Math.floor(Math.random()*rest.length)];
      pairs.push([a,b]);
    }

    // 最終：同じペア重複を軽く避ける（完全回避はしない）
    return pairs;
  }

  function pickEnemyForPlayer(alive, pTeam){
    // (1) 同エリア
    const same = alive.filter(t => t.teamId !== pTeam.teamId && t.areaId === pTeam.areaId);
    if (same.length) return same[Math.floor(Math.random()*same.length)];

    // (2) 生存から
    const other = alive.filter(t => t.teamId !== pTeam.teamId);
    if (!other.length) return null;
    return other[Math.floor(Math.random()*other.length)];
  }

  function pickFinalPair(alive, playerTeamId){
    // できればプレイヤーが残ってたら含める
    const p = playerTeamId ? alive.find(t => t.teamId === playerTeamId) : null;
    if (p){
      const other = alive.filter(t => t.teamId !== p.teamId);
      return [p, other[0]];
    }
    return [alive[0], alive[1]];
  }

  /* =========================
     交戦解決
  ========================== */

  function resolveFight(state, A, B, round, logs){
    if (!A || !B) return { ok:false };

    // battle log header（UI側で使える形）
    logs.push(makeLog('BATTLE_START', A, B, `交戦開始！`));

    // 勝率計算（内部）
    const aPow = calcTeamFightPower(A);
    const bPow = calcTeamFightPower(B);
    const diff = aPow - bPow;

    const aWinRate = clamp(50 + diff * CONF.winrateK, CONF.winrateMin, CONF.winrateMax);
    const aWin = roll(aWinRate / 100);

    const winner = aWin ? A : B;
    const loser  = aWin ? B : A;

    // キル/アシスト（両陣営に付与：集計用、ログはUI側で「プレイヤー交戦のみ表示」できる）
    const kRes = assignKillsAndAssists(winner, loser, aPow, bPow);

    // 敗者：全滅（確定）
    eliminateTeam(state, loser, round);

    // 勝者：DB抽選（勝者も削れる）
    applyWinnerDb(winner);

    // fight end
    logs.push(makeLog('BATTLE_END', winner, loser, `${winner.name}が勝利！`));

    return {
      ok:true,
      round,
      aId: A.teamId,
      bId: B.teamId,
      winnerId: winner.teamId,
      loserId: loser.teamId,
      loserEliminatedId: loser.teamId,
      aWinRate,
      kills: kRes
    };
  }

  function calcTeamFightPower(team){
    // 3人実戦戦闘力%の平均（内部）
    // powerMin/powerMax からその場で抽選（「試合ごとに揺れる」）
    const members = Array.isArray(team.members) ? team.members : [];
    if (!members.length) return team.basePower || 60;

    // alive人数に合わせてメンバー数を使う（0は除外）
    const alive = clampInt(Number(team.alive ?? 3), 0, 3);

    // alive=2 は +40% 補正
    const boost = (alive === 2) ? (1 + CONF.twoAliveBoost / 100) : 1;

    const picks = [];
    for (let i=0; i<Math.min(3, members.length); i++){
      const m = members[i];
      const min = Number(m.powerMin ?? m.min ?? 60);
      const max = Number(m.powerMax ?? m.max ?? min);
      const v = randRange(min, max);
      picks.push(v);
    }

    // alive=1/2 でも平均の元は3人想定なので、単純に平均して補正だけ掛ける
    const avg = picks.reduce((s,v)=>s+v,0) / picks.length;
    return avg * boost;
  }

  function assignKillsAndAssists(winner, loser, aPow, bPow){
    // 差が大きいほど「格下を倒した勝者＝2〜3寄り」「格上を倒した勝者＝0〜2寄り」
    const diff = Math.abs(aPow - bPow);
    const close = diff < 8; // 接戦判定

    const wKills = biasedInt(CONF.winnerKillRange[0], CONF.winnerKillRange[1], close ? 0 : (aPow > bPow ? 1 : -1));
    const lKills = biasedInt(CONF.loserKillRange[0],  CONF.loserKillRange[1],  close ? 0 : (aPow > bPow ? -1 : 1));

    addTeamPoints(winner, 'kill', wKills);
    addTeamPoints(loser,  'kill', lKills);

    // 個人配分（kills）
    distributeMemberKills(winner, wKills);
    distributeMemberKills(loser,  lKills);

    // アシスト：1キルにつき最大1（Assist ≤ Kill を保証）
    const wAssists = roll(CONF.assistBase + (close ? CONF.assistCloseAdd : 0)) ? randInt(0, wKills) : 0;
    const lAssists = roll(CONF.assistBase + (close ? CONF.assistCloseAdd : 0)) ? randInt(0, lKills) : 0;

    addTeamPoints(winner, 'assist', wAssists);
    addTeamPoints(loser,  'assist', lAssists);

    distributeMemberAssists(winner, wAssists);
    distributeMemberAssists(loser,  lAssists);

    return {
      winner: { kills:wKills, assists:wAssists },
      loser:  { kills:lKills, assists:lAssists }
    };
  }

  function distributeMemberKills(team, kills){
    if (!kills) return;
    ensureMemberStats(team);
    for (let i=0; i<kills; i++){
      const m = pickByRoleWeight(team.members);
      if (m) m.kills = (m.kills || 0) + 1;
    }
    team.kills_total = sumMember(team.members, 'kills');
  }

  function distributeMemberAssists(team, assists){
    if (!assists) return;
    ensureMemberStats(team);
    for (let i=0; i<assists; i++){
      const m = pickByRoleWeight(team.members);
      if (m) m.assists = (m.assists || 0) + 1;
    }
    team.assists_total = sumMember(team.members, 'assists');
  }

  function ensureMemberStats(team){
    if (!Array.isArray(team.members)) team.members = [];
    for (const m of team.members){
      if (m.kills == null) m.kills = 0;
      if (m.assists == null) m.assists = 0;
    }
    if (team.kills_total == null) team.kills_total = 0;
    if (team.assists_total == null) team.assists_total = 0;
  }

  function pickByRoleWeight(members){
    const arr = (members || []).slice();
    if (!arr.length) return null;

    let sum = 0;
    const w = arr.map(m=>{
      const role = String(m.role || '').toUpperCase();
      const ww = CONF.roleWeight[role] ?? 1;
      sum += ww;
      return ww;
    });

    let r = Math.random() * sum;
    for (let i=0; i<arr.length; i++){
      r -= w[i];
      if (r <= 0) return arr[i];
    }
    return arr[arr.length-1];
  }

  function eliminateTeam(state, team, round){
    if (!team || team.eliminated) return;
    team.eliminated = true;
    team.alive = 0;

    // elimOrder（脱落順）に追加
    state.elimOrder.push({
      teamId: team.teamId,
      atRound: round,
      at: Date.now()
    });
  }

  function applyWinnerDb(team){
    // DB抽選（固定確率）
    const r = Math.random();
    let db = 0;
    if (r < CONF.winnerDbDist.db0){
      db = 0;
    }else if (r < CONF.winnerDbDist.db0 + CONF.winnerDbDist.db1){
      db = 1;
    }else{
      db = 2;
    }

    // alive / deathBoxes
    const alive = clampInt(Number(team.alive ?? 3), 0, 3);
    const loss = Math.min(db, alive); // 0〜alive
    team.alive = alive - loss;
    team.deathBoxes = clampInt(Number(team.deathBoxes ?? 0) + loss, 0, 3);
  }

  /* =========================
     result row（試合終了時）
  ========================== */

  function makeResultRow(team, rank){
    const points = normalizePoints(team.points);
    return {
      rank,
      teamId: team.teamId,
      name: team.name,
      areaId: team.areaId,
      areaName: (window.SimMap?.getAreaName ? window.SimMap.getAreaName(team.areaId) : `Area${team.areaId}`),
      points: points,
      placementPt: 0, // buildMatchResult で確定
      totalPt: 0,
      kills_total: Number(team.kills_total || 0),
      assists_total: Number(team.assists_total || 0),
      treasure: Number(points.treasure || 0),
      flag: Number(points.flag || 0)
    };
  }

  function normalizePoints(p){
    const o = p || {};
    return {
      placement: Number(o.placement || 0),
      kill:      Number(o.kill || 0),
      assist:    Number(o.assist || 0),
      treasure:  Number(o.treasure || 0),
      flag:      Number(o.flag || 0)
    };
  }

  function sumPoints(p){
    return Number(p.placement||0) + Number(p.kill||0) + Number(p.assist||0) + Number(p.treasure||0) + Number(p.flag||0);
  }

  function addTeamPoints(team, key, val){
    team.points = team.points || { placement:0, kill:0, assist:0, treasure:0, flag:0 };
    team.points[key] = (team.points[key] || 0) + (Number(val)||0);
  }

  function sumMember(members, key){
    let s = 0;
    for (const m of members || []) s += Number(m[key] || 0);
    return s;
  }

  /* =========================
     ログ（UI側で自由に表示）
  ========================== */

  function makeLog(type, A, B, text){
    const areaNameA = window.SimMap?.getAreaName ? window.SimMap.getAreaName(A.areaId) : `Area${A.areaId}`;
    const areaNameB = window.SimMap?.getAreaName ? window.SimMap.getAreaName(B.areaId) : `Area${B.areaId}`;
    return {
      type,
      aId: A.teamId, aName: A.name, aAreaId: A.areaId, aAreaName: areaNameA,
      bId: B.teamId, bName: B.name, bAreaId: B.areaId, bAreaName: areaNameB,
      text
    };
  }

  /* =========================
     乱数/補助
  ========================== */

  function roll(p){ return Math.random() < p; }

  function randInt(min,max){
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function randRange(min,max){
    const a = Number(min)||0, b = Number(max)||0;
    if (b <= a) return a;
    return a + Math.random() * (b - a);
  }

  function clamp(v, a, b){
    return Math.max(a, Math.min(b, v));
  }

  function clampInt(v, a, b){
    v = Math.floor(Number(v) || 0);
    return Math.max(a, Math.min(b, v));
  }

  // bias: -1(低め寄り) / 0(均等) / +1(高め寄り)
  function biasedInt(min, max, bias){
    min = Number(min)||0; max = Number(max)||0;
    if (max < min) [min,max] = [max,min];
    const span = max - min;

    if (span <= 0) return min;

    let r = Math.random();
    if (bias > 0){
      // 高め寄り：r^0.6
      r = Math.pow(r, 0.6);
    }else if (bias < 0){
      // 低め寄り：1-(1-r)^0.6
      r = 1 - Math.pow(1 - r, 0.6);
      r = 1 - r; // 反転で低めへ
    }
    return min + Math.round(r * span);
  }

})();
