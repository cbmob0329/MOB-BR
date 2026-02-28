'use strict';

/* =========================================================
   MOB BR - ui_team_core.js v19.4（FULL）
   - ✅ チーム画面 “コア” のみ（training注入はしない）
   - ✅ チーム画面でトレーニング/修行が出来ないようにする（無限強化根絶）
   - ✅ 表示ステータスは「体力 / エイム / 技術 / メンタル」だけ
   - ✅ メンバー名ボタンは作らない（TEAMで名前変更は別導線に統一）
   - ✅ 互換維持：
      - window.MOBBR._uiTeamCore を提供（旧参照の保険）
      - window.MOBBR.ui._teamCore を提供（app.js の CHECK 用）
      - window.MOBBR.initTeamUI() を提供
      - migrateAndPersistTeam / readPlayerTeam / writePlayerTeam / clone 等
   - ✅ v19.4 hotfix:
      - 「セーブ / セーブ削除」が押せない問題を修正（イベント未バインド対策）
      - btnManualSave / btnDeleteSave がDOMに存在する場合だけバインド
========================================================= */

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){
  const $ = (id) => document.getElementById(id);

  // =========================================================
  // storage keys（既存と衝突しない前提で “同じ” を使う）
  // =========================================================
  const KEY_PLAYER_TEAM = 'mobbr_playerTeam';

  // 互換：メイン等が使っている主要キー（スナップショット用）
  const K = {
    company: 'mobbr_company',
    team: 'mobbr_team',
    m1: 'mobbr_m1',
    m2: 'mobbr_m2',
    m3: 'mobbr_m3',
    gold: 'mobbr_gold',
    rank: 'mobbr_rank',
    year: 'mobbr_year',
    month: 'mobbr_month',
    week: 'mobbr_week',
    nextTour: 'mobbr_nextTour',
    nextTourW: 'mobbr_nextTourW',
    recent: 'mobbr_recent',
    tourState: 'mobbr_tour_state'
  };

  // 表示ステータス（要望：これ以外は表示しない）
  const STATS_SHOW = [
    { key:'hp',     label:'体力'   },
    { key:'aim',    label:'エイム' },
    { key:'tech',   label:'技術'   },
    { key:'mental', label:'メンタル' }
  ];

  // =========================================================
  // DOM
  // =========================================================
  const dom = {
    teamScreen: null,
    teamPanel: null,
    teamName: null,
    teamPower: null,
    membersWrap: null,

    // 互換のため保持（本モジュールでは使わない）
    membersPop: null,
    modalBack: null,

    // ✅ セーブ互換（DOMに存在するなら動かす）
    btnManualSave: null,
    btnDeleteSave: null
  };

  // =========================================================
  // util
  // =========================================================
  function safeJsonParse(s, fallback){
    try{ return JSON.parse(s); }catch(e){ return fallback; }
  }

  function clamp(n, min, max){
    const v = Number(n);
    if (!Number.isFinite(v)) return min;
    return Math.max(min, Math.min(max, v));
  }
  function clamp0to99(n){ return clamp(n, 0, 99); }

  function clone(obj){
    try{ return JSON.parse(JSON.stringify(obj)); }catch(e){ return obj; }
  }

  function getStorage(){
    return window.MOBBR && window.MOBBR.storage ? window.MOBBR.storage : null;
  }

  function getStr(key, def){
    const S = getStorage();
    if (S?.getStr) return S.getStr(key, def);
    const v = localStorage.getItem(key);
    return (v === null || v === undefined || v === '') ? def : v;
  }

  function getNum(key, def){
    const S = getStorage();
    if (S?.getNum) return S.getNum(key, def);
    const v = Number(localStorage.getItem(key));
    return Number.isFinite(v) ? v : def;
  }

  function readPlayerTeam(){
    const S = getStorage();
    if (S?.getJSON){
      return S.getJSON(KEY_PLAYER_TEAM, null);
    }
    const raw = localStorage.getItem(KEY_PLAYER_TEAM);
    if (!raw) return null;
    return safeJsonParse(raw, null);
  }

  function writePlayerTeam(team){
    const S = getStorage();
    if (S?.setJSON){
      S.setJSON(KEY_PLAYER_TEAM, team);
      return;
    }
    try{ localStorage.setItem(KEY_PLAYER_TEAM, JSON.stringify(team)); }catch(e){}
  }

  // =========================================================
  // team data migration（壊さず整える）
  // =========================================================
  function ensureMemberBase(mem, id, fallbackRole){
    if (!mem || typeof mem !== 'object') mem = {};
    mem.id = String(mem.id || id || 'A');

    // name
    if (typeof mem.name !== 'string' || !mem.name.trim()){
      // 既存仕様の「ピーチ」などがあるなら上書きしない
      mem.name = mem.id;
    }

    // role
    if (typeof mem.role !== 'string' || !mem.role.trim()){
      mem.role = fallbackRole || '';
    }

    // stats（表示は4つだけだが、既存が持っている他ステは “消さない”）
    mem.stats = (mem.stats && typeof mem.stats === 'object') ? mem.stats : {};
    for (const s of STATS_SHOW){
      if (!Number.isFinite(Number(mem.stats[s.key]))){
        // 初期値は既存の流れに合わせて 66 を推奨
        mem.stats[s.key] = 66;
      }else{
        mem.stats[s.key] = clamp0to99(mem.stats[s.key]);
      }
    }

    // 画像（あるなら維持、なければ空）
    if (typeof mem.img !== 'string') mem.img = '';

    return mem;
  }

  function migrateTeam(team){
    if (!team || typeof team !== 'object') team = {};

    // team name
    if (typeof team.teamName !== 'string') team.teamName = 'PLAYER TEAM';

    // members
    if (!Array.isArray(team.members)) team.members = [];

    // id で拾えるように整形
    const byId = {};
    team.members.forEach(m=>{
      const id = String(m?.id || '');
      if (!id) return;
      byId[id] = m;
    });

    // 必ず A/B/C を作る（既存がある場合は優先して保持）
    const rolesFallback = { A:'IGL', B:'アタッカー', C:'サポーター' };

    const A = ensureMemberBase(byId['A'] || team.members.find(x=>String(x?.id)==='A'), 'A', rolesFallback.A);
    const B = ensureMemberBase(byId['B'] || team.members.find(x=>String(x?.id)==='B'), 'B', rolesFallback.B);
    const C = ensureMemberBase(byId['C'] || team.members.find(x=>String(x?.id)==='C'), 'C', rolesFallback.C);

    // 既存の他メンバーは “消さない” が、表示はA/B/Cのみ（要望に合わせる）
    const rest = team.members.filter(m=>{
      const id = String(m?.id || '');
      return id !== 'A' && id !== 'B' && id !== 'C';
    });

    team.members = [A, B, C, ...rest];

    return team;
  }

  function migrateAndPersistTeam(){
    const team0 = readPlayerTeam();
    const team = migrateTeam(team0);
    writePlayerTeam(team);
    return team;
  }

  // =========================================================
  // team power（簡易：4ステ平均。既存powerがあるなら表示はそれ優先）
  // =========================================================
  function calcMemberPower(mem){
    const st = mem?.stats || {};
    let sum = 0;
    let cnt = 0;
    for (const s of STATS_SHOW){
      sum += clamp0to99(st[s.key] || 0);
      cnt += 1;
    }
    if (!cnt) return 0;
    return Math.round(sum / cnt);
  }

  function calcTeamPower(team){
    const ms = (team?.members || []).filter(m=>{
      const id = String(m?.id || '');
      return id === 'A' || id === 'B' || id === 'C';
    });
    if (!ms.length) return 0;

    // 既存仕様で team.power があれば、それを最優先で表示
    const p0 = Number(team?.power);
    if (Number.isFinite(p0) && p0 > 0) return Math.round(p0);

    let sum = 0;
    ms.forEach(m=>{ sum += calcMemberPower(m); });
    return Math.round(sum / ms.length);
  }

  // =========================================================
  // UI parts
  // =========================================================
  function buildTeamDomIfMissing(){
    dom.teamScreen = $('teamScreen') || $('team') || document.querySelector('.teamScreen') || null;
    dom.modalBack = $('modalBack') || document.querySelector('#modalBack') || null;
    dom.membersPop = $('membersPop') || document.querySelector('#membersPop') || null;

    // ✅ セーブボタン（HTMLに残っている場合の互換）
    dom.btnManualSave = $('btnManualSave') || null;
    dom.btnDeleteSave = $('btnDeleteSave') || null;

    if (!dom.teamScreen) return;

    dom.teamPanel =
      dom.teamScreen.querySelector('.teamPanel') ||
      dom.teamScreen;

    dom.teamName =
      dom.teamScreen.querySelector('#teamName') ||
      dom.teamScreen.querySelector('.teamName') ||
      null;

    dom.teamPower =
      dom.teamScreen.querySelector('#teamPower') ||
      dom.teamScreen.querySelector('.teamPower') ||
      null;

    dom.membersWrap =
      dom.teamScreen.querySelector('#teamMembers') ||
      dom.teamScreen.querySelector('.teamMembers') ||
      null;

    if (!dom.membersWrap){
      // 無ければ作る（壊さない範囲）
      const wrap = document.createElement('div');
      wrap.id = 'teamMembers';
      wrap.className = 'teamMembers';
      wrap.style.marginTop = '10px';
      wrap.style.display = 'grid';
      wrap.style.gridTemplateColumns = '1fr';
      wrap.style.gap = '10px';
      dom.teamPanel.appendChild(wrap);
      dom.membersWrap = wrap;
    }
  }

  function renderMemberCard(mem){
    const card = document.createElement('div');
    card.style.borderRadius = '14px';
    card.style.padding = '12px';
    card.style.border = '1px solid rgba(255,255,255,.14)';
    card.style.background = 'rgba(255,255,255,.08)';

    // ===== header（メンバー名ボタン無し）=====
    const head = document.createElement('div');
    head.style.display = 'flex';
    head.style.flexDirection = 'column';
    head.style.gap = '4px';

    const name = document.createElement('div');
    name.style.fontWeight = '1000';
    name.style.fontSize = '15px';
    name.style.whiteSpace = 'nowrap';
    name.style.overflow = 'hidden';
    name.style.textOverflow = 'ellipsis';
    name.textContent = `${String(mem.name || mem.id)}${mem.role ? `（${mem.role}）` : ''}`;

    const sub = document.createElement('div');
    sub.style.fontSize = '12px';
    sub.style.opacity = '0.92';
    sub.textContent = `ID: ${mem.id}`;

    head.appendChild(name);
    head.appendChild(sub);
    card.appendChild(head);

    // 画像（あれば）
    if (mem.img){
      const img = document.createElement('img');
      img.src = mem.img;
      img.alt = mem.id;
      img.style.width = '100%';
      img.style.maxHeight = '220px';
      img.style.objectFit = 'contain';
      img.style.marginTop = '10px';
      img.style.borderRadius = '12px';
      img.style.background = 'rgba(0,0,0,.18)';
      card.appendChild(img);
    }

    // ✅ ステ表示：4つのみ
    const stats = document.createElement('div');
    stats.style.marginTop = '10px';
    stats.style.display = 'grid';
    stats.style.gridTemplateColumns = '1fr 1fr';
    stats.style.gap = '10px';

    STATS_SHOW.forEach(s=>{
      const box = document.createElement('div');
      box.style.borderRadius = '12px';
      box.style.padding = '10px';
      box.style.background = 'rgba(0,0,0,.18)';
      box.style.border = '1px solid rgba(255,255,255,.12)';

      const t = document.createElement('div');
      t.style.fontWeight = '1000';
      t.style.fontSize = '13px';
      t.textContent = s.label;

      const v = document.createElement('div');
      v.style.marginTop = '4px';
      v.style.fontWeight = '1000';
      v.style.fontSize = '18px';
      v.textContent = String(clamp0to99(mem?.stats?.[s.key] || 0));

      box.appendChild(t);
      box.appendChild(v);
      stats.appendChild(box);
    });

    card.appendChild(stats);

    return card;
  }

  function renderTeamHeader(team){
    if (dom.teamName){
      dom.teamName.textContent = String(team?.teamName || 'PLAYER TEAM');
    }
    if (dom.teamPower){
      const p = calcTeamPower(team);
      dom.teamPower.textContent = `チーム力：${p}%`;
    }
  }

  function renderMembers(team){
    if (!dom.membersWrap) return;
    dom.membersWrap.innerHTML = '';

    const list = (team?.members || []).filter(m=>{
      const id = String(m?.id || '');
      return id === 'A' || id === 'B' || id === 'C';
    });

    list.forEach(mem=>{
      dom.membersWrap.appendChild(renderMemberCard(mem));
    });

    // ✅ 注意書き：チーム画面では修行しない
    const note = document.createElement('div');
    note.style.marginTop = '4px';
    note.style.fontSize = '12px';
    note.style.opacity = '0.92';
    note.style.lineHeight = '1.35';
    note.style.padding = '10px 12px';
    note.style.borderRadius = '12px';
    note.style.border = '1px solid rgba(255,255,255,.14)';
    note.style.background = 'rgba(0,0,0,.18)';
    note.textContent = '※修行（トレーニング）は「育成（修行）」画面で行います。チーム画面では実行できません。';
    dom.membersWrap.appendChild(note);
  }

  function render(){
    buildTeamDomIfMissing();
    if (!dom.teamScreen) return;

    const team = migrateAndPersistTeam();
    renderTeamHeader(team);
    renderMembers(team);
  }

  // =========================================================
  // ✅ セーブ互換（TEAM画面にボタンが残っている場合に動かす）
  // =========================================================
  function manualSave(){
    try{
      const snap = {
        ver: 'ui_team_core_v19.4',
        ts: Date.now(),

        company: getStr(K.company, 'CB Memory'),
        team: getStr(K.team, 'PLAYER TEAM'),
        m1: getStr(K.m1, 'A'),
        m2: getStr(K.m2, 'B'),
        m3: getStr(K.m3, 'C'),

        year: getNum(K.year, 1989),
        month: getNum(K.month, 1),
        week: getNum(K.week, 1),

        gold: getNum(K.gold, 0),
        rank: getNum(K.rank, 10),

        nextTour: getStr(K.nextTour, '未定'),
        nextTourW: getStr(K.nextTourW, '未定'),
        recent: getStr(K.recent, '未定'),

        // 重要：チーム本体
        playerTeam: readPlayerTeam(),

        // 互換：world phase 等を持っている場合
        tourState: safeJsonParse(localStorage.getItem(K.tourState) || '', null)
      };

      localStorage.setItem('mobbr_save1', JSON.stringify(snap));
      alert('セーブしました。');
    }catch(e){
      console.error(e);
      alert('セーブに失敗しました（コンソール確認）');
    }
  }

  function deleteSaveAndReset(){
    const ok = confirm(
      'セーブ削除すると、スケジュール／名前／戦績／持ち物／育成など全てリセットされます。\n本当に実行しますか？'
    );
    if (!ok) return;

    try{
      // overlayが残ってると操作不能になるケースがあるので最低限閉じる
      const back = $('modalBack');
      if (back){
        back.style.display = 'none';
        back.style.pointerEvents = 'none';
        back.setAttribute('aria-hidden', 'true');
      }
      const popIds = ['membersPop','weekPop','trainingResultPop','trainingWeekPop','cardPreview','trainingLockPop'];
      popIds.forEach(id=>{
        const el = $(id);
        if (el){
          el.style.display = 'none';
          el.setAttribute('aria-hidden', 'true');
        }
      });

      // storage.js があるならそれを優先
      if (window.MOBBR?.storage?.resetAll){
        window.MOBBR.storage.resetAll();
        return;
      }

      // フォールバック
      localStorage.clear();
      location.reload();
    }catch(e){
      console.error(e);
      try{
        localStorage.clear();
        location.reload();
      }catch(_){}
    }
  }

  let saveBound = false;
  function bindSaveIfExists(){
    if (saveBound) return;
    // DOM取得前でも、呼ばれたタイミングで再収集する
    buildTeamDomIfMissing();

    // ボタンが無いなら何もしない（TEAM画面によっては存在しない）
    if (!dom.btnManualSave && !dom.btnDeleteSave) return;

    saveBound = true;

    const bindBtn = (btn, handler)=>{
      if (!btn) return;
      // iOS対策：タッチ系最適化（クリックが吸われる事故を減らす）
      try{ btn.style.touchAction = 'manipulation'; }catch(e){}
      btn.addEventListener('touchstart', ()=>{}, { passive:true });
      btn.addEventListener('click', (e)=>{
        try{ e.preventDefault(); }catch(_){}
        handler();
      }, { passive:false });
    };

    bindBtn(dom.btnManualSave, manualSave);
    bindBtn(dom.btnDeleteSave, deleteSaveAndReset);
  }

  // =========================================================
  // init
  // =========================================================
  function initTeamUI(){
    buildTeamDomIfMissing();
    bindSaveIfExists();
    render();
  }

  // =========================================================
  // export core api（他モジュール互換用）
  // =========================================================
  const coreApi = {
    dom,
    clone,
    clamp0to99,
    readPlayerTeam,
    writePlayerTeam,
    migrateTeam,
    migrateAndPersistTeam,
    calcTeamPower,
    manualSave,          // 互換：外部から呼びたい場合
    deleteSaveAndReset,  // 互換：外部から呼びたい場合
    bindSaveIfExists,
    renderTeamPower: () => {
      try{
        const team = migrateAndPersistTeam();
        renderTeamHeader(team);
      }catch(e){}
    },
    render
  };

  // ✅ 互換：旧参照
  window.MOBBR._uiTeamCore = coreApi;

  // ✅ 新参照（app.js のCHECKで見ている）
  window.MOBBR.ui._teamCore = coreApi;

  // ✅ init
  window.MOBBR.initTeamUI = initTeamUI;

  // 初回：DOM準備後に呼ばれる想定だが、保険で1回だけ
  try{
    if (document.readyState === 'complete' || document.readyState === 'interactive'){
      setTimeout(()=>{ try{ initTeamUI(); }catch(e){} }, 0);
    }else{
      document.addEventListener('DOMContentLoaded', ()=>{ try{ initTeamUI(); }catch(e){} }, { once:true });
    }
  }catch(e){}

})();
