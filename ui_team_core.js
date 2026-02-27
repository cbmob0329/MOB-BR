'use strict';

/*
  MOB BR - ui_team_core.js v18-split（FULL）
  - 元 ui_team.js を安全に分割運用
  - core：DOM/名前/TeamPower/移行/描画/open-close/セーブ
  - training：ui_team_training.js 側へ（育成UI/ログ/成長/パッシブ強化）

  v18 追加：
  - ✅「メンバー名タップ → パッシブ強化ポップアップ」を優先
    - training側に openPassivePopup(memberId) があればそれを呼ぶ
    - 無ければ従来通り「名前変更prompt」へフォールバック（互換）
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){
  const $ = (id) => document.getElementById(id);

  const S  = window.MOBBR?.storage;
  const DP = window.MOBBR?.data?.player;
  const DC = window.MOBBR?.data?.cards;

  if (!S || !S.KEYS){
    console.warn('[ui_team_core] storage.js not found');
    return;
  }
  if (!DP){
    console.warn('[ui_team_core] data_player.js not found');
    return;
  }

  const K = S.KEYS;

  // ===== DOM =====
  const dom = {
    teamScreen: $('teamScreen'),
    btnCloseTeam: $('btnCloseTeam'),

    tCompany: $('tCompany'),
    tTeam: $('tTeam'),

    tNameA: $('tNameA'),
    tNameB: $('tNameB'),
    tNameC: $('tNameC'),

    tTeamPower: $('tTeamPower'),
    tTeamPowerRow: $('tTeamPowerRow'),
    tTeamPowerWrap: $('tTeamPowerWrap'),

    tA_hp: $('tA_hp'),
    tA_mental: $('tA_mental'),
    tA_aim: $('tA_aim'),
    tA_agi: $('tA_agi'),
    tA_tech: $('tA_tech'),
    tA_support: $('tA_support'),
    tA_scan: $('tA_scan'),
    tA_passive: $('tA_passive'),
    tA_ult: $('tA_ult'),

    tB_hp: $('tB_hp'),
    tB_mental: $('tB_mental'),
    tB_aim: $('tB_aim'),
    tB_agi: $('tB_agi'),
    tB_tech: $('tB_tech'),
    tB_support: $('tB_support'),
    tB_scan: $('tB_scan'),
    tB_passive: $('tB_passive'),
    tB_ult: $('tB_ult'),

    tC_hp: $('tC_hp'),
    tC_mental: $('tC_mental'),
    tC_aim: $('tC_aim'),
    tC_agi: $('tC_agi'),
    tC_tech: $('tC_tech'),
    tC_support: $('tC_support'),
    tC_scan: $('tC_scan'),
    tC_passive: $('tC_passive'),
    tC_ult: $('tC_ult'),

    btnManualSave: $('btnManualSave'),
    btnDeleteSave: $('btnDeleteSave')
  };

  // ===== utils =====
  function safeText(el, text){
    if (!el) return;
    el.textContent = String(text ?? '');
  }

  function clamp(n, min, max){
    const v = Number(n);
    if (!Number.isFinite(v)) return min;
    return Math.max(min, Math.min(max, v));
  }
  function clamp01to100(n){ return clamp(n, 0, 100); }
  function clamp1to100(n){ return clamp(n, 1, 100); }
  function clamp0to99(n){ return clamp(n, 0, 99); }
  function clamp0to30(n){ return clamp(n, 0, 30); }
  function clamp0(n){ return Math.max(0, Number.isFinite(Number(n)) ? Number(n) : 0); }

  function getNameA(){ return S.getStr(K.m1, 'A'); }
  function getNameB(){ return S.getStr(K.m2, 'B'); }
  function getNameC(){ return S.getStr(K.m3, 'C'); }

  function setNameA(v){ S.setStr(K.m1, v); }
  function setNameB(v){ S.setStr(K.m2, v); }
  function setNameC(v){ S.setStr(K.m3, v); }

  // 4ステ版でもUIが壊れないように安全化（agi/support/scan/armor などは 0 or 100で補完）
  function normalizeStats(stats){
    // data_player.js に normalizeStats がある場合はそれを優先
    if (DP && typeof DP.normalizeStats === 'function'){
      try{
        return DP.normalizeStats(stats);
      }catch(e){}
    }

    const s = stats && typeof stats === 'object' ? stats : {};
    return {
      hp: clamp0to99(s.hp ?? 0),
      aim: clamp0to99(s.aim ?? 0),
      tech: clamp0to99(s.tech ?? 0),
      mental: clamp0to99(s.mental ?? 0),

      // 旧UI互換（表示用）
      agi: clamp0to99(s.agi ?? 0),
      support: clamp0to99(s.support ?? 0),
      scan: clamp0to99(s.scan ?? 0),
      armor: clamp01to100(Number.isFinite(Number(s.armor)) ? s.armor : 100)
    };
  }

  function getPlayerTeam(){
    try{
      const raw = localStorage.getItem(K.playerTeam);
      if (raw){
        const t = JSON.parse(raw);
        if (t && Array.isArray(t.members)) return t;
      }
    }catch(e){}
    return DP.buildDefaultTeam();
  }

  function writePlayerTeam(team){
    try{
      localStorage.setItem(K.playerTeam, JSON.stringify(team));
    }catch(e){}
  }

  function clone(obj){
    return JSON.parse(JSON.stringify(obj));
  }

  // ===== reflect names everywhere =====
  function reflectNamesEverywhere(){
    safeText(dom.tNameA, getNameA());
    safeText(dom.tNameB, getNameB());
    safeText(dom.tNameC, getNameC());

    const uiM1 = $('uiM1');
    const uiM2 = $('uiM2');
    const uiM3 = $('uiM3');
    if (uiM1) uiM1.textContent = getNameA();
    if (uiM2) uiM2.textContent = getNameB();
    if (uiM3) uiM3.textContent = getNameC();
  }

  // =========================================================
  // ✅ポイント統一（唯一の正）：points {muscle, tech, mental}
  // ✅旧セーブ互換：trainPts / spirit
  // ※ training 側が points を使わない構成でも、ここは互換として保持
  // =========================================================
  function ensurePoints(mem){
    if (!mem || typeof mem !== 'object') return;

    if (!mem.points || typeof mem.points !== 'object'){
      mem.points = { muscle:0, tech:0, mental:0 };
    }
    if (!Number.isFinite(Number(mem.points.muscle))) mem.points.muscle = 0;
    if (!Number.isFinite(Number(mem.points.tech))) mem.points.tech = 0;
    if (!Number.isFinite(Number(mem.points.mental))) mem.points.mental = 0;

    // old trainPts -> points
    if (mem.trainPts && typeof mem.trainPts === 'object'){
      const tm = Number(mem.trainPts.muscle ?? 0);
      const tt = Number(mem.trainPts.tech ?? 0);
      const ts = Number(mem.trainPts.spirit ?? 0);
      const tme = Number(mem.trainPts.mental ?? 0);

      mem.points.muscle = clamp0(mem.points.muscle + (Number.isFinite(tm)?tm:0));
      mem.points.tech   = clamp0(mem.points.tech   + (Number.isFinite(tt)?tt:0));

      const addMental = (Number.isFinite(tme)?tme:0) + (Number.isFinite(ts)?ts:0);
      mem.points.mental = clamp0(mem.points.mental + addMental);

      try{ delete mem.trainPts; }catch(e){}
    }

    // old spirit -> mental
    if (Number.isFinite(Number(mem.spirit))){
      mem.points.mental = clamp0(mem.points.mental + Number(mem.spirit));
      try{ delete mem.spirit; }catch(e){}
    }

    mem.points.muscle = clamp0(mem.points.muscle);
    mem.points.tech   = clamp0(mem.points.tech);
    mem.points.mental = clamp0(mem.points.mental);
  }

  function ensureMemberMeta(mem){
    if (!mem) return;

    ensurePoints(mem);

    // upgradeCount（累計）
    if (!mem.upgradeCount || typeof mem.upgradeCount !== 'object'){
      mem.upgradeCount = { hp:0, aim:0, tech:0, mental:0 };
    }
    for (const s of ['hp','aim','tech','mental']){
      mem.upgradeCount[s] = clamp(Number(mem.upgradeCount[s] ?? 0), 0, 999999);
    }

    // skills（+強化）… training側が passives を運用しても、ここは壊さない
    if (!mem.skills || typeof mem.skills !== 'object'){
      mem.skills = {};
    }
    for (const sid in mem.skills){
      const ent = mem.skills[sid];
      if (!ent || typeof ent !== 'object'){
        mem.skills[sid] = { plus:0 };
        continue;
      }
      ent.plus = clamp0to30(ent.plus);
    }
  }

  function ensureTeamMeta(team){
    if (!team || !Array.isArray(team.members)) return;
    team.members.forEach(ensureMemberMeta);
  }

  function migrateAndPersistTeam(){
    const team = getPlayerTeam();
    ensureTeamMeta(team);
    writePlayerTeam(team);
    return team;
  }

  function getMemberNameById(id){
    if (id === 'A') return getNameA();
    if (id === 'B') return getNameB();
    if (id === 'C') return getNameC();
    return String(id || '');
  }

  function getMemberRole(mem){
    return String(mem?.role || '');
  }

  // ===== Team Power (base + cards) =====
  const WEIGHT = {
    aim: 0.25,
    mental: 0.15,
    agi: 0.10,
    tech: 0.10,
    support: 0.10,
    scan: 0.10,
    armor: 0.10,
    hp: 0.10
  };

  function calcCharBasePower(stats){
    const s = normalizeStats(stats);

    const hp      = clamp01to100(s.hp);
    const mental  = clamp01to100(s.mental);
    const aim     = clamp01to100(s.aim);
    const agi     = clamp01to100(s.agi);
    const tech    = clamp01to100(s.tech);
    const support = clamp01to100(s.support);
    const scan    = clamp01to100(s.scan);
    const armor   = clamp01to100(s.armor);

    let total = 0;
    total += aim * WEIGHT.aim;
    total += mental * WEIGHT.mental;
    total += agi * WEIGHT.agi;
    total += tech * WEIGHT.tech;
    total += support * WEIGHT.support;
    total += scan * WEIGHT.scan;
    total += armor * WEIGHT.armor;
    total += hp * WEIGHT.hp;

    return Math.max(0, Math.min(100, total));
  }

  function calcTeamBasePercent(team){
    const members = Array.isArray(team?.members) ? team.members : [];
    if (members.length === 0) return 0;
    const vals = members.slice(0,3).map(m => calcCharBasePower(m?.stats || {}));
    const avg = vals.reduce((a,b)=>a+b,0) / vals.length;
    return Math.round(avg + 3);
  }

  function getOwnedCardsMap(){
    try{
      return JSON.parse(localStorage.getItem('mobbr_cards')) || {};
    }catch{
      return {};
    }
  }

  function calcCollectionBonusPercent(){
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

    if (!Number.isFinite(sum)) return 0;
    return Math.max(0, sum);
  }

  function ensureCardPowerUI(){
    const baseEl = dom.tTeamPower;
    const rowEl = dom.tTeamPowerRow || dom.tTeamPowerWrap || (baseEl ? baseEl.parentElement : null);
    if (!rowEl) return { baseEl: null, cardEl: null, labelEl: null };

    const existingCard = rowEl.querySelector?.('.teamPowerCard');
    const existingLabel = rowEl.querySelector?.('.teamPowerCardLabel');
    if (existingCard && existingLabel) return { baseEl, cardEl: existingCard, labelEl: existingLabel };

    const cardEl = document.createElement('span');
    cardEl.className = 'teamPowerCard';
    cardEl.style.marginLeft = '8px';
    cardEl.style.color = '#ff3b30';
    cardEl.style.fontWeight = '1000';
    cardEl.style.whiteSpace = 'nowrap';

    const labelEl = document.createElement('span');
    labelEl.className = 'teamPowerCardLabel';
    labelEl.textContent = 'カード効果！';
    labelEl.style.marginLeft = '6px';
    labelEl.style.fontSize = '12px';
    labelEl.style.opacity = '0.95';
    labelEl.style.color = '#ff3b30';
    labelEl.style.whiteSpace = 'nowrap';

    if (baseEl && baseEl.parentElement === rowEl){
      if (baseEl.nextSibling){
        rowEl.insertBefore(cardEl, baseEl.nextSibling);
      }else{
        rowEl.appendChild(cardEl);
      }
      rowEl.appendChild(labelEl);
    }else{
      rowEl.appendChild(cardEl);
      rowEl.appendChild(labelEl);
    }

    return { baseEl, cardEl, labelEl };
  }

  function calcTeamPower(){
    const team = getPlayerTeam();
    const base = calcTeamBasePercent(team);
    const bonus = calcCollectionBonusPercent();
    const total = base + bonus;
    const totalInt = Math.round(total);
    return clamp1to100(totalInt);
  }

  function persistTeamPower(teamPowerInt){
    try{
      const raw = localStorage.getItem(K.playerTeam);
      if (!raw) return;
      const t = JSON.parse(raw);
      if (!t || typeof t !== 'object') return;

      t.teamPower = clamp1to100(teamPowerInt);
      localStorage.setItem(K.playerTeam, JSON.stringify(t));
    }catch(e){}
  }

  function renderTeamPower(){
    const team = getPlayerTeam();
    const base = calcTeamBasePercent(team);

    if (dom.tTeamPower){
      dom.tTeamPower.textContent = `${base}%`;
    }

    const ui = ensureCardPowerUI();
    const bonus = calcCollectionBonusPercent();
    const total = base + bonus;

    if (ui.cardEl){
      ui.cardEl.textContent = `${total.toFixed(2)}%`;
    }

    const totalInt = clamp1to100(Math.round(total));
    persistTeamPower(totalInt);
  }

  // ===== main render =====
  function render(){
    safeText(dom.tCompany, S.getStr(K.company, 'CB Memory'));
    safeText(dom.tTeam, S.getStr(K.team, 'PLAYER TEAM'));

    const team = migrateAndPersistTeam();
    const byId = {};
    for (const m of (team.members || [])) byId[m.id] = m;

    const A = byId.A;
    if (A){
      const st = normalizeStats(A.stats);
      safeText(dom.tA_hp, st.hp);
      safeText(dom.tA_mental, st.mental);
      safeText(dom.tA_aim, st.aim);
      safeText(dom.tA_agi, st.agi);
      safeText(dom.tA_tech, st.tech);
      safeText(dom.tA_support, st.support);
      safeText(dom.tA_scan, st.scan);
      safeText(dom.tA_passive, A.passive || '未定');
      safeText(dom.tA_ult, A.ult || '未定');
    }

    const B = byId.B;
    if (B){
      const st = normalizeStats(B.stats);
      safeText(dom.tB_hp, st.hp);
      safeText(dom.tB_mental, st.mental);
      safeText(dom.tB_aim, st.aim);
      safeText(dom.tB_agi, st.agi);
      safeText(dom.tB_tech, st.tech);
      safeText(dom.tB_support, st.support);
      safeText(dom.tB_scan, st.scan);
      safeText(dom.tB_passive, B.passive || '未定');
      safeText(dom.tB_ult, B.ult || '未定');
    }

    const C = byId.C;
    if (C){
      const st = normalizeStats(C.stats);
      safeText(dom.tC_hp, st.hp);
      safeText(dom.tC_mental, st.mental);
      safeText(dom.tC_aim, st.aim);
      safeText(dom.tC_agi, st.agi);
      safeText(dom.tC_tech, st.tech);
      safeText(dom.tC_support, st.support);
      safeText(dom.tC_scan, st.scan);
      safeText(dom.tC_passive, C.passive || '未定');
      safeText(dom.tC_ult, C.ult || '未定');
    }

    reflectNamesEverywhere();
    renderTeamPower();

    // training側へ描画依頼（存在すれば）
    if (window.MOBBR?.uiTeamTraining?.render){
      try{ window.MOBBR.uiTeamTraining.render(); }catch(e){}
    }
  }

  function open(){
    if (!dom.teamScreen) return;
    dom.teamScreen.classList.add('show');
    dom.teamScreen.setAttribute('aria-hidden', 'false');
    render();
  }

  function close(){
    if (!dom.teamScreen) return;
    dom.teamScreen.classList.remove('show');
    dom.teamScreen.setAttribute('aria-hidden', 'true');
  }

  // =========================================================
  // メンバー名タップ挙動
  // 1) training側が openPassivePopup(memberId) を持っていればそれを呼ぶ
  // 2) 無ければ従来：prompt で名前変更
  // =========================================================
  function openPassivePopupIfAvailable(memberId){
    const tr = window.MOBBR?.uiTeamTraining;
    const fn = tr?.openPassivePopup;
    if (typeof fn === 'function'){
      try{
        fn(String(memberId));
        return true;
      }catch(e){
        return false;
      }
    }
    return false;
  }

  function promptRename(memberId){
    const cur =
      (memberId === 'A') ? getNameA() :
      (memberId === 'B') ? getNameB() :
      (memberId === 'C') ? getNameC() : String(memberId);

    const v = prompt(`メンバー名（${memberId}）を変更`, cur);
    if (v === null) return;
    const nv = v.trim();
    if (!nv) return;

    if (memberId === 'A') setNameA(nv);
    if (memberId === 'B') setNameB(nv);
    if (memberId === 'C') setNameC(nv);

    try{
      const raw = localStorage.getItem(K.playerTeam);
      if (raw){
        const t = JSON.parse(raw);
        if (t && Array.isArray(t.members)){
          const m = t.members.find(x=>x.id===memberId);
          if (m) m.name = nv;
          localStorage.setItem(K.playerTeam, JSON.stringify(t));
        }
      }
    }catch(e){}

    reflectNamesEverywhere();
    if (window.MOBBR?.uiTeamTraining?.render){
      try{ window.MOBBR.uiTeamTraining.render(); }catch(e){}
    }
  }

  let nameTapBound = false;
  function bindNameTap(){
    if (nameTapBound) return;
    nameTapBound = true;

    const bindOne = (el, id)=>{
      if (!el) return;
      el.style.cursor = 'pointer';
      el.style.touchAction = 'manipulation';
      el.addEventListener('click', ()=>{
        // まず「パッシブポップアップ」
        const opened = openPassivePopupIfAvailable(id);
        if (!opened){
          // training未実装の時だけ従来 rename
          promptRename(id);
        }
      });
    };

    bindOne(dom.tNameA, 'A');
    bindOne(dom.tNameB, 'B');
    bindOne(dom.tNameC, 'C');
  }

  // ===== save =====
  function manualSave(){
    const snap = {
      ver: 'v18-split',
      ts: Date.now(),
      company: S.getStr(K.company, 'CB Memory'),
      team: S.getStr(K.team, 'PLAYER TEAM'),
      m1: getNameA(),
      m2: getNameB(),
      m3: getNameC(),
      year: S.getNum(K.year, 1989),
      month: S.getNum(K.month, 1),
      week: S.getNum(K.week, 1),
      gold: S.getNum(K.gold, 0),
      rank: S.getNum(K.rank, 10),
      nextTour: S.getStr(K.nextTour, '未定'),
      nextTourW: S.getStr(K.nextTourW, '未定'),
      recent: S.getStr(K.recent, '未定')
    };

    localStorage.setItem('mobbr_save1', JSON.stringify(snap));
    alert('セーブしました。');
  }

  function closeAllOverlays(){
    const idsHideDisplay = [
      'membersPop',
      'weekPop',
      'trainingResultPop',
      'trainingWeekPop',
      'cardPreview',
      'trainingLockPop',
      'mobbrTrainingPopup' // training側の全画面ポップ
    ];

    const idsRemoveShow = [
      'teamScreen',
      'trainingScreen',
      'shopScreen',
      'cardScreen',
      'scheduleScreen'
    ];

    const back = $('modalBack');
    if (back){
      back.style.display = 'none';
      back.style.pointerEvents = 'none';
      back.setAttribute('aria-hidden', 'true');
    }

    idsHideDisplay.forEach(id=>{
      const el = $(id);
      if (el){
        // mobbrTrainingPopup は display管理じゃなく remove の方が安全
        if (id === 'mobbrTrainingPopup'){
          try{ el.remove(); }catch(e){}
          return;
        }
        el.style.display = 'none';
        el.setAttribute('aria-hidden', 'true');
      }
    });

    idsRemoveShow.forEach(id=>{
      const el = $(id);
      if (el){
        el.classList.remove('show');
        el.setAttribute('aria-hidden', 'true');
      }
    });

    const shopResult = $('shopResult');
    if (shopResult) shopResult.style.display = 'none';

    const trainingResultSection = $('trainingResultSection');
    if (trainingResultSection) trainingResultSection.style.display = 'none';
  }

  function deleteSaveAndReset(){
    if (!confirm('セーブ削除すると、スケジュール／名前／戦績／持ち物／育成など全てリセットされます。\n本当に実行しますか？')) return;

    closeAllOverlays();

    if (window.MOBBR?.storage?.resetAll){
      window.MOBBR.storage.resetAll();
    }else{
      localStorage.clear();
      location.reload();
    }
  }

  let saveBound = false;
  function bindSave(){
    if (saveBound) return;
    saveBound = true;

    if (dom.btnManualSave){
      dom.btnManualSave.addEventListener('click', manualSave);
    }
    if (dom.btnDeleteSave){
      dom.btnDeleteSave.addEventListener('click', deleteSaveAndReset);
    }
  }

  let closeBound = false;
  function bindClose(){
    if (closeBound) return;
    closeBound = true;

    if (dom.btnCloseTeam){
      dom.btnCloseTeam.addEventListener('click', close);
    }
  }

  // ===== core API（training側が参照）=====
  const coreApi = {
    $,
    dom,
    S,
    DP,
    DC,
    K,

    clamp,
    clamp01to100,
    clamp1to100,
    clamp0to99,
    clamp0to30,
    clamp0,

    clone,
    normalizeStats,

    getPlayerTeam,
    writePlayerTeam,
    migrateAndPersistTeam,
    ensureTeamMeta,
    ensureMemberMeta,
    ensurePoints,

    getMemberNameById,
    getMemberRole,

    renderTeamPower,
    calcTeamPower,

    render,
    open,
    close,

    showMsg: null // training側が差し込む
  };

  // training側へ coreApi を渡す（読み込み順が逆でも後でattachできるように両対応）
  function attachTrainingIfReady(){
    if (window.MOBBR?.uiTeamTraining?.attach){
      try{ window.MOBBR.uiTeamTraining.attach(coreApi); }catch(e){}
    }
  }

  function initTeamUI(){
    bindClose();
    bindNameTap(); // ← v18：ここがrenameではなく“タップ統合”
    bindSave();

    migrateAndPersistTeam();
    attachTrainingIfReady();
    render();
  }

  // 外部公開
  window.MOBBR.initTeamUI = initTeamUI;
  window.MOBBR.ui.team = { open, close, render, calcTeamPower };

  // training側が後からロードされても attach できるようにフック
  window.MOBBR._uiTeamCore = coreApi;

  document.addEventListener('DOMContentLoaded', ()=>{
    initTeamUI();
  });

})();
