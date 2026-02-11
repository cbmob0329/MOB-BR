'use strict';

/*
  sim_tournament_flow.js v4（フル）
  ローカル大会（5試合）
  - 20チーム（プレイヤー1 + CPU19）
  - CPU min-max抽選：大会開始時に team.power を確定（チーム戦闘力）
  - R1〜R6：交戦枠固定（R1-4:4 / R5:2 / R6:1）
  - プレイヤー交戦確率：R1(被り100) / R2:70 / R3:75 / R4-6:100（仕様準拠）
  - ログ：プレイヤー視点のみ
  - プレイヤー全滅後：裏で高速処理（ログ追加なし）→ その試合resultへ
  - 移動：必ず ido.png → 次エリア画像ロード完了 → 到着ログ
  - チーム紹介：大会開始前（intro）だけ
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){

  const K = {
    company: 'mobbr_company',
    team: 'mobbr_team',
    playerTeam: 'mobbr_playerTeam'
  };

  // ===== area master（確定表）=====
  // 画像は maps/ 内を想定
  const AREAS = {
    1:{name:'ネオン噴水西',img:'maps/neonhun.png'},
    2:{name:'ネオン噴水東',img:'maps/neonhun.png'},
    3:{name:'ネオン噴水南',img:'maps/neonhun.png'},
    4:{name:'ネオン噴水北',img:'maps/neonhun.png'},
    5:{name:'ネオン中心街',img:'maps/neonmain.png'},
    6:{name:'ネオンジム',img:'maps/neongym.png'},
    7:{name:'ネオンペイント街西',img:'maps/neonstreet.png'},
    8:{name:'ネオンペイント街東',img:'maps/neonstreet.png'},
    9:{name:'ネオンパプリカ広場西',img:'maps/neonpap.png'},
    10:{name:'ネオンパプリカ広場東',img:'maps/neonpap.png'},
    11:{name:'ネオンパルクール広場西',img:'maps/neonpal.png'},
    12:{name:'ネオンパルクール広場東',img:'maps/neonpal.png'},
    13:{name:'ネオン裏路地西',img:'maps/neonura.png'},
    14:{name:'ネオン裏路地東',img:'maps/neonura.png'},
    15:{name:'ネオン裏路地南',img:'maps/neonura.png'},
    16:{name:'ネオン裏路地北',img:'maps/neonura.png'},
    17:{name:'ネオン大橋',img:'maps/neonbrige.png'},
    18:{name:'ネオン工場',img:'maps/neonfact.png'},
    19:{name:'ネオンどんぐり広場西',img:'maps/neondon.png'},
    20:{name:'ネオンどんぐり広場東',img:'maps/neondon.png'},
    21:{name:'ネオンスケボー広場',img:'maps/neonske.png'},
    22:{name:'ネオン秘密基地',img:'maps/neonhimi.png'},
    23:{name:'ネオンライブハウス',img:'maps/neonlivehouse.png'},
    24:{name:'ネオンライブステージ',img:'maps/neonlivestage.png'},
    25:{name:'ネオン街最終エリア',img:'maps/neonfinal.png'}
  };

  function areaRangeForRound(round){
    if (round <= 2) return [1,16];
    if (round === 3) return [17,20];
    if (round === 4) return [21,22];
    if (round === 5) return [23,24];
    return [25,25];
  }

  function areaInfo(id){
    return AREAS[id] || { name:`Area${id}`, img:'maps/neonmain.png' };
  }

  // ===== DataCPU API 吸収 =====
  function getCpuTeams(){
    const d = window.DataCPU;
    if (!d) return [];
    if (typeof d.getAllTeams === 'function') return d.getAllTeams() || [];
    if (typeof d.getALLTeams === 'function') return d.getALLTeams() || [];
    if (Array.isArray(d.TEAMS)) return d.TEAMS;
    return [];
  }

  function shuffle(arr){
    const a = arr.slice();
    for (let i=a.length-1;i>0;i--){
      const j = (Math.random()*(i+1))|0;
      [a[i],a[j]]=[a[j],a[i]];
    }
    return a;
  }

  function clamp01to100(n){
    const v = Number(n);
    if (!Number.isFinite(v)) return 0;
    return Math.max(0, Math.min(100, v));
  }

  // プレイヤーチーム戦闘力：ui_team と合わせたいが、ここは「同じ代表値」を使う前提
  // ※ui_team 側が別計算なら、同じ関数を共通化するのが最終形
  const WEIGHT = { aim:0.25, mental:0.15, agi:0.10, tech:0.10, support:0.10, scan:0.10, armor:0.10, hp:0.10 };

  function calcCharBasePower(stats){
    const s = {
      hp: clamp01to100(stats?.hp),
      mental: clamp01to100(stats?.mental),
      aim: clamp01to100(stats?.aim),
      agi: clamp01to100(stats?.agi),
      tech: clamp01to100(stats?.tech),
      support: clamp01to100(stats?.support),
      scan: clamp01to100(stats?.scan),
      armor: clamp01to100(Number.isFinite(Number(stats?.armor)) ? stats.armor : 100)
    };
    let total = 0;
    total += s.aim * WEIGHT.aim;
    total += s.mental * WEIGHT.mental;
    total += s.agi * WEIGHT.agi;
    total += s.tech * WEIGHT.tech;
    total += s.support * WEIGHT.support;
    total += s.scan * WEIGHT.scan;
    total += s.armor * WEIGHT.armor;
    total += s.hp * WEIGHT.hp;
    return Math.max(1, Math.min(100, total));
  }

  function calcPlayerTeamPower(){
    try{
      const raw = localStorage.getItem(K.playerTeam);
      if (!raw) return 55;
      const t = JSON.parse(raw);
      if (!t || !Array.isArray(t.members) || t.members.length < 1) return 55;
      const members = t.members.slice(0,3);
      const vals = members.map(m => calcCharBasePower(m.stats || {}));
      const avg = vals.reduce((a,b)=>a+b,0) / vals.length;
      return Math.round(avg + 3); // ui_team寄せ
    }catch{
      return 55;
    }
  }

  // CPU min-max 抽選（チーム代表値）
  function rollCpuPower(cpuTeam){
    const base = Number(cpuTeam.teamPower || cpuTeam.power || 55);
    const min = Number(cpuTeam.min || cpuTeam.minPower || cpuTeam.powerMin || 0.92);
    const max = Number(cpuTeam.max || cpuTeam.maxPower || cpuTeam.powerMax || 1.08);
    const isMult = (min > 0 && min < 2.5 && max > 0 && max < 2.5);
    if (isMult){
      const r = min + Math.random() * (max - min);
      return Math.round(base * r);
    }
    const lo = Math.min(min, max);
    const hi = Math.max(min, max);
    const v = lo + Math.random() * (hi - lo);
    return Math.round(v);
  }

  function battleSlots(round){
    if (round <= 4) return 4;
    if (round === 5) return 2;
    return 1;
  }

  function playerBattleProb(round, isOverlapped){
    if (round === 1) return isOverlapped ? 1.0 : 0.0; // R1は被りのみ100%
    if (round === 2) return 0.70;
    if (round === 3) return 0.75;
    return 1.00; // R4-6
  }

  // ===== state =====
  let state = null;

  function pushPlayerLog3(l1, l2, l3){
    if (!state) return;
    if (!state.logs) state.logs = [];
    state.logs.push({ l1:String(l1||''), l2:String(l2||''), l3:String(l3||'') });
    if (state.logs.length > 60) state.logs = state.logs.slice(-60);
  }

  function aliveTeams(){
    return (state?.teams || []).filter(t => !t.eliminated);
  }

  function getPlayer(){
    return (state?.teams || []).find(t => t.isPlayer) || null;
  }

  function computeCtx(){
    const player = getPlayer();
    const coachFlags = window.MOBBR?.sim?.matchFlow?.getPlayerCoachFlags
      ? window.MOBBR.sim.matchFlow.getPlayerCoachFlags()
      : null;
    return { player, playerCoach: coachFlags || {} };
  }

  function ensureEventBuffs(team){
    if (!team.eventBuffs || typeof team.eventBuffs !== 'object'){
      team.eventBuffs = { aim:0, mental:0, agi:0 };
    }
  }

  // ===== 初期降下（4-1）=====
  function initialDrop(){
    const teams = state.teams;

    // シャッフル
    const sh = shuffle(teams);

    // 先頭16をArea1-16へ
    for (let i=0;i<16;i++){
      sh[i].areaId = i+1;
    }

    // 残り4を「被りArea」を4つ選び、1チームずつ追加
    const overlapAreas = shuffle([1,2,3,4,5,6,7,8,9,10,11,12,13,14,15,16]).slice(0,4);
    for (let i=16;i<20;i++){
      sh[i].areaId = overlapAreas[i-16];
    }

    // 反映
    state.teams = sh;
  }

  function isAreaOverlappedForPlayer(){
    const p = getPlayer();
    if (!p) return false;
    const a = p.areaId;
    if (!a) return false;
    const others = state.teams.filter(t => !t.eliminated && t.id !== p.id && t.areaId === a);
    return others.length > 0;
  }

  // ===== マッチ組み（同Area/近接優先 + プレイヤー確率）=====
  function buildMatchesForRound(round){
    const alive = aliveTeams();
    const slots = battleSlots(round);

    const matches = [];
    const used = new Set();

    const player = getPlayer();

    const makePair = (a,b)=>{
      used.add(a.id); used.add(b.id);
      matches.push([a,b]);
    };

    const pickFrom = (pool)=>{
      if (!pool.length) return null;
      return pool[(Math.random()*pool.length)|0];
    };

    // ---- プレイヤー戦（確率） ----
    if (player && !player.eliminated){
      const overlapped = isAreaOverlappedForPlayer();
      const pProb = playerBattleProb(round, overlapped);
      const doPlayer = (Math.random() < pProb);

      if (doPlayer){
        used.add(player.id);

        const same = alive.filter(t => !used.has(t.id) && t.id !== player.id && t.areaId === player.areaId);
        const near = alive.filter(t => !used.has(t.id) && t.id !== player.id && Math.abs((t.areaId|0)-(player.areaId|0))===1);
        const any  = alive.filter(t => !used.has(t.id) && t.id !== player.id);

        const opp = pickFrom(same) || pickFrom(near) || pickFrom(any);
        if (opp){
          makePair(player, opp);
        }else{
          used.delete(player.id);
        }
      }
    }

    // ---- 残り枠（CPU同士） ----
    while (matches.length < slots){
      const pool = alive.filter(t => !used.has(t.id));
      if (pool.length < 2) break;

      // まず1つ
      const a = pickFrom(pool);
      used.add(a.id);

      // 同Area優先 → 近接 → それ以外
      const same = pool.filter(t => !used.has(t.id) && t.id !== a.id && t.areaId === a.areaId);
      const near = pool.filter(t => !used.has(t.id) && t.id !== a.id && Math.abs((t.areaId|0)-(a.areaId|0))===1);
      const any  = pool.filter(t => !used.has(t.id) && t.id !== a.id);

      const b = pickFrom(same) || pickFrom(near) || pickFrom(any);
      if (!b){
        used.delete(a.id);
        break;
      }
      makePair(a,b);
    }

    return matches;
  }

  // ===== event（プレイヤー関与のみログ）=====
  function runEventForMatch(A,B, round, ctx){
    // v2のmatchEventsは rollForTeam なので、A/Bそれぞれに抽選（同ラウンド重複なしは今後）
    // ただしログは「プレイヤーが関与した試合の分だけ出す」
    const me = ctx.player;
    const isPlayerInvolved = (me && (A.id === me.id || B.id === me.id));

    // R1:1回 / R2-5:2回（ラウンド全体回数は本来「ラウンド開始時」だが、
    // 今は「交戦直前の雰囲気」を優先して 交戦ごとに1回だけにしている）
    // ※あなたの最新版に完全一致させるなら「ラウンド開始時に eventCount 回、対象チーム抽選」で別実装にする
    const evTeam = (Math.random() < 0.5) ? A : B;

    const e = window.MOBBR?.sim?.matchEvents?.rollForTeam
      ? window.MOBBR.sim.matchEvents.rollForTeam(evTeam, round, ctx)
      : null;

    if (isPlayerInvolved && e){
      pushPlayerLog3(e.log1, e.log2, e.log3);
    }
  }

  // ===== battle（UIに battleView を渡す）=====
  function makeBattleChatter(){
    const list = [
      'やってやんべ！','裏取るぞ！','展開する！','サポートするぞ！','うわあー！','ミスった！',
      '一気に行くぞ！','今のうちに回復だ！','絶対勝つぞ！','撃て―！','なんて動きだ！','撃ちまくれ！',
      'グレ使う！','グレ投げろ！','リロードする！','被弾した！','カバー頼む！','大丈夫か!?',
      '走れーー！','耐えるぞー！'
    ];
    const sh = shuffle(list).slice(0,10);
    // ウルトは必ず候補に入れる（ログ中に1回は出したいので、UI側で確率差し替えもする）
    if (sh.length) sh[(Math.random()*sh.length)|0] = 'ウルト行くぞ！';
    return sh;
  }

  function battleOutcomeLine(resultType){
    if (resultType === 'win') return pickOne(['よし！次に備えるぞ！','やったー！勝ったぞ！','ナイスー！']);
    if (resultType === 'lose') return pickOne(['やられた..','次だ次！','負けちまった..']);
    return pickOne(['チャンピオンだ―！！','みんなよくやった！！','獲ったぞー！！']);
  }

  function pickOne(list){
    if (!Array.isArray(list) || !list.length) return '';
    return list[(Math.random()*list.length)|0];
  }

  function resolveOneBattle(A,B, round, ctx){
    ensureEventBuffs(A); ensureEventBuffs(B);

    // イベント（ログはプレイヤー関与のみ）
    runEventForMatch(A,B, round, ctx);

    // バトル解決（エンジン）
    const res = window.MOBBR?.sim?.matchFlow?.resolveBattle
      ? window.MOBBR.sim.matchFlow.resolveBattle(A, B, round, ctx)
      : null;

    if (!res) return null;

    const player = ctx.player;
    const isPlayer = player && (A.id===player.id || B.id===player.id);

    if (isPlayer){
      const me  = (A.id===player.id) ? A : B;
      const foe = (A.id===player.id) ? B : A;

      const iWon = (res.winnerId === me.id);
      const isFinal = (round === 6);

      const resultType = (iWon ? (isFinal ? 'champ' : 'win') : 'lose');

      state.battleView = {
        playerTeamName: me.name,
        enemyTeamName: foe.name,
        enemyTeamId: foe.id,
        chatter: makeBattleChatter(),
        result: (resultType === 'champ') ? 'champ' : (iWon ? 'win' : 'lose'),
        afterLine: battleOutcomeLine(resultType)
      };

      // 3段ログは「戦闘中…」固定にしておく（戦闘枠は battleView が主役）
      pushPlayerLog3('交戦中…', '', '');
    }

    return { isPlayer, playerWon: isPlayer ? (res.winnerId === ctx.player.id) : null };
  }

  // ===== ラウンド処理 =====
  function setBgToPlayerArea(){
    const p = getPlayer();
    if (!p || !p.areaId) return;
    const info = areaInfo(p.areaId);
    state.bgImage = info.img;
  }

  function stepRoundBattles(){
    const round = state.round;
    const ctx = computeCtx();

    state.phase = 'battle';
    state.bannerLeft = `ROUND ${round}`;
    state.bannerRight = `交戦：${battleSlots(round)}枠`;
    setBgToPlayerArea();

    // battleViewは「プレイヤー戦の時だけ」立つ。CPU戦だけの時は無し。
    state.battleView = null;

    const matches = buildMatchesForRound(round);

    // 交戦枠ぶん必ず実行（組めない場合は実行数が減る可能性はあるが、基本は20→推移で成立）
    let playerFought = false;
    let playerLost = false;

    for (const [A,B] of matches){
      const r = resolveOneBattle(A,B, round, ctx);
      if (r && r.isPlayer){
        playerFought = true;
        if (!r.playerWon){
          playerLost = true;
          break; // プレイヤー敗北したら以後は高速処理へ
        }
      }
    }

    // プレイヤー全滅チェック
    const p = getPlayer();
    const playerElim = !!(p && p.eliminated);

    // R6はこの後 result へ（移動無し）
    if (round === 6){
      state.phase = 'result_prepare';
      return;
    }

    // プレイヤー敗北/全滅 → 高速処理で試合を畳む（ログ追加無し）
    if (playerElim || playerLost){
      state.phase = 'fast';
      return;
    }

    // 次：移動フェーズへ
    state.phase = 'move_prepare';
  }

  // ===== 移動（必ずido→ロード完了→到着）=====
  function moveAllTeamsToNextRound(nextRound){
    const [lo,hi] = areaRangeForRound(nextRound);
    for (const t of state.teams){
      if (t.eliminated) continue;
      const id = (lo===hi) ? lo : (lo + ((Math.random()*(hi-lo+1))|0));
      t.areaId = id;
    }
  }

  function beginMoveToNextRound(){
    const nextRound = state.round + 1;

    state.phase = 'move';
    state.bgImage = 'ido.png';
    state.bannerLeft = `ROUND ${state.round} 終了`;
    state.bannerRight = '移動中';

    pushPlayerLog3('安置が縮む…移動開始！', '', '');

    // エリア更新（裏）
    moveAllTeamsToNextRound(nextRound);

    // 到着先（プレイヤーのみ表示）を「ロード待ち」にする
    const p = getPlayer();
    const info = areaInfo(p?.areaId || 1);

    state.pendingArrival = {
      round: nextRound,
      areaId: p?.areaId || 1,
      areaName: info.name,
      bgImage: info.img
    };

    // UI側が pendingArrival.bgImage をロードしてから arrive() を呼ぶ
  }

  function arrive(){
    if (!state || !state.pendingArrival) return;

    const pa = state.pendingArrival;
    state.pendingArrival = null;

    state.round = pa.round;
    state.bgImage = pa.bgImage;

    pushPlayerLog3(`${pa.areaName}へ到着！`, '', '');

    state.phase = 'ready';
    state.bannerLeft = `ROUND ${state.round}`;
    state.bannerRight = '次へで進行';
  }

  // ===== 高速処理（プレイヤー脱落後）=====
  function fastForwardToMatchEnd(){
    while (state.round <= 6){
      const round = state.round;
      const ctx = computeCtx();

      // R6は交戦して終わり
      if (round === 6){
        const matches = buildMatchesForRound(round);
        for (const [A,B] of matches){
          // イベントは内部のみ
          if (window.MOBBR?.sim?.matchEvents?.rollForTeam){
            const evTeam = (Math.random() < 0.5) ? A : B;
            window.MOBBR.sim.matchEvents.rollForTeam(evTeam, round, ctx);
          }
          if (window.MOBBR?.sim?.matchFlow?.resolveBattle){
            window.MOBBR.sim.matchFlow.resolveBattle(A,B,round,ctx);
          }
        }
        break;
      }

      // R1-5：交戦
      const matches = buildMatchesForRound(round);
      for (const [A,B] of matches){
        if (window.MOBBR?.sim?.matchEvents?.rollForTeam){
          const evTeam = (Math.random() < 0.5) ? A : B;
          window.MOBBR.sim.matchEvents.rollForTeam(evTeam, round, ctx);
        }
        if (window.MOBBR?.sim?.matchFlow?.resolveBattle){
          window.MOBBR.sim.matchFlow.resolveBattle(A,B,round,ctx);
        }
      }

      // 移動（裏）
      if (round < 6){
        moveAllTeamsToNextRound(round+1);
      }

      state.round++;
    }

    // 最終状態へ
    state.round = 6;
    state.phase = 'result_prepare';
  }

  // ===== 試合 result（ここは最低限。表示はUI側。詳細スコア集計は次の実装で拡張）=====
  function placementP(place){
    if (place === 1) return 12;
    if (place === 2) return 8;
    if (place === 3) return 5;
    if (place === 4) return 3;
    if (place === 5) return 2;
    if (place >= 6 && place <= 10) return 1;
    return 0;
  }

  function buildMatchResultRows(){
    // 現状：alive優先→残存数→ランダムで順位を作る（正式は「脱落順＋KPなど」へ拡張）
    const teams = (state.teams || []).slice();

    // eliminatedは下、alive多いほど上
    teams.sort((a,b)=>{
      const ae = a.eliminated ? 1 : 0;
      const be = b.eliminated ? 1 : 0;
      if (ae !== be) return ae - be;
      const aa = a.alive || 0;
      const bb = b.alive || 0;
      if (bb !== aa) return bb - aa;
      return (Math.random() < 0.5) ? -1 : 1;
    });

    const rows = teams.map((t, i)=>{
      const place = i+1;
      const pp = placementP(place);
      const kp = Number(t.kp||t.kills_total||0) || 0;
      const ap = Number(t.ap||t.assists_total||0) || 0;
      const tr = Number(t.treasure||0) || 0;
      const fl = Number(t.flag||0) || 0;
      const total = pp + kp + ap + tr + (fl*2);
      return {
        placement: place,
        teamId: t.id,
        squad: t.name,
        kp, ap,
        treasure: tr,
        flag: fl,
        total,
        placementP: pp
      };
    });

    return rows;
  }

  function finishOneMatchToResult(){
    // 背景をbattle.png（仕様）
    state.bgImage = 'battle.png';
    state.phase = 'match_result';

    const rows = buildMatchResultRows();
    state.matchResult = { matchIndex: state.matchIndex, rows };

    // 3段ログ
    const champ = rows[0]?.squad || '不明';
    pushPlayerLog3('試合終了', `チャンピオン：${champ}`, '');
  }

  // ===== 試合ループ（5試合）=====
  function resetTeamsForNewMatch(){
    for (const t of state.teams){
      t.eliminated = false;
      t.alive = 3;
      t.treasure = 0;
      t.flag = 0;
      t.eventBuffs = { aim:0, mental:0, agi:0 };
      // KP/AP等は後実装（ここではゼロ初期化だけ）
      t.kills_total = 0;
      t.assists_total = 0;
      if (Array.isArray(t.members)){
        t.members.forEach(m=>{
          m.kills = 0; m.assists = 0;
        });
      }
    }
  }

  function startMatch(){
    state.round = 1;
    state.matchResult = null;
    state.battleView = null;
    state.pendingArrival = null;

    resetTeamsForNewMatch();

    // 降下
    initialDrop();

    // tent表示 → プレイヤー降下エリアへ（到着はロード待ち扱いにする）
    state.phase = 'match_start';
    state.bgImage = 'tent.png';
    state.bannerLeft = `試合${state.matchIndex}/5`;
    state.bannerRight = '降下';

    pushPlayerLog3('バトルスタート！', '降下開始…！', '');

    // 次へ：降下完了（ロード待ち）
  }

  function beginDropArrival(){
    const p = getPlayer();
    const info = areaInfo(p?.areaId || 1);

    state.phase = 'drop';
    state.bgImage = 'tent.png';

    // 被り判定
    const overlapped = isAreaOverlappedForPlayer();

    // 到着先ロード待ち
    state.pendingArrival = {
      round: 1,
      areaId: p?.areaId || 1,
      areaName: info.name,
      bgImage: info.img
    };

    // 到着後のログは arrive() 側で出す
    // 追加ログだけここで積む（仕様文言）
    const line2 = overlapped ? '被った…敵影がいる！' : '周囲を確認…';
    pushPlayerLog3(`${info.name}に降下完了。`, line2, 'IGLがコール！戦闘準備！');
  }

  // ===== 開始（ローカル大会）=====
  function startLocalTournament(){
    const cpuRaw = getCpuTeams();
    const cpu19 = shuffle(cpuRaw).slice(0, 19);

    const playerName = localStorage.getItem(K.team) || 'PLAYER TEAM';
    const playerPower = calcPlayerTeamPower();

    const teams = [];

    teams.push({
      id: 'PLAYER',
      name: playerName,
      isPlayer: true,
      alive: 3,
      eliminated: false,
      treasure: 0,
      flag: 0,
      power: playerPower,
      areaId: 1,
      eventBuffs: { aim:0, mental:0, agi:0 },
      kills_total: 0,
      assists_total: 0,
      members: []
    });

    cpu19.forEach((c, i)=>{
      const id = c.teamId || c.id || `local${String(i+1).padStart(2,'0')}`;
      const nm = c.teamName || c.name || id;
      const power = rollCpuPower(c);

      teams.push({
        id,
        name: nm,
        isPlayer: false,
        alive: 3,
        eliminated: false,
        treasure: 0,
        flag: 0,
        power,
        areaId: 1,
        eventBuffs: { aim:0, mental:0, agi:0 },
        kills_total: 0,
        assists_total: 0,
        members: []
      });
    });

    state = {
      mode: 'local',
      matchIndex: 1,
      totalMatches: 5,

      phase: 'intro',               // ✅紹介フェーズ
      round: 0,

      teams,
      logs: [],

      bgImage: 'tent.png',
      pendingArrival: null,
      battleView: null,

      matchResult: null,
      tournamentResult: null,

      bannerLeft: 'ローカル大会',
      bannerRight: '本日の出場チームをご紹介！'
    };

    pushPlayerLog3('ローカル大会', '本日の出場チームをご紹介！', '次へで試合開始');

    if (window.MOBBR?.ui?.tournament?.open) window.MOBBR.ui.tournament.open();
    if (window.MOBBR?.ui?.tournament?.render) window.MOBBR.ui.tournament.render();
  }

  // ===== 進行（UIの「次へ」）=====
  function step(){
    if (!state) return;

    // 到着待ちがあるなら、UIが画像ロード後に arrive() を呼ぶ
    // ここでは進めない
    if (state.pendingArrival){
      return;
    }

    // intro → 試合開始
    if (state.phase === 'intro'){
      // チーム紹介はここで終了（試合が始まったら消える：UI側がphaseで隠す）
      startMatch();
      return;
    }

    // 試合開始（tent）→ 降下完了（ロード待ち）
    if (state.phase === 'match_start'){
      beginDropArrival(); // pendingArrival を立てる
      return;
    }

    // ready → battle
    if (state.phase === 'ready'){
      stepRoundBattles();
      return;
    }

    // battleが終わった → move or fast or result_prepare
    if (state.phase === 'battle'){
      if (state.battleView){
        // プレイヤー戦だった：UIが戦闘アニメを流す（NextはUI側でロック）
        // アニメ終了後、UIが「次へ」を押すとここに再入 → このbattleViewは既に消して進行
        state.battleView = null;
        state.phase = 'battle_done';
        return;
      }
      state.phase = 'battle_done';
      return;
    }

    if (state.phase === 'battle_done'){
      // 次へ：移動 or 高速 or 結果準備
      if (state.round === 6){
        state.phase = 'result_prepare';
        return;
      }
      state.phase = 'move_prepare';
      return;
    }

    if (state.phase === 'move_prepare'){
      beginMoveToNextRound(); // pendingArrival を立てる
      return;
    }

    if (state.phase === 'fast'){
      fastForwardToMatchEnd();
      finishOneMatchToResult();
      return;
    }

    if (state.phase === 'result_prepare'){
      finishOneMatchToResult();
      return;
    }

    // 試合result表示中 → 次試合 or 大会終了（今は5試合ループのみ）
    if (state.phase === 'match_result'){
      if (state.matchIndex < state.totalMatches){
        state.matchIndex += 1;
        // 次試合：introはもう無し。直でmatch_startへ
        startMatch();
        return;
      }
      // 5試合終わり：大会resultは次の実装で集計（今は簡易）
      state.phase = 'tournament_end';
      state.tournamentResult = { rows: [] };
      pushPlayerLog3('大会終了', 'メイン画面へ戻ります', '');
      return;
    }

    // tournament_endは止める
    if (state.phase === 'tournament_end'){
      return;
    }
  }

  function getState(){ return state; }

  window.MOBBR.sim.tournamentFlow = {
    startLocalTournament,
    step,
    arrive,
    getState
  };

})();
