'use strict';

/*
  MOB BR - ui_training.js v14（フル）

  今回の目的（あなたの要望）：
  - トレーニングメニューの各項目に「何がアップするか」を表示する
    例）射撃練習：エイム / 敏捷性、総合演習：全能力

  役割：
  - 育成（修行）画面の制御
  - 3人分の修行を選択 → 結果表示 → OKで確定（保存＋1週進行）
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
     - up: ['aim','agi'] のように「対象能力」
     - 'all' の場合は全能力
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

  if (!dom.screen){
    console.warn('[ui_training] #trainingScreen not found');
    return;
  }

  /* =========================
     内部状態（保存しない）
  ========================= */
  let selected = { A:null, B:null, C:null };
  let bound = false;

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
    if (dom.trY) dom.trY.textContent = String(d.y);
    if (dom.trM) dom.trM.textContent = String(d.m);
    if (dom.trW) dom.trW.textContent = String(d.w);
  }

  function allSelected(){
    return !!(selected.A && selected.B && selected.C);
  }

  function memberDisplayName(id){
    if (id === 'A') return S.getStr(K.m1, 'A');
    if (id === 'B') return S.getStr(K.m2, 'B');
    if (id === 'C') return S.getStr(K.m3, 'C');
    return id;
  }

  // ★今回追加：各メニューが「何がアップするか」表示用
  function trainingUpLabel(tr){
    if (!tr) return '';
    if (tr.up === 'all') return '全能力';

    // DP.STAT_LABEL を使って日本語ラベル化
    const labels = [];
    for (const k of tr.up){
      const lb = DP.STAT_LABEL?.[k] || k;
      labels.push(lb);
    }
    return labels.join(' / ');
  }

  /* =========================
     UI生成
  ========================= */
  function renderCards(){
    if (!dom.cards) return;
    dom.cards.innerHTML = '';

    // A/B/C だけ固定で扱う（チーム構成が変わっても壊れにくい）
    const members = [
      { id:'A' },
      { id:'B' },
      { id:'C' }
    ];

    for (const mem of members){
      const wrap = document.createElement('div');
      wrap.className = 'trainingCard';

      const title = document.createElement('div');
      title.className = 'trainingMember';
      title.textContent = memberDisplayName(mem.id);

      const list = document.createElement('div');
      list.className = 'trainingMenuList';

      for (const tr of TRAININGS){
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'trainingMenuBtn';

        // ▼ボタン内を2段に：メニュー名 + 伸びる能力
        const t1 = document.createElement('div');
        t1.className = 'trBtnName';
        t1.textContent = tr.name;

        const t2 = document.createElement('div');
        t2.className = 'trBtnUp';
        t2.textContent = trainingUpLabel(tr);

        btn.appendChild(t1);
        btn.appendChild(t2);

        // 選択状態
        if (selected[mem.id]?.id === tr.id){
          btn.classList.add('selected');
        }

        btn.addEventListener('click', ()=>{
          selected[mem.id] = tr;
          renderCards();
          if (dom.btnStart) dom.btnStart.disabled = !allSelected();
        });

        list.appendChild(btn);
      }

      wrap.appendChild(title);
      wrap.appendChild(list);
      dom.cards.appendChild(wrap);
    }
  }

  /* =========================
     結果計算（まだ保存しない）
  ========================= */
  function calcResult(){
    const result = [];

    const members = [
      { id:'A' },
      { id:'B' },
      { id:'C' }
    ];

    for (const mem of members){
      const tr = selected[mem.id];
      const add = {};

      // 共通EXP +1（全能力）
      for (const k of DP.STAT_KEYS){
        add[k] = 1;
      }

      // 専門 or 総合
      if (tr.up === 'all'){
        for (const k of DP.STAT_KEYS){
          add[k] += 1; // 合計 +2
        }
      }else{
        for (const k of tr.up){
          add[k] += 3; // 合計 +4
        }
      }

      result.push({
        id: mem.id,
        name: memberDisplayName(mem.id),
        training: tr.name,
        upLabel: trainingUpLabel(tr),
        expAdd: add
      });
    }

    return result;
  }

  /* =========================
     結果表示
  ========================= */
  function showResult(result){
    if (dom.resultSec) dom.resultSec.style.display = 'block';
    if (dom.resultTop) dom.resultTop.textContent = '修行完了！';

    if (!dom.resultList) return;
    dom.resultList.innerHTML = '';

    for (const r of result){
      const div = document.createElement('div');
      div.className = 'trainingResultRow';
      // 文章演出のみ（数値は出さない）
      div.textContent = `${r.name}は${r.training}に集中した！ (${r.upLabel})`;
      dom.resultList.appendChild(div);
    }
  }

  /* =========================
     確定処理（OK/NEXT）
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

    // メンバーが壊れてたら復旧
    if (!team || !Array.isArray(team.members)){
      team = DP.buildDefaultTeam();
    }

    // EXP反映（余りは繰り越し / 20でLv+1）
    for (const mem of team.members){
      const r = result.find(x=>x.id===mem.id);
      if (!r) continue;

      mem.exp = DP.normalizeExp(mem.exp);
      mem.lv  = DP.normalizeLv(mem.lv);

      for (const k of DP.STAT_KEYS){
        mem.exp[k] += r.expAdd[k];

        while (mem.exp[k] >= 20){
          mem.exp[k] -= 20;
          mem.lv[k] += 1;
        }
      }
    }

    localStorage.setItem(K.playerTeam, JSON.stringify(team));

    // 週進行（ここは既存仕様のまま）
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

    // 画面再描画
    if (window.MOBBR.initMainUI) window.MOBBR.initMainUI();
    if (window.MOBBR.ui?.team?.render) window.MOBBR.ui.team.render();
  }

  /* =========================
     open / close
  ========================= */
  function open(){
    selected = { A:null, B:null, C:null };
    if (dom.resultSec) dom.resultSec.style.display = 'none';
    if (dom.btnStart) dom.btnStart.disabled = true;

    updateDateUI();
    renderCards();

    dom.screen.classList.add('show');
    dom.screen.setAttribute('aria-hidden', 'false');
  }

  function close(){
    dom.screen.classList.remove('show');
    dom.screen.setAttribute('aria-hidden', 'true');
  }

  /* =========================
     bind
  ========================= */
  function bind(){
    if (bound) return;
    bound = true;

    if (dom.close) dom.close.addEventListener('click', close);

    if (dom.btnStart){
      dom.btnStart.addEventListener('click', ()=>{
        if (!allSelected()) return;
        const result = calcResult();
        showResult(result);

        if (dom.btnOk){
          dom.btnOk.onclick = () => {
            commit(result);
          };
        }
      });
    }
  }

  function initTrainingUI(){
    bind();
  }

  window.MOBBR.initTrainingUI = initTrainingUI;
  window.MOBBR.ui.training = { open, close };

  document.addEventListener('DOMContentLoaded', initTrainingUI);
})();
