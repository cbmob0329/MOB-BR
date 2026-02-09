/* =========================================================
   MOB BR - sim_tournament_local.js (FULL / FIXED)
   ---------------------------------------------------------
   修正内容（今回の目的）：
   ✅ 試合前コーチスキルを「使う / 使わない」で選べる
   ✅ 消耗品：使ったら mobbr_coachSkillsOwned から減る（0なら削除）
   ✅ 使えるコーチスキルが無い場合：
      「コーチスキルはもう使い切っている！選手を信じよう！」
   ✅ カードコレクション効果（%）を “試合シム” に反映（簡易）
   ---------------------------------------------------------
   役割：
   ・ローカル大会（20チーム / 5試合）の“大会進行データ”を管理
   ・1試合ごとに result（20チーム）を生成
   ・試合後に「現在(1/5)の総合順位」を更新（20チーム）
   ・戦闘ロジックは持たない（ここでは簡易シムで result を作るだけ）
   ---------------------------------------------------------
   依存（あれば使う / 無くても動く）：
   ・window.MOBBR.data.tournament（data_tournament.js）
   ・window.MOBBR.ui.matchResult（ui_match_result.js）
   ・window.DataCPU（data_cpu_teams.js）
   ・window.DataPlayer（任意：プレイヤーチーム取得用）
   ・window.MOBBR.data.cards（任意：カード%計算）
========================================================= */

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){
  'use strict';

  const Local = {};
  window.MOBBR.sim.tournamentLocal = Local;

  // ---------------------------------------------------------
  // CONFIG / KEYS
  // ---------------------------------------------------------
  const LS_KEY = 'mobbr_tournament_local_state_v2';

  // 画像フォルダ（ユーザー構成）
  const CPU_IMG_BASE = 'cpu/';

  // Coach skill storage keys（ui_team.js と合わせる）
  const COACH_OWNED_KEY = 'mobbr_coachSkillsOwned';     // { id: count }
  const COACH_EQUIP_KEY = 'mobbr_coachSkillsEquipped';  // [id|null, id|null, id|null]

  // Coach skills master（ui_team.js と同一ID前提）
  const COACH_SKILLS = [
    { id:'tactics_note',   name:'戦術ノート',       powerPct: 1,  treasureRate:0,   flagRate:0,   note:'基本を徹底。丁寧に戦おう！' },
    { id:'mental_care',    name:'メンタル整備',     powerPct: 0,  treasureRate:0,   flagRate:0,   note:'全員で勝つぞ！' },
    { id:'endgame_power',  name:'終盤の底力',       powerPct: 3,  treasureRate:0,   flagRate:0,   note:'終盤一気に押すぞ！' },
    { id:'clearing',       name:'クリアリング徹底', powerPct: 0,  treasureRate:0,   flagRate:0,   note:'周辺をしっかり見ろ！' },
    { id:'score_mind',     name:'スコア意識',       powerPct: 0,  treasureRate:0.06,flagRate:0.03,note:'この試合はポイント勝負だ！' },
    { id:'igl_call',       name:'IGL強化コール',    powerPct: 4,  treasureRate:0,   flagRate:0,   note:'コールを信じろ！チャンピオン取るぞ！' },
    { id:'protagonist',    name:'主人公ムーブ',     powerPct: 6,  treasureRate:0,   flagRate:0,   note:'チームの力を信じろ！' }
  ];
  const COACH_BY_ID = Object.fromEntries(COACH_SKILLS.map(s => [s.id, s]));

  // ---------------------------------------------------------
  // PUBLIC API
  // ---------------------------------------------------------

  /**
   * ローカル大会セッション作成（20チーム / 5試合）
   * @param {object} opt
   *  - seed (number) : 乱数シード（任意）
   *  - teams (array) : 20チームを外部から渡す（任意）
   *  - keepStorage (boolean) : 既存保存を優先して復帰（任意 / true推奨）
   */
  Local.create = function(opt){
    const o = opt || {};
    if (o.keepStorage !== false){
      const saved = readState();
      if (saved && saved.kind === 'local' && saved.matchIndex < saved.matchTotal){
        // 旧版からの移行（念のため）
        saved.version = 2;
        if (!saved.step) saved.step = 'idle';
        if (!saved.pending) saved.pending = null;
        writeState(saved);
        return saved;
      }
    }

    const matchTotal = 5;
    const teams = normalizeTeams(o.teams || buildDefaultTeams20());

    const state = {
      kind: 'local',
      version: 2,
      seed: Number.isFinite(Number(o.seed)) ? Number(o.seed) : Math.floor(Math.random()*1e9),
      rngI: 0,

      matchIndex: 0,
      matchTotal,

      teams: teams.map(t => ({
        isPlayer: !!t.isPlayer,
        teamId: String(t.teamId),
        name: String(t.name),
        image: String(t.image || (t.teamId ? (CPU_IMG_BASE + t.teamId + '.png') : '')),
      })),

      // 累積（総合順位用）
      agg: initAgg(teams),

      // 進行ステップ（NEXTで2段階にする）
      // idle -> (preCoach) -> idle -> ...（試合生成）
      step: 'idle',

      // コーチ選択の保留情報
      pending: null,

      // 最後に生成した表示用データ
      last: null
    };

    writeState(state);
    return state;
  };

  /**
   * 次の試合を進める（NEXTの都度呼ばれる想定）
   * - 1回目NEXT：コーチスキル選択（使える場合）
   * - 2回目NEXT：試合結果生成 & UI表示
   *
   * @param {object} state Local.create の戻り
   * @param {object} opt
   *  - openUI (boolean) : result UI を開く（既定 true）
   *  - title/subtitle : UI文言
   * @returns {object} updated state
   */
  Local.playNextMatch = function(state, opt){
    const st = state || readState();
    if (!st || st.kind !== 'local') return null;

    if (st.matchIndex >= st.matchTotal){
      return st; // 既に終了
    }

    const o = opt || {};
    const matchNo = st.matchIndex + 1;

    // 1) 試合前：コーチスキル選択ステップ
    if (st.step !== 'preCoachDone'){
      const didOpen = openCoachSelectionIfNeeded(st, matchNo);
      writeState(st);

      // 選択UIを開いた場合：ここで止める（次のNEXTで試合実行）
      if (didOpen){
        return st;
      }
      // 選択不要（or 使い切り）：このまま試合実行へ
      st.step = 'preCoachDone';
    }

    // 2) 試合実行（簡易シム）
    const ctx = buildMatchContextFromPending(st);
    const matchRows = simulateOneMatch(st, ctx);

    // 累積更新（総合順位）
    applyAgg(st, matchRows);

    // 総合順位（20チーム）
    const overallRows = buildOverallRows(st);

    // 表示用まとめ
    const championRow = matchRows[0] || null;
    const championName = championRow ? championRow.name : '';

    st.matchIndex = matchNo;
    st.last = {
      matchNo,
      matchRows,
      overallRows,
      championName,
      matchContext: ctx
    };

    // 次試合に向けて進行ステップを戻す
    st.step = 'idle';
    st.pending = null;

    writeState(st);

    // UI表示（このファイルだけでも動くように“あれば”開く）
    if (o.openUI !== false){
      const ui = window.MOBBR?.ui?.matchResult;
      if (ui && typeof ui.open === 'function'){
        ui.open({
          title: String(o.title || 'RESULT'),
          subtitle: String(o.subtitle || `ローカル大会 第${matchNo}試合`),
          matchIndex: matchNo,
          matchTotal: st.matchTotal,
          rows: matchRows,
          championName
        });
      }
    }

    return st;
  };

  /**
   * 総合順位を UI で出したい場合（20チーム）
   */
  Local.openOverallUI = function(state, opt){
    const st = state || readState();
    if (!st || st.kind !== 'local') return;

    const o = opt || {};
    const ui = window.MOBBR?.ui?.matchResult;
    if (!ui || typeof ui.open !== 'function') return;

    const overallRows = buildOverallRows(st);

    ui.open({
      title: String(o.title || 'OVERALL'),
      subtitle: String(o.subtitle || `ローカル大会 総合順位（${st.matchIndex}/${st.matchTotal}）`),
      matchIndex: st.matchIndex,
      matchTotal: st.matchTotal,
      rows: overallRows,
      championName: overallRows[0]?.name || ''
    });
  };

  /**
   * 大会終了判定
   */
  Local.isFinished = function(state){
    const st = state || readState();
    return !!(st && st.kind === 'local' && st.matchIndex >= st.matchTotal);
  };

  /**
   * 終了時の総合順位（20チーム）を返す
   */
  Local.getFinalOverall = function(state){
    const st = state || readState();
    if (!st || st.kind !== 'local') return null;
    return buildOverallRows(st);
  };

  /**
   * リセット（保存も消す）
   */
  Local.reset = function(){
    try{ localStorage.removeItem(LS_KEY); }catch{}
  };

  // ---------------------------------------------------------
  // PRE-MATCH: Coach skill selection
  // ---------------------------------------------------------

  function openCoachSelectionIfNeeded(st, matchNo){
    // すでに選択UI中なら何もしない（次NEXT待ち）
    if (st.step === 'awaitCoach'){
      return true;
    }

    // 装備枠を取得
    const equipped = readCoachEquipped();
    const owned = readCoachOwned();

    // 装備が空なら選択不要
    const usableIds = equipped.filter(id => id && (Number(owned[id]) || 0) > 0);
    if (usableIds.length === 0){
      // ただし装備はあるが所持が無い（使い切り）ならメッセージ
      const hadEquippedAny = equipped.some(Boolean);
      if (hadEquippedAny){
        showMessage('コーチスキルはもう使い切っている！選手を信じよう！');
      }
      // pending は「使わない」と同等
      st.pending = { matchNo, selectedId: null, used: false };
      st.step = 'preCoachDone';
      return false;
    }

    // ここで選択UIを出す
    st.pending = { matchNo, selectedId: null, used: false };
    st.step = 'awaitCoach';

    openCoachModal({
      title: `第${matchNo}試合：コーチスキル`,
      list: usableIds.map(id => COACH_BY_ID[id]).filter(Boolean),
      onUse: (id)=>{
        // 所持を減らす（消耗）
        consumeCoachOwned(id);
        st.pending = { matchNo, selectedId: id, used: true };
        st.step = 'preCoachDone';
        writeState(st);
        closeCoachModal();
        showMessage(`コーチスキル使用：${COACH_BY_ID[id]?.name || id}`);
      },
      onSkip: ()=>{
        st.pending = { matchNo, selectedId: null, used: false };
        st.step = 'preCoachDone';
        writeState(st);
        closeCoachModal();
        showMessage('コーチスキル：使わない');
      }
    });

    return true;
  }

  function buildMatchContextFromPending(st){
    const cardBonusPct = calcCollectionBonusPercent(); // 例: 0.27
    const selectedId = st?.pending?.selectedId || null;

    const skill = selectedId ? COACH_BY_ID[selectedId] : null;

    return {
      cardBonusPct,
      coach: skill ? {
        id: skill.id,
        name: skill.name,
        powerPct: Number(skill.powerPct) || 0,
        treasureRate: Number(skill.treasureRate) || 0,
        flagRate: Number(skill.flagRate) || 0,
        note: skill.note || ''
      } : null
    };
  }

  // ---------------------------------------------------------
  // SIMPLE MODAL (no confirm)
  // ---------------------------------------------------------
  let _coachModal = null;

  function openCoachModal(opt){
    const o = opt || {};
    if (!_coachModal){
      _coachModal = buildCoachModal();
      document.body.appendChild(_coachModal.back);
    }

    _coachModal.title.textContent = String(o.title || 'コーチスキル');
    _coachModal.list.innerHTML = '';

    const list = Array.isArray(o.list) ? o.list : [];
    list.forEach(skill=>{
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'mobbrCoachItem';
      btn.innerHTML = `
        <div class="mobbrCoachItemTop">
          <div class="mobbrCoachItemName">${escapeHtml(skill.name)}</div>
          <div class="mobbrCoachItemHint">タップで使用</div>
        </div>
        <div class="mobbrCoachItemDesc">${escapeHtml(buildCoachEffectText(skill))}</div>
        <div class="mobbrCoachItemLine">コーチ：「${escapeHtml(skill.note || '')}」</div>
      `;
      btn.addEventListener('click', ()=>{
        if (typeof o.onUse === 'function') o.onUse(skill.id);
      });
      _coachModal.list.appendChild(btn);
    });

    _coachModal.btnSkip.onclick = ()=>{
      if (typeof o.onSkip === 'function') o.onSkip();
    };

    _coachModal.back.style.display = 'flex';
    _coachModal.back.setAttribute('aria-hidden', 'false');
  }

  function closeCoachModal(){
    if (!_coachModal) return;
    _coachModal.back.style.display = 'none';
    _coachModal.back.setAttribute('aria-hidden', 'true');
  }

  function buildCoachEffectText(skill){
    const p = Number(skill.powerPct)||0;
    const t = Number(skill.treasureRate)||0;
    const f = Number(skill.flagRate)||0;

    const parts = [];
    if (p) parts.push(`この試合、総合戦闘力 +${p}%`);
    if (t) parts.push(`この試合、お宝率 +${Math.round(t*100)}%`);
    if (f) parts.push(`この試合、旗率 +${Math.round(f*100)}%`);
    if (parts.length === 0) parts.push('この試合、安定感が増す（演出）');
    return parts.join(' / ');
  }

  function buildCoachModal(){
    injectCoachModalStyleOnce();

    const back = document.createElement('div');
    back.className = 'mobbrCoachBack';
    back.setAttribute('aria-hidden','true');
    back.style.display = 'none';

    const card = document.createElement('div');
    card.className = 'mobbrCoachCard';

    const head = document.createElement('div');
    head.className = 'mobbrCoachHead';

    const title = document.createElement('div');
    title.className = 'mobbrCoachTitle';
    title.textContent = 'コーチスキル';

    const sub = document.createElement('div');
    sub.className = 'mobbrCoachSub';
    sub.textContent = '使うスキルを1つ選ぶ（消耗品） / 「使わない」もOK';

    const btnSkip = document.createElement('button');
    btnSkip.type = 'button';
    btnSkip.className = 'mobbrCoachSkip';
    btnSkip.textContent = '使わない';

    head.appendChild(title);
    head.appendChild(sub);
    head.appendChild(btnSkip);

    const list = document.createElement('div');
    list.className = 'mobbrCoachList';

    card.appendChild(head);
    card.appendChild(list);
    back.appendChild(card);

    // 背景タップで閉じない（誤操作防止）
    back.addEventListener('click', (e)=>{
      e.preventDefault();
    });
    card.addEventListener('click', (e)=>e.stopPropagation());

    return { back, title, list, btnSkip };
  }

  function injectCoachModalStyleOnce(){
    if (document.getElementById('mobbrCoachModalStyle')) return;
    const st = document.createElement('style');
    st.id = 'mobbrCoachModalStyle';
    st.textContent = `
      .mobbrCoachBack{
        position: fixed; inset: 0;
        background: rgba(0,0,0,.58);
        z-index: 99998;
        padding: 10px;
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        overscroll-behavior: contain;
      }
      .mobbrCoachCard{
        width: min(560px, 96vw);
        max-height: min(86vh, 860px);
        background: rgba(15,18,24,.96);
        border: 1px solid rgba(255,255,255,.12);
        border-radius: 16px;
        overflow: hidden;
        box-shadow: 0 18px 50px rgba(0,0,0,.55);
        display: flex;
        flex-direction: column;
      }
      .mobbrCoachHead{
        padding: 12px 12px 10px;
        border-bottom: 1px solid rgba(255,255,255,.10);
        position: relative;
      }
      .mobbrCoachTitle{
        font-weight: 900;
        letter-spacing: .04em;
        font-size: 14px;
        color: #fff;
      }
      .mobbrCoachSub{
        margin-top: 6px;
        font-size: 12px;
        color: rgba(255,255,255,.86);
        line-height: 1.25;
      }
      .mobbrCoachSkip{
        position: absolute;
        right: 10px;
        top: 10px;
        padding: 8px 10px;
        font-size: 12px;
        border-radius: 10px;
        border: 1px solid rgba(255,255,255,.18);
        background: rgba(255,255,255,.06);
        color: #fff;
      }
      .mobbrCoachList{
        padding: 10px 10px 12px;
        overflow: auto;
        -webkit-overflow-scrolling: touch;
        display: flex;
        flex-direction: column;
        gap: 10px;
      }
      .mobbrCoachItem{
        width: 100%;
        text-align: left;
        border-radius: 12px;
        border: 1px solid rgba(255,255,255,.10);
        background: rgba(255,255,255,.04);
        padding: 10px 10px;
        color: #fff;
      }
      .mobbrCoachItemTop{
        display: flex;
        justify-content: space-between;
        gap: 10px;
        align-items: baseline;
      }
      .mobbrCoachItemName{
        font-weight: 1000;
        font-size: 13px;
      }
      .mobbrCoachItemHint{
        font-size: 11px;
        opacity: .85;
      }
      .mobbrCoachItemDesc{
        margin-top: 6px;
        font-size: 12px;
        opacity: .92;
        line-height: 1.25;
      }
      .mobbrCoachItemLine{
        margin-top: 6px;
        font-size: 12px;
        opacity: .92;
        line-height: 1.25;
      }
    `;
    document.head.appendChild(st);
  }

  function escapeHtml(s){
    return String(s ?? '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }

  function showMessage(text){
    const t = String(text || '');
    const ui = window.MOBBR?.ui;
    if (ui && typeof ui.showMessage === 'function'){
      ui.showMessage(t);
      return;
    }
    console.log('[LOCAL]', t);
  }

  // ---------------------------------------------------------
  // CARD BONUS (optional)
  // ---------------------------------------------------------
  function getOwnedCardsMap(){
    try{
      return JSON.parse(localStorage.getItem('mobbr_cards')) || {};
    }catch{
      return {};
    }
  }

  function calcCollectionBonusPercent(){
    const DC = window.MOBBR?.data?.cards;
    if (!DC || typeof DC.getById !== 'function' || typeof DC.calcSingleCardPercent !== 'function'){
      return 0;
    }

    const owned = getOwnedCardsMap();
    let sum = 0;

    for (const id in owned){
      const cnt = Number(owned[id]) || 0;
      if (cnt <= 0) continue;

      const card = DC.getById(id);
      if (!card) continue;

      const effCnt = Math.max(0, Math.min(10, cnt));
      sum += DC.calcSingleCardPercent(card.rarity, effCnt);
    }

    if (!Number.isFinite(sum)) return 0;
    return Math.max(0, sum);
  }

  // ---------------------------------------------------------
  // COACH STORAGE
  // ---------------------------------------------------------
  function readCoachOwned(){
    try{
      const obj = JSON.parse(localStorage.getItem(COACH_OWNED_KEY) || '{}');
      return (obj && typeof obj === 'object') ? obj : {};
    }catch{
      return {};
    }
  }

  function readCoachEquipped(){
    try{
      const arr = JSON.parse(localStorage.getItem(COACH_EQUIP_KEY) || '[]');
      if (Array.isArray(arr)){
        const out = [arr[0] ?? null, arr[1] ?? null, arr[2] ?? null].slice(0,3);
        return out.map(v => (typeof v === 'string' && v.trim()) ? v : null);
      }
      return [null,null,null];
    }catch{
      return [null,null,null];
    }
  }

  function consumeCoachOwned(id){
    if (!id) return;
    const owned = readCoachOwned();
    const cur = Number(owned[id]) || 0;
    if (cur <= 0) return;

    const next = cur - 1;
    if (next <= 0){
      delete owned[id];
    }else{
      owned[id] = next;
    }
    try{
      localStorage.setItem(COACH_OWNED_KEY, JSON.stringify(owned));
    }catch{}
  }

  // ---------------------------------------------------------
  // CORE: One match simulation (簡易 + buff反映)
  // ---------------------------------------------------------
  function simulateOneMatch(st, ctx){
    const teams = st.teams.slice();

    // player buff（カード% + コーチ%）を 0..?? として扱う
    const playerPowerPct = (ctx?.cardBonusPct || 0) + (ctx?.coach?.powerPct || 0);
    const addTreasureRate = (ctx?.coach?.treasureRate || 0);
    const addFlagRate = (ctx?.coach?.flagRate || 0);

    // place 1..20 を「強いほど上がりやすい」簡易抽選にする
    const order = weightedOrderWithSeed(teams, st, (t)=>{
      if (!t.isPlayer) return 1;
      // プレイヤーだけ補正（カード/コーチが反映されているかを見える形にする）
      return 1 + Math.max(0, playerPowerPct) * 0.08; // 例: +5% -> +0.4
    });

    const placeById = {};
    for (let i=0;i<order.length;i++){
      placeById[order[i].teamId] = i + 1;
    }

    // 1試合の各チームスコア（簡易）
    const rows = teams.map(t=>{
      const place = placeById[t.teamId] || 20;

      // KP/AP：上位ほど出やすい + playerPowerPct で少し底上げ
      const powBoost = t.isPlayer ? Math.max(0, playerPowerPct) : 0;
      const kpBase = place <= 3 ? 3 : place <= 10 ? 2 : 1;
      const kpMax = Math.max(0, kpBase + 3 + Math.floor(powBoost * 0.12)); // 緩く反映
      const kp = randInt(st, 0, kpMax);

      const apMax = Math.max(0, kp + 3 + Math.floor(powBoost * 0.10));
      const ap = randInt(st, 0, apMax);

      // お宝/旗：score_mind 等の影響をプレイヤーに付与
      const treasureBase = 0.18;
      const flagBase = 0.08;

      const treRate = t.isPlayer ? (treasureBase + addTreasureRate) : treasureBase;
      const flgRate = t.isPlayer ? (flagBase + addFlagRate) : flagBase;

      const treasure = (rand01(st) < treRate) ? 1 : 0;
      const flag = (rand01(st) < flgRate) ? 1 : 0;

      const placementP = getPlacementPoint(place);
      const total = placementP + kp + ap + treasure + flag*2;

      return {
        place,
        teamId: t.teamId,
        name: t.name,
        image: t.image || (CPU_IMG_BASE + t.teamId + '.png'),
        placementP,
        kp,
        ap,
        treasure,
        flag,
        total
      };
    });

    // place昇順
    rows.sort((a,b)=>a.place-b.place);
    return rows;
  }

  // ---------------------------------------------------------
  // AGGREGATION
  // ---------------------------------------------------------
  function initAgg(teams){
    const agg = {};
    for (const t of teams){
      agg[t.teamId] = {
        teamId: t.teamId,
        name: t.name,
        image: t.image || (CPU_IMG_BASE + t.teamId + '.png'),

        matches: 0,
        sumPlace: 0,

        totalPts: 0,
        totalKP: 0,
        totalAP: 0,
        totalTreasure: 0,
        totalFlag: 0
      };
    }
    return agg;
  }

  function applyAgg(st, matchRows){
    for (const r of matchRows){
      const a = st.agg[r.teamId];
      if (!a) continue;

      a.matches += 1;
      a.sumPlace += (Number(r.place)||20);

      a.totalPts += (Number(r.total)||0);
      a.totalKP += (Number(r.kp)||0);
      a.totalAP += (Number(r.ap)||0);
      a.totalTreasure += (Number(r.treasure)||0);
      a.totalFlag += (Number(r.flag)||0);
    }
  }

  function buildOverallRows(st){
    const list = Object.values(st.agg || {});
    const rows = list.map(a=>{
      const avgPlace = a.matches ? (a.sumPlace / a.matches) : 99;
      return {
        teamId: a.teamId,
        name: a.name,
        image: a.image,

        place: 0,
        placementP: 0,
        kp: a.totalKP,
        ap: a.totalAP,
        treasure: a.totalTreasure,
        flag: a.totalFlag,
        total: a.totalPts,

        _avgPlace: avgPlace
      };
    });

    rows.sort((x,y)=>{
      if (y.total !== x.total) return y.total - x.total;
      if (y.kp !== x.kp) return y.kp - x.kp;
      if (x._avgPlace !== y._avgPlace) return x._avgPlace - y._avgPlace;
      if (y.ap !== x.ap) return y.ap - x.ap;
      return (rand01(st) < 0.5) ? -1 : 1;
    });

    for (let i=0;i<rows.length;i++){
      rows[i].place = i + 1;
    }
    rows.forEach(r=>{ delete r._avgPlace; });

    return rows;
  }

  // ---------------------------------------------------------
  // TEAMS: build default 20 (player + 19 local CPU)
  // ---------------------------------------------------------
  function buildDefaultTeams20(){
    const out = [];

    const player = getPlayerTeamOrNull();
    if (player) out.push(player);

    const cpuLocals = getLocalCpuTeams();
    const need = 20 - out.length;

    const picked = pickUnique(cpuLocals, need);
    out.push(...picked);

    while (out.length < 20){
      out.push({
        isPlayer: false,
        teamId: 'cpu_dummy_' + out.length,
        name: 'CPU',
        image: ''
      });
    }

    return out.slice(0,20);
  }

  function getPlayerTeamOrNull(){
    const DP = window.DataPlayer || window.MOBBR?.data?.player || null;
    if (DP){
      if (typeof DP.getTeam === 'function'){
        const t = DP.getTeam();
        if (t && t.teamId) return normalizeTeam(t, true);
      }
      if (typeof DP.getPlayerTeam === 'function'){
        const t = DP.getPlayerTeam();
        if (t && t.teamId) return normalizeTeam(t, true);
      }
      if (DP.team && DP.team.teamId){
        return normalizeTeam(DP.team, true);
      }
    }

    return {
      isPlayer: true,
      teamId: 'player',
      name: 'プレイヤーチーム',
      image: ''
    };
  }

  function getLocalCpuTeams(){
    const DC = window.DataCPU || null;
    let all = [];
    if (DC && typeof DC.getAllTeams === 'function'){
      all = DC.getAllTeams() || [];
    }
    const locals = all.filter(t => String(t.teamId||'').startsWith('local'));
    return locals.map(t=>normalizeTeam(t,false));
  }

  function normalizeTeams(arr){
    const list = Array.isArray(arr) ? arr : [];
    const out = [];
    const seen = new Set();
    for (const t of list){
      const nt = normalizeTeam(t, !!t.isPlayer);
      if (!nt || !nt.teamId) continue;
      if (seen.has(nt.teamId)) continue;
      seen.add(nt.teamId);
      out.push(nt);
      if (out.length >= 20) break;
    }
    while (out.length < 20){
      out.push({
        isPlayer: false,
        teamId: 'cpu_dummy_' + out.length,
        name: 'CPU',
        image: ''
      });
    }
    return out.slice(0,20);
  }

  function normalizeTeam(t, forcePlayer){
    if (!t) return null;
    const teamId = String(t.teamId || t.id || t.key || '');
    if (!teamId) return null;
    const name = String(t.name || t.teamName || teamId);
    let image = String(t.image || t.img || '');
    if (image.startsWith('assets/')) image = 'cpu/' + image.slice('assets/'.length);
    if (!image && !forcePlayer) image = CPU_IMG_BASE + teamId + '.png';

    return {
      isPlayer: !!forcePlayer || !!t.isPlayer,
      teamId,
      name,
      image
    };
  }

  function pickUnique(arr, n){
    const a = (arr || []).slice();
    for (let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      const tmp=a[i]; a[i]=a[j]; a[j]=tmp;
    }
    return a.slice(0, Math.max(0,n));
  }

  // ---------------------------------------------------------
  // POINT TABLE（ユーザー確定）
  // ---------------------------------------------------------
  function getPlacementPoint(place){
    const p = Number(place)||20;
    if (p === 1) return 12;
    if (p === 2) return 8;
    if (p === 3) return 6;
    if (p === 4) return 5;
    if (p === 5) return 4;
    if (p === 6) return 3;
    if (p === 7) return 2;
    if (p >= 8 && p <= 10) return 1;
    return 0;
  }

  // ---------------------------------------------------------
  // RNG (seeded) — 再現性のため state.seed を使う
  // ---------------------------------------------------------
  function rand01(st){
    let x = (st.seed >>> 0) ^ ((st.rngI + 1) * 0x9e3779b9);
    x ^= x << 13; x >>>= 0;
    x ^= x >> 17; x >>>= 0;
    x ^= x << 5;  x >>>= 0;
    st.rngI = (st.rngI + 1) >>> 0;
    return (x >>> 0) / 4294967296;
  }

  function randInt(st, min, max){
    const a = Number(min)||0;
    const b = Number(max)||0;
    if (b <= a) return a;
    return a + Math.floor(rand01(st) * (b - a + 1));
  }

  // 「強いほど前に来やすい」重み付き順序
  function weightedOrderWithSeed(teams, st, weightFn){
    const pool = (teams || []).slice();
    const out = [];

    while (pool.length){
      // 合計重み
      let sum = 0;
      const w = pool.map(t=>{
        const ww = Math.max(0.0001, Number(weightFn ? weightFn(t) : 1) || 1);
        sum += ww;
        return ww;
      });

      // ルーレット選択
      let r = rand01(st) * sum;
      let idx = 0;
      for (; idx < pool.length; idx++){
        r -= w[idx];
        if (r <= 0) break;
      }
      if (idx >= pool.length) idx = pool.length - 1;

      out.push(pool[idx]);
      pool.splice(idx, 1);
    }
    return out;
  }

  // ---------------------------------------------------------
  // STORAGE
  // ---------------------------------------------------------
  function readState(){
    try{
      const raw = localStorage.getItem(LS_KEY);
      return raw ? JSON.parse(raw) : null;
    }catch{
      return null;
    }
  }

  function writeState(st){
    try{
      localStorage.setItem(LS_KEY, JSON.stringify(st));
    }catch{}
  }

})();
