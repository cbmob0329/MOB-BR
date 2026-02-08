'use strict';

/*
  MOB BR - match_encounter.js v1（フル）
  役割：
  - 交戦枠（R別の戦闘数）を確定仕様で作る
  - プレイヤー戦の発生確率（R別）で「プレイヤーが戦うか」を決める
  - 敵選び（同じArea優先 → いなければ全生存から抽選）※近接Area概念は使わない
  - 交戦カード（encounters）を返す：battle側がこれを処理する

  仕様（確定）：
  - 交戦枠：R1=4 / R2=4 / R3=4 / R4=4 / R5=2 / R6=1
  - プレイヤー戦確率：
      R1: 被りなら100%（被り無しなら通常抽選に落とす）
      R2: 70%
      R3: 75%
      R4: 80%
      R5: 85%
      R6: 100%
  - プレイヤー戦の敵選び：
      (1) 同じAreaに敵がいる → そこから1チーム抽選
      (2) いない → 生存チームから抽選（演出上「遭遇した」でOK）
    ※「近接Area（±1扱い）」は使用しない（禁止）
  - プレイヤー戦は“絶対”ではない（R別確率で寄せる）
  - 交戦は「起きたら」ではなく必ず枠数ぶん作る（成立）
  - eliminated=true のチームは交戦に参加させない
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.match = window.MOBBR.match || {};

(function(){
  const VERSION = 'v1';

  // =========================
  // Encounters per round（確定）
  // =========================
  const ENCOUNTER_SLOTS = { 1:4, 2:4, 3:4, 4:4, 5:2, 6:1 };

  // プレイヤー戦確率（確定）
  const PLAYER_FIGHT_RATE = { 1:1.00, 2:0.70, 3:0.75, 4:0.80, 5:0.85, 6:1.00 };

  // =========================
  // Utils
  // =========================
  function getTeamsFromState(state){
    if (!state) return [];
    if (Array.isArray(state.teams)) return state.teams;
    if (Array.isArray(state.teamStates)) return state.teamStates;
    if (Array.isArray(state.allTeams)) return state.allTeams;
    return [];
  }

  function isEliminated(team){
    return !!team?.eliminated || (Number(team?.alive) || 0) <= 0 && team?.eliminated === true;
  }

  function aliveTeams(state){
    return getTeamsFromState(state).filter(t => t && !isEliminated(t));
  }

  function getPlayerTeam(state){
    // 柔軟：state.playerTeam / state.playerTeamId / state.playerTeamIndex / teams[].isPlayer
    if (!state) return null;
    if (state.playerTeam && typeof state.playerTeam === 'object') return state.playerTeam;

    const teams = getTeamsFromState(state);
    const byFlag = teams.find(t => t && (t.isPlayer === true || t.isPlayerTeam === true));
    if (byFlag) return byFlag;

    const id = state.playerTeamId ?? state.playerTeamKey ?? null;
    if (id != null){
      const found = teams.find(t => String(t.teamId ?? t.id ?? t.key) === String(id));
      if (found) return found;
    }

    const idx = Number(state.playerTeamIndex);
    if (Number.isFinite(idx) && teams[idx]) return teams[idx];

    // ここまで無ければ先頭を「プレイヤー」と仮定はしない（事故るのでnull）
    return null;
  }

  function randPick(arr){
    if (!arr || arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function shuffle(arr){
    const a = arr.slice();
    for (let i=a.length-1; i>0; i--){
      const j = Math.floor(Math.random() * (i+1));
      const t = a[i]; a[i] = a[j]; a[j] = t;
    }
    return a;
  }

  function hasSameAreaEnemy(player, teams){
    if (!player) return false;
    const a = Number(player.areaId);
    if (!Number.isFinite(a)) return false;
    return teams.some(t => t && t !== player && !isEliminated(t) && Number(t.areaId) === a);
  }

  function pickEnemyForPlayer(player, teams){
    if (!player) return null;
    const area = Number(player.areaId);

    // (1) 同じArea優先
    if (Number.isFinite(area)){
      const same = teams.filter(t => t && t !== player && !isEliminated(t) && Number(t.areaId) === area);
      const e1 = randPick(same);
      if (e1) return e1;
    }

    // (2) 生存から抽選（演出上「遭遇」でOK）
    const pool = teams.filter(t => t && t !== player && !isEliminated(t));
    return randPick(pool);
  }

  // 2チームを消費して1交戦を作る（同一チーム重複を避ける）
  function pickPairFromPool(pool){
    // pool: array of team objects (alive)
    if (!pool || pool.length < 2) return null;
    const a = pool.pop();
    if (!a) return null;
    const b = pool.pop();
    if (!b) return null;
    return [a,b];
  }

  // =========================
  // Public: buildEncounters
  // =========================
  /*
    戻り値：
    {
      round,
      slots,
      playerInvolved: true/false,
      encounters: [
        {
          round,
          index,
          kind: 'player' | 'cpu',
          aTeamId,
          bTeamId,
          aIsPlayer,
          bIsPlayer,
          aAreaId,
          bAreaId
        }, ...
      ]
    }
  */
  function buildEncounters(state, round){
    const r = Number(round) || 0;
    const slots = ENCOUNTER_SLOTS[r] ?? 0;

    const teams = aliveTeams(state);
    const player = getPlayerTeam(state);

    const pack = {
      round: r,
      slots,
      playerInvolved: false,
      encounters: []
    };

    if (slots <= 0) return pack;
    if (teams.length < 2) return pack;

    // プレイヤー戦を入れるか？（確率）
    let wantPlayer = false;
    if (player && !isEliminated(player)){
      if (r === 1){
        // R1: 被りなら100% ただし「被り無し」なら通常抽選へ
        if (hasSameAreaEnemy(player, teams)){
          wantPlayer = true;
        }else{
          wantPlayer = (Math.random() < (PLAYER_FIGHT_RATE[r] ?? 0));
        }
      }else{
        wantPlayer = (Math.random() < (PLAYER_FIGHT_RATE[r] ?? 0));
      }
    }

    // 交戦生成
    const used = new Set(); // teamId
    const getId = (t)=> String(t.teamId ?? t.id ?? t.key ?? '');

    function markUsed(t){
      const id = getId(t);
      if (id) used.add(id);
    }
    function isUsed(t){
      const id = getId(t);
      return id ? used.has(id) : false;
    }

    let idx = 0;

    // (A) まずプレイヤー交戦を1枠入れる（入れるなら）
    if (wantPlayer && player && !isEliminated(player)){
      const enemy = pickEnemyForPlayer(player, teams);
      if (enemy){
        // 同じチームが複数枠に出るのは仕様上禁止ではないが、
        // 1Round中に同一チームが何度も交戦すると不自然なので「基本は1回」に寄せる。
        // ただし人数が足りない場合は後段で緩和する（fallback）。
        pack.playerInvolved = true;

        const aIsPlayer = true;
        const bIsPlayer = false;

        pack.encounters.push({
          round: r,
          index: idx++,
          kind: 'player',
          aTeamId: getId(player),
          bTeamId: getId(enemy),
          aIsPlayer,
          bIsPlayer,
          aAreaId: Number(player.areaId) || 0,
          bAreaId: Number(enemy.areaId) || 0
        });

        markUsed(player);
        markUsed(enemy);
      }
    }

    // (B) 残り枠をCPU交戦で埋める（必ず slots まで）
    // 基本は「未使用優先」でペア作成、足りなければ使用済みも混ぜて埋める
    const need = Math.max(0, slots - pack.encounters.length);

    // 未使用の生存チーム
    let poolPrimary = shuffle(teams.filter(t => !isUsed(t)));
    // 使用済みも含む生存チーム（fallback）
    let poolAny = shuffle(teams);

    for (let k=0; k<need; k++){
      let pair = null;

      // まず未使用から取りたい
      if (poolPrimary.length >= 2){
        pair = pickPairFromPool(poolPrimary);
      }

      // 足りなければ、全体から（同一チーム重複だけは避ける）
      if (!pair){
        // poolAny から2つ取るが、同一でないように調整
        // 取り直しは最大数回で止める（無限ループ防止）
        for (let tries=0; tries<20; tries++){
          const a = randPick(poolAny);
          const b = randPick(poolAny);
          if (!a || !b) continue;
          if (a === b) continue;
          if (isEliminated(a) || isEliminated(b)) continue;

          pair = [a,b];
          break;
        }
      }

      if (!pair) break; // どうしても作れない（生存<2など）

      const [A,B] = pair;

      // プレイヤーが既に交戦済みなら、CPU枠には入れない（プレイヤー視点ログの整合）
      if (player && (A === player || B === player)) {
        // 代替ペアを探す
        let replaced = false;
        for (let tries=0; tries<30; tries++){
          const a = randPick(teams);
          const b = randPick(teams);
          if (!a || !b) continue;
          if (a === b) continue;
          if (a === player || b === player) continue;
          if (isEliminated(a) || isEliminated(b)) continue;
          pair[0] = a; pair[1] = b;
          replaced = true;
          break;
        }
        if (!replaced){
          // 置換できないならそのままスキップして次へ（ただし枠は埋めたいので k-- して再試行）
          k--;
          continue;
        }
      }

      const aId = getId(pair[0]);
      const bId = getId(pair[1]);
      const aIsP = (player && pair[0] === player);
      const bIsP = (player && pair[1] === player);

      pack.encounters.push({
        round: r,
        index: idx++,
        kind: (aIsP || bIsP) ? 'player' : 'cpu',
        aTeamId: aId,
        bTeamId: bId,
        aIsPlayer: !!aIsP,
        bIsPlayer: !!bIsP,
        aAreaId: Number(pair[0].areaId) || 0,
        bAreaId: Number(pair[1].areaId) || 0
      });

      markUsed(pair[0]);
      markUsed(pair[1]);

      // primary pool も更新したいので、usedが増えた分を取り除く（簡易に再フィルタ）
      poolPrimary = poolPrimary.filter(t => !isUsed(t));
    }

    // まだ足りない場合（極端な生存不足）
    // 「必ず枠数」だが、生存<2なら物理的に無理なのでここで止める。
    // （battle側で安全に処理できるよう pack.encounters.length を見ればOK）
    return pack;
  }

  // =========================
  // Expose
  // =========================
  window.MOBBR.match.encounter = {
    VERSION,
    ENCOUNTER_SLOTS,
    PLAYER_FIGHT_RATE,
    buildEncounters
  };
})();
