/* =========================================================
   MOB BR - sim.js (FULL)
   - 試合オート進行
   - 20チーム順位算出
   - 脱落後の高速処理
   - result生成
   ---------------------------------------------------------
   厳守：
   ・内部％/勝率はUIに出さない
   ・表示はUI、遷移はAppに委譲
========================================================= */

(function(){
  'use strict';

  const Sim = {};
  window.Sim = Sim;

  /* =========================
     CONSTANTS
  ========================== */
  const BG = {
    main: 'assets/main1.png',
    ido: 'assets/ido.png',
    battle: 'assets/battle.png',
    final: 'assets/neonfinal.png',
  };

  const ROUND_DEF = [
    { r:1, fights:4, survive:16 },
    { r:2, fights:4, survive:12 },
    { r:3, fights:4, survive:8  },
    { r:4, fights:4, survive:4  },
    { r:5, fights:2, survive:2  },
    { r:6, fights:1, survive:1  },
  ];

  /* =========================
     STATE
  ========================== */
  let state = null;

  /* =========================
     PUBLIC API
  ========================== */
  Sim.startMatch = function({ onUpdate, onEnd }){
    initState();
    state.onUpdate = onUpdate;
    state.onEnd = onEnd;

    // 開始演出
    push([
      step('バトルスタート！', BG.main),
      step('降下開始…！', BG.main),
      step(`降下完了。周囲を確認…`, state.areaBg, true),
    ], true);

    nextRound();
  };

  /* =========================
     INIT
  ========================== */
  function initState(){
    const cpuTeams = DataCPU.getAllTeams();
    const player = DataPlayer.getTeam();

    // 20チーム抽選（プレイヤー含む）
    const teams = shuffle([player, ...cpuTeams]).slice(0, 20);

    // 初期配置
    teams.forEach((t, i) => {
      t.alive = 3;
      t.eliminated = false;
      t.kp = 0;
      t.ap = 0;
      t.treasure = 0;
      t.flag = 0;
      t.place = null;
      t.areaId = i % 16 + 1;
    });

    state = {
      roundIndex: 0,
      teams,
      aliveTeams: teams.slice(),
      eliminatedOrder: [],
      onUpdate: null,
      onEnd: null,
      areaBg: getAreaBg(teams[0].areaId),
    };
  }

  /* =========================
     ROUND FLOW
  ========================== */
  function nextRound(){
    const def = ROUND_DEF[state.roundIndex];
    if(!def) return finishMatch();

    push([ step(`Round ${def.r} 開始！`, null) ]);

    // プレイヤー戦優先
    for(let i=0;i<def.fights;i++){
      processFight();
    }

    // 生存数調整
    trimSurvivors(def.survive);

    if(def.r < 6){
      push([
        step('安置が縮む…移動開始！', BG.ido, true),
        step('次のエリアへ到着！', getAreaBg(), true),
      ]);
      state.roundIndex++;
      nextRound();
    }else{
      finishMatch();
    }
  }

  /* =========================
     FIGHT
  ========================== */
  function processFight(){
    const alive = state.aliveTeams.filter(t=>!t.eliminated);
    if(alive.length <= 1) return;

    const a = alive[0];
    const b = alive[1];

    // 勝敗（内部）
    const winA = Math.random() < 0.5;
    const winner = winA ? a : b;
    const loser  = winA ? b : a;

    // ログ（プレイヤー絡みのみ表示）
    if(isPlayerInvolved(a,b)){
      push([
        step(`${winner.name}チームが撃ち合いを制した！`, BG.battle, true),
      ]);
    }

    // KP/AP
    const k = rand(0,3);
    const aK = rand(0,k);
    winner.kp += k;
    winner.ap += aK;

    // 脱落
    loser.eliminated = true;
    loser.place = state.aliveTeams.length;
    state.eliminatedOrder.push(loser);
    state.aliveTeams = state.aliveTeams.filter(t=>!t.eliminated);
  }

  function isPlayerInvolved(a,b){
    return a.isPlayer || b.isPlayer;
  }

  /* =========================
     SURVIVOR TRIM
  ========================== */
  function trimSurvivors(target){
    while(state.aliveTeams.length > target){
      const t = state.aliveTeams.pop();
      if(!t.place){
        t.place = state.aliveTeams.length + 1;
        state.eliminatedOrder.push(t);
      }
    }
  }

  /* =========================
     FINISH
  ========================== */
  function finishMatch(){
    // 残り順位
    state.aliveTeams.forEach((t,i)=>{
      t.place = 1 + i;
    });

    const all = [...state.aliveTeams, ...state.eliminatedOrder];

    // result生成
    const rows = all
      .sort((a,b)=>a.place - b.place)
      .map(t=>({
        rank: t.place,
        teamName: t.name,
        kp: t.kp,
        ap: t.ap,
        treasure: t.treasure,
        flag: t.flag,
        placementP: placementPoint(t.place),
        total: placementPoint(t.place) + t.kp + t.ap + t.treasure + t.flag*2,
      }));

    push([
      step(`チャンピオンは ${rows[0].teamName}！`, BG.final, true),
    ]);

    state.onEnd({
      bg: BG.battle,
      title: 'MATCH RESULT',
      rows,
      noteLines: ['お疲れさま！次の週へ進もう。']
    });
  }

  /* =========================
     UI HELPERS
  ========================== */
  function push(steps, reset=false){
    if(typeof state.onUpdate === 'function'){
      state.onUpdate({ steps, reset });
    }
  }

  function step(message, bg=null, anim=false){
    return { message, bg, bgAnim: anim };
  }

  /* =========================
     UTILS
  ========================== */
  function placementPoint(p){
    if(p===1) return 12;
    if(p===2) return 8;
    if(p===3) return 5;
    if(p===4) return 3;
    if(p===5) return 2;
    if(p<=10) return 1;
    return 0;
  }

  function getAreaBg(){
    return BG.final;
  }

  function shuffle(arr){
    const a = arr.slice();
    for(let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      [a[i],a[j]]=[a[j],a[i]];
    }
    return a;
  }

  function rand(min,max){
    return Math.floor(Math.random()*(max-min+1))+min;
  }

})();
