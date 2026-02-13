'use strict';

/*
  MOB BR - ui_team.js v16（フル）
  追加：
  - コーチスキルの「装備 / 取り外し」(最大3枠)
    所持：mobbr_coachSkillsOwned（shopで増える）
    装備：mobbr_coachSkillsEquipped（このファイルで管理）
  - 既存機能は維持：
    ・カード効果込み総合% 表示（赤文字 +「カード効果！」）
    ・セーブ削除（完全リセット）時に全ポップアップ/スクリーンを閉じる

  ★今回の修正（power55問題）
  - window.MOBBR.ui.team.calcTeamPower() を実装（試合側が参照）
  - renderTeamPower() のたびに localStorage[mobbr_playerTeam].teamPower を保存
    → 大会/試合側の calcPlayerTeamPower() が 55 に落ちなくなる
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

  // ===== Coach Skills Storage =====
  const COACH_OWNED_KEY = 'mobbr_coachSkillsOwned';     // { id: count }
  const COACH_EQUIP_KEY = 'mobbr_coachSkillsEquipped';  // [id|null, id|null, id|null]

  // ===== Coach Skills Master =====
  const COACH_SKILLS = [
    {
      id: 'tactics_note',
      name: '戦術ノート',
      effectLabel: 'この試合、総合戦闘力が1%アップする',
      coachLine: '基本を徹底。丁寧に戦おう！'
    },
    {
      id: 'mental_care',
      name: 'メンタル整備',
      effectLabel: 'この試合、チームの雰囲気が安定する',
      coachLine: '全員で勝つぞ！'
    },
    {
      id: 'endgame_power',
      name: '終盤の底力',
      effectLabel: 'この試合、終盤の勝負で総合戦闘力が3%アップする',
      coachLine: '終盤一気に押すぞ！'
    },
    {
      id: 'clearing',
      name: 'クリアリング徹底',
      effectLabel: 'この試合、ファイトに勝った後に人数が残りやすい',
      coachLine: '周辺をしっかり見ろ！'
    },
    {
      id: 'score_mind',
      name: 'スコア意識',
      effectLabel: 'この試合、お宝やフラッグを取りやすい',
      coachLine: 'この試合はポイント勝負だ！'
    },
    {
      id: 'igl_call',
      name: 'IGL強化コール',
      effectLabel: 'この試合、総合戦闘力が4%アップする',
      coachLine: 'コールを信じろ！チャンピオン取るぞ！'
    },
    {
      id: 'protagonist',
      name: '主人公ムーブ',
      effectLabel: 'この試合、総合戦闘力が6%アップし、アシストも出やすくなる',
      coachLine: 'チームの力を信じろ！'
    }
  ];
  const COACH_BY_ID = Object.fromEntries(COACH_SKILLS.map(s => [s.id, s]));

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

  function clamp01to100(n){
    const v = Number(n);
    if (!Number.isFinite(v)) return 0;
    return Math.max(0, Math.min(100, v));
  }

  function clamp1to100(n){
    const v = Number(n);
    if (!Number.isFinite(v)) return 1;
    return Math.max(1, Math.min(100, v));
  }

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
    // localStorage[mobbr_playerTeam].teamPower を確実に保存（試合側のフォールバック用）
    try{
      const raw = localStorage.getItem(K.playerTeam);
      if (!raw) return;
      const t = JSON.parse(raw);
      if (!t || typeof t !== 'object') return;

      t.teamPower = clamp1to100(teamPowerInt);

      // 念のため members の name など既存構造はそのまま維持して上書き保存
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

    // ★大会/試合で使う整数power（1..100）を保存
    const totalInt = clamp1to100(Math.round(total));
    persistTeamPower(totalInt);
  }

  // ===== Coach Skills: load/save =====
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
      if (Array.isArray(arr)){
        const out = [arr[0] ?? null, arr[1] ?? null, arr[2] ?? null].slice(0,3);
        return out.map(v => (typeof v === 'string' && v.trim()) ? v : null);
      }
      return [null,null,null];
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

  function countEquipped(id, equipped){
    return equipped.filter(x => x === id).length;
  }

  // ===== Coach Skills UI (injected) =====
  let coachUI = null;

  function findTeamPanel(){
    if (!dom.teamScreen) return null;
    // teamPanel がある想定（team.cssの構造）
    return dom.teamScreen.querySelector?.('.teamPanel') || dom.teamScreen;
  }

  function ensureCoachUI(){
    const panel = findTeamPanel();
    if (!panel) return null;

    const existing = panel.querySelector?.('#coachSkillSection');
    if (existing){
      coachUI = {
        root: existing,
        equipRow: existing.querySelector('.coachEquipRow'),
        ownedList: existing.querySelector('.coachOwnedList')
      };
      return coachUI;
    }

    // なるべく下の方に追加：.teamSection の最後の後ろ
    const lastSection = panel.querySelector?.('.teamSection:last-of-type');

    const section = document.createElement('div');
    section.id = 'coachSkillSection';
    section.className = 'teamSection';
    section.style.marginTop = '12px';

    const title = document.createElement('div');
    title.className = 'teamSectionTitle';
    title.textContent = 'コーチスキル（装備：最大3つ）';

    const sub = document.createElement('div');
    sub.style.marginTop = '6px';
    sub.style.fontSize = '13px';
    sub.style.opacity = '0.92';
    sub.style.lineHeight = '1.35';
    sub.textContent = '所持スキルをタップで装備。装備中枠をタップで取り外し。';

    // equipped row
    const equipWrap = document.createElement('div');
    equipWrap.style.marginTop = '10px';

    const equipLabel = document.createElement('div');
    equipLabel.style.fontWeight = '1000';
    equipLabel.style.fontSize = '14px';
    equipLabel.style.opacity = '0.95';
    equipLabel.textContent = '装備中（3枠）';

    const equipRow = document.createElement('div');
    equipRow.className = 'coachEquipRow';
    equipRow.style.display = 'grid';
    equipRow.style.gridTemplateColumns = 'repeat(3, minmax(0, 1fr))';
    equipRow.style.gap = '10px';
    equipRow.style.marginTop = '8px';

    // owned list
    const ownedWrap = document.createElement('div');
    ownedWrap.style.marginTop = '14px';

    const ownedLabel = document.createElement('div');
    ownedLabel.style.fontWeight = '1000';
    ownedLabel.style.fontSize = '14px';
    ownedLabel.style.opacity = '0.95';
    ownedLabel.textContent = '所持一覧（タップで装備）';

    const ownedList = document.createElement('div');
    ownedList.className = 'coachOwnedList';
    ownedList.style.display = 'flex';
    ownedList.style.flexDirection = 'column';
    ownedList.style.gap = '10px';
    ownedList.style.marginTop = '8px';

    section.appendChild(title);
    section.appendChild(sub);

    equipWrap.appendChild(equipLabel);
    equipWrap.appendChild(equipRow);
    section.appendChild(equipWrap);

    ownedWrap.appendChild(ownedLabel);
    ownedWrap.appendChild(ownedList);
    section.appendChild(ownedWrap);

    if (lastSection && lastSection.parentElement){
      lastSection.parentElement.insertBefore(section, lastSection.nextSibling);
    }else{
      panel.appendChild(section);
    }

    coachUI = { root: section, equipRow, ownedList };
    return coachUI;
  }

  function createPillButton(text){
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.style.width = '100%';
    btn.style.border = '0';
    btn.style.borderRadius = '12px';
    btn.style.padding = '10px 10px';
    btn.style.background = 'rgba(255,255,255,.12)';
    btn.style.color = '#fff';
    btn.style.fontWeight = '1000';
    btn.style.fontSize = '13px';
    btn.style.textAlign = 'left';
    btn.style.touchAction = 'manipulation';
    btn.textContent = text;
    btn.addEventListener('touchstart', ()=>{}, {passive:true});
    btn.onmousedown = ()=>{};
    return btn;
  }

  function renderCoachUI(){
    const ui = ensureCoachUI();
    if (!ui) return;

    const owned = readCoachOwned();
    const equipped = readCoachEquipped();

    // ===== equipped 3 slots =====
    ui.equipRow.innerHTML = '';
    for (let i=0;i<3;i++){
      const id = equipped[i];
      const skill = id ? COACH_BY_ID[id] : null;

      const btn = createPillButton('');
      btn.style.background = id ? 'rgba(255,59,48,.18)' : 'rgba(255,255,255,.10)';
      btn.style.border = id ? '1px solid rgba(255,59,48,.38)' : '1px solid rgba(255,255,255,.14)';

      const name = skill ? skill.name : '（空き）';
      const line1 = document.createElement('div');
      line1.style.fontSize = '13px';
      line1.style.fontWeight = '1000';
      line1.textContent = `枠${i+1}：${name}`;

      const line2 = document.createElement('div');
      line2.style.fontSize = '11px';
      line2.style.opacity = '0.92';
      line2.style.marginTop = '4px';
      line2.textContent = skill ? 'タップで取り外し' : '所持一覧から装備';

      btn.textContent = '';
      btn.appendChild(line1);
      btn.appendChild(line2);

      btn.addEventListener('click', ()=>{
        const cur = readCoachEquipped();
        if (!cur[i]) return; // 空は何もしない
        cur[i] = null;
        writeCoachEquipped(cur);
        renderCoachUI();
        alert('取り外しました。');
      });

      ui.equipRow.appendChild(btn);
    }

    // ===== owned list =====
    ui.ownedList.innerHTML = '';

    // 表示順：マスター順
    const hasAny = COACH_SKILLS.some(s => (Number(owned[s.id])||0) > 0);
    if (!hasAny){
      const note = document.createElement('div');
      note.style.opacity = '0.92';
      note.style.fontSize = '13px';
      note.textContent = '所持しているコーチスキルがありません（ショップで購入できます）';
      ui.ownedList.appendChild(note);
      return;
    }

    COACH_SKILLS.forEach(skill=>{
      const cnt = Number(owned[skill.id]) || 0;
      if (cnt <= 0) return;

      const equippedNow = readCoachEquipped();
      const already = countEquipped(skill.id, equippedNow) > 0;

      const btn = createPillButton('');
      btn.style.border = '1px solid rgba(255,255,255,.14)';
      btn.style.background = already ? 'rgba(255,59,48,.16)' : 'rgba(255,255,255,.10)';

      const top = document.createElement('div');
      top.style.display = 'flex';
      top.style.justifyContent = 'space-between';
      top.style.alignItems = 'baseline';
      top.style.gap = '10px';

      const left = document.createElement('div');
      left.style.fontSize = '14px';
      left.style.fontWeight = '1000';
      left.textContent = skill.name;

      const right = document.createElement('div');
      right.style.fontSize = '12px';
      right.style.opacity = '0.95';
      right.textContent = already ? '装備中' : `所持：${cnt}`;

      top.appendChild(left);
      top.appendChild(right);

      const eff = document.createElement('div');
      eff.style.marginTop = '6px';
      eff.style.fontSize = '12px';
      eff.style.opacity = '0.92';
      eff.textContent = skill.effectLabel;

      const line = document.createElement('div');
      line.style.marginTop = '6px';
      line.style.fontSize = '12px';
      line.style.opacity = '0.92';
      line.textContent = `コーチ：「${skill.coachLine}」`;

      btn.textContent = '';
      btn.appendChild(top);
      btn.appendChild(eff);
      btn.appendChild(line);

      btn.addEventListener('click', ()=>{
        const curEq = readCoachEquipped();

        // 同一スキル2枠禁止
        if (curEq.includes(skill.id)){
          alert('このスキルはすでに装備中です。');
          return;
        }

        // 空き枠を探す
        const emptyIdx = curEq.findIndex(v => !v);
        if (emptyIdx === -1){
          alert('装備枠が埋まっています。先にどれか取り外してください。');
          return;
        }

        curEq[emptyIdx] = skill.id;
        writeCoachEquipped(curEq);
        renderCoachUI();
        alert(`装備しました（枠${emptyIdx+1}）。`);
      });

      ui.ownedList.appendChild(btn);
    });
  }

  // ===== main render =====
  function render(){
    // meta
    safeText(dom.tCompany, S.getStr(K.company, 'CB Memory'));
    safeText(dom.tTeam, S.getStr(K.team, 'PLAYER TEAM'));

    // team members + stats
    const team = getPlayerTeam();
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

    // coach skills
    renderCoachUI();
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
      });
    }
  }

  // ===== save =====
  function manualSave(){
    const snap = {
      ver: 'v16',
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

      coachOwned: readCoachOwned(),
      coachEquipped: readCoachEquipped()
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
      'cardPreview'
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

    // open は ui_main のルーティングが担当（ここでは close だけ確実に）
    if (dom.btnCloseTeam){
      dom.btnCloseTeam.addEventListener('click', close);
    }
  }

  // ===== init =====
  function initTeamUI(){
    bindClose();
    bindRename();
    bindSave();

    // 初回：装備配列の形を安定化
    writeCoachEquipped(readCoachEquipped());

    render();
  }

  window.MOBBR.initTeamUI = initTeamUI;

  // ★ calcTeamPower を公開（大会/試合が参照する）
  window.MOBBR.ui.team = { open, close, render, calcTeamPower };

  document.addEventListener('DOMContentLoaded', ()=>{
    initTeamUI();
  });
})();
