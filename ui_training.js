'use strict';

/*
  MOB BR - ui_training.js v16（フル / 大会週ブロック追加）

  役割：
  - 育成（修行）画面の制御
  - 3人分の修行を選択 → 実行 → 結果を必ずポップアップ表示
  - 結果OKでのみ確定（EXP反映 + Lv処理 + 1週進行 + 企業ランク報酬G）
  - メニューに「何がアップするか」を表示

  設計方針（重要）：
  - 途中状態は保存しない（事故防止）
  - commit（保存・週進行）は「結果ポップアップOK」だけ
  - 結果表示中は trainingScreen を操作させない（閉じる無効 + modalBack）

  v16 追加：
  - ★大会週は修行を開けない＆実行できない（大会優先）
    判定は ui_schedule.js と同じ表を内蔵して「今週が大会ならブロック」
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
     大会スケジュール（ui_schedule.js と同一）
     - 「今週が大会」なら修行をブロック
  ========================= */
  const TOURNAMENT_SCHEDULE = [
    { m:2, w:1, name:'ローカル大会' },
    { m:3, w:1, name:'ナショナル大会' },
    { m:3, w:2, name:'ナショナル大会後半' },
    { m:3, w:3, name:'ナショナルラストチャンス' },
    { m:4, w:1, name:'ワールドファイナル' },

    { m:7, w:1, name:'ローカル大会' },
    { m:8, w:1, name:'ナショナル大会' },
    { m:8, w:2, name:'ナショナル大会後半' },
    { m:8, w:3, name:'ナショナルラストチャンス' },
    { m:9, w:1, name:'ワールドファイナル' },

    { m:11, w:1, name:'ローカル大会' },
    { m:12, w:1, name:'ナショナル大会' },
    { m:12, w:2, name:'ナショナル大会後半' },
    { m:12, w:3, name:'ナショナルラストチャンス' },
    { m:1,  w:2, name:'チャンピオンシップ ワールドファイナル' }
  ];

  /* =========================
     修行メニュー定義（確定仕様）
     - 共通：全能力 EXP +1
     - 専門：対象能力 EXP +4（＝共通+1 +追加+3）
     - 総合：全能力 EXP +2（＝共通+1 +追加+1）
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
     DOM（既存HTML前提）
  ========================= */
  const dom = {
    screen: $('trainingScreen'),
    close: $('btnCloseTraining'),

    trY: $('trY'),
    trM: $('trM'),
    trW: $('trW'),

    cards: $('trainingCards'),
    btnStart: $('btnTrainingStart')
  };

  // 共通の透明フタ（あれば使う）
  const modalBack = $('modalBack');

  /* =========================
     内部状態（保存しない）
  ========================= */
  let selected = { A:null, B:null, C:null };

  // bind多重防止
  let bound = false;

  /* =========================
     ユーティリティ
  ========================= */
  function getStr(key, def){
    const v = localStorage.getItem(key);
    return (v === null || v === undefined || v === '') ? def : v;
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
    if (dom.trY) dom.trY.textContent = d.y;
    if (dom.trM) dom.trM.textContent = d.m;
    if (dom.trW) dom.trW.textContent = d.w;
  }

  function showBack(){
    if (!modalBack) return;
    modalBack.style.display = 'block';
    modalBack.setAttribute('aria-hidden', 'false');
  }
  function hideBack(){
    if (!modalBack) return;
    modalBack.style.display = 'none';
    modalBack.setAttribute('aria-hidden', 'true');
  }

  function allSelected(){
    return !!(selected.A && selected.B && selected.C);
  }

  function labelUp(tr){
    if (!tr) return '';
    if (tr.up === 'all') return '全能力';
    const keys = tr.up || [];
    const parts = keys.map(k => DP.STAT_LABEL?.[k] || k);
    return parts.join(' / ');
  }

  function getDisplayNameById(id){
    // まず storage の m1/m2/m3 を優先（ユーザーが変更できる）
    if (id === 'A') return getStr(K.m1, 'A');
    if (id === 'B') return getStr(K.m2, 'B');
    if (id === 'C') return getStr(K.m3, 'C');
    return id;
  }

  function readPlayerTeam(){
    // mobbr_playerTeam が壊れてても落とさず、必ずチームを返す
    try{
      const raw = localStorage.getItem(K.playerTeam);
      const team = raw ? JSON.parse(raw) : null;
      if (team && Array.isArray(team.members)) return team;
    }catch(e){}
    return DP.buildDefaultTeam();
  }

  function writePlayerTeam(team){
    localStorage.setItem(K.playerTeam, JSON.stringify(team));
  }

  function normalizeTeam(team){
    // exp/lv が欠けてても安全化
    if (!team || !Array.isArray(team.members)) return DP.buildDefaultTeam();

    team.members.forEach(mem=>{
      mem.exp = DP.normalizeExp(mem.exp);
      mem.lv  = DP.normalizeLv(mem.lv);

      // name は storageの名前で上書きして整合を保つ（全画面反映の基礎）
      if (mem.id === 'A') mem.name = getDisplayNameById('A');
      if (mem.id === 'B') mem.name = getDisplayNameById('B');
      if (mem.id === 'C') mem.name = getDisplayNameById('C');
    });

    return team;
  }

  function clone(obj){
    return JSON.parse(JSON.stringify(obj));
  }

  function weeklyGoldByRank(rank){
    // ui_main.js と同じテーブル（安定運用のため揃える）
    if (rank >= 1 && rank <= 5) return 500;
    if (rank >= 6 && rank <= 10) return 800;
    if (rank >= 11 && rank <= 20) return 1000;
    if (rank >= 21 && rank <= 30) return 2000;
    return 3000;
  }

  /* =========================
     大会週ブロック
  ========================= */
  function getTournamentToday(){
    const d = getDate();
    for (const it of TOURNAMENT_SCHEDULE){
      if (Number(it.m) === Number(d.m) && Number(it.w) === Number(d.w)){
        return { name: String(it.name || '大会') };
      }
    }
    return null;
  }

  function announce(msg){
    // できるだけ既存UIに寄せて表示
    try{
      const ui = window.MOBBR?.ui;
      if (ui && typeof ui.showMessage === 'function'){
        ui.showMessage(String(msg || ''));
        return;
      }
    }catch(e){}

    // 最後の砦
    try{ alert(String(msg || '')); }catch(e){}
  }

  let blockPop = null;
  function ensureBlockPop(){
    if (blockPop) return blockPop;

    const pop = document.createElement('div');
    pop.id = 'trainingBlockPop';
    pop.className = 'modalCard';
    pop.style.display = 'none';
    pop.setAttribute('aria-hidden', 'true');

    pop.style.position = 'fixed';
    pop.style.left = '50%';
    pop.style.top = '50%';
    pop.style.transform = 'translate(-50%,-50%)';
    pop.style.zIndex = '9999';
    pop.style.width = 'min(560px, 92vw)';
    pop.style.maxHeight = '78vh';
    pop.style.overflow = 'auto';

    const title = document.createElement('div');
    title.className = 'modalTitle';
    title.textContent = '修行できません';

    const sub = document.createElement('div');
    sub.id = 'trainingBlockSub';
    sub.style.marginTop = '10px';
    sub.style.fontWeight = '1000';
    sub.style.opacity = '0.95';
    sub.style.lineHeight = '1.45';

    const ok = document.createElement('button');
    ok.className = 'closeBtn';
    ok.type = 'button';
    ok.id = 'btnTrainingBlockOk';
    ok.textContent = 'OK';
    ok.style.marginTop = '14px';

    pop.appendChild(title);
    pop.appendChild(sub);
    pop.appendChild(ok);

    document.body.appendChild(pop);
    blockPop = pop;

    ok.addEventListener('click', ()=>{
      blockPop.style.display = 'none';
      blockPop.setAttribute('aria-hidden', 'true');
      hideBack();
    });

    return blockPop;
  }

  function showTournamentBlockPop(tourName){
    const pop = ensureBlockPop();
    const sub = $('trainingBlockSub');
    const d = getDate();

    if (sub){
      sub.textContent =
        `今週は「${tourName}」の週です。\n` +
        `（${d.m}月 第${d.w}週）\n` +
        `修行はできません。大会に進んでください。`;
    }

    // 演出ログにも残す（任意だが分かりやすい）
    try{
      S.setStr(K.recent, `大会週のため修行はできない（${tourName}）`);
      if (window.MOBBR.initMainUI) window.MOBBR.initMainUI();
    }catch(e){}

    showBack();
    pop.style.display = 'block';
    pop.setAttribute('aria-hidden', 'false');
  }

  function guardTournamentWeekOrReturnFalse(){
    const t = getTournamentToday();
    if (!t) return true;

    // 画面を開かせない（＆もし開いてても閉じる）
    try{
      if (dom.screen){
        dom.screen.classList.remove('show');
        dom.screen.setAttribute('aria-hidden', 'true');
      }
      if (dom.btnStart) dom.btnStart.disabled = true;
    }catch(e){}

    showTournamentBlockPop(t.name || '大会');
    return false;
  }

  /* =========================
     UI生成：修行カード
  ========================= */
  function renderCards(){
    if (!dom.cards) return;
    dom.cards.innerHTML = '';

    const team = normalizeTeam(readPlayerTeam());
    const members = team.members;

    members.forEach(mem=>{
      const wrap = document.createElement('div');
      wrap.className = 'trainingCard';

      const title = document.createElement('div');
      title.className = 'trainingMember';
      title.textContent = getDisplayNameById(mem.id);

      const list = document.createElement('div');
      list.className = 'trainingMenuList';

      TRAININGS.forEach(tr=>{
        const btn = document.createElement('button');
        btn.type = 'button';
        btn.className = 'trainingMenuBtn';

        // 2行表示（CSSが無くても崩れにくいよう span）
        const line1 = document.createElement('div');
        line1.textContent = tr.name;

        const line2 = document.createElement('div');
        line2.style.fontSize = '12px';
        line2.style.opacity = '0.9';
        line2.style.marginTop = '2px';
        line2.textContent = `↑ ${labelUp(tr)}`;

        btn.appendChild(line1);
        btn.appendChild(line2);

        if (selected[mem.id]?.id === tr.id){
          btn.classList.add('selected');
        }

        btn.addEventListener('click', ()=>{
          // 大会週なら選択自体も止める（誤操作防止）
          if (!guardTournamentWeekOrReturnFalse()) return;

          selected[mem.id] = tr;
          renderCards();
          if (dom.btnStart) dom.btnStart.disabled = !allSelected();
        });

        list.appendChild(btn);
      });

      wrap.appendChild(title);
      wrap.appendChild(list);
      dom.cards.appendChild(wrap);
    });
  }

  /* =========================
     結果計算（プレビュー）
  ========================= */
  function calcExpAddForTraining(tr){
    const add = {};
    // 共通 +1
    DP.STAT_KEYS.forEach(k => add[k] = 1);

    // 専門 or 総合
    if (tr.up === 'all'){
      DP.STAT_KEYS.forEach(k => add[k] += 1); // 合計 +2
    }else{
      (tr.up || []).forEach(k => add[k] += 3); // 合計 +4
    }
    return add;
  }

  function applyTrainingPreview(team){
    // team は clone 済み想定
    const res = [];

    team.members.forEach(mem=>{
      const tr = selected[mem.id];
      const expAdd = calcExpAddForTraining(tr);

      mem.exp = DP.normalizeExp(mem.exp);
      mem.lv  = DP.normalizeLv(mem.lv);

      const before = { exp: clone(mem.exp), lv: clone(mem.lv) };

      // 反映（preview）
      DP.STAT_KEYS.forEach(k=>{
        mem.exp[k] += expAdd[k];
        while (mem.exp[k] >= 20){
          mem.exp[k] -= 20;
          mem.lv[k] += 1;
        }
      });

      const after = { exp: clone(mem.exp), lv: clone(mem.lv) };

      res.push({
        id: mem.id,
        name: getDisplayNameById(mem.id),
        trainingName: tr.name,
        expAdd,
        before,
        after
      });
    });

    return res;
  }

  /* =========================
     結果ポップアップ（DOM動的生成）
  ========================= */
  let resultPop = null;
  function ensureResultPop(){
    if (resultPop) return resultPop;

    // modalCard を流用（base.cssがある前提）
    const pop = document.createElement('div');
    pop.id = 'trainingResultPop';
    pop.className = 'modalCard';
    pop.style.display = 'none';
    pop.setAttribute('aria-hidden', 'true');

    // 画面中央寄せ（base.cssが無い環境でも最低限動く）
    pop.style.position = 'fixed';
    pop.style.left = '50%';
    pop.style.top = '50%';
    pop.style.transform = 'translate(-50%,-50%)';
    pop.style.zIndex = '9999';
    pop.style.width = 'min(560px, 92vw)';
    pop.style.maxHeight = '78vh';
    pop.style.overflow = 'auto';

    const title = document.createElement('div');
    title.className = 'modalTitle';
    title.textContent = '修行結果';

    const sub = document.createElement('div');
    sub.id = 'trainingResultSub';
    sub.style.marginTop = '6px';
    sub.style.fontWeight = '900';
    sub.style.opacity = '0.95';

    const list = document.createElement('div');
    list.id = 'trainingResultListPop';
    list.style.marginTop = '12px';
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '12px';

    const ok = document.createElement('button');
    ok.id = 'btnTrainingResultOk';
    ok.className = 'closeBtn';
    ok.type = 'button';
    ok.textContent = 'OK（週を進めて確定）';
    ok.style.marginTop = '14px';

    pop.appendChild(title);
    pop.appendChild(sub);
    pop.appendChild(list);
    pop.appendChild(ok);

    document.body.appendChild(pop);
    resultPop = pop;
    return pop;
  }

  function openResultPop(){
    const pop = ensureResultPop();
    showBack();
    pop.style.display = 'block';
    pop.setAttribute('aria-hidden', 'false');
  }

  function closeResultPop(){
    if (!resultPop) return;
    resultPop.style.display = 'none';
    resultPop.setAttribute('aria-hidden', 'true');
    hideBack();
  }

  function renderExpBar(exp){
    const wrap = document.createElement('div');
    wrap.style.marginTop = '6px';

    const bar = document.createElement('div');
    bar.style.width = '100%';
    bar.style.height = '10px';
    bar.style.borderRadius = '999px';
    bar.style.background = 'rgba(255,255,255,.18)';
    bar.style.overflow = 'hidden';

    const fill = document.createElement('div');
    fill.style.height = '100%';
    fill.style.width = `${Math.max(0, Math.min(100, (exp/20)*100))}%`;
    fill.style.background = 'rgba(255,255,255,.78)';

    bar.appendChild(fill);
    wrap.appendChild(bar);
    return wrap;
  }

  function renderResultPop(previewResults){
    const sub = $('trainingResultSub');
    const list = $('trainingResultListPop');

    if (sub) sub.textContent = '修行完了！OKで確定して1週進みます。';
    if (!list) return;

    list.innerHTML = '';

    previewResults.forEach(r=>{
      const card = document.createElement('div');
      card.style.borderRadius = '12px';
      card.style.padding = '12px';
      card.style.background = 'rgba(255,255,255,.10)';
      card.style.border = '1px solid rgba(255,255,255,.14)';

      const top = document.createElement('div');
      top.style.fontWeight = '1000';
      top.style.fontSize = '16px';
      top.textContent = `${r.name}：${r.trainingName}`;

      const note = document.createElement('div');
      note.style.marginTop = '4px';
      note.style.opacity = '0.92';
      note.style.fontSize = '13px';
      note.textContent = `共通 +1 / 専門 or 総合で追加（表示はEXPのみ）`;

      card.appendChild(top);
      card.appendChild(note);

      const grid = document.createElement('div');
      grid.style.marginTop = '10px';
      grid.style.display = 'flex';
      grid.style.flexDirection = 'column';
      grid.style.gap = '8px';

      DP.STAT_KEYS.forEach(k=>{
        const row = document.createElement('div');

        const label = DP.STAT_LABEL?.[k] || k;
        const add = r.expAdd[k] || 0;

        const afterExp = r.after.exp[k] ?? 0;
        const beforeLv = r.before.lv[k] ?? 1;
        const afterLv = r.after.lv[k] ?? beforeLv;

        const head = document.createElement('div');
        head.style.display = 'flex';
        head.style.justifyContent = 'space-between';
        head.style.alignItems = 'baseline';
        head.style.gap = '10px';

        const left = document.createElement('div');
        left.style.fontWeight = '1000';
        left.style.fontSize = '13px';
        left.textContent = `${label}  +${add}EXP`;

        const right = document.createElement('div');
        right.style.fontWeight = '900';
        right.style.fontSize = '12px';
        right.style.opacity = '0.95';

        const need = Math.max(0, 20 - (afterExp % 20));
        const lvText = (afterLv !== beforeLv) ? `LvUP! (${beforeLv}→${afterLv})` : `あと${need}でLvUP`;
        right.textContent = `EXP ${afterExp}/20  ・ ${lvText}`;

        head.appendChild(left);
        head.appendChild(right);

        row.appendChild(head);
        row.appendChild(renderExpBar(afterExp % 20));

        grid.appendChild(row);
      });

      card.appendChild(grid);
      list.appendChild(card);
    });
  }

  /* =========================
     週進行＆報酬ポップ（簡易版：動的生成）
  ========================= */
  let weekPop = null;
  function ensureWeekPop(){
    if (weekPop) return weekPop;

    const pop = document.createElement('div');
    pop.id = 'trainingWeekPop';
    pop.className = 'modalCard';
    pop.style.display = 'none';
    pop.setAttribute('aria-hidden', 'true');

    pop.style.position = 'fixed';
    pop.style.left = '50%';
    pop.style.top = '50%';
    pop.style.transform = 'translate(-50%,-50%)';
    pop.style.zIndex = '9999';
    pop.style.width = 'min(560px, 92vw)';

    const title = document.createElement('div');
    title.className = 'modalTitle';
    title.id = 'trainingWeekPopTitle';
    title.textContent = '週が進んだ';

    const sub = document.createElement('div');
    sub.id = 'trainingWeekPopSub';
    sub.style.marginTop = '8px';
    sub.style.fontWeight = '1000';
    sub.style.opacity = '0.95';

    const ok = document.createElement('button');
    ok.className = 'closeBtn';
    ok.type = 'button';
    ok.id = 'btnTrainingWeekPopOk';
    ok.textContent = 'OK';
    ok.style.marginTop = '14px';

    pop.appendChild(title);
    pop.appendChild(sub);
    pop.appendChild(ok);

    document.body.appendChild(pop);
    weekPop = pop;
    return pop;
  }

  function showWeekGainPop(titleText, subText, onOk){
    const pop = ensureWeekPop();
    const t = $('trainingWeekPopTitle');
    const s = $('trainingWeekPopSub');
    const ok = $('btnTrainingWeekPopOk');

    if (t) t.textContent = titleText;
    if (s) s.textContent = subText;

    showBack();
    pop.style.display = 'block';
    pop.setAttribute('aria-hidden', 'false');

    if (ok){
      ok.onclick = () => {
        pop.style.display = 'none';
        pop.setAttribute('aria-hidden', 'true');
        hideBack();
        if (typeof onOk === 'function') onOk();
      };
    }
  }

  /* =========================
     commit（OKでのみ）
  ========================= */
  function commitAndAdvance(previewResults){
    // ★大会週は絶対にcommitさせない（二重防止）
    if (!guardTournamentWeekOrReturnFalse()) return;

    // 1) teamを読み込み
    let team = normalizeTeam(readPlayerTeam());

    // 2) EXP/Lv を previewResults 通りに反映
    team.members.forEach(mem=>{
      const r = previewResults.find(x => x.id === mem.id);
      if (!r) return;

      mem.exp = DP.normalizeExp(mem.exp);
      mem.lv  = DP.normalizeLv(mem.lv);

      DP.STAT_KEYS.forEach(k=>{
        mem.exp[k] += (r.expAdd[k] || 0);
        while (mem.exp[k] >= 20){
          mem.exp[k] -= 20;
          mem.lv[k] += 1;
        }
      });
    });

    writePlayerTeam(team);

    // 3) 週進行
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

    // 4) 企業ランク報酬G
    const rank = S.getNum(K.rank, 10);
    const gain = weeklyGoldByRank(rank);
    const gold = S.getNum(K.gold, 0);
    S.setNum(K.gold, gold + gain);

    // 5) recent（演出）
    S.setStr(K.recent, `修行を行い、週が進んだ（+${gain}G）`);

    // 6) UI再描画
    if (window.MOBBR.initMainUI) window.MOBBR.initMainUI();
    if (window.MOBBR.ui?.team?.render) window.MOBBR.ui.team.render();

    // 7) 週＆報酬ポップ
    showWeekGainPop(
      `${y}年${m}月 第${w}週`,
      `企業ランク${rank}なので ${gain}G 手に入れた！`,
      () => {
        if (window.MOBBR.initMainUI) window.MOBBR.initMainUI();
      }
    );
  }

  /* =========================
     open / close
  ========================= */
  function open(){
    // ★大会週は開かせない
    if (!guardTournamentWeekOrReturnFalse()) return;

    selected = { A:null, B:null, C:null };

    // 結果ポップが残ってたら消す
    closeResultPop();

    // 開いた直後はスタート不可
    if (dom.btnStart) dom.btnStart.disabled = true;

    updateDateUI();
    renderCards();

    if (dom.screen){
      dom.screen.classList.add('show');
      dom.screen.setAttribute('aria-hidden', 'false');
    }
  }

  function close(){
    // 結果表示中は閉じさせない（事故防止）
    if (resultPop && resultPop.style.display !== 'none') return;

    if (dom.screen){
      dom.screen.classList.remove('show');
      dom.screen.setAttribute('aria-hidden', 'true');
    }
  }

  /* =========================
     bind
  ========================= */
  function bind(){
    if (bound) return;
    bound = true;

    if (dom.close){
      dom.close.addEventListener('click', close);
    }

    if (dom.btnStart){
      dom.btnStart.addEventListener('click', ()=>{
        // ★大会週は実行できない
        if (!guardTournamentWeekOrReturnFalse()) return;

        if (!allSelected()) return;

        // trainingScreen操作防止（閉じる無効）
        if (dom.close) dom.close.disabled = true;

        // preview作成
        const teamPreview = clone(normalizeTeam(readPlayerTeam()));
        const previewResults = applyTrainingPreview(teamPreview);

        // 結果ポップ表示
        renderResultPop(previewResults);
        openResultPop();

        // OKで確定
        const ok = $('btnTrainingResultOk');
        if (ok){
          ok.onclick = () => {
            // ★OK直前も大会週チェック（安全）
            if (!guardTournamentWeekOrReturnFalse()){
              // 結果ポップ閉じ＆復帰
              closeResultPop();
              if (dom.close) dom.close.disabled = false;
              return;
            }

            // 結果ポップ閉じ
            closeResultPop();

            // trainingScreen 自体は閉じる（仕様：結果は別ポップでやる）
            if (dom.screen){
              dom.screen.classList.remove('show');
              dom.screen.setAttribute('aria-hidden', 'true');
            }

            // commit & week gain pop
            commitAndAdvance(previewResults);

            // 次回のために閉じる復帰
            if (dom.close) dom.close.disabled = false;
          };
        }
      });
    }

    // modalBack は「背景タップで閉じない」（誤爆防止）
    if (modalBack){
      modalBack.addEventListener('click', (e)=> e.preventDefault(), { passive:false });
    }
  }

  function initTrainingUI(){
    bind();
  }

  // expose
  window.MOBBR.initTrainingUI = initTrainingUI;
  window.MOBBR.ui.training = { open, close };

  document.addEventListener('DOMContentLoaded', initTrainingUI);
})();
