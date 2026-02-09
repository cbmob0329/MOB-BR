/* =========================================================
   MOB BR - sim_battle.js (FULL / UPDATED)
   - 交戦処理（必ず枠数ぶん成立）
   - 勝敗 / 脱落 / DB（deathBoxes）/ キル&アシスト配分
   - お宝/フラッグは sim_event.js が points に加算済み（ここでは触らない）
   ---------------------------------------------------------
   追加（今回）：
   ✅ カードコレクション効果（mobbr_cards + data.cards があれば）を
      「プレイヤーチームの戦闘力」に反映
   ✅ コーチスキル効果（mobbr_coachSkillsEquipped / mobbr_coachSkillChosen があれば）を
      「プレイヤーチームの戦闘力/アシスト/DB」に反映
      ※“消耗品削除”や“試合前選択UI”は大会側(sim_tournament_xxx)で行う
   ---------------------------------------------------------
   依存：なし（あれば使う）
   - SimMap（任意）：areaName 表示用
   - RULES（任意）：外部設定
   - window.MOBBR.data.cards（任意）：カード効果%計算用
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

    // ===== 追加：カード/コーチ反映のON/OFF（任意） =====
    enableCardBonus: true,
    enableCoachSkill: true
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
     コーチスキル（ui_team と同ID）
     ※“選択して使う/消耗”は大会側で管理
     ここでは「効果量」を参照して戦闘に反映するだけ
  ========================== */
  const COACH_EFFECTS = {
    tactics_note:   { powerPct: 1 },              // この試合 +1%
    mental_care:    { assistAdd: 0.08 },          // アシスト微増
    endgame_power:  { powerPctEndgame: 3 },       // 終盤(目安R5-R6) +3%
    clearing:       { winnerDbSafe: 0.12 },       // 勝者DBが減りやすい（db2確率↓）
    score_mind:     { /* points側 */ },           // お宝/旗は sim_event 側なのでここでは触らない
    igl_call:       { powerPct: 4 },              // この試合 +4%
    protagonist:    { powerPct: 6, assistAdd: 0.12 } // この試合 +6% +アシスト増
  };

  // 参照キー（存在しなくてもOK）
  const LS = {
    cardsOwned: 'mobbr_cards',
    coachEquipped: 'mobbr_coachSkillsEquipped',   // [id|null,id|null,id|null]
    coachChosen:  'mobbr_coachSkillChosen'        // 1試合前に選んだ1つ（大会側が書く想定）
  };

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

    // 念のため 1〜N を満たす（不足時）
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

    return ranked.sort((a,b)=>a.rank-b.rank);
  };

  /* =========================
     交戦ペア生成
  ========================== */

  function buildFightPairs(state, round, count, opt){
    const pairs = [];
    const teams = state.teams || [];
    const alive = teams.filter(t => t && !t.eliminated);

    const need = Math.max(0, Number(count) || 0);
    if (need === 0) return pairs;

    const pId = state.playerTeamId || null;
    const pTeam = pId ? alive.find(t => t.teamId === pId) : null;
    const wantPlayerFight = !!pTeam && roll(CONF.playerFightRate[round] ?? 0);

    // R1は「被り4箇所」優先（opt.overlappedAreasR1 があれば利用）
    if (round === 1){
      const overlapped = (opt && Array.isArray(opt.overlappedAreasR1)) ? opt.overlappedAreasR1.slice() : null;
      if (overlapped && overlapped.length){
        const used = new Set();
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

    const usedIds = new Set();
    for (const [a,b] of pairs){ usedIds.add(a.teamId); usedIds.add(b.teamId); }

    // 同エリア優先→足りなければランダム
    while (pairs.length < need){
      const pool = alive.filter(t => !usedIds.has(t.teamId));
      if (pool.length < 2) break;

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

    return pairs;
  }

  function pickEnemyForPlayer(alive, pTeam){
    const same = alive.filter(t => t.teamId !== pTeam.teamId && t.areaId === pTeam.areaId);
    if (same.length) return same[Math.floor(Math.random()*same.length)];
    const other = alive.filter(t => t.teamId !== pTeam.teamId);
    if (!other.length) return null;
    return other[Math.floor(Math.random()*other.length)];
  }

  function pickFinalPair(alive, playerTeamId){
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

    logs.push(makeLog('BATTLE_START', A, B, `交戦開始！`));

    // 戦闘力（カード/コーチ反映込み）
    const aPow = calcTeamFightPower(state, A, round);
    const bPow = calcTeamFightPower(state, B, round);
    const diff = aPow - bPow;

    const aWinRate = clamp(50 + diff * CONF.winrateK, CONF.winrateMin, CONF.winrateMax);
    const aWin = roll(aWinRate / 100);

    const winner = aWin ? A : B;
    const loser  = aWin ? B : A;

    // キル/アシスト
    const kRes = assignKillsAndAssists(state, winner, loser, aPow, bPow, round);

    // 敗者：全滅（確定）
    eliminateTeam(state, loser, round);

    // 勝者：DB抽選（勝者も削れる）※コーチ効果で少し補正
    applyWinnerDb(state, winner, round);

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

  function calcTeamFightPower(state, team, round){
    const members = Array.isArray(team.members) ? team.members : [];
    if (!members.length) return team.basePower || 60;

    const alive = clampInt(Number(team.alive ?? 3), 0, 3);
    const boostAlive = (alive === 2) ? (1 + CONF.twoAliveBoost / 100) : 1;

    const picks = [];
    for (let i=0; i<Math.min(3, members.length); i++){
      const m = members[i];
      const min = Number(m.powerMin ?? m.min ?? 60);
      const max = Number(m.powerMax ?? m.max ?? min);
      const v = randRange(min, max);
      picks.push(v);
    }

    const avg = picks.reduce((s,v)=>s+v,0) / picks.length;
    let pow = avg * boostAlive;

    // ===== 追加：カード効果 / コーチ効果（プレイヤーだけ） =====
    const isPlayer = isPlayerTeam(state, team);

    if (isPlayer){
      if (CONF.enableCardBonus){
        const bonus = getCollectionBonusPercent(); // 例 0.27
        if (bonus > 0) pow *= (1 + bonus / 100);
      }
      if (CONF.enableCoachSkill){
        const eff = getCoachEffect(state, round);
        if (eff.powerPct) pow *= (1 + eff.powerPct / 100);
        if (eff.powerPctEndgame && (round >= 5)) pow *= (1 + eff.powerPctEndgame / 100);
      }
    }

    return pow;
  }

  function assignKillsAndAssists(state, winner, loser, aPow, bPow, round){
    const diff = Math.abs(aPow - bPow);
    const close = diff < 8;

    const wKills = biasedInt(CONF.winnerKillRange[0], CONF.winnerKillRange[1], close ? 0 : (aPow > bPow ? 1 : -1));
    const lKills = biasedInt(CONF.loserKillRange[0],  CONF.loserKillRange[1],  close ? 0 : (aPow > bPow ? -1 : 1));

    addTeamPoints(winner, 'kill', wKills);
    addTeamPoints(loser,  'kill', lKills);

    distributeMemberKills(winner, wKills);
    distributeMemberKills(loser,  lKills);

    // アシスト確率（コーチで増える）
    let assistRate = CONF.assistBase + (close ? CONF.assistCloseAdd : 0);

    // プレイヤーが関わる陣営のみ補正（“選手を信じよう”時は増えない）
    const pEff = (CONF.enableCoachSkill) ? getCoachEffect(state, round) : {};
    if (pEff.assistAdd){
      // 勝者側がプレイヤーなら加算、敗者側がプレイヤーなら加算（両方は無い想定）
      if (isPlayerTeam(state, winner) || isPlayerTeam(state, loser)){
        assistRate += Number(pEff.assistAdd) || 0;
      }
    }
    assistRate = clamp(assistRate, 0, 0.92);

    const wAssists = roll(assistRate) ? randInt(0, wKills) : 0;
    const lAssists = roll(assistRate) ? randInt(0, lKills) : 0;

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

    state.elimOrder.push({
      teamId: team.teamId,
      atRound: round,
      at: Date.now()
    });
  }

  function applyWinnerDb(state, team, round){
    // 基本確率
    let dist = Object.assign({}, CONF.winnerDbDist);

    // コーチ（クリアリング徹底）：db2 を下げて db0 に寄せる
    if (CONF.enableCoachSkill && isPlayerTeam(state, team)){
      const eff = getCoachEffect(state, round);
      if (eff.winnerDbSafe){
        const safe = clamp(Number(eff.winnerDbSafe)||0, 0, 0.35);
        // db2 から safe 分だけ引いて db0 に足す（db1はそのまま）
        const cut = Math.min(dist.db2, safe);
        dist.db2 -= cut;
        dist.db0 += cut;
        // 正規化（微小誤差対策）
        const s = dist.db0 + dist.db1 + dist.db2;
        if (s > 0){
          dist.db0 /= s; dist.db1 /= s; dist.db2 /= s;
        }
      }
    }

    const r = Math.random();
    let db = 0;
    if (r < dist.db0){
      db = 0;
    }else if (r < dist.db0 + dist.db1){
      db = 1;
    }else{
      db = 2;
    }

    const alive = clampInt(Number(team.alive ?? 3), 0, 3);
    const loss = Math.min(db, alive);
    team.alive = alive - loss;
    team.deathBoxes = clampInt(Number(team.deathBoxes ?? 0) + loss, 0, 3);
  }

  /* =========================
     カード効果（%）
     - ui_team.js と同様に
       window.MOBBR.data.cards があれば使う
  ========================== */
  function getCollectionBonusPercent(){
    try{
      if (!CONF.enableCardBonus) return 0;

      const DC = window.MOBBR?.data?.cards || window.DataCards || null;
      if (!DC || !DC.getById || !DC.calcSingleCardPercent) return 0;

      const owned = JSON.parse(localStorage.getItem(LS.cardsOwned) || '{}') || {};
      let sum = 0;

      for (const id in owned){
        const cnt = Number(owned[id]) || 0;
        if (cnt <= 0) continue;

        const card = DC.getById(id);
        if (!card) continue;

        const effCnt = Math.max(0, Math.min(10, cnt));
        sum += DC.calcSingleCardPercent(card.rarity, effCnt);
      }

      if (!Number.isFinite(sum)) return 0;
      return Math.max(0, sum);
    }catch{
      return 0;
    }
  }

  /* =========================
     コーチ効果（1試合で使う1つ）
     - 大会側が「この試合で使う」を選ばせたら
       localStorage.mobbr_coachSkillChosen に id を入れる想定
     - まだ無ければ “装備中の1枠目” を暫定参照（無いよりマシ）
  ========================== */
  function getCoachEffect(state, round){
    if (!CONF.enableCoachSkill) return {};

    let chosen = null;

    // (1) この試合で選択されたスキル（大会側がセット）
    try{
      chosen = String(localStorage.getItem(LS.coachChosen) || '').trim() || null;
    }catch{}

    // (2) 無ければ装備中の先頭を参照（暫定）
    if (!chosen){
      try{
        const eq = JSON.parse(localStorage.getItem(LS.coachEquipped) || '[]');
        if (Array.isArray(eq)){
          const first = (typeof eq[0] === 'string') ? eq[0].trim() : '';
          chosen = first || null;
        }
      }catch{}
    }

    if (!chosen) return {};
    const eff = COACH_EFFECTS[chosen] || {};
    // 返す時に id も持たせる（後段で参照）
    return Object.assign({ id: chosen }, eff);
  }

  function isPlayerTeam(state, team){
    if (!state || !team) return false;
    const pId = state.playerTeamId || null;
    if (pId && team.teamId === pId) return true;
    return !!team.isPlayer;
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
      placementPt: 0,
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
      r = Math.pow(r, 0.6);
    }else if (bias < 0){
      r = 1 - Math.pow(1 - r, 0.6);
      r = 1 - r;
    }
    return min + Math.round(r * span);
  }

})();
