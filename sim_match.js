/* =========================================================
   MOB BR - sim_match.js (FULL / SPEC COMPLETE)
   ---------------------------------------------------------
   役割：
   ・20チームの1試合をR1〜R6で進行（試合の流れ.txt 準拠）
   ・Rごとの「イベント回数」「交戦枠数」「生存推移」を確定通りに実行
   ・プレイヤー戦は確率で寄せる（R別確率）
   ・結果として各チームに以下を付与
     - eliminatedRound (1..6 / 優勝は null)
     - kp / ap / treasure / flag
     - deathBoxes / alive（ラウンド内の進行用）
   ・最終的な順位表は sim_result.js（SimResult.buildMatchResult）で確定する想定
   ---------------------------------------------------------
   依存：
   ・window.SimMap（sim-map.js）
   ・window.SimResult（sim_result.js）
   ・window.DataCPU（data_cpu_teams.js）
   ・window.DataPlayer（プレイヤーチームがある場合）
========================================================= */

(function(){
  'use strict';

  const SimMatch = {};
  window.SimMatch = SimMatch;

  const SimMap = window.SimMap || null;
  const SimResult = window.SimResult || null;

  /* =========================
     CONSTANTS (確定)
  ========================== */

  // 生存推移（ラウンド終了時点の生存チーム数）
  const ALIVE_TARGET = {
    1: 16,
    2: 12,
    3: 8,
    4: 4,
    5: 2,
    6: 1
  };

  // 交戦枠（確定）
  const FIGHT_SLOTS = { 1:4, 2:4, 3:4, 4:4, 5:2, 6:1 };

  // プレイヤー戦寄せ（確定）
  const PLAYER_FIGHT_RATE = { 1:1.00, 2:0.70, 3:0.75, 4:0.80, 5:0.85, 6:1.00 };

  // イベント回数（確定）
  const EVENT_COUNT = { 1:1, 2:2, 3:2, 4:2, 5:2, 6:0 };

  // 移動先エリア群（確定）
  // R1-R2: 1..16 / R3:17..20 / R4:21..22 / R5:23..24 / R6:25
  const ROUND_AREAS = {
    1: range(1,16),
    2: range(1,16),
    3: range(17,20),
    4: range(21,22),
    5: range(23,24),
    6: [25]
  };

  // リスポーン（確定）
  // R1-R5: DB1=100%1復活, DB2=70%2復活/30%1復活
  // R6: DB>=1なら全員復活（alive=3, DB=0）
  const DB2_REVIVE_2_RATE = 0.70;

  // 勝者DB抽選（確定）
  const WINNER_DB_TABLE = [
    { n:0, p:0.55 },
    { n:1, p:0.35 },
    { n:2, p:0.10 },
  ];

  // イベント（重み抽選・同ラウンド重複なし・全滅除外：確定）
  // ※重みはそのまま採用（合計は内部で正規化）
  const EVENTS = [
    { key:'meeting',  w:35, name:'作戦会議',  say:'作戦会議！連携力がアップ！', effect:{ agilityP:+1 } },
    { key:'circle',   w:35, name:'円陣',      say:'円陣を組んだ！ファイト力がアップ！', effect:{ aimP:+1 } },
    { key:'scout',    w:35, name:'冷静な索敵', say:'冷静に索敵！先手を取りやすくなる！', effect:{ mentalP:+1 } },

    { key:'rareW',    w:10, name:'レア武器ゲット', say:'レア武器を拾った！全員のエイムが大きくアップ！', effect:{ aimP:+2 } },

    { key:'miss',     w:15, name:'判断ミス',  say:'向かう方向が分かれてタイムロス！敏捷性が下がった！', effect:{ agilityP:-1 } },
    { key:'fight',    w:10, name:'喧嘩',      say:'コールが嚙み合わない！全員のメンタルが減少！', effect:{ mentalP:-1 } },

    { key:'zone',     w:5,  name:'ゾーンに入る', say:'全員がゾーンに入り覚醒！', effect:{ aimP:+3, mentalP:+3 } },

    { key:'treasure', w:4,  name:'お宝ゲット', say:'お宝をゲットした！', effect:{ treasure:+1 } },
    { key:'flag',     w:2,  name:'フラッグゲット', say:'フラッグをゲットした！', effect:{ flag:+1 } },
  ];

  // キル配分重み（確定）
  const KILL_ROLE_WEIGHT = { ATTACKER:50, IGL:30, SUPPORT:20 };

  /* =========================
     PUBLIC API
  ========================== */

  /**
   * 1試合実行（20チーム想定）
   * @param {Array} teams - プレイヤー含むチーム配列（オブジェクト参照を直接更新）
   * @param {Object} opt
   *   - wantTimeline: true なら timeline を返す（UI用）
   *   - forcePlayerFight: true なら常にプレイヤー戦（デバッグ用）
   * @returns {Object}
   *   - teams: 更新済みteams
   *   - resultRows: SimResult.buildMatchResult の結果（SimResultがある場合）
   *   - timeline: 省略可
   */
  SimMatch.playMatch = function(teams, opt){
    opt = opt || {};
    if(!Array.isArray(teams) || teams.length === 0){
      return { teams: teams || [], resultRows: [], timeline: [] };
    }
    if(!SimMap){
      console.warn('[sim_match] SimMap not found');
    }

    // 初期化
    initMatchState(teams);

    const timeline = opt.wantTimeline ? [] : null;

    // R1 降下配置（16分散+被り4）
    if(SimMap && typeof SimMap.deployR1 === 'function'){
      const dep = SimMap.deployR1(teams);
      if(timeline){
        timelinePush(timeline, 'drop', {
          round: 1,
          text: ['バトルスタート！','降下開始…！'],
          overlappedAreas: dep?.overlappedAreas || []
        });
      }
    }else{
      // 最低限：ランダムにR1範囲へ
      moveAllAliveToRoundAreas(teams, 1);
    }

    // R1〜R6
    for(let r=1; r<=6; r++){
      // Round開始ログ
      if(timeline){
        timelinePush(timeline, 'roundStart', { round:r, text:[`Round ${r} 開始！`] });
      }

      // R別：リスポーン
      doRespawn(teams, r, timeline);

      // R別：イベント
      doEvents(teams, r, timeline);

      // R別：交戦（枠数ぶん必ず）
      doFights(teams, r, timeline, opt);

      // Round終了：移動（R6は最終なので移動しない）
      if(r <= 5){
        if(timeline){
          timelinePush(timeline, 'moveStart', { round:r, text:['安置が縮む…移動開始！','ルート変更。急げ！'] });
        }
        moveAllAliveToRoundAreas(teams, r+1);
        if(timeline){
          const p = getPlayerTeam(teams);
          const areaId = p?.areaId || null;
          const areaName = SimMap ? SimMap.getAreaName(areaId) : `Area${areaId}`;
          timelinePush(timeline, 'moveArrive', { round:r, text:[`${areaName}へ到着！`], areaId });
        }
      }
    }

    // result
    let resultRows = [];
    if(SimResult && typeof SimResult.buildMatchResult === 'function'){
      resultRows = SimResult.buildMatchResult(teams);
    }

    return {
      teams,
      resultRows,
      timeline: timeline || undefined
    };
  };

  /* =========================
     INIT
  ========================== */

  function initMatchState(teams){
    for(const t of teams){
      if(!t) continue;

      // 生存状態
      if(typeof t.alive !== 'number') t.alive = 3;
      if(typeof t.deathBoxes !== 'number') t.deathBoxes = 0;
      t.eliminated = false;
      t.eliminatedRound = null;

      // ポイント
      t.kp = t.kp || 0;
      t.ap = t.ap || 0;
      t.treasure = t.treasure || 0;
      t.flag = t.flag || 0;

      // イベントバフ（％は内部のみ）
      t.eventBuffs = { aimP:0, mentalP:0, agilityP:0 };

      // メンバー（キル/アシスト集計用）
      if(!Array.isArray(t.members)) t.members = [];
      for(const m of t.members){
        m.kills = m.kills || 0;
        m.assists = m.assists || 0;
      }

      // avgPlace（タイブレーク用：無ければ大きめ）
      if(typeof t.avgPlace !== 'number') t.avgPlace = 99;
    }
  }

  /* =========================
     RESPAWN
  ========================== */

  function doRespawn(teams, round, timeline){
    const p = getPlayerTeam(teams);

    for(const t of teams){
      if(!t || t.eliminated) continue;

      if(round === 6){
        // R6：DB>=1 なら全員復活（確定）
        if((t.deathBoxes||0) >= 1){
          t.alive = 3;
          t.deathBoxes = 0;

          if(timeline && t === p){
            timelinePush(timeline, 'respawn', { round, text:['最終前に全員復帰！万全で行く！'] });
          }
        }else{
          // deathBoxes=0 はログ無し
        }
        continue;
      }

      // R1〜R5
      const db = t.deathBoxes || 0;
      if(db === 0){
        if(timeline && t === p){
          timelinePush(timeline, 'respawn', { round, text:['復活対象なし。全員生存！'] });
        }
        continue;
      }

      if(db === 1){
        t.alive = clamp((t.alive||0) + 1, 0, 3);
        t.deathBoxes = 0;

        if(timeline && t === p){
          timelinePush(timeline, 'respawn', { round, text:['デスボ回収成功！1人復帰！'] });
        }
        continue;
      }

      if(db >= 2){
        const roll = Math.random();
        if(roll < DB2_REVIVE_2_RATE){
          t.alive = clamp((t.alive||0) + 2, 0, 3);
          t.deathBoxes = db - 2;
          if(timeline && t === p){
            timelinePush(timeline, 'respawn', { round, text:['デスボ回収成功！一気に2人復帰！'] });
          }
        }else{
          t.alive = clamp((t.alive||0) + 1, 0, 3);
          t.deathBoxes = db - 1;
          if(timeline && t === p){
            timelinePush(timeline, 'respawn', { round, text:['デスボ回収…1人しか戻せない！'] });
          }
        }
      }
    }
  }

  /* =========================
     EVENTS
  ========================== */

  function doEvents(teams, round, timeline){
    const n = EVENT_COUNT[round] || 0;
    if(n <= 0) return;

    const aliveTeams = teams.filter(t => t && !t.eliminated);

    // 同ラウンド重複なし
    const usedKeys = new Set();

    for(let i=0;i<n;i++){
      const ev = pickWeightedEvent(usedKeys);
      if(!ev) break;

      // 対象：eliminated=false のみ（確定）
      const target = pickRandom(aliveTeams);
      if(!target) break;

      applyEvent(target, ev);

      if(timeline){
        const p = getPlayerTeam(teams);
        // 画面ログは「プレイヤー視点」主体なので、対象がプレイヤーの時だけ濃く見せる
        if(target === p){
          timelinePush(timeline, 'event', {
            round,
            text: ['イベント発生！', ev.name, ev.say],
            eventKey: ev.key
          });
        }else{
          // CPUイベントは裏処理だが、仕様としてイベントログは「プレイヤー視点のみ」なので出さない
          // ただし UI側で欲しければここを切替できる
        }
      }
    }
  }

  function pickWeightedEvent(usedKeys){
    // 重み抽選（重複なし）
    const cand = EVENTS.filter(e => !usedKeys.has(e.key));
    if(cand.length === 0) return null;

    const sum = cand.reduce((a,e)=>a+(e.w||0),0);
    let r = Math.random() * sum;
    for(const e of cand){
      r -= (e.w||0);
      if(r <= 0){
        usedKeys.add(e.key);
        return e;
      }
    }
    usedKeys.add(cand[cand.length-1].key);
    return cand[cand.length-1];
  }

  function applyEvent(team, ev){
    const ef = ev.effect || {};
    team.eventBuffs = team.eventBuffs || { aimP:0, mentalP:0, agilityP:0 };

    if(typeof ef.aimP === 'number') team.eventBuffs.aimP += ef.aimP;
    if(typeof ef.mentalP === 'number') team.eventBuffs.mentalP += ef.mentalP;
    if(typeof ef.agilityP === 'number') team.eventBuffs.agilityP += ef.agilityP;

    if(typeof ef.treasure === 'number') team.treasure = (team.treasure||0) + ef.treasure;
    if(typeof ef.flag === 'number') team.flag = (team.flag||0) + ef.flag;
  }

  /* =========================
     FIGHTS
  ========================== */

  function doFights(teams, round, timeline, opt){
    const slots = FIGHT_SLOTS[round] || 0;
    if(slots <= 0) return;

    // このラウンドで何チーム脱落させるべきか（確定：生存推移に一致）
    const aliveNow = countAliveTeams(teams);
    const targetAlive = ALIVE_TARGET[round] || Math.max(1, aliveNow - slots);
    const needElims = Math.max(0, aliveNow - targetAlive);

    // slots と needElims は常に一致する設計（R1=4, R5=2, R6=1）なのでここは安全
    // ずれた場合でも、needElims 分は必ず脱落させる。
    let remainingElims = needElims;

    for(let i=0;i<slots;i++){
      if(remainingElims <= 0){
        // ここに来る想定は基本ない（仕様上 slots==elim ）
        break;
      }

      const pair = pickFightPair(teams, round, opt);
      if(!pair) break;

      const { a, b, isPlayerFight } = pair;

      // 交戦実行（敗者は必ず全滅＝脱落）
      const out = resolveFight(a, b, round);

      // ログ（プレイヤー交戦のみ）
      if(timeline && isPlayerFight){
        timelinePush(timeline, 'battleStart', {
          round,
          text: ['敵影を確認…！','戦闘開始！'],
          enemyTeamId: out.loser === a ? b.teamId : a.teamId
        });
      }

      // 勝敗反映
      applyFightOutcome(out, round, isPlayerFight ? timeline : null);

      remainingElims--;
    }
  }

  function pickFightPair(teams, round, opt){
    const alive = teams.filter(t => t && !t.eliminated);
    if(alive.length < 2) return null;

    const player = getPlayerTeam(teams);

    // プレイヤー戦を寄せるか
    let wantPlayer = false;
    if(opt && opt.forcePlayerFight) wantPlayer = true;
    else{
      if(player && !player.eliminated){
        // R1は「被りなら100%」なので area 内に敵が居るなら確定
        if(round === 1){
          const same = alive.filter(t => t !== player && t.areaId === player.areaId);
          if(same.length > 0) wantPlayer = true;
          else wantPlayer = false;
        }else{
          wantPlayer = Math.random() < (PLAYER_FIGHT_RATE[round] || 0);
        }
      }
    }

    if(wantPlayer && player && !player.eliminated){
      // (1) 同じArea → そこから抽選
      const same = alive.filter(t => t !== player && t.areaId === player.areaId);
      if(same.length > 0){
        return { a: player, b: pickRandom(same), isPlayerFight: true };
      }
      // (2) いない → 生存から抽選（近接Areaは使わない確定）
      const cand = alive.filter(t => t !== player);
      return { a: player, b: pickRandom(cand), isPlayerFight: true };
    }

    // CPU同士（同じAreaの2チームを優先、無ければランダム）
    const byArea = new Map();
    for(const t of alive){
      const k = t.areaId || 0;
      if(!byArea.has(k)) byArea.set(k, []);
      byArea.get(k).push(t);
    }
    const crowded = [];
    for(const [areaId, list] of byArea.entries()){
      if(areaId && list.length >= 2) crowded.push({ areaId, list });
    }
    if(crowded.length > 0){
      const c = pickRandom(crowded);
      const list = c.list.slice();
      shuffleInPlace(list);
      return { a:list[0], b:list[1], isPlayerFight:false };
    }

    // 完全ランダム
    shuffleInPlace(alive);
    return { a:alive[0], b:alive[1], isPlayerFight:(alive[0]===player || alive[1]===player) };
  }

  /* =========================
     FIGHT RESOLVE（内部）
     ※戦闘ロジックは別でも良いが、試合を進めるために最低限はここで確定させる
  ========================== */

  function resolveFight(a, b, round){
    // 戦闘力（内部）：3人%平均 + バフ + 2人補正 + プレイヤー固有要素
    const pa = teamFightPower(a, round);
    const pb = teamFightPower(b, round);

    const diff = pa - pb;
    const winRateA = clamp(50 + diff * 1.8, 22, 78) / 100;

    const aWin = Math.random() < winRateA;
    const winner = aWin ? a : b;
    const loser  = aWin ? b : a;

    // キル/アシスト（全チーム裏集計は同ルール）
    // 勝者：0〜3 / 敗者：0〜2（確定）
    const winKills = randIntWeighted([0,1,2,3], [10,25,35,30]);
    const loseKills = randIntWeighted([0,1,2], [55,35,10]);

    // アシスト：Killを絶対に超えない（確定）
    const winAssists = randInt(0, winKills);      // 1キル最大1A になるように総数を制限
    const loseAssists = randInt(0, loseKills);

    // DB：勝者のみ抽選（確定）
    const winnerDb = pickByProb(WINNER_DB_TABLE);

    return {
      winner,
      loser,
      winnerDb,
      winKills,
      loseKills,
      winAssists,
      loseAssists
    };
  }

  function applyFightOutcome(out, round, timeline){
    const w = out.winner;
    const l = out.loser;

    // 敗者：全滅（確定）
    l.eliminated = true;
    l.eliminatedRound = round;
    l.alive = 0;

    // 勝者：DB抽選分 alive減少 / deathBoxes増加（確定）
    const db = out.winnerDb || 0;
    if(db > 0){
      w.alive = clamp((w.alive||0) - db, 0, 3);
      w.deathBoxes = clamp((w.deathBoxes||0) + db, 0, 3);
    }

    // チームキル/アシスト加算
    w.kp = (w.kp||0) + (out.winKills||0);
    w.ap = (w.ap||0) + (out.winAssists||0);
    l.kp = (l.kp||0) + (out.loseKills||0);
    l.ap = (l.ap||0) + (out.loseAssists||0);

    // 個人配分（確定：アタッカー/IGL/サポ）
    distributeKillsAndAssists(w, out.winKills||0, out.winAssists||0);
    distributeKillsAndAssists(l, out.loseKills||0, out.loseAssists||0);

    // プレイヤー交戦ログ（timeline が来てる＝プレイヤー戦の時だけ）
    if(timeline){
      // 例ログ：数値は表示しないが、+1K/+1A の表現は仕様にあるのでそれだけ出す
      const logs = [];
      const wk = out.winKills||0;
      const wa = out.winAssists||0;
      if(wk > 0) logs.push(`${w.name}がキルを獲得！(+${wk}K)`);
      if(wa > 0) logs.push(`${w.name}がアシスト！(+${wa}A)`);
      timelinePush(timeline, 'battleResult', {
        round,
        text: logs.length ? logs : ['戦闘が決着！']
      });
    }
  }

  function teamFightPower(team, round){
    // メンバーが powerMin/powerMax を持っている場合はそこから抽選
    let sum = 0;
    let n = 0;

    if(Array.isArray(team.members) && team.members.length){
      for(const m of team.members){
        const min = Number(m.powerMin);
        const max = Number(m.powerMax);
        if(isFinite(min) && isFinite(max) && max >= min){
          sum += min + Math.random() * (max - min);
        }else if(typeof team.basePower === 'number'){
          sum += team.basePower;
        }else{
          sum += 70;
        }
        n++;
      }
    }

    if(n === 0){
      sum = (typeof team.basePower === 'number') ? team.basePower * 3 : 210;
      n = 3;
    }

    let avg = sum / n;

    // 2人補正（確定）：総合力+40%補正
    if((team.alive||3) === 2) avg *= 1.40;

    // イベント％効果（確定：乗算）
    const b = team.eventBuffs || { aimP:0, mentalP:0, agilityP:0 };
    const mult =
      (1 + (b.aimP||0)/100) *
      (1 + (b.mentalP||0)/100) *
      (1 + (b.agilityP||0)/100);
    avg *= mult;

    // プレイヤー固有要素（現状は「勝敗に効く boost」だけ確定反映）
    if(team.isPlayer){
      // ウルト：FightBoost +2（内部）
      // ※ここでは「試合中に1回」等は battle層の制御が必要なので、
      //   match層では “強い時がある” 程度の寄せとして小確率で発動させる（UIログは別）
      //   完全に「1回だけ」にしたい場合は、battle層（sim_battle.js）に移すのが正解
      if(round >= 2 && Math.random() < 0.20){
        avg += 2;
      }
    }

    team._avgPower = avg;
    return avg;
  }

  /* =========================
     MOVE
  ========================== */

  function moveAllAliveToRoundAreas(teams, round){
    const targets = ROUND_AREAS[round] || [];
    if(!targets.length) return;

    if(SimMap && typeof SimMap.moveAllAliveTo === 'function'){
      SimMap.moveAllAliveTo(teams, targets);
      return;
    }

    for(const t of teams){
      if(!t || t.eliminated) continue;
      t.areaId = targets[Math.floor(Math.random() * targets.length)];
    }
  }

  /* =========================
     DISTRIBUTE K/A
     ・キル配分重み（ATTACKER/IGL/SUPPORT）
     ・アシストは totalKills を超えない（確定）
  ========================== */

  function distributeKillsAndAssists(team, kills, assists){
    if(!team || !Array.isArray(team.members) || team.members.length === 0) return;

    // roles から重み抽選できるように
    const mem = team.members.map(m => ({
      ref: m,
      role: String(m.role||'').toUpperCase()
    }));

    for(let i=0;i<kills;i++){
      const m = pickMemberByRoleWeight(mem);
      if(m) m.ref.kills = (m.ref.kills||0) + 1;
    }

    // 1キルにつき最大1A → assists は kills 以下の前提で来る
    for(let i=0;i<assists;i++){
      const m = pickMemberByRoleWeight(mem);
      if(m) m.ref.assists = (m.ref.assists||0) + 1;
    }
  }

  function pickMemberByRoleWeight(mem){
    const entries = mem.map(x => {
      const w = KILL_ROLE_WEIGHT[x.role] || 1;
      return { x, w };
    });
    const sum = entries.reduce((a,e)=>a+e.w,0);
    let r = Math.random() * sum;
    for(const e of entries){
      r -= e.w;
      if(r <= 0) return e.x;
    }
    return entries[entries.length-1]?.x || null;
  }

  /* =========================
     HELPERS
  ========================== */

  function getPlayerTeam(teams){
    return (teams || []).find(t => t && t.isPlayer) || null;
  }

  function countAliveTeams(teams){
    let n = 0;
    for(const t of teams){
      if(t && !t.eliminated) n++;
    }
    return n;
  }

  function timelinePush(tl, type, payload){
    tl.push({ type, ...payload });
  }

  function pickRandom(arr){
    if(!arr || arr.length === 0) return null;
    return arr[Math.floor(Math.random() * arr.length)];
  }

  function pickByProb(table){
    // table: [{n,p}, ...] pは合計1想定（多少ズレてもOK）
    const sum = table.reduce((a,e)=>a+(e.p||0),0);
    let r = Math.random() * sum;
    for(const e of table){
      r -= (e.p||0);
      if(r <= 0) return e.n;
    }
    return table[table.length-1]?.n || 0;
  }

  function randInt(min, max){
    min = Math.ceil(min);
    max = Math.floor(max);
    return Math.floor(Math.random() * (max - min + 1)) + min;
  }

  function randIntWeighted(values, weights){
    const sum = weights.reduce((a,w)=>a+(w||0),0);
    let r = Math.random() * sum;
    for(let i=0;i<values.length;i++){
      r -= (weights[i]||0);
      if(r <= 0) return values[i];
    }
    return values[values.length-1];
  }

  function clamp(v,a,b){ return Math.max(a, Math.min(b, v)); }

  function range(a,b){
    const out = [];
    for(let i=a;i<=b;i++) out.push(i);
    return out;
  }

  function shuffleInPlace(a){
    for(let i=a.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      const tmp=a[i]; a[i]=a[j]; a[j]=tmp;
    }
  }

})();
