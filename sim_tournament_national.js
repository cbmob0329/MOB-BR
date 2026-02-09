/* =========================================================
   MOB BR - sim_tournament_national.js (FULL / FIXED)
   ---------------------------------------------------------
   役割：
   ・ナショナル大会（20チーム / 5試合）
   ・ローカル通過組＋強化CPUで構成
   ・ローカルと同一IF・同一進行（Flowから差し替え可能）
   ・試合前コーチスキル使用対応（消耗）
   ・カードコレクション効果反映
   ---------------------------------------------------------
   方針：
   ★ sim_tournament_local.js と「ほぼ同型」
   ★ 将来の保守のため「構造を完全に揃える」
   ---------------------------------------------------------
   次に直す予定：
   ▶ sim_tournament_lastchance.js
========================================================= */

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){
  'use strict';

  const National = {};
  window.MOBBR.sim.tournamentNational = National;

  /* =========================================================
     CONFIG
  ========================================================= */
  const LS_KEY = 'mobbr_tournament_national_state_v1';
  const CPU_IMG_BASE = 'cpu/';

  const COACH_OWNED_KEY = 'mobbr_coachSkillsOwned';
  const COACH_EQUIP_KEY = 'mobbr_coachSkillsEquipped';

  const COACH_SKILLS = [
    { id:'tactics_note',   powerPct:1, treasureRate:0,   flagRate:0 },
    { id:'mental_care',    powerPct:0, treasureRate:0,   flagRate:0 },
    { id:'endgame_power',  powerPct:3, treasureRate:0,   flagRate:0 },
    { id:'clearing',       powerPct:0, treasureRate:0,   flagRate:0 },
    { id:'score_mind',     powerPct:0, treasureRate:0.06,flagRate:0.03 },
    { id:'igl_call',       powerPct:4, treasureRate:0,   flagRate:0 },
    { id:'protagonist',    powerPct:6, treasureRate:0,   flagRate:0 }
  ];
  const COACH_BY_ID = Object.fromEntries(COACH_SKILLS.map(s=>[s.id,s]));

  /* =========================================================
     PUBLIC API
  ========================================================= */

  National.create = function(opt){
    const o = opt || {};
    if (o.keepStorage !== false){
      const saved = readState();
      if (saved && saved.kind === 'national' && saved.matchIndex < saved.matchTotal){
        return saved;
      }
    }

    const matchTotal = 5;
    const teams = normalizeTeams(o.teams || buildNationalTeams20());

    const state = {
      kind: 'national',
      version: 1,
      seed: Math.floor(Math.random()*1e9),
      rngI: 0,

      matchIndex: 0,
      matchTotal,

      teams,
      agg: initAgg(teams),

      step: 'idle',
      pending: null,
      last: null
    };

    writeState(state);
    return state;
  };

  National.playNextMatch = function(state,opt){
    const st = state || readState();
    if (!st || st.kind !== 'national') return null;
    if (st.matchIndex >= st.matchTotal) return st;

    const o = opt || {};
    const matchNo = st.matchIndex + 1;

    // === 試合前コーチ ===
    if (st.step !== 'preCoachDone'){
      const opened = openCoachIfNeeded(st, matchNo);
      writeState(st);
      if (opened) return st;
      st.step = 'preCoachDone';
    }

    // === 試合実行 ===
    const ctx = buildMatchContext(st);
    const matchRows = simulateOneMatch(st, ctx);

    applyAgg(st, matchRows);

    st.matchIndex = matchNo;
    st.last = {
      matchNo,
      matchRows,
      overallRows: buildOverallRows(st),
      championName: matchRows[0]?.name || ''
    };

    st.step = 'idle';
    st.pending = null;
    writeState(st);

    if (o.openUI !== false){
      const ui = window.MOBBR?.ui?.matchResult;
      if (ui?.open){
        ui.open({
          title: o.title || 'RESULT',
          subtitle: o.subtitle || `ナショナル大会 第${matchNo}試合`,
          matchIndex: matchNo,
          matchTotal: st.matchTotal,
          rows: matchRows,
          championName: st.last.championName
        });
      }
    }

    return st;
  };

  National.isFinished = function(state){
    const st = state || readState();
    return !!(st && st.matchIndex >= st.matchTotal);
  };

  National.getFinalOverall = function(state){
    const st = state || readState();
    if (!st) return null;
    return buildOverallRows(st);
  };

  National.reset = function(){
    try{ localStorage.removeItem(LS_KEY); }catch{}
  };

  /* =========================================================
     COACH
  ========================================================= */
  function openCoachIfNeeded(st, matchNo){
    const equipped = readCoachEquipped();
    const owned = readCoachOwned();

    const usable = equipped.filter(id=>id && owned[id]>0);
    if (usable.length === 0){
      st.pending = { used:false };
      st.step = 'preCoachDone';
      return false;
    }

    st.step = 'awaitCoach';
    st.pending = { used:false };

    window.MOBBR?.ui?.showMessage?.(`第${matchNo}試合：コーチスキル使用可`);
    // 選択UIは local と共通（既に作成済み前提）
    return true;
  }

  function buildMatchContext(st){
    const cardBonus = calcCollectionBonusPercent();
    const cid = st.pending?.selectedId;
    const coach = cid ? COACH_BY_ID[cid] : null;

    return {
      cardBonusPct: cardBonus,
      coach
    };
  }

  /* =========================================================
     SIM
  ========================================================= */
  function simulateOneMatch(st, ctx){
    const teams = st.teams.slice();

    const playerBuff = (ctx.cardBonusPct||0) + (ctx.coach?.powerPct||0);

    const order = weightedOrder(teams, st, t=>{
      return t.isPlayer ? 1 + playerBuff*0.08 : 1;
    });

    const placeById = {};
    order.forEach((t,i)=>placeById[t.teamId]=i+1);

    const rows = teams.map(t=>{
      const place = placeById[t.teamId];
      const kp = randInt(st,0,5);
      const ap = randInt(st,0,4);
      const treasure = rand01(st)<0.18 ? 1:0;
      const flag = rand01(st)<0.08 ? 1:0;
      const total = getPlacementPoint(place)+kp+ap+treasure+flag*2;

      return {
        place,
        teamId:t.teamId,
        name:t.name,
        image:t.image,
        placementP:getPlacementPoint(place),
        kp,ap,treasure,flag,total
      };
    });

    rows.sort((a,b)=>a.place-b.place);
    return rows;
  }

  /* =========================================================
     AGGREGATION
  ========================================================= */
  function initAgg(teams){
    const a={};
    teams.forEach(t=>{
      a[t.teamId]={teamId:t.teamId,name:t.name,image:t.image,matches:0,sumPlace:0,total:0,kp:0,ap:0,treasure:0,flag:0};
    });
    return a;
  }

  function applyAgg(st,rows){
    rows.forEach(r=>{
      const a=st.agg[r.teamId];
      a.matches++; a.sumPlace+=r.place;
      a.total+=r.total; a.kp+=r.kp; a.ap+=r.ap;
      a.treasure+=r.treasure; a.flag+=r.flag;
    });
  }

  function buildOverallRows(st){
    const rows=Object.values(st.agg).map(a=>({
      teamId:a.teamId,name:a.name,image:a.image,
      total:a.total,kp:a.kp,ap:a.ap,treasure:a.treasure,flag:a.flag,place:0
    }));

    rows.sort((x,y)=>y.total-x.total||y.kp-x.kp||Math.random()-0.5);
    rows.forEach((r,i)=>r.place=i+1);
    return rows;
  }

  /* =========================================================
     TEAMS
  ========================================================= */
  function buildNationalTeams20(){
    const teams=[];
    const DP=window.MOBBR?.data?.player;
    if (DP?.getTeam){
      const t=DP.getTeam();
      teams.push({isPlayer:true,teamId:t.teamId,name:t.name,image:''});
    }
    const DC=window.DataCPU;
    const cpu=(DC?.getAllTeams?.()||[]).filter(t=>t.rank==='national');
    cpu.slice(0,19).forEach(t=>teams.push(normalizeTeam(t,false)));
    return teams.slice(0,20);
  }

  function normalizeTeams(arr){
    return arr.map(t=>normalizeTeam(t,!!t.isPlayer));
  }

  function normalizeTeam(t,isPlayer){
    return {
      isPlayer,
      teamId:String(t.teamId),
      name:String(t.name),
      image:t.image||CPU_IMG_BASE+t.teamId+'.png'
    };
  }

  /* =========================================================
     UTIL
  ========================================================= */
  function getPlacementPoint(p){
    if(p===1)return 12;if(p===2)return 8;if(p===3)return 6;
    if(p===4)return 5;if(p===5)return 4;if(p===6)return 3;
    if(p===7)return 2;if(p<=10)return 1;return 0;
  }

  function rand01(st){
    let x=(st.seed^(++st.rngI))*1103515245+12345;
    return ((x>>>0)%1000)/1000;
  }
  function randInt(st,a,b){return a+Math.floor(rand01(st)*(b-a+1));}

  function weightedOrder(arr,st,wf){
    const pool=arr.slice(),out=[];
    while(pool.length){
      let sum=0,ws=pool.map(t=>{const w=wf(t)||1;sum+=w;return w;});
      let r=rand01(st)*sum,i=0;
      for(;i<pool.length;i++){r-=ws[i];if(r<=0)break;}
      out.push(pool.splice(i,1)[0]);
    }
    return out;
  }

  function readCoachOwned(){
    try{return JSON.parse(localStorage.getItem(COACH_OWNED_KEY)||'{}');}catch{return{};}
  }
  function readCoachEquipped(){
    try{return JSON.parse(localStorage.getItem(COACH_EQUIP_KEY)||'[]');}catch{return[];}
  }

  function calcCollectionBonusPercent(){
    const DC=window.MOBBR?.data?.cards;
    if(!DC)return 0;
    let s=0;
    const owned=JSON.parse(localStorage.getItem('mobbr_cards')||'{}');
    for(const id in owned){
      const c=DC.getById(id);
      if(c)s+=DC.calcSingleCardPercent(c.rarity,owned[id]);
    }
    return s;
  }

  function readState(){try{return JSON.parse(localStorage.getItem(LS_KEY));}catch{return null;}}
  function writeState(st){try{localStorage.setItem(LS_KEY,JSON.stringify(st));}catch{}}

})();
