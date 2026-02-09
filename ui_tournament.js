'use strict';

/*
  MOB BR - ui_tournament.js v2（フル）
  STEP4：大会UI（見た目＋NEXT進行の器）

  変更点（重要）
  - あなたが指定した「直下画像」をこのUIで使えるように反映
    tent.png / ido.png / winner.png / bdeba.png / bup.png / bgeta.png / bgetb.png
  - マップ背景（neonmain.png 等）は maps/ をデフォルトに変更
  - flow側から「キー指定」で背景を切り替えられるAPIを追加
    setScene({ bgKey:'TENT' }) など
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){
  // =========================
  // Optional deps
  // =========================
  const S = window.MOBBR?.storage || null;

  // =========================
  // Assets（あなたの構成に合わせる）
  // =========================
  const ASSET = {
    // マップ系は maps/ が基本（neonmain.png など）
    MAP_BASE: (window.RULES?.MAP?.areaImgBase || 'maps/'),

    // 大会UIで使う「直下」画像（←あなた指定）
    TENT:    'tent.png',
    IDO:     'ido.png',
    WINNER:  'winner.png',

    B_DEBA:  'bdeba.png',
    B_UP:    'bup.png',
    B_GETA:  'bgeta.png',
    B_GETB:  'bgetb.png',

    // デフォルト大会背景（マップ画像扱い）
    TOURNAMENT_BG: 'neonmain.png'
  };

  function mapImg(file){
    if (!file) return ASSET.MAP_BASE + ASSET.TOURNAMENT_BG;
    // すでにパスっぽい場合はそのまま
    if (/^(https?:)?\/\//.test(file) || file.includes('/') ) return file;
    return ASSET.MAP_BASE + file;
  }

  // =========================
  // z-index（ショップ等と衝突しないよう上に）
  // =========================
  const Z = {
    back: 12000,
    panel: 13000,
    pop: 14000
  };

  // =========================
  // State（UI側）
  // =========================
  const state = {
    isOpen: false,
    mode: 'tournament',
    phase: 'intro',
    title: '',
    subtitle: '',
    playerImage: 'P1.png',
    enemyImage: '',

    // 背景（フルパス or ファイル名）
    bg: mapImg(ASSET.TOURNAMENT_BG),
    bgKey: 'MAP', // MAP / TENT / IDO / WINNER / B_DEBA / B_UP / B_GETA / B_GETB / CUSTOM

    // message
    messageLines: [],
    nextLabel: 'NEXT',
    nextEnabled: true,
    onNext: null,

    // result
    resultTitle: '',
    resultLobbyLabel: '',
    resultRows: [],
    highlightTeamId: '',
    showResult: false,

    lockBack: false
  };

  // =========================
  // Build DOM（index.html 変更なしで動く）
  // =========================
  let built = false;

  const dom = {
    root: null,
    back: null,
    panel: null,
    bg: null,

    layerTent: null,
    tentImg: null,

    layerChars: null,
    playerImg: null,
    enemyImg: null,

    msgWrap: null,
    msgTitle: null,
    msgBody: null,
    btnNext: null,

    resultWrap: null,
    resultHeader: null,
    resultSub: null,
    resultList: null,
    resultClose: null
  };

  function injectStyle(){
    if (document.getElementById('uiTournamentStyleV2')) return;

    const st = document.createElement('style');
    st.id = 'uiTournamentStyleV2';
    st.textContent = `
      #tournamentBack{
        position:fixed; inset:0;
        background: rgba(0,0,0,.55);
        z-index:${Z.back};
        display:none;
        pointer-events:none;
      }
      #tournamentRoot{
        position:fixed; inset:0;
        z-index:${Z.panel};
        display:none;
        pointer-events:none;
        font-family: system-ui, -apple-system, "Segoe UI", Roboto, "Hiragino Sans", "Noto Sans JP", sans-serif;
      }
      #tournamentRoot.show{ display:block; pointer-events:auto; }
      #tournamentBack.show{ display:block; pointer-events:auto; }

      .tntBg{ position:absolute; inset:0; background:#000; }
      .tntBgImg{
        position:absolute; inset:0;
        width:100%; height:100%;
        object-fit: cover;
        user-select:none;
        -webkit-user-drag:none;
      }

      .tntPanel{
        position:absolute;
        left:50%; top:50%;
        transform: translate(-50%,-50%);
        width: min(94vw, 560px);
        height: min(90vh, 780px);
        border-radius: 22px;
        overflow: hidden;
        background: rgba(0,0,0,.20);
        box-shadow: 0 20px 70px rgba(0,0,0,.65);
      }

      .tntTent{
        position:absolute;
        left:50%;
        top: 34%;
        transform: translate(-50%, -50%);
        width: min(74vw, 420px);
        aspect-ratio: 1 / 1;
        border-radius: 18px;
        overflow:hidden;
        background: rgba(0,0,0,.25);
        box-shadow: 0 10px 40px rgba(0,0,0,.45);
        display:none;
      }
      .tntTent.show{ display:block; }
      .tntTentImg{
        width:100%; height:100%;
        object-fit: cover;
        display:block;
        user-select:none;
        -webkit-user-drag:none;
      }

      .tntChars{
        position:absolute;
        left:50%;
        top: 58%;
        transform: translate(-50%, -50%);
        width: min(92vw, 520px);
        display:flex;
        justify-content: space-between;
        align-items: flex-end;
        gap: 12px;
        pointer-events:none;
      }
      .tntCharImg{
        width: min(40vw, 220px);
        height:auto;
        object-fit: contain;
        filter: drop-shadow(0 10px 18px rgba(0,0,0,.6));
        user-select:none;
        -webkit-user-drag:none;
      }
      .tntCharImg.enemy{ opacity:0.98; }

      .tntMsg{
        position:absolute;
        left:50%;
        bottom: 14px;
        transform: translateX(-50%);
        width: min(92vw, 520px);
        border-radius: 20px;
        background: rgba(15,15,15,.88);
        box-shadow: 0 14px 40px rgba(0,0,0,.65);
        padding: 14px 14px 12px;
      }
      .tntMsgTitle{
        font-weight: 1000;
        letter-spacing: .02em;
        font-size: 15px;
        color: rgba(255,255,255,.95);
        margin-bottom: 6px;
      }
      .tntMsgBody{
        font-size: 14px;
        line-height: 1.35;
        white-space: pre-wrap;
        color: rgba(255,255,255,.92);
        min-height: 44px;
      }
      .tntNextRow{ display:flex; justify-content:flex-end; margin-top:10px; }
      .tntNextBtn{
        border:0;
        border-radius: 9999px;
        padding: 10px 14px;
        min-height: 40px;
        font-weight: 1000;
        background: rgba(255,255,255,.92);
        box-shadow: 0 10px 18px rgba(0,0,0,.35);
        animation: tntFloat 1.7s ease-in-out infinite;
      }
      .tntNextBtn:disabled{ opacity:.5; animation:none; }
      @keyframes tntFloat{
        0%{ transform: translateY(0px); }
        50%{ transform: translateY(-3px); }
        100%{ transform: translateY(0px); }
      }

      .tntResult{
        position:absolute;
        left:50%;
        top:50%;
        transform: translate(-50%,-50%);
        width: min(94vw, 560px);
        height: min(88vh, 760px);
        border-radius: 22px;
        background: rgba(15,15,15,.96);
        box-shadow: 0 24px 80px rgba(0,0,0,.75);
        display:none;
        overflow:hidden;
      }
      .tntResult.show{ display:block; }

      .tntResultHeader{
        padding: 14px 14px 10px;
        border-bottom: 1px solid rgba(255,255,255,.10);
      }
      .tntResultTitle{
        font-weight: 1000;
        font-size: 16px;
        color: rgba(255,255,255,.96);
        margin-bottom: 4px;
      }
      .tntResultSub{
        font-size: 12px;
        color: rgba(255,255,255,.78);
        white-space: pre-wrap;
      }

      .tntResultList{
        height: calc(100% - 128px);
        overflow:auto;
        padding: 10px 12px 12px;
      }
      .tntRow{
        display:flex;
        align-items:center;
        justify-content: space-between;
        gap: 10px;
        padding: 10px 10px;
        border-radius: 16px;
        background: rgba(255,255,255,.06);
        box-shadow: inset 0 0 0 1px rgba(255,255,255,.06);
        margin-bottom: 8px;
      }
      .tntRank{ width: 42px; font-weight:1000; color: rgba(255,255,255,.92); }
      .tntName{
        flex: 1;
        font-weight:1000;
        color: rgba(255,255,255,.92);
        overflow:hidden;
        text-overflow: ellipsis;
        white-space: nowrap;
      }
      .tntPts{ width: 70px; text-align:right; font-weight:1000; color: rgba(255,255,255,.92); }
      .tntMini{ width: 120px; text-align:right; font-size: 11px; color: rgba(255,255,255,.78); white-space: nowrap; }
      .tntRow.isPlayer{
        background: rgba(255,215,0,.16);
        box-shadow: inset 0 0 0 1px rgba(255,215,0,.28);
      }

      .tntResultFooter{
        position:absolute; left:0; right:0; bottom:0;
        padding: 12px 14px 14px;
        border-top: 1px solid rgba(255,255,255,.10);
        background: rgba(0,0,0,.18);
      }
      .tntCloseBtn{
        width:100%;
        border:0;
        border-radius: 16px;
        padding: 12px 14px;
        min-height: 44px;
        font-weight: 1000;
        background: rgba(255,255,255,.92);
      }
    `;
    document.head.appendChild(st);
  }

  function build(){
    if (built) return;
    built = true;

    injectStyle();

    dom.back = document.createElement('div');
    dom.back.id = 'tournamentBack';
    dom.back.setAttribute('aria-hidden', 'true');

    dom.root = document.createElement('div');
    dom.root.id = 'tournamentRoot';
    dom.root.setAttribute('aria-hidden', 'true');

    dom.bg = document.createElement('div');
    dom.bg.className = 'tntBg';
    const bgImg = document.createElement('img');
    bgImg.className = 'tntBgImg';
    bgImg.alt = 'TOURNAMENT BG';
    bgImg.draggable = false;
    dom.bg.appendChild(bgImg);

    dom.panel = document.createElement('div');
    dom.panel.className = 'tntPanel';

    dom.layerTent = document.createElement('div');
    dom.layerTent.className = 'tntTent';

    dom.tentImg = document.createElement('img');
    dom.tentImg.className = 'tntTentImg';
    dom.tentImg.alt = 'TENT';
    dom.tentImg.draggable = false;
    dom.layerTent.appendChild(dom.tentImg);

    dom.layerChars = document.createElement('div');
    dom.layerChars.className = 'tntChars';

    dom.playerImg = document.createElement('img');
    dom.playerImg.className = 'tntCharImg player';
    dom.playerImg.alt = 'PLAYER';
    dom.playerImg.draggable = false;

    dom.enemyImg = document.createElement('img');
    dom.enemyImg.className = 'tntCharImg enemy';
    dom.enemyImg.alt = 'ENEMY';
    dom.enemyImg.draggable = false;

    dom.layerChars.appendChild(dom.playerImg);
    dom.layerChars.appendChild(dom.enemyImg);

    dom.msgWrap = document.createElement('div');
    dom.msgWrap.className = 'tntMsg';

    dom.msgTitle = document.createElement('div');
    dom.msgTitle.className = 'tntMsgTitle';
    dom.msgTitle.textContent = '';

    dom.msgBody = document.createElement('div');
    dom.msgBody.className = 'tntMsgBody';
    dom.msgBody.textContent = '';

    const nextRow = document.createElement('div');
    nextRow.className = 'tntNextRow';

    dom.btnNext = document.createElement('button');
    dom.btnNext.type = 'button';
    dom.btnNext.className = 'tntNextBtn';
    dom.btnNext.textContent = 'NEXT';

    nextRow.appendChild(dom.btnNext);

    dom.msgWrap.appendChild(dom.msgTitle);
    dom.msgWrap.appendChild(dom.msgBody);
    dom.msgWrap.appendChild(nextRow);

    dom.resultWrap = document.createElement('div');
    dom.resultWrap.className = 'tntResult';

    const rh = document.createElement('div');
    rh.className = 'tntResultHeader';

    dom.resultHeader = document.createElement('div');
    dom.resultHeader.className = 'tntResultTitle';
    dom.resultHeader.textContent = 'RESULT';

    dom.resultSub = document.createElement('div');
    dom.resultSub.className = 'tntResultSub';
    dom.resultSub.textContent = '';

    rh.appendChild(dom.resultHeader);
    rh.appendChild(dom.resultSub);

    dom.resultList = document.createElement('div');
    dom.resultList.className = 'tntResultList';

    const rf = document.createElement('div');
    rf.className = 'tntResultFooter';

    dom.resultClose = document.createElement('button');
    dom.resultClose.type = 'button';
    dom.resultClose.className = 'tntCloseBtn';
    dom.resultClose.textContent = '閉じる';

    rf.appendChild(dom.resultClose);

    dom.resultWrap.appendChild(rh);
    dom.resultWrap.appendChild(dom.resultList);
    dom.resultWrap.appendChild(rf);

    dom.panel.appendChild(dom.layerTent);
    dom.panel.appendChild(dom.layerChars);
    dom.panel.appendChild(dom.msgWrap);

    dom.root.appendChild(dom.bg);
    dom.root.appendChild(dom.panel);
    dom.root.appendChild(dom.resultWrap);

    document.body.appendChild(dom.back);
    document.body.appendChild(dom.root);

    bind();
  }

  // =========================
  // Background by key
  // =========================
  function resolveBgByKey(key, custom){
    const k = String(key || '').toUpperCase();

    if (k === 'TENT')   return ASSET.TENT;          // 直下
    if (k === 'IDO')    return ASSET.IDO;           // 直下
    if (k === 'WINNER') return ASSET.WINNER;        // 直下
    if (k === 'B_DEBA') return ASSET.B_DEBA;        // 直下
    if (k === 'B_UP')   return ASSET.B_UP;          // 直下
    if (k === 'B_GETA') return ASSET.B_GETA;        // 直下
    if (k === 'B_GETB') return ASSET.B_GETB;        // 直下

    if (k === 'MAP')    return mapImg(ASSET.TOURNAMENT_BG);

    // CUSTOM：そのまま
    if (k === 'CUSTOM') return String(custom || '');

    // 互換：bgにファイル名だけが来た場合は MAP扱いで maps/ を付ける
    if (custom && !String(custom).includes('/') && !/^(https?:)?\/\//.test(String(custom))){
      return mapImg(String(custom));
    }

    return String(custom || mapImg(ASSET.TOURNAMENT_BG));
  }

  function shouldShowTentLayer(bgKey){
    const k = String(bgKey || '').toUpperCase();
    // テント演出は「tent.png」を使うので、テント枠も表示
    return (k === 'TENT');
  }

  // =========================
  // Render
  // =========================
  function setBackVisible(on){
    if (!dom.back) return;
    dom.back.classList.toggle('show', !!on);
    dom.back.setAttribute('aria-hidden', on ? 'false' : 'true');
  }

  function setRootVisible(on){
    if (!dom.root) return;
    dom.root.classList.toggle('show', !!on);
    dom.root.setAttribute('aria-hidden', on ? 'false' : 'true');
  }

  function render(){
    if (!built) build();

    // background
    const bgImg = dom.bg?.querySelector('.tntBgImg');
    if (bgImg) bgImg.src = state.bg || mapImg(ASSET.TOURNAMENT_BG);

    // tent layer (only when bgKey === TENT)
    if (dom.layerTent){
      dom.layerTent.classList.toggle('show', shouldShowTentLayer(state.bgKey));
    }
    if (dom.tentImg) dom.tentImg.src = ASSET.TENT;

    // chars
    if (dom.playerImg) dom.playerImg.src = state.playerImage || 'P1.png';
    if (dom.enemyImg){
      const hasEnemy = !!state.enemyImage;
      dom.enemyImg.style.display = hasEnemy ? '' : 'none';
      if (hasEnemy) dom.enemyImg.src = state.enemyImage;
    }

    // message
    const title = state.title || '';
    const lines = Array.isArray(state.messageLines) ? state.messageLines : [];
    const body = lines.join('\n');

    if (dom.msgTitle) dom.msgTitle.textContent = title;
    if (dom.msgBody) dom.msgBody.textContent = body;

    // next button
    if (dom.btnNext){
      dom.btnNext.textContent = state.nextLabel || 'NEXT';
      dom.btnNext.disabled = !state.nextEnabled;
    }

    // result visibility
    if (dom.resultWrap){
      dom.resultWrap.classList.toggle('show', !!state.showResult);
    }

    setBackVisible(state.isOpen);
    setRootVisible(state.isOpen);
  }

  // =========================
  // Result rendering（Apex風：20/40対応）
  // =========================
  function clearResult(){
    if (dom.resultList) dom.resultList.innerHTML = '';
  }

  function fmtMini(row){
    const k = row.kills ?? row.kill ?? 0;
    const a = row.assists ?? row.assist ?? 0;
    const t = row.treasure ?? 0;
    const f = row.flag ?? 0;
    return `K${k} A${a} T${t} F${f}`;
  }

  function renderResultList(rows){
    clearResult();
    if (!dom.resultList) return;

    const arr = Array.isArray(rows) ? rows : [];

    if (arr.length === 0){
      const empty = document.createElement('div');
      empty.style.padding = '14px';
      empty.style.opacity = '0.85';
      empty.textContent = '結果データがありません';
      dom.resultList.appendChild(empty);
      return;
    }

    arr.forEach((r, idx)=>{
      const rank = r.rank ?? (idx + 1);
      const teamId = String(r.teamId ?? r.id ?? '');
      const name = String(r.teamName ?? r.name ?? teamId || `TEAM${rank}`);
      const pts = Number(r.points ?? r.totalPoints ?? 0);

      const row = document.createElement('div');
      row.className = 'tntRow';
      if (state.highlightTeamId && teamId && teamId === state.highlightTeamId){
        row.classList.add('isPlayer');
      }

      const leftRank = document.createElement('div');
      leftRank.className = 'tntRank';
      leftRank.textContent = `${rank}位`;

      const nm = document.createElement('div');
      nm.className = 'tntName';
      nm.textContent = name;

      const mini = document.createElement('div');
      mini.className = 'tntMini';
      mini.textContent = fmtMini(r);

      const p = document.createElement('div');
      p.className = 'tntPts';
      p.textContent = `${pts}pt`;

      row.appendChild(leftRank);
      row.appendChild(nm);
      row.appendChild(mini);
      row.appendChild(p);

      dom.resultList.appendChild(row);
    });
  }

  // =========================
  // Public UI API（flowが呼ぶ）
  // =========================
  function open(opts){
    build();

    state.isOpen = true;

    // bgKey優先（なければbg）
    const bgKey = (opts?.bgKey !== undefined) ? String(opts.bgKey || '') : state.bgKey;
    state.bgKey = bgKey || 'MAP';
    state.bg = (opts?.bg !== undefined)
      ? resolveBgByKey(state.bgKey, opts.bg)
      : resolveBgByKey(state.bgKey, mapImg(ASSET.TOURNAMENT_BG));

    state.playerImage = String(opts?.playerImage || 'P1.png');
    state.enemyImage  = String(opts?.enemyImage  || '');

    state.title = String(opts?.title || '');
    state.subtitle = String(opts?.subtitle || '');
    state.messageLines = Array.isArray(opts?.messageLines) ? opts.messageLines : (opts?.message ? [String(opts.message)] : []);
    state.nextLabel = String(opts?.nextLabel || 'NEXT');
    state.nextEnabled = (opts?.nextEnabled !== false);
    state.onNext = (typeof opts?.onNext === 'function') ? opts.onNext : null;

    state.showResult = false;
    state.resultTitle = '';
    state.resultLobbyLabel = '';
    state.resultRows = [];
    state.highlightTeamId = String(opts?.highlightTeamId || '');

    state.lockBack = true;

    render();
  }

  function close(){
    state.isOpen = false;
    state.onNext = null;
    state.showResult = false;
    state.lockBack = false;
    render();
  }

  function setScene(opts){
    // bgKey / bg
    if (opts?.bgKey !== undefined){
      state.bgKey = String(opts.bgKey || 'MAP');
      // bg未指定でもキーに沿って切り替える
      if (opts?.bg === undefined){
        state.bg = resolveBgByKey(state.bgKey, mapImg(ASSET.TOURNAMENT_BG));
      }
    }

    if (opts?.bg !== undefined){
      state.bg = resolveBgByKey(state.bgKey, opts.bg);
    }

    state.playerImage = (opts?.playerImage !== undefined) ? String(opts.playerImage) : state.playerImage;
    state.enemyImage  = (opts?.enemyImage  !== undefined) ? String(opts.enemyImage)  : state.enemyImage;

    state.title = (opts?.title !== undefined) ? String(opts.title) : state.title;
    state.subtitle = (opts?.subtitle !== undefined) ? String(opts.subtitle) : state.subtitle;

    if (opts?.messageLines !== undefined){
      state.messageLines = Array.isArray(opts.messageLines) ? opts.messageLines : [];
    }else if (opts?.message !== undefined){
      state.messageLines = [String(opts.message)];
    }

    state.nextLabel = (opts?.nextLabel !== undefined) ? String(opts.nextLabel) : state.nextLabel;
    if (opts?.nextEnabled !== undefined) state.nextEnabled = !!opts.nextEnabled;
    if (opts?.onNext !== undefined) state.onNext = (typeof opts.onNext === 'function') ? opts.onNext : null;

    if (opts?.highlightTeamId !== undefined) state.highlightTeamId = String(opts.highlightTeamId || '');

    render();
  }

  // 便利：イベント背景キーを使って表示
  function showEventScene(eventKey, title, lines, nextLabel){
    setScene({
      bgKey: eventKey,
      title: title || '',
      messageLines: Array.isArray(lines) ? lines : [String(lines || '')],
      nextLabel: (nextLabel !== undefined) ? String(nextLabel) : state.nextLabel
    });
  }

  function showMessage(title, lines, nextLabel){
    state.showResult = false;
    state.title = String(title || '');
    state.messageLines = Array.isArray(lines) ? lines : [String(lines || '')];
    if (nextLabel !== undefined) state.nextLabel = String(nextLabel || 'NEXT');
    render();
  }

  function showResult(opts){
    state.showResult = true;
    state.resultTitle = String(opts?.title || 'RESULT');
    state.resultLobbyLabel = String(opts?.sub || '');

    if (dom.resultHeader) dom.resultHeader.textContent = state.resultTitle;
    if (dom.resultSub) dom.resultSub.textContent = state.resultLobbyLabel;

    state.highlightTeamId = String(opts?.highlightTeamId ?? state.highlightTeamId ?? '');
    state.resultRows = Array.isArray(opts?.rows) ? opts.rows : [];

    renderResultList(state.resultRows);
    render();
  }

  function hideResult(){
    state.showResult = false;
    render();
  }

  function setNextHandler(fn){
    state.onNext = (typeof fn === 'function') ? fn : null;
    render();
  }

  function setNextEnabled(on){
    state.nextEnabled = !!on;
    render();
  }

  // =========================
  // Bind
  // =========================
  let bound = false;
  function bind(){
    if (bound) return;
    bound = true;

    if (dom.back){
      dom.back.addEventListener('click', (e)=>{
        e.preventDefault();
        e.stopPropagation();
      }, { passive:false });
    }

    if (dom.btnNext){
      dom.btnNext.addEventListener('click', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        if (!state.nextEnabled) return;

        state.nextEnabled = false;
        render();

        try{
          if (typeof state.onNext === 'function') state.onNext();
        }finally{
          setTimeout(()=>{
            if (!state.isOpen) return;
            if (state.nextEnabled === false){
              state.nextEnabled = true;
              render();
            }
          }, 120);
        }
      });
    }

    if (dom.resultClose){
      dom.resultClose.addEventListener('click', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        hideResult();
      });
    }

    window.addEventListener('keydown', (e)=>{
      if (!state.isOpen) return;
      if (e.key === 'Escape'){
        e.preventDefault();
      }
    });
  }

  // =========================
  // Debug
  // =========================
  function demoResult20(){
    const rows = [];
    for (let i=1; i<=20; i++){
      rows.push({
        rank: i,
        teamId: `team${String(i).padStart(2,'0')}`,
        teamName: `TEAM ${i}`,
        points: Math.max(0, 50 - i),
        kills: Math.floor(Math.random()*8),
        assists: Math.floor(Math.random()*10),
        treasure: Math.floor(Math.random()*2),
        flag: Math.floor(Math.random()*2)
      });
    }
    showResult({
      title: 'RESULT',
      sub: 'A & B 第1試合',
      rows,
      highlightTeamId: 'team01'
    });
  }

  // =========================
  // Expose
  // =========================
  window.MOBBR.ui.tournament = {
    VERSION: 'v2',

    open,
    close,
    setScene,
    showMessage,
    showResult,
    hideResult,
    setNextHandler,
    setNextEnabled,

    // 追加：イベント用
    showEventScene,

    // assets keys（flow側で使う用）
    BG_KEYS: {
      MAP: 'MAP',
      TENT: 'TENT',
      IDO: 'IDO',
      WINNER: 'WINNER',
      B_DEBA: 'B_DEBA',
      B_UP: 'B_UP',
      B_GETA: 'B_GETA',
      B_GETB: 'B_GETB',
      CUSTOM: 'CUSTOM'
    },

    // debug
    _demoResult20: demoResult20
  };

  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', build);
  }else{
    build();
  }
})();
