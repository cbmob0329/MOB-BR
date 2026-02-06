'use strict';

/*
  MOB BR - ui_team.js v14（フル）

  目的：
  - #teamScreen（固定HTML）を動かす
  - 参照元を「DP.buildDefaultTeam()」ではなく
    localStorage の mobbr_playerTeam（storage.KEYS.playerTeam）に統一
    → 育成で更新された exp/lv がチーム画面に必ず反映される

  仕様（現段階での安全実装）：
  - playerTeam が無い/壊れている場合は default を生成して保存してから表示（壊れにくい）
  - 表示ステータスは「基礎stats + (Lv-1)」で成長が見える形にする（簡易）
    ※今後、仕様が固まったら計算式は差し替え可能
  - 名前変更は storage(m1/m2/m3) を更新し、playerTeam.members[].name にも同期
  - セーブ：スナップショット保存（mobbr_save1）
  - セーブ削除：storage.resetAll() → タイトルへ戻る（既存仕様）
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){
  const $ = (id) => document.getElementById(id);

  const S  = window.MOBBR?.storage;
  const DP = window.MOBBR?.data?.player;

  if (!S || !S.KEYS){
    console.warn('[ui_team] storage.js not found');
    return;
  }
  if (!DP){
    console.warn('[ui_team] data_player.js not found');
    return;
  }

  const K = S.KEYS;

  // ===== DOM =====
  const dom = {
    // open/close
    btnTeam: $('btnTeam'),
    teamScreen: $('teamScreen'),
    btnCloseTeam: $('btnCloseTeam'),

    // meta
    tCompany: $('tCompany'),
    tTeam: $('tTeam'),

    // names (buttons)
    tNameA: $('tNameA'),
    tNameB: $('tNameB'),
    tNameC: $('tNameC'),

    // stats A
    tA_hp: $('tA_hp'),
    tA_mental: $('tA_mental'),
    tA_aim: $('tA_aim'),
    tA_agi: $('tA_agi'),
    tA_tech: $('tA_tech'),
    tA_support: $('tA_support'),
    tA_scan: $('tA_scan'),
    tA_passive: $('tA_passive'),
    tA_ult: $('tA_ult'),

    // stats B
    tB_hp: $('tB_hp'),
    tB_mental: $('tB_mental'),
    tB_aim: $('tB_aim'),
    tB_agi: $('tB_agi'),
    tB_tech: $('tB_tech'),
    tB_support: $('tB_support'),
    tB_scan: $('tB_scan'),
    tB_passive: $('tB_passive'),
    tB_ult: $('tB_ult'),

    // stats C
    tC_hp: $('tC_hp'),
    tC_mental: $('tC_mental'),
    tC_aim: $('tC_aim'),
    tC_agi: $('tC_agi'),
    tC_tech: $('tC_tech'),
    tC_support: $('tC_support'),
    tC_scan: $('tC_scan'),
    tC_passive: $('tC_passive'),
    tC_ult: $('tC_ult'),

    // save buttons（HTML固定）
    btnManualSave: $('btnManualSave'),
    btnDeleteSave: $('btnDeleteSave')
  };

  // ===== utils =====
  function safeText(el, text){
    if (!el) return;
    el.textContent = String(text ?? '');
  }

  function getNameA(){ return S.getStr(K.m1, 'A'); }
  function getNameB(){ return S.getStr(K.m2, 'B'); }
  function getNameC(){ return S.getStr(K.m3, 'C'); }
  function setNameA(v){ S.setStr(K.m1, v); }
  function setNameB(v){ S.setStr(K.m2, v); }
  function setNameC(v){ S.setStr(K.m3, v); }

  function loadPlayerTeamOrCreate(){
    let team;
    try{
      const raw = localStorage.getItem(K.playerTeam);
      team = raw ? JSON.parse(raw) : null;
    }catch{
      team = null;
    }

    const valid = team && Array.isArray(team.members);
    if (!valid){
      team = DP.buildDefaultTeam();
      // 初期名前を storage に寄せる
      try{
        const bySlot = [...team.members].sort((a,b)=> (a.slot||0)-(b.slot||0));
        if (bySlot[0]) bySlot[0].name = getNameA();
        if (bySlot[1]) bySlot[1].name = getNameB();
        if (bySlot[2]) bySlot[2].name = getNameC();
      }catch{}
      localStorage.setItem(K.playerTeam, JSON.stringify(team));
      return team;
    }

    // 正規化（不足があっても落とさない）
    try{
      team.members.forEach(m=>{
        m.stats = DP.normalizeStats(m.stats);
        m.exp   = DP.normalizeExp(m.exp);
        m.lv    = DP.normalizeLv(m.lv);
      });
    }catch{}

    return team;
  }

  function savePlayerTeam(team){
    try{
      localStorage.setItem(K.playerTeam, JSON.stringify(team));
    }catch(e){
      console.warn('[ui_team] failed to save playerTeam', e);
    }
  }

  // 表示用：基礎stats + (lv-1) で “成長” を見える化（簡易）
  function effectiveStats(member){
    const base = DP.normalizeStats(member?.stats);
    const lv   = DP.normalizeLv(member?.lv);
    const out = {};
    for (const k of DP.STAT_KEYS){
      const add = Math.max(0, (Number(lv[k]) || 1) - 1);
      out[k] = (Number(base[k]) || 0) + add;
    }
    return out;
  }

  function reflectNamesEverywhere(){
    // team screen
    safeText(dom.tNameA, getNameA());
    safeText(dom.tNameB, getNameB());
    safeText(dom.tNameC, getNameC());

    // main screen member popup（存在すれば）
    const uiM1 = $('uiM1');
    const uiM2 = $('uiM2');
    const uiM3 = $('uiM3');
    if (uiM1) uiM1.textContent = getNameA();
    if (uiM2) uiM2.textContent = getNameB();
    if (uiM3) uiM3.textContent = getNameC();
  }

  // ===== render =====
  function render(){
    // meta
    safeText(dom.tCompany, S.getStr(K.company, 'CB Memory'));
    safeText(dom.tTeam, S.getStr(K.team, 'PLAYER TEAM'));

    const team = loadPlayerTeamOrCreate();

    // members index（id優先 / 予備でslot）
    const byId = {};
    for (const m of team.members) byId[m.id] = m;

    const A = byId.A || team.members.find(x=>x.slot===1) || null;
    const B = byId.B || team.members.find(x=>x.slot===2) || null;
    const C = byId.C || team.members.find(x=>x.slot===3) || null;

    // storage名を playerTeam に同期（表示のブレ防止）
    try{
      if (A) A.name = getNameA();
      if (B) B.name = getNameB();
      if (C) C.name = getNameC();
      savePlayerTeam(team);
    }catch{}

    // A
    if (A){
      const st = effectiveStats(A);
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

    // B
    if (B){
      const st = effectiveStats(B);
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

    // C
    if (C){
      const st = effectiveStats(C);
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
  }

  // ===== open/close =====
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

  // ===== rename =====
  function syncPlayerTeamNamesFromStorage(){
    const team = loadPlayerTeamOrCreate();
    try{
      const bySlot = [...team.members].sort((a,b)=> (a.slot||0)-(b.slot||0));
      if (bySlot[0]) bySlot[0].name = getNameA();
      if (bySlot[1]) bySlot[1].name = getNameB();
      if (bySlot[2]) bySlot[2].name = getNameC();
      savePlayerTeam(team);
    }catch{}
  }

  function bindRename(){
    if (dom.tNameA){
      dom.tNameA.addEventListener('click', ()=>{
        const cur = getNameA();
        const v = prompt('メンバー名（A）を変更', cur);
        if (v === null) return;
        const nv = v.trim();
        if (!nv) return;
        setNameA(nv);
        syncPlayerTeamNamesFromStorage();
        render();
        if (window.MOBBR?.initMainUI) window.MOBBR.initMainUI();
      });
    }
    if (dom.tNameB){
      dom.tNameB.addEventListener('click', ()=>{
        const cur = getNameB();
        const v = prompt('メンバー名（B）を変更', cur);
        if (v === null) return;
        const nv = v.trim();
        if (!nv) return;
        setNameB(nv);
        syncPlayerTeamNamesFromStorage();
        render();
        if (window.MOBBR?.initMainUI) window.MOBBR.initMainUI();
      });
    }
    if (dom.tNameC){
      dom.tNameC.addEventListener('click', ()=>{
        const cur = getNameC();
        const v = prompt('メンバー名（C）を変更', cur);
        if (v === null) return;
        const nv = v.trim();
        if (!nv) return;
        setNameC(nv);
        syncPlayerTeamNamesFromStorage();
        render();
        if (window.MOBBR?.initMainUI) window.MOBBR.initMainUI();
      });
    }
  }

  // ===== save =====
  function manualSave(){
    const snap = {
      ver: 'v14',
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
      recent: S.getStr(K.recent, '未定'),
      playerTeam: (function(){
        try{ return JSON.parse(localStorage.getItem(K.playerTeam) || 'null'); }
        catch{ return null; }
      })()
    };

    localStorage.setItem('mobbr_save1', JSON.stringify(snap));
    alert('セーブしました。');
  }

  function deleteSaveAndReset(){
    if (!confirm('セーブ削除すると、スケジュール／名前／戦績／持ち物／育成など全てリセットされます。\n本当に実行しますか？')) return;

    if (window.MOBBR?.storage?.resetAll){
      window.MOBBR.storage.resetAll();
    }else{
      location.reload();
    }
  }

  function bindSave(){
    if (dom.btnManualSave) dom.btnManualSave.addEventListener('click', manualSave);
    if (dom.btnDeleteSave) dom.btnDeleteSave.addEventListener('click', deleteSaveAndReset);
  }

  function bindOpenClose(){
    // ui_main.js 側でも btnTeam を開くが、二重でも致命傷にならないようガード
    if (dom.btnTeam) dom.btnTeam.addEventListener('click', open);
    if (dom.btnCloseTeam) dom.btnCloseTeam.addEventListener('click', close);
  }

  // ===== init =====
  let inited = false;
  function initTeamUI(){
    if (inited) return;
    inited = true;

    bindOpenClose();
    bindRename();
    bindSave();

    // 開かなくても安全に1回描画（他UIから render() 呼ばれてもOK）
    render();
  }

  window.MOBBR.initTeamUI = initTeamUI;
  window.MOBBR.ui.team = { open, close, render };

  // 動的ロード（NEXT後）でも確実に動くように即実行
  initTeamUI();
})();
