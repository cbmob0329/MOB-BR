'use strict';

/*
  MOB BR - sim_tournament_flow.js v3（フル）
  ローカル大会：A（裏ロジック）
  - 「試合最新版.txt」準拠：
    * 20チーム（各3人）
    * R1:20→16 / R2:16→12 / R3:12→8 / R4:8→4 / R5:4→2 / R6:2→1
    * 交戦枠：R1-4は4戦 / R5は2戦 / R6は1戦
    * プレイヤー戦確率：R1(被り100%) / R2 70 / R3 75 / R4-6 100
    * CPUはmin-max抽選（試合開始前に抽選、実戦は3人抽選平均）
    * コーチスキル（5種）効果確定：
        tactics_note: 常時×1.01
        endgame_power: R5/R6のみ×1.03
        score_mind: お宝ゲット時 +1追加（合計+2）
        igl_call: 常時×1.05
        protagonist: 常時×1.10
    * deathbox/復帰/回収/リスポーン無し（概念ごと削除）
    * ログはプレイヤー視点のみ（CPU同士は裏処理）
    * 内部％はログに出さない
    * downs_total：順位タイブレーク用（下の方が良い）
  - UI連携：
    window.MOBBR.ui.tournament.* があればそちらへ通知
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){
  const SKEY = {
    company: 'mobbr_company',
    team: 'mobbr_team',
    playerTeam: 'mobbr_playerTeam',
    coachEquip: 'mobbr_coachSkillsEquipped', // [id|null,id|null,id|null]
    coachOwned: 'mobbr_coachSkillsOwned',    // {id:count}（ここでは参照のみ）
  };

  const COACH = {
    tactics_note:   { mult: 1.01, endOnly: false },
    endgame_power:  { mult: 1.03, endOnly: true  }, // R5/R6
    score_mind:     { mult: 1.00, endOnly: false }, // treasure加算で使う
    igl_call:       { mult: 1.05, endOnly: false },
    protagonist:    { mult: 1.10, endOnly: false },
  };

  const ROUND_RULES = {
    1: { fights: 4, elim: 4, events: 1, pPlayer: 1.00 },
    2: { fights: 4, elim: 4, events: 2, pPlayer: 0.70 },
    3: { fights: 4, elim: 4, events: 2, pPlayer: 0.75 },
    4: { fights: 4, elim: 4, events: 2, pPlayer: 1.00 },
    5: { fights: 2, elim: 2, events: 2, pPlayer: 1.00 },
    6: { fights: 1, elim: 1, events: 0, pPlayer: 1.00 },
  };

  // マップ（ローカルは数値だけで運用、背景画像名はUI側が areaId->png 解決）
  function areasForRound(r){
    if (r === 1 || r === 2) return range(1,16);
    if (r === 3) return range(17,20);
    if (r === 4) return range(21,22);
    if (r === 5) return range(23,24);
    return [25];
  }
  function range(a,b){ const out=[]; for(let i=a;i<=b;i++) out.push(i); return out; }

  function clamp(n, lo, hi){ return Math.max(lo, Math.min(hi, n)); }
  function rint(lo, hi){ return Math.floor(Math.random()*(hi-lo+1))+lo; }
  function pick(arr){ return arr[Math.floor(Math.random()*arr.length)]; }
  function shuffle(arr){
    const a = arr.slice();
    for(let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [a[i],a[j]]=[a[j],a[i]];
    }
    return a;
  }

  // ===== player base power（ui_team.js と同系統で雑に合わせる）=====
  const WEIGHT = { aim:0.25, mental:0.15, agi:0.10, tech:0.10, support:0.10, scan:0.10, armor:0.10, hp:0.10 };
  function clamp01to100(n){ const v=Number(n); return Number.isFinite(v)? Math.max(0, Math.min(100, v)) : 0; }

  function calcCharBasePower(stats){
    const s = {
      hp: clamp01to100(stats?.hp),
      mental: clamp01to100(stats?.mental),
      aim: clamp01to100(stats?.aim),
      agi: clamp01to100(stats?.agi),
      tech: clamp01to100(stats?.tech),
      support: clamp01to100(stats?.support),
      scan: clamp01to100(stats?.scan),
      armor: clamp01to100(Number.isFinite(Number(stats?.armor)) ? stats.armor : 100),
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
    return Math.max(0, Math.min(100, total));
  }

  function getPlayerTeamObj(){
    try{
      const raw = localStorage.getItem(SKEY.playerTeam);
      if (raw){
        const t = JSON.parse(raw);
        if (t && Array.isArray(t.members) && t.members.length) return t;
      }
    }catch(e){}
    // data_player.js があればデフォルト生成
    if (window.MOBBR?.data?.player?.buildDefaultTeam){
      return window.MOBBR.data.player.buildDefaultTeam();
    }
    return {
      teamId:'player',
      name: localStorage.getItem(SKEY.team) || 'PLAYER TEAM',
      members:[
        {id:'A', slot:1, name:'A', role:'IGL', stats:{hp:50,mental:50,aim:50,agi:50,tech:50,support:50,scan:50,armor:100}},
        {id:'B', slot:2, name:'B', role:'ATT', stats:{hp:50,mental:50,aim:50,agi:50,tech:50,support:50,scan:50,armor:100}},
        {id:'C', slot:3, name:'C', role:'SUP', stats:{hp:50,mental:50,aim:50,agi:50,tech:50,support:50,scan:50,armor:100}},
      ],
    };
  }

  function calcPlayerBasePercent(team){
    const mem = Array.isArray(team?.members) ? team.members.slice(0,3) : [];
    if (!mem.length) return 50;
    const vals = mem.map(m => calcCharBasePower(m?.stats||{}));
    const avg = vals.reduce((a,b)=>a+b,0)/vals.length;
    // ui_team.js と同様に +3 の微補正
    return Math.round(avg + 3);
  }

  function calcCardBonusPercent(){
    // data_cards.js があれば ui_team.js 相当で加算
    const DC = window.MOBBR?.data?.cards;
    if (!DC || !DC.getById || !DC.calcSingleCardPercent) return 0;

    let owned = {};
    try{ owned = JSON.parse(localStorage.getItem('mobbr_cards')||'{}')||{}; }catch(e){ owned = {}; }
    let sum = 0;
    for (const id in owned){
      const cnt = Number(owned[id])||0;
      if (cnt<=0) continue;
      const card = DC.getById(id);
      if (!card) continue;
      const effCnt = Math.max(0, Math.min(10, cnt));
      sum += DC.calcSingleCardPercent(card.rarity, effCnt);
    }
    if (!Number.isFinite(sum)) return 0;
    return Math.max(0, sum);
  }

  function readCoachEquipped(){
    try{
      const arr = JSON.parse(localStorage.getItem(SKEY.coachEquip) || '[]');
      if (!Array.isArray(arr)) return [];
      return arr.map(v => (typeof v==='string' && v.trim()) ? v : null).filter(Boolean);
    }catch{
      return [];
    }
  }

  function calcCoachMultiplier(round){
    const eq = readCoachEquipped();
    let mult = 1.0;
    for (const id of eq){
      const c = COACH[id];
      if (!c) continue;
      if (c.endOnly){
        if (round === 5 || round === 6) mult *= c.mult;
      }else{
        mult *= c.mult;
      }
    }
    return mult;
  }

  function hasScoreMind(){
    const eq = readCoachEquipped();
    return eq.includes('score_mind');
  }

  // ===== Events（重み確定 / 効果は内部）=====
  const EVENTS = [
    { key:'war_meeting', name:'作戦会議', w:35, type:'buff', mult:1.01, icon:'bup.png',
      lines:[
        '次の戦闘に向けて作戦会議！連携力がアップした！',
        'ここで作戦会議！連携力アップ！',
        '次の移動について作戦会議！連携がアップ！',
      ]
    },
    { key:'supply_swap', name:'物資交換', w:35, type:'buff', mult:1.01, icon:'bup.png',
      lines:[
        '物資をお互いに交換！連携力がアップした！',
        '物資を交換した！連携力アップ！',
        '物資をチェックし、準備万端！連携がアップ！',
      ]
    },
    { key:'circle', name:'円陣', w:35, type:'buff', mult:1.01, icon:'bup.png',
      lines:[
        '円陣を組んだ！ファイト力アップ！',
        '絶対勝つぞ！円陣で気合い注入！',
        '円陣によりファイト力アップ！',
      ]
    },
    { key:'calm_scan', name:'冷静な索敵', w:35, type:'buff', mult:1.01, icon:'bup.png',
      lines:[
        '落ち着いて索敵！次の戦闘は先手を取れそうだ！',
        'それぞれが索敵！戦闘に備える！',
        '敵発見！さあどう動く！',
      ]
    },
    { key:'rare_weapon', name:'レア武器ゲット', w:10, type:'buff', mult:1.02, icon:'bup.png',
      lines:[
        'レア武器をゲット！戦闘が有利に！',
        'これは..レア武器発見！やったね！',
        'レア武器を拾った！一気に押していこう！',
      ]
    },
    { key:'mistake', name:'判断ミス', w:15, type:'debuff', mult:0.99, icon:'bdeba.png',
      lines:[
        '痛恨の判断ミス！',
        '移動で迷ってしまった..',
      ]
    },
    { key:'fight', name:'喧嘩', w:10, type:'debuff', mult:0.99, icon:'bdeba.png',
      lines:[
        'ムーブが噛み合わない！争ってしまった..',
        'ピンを見ていなかった..一時の言い争いだ',
      ]
    },
    { key:'reload', name:'リロードミス', w:5, type:'debuff', mult:0.98, icon:'bdeba.png',
      lines:[
        'リロードしていなかった！これはまずい',
      ]
    },
    { key:'zone', name:'ゾーンに入る', w:5, type:'buff', mult:1.03, icon:'bup.png',
      lines:[
        '全員がゾーンに入った!!優勝するぞ！',
        '全員が集中モード！終わらせよう！',
      ]
    },
    { key:'champ_move', name:'チャンピオンムーブ', w:3, type:'buff', mult:1.05, icon:'bup.png',
      lines:[
        'チャンピオンムーブが発動！全員覚醒モードだ！',
      ]
    },
    { key:'treasure', name:'お宝ゲット', w:4, type:'treasure', add:1, icon:'bgeta.png',
      lines:[
        'お宝をゲット！順位が有利に！',
      ]
    },
    { key:'flag', name:'フラッグゲット', w:2, type:'flag', add:1, icon:'bgetb.png',
      lines:[
        'フラッグをゲット！順位に大きく影響する！',
      ]
    },
  ];

  function weightedPickEvent(excludeKeys){
    const pool = EVENTS.filter(e => !excludeKeys.has(e.key));
    const sum = pool.reduce((a,e)=>a+e.w,0);
    let r = Math.random()*sum;
    for (const e of pool){
      r -= e.w;
      if (r <= 0) return e;
    }
    return pool[pool.length-1];
  }

  // ===== Fight chatter (10高速) =====
  const BATTLE_CHAT = [
    'やってやんべ！','裏取るぞ！','展開する！','サポートするぞ！','うわあー！',
    'ミスった！','一気に行くぞ！','今のうちに回復だ！','絶対勝つぞ！','撃て―！',
    'なんて動きだ！','撃ちまくれ！','グレ使う！','グレ投げろ！','リロードする！',
    '被弾した！','カバー頼む！','大丈夫か!?','走れーー！','耐えるぞー！'
  ];
  const WIN_LINES = ['よし！次に備えるぞ！','やったー！勝ったぞ！','ナイスー！'];
  const LOSE_LINES = ['やられた..','次だ次！','負けちまった..'];
  const CHAMP_LINES = ['チャンピオンだ―！！','みんなよくやった！！','獲ったぞー！！'];

  // ===== State builder =====
  function buildInitialState(){
    const company = localStorage.getItem(SKEY.company) || 'CB Memory';
    const playerName = localStorage.getItem(SKEY.team) || 'PLAYER TEAM';

    // CPU teams
    const DataCPU = window.MOBBR?.data?.cpuTeams;
    if (!DataCPU || typeof DataCPU.getAllTeams !== 'function'){
      throw new Error('CPUデータNG（DataCPU.getAllTeams が見つかりません）');
    }
    const allCpu = DataCPU.getAllTeams(); // [{teamId,name,members:[{role,min,max}..], power ...}, ...]
    if (!Array.isArray(allCpu) || allCpu.length < 19){
      throw new Error('CPUデータNG（チーム数不足）');
    }

    const pickedCpu = shuffle(allCpu).slice(0, 19);

    const playerTeamObj = getPlayerTeamObj();

    // team model（必須データ）
    const teams = [];

    // player team as teamId 'player' (画像は P?.png を使うので teamId 画像は不要)
    teams.push({
      isPlayer:true,
      teamId:'player',
      name: playerName,
      company,
      eliminated:false,
      areaId: 0,
      downs_total: 0,
      kills_total: 0,
      assists_total: 0,
      treasure: 0,
      flag: 0,
      eventMult: 1.0,
      members: [
        { slot:1, id:'A', name: playerTeamObj.members?.[0]?.name || 'A', role:'IGL', kills:0, assists:0 },
        { slot:2, id:'B', name: playerTeamObj.members?.[1]?.name || 'B', role:'ATT', kills:0, assists:0 },
        { slot:3, id:'C', name: playerTeamObj.members?.[2]?.name || 'C', role:'SUP', kills:0, assists:0 },
      ],
      basePower: calcPlayerBasePercent(playerTeamObj),
      cardBonus: calcCardBonusPercent(), // 加算（%）
      coachEq: readCoachEquipped(),
      preDraw: null, // playerは固定（base+card+coach+eventで評価）
    });

    // cpu teams
    for (const c of pickedCpu){
      const mem = Array.isArray(c.members) ? c.members.slice(0,3) : [];
      teams.push({
        isPlayer:false,
        teamId: String(c.teamId || ''),
        name: String(c.name || c.teamId || 'CPU'),
        company: '',
        eliminated:false,
        areaId: 0,
        downs_total: 0,
        kills_total: 0,
        assists_total: 0,
        treasure: 0,
        flag: 0,
        eventMult: 1.0,
        members: [
          { slot:1, id:'m1', name: mem[0]?.name || 'IGL', role: mem[0]?.role || 'IGL', kills:0, assists:0, min:mem[0]?.min ?? 60, max:mem[0]?.max ?? 80 },
          { slot:2, id:'m2', name: mem[1]?.name || 'ATT', role: mem[1]?.role || 'ATT', kills:0, assists:0, min:mem[1]?.min ?? 60, max:mem[1]?.max ?? 80 },
          { slot:3, id:'m3', name: mem[2]?.name || 'SUP', role: mem[2]?.role || 'SUP', kills:0, assists:0, min:mem[2]?.min ?? 60, max:mem[2]?.max ?? 80 },
        ],
        basePower: Number.isFinite(Number(c.power)) ? Number(c.power) : 70, // 表示用
        cardBonus: 0,
        coachEq: [],
        preDraw: null, // 試合開始時に抽選
      });
    }

    return {
      mode: 'local',
      createdAt: Date.now(),
      round: 0,
      phase: 'idle', // idle|drop|round|move|result|done
      teams,
      logQueue: [],
      ui: {
        bg: 'tent.png',
        bannerLeft: 'ローカル大会',
        bannerRight: '20チーム',
        logMain: '',
        logSub: '',
        showNext: true,
        showAuto: true,
      },
      battles: [],
      lastBattle: null,
      championTeamId: null,
      playerPlacement: null,
    };
  }

  // ===== pre-draw CPU power（min-max抽選）=====
  function predrawCpuPowers(state){
    for (const t of state.teams){
      if (t.isPlayer) continue;
      const draws = t.members.slice(0,3).map(m => {
        const mn = Number(m.min); const mx = Number(m.max);
        const lo = Number.isFinite(mn)?mn:60;
        const hi = Number.isFinite(mx)?mx:80;
        return rint(Math.min(lo,hi), Math.max(lo,hi));
      });
      const avg = draws.reduce((a,b)=>a+b,0)/draws.length;
      t.preDraw = avg; // 実戦の代表
    }
  }

  // ===== calc effective fight power =====
  function calcTeamFightPower(state, team, round){
    if (team.eliminated) return 0;

    // base
    let p = team.isPlayer
      ? (Number(team.basePower)||50) + (Number(team.cardBonus)||0)
      : (Number(team.preDraw)||Number(team.basePower)||70);

    // event mult
    p *= Number(team.eventMult || 1.0);

    // coach mult (player only)
    if (team.isPlayer){
      p *= calcCoachMultiplier(round);
    }

    // clamp-ish
    if (!Number.isFinite(p)) p = 50;
    return clamp(p, 1, 100);
  }

  // ===== decide winner probability =====
  function winProb(aPower, bPower){
    const diff = aPower - bPower;
    const p = clamp(50 + diff*1.8, 22, 78); // A勝率（内部）
    return p / 100;
  }

  // ===== downs distribution (for tie-break only) =====
  function applyDowns(teamWinner, teamLoser){
    // 敗者は全滅扱い（復活なし）
    teamLoser.eliminated = true;

    // downs_total：敗者 +3 固定、勝者 0/1/2 をランダム
    teamLoser.downs_total += 3;
    const w = Math.random();
    const addW = (w < 0.60) ? 0 : (w < 0.90) ? 1 : 2;
    teamWinner.downs_total += addW;
  }

  // ===== kills/assists（裏集計）=====
  function allocateKillsAssists(winner, loser){
    // 勝者 0-3 / 敗者 0-2
    const wKills = rint(0,3);
    const lKills = rint(0,2);

    addTeamKills(winner, wKills);
    addTeamKills(loser, lKills);

    // アシスト：1キルにつき最大1（Assist ≤ Kill を保証）
    addTeamAssists(winner, wKills);
    addTeamAssists(loser, lKills);
  }

  function roleWeight(role){
    const r = String(role||'').toUpperCase();
    // 原文：ATT50 / IGL30 / SUP20
    if (r.includes('ATT')) return 50;
    if (r.includes('IGL')) return 30;
    return 20;
  }

  function addTeamKills(team, k){
    team.kills_total += k;
    if (!team.members || !team.members.length) return;

    for (let i=0;i<k;i++){
      const pool = team.members.map(m => ({m, w: roleWeight(m.role)}));
      const sum = pool.reduce((a,x)=>a+x.w,0);
      let r = Math.random()*sum;
      let pickM = pool[0].m;
      for (const x of pool){
        r -= x.w;
        if (r<=0){ pickM = x.m; break; }
      }
      pickM.kills = (pickM.kills||0) + 1;
    }
  }

  function addTeamAssists(team, k){
    team.assists_total += k;
    if (!team.members || team.members.length < 2) return;

    for (let i=0;i<k;i++){
      // キルした人以外に寄せたいが、厳密は不要（Assist≤Kill保証だけ）
      // ランダムで1名に付与
      const m = pick(team.members);
      m.assists = (m.assists||0) + 1;
    }

    // 安全：assist_total と個人合計がズレてもいいが、念のため丸める
    const sum = team.members.reduce((a,m)=>a+(m.assists||0),0);
    if (sum !== team.assists_total){
      // ここでは team.assists_total を個人合計に合わせる
      team.assists_total = sum;
    }
  }

  // ===== round: drop assignment =====
  function assignDropAreas(state){
    const pool = areasForRound(1); // 1-16
    const alive = state.teams.filter(t => !t.eliminated);

    // シャッフルして先頭16チーム→Area1-16（空き無し）
    const shuffled = shuffle(alive);

    const first16 = shuffled.slice(0,16);
    for (let i=0;i<first16.length;i++){
      first16[i].areaId = pool[i];
    }

    // 残り4チーム→被りAreaを4つ選ぶ（=2チームエリアが4つ）
    const rest = shuffled.slice(16);
    const overlapAreas = shuffle(pool).slice(0,4);
    for (let i=0;i<rest.length;i++){
      rest[i].areaId = overlapAreas[i];
    }
  }

  // ===== move areas at end of round =====
  function moveTeamsToNextRound(state, nextRound){
    const pool = areasForRound(nextRound);
    const alive = state.teams.filter(t => !t.eliminated);

    for (const t of alive){
      // R6は25固定
      if (nextRound === 6){
        t.areaId = 25;
      }else{
        t.areaId = pick(pool);
      }
    }
  }

  // ===== select battles for round =====
  function buildBattlesForRound(state, round){
    const rule = ROUND_RULES[round];
    const alive = state.teams.filter(t => !t.eliminated);

    // バトル枠を作る（このラウンドは必ず elim 数だけ敗者を作る）
    const fightsNeeded = rule.fights;

    const player = alive.find(t => t.isPlayer);

    const used = new Set(); // teamId used in any battle this round
    const battles = [];

    function addBattle(a, b, reason){
      used.add(a.teamId);
      used.add(b.teamId);
      battles.push({ aId:a.teamId, bId:b.teamId, reason: reason||'', resolved:false, winnerId:null, loserId:null });
    }

    // ---- player battle decision ----
    if (player){
      let doPlayerFight = false;
      if (round === 1){
        // 被りなら100%
        const sameAreaEnemies = alive.filter(t => !t.isPlayer && t.areaId === player.areaId);
        if (sameAreaEnemies.length > 0){
          doPlayerFight = true;
        }
      }else{
        doPlayerFight = (Math.random() < rule.pPlayer);
      }

      if (doPlayerFight && battles.length < fightsNeeded){
        const enemy = pickEnemyForPlayer(state, round, player, alive);
        if (enemy){
          addBattle(player, enemy, 'player');
        }
      }
    }

    // ---- fill remaining CPU battles ----
    const remainingSlots = fightsNeeded - battles.length;
    if (remainingSlots > 0){
      const poolTeams = alive.filter(t => !used.has(t.teamId));
      const shuffled = shuffle(poolTeams);

      // できるだけ同Area/近接で組む（ログに出さない）
      const pairs = [];
      const taken = new Set();

      function isNear(a,b){
        if (a.areaId === b.areaId) return true;
        const ar = areasForRound(round);
        // 同Round内で±1扱い（仕様）
        return Math.abs((a.areaId||0) - (b.areaId||0)) === 1 && ar.includes(a.areaId) && ar.includes(b.areaId);
      }

      for (let i=0;i<shuffled.length;i++){
        const A = shuffled[i];
        if (!A || taken.has(A.teamId)) continue;

        // 近い相手を探す
        let found = null;
        for (let j=i+1;j<shuffled.length;j++){
          const B = shuffled[j];
          if (!B || taken.has(B.teamId)) continue;
          if (isNear(A,B)){ found = B; break; }
        }
        // 見つからなければ次の未使用
        if (!found){
          for (let j=i+1;j<shuffled.length;j++){
            const B = shuffled[j];
            if (!B || taken.has(B.teamId)) continue;
            found = B; break;
          }
        }

        if (found){
          taken.add(A.teamId);
          taken.add(found.teamId);
          pairs.push([A, found]);
          if (pairs.length >= remainingSlots) break;
        }
      }

      for (const [A,B] of pairs){
        if (battles.length >= fightsNeeded) break;
        addBattle(A,B,'cpu');
      }
    }

    // 最終保険：枠不足ならランダムで埋める
    while (battles.length < fightsNeeded){
      const left = alive.filter(t => !used.has(t.teamId));
      if (left.length < 2) break;
      const A = left[0];
      const B = left[1];
      addBattle(A,B,'cpu2');
    }

    return battles.slice(0, fightsNeeded);
  }

  function pickEnemyForPlayer(state, round, player, alive){
    // 9-3 に準拠：同Area→近接→全体
    const same = alive.filter(t => !t.isPlayer && !t.eliminated && t.areaId === player.areaId);
    if (same.length) return pick(same);

    const ar = areasForRound(round);
    const near = alive.filter(t => !t.isPlayer && !t.eliminated && ar.includes(t.areaId) && Math.abs(t.areaId - player.areaId) === 1);
    if (near.length) return pick(near);

    const any = alive.filter(t => !t.isPlayer && !t.eliminated);
    if (any.length) return pick(any);

    return null;
  }

  // ===== events apply (silent for CPU, visible if player hit) =====
  function applyEvents(state, round){
    const cnt = ROUND_RULES[round].events;
    if (cnt <= 0) return [];

    const alive = state.teams.filter(t => !t.eliminated);
    const player = alive.find(t => t.isPlayer);

    const chosenKeys = new Set();
    const hits = [];

    for (let i=0;i<cnt;i++){
      const ev = weightedPickEvent(chosenKeys);
      chosenKeys.add(ev.key);

      const target = pick(alive);
      if (!target) continue;

      // reflect effect
      if (ev.type === 'buff' || ev.type === 'debuff'){
        target.eventMult = Number(target.eventMult || 1.0) * Number(ev.mult || 1.0);
      }else if (ev.type === 'treasure'){
        // +1
        target.treasure = (target.treasure||0) + (ev.add||1);
        // score_mind: 追加+1（合計+2）
        if (target.isPlayer && hasScoreMind()){
          target.treasure += 1;
        }
      }else if (ev.type === 'flag'){
        target.flag = (target.flag||0) + (ev.add||1);
      }

      const isPlayerHit = !!(player && target.teamId === player.teamId);
      hits.push({ event: ev, targetTeamId: target.teamId, show: isPlayerHit });
    }
    return hits;
  }

  // ===== resolve one battle =====
  function resolveBattle(state, round, battle){
    const a = state.teams.find(t => t.teamId === battle.aId);
    const b = state.teams.find(t => t.teamId === battle.bId);
    if (!a || !b) return null;

    const aP = calcTeamFightPower(state, a, round);
    const bP = calcTeamFightPower(state, b, round);
    const pA = winProb(aP, bP);

    const aWin = Math.random() < pA;

    const winner = aWin ? a : b;
    const loser  = aWin ? b : a;

    applyDowns(winner, loser);
    allocateKillsAssists(winner, loser);

    battle.resolved = true;
    battle.winnerId = winner.teamId;
    battle.loserId = loser.teamId;

    return { winner, loser, aPower:aP, bPower:bP };
  }

  // ===== placement / champion =====
  function computePlacement(state){
    // 生存順（最後に死んだ方が上位）をざっくり推定するため、
    // ここでは eliminated のタイミングを記録していない。
    // → ローカル大会は「プレイヤーが負けたらその時点の生存数」で順位を決定する。
    const alive = state.teams.filter(t => !t.eliminated);
    return alive.length + 1; // 自分が今落ちたなら、この時点の生存数+1位
  }

  // ===== public Flow =====
  const Flow = {};

  Flow.startLocalTournament = function(){
    const st = buildInitialState();
    predrawCpuPowers(st);

    // drop
    st.phase = 'drop';
    st.round = 1;
    assignDropAreas(st);

    // UI open
    if (window.MOBBR?.ui?.tournament?.open){
      window.MOBBR.ui.tournament.open(st);
    }else{
      console.warn('[tournamentFlow] ui_tournament not found');
    }
  };

  // UIが「次へ」を押した時に呼ぶ
  Flow.next = function(state){
    if (!state || !state.teams) return;

    // プレイヤーが落ちていたら高速処理→result
    const player = state.teams.find(t => t.isPlayer);
    const playerDead = !!(player && player.eliminated);

    if (state.phase === 'drop'){
      // R1開始メッセージはUI側で出すので、ここはラウンドへ
      state.phase = 'round';
      state._roundStep = 0; // 0: roundStart, 1: events, 2: battleQueue, 3: move, ...
      state._battleIndex = 0;
      state._eventsDone = false;
      state.battles = buildBattlesForRound(state, 1);
      state.lastBattle = null;
      return;
    }

    // 高速処理フェーズ
    if (playerDead && state.phase !== 'result' && state.phase !== 'done'){
      // 残りを高速で最後まで（ログは出さない）
      fastForwardToEnd(state);
      state.phase = 'result';
      if (window.MOBBR?.ui?.tournament?.render) window.MOBBR.ui.tournament.render(state);
      return;
    }

    if (state.phase === 'round'){
      roundAdvance(state);
      return;
    }

    if (state.phase === 'move'){
      // move演出後、次ラウンドへ
      if (state.round >= 6){
        // R6後は結果へ
        state.phase = 'result';
        if (window.MOBBR?.ui?.tournament?.render) window.MOBBR.ui.tournament.render(state);
        return;
      }
      state.round += 1;

      // 次ラウンド開始準備
      state.phase = 'round';
      state._roundStep = 0;
      state._battleIndex = 0;
      state._eventsDone = false;
      state.battles = buildBattlesForRound(state, state.round);
      state.lastBattle = null;
      return;
    }

    if (state.phase === 'result'){
      state.phase = 'done';
      if (window.MOBBR?.ui?.tournament?.close){
        // result画面はUI側に任せる（ここでは閉じない）
      }
      return;
    }
  };

  function roundAdvance(state){
    const r = state.round;
    const rule = ROUND_RULES[r];

    // step 0: Round start
    if (state._roundStep === 0){
      state._roundStep = 1;
      return;
    }

    // step 1: events (apply, show if player hit)
    if (state._roundStep === 1){
      if (!state._eventsDone){
        state._eventsDone = true;
        state._lastEvents = applyEvents(state, r);
      }
      state._roundStep = 2;
      return;
    }

    // step 2: battles (player battle with log; cpu battles silent)
    if (state._roundStep === 2){
      if (!Array.isArray(state.battles)) state.battles = [];
      while (state._battleIndex < state.battles.length){
        const b = state.battles[state._battleIndex];

        // 既に片方が死んでたらスキップ（保険）
        const A = state.teams.find(t => t.teamId === b.aId);
        const B = state.teams.find(t => t.teamId === b.bId);
        if (!A || !B || A.eliminated || B.eliminated){
          state._battleIndex++;
          continue;
        }

        const res = resolveBattle(state, r, b);
        state.lastBattle = {
          battle: b,
          a: A, b: B,
          winner: res?.winner || null,
          loser: res?.loser || null,
          isPlayerBattle: !!(A.isPlayer || B.isPlayer),
        };

        state._battleIndex++;

        // プレイヤー戦なら「1戦ごとに止めて」UIに見せる
        if (state.lastBattle.isPlayerBattle){
          return;
        }
        // CPU戦は裏処理なので続けて消化（この関数内で回す）
      }

      // battles done -> move
      state._roundStep = 3;
      return;
    }

    // step 3: move start
    if (state._roundStep === 3){
      // move in logic now (areaId update)
      if (r < 6){
        moveTeamsToNextRound(state, r+1);
      }else{
        // R6は移動無し
      }
      state.phase = 'move';
      state._roundStep = 0;
      state._battleIndex = 0;
      state._eventsDone = false;
      state._lastEvents = null;
      return;
    }
  }

  function fastForwardToEnd(state){
    // プレイヤー敗北後：残りを一気に決着（ログ無し）
    // roundがどこでも、R6まで消化して1チームにする
    for (let r = state.round; r <= 6; r++){
      // events
      if (ROUND_RULES[r].events > 0){
        applyEvents(state, r);
      }
      // fights
      const battles = buildBattlesForRound(state, r);
      for (const b of battles){
        const A = state.teams.find(t => t.teamId === b.aId);
        const B = state.teams.find(t => t.teamId === b.bId);
        if (!A || !B || A.eliminated || B.eliminated) continue;
        resolveBattle(state, r, b);
      }
      if (r < 6){
        moveTeamsToNextRound(state, r+1);
      }
    }
    // champion
    const alive = state.teams.filter(t => !t.eliminated);
    state.championTeamId = alive[0]?.teamId || null;
  }

  Flow.getStateSnapshot = function(state){
    // UI用：最小限
    const alive = state.teams.filter(t => !t.eliminated);
    const player = state.teams.find(t => t.isPlayer);
    const champ = state.championTeamId ? state.teams.find(t=>t.teamId===state.championTeamId) : null;

    return {
      round: state.round,
      phase: state.phase,
      aliveCount: alive.length,
      teams: state.teams.map(t => ({
        teamId: t.teamId,
        name: t.name,
        isPlayer: !!t.isPlayer,
        eliminated: !!t.eliminated,
        areaId: t.areaId,
        downs_total: t.downs_total,
        kills_total: t.kills_total,
        assists_total: t.assists_total,
        treasure: t.treasure,
        flag: t.flag,
      })),
      lastBattle: state.lastBattle ? {
        isPlayerBattle: !!state.lastBattle.isPlayerBattle,
        aId: state.lastBattle.battle?.aId,
        bId: state.lastBattle.battle?.bId,
        winnerId: state.lastBattle.battle?.winnerId,
        loserId: state.lastBattle.battle?.loserId,
      } : null,
      player: player ? {
        teamId: player.teamId,
        eliminated: !!player.eliminated,
      } : null,
      champion: champ ? { teamId: champ.teamId, name: champ.name } : null,
    };
  };

  window.MOBBR.sim.tournamentFlow = Flow;
})();
