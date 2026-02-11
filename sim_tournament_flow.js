'use strict';

/*
  sim_tournament_flow.js v3.1（フル）
  ✅「試合最新版.txt」準拠（運用版）
  - ローカル大会：CPUは local01〜local20 のみ
  - 5試合（match 1〜5）を実行し、試合ごとに result を出す
  - マップ画像（maps/）を使用：R1-R2=1-16 / R3=17-20 / R4=21-22 / R5=23-24 / R6=25
  - 降下：16エリアに1チームずつ＋被り4（=2チームエリアが4箇所）
  - 交戦枠：R1-4=4 / R5=2 / R6=1
  - プレイヤー戦確率：R1(被りなら100) / R2=70 / R3=75 / R4-6=100
  - プレイヤー全滅後：裏で高速処理→その試合のresultへ（以後ログ無し）
  - イベント：R1=1回 / R2-5=2回 / R6=基本なし（プレイヤー視点のみ表示）
  - eventBuffs(aim/mental/agi %加算) は matchEvents.rollForTeam を使用（UI側が回数制御）
  - battle解決：matchFlow.resolveBattle を使用
  - ダウン概念なし（downs_total 一切なし）
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){

  const K = {
    teamName: 'mobbr_team',
    playerTeam: 'mobbr_playerTeam',
    equippedSkin: 'mobbr_equippedSkin',                // P1〜P5（無ければP1）
    equippedCoachSkills: 'mobbr_equippedCoachSkills'   // 装備中最大3
  };

  // ===== Map Master（固定）=====
  const AREA = {
    1:{ name:'ネオン噴水西',  img:'maps/neonhun.png' },
    2:{ name:'ネオン噴水東',  img:'maps/neonhun.png' },
    3:{ name:'ネオン噴水南',  img:'maps/neonhun.png' },
    4:{ name:'ネオン噴水北',  img:'maps/neonhun.png' },
    5:{ name:'ネオン中心街',  img:'maps/neonmain.png' },
    6:{ name:'ネオンジム',    img:'maps/neongym.png' },
    7:{ name:'ネオンペイント街西', img:'maps/neonstreet.png' },
    8:{ name:'ネオンペイント街東', img:'maps/neonstreet.png' },
    9:{ name:'ネオンパプリカ広場西', img:'maps/neonpap.png' },
    10:{ name:'ネオンパプリカ広場東', img:'maps/neonpap.png' },
    11:{ name:'ネオンパルクール広場西', img:'maps/neonpal.png' },
    12:{ name:'ネオンパルクール広場東', img:'maps/neonpal.png' },
    13:{ name:'ネオン裏路地西', img:'maps/neonura.png' },
    14:{ name:'ネオン裏路地東', img:'maps/neonura.png' },
    15:{ name:'ネオン裏路地南', img:'maps/neonura.png' },
    16:{ name:'ネオン裏路地北', img:'maps/neonura.png' },

    17:{ name:'ネオン大橋', img:'maps/neonbrige.png' },
    18:{ name:'ネオン工場', img:'maps/neonfact.png' },
    19:{ name:'ネオンどんぐり広場西', img:'maps/neondon.png' },
    20:{ name:'ネオンどんぐり広場東', img:'maps/neondon.png' },

    21:{ name:'ネオンスケボー広場', img:'maps/neonske.png' },
    22:{ name:'ネオン秘密基地', img:'maps/neonhimi.png' },

    23:{ name:'ネオンライブハウス', img:'maps/neonlivehouse.png' },
    24:{ name:'ネオンライブステージ', img:'maps/neonlivestage.png' },

    25:{ name:'ネオン街最終エリア', img:'maps/neonfinal.png' }
  };

  function range(a,b){
    const out = [];
    for(let i=a;i<=b;i++) out.push(i);
    return out;
  }

  function areasForRound(r){
    if (r <= 2) return range(1,16);
    if (r === 3) return range(17,20);
    if (r === 4) return range(21,22);
    if (r === 5) return range(23,24);
    return [25];
  }

  function clamp(n, lo, hi){
    const v = Number(n);
    if (!Number.isFinite(v)) return lo;
    return Math.max(lo, Math.min(hi, v));
  }

  function shuffle(arr){
    const a = arr.slice();
    for (let i=a.length-1;i>0;i--){
      const j = (Math.random()*(i+1))|0;
      [a[i],a[j]]=[a[j],a[i]];
    }
    return a;
  }

  // ===== DataCPU：ローカルのみ =====
  function getCpuTeamsLocalOnly(){
    const d = window.DataCPU;
    if (!d) return [];

    let all = [];
    if (typeof d.getAllTeams === 'function') all = d.getAllTeams() || [];
    else if (typeof d.getALLTeams === 'function') all = d.getALLTeams() || [];
    else if (Array.isArray(d.TEAMS)) all = d.TEAMS;

    if (!Array.isArray(all)) all = [];

    return all.filter(t=>{
      const id = String(t.teamId || t.id || '');
      return id.startsWith('local');
    });
  }

  // ===== プレイヤー戦闘力：ui_team と完全一致（可能なら委譲）=====
  function calcPlayerTeamPower(){
    // 1) ui_team が計算関数を公開してるなら最優先
    try{
      const fn = window.MOBBR?.ui?.team?.calcTeamPower;
      if (typeof fn === 'function'){
        const v = fn();
        if (Number.isFinite(v)) return clamp(v, 1, 100);
      }
    }catch(e){}

    // 2) 保存データに teamPower があるなら採用
    try{
      const raw = localStorage.getItem(K.playerTeam);
      if (raw){
        const t = JSON.parse(raw);
        const v = Number(t?.teamPower);
        if (Number.isFinite(v)) return clamp(v, 1, 100);
      }
    }catch(e){}

    return 55;
  }

  function getEquippedSkin(){
    const v = (localStorage.getItem(K.equippedSkin) || 'P1').trim();
    const m = v.match(/^P([1-5])$/);
    const n = m ? `P${m[1]}` : 'P1';
    return `${n}.png`;
  }

  // ===== CPU 実戦戦闘力抽選（最新仕様）=====
  // ・overall/basePower は “表示用代表値” で、安定度（ブレ縮小）にのみ影響
  // ・実戦は3人 min-max 抽選平均
  function rollCpuTeamPowerFromMembers(cpuTeam){
    const mem = Array.isArray(cpuTeam?.members) ? cpuTeam.members : [];
    const overall = Number(cpuTeam?.overall ?? cpuTeam?.basePower ?? cpuTeam?.teamPower ?? 70);
    const bp = Number.isFinite(overall) ? clamp(overall, 1, 100) : 70;

    if (mem.length === 0){
      return clamp(bp, 1, 100);
    }

    // bpが高いほどブレ縮小：50→縮小なし、100→かなり縮小
    const stable = clamp((bp - 50) / 50, 0, 1); // 0..1
    const compress = 1 - (stable * 0.55);       // 1.00 → 0.45

    const vals = mem.slice(0,3).map(m=>{
      const lo0 = Number(m?.min ?? m?.powerMin);
      const hi0 = Number(m?.max ?? m?.powerMax);
      const lo = Number.isFinite(lo0) ? clamp(lo0, 1, 100) : 50;
      const hi = Number.isFinite(hi0) ? clamp(hi0, 1, 100) : 80;

      const mid = (lo + hi) / 2;
      const half = Math.max(0, (hi - lo) / 2);

      const half2 = half * compress;
      const lo2 = mid - half2;
      const hi2 = mid + half2;

      const r = lo2 + Math.random() * (hi2 - lo2);
      return r;
    });

    const avg = vals.reduce((a,b)=>a+b,0) / vals.length;
    return Math.round(clamp(avg, 1, 100));
  }

  // ===== コーチスキル（効果確定5種）=====
  const COACH_MASTER = {
    tactics_note:   { mult:1.01, endgame:false, quote:'戦術を大事にして戦おう！' },
    endgame_power:  { mult:1.03, endgame:true,  quote:'終盤一気に攻めるぞ！' },
    score_mind:     { mult:1.00, endgame:false, quote:'お宝狙いだ！全力で探せ！' },
    igl_call:       { mult:1.05, endgame:false, quote:'IGLを信じるんだ！' },
    protagonist:    { mult:1.10, endgame:false, quote:'この試合の主人公はお前たちだ！' }
  };

  function getEquippedCoachSkills(){
    try{
      const raw = localStorage.getItem(K.equippedCoachSkills);
      if (!raw) return [];
      const a = JSON.parse(raw);
      if (!Array.isArray(a)) return [];
      return a.map(x=>String(x||'')).filter(Boolean).slice(0,3);
    }catch{
      return [];
    }
  }

  // ===== round settings =====
  function battleSlots(round){
    if (round <= 4) return 4;
    if (round === 5) return 2;
    return 1;
  }
  function eventCount(round){
    if (round === 1) return 1;
    if (round >= 2 && round <= 5) return 2;
    return 0; // R6 基本なし
  }
  function playerBattleProb(round, playerContestedAtDrop){
    if (round === 1) return playerContestedAtDrop ? 1.0 : 0.0;
    if (round === 2) return 0.70;
    if (round === 3) return 0.75;
    return 1.0; // R4-6
  }

  function isAdjacentArea(a,b, round){
    const list = areasForRound(round);
    if (!list.includes(a) || !list.includes(b)) return false;
    return Math.abs(a-b) === 1;
  }

  // ===== State =====
  let state = null;

  function getPlayer(){
    return (state?.teams || []).find(t => t.isPlayer) || null;
  }
  function aliveTeams(){
    return (state?.teams || []).filter(t => !t.eliminated);
  }

  function ensureTeamRuntimeShape(t){
    if (!t) return;
    if (!Number.isFinite(Number(t.alive))) t.alive = 3;
    if (!Number.isFinite(Number(t.power))) t.power = 55;
    if (t.eliminated !== true) t.eliminated = false;
    if (!Number.isFinite(Number(t.areaId))) t.areaId = 1;
    if (!Number.isFinite(Number(t.treasure))) t.treasure = 0;
    if (!Number.isFinite(Number(t.flag))) t.flag = 0;
    if (!t.eventBuffs || typeof t.eventBuffs !== 'object'){
      t.eventBuffs = { aim:0, mental:0, agi:0 };
    }
  }

  function computeCtx(){
    const player = getPlayer();
    const coachFlags = window.MOBBR?.sim?.matchFlow?.getPlayerCoachFlags
      ? window.MOBBR.sim.matchFlow.getPlayerCoachFlags()
      : {};
    return { player, playerCoach: coachFlags };
  }

  // ===== drop =====
  function resetForNewMatch(){
    for(const t of state.teams){
      t.eliminated = false;
      t.alive = 3;
      t.eventBuffs = { aim:0, mental:0, agi:0 };
      t.treasure = 0;
      t.flag = 0;
      // kills/assists は将来用：ここでは維持してOK（試合集計するなら match開始で0にしてもよい）
      t.kills_total = 0;
      t.assists_total = 0;
    }
    state.playerContestedAtDrop = false;
  }

  function initDropPositions(){
    const teams = state.teams.slice();
    const ids = shuffle(teams.map(t=>t.id));

    const areas = range(1,16);
    const assigned = new Map();
    for(const a of areas) assigned.set(a, []);

    // 先頭16：Area1..16へ1チームずつ
    for(let i=0;i<16;i++){
      const teamId = ids[i];
      const areaId = i+1;
      assigned.get(areaId).push(teamId);
    }

    // 残り4：被り4箇所
    const rest = ids.slice(16,20);
    const dupAreas = shuffle(areas).slice(0,4);
    for(let i=0;i<4;i++){
      assigned.get(dupAreas[i]).push(rest[i]);
    }

    // 反映
    for(const t of state.teams){
      let areaId = 1;
      for(const [a, list] of assigned.entries()){
        if (list.includes(t.id)){ areaId = a; break; }
      }
      t.areaId = areaId;
    }

    // プレイヤー被り判定
    const p = getPlayer();
    state.playerContestedAtDrop = !!(p && (assigned.get(p.areaId)?.length >= 2));
  }

  function moveAllTeamsToNextRound(roundJustFinished){
    const nextRound = roundJustFinished + 1;
    const pool = areasForRound(nextRound);

    for(const t of state.teams){
      if (t.eliminated) continue;

      const cur = t.areaId;
      let candidates = pool.slice();
      candidates.sort((a,b)=>Math.abs(a-cur)-Math.abs(b-cur));
      const top = candidates.slice(0, Math.min(3, candidates.length));
      const pick = top[(Math.random()*top.length)|0];
      t.areaId = pick;
    }
  }

  // ===== matches =====
  function buildMatchesForRound(round){
    const alive = aliveTeams();
    const slots = battleSlots(round);
    const used = new Set();
    const matches = [];

    const player = getPlayer();

    // 1) プレイヤー戦（確率）
    if (player && !player.eliminated){
      const prob = playerBattleProb(round, !!state.playerContestedAtDrop);
      if (Math.random() < prob){
        used.add(player.id);

        const same = alive.filter(t=>!t.eliminated && t.id!==player.id && t.areaId===player.areaId && !used.has(t.id));
        const near = alive.filter(t=>!t.eliminated && t.id!==player.id && isAdjacentArea(t.areaId, player.areaId, round) && !used.has(t.id));
        let pool = same.length ? same : (near.length ? near : alive.filter(t=>!t.eliminated && t.id!==player.id && !used.has(t.id)));

        const opp = pool.length ? pool[(Math.random()*pool.length)|0] : null;
        if (opp){
          used.add(opp.id);
          matches.push([player, opp]);
        }else{
          used.delete(player.id);
        }
      }
    }

    // 2) CPU同士：同Area/近接優先
    while(matches.length < slots){
      const pool = alive.filter(t=>!t.eliminated && !used.has(t.id));
      if (pool.length < 2) break;

      const a = pool[(Math.random()*pool.length)|0];
      used.add(a.id);

      const same = pool.filter(t=>t.id!==a.id && !used.has(t.id) && t.areaId===a.areaId);
      const near = pool.filter(t=>t.id!==a.id && !used.has(t.id) && isAdjacentArea(t.areaId, a.areaId, round));
      let pickPool = same.length ? same : (near.length ? near : pool.filter(t=>t.id!==a.id && !used.has(t.id)));

      const b = pickPool.length ? pickPool[(Math.random()*pickPool.length)|0] : null;
      if (!b){
        used.delete(a.id);
        break;
      }
      used.add(b.id);
      matches.push([a,b]);
    }

    return matches.slice(0, slots);
  }

  // ===== coach mult =====
  function coachMultForRound(round){
    const sk = state.selectedCoachSkill;
    if (!sk) return 1.0;
    const m = COACH_MASTER[sk];
    if (!m) return 1.0;
    if (m.endgame) return (round >= 5) ? m.mult : 1.0;
    return m.mult;
  }

  // ===== result (match) =====
  const PLACEMENT_P = (placement)=>{
    if (placement === 1) return 12;
    if (placement === 2) return 8;
    if (placement === 3) return 5;
    if (placement === 4) return 3;
    if (placement === 5) return 2;
    if (placement >= 6 && placement <= 10) return 1;
    return 0;
  };

  function computePlacements(){
    const teams = state.teams.slice();
    teams.sort((a,b)=>{
      const ae = a.eliminated ? 1 : 0;
      const be = b.eliminated ? 1 : 0;
      if (ae !== be) return ae - be;

      const ak = Number(a.kills_total||0);
      const bk = Number(b.kills_total||0);
      if (bk !== ak) return bk - ak;

      // 総合力低い方が上寄り（downs無しの代替）
      const ap = Number(a.power||0);
      const bp = Number(b.power||0);
      if (ap !== bp) return ap - bp;

      return String(a.name||'').localeCompare(String(b.name||''), 'ja');
    });
    // 同値帯だけ軽くシャッフル
    for(let i=0;i<teams.length;i++){
      for(let j=i+1;j<teams.length;j++){
        const a = teams[i], b = teams[j];
        if (!!a.eliminated === !!b.eliminated &&
            (a.kills_total||0)===(b.kills_total||0) &&
            Number(a.power||0)===Number(b.power||0)){
          if (Math.random() < 0.5){ teams[i]=b; teams[j]=a; }
        }
      }
    }
    return teams.map((t, idx)=>({ id:t.id, name:t.name, placement: idx+1 }));
  }

  function computeMatchResultTable(){
    const placements = computePlacements();
    const byId = new Map(state.teams.map(t=>[t.id,t]));

    return placements.map(p=>{
      const t = byId.get(p.id) || {};
      const KP = Number(t.kills_total||0);
      const AP = Number(t.assists_total||0);
      const Treasure = Number(t.treasure||0);
      const Flag = Number(t.flag||0);
      const PlacementP = PLACEMENT_P(p.placement);
      const Total = PlacementP + KP + AP + Treasure + (Flag*2);

      return { placement:p.placement, id:p.id, squad:p.name, KP, AP, Treasure, Flag, Total, PlacementP };
    });
  }

  function addToTournamentTotal(matchRows){
    const total = state.tournamentTotal;
    for(const r of matchRows){
      if (!total[r.id]){
        total[r.id] = { id:r.id, squad:r.squad, sumPlacementP:0, KP:0, AP:0, Treasure:0, Flag:0, sumTotal:0 };
      }
      total[r.id].sumPlacementP += r.PlacementP;
      total[r.id].KP += r.KP;
      total[r.id].AP += r.AP;
      total[r.id].Treasure += r.Treasure;
      total[r.id].Flag += r.Flag;
      total[r.id].sumTotal += r.Total;
    }
  }

  // ===== UI helper =====
  function setRequest(type, payload){
    state.request = { type, ...(payload||{}) };
  }

  function setCenter3(a,b,c){
    state.ui.center3 = [String(a||''), String(b||''), String(c||'')];
  }

  function getAreaInfo(areaId){
    const a = AREA[areaId];
    return a ? { id:areaId, name:a.name, img:a.img } : { id:areaId, name:`Area${areaId}`, img:'' };
  }

  // ===== public methods for UI to call =====
  function getState(){ return state; }

  function getCoachMaster(){ return COACH_MASTER; }
  function getEquippedCoachList(){ return getEquippedCoachSkills(); }
  function setCoachSkill(skillId){
    const id = String(skillId||'');
    if (!id || !COACH_MASTER[id]){
      state.selectedCoachSkill = null;
      state.selectedCoachQuote = '';
      return;
    }
    state.selectedCoachSkill = id;
    state.selectedCoachQuote = COACH_MASTER[id].quote || '';
  }
  function getPlayerSkin(){ return getEquippedSkin(); }

  function applyEventForTeam(team){
    const ctx = computeCtx();
    if (!window.MOBBR?.sim?.matchEvents?.rollForTeam) return null;
    return window.MOBBR.sim.matchEvents.rollForTeam(team, state.round, ctx);
  }

  function initMatchDrop(){
    resetForNewMatch();
    initDropPositions();

    const p = getPlayer();
    if (p){
      const info = getAreaInfo(p.areaId);
      state.ui.bg = info.img || state.ui.bg;
    }
  }

  // ===== core sim: one round =====
  function simulateRound(round){
    const ctx = computeCtx();
    const matches = buildMatchesForRound(round);

    const out = {
      round,
      matches: matches.map(([A,B])=>({ aId:A.id, bId:B.id }))
    };

    for(const [A,B] of matches){
      ensureTeamRuntimeShape(A);
      ensureTeamRuntimeShape(B);

      // コーチ倍率はプレイヤーのみ、勝敗に反映（内部だけ）
      const mult = coachMultForRound(round);
      let aBackup = null, bBackup = null;

      if (A.isPlayer){
        aBackup = A.power;
        A.power = clamp(A.power * mult, 1, 100);
      }
      if (B.isPlayer){
        bBackup = B.power;
        B.power = clamp(B.power * mult, 1, 100);
      }

      const res = window.MOBBR?.sim?.matchFlow?.resolveBattle
        ? window.MOBBR.sim.matchFlow.resolveBattle(A, B, round, ctx)
        : null;

      if (A.isPlayer && aBackup !== null) A.power = aBackup;
      if (B.isPlayer && bBackup !== null) B.power = bBackup;

      if (res){
        if (!out.results) out.results = [];
        out.results.push(res);
      }

      const pNow = getPlayer();
      if (pNow && pNow.eliminated){
        out.playerEliminated = true;
        break;
      }
    }

    if (round <= 5) moveAllTeamsToNextRound(round);
    else{
      for(const t of state.teams){
        if (!t.eliminated) t.areaId = 25;
      }
    }

    return out;
  }

  function fastForwardToMatchEnd(){
    // プレイヤー全滅後：ログ無しで最後まで
    while(state.round <= 6){
      const r = state.round;

      if (r === 6){
        for(const t of state.teams){
          if (!t.eliminated) t.areaId = 25;
        }
      }

      const matches = buildMatchesForRound(r);
      const ctx = computeCtx();

      for(const [A,B] of matches){
        if (window.MOBBR?.sim?.matchFlow?.resolveBattle){
          window.MOBBR.sim.matchFlow.resolveBattle(A, B, r, ctx);
        }
      }

      if (r <= 5) moveAllTeamsToNextRound(r);
      state.round++;
    }
    state.round = 7;
  }

  function finishMatchAndBuildResult(){
    const rows = computeMatchResultTable();
    addToTournamentTotal(rows);
    state.lastMatchResultRows = rows;
  }

  function startNextMatch(){
    state.matchIndex += 1;
    state.round = 1;
    state.selectedCoachSkill = null;
    state.selectedCoachQuote = '';
    initMatchDrop();
  }

  function isTournamentFinished(){
    return state.matchIndex > state.matchCount;
  }

  // ===== main step machine =====
  // ここが「本日のチームをご紹介」停止バグの根本対策：
  // ・毎stepで必ず request を出す（UIが何を描けばいいか迷わない）
  // ・intro -> teamList -> coach -> drop -> roundStart -> events -> encounter -> battle -> battleResult -> move -> ... を固定
  function step(){
    if (!state) return;

    // requestは「UIが消化したらnullにする」運用でもOKだが、
    // 事故防止で step毎に必ず上書きする
    const p = getPlayer();

    // 終了済み
    if (state.phase === 'done'){
      setRequest('noop', {});
      return;
    }

    // 大会開始直後：到着演出→紹介テキスト
    if (state.phase === 'intro'){
      state.bannerLeft = 'ローカル大会';
      state.bannerRight = '20チーム';
      state.ui.bg = 'maps/neonmain.png';
      state.ui.squareBg = 'tent.png';
      state.ui.leftImg = getPlayerSkin();
      state.ui.rightImg = '';
      setCenter3('本日のチームをご紹介！', '', '');
      setRequest('showIntroText', {});
      state.phase = 'teamList';
      return;
    }

    // チーム一覧（大会開始前だけ）
    if (state.phase === 'teamList'){
      // 一覧をUIに要求（スクロール）
      setCenter3('', '', '');
      setRequest('showTeamList', { teams: state.teams.map(t=>({
        id:t.id, name:t.name, power:t.power, alive:t.alive, eliminated:t.eliminated, treasure:t.treasure, flag:t.flag, isPlayer:!!t.isPlayer
      }))});
      state.phase = 'teamList_done';
      return;
    }

    // 一覧の次：試合開始宣言→コーチスキル選択
    if (state.phase === 'teamList_done'){
      setCenter3('それでは試合を開始します！', '使用するコーチスキルを選択してください！', '');
      setRequest('showCoachSelect', {
        equipped: getEquippedCoachList(),
        master: COACH_MASTER
      });
      state.phase = 'coach_done';
      return;
    }

    // コーチ選択後：降下開始（drop）
    if (state.phase === 'coach_done'){
      // drop初期化
      initMatchDrop();

      const p2 = getPlayer();
      const info = getAreaInfo(p2?.areaId || 1);

      state.bannerLeft = `MATCH ${state.matchIndex} / 5`;
      state.bannerRight = '降下';
      state.ui.leftImg = getPlayerSkin();
      state.ui.rightImg = '';
      state.ui.bg = 'tent.png'; // 会場→降下前
      setCenter3('バトルスタート！', '降下開始…！', '');
      setRequest('showDropStart', {});

      // 次のstepで降下完了表示
      state.phase = 'drop_land';
      return;
    }

    if (state.phase === 'drop_land'){
      const p2 = getPlayer();
      const info = getAreaInfo(p2?.areaId || 1);
      state.ui.bg = info.img;

      const contested = !!state.playerContestedAtDrop;
      setCenter3(`${info.name}に降下完了。周囲を確認…`, contested ? '被った…敵影がいる！' : '周囲は静かだ…', 'IGLがコール！戦闘準備！');
      setRequest('showDropLanded', { areaId: info.id, areaName: info.name, bg: info.img, contested });
      state.phase = 'round_start';
      state.round = 1;
      return;
    }

    // ===== round loop =====
    if (state.phase === 'round_start'){
      const r = state.round;
      state.bannerLeft = `MATCH ${state.matchIndex} / 5`;
      state.bannerRight = `ROUND ${r}`;

      setCenter3(`Round ${r} 開始！`, '', '');
      setRequest('showRoundStart', { round: r });

      // 次：イベント（表示はUIが eventCount(r) 回だけプレイヤーに対してやる）
      state.phase = 'round_events';
      state._eventsToShow = eventCount(r);
      return;
    }

    if (state.phase === 'round_events'){
      const r = state.round;

      // R6は基本なし
      if (eventCount(r) === 0){
        state.phase = 'round_battles';
        return step();
      }

      // プレイヤーが生きている間だけイベント表示（プレイヤー視点）
      if (!p || p.eliminated){
        state.phase = 'round_battles';
        return step();
      }

      const remain = Number(state._eventsToShow||0);
      if (remain <= 0){
        state.phase = 'round_battles';
        return step();
      }

      // プレイヤーにイベント1回分を適用＆表示要求
      const ev = applyEventForTeam(p);
      state._eventsToShow = remain - 1;

      if (ev){
        setCenter3(ev.log1, ev.log2, ev.log3);
        setRequest('showEvent', { icon: ev.icon, log1: ev.log1, log2: ev.log2, log3: ev.log3 });
      }else{
        setCenter3('イベント発生！', '……', '');
        setRequest('showEvent', { icon: '', log1:'イベント発生！', log2:'……', log3:'' });
      }
      return;
    }

    if (state.phase === 'round_battles'){
      const r = state.round;

      // 交戦マッチ作成＆保存（UIが1戦ずつ演出するため）
      const matches = buildMatchesForRound(r);
      state._roundMatches = matches.map(([A,B])=>({ aId:A.id, bId:B.id }));
      state._matchCursor = 0;

      setRequest('prepareBattles', { round: r, slots: battleSlots(r), matches: state._roundMatches });
      state.phase = 'battle_one';
      return;
    }

    if (state.phase === 'battle_one'){
      const r = state.round;
      const cur = Number(state._matchCursor||0);
      const list = Array.isArray(state._roundMatches) ? state._roundMatches : [];

      if (cur >= list.length){
        // roundの交戦が終わった → 移動 or R6結果へ
        state.phase = (r <= 5) ? 'round_move' : 'match_result';
        return step();
      }

      const pair = list[cur];
      const A = state.teams.find(t=>t.id===pair.aId);
      const B = state.teams.find(t=>t.id===pair.bId);
      if (!A || !B){
        state._matchCursor = cur + 1;
        return step();
      }

      // プレイヤー関与ならUIに「接敵演出」を要求（ロード猶予）
      const playerIn = (A.isPlayer || B.isPlayer);
      if (playerIn){
        const me = A.isPlayer ? A : B;
        const foe = A.isPlayer ? B : A;

        state.ui.leftImg = getPlayerSkin();
        state.ui.rightImg = `${foe.id}.png`; // UIが cpu/ or 直下 どちらで読むかはUI側既存に合わせる（プレビュー規則に従う想定）
        state.ui.topLeftName = me.name;
        state.ui.topRightName = foe.name;

        setCenter3('接敵‼︎', `${me.name} vs ${foe.name}‼︎`, '交戦スタート‼︎');
        setRequest('showEncounter', { meId: me.id, foeId: foe.id, meName: me.name, foeName: foe.name, foeTeamId: foe.id });
      }else{
        // CPU同士はログ無し：UIへは「裏処理」だけ通知して次へ
        setRequest('cpuBattleSilent', { aId:A.id, bId:B.id });
      }

      state.phase = 'battle_resolve';
      return;
    }

    if (state.phase === 'battle_resolve'){
      const r = state.round;
      const cur = Number(state._matchCursor||0);
      const list = Array.isArray(state._roundMatches) ? state._roundMatches : [];
      const pair = list[cur];

      const A = state.teams.find(t=>t.id===pair.aId);
      const B = state.teams.find(t=>t.id===pair.bId);
      if (!A || !B){
        state._matchCursor = cur + 1;
        state.phase = 'battle_one';
        return step();
      }

      const ctx = computeCtx();

      // コーチ倍率はプレイヤーのみ
      const mult = coachMultForRound(r);
      let aBackup=null, bBackup=null;
      if (A.isPlayer){ aBackup=A.power; A.power=clamp(A.power*mult,1,100); }
      if (B.isPlayer){ bBackup=B.power; B.power=clamp(B.power*mult,1,100); }

      const res = window.MOBBR?.sim?.matchFlow?.resolveBattle
        ? window.MOBBR.sim.matchFlow.resolveBattle(A, B, r, ctx)
        : null;

      if (A.isPlayer && aBackup!==null) A.power=aBackup;
      if (B.isPlayer && bBackup!==null) B.power=bBackup;

      // プレイヤー関与なら「戦闘ログ（高速切替10個）」→「勝敗表示」→2秒→NEXT をUI側でやる
      const playerIn = (A.isPlayer || B.isPlayer);
      if (playerIn){
        const me = A.isPlayer ? A : B;
        const foe = A.isPlayer ? B : A;
        const iWon = res ? (res.winnerId === me.id) : false;

        setRequest('showBattle', {
          round: r,
          meId: me.id, foeId: foe.id,
          meName: me.name, foeName: foe.name,
          win: iWon,
          final: (r===6),
          // UIが2秒待ってNEXT出すためのヒント
          holdMs: 2000
        });

        if (!iWon && me.eliminated){
          // 全滅 → 裏高速処理（ログ無し）
          setRequest('playerEliminatedFastForward', { round: r, matchIndex: state.matchIndex });
          // 高速処理
          fastForwardToMatchEnd();
          // resultへ
          state.phase = 'match_result';
          return;
        }
      }else{
        // CPU同士：ログ無し
      }

      // 次の交戦へ
      state._matchCursor = cur + 1;
      state.phase = 'battle_one';
      return;
    }

    if (state.phase === 'round_move'){
      const r = state.round;
      // 移動演出（ido.png → 次エリアロード完了 → 到着）
      // ここでは「移動要求」を出す。実際の画像ロード/フェードはUIがやる。
      const p3 = getPlayer();
      const before = p3 ? getAreaInfo(p3.areaId) : null;

      // すでに moveAllTeamsToNextRound は battle_resolve 後には走ってないのでここで走らせる
      moveAllTeamsToNextRound(r);

      const p4 = getPlayer();
      const after = p4 ? getAreaInfo(p4.areaId) : null;

      state.ui.bg = 'ido.png';
      state.ui.leftImg = getPlayerSkin();
      state.ui.rightImg = '';
      setCenter3('安置が縮む…移動開始！', 'ルート変更。急げ！', '');
      setRequest('showMove', {
        fromAreaId: before?.id || 0,
        toAreaId: after?.id || 0,
        toAreaName: after?.name || '',
        toBg: after?.img || '',
        holdMs: 0
      });

      state.phase = 'round_arrive';
      return;
    }

    if (state.phase === 'round_arrive'){
      const p5 = getPlayer();
      const info = p5 ? getAreaInfo(p5.areaId) : null;
      if (info){
        state.ui.bg = info.img;
        setCenter3(`${info.name}へ到着！`, '', '');
        setRequest('showArrive', { areaId: info.id, areaName: info.name, bg: info.img });
      }else{
        setCenter3('到着！', '', '');
        setRequest('showArrive', { areaId: 0, areaName: '', bg: '' });
      }

      // 次round
      state.round += 1;
      state.phase = (state.round <= 6) ? 'round_start' : 'match_result';
      return;
    }

    if (state.phase === 'match_result'){
      // 1試合のresult計算
      finishMatchAndBuildResult();

      setRequest('showMatchResult', {
        matchIndex: state.matchIndex,
        matchCount: state.matchCount,
        rows: state.lastMatchResultRows
      });
      state.phase = 'match_result_done';
      return;
    }

    if (state.phase === 'match_result_done'){
      if (state.matchIndex >= state.matchCount){
        // 大会終了：総合resultへ
        setRequest('showTournamentResult', { total: state.tournamentTotal });
        state.phase = 'done';
        return;
      }

      // 次の試合へ
      startNextMatch();

      setCenter3(`次の試合へ`, `MATCH ${state.matchIndex} / 5`, '');
      setRequest('nextMatch', { matchIndex: state.matchIndex });
      state.phase = 'round_start'; // match開始後は即 R1開始前演出へ
      // ただし「紹介画面」はもう出さない（最初だけ）
      return;
    }

    // フォールバック
    setRequest('noop', {});
  }

  // ===== start =====
  function startLocalTournament(){
    const cpuAllLocal = getCpuTeamsLocalOnly();
    const cpu19 = shuffle(cpuAllLocal).slice(0, 19);

    const player = {
      id: 'PLAYER',
      name: localStorage.getItem(K.teamName) || 'PLAYER TEAM',
      isPlayer: true,

      power: calcPlayerTeamPower(),

      alive: 3,
      eliminated: false,
      areaId: 1,

      kills_total: 0,
      assists_total: 0,
      members: [],
      treasure: 0,
      flag: 0,
      eventBuffs: { aim:0, mental:0, agi:0 }
    };

    const teams = [player];

    cpu19.forEach((c, i)=>{
      const id = c.teamId || c.id || `localXX_${i+1}`;
      // 表示名は teamId を基本（仕様：画像名に直結）
      const nm = String(c.teamId || c.id || id);

      teams.push({
        id,
        name: nm,
        isPlayer: false,

        power: rollCpuTeamPowerFromMembers(c),

        alive: 3,
        eliminated: false,
        areaId: 1,

        kills_total: 0,
        assists_total: 0,
        members: [],
        treasure: 0,
        flag: 0,
        eventBuffs: { aim:0, mental:0, agi:0 }
      });
    });

    state = {
      mode: 'local',
      matchIndex: 1,
      matchCount: 5,
      round: 1,

      // intro → teamList → coach → drop → round... → match_result...
      phase: 'intro',

      teams,
      tournamentTotal: {},

      playerContestedAtDrop: false,

      selectedCoachSkill: null,
      selectedCoachQuote: '',

      bannerLeft: 'ローカル大会',
      bannerRight: '20チーム',

      ui: {
        bg: 'maps/neonmain.png',
        squareBg: 'tent.png',
        leftImg: getEquippedSkin(),
        rightImg: '',
        center3: ['','',''],
        topLeftName: '',
        topRightName: ''
      },

      request: null
    };

    // UI open
    if (window.MOBBR?.ui?.tournament?.open){
      window.MOBBR.ui.tournament.open();
    }
    if (window.MOBBR?.ui?.tournament?.render){
      window.MOBBR.ui.tournament.render();
    }

    // 最初のステップ（intro requestを出す）
    step();
    if (window.MOBBR?.ui?.tournament?.render){
      window.MOBBR.ui.tournament.render();
    }
  }

  window.MOBBR.sim.tournamentFlow = {
    startLocalTournament,
    step,
    getState,

    // UIが使う（v3系想定）
    getCoachMaster,
    getEquippedCoachList,
    setCoachSkill,
    getPlayerSkin,
    getAreaInfo,
    initMatchDrop,
    applyEventForTeam,
    simulateRound,
    fastForwardToMatchEnd,
    finishMatchAndBuildResult,
    startNextMatch,
    isTournamentFinished
  };

})();
