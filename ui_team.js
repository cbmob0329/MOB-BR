'use strict';

/*
  MOB BR - ui_team.js v15（カード効果込み総合% + リセット時全ポップアップ閉じ）

  目的（追加分）：
  - チーム画面で「総合戦闘力%」の右に
      赤文字：カード効果込み総合%
      小文字：カード効果！
    を表示する
  - セーブ削除（完全リセット）時に、残っているポップアップ/モーダル/スクリーンを全て閉じる
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){
  const $ = (id) => document.getElementById(id);

  const S  = window.MOBBR?.storage;
  const DP = window.MOBBR?.data?.player;
  const DC = window.MOBBR?.data?.cards; // あればカードボーナス計算に使う

  if (!S || !S.KEYS){
    console.warn('[ui_team] storage.js not found');
    return;
  }
  if (!DP){
    console.warn('[ui_team] data_player.js not found');
    return;
  }

  // ===== DOM =====
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

    // =====（任意）総合%表示（存在すれば使う）
    // 既存IDが分からないので、以下のどれかがあれば拾う：
    //  - tTeamPower （ベース総合%表示の要素）
    //  - tTeamPowerRow / tTeamPowerWrap （行コンテナ）
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

    // save buttons（あなたのHTML）
    btnManualSave: $('btnManualSave'),
    btnDeleteSave: $('btnDeleteSave')
  };

  // ===== keys =====
  const K = S.KEYS;

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
    // 育成で保存される mobbr_playerTeam があればそちらを優先
    try{
      const raw = localStorage.getItem(K.playerTeam);
      if (raw){
        const t = JSON.parse(raw);
        if (t && Array.isArray(t.members)) return t;
      }
    }catch(e){}
    return DP.buildDefaultTeam();
  }

  // ===== render all UI names (main + team) =====
  function reflectNamesEverywhere(){
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

  // ===== チーム総合%計算（カード無しベース / カード込み） =====
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

  function calcCharBasePower(stats){
    // stats に armor が無ければ「100固定」を採用（仕様上：アーマー100が前提）
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

    // 0-100に丸め
    return Math.max(0, Math.min(100, total));
  }

  function calcTeamBasePercent(team){
    // 3人平均 → round(平均 + 3)
    const members = Array.isArray(team?.members) ? team.members : [];
    if (members.length === 0) return 0;

    const vals = members.slice(0,3).map(m => calcCharBasePower(m?.stats || {}));
    const avg = vals.reduce((a,b)=>a+b,0) / vals.length;

    return Math.round(avg + 3);
  }

  // 所持カードから CollectionBonus% を合計（例：SSR×5 -> 0.27）
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

      // 1..10 の範囲で効果計算（11枚目以降はG変換で残らない前提だが保険）
      const effCnt = Math.max(0, Math.min(10, cnt));
      sum += DC.calcSingleCardPercent(card.rarity, effCnt);
    }

    // 小数が大きくなりすぎないよう保険
    if (!Number.isFinite(sum)) return 0;
    return Math.max(0, sum);
  }

  // ===== 総合%表示（DOMが分からなくても壊れないように “後付けUI”） =====
  function ensureCardPowerUI(){
    // 置き場所候補：tTeamPower（ベース%の要素） → その直後に追加
    // もしくは tTeamPowerRow / tTeamPowerWrap があればそこに追加
    const baseEl = dom.tTeamPower;
    const rowEl = dom.tTeamPowerRow || dom.tTeamPowerWrap || (baseEl ? baseEl.parentElement : null);

    if (!rowEl) return { baseEl: null, cardEl: null, labelEl: null };

    // 既に作ってあれば返す
    const existingCard = rowEl.querySelector?.('.teamPowerCard');
    const existingLabel = rowEl.querySelector?.('.teamPowerCardLabel');
    if (existingCard && existingLabel) return { baseEl, cardEl: existingCard, labelEl: existingLabel };

    // 作る（赤文字：カード込み総合% / 小文字：カード効果！）
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

    // baseEl があるならその直後へ、無ければrow末尾へ
    if (baseEl && baseEl.parentElement === rowEl){
      // baseElがrow直下の想定。直後に追加
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

  function renderTeamPower(){
    // ベース%（カード無し）と、カード込み% を表示
    const team = getPlayerTeam();
    const base = calcTeamBasePercent(team);

    // ベース表示（既存要素がある場合だけ）
    if (dom.tTeamPower){
      dom.tTeamPower.textContent = `${base}%`;
    }

    // カード込み表示（後付け）
    const ui = ensureCardPowerUI();
    if (ui.cardEl){
      const bonus = calcCollectionBonusPercent(); // 例 0.27
      const total = base + bonus;

      // 表示は「小数2桁」固定（カードが0なら .00 になるが、赤表示の意味はある）
      // 嫌なら後で .00 の時だけ整数表示に変える
      ui.cardEl.textContent = `${total.toFixed(2)}%`;
    }
  }

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

    // names
    reflectNamesEverywhere();

    // team power (base + card total)
    renderTeamPower();
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
  function bindRename(){
    if (dom.tNameA){
      dom.tNameA.addEventListener('click', ()=>{
        const cur = getNameA();
        const v = prompt('メンバー名（A）を変更', cur);
        if (v === null) return;
        const nv = v.trim();
        if (!nv) return;
        setNameA(nv);

        // playerTeam の name も同期（main/team/trainingなど全画面用）
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
      ver: 'v15',
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
      'cardPreview'
    ];

    const idsRemoveShow = [
      'teamScreen',
      'trainingScreen',
      'shopScreen',
      'cardScreen'
    ];

    // modalBack
    const back = $('modalBack');
    if (back){
      back.style.display = 'none';
      back.setAttribute('aria-hidden', 'true');
    }

    // display none
    idsHideDisplay.forEach(id=>{
      const el = $(id);
      if (el){
        el.style.display = 'none';
        el.setAttribute('aria-hidden', 'true');
      }
    });

    // remove .show
    idsRemoveShow.forEach(id=>{
      const el = $(id);
      if (el){
        el.classList.remove('show');
        el.setAttribute('aria-hidden', 'true');
      }
    });

    // shop result area
    const shopResult = $('shopResult');
    if (shopResult) shopResult.style.display = 'none';

    // training result section（古いDOMが残ってる保険）
    const trainingResultSection = $('trainingResultSection');
    if (trainingResultSection) trainingResultSection.style.display = 'none';
  }

  function deleteSaveAndReset(){
    if (!confirm('セーブ削除すると、スケジュール／名前／戦績／持ち物／育成など全てリセットされます。\n本当に実行しますか？')) return;

    // ★ここが今回の重要修正：先に全部閉じる
    closeAllOverlays();

    // ★完全リセット → タイトルへ
    if (window.MOBBR?.storage?.resetAll){
      window.MOBBR.storage.resetAll();
    }else{
      localStorage.clear();
      location.reload();
    }
  }

  function bindSave(){
    if (dom.btnManualSave){
      dom.btnManualSave.addEventListener('click', manualSave);
    }
    if (dom.btnDeleteSave){
      dom.btnDeleteSave.addEventListener('click', deleteSaveAndReset);
    }
  }

  function bindOpenClose(){
    if (dom.btnTeam) dom.btnTeam.addEventListener('click', open);
    if (dom.btnCloseTeam) dom.btnCloseTeam.addEventListener('click', close);
  }

  // ===== init =====
  function initTeamUI(){
    bindOpenClose();
    bindRename();
    bindSave();
    render();
  }

  window.MOBBR.initTeamUI = initTeamUI;
  window.MOBBR.ui.team = { open, close, render };

  document.addEventListener('DOMContentLoaded', ()=>{
    initTeamUI();
  });
})();
