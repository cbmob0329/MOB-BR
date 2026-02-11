'use strict';

/*
  ui_tournament.js v3.2（フル）
  ✅ 仕様反映：
  - 「大会メイン背景」は固定（背面）… state.ui.tournamentBg（無ければ maps/neonmain.png）
  - tent.png は「試合開始前だけ」使用（到着/チーム紹介/コーチ選択まで）
  - 試合開始後は tent を絶対に出さない：
      * 降下〜交戦〜移動：前面は ido.png / エリア背景 / battle系へ切替
  - 画像ロード待ち：
      * 交戦前「接敵!!」→「A vs B!!」演出中に左右画像をプリロード
      * 移動は ido.png → 次エリア画像をプリロード → 到着
  - 「結果演出」は2秒表示してから NEXT を出す
  - NEXT を押して進む（AUTOは未実装）
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){

  const $ = (id)=>document.getElementById(id);

  function el(tag, cls){
    const d = document.createElement(tag);
    if (cls) d.className = cls;
    return d;
  }

  function safeText(node, t){
    if (!node) return;
    node.textContent = String(t ?? '');
  }

  function clamp(n, lo, hi){
    const v = Number(n);
    if (!Number.isFinite(v)) return lo;
    return Math.max(lo, Math.min(hi, v));
  }

  // ===== image preload =====
  function preloadImage(src){
    return new Promise((resolve)=>{
      if (!src) return resolve(false);
      const img = new Image();
      img.onload = ()=>resolve(true);
      img.onerror = ()=>resolve(false);
      img.src = src;
    });
  }

  // ===== CPU base =====
  function getCpuBase(){
    try{
      if (window.DataCPU && typeof window.DataCPU.getAssetBase === 'function'){
        return window.DataCPU.getAssetBase() || 'cpu';
      }
    }catch(e){}
    return 'cpu';
  }

  function guessPlayerImage(){
    // tournamentFlow が「装備中のP?.png」を返せるなら優先
    try{
      const fn = window.MOBBR?.sim?.tournamentFlow?.getPlayerSkin;
      if (typeof fn === 'function'){
        const v = fn();
        if (v) return v;
      }
    }catch(e){}
    return 'P1.png';
  }

  function getTeamImageSrc(team){
    if (!team) return '';
    if (team.isPlayer) return guessPlayerImage();
    const base = getCpuBase();
    // teamId/id と同名PNGが前提（例: local07.png）
    return `${base}/${team.id}.png`;
  }

  // ===== Root =====
  let root = null;
  let state = null;

  // UI lock（state.lockNext とは別に、演出で一時的にNextを隠す）
  let uiLocked = false;

  function ensureRoot(){
    if (root) return root;

    root = el('div', 'mobbrTui');
    root.setAttribute('aria-hidden', 'true');

    // 背面：大会メイン背景（固定）
    const bgBack = el('div', 'tuiBgBack');
    root.appendChild(bgBack);

    // フェード用の黒幕
    const bgFade = el('div', 'tuiBgFade');
    root.appendChild(bgFade);

    const wrap = el('div', 'tuiWrap');

    // TOP
    const top = el('div', 'tuiTop');
    const title = el('div', 'tuiTitle');
    title.textContent = 'ローカル大会';
    const meta = el('div', 'tuiMeta');
    meta.textContent = '';

    const closeBtn = document.createElement('button');
    closeBtn.type = 'button';
    closeBtn.className = 'tuiClose';
    closeBtn.textContent = '閉じる';
    closeBtn.addEventListener('click', close);

    top.appendChild(title);
    top.appendChild(meta);
    top.appendChild(closeBtn);

    // CENTER
    const center = el('div', 'tuiCenter');
    const square = el('div', 'tuiSquare');

    // 前面（切替対象）：ido / area / battle / result
    const squareFront = el('div', 'tuiSquareBgFront');
    square.appendChild(squareFront);

    // tent（試合開始前だけ）
    const tent = el('div', 'tuiTent');
    tent.style.backgroundImage = `url("tent.png")`;
    tent.setAttribute('data-on', '1');
    square.appendChild(tent);

    // バトルバナー（brbattle / brwin / brlose）
    const battleBadge = el('div', 'tuiBattleBadge');
    const battleBadgeImg = document.createElement('img');
    battleBadgeImg.alt = 'battle badge';
    battleBadgeImg.draggable = false;
    battleBadge.appendChild(battleBadgeImg);
    square.appendChild(battleBadge);

    // 左右キャラ
    const left = el('div', 'tuiLeft');
    const leftImg = document.createElement('img');
    leftImg.alt = 'player';
    leftImg.draggable = false;
    left.appendChild(leftImg);

    const right = el('div', 'tuiRight');
    const rightImg = document.createElement('img');
    rightImg.alt = 'enemy';
    rightImg.draggable = false;
    right.appendChild(rightImg);

    square.appendChild(left);
    square.appendChild(right);

    // 名前（交戦時）
    const nameL = el('div', 'tuiName tuiNameL');
    const nameR = el('div', 'tuiName tuiNameR');
    square.appendChild(nameL);
    square.appendChild(nameR);

    // 中央ログ（3段固定）
    const centerLog = el('div', 'tuiCenterLog');
    const l1 = el('div', 'l1');
    const l2 = el('div', 'l2');
    const l3 = el('div', 'l3');
    centerLog.appendChild(l1);
    centerLog.appendChild(l2);
    centerLog.appendChild(l3);
    square.appendChild(centerLog);

    // スクロール（チーム一覧）
    const list = el('div', 'tuiList');
    square.appendChild(list);

    center.appendChild(square);

    // BOTTOM
    const bottom = el('div', 'tuiBottom');
    const btnNext = el('button', 'tuiBtn');
    btnNext.type = 'button';
    btnNext.textContent = '次へ';
    btnNext.addEventListener('click', ()=>{
      if (uiLocked) return;
      const Flow = window.MOBBR?.sim?.tournamentFlow;
      if (!Flow){
        alert('大会進行が見つかりません（sim_tournament_flow.js を確認）');
        return;
      }
      // UI側が request を消化してから Flow.step() する設計もあるが、
      // 現行は Flow が request を発行し、UIが消化する想定。
      if (typeof Flow.step === 'function'){
        Flow.step();
      }else if (typeof Flow.advance === 'function'){
        Flow.advance();
      }else{
        alert('大会進行APIが見つかりません（step/advance）');
        return;
      }
      render();
    });

    bottom.appendChild(btnNext);

    wrap.appendChild(top);
    wrap.appendChild(center);
    wrap.appendChild(bottom);
    root.appendChild(wrap);

    document.body.appendChild(root);
    return root;
  }

  function setTournamentBg(src){
    const r = ensureRoot();
    const node = r.querySelector('.tuiBgBack');
    if (!node) return;
    if (!src) return;
    node.style.backgroundImage = `url("${src}")`;
  }

  function setFrontBg(src){
    const r = ensureRoot();
    const node = r.querySelector('.tuiSquareBgFront');
    if (!node) return;
    if (!src) return;
    node.style.backgroundImage = `url("${src}")`;
  }

  function setTentOn(on){
    const r = ensureRoot();
    const node = r.querySelector('.tuiTent');
    if (!node) return;
    node.setAttribute('data-on', on ? '1' : '0');
  }

  function setBattleBadge(src){
    const r = ensureRoot();
    const wrap = r.querySelector('.tuiBattleBadge');
    const img = r.querySelector('.tuiBattleBadge img');
    if (!wrap || !img){
      return;
    }
    if (!src){
      wrap.setAttribute('data-on', '0');
      img.src = '';
      return;
    }
    wrap.setAttribute('data-on', '1');
    img.src = src;
  }

  function setSideImages(leftSrc, rightSrc){
    const r = ensureRoot();
    const l = r.querySelector('.tuiLeft img');
    const rr = r.querySelector('.tuiRight img');
    if (l){
      l.onerror = ()=>{ l.onerror=null; l.src=''; };
      l.src = leftSrc || '';
    }
    if (rr){
      rr.onerror = ()=>{ rr.onerror=null; rr.src=''; };
      rr.src = rightSrc || '';
    }
  }

  function setNames(leftName, rightName){
    const r = ensureRoot();
    const nl = r.querySelector('.tuiNameL');
    const nr = r.querySelector('.tuiNameR');
    safeText(nl, leftName || '');
    safeText(nr, rightName || '');
    const on = !!(leftName || rightName);
    if (nl) nl.setAttribute('data-on', on ? '1' : '0');
    if (nr) nr.setAttribute('data-on', on ? '1' : '0');
  }

  function setCenter3(a,b,c){
    const r = ensureRoot();
    const l1 = r.querySelector('.tuiCenterLog .l1');
    const l2 = r.querySelector('.tuiCenterLog .l2');
    const l3 = r.querySelector('.tuiCenterLog .l3');
    safeText(l1, a || '');
    safeText(l2, b || '');
    safeText(l3, c || '');
  }

  function setMeta(text){
    const r = ensureRoot();
    const meta = r.querySelector('.tuiMeta');
    safeText(meta, text || '');
  }

  function setTitle(text){
    const r = ensureRoot();
    const t = r.querySelector('.tuiTitle');
    safeText(t, text || '');
  }

  function setNextVisible(on){
    const r = ensureRoot();
    const btn = r.querySelector('.tuiBtn');
    if (!btn) return;
    btn.style.display = on ? 'block' : 'none';
  }

  function lockNext(ms){
    uiLocked = true;
    setNextVisible(false);
    const wait = clamp(ms, 0, 99999);
    if (wait <= 0){
      uiLocked = false;
      setNextVisible(true);
      return;
    }
    setTimeout(()=>{
      uiLocked = false;
      setNextVisible(true);
    }, wait);
  }

  // ===== team list =====
  function renderTeamList(teams){
    const r = ensureRoot();
    const list = r.querySelector('.tuiList');
    if (!list) return;
    list.innerHTML = '';

    const arr = Array.isArray(teams) ? teams.slice() : [];

    arr.forEach((t, idx)=>{
      const row = el('div', 'tuiRow');

      row.addEventListener('click', async ()=>{
        // プレビュー（試合前でもOK）
        const src = getTeamImageSrc(t);
        if (src){
          // ちょい先読み
          preloadImage(src);
        }
      }, { passive:true });

      const name = el('div', 'name');
      const tag = el('div', 'tag');

      const nm = (t.isPlayer ? '★ ' : '') + (t.name || t.id || `TEAM ${idx+1}`);
      safeText(name, nm);

      // 表示：総合戦闘力（代表値）
      const p = Number(t.power);
      const showP = Number.isFinite(p) ? `${Math.round(p)}%` : '';
      safeText(tag, showP);

      if (t.isPlayer){
        row.style.border = '1px solid rgba(255,59,48,.55)';
        row.style.background = 'rgba(255,59,48,.10)';
      }

      row.appendChild(name);
      row.appendChild(tag);
      list.appendChild(row);
    });
  }

  function setTeamListVisible(on){
    const r = ensureRoot();
    const list = r.querySelector('.tuiList');
    if (!list) return;
    list.setAttribute('data-on', on ? '1' : '0');
  }

  // ===== request handlers（tournamentFlow.state.request を消化）=====
  async function handleRequest(req){
    if (!req || typeof req !== 'object') return;

    // request に「試合開始前/後」が混ざっても tent を誤表示しないように
    // typeごとに tent を明確に ON/OFF する

    const type = String(req.type || '');

    // どの演出でも「大会固定背景」は維持
    if (state?.ui?.tournamentBg) setTournamentBg(state.ui.tournamentBg);
    else setTournamentBg('maps/neonmain.png');

    if (type === 'showIntroText'){
      // 到着/導入（試合前）
      setTentOn(true);
      setTeamListVisible(false);
      setBattleBadge('');
      setNames('', '');
      setSideImages(guessPlayerImage(), '');

      setFrontBg(''); // tentが前面役なのでfrontは消してOK
      setCenter3(req.l1 || '本日のチームをご紹介！', req.l2 || '', req.l3 || '');
      setNextVisible(true);
      return;
    }

    if (type === 'showTeamList'){
      // チーム一覧（試合前）
      setTentOn(true);
      setBattleBadge('');
      setNames('', '');
      setSideImages(guessPlayerImage(), '');
      setFrontBg('');
      setCenter3(req.l1 || '本日の出場チームをご紹介！', req.l2 || 'スクロールで確認', req.l3 || '次へで進行');
      setTeamListVisible(true);
      renderTeamList(state?.teams || []);
      setNextVisible(true);
      return;
    }

    if (type === 'hideTeamList'){
      // 試合開始後にチーム紹介は二度と出さない
      setTeamListVisible(false);
      return;
    }

    if (type === 'showCoachSelect'){
      // コーチ選択（試合前）
      // ※ここはUI側の選択UI未実装なので、テキストだけ（今後拡張）
      setTentOn(true);
      setTeamListVisible(false);
      setBattleBadge('');
      setNames('', '');
      setSideImages(guessPlayerImage(), '');
      setFrontBg('');
      setCenter3(
        req.l1 || 'それでは試合を開始します！',
        req.l2 || '使用するコーチスキルを選択してください！',
        req.l3 || '（現状：自動 or 未実装）'
      );
      setNextVisible(true);
      return;
    }

    if (type === 'showDropStart'){
      // 試合開始（ここから tent禁止）
      setTentOn(false);
      setTeamListVisible(false);
      setBattleBadge('');
      setNames('', '');
      setSideImages(guessPlayerImage(), '');
      // 背景：プレイヤー降下先エリア（state.ui.bg or req.bg）
      const bg = req.bg || state?.ui?.bg || '';
      if (bg) await preloadImage(bg);
      setFrontBg(bg || '');
      setCenter3('バトルスタート！', '降下開始…！', '');
      setNextVisible(true);
      return;
    }

    if (type === 'showRoundStart'){
      // ラウンド開始（tent禁止）
      setTentOn(false);
      setTeamListVisible(false);
      setBattleBadge('');
      setNames('', '');
      setSideImages(guessPlayerImage(), '');
      const bg = req.bg || state?.ui?.bg || '';
      if (bg) await preloadImage(bg);
      setFrontBg(bg || '');
      setCenter3(`Round ${req.round || state?.round || 1} 開始！`, '', '');
      setNextVisible(true);
      return;
    }

    if (type === 'showEvent'){
      // イベント（tent禁止）
      setTentOn(false);
      setTeamListVisible(false);
      setBattleBadge(req.icon || '');
      setNames('', '');
      setSideImages(guessPlayerImage(), '');
      const bg = req.bg || state?.ui?.bg || '';
      if (bg) await preloadImage(bg);
      setFrontBg(bg || '');
      setCenter3(req.l1 || 'イベント発生！', req.l2 || '', req.l3 || '');
      setNextVisible(true);
      return;
    }

    if (type === 'showContact'){
      // ✅ 接敵演出（敵/プレイヤー画像のロード時間を確保）
      // 1) 接敵!!（派手） 2) A vs B!!
      setTentOn(false);
      setTeamListVisible(false);
      setBattleBadge(''); // ここではまだ battle バッジ出さない
      setNextVisible(false); // 演出中はNext不可（自動進行）

      const bg = req.bg || state?.ui?.bg || '';
      if (bg) await preloadImage(bg);
      setFrontBg(bg || '');

      const leftSrc = req.leftImg || guessPlayerImage();
      const rightSrc = req.rightImg || '';

      // 先にプリロード（同時）
      await Promise.all([preloadImage(leftSrc), preloadImage(rightSrc)]);

      // 表示（接敵）
      setSideImages(leftSrc, rightSrc);
      setNames('', '');
      setCenter3('接敵!!', '', '');
      await new Promise(r=>setTimeout(r, 650));

      // 表示（vs）
      const aName = req.leftName || '';
      const bName = req.rightName || '';
      setNames(aName, bName);
      setCenter3(`${aName} vs ${bName}!!`, '', '');
      await new Promise(r=>setTimeout(r, 900));

      // 交戦へ（Flowが次requestを出している想定）
      uiLocked = false;
      setNextVisible(true);
      return;
    }

    if (type === 'showBattle'){
      // 交戦中（ログは高速切替…処理は裏で進める想定）
      setTentOn(false);
      setTeamListVisible(false);

      const bg = req.bg || state?.ui?.bg || '';
      if (bg) await preloadImage(bg);
      setFrontBg(bg || '');

      setBattleBadge(req.badge || 'brbattle.png');
      setSideImages(req.leftImg || guessPlayerImage(), req.rightImg || '');
      setNames(req.leftName || '', req.rightName || '');

      setCenter3('', '', '');
      setNextVisible(false);

      // ランダム台詞を高速表示（ここは「表示だけ」。勝敗処理はsim側）
      const lines = Array.isArray(req.lines) && req.lines.length ? req.lines : [
        'やってやんべ！','裏取るぞ！','展開する！','サポートするぞ！','うわあー！','ミスった！','一気に行くぞ！',
        '今のうちに回復だ！','絶対勝つぞ！','撃て―！','なんて動きだ！','撃ちまくれ！','グレ使う！','グレ投げろ！',
        'リロードする！','被弾した！','カバー頼む！','大丈夫か!?','走れーー！','耐えるぞー！'
      ];

      // 約1.6秒（10本くらい）流す
      const count = clamp(req.count || 10, 6, 16);
      for (let i=0;i<count;i++){
        const s = lines[(Math.random()*lines.length)|0];
        setCenter3('', '', s);
        await new Promise(r=>setTimeout(r, 140));
        setCenter3('', '', '');
        await new Promise(r=>setTimeout(r, 60));
      }

      // バトル終了後は sim が showBattleResult request を出す想定
      setNextVisible(true);
      return;
    }

    if (type === 'showBattleResult'){
      // 勝敗演出：2秒表示してからNEXT
      setTentOn(false);
      setTeamListVisible(false);

      const bg = req.bg || state?.ui?.bg || '';
      if (bg) await preloadImage(bg);
      setFrontBg(bg || '');

      // 勝ち/負けバッジ
      setBattleBadge(req.badge || '');

      setSideImages(req.leftImg || guessPlayerImage(), req.rightImg || '');
      setNames(req.leftName || '', req.rightName || '');

      setCenter3(req.l1 || '', req.l2 || '', req.l3 || '');
      lockNext(2000);
      return;
    }

    if (type === 'showMove'){
      // ✅ 移動：ido.png → 次エリアをロードしてから到着へ
      setTentOn(false);
      setTeamListVisible(false);
      setBattleBadge('');
      setNames('', '');
      setSideImages(guessPlayerImage(), '');

      setNextVisible(false);

      // 1) ido
      await preloadImage('ido.png');
      setFrontBg('ido.png');
      setCenter3('安置が縮む…移動開始！', 'ルート変更。急げ！', '');
      await new Promise(r=>setTimeout(r, 650));

      // 2) 次エリア bg をロード
      const toBg = req.toBg || '';
      if (toBg) await preloadImage(toBg);

      // 3) 到着（bgに切替）
      if (toBg) setFrontBg(toBg);
      setCenter3(req.arrive1 || '到着！', req.arrive2 || '', req.arrive3 || '');
      setNextVisible(true);
      return;
    }

    if (type === 'showMatchResult'){
      // 試合result（tent禁止）
      setTentOn(false);
      setTeamListVisible(false);
      setBattleBadge('');
      setNames('', '');
      setSideImages(guessPlayerImage(), '');
      const bg = req.bg || 'battle.png';
      await preloadImage(bg);
      setFrontBg(bg);
      setCenter3('result', '', '（順位表は次段で実装）');
      setNextVisible(true);
      return;
    }

    // fallback
    return;
  }

  // ===== render =====
  async function render(){
    const r = ensureRoot();
    state = window.MOBBR?.sim?.tournamentFlow?.getState?.() || state;

    if (!state){
      setTournamentBg('maps/neonmain.png');
      setTentOn(true);
      setFrontBg('');
      setBattleBadge('');
      setTeamListVisible(false);
      setSideImages(guessPlayerImage(), '');
      setNames('', '');
      setTitle('ローカル大会');
      setMeta('');
      setCenter3('大会データなし', 'BATTLEから開始してください', '');
      setNextVisible(true);
      return;
    }

    // 固定大会背景
    const tourBg = state?.ui?.tournamentBg || state?.ui?.bgFixed || 'maps/neonmain.png';
    setTournamentBg(tourBg);

    // title/meta
    setTitle(state.mode === 'local' ? 'ローカル大会' : (state.title || '大会'));
    const mi = state.matchIndex ? `MATCH ${state.matchIndex}/${state.matchCount || 5}` : '';
    const rd = state.round ? `R${state.round}` : '';
    const ph = state.phase ? String(state.phase) : '';
    setMeta([mi, rd, ph].filter(Boolean).join(' / '));

    // state.ui があるなら反映（requestが無い時の最低限）
    const ui = state.ui || {};
    if (ui.leftImg || ui.rightImg) setSideImages(ui.leftImg || guessPlayerImage(), ui.rightImg || '');
    if (ui.topLeftName || ui.topRightName) setNames(ui.topLeftName || '', ui.topRightName || '');
    if (Array.isArray(ui.center3)) setCenter3(ui.center3[0]||'', ui.center3[1]||'', ui.center3[2]||'');
    if (ui.battleBadge) setBattleBadge(ui.battleBadge);
    if (ui.frontBg) setFrontBg(ui.frontBg);

    // request があればUIで消化（tournamentFlow側が request をクリアする前提）
    if (state.request){
      const req = state.request;
      // requestを即時クリア（「同じrequestが何度も再生」事故防止）
      state.request = null;
      try{
        await handleRequest(req);
      }catch(e){
        console.error(e);
      }
    }

    // lockNext/state.lockNext があるなら反映
    const lock = !!state.lockNext;
    uiLocked = uiLocked || lock;
    if (uiLocked){
      setNextVisible(false);
    }else{
      setNextVisible(true);
    }
  }

  function open(){
    const r = ensureRoot();
    r.classList.add('isOpen');
    r.style.display = 'block';
    r.style.pointerEvents = 'auto';
    r.setAttribute('aria-hidden', 'false');
    render();
  }

  function close(){
    if (!root) return;
    root.classList.remove('isOpen');
    root.style.display = 'none';
    root.style.pointerEvents = 'none';
    root.setAttribute('aria-hidden', 'true');
  }

  // expose
  window.MOBBR.ui.tournament = { open, close, render };

  // init hook（app.js が呼ぶ）
  window.MOBBR.initTournamentUI = function(){
    ensureRoot();
    close();
  };

  document.addEventListener('DOMContentLoaded', ()=>{
    ensureRoot();
    close();
  });

})();
