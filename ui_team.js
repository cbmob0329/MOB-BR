'use strict';

/*
  MOB BR - ui_team.js v13（HTML固定レイアウト対応版）

  目的：
  - #teamScreen の中身を「確定仕様ベース」で動かす
    1) A/B/C の名前変更（タップで変更）→ storageのm1/m2/m3へ反映 → 全UIへ反映
    2) ステータス7種（数値）・パッシブ・ウルトを表示
    3) セーブ：手動セーブ（簡易スナップショット保存）
    4) セーブ削除：完全リセット → タイトルへ戻る → 次のNEXTで名称入力からやり直し
  前提：
  - storage.js / data_player.js が先に読み込まれていること
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){
  const $ = (id) => document.getElementById(id);

  const S = window.MOBBR?.storage;
  const DP = window.MOBBR?.data?.player;

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

  function getDefaultTeam(){
    // data_player.js の確定データ
    return DP.buildDefaultTeam();
  }

  // ===== render all UI names (main + team) =====
  function reflectNamesEverywhere(){
    // team screen buttons
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

  function render(){
    // meta
    safeText(dom.tCompany, S.getStr(K.company, 'CB Memory'));
    safeText(dom.tTeam, S.getStr(K.team, 'PLAYER TEAM'));

    // members + stats
    const team = getDefaultTeam();
    const byId = {};
    for (const m of team.members) byId[m.id] = m;

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
        reflectNamesEverywhere();
      });
    }
  }

  // ===== save =====
  function manualSave(){
    // まずは「現状の重要情報だけ」スナップショット（将来ここに育成/所持品などを足す）
    const snap = {
      ver: 'v13',
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

  function deleteSaveAndReset(){
    if (!confirm('セーブ削除すると、スケジュール／名前／戦績／持ち物／育成など全てリセットされます。\n本当に実行しますか？')) return;

    // ★完全リセット → タイトルへ
    // ★次のNEXTで「企業/チーム/メンバー名の入力」→ 1989年1月第1週から
    if (window.MOBBR?.storage?.resetAll){
      window.MOBBR.storage.resetAll();
    }else{
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
    // 初回描画（開かなくても安全）
    render();
  }

  window.MOBBR.initTeamUI = initTeamUI;
  window.MOBBR.ui.team = { open, close, render };

  document.addEventListener('DOMContentLoaded', ()=>{
    initTeamUI();
  });
})();
