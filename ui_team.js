'use strict';

/*
  MOB BR - ui_team.js v14（フル）

  目的（v14での変更点）：
  1) チーム画面に「チーム総合戦闘力%」を表示（※この画面だけ例外で%表示）
  2) チーム画面の表示データは localStorage の mobbr_playerTeam を参照
     - 育成で増えた exp/lv を反映して表示する
  3) A/B/C の名前変更は storage(m1/m2/m3) に保存し、playerTeam にも同期
  4) 手動セーブ / セーブ削除（完全リセット→タイトルへ）は維持

  前提：
  - storage.js / data_player.js が先に読み込まれていること
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

  // ===== DOM（あなたのHTMLのIDに合わせる）=====
  const dom = {
    // open/close
    btnTeam: $('btnTeam'),
    teamScreen: $('teamScreen'),
    btnCloseTeam: $('btnCloseTeam'),

    // meta
    tCompany: $('tCompany'),
    tTeam: $('tTeam'),

    // names
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

    // save buttons
    btnManualSave: $('btnManualSave'),
    btnDeleteSave: $('btnDeleteSave')
  };

  // ===== internal =====
  let bound = false;

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

  // ===== playerTeam load/save =====
  function loadPlayerTeam(){
    try{
      const raw = localStorage.getItem(K.playerTeam);
      if (!raw) return DP.buildDefaultTeam();
      const team = JSON.parse(raw);
      if (!team || !Array.isArray(team.members)) return DP.buildDefaultTeam();
      return team;
    }catch(e){
      return DP.buildDefaultTeam();
    }
  }

  function savePlayerTeam(team){
    try{
      localStorage.setItem(K.playerTeam, JSON.stringify(team));
    }catch(e){
      // ignore
    }
  }

  // storage の m1/m2/m3 を playerTeam.members の name に同期
  function syncNamesToPlayerTeam(team){
    const nm1 = getNameA();
    const nm2 = getNameB();
    const nm3 = getNameC();

    const bySlot = [...team.members].sort((a,b)=> (a.slot||0)-(b.slot||0));
    if (bySlot[0]) bySlot[0].name = nm1;
    if (bySlot[1]) bySlot[1].name = nm2;
    if (bySlot[2]) bySlot[2].name = nm3;
  }

  // ===== 成長反映：表示用の「実効ステータス」 =====
  // ※仕様に「Lvが何を増やすか」明記が無いので、バグりにくい最小ルール：
  //    Lv 1=変化なし / Lvが1上がるごとに、そのステータス +1（表示も計算も同じ）
  function effectiveStats(member){
    const base = DP.normalizeStats(member?.stats);
    const lv   = DP.normalizeLv(member?.lv);

    const out = {};
    for (const k of DP.STAT_KEYS){
      const baseV = Number(base[k] ?? 0);
      const lvV = Number(lv[k] ?? 1);
      const bonus = Math.max(0, (lvV - 1));
      out[k] = baseV + bonus;
    }
    return out;
  }

  // ===== チーム総合戦闘力%（表示用） =====
  // 仕様（ユーザー提供）：
  // - 重み合計1.0（armor含む）
  // - チーム基礎：3人平均
  // - チーム総合力% = round(平均 + 3)
  // ※ armorは data_player に無いので、常に100として扱う（表示はしない）
  const WEIGHTS = {
    aim: 0.25,
    mental: 0.15,
    agi: 0.10,
    tech: 0.10,
    support: 0.10,
    scan: 0.10,
    armor: 0.10,
    hp: 0.10
  };

  function memberPower0to100(member){
    const st = effectiveStats(member);
    const armor = Number(member?.armor ?? 100); // 無ければ100固定
    const val =
      (Number(st.aim)    * WEIGHTS.aim) +
      (Number(st.mental) * WEIGHTS.mental) +
      (Number(st.agi)    * WEIGHTS.agi) +
      (Number(st.tech)   * WEIGHTS.tech) +
      (Number(st.support)* WEIGHTS.support) +
      (Number(st.scan)   * WEIGHTS.scan) +
      (Number(armor)     * WEIGHTS.armor) +
      (Number(st.hp)     * WEIGHTS.hp);

    // 0-100想定だけど、念のためクランプ
    return Math.max(0, Math.min(100, val));
  }

  function teamPowerPercent(team){
    const mems = Array.isArray(team?.members) ? team.members : [];
    if (mems.length < 3) return 0;

    const avg = (memberPower0to100(mems[0]) + memberPower0to100(mems[1]) + memberPower0to100(mems[2])) / 3;
    return Math.round(avg + 3);
  }

  // ===== チーム画面に「総合戦闘力」行を注入（HTMLを増やさずに安全に） =====
  function ensurePowerLine(){
    if (!dom.teamScreen) return;

    const meta = dom.teamScreen.querySelector('.teamMeta');
    if (!meta) return;

    if (meta.querySelector('#tPower')) return;

    const line = document.createElement('div');
    line.className = 'teamLine';
    line.id = 'tPower';
    line.textContent = 'チーム総合戦闘力：--%';
    meta.appendChild(line);
  }

  function render(){
    // meta
    safeText(dom.tCompany, S.getStr(K.company, 'CB Memory'));
    safeText(dom.tTeam, S.getStr(K.team, 'PLAYER TEAM'));

    // playerTeam load + name sync
    const team = loadPlayerTeam();
    syncNamesToPlayerTeam(team);
    savePlayerTeam(team);

    // power line
    ensurePowerLine();
    const pEl = $('tPower') || (dom.teamScreen ? dom.teamScreen.querySelector('#tPower') : null);
    if (pEl){
      const p = teamPowerPercent(team);
      pEl.textContent = `チーム総合戦闘力：${p}%`;
    }

    // members by id (A/B/C)
    const byId = {};
    for (const m of (team.members || [])) byId[m.id] = m;

    // names (buttons)
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

    // A
    const A = byId.A;
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
    const B = byId.B;
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
    const C = byId.C;
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

  function renamePrompt(which){
    let label = '';
    let cur = '';
    let setter = null;

    if (which === 'A'){ label = 'メンバー名（A）を変更'; cur = getNameA(); setter = setNameA; }
    if (which === 'B'){ label = 'メンバー名（B）を変更'; cur = getNameB(); setter = setNameB; }
    if (which === 'C'){ label = 'メンバー名（C）を変更'; cur = getNameC(); setter = setNameC; }
    if (!setter) return;

    const v = prompt(label, cur);
    if (v === null) return;
    const nv = v.trim();
    if (!nv) return;

    setter(nv);

    // playerTeamにも同期
    const team = loadPlayerTeam();
    syncNamesToPlayerTeam(team);
    savePlayerTeam(team);

    // 他UIにも反映（main側は ui_main.js がrenderする想定だが、ここでも最低限）
    render();
    if (window.MOBBR?.initMainUI) window.MOBBR.initMainUI();
  }

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
      playerTeam: loadPlayerTeam()
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

  function bind(){
    if (bound) return;
    bound = true;

    // open/close
    if (dom.btnTeam) dom.btnTeam.addEventListener('click', open);
    if (dom.btnCloseTeam) dom.btnCloseTeam.addEventListener('click', close);

    // rename
    if (dom.tNameA) dom.tNameA.addEventListener('click', ()=> renamePrompt('A'));
    if (dom.tNameB) dom.tNameB.addEventListener('click', ()=> renamePrompt('B'));
    if (dom.tNameC) dom.tNameC.addEventListener('click', ()=> renamePrompt('C'));

    // save
    if (dom.btnManualSave) dom.btnManualSave.addEventListener('click', manualSave);
    if (dom.btnDeleteSave) dom.btnDeleteSave.addEventListener('click', deleteSaveAndReset);
  }

  function initTeamUI(){
    bind();

    // 起動時にも playerTeam が無ければ作っておく（壊れ防止）
    const team = loadPlayerTeam();
    syncNamesToPlayerTeam(team);
    savePlayerTeam(team);

    // 開かなくても安全に初回render
    render();
  }

  window.MOBBR.initTeamUI = initTeamUI;
  window.MOBBR.ui.team = { open, close, render };

  // 動的ロード後でも確実に初期化（DOMContentLoaded待ちにしない）
  initTeamUI();
})();
