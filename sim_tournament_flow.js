'use strict';

/*
  sim_tournament_flow.js v3（フル）
  ✅「試合最新版.txt」準拠（運用版）
  - ローカル大会：CPUは local01〜local20 のみ
  - 5試合（match 1〜5）を実行し、試合ごとに result を出す
  - マップ画像（maps/）を使用：R1-R2=1-16 / R3=17-20 / R4=21-22 / R5=23-24 / R6=25
  - 降下：16エリアに1チームずつ＋被り4（=2チームエリアが4箇所）
  - 交戦枠：R1-4=4 / R5=2 / R6=1
  - プレイヤー戦確率：R1(被りなら100) / R2=70 / R3=75 / R4-6=100
  - プレイヤー全滅後：裏で高速処理→その試合のresultへ（以後ログ無し）
  - イベント：R1=1回 / R2-5=2回 / R6=基本なし（プレイヤー視点のみ表示）
  - eventBuffs(aim/mental/agi %加算) は matchEvents.rollForTeam を使用
  - battle解決：matchFlow.resolveBattle を使用
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){

  const K = {
    teamName: 'mobbr_team',
    playerTeam: 'mobbr_playerTeam',
    equippedSkin: 'mobbr_equippedSkin',          // P1〜P5 を保存している想定（無ければP1）
    equippedCoachSkills: 'mobbr_equippedCoachSkills' // 装備中（最大3）想定
  };

  // ===== Map Master（固定） =====
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

  function areasForRound(r){
    if (r <= 2) return range(1,16);
    if (r === 3) return range(17,20);
    if (r === 4) return range(21,22);
    if (r === 5) return range(23,24);
    return [25];
  }

  function range(a,b){
    const out = [];
    for(let i=a;i<=b;i++) out.push(i);
    return out;
  }

  // ===== DataCPU =====
  function getCpuTeamsLocalOnly(){
    const d = window.DataCPU;
    if (!d) return [];
    let all = [];
    if (typeof d.getAllTeams === 'function') all = d.getAllTeams() || [];
    else if (typeof d.getALLTeams === 'function') all = d.getALLTeams() || [];
    else if (Array.isArray(d.TEAMS)) all = d.TEAMS;
    if (!Array.isArray(all)) all = [];
    // ✅ ローカルのみ
    return all.filter(t => String(t.teamId || t.id || '').startsWith('local'));
  }

  function shuffle(arr){
    const a = arr.slice();
    for (let i=a.length-1;i>0;i--){
      const j = (Math.random()*(i+1))|0;
      [a[i],a[j]]=[a[j],a[i]];
    }
    return a;
  }

  // ===== プレイヤー戦闘力：ui_team と一致させる（可能なら委譲）=====
  function calcPlayerTeamPower(){
    // 1) ui_team が計算関数を公開してるなら最優先
    try{
      const fn = window.MOBBR?.ui?.team?.calcTeamPower;
      if (typeof fn === 'function'){
        const v = fn();
        if (Number.isFinite(v)) return v;
      }
    }catch(e){}

    // 2) 保存データに teamPower があるなら採用
    try{
      const raw = localStorage.getItem(K.playerTeam);
      if (raw){
        const t = JSON.parse(raw);
        const v = Number(t?.teamPower);
        if (Number.isFinite(v)) return v;
      }
    }catch(e){}

    // 3) フォールバック（最低限）
    return 55;
  }

  function getEquippedSkin(){
    const v = (localStorage.getItem(K.equippedSkin) || 'P1').trim();
    const n = v.match(/^P([1-5])$/) ? v : 'P1';
    return `${n}.png`;
  }

  // ===== CPU 実戦戦闘力抽選（最新仕様）=====
  // ・総合力(basePower)は「表示用の代表値」：実戦は3人min-max抽選の平均
  // ・総合力が高いほどブレが小さい：basePowerに応じて min-max の振れ幅を縮める
  function rollCpuTeamPowerFromMembers(cpuTeam){
    const mem = Array.isArray(cpuTeam?.members) ? cpuTeam.members : [];
    if (mem.length === 0){
      // dataが無い場合は basePower をそのまま
      const base = Number(cpuTeam?.basePower);
      return Number.isFinite(base) ? base : 55;
    }

    const basePower = Number(cpuTeam?.basePower);
    const bp = Number.isFinite(basePower) ? basePower : 70;

    // 安定度：bpが高いほど 1.0 に寄せる（振れ幅縮小）
    // 例：bp=95 → 0.85〜1.15 のレンジを 0.93〜1.07 くらいへ圧縮
    const stable = clamp01((bp - 50) / 50); // 0..1（50以下は0）
    const compress = 1 - (stable * 0.55);   // 1.00 → 0.45

    const vals = mem.slice(0,3).map(m=>{
      const lo0 = Number(m?.powerMin);
      const hi0 = Number(m?.powerMax);
      const lo = Number.isFinite(lo0) ? lo0 : 50;
      const hi = Number.isFinite(hi0) ? hi0 : 80;
      const mid = (lo + hi) / 2;
      const half = (hi - lo) / 2;

      const half2 = half * compress;
      const lo2 = mid - half2;
      const hi2 = mid + half2;

      const r = lo2 + Math.random() * (hi2 - lo2);
      return r;
    });

    const avg = vals.reduce((a,b)=>a+b,0) / vals.length;
    return Math.round(clamp(avg, 1, 100));
  }

  function clamp(n, lo, hi){
    const v = Number(n);
    if (!Number.isFinite(v)) return lo;
    return Math.max(lo, Math.min(hi, v));
  }
  function clamp01(n){
    return clamp(n, 0, 1);
  }

  // ===== コーチスキル（効果確定5種）=====
  // 仕様：プレイヤーのみ。最大3枠。選択したスキルは消耗（所持＆装備から削除想定：ここでは「今回使用」としてstateへ記録）
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

  // ===== ラウンド別設定 =====
  function battleSlots(round){
    if (round <= 4) return 4;
    if (round === 5) return 2;
    return 1;
  }
  function eventCount(round){
    if (round === 1) return 1;
    if (round >= 2 && round <= 5) return 2;
    return 0;
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

  function computeCtx(){
    const player = getPlayer();
    const coachFlags = window.MOBBR?.sim?.matchFlow?.getPlayerCoachFlags
      ? window.MOBBR.sim.matchFlow.getPlayerCoachFlags()
      : {};
    return { player, playerCoach: coachFlags };
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

  function resetForNewMatch(){
    // 試合開始時：全チーム復活・イベントバフ初期化・お宝/旗は試合内カウント（resultで使う）
    for(const t of state.teams){
      t.eliminated = false;
      t.alive = 3;
      t.eventBuffs = { aim:0, mental:0, agi:0 };
      t.treasure = 0;
      t.flag = 0;
      // kills/assists は将来用（ここでは壊さない）
    }
  }

  function initDropPositions(){
    const ids = shuffle(state.teams.map(t=>t.id));
    const areas = range(1,16);
    const assigned = new Map(); // areaId -> [teamId...]
    for(const a of areas) assigned.set(a, []);

    // 先頭16を1〜16へ
    for(let i=0;i<16;i++){
      const teamId = ids[i];
      const areaId = i+1;
      assigned.get(areaId).push(teamId);
    }

    // 残り4：被りを4つ選ぶ（=2チームエリアが4箇所）
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

    // プレイヤー被り判定（R1プレイヤー戦確率に使う）
    const p = getPlayer();
    state.playerContestedAtDrop = !!(p && (assigned.get(p.areaId)?.length >= 2));
  }

  function moveAllTeamsToNextRound(roundJustFinished){
    // Round終了時に移動（R1終了→R2へ、...）
    const nextRound = roundJustFinished + 1;
    const pool = areasForRound(nextRound);

    for(const t of state.teams){
      if (t.eliminated) continue;

      // pool内のどこかに移動（単純：現areaに近い方を優先して少し寄せる）
      const cur = t.areaId;
      let candidates = pool.slice();
      candidates.sort((a,b)=>Math.abs(a-cur)-Math.abs(b-cur));
      const top = candidates.slice(0, Math.min(3, candidates.length));
      const pick = top[(Math.random()*top.length)|0];
      t.areaId = pick;
    }
  }

  // ===== マッチ組み（CPU同士は「同Area or 近接」を優先、重複戦闘なし）=====
  function buildMatchesForRound(round){
    const alive = aliveTeams();
    const slots = battleSlots(round);
    const used = new Set();
    const matches = [];

    const player = getPlayer();

    // 1) プレイヤー戦（確率で寄せる）
    if (player && !player.eliminated){
      const prob = playerBattleProb(round, !!state.playerContestedAtDrop);
      if (Math.random() < prob){
        used.add(player.id);

        // 同Area優先 → 近接 → ランダム
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

    // 2) 残り枠：CPU同士（同Area/近接を優先）
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

  // ===== コーチスキル倍率 =====
  function coachMultForRound(round){
    const p = getPlayer();
    if (!p) return 1.0;
    const sk = state.selectedCoachSkill;
    if (!sk) return 1.0;

    const m = COACH_MASTER[sk];
    if (!m) return 1.0;

    if (m.endgame){
      return (round >= 5) ? m.mult : 1.0;
    }
    return m.mult;
  }

  // ===== 1試合：Roundを1つ進める（UIは ui_tournament が演出制御）=====
  // ここは「処理のみ」。表示は ui_tournament 側で順序制御する。
  function simulateRound(round){
    const ctx = computeCtx();
    const matches = buildMatchesForRound(round);

    // プレイヤー全滅後は「裏処理」専用（ログを増やさない）
    const player = ctx.player;
    const playerAlive = !!(player && !player.eliminated);

    const out = {
      round,
      matches: matches.map(([A,B])=>({ aId:A.id, bId:B.id }))
    };

    for(const [A,B] of matches){
      ensureTeamRuntimeShape(A);
      ensureTeamRuntimeShape(B);

      // イベント：各交戦ごとに「そのチームに対して」抽選（R別回数はUI側がプレイヤーに見せるため、ここでは最小：各交戦前に1回ずつ）
      // ✅ プレイヤー表示用は ui 側で「R1=1, R2-5=2」に合わせて制御するため、ここは「内部適用」だけ行う
      // （ui_tournament が rollForTeam を必要回数呼ぶ＝内部適用も一致する）
      // なのでここではイベント適用をしない（=UIが適用責務）。
      // → バトルのみ解決。

      // 戦闘：コーチ倍率をプレイヤーにだけ反映するため、round中だけpowerに乗せて戻す
      const mult = coachMultForRound(round);
      let pBackup = null;
      if (A.isPlayer){
        pBackup = A.power;
        A.power = clamp(A.power * mult, 1, 100);
      }
      if (B.isPlayer){
        pBackup = B.power;
        B.power = clamp(B.power * mult, 1, 100);
      }

      const res = window.MOBBR?.sim?.matchFlow?.resolveBattle
        ? window.MOBBR.sim.matchFlow.resolveBattle(A, B, round, ctx)
        : null;

      // power戻す
      if (A.isPlayer && pBackup !== null) A.power = pBackup;
      if (B.isPlayer && pBackup !== null) B.power = pBackup;

      // resはUIが参照する（誰が勝ったか）
      if (res){
        if (!out.results) out.results = [];
        out.results.push(res);
      }

      // プレイヤーが全滅したら：以後ログ無しで続行（UIはここで高速へ）
      if (playerAlive){
        const pNow = getPlayer();
        if (pNow && pNow.eliminated){
          // 以後の処理は fastForward が担当
          break;
        }
      }
    }

    // Round終了時の移動（R1-5）
    if (round <= 5){
      moveAllTeamsToNextRound(round);
    }else{
      // R6は移動なし（Area25固定）
      for(const t of state.teams){
        if (!t.eliminated) t.areaId = 25;
      }
    }

    return out;
  }

  function fastForwardToMatchEnd(){
    // プレイヤー全滅後：表示なしでR6まで回して順位確定
    while(state.round <= 6){
      const r = state.round;

      // R6はエリア固定
      if (r === 6){
        for(const t of state.teams){
          if (!t.eliminated) t.areaId = 25;
        }
      }

      // イベント内部適用：プレイヤーは死んでるので省略（勝敗に直結させない＆ログ無しでOK）
      // 交戦だけ回す
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
    state.round = 7; // end marker
  }

  // ===== result（1試合） =====
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
    // 生存順位＝最後まで残った順
    // 同ラウンド脱落内：KP→（downs_totalは使わない）→総合力低い方寄り→ランダム
    // ※KP/APは将来実装のため、現時点は 0 固定でも並びが決まるように総合力/ランダムで決着させる
    const teams = state.teams.slice();

    // eliminated=false を上へ（alive>0想定）
    teams.sort((a,b)=>{
      const ae = a.eliminated ? 1 : 0;
      const be = b.eliminated ? 1 : 0;
      if (ae !== be) return ae - be;

      // KP（未実装：0想定）
      const ak = Number(a.kills_total||0);
      const bk = Number(b.kills_total||0);
      if (bk !== ak) return bk - ak;

      // 総合力低い方が上寄り（60:40）＝完全決定はしないが、ソートで再現するため「低い方優先」
      const ap = Number(a.power||0);
      const bp = Number(b.power||0);
      if (ap !== bp) return ap - bp;

      // 最後は名前
      return String(a.name||'').localeCompare(String(b.name||''), 'ja');
    });

    // ただし、上記だけだと「同ラウンド脱落」が表現できないので、最終的にはランダム少し混ぜる（同値帯のみ）
    // → 最低限の安定のため、ここでは同値帯だけ軽くシャッフル
    for(let i=0;i<teams.length;i++){
      for(let j=i+1;j<teams.length;j++){
        const a = teams[i], b = teams[j];
        if (!!a.eliminated === !!b.eliminated &&
            (a.kills_total||0)===(b.kills_total||0) &&
            Number(a.power||0)===Number(b.power||0)){
          if (Math.random() < 0.5){
            teams[i]=b; teams[j]=a;
          }
        }
      }
    }

    return teams.map((t, idx)=>({ id:t.id, name:t.name, placement: idx+1 }));
  }

  function computeMatchResultTable(){
    const placements = computePlacements();
    const byId = new Map(state.teams.map(t=>[t.id,t]));

    const rows = placements.map(p=>{
      const t = byId.get(p.id) || {};
      const KP = Number(t.kills_total||0);
      const AP = Number(t.assists_total||0);
      const Treasure = Number(t.treasure||0);
      const Flag = Number(t.flag||0);
      const PlacementP = PLACEMENT_P(p.placement);
      const Total = PlacementP + KP + AP + Treasure + (Flag*2);

      return {
        placement: p.placement,
        id: p.id,
        squad: p.name,
        KP, AP, Treasure, Flag, Total, PlacementP
      };
    });

    return rows;
  }

  function addToTournamentTotal(matchRows){
    // 総合：PlacementP合計 + KP + AP + Treasure + Flag*2
    const total = state.tournamentTotal;
    for(const r of matchRows){
      if (!total[r.id]){
        total[r.id] = {
          id: r.id,
          squad: r.squad,
          sumPlacementP: 0,
          KP: 0,
          AP: 0,
          Treasure: 0,
          Flag: 0,
          sumTotal: 0
        };
      }
      total[r.id].sumPlacementP += r.PlacementP;
      total[r.id].KP += r.KP;
      total[r.id].AP += r.AP;
      total[r.id].Treasure += r.Treasure;
      total[r.id].Flag += r.Flag;
      total[r.id].sumTotal += r.Total;
    }
  }

  // ===== Public API =====
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

      // result用（将来）
      kills_total: 0,
      assists_total: 0,
      members: [],
      treasure: 0,
      flag: 0,
      eventBuffs: { aim:0, mental:0, agi:0 }
    };

    const teams = [player];

    cpu19.forEach((c, i)=>{
      const id = c.teamId || c.id || `CPU_${i+1}`;
      const nm = c.name || c.teamName || id;

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
      matchIndex: 1,             // 1..5
      matchCount: 5,
      round: 1,                  // 1..6（試合内）
      phase: 'intro',            // intro -> coach -> drop -> round -> move -> result -> nextMatch -> tournamentResult
      teams,
      tournamentTotal: {},

      // UI用
      bannerLeft: 'ローカル大会',
      bannerRight: '20チーム',
      playerContestedAtDrop: false,
      selectedCoachSkill: null,
      selectedCoachQuote: '',

      // UIが参照する画像
      ui: {
        bg: 'maps/neonmain.png', // 大会背景（到着）
        squareBg: 'tent.png',
        leftImg: getEquippedSkin(),
        rightImg: '',
        center3: ['','', ''],
        topLeftName: '',
        topRightName: '',
        battleBanner: '' // "BATTLE!!"等
      },

      // UI制御
      lockNext: false,
      request: null, // UIへ「次に何を演出するか」要求（ui_tournament が消化）
    };

    // UI open
    if (window.MOBBR?.ui?.tournament?.open){
      window.MOBBR.ui.tournament.open();
      window.MOBBR.ui.tournament.render();
    }
  }

  function getState(){
    return state;
  }

  // UIが「イベント適用」を呼ぶ（表示テンポ固定のためUI主導）
  function applyEventForTeam(team){
    const ctx = computeCtx();
    if (!window.MOBBR?.sim?.matchEvents?.rollForTeam) return null;
    return window.MOBBR.sim.matchEvents.rollForTeam(team, state.round, ctx);
  }

  function simulateCurrentRound(){
    return simulateRound(state.round);
  }

  function advanceRoundCounter(){
    state.round += 1;
  }

  function finishMatchAndBuildResult(){
    // roundは7まで進んでいる想定でもOK
    const rows = computeMatchResultTable();
    addToTournamentTotal(rows);
    state.lastMatchResultRows = rows;
  }

  function startNextMatch(){
    state.matchIndex += 1;
    state.round = 1;
    state.selectedCoachSkill = null;
    state.selectedCoachQuote = '';
    resetForNewMatch();
  }

  function isTournamentFinished(){
    return state.matchIndex > state.matchCount;
  }

  function fastForwardMatchEnd(){
    fastForwardToMatchEnd();
    finishMatchAndBuildResult();
  }

  function setCoachSkill(skillId){
    const id = String(skillId || '');
    if (!id || !COACH_MASTER[id]){
      state.selectedCoachSkill = null;
      state.selectedCoachQuote = '';
      return;
    }
    state.selectedCoachSkill = id;
    state.selectedCoachQuote = COACH_MASTER[id].quote || '';
  }

  function getCoachMaster(){
    return COACH_MASTER;
  }

  function getEquippedCoachList(){
    return getEquippedCoachSkills();
  }

  function getPlayerSkin(){
    return getEquippedSkin();
  }

  function getAreaInfo(areaId){
    const a = AREA[areaId];
    return a ? { id: areaId, name: a.name, img: a.img } : { id: areaId, name: `Area${areaId}`, img: '' };
  }

  function initMatchDrop(){
    resetForNewMatch();
    initDropPositions();
    // 開幕：プレイヤー側の背景を降下先へ
    const p = getPlayer();
    if (p){
      const info = getAreaInfo(p.areaId);
      state.ui.bg = info.img || state.ui.bg;
    }
  }

  window.MOBBR.sim.tournamentFlow = {
    startLocalTournament,
    getState,

    // UIが使う
    getCoachMaster,
    getEquippedCoachList,
    setCoachSkill,
    getPlayerSkin,
    getAreaInfo,

    // 試合制御（UI主導で演出順を守る）
    initMatchDrop,
    applyEventForTeam,
    simulateCurrentRound,
    advanceRoundCounter,
    finishMatchAndBuildResult,
    startNextMatch,
    isTournamentFinished,
    fastForwardMatchEnd
  };

})();
