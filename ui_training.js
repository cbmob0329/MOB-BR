'use strict';

/*
  MOB BR - ui_training.js v14（フル）

  役割：
  - 育成（修行）画面の制御
  - 3人分の修行を選択 → 確認 → 実行
  - 結果表示 → NEXTで確定（保存＋1週進行）

  設計方針（重要）：
  - 途中状態は保存しない（事故防止）
  - 保存・週進行は「結果NEXT」の1箇所のみ
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){
  const $ = (id) => document.getElementById(id);

  const S  = window.MOBBR?.storage;
  const DP = window.MOBBR?.data?.player;

  if (!S || !DP){
    console.warn('[ui_training] storage.js / data_player.js not found');
    return;
  }

  const K = S.KEYS;

  /* =========================
     修行メニュー定義（確定仕様）
  ========================= */
  const TRAININGS = [
    { id:'shoot',  name:'射撃練習',  up:['aim','agi'] },
    { id:'dash',   name:'ダッシュ',  up:['agi','hp'] },
    { id:'puzzle', name:'パズル',    up:['tech','mental'] },
    { id:'battle', name:'実戦練習',  up:['aim','hp'] },
    { id:'water',  name:'滝修行',    up:['mental','hp'] },
    { id:'lab',    name:'研究',      up:['tech','support'] },
    { id:'all',    name:'総合演習',  up:'all' }
  ];

  /* =========================
     DOM
  ========================= */
  const dom = {
    screen: $('trainingScreen'),
    close: $('btnCloseTraining'),

    trY: $('trY'),
    trM: $('trM'),
    trW: $('trW'),

    cards: $('trainingCards'),
    btnStart: $('btnTrainingStart'),

    resultSec: $('trainingResultSection'),
    resultTop: $('trainingResultTop'),
    resultList: $('trainingResultList'),
    btnOk: $('btnTrainingOk')
  };

  /* =========================
     内部状態（保存しない）
  ========================= */
  let selected = {
    A: null,
    B: null,
    C: null
  };

  /* =========================
     ユーティリティ
  ========================= */
  function getDate(){
    return {
      y: S.getNum(K.year, 1989),
      m: S.getNum(K.month, 1),
      w: S.getNum(K.week, 1)
    };
  }

  function updateDateUI(){
    const d = getDate();
    if (dom.trY) dom.trY.textContent = d.y;
    if (dom.trM) dom.trM.textContent = d.m;
    if (dom.trW) dom.trW.textContent = d.w;
  }

  function allSelected(){
    return selected.A && selected.B && selected.C;
  }

  /* =========================
     UI生成
  ========================= */
  function renderCards(){
    if (!dom.cards) return;
    dom.cards.innerHTML = '';

    const team = DP.buildDefaultTeam();
    team.members.forEach(mem=>{
      const wrap = document.createElement('div');
      wrap.className = 'trainingCard';

      const title = document.createElement('div');
      title.className = 'trainingMember';
      title.textContent = mem.name || mem.id;

      const list = document.createElement('div');
      list.className = 'trainingMenuList';

      TRAININGS.forEach(tr=>{
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'trainingMenuBtn';
        btn.textContent = tr.name;

        if (selected[mem.id]?.id === tr.id){
          btn.classList.add('selected');
        }

        btn.addEventListener('click', ()=>{
          selected[mem.id] = tr;
          renderCards();
          dom.btnStart.disabled = !allSelected();
        });

        list.appendChild(btn);
      });

      wrap.appendChild(title);
      wrap.appendChild(list);
      dom.cards.appendChild(wrap);
    });
  }

  /* =========================
     結果計算（まだ保存しない）
  ========================= */
  function calcResult(){
    const team = DP.buildDefaultTeam();
    const result = [];

    team.members.forEach(mem=>{
      const tr = selected[mem.id];
      const add = {};

      // 共通EXP +1
      DP.STAT_KEYS.forEach(k=>{
        add[k] = 1;
      });

      // 専門 or 総合
      if (tr.up === 'all'){
        DP.STAT_KEYS.forEach(k=>{
          add[k] += 1; // 合計 +2
        });
      }else{
        tr.up.forEach(k=>{
          add[k] += 3; // 合計 +4
        });
      }

      result.push({
        id: mem.id,
        name: mem.name || mem.id,
        training: tr.name,
        expAdd: add
      });
    });

    return result;
  }

  /* =========================
     結果表示
  ========================= */
  function showResult(result){
    dom.resultSec.style.display = 'block';
    dom.resultTop.textContent = '修行完了！';

    dom.resultList.innerHTML = '';
    result.forEach(r=>{
      const div = document.createElement('div');
      div.className = 'trainingResultRow';
      div.textContent =
        `${r.name}は${r.training}を行った！ 成長を感じている`;
      dom.resultList.appendChild(div);
    });
  }

  /* =========================
     確定処理（NEXT）
  ========================= */
  function commit(result){
    // playerTeam を取得 or 初期生成
    let team;
    try{
      const raw = localStorage.getItem(K.playerTeam);
      team = raw ? JSON.parse(raw) : DP.buildDefaultTeam();
    }catch{
      team = DP.buildDefaultTeam();
    }

    // EXP反映
    team.members.forEach(mem=>{
      const r = result.find(x=>x.id===mem.id);
      if (!r) return;

      mem.exp = DP.normalizeExp(mem.exp);
      mem.lv  = DP.normalizeLv(mem.lv);

      DP.STAT_KEYS.forEach(k=>{
        mem.exp[k] += r.expAdd[k];

        while (mem.exp[k] >= 20){
          mem.exp[k] -= 20;
          mem.lv[k] += 1;
        }
      });
    });

    localStorage.setItem(K.playerTeam, JSON.stringify(team));

    // 週進行
    let { y,m,w } = getDate();
    w++;
    if (w >= 5){
      w = 1;
      m++;
      if (m >= 13){
        m = 1;
        y++;
      }
    }
    S.setNum(K.year, y);
    S.setNum(K.month, m);
    S.setNum(K.week, w);

    S.setStr(K.recent, '修行を行い、チームの地力が上がった');

    close();
    if (window.MOBBR.initMainUI) window.MOBBR.initMainUI();
    if (window.MOBBR.ui?.team?.render) window.MOBBR.ui.team.render();
  }

  /* =========================
     open / close
  ========================= */
  function open(){
    selected = { A:null, B:null, C:null };
    dom.resultSec.style.display = 'none';
    dom.btnStart.disabled = true;
    updateDateUI();
    renderCards();
    dom.screen.classList.add('show');
  }

  function close(){
    dom.screen.classList.remove('show');
  }

  /* =========================
     bind
  ========================= */
  function bind(){
    if (dom.close) dom.close.addEventListener('click', close);

    dom.btnStart.addEventListener('click', ()=>{
      if (!allSelected()) return;
      const result = calcResult();
      showResult(result);

      dom.btnOk.onclick = ()=>{
        commit(result);
      };
    });
  }

  function initTrainingUI(){
    bind();
  }

  window.MOBBR.initTrainingUI = initTrainingUI;
  window.MOBBR.ui.training = { open, close };

  document.addEventListener('DOMContentLoaded', initTrainingUI);
})();
