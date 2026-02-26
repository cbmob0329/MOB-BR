　'use strict';

/*
  MOB BR - ui_training.js v17（FULL / 新修行：1回選択→全員ポイント付与）

  役割：
  - 育成（修行）画面の制御
  - 修行メニューを「1つ」選択 → 実行 → 結果を必ずポップアップ表示
  - 結果OKでのみ確定（ポイント反映 + 1週進行 + 企業ランク報酬G）
  - 大会週ブロックは nextTour / nextTourW を参照して判定（v16踏襲）

  新仕様（確定）：
  - 1回の修行で A/B/C 全員に同じポイントが入る
    射撃：筋力 +10
    パズル：技術力 +10
    研究：精神力 +10
    ダッシュ：筋力 +5 / 技術力 +5
  - 付与したポイントの「振り分け」は別UI（チーム画面の能力アップ/能力獲得）で消費する想定

  保存：
  - localStorage[mobbr_playerTeam] 内の members[*].points を使用
    points = { muscle:0, tech:0, mental:0 }
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){
  const $  = (id) => document.getElementById(id);

  const S  = window.MOBBR?.storage;
  const DP = window.MOBBR?.data?.player;

  if (!S || !DP){
    console.warn('[ui_training] storage.js / data_player.js not found');
    return;
  }

  const K = S.KEYS;

  /* =========================
     修行メニュー（新仕様：全員に同じポイント）
  ========================= */
  const TRAININGS = [
    { id:'shoot',  name:'射撃',  give:{ muscle:10, tech:0,  mental:0  }, note:'筋力 +10（全員）' },
    { id:'puzzle', name:'パズル',give:{ muscle:0,  tech:10, mental:0  }, note:'技術力 +10（全員）' },
    { id:'study',  name:'研究',  give:{ muscle:0,  tech:0,  mental:10 }, note:'精神力 +10（全員）' },
    { id:'dash',   name:'ダッシュ',give:{ muscle:5, tech:5,  mental:0  }, note:'筋力 +5 / 技術力 +5（全員）' }
  ];

  const POINT_LABEL = {
    muscle: '筋力',
    tech: '技術力',
    mental: '精神力'
  };

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
  let selectedTraining = null;

  // bind多重防止
  let bound = false;

  /* =========================
     util
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

  function clamp0(n){
    const v = Number(n);
    return Number.isFinite(v) ? Math.max(0, v) : 0;
  }

  function clone(obj){
    return JSON.parse(JSON.stringify(obj));
  }

  function weeklyGoldByRank(rank){
    if (rank >= 1 && rank <= 5) return 500;
    if (rank >= 6 && rank <= 10) return 800;
    if (rank >= 11 && rank <= 20) return 1000;
    if (rank >= 21 && rank <= 30) return 2000;
    return 3000;
  }

  function getDisplayNameById(id){
    if (id === 'A') return getStr(K.m1, 'A');
    if (id === 'B') return getStr(K.m2, 'B');
    if (id === 'C') return getStr(K.m3, 'C');
    return id;
  }

  function readPlayerTeam(){
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

  function ensurePoints(mem){
    if (!mem || typeof mem !== 'object') return;
    if (!mem.points || typeof mem.points !== 'object'){
      mem.points = { muscle:0, tech:0, mental:0 };
    }else{
      // 欠けを補完
      if (!Number.isFinite(Number(mem.points.muscle))) mem.points.muscle = 0;
      if (!Number.isFinite(Number(mem.points.tech))) mem.points.tech = 0;
      if (!Number.isFinite(Number(mem.points.mental))) mem.points.mental = 0;
    }
  }

  function normalizeTeam(team){
    if (!team || !Array.isArray(team.members)) return DP.buildDefaultTeam();

    team.members.forEach(mem=>{
      if (mem.id === 'A') mem.name = getDisplayNameById('A');
      if (mem.id === 'B') mem.name = getDisplayNameById('B');
      if (mem.id === 'C') mem.name = getDisplayNameById('C');

      ensurePoints(mem);
    });

    return team;
  }

  /* =========================
     大会週ブロック（nextTour基準） v16踏襲
  ========================= */
  function parseTourW(str){
    // "2-1" 形式のみ許可
    const s = String(str || '').trim();
    const m = s.match(/^(\d{1,2})-(\d{1,2})$/);
    if (!m) return null;
    const mm = Number(m[1]);
    const ww = Number(m[2]);
    if (!Number.isFinite(mm) || !Number.isFinite(ww)) return null;
    if (mm < 1 || mm > 12) return null;
    if (ww < 1 || ww > 4) return null;
    return { m: mm, w: ww };
  }

  function isTournamentWeekNow(){
    const now = getDate();

    const tourName = S.getStr(K.nextTour, '未定');
    const tourWStr = S.getStr(K.nextTourW, '未定');

    if (!tourName || tourName === '未定') return { locked:false };
    if (!tourWStr || tourWStr === '未定') return { locked:false };

    const tw = parseTourW(tourWStr);
    if (!tw) return { locked:false };

    const locked = (now.m === tw.m && now.w === tw.w);
    return { locked, tourName, tourWStr, now };
  }

  /* =========================
     ロック表示ポップ（簡易）
  ========================= */
  let lockPop = null;

  function ensureLockPop(){
    if (lockPop) return lockPop;

    const pop = document.createElement('div');
    pop.id = 'trainingLockPop';
    pop.className = 'modalCard';
    pop.style.display = 'none';
    pop.setAttribute('aria-hidden', 'true');

    pop.style.position = 'fixed';
    pop.style.left = '50%';
    pop.style.top = '50%';
    pop.style.transform = 'translate(-50%,-50%)';
    pop.style.zIndex = '10000';
    pop.style.width = 'min(560px, 92vw)';
    pop.style.maxHeight = '78vh';
    pop.style.overflow = 'auto';

    const title = document.createElement('div');
    title.className = 'modalTitle';
    title.textContent = '修行できません';

    const msg = document.createElement('div');
    msg.id = 'trainingLockMsg';
    msg.style.marginTop = '10px';
    msg.style.whiteSpace = 'pre-wrap';
    msg.style.fontSize = '14px';
    msg.style.lineHeight = '1.55';
    msg.style.opacity = '0.95';

    const ok = document.createElement('button');
    ok.id = 'btnTrainingLockOk';
    ok.className = 'closeBtn';
    ok.type = 'button';
    ok.textContent = 'OK';
    ok.style.marginTop = '14px';

    pop.appendChild(title);
    pop.appendChild(msg);
    pop.appendChild(ok);

    document.body.appendChild(pop);
    lockPop = pop;

    ok.addEventListener('click', ()=>{
      pop.style.display = 'none';
      pop.setAttribute('aria-hidden', 'true');
      hideBack();
    });

    return pop;
  }

  function showLockedPopup(tourName, tourWStr, now){
    const pop = ensureLockPop();
    const msg = $('trainingLockMsg');

    const nowText = `${now.y}年${now.m}月 第${now.w}週`;
    const tourText = `${tourName}（${tourWStr}）`;

    if (msg){
      msg.textContent =
        `今週は「${tourText}」の週です。\n` +
        `（現在：${nowText}）\n` +
        `修行はできません。大会に進んでください。`;
    }

    showBack();
    pop.style.display = 'block';
    pop.setAttribute('aria-hidden', 'false');
  }

  /* =========================
     UI描画：1枚カード＋メニュー
  ========================= */
  function renderCards(){
    if (!dom.cards) return;
    dom.cards.innerHTML = '';

    const wrap = document.createElement('div');
    wrap.className = 'trainingCard';

    const title = document.createElement('div');
    title.className = 'trainingTitle';
    title.textContent = '修行（1回選ぶだけ）';

    const desc = document.createElement('div');
    desc.className = 'trainingDesc';
    desc.textContent =
      '修行メニューを1つ選択すると、A/B/C 全員に同じポイントが入ります。\n' +
      'ポイントの振り分けは「能力アップ / 能力獲得」で行います。';

    const list = document.createElement('div');
    list.className = 'trainingMenuList';

    TRAININGS.forEach(tr=>{
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'trainingMenuBtn';

      const t1 = document.createElement('div');
      t1.className = 't1';
      t1.textContent = tr.name;

      const t2 = document.createElement('div');
      t2.className = 't2';
      t2.textContent = tr.note;

      btn.appendChild(t1);
      btn.appendChild(t2);

      if (selectedTraining?.id === tr.id){
        btn.classList.add('selected');
      }

      btn.addEventListener('click', ()=>{
        selectedTraining = tr;
        renderCards();
        if (dom.btnStart) dom.btnStart.disabled = !selectedTraining;
      });

      list.appendChild(btn);
    });

    wrap.appendChild(title);
    wrap.appendChild(desc);
    wrap.appendChild(list);

    dom.cards.appendChild(wrap);
  }

  /* =========================
     preview（結果表示用）
  ========================= */
  function buildGiveText(give){
    const parts = [];
    if (give.muscle) parts.push(`${POINT_LABEL.muscle}+${give.muscle}`);
    if (give.tech) parts.push(`${POINT_LABEL.tech}+${give.tech}`);
    if (give.mental) parts.push(`${POINT_LABEL.mental}+${give.mental}`);
    return parts.join(' / ') || 'なし';
  }

  function applyTrainingPreview(team, tr){
    const res = [];
    const give = tr?.give || { muscle:0, tech:0, mental:0 };

    team.members.forEach(mem=>{
      ensurePoints(mem);

      const before = clone(mem.points);

      mem.points.muscle = clamp0(mem.points.muscle + (give.muscle || 0));
      mem.points.tech   = clamp0(mem.points.tech   + (give.tech   || 0));
      mem.points.mental = clamp0(mem.points.mental + (give.mental || 0));

      const after = clone(mem.points);

      res.push({
        id: mem.id,
        name: getDisplayNameById(mem.id),
        trainingName: tr.name,
        give: clone(give),
        giveText: buildGiveText(give),
        before,
        after
      });
    });

    return res;
  }

  /* =========================
     結果ポップアップ
  ========================= */
  let resultPop = null;
  function ensureResultPop(){
    if (resultPop) return resultPop;

    const pop = document.createElement('div');
    pop.id = 'trainingResultPop';
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

  function renderResultPop(previewResults, tr){
    const sub = $('trainingResultSub');
    const list = $('trainingResultListPop');

    if (sub){
      sub.textContent = `「${tr.name}」を実行しました。A/B/C 全員に ${buildGiveText(tr.give)} が入ります。`;
    }
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
      top.textContent = `${r.name}`;

      const add = document.createElement('div');
      add.style.marginTop = '6px';
      add.style.fontSize = '13px';
      add.style.opacity = '0.95';
      add.textContent = `付与：${r.giveText}`;

      const now = document.createElement('div');
      now.style.marginTop = '10px';
      now.style.fontSize = '12px';
      now.style.opacity = '0.92';
      now.style.lineHeight = '1.45';
      now.textContent =
        `所持ポイント：` +
        `${POINT_LABEL.muscle}${r.after.muscle} / ` +
        `${POINT_LABEL.tech}${r.after.tech} / ` +
        `${POINT_LABEL.mental}${r.after.mental}`;

      card.appendChild(top);
      card.appendChild(add);
      card.appendChild(now);

      list.appendChild(card);
    });
  }

  /* =========================
     週進行＆報酬ポップ（簡易版）
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
    let team = normalizeTeam(readPlayerTeam());

    // previewResults の after をそのまま確定
    team.members.forEach(mem=>{
      const r = previewResults.find(x => x.id === mem.id);
      if (!r) return;
      ensurePoints(mem);
      mem.points.muscle = clamp0(r.after.muscle);
      mem.points.tech   = clamp0(r.after.tech);
      mem.points.mental = clamp0(r.after.mental);
    });

    writePlayerTeam(team);

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

    // 企業ランク報酬G
    const rank = S.getNum(K.rank, 10);
    const gain = weeklyGoldByRank(rank);
    const gold = S.getNum(K.gold, 0);
    S.setNum(K.gold, gold + gain);

    // recent（演出）
    S.setStr(K.recent, `修行を行い、週が進んだ（+${gain}G）`);

    // UI再描画
    if (window.MOBBR.initMainUI) window.MOBBR.initMainUI();
    if (window.MOBBR.ui?.team?.render) window.MOBBR.ui.team.render();

    // 週＆報酬ポップ
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
    // 大会週ブロック（nextTour基準）
    const lock = isTournamentWeekNow();
    if (lock.locked){
      showLockedPopup(lock.tourName, lock.tourWStr, lock.now);
      return;
    }

    selectedTraining = null;
    closeResultPop();

    if (dom.btnStart) dom.btnStart.disabled = true;

    updateDateUI();
    renderCards();

    if (dom.close) dom.close.disabled = false;

    if (dom.screen){
      dom.screen.classList.add('show');
      dom.screen.setAttribute('aria-hidden', 'false');
    }
  }

  function close(){
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
        // 念のため：開始ボタン押下時も大会週チェック
        const lock = isTournamentWeekNow();
        if (lock.locked){
          showLockedPopup(lock.tourName, lock.tourWStr, lock.now);
          return;
        }

        if (!selectedTraining) return;

        if (dom.close) dom.close.disabled = true;

        const teamPreview = clone(normalizeTeam(readPlayerTeam()));
        const previewResults = applyTrainingPreview(teamPreview, selectedTraining);

        renderResultPop(previewResults, selectedTraining);
        openResultPop();

        const ok = $('btnTrainingResultOk');
        if (ok){
          ok.onclick = () => {
            closeResultPop();

            if (dom.screen){
              dom.screen.classList.remove('show');
              dom.screen.setAttribute('aria-hidden', 'true');
            }

            commitAndAdvance(previewResults);

            if (dom.close) dom.close.disabled = false;
          };
        }
      });
    }

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
