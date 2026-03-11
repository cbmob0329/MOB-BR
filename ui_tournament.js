'use strict';

/* =========================================================
   ui_tournament.js（v3.6.15 split-3 FULL）
   - entry / bind / dispatcher / render
   - core: ui_tournament.core.js（split-1）FULL 前提
   - handlers: ui_tournament.handlers.js（split-2）FULL 前提

   ✅ v3.6.14（FIX）
   - ✅ noop req は即 consume（v3.6.13踏襲）
   - ✅ hold中 pendingReq を “必ず復帰して描画” する（止まり根絶）
   - ✅ lastReqKey は「描画成功後」に更新（途中returnで固定化しない）
   - ✅ 同一reqが残留しても “UI側で進行不能にならない” 防止策を追加

   ✅ v3.6.15（今回）
   - ✅ 初期設定で決めたチーム名 / メンバー名を大会UIへ反映
   - ✅ PLAYER TEAM / PLAYER_IGL / PLAYER_ATTACKER / PLAYER_SUPPORT を
      localStorage の最新名に同期
   - ✅ render前に state 側を補正
   - ✅ render後に DOM 側も保険で補正
========================================================= */

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){

  const MOD = window.MOBBR.ui._tournamentMod;
  if (!MOD){
    console.error('[ui_tournament] core module missing: window.MOBBR.ui._tournamentMod');
    return;
  }

  // split-2 が後から注入される想定でも動くようにする
  const HANDLER_NAMES = [
    'handleShowArrival',
    'handleShowIntroText',
    'handleShowAutoSession',
    'handleShowAutoSessionDone',
    'handleShowTeamList',
    'handleShowCoachSelect',
    'handleShowDropStart',
    'handleShowDropLanded',
    'handleShowRoundStart',
    'handleShowEvent',
    'handlePrepareBattles',
    'handleShowEncounter',
    'handleShowBattle',
    'handleShowMove',
    'handleShowChampion',
    'handleShowMatchResult',
    'handleShowTournamentResult',
    'handleShowNationalNotice',
    'handleEndTournament',
    'handleEndNationalWeek',
    'handleNextMatch'
  ];

  const {
    ensureDom,
    openCore,
    closeCore,

    getFlow,
    getState,

    mkReqKey,
    setNextEnabled,
    onNextCore,

    // 以下は split-1 に存在（render中の補助）
    syncSessionBar,
    setBattleMode,
    setChampionMode,
    setResultStampMode,
    hidePanels,
    hideSplash,
    showCenterStamp
  } = MOD;

  let bound = false;

  function hasHandlers(){
    return HANDLER_NAMES.every(k => typeof MOD[k] === 'function');
  }

  // =========================================================
  // PLAYER名同期
  // =========================================================
  const LS = {
    team: 'mobbr_team',
    playerTeam: 'mobbr_playerTeam',
    m1: 'mobbr_m1',
    m2: 'mobbr_m2',
    m3: 'mobbr_m3'
  };

  function readPlayerNames(){
    let teamName = '';
    let a = '';
    let b = '';
    let c = '';

    try{
      teamName = String(localStorage.getItem(LS.team) || '').trim();
    }catch(_){}

    try{
      a = String(localStorage.getItem(LS.m1) || '').trim();
      b = String(localStorage.getItem(LS.m2) || '').trim();
      c = String(localStorage.getItem(LS.m3) || '').trim();
    }catch(_){}

    try{
      const raw = localStorage.getItem(LS.playerTeam);
      if (raw){
        const obj = JSON.parse(raw);
        if (!teamName){
          const tn = String(obj?.teamName || '').trim();
          if (tn) teamName = tn;
        }

        const members = Array.isArray(obj?.members) ? obj.members : [];
        const ma = members.find(x => String(x?.id || '') === 'A');
        const mb = members.find(x => String(x?.id || '') === 'B');
        const mc = members.find(x => String(x?.id || '') === 'C');

        if (!a){
          const v = String(ma?.name || '').trim();
          if (v) a = v;
        }
        if (!b){
          const v = String(mb?.name || '').trim();
          if (v) b = v;
        }
        if (!c){
          const v = String(mc?.name || '').trim();
          if (v) c = v;
        }
      }
    }catch(_){}

    return {
      teamName: teamName || 'PLAYER TEAM',
      a: a || 'A',
      b: b || 'B',
      c: c || 'C'
    };
  }

  function replacePlayerText(v, names){
    const s = String(v ?? '');
    if (!s) return s;

    if (s === 'PLAYER TEAM') return names.teamName;
    if (s === 'PLAYER') return names.teamName;

    if (s === 'PLAYER_IGL') return names.a;
    if (s === 'PLAYER_ATTACKER') return names.b;
    if (s === 'PLAYER_SUPPORT') return names.c;

    return s;
  }

  function syncPlayerNamesIntoState(){
    const st = getState();
    if (!st) return;

    const names = readPlayerNames();

    // teams
    try{
      if (Array.isArray(st.teams)){
        for (const t of st.teams){
          if (!t) continue;
          if (String(t.id || '') !== 'PLAYER') continue;

          t.name = names.teamName;

          if (Array.isArray(t.members)){
            const m0 = t.members[0];
            const m1 = t.members[1];
            const m2 = t.members[2];

            if (m0) m0.name = names.a;
            if (m1) m1.name = names.b;
            if (m2) m2.name = names.c;
          }
        }
      }
    }catch(_){}

    // national/world all defs
    try{
      const defs = st?.national?.allTeamDefs;
      if (defs && typeof defs === 'object' && defs.PLAYER){
        defs.PLAYER.name = names.teamName;
        if (Array.isArray(defs.PLAYER.members)){
          const m0 = defs.PLAYER.members[0];
          const m1 = defs.PLAYER.members[1];
          const m2 = defs.PLAYER.members[2];

          if (m0) m0.name = names.a;
          if (m1) m1.name = names.b;
          if (m2) m2.name = names.c;
        }
      }
    }catch(_){}

    // center stamp / name fields
    try{
      if (st.center && typeof st.center === 'object'){
        st.center.a = replacePlayerText(st.center.a, names);
        st.center.b = replacePlayerText(st.center.b, names);
        st.center.c = replacePlayerText(st.center.c, names);
      }
    }catch(_){}

    try{
      if (st.ui && typeof st.ui === 'object'){
        st.ui.topLeftName = replacePlayerText(st.ui.topLeftName, names);
        st.ui.topRightName = replacePlayerText(st.ui.topRightName, names);

        if (Array.isArray(st.ui.center3)){
          st.ui.center3 = st.ui.center3.map(x => replacePlayerText(x, names));
        }

        st.ui.playerName = names.teamName;
      }
    }catch(_){}

    // req payload 内の表示テキストも保険で補正
    try{
      const reqs = [];
      if (st.requestObj && typeof st.requestObj === 'object') reqs.push(st.requestObj);
      if (st.requestObjFlat && typeof st.requestObjFlat === 'object') reqs.push(st.requestObjFlat);
      if (st.ui && st.ui.req && typeof st.ui.req === 'object') reqs.push(st.ui.req);
      if (st.ui && st.ui.request && typeof st.ui.request === 'object') reqs.push(st.ui.request);
      if (st.ui && st.ui.reqObj && typeof st.ui.reqObj === 'object') reqs.push(st.ui.reqObj);
      if (st.ui && st.ui.requestObj && typeof st.ui.requestObj === 'object') reqs.push(st.ui.requestObj);

      for (const req of reqs){
        if (!req) continue;

        if (typeof req.leftName === 'string') req.leftName = replacePlayerText(req.leftName, names);
        if (typeof req.rightName === 'string') req.rightName = replacePlayerText(req.rightName, names);
        if (typeof req.title === 'string') req.title = replacePlayerText(req.title, names);
        if (typeof req.text === 'string') req.text = replacePlayerText(req.text, names);

        if (Array.isArray(req.center3)){
          req.center3 = req.center3.map(x => replacePlayerText(x, names));
        }

        const p = req.payload;
        if (p && typeof p === 'object'){
          if (typeof p.leftName === 'string') p.leftName = replacePlayerText(p.leftName, names);
          if (typeof p.rightName === 'string') p.rightName = replacePlayerText(p.rightName, names);
          if (typeof p.title === 'string') p.title = replacePlayerText(p.title, names);
          if (typeof p.text === 'string') p.text = replacePlayerText(p.text, names);

          if (Array.isArray(p.center3)){
            p.center3 = p.center3.map(x => replacePlayerText(x, names));
          }

          if (Array.isArray(p.lines)){
            p.lines = p.lines.map(x => replacePlayerText(x, names));
          }

          if (Array.isArray(p.teams)){
            p.teams.forEach(team=>{
              if (!team || typeof team !== 'object') return;
              if (String(team.id || '') === 'PLAYER' || String(team.name || '') === 'PLAYER TEAM'){
                team.name = names.teamName;
              }
            });
          }

          if (p.team && typeof p.team === 'object'){
            if (String(p.team.id || '') === 'PLAYER' || String(p.team.name || '') === 'PLAYER TEAM'){
              p.team.name = names.teamName;
            }
          }

          if (p.player && typeof p.player === 'object'){
            p.player.name = names.teamName;
            if (Array.isArray(p.player.members)){
              const m0 = p.player.members[0];
              const m1 = p.player.members[1];
              const m2 = p.player.members[2];
              if (m0) m0.name = names.a;
              if (m1) m1.name = names.b;
              if (m2) m2.name = names.c;
            }
          }
        }
      }
    }catch(_){}
  }

  // ===== 表示の後処理（v3.6.11相当を保持）=====
  function escapeHtml(str){
    return String(str)
      .replaceAll('&', '&amp;')
      .replaceAll('<', '&lt;')
      .replaceAll('>', '&gt;')
      .replaceAll('"', '&quot;')
      .replaceAll("'", '&#039;');
  }

  function getOverlayEl(){
    return document.getElementById('mobbrTournamentOverlay');
  }

  function normalizeBannerTextTo2Lines(raw, mode){
    const s0 = String(raw || '').trim();
    if (!s0) return '';
    if (s0.includes('<br>')) return s0;

    if (mode === 'left'){
      const idx = s0.indexOf('MATCH');
      if (idx > 0){
        const a = s0.slice(0, idx).trim();
        const b = s0.slice(idx).trim();
        return `${escapeHtml(a)}<br>${escapeHtml(b)}`;
      }
      return escapeHtml(s0);
    }

    if (mode === 'right'){
      const m = s0.match(/^(ROUND)\s*(\d+.*)$/i);
      if (m){
        return `${escapeHtml(m[1].toUpperCase())}<br>${escapeHtml(m[2])}`;
      }
      return escapeHtml(s0);
    }

    return escapeHtml(s0);
  }

  function applyBannerFix(){
    const st = getState();
    const overlay = getOverlayEl();
    if (!overlay || !st) return;

    const leftEl  = overlay.querySelector('.banner .left');
    const rightEl = overlay.querySelector('.banner .right');
    if (!leftEl || !rightEl) return;

    const leftHtml  = normalizeBannerTextTo2Lines(st.bannerLeft,  'left');
    const rightHtml = normalizeBannerTextTo2Lines(st.bannerRight, 'right');

    try{ leftEl.innerHTML  = leftHtml; }catch(_){ leftEl.textContent = String(st.bannerLeft||''); }
    try{ rightEl.innerHTML = rightHtml; }catch(_){ rightEl.textContent = String(st.bannerRight||''); }
  }

  function applyNameBoxFix(){
    const overlay = getOverlayEl();
    if (!overlay) return;

    const names = overlay.querySelectorAll('.chars .char .name');
    for (const el of names){
      try{
        el.style.whiteSpace = 'pre-line';
        el.style.wordBreak  = 'keep-all';
      }catch(_){}
    }
  }

  // ✅ render後のDOM保険補正
  function applyPlayerNameDomFix(){
    const overlay = getOverlayEl();
    if (!overlay) return;

    const names = readPlayerNames();

    const walker = document.createTreeWalker(overlay, NodeFilter.SHOW_TEXT, null);
    const textNodes = [];
    let node;
    while ((node = walker.nextNode())){
      textNodes.push(node);
    }

    for (const n of textNodes){
      const before = String(n.nodeValue || '');
      let after = before;

      after = after.replaceAll('PLAYER TEAM', names.teamName);
      after = after.replaceAll('PLAYER_IGL', names.a);
      after = after.replaceAll('PLAYER_ATTACKER', names.b);
      after = after.replaceAll('PLAYER_SUPPORT', names.c);

      if (after !== before){
        n.nodeValue = after;
      }
    }

    // よくある name 系要素は textContent でも補正
    const selectors = [
      '.teamName',
      '.name',
      '.leftName',
      '.rightName',
      '.vsName',
      '.resultName',
      '.teamListName',
      '.championName',
      '.logBox',
      '.centerStamp',
      '.stamp',
      '.center',
      '.center3'
    ];

    for (const sel of selectors){
      const els = overlay.querySelectorAll(sel);
      for (const el of els){
        if (!el) continue;
        const before = String(el.textContent || '');
        let after = before;

        after = after.replaceAll('PLAYER TEAM', names.teamName);
        after = after.replaceAll('PLAYER_IGL', names.a);
        after = after.replaceAll('PLAYER_ATTACKER', names.b);
        after = after.replaceAll('PLAYER_SUPPORT', names.c);

        if (after !== before){
          el.textContent = after;
        }
      }
    }
  }

  function postRenderFixups(){
    applyBannerFix();
    applyNameBoxFix();
    applyPlayerNameDomFix();
  }

  // ===== bind =====
  function bindOnce(){
    if (bound) return;
    bound = true;

    const dom = ensureDom();

    dom.nextBtn.addEventListener('click', ()=>{
      const r = onNextCore();
      if (r && r.shouldRender){
        MOD.render();
      }
    });

    dom.closeBtn.addEventListener('click', ()=>{
      MOD.close();
    });

    // キーボード（PCデバッグ）
    window.addEventListener('keydown', (e)=>{
      if (!dom.overlay.classList.contains('isOpen')) return;
      if (e.key === 'Enter' || e.key === ' '){
        e.preventDefault();
        const r = onNextCore();
        if (r && r.shouldRender) MOD.render();
      }
      if (e.key === 'Escape'){
        e.preventDefault();
        MOD.close();
      }
    });
  }

  // =============== Request pickup (robust) ===============
  function peekReq(flow){
    if (!flow) return null;

    try{
      if (typeof flow.peekUiRequest === 'function') return flow.peekUiRequest() || null;
    }catch(e){}

    try{
      if (typeof flow.peekRequest === 'function') return flow.peekRequest() || null;
    }catch(e){}

    try{
      const st = getState();
      if (st && st.ui && st.ui.req) return st.ui.req;
      if (st && st.ui && st.ui.request) return st.ui.request;
    }catch(e){}

    try{
      if (flow.uiReq) return flow.uiReq;
      if (flow.uiRequest) return flow.uiRequest;
      if (flow.req) return flow.req;
      if (flow.request) return flow.request;
    }catch(e){}

    return null;
  }

  function consumeReq(flow){
    if (!flow) return;

    try{
      if (typeof flow.consumeUiRequest === 'function'){ flow.consumeUiRequest(); return; }
    }catch(e){}
    try{
      if (typeof flow.consumeRequest === 'function'){ flow.consumeRequest(); return; }
    }catch(e){}

    try{
      const st = getState();
      if (st && st.ui){
        if ('req' in st.ui) st.ui.req = null;
        if ('request' in st.ui) st.ui.request = null;
      }
    }catch(e){}

    try{
      if ('uiReq' in flow) flow.uiReq = null;
      if ('uiRequest' in flow) flow.uiRequest = null;
      if ('req' in flow) flow.req = null;
      if ('request' in flow) flow.request = null;
    }catch(e){}
  }

  function stashPendingIfHolding(req){
    const holdType = MOD._getHoldScreenType ? MOD._getHoldScreenType() : null;
    if (!holdType) return false;

    const pending = MOD._getPendingReqAfterHold ? MOD._getPendingReqAfterHold() : null;
    if (pending) return true;

    const t = String(req?.type || '');
    if (!t) return false;

    if (t === holdType) return true;

    if (MOD._setPendingReqAfterHold) MOD._setPendingReqAfterHold(req);
    return true;
  }

  // ✅ v3.6.14: hold解除後は pending を最優先で描画
  function popPendingIfReady(){
    const holdType = MOD._getHoldScreenType ? MOD._getHoldScreenType() : null;
    if (holdType) return null;

    const pending = MOD._getPendingReqAfterHold ? MOD._getPendingReqAfterHold() : null;
    if (!pending) return null;

    if (MOD._setPendingReqAfterHold) MOD._setPendingReqAfterHold(null);
    return pending;
  }

  // =============== Dispatcher ===============
  async function dispatch(req){
    const t = String(req?.type || '');

    switch(t){
      case 'showArrival':            return MOD.handleShowArrival(req);
      case 'showIntroText':          return MOD.handleShowIntroText(req);
      case 'showAutoSession':        return MOD.handleShowAutoSession(req);
      case 'showAutoSessionDone':    return MOD.handleShowAutoSessionDone(req);
      case 'showTeamList':           return MOD.handleShowTeamList(req);
      case 'showCoachSelect':        return MOD.handleShowCoachSelect(req);
      case 'showDropStart':          return MOD.handleShowDropStart(req);
      case 'showDropLanded':         return MOD.handleShowDropLanded(req);
      case 'showRoundStart':         return MOD.handleShowRoundStart(req);
      case 'showEvent':              return MOD.handleShowEvent(req);
      case 'prepareBattles':         return MOD.handlePrepareBattles(req);
      case 'showEncounter':          return MOD.handleShowEncounter(req);
      case 'showBattle':             return MOD.handleShowBattle(req);
      case 'showMove':               return MOD.handleShowMove(req);
      case 'showChampion':           return MOD.handleShowChampion(req);
      case 'showMatchResult':        return MOD.handleShowMatchResult(req);
      case 'showTournamentResult':   return MOD.handleShowTournamentResult(req);
      case 'showNationalNotice':     return MOD.handleShowNationalNotice(req);
      case 'nextMatch':              return MOD.handleNextMatch(req);
      case 'endTournament':          return MOD.handleEndTournament(req);
      case 'endNationalWeek':        return MOD.handleEndNationalWeek(req);
      default:
        console.warn('[ui_tournament] unknown req.type:', t, req);
        return;
    }
  }

  // =============== Public API ===============
  async function render(){
    bindOnce();
    ensureDom();

    if (MOD._getRendering && MOD._getRendering()) return;

    const flow = getFlow();
    if (!flow){
      setNextEnabled(false);
      return;
    }

    if (!hasHandlers()){
      console.error('[ui_tournament] handlers missing. make sure split-2 is loaded before calling render().');
      setNextEnabled(false);
      return;
    }

    // ✅ render前に state 側へ最新名を流し込む
    syncPlayerNamesIntoState();

    try{ if (typeof syncSessionBar === 'function') syncSessionBar(); }catch(e){}

    const pend = popPendingIfReady();
    if (pend){
      await renderOne(flow, pend, { fromPending:true });
      postRenderFixups();
      return;
    }

    const req = peekReq(flow);

    if (req && String(req.type || '') === 'noop'){
      consumeReq(flow);
      setNextEnabled(true);
      postRenderFixups();
      return;
    }

    if (!req){
      setNextEnabled(true);
      postRenderFixups();
      return;
    }

    if (stashPendingIfHolding(req)){
      setNextEnabled(true);
      postRenderFixups();
      return;
    }

    await renderOne(flow, req, { fromPending:false });
    postRenderFixups();
  }

  // ✅ v3.6.14: lastReqKey の更新は「描画成功後」
  async function renderOne(flow, req, opt){
    if (MOD._setRendering) MOD._setRendering(true);

    setNextEnabled(false);

    try{
      // ✅ dispatch直前にも最新名で補正
      syncPlayerNamesIntoState();

      const key = mkReqKey(req);
      const last = MOD._getLastReqKey ? MOD._getLastReqKey() : '';

      if (!opt?.fromPending && key && key === last){
        consumeReq(flow);
        setNextEnabled(true);
        return;
      }

      try{
        const t = String(req?.type||'');
        if (!t || t === 'noop'){
          if (typeof setBattleMode === 'function' && MOD._getEncounterGatePhase && MOD._getEncounterGatePhase() === 0){
            setBattleMode(false);
          }
          if (typeof setChampionMode === 'function') setChampionMode(false);
          if (typeof setResultStampMode === 'function') setResultStampMode(false);
          if (typeof hidePanels === 'function') hidePanels();
          if (typeof hideSplash === 'function') hideSplash();
          if (typeof showCenterStamp === 'function') showCenterStamp('');
        }
      }catch(e){}

      await dispatch(req);

      consumeReq(flow);

      if (MOD._setLastReqKey){
        const key2 = mkReqKey(req);
        MOD._setLastReqKey(key2);
      }

    }catch(e){
      console.error('[ui_tournament] render error:', e);
      try{ consumeReq(flow); }catch(_){}

    }finally{
      if (MOD._setRendering) MOD._setRendering(false);
      setNextEnabled(true);
    }
  }

  function open(){
    bindOnce();
    openCore();
    render();
  }

  function close(){
    closeCore();
  }

  // ===== expose =====
  Object.assign(MOD, { open, close, render });

  window.MOBBR.ui.tournament = window.MOBBR.ui.tournament || {};
  Object.assign(window.MOBBR.ui.tournament, {
    open: ()=>MOD.open(),
    close: ()=>MOD.close(),
    render: ()=>MOD.render()
  });

})();
