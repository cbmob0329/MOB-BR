'use strict';

/*
  MOB BR - ui_training.js v14（フル・作り直し）

  目的（今回の修正点）：
  1) 「修行結果 → OKで確定（EXP/Lv反映）→ 1週進行 → ランク報酬G獲得ポップアップ」
     の2段階演出を“必ず”通す（取りこぼし事故ゼロ）
  2) 結果表示中は「閉じる」を無効化（OKしないと確定しない）
  3) メニューの各項目に「何が上がるか」を2段表示で明示

  重要方針：
  - 途中状態は保存しない（選択中はlocalStorageを触らない）
  - 保存・週進行・報酬G加算は「結果OK」1箇所だけ
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){
  const $ = (id) => document.getElementById(id);

  const S  = window.MOBBR?.storage;
  const DP = window.MOBBR?.data?.player;

  if (!S || !S.KEYS || !DP){
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
    // screen
    screen: $('trainingScreen'),
    close: $('btnCloseTraining'),

    // date
    trY: $('trY'),
    trM: $('trM'),
    trW: $('trW'),

    // selection area
    cards: $('trainingCards'),
    btnStart: $('btnTrainingStart'),
    note: $('trainingNote'),

    // result area (inside training panel)
    resultSec: $('trainingResultSection'),
    resultTop: $('trainingResultTop'),
    resultList: $('trainingResultList'),
    btnOk: $('btnTrainingOk'),

    // shared overlay (main UI)
    modalBack: $('modalBack'),
    weekPop: $('weekPop'),
    popTitle: $('popTitle'),
    popSub: $('popSub'),
    btnPopNext: $('btnPopNext'),
  };

  /* =========================
     状態（保存しない）
  ========================= */
  let phase = 'select'; // 'select' | 'result' | 'weekpop'
  let selected = { A:null, B:null, C:null };
  let lastResult = null;

  /* =========================
     ユーティリティ
  ========================= */
  function weeklyGoldByRank(rank){
    if (rank >= 1 && rank <= 5) return 500;
    if (rank >= 6 && rank <= 10) return 800;
    if (rank >= 11 && rank <= 20) return 1000;
    if (rank >= 21 && rank <= 30) return 2000;
    return 3000;
  }

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

  function showBack(){
    if (!dom.modalBack) return;
    dom.modalBack.style.display = 'block';
    dom.modalBack.setAttribute('aria-hidden', 'false');
  }
  function hideBack(){
    if (!dom.modalBack) return;
    dom.modalBack.style.display = 'none';
    dom.modalBack.setAttribute('aria-hidden', 'true');
  }

  function setCloseEnabled(enabled){
    if (!dom.close) return;
    dom.close.disabled = !enabled;
    dom.close.style.opacity = enabled ? '1' : '0.55';
    dom.close.style.pointerEvents = enabled ? 'auto' : 'none';
  }

  function allSelected(){
    return !!(selected.A && selected.B && selected.C);
  }

  function readTeamFromStorageOrDefault(){
    // 育成対象は「mobbr_playerTeam」を正とする（無ければ初期生成）
    try{
      const raw = localStorage.getItem(K.playerTeam);
      if (raw){
        const team = JSON.parse(raw);
        if (team && Array.isArray(team.members)) return team;
      }
    }catch(e){}
    return DP.buildDefaultTeam();
  }

  function getMemberDisplayName(mem){
    // UI表示名は storageのm1/m2/m3 を優先（A/B/Cのスロット順）
    // slot:1=A,2=B,3=C を想定
    const slot = Number(mem?.slot || 0);
    if (slot === 1) return S.getStr(K.m1, mem.name || mem.id || 'A');
    if (slot === 2) return S.getStr(K.m2, mem.name || mem.id || 'B');
    if (slot === 3) return S.getStr(K.m3, mem.name || mem.id || 'C');
    return mem.name || mem.id || '—';
  }

  function statLabel(key){
    return DP.STAT_LABEL?.[key] || key;
  }

  function trainingUpText(tr){
    if (!tr) return '';
    if (tr.up === 'all') return '全能力';
    return tr.up.map(k => statLabel(k)).join(' / ');
  }

  /* =========================
     UI（カード生成）
  ========================= */
  function renderCards(){
    if (!dom.cards) return;

    const team = readTeamFromStorageOrDefault();

    dom.cards.innerHTML = '';

    // membersはA/B/C固定想定だが、念のためslot順にする
    const members = [...team.members].sort((a,b)=> (a.slot||0)-(b.slot||0));

    for (const mem of members){
      const memId = mem.id; // 'A','B','C'
      const wrap = document.createElement('div');
      wrap.className = 'trainingCard';

      const title = document.createElement('div');
      title.className = 'trainingMember';
      title.textContent = `${memId}：${getMemberDisplayName(mem)}`;

      const list = document.createElement('div');
      list.className = 'trainingMenuList';

      for (const tr of TRAININGS){
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'trainingMenuBtn';

        // 2段：上=名称 / 下=上がる項目
        const line1 = document.createElement('div');
        line1.className = 'trBtnName';
        line1.textContent = tr.name;

        const line2 = document.createElement('div');
        line2.className = 'trBtnUp';
        line2.textContent = `↑ ${trainingUpText(tr)}`;

        btn.appendChild(line1);
        btn.appendChild(line2);

        if (selected[memId]?.id === tr.id){
          btn.classList.add('selected');
        }

        btn.addEventListener('click', ()=>{
          if (phase !== 'select') return;
          selected[memId] = tr;
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
     ルール：
     - 共通：全能力EXP +1
     - 専門：対象EXP +4（共通+1込み → 追加+3）
     - 総合：全能力EXP +2（共通+1込み → 追加+1）
  ========================= */
  function calcResult(){
    const team = readTeamFromStorageOrDefault();
    const members = [...team.members].sort((a,b)=> (a.slot||0)-(b.slot||0));

    const result = [];

    for (const mem of members){
      const memId = mem.id;
      const tr = selected[memId];
      if (!tr) continue;

      const add = {};
      // 共通 +1
      for (const k of DP.STAT_KEYS) add[k] = 1;

      // 専門 or 総合
      if (tr.up === 'all'){
        for (const k of DP.STAT_KEYS) add[k] += 1; // 合計+2
      }else{
        for (const k of tr.up) add[k] += 3; // 合計+4
      }

      result.push({
        id: memId,
        name: getMemberDisplayName(mem),
        training: tr.name,
        upText: trainingUpText(tr),
        expAdd: add
      });
    }

    return result;
  }

  /* =========================
     結果表示（選択UIは閉じた扱い）
  ========================= */
  function showResult(result){
    phase = 'result';
    lastResult = result;

    // 結果中は閉じるを無効化
    setCloseEnabled(false);

    // selection UIを“使えない”状態にする（CSS次第だが安全に）
    if (dom.btnStart) dom.btnStart.disabled = true;

    if (dom.resultSec) dom.resultSec.style.display = 'block';
    if (dom.resultTop) dom.resultTop.textContent = '修行完了！';

    if (dom.resultList){
      dom.resultList.innerHTML = '';
      for (const r of result){
        const row = document.createElement('div');
        row.className = 'trainingResultRow';
        row.textContent = `${r.name}は${r.training}を行った！（↑ ${r.upText}）`;
        dom.resultList.appendChild(row);
      }
    }
  }

  function hideResult(){
    if (dom.resultSec) dom.resultSec.style.display = 'none';
    lastResult = null;
  }

  /* =========================
     週進行＋ランク報酬ポップアップ（shared weekPop使用）
  ========================= */
  function advanceWeekAndShowReward(){
    const y = S.getNum(K.year, 1989);
    const m = S.getNum(K.month, 1);
    const w = S.getNum(K.week, 1);

    let ny = y, nm = m, nw = w + 1;
    if (nw >= 5){
      nw = 1;
      nm = m + 1;
      if (nm >= 13){
        nm = 1;
        ny = y + 1;
      }
    }

    const rank = S.getNum(K.rank, 10);
    const gain = weeklyGoldByRank(rank);

    // 先に日付とGを確定（OK押したら進む仕様なので、ここで確定してよい）
    S.setNum(K.year, ny);
    S.setNum(K.month, nm);
    S.setNum(K.week, nw);

    const gold = S.getNum(K.gold, 0);
    S.setNum(K.gold, gold + gain);

    // recent
    S.setStr(K.recent, `修行を行い、チームの地力が上がった（+${gain}G）`);

    // weekPop を表示
    phase = 'weekpop';
    showBack();

    if (dom.weekPop) dom.weekPop.style.display = 'block';
    if (dom.popTitle) dom.popTitle.textContent = `${ny}年${nm}月 第${nw}週`;
    if (dom.popSub) dom.popSub.textContent = `企業ランク${rank}なので ${gain}G 手に入れた！`;

    if (dom.btnPopNext){
      dom.btnPopNext.onclick = ()=>{
        // weekPop閉じる
        if (dom.weekPop) dom.weekPop.style.display = 'none';
        hideBack();

        phase = 'select'; // 次回に備える（この時点でtrainingは閉じてる）
        // UI再描画
        if (window.MOBBR.initMainUI) window.MOBBR.initMainUI();
        if (window.MOBBR.ui?.team?.render) window.MOBBR.ui.team.render();
      };
    }
  }

  /* =========================
     確定処理（結果OK）
  ========================= */
  function commit(result){
    // playerTeam を取得 or 初期生成
    let team;
    try{
      const raw = localStorage.getItem(K.playerTeam);
      team = raw ? JSON.parse(raw) : DP.buildDefaultTeam();
    }catch(e){
      team = DP.buildDefaultTeam();
    }
    if (!team || !Array.isArray(team.members)) team = DP.buildDefaultTeam();

    // EXP/Lv反映
    for (const mem of team.members){
      const r = result.find(x => x.id === mem.id);
      if (!r) continue;

      mem.exp = DP.normalizeExp(mem.exp);
      mem.lv  = DP.normalizeLv(mem.lv);

      for (const k of DP.STAT_KEYS){
        mem.exp[k] += Number(r.expAdd?.[k] || 0);

        while (mem.exp[k] >= 20){
          mem.exp[k] -= 20;
          mem.lv[k] += 1;
        }
      }
    }

    localStorage.setItem(K.playerTeam, JSON.stringify(team));

    // 育成画面は強制的に閉じる（ここで“メニュー画面に戻らない”）
    close(true);

    // 週進行＋ランク報酬ポップアップ
    advanceWeekAndShowReward();
  }

  /* =========================
     open / close
  ========================= */
  function open(){
    if (!dom.screen) return;

    phase = 'select';
    selected = { A:null, B:null, C:null };
    lastResult = null;

    // 選択状態初期化
    updateDateUI();
    if (dom.btnStart) dom.btnStart.disabled = true;

    // 結果は隠す
    hideResult();

    // 閉じるは有効
    setCloseEnabled(true);

    // カード描画
    renderCards();

    dom.screen.classList.add('show');
    dom.screen.setAttribute('aria-hidden', 'false');
  }

  // force=true なら状態を問わず閉じる（commitで使う）
  function close(force){
    if (!dom.screen) return;

    if (!force && phase !== 'select'){
      // 結果中は閉じさせない（事故防止）
      return;
    }

    dom.screen.classList.remove('show');
    dom.screen.setAttribute('aria-hidden', 'true');

    // 次回のために
    phase = 'select';
    setCloseEnabled(true);
  }

  /* =========================
     bind
  ========================= */
  let bound = false;
  function bind(){
    if (bound) return;
    bound = true;

    // 閉じる（結果中は無効）
    if (dom.close){
      dom.close.addEventListener('click', ()=>{
        if (phase !== 'select'){
          // 無反応より一言だけ（不快になりにくい最小限）
          alert('結果OKで確定します。OKを押してください。');
          return;
        }
        close(false);
      });
    }

    // 修行開始 → 結果表示（まだ保存しない）
    if (dom.btnStart){
      dom.btnStart.addEventListener('click', ()=>{
        if (phase !== 'select') return;
        if (!allSelected()) return;

        const result = calcResult();
        showResult(result);

        if (dom.btnOk){
          dom.btnOk.onclick = ()=>{
            if (phase !== 'result') return;
            commit(result);
          };
        }
      });
    }

    // 背景押しで閉じない（誤爆防止）
    if (dom.modalBack){
      dom.modalBack.addEventListener('click', (e)=> e.preventDefault(), { passive:false });
    }
  }

  function initTrainingUI(){
    // DOMが無いなら何もしない
    if (!dom.screen) return;
    bind();
  }

  // expose
  window.MOBBR.initTrainingUI = initTrainingUI;
  window.MOBBR.ui.training = { open, close };

  // app.js から呼ばれる前提だが、念のためDOMReadyでも
  document.addEventListener('DOMContentLoaded', initTrainingUI);
})();
