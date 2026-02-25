'use strict';

/* =========================================================
   ui_tournament.handlers.js（v3.6.12 split-2）FULL
   - 各 handleShow*** / buildTable 系
   - ✅変更:
     1) SKIPボタン/スキップ確認ロジックを完全廃止
     2) コーチスキルは「現状使わない」ため UIを廃止（選択させない）
        ※ flow 側の仕組みは壊さず、UIだけ無効化（将来の交戦スキル追加に備える）

   ✅ v3.6.12 変更（今回の②対応：UI側）
   - FIX: 試合resultに currentOverall を “同じパネル内に混在表示” しない（分離）
   - ADD: 総合resultで「通過ライン色分け」
          Local上位10 / National上位8 / LastChance上位2 / WORLD予選上位10 / Losers上位10
   - ADD: WORLD FINALは「80pt点灯チーム」を色分け（state.worldFinalMP.litAtMatch）
   - 既存: 敵画像候補の生成で “空 → P1.png” に落ちない（coreの guessEnemyImageCandidates）
========================================================= */

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){

  const MOD = window.MOBBR.ui._tournamentMod;
  if (!MOD){
    console.error('[ui_tournament.handlers] core module missing');
    return;
  }

  const {
    TOURNEY_BACKDROP, ASSET, BATTLE_CHAT,

    getFlow, getState,
    sleep, shuffle,

    lockUI, unlockUI,

    setChampionMode, setResultStampMode,
    hidePanels, hideSplash,
    setEventIcon, showCenterStamp,
    resetEncounterGate, clearHold, setHold,
    setBattleMode,

    setBackdrop, setSquareBg, setChars, setNames, setNamesRich,
    setBanners, setLines,
    showSplash, showPanel, escapeHtml,
    syncSessionBar,
    preloadEventIcons,
    guessPlayerImageCandidates,
    guessEnemyImageCandidates,
    guessTeamImageCandidates,
    resolveFirstExisting,

    getMatchTotalFromState
  } = MOD;

  function pickChats(n){
    const a = shuffle(BATTLE_CHAT);
    const out = a.slice(0, Math.max(1, n|0));
    if (out.length >= 6){
      const idx = 3 + ((Math.random()*3)|0);
      out[idx] = 'ウルト行くぞ！';
    }
    return out;
  }

  function buildTeamListTable(teams){
    const wrap = document.createElement('div');
    wrap.className = 'teamListWrap';

    const table = document.createElement('table');
    table.className = 'teamTable';
    table.innerHTML = `
      <thead>
        <tr>
          <th>TEAM</th>
          <th class="num">POWER</th>
          <th class="num">ALIVE</th>
          <th class="num">TRE</th>
          <th class="num">FLG</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tb = table.querySelector('tbody');

    (teams||[]).forEach(t=>{
      const tr = document.createElement('tr');
      if (t.isPlayer) tr.classList.add('isPlayer');
      tr.innerHTML = `
        <td>${escapeHtml(t.name || t.id || '')}</td>
        <td class="num">${escapeHtml(String(t.power ?? ''))}</td>
        <td class="num">${escapeHtml(String(t.alive ?? ''))}</td>
        <td class="num">${escapeHtml(String(t.treasure ?? 0))}</td>
        <td class="num">${escapeHtml(String(t.flag ?? 0))}</td>
      `;
      tb.appendChild(tr);
    });

    wrap.appendChild(table);
    return wrap;
  }

  function buildCurrentOverallTable(rows){
    const wrap = document.createElement('div');
    wrap.className = 'overallWrap';

    const table = document.createElement('table');
    table.className = 'tourneyTable';
    table.innerHTML = `
      <thead>
        <tr>
          <th>RANK</th>
          <th>TEAM</th>
          <th class="num">PT</th>
          <th class="num">PP</th>
          <th class="num">K</th>
          <th class="num">A</th>
          <th class="num">TRE</th>
          <th class="num">FLG</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tb = table.querySelector('tbody');

    (rows||[]).forEach((r,i)=>{
      const tr = document.createElement('tr');
      const isPlayer = (String(r.id||'') === 'PLAYER') || !!r.isPlayer;
      if (isPlayer) tr.classList.add('isPlayer');

      tr.innerHTML = `
        <td>${escapeHtml(String(i+1))}</td>
        <td>${escapeHtml(String(r.name || r.squad || r.id || ''))}</td>
        <td class="num">${escapeHtml(String(r.total ?? 0))}</td>
        <td class="num">${escapeHtml(String(r.placementP ?? 0))}</td>
        <td class="num">${escapeHtml(String(r.kp ?? 0))}</td>
        <td class="num">${escapeHtml(String(r.ap ?? 0))}</td>
        <td class="num">${escapeHtml(String(r.treasure ?? 0))}</td>
        <td class="num">${escapeHtml(String(r.flag ?? 0))}</td>
      `;
      tb.appendChild(tr);
    });

    wrap.appendChild(table);
    return wrap;
  }

  function findChampionTeam(state, payload){
    const teams = Array.isArray(state?.teams) ? state.teams : [];
    const name = String(payload?.championName || payload?.line2 || '').trim();

    let t = null;

    if (payload?.championTeamId){
      const id = String(payload.championTeamId);
      t = teams.find(x=>String(x?.id||'') === id) || null;
      if (t) return t;
    }

    if (name){
      t = teams.find(x=>String(x?.name||'') === name) || null;
      if (t) return t;

      t = teams.find(x=>String(x?.name||'').includes(name)) || null;
      if (t) return t;
    }

    return null;
  }

  // =========================================================
  // ✅ 通過ライン / 点灯ライン（色分け用）
  // =========================================================
  function getQualLineByState(st){
    const mode = String(st?.mode || '').toLowerCase();
    const wp = String(st?.worldPhase || st?.phase || '').toLowerCase();

    if (mode === 'local') return { line: 10, label: 'TOP10通過' };
    if (mode === 'national') return { line: 8, label: 'TOP8通過' };
    if (mode === 'lastchance') return { line: 2, label: 'TOP2通過' };

    if (mode === 'world'){
      if (wp === 'qual') return { line: 10, label: 'TOP10通過' };
      if (wp === 'losers') return { line: 10, label: 'TOP10通過' };
      if (wp === 'final') return { line: 0, label: '' }; // finalは点灯で表示
      if (wp === 'eliminated') return { line: 0, label: '' };
    }
    return { line: 0, label: '' };
  }

  function getWorldFinalLitSet(st){
    try{
      const mp = st?.worldFinalMP;
      const lit = mp?.litAtMatch;
      if (!lit || typeof lit !== 'object') return new Set();
      const s = new Set();
      for (const k of Object.keys(lit)){
        const id = String(k||'');
        if (!id) continue;
        s.add(id);
      }
      return s;
    }catch(_){
      return new Set();
    }
  }

  function applyRowHighlight(tr, opts){
    // opts: { qualified:boolean, cut:boolean, lit:boolean }
    if (!tr) return;

    if (opts?.qualified){
      tr.classList.add('isQualified');
      // CSSが無い環境でも一応見えるように（薄め）
      tr.style.background = 'rgba(80, 200, 120, 0.12)';
    }
    if (opts?.cut){
      tr.classList.add('isCut');
      tr.style.opacity = '0.72';
    }
    if (opts?.lit){
      tr.classList.add('isLit');
      tr.style.background = 'rgba(255, 215, 0, 0.14)';
      tr.style.boxShadow = 'inset 0 0 0 1px rgba(255, 215, 0, 0.35)';
    }
  }

  async function handleShowArrival(payload){
    lockUI();
    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels();
      setEventIcon('');
      showCenterStamp('');
      resetEncounterGate();
      clearHold();
      setBattleMode(false);

      setBackdrop(TOURNEY_BACKDROP);
      setSquareBg('');
      setChars('', '');
      setNames('', '');
      hideSplash();

      showSplash(payload?.line1 || '大会会場へ到着！', payload?.line2 || '観客の熱気が一気に押し寄せる…！');
      setLines(
        payload?.line1 || '🏟️ 大会会場へ到着！',
        payload?.line2 || '🔥 観客が沸いている…！',
        payload?.line3 || 'NEXTで開幕演出へ'
      );
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handleShowIntroText(){
    lockUI();
    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels(); hideSplash(); showCenterStamp(''); setEventIcon('');
      resetEncounterGate();
      clearHold();
      setBattleMode(false);

      const st = getState();
      if (!st) return;

      setBackdrop(TOURNEY_BACKDROP);
      const sq = await resolveFirstExisting([st.ui?.squareBg || ASSET.tent, ASSET.tent]);
      setSquareBg(sq || ASSET.tent);

      const leftResolved = await resolveFirstExisting(MOD.guessPlayerImageCandidates(st.ui?.leftImg || 'P1.png'));
      setChars(leftResolved, '');
      setNames('', '');

      setBanners(st.bannerLeft, st.bannerRight);

      const l1 = st.ui?.center3?.[0] || 'ローカル大会開幕！';
      const l2 = st.ui?.center3?.[1] || '本日の戦場へ——';
      const l3 = st.ui?.center3?.[2] || 'NEXTでチーム紹介';
      setLines(l1, l2, l3);

      MOD.preloadEventIcons();
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handleShowAutoSession(payload){
    lockUI();
    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels();
      setEventIcon('');
      showCenterStamp('');
      resetEncounterGate();
      clearHold();
      setBattleMode(false);

      setBackdrop(TOURNEY_BACKDROP);
      setSquareBg('');
      setChars('', '');
      setNames('', '');
      hideSplash();

      const t1 = payload?.title || payload?.line1 || '';
      const t2 = payload?.sub || payload?.line2 || '';

      showSplash(t1, t2);
      setLines(payload?.line1 || t1 || '', payload?.line2 || t2 || '', payload?.line3 || 'NEXTで進行');
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handleShowAutoSessionDone(payload){
    lockUI();
    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels();
      setEventIcon('');
      showCenterStamp('');
      resetEncounterGate();
      clearHold();
      setBattleMode(false);

      setBackdrop(TOURNEY_BACKDROP);
      setSquareBg('');
      setChars('', '');
      setNames('', '');
      hideSplash();

      const t1 = payload?.title || payload?.line1 || '全試合終了！';
      const t2 = payload?.sub || payload?.line2 || '現在の総合ポイントはこちら！';

      showSplash(t1, t2);
      setLines(payload?.line1 || t1, payload?.line2 || t2, payload?.line3 || 'NEXTでRESULT表示');
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handleShowTeamList(payload){
    lockUI();
    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels(); hideSplash(); showCenterStamp(''); setEventIcon('');
      resetEncounterGate();
      clearHold();
      setBattleMode(false);

      const st = getState();
      if (!st) return;

      setBackdrop(TOURNEY_BACKDROP);
      const sq = await resolveFirstExisting([st.ui?.squareBg || ASSET.tent, ASSET.tent]);
      setSquareBg(sq || ASSET.tent);

      const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st.ui?.leftImg || 'P1.png'));
      setChars(leftResolved, '');
      setNames('', '');

      setBanners(st.bannerLeft, st.bannerRight);

      const teams = Array.isArray(payload?.teams) ? payload.teams : (Array.isArray(st.teams) ? st.teams : []);
      showPanel('参加チーム', buildTeamListTable(teams));

      setLines('✨ 本日のチームをご紹介！', '（NEXTで進行）', '');
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  // =========================================================
  // ✅ コーチスキル UI 廃止（現状使わない）
  // =========================================================
  async function handleShowCoachSelect(payload){
    lockUI();
    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels(); hideSplash(); showCenterStamp(''); setEventIcon('');
      resetEncounterGate();
      clearHold();
      setBattleMode(false);

      const st = getState();
      if (!st) return;

      setBackdrop(TOURNEY_BACKDROP);
      const sq = await resolveFirstExisting([st.ui?.squareBg || ASSET.tent, ASSET.tent]);
      setSquareBg(sq || ASSET.tent);

      const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st.ui?.leftImg || 'P1.png'));
      setChars(leftResolved, '');
      setNames('', '');

      setBanners(st.bannerLeft, st.bannerRight);

      const wrap = document.createElement('div');
      wrap.className = 'coachWrap';

      const hint = document.createElement('div');
      hint.className = 'coachHint';
      hint.textContent = 'コーチスキルは現在廃止（未使用）です。NEXTで進行します。';
      wrap.appendChild(hint);

      showPanel('コーチ', wrap);

      setLines(
        st.ui?.center3?.[0] || 'それでは試合を開始します！',
        st.ui?.center3?.[1] || '（コーチスキル無し）',
        st.ui?.center3?.[2] || 'NEXTで進行'
      );
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handleShowDropStart(){
    lockUI();
    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels(); hideSplash(); showCenterStamp(''); setEventIcon('');
      resetEncounterGate();
      clearHold();
      setBattleMode(false);

      const st = getState();
      if (!st) return;

      setBackdrop(TOURNEY_BACKDROP);
      setSquareBg(ASSET.tent);

      setBanners(st.bannerLeft, st.bannerRight);
      setNames('', '');

      const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st.ui?.leftImg || 'P1.png'));
      setChars(leftResolved, '');

      setLines(st.ui?.center3?.[0] || '🚀 バトルスタート！', st.ui?.center3?.[1] || '降下開始…！', st.ui?.center3?.[2] || 'NEXTで着地');
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handleShowDropLanded(payload){
    lockUI();
    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels(); hideSplash(); showCenterStamp(''); setEventIcon('');
      resetEncounterGate();
      clearHold();
      setBattleMode(false);

      const st = getState();
      if (!st) return;

      setBackdrop(TOURNEY_BACKDROP);

      const areaBg = String(payload?.bg || st.ui?.bg || '');
      const areaResolved = await resolveFirstExisting([areaBg]);
      if (areaResolved) setSquareBg(areaResolved);

      const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st.ui?.leftImg || 'P1.png'));
      setChars(leftResolved, '');
      setNames('', '');

      setLines(st.ui?.center3?.[0] || '', st.ui?.center3?.[1] || '', st.ui?.center3?.[2] || '');
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handleShowRoundStart(payload){
    lockUI();
    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels(); hideSplash(); showCenterStamp(''); setEventIcon('');
      resetEncounterGate();
      clearHold();
      setBattleMode(false);

      const st = getState();
      if (!st) return;

      setBackdrop(TOURNEY_BACKDROP);

      const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st.ui?.leftImg || 'P1.png'));
      setChars(leftResolved, '');
      setNames('', '');

      setBanners(st.bannerLeft, st.bannerRight);
      setLines(`⚔️ Round ${payload?.round || st.round} 開始！`, '油断するな。ここからが勝負だ。', '');
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handleShowEvent(payload){
    lockUI();
    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels(); hideSplash(); showCenterStamp('');
      resetEncounterGate();
      clearHold();
      setBattleMode(false);

      const st = getState();
      setBackdrop(TOURNEY_BACKDROP);

      const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st?.ui?.leftImg || 'P1.png'));
      setChars(leftResolved, '');
      setNames('', '');

      preloadEventIcons();
      setEventIcon(payload?.icon ? String(payload.icon) : '');

      setBanners(st?.bannerLeft || '', st?.bannerRight || '');

      if (st?.ui?.center3){
        const l1 = st.ui.center3[0] || 'イベント発生！';
        const l2 = st.ui.center3[1] || '';
        const l3 = st.ui.center3[2] || '';
        setLines(l1, l2, l3);
      }else{
        const l1 = payload?.log1 || 'イベント発生！';
        const l2 = payload?.log2 || '';
        const l3 = payload?.log3 || '';
        setLines(l1, l2, l3);
      }
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handlePrepareBattles(){
    lockUI();
    try{
      setChampionMode(false);
      setResultStampMode(false);
      setBattleMode(false);
      setBackdrop(TOURNEY_BACKDROP);
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handleShowEncounter(payload){
    lockUI();
    try{
      setChampionMode(false);
      setResultStampMode(false);

      MOD._setEncounterGatePhase(1);
      MOD._setPendingBattleReq(null);
      clearHold();

      hidePanels();
      setEventIcon('');
      showCenterStamp('');
      hideSplash();

      setBattleMode(false);

      const st = getState();
      if (!st) return;

      setBackdrop(TOURNEY_BACKDROP);
      setBanners(st.bannerLeft, st.bannerRight);

      const meName = payload?.meName || '';
      const foeName = payload?.foeName || '';
      const foeId = payload?.foeTeamId || '';

      const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st.ui?.leftImg || 'P1.png'));

      // ✅ 敵側は “空ならP1.pngに落ちない” candidates
      const rightCands = []
        .concat(guessEnemyImageCandidates(st.ui?.rightImg || ''))
        .concat(guessTeamImageCandidates(foeId));

      const rightResolved = await resolveFirstExisting(rightCands);

      setNames('', '');
      setChars(leftResolved, '');

      showSplash('⚠️ 接敵‼︎', `${foeName}チームを発見！`);
      setLines('⚠️ 接敵‼︎', `${foeName}チームを発見！`, 'NEXTで敵を表示');

      MOD._setLocalNextAction(()=>{
        lockUI();
        try{
          MOD._setEncounterGatePhase(2);

          showCenterStamp('');
          hideSplash();

          setBattleMode(true);

          setNamesRich(
            meName, payload?.meMembers,
            foeName, payload?.foeMembers
          );

          setChars(leftResolved, rightResolved);
          setLines('⚠️ 接敵‼︎', `${meName} vs ${foeName}‼︎`, 'NEXTで交戦開始');

          MOD._setLocalNextAction(()=>{
            lockUI();
            try{
              const pend = MOD._getPendingBattleReq();
              if (pend){
                MOD._setPendingBattleReq(null);
                MOD._setEncounterGatePhase(0);
                (async()=>{ await handleShowBattle(pend); })();
                return;
              }
              const flow = getFlow();
              if (!flow) return;
              MOD._setEncounterGatePhase(0);
              flow.step();
              MOD.render();
            }finally{
              unlockUI();
            }
          });
        }finally{
          unlockUI();
        }
      });

      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handleShowBattle(payload){
    lockUI();
    MOD._setBusy(true);
    MOD.setNextEnabled(false);

    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels(); hideSplash(); setEventIcon('');
      clearHold();

      const st = getState();
      if (!st) return;

      setBattleMode(true);
      setBackdrop(TOURNEY_BACKDROP);

      setResultStampMode(false);
      showCenterStamp(ASSET.brbattle);

      const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st.ui?.leftImg || 'P1.png'));

      const foeId = payload?.foeTeamId || '';

      // ✅ 敵側は “空ならP1.pngに落ちない”
      const rightCands = []
        .concat(guessEnemyImageCandidates(st.ui?.rightImg || ''))
        .concat(guessTeamImageCandidates(foeId));

      const rightResolved = await resolveFirstExisting(rightCands);

      const meName = payload?.meName || '';
      const foeName = payload?.foeName || '';

      setNamesRich(
        meName, payload?.meMembers,
        foeName, payload?.foeMembers
      );

      setChars(leftResolved, rightResolved);

      setLines('交戦開始‼︎', '一瞬で決めるぞ！', '');
      await sleep(420);

      const chats = pickChats(10);
      for (let i=0;i<chats.length;i++){
        setLines(chats[i], '', '');
        await sleep(140);
        setLines('', '', '');
        await sleep(90);
      }

      setResultStampMode(true);
      showCenterStamp(payload?.win ? ASSET.brwin : ASSET.brlose);

      if (payload?.win){
        const winLines = (payload?.final)
          ? ['チャンピオンだ―！！','みんなよくやった！！','獲ったぞー！！']
          : ['よし！次に備えるぞ！','やったー！勝ったぞ！','ナイスー！'];
        setLines('✅ 勝利！', winLines[(Math.random()*winLines.length)|0], '');
      }else{
        const loseLines = ['やられた..','次だ次！','負けちまった..'];
        setLines('❌ 敗北…', loseLines[(Math.random()*loseLines.length)|0], '');
      }

      await sleep(Number(payload?.holdMs || 2000));

      setResultStampMode(false);
      syncSessionBar();
    }finally{
      MOD._setBusy(false);
      unlockUI();
      MOD.setNextEnabled(true);
    }
  }

  async function handleShowMove(payload){
    lockUI();
    MOD._setBusy(true);
    MOD.setNextEnabled(false);

    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels(); hideSplash(); showCenterStamp(''); setEventIcon('');
      resetEncounterGate();
      clearHold();

      const st = getState();
      if (!st) return;

      setBattleMode(false);

      setBackdrop(TOURNEY_BACKDROP);
      setSquareBg(ASSET.ido);

      const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st.ui?.leftImg || 'P1.png'));
      setChars(leftResolved, '');
      setNames('', '');

      const toBg = String(payload?.toBg || '');
      const toResolved = await resolveFirstExisting([toBg]);

      setLines(payload?.log1 || '移動中…', payload?.log2 || '', payload?.log3 || '');
      await sleep(360);

      if (toResolved) setSquareBg(toResolved);

      setLines(
        payload?.arrive1 || (payload?.toAreaName ? `📍 ${String(payload.toAreaName)}に到着！` : '📍 到着！'),
        payload?.arrive2 || '周囲を警戒しろ。',
        payload?.arrive3 || ''
      );

      syncSessionBar();
    }finally{
      MOD._setBusy(false);
      unlockUI();
      MOD.setNextEnabled(true);
    }
  }

  async function handleShowChampion(payload){
    lockUI();
    try{
      setChampionMode(true);
      setResultStampMode(false);
      hidePanels(); hideSplash(); setEventIcon('');
      resetEncounterGate();
      clearHold();
      setBattleMode(false);

      setBackdrop(TOURNEY_BACKDROP);

      showCenterStamp('');
      setResultStampMode(false);

      const st = getState();

      const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st?.ui?.leftImg || 'P1.png'));

      const champTeam = findChampionTeam(st, payload);
      const champName = String(payload?.championName || champTeam?.name || payload?.line2 || '').trim();

      let champImg = '';
      if (champTeam?.id){
        const cands = []
          .concat(guessEnemyImageCandidates(champTeam?.img || ''))
          .concat(guessTeamImageCandidates(champTeam.id));
        champImg = await resolveFirstExisting(cands);
      }

      setChars(leftResolved, champImg || '');
      setNames('', champName || '');

      setLines(
        payload?.line1 || '🏆 この試合のチャンピオンは…',
        champName || '',
        payload?.line3 || '‼︎'
      );

      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  // =========================================================
  // ✅ 試合結果：ここでは “試合resultのみ” を表示（総合は分離）
  // =========================================================
  async function handleShowMatchResult(payload){
    lockUI();
    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels(); hideSplash(); showCenterStamp(''); setEventIcon('');
      resetEncounterGate();
      setHold('showMatchResult');
      setBattleMode(false);

      setBackdrop(TOURNEY_BACKDROP);
      setSquareBg(ASSET.tent);

      const srcRows = Array.isArray(payload?.rows) ? payload.rows : [];

      const wrap = document.createElement('div');
      wrap.className = 'resultWrap';

      const table = document.createElement('table');
      table.className = 'resultTable';
      table.innerHTML = `
        <thead>
          <tr>
            <th>TEAM</th>
            <th class="num">PP</th>
            <th class="num">K</th>
            <th class="num">A</th>
            <th class="num">TRE</th>
            <th class="num">FLG</th>
            <th class="num">TOTAL</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;
      const tb = table.querySelector('tbody');

      srcRows.forEach(r=>{
        const tr = document.createElement('tr');
        const isPlayer = (String(r.id||'') === 'PLAYER') || !!r.isPlayer;
        if (isPlayer) tr.classList.add('isPlayer');

        const place = Number(r.placement ?? r.Placement ?? 0);
        const name = String(r.name ?? r.squad ?? r.id ?? '');

        const PlacementP = Number(r.PlacementP ?? r.placementP ?? 0);
        const KP = Number(r.KP ?? r.kp ?? 0);
        const AP = Number(r.AP ?? r.ap ?? 0);
        const Treasure = Number(r.Treasure ?? r.treasure ?? 0);
        const Flag = Number(r.Flag ?? r.flag ?? 0);
        const Total = Number(r.Total ?? r.total ?? 0);

        const teamLabel = `${place ? `#${place} ` : ''}${name}`;

        tr.innerHTML = `
          <td>${escapeHtml(teamLabel)}</td>
          <td class="num">${escapeHtml(String(PlacementP))}</td>
          <td class="num">${escapeHtml(String(KP))}</td>
          <td class="num">${escapeHtml(String(AP))}</td>
          <td class="num">${escapeHtml(String(Treasure))}</td>
          <td class="num">${escapeHtml(String(Flag))}</td>
          <td class="num">${escapeHtml(String(Total))}</td>
        `;
        tb.appendChild(tr);
      });

      wrap.appendChild(table);

      showPanel(`MATCH ${payload?.matchIndex || ''} RESULT`, wrap);

      // ✅ ここでは総合を見せない（分離）
      setLines('📊 試合結果', 'NEXTで総合RESULTへ', '');
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  // =========================================================
  // ✅ 総合結果：通過ライン色分け / WORLD FINAL 点灯色分け
  // =========================================================
  async function handleShowTournamentResult(payload){
    lockUI();
    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels(); hideSplash(); showCenterStamp(''); setEventIcon('');
      resetEncounterGate();
      setHold('showTournamentResult');
      setBattleMode(false);

      setBackdrop(TOURNEY_BACKDROP);
      setSquareBg(ASSET.tent);

      const st = getState() || {};
      const total = payload?.total || {};
      const arr = Object.values(total);

      arr.sort((a,b)=>{
        const pa = Number(a.sumTotal ?? a.total ?? 0);
        const pb = Number(b.sumTotal ?? b.total ?? 0);
        if (pb !== pa) return pb - pa;

        const ka = Number(a.sumKP ?? a.KP ?? a.kp ?? 0);
        const kb = Number(b.sumKP ?? b.KP ?? b.kp ?? 0);
        if (kb !== ka) return kb - ka;

        const ppa = Number(a.sumPlacementP ?? a.PP ?? a.placementP ?? 0);
        const ppb = Number(b.sumPlacementP ?? b.PP ?? b.placementP ?? 0);
        if (ppb !== ppa) return ppb - ppa;

        return String(a.name || a.squad || a.id || '').localeCompare(String(b.name || b.squad || b.id || ''));
      });

      const q = getQualLineByState(st);
      const litSet = getWorldFinalLitSet(st);
      const isWorldFinal = (String(st.mode||'').toLowerCase()==='world' && String(st.worldPhase||st.phase||'').toLowerCase()==='final');

      const wrap = document.createElement('div');
      wrap.className = 'tourneyWrap';

      const hint = document.createElement('div');
      hint.className = 'coachHint';

      if (isWorldFinal){
        const mp = Number(st?.worldFinalMP?.matchPoint ?? 80);
        hint.textContent = `WORLD FINAL：${mp}pt点灯チーム（次試合以降のチャンピオンで優勝）`;
      }else if (q.line > 0){
        hint.textContent = `通過ライン：${q.label}`;
      }else{
        hint.textContent = '総合ポイント';
      }
      wrap.appendChild(hint);

      const table = document.createElement('table');
      table.className = 'tourneyTable';
      table.innerHTML = `
        <thead>
          <tr>
            <th>TEAM</th>
            <th class="num">PT</th>
            <th class="num">PP</th>
            <th class="num">K</th>
            <th class="num">A</th>
            <th class="num">TRE</th>
            <th class="num">FLG</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;
      const tb = table.querySelector('tbody');

      arr.forEach((r,i)=>{
        const rank = i + 1;

        const tr = document.createElement('tr');
        const id = String(r.id ?? '');
        const isPlayer = (id === 'PLAYER') || !!r.isPlayer;
        if (isPlayer) tr.classList.add('isPlayer');

        const teamName = String(r.name ?? r.squad ?? r.id ?? '');
        let teamLabel = `#${rank} ${teamName}`;

        // FINAL 点灯マーク
        const lit = isWorldFinal && litSet.has(id);
        if (lit){
          teamLabel = `🟡 ${teamLabel}`; // 点灯チーム
        }

        const PT = Number(r.sumTotal ?? r.total ?? 0);
        const PP = Number(r.sumPlacementP ?? r.PP ?? r.placementP ?? 0);
        const K  = Number(r.sumKP ?? r.KP ?? r.kp ?? 0);
        const A  = Number(r.sumAP ?? r.AP ?? r.ap ?? 0);
        const TRE = Number(r.sumTreasure ?? r.Treasure ?? r.treasure ?? 0);
        const FLG = Number(r.sumFlag ?? r.Flag ?? r.flag ?? 0);

        tr.innerHTML = `
          <td>${escapeHtml(teamLabel)}</td>
          <td class="num">${escapeHtml(String(PT))}</td>
          <td class="num">${escapeHtml(String(PP))}</td>
          <td class="num">${escapeHtml(String(K))}</td>
          <td class="num">${escapeHtml(String(A))}</td>
          <td class="num">${escapeHtml(String(TRE))}</td>
          <td class="num">${escapeHtml(String(FLG))}</td>
        `;

        // 通過ライン色分け（FINALは点灯色分け優先）
        const qualified = (!isWorldFinal && q.line > 0 && rank <= q.line);
        const cut = (!isWorldFinal && q.line > 0 && rank > q.line);

        applyRowHighlight(tr, { qualified, cut, lit });

        tb.appendChild(tr);
      });

      wrap.appendChild(table);
      showPanel('TOURNAMENT RESULT', wrap);

      setLines('🏁 総合RESULT', '（NEXTで進行）', '');
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handleShowNationalNotice(payload){
    lockUI();
    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels(); setEventIcon('');
      resetEncounterGate();
      clearHold();
      setBattleMode(false);

      setBackdrop(TOURNEY_BACKDROP);
      setSquareBg('');

      setChars('', '');
      setNames('', '');
      showCenterStamp('');
      showSplash(payload?.line1 || '', payload?.line2 || '');

      setLines(payload?.line1 || '', payload?.line2 || '', payload?.line3 || 'NEXTで進行');
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handleEndTournament(){
    lockUI();
    try{
      MOD.close();
    }finally{
      unlockUI();
    }
  }

  async function handleEndNationalWeek(payload){
    lockUI();
    try{
      MOD.close();
    }finally{
      unlockUI();
    }

    try{
      const weeks = Number(payload?.weeks ?? 1) || 1;

      if (window.MOBBR?.ui?.main?.advanceWeeks && typeof window.MOBBR.ui.main.advanceWeeks === 'function'){
        window.MOBBR.ui.main.advanceWeeks(weeks);
        return;
      }
      if (window.MOBBR?.advanceWeeks && typeof window.MOBBR.advanceWeeks === 'function'){
        window.MOBBR.advanceWeeks(weeks);
        return;
      }

      window.dispatchEvent(new CustomEvent('mobbr:endNationalWeek', { detail:{ weeks } }));
    }catch(e){
      console.error('[ui_tournament] endNationalWeek notify error:', e);
    }
  }

  async function handleNextMatch(payload){
    lockUI();
    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels(); hideSplash(); showCenterStamp(''); setEventIcon('');
      resetEncounterGate();
      clearHold();
      setBattleMode(false);

      setBackdrop(TOURNEY_BACKDROP);
      setSquareBg(ASSET.tent);

      const st = getState() || {};
      const total = getMatchTotalFromState(st);
      const mi = Number(payload?.matchIndex ?? st.matchIndex ?? st.match ?? 0) || 0;

      setLines('➡️ 次の試合へ', `MATCH ${mi} / ${total}`, 'NEXTで進行');
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  Object.assign(MOD, {
    handleShowArrival,
    handleShowIntroText,
    handleShowAutoSession,
    handleShowAutoSessionDone,
    handleShowTeamList,
    handleShowCoachSelect,
    handleShowDropStart,
    handleShowDropLanded,
    handleShowRoundStart,
    handleShowEvent,
    handlePrepareBattles,
    handleShowEncounter,
    handleShowBattle,
    handleShowMove,
    handleShowChampion,
    handleShowMatchResult,
    handleShowTournamentResult,
    handleShowNationalNotice,
    handleEndTournament,
    handleEndNationalWeek,
    handleNextMatch
  });

})();

// ✅ splitロード検知（app.js の [CHECK] ui_tournament split 用）
window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};
window.MOBBR.ui._tournamentHandlers = true;
