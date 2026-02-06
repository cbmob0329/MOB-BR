'use strict';

/*
  MOB BR - ui_training.js v15（フル）

  修正ポイント（重要）：
  - 修行開始ボタンは「1つのみ」
  - 結果は「別ポップアップ」で表示（育成画面は強制クローズ）
  - 結果ポップアップを閉じた瞬間に
      ・能力EXP/Lv反映
      ・週進行
      ・企業ランクに応じたG獲得
      ・中央ログ更新
  - 結果表示中は「閉じる/戻る」不可（事故防止）
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){
  const $ = (id)=>document.getElementById(id);

  const S  = window.MOBBR?.storage;
  const DP = window.MOBBR?.data?.player;
  if (!S || !DP){
    console.warn('[ui_training] storage.js / data_player.js not found');
    return;
  }
  const K = S.KEYS;

  /* =========================
     修行メニュー（確定）
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
    // 育成画面
    screen: $('trainingScreen'),
    btnClose: $('btnCloseTraining'),
    y: $('trY'),
    m: $('trM'),
    w: $('trW'),
    cards: $('trainingCards'),
    btnStart: $('btnTrainingStart'),

    // 結果ポップアップ（別）
    resultPop: $('trainingResultPop'),
    resultTitle: $('trainingResultTitle'),
    resultText: $('trainingResultText'),
    btnResultOk: $('btnTrainingResultOk'),

    modalBack: $('modalBack')
  };

  /* =========================
     内部状態（保存しない）
  ========================= */
  let selected = { A:null, B:null, C:null };
  let pendingResult = null;

  /* =========================
     日付/G
  ========================= */
  function getDate(){
    return {
      y: S.getNum(K.year,1989),
      m: S.getNum(K.month,1),
      w: S.getNum(K.week,1)
    };
  }
  function setDate(y,m,w){
    S.setNum(K.year,y);
    S.setNum(K.month,m);
    S.setNum(K.week,w);
  }

  function weeklyGoldByRank(rank){
    if (rank<=5) return 500;
    if (rank<=10) return 800;
    if (rank<=20) return 1000;
    if (rank<=30) return 2000;
    return 3000;
  }

  /* =========================
     UI
  ========================= */
  function updateDateUI(){
    const d = getDate();
    if (dom.y) dom.y.textContent = d.y;
    if (dom.m) dom.m.textContent = d.m;
    if (dom.w) dom.w.textContent = d.w;
  }

  function allSelected(){
    return selected.A && selected.B && selected.C;
  }

  function renderCards(){
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
        const b = document.createElement('button');
        b.type = 'button';
        b.textContent = tr.name;
        b.className = 'trainingMenuBtn';

        if (selected[mem.id]?.id === tr.id) b.classList.add('selected');

        b.onclick = ()=>{
          selected[mem.id] = tr;
          renderCards();
          dom.btnStart.disabled = !allSelected();
        };
        list.appendChild(b);
      });

      wrap.appendChild(title);
      wrap.appendChild(list);
      dom.cards.appendChild(wrap);
    });
  }

  /* =========================
     結果計算（まだ反映しない）
  ========================= */
  function calcResult(){
    const team = DP.buildDefaultTeam();
    const out = [];

    team.members.forEach(mem=>{
      const tr = selected[mem.id];
      const add = {};
      DP.STAT_KEYS.forEach(k=>add[k]=1); // 共通+1

      if (tr.up==='all'){
        DP.STAT_KEYS.forEach(k=>add[k]+=1); // 合計+2
      }else{
        tr.up.forEach(k=>add[k]+=3); // 合計+4
      }

      out.push({
        id: mem.id,
        name: mem.name||mem.id,
        training: tr.name,
        expAdd: add
      });
    });
    return out;
  }

  /* =========================
     結果ポップアップ
  ========================= */
  function showResultPop(result){
    pendingResult = result;

    const lines = [];
    lines.push('修行完了！');
    lines.push('全能力に共通ボーナス +1 EXP');
    result.forEach(r=>{
      lines.push(`${r.name}は${r.training}に集中した！`);
    });
    lines.push('チーム全体の地力が少し上がった');

    dom.resultTitle.textContent = '修行結果';
    dom.resultText.textContent = lines.join('\n');

    dom.modalBack.style.display='block';
    dom.resultPop.style.display='block';
  }

  function hideResultPop(){
    dom.resultPop.style.display='none';
    dom.modalBack.style.display='none';
  }

  /* =========================
     確定処理（能力反映＋週進行）
  ========================= */
  function commit(){
    if (!pendingResult) return;

    let team;
    try{
      const raw = localStorage.getItem(K.playerTeam);
      team = raw ? JSON.parse(raw) : DP.buildDefaultTeam();
    }catch{
      team = DP.buildDefaultTeam();
    }

    team.members.forEach(mem=>{
      const r = pendingResult.find(x=>x.id===mem.id);
      if (!r) return;

      mem.exp = DP.normalizeExp(mem.exp);
      mem.lv  = DP.normalizeLv(mem.lv);

      DP.STAT_KEYS.forEach(k=>{
        mem.exp[k]+=r.expAdd[k];
        while(mem.exp[k]>=20){
          mem.exp[k]-=20;
          mem.lv[k]+=1;
        }
      });
    });

    localStorage.setItem(K.playerTeam, JSON.stringify(team));

    // 週進行
    let {y,m,w} = getDate();
    w++;
    if (w>=5){ w=1; m++; if (m>=13){ m=1; y++; } }
    setDate(y,m,w);

    const rank = S.getNum(K.rank,10);
    const gain = weeklyGoldByRank(rank);
    S.setNum(K.gold, S.getNum(K.gold,0)+gain);

    S.setStr(
      K.recent,
      `${y}年${m}月 第${w}週｜企業ランク${rank}により${gain}G獲得！`
    );

    pendingResult = null;
  }

  /* =========================
     open / close
  ========================= */
  function open(){
    selected = {A:null,B:null,C:null};
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
    dom.btnClose.onclick = ()=>{}; // 無効化

    dom.btnStart.onclick = ()=>{
      if (!allSelected()) return;
      const r = calcResult();
      close();                 // 強制クローズ
      showResultPop(r);        // 結果は別ポップ
    };

    dom.btnResultOk.onclick = ()=>{
      commit();
      hideResultPop();
      if (window.MOBBR.initMainUI) window.MOBBR.initMainUI();
      if (window.MOBBR.ui?.team?.render) window.MOBBR.ui.team.render();
    };
  }

  function init(){
    bind();
  }

  window.MOBBR.initTrainingUI = init;
  window.MOBBR.ui.training = { open };

  document.addEventListener('DOMContentLoaded', init);
})();
