'use strict';

/*
  MOB BR - ui_tournament.js v1（フル）
  - 大会画面UI（本番：CSS分離）
  - ui_main.js(v18) は Flow を呼ぶ → Flow がこの UI を open() する
  - ここでは btnBattle を bind しない（ui_main.js と二重発火させない）

  コーチスキル：
  - 最新版仕様：5種のみ（内部効果は後で sim 側が参照）
  - “装備中”から1つ選んで使用（= 所持 -1 / 装備枠から除去）
  - “使わない”あり
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){
  const $ = (id) => document.getElementById(id);

  // ===== keys =====
  const COACH_OWNED_KEY    = 'mobbr_coachSkillsOwned';      // { id: count }
  const COACH_EQUIP_KEY    = 'mobbr_coachSkillsEquipped';   // [id|null, id|null, id|null]
  const COACH_SELECTED_KEY = 'mobbr_coachSkillSelected';    // string|null（この試合で使用）

  const TS_KEY = 'mobbr_tournamentState'; // sim_tournament_flow.js が生成

  // ===== images =====
  const IMG_NEONMAIN = 'neonmain.png';
  const IMG_TENT     = 'tent.png';

  // ===== coach master（最新版：5種）=====
  const COACH_SKILLS = [
    { id:'tactics_note',  name:'戦術ノート',     effectLabel:'常時：戦闘総合力 ×1.01', coachLine:'戦術を大事にして戦おう！' },
    { id:'endgame_power', name:'終盤の底力',     effectLabel:'終盤(R5/R6)：戦闘総合力 ×1.03', coachLine:'終盤一気に攻めるぞ！' },
    { id:'score_mind',    name:'スコア意識',     effectLabel:'お宝/フラッグ取得が伸びる（+1追加）', coachLine:'お宝狙いだ！全力で探せ！' },
    { id:'igl_call',      name:'IGL強化コール',  effectLabel:'常時：戦闘総合力 ×1.05', coachLine:'IGLを信じるんだ！' },
    { id:'protagonist',   name:'主人公ムーブ',   effectLabel:'常時：戦闘総合力 ×1.10', coachLine:'この試合の主人公はお前たちだ！' }
  ];
  const COACH_BY_ID = Object.fromEntries(COACH_SKILLS.map(s => [s.id, s]));

  // ===== state =====
  let ui = null;
  let step = 'arrival'; // arrival -> teams -> coachPick -> coachConfirm -> r1
  let selectedSkillId = null;

  // ===== helpers =====
  function safeParse(raw, fallback){
    try{ return JSON.parse(raw); }catch{ return fallback; }
  }

  function readOwned(){
    const obj = safeParse(localStorage.getItem(COACH_OWNED_KEY) || '{}', {});
    return (obj && typeof obj === 'object') ? obj : {};
  }

  function readEquipped(){
    const arr = safeParse(localStorage.getItem(COACH_EQUIP_KEY) || '[]', []);
    if (!Array.isArray(arr)) return [null,null,null];
    const out = [arr[0] ?? null, arr[1] ?? null, arr[2] ?? null];
    return out.map(v => (typeof v === 'string' && v.trim()) ? v : null);
  }

  function writeOwned(obj){
    localStorage.setItem(COACH_OWNED_KEY, JSON.stringify(obj || {}));
  }

  function writeEquipped(arr){
    const out = Array.isArray(arr) ? arr.slice(0,3) : [null,null,null];
    const norm = out.map(v => (typeof v === 'string' && v.trim()) ? v : null);
    while (norm.length < 3) norm.push(null);
    localStorage.setItem(COACH_EQUIP_KEY, JSON.stringify(norm));
  }

  function setSelectedSkill(idOrNull){
    if (!idOrNull){
      localStorage.removeItem(COACH_SELECTED_KEY);
      return;
    }
    localStorage.setItem(COACH_SELECTED_KEY, String(idOrNull));
  }

  function consumeSkill(skillId){
    // owned--
    const owned = readOwned();
    const cnt = Number(owned[skillId]) || 0;
    if (cnt > 0) owned[skillId] = cnt - 1;
    writeOwned(owned);

    // equipped remove（同IDが入ってたら null に）
    const eq = readEquipped().map(v => (v === skillId) ? null : v);
    writeEquipped(eq);
  }

  function loadTournamentState(){
    const st = safeParse(localStorage.getItem(TS_KEY) || 'null', null);
    return st && typeof st === 'object' ? st : null;
  }

  function hardHideModalBack(){
    const back = $('modalBack');
    if (back){
      back.style.display = 'none';
      back.style.pointerEvents = 'none';
      back.setAttribute('aria-hidden', 'true');
    }
  }

  // ===== DOM build =====
  function ensureDOM(){
    if (ui) return ui;

    const root = document.createElement('div');
    root.className = 'mobbrTui';
    root.setAttribute('aria-hidden', 'true');

    const bg = document.createElement('div');
    bg.className = 'tuiBg';
    root.appendChild(bg);

    const wrap = document.createElement('div');
    wrap.className = 'tuiWrap';

    // top
    const top = document.createElement('div');
    top.className = 'tuiTop';

    const title = document.createElement('div');
    title.className = 'tuiTitle';
    title.textContent = '大会';
    top.appendChild(title);

    const meta = document.createElement('div');
    meta.className = 'tuiMeta';
    meta.textContent = '文章演出のみ';
    top.appendChild(meta);

    const close = document.createElement('button');
    close.className = 'tuiClose';
    close.type = 'button';
    close.textContent = '戻る';
    close.addEventListener('click', () => closeUI());
    top.appendChild(close);

    // center
    const center = document.createElement('div');
    center.className = 'tuiCenter';

    const sq = document.createElement('div');
    sq.className = 'tuiSquare';

    const sqBg = document.createElement('div');
    sqBg.className = 'tuiSquareBg';
    sq.appendChild(sqBg);

    const inner = document.createElement('div');
    inner.className = 'tuiSquareInner';

    const banner = document.createElement('div');
    banner.className = 'tuiBanner';
    banner.innerHTML = `<div class="left" id="tuiBannerLeft">大会到着</div><div class="right" id="tuiBannerRight">NEXTで進行</div>`;
    inner.appendChild(banner);

    const scroll = document.createElement('div');
    scroll.className = 'tuiScroll';
    scroll.id = 'tuiScroll';
    inner.appendChild(scroll);

    const log = document.createElement('div');
    log.className = 'tuiLog';
    log.innerHTML = `<div class="tuiLogMain" id="tuiLogMain"></div><div class="tuiLogSub" id="tuiLogSub"></div>`;
    inner.appendChild(log);

    sq.appendChild(inner);
    center.appendChild(sq);

    // bottom
    const bottom = document.createElement('div');
    bottom.className = 'tuiBottom';

    const btnNext = document.createElement('button');
    btnNext.className = 'tuiBtn';
    btnNext.type = 'button';
    btnNext.id = 'tuiNext';
    btnNext.textContent = 'NEXT';
    bottom.appendChild(btnNext);

    const btnAlt = document.createElement('button');
    btnAlt.className = 'tuiBtn tuiBtnGhost';
    btnAlt.type = 'button';
    btnAlt.id = 'tuiAlt';
    btnAlt.textContent = '使わない';
    btnAlt.style.display = 'none';
    bottom.appendChild(btnAlt);

    wrap.appendChild(top);
    wrap.appendChild(center);
    wrap.appendChild(bottom);

    root.appendChild(wrap);
    document.body.appendChild(root);

    ui = {
      root,
      bg,
      sqBg,
      bannerLeft: root.querySelector('#tuiBannerLeft'),
      bannerRight: root.querySelector('#tuiBannerRight'),
      scroll,
      logMain: root.querySelector('#tuiLogMain'),
      logSub: root.querySelector('#tuiLogSub'),
      btnNext,
      btnAlt
    };

    ui.btnNext.addEventListener('click', () => next());
    ui.btnAlt.addEventListener('click', () => {
      // coachPick / coachConfirm で有効
      selectedSkillId = null;
      setSelectedSkill(null);
      showR1Start();
    });

    return ui;
  }

  function setBG(img){ ensureDOM().bg.style.backgroundImage = `url(${img})`; }
  function setSquareBG(img){ ensureDOM().sqBg.style.backgroundImage = `url(${img})`; }

  function setBanner(left, right){
    const d = ensureDOM();
    if (d.bannerLeft) d.bannerLeft.textContent = String(left ?? '');
    if (d.bannerRight) d.bannerRight.textContent = String(right ?? '');
  }

  function setLog(main, sub){
    const d = ensureDOM();
    d.logMain.textContent = String(main ?? '');
    d.logSub.textContent = String(sub ?? '');
  }

  function setScrollHTML(html){
    ensureDOM().scroll.innerHTML = html || '';
  }

  function setButtons(nextText, altVisible){
    const d = ensureDOM();
    d.btnNext.textContent = nextText || 'NEXT';
    d.btnAlt.style.display = altVisible ? 'block' : 'none';
  }

  // ===== screens =====
  function showArrival(){
    step = 'arrival';
    selectedSkillId = null;
    setSelectedSkill(null);

    setBG(IMG_NEONMAIN);
    setSquareBG(IMG_TENT);

    setBanner('大会到着', 'NEXTで進行');
    setScrollHTML(
      `<div class="tuiNote">
        本日の出場チームをご紹介！<br>
        ※試合はオート進行（紙芝居＋ログ）
      </div>`
    );
    setLog('本日の出場チームをご紹介！', '');
    setButtons('NEXT', false);
  }

  function showTeams(){
    step = 'teams';
    setBanner('出場チーム', '20チーム');

    const st = loadTournamentState();
    const ps = Array.isArray(st?.participants) ? st.participants : [];

    let html = '';
    if (ps.length === 0){
      html = `<div class="tuiNote">参加チームデータがありません。</div>`;
    }else{
      for (const p of ps){
        html += `
          <div class="tuiRow">
            <button class="tuiRowBtn" type="button" aria-label="team">
              <div class="name">${escapeHTML(p.name || 'TEAM')}</div>
              <div class="tag">${escapeHTML(p.kind === 'player' ? 'PLAYER' : 'CPU')}</div>
            </button>
          </div>
        `;
      }
      html += `<div class="tuiNote">NEXTでコーチスキル選択へ進みます。</div>`;
    }

    setScrollHTML(html);
    setLog('出場チーム一覧', '');
    setButtons('NEXT', false);
  }

  function showCoachPick(){
    step = 'coachPick';
    setBanner('コーチスキル', '1つ選んで消耗');

    const eq = readEquipped();
    const owned = readOwned();

    // “装備中”に入ってる & 所持>0 & マスターに存在する（最新版5種のみ）
    const usable = [];
    for (const id of eq){
      if (!id) continue;
      if (!COACH_BY_ID[id]) continue;
      const cnt = Number(owned[id]) || 0;
      if (cnt <= 0) continue;
      if (!usable.includes(id)) usable.push(id);
    }

    let html = `<div class="tuiNote">装備中のスキルから1つ選択してください（使わないもOK）。</div>`;

    if (usable.length === 0){
      html += `<div class="tuiNote">使用可能なコーチスキルがありません。</div>`;
    }else{
      for (const id of usable){
        const s = COACH_BY_ID[id];
        const cnt = Number(owned[id]) || 0;
        html += `
          <div class="tuiSkill">
            <div class="sTop">
              <div class="sName">${escapeHTML(s.name)}</div>
              <div class="sState">所持:${cnt}</div>
            </div>
            <div class="sDesc">${escapeHTML(s.effectLabel)}</div>
            <div class="tuiNote">コーチ：「${escapeHTML(s.coachLine)}」</div>
            <div style="height:8px;"></div>
            <button class="tuiBtn" type="button" data-sel="${escapeAttr(id)}" style="width:100%;">これを使う</button>
          </div>
        `;
      }
    }

    html += `<div class="tuiNote">※「使わない」を押すとスキル無しで開始します。</div>`;

    setScrollHTML(html);
    setLog('使用するコーチスキルを選択してください', '');
    setButtons('戻る', true);

    // 次ボタンは “戻る” として teamsへ
    ensureDOM().btnNext.onclick = () => {
      ensureDOM().btnNext.onclick = () => next(); // 既定に戻す
      showTeams();
    };

    bindSkillButtons();
  }

  function bindSkillButtons(){
    const d = ensureDOM();
    const btns = d.scroll.querySelectorAll('button[data-sel]');
    btns.forEach(btn => {
      btn.addEventListener('click', () => {
        const id = btn.getAttribute('data-sel');
        if (!id) return;
        selectedSkillId = id;
        showCoachConfirm();
      });
    });
  }

  function showCoachConfirm(){
    step = 'coachConfirm';

    const s = COACH_BY_ID[selectedSkillId];
    if (!s){
      selectedSkillId = null;
      setSelectedSkill(null);
      showR1Start();
      return;
    }

    setBanner('コーチスキル発動', 'この試合で消耗');
    setScrollHTML(
      `<div class="tuiNote">
        選択：<b>${escapeHTML(s.name)}</b><br>
        このスキルを使用します。よろしいですか？
      </div>`
    );
    setLog(`コーチ：「${s.coachLine}」`, 'NEXTで確定（消耗）');
    setButtons('NEXT', true);

    // alt（使わない）＝選択解除で開始
    ensureDOM().btnAlt.onclick = () => {
      selectedSkillId = null;
      setSelectedSkill(null);
      showR1Start();
    };

    // next（確定）＝消耗して開始
    ensureDOM().btnNext.onclick = () => {
      if (selectedSkillId){
        setSelectedSkill(selectedSkillId);
        consumeSkill(selectedSkillId);
      }else{
        setSelectedSkill(null);
      }
      showR1Start();
    };
  }

  function showR1Start(){
    step = 'r1';

    // next ボタンの onclick を既定（next()）に戻す
    ensureDOM().btnNext.onclick = () => next();

    setBanner('試合開始', 'Round 1');
    setScrollHTML(`<div class="tuiNote">R1を開始します。</div>`);

    const s = selectedSkillId && COACH_BY_ID[selectedSkillId] ? COACH_BY_ID[selectedSkillId].name : '（なし）';
    setLog('Round 1 開始！', `コーチスキル：${s}`);

    setButtons('OK', false);

    // 今はここまで（次工程で試合本体へ接続）
    ensureDOM().btnNext.onclick = () => {
      closeUI();
      // 将来：window.MOBBR.sim.match.start() 等へ接続
    };
  }

  function next(){
    if (step === 'arrival') return showTeams();
    if (step === 'teams') return showCoachPick();
    // coachPick/coachConfirm/r1 は個別で制御済み
  }

  // ===== open/close =====
  function openUI(){
    const d = ensureDOM();

    // “透明フタ事故”は必ず殺す
    hardHideModalBack();

    d.root.style.display = 'block';
    d.root.style.pointerEvents = 'auto';
    d.root.classList.add('isOpen');
    d.root.setAttribute('aria-hidden', 'false');

    showArrival();
  }

  function closeUI(){
    const d = ensureDOM();
    d.root.classList.remove('isOpen');
    d.root.style.display = 'none';
    d.root.style.pointerEvents = 'none';
    d.root.setAttribute('aria-hidden', 'true');
    hardHideModalBack();
  }

  // ===== escape =====
  function escapeHTML(s){
    return String(s ?? '').replace(/[&<>"']/g, (m) => ({
      '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
    }[m]));
  }
  function escapeAttr(s){
    return String(s ?? '').replace(/"/g, '&quot;');
  }

  // ===== init =====
  function initTournamentUI(){
    ensureDOM();
    closeUI();
  }

  window.MOBBR.initTournamentUI = initTournamentUI;
  window.MOBBR.ui.tournament = { open: openUI, close: closeUI };
})();
