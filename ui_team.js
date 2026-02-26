'use strict';

/*
  MOB BR - ui_team.js v17（フル）

  ✅ 今回の変更（確定仕様を反映）
  - コーチスキル機能は完全削除（不要）
  - チーム画面に「能力アップ」「能力獲得（スキル取得/強化）」を追加
  - タップで右に「+」の保留値が増える → 「決定」でまとめて反映
  - 足りない時は「ポイントが足りません」を表示して反映しない
  - ステータス上限 99
  - スキル強化上限 +30
  - ステータスアップ：必要ポイントが +1 ずつ増加（同一メンバー×同一ステの累計回数で増える）
  - スキル：必要ポイントが +2 ずつ増加（同一メンバー×同一スキルの現在+値で増える）
  - 発動率は 100% 上限でクランプ（表示も同様）

  ✅ 既存維持
  - 名前変更
  - チーム%（カード効果込み表示）
  - power55対策：calcTeamPower() と teamPower 永続化
  - セーブ削除（完全リセット）時に全ポップアップ/スクリーンを閉じる
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){
  const $ = (id) => document.getElementById(id);

  const S  = window.MOBBR?.storage;
  const DP = window.MOBBR?.data?.player;
  const DC = window.MOBBR?.data?.cards; // あればカードボーナス計算

  if (!S || !S.KEYS){
    console.warn('[ui_team] storage.js not found');
    return;
  }
  if (!DP){
    console.warn('[ui_team] data_player.js not found');
    return;
  }

  // ===== keys =====
  const K = S.KEYS;

  // ===== Training / Skill storage (inside playerTeam) =====
  // playerTeam.members[i].trainPts: { muscle, tech, spirit }
  // playerTeam.members[i].upgradeCount: { hp, aim, tech, mental }  // ステータスアップ累計（必要+1）
  // playerTeam.members[i].skills: { [skillId]: { plus:number } }   // 取得/強化（必要+2）
  // ※既存セーブ互換のため、存在しなければ初期化する

  // ===== DOM =====
  const dom = {
    // screen
    teamScreen: $('teamScreen'),
    btnCloseTeam: $('btnCloseTeam'),

    // meta
    tCompany: $('tCompany'),
    tTeam: $('tTeam'),

    // names
    tNameA: $('tNameA'),
    tNameB: $('tNameB'),
    tNameC: $('tNameC'),

    // team power（任意）
    tTeamPower: $('tTeamPower'),
    tTeamPowerRow: $('tTeamPowerRow'),
    tTeamPowerWrap: $('tTeamPowerWrap'),

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

    // save buttons
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

  function clamp01to100(n){
    return clamp(n, 0, 100);
  }
  function clamp1to100(n){
    return clamp(n, 1, 100);
  }
  function clamp0to99(n){
    return clamp(n, 0, 99);
  }

  function getNameA(){ return S.getStr(K.m1, 'A'); }
  function getNameB(){ return S.getStr(K.m2, 'B'); }
  function getNameC(){ return S.getStr(K.m3, 'C'); }

  function setNameA(v){ S.setStr(K.m1, v); }
  function setNameB(v){ S.setStr(K.m2, v); }
  function setNameC(v){ S.setStr(K.m3, v); }

  function normalize(stats){ return DP.normalizeStats(stats); }

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

  // ★ power55対策：試合が参照する「チーム戦闘力」をこのUIで確定させる
  function calcTeamPower(){
    const team = getPlayerTeam();
    const base = calcTeamBasePercent(team);
    const bonus = calcCollectionBonusPercent();
    const total = base + bonus;     // float
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
    const bonus = calcCollectionBonusPercent(); // 例 0.27
    const total = base + bonus;

    if (ui.cardEl){
      ui.cardEl.textContent = `${total.toFixed(2)}%`;
    }

    const totalInt = clamp1to100(Math.round(total));
    persistTeamPower(totalInt);
  }

  // =========================================================
  // ここから：能力アップ / 能力獲得（スキル）UI
  // =========================================================

  const PTS_KEYS = ['muscle','tech','spirit'];
  const PTS_LABEL = { muscle:'筋力', tech:'技術力', spirit:'精神力' };

  // ステータスアップの対象（あなたの指定）
  const UP_STATS = [
    { key:'hp',     label:'体力'   },
    { key:'aim',    label:'エイム' },
    { key:'tech',   label:'技術'   },
    { key:'mental', label:'メンタル' }
  ];

  // ステータスアップ：基礎コスト（+回数で各項目に +1 ずつ増える）
  function baseCostForStat(statKey){
    if (statKey === 'hp')     return { muscle:10, tech:0,  spirit:0 };
    if (statKey === 'aim')    return { muscle:4,  tech:4,  spirit:2 };
    if (statKey === 'tech')   return { muscle:2,  tech:8,  spirit:0 };
    if (statKey === 'mental') return { muscle:0,  tech:2,  spirit:8 };
    return { muscle:0, tech:0, spirit:0 };
  }

  // スキル定義（確定仕様）
  // - baseChance: %（0..100）
  // - baseEffect: %（効果が%のもの）
  // - plusで chance+1, effect+1（ただし100%上限）
  // - cost: 取得コスト（強化は「必要が2ずつアップ」= +値に応じて各項目に +2*plus）
  const SKILLS = [
    // IGL
    {
      id:'igl_inspire',
      role:'IGL',
      name:'閃きと輝き',
      cost:{ muscle:50, tech:50, spirit:60 },
      baseChance: 1.0,
      trigger:'接敵時',
      type:'buff_team',
      baseEffect: 10, // チーム全員10%
      desc:'接敵時に発動。チーム全員のステータスを10%アップ。'
    },
    {
      id:'igl_control',
      role:'IGL',
      name:'空間制圧',
      cost:{ muscle:30, tech:60, spirit:80 },
      baseChance: 0.5,
      trigger:'接敵時',
      type:'debuff_enemy_power',
      baseEffect: 5, // 敵総合戦闘力 -5
      desc:'接敵時に発動。敵チームの総合戦闘力を5ダウン。'
    },

    // Attacker
    {
      id:'atk_speedstar',
      role:'アタッカー',
      name:'スピードスター',
      cost:{ muscle:70, tech:20, spirit:30 },
      baseChance: 1.0,
      trigger:'接敵時',
      type:'buff_self_aim',
      baseEffect: 20, // 自身エイム +20%
      desc:'接敵時に発動。自身のエイムが20%アップ。'
    },
    {
      id:'atk_physical',
      role:'アタッカー',
      name:'フィジカルモンスター',
      cost:{ muscle:90, tech:40, spirit:60 },
      baseChance: 0.5,
      trigger:'マッチ開始時',
      type:'buff_match_aim',
      baseEffect: 50, // 試合中エイム +50%
      desc:'マッチ開始時に発動。発動した試合中、エイムが50%アップ。'
    },

    // Support
    {
      id:'sup_shingan',
      role:'サポーター',
      name:'心眼',
      cost:{ muscle:20, tech:30, spirit:40 }, // ★不足していた取得ポイントを付与
      baseChance: 1.0,
      trigger:'マッチ開始時',
      type:'block_debuff',
      baseEffect: 100, // 「デバフイベント発生しない」を便宜上100%効果として扱う
      desc:'マッチ開始時に発動。発動した試合でデバフイベントが発生しなくなる。'
    },
    {
      id:'sup_godcover',
      role:'サポーター',
      name:'神カバー',
      cost:{ muscle:30, tech:30, spirit:20 }, // ★不足していた取得ポイントを付与
      baseChance: 5.0,
      trigger:'接敵時',
      type:'buff_others',
      baseEffect: 5, // 自分以外 全能力 +5%
      desc:'接敵時に発動。自分以外の全能力を5%アップ。'
    }
  ];

  const SKILL_BY_ID = Object.fromEntries(SKILLS.map(s => [s.id, s]));

  // ===== team data normalize =====
  function ensureMemberMeta(mem){
    if (!mem) return;

    // trainPts
    if (!mem.trainPts || typeof mem.trainPts !== 'object'){
      mem.trainPts = { muscle:0, tech:0, spirit:0 };
    }
    for (const k of PTS_KEYS){
      mem.trainPts[k] = clamp(Number(mem.trainPts[k] ?? 0), 0, 999999);
    }

    // upgradeCount
    if (!mem.upgradeCount || typeof mem.upgradeCount !== 'object'){
      mem.upgradeCount = { hp:0, aim:0, tech:0, mental:0 };
    }
    for (const s of ['hp','aim','tech','mental']){
      mem.upgradeCount[s] = clamp(Number(mem.upgradeCount[s] ?? 0), 0, 999999);
    }

    // skills
    if (!mem.skills || typeof mem.skills !== 'object'){
      mem.skills = {};
    }
    // 正規化
    for (const sid in mem.skills){
      const ent = mem.skills[sid];
      if (!ent || typeof ent !== 'object'){
        mem.skills[sid] = { plus:0 };
        continue;
      }
      ent.plus = clamp(Number(ent.plus ?? 0), 0, 30);
    }
  }

  function ensureTeamMeta(team){
    if (!team || !Array.isArray(team.members)) return;
    team.members.forEach(ensureMemberMeta);
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

  // ===== UI injection =====
  let trainingUI = null;

  function findTeamPanel(){
    if (!dom.teamScreen) return null;
    return dom.teamScreen.querySelector?.('.teamPanel') || dom.teamScreen;
  }

  function createSectionTitle(text){
    const t = document.createElement('div');
    t.style.fontWeight = '1000';
    t.style.fontSize = '14px';
    t.style.opacity = '0.98';
    t.style.marginTop = '10px';
    t.textContent = text;
    return t;
  }

  function createSubText(text){
    const s = document.createElement('div');
    s.style.marginTop = '6px';
    s.style.fontSize = '12px';
    s.style.opacity = '0.92';
    s.style.lineHeight = '1.35';
    s.textContent = text;
    return s;
  }

  function createTabRow(){
    const row = document.createElement('div');
    row.style.display = 'grid';
    row.style.gridTemplateColumns = 'repeat(3, minmax(0, 1fr))';
    row.style.gap = '8px';
    row.style.marginTop = '10px';
    return row;
  }

  function createTabBtn(label, active){
    const b = document.createElement('button');
    b.type = 'button';
    b.style.border = '1px solid rgba(255,255,255,.16)';
    b.style.borderRadius = '12px';
    b.style.padding = '10px 10px';
    b.style.fontWeight = '1000';
    b.style.fontSize = '13px';
    b.style.cursor = 'pointer';
    b.style.touchAction = 'manipulation';
    b.style.background = active ? 'rgba(255,255,255,.86)' : 'rgba(255,255,255,.10)';
    b.style.color = active ? '#111' : '#fff';
    b.textContent = label;
    b.addEventListener('touchstart', ()=>{}, {passive:true});
    b.onmousedown = ()=>{};
    return b;
  }

  function createCard(){
    const c = document.createElement('div');
    c.style.borderRadius = '14px';
    c.style.padding = '12px';
    c.style.background = 'rgba(255,255,255,.10)';
    c.style.border = '1px solid rgba(255,255,255,.14)';
    return c;
  }

  function createMiniPill(text){
    const p = document.createElement('div');
    p.style.display = 'inline-block';
    p.style.padding = '4px 8px';
    p.style.borderRadius = '999px';
    p.style.fontSize = '11px';
    p.style.fontWeight = '1000';
    p.style.border = '1px solid rgba(255,255,255,.18)';
    p.style.background = 'rgba(0,0,0,.25)';
    p.style.opacity = '0.95';
    p.textContent = text;
    return p;
  }

  function createPrimaryBtn(text){
    const b = document.createElement('button');
    b.type = 'button';
    b.style.width = '100%';
    b.style.border = '1px solid rgba(255,255,255,.18)';
    b.style.borderRadius = '14px';
    b.style.padding = '12px 12px';
    b.style.fontWeight = '1000';
    b.style.fontSize = '14px';
    b.style.background = 'rgba(255,255,255,.86)';
    b.style.color = '#111';
    b.style.cursor = 'pointer';
    b.style.touchAction = 'manipulation';
    b.addEventListener('touchstart', ()=>{}, {passive:true});
    b.onmousedown = ()=>{};
    b.textContent = text;
    return b;
  }

  function createGhostBtn(text){
    const b = document.createElement('button');
    b.type = 'button';
    b.style.width = '100%';
    b.style.border = '1px solid rgba(255,255,255,.16)';
    b.style.borderRadius = '14px';
    b.style.padding = '12px 12px';
    b.style.fontWeight = '1000';
    b.style.fontSize = '14px';
    b.style.background = 'rgba(255,255,255,.10)';
    b.style.color = '#fff';
    b.style.cursor = 'pointer';
    b.style.touchAction = 'manipulation';
    b.addEventListener('touchstart', ()=>{}, {passive:true});
    b.onmousedown = ()=>{};
    b.textContent = text;
    return b;
  }

  function ensureTrainingUI(){
    const panel = findTeamPanel();
    if (!panel) return null;

    const existing = panel.querySelector?.('#teamTrainingSection');
    if (existing){
      trainingUI = {
        root: existing,
        memberTabs: existing.querySelector('.ttMemberTabs'),
        ptRow: existing.querySelector('.ttPointRow'),
        upArea: existing.querySelector('.ttUpArea'),
        skillArea: existing.querySelector('.ttSkillArea'),
        msg: existing.querySelector('.ttMsg')
      };
      return trainingUI;
    }

    // 追加位置：できるだけ下の方
    const section = document.createElement('div');
    section.id = 'teamTrainingSection';
    section.style.marginTop = '12px';

    const title = createSectionTitle('育成（能力アップ / 能力獲得）');
    section.appendChild(title);
    section.appendChild(createSubText('タップで右に + が増えます。決定でまとめて反映します。足りない時は反映しません。'));

    const memberTabs = createTabRow();
    memberTabs.className = 'ttMemberTabs';
    section.appendChild(memberTabs);

    const ptRow = document.createElement('div');
    ptRow.className = 'ttPointRow';
    ptRow.style.display = 'flex';
    ptRow.style.flexWrap = 'wrap';
    ptRow.style.gap = '8px';
    ptRow.style.marginTop = '10px';
    section.appendChild(ptRow);

    const msg = document.createElement('div');
    msg.className = 'ttMsg';
    msg.style.marginTop = '8px';
    msg.style.fontSize = '12px';
    msg.style.lineHeight = '1.35';
    msg.style.opacity = '0.95';
    msg.style.display = 'none';
    msg.style.padding = '10px 10px';
    msg.style.borderRadius = '12px';
    msg.style.border = '1px solid rgba(255,255,255,.16)';
    msg.style.background = 'rgba(0,0,0,.25)';
    section.appendChild(msg);

    const upTitle = createSectionTitle('能力アップ');
    section.appendChild(upTitle);

    const upArea = document.createElement('div');
    upArea.className = 'ttUpArea';
    upArea.style.marginTop = '10px';
    section.appendChild(upArea);

    const skillTitle = createSectionTitle('能力獲得（スキル取得 / 強化）');
    section.appendChild(skillTitle);

    const skillArea = document.createElement('div');
    skillArea.className = 'ttSkillArea';
    skillArea.style.marginTop = '10px';
    section.appendChild(skillArea);

    panel.appendChild(section);

    trainingUI = { root: section, memberTabs, ptRow, upArea, skillArea, msg };
    return trainingUI;
  }

  function showMsg(text){
    const ui = ensureTrainingUI();
    if (!ui || !ui.msg) return;
    ui.msg.textContent = String(text || '');
    ui.msg.style.display = text ? 'block' : 'none';
  }

  // ===== pending state (not saved) =====
  let ttSelectedId = 'A';
  let pendingUp = {
    A: { hp:0, aim:0, tech:0, mental:0 },
    B: { hp:0, aim:0, tech:0, mental:0 },
    C: { hp:0, aim:0, tech:0, mental:0 }
  };
  let pendingSkill = {
    A: {}, B: {}, C: {}
  };

  function resetPending(){
    pendingUp = {
      A: { hp:0, aim:0, tech:0, mental:0 },
      B: { hp:0, aim:0, tech:0, mental:0 },
      C: { hp:0, aim:0, tech:0, mental:0 }
    };
    pendingSkill = { A:{}, B:{}, C:{} };
  }

  function getMemById(team, id){
    return (team?.members || []).find(m => String(m?.id) === String(id));
  }

  function formatPtsCost(cost){
    const parts = [];
    for (const k of PTS_KEYS){
      const v = Number(cost?.[k] || 0);
      if (v > 0) parts.push(`${PTS_LABEL[k]}${v}`);
    }
    return parts.join(' / ') || '0';
  }

  function calcStatCost(mem, statKey, addCount /* 1..n */){
    // 1回分のコスト：base + (upgradeCount[stat] + (i-1)) を各項目に加算
    // addCount回ぶんを合算する
    const base = baseCostForStat(statKey);
    const cur = Number(mem?.upgradeCount?.[statKey] || 0);

    const sum = { muscle:0, tech:0, spirit:0 };

    for (let i=0;i<addCount;i++){
      const inc = cur + i; // これが「必要 +1ずつアップ」の増分
      for (const k of PTS_KEYS){
        const b = Number(base[k] || 0);
        if (b <= 0) continue;
        sum[k] += (b + inc);
      }
    }
    return sum;
  }

  function calcSkillCost(mem, skillId, addCount /* 1..n */){
    const def = SKILL_BY_ID[skillId];
    if (!def) return { muscle:0, tech:0, spirit:0 };

    const curPlus = clamp(Number(mem?.skills?.[skillId]?.plus || 0), 0, 30);

    // 1回分のコスト：base + (curPlus + (i)) *2 を各項目に加算（「必要 +2ずつアップ」）
    // 取得（+1）も同じ扱い（curPlusが0なら base + 0*2）
    const sum = { muscle:0, tech:0, spirit:0 };

    for (let i=0;i<addCount;i++){
      const p = curPlus + i;        // 今から増やす前の+値
      const inc2 = p * 2;           // +2ずつ
      for (const k of PTS_KEYS){
        const b = Number(def.cost?.[k] || 0);
        if (b <= 0) continue;
        sum[k] += (b + inc2);
      }
    }
    return sum;
  }

  function hasEnoughPts(mem, cost){
    for (const k of PTS_KEYS){
      const have = Number(mem?.trainPts?.[k] || 0);
      const need = Number(cost?.[k] || 0);
      if (have < need) return false;
    }
    return true;
  }

  function consumePts(mem, cost){
    for (const k of PTS_KEYS){
      mem.trainPts[k] = clamp(Number(mem.trainPts[k] || 0) - Number(cost?.[k] || 0), 0, 999999);
    }
  }

  function applyPendingToTeam(team){
    // 決定：不足チェック → 全部OKなら反映
    const ids = ['A','B','C'];

    // 1) cost集計
    const totalCostByMem = { A:{muscle:0,tech:0,spirit:0}, B:{muscle:0,tech:0,spirit:0}, C:{muscle:0,tech:0,spirit:0} };

    for (const id of ids){
      const mem = getMemById(team, id);
      if (!mem) continue;

      // stat
      for (const s of ['hp','aim','tech','mental']){
        const add = Number(pendingUp?.[id]?.[s] || 0);
        if (add > 0){
          const c = calcStatCost(mem, s, add);
          for (const k of PTS_KEYS) totalCostByMem[id][k] += c[k];
        }
      }

      // skill
      const pmap = pendingSkill[id] || {};
      for (const sid in pmap){
        const add = Number(pmap[sid] || 0);
        if (add > 0){
          const c = calcSkillCost(mem, sid, add);
          for (const k of PTS_KEYS) totalCostByMem[id][k] += c[k];
        }
      }
    }

    // 2) 不足判定（誰か1人でも不足なら全員反映しない）
    for (const id of ids){
      const mem = getMemById(team, id);
      if (!mem) continue;
      if (!hasEnoughPts(mem, totalCostByMem[id])){
        return { ok:false, reason:'ポイントが足りません' };
      }
    }

    // 3) 反映
    for (const id of ids){
      const mem = getMemById(team, id);
      if (!mem) continue;

      // consume
      consumePts(mem, totalCostByMem[id]);

      // stat apply
      for (const s of ['hp','aim','tech','mental']){
        const add = Number(pendingUp?.[id]?.[s] || 0);
        if (add <= 0) continue;

        mem.stats = mem.stats || {};
        mem.stats[s] = clamp0to99(Number(mem.stats[s] || 0) + add);

        // upgrade count update
        mem.upgradeCount[s] = clamp(Number(mem.upgradeCount[s] || 0) + add, 0, 999999);
      }

      // skill apply
      mem.skills = mem.skills || {};
      const pmap = pendingSkill[id] || {};
      for (const sid in pmap){
        const add = Number(pmap[sid] || 0);
        if (add <= 0) continue;

        if (!mem.skills[sid]) mem.skills[sid] = { plus:0 };
        const cur = clamp(Number(mem.skills[sid].plus || 0), 0, 30);
        const next = clamp(cur + add, 0, 30);
        mem.skills[sid].plus = next;
      }
    }

    return { ok:true };
  }

  function formatChance(def, plus){
    const base = Number(def?.baseChance || 0);
    const p = clamp(Number(plus || 0), 0, 30);
    const v = Math.min(100, base + p);
    return `${v.toFixed(1)}%`;
  }

  function formatEffect(def, plus){
    const base = Number(def?.baseEffect || 0);
    const p = clamp(Number(plus || 0), 0, 30);
    const v = base + p;
    // block_debuff は「発生しない」が主効果。表示は特別扱い
    if (def?.type === 'block_debuff'){
      return 'デバフイベント発生なし';
    }
    return `${v}%`;
  }

  function renderPtsRow(mem){
    const ui = ensureTrainingUI();
    if (!ui || !ui.ptRow) return;
    ui.ptRow.innerHTML = '';

    for (const k of PTS_KEYS){
      const pill = createMiniPill(`${PTS_LABEL[k]}：${Number(mem?.trainPts?.[k] || 0)}`);
      ui.ptRow.appendChild(pill);
    }
  }

  function renderMemberTabs(team){
    const ui = ensureTrainingUI();
    if (!ui || !ui.memberTabs) return;

    ui.memberTabs.innerHTML = '';

    const ids = ['A','B','C'];
    ids.forEach(id=>{
      const mem = getMemById(team, id);
      const name = getMemberNameById(id);
      const role = getMemberRole(mem);
      const label = role ? `${name}（${role}）` : name;

      const btn = createTabBtn(label, ttSelectedId === id);
      btn.addEventListener('click', ()=>{
        ttSelectedId = id;
        showMsg('');
        renderTrainingSection(); // 全再描画
      });
      ui.memberTabs.appendChild(btn);
    });
  }

  function renderUpArea(team){
    const ui = ensureTrainingUI();
    if (!ui || !ui.upArea) return;

    ui.upArea.innerHTML = '';

    const mem = getMemById(team, ttSelectedId);
    if (!mem) return;

    const card = createCard();

    const head = document.createElement('div');
    head.style.display = 'flex';
    head.style.justifyContent = 'space-between';
    head.style.alignItems = 'baseline';
    head.style.gap = '10px';

    const left = document.createElement('div');
    left.style.fontWeight = '1000';
    left.style.fontSize = '14px';
    left.textContent = `${getMemberNameById(mem.id)}：能力アップ`;

    const right = document.createElement('div');
    right.style.display = 'flex';
    right.style.gap = '6px';
    right.style.flexWrap = 'wrap';
    right.appendChild(createMiniPill('上限 99'));
    right.appendChild(createMiniPill('必要：+1ずつ増加'));

    head.appendChild(left);
    head.appendChild(right);
    card.appendChild(head);

    const note = document.createElement('div');
    note.style.marginTop = '8px';
    note.style.fontSize = '12px';
    note.style.opacity = '0.92';
    note.style.lineHeight = '1.35';
    note.textContent = 'タップで + を保留します。決定でまとめて反映します。';
    card.appendChild(note);

    // rows
    const list = document.createElement('div');
    list.style.marginTop = '10px';
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '10px';

    UP_STATS.forEach(st=>{
      const row = document.createElement('div');
      row.style.display = 'grid';
      row.style.gridTemplateColumns = '1fr auto';
      row.style.gap = '10px';
      row.style.alignItems = 'center';

      const info = document.createElement('div');

      const curVal = clamp0to99(Number(mem?.stats?.[st.key] || 0));
      const pend = Number(pendingUp?.[mem.id]?.[st.key] || 0);
      const after = clamp0to99(curVal + pend);

      const line1 = document.createElement('div');
      line1.style.fontWeight = '1000';
      line1.style.fontSize = '13px';
      line1.textContent = `${st.label}：${curVal}  →  ${after}${pend>0 ? `（+${pend}）` : ''}`;

      const c1 = calcStatCost(mem, st.key, Math.max(0, pend || 0));
      const base = baseCostForStat(st.key);
      const line2 = document.createElement('div');
      line2.style.marginTop = '4px';
      line2.style.fontSize = '12px';
      line2.style.opacity = '0.92';
      line2.textContent =
        `基礎：${formatPtsCost(base)} / 保留分コスト：${pend>0 ? formatPtsCost(c1) : '0'}`;

      info.appendChild(line1);
      info.appendChild(line2);

      const btnCol = document.createElement('div');
      btnCol.style.display = 'flex';
      btnCol.style.flexDirection = 'column';
      btnCol.style.gap = '6px';
      btnCol.style.minWidth = '120px';

      const plusBtn = createGhostBtn('＋1');
      plusBtn.style.padding = '10px 10px';
      plusBtn.addEventListener('click', ()=>{
        // 上限チェック（表示上は上限99）
        const cur = clamp0to99(Number(mem?.stats?.[st.key] || 0));
        const pendNow = Number(pendingUp?.[mem.id]?.[st.key] || 0);
        if (cur + pendNow >= 99){
          showMsg('ステータス上限（99）です。');
          return;
        }
        pendingUp[mem.id][st.key] = pendNow + 1;
        showMsg('');
        renderTrainingSection();
      });

      const minusBtn = createGhostBtn('－1');
      minusBtn.style.padding = '10px 10px';
      minusBtn.addEventListener('click', ()=>{
        const pendNow = Number(pendingUp?.[mem.id]?.[st.key] || 0);
        if (pendNow <= 0) return;
        pendingUp[mem.id][st.key] = pendNow - 1;
        showMsg('');
        renderTrainingSection();
      });

      // right-side pending indicator
      const pendTag = document.createElement('div');
      pendTag.style.textAlign = 'right';
      pendTag.style.fontSize = '12px';
      pendTag.style.fontWeight = '1000';
      pendTag.style.opacity = '0.95';
      pendTag.textContent = pendNowText(pendingUp[mem.id][st.key]);

      function pendNowText(n){
        const v = Number(n || 0);
        return v > 0 ? `保留：+${v}` : '保留：0';
      }

      // keep updated visually
      pendTag.textContent = pendNowText(pendingUp[mem.id][st.key]);

      btnCol.appendChild(plusBtn);
      btnCol.appendChild(minusBtn);
      btnCol.appendChild(pendTag);

      row.appendChild(info);
      row.appendChild(btnCol);

      list.appendChild(row);
    });

    card.appendChild(list);

    // 결정 버튼（このメンバーだけ確정ではなく、仕様通일을 위해 "全員分の保留を決定"）
    const btns = document.createElement('div');
    btns.style.marginTop = '12px';
    btns.style.display = 'grid';
    btns.style.gridTemplateColumns = '1fr 1fr';
    btns.style.gap = '10px';

    const btnCommit = createPrimaryBtn('決定（保留を反映）');
    btnCommit.addEventListener('click', ()=>{
      const team2 = clone(team);
      ensureTeamMeta(team2);

      const res = applyPendingToTeam(team2);
      if (!res.ok){
        showMsg(res.reason || 'ポイントが足りません');
        return;
      }

      // 保存
      writePlayerTeam(team2);

      // pending 리셋
      resetPending();
      showMsg('反映しました。');

      // チーム%更新（ステ上がったため）
      renderTeamPower();

      // 画面再描画
      render();
    });

    const btnClear = createGhostBtn('保留をクリア');
    btnClear.addEventListener('click', ()=>{
      resetPending();
      showMsg('保留をクリアしました。');
      renderTrainingSection();
    });

    btns.appendChild(btnCommit);
    btns.appendChild(btnClear);

    card.appendChild(btns);

    ui.upArea.appendChild(card);
  }

  function renderSkillArea(team){
    const ui = ensureTrainingUI();
    if (!ui || !ui.skillArea) return;

    ui.skillArea.innerHTML = '';

    const mem = getMemById(team, ttSelectedId);
    if (!mem) return;

    const card = createCard();

    const head = document.createElement('div');
    head.style.display = 'flex';
    head.style.justifyContent = 'space-between';
    head.style.alignItems = 'baseline';
    head.style.gap = '10px';

    const left = document.createElement('div');
    left.style.fontWeight = '1000';
    left.style.fontSize = '14px';
    left.textContent = `${getMemberNameById(mem.id)}：能力獲得（スキル）`;

    const right = document.createElement('div');
    right.style.display = 'flex';
    right.style.gap = '6px';
    right.style.flexWrap = 'wrap';
    right.appendChild(createMiniPill('上限 +30'));
    right.appendChild(createMiniPill('必要：+2ずつ増加'));
    head.appendChild(left);
    head.appendChild(right);

    card.appendChild(head);

    const note = document.createElement('div');
    note.style.marginTop = '8px';
    note.style.fontSize = '12px';
    note.style.opacity = '0.92';
    note.style.lineHeight = '1.35';
    note.textContent = '取得/強化は + を保留し、決定でまとめて反映します。';
    card.appendChild(note);

    const role = getMemberRole(mem);

    const list = document.createElement('div');
    list.style.marginTop = '10px';
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '10px';

    const skills = SKILLS.filter(s => !role || s.role === role);
    if (!skills.length){
      const none = document.createElement('div');
      none.style.opacity = '0.92';
      none.style.fontSize = '13px';
      none.textContent = 'このメンバーのロールに対応するスキルがありません。';
      list.appendChild(none);
    }

    skills.forEach(def=>{
      const row = document.createElement('div');
      row.style.borderRadius = '12px';
      row.style.padding = '12px';
      row.style.background = 'rgba(0,0,0,.18)';
      row.style.border = '1px solid rgba(255,255,255,.14)';

      const top = document.createElement('div');
      top.style.display = 'flex';
      top.style.justifyContent = 'space-between';
      top.style.alignItems = 'baseline';
      top.style.gap = '10px';

      const name = document.createElement('div');
      name.style.fontWeight = '1000';
      name.style.fontSize = '14px';
      name.textContent = def.name;

      const tag = document.createElement('div');
      tag.style.display = 'flex';
      tag.style.gap = '6px';
      tag.style.flexWrap = 'wrap';
      tag.appendChild(createMiniPill(def.role));
      tag.appendChild(createMiniPill(def.trigger));

      top.appendChild(name);
      top.appendChild(tag);

      const curPlus = clamp(Number(mem?.skills?.[def.id]?.plus || 0), 0, 30);
      const pend = clamp(Number((pendingSkill[mem.id] || {})[def.id] || 0), 0, 30);

      const line1 = document.createElement('div');
      line1.style.marginTop = '8px';
      line1.style.fontSize = '12px';
      line1.style.opacity = '0.95';
      line1.textContent = def.desc;

      const line2 = document.createElement('div');
      line2.style.marginTop = '6px';
      line2.style.fontSize = '12px';
      line2.style.opacity = '0.95';

      const chanceText = formatChance(def, curPlus + pend);
      const effText = formatEffect(def, curPlus + pend);

      // 特記事項：接敵時発動スキルは交戦後リセット（仕様メモ）
      const resetNote = (def.trigger === '接敵時') ? '（交戦後リセット）' : '';

      line2.textContent =
        `現在：+${curPlus} → +${clamp(curPlus + pend, 0, 30)}${pend>0 ? `（保留+${pend}）` : ''} / 発動率：${chanceText} / 効果：${effText} ${resetNote}`;

      const costNow = calcSkillCost(mem, def.id, 1); // 次の+1を取るコスト（表示用）
      const costPend = pend > 0 ? calcSkillCost(mem, def.id, pend) : { muscle:0, tech:0, spirit:0 };

      const line3 = document.createElement('div');
      line3.style.marginTop = '6px';
      line3.style.fontSize = '12px';
      line3.style.opacity = '0.92';
      line3.textContent =
        `取得/強化コスト（次+1）：${formatPtsCost(costNow)} / 保留分コスト：${pend>0 ? formatPtsCost(costPend) : '0'}`;

      const btnRow = document.createElement('div');
      btnRow.style.marginTop = '10px';
      btnRow.style.display = 'grid';
      btnRow.style.gridTemplateColumns = '1fr 1fr';
      btnRow.style.gap = '8px';

      const btnPlus = createGhostBtn('＋1');
      btnPlus.style.padding = '10px 10px';
      btnPlus.addEventListener('click', ()=>{
        const cur = clamp(Number(mem?.skills?.[def.id]?.plus || 0), 0, 30);
        const pendNow = clamp(Number((pendingSkill[mem.id] || {})[def.id] || 0), 0, 30);
        if (cur + pendNow >= 30){
          showMsg('スキル強化上限（+30）です。');
          return;
        }
        pendingSkill[mem.id] = pendingSkill[mem.id] || {};
        pendingSkill[mem.id][def.id] = pendNow + 1;
        showMsg('');
        renderTrainingSection();
      });

      const btnMinus = createGhostBtn('－1');
      btnMinus.style.padding = '10px 10px';
      btnMinus.addEventListener('click', ()=>{
        const pendNow = clamp(Number((pendingSkill[mem.id] || {})[def.id] || 0), 0, 30);
        if (pendNow <= 0) return;
        pendingSkill[mem.id][def.id] = pendNow - 1;
        showMsg('');
        renderTrainingSection();
      });

      btnRow.appendChild(btnPlus);
      btnRow.appendChild(btnMinus);

      row.appendChild(top);
      row.appendChild(line1);
      row.appendChild(line2);
      row.appendChild(line3);
      row.appendChild(btnRow);

      list.appendChild(row);
    });

    card.appendChild(list);

    // 決定/クリアは能力アップと同じ（上のカード側にもあるが、ここにも置く）
    const btns = document.createElement('div');
    btns.style.marginTop = '12px';
    btns.style.display = 'grid';
    btns.style.gridTemplateColumns = '1fr 1fr';
    btns.style.gap = '10px';

    const btnCommit = createPrimaryBtn('決定（保留を反映）');
    btnCommit.addEventListener('click', ()=>{
      const team2 = clone(team);
      ensureTeamMeta(team2);

      const res = applyPendingToTeam(team2);
      if (!res.ok){
        showMsg(res.reason || 'ポイントが足りません');
        return;
      }

      writePlayerTeam(team2);
      resetPending();
      showMsg('反映しました。');

      renderTeamPower();
      render();
    });

    const btnClear = createGhostBtn('保留をクリア');
    btnClear.addEventListener('click', ()=>{
      resetPending();
      showMsg('保留をクリアしました。');
      renderTrainingSection();
    });

    btns.appendChild(btnCommit);
    btns.appendChild(btnClear);

    card.appendChild(btns);

    ui.skillArea.appendChild(card);
  }

  function renderTrainingSection(){
    const team = getPlayerTeam();
    ensureTeamMeta(team);

    const mem = getMemById(team, ttSelectedId) || getMemById(team, 'A');
    if (!mem){
      return;
    }
    renderMemberTabs(team);
    renderPtsRow(mem);
    renderUpArea(team);
    renderSkillArea(team);
  }

  // ===== main render =====
  function render(){
    // meta
    safeText(dom.tCompany, S.getStr(K.company, 'CB Memory'));
    safeText(dom.tTeam, S.getStr(K.team, 'PLAYER TEAM'));

    const team = getPlayerTeam();
    ensureTeamMeta(team);

    // team members + stats
    const byId = {};
    for (const m of (team.members || [])) byId[m.id] = m;

    // A
    const A = byId.A;
    if (A){
      const st = normalize(A.stats);
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
    const B = byId.B;
    if (B){
      const st = normalize(B.stats);
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
    const C = byId.C;
    if (C){
      const st = normalize(C.stats);
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

    // 育成UI（注入）
    ensureTrainingUI();
    renderTrainingSection();
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

  // ===== rename handlers =====
  let renameBound = false;
  function bindRename(){
    if (renameBound) return;
    renameBound = true;

    if (dom.tNameA){
      dom.tNameA.addEventListener('click', ()=>{
        const cur = getNameA();
        const v = prompt('メンバー名（A）を変更', cur);
        if (v === null) return;
        const nv = v.trim();
        if (!nv) return;
        setNameA(nv);

        try{
          const raw = localStorage.getItem(K.playerTeam);
          if (raw){
            const t = JSON.parse(raw);
            if (t && Array.isArray(t.members)){
              const m = t.members.find(x=>x.id==='A');
              if (m) m.name = nv;
              localStorage.setItem(K.playerTeam, JSON.stringify(t));
            }
          }
        }catch(e){}

        reflectNamesEverywhere();
        renderTrainingSection();
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

        try{
          const raw = localStorage.getItem(K.playerTeam);
          if (raw){
            const t = JSON.parse(raw);
            if (t && Array.isArray(t.members)){
              const m = t.members.find(x=>x.id==='B');
              if (m) m.name = nv;
              localStorage.setItem(K.playerTeam, JSON.stringify(t));
            }
          }
        }catch(e){}

        reflectNamesEverywhere();
        renderTrainingSection();
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

        try{
          const raw = localStorage.getItem(K.playerTeam);
          if (raw){
            const t = JSON.parse(raw);
            if (t && Array.isArray(t.members)){
              const m = t.members.find(x=>x.id==='C');
              if (m) m.name = nv;
              localStorage.setItem(K.playerTeam, JSON.stringify(t));
            }
          }
        }catch(e){}

        reflectNamesEverywhere();
        renderTrainingSection();
      });
    }
  }

  // ===== save =====
  function manualSave(){
    const snap = {
      ver: 'v17',
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

  // ★リセット前に「全ポップアップを閉じる」
  function closeAllOverlays(){
    const idsHideDisplay = [
      'membersPop',
      'weekPop',
      'trainingResultPop',
      'trainingWeekPop',
      'cardPreview',
      'trainingLockPop'
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

  // ===== init =====
  function initTeamUI(){
    bindClose();
    bindRename();
    bindSave();

    // 互換初期化：teamに育成メタを付与して保存しておく（存在しないとUIでnullになるため）
    const team = getPlayerTeam();
    ensureTeamMeta(team);
    writePlayerTeam(team);

    render();
  }

  window.MOBBR.initTeamUI = initTeamUI;

  // ★ calcTeamPower を公開（大会/試合が参照する）
  window.MOBBR.ui.team = { open, close, render, calcTeamPower };

  document.addEventListener('DOMContentLoaded', ()=>{
    initTeamUI();
  });
})();
