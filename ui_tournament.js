'use strict';

/*
  MOB BR - ui_tournament.js v1（フル）
  - 大会画面（本番レイアウト：CSS分離）
  - btnBattle から開く（ui_main.js改修なしで動作）
  - コーチスキル：装備中から1つ選択→消耗（owned-- & equippedから除去）
  - 選択結果は mobbr_coachSkillSelected に保存（後で sim が参照）
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){
  const $ = (id) => document.getElementById(id);

  // ===== storage keys (coach) =====
  const COACH_OWNED_KEY = 'mobbr_coachSkillsOwned';     // { id: count }
  const COACH_EQUIP_KEY = 'mobbr_coachSkillsEquipped';  // [id|null, id|null, id|null]
  const COACH_SELECTED_KEY = 'mobbr_coachSkillSelected';// string|null（この大会で使用）

  // ===== images =====
  const IMG_NEONMAIN = 'neonmain.png';
  const IMG_TENT     = 'tent.png';

  // ===== coach master (UI表示用) =====
  // ※ui_team.js の定義と同じID/名称で合わせる（効果の数値は表示のみ・内部反映は sim 側）
  const COACH_SKILLS = [
    { id:'tactics_note',  name:'戦術ノート',     effectLabel:'この試合、総合戦闘力が1%アップする', coachLine:'基本を徹底。丁寧に戦おう！' },
    { id:'mental_care',   name:'メンタル整備',   effectLabel:'この試合、チームの雰囲気が安定する', coachLine:'全員で勝つぞ！' },
    { id:'endgame_power', name:'終盤の底力',     effectLabel:'この試合、終盤の勝負で総合戦闘力が3%アップする', coachLine:'終盤一気に押すぞ！' },
    { id:'clearing',      name:'クリアリング徹底',effectLabel:'この試合、ファイトに勝った後に人数が残りやすい', coachLine:'周辺をしっかり見ろ！' },
    { id:'score_mind',    name:'スコア意識',     effectLabel:'この試合、お宝やフラッグを取りやすい', coachLine:'この試合はポイント勝負だ！' },
    { id:'igl_call',      name:'IGL強化コール',  effectLabel:'この試合、総合戦闘力が4%アップする', coachLine:'コールを信じろ！チャンピオン取るぞ！' },
    { id:'protagonist',   name:'主人公ムーブ',   effectLabel:'この試合、総合戦闘力が6%アップし、アシストも出やすくなる', coachLine:'チームの力を信じろ！' }
  ];
  const COACH_BY_ID = Object.fromEntries(COACH_SKILLS.map(s => [s.id, s]));

  // ===== state =====
  let tui = null;
  let step = 'intro'; // intro -> teams -> coach -> coachConfirm -> r1
  let selectedSkillId = null;

  // ===== local helpers =====
  function safeJSONParse(raw, fallback){
    try{ return JSON.parse(raw); }catch{ return fallback; }
  }

  function readOwned(){
    const obj = safeJSONParse(localStorage.getItem(COACH_OWNED_KEY) || '{}', {});
    return (obj && typeof obj === 'object') ? obj : {};
  }

  function readEquipped(){
    const arr = safeJSONParse(localStorage.getItem(COACH_EQUIP_KEY) || '[]', []);
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

    // equipped remove (all slots of same id)
    const eq = readEquipped().map(v => (v === skillId) ? null : v);
    writeEquipped(eq);
  }

  // ===== DOM build =====
  function ensureDOM(){
    if (tui) return tui;

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

    const btnGhost = document.createElement('button');
    btnGhost.className = 'tuiBtn tuiBtnGhost';
    btnGhost.type = 'button';
    btnGhost.id = 'tuiAlt';
    btnGhost.textContent = '使わない';
    btnGhost.style.display = 'none';
    bottom.appendChild(btnGhost);

    wrap.appendChild(top);
    wrap.appendChild(center);
    wrap.appendChild(bottom);

    root.appendChild(wrap);
    document.body.appendChild(root);

    tui = {
      root,
      bg,
      sqBg,
      bannerLeft: root.querySelector('#tuiBannerLeft'),
      bannerRight: root.querySelector('#tuiBannerRight'),
      scroll,
      logMain: root.querySelector('#tuiLogMain'),
      logSub: root.querySelector('#tuiLogSub'),
      btnNext,
      btnAlt: btnGhost
    };

    tui.btnNext.addEventListener('click', () => next());
    tui.btnAlt.addEventListener('click', () => {
      // “使わない”はコーチ選択画面でのみ表示
      selectedSkillId = null;
      setSelectedSkill(null);
      showR1Start();
    });

    return tui;
  }

  function setBG(img){
    ensureDOM().bg.style.backgroundImage = `url(${img})`;
  }

  function setSquareBG(img){
    ensureDOM().sqBg.style.backgroundImage = `url(${img})`;
  }

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
  function showIntro(){
    step = 'intro';
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

    // いまは大会データ削除＝1から。よって仮の一覧（後で data_cpu_teams と接続）
    let html = '';
    for (let i=1; i<=20; i++){
      html += `
        <div class="tuiRow">
          <button class="tuiRowBtn" type="button">
            <div class="name">Team ${i}</div>
            <div class="tag">紹介</div>
          </button>
        </div>
      `;
    }
    html += `<div class="tuiNote">NEXTでコーチスキル選択へ進みます。</div>`;
    setScrollHTML(html);
    setLog('出場チーム一覧', '');
    setButtons('NEXT', false);
  }

  function showCoachSelect(){
    step = 'coach';
    setBanner('コーチスキル', '1つ選んで消耗');

    const eq = readEquipped();
    const owned = readOwned();

    let html = `<div class="tuiNote">装備中のスキルから1つ選択してください（使わないもOK）。</div>`;

    const usable = [];
    for (const id of eq){
      if (!id) continue;
      const cnt = Number(owned[id]) || 0;
      if (cnt <= 0) continue;
      usable.push(id);
    }

    if (usable.length === 0){
      html += `<div class="tuiNote">使用可能なコーチスキルがありません。</div>`;
    }else{
      for (const id of usable){
        const s = COACH_BY_ID[id] || { id, name:id, effectLabel:'', coachLine:'' };
        const cnt = Number(owned[id]) || 0;
        html += `
          <div class="tuiSkill">
            <div class="sTop">
              <div class="sName">${escapeHTML(s.name)}</div>
              <div class="sState">所持:${cnt}</div>
            </div>
            <div class="sDesc">${escapeHTML(s.effectLabel || '')}</div>
            <div class="tuiNote">コーチ：「${escapeHTML(s.coachLine || '')}」</div>
            <div style="height:8px;"></div>
            <button class="tuiBtn" type="button" data-sel="${escapeAttr(id)}" style="width:100%;">これを使う</button>
          </div>
        `;
      }
    }

    setScrollHTML(html);
    setLog('使用するコーチスキルを選択してください', '');
    setButtons('戻る', true);
    ensureDOM().btnNext.onclick = () => prevFromCoach(); // ここだけ差し替え
    bindSkillButtons();
  }

  function prevFromCoach(){
    // coach選択から戻る = teamsへ
    ensureDOM().btnNext.onclick = () => next(); // 元に戻す
    showTeams();
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
    const s = COACH_BY_ID[selectedSkillId] || { name:selectedSkillId, coachLine:'' };

    setBanner('コーチスキル発動', 'この試合で消耗');
    setScrollHTML(
      `<div class="tuiNote">
        選択：<b>${escapeHTML(s.name)}</b><br>
        このスキルを使用します。よろしいですか？
      </div>`
    );
    setLog(`コーチ：「${s.coachLine || '行くぞ！'}」`, 'NEXTで確定（消耗）');
    setButtons('NEXT', true);

    // alt = 使わない（=選択解除）
    ensureDOM().btnAlt.onclick = () => {
      selectedSkillId = null;
      setSelectedSkill(null);
      showR1Start();
    };

    // next = consume and proceed
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
    ensureDOM().btnNext.onclick = () => next(); // 元に戻す

    setBanner('試合開始', 'Round 1');
    setScrollHTML(`<div class="tuiNote">R1を開始します。</div>`);
    setLog('Round 1 開始！', '（ここから先は sim 実装で接続）');
    setButtons('OK', false);

    // いまは sim 未実装なので閉じるだけ（次ステップで battle UIへ接続）
    ensureDOM().btnNext.onclick = () => {
      closeUI();
      // 将来：window.MOBBR.sim.startMatch() などへ接続
    };
  }

  function next(){
    if (step === 'intro') return showTeams();
    if (step === 'teams') return showCoachSelect();
    // coach系は専用ハンドラ
  }

  // ===== open/close =====
  function openUI(){
    const d = ensureDOM();
    d.root.style.display = 'block';
    d.root.style.pointerEvents = 'auto';
    d.root.classList.add('isOpen');
    d.root.setAttribute('aria-hidden', 'false');

    // タップ死亡事故（modalBack）を先に掃除
    if (typeof window.hardResetOverlays === 'function'){
      window.hardResetOverlays();
    }else{
      // app.js内関数はスコープなので呼べない。念のためここでも掃除
      const back = $('modalBack');
      if (back){
        back.style.display = 'none';
        back.style.pointerEvents = 'none';
        back.setAttribute('aria-hidden', 'true');
      }
    }

    showIntro();
  }

  function closeUI(){
    const d = ensureDOM();
    d.root.classList.remove('isOpen');
    d.root.style.display = 'none';
    d.root.style.pointerEvents = 'none';
    d.root.setAttribute('aria-hidden', 'true');

    // “透明フタ”事故の保険
    const back = $('modalBack');
    if (back){
      back.style.display = 'none';
      back.style.pointerEvents = 'none';
      back.setAttribute('aria-hidden', 'true');
    }
  }

  // ===== bind battle button =====
  let bound = false;
  function bindBattleButton(){
    if (bound) return;
    bound = true;

    const btn = $('btnBattle');
    if (!btn) return;
    btn.addEventListener('click', () => openUI());
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
    bindBattleButton();

    // “大会データ削除で1から”なので、初回の選択値はクリアしておく（安全）
    // ※嫌なら削除OK
    // localStorage.removeItem(COACH_SELECTED_KEY);

    // 画面残骸があっても閉じられるように
    closeUI();
  }

  window.MOBBR.initTournamentUI = initTournamentUI;
  window.MOBBR.ui.tournament = { open: openUI, close: closeUI };

})();
