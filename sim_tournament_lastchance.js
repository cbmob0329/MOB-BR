/* =========================================================
   MOB BR - sim_tournament_lastchance.js (FULL / FIXED)
   ---------------------------------------------------------
   役割：
   ・ラストチャンス大会（既定：40チーム / 5試合）※20にも対応
   ・1試合ごとに result を生成（ui_match_result.js が 20/40対応）
   ・試合後に「現在の総合順位」を更新
   ・戦闘ロジックは持たない（簡易シムで result を作るだけ）
   ---------------------------------------------------------
   追加対応（あなたの懸念点）：
   ✅ 試合前コーチスキル
      - 使える時は選択UIが出る（使わない選択もあり）
      - 消耗品：使ったら所持数を減らし、0なら装備枠からも外す
      - 使えるスキルが無ければ
        「コーチスキルはもう使い切っている！選手を信じよう！」
   ✅ カードコレクション効果
      - プレイヤーチームの「勝ちやすさ」に反映（簡易ウェイト）
   ---------------------------------------------------------
   依存（あれば使う / 無くても動く）：
   ・window.MOBBR.ui.matchResult（ui_match_result.js）
   ・window.MOBBR.ui.showMessage（任意）
   ・window.MOBBR.data.cards（カード%算出用。なければ0）
   ・window.DataCPU（data_cpu_teams.js）
   ・window.MOBBR.data.player（任意：プレイヤーチーム取得）
========================================================= */

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){
  'use strict';

  const Last = {};
  window.MOBBR.sim.tournamentLastchance = Last;

  // ---------------------------------------------------------
  // CONFIG / KEYS
  // ---------------------------------------------------------
  const LS_KEY = 'mobbr_tournament_lastchance_state_v1';

  const CPU_IMG_BASE = 'cpu/';
  const COACH_OWNED_KEY = 'mobbr_coachSkillsOwned';
  const COACH_EQUIP_KEY = 'mobbr_coachSkillsEquipped';

  // “ui_team.js v16” に合わせる（idは固定）
  const COACH_MASTER = [
    { id:'tactics_note',  name:'戦術ノート',     powerPct:1, treasurePlus:0,   flagPlus:0 },
    { id:'mental_care',   name:'メンタル整備',   powerPct:0, treasurePlus:0,   flagPlus:0 },
    { id:'endgame_power', name:'終盤の底力',     powerPct:3, treasurePlus:0,   flagPlus:0 },
    { id:'clearing',      name:'クリアリング徹底',powerPct:0, treasurePlus:0,  flagPlus:0 },
    { id:'score_mind',    name:'スコア意識',     powerPct:0, treasurePlus:0.06,flagPlus:0.03 },
    { id:'igl_call',      name:'IGL強化コール',  powerPct:4, treasurePlus:0,   flagPlus:0 },
    { id:'protagonist',   name:'主人公ムーブ',   powerPct:6, treasurePlus:0,   flagPlus:0 }
  ];
  const COACH_BY_ID = Object.fromEntries(COACH_MASTER.map(s=>[s.id,s]));

  // ---------------------------------------------------------
  // PUBLIC API
  // ---------------------------------------------------------
  /**
   * ラストチャンス大会セッション作成
   * opt:
   *  - keepStorage (boolean) : 既存保存優先（既定true）
   *  - teamCount (number) : 20 or 40（既定40）
   *  - matchTotal (number) : 既定5
   *  - teams (array) : 外部注入（任意）
   *  - seed (number) : 任意
   */
  Last.create = function(opt){
    const o = opt || {};
    if (o.keepStorage !== false){
      const saved = readState();
      if (saved && saved.kind === 'lastchance' && saved.matchIndex < saved.matchTotal){
        return saved;
      }
    }

    const teamCount = (Number(o.teamCount) === 20) ? 20 : 40;
    const matchTotal = Number.isFinite(Number(o.matchTotal)) ? Math.max(1, Number(o.matchTotal)) : 5;

    const teams = normalizeTeams(o.teams || buildDefaultTeams(teamCount), teamCount);

    const state = {
      kind: 'lastchance',
      version: 1,
      seed: Number.isFinite(Number(o.seed)) ? Number(o.seed) : Math.floor(Math.random()*1e9),
      rngI: 0,

      teamCount,
      matchIndex: 0,
      matchTotal,

      teams: teams.map(t => ({
        isPlayer: !!t.isPlayer,
        teamId: String(t.teamId),
        name: String(t.name),
        image: String(t.image || (t.teamId ? (CPU_IMG_BASE + t.teamId + '.png') : ''))
      })),

      // 総合順位用
      agg: initAgg(teams),

      // 試合前コーチ選択待ちステップ
      step: 'idle',        // 'idle' | 'awaitCoach'
      pending: null,       // { matchNo, selectedId|null, used:boolean }

      // 最後の表示用
      last: null
    };

    writeState(state);
    return state;
  };

  /**
   * 次の試合を進める（1試合分だけ）
   * ※ 試合前にコーチスキル選択が必要な場合、UIが出てここで止まる
   */
  Last.playNextMatch = function(state, opt){
    const st = state || readState();
    if (!st || st.kind !== 'lastchance') return null;

    if (st.matchIndex >= st.matchTotal){
      return st;
    }

    const o = opt || {};
    const matchNo = st.matchIndex + 1;

    // ---- 試合前コーチ（必要ならここで止める） ----
    if (st.step !== 'awaitCoachDone'){
      const opened = openCoachSelectIfNeeded(st, matchNo);
      writeState(st);
      if (opened){
        // UI操作で続きはもう一度 playNextMatch を呼べば進む
        return st;
      }
      st.step = 'awaitCoachDone';
    }

    // ---- 1試合の result 生成 ----
    const ctx = buildMatchContext(st);
    const matchRows = simulateOneMatch(st, ctx);

    // ---- 累積更新（総合順位） ----
    applyAgg(st, matchRows);
    const overallRows = buildOverallRows(st);

    const championName = matchRows[0]?.name || '';

    st.matchIndex = matchNo;
    st.last = { matchNo, matchRows, overallRows, championName };

    // 次に備えてリセット
    st.step = 'idle';
    st.pending = null;

    writeState(st);

    // UI表示（あれば）
    if (o.openUI !== false){
      const ui = window.MOBBR?.ui?.matchResult;
      if (ui && typeof ui.open === 'function'){
        ui.open({
          title: String(o.title || 'RESULT'),
          subtitle: String(o.subtitle || `ラストチャンス 第${matchNo}試合`),
          matchIndex: matchNo,
          matchTotal: st.matchTotal,
          rows: matchRows,
          championName
        });
      }
    }

    return st;
  };

  /**
   * 総合順位UI
   */
  Last.openOverallUI = function(state, opt){
    const st = state || readState();
    if (!st || st.kind !== 'lastchance') return;

    const ui = window.MOBBR?.ui?.matchResult;
    if (!ui || typeof ui.open !== 'function') return;

    const rows = buildOverallRows(st);
    const o = opt || {};

    ui.open({
      title: String(o.title || 'OVERALL'),
      subtitle: String(o.subtitle || `ラストチャンス 現在順位（${st.matchIndex}/${st.matchTotal}）`),
      matchIndex: st.matchIndex,
      matchTotal: st.matchTotal,
      rows,
      championName: rows[0]?.name || ''
    });
  };

  Last.isFinished = function(state){
    const st = state || readState();
    return !!(st && st.kind === 'lastchance' && st.matchIndex >= st.matchTotal);
  };

  Last.getFinalOverall = function(state){
    const st = state || readState();
    if (!st || st.kind !== 'lastchance') return null;
    return buildOverallRows(st);
  };

  Last.reset = function(){
    try{ localStorage.removeItem(LS_KEY); }catch{}
  };

  // ---------------------------------------------------------
  // COACH: 試合前選択（消耗）
  // ---------------------------------------------------------
  function openCoachSelectIfNeeded(st, matchNo){
    // すでに選択済みなら開かない
    if (st.pending && st.pending.matchNo === matchNo && st.pending.used === true){
      st.step = 'awaitCoachDone';
      return false;
    }
    if (st.pending && st.pending.matchNo === matchNo && st.pending.used === false && st.pending.selectedId === null){
      // 使わない選択済み
      st.step = 'awaitCoachDone';
      return false;
    }

    const owned = readCoachOwned();
    const equipped = readCoachEquipped();

    const usable = equipped
      .filter(id => id && typeof id === 'string')
      .filter(id => (Number(owned[id])||0) > 0)
      .map(id => COACH_BY_ID[id])
      .filter(Boolean);

    if (usable.length === 0){
      announce('コーチスキルはもう使い切っている！選手を信じよう！');
      st.pending = { matchNo, selectedId: null, used: false };
      st.step = 'awaitCoachDone';
      return false;
    }

    st.step = 'awaitCoach';
    st.pending = { matchNo, selectedId: null, used: false };

    ensureCoachModal();
    renderCoachModal(usable, matchNo, (selectedId)=>{
      // 選択結果を保存
      if (!selectedId){
        st.pending = { matchNo, selectedId: null, used: false };
        st.step = 'awaitCoachDone';
        writeState(st);
        closeCoachModal();
        announce('コーチスキル：使わない');
        return;
      }

      // 消耗処理
      consumeCoachSkill(selectedId);

      st.pending = { matchNo, selectedId, used: true };
      st.step = 'awaitCoachDone';
      writeState(st);
      closeCoachModal();
      announce(`コーチスキル使用：${COACH_BY_ID[selectedId]?.name || selectedId}`);
    });

    return true;
  }

  function consumeCoachSkill(id){
    const owned = readCoachOwned();
    const equipped = readCoachEquipped();

    const cur = Number(owned[id]) || 0;
    const next = Math.max(0, cur - 1);
    if (next <= 0){
      delete owned[id];
      // 0になったら装備枠からも外す（あなたの要件：所持品から削除＋装備にも残さない）
      for (let i=0;i<equipped.length;i++){
        if (equipped[i] === id) equipped[i] = null;
      }
    }else{
      owned[id] = next;
    }

    writeCoachOwned(owned);
    writeCoachEquipped(equipped);
  }

  function buildMatchContext(st){
    const cardBonus = calcCollectionBonusPercent();
    const coach = (st.pending && st.pending.used && st.pending.selectedId)
      ? COACH_BY_ID[st.pending.selectedId]
      : null;

    return {
      cardBonusPct: cardBonus,
      coach
    };
  }

  // ---------------------------------------------------------
  // CORE: One match simulation（簡易）
  // ---------------------------------------------------------
  function simulateOneMatch(st, ctx){
    const teams = st.teams.slice();

    // プレイヤー補正（カード + コーチ）
    const playerBoostPct = (ctx?.cardBonusPct||0) + (ctx?.coach?.powerPct||0);

    // 置き換え可能：ここは「勝ちやすさ」ウェイト（簡易）
    const orderedTeams = weightedOrder(teams, st, (t)=>{
      if (!t.isPlayer) return 1;
      // 0.00%〜 の微差が勝敗に乗るように緩く反映
      return 1 + (playerBoostPct * 0.08);
    });

    const placeById = {};
    for (let i=0;i<orderedTeams.length;i++){
      placeById[orderedTeams[i].teamId] = i + 1;
    }

    // 1試合スコア
    const baseTreasureRate = 0.18;
    const baseFlagRate = 0.08;

    const treasurePlus = (ctx?.coach?.treasurePlus||0);
    const flagPlus = (ctx?.coach?.flagPlus||0);

    const rows = teams.map(t=>{
      const place = placeById[t.teamId] || st.teamCount;

      // KP/AP：上位が少し出やすい
      const kpBase = place <= 3 ? 3 : place <= 10 ? 2 : 1;
      const kp = randInt(st, 0, kpBase + 3);

      const apMax = Math.max(0, kp + 3 + (t.isPlayer ? (ctx?.coach?.id === 'protagonist' ? 1 : 0) : 0));
      const ap = randInt(st, 0, apMax);

      const trRate = t.isPlayer ? (baseTreasureRate + treasurePlus) : baseTreasureRate;
      const flRate = t.isPlayer ? (baseFlagRate + flagPlus) : baseFlagRate;

      const treasure = (rand01(st) < trRate) ? 1 : 0;
      const flag = (rand01(st) < flRate) ? 1 : 0;

      const placementP = getPlacementPoint(place);
      const total = placementP + kp + ap + treasure + flag*2;

      return {
        place,
        teamId: t.teamId,
        name: t.name,
        image: t.image || (CPU_IMG_BASE + t.teamId + '.png'),
        placementP,
        kp,
        ap,
        treasure,
        flag,
        total
      };
    });

    rows.sort((a,b)=>a.place-b.place);
    return rows;
  }

  // ---------------------------------------------------------
  // AGGREGATION
  // ---------------------------------------------------------
  function initAgg(teams){
    const agg = {};
    for (const t of teams){
      agg[t.teamId] = {
        teamId: t.teamId,
        name: t.name,
        image: t.image || (CPU_IMG_BASE + t.teamId + '.png'),

        matches: 0,
        sumPlace: 0,

        totalPts: 0,
        totalKP: 0,
        totalAP: 0,
        totalTreasure: 0,
        totalFlag: 0
      };
    }
    return agg;
  }

  function applyAgg(st, matchRows){
    for (const r of matchRows){
      const a = st.agg[r.teamId];
      if (!a) continue;

      a.matches += 1;
      a.sumPlace += (Number(r.place)||st.teamCount);

      a.totalPts += (Number(r.total)||0);
      a.totalKP += (Number(r.kp)||0);
      a.totalAP += (Number(r.ap)||0);
      a.totalTreasure += (Number(r.treasure)||0);
      a.totalFlag += (Number(r.flag)||0);
    }
  }

  function buildOverallRows(st){
    const list = Object.values(st.agg || {});
    const rows = list.map(a=>{
      const avgPlace = a.matches ? (a.sumPlace / a.matches) : 999;
      return {
        teamId: a.teamId,
        name: a.name,
        image: a.image,
        place: 0,
        placementP: 0,
        kp: a.totalKP,
        ap: a.totalAP,
        treasure: a.totalTreasure,
        flag: a.totalFlag,
        total: a.totalPts,
        _avgPlace: avgPlace
      };
    });

    rows.sort((x,y)=>{
      if (y.total !== x.total) return y.total - x.total;
      if (y.kp !== x.kp) return y.kp - x.kp;
      if (x._avgPlace !== y._avgPlace) return x._avgPlace - y._avgPlace;
      if (y.ap !== x.ap) return y.ap - x.ap;
      return (rand01(st) < 0.5) ? -1 : 1;
    });

    for (let i=0;i<rows.length;i++) rows[i].place = i + 1;
    rows.forEach(r=>{ delete r._avgPlace; });
    return rows;
  }

  // ---------------------------------------------------------
  // TEAMS
  // ---------------------------------------------------------
  function buildDefaultTeams(teamCount){
    const out = [];
    const player = getPlayerTeamOrNull();
    if (player) out.push(player);

    const cpuPool = getLastChanceCpuTeams();
    const need = teamCount - out.length;

    const picked = pickUnique(cpuPool, need);
    out.push(...picked);

    while (out.length < teamCount){
      out.push({ isPlayer:false, teamId:'cpu_dummy_'+out.length, name:'CPU', image:'' });
    }
    return out.slice(0, teamCount);
  }

  function getPlayerTeamOrNull(){
    const DP = window.MOBBR?.data?.player || window.DataPlayer || null;
    if (DP){
      if (typeof DP.getTeam === 'function'){
        const t = DP.getTeam();
        if (t && t.teamId) return normalizeTeam(t, true);
      }
      if (typeof DP.getPlayerTeam === 'function'){
        const t = DP.getPlayerTeam();
        if (t && t.teamId) return normalizeTeam(t, true);
      }
      if (DP.team && DP.team.teamId){
        return normalizeTeam(DP.team, true);
      }
    }
    return { isPlayer:true, teamId:'player', name:'プレイヤーチーム', image:'' };
  }

  function getLastChanceCpuTeams(){
    const DC = window.DataCPU || null;
    let all = [];
    if (DC && typeof DC.getAllTeams === 'function'){
      all = DC.getAllTeams() || [];
    }

    // できるだけ “lastchance” を拾う（命名が揺れても拾う）
    const hit = (t)=>{
      const id = String(t.teamId||'').toLowerCase();
      if (!id) return false;
      return (
        id.startsWith('lc') ||
        id.includes('last') ||
        id.includes('chance') ||
        id.startsWith('lch') ||
        id.startsWith('lastchance')
      );
    };

    let pool = all.filter(hit);
    if (pool.length === 0){
      // 何も無ければ local/national/world 以外も含めて広めに
      pool = all.filter(t=>{
        const id = String(t.teamId||'').toLowerCase();
        return id && !id.startsWith('local') && !id.startsWith('national') && !id.startsWith('world') && !id.startsWith('final');
      });
    }
    if (pool.length === 0) pool = all;

    return pool.map(t=>normalizeTeam(t,false));
  }

  function normalizeTeams(arr, teamCount){
    const list = Array.isArray(arr) ? arr : [];
    const out = [];
    const seen = new Set();
    for (const t of list){
      const nt = normalizeTeam(t, !!t.isPlayer);
      if (!nt || !nt.teamId) continue;
      if (seen.has(nt.teamId)) continue;
      seen.add(nt.teamId);
      out.push(nt);
      if (out.length >= teamCount) break;
    }
    while (out.length < teamCount){
      out.push({ isPlayer:false, teamId:'cpu_dummy_'+out.length, name:'CPU', image:'' });
    }
    return out.slice(0, teamCount);
  }

  function normalizeTeam(t, forcePlayer){
    if (!t) return null;
    const teamId = String(t.teamId || t.id || t.key || '');
    if (!teamId) return null;
    const name = String(t.name || t.teamName || teamId);

    let image = String(t.image || t.img || '');
    if (image.startsWith('assets/')) image = 'cpu/' + image.slice('assets/'.length);
    if (!image && !forcePlayer) image = CPU_IMG_BASE + teamId + '.png';

    return { isPlayer: !!forcePlayer || !!t.isPlayer, teamId, name, image };
  }

  function pickUnique(arr, n){
    const a = (arr || []).slice();
    for (let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      const tmp=a[i]; a[i]=a[j]; a[j]=tmp;
    }
    return a.slice(0, Math.max(0,n));
  }

  // ---------------------------------------------------------
  // POINT TABLE（ユーザー確定）
  // ---------------------------------------------------------
  function getPlacementPoint(place){
    const p = Number(place)||999;
    if (p === 1) return 12;
    if (p === 2) return 8;
    if (p === 3) return 6;
    if (p === 4) return 5;
    if (p === 5) return 4;
    if (p === 6) return 3;
    if (p === 7) return 2;
    if (p >= 8 && p <= 10) return 1;
    return 0;
  }

  // ---------------------------------------------------------
  // RNG (seeded)
  // ---------------------------------------------------------
  function rand01(st){
    let x = (st.seed >>> 0) ^ ((st.rngI + 1) * 0x9e3779b9);
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17; x >>>= 0;
    x ^= x << 5;  x >>>= 0;
    st.rngI = (st.rngI + 1) >>> 0;
    return (x >>> 0) / 4294967296;
  }
  function randInt(st, min, max){
    const a = Number(min)||0;
    const b = Number(max)||0;
    if (b <= a) return a;
    return a + Math.floor(rand01(st) * (b - a + 1));
  }

  function weightedOrder(teams, st, weightFn){
    const pool = teams.slice();
    const out = [];
    while (pool.length){
      let sum = 0;
      const ws = pool.map(t=>{
        const w = Math.max(0.0001, Number(weightFn(t)) || 1);
        sum += w;
        return w;
      });
      let r = rand01(st) * sum;
      let pick = 0;
      for (; pick < pool.length; pick++){
        r -= ws[pick];
        if (r <= 0) break;
      }
      out.push(pool.splice(Math.min(pick, pool.length-1),1)[0]);
    }
    return out;
  }

  // ---------------------------------------------------------
  // CARD BONUS（ui_team.js と同じ考え方：あれば%を算出）
  // ---------------------------------------------------------
  function getOwnedCardsMap(){
    try{ return JSON.parse(localStorage.getItem('mobbr_cards')) || {}; }catch{ return {}; }
  }

  function calcCollectionBonusPercent(){
    const DC = window.MOBBR?.data?.cards;
    if (!DC || !DC.getById || !DC.calcSingleCardPercent) return 0;

    const owned = getOwnedCardsMap();
    let sum = 0;

    for (const id in owned){
      const cnt = Number(owned[id]) || 0;
      if (cnt <= 0) continue;

      const card = DC.getById(id);
      if (!card) continue;

      const effCnt = Math.max(0, Math.min(10, cnt));
      sum += DC.calcSingleCardPercent(card.rarity, effCnt);
    }

    return Number.isFinite(sum) ? Math.max(0, sum) : 0;
  }

  // ---------------------------------------------------------
  // COACH STORAGE
  // ---------------------------------------------------------
  function readCoachOwned(){
    try{
      const obj = JSON.parse(localStorage.getItem(COACH_OWNED_KEY) || '{}');
      return (obj && typeof obj === 'object') ? obj : {};
    }catch{
      return {};
    }
  }
  function writeCoachOwned(obj){
    localStorage.setItem(COACH_OWNED_KEY, JSON.stringify(obj || {}));
  }
  function readCoachEquipped(){
    try{
      const arr = JSON.parse(localStorage.getItem(COACH_EQUIP_KEY) || '[]');
      if (!Array.isArray(arr)) return [null,null,null];
      const out = [arr[0] ?? null, arr[1] ?? null, arr[2] ?? null].slice(0,3);
      return out.map(v => (typeof v === 'string' && v.trim()) ? v : null);
    }catch{
      return [null,null,null];
    }
  }
  function writeCoachEquipped(arr){
    const out = Array.isArray(arr) ? arr.slice(0,3) : [null,null,null];
    const norm = out.map(v => (typeof v === 'string' && v.trim()) ? v : null);
    while (norm.length < 3) norm.push(null);
    localStorage.setItem(COACH_EQUIP_KEY, JSON.stringify(norm));
  }

  // ---------------------------------------------------------
  // COACH SELECT MODAL（confirm()禁止なので自前UI）
  // ---------------------------------------------------------
  let coachModal = null;

  function ensureCoachModal(){
    if (coachModal) return;

    const wrap = document.createElement('div');
    wrap.id = 'mobbrCoachSelectModal';
    wrap.style.position = 'fixed';
    wrap.style.inset = '0';
    wrap.style.zIndex = '99998';
    wrap.style.display = 'none';
    wrap.style.alignItems = 'center';
    wrap.style.justifyContent = 'center';
    wrap.style.background = 'rgba(0,0,0,.60)';
    wrap.style.padding = '12px';
    wrap.style.boxSizing = 'border-box';

    const card = document.createElement('div');
    card.style.width = 'min(560px, 96vw)';
    card.style.maxHeight = 'min(86vh, 860px)';
    card.style.background = 'rgba(15,18,24,.96)';
    card.style.border = '1px solid rgba(255,255,255,.12)';
    card.style.borderRadius = '16px';
    card.style.overflow = 'hidden';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';

    const head = document.createElement('div');
    head.style.padding = '12px 12px 10px';
    head.style.borderBottom = '1px solid rgba(255,255,255,.10)';

    const title = document.createElement('div');
    title.style.fontWeight = '900';
    title.style.letterSpacing = '.06em';
    title.style.fontSize = '14px';
    title.style.color = '#fff';
    title.textContent = '試合前：コーチスキルを使う？';

    const sub = document.createElement('div');
    sub.id = 'mobbrCoachSelectSub';
    sub.style.marginTop = '6px';
    sub.style.fontSize = '12px';
    sub.style.color = 'rgba(255,255,255,.82)';
    sub.style.lineHeight = '1.25';
    sub.textContent = '';

    head.appendChild(title);
    head.appendChild(sub);

    const list = document.createElement('div');
    list.id = 'mobbrCoachSelectList';
    list.style.padding = '10px';
    list.style.overflow = 'auto';
    list.style.webkitOverflowScrolling = 'touch';
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '10px';

    const foot = document.createElement('div');
    foot.style.padding = '10px';
    foot.style.borderTop = '1px solid rgba(255,255,255,.10)';
    foot.style.display = 'flex';
    foot.style.gap = '10px';

    const btnSkip = document.createElement('button');
    btnSkip.type = 'button';
    btnSkip.id = 'mobbrCoachSelectSkip';
    btnSkip.textContent = '使わない';
    btnSkip.style.flex = '1';
    btnSkip.style.padding = '10px';
    btnSkip.style.borderRadius = '12px';
    btnSkip.style.border = '1px solid rgba(255,255,255,.18)';
    btnSkip.style.background = 'rgba(255,255,255,.06)';
    btnSkip.style.color = '#fff';
    btnSkip.style.fontWeight = '900';

    foot.appendChild(btnSkip);

    card.appendChild(head);
    card.appendChild(list);
    card.appendChild(foot);
    wrap.appendChild(card);
    document.body.appendChild(wrap);

    coachModal = { wrap, sub, list, btnSkip };
  }

  function renderCoachModal(usableSkills, matchNo, onPick){
    if (!coachModal) return;

    coachModal.sub.textContent = `第${matchNo}試合：使用すると所持品から消耗します`;
    coachModal.list.innerHTML = '';

    // owned数も表示
    const owned = readCoachOwned();

    usableSkills.forEach(sk=>{
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.style.width = '100%';
      btn.style.textAlign = 'left';
      btn.style.padding = '10px 10px';
      btn.style.borderRadius = '12px';
      btn.style.border = '1px solid rgba(255,255,255,.14)';
      btn.style.background = 'rgba(255,255,255,.10)';
      btn.style.color = '#fff';
      btn.style.fontWeight = '900';
      btn.style.touchAction = 'manipulation';

      const top = document.createElement('div');
      top.style.display = 'flex';
      top.style.justifyContent = 'space-between';
      top.style.gap = '10px';
      top.style.alignItems = 'baseline';

      const left = document.createElement('div');
      left.textContent = sk.name;
      left.style.fontSize = '14px';

      const right = document.createElement('div');
      right.textContent = `所持：${Number(owned[sk.id])||0}`;
      right.style.fontSize = '12px';
      right.style.opacity = '0.92';

      top.appendChild(left);
      top.appendChild(right);

      const eff = document.createElement('div');
      eff.style.marginTop = '6px';
      eff.style.fontSize = '12px';
      eff.style.opacity = '0.90';
      eff.textContent =
        (sk.powerPct ? `総合戦闘力 +${sk.powerPct}%` : '') +
        (sk.treasurePlus ? ` / 宝率+` : '') +
        (sk.flagPlus ? ` / 旗率+` : '');

      btn.appendChild(top);
      btn.appendChild(eff);

      btn.addEventListener('click', ()=>{
        onPick(sk.id);
      });

      coachModal.list.appendChild(btn);
    });

    coachModal.btnSkip.onclick = ()=>{
      onPick(null);
    };

    coachModal.wrap.style.display = 'flex';
  }

  function closeCoachModal(){
    if (!coachModal) return;
    coachModal.wrap.style.display = 'none';
  }

  // ---------------------------------------------------------
  // UI announce helper
  // ---------------------------------------------------------
  function announce(text){
    const ui = window.MOBBR?.ui;
    if (ui && typeof ui.showMessage === 'function'){
      ui.showMessage(text);
    }else{
      console.log('[ANNOUNCE]', text);
    }
  }

  // ---------------------------------------------------------
  // STORAGE
  // ---------------------------------------------------------
  function readState(){
    try{
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : null;
    }catch{
      return null;
    }
  }
  function writeState(st){
    try{
      localStorage.setItem(LS_KEY, JSON.stringify(st));
    }catch{}
  }

})();
