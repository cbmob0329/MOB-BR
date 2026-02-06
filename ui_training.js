'use strict';

/*
  MOB BR - ui_training.js v14（フル / 安全・シンプル版）

  目的（あなたの提案フローに寄せる）：
  - 育成ボタン → 育成画面
  - 3人の名前バナー表示
  - 1人ずつ「修行」を選択（A→B→Cの順）
  - 3人目が決まったら確認：
      「修行を開始しますか？（1週消費）」 / 「選び直す」
  - 開始したら結果を表示
  - NEXT（OK）で「結果を閉じる + 保存 + 1週進める」
    ※途中状態は保存しない（事故防止）

  重要：
  - 表示は文章 + 経験値バー（%や補正値は表示しない）
  - 名前は storage(m1/m2/m3) を参照し、playerTeam(mobbr_playerTeam)にも同期
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
     - 専門：対象2能力
     - 総合：全能力
  ========================= */
  const TRAININGS = [
    { id:'shoot',  name:'射撃練習',  kind:'spec', up:['aim','agi'] },
    { id:'dash',   name:'ダッシュ',  kind:'spec', up:['agi','hp'] },
    { id:'puzzle', name:'パズル',    kind:'spec', up:['tech','mental'] },
    { id:'battle', name:'実戦練習',  kind:'spec', up:['aim','hp'] },
    { id:'water',  name:'滝修行',    kind:'spec', up:['mental','hp'] },
    { id:'lab',    name:'研究',      kind:'spec', up:['tech','support'] },
    { id:'all',    name:'総合演習',  kind:'all',  up:'all' }
  ];

  /* =========================
     DOM
  ========================= */
  const dom = {
    // screen
    screen: $('trainingScreen'),
    close: $('btnCloseTraining'),

    // date line
    trY: $('trY'),
    trM: $('trM'),
    trW: $('trW'),

    // container
    cards: $('trainingCards'),
    btnStart: $('btnTrainingStart'),

    // result
    resultSec: $('trainingResultSection'),
    resultTop: $('trainingResultTop'),
    resultList: $('trainingResultList'),
    btnOk: $('btnTrainingOk'),

    // (optional) note area
    note: $('trainingNote')
  };

  if (!dom.screen || !dom.cards || !dom.btnStart || !dom.resultSec || !dom.resultTop || !dom.resultList || !dom.btnOk){
    console.warn('[ui_training] training DOM not found in index.html');
    return;
  }

  /* =========================
     状態（途中保存しない）
  ========================= */
  const ORDER = ['A','B','C']; // 1人ずつ選ぶ順番（固定）
  let stepIndex = 0;           // 0..2（誰を選択中か）
  let selected = { A:null, B:null, C:null }; // {trainingId, trainingName}

  // 直近の計算結果（確定前）
  let lastResult = null;

  /* =========================
     小物（スタイル）
  ========================= */
  function el(tag, className, text){
    const e = document.createElement(tag);
    if (className) e.className = className;
    if (text !== undefined) e.textContent = text;
    return e;
  }

  function clear(node){
    while (node.firstChild) node.removeChild(node.firstChild);
  }

  function getDate(){
    return {
      y: S.getNum(K.year, 1989),
      m: S.getNum(K.month, 1),
      w: S.getNum(K.week, 1)
    };
  }

  function setDateUI(){
    const d = getDate();
    if (dom.trY) dom.trY.textContent = String(d.y);
    if (dom.trM) dom.trM.textContent = String(d.m);
    if (dom.trW) dom.trW.textContent = String(d.w);
  }

  function getNameById(id){
    if (id === 'A') return S.getStr(K.m1, 'A');
    if (id === 'B') return S.getStr(K.m2, 'B');
    if (id === 'C') return S.getStr(K.m3, 'C');
    return id;
  }

  function syncPlayerTeamNamesToStorageTeam(team){
    // storage名 → team.members[].name へ寄せる（壊れてても落とさない）
    try{
      const a = getNameById('A');
      const b = getNameById('B');
      const c = getNameById('C');

      const byId = {};
      (team?.members || []).forEach(m => { if (m?.id) byId[m.id] = m; });

      if (byId.A) byId.A.name = a;
      if (byId.B) byId.B.name = b;
      if (byId.C) byId.C.name = c;
    }catch(e){}
  }

  function loadTeamSafe(){
    let team;
    try{
      const raw = localStorage.getItem(K.playerTeam);
      team = raw ? JSON.parse(raw) : null;
    }catch(e){
      team = null;
    }
    if (!team || !Array.isArray(team.members)) team = DP.buildDefaultTeam();

    // exp/lvの正規化
    team.members.forEach(m=>{
      m.exp = DP.normalizeExp(m.exp);
      m.lv  = DP.normalizeLv(m.lv);
      m.stats = DP.normalizeStats(m.stats);
    });

    // 名前同期（storage → team）
    syncPlayerTeamNamesToStorageTeam(team);

    return team;
  }

  function saveTeam(team){
    localStorage.setItem(K.playerTeam, JSON.stringify(team));
  }

  function resetUIState(){
    stepIndex = 0;
    selected = { A:null, B:null, C:null };
    lastResult = null;

    // 結果は隠す
    dom.resultSec.style.display = 'none';
    dom.btnOk.onclick = null;

    // startボタンは「確認用」として使う（3人決まるまで無効）
    dom.btnStart.disabled = true;
    dom.btnStart.textContent = '修行開始（1週消費）';
  }

  function allSelected(){
    return !!(selected.A && selected.B && selected.C);
  }

  /* =========================
     EXP加算ロジック（確定仕様）
     - 共通：全能力 +1 EXP
     - 専門：対象能力 +4（＝共通+1込みで最終+4）
     - 総合：全能力 +2（＝共通+1込みで最終+2）
  ========================= */
  function calcExpAdd(training){
    const add = {};
    DP.STAT_KEYS.forEach(k => add[k] = 1); // 共通+1

    if (training.kind === 'all'){
      DP.STAT_KEYS.forEach(k => add[k] += 1); // 合計+2
    }else{
      training.up.forEach(k => add[k] += 3);  // 合計+4
    }
    return add;
  }

  /* =========================
     画面描画（ステップ式）
  ========================= */
  function render(){
    clear(dom.cards);

    const team = loadTeamSafe(); // 表示用（保存はまだしない）
    const activeId = ORDER[Math.min(stepIndex, ORDER.length - 1)];
    const activeName = getNameById(activeId);

    // --- 上：3人バナー（選択状況） ---
    const head = el('div', 'trHead');
    head.style.display = 'grid';
    head.style.gridTemplateColumns = '1fr 1fr 1fr';
    head.style.gap = '10px';

    ORDER.forEach(id=>{
      const b = el('div', 'trBanner');
      b.style.border = '2px solid rgba(255,255,255,.22)';
      b.style.borderRadius = '12px';
      b.style.padding = '10px';
      b.style.background = 'rgba(255,255,255,.08)';
      b.style.color = '#fff';
      b.style.textShadow = '0 3px 0 rgba(0,0,0,.55)';
      b.style.fontWeight = '1000';

      if (id === activeId && !allSelected()){
        b.style.borderColor = 'rgba(255,255,255,.55)';
        b.style.background = 'rgba(255,255,255,.12)';
      }

      const line1 = el('div', 'trBannerName', `${id}：${getNameById(id)}`);
      line1.style.fontSize = '16px';
      line1.style.whiteSpace = 'nowrap';
      line1.style.overflow = 'hidden';
      line1.style.textOverflow = 'ellipsis';

      const line2 = el('div', 'trBannerPick');
      line2.style.marginTop = '6px';
      line2.style.fontSize = '13px';
      line2.style.opacity = '.95';
      line2.textContent = selected[id] ? `選択：${selected[id].name}` : '未選択';

      b.appendChild(line1);
      b.appendChild(line2);
      head.appendChild(b);
    });

    dom.cards.appendChild(head);

    // --- 中：今選ぶ人のメニュー ---
    if (!allSelected()){
      const sec = el('div', 'trPickSec');
      sec.style.marginTop = '12px';
      sec.style.padding = '12px';
      sec.style.borderRadius = '14px';
      sec.style.border = '2px solid rgba(255,255,255,.18)';
      sec.style.background = 'rgba(0,0,0,.25)';
      sec.style.color = '#fff';
      sec.style.textShadow = '0 3px 0 rgba(0,0,0,.55)';

      const title = el('div', 'trPickTitle', `${activeName} の修行を選択`);
      title.style.fontSize = '18px';
      title.style.fontWeight = '1000';
      title.style.marginBottom = '10px';

      const grid = el('div', 'trMenuGrid');
      grid.style.display = 'grid';
      grid.style.gridTemplateColumns = '1fr';
      grid.style.gap = '10px';

      TRAININGS.forEach(tr=>{
        const btn = el('button', 'trMenuBtn', tr.name);
        btn.type = 'button';
        btn.style.width = '100%';
        btn.style.border = '0';
        btn.style.borderRadius = '12px';
        btn.style.padding = '12px';
        btn.style.fontSize = '16px';
        btn.style.fontWeight = '1000';
        btn.style.background = 'rgba(255,255,255,.92)';
        btn.style.color = '#111';
        btn.style.touchAction = 'manipulation';
        btn.style.boxShadow = '0 10px 22px rgba(0,0,0,.25)';

        // 選択中の強調
        const curSel = selected[activeId]?.id;
        if (curSel === tr.id){
          btn.style.outline = '3px solid rgba(46,204,113,.85)';
        }

        btn.addEventListener('click', ()=>{
          selected[activeId] = { id: tr.id, name: tr.name };

          // 次の人へ
          if (stepIndex < 2) stepIndex += 1;

          render();
          dom.btnStart.disabled = !allSelected();
        });

        grid.appendChild(btn);
      });

      sec.appendChild(title);
      sec.appendChild(grid);
      dom.cards.appendChild(sec);
    }else{
      // --- 3人決まったら確認UI（開始 / 選び直す） ---
      const sec = el('div', 'trConfirmSec');
      sec.style.marginTop = '12px';
      sec.style.padding = '12px';
      sec.style.borderRadius = '14px';
      sec.style.border = '2px solid rgba(255,255,255,.18)';
      sec.style.background = 'rgba(0,0,0,.25)';
      sec.style.color = '#fff';
      sec.style.textShadow = '0 3px 0 rgba(0,0,0,.55)';

      const title = el('div', 'trConfirmTitle', '修行を開始しますか？（1週消費）');
      title.style.fontSize = '18px';
      title.style.fontWeight = '1000';

      const btnRow = el('div', 'trConfirmBtns');
      btnRow.style.display = 'grid';
      btnRow.style.gridTemplateColumns = '1fr 1fr';
      btnRow.style.gap = '10px';
      btnRow.style.marginTop = '12px';

      const btnGo = el('button', 'trBtnGo', '修行開始（1週消費）');
      btnGo.type = 'button';
      btnGo.style.border = '0';
      btnGo.style.borderRadius = '12px';
      btnGo.style.padding = '12px';
      btnGo.style.fontSize = '16px';
      btnGo.style.fontWeight = '1000';
      btnGo.style.background = 'rgba(255,255,255,.92)';
      btnGo.style.color = '#111';
      btnGo.style.touchAction = 'manipulation';

      const btnRetry = el('button', 'trBtnRetry', '選び直す');
      btnRetry.type = 'button';
      btnRetry.style.border = '0';
      btnRetry.style.borderRadius = '12px';
      btnRetry.style.padding = '12px';
      btnRetry.style.fontSize = '16px';
      btnRetry.style.fontWeight = '1000';
      btnRetry.style.background = 'rgba(255,80,80,.92)';
      btnRetry.style.color = '#111';
      btnRetry.style.touchAction = 'manipulation';

      btnRetry.addEventListener('click', ()=>{
        resetUIState();
        render();
      });

      btnGo.addEventListener('click', ()=>{
        // 結果作成 → 結果表示（まだ保存しない）
        lastResult = buildResultPreview(team);
        showResult(lastResult);
      });

      btnRow.appendChild(btnGo);
      btnRow.appendChild(btnRetry);

      sec.appendChild(title);
      sec.appendChild(btnRow);
      dom.cards.appendChild(sec);

      dom.btnStart.disabled = true; // 既存ボタンは使わない（誤爆防止）
    }
  }

  /* =========================
     結果のプレビュー（保存前）
     - team（現状）+ 選択 → 加算後の exp/lv を「見た目用」に計算
  ========================= */
  function buildResultPreview(team){
    const preview = [];

    // deep clone（表示用）
    const cloned = DP.cloneTeam(team);

    cloned.members.forEach(mem=>{
      const sel = selected[mem.id];
      const tr = TRAININGS.find(t=>t.id === sel.id);
      const add = calcExpAdd(tr);

      // 現在値
      mem.exp = DP.normalizeExp(mem.exp);
      mem.lv  = DP.normalizeLv(mem.lv);

      // 加算後（表示用）
      const after = {
        exp: DP.normalizeExp(mem.exp),
        lv:  DP.normalizeLv(mem.lv)
      };

      DP.STAT_KEYS.forEach(k=>{
        after.exp[k] += add[k];

        while (after.exp[k] >= 20){
          after.exp[k] -= 20;
          after.lv[k] += 1;
        }
      });

      preview.push({
        id: mem.id,
        name: getNameById(mem.id),
        trainingName: tr.name,
        beforeExp: mem.exp,
        beforeLv: mem.lv,
        afterExp: after.exp,
        afterLv: after.lv,
        expAdd: add
      });
    });

    return preview;
  }

  /* =========================
     結果表示（経験値バー + あと○でLvアップ）
  ========================= */
  function showResult(preview){
    dom.resultSec.style.display = 'block';
    dom.resultTop.textContent = '修行完了！';

    clear(dom.resultList);

    // “共通ボーナス”の文章（確定ログに寄せる）
    const commonLine = el('div', 'trResCommon', '全能力に共通ボーナス +1 EXP');
    commonLine.style.fontWeight = '1000';
    commonLine.style.marginBottom = '10px';
    commonLine.style.opacity = '.95';
    dom.resultList.appendChild(commonLine);

    preview.forEach(p=>{
      const box = el('div', 'trResBox');
      box.style.border = '2px solid rgba(255,255,255,.18)';
      box.style.background = 'rgba(255,255,255,.06)';
      box.style.borderRadius = '14px';
      box.style.padding = '12px';
      box.style.marginBottom = '10px';
      box.style.color = '#fff';
      box.style.textShadow = '0 3px 0 rgba(0,0,0,.55)';

      const t1 = el('div', 'trResTitle', `${p.name} は「${p.trainingName}」に集中した！`);
      t1.style.fontSize = '16px';
      t1.style.fontWeight = '1000';

      const t2 = el('div', 'trResSub', 'チーム全体の地力が少し上がった');
      t2.style.fontSize = '13px';
      t2.style.marginTop = '6px';
      t2.style.opacity = '.95';

      // ステータス行（バー表示）
      const grid = el('div', 'trResGrid');
      grid.style.display = 'grid';
      grid.style.gridTemplateColumns = '1fr';
      grid.style.gap = '8px';
      grid.style.marginTop = '10px';

      DP.STAT_KEYS.forEach(k=>{
        const row = el('div', 'trResRow');
        row.style.background = 'rgba(0,0,0,.25)';
        row.style.border = '1px solid rgba(255,255,255,.14)';
        row.style.borderRadius = '10px';
        row.style.padding = '8px 10px';

        const top = el('div', 'trResRowTop');
        top.style.display = 'flex';
        top.style.justifyContent = 'space-between';
        top.style.alignItems = 'baseline';
        top.style.gap = '10px';

        const left = el('div', 'trResK', DP.STAT_LABEL?.[k] || k);
        left.style.fontSize = '14px';
        left.style.fontWeight = '1000';
        left.style.opacity = '.95';

        const right = el('div', 'trResV', `Lv ${p.afterLv[k]}`);
        right.style.fontSize = '13px';
        right.style.fontWeight = '1000';
        right.style.opacity = '.95';

        top.appendChild(left);
        top.appendChild(right);

        // bar
        const barWrap = el('div', 'trBarWrap');
        barWrap.style.marginTop = '6px';
        barWrap.style.height = '10px';
        barWrap.style.borderRadius = '999px';
        barWrap.style.background = 'rgba(255,255,255,.12)';
        barWrap.style.overflow = 'hidden';

        const bar = el('div', 'trBar');
        const expVal = Number(p.afterExp[k]) || 0; // 0..19
        const pct = Math.max(0, Math.min(100, (expVal / 20) * 100));
        bar.style.height = '100%';
        bar.style.width = `${pct}%`;
        bar.style.background = 'rgba(46,204,113,.85)';

        barWrap.appendChild(bar);

        const need = 20 - expVal;
        const needLine = el('div', 'trNeed', `あと ${need} でLvアップ`);
        needLine.style.marginTop = '6px';
        needLine.style.fontSize = '12px';
        needLine.style.fontWeight = '1000';
        needLine.style.opacity = '.92';

        row.appendChild(top);
        row.appendChild(barWrap);
        row.appendChild(needLine);

        grid.appendChild(row);
      });

      box.appendChild(t1);
      box.appendChild(t2);
      box.appendChild(grid);

      dom.resultList.appendChild(box);
    });

    // NEXT（OK）で確定：保存＋1週進行＋閉じる
    dom.btnOk.onclick = ()=>{
      commit(preview);
    };
  }

  /* =========================
     確定処理（保存 + 1週進行 + 最近ログ）
  ========================= */
  function commit(preview){
    // 保存対象 team
    const team = loadTeamSafe();

    // preview を反映（EXP/Lv）
    team.members.forEach(mem=>{
      const p = preview.find(x=>x.id === mem.id);
      if (!p) return;

      mem.exp = DP.normalizeExp(mem.exp);
      mem.lv  = DP.normalizeLv(mem.lv);

      DP.STAT_KEYS.forEach(k=>{
        // “最終値”へ合わせる（ズレ防止）
        mem.exp[k] = Number(p.afterExp[k]) || 0;
        mem.lv[k]  = Number(p.afterLv[k])  || 1;
      });
    });

    // 名前同期（storage → team）
    syncPlayerTeamNamesToStorageTeam(team);

    // 保存
    saveTeam(team);

    // 1週進行（1989年1月第1週スタート仕様の延長）
    let { y, m, w } = getDate();
    w += 1;
    if (w >= 5){
      w = 1;
      m += 1;
      if (m >= 13){
        m = 1;
        y += 1;
      }
    }
    S.setNum(K.year, y);
    S.setNum(K.month, m);
    S.setNum(K.week, w);

    // 最近ログ（文章のみ）
    S.setStr(K.recent, '修行を行い、チームの地力が少し上がった');

    // 閉じる → メイン/チーム再描画
    close();

    if (window.MOBBR?.initMainUI) window.MOBBR.initMainUI();
    if (window.MOBBR?.ui?.team?.render) window.MOBBR.ui.team.render();
  }

  /* =========================
     open / close
  ========================= */
  function open(){
    // 画面を開く前に状態初期化
    resetUIState();
    setDateUI();
    render();

    dom.screen.classList.add('show');
    dom.screen.setAttribute('aria-hidden', 'false');
  }

  function close(){
    dom.screen.classList.remove('show');
    dom.screen.setAttribute('aria-hidden', 'true');

    // 念のため結果を隠す（次回持ち越し防止）
    dom.resultSec.style.display = 'none';
    dom.btnOk.onclick = null;
  }

  /* =========================
     bind
  ========================= */
  let bound = false;
  function bind(){
    if (bound) return;
    bound = true;

    if (dom.close) dom.close.addEventListener('click', close);

    // 既存HTMLにあるボタンは誤爆防止で無効化（この版は確認UIから開始する）
    dom.btnStart.disabled = true;
    dom.btnStart.addEventListener('click', (e)=>{
      e.preventDefault();
      e.stopPropagation();
    });

    // “育成ボタン”を直接拾って open（ui_main が先に動いてもOK）
    const btnTraining = $('btnTraining');
    if (btnTraining){
      btnTraining.addEventListener('click', ()=>{
        open();
      });
    }
  }

  function initTrainingUI(){
    bind();
  }

  // expose
  window.MOBBR.initTrainingUI = initTrainingUI;
  window.MOBBR.ui.training = { open, close };

  // dynamic loadでも動く（複数回でも bound で守る）
  initTrainingUI();
})();
