'use strict';

/*
  MOB BR - ui_training.js v14（フル / 作り直し）

  目的（今回の修正点）：
  1) 「修行開始ボタンが2個」問題を解消
     - HTML既存の #btnTrainingStart だけを使う（追加ボタンは生成しない）

  2) 「OKを押さずに閉じる」で無効になる問題を解消
     - “結果確定（NEXT）” 以外では保存・週進行しない
     - 結果表示中は「閉じる」を無効化（誤キャンセル防止）
     - フローを分離：
       選択 → 確認（開始/選び直す）→ 実行 → 結果POP（NEXT）→ 週進行POP（NEXT）

  3) 能力アップが実ステータスに反映されない問題を解消
     - playerTeam の exp/lv だけでなく、Lvアップ分を stats に加算して“見える成長”を反映
       ※仕様書に「Lvで何が上がる」が明記されていないため、
         ここでは “Lvが上がった能力は stats を +1 ずつ加算” の安全設計にしています。
         （バグりにくい/後から調整しやすい）

  前提：
  - storage.js v14, data_player.js v14 が読み込まれている
  - index.html に #trainingScreen / #btnTrainingStart / #btnTrainingOk 等が存在
  - ui_main.js で #weekPop（大きい週表示）を既に持っているので、それを再利用する
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
     DOM（HTML既存）
  ========================= */
  const dom = {
    // training screen
    screen: $('trainingScreen'),
    close: $('btnCloseTraining'),
    trY: $('trY'),
    trM: $('trM'),
    trW: $('trW'),
    cards: $('trainingCards'),
    btnStart: $('btnTrainingStart'),

    // 既存の結果セクション（今回は“使わない”が、残っていても壊さない）
    resultSec: $('trainingResultSection'),
    resultTop: $('trainingResultTop'),
    resultList: $('trainingResultList'),
    btnOk: $('btnTrainingOk'),

    // main overlay（週進行POP再利用）
    modalBack: $('modalBack'),
    weekPop: $('weekPop'),
    popTitle: $('popTitle'),
    popSub: $('popSub'),
    btnPopNext: $('btnPopNext'),

    // 左メニューの育成ボタン（存在すればここでも安全にopenする）
    btnTrainingMenu: $('btnTraining')
  };

  if (!dom.screen || !dom.cards || !dom.btnStart){
    console.warn('[ui_training] training DOM not found');
    return;
  }

  /* =========================
     内部状態（保存しない）
  ========================= */
  const memberIds = ['A','B','C'];

  let state = {
    phase: 'select',        // select | confirm | running | result | weekpop
    selected: { A:null, B:null, C:null }, // training object
    pendingResult: null,    // calc result cache
  };

  /* =========================
     共通：日付/週進行/企業ランクG
  ========================= */
  function getDate(){
    return {
      y: S.getNum(K.year, 1989),
      m: S.getNum(K.month, 1),
      w: S.getNum(K.week, 1)
    };
  }

  function setDate(y,m,w){
    S.setNum(K.year, y);
    S.setNum(K.month, m);
    S.setNum(K.week, w);
  }

  function advanceWeekPure(y,m,w){
    let ny=y, nm=m, nw=w+1;
    if (nw >= 5){
      nw = 1;
      nm = m + 1;
      if (nm >= 13){
        nm = 1;
        ny = y + 1;
      }
    }
    return { y:ny, m:nm, w:nw };
  }

  function weeklyGoldByRank(rank){
    // ui_main.js と同じ表（整合）
    if (rank >= 1 && rank <= 5) return 500;
    if (rank >= 6 && rank <= 10) return 800;
    if (rank >= 11 && rank <= 20) return 1000;
    if (rank >= 21 && rank <= 30) return 2000;
    return 3000;
  }

  function updateDateUI(){
    const d = getDate();
    if (dom.trY) dom.trY.textContent = String(d.y);
    if (dom.trM) dom.trM.textContent = String(d.m);
    if (dom.trW) dom.trW.textContent = String(d.w);
  }

  /* =========================
     overlay helpers（modalBack / weekPop）
  ========================= */
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

  function showWeekPop(title, sub, onNext){
    // 既存の weekPop を再利用（中央で大きく）
    if (!dom.weekPop || !dom.btnPopNext) return;

    if (dom.popTitle) dom.popTitle.textContent = title;
    if (dom.popSub) dom.popSub.textContent = sub;

    showBack();
    dom.weekPop.style.display = 'block';

    dom.btnPopNext.onclick = () => {
      dom.weekPop.style.display = 'none';
      hideBack();
      if (typeof onNext === 'function') onNext();
    };
  }

  /* =========================
     ここから：育成 UI（画像なし / テキスト中心）
     ※CSSが未追加でも動くように、最低限はJSで整える
  ========================= */
  function allSelected(){
    return !!(state.selected.A && state.selected.B && state.selected.C);
  }

  function setPhase(p){
    state.phase = p;

    // 「閉じる」可否
    if (dom.close){
      const lock = (p === 'confirm' || p === 'running' || p === 'result' || p === 'weekpop');
      dom.close.disabled = lock;
      dom.close.style.opacity = lock ? '0.6' : '1';
      dom.close.style.pointerEvents = lock ? 'none' : 'auto';
    }

    // 既存の resultSec は使わない（誤表示防止）
    if (dom.resultSec) dom.resultSec.style.display = 'none';
  }

  function resetState(){
    state.selected = { A:null, B:null, C:null };
    state.pendingResult = null;
    setPhase('select');
  }

  function memberDisplayName(id){
    // storageのメンバー名優先
    if (id === 'A') return S.getStr(K.m1, 'A');
    if (id === 'B') return S.getStr(K.m2, 'B');
    if (id === 'C') return S.getStr(K.m3, 'C');
    return id;
  }

  function renderCards(){
    dom.cards.innerHTML = '';

    // 3人固定で出す（A/B/C）
    memberIds.forEach(id => {
      const wrap = document.createElement('div');
      wrap.className = 'trainingCard';
      wrap.style.borderRadius = '14px';
      wrap.style.border = '2px solid rgba(255,255,255,.22)';
      wrap.style.background = 'rgba(0,0,0,.35)';
      wrap.style.padding = '12px';
      wrap.style.marginBottom = '12px';

      const head = document.createElement('div');
      head.className = 'trainingMember';
      head.style.fontWeight = '1000';
      head.style.fontSize = '16px';
      head.style.color = '#fff';
      head.style.textShadow = '0 3px 0 rgba(0,0,0,.55)';
      head.style.marginBottom = '8px';
      head.textContent = `${id}：${memberDisplayName(id)}`;

      const picked = document.createElement('div');
      picked.className = 'trainingPicked';
      picked.style.color = 'rgba(255,255,255,.92)';
      picked.style.fontWeight = '900';
      picked.style.fontSize = '14px';
      picked.style.marginBottom = '10px';
      picked.textContent = state.selected[id]
        ? `選択：${state.selected[id].name}`
        : '選択：—';

      const list = document.createElement('div');
      list.className = 'trainingMenuList';
      list.style.display = 'grid';
      list.style.gridTemplateColumns = '1fr 1fr';
      list.style.gap = '8px';

      TRAININGS.forEach(tr => {
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'trainingMenuBtn';
        btn.textContent = tr.name;

        // style（CSS未追加でも押せる）
        btn.style.border = '1px solid rgba(255,255,255,.18)';
        btn.style.background = 'rgba(255,255,255,.10)';
        btn.style.color = '#fff';
        btn.style.borderRadius = '12px';
        btn.style.padding = '10px 10px';
        btn.style.fontWeight = '1000';
        btn.style.fontSize = '14px';
        btn.style.textAlign = 'center';
        btn.style.touchAction = 'manipulation';

        const isSel = (state.selected[id]?.id === tr.id);
        if (isSel){
          btn.style.background = 'rgba(255,255,255,.88)';
          btn.style.color = '#111';
        }

        btn.addEventListener('click', () => {
          if (state.phase !== 'select') return;
          state.selected[id] = tr;
          renderCards();
          updateStartButton();
        });

        list.appendChild(btn);
      });

      wrap.appendChild(head);
      wrap.appendChild(picked);
      wrap.appendChild(list);
      dom.cards.appendChild(wrap);
    });
  }

  function updateStartButton(){
    // HTML既存のボタンは1つだけ使う
    if (!dom.btnStart) return;

    const ok = allSelected();
    dom.btnStart.disabled = !ok;

    // 表示文も明確に
    dom.btnStart.textContent = ok ? '修行開始（1週消費）' : '修行を選択してください（3人分）';
  }

  /* =========================
     確認POP（開始 / 選び直す）
     ※trainingScreen上に“追加ボタン”を作らず、modalBack上に小ポップを出す
  ========================= */
  let confirmPopEl = null;

  function ensureConfirmPop(){
    if (confirmPopEl) return confirmPopEl;

    const pop = document.createElement('div');
    pop.id = 'trainingConfirmPop';
    pop.style.position = 'absolute';
    pop.style.left = '50%';
    pop.style.top = '50%';
    pop.style.transform = 'translate(-50%,-50%)';
    pop.style.zIndex = '9999';
    pop.style.width = 'min(560px, 88vw)';
    pop.style.borderRadius = '16px';
    pop.style.background = 'rgba(0,0,0,.82)';
    pop.style.border = '2px solid rgba(255,255,255,.35)';
    pop.style.boxShadow = '0 18px 40px rgba(0,0,0,.45)';
    pop.style.padding = '16px';
    pop.style.color = '#fff';
    pop.style.textShadow = '0 3px 0 rgba(0,0,0,.55)';
    pop.style.display = 'none';

    const title = document.createElement('div');
    title.style.fontSize = '18px';
    title.style.fontWeight = '1000';
    title.style.marginBottom = '10px';
    title.textContent = '修行を開始しますか？（1週消費）';

    const picks = document.createElement('div');
    picks.id = 'trainingConfirmPicks';
    picks.style.display = 'grid';
    picks.style.gridTemplateColumns = '1fr';
    picks.style.gap = '8px';
    picks.style.marginBottom = '12px';
    picks.style.fontWeight = '900';
    picks.style.fontSize = '14px';
    picks.style.opacity = '0.95';

    const btnRow = document.createElement('div');
    btnRow.style.display = 'grid';
    btnRow.style.gridTemplateColumns = '1fr 1fr';
    btnRow.style.gap = '10px';

    const btnGo = document.createElement('button');
    btnGo.type = 'button';
    btnGo.id = 'btnConfirmGo';
    btnGo.textContent = '修行開始（1週消費）';
    btnGo.style.border = 'none';
    btnGo.style.borderRadius = '14px';
    btnGo.style.padding = '14px 12px';
    btnGo.style.fontSize = '16px';
    btnGo.style.fontWeight = '1000';
    btnGo.style.background = 'rgba(255,255,255,.92)';
    btnGo.style.color = '#111';
    btnGo.style.touchAction = 'manipulation';

    const btnRedo = document.createElement('button');
    btnRedo.type = 'button';
    btnRedo.id = 'btnConfirmRedo';
    btnRedo.textContent = '選び直す';
    btnRedo.style.border = 'none';
    btnRedo.style.borderRadius = '14px';
    btnRedo.style.padding = '14px 12px';
    btnRedo.style.fontSize = '16px';
    btnRedo.style.fontWeight = '1000';
    btnRedo.style.background = 'rgba(255,80,80,.92)';
    btnRedo.style.color = '#111';
    btnRedo.style.touchAction = 'manipulation';

    btnRow.appendChild(btnGo);
    btnRow.appendChild(btnRedo);

    pop.appendChild(title);
    pop.appendChild(picks);
    pop.appendChild(btnRow);

    // #app 配下に置く（modalBackと同階層）
    const app = $('app');
    (app || document.body).appendChild(pop);

    confirmPopEl = pop;
    return pop;
  }

  function showConfirmPop(){
    setPhase('confirm');
    const pop = ensureConfirmPop();

    // 選択内容の表示
    const picks = $('trainingConfirmPicks');
    if (picks){
      picks.innerHTML = '';
      memberIds.forEach(id => {
        const line = document.createElement('div');
        const tr = state.selected[id];
        line.textContent = `${id}：${memberDisplayName(id)} / ${tr ? tr.name : '—'}`;
        picks.appendChild(line);
      });
    }

    showBack();
    pop.style.display = 'block';

    const btnGo = $('btnConfirmGo');
    const btnRedo = $('btnConfirmRedo');

    if (btnRedo){
      btnRedo.onclick = () => {
        pop.style.display = 'none';
        hideBack();
        setPhase('select');
      };
    }

    if (btnGo){
      btnGo.onclick = () => {
        pop.style.display = 'none';
        hideBack();
        runTrainingFlow();
      };
    }
  }

  /* =========================
     結果POP（NEXTのみ）
  ========================= */
  let resultPopEl = null;

  function ensureResultPop(){
    if (resultPopEl) return resultPopEl;

    const pop = document.createElement('div');
    pop.id = 'trainingResultPop';
    pop.style.position = 'absolute';
    pop.style.left = '50%';
    pop.style.top = '50%';
    pop.style.transform = 'translate(-50%,-50%)';
    pop.style.zIndex = '9999';
    pop.style.width = 'min(560px, 88vw)';
    pop.style.borderRadius = '16px';
    pop.style.background = 'rgba(0,0,0,.82)';
    pop.style.border = '2px solid rgba(255,255,255,.35)';
    pop.style.boxShadow = '0 18px 40px rgba(0,0,0,.45)';
    pop.style.padding = '16px';
    pop.style.color = '#fff';
    pop.style.textShadow = '0 3px 0 rgba(0,0,0,.55)';
    pop.style.display = 'none';

    const title = document.createElement('div');
    title.id = 'trainingResultTitle';
    title.style.fontSize = '20px';
    title.style.fontWeight = '1000';
    title.style.marginBottom = '10px';
    title.textContent = '修行完了！';

    const body = document.createElement('div');
    body.id = 'trainingResultBody';
    body.style.display = 'flex';
    body.style.flexDirection = 'column';
    body.style.gap = '8px';
    body.style.fontWeight = '900';
    body.style.fontSize = '14px';
    body.style.opacity = '0.95';
    body.style.marginBottom = '12px';

    const note = document.createElement('div');
    note.style.fontSize = '13px';
    note.style.fontWeight = '900';
    note.style.opacity = '0.92';
    note.style.marginBottom = '12px';
    note.textContent = '全能力に共通ボーナス +1 EXP（内部）';

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.id = 'btnTrainingResultNext';
    btn.textContent = 'NEXT';
    btn.style.width = '100%';
    btn.style.border = 'none';
    btn.style.borderRadius = '14px';
    btn.style.padding = '14px 12px';
    btn.style.fontSize = '16px';
    btn.style.fontWeight = '1000';
    btn.style.background = 'rgba(255,255,255,.92)';
    btn.style.color = '#111';
    btn.style.touchAction = 'manipulation';

    pop.appendChild(title);
    pop.appendChild(note);
    pop.appendChild(body);
    pop.appendChild(btn);

    const app = $('app');
    (app || document.body).appendChild(pop);

    resultPopEl = pop;
    return pop;
  }

  function showResultPop(result){
    setPhase('result');
    const pop = ensureResultPop();

    const body = $('trainingResultBody');
    if (body){
      body.innerHTML = '';
      result.forEach(r => {
        const line = document.createElement('div');
        // “％や数値は出さない” ルールに従い、文章演出のみ
        line.textContent = `${r.name}は${r.training}に集中した！ ${r.growthText}`;
        body.appendChild(line);
      });
      const tail = document.createElement('div');
      tail.style.marginTop = '8px';
      tail.textContent = 'チーム全体の地力が少し上がった';
      body.appendChild(tail);
    }

    showBack();
    pop.style.display = 'block';

    const btn = $('btnTrainingResultNext');
    if (btn){
      btn.onclick = () => {
        // NEXTで確定（保存＋週進行＋G獲得→週POP）
        pop.style.display = 'none';
        hideBack();
        commitAndAdvance(result);
      };
    }
  }

  /* =========================
     結果計算（保存前）
  ========================= */
  function calcResult(){
    // “選択”から内部結果を作る（数値は内部）
    const res = [];

    memberIds.forEach(id => {
      const tr = state.selected[id];

      // EXP付与
      const expAdd = {};
      DP.STAT_KEYS.forEach(k => expAdd[k] = 1); // 共通 +1

      if (tr.up === 'all'){
        DP.STAT_KEYS.forEach(k => expAdd[k] += 1); // 合計 +2
      }else{
        tr.up.forEach(k => expAdd[k] += 3); // 合計 +4
      }

      // 演出文（確定仕様ログ寄り）
      let growthText = '';
      if (tr.up === 'all'){
        growthText = '全能力が成長した！';
      }else{
        const labels = tr.up.map(k => DP.STAT_LABEL?.[k] || k);
        growthText = `${labels.join('と')}が成長した！`;
      }

      res.push({
        id,
        name: memberDisplayName(id),
        training: tr.name,
        expAdd,
        growthText
      });
    });

    return res;
  }

  /* =========================
     playerTeam 読み書き（安全）
  ========================= */
  function loadPlayerTeamSafe(){
    let team;
    try{
      const raw = localStorage.getItem(K.playerTeam);
      team = raw ? JSON.parse(raw) : null;
    }catch(e){
      team = null;
    }

    // なければ作る
    if (!team || !Array.isArray(team.members)){
      team = DP.buildDefaultTeam();
    }

    // メンバー構造の最低限保証
    team.members = team.members.map(m => {
      const out = m || {};
      out.id = out.id || 'A';
      out.stats = DP.normalizeStats(out.stats);
      out.exp   = DP.normalizeExp(out.exp);
      out.lv    = DP.normalizeLv(out.lv);
      return out;
    });

    return team;
  }

  function savePlayerTeamSafe(team){
    try{
      localStorage.setItem(K.playerTeam, JSON.stringify(team));
    }catch(e){
      // localStorage失敗時は落とさない
      console.warn('[ui_training] failed to save playerTeam', e);
    }
  }

  /* =========================
     確定：保存 + 週進行 + G獲得POP
  ========================= */
  function commitAndAdvance(result){
    setPhase('running');

    // 1) playerTeamへ EXP/Lv/Stats反映
    const team = loadPlayerTeamSafe();

    team.members.forEach(mem => {
      const r = result.find(x => x.id === mem.id);
      if (!r) return;

      mem.stats = DP.normalizeStats(mem.stats);
      mem.exp   = DP.normalizeExp(mem.exp);
      mem.lv    = DP.normalizeLv(mem.lv);

      DP.STAT_KEYS.forEach(k => {
        const add = Number(r.expAdd?.[k]) || 0;

        // EXP加算
        mem.exp[k] += add;

        // Lvアップ（20EXPごと）
        let lvUpCount = 0;
        while (mem.exp[k] >= 20){
          mem.exp[k] -= 20;
          mem.lv[k] += 1;
          lvUpCount += 1;
        }

        // ★“実ステータスに反映”：
        // Lvが上がった能力だけ stats を +1ずつ加算（シンプル/バグりにくい）
        if (lvUpCount > 0){
          mem.stats[k] = Number(mem.stats[k]) + lvUpCount;
        }
      });
    });

    savePlayerTeamSafe(team);

    // 2) 週進行 + 企業ランクG獲得
    const d0 = getDate();
    const d1 = advanceWeekPure(d0.y, d0.m, d0.w);

    const rank = S.getNum(K.rank, 10);
    const gain = weeklyGoldByRank(rank);
    const gold = S.getNum(K.gold, 0);

    // 週・Gを確定保存
    setDate(d1.y, d1.m, d1.w);
    S.setNum(K.gold, gold + gain);

    // recentログ（表示は文章のみ）
    S.setStr(K.recent, '修行を行い、チームの地力が上がった');

    // 3) training画面は強制的に閉じる（要求通り）
    forceCloseTrainingScreen();

    // 4) 週POP（中央大きく）を表示 → NEXTで閉じる
    setPhase('weekpop');

    const title = `${d1.y}年${d1.m}月 第${d1.w}週`;
    const sub   = `企業ランク${rank}なので ${gain}G 手に入れた！`;

    showWeekPop(title, sub, () => {
      setPhase('select');

      // UI再描画（メイン/チーム）
      if (window.MOBBR?.initMainUI) window.MOBBR.initMainUI();
      if (window.MOBBR?.ui?.team?.render) window.MOBBR.ui.team.render();
    });
  }

  function forceCloseTrainingScreen(){
    // 閉じるボタンが効かない状態でも確実に閉じる
    try{
      dom.screen.classList.remove('show');
      dom.screen.setAttribute('aria-hidden', 'true');
    }catch(e){}
  }

  /* =========================
     実行フロー
  ========================= */
  function runTrainingFlow(){
    // 選択画面は強制的に閉じて、結果POPへ（要求通り）
    setPhase('running');

    // いったん trainingScreen を閉じる（メニューウィンドウを残さない）
    forceCloseTrainingScreen();

    // 結果算出 → 結果POP（NEXTのみ）
    const result = calcResult();
    state.pendingResult = result;

    showResultPop(result);
  }

  /* =========================
     open / close
  ========================= */
  function open(){
    resetState();
    updateDateUI();
    renderCards();
    updateStartButton();

    // trainingScreenを表示
    dom.screen.classList.add('show');
    dom.screen.setAttribute('aria-hidden', 'false');

    // 既存resultSecが残ってても表示しない
    if (dom.resultSec) dom.resultSec.style.display = 'none';
  }

  function close(){
    // 結果/確認中は閉じさせない（事故防止）
    if (state.phase !== 'select') return;
    forceCloseTrainingScreen();
  }

  /* =========================
     bind
  ========================= */
  let bound = false;

  function bind(){
    if (bound) return;
    bound = true;

    // close（select以外は無効化される）
    if (dom.close){
      dom.close.addEventListener('click', () => close());
    }

    // 開始ボタン（HTML既存の1つだけ）
    dom.btnStart.addEventListener('click', () => {
      if (state.phase !== 'select') return;
      if (!allSelected()) return;
      showConfirmPop();
    });

    // 左メニューの育成ボタンがあるなら、ここでもopen（ui_mainと二重でも安全）
    if (dom.btnTrainingMenu){
      dom.btnTrainingMenu.addEventListener('click', () => {
        // ui_mainがclass付与するだけでも動くが、確実に初期化する
        open();
      });
    }

    // modalBackは“閉じるための背景”としては使わない（誤爆防止）
    if (dom.modalBack){
      dom.modalBack.addEventListener('click', (e) => {
        e.preventDefault();
        e.stopPropagation();
      }, { passive:false });
    }
  }

  function initTrainingUI(){
    bind();

    // 初期状態の安全化：resultSecは常に隠す
    if (dom.resultSec) dom.resultSec.style.display = 'none';

    // もし ui_main が先に trainingScreen を show してきた場合でも、
    // ここで内容を作っておけば “白紙/壊れ” を防げる
    // ただし勝手にopenはしない（選択状態を汚さない）
  }

  // expose
  window.MOBBR.initTrainingUI = initTrainingUI;
  window.MOBBR.ui.training = { open, close };

  // 起動
  document.addEventListener('DOMContentLoaded', initTrainingUI);
})();
