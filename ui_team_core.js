'use strict';

/* =========================================================
   MOB BR - ui_team_core.js v19.8（FULL）
   - ✅ チーム画面 “コア” のみ（training注入はしない）
   - ✅ チーム画面でトレーニング/修行が出来ないようにする（無限強化根絶）
   - ✅ 表示ステータスは「体力 / エイム / 技術 / メンタル」だけ
   - ✅ メンバー名ボタンは作らない（TEAMで名前変更は別導線に統一）
   - ✅ 旧UIの「A/B/Cブロック」だけを自動で非表示（ヘッダーの総合/%は残す）
   - ✅ v19.7:
      - ✅ チーム総合戦闘力が0になる問題を修正（DOM拾いを強化）
      - ✅ ヘッダー横に「カード効果（バフ）」表示を追加（無ければ自動生成）
      - ✅ eventBuffs（aim/mental/agi %）と eventBuff（旧）を吸収して表示
   - ✅ v19.8（今回）:
      - ✅ TEAM画面の「セーブ」「セーブ削除」が効かない問題を修正
         1) セーブ/削除ボタンへ確実にイベントをバインド（click + pointerup）
         2) modalBack が前面に残ってタップを吸うケースを抑止（TEAM表示時は pointer-events:none）
         3) セーブ削除後は markNeedSetup を立て、必要キーをクリアし、リロードで確実に初期設定へ戻す
   - ✅ 互換維持：
      - window.MOBBR._uiTeamCore を提供（旧参照の保険）
      - window.MOBBR.ui._teamCore を提供（app.js の CHECK 用）
      - window.MOBBR.initTeamUI() を提供
      - migrateAndPersistTeam / readPlayerTeam / writePlayerTeam / clone 等
========================================================= */

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){
  const $ = (id) => document.getElementById(id);

  // =========================================================
  // storage keys（既存と衝突しない前提で “同じ” を使う）
  // =========================================================
  const KEY_PLAYER_TEAM = 'mobbr_playerTeam';

  // app.js v19.4 setup keys（存在する前提で合わせる）
  const KEY_NEED_SETUP = 'mobbr_need_setup';
  const KEY_COMPANY    = 'mobbr_company';

  // app.js / tournament 周りの代表キー（削除時の最小クリア対象）
  const KEY_YEAR   = 'mobbr_year';
  const KEY_MONTH  = 'mobbr_month';
  const KEY_WEEK   = 'mobbr_week';
  const KEY_GOLD   = 'mobbr_gold';
  const KEY_RANK   = 'mobbr_rank';
  const KEY_RECENT = 'mobbr_recent';

  const KEY_TOUR_STATE   = 'mobbr_tour_state';
  const KEY_NEXT_TOUR    = 'mobbr_nextTour';
  const KEY_NEXT_TOUR_W  = 'mobbr_nextTourW';

  // 表示ステータス（要望：これ以外は表示しない）
  const STATS_SHOW = [
    { key:'hp',     label:'体力'   },
    { key:'aim',    label:'エイム' },
    { key:'tech',   label:'技術'   },
    { key:'mental', label:'メンタル' }
  ];

  // =========================================================
  // DOM
  // =========================================================
  const dom = {
    teamScreen: null,
    teamPanel: null,
    teamName: null,
    teamPower: null,     // “総合戦闘力/チーム力” 表示先（複数候補）
    teamEffect: null,    // “カード効果（バフ）” 表示先（無ければ自動生成）
    membersWrap: null,
    membersPop: null,  // 互換のため保持（本モジュールでは使わない）
    modalBack: null,   // 互換のため保持（TEAM表示中はタップ吸いを抑止）
    btnSave: null,
    btnDelete: null
  };

  // =========================================================
  // util
  // =========================================================
  function safeJsonParse(s, fallback){
    try{ return JSON.parse(s); }catch(e){ return fallback; }
  }

  function clamp(n, min, max){
    const v = Number(n);
    if (!Number.isFinite(v)) return min;
    return Math.max(min, Math.min(max, v));
  }
  function clamp0to99(n){ return clamp(n, 0, 99); }

  function clone(obj){
    try{ return JSON.parse(JSON.stringify(obj)); }catch(e){ return obj; }
  }

  function getStorage(){
    return window.MOBBR && window.MOBBR.storage ? window.MOBBR.storage : null;
  }

  function readPlayerTeam(){
    const S = getStorage();
    if (S?.getJSON){
      return S.getJSON(KEY_PLAYER_TEAM, null);
    }
    const raw = localStorage.getItem(KEY_PLAYER_TEAM);
    if (!raw) return null;
    return safeJsonParse(raw, null);
  }

  function writePlayerTeam(team){
    const S = getStorage();
    if (S?.setJSON){
      S.setJSON(KEY_PLAYER_TEAM, team);
      return;
    }
    try{ localStorage.setItem(KEY_PLAYER_TEAM, JSON.stringify(team)); }catch(e){}
  }

  function setStrLS(key, val){ try{ localStorage.setItem(String(key), String(val)); }catch(e){} }
  function delLS(key){ try{ localStorage.removeItem(String(key)); }catch(e){} }

  // =========================================================
  // team data migration（壊さず整える）
  // =========================================================
  function ensureMemberBase(mem, id, fallbackRole){
    if (!mem || typeof mem !== 'object') mem = {};
    mem.id = String(mem.id || id || 'A');

    // name
    if (typeof mem.name !== 'string' || !mem.name.trim()){
      mem.name = mem.id;
    }

    // role
    if (typeof mem.role !== 'string' || !mem.role.trim()){
      mem.role = fallbackRole || '';
    }

    // stats（表示は4つだけだが、既存が持っている他ステは “消さない”）
    mem.stats = (mem.stats && typeof mem.stats === 'object') ? mem.stats : {};
    for (const s of STATS_SHOW){
      if (!Number.isFinite(Number(mem.stats[s.key]))){
        mem.stats[s.key] = 66;
      }else{
        mem.stats[s.key] = clamp0to99(mem.stats[s.key]);
      }
    }

    // 画像（あるなら維持、なければ空）
    if (typeof mem.img !== 'string') mem.img = '';

    return mem;
  }

  function migrateTeam(team){
    if (!team || typeof team !== 'object') team = {};

    // team name
    if (typeof team.teamName !== 'string') team.teamName = 'PLAYER TEAM';

    // members
    if (!Array.isArray(team.members)) team.members = [];

    // id で拾えるように整形
    const byId = {};
    team.members.forEach(m=>{
      const id = String(m?.id || '');
      if (!id) return;
      byId[id] = m;
    });

    // 必ず A/B/C を作る（既存がある場合は優先して保持）
    const rolesFallback = { A:'IGL', B:'アタッカー', C:'サポーター' };

    const A = ensureMemberBase(byId['A'] || team.members.find(x=>String(x?.id)==='A'), 'A', rolesFallback.A);
    const B = ensureMemberBase(byId['B'] || team.members.find(x=>String(x?.id)==='B'), 'B', rolesFallback.B);
    const C = ensureMemberBase(byId['C'] || team.members.find(x=>String(x?.id)==='C'), 'C', rolesFallback.C);

    // 既存の他メンバーは “消さない”
    const rest = team.members.filter(m=>{
      const id = String(m?.id || '');
      return id !== 'A' && id !== 'B' && id !== 'C';
    });

    team.members = [A, B, C, ...rest];

    return team;
  }

  function migrateAndPersistTeam(){
    const team0 = readPlayerTeam();
    const team = migrateTeam(team0);
    writePlayerTeam(team);
    return team;
  }

  // =========================================================
  // team power（簡易：4ステ平均。既存powerがあるなら表示はそれ優先）
  // =========================================================
  function calcMemberPower(mem){
    const st = mem?.stats || {};
    let sum = 0;
    let cnt = 0;
    for (const s of STATS_SHOW){
      sum += clamp0to99(st[s.key] || 0);
      cnt += 1;
    }
    if (!cnt) return 0;
    return Math.round(sum / cnt);
  }

  function calcTeamPower(team){
    const ms = (team?.members || []).filter(m=>{
      const id = String(m?.id || '');
      return id === 'A' || id === 'B' || id === 'C';
    });
    if (!ms.length) return 0;

    // 既存仕様で team.power があれば、それを最優先で表示
    const p0 = Number(team?.power);
    if (Number.isFinite(p0) && p0 > 0) return Math.round(p0);

    let sum = 0;
    ms.forEach(m=>{ sum += calcMemberPower(m); });
    return Math.round(sum / ms.length);
  }

  // =========================================================
  // ✅ カード効果（バフ）表示（eventBuffs / eventBuff を吸収）
  // - eventBuffs: { aim:+10, mental:+5, agi:+8 } など（%加算）
  // - eventBuff : { multPower:1.1, addAim:5 } など（旧）
  // - ここは “表示だけ”。削除・上書きはしない。
  // =========================================================
  function num(n){ const v = Number(n); return Number.isFinite(v) ? v : 0; }

  function formatBuffText(team){
    const parts = [];

    // 新：eventBuffs（%）
    const eb = (team && typeof team === 'object') ? team.eventBuffs : null;
    if (eb && typeof eb === 'object'){
      const aim = num(eb.aim);
      const mental = num(eb.mental);
      const agi = num(eb.agi);

      if (aim) parts.push(`エイム +${aim}%`);
      if (mental) parts.push(`メンタル +${mental}%`);
      if (agi) parts.push(`機動力 +${agi}%`);
    }

    // 旧：eventBuff（互換）
    const ob = (team && typeof team === 'object') ? team.eventBuff : null;
    if (ob && typeof ob === 'object'){
      const multPower = num(ob.multPower);
      const addPower = num(ob.addPower);
      const addAim = num(ob.addAim);
      const addMental = num(ob.addMental);
      const addAgi = num(ob.addAgi);
      const addTech = num(ob.addTech);

      if (multPower && multPower !== 1){
        const pct = Math.round((multPower - 1) * 100);
        if (pct) parts.push(`総合 +${pct}%`);
      }
      if (addPower) parts.push(`総合 +${addPower}`);
      if (addAim) parts.push(`エイム +${addAim}`);
      if (addMental) parts.push(`メンタル +${addMental}`);
      if (addAgi) parts.push(`機動力 +${addAgi}`);
      if (addTech) parts.push(`技術 +${addTech}`);
    }

    // 将来拡張用（表示だけ）
    const ce = team?.cardEffects;
    if (Array.isArray(ce)){
      ce.forEach(x=>{
        const s = String(x || '').trim();
        if (s) parts.push(s);
      });
    }

    if (!parts.length) return 'なし';
    return parts.join(' / ');
  }

  // =========================================================
  // ✅ 旧UIの「A/B/Cブロック」だけ消す（ヘッダーは残す）
  //   - tCompany/tTeam/tTeamPower 等は絶対に触らない
  // =========================================================
  const LEGACY_MEMBER_IDS = [
    'tNameA','tNameB','tNameC',
    'tA_hp','tA_mental','tA_aim','tA_agi','tA_tech','tA_support','tA_scan','tA_passive','tA_ult',
    'tB_hp','tB_mental','tB_aim','tB_agi','tB_tech','tB_support','tB_scan','tB_passive','tB_ult',
    'tC_hp','tC_mental','tC_aim','tC_agi','tC_tech','tC_support','tC_scan','tC_passive','tC_ult'
  ];

  function pickExistingId(ids){
    for (const id of ids){
      const el = $(id);
      if (el) return el;
    }
    return null;
  }

  function countLegacyIn(node, prefix){
    try{
      return node.querySelectorAll(
        prefix === 'A'
          ? '#tNameA,[id^="tA_"]'
          : prefix === 'B'
            ? '#tNameB,[id^="tB_"]'
            : '#tNameC,[id^="tC_"]'
      ).length;
    }catch(e){
      return 0;
    }
  }

  function hideBlock(el){
    if (!el) return;
    el.style.display = 'none';
    el.style.pointerEvents = 'none';
    el.setAttribute('aria-hidden','true');
    el.setAttribute('data-mobbr-hidden','1');
  }

  function hideLegacyMemberSectionByPrefix(prefix){
    const anchor =
      prefix === 'A' ? pickExistingId(['tNameA','tA_hp','tA_aim','tA_tech','tA_mental']) :
      prefix === 'B' ? pickExistingId(['tNameB','tB_hp','tB_aim','tB_tech','tB_mental']) :
                       pickExistingId(['tNameC','tC_hp','tC_aim','tC_tech','tC_mental']);

    if (!anchor || !dom.teamPanel) return;

    let best = null;
    let cur = anchor.parentElement;

    while (cur && cur !== dom.teamPanel && cur !== dom.teamScreen){
      const cnt = countLegacyIn(cur, prefix);
      if (cnt >= 6){
        best = cur;
      }
      cur = cur.parentElement;
    }

    if (best){
      hideBlock(best);
      return;
    }

    const ids = LEGACY_MEMBER_IDS.filter(id=>{
      if (prefix === 'A') return id === 'tNameA' || id.startsWith('tA_');
      if (prefix === 'B') return id === 'tNameB' || id.startsWith('tB_');
      return id === 'tNameC' || id.startsWith('tC_');
    });

    ids.forEach(id=>{
      const el = $(id);
      if (!el) return;
      const p1 = el.parentElement;
      const p2 = p1 ? p1.parentElement : null;

      if (p2 && p2 !== dom.teamPanel && p2 !== dom.teamScreen){
        hideBlock(p2);
      }else if (p1 && p1 !== dom.teamPanel && p1 !== dom.teamScreen){
        hideBlock(p1);
      }else{
        hideBlock(el);
      }
    });
  }

  function hideLegacyMemberBlocksOnly(){
    try{
      const any = LEGACY_MEMBER_IDS.some(id=> !!$(id));
      if (!any) return;
      hideLegacyMemberSectionByPrefix('A');
      hideLegacyMemberSectionByPrefix('B');
      hideLegacyMemberSectionByPrefix('C');
    }catch(e){}
  }

  // =========================================================
  // ✅ v19.8: 小さなトースト（通知）
  // =========================================================
  let toastTimer = null;
  function showToast(text){
    try{
      let el = document.getElementById('mobbrTeamToast');
      if (!el){
        el = document.createElement('div');
        el.id = 'mobbrTeamToast';
        el.style.position = 'fixed';
        el.style.left = '50%';
        el.style.bottom = '18px';
        el.style.transform = 'translateX(-50%)';
        el.style.zIndex = '1000009';
        el.style.maxWidth = '92vw';
        el.style.padding = '10px 12px';
        el.style.borderRadius = '14px';
        el.style.border = '1px solid rgba(255,255,255,.16)';
        el.style.background = 'rgba(0,0,0,.82)';
        el.style.color = '#fff';
        el.style.fontSize = '13px';
        el.style.fontWeight = '900';
        el.style.opacity = '0';
        el.style.transition = 'opacity .15s ease';
        el.style.pointerEvents = 'none';
        document.body.appendChild(el);
      }

      el.textContent = String(text || '');
      el.style.opacity = '1';

      if (toastTimer) clearTimeout(toastTimer);
      toastTimer = setTimeout(()=>{
        try{
          el.style.opacity = '0';
        }catch(e){}
      }, 1200);
    }catch(e){}
  }

  // =========================================================
  // ✅ v19.8: modalBack が TEAM タップを吸わないように抑止
  // - TEAM画面が表示されている間だけ、安全側で pointer-events:none
  // =========================================================
  function suppressModalBackTapIfNeeded(){
    try{
      if (!dom.modalBack) return;

      // TEAMが “表示されているっぽい” 時だけ
      const isTeamVisible = !!(dom.teamScreen && dom.teamScreen.style && dom.teamScreen.style.display !== 'none');
      if (!isTeamVisible) return;

      dom.modalBack.style.pointerEvents = 'none';
    }catch(e){}
  }

  // =========================================================
  // UI parts
  // =========================================================
  function buildTeamDomIfMissing(){
    dom.teamScreen = $('teamScreen') || $('team') || document.querySelector('.teamScreen') || null;
    dom.modalBack  = $('modalBack') || document.querySelector('#modalBack') || null;
    dom.membersPop = $('membersPop') || document.querySelector('#membersPop') || null;

    if (!dom.teamScreen) return;

    dom.teamPanel =
      dom.teamScreen.querySelector('.teamPanel') ||
      dom.teamScreen;

    // チーム名
    dom.teamName =
      dom.teamScreen.querySelector('#teamName') ||
      dom.teamScreen.querySelector('.teamName') ||
      dom.teamScreen.querySelector('#tTeam') ||
      dom.teamScreen.querySelector('#tTeamName') ||
      null;

    // ✅ 総合戦闘力（拾いを強化）
    dom.teamPower =
      dom.teamScreen.querySelector('#teamPower') ||
      dom.teamScreen.querySelector('.teamPower') ||
      dom.teamScreen.querySelector('#tTeamPower') ||
      dom.teamScreen.querySelector('#tPower') ||
      dom.teamScreen.querySelector('.tTeamPower') ||
      dom.teamScreen.querySelector('[data-team-power]') ||
      null;

    // ✅ カード効果（ヘッダー横）拾い → 無ければ自動生成
    dom.teamEffect =
      dom.teamScreen.querySelector('#teamEffect') ||
      dom.teamScreen.querySelector('.teamEffect') ||
      dom.teamScreen.querySelector('#tCardEffect') ||
      dom.teamScreen.querySelector('#tTeamBuff') ||
      dom.teamScreen.querySelector('.tCardEffect') ||
      dom.teamScreen.querySelector('[data-team-effect]') ||
      null;

    // メンバー枠
    dom.membersWrap =
      dom.teamScreen.querySelector('#teamMembers') ||
      dom.teamScreen.querySelector('.teamMembers') ||
      null;

    if (!dom.membersWrap){
      const wrap = document.createElement('div');
      wrap.id = 'teamMembers';
      wrap.className = 'teamMembers';
      wrap.style.marginTop = '10px';
      wrap.style.display = 'grid';
      wrap.style.gridTemplateColumns = '1fr';
      wrap.style.gap = '10px';
      dom.teamPanel.appendChild(wrap);
      dom.membersWrap = wrap;
    }

    // ✅ 旧UIの A/B/C ブロックだけ消す（ヘッダーは残す）
    hideLegacyMemberBlocksOnly();

    // ✅ “カード効果”表示が無いなら、総合戦闘力の近くに1つ作る
    if (!dom.teamEffect){
      let host = null;
      if (dom.teamPower && dom.teamPower.parentElement){
        host = dom.teamPower.parentElement;
      }else{
        host = dom.teamPanel;
      }

      const eff = document.createElement('div');
      eff.id = 'teamEffect';
      eff.className = 'teamEffect';
      eff.setAttribute('data-team-effect','1');
      eff.style.marginTop = '6px';
      eff.style.fontSize = '12px';
      eff.style.opacity = '0.95';
      eff.style.lineHeight = '1.35';
      eff.style.padding = '8px 10px';
      eff.style.borderRadius = '12px';
      eff.style.border = '1px solid rgba(255,255,255,.14)';
      eff.style.background = 'rgba(0,0,0,.18)';
      eff.textContent = 'カード効果：なし';

      try{
        if (host && host !== dom.teamPanel){
          host.appendChild(eff);
        }else{
          if (dom.teamPanel && dom.teamPanel.firstChild){
            dom.teamPanel.insertBefore(eff, dom.teamPanel.firstChild);
          }else if (dom.teamPanel){
            dom.teamPanel.appendChild(eff);
          }
        }
      }catch(e){
        try{ dom.teamPanel.appendChild(eff); }catch(_){}
      }

      dom.teamEffect = eff;
    }

    // ✅ v19.8: TEAM表示中の modalBack タップ吸い抑止
    suppressModalBackTapIfNeeded();

    // ✅ v19.8: セーブ/削除ボタン拾い
    pickSaveDeleteButtons();
    bindSaveDeleteButtonsOnce();
  }

  function pickSaveDeleteButtons(){
    try{
      if (!dom.teamScreen) return;

      const pickByIds = (ids) => {
        for (const id of ids){
          const el = $(id) || dom.teamScreen.querySelector('#'+id);
          if (el) return el;
        }
        return null;
      };

      // よくあるID候補（既存HTMLに合わせて順に拾う）
      dom.btnSave = dom.btnSave || pickByIds([
        'btnTeamSave','teamSaveBtn','btnSave','btnSaveTeam','btnTeamSaveData'
      ]);

      dom.btnDelete = dom.btnDelete || pickByIds([
        'btnTeamDelete','teamDeleteBtn','btnDelete','btnDeleteSave','btnTeamDeleteSave'
      ]);

      // IDが無い環境：テキスト/属性で拾う（壊さない範囲）
      if (!dom.btnSave){
        const cands = Array.from(dom.teamScreen.querySelectorAll('button, a, [role="button"]'));
        dom.btnSave = cands.find(el=>{
          const t = String(el.textContent || '').trim();
          return t === 'セーブ' || t === '保存' || t.includes('セーブ');
        }) || null;
      }

      if (!dom.btnDelete){
        const cands = Array.from(dom.teamScreen.querySelectorAll('button, a, [role="button"]'));
        dom.btnDelete = cands.find(el=>{
          const t = String(el.textContent || '').trim();
          return t === 'セーブ削除' || t.includes('セーブ削除') || t.includes('削除');
        }) || null;
      }
    }catch(e){}
  }

  // =========================================================
  // ✅ v19.8: セーブ/削除の実処理
  // =========================================================
  function doSave(){
    try{
      // TEAMデータは “壊さず整える → 保存” だけ
      const team = migrateAndPersistTeam();

      // 初期セットアップ強制フラグが残ってたら解除（安全側）
      delLS(KEY_NEED_SETUP);

      // 表示も更新
      renderTeamHeader(team);
      showToast('セーブしました');
    }catch(e){
      console.error('[TEAM] save failed:', e);
      showToast('セーブ失敗');
    }
  }

  function doDeleteSave(){
    try{
      // 1) need setup を強制（app.js v19.4 と導線一致）
      try{
        if (window.MOBBR && typeof window.MOBBR.markNeedSetup === 'function'){
          window.MOBBR.markNeedSetup();
        }else{
          setStrLS(KEY_NEED_SETUP, '1');
        }
      }catch(_){
        setStrLS(KEY_NEED_SETUP, '1');
      }

      // 2) 最小限のキーをクリア（大会状態/チーム/会社など）
      //    ※ “全部消す” 系の storage API があればそれを優先
      const S = getStorage();

      // 任意の全消しAPI（存在する場合だけ）
      if (S && typeof S.clearAllGameData === 'function'){
        S.clearAllGameData();
      }else if (S && typeof S.clearAll === 'function'){
        // clearAll が “本当に全消し” の可能性があるので、
        // 既存実装がある場合のみ使う（無ければ個別remove）
        S.clearAll();
      }else{
        delLS(KEY_PLAYER_TEAM);
        delLS(KEY_COMPANY);

        delLS(KEY_YEAR);
        delLS(KEY_MONTH);
        delLS(KEY_WEEK);
        delLS(KEY_GOLD);
        delLS(KEY_RANK);
        delLS(KEY_RECENT);

        delLS(KEY_TOUR_STATE);
        delLS(KEY_NEXT_TOUR);
        delLS(KEY_NEXT_TOUR_W);
      }

      showToast('セーブを削除しました');

      // 3) 画面状態を確実にそろえるためリロード（初期設定へ）
      setTimeout(()=>{
        try{ location.reload(); }catch(e){}
      }, 250);
    }catch(e){
      console.error('[TEAM] delete failed:', e);
      showToast('削除失敗');
    }
  }

  function bindSaveDeleteButtonsOnce(){
    try{
      // バインド済みなら二重付けしない
      const bindOne = (btn, type) => {
        if (!btn) return;
        if (btn.dataset && btn.dataset.mobbrBound === '1') return;
        if (btn.dataset) btn.dataset.mobbrBound = '1';

        const handler = (ev) => {
          try{
            // TEAM上で modalBack が吸ってたら、念のため解除
            suppressModalBackTapIfNeeded();

            // iOS: pointerup/click の二重発火を抑止
            if (ev && typeof ev.preventDefault === 'function') ev.preventDefault();
            if (ev && typeof ev.stopPropagation === 'function') ev.stopPropagation();
          }catch(_){}

          if (type === 'save') doSave();
          else doDeleteSave();
        };

        // 安全側で両方
        btn.addEventListener('click', handler, { passive:false });
        btn.addEventListener('pointerup', handler, { passive:false });

        // iOS古めの保険
        btn.addEventListener('touchend', handler, { passive:false });
      };

      bindOne(dom.btnSave, 'save');
      bindOne(dom.btnDelete, 'delete');
    }catch(e){}
  }

  // =========================================================
  // レンダリング
  // =========================================================
  function renderMemberCard(mem){
    const card = document.createElement('div');
    card.style.borderRadius = '14px';
    card.style.padding = '12px';
    card.style.border = '1px solid rgba(255,255,255,.14)';
    card.style.background = 'rgba(255,255,255,.08)';

    // ===== header（メンバー名ボタン無し）=====
    const head = document.createElement('div');
    head.style.display = 'flex';
    head.style.flexDirection = 'column';
    head.style.gap = '4px';

    const name = document.createElement('div');
    name.style.fontWeight = '1000';
    name.style.fontSize = '15px';
    name.style.whiteSpace = 'nowrap';
    name.style.overflow = 'hidden';
    name.style.textOverflow = 'ellipsis';
    name.textContent = `${String(mem.name || mem.id)}${mem.role ? `（${mem.role}）` : ''}`;

    const sub = document.createElement('div');
    sub.style.fontSize = '12px';
    sub.style.opacity = '0.92';
    sub.textContent = `ID: ${mem.id}`;

    head.appendChild(name);
    head.appendChild(sub);
    card.appendChild(head);

    // 画像（あれば）
    if (mem.img){
      const img = document.createElement('img');
      img.src = mem.img;
      img.alt = mem.id;
      img.style.width = '100%';
      img.style.maxHeight = '220px';
      img.style.objectFit = 'contain';
      img.style.marginTop = '10px';
      img.style.borderRadius = '12px';
      img.style.background = 'rgba(0,0,0,.18)';
      card.appendChild(img);
    }

    // ✅ ステ表示：4つのみ
    const stats = document.createElement('div');
    stats.style.marginTop = '10px';
    stats.style.display = 'grid';
    stats.style.gridTemplateColumns = '1fr 1fr';
    stats.style.gap = '10px';

    STATS_SHOW.forEach(s=>{
      const box = document.createElement('div');
      box.style.borderRadius = '12px';
      box.style.padding = '10px';
      box.style.background = 'rgba(0,0,0,.18)';
      box.style.border = '1px solid rgba(255,255,255,.12)';

      const t = document.createElement('div');
      t.style.fontWeight = '1000';
      t.style.fontSize = '13px';
      t.textContent = s.label;

      const v = document.createElement('div');
      v.style.marginTop = '4px';
      v.style.fontWeight = '1000';
      v.style.fontSize = '18px';
      v.textContent = String(clamp0to99(mem?.stats?.[s.key] || 0));

      box.appendChild(t);
      box.appendChild(v);
      stats.appendChild(box);
    });

    card.appendChild(stats);
    return card;
  }

  function renderTeamHeader(team){
    if (dom.teamName){
      dom.teamName.textContent = String(team?.teamName || 'PLAYER TEAM');
    }

    // ✅ 総合戦闘力（%）表示
    const p = calcTeamPower(team);
    if (dom.teamPower){
      dom.teamPower.textContent = `チーム力：${p}%`;
      dom.teamPower.setAttribute('data-team-power','1');
    }

    // ✅ カード効果（バフ）
    if (dom.teamEffect){
      const txt = formatBuffText(team);
      dom.teamEffect.textContent = `カード効果：${txt}`;
      dom.teamEffect.setAttribute('data-team-effect','1');
    }
  }

  function renderMembers(team){
    if (!dom.membersWrap) return;
    dom.membersWrap.innerHTML = '';

    const list = (team?.members || []).filter(m=>{
      const id = String(m?.id || '');
      return id === 'A' || id === 'B' || id === 'C';
    });

    list.forEach(mem=>{
      dom.membersWrap.appendChild(renderMemberCard(mem));
    });

    // ✅ 注意書き：チーム画面では修行しない
    const note = document.createElement('div');
    note.style.marginTop = '4px';
    note.style.fontSize = '12px';
    note.style.opacity = '0.92';
    note.style.lineHeight = '1.35';
    note.style.padding = '10px 12px';
    note.style.borderRadius = '12px';
    note.style.border = '1px solid rgba(255,255,255,.14)';
    note.style.background = 'rgba(0,0,0,.18)';
    note.textContent = '※修行（トレーニング）は「育成（修行）」画面で行います。チーム画面では実行できません。';
    dom.membersWrap.appendChild(note);
  }

  function render(){
    buildTeamDomIfMissing();
    if (!dom.teamScreen) return;

    const team = migrateAndPersistTeam();
    renderTeamHeader(team);
    renderMembers(team);

    // ✅ 描画の度に、旧A/B/Cブロックが復活してないか潰す
    hideLegacyMemberBlocksOnly();

    // ✅ v19.8: modalBack 吸いの抑止を毎回
    suppressModalBackTapIfNeeded();

    // ✅ v19.8: ボタン再拾い＆イベント付け直し（ただし二重付けはしない）
    pickSaveDeleteButtons();
    bindSaveDeleteButtonsOnce();
  }

  // =========================================================
  // init
  // =========================================================
  function initTeamUI(){
    buildTeamDomIfMissing();
    render();
  }

  // =========================================================
  // export core api（他モジュール互換用）
  // =========================================================
  const coreApi = {
    dom,
    clone,
    clamp0to99,
    readPlayerTeam,
    writePlayerTeam,
    migrateTeam,
    migrateAndPersistTeam,
    calcTeamPower,
    renderTeamPower: () => {
      try{
        const team = migrateAndPersistTeam();
        renderTeamHeader(team);
      }catch(e){}
    },
    render,
    // デバッグ用
    hideLegacyMemberBlocksOnly,
    // v19.8 追加（手動検証用）
    _debug: {
      pickSaveDeleteButtons,
      bindSaveDeleteButtonsOnce,
      doSave,
      doDeleteSave,
      suppressModalBackTapIfNeeded
    }
  };

  // ✅ 互換：旧参照
  window.MOBBR._uiTeamCore = coreApi;

  // ✅ 新参照（app.js のCHECKで見ている）
  window.MOBBR.ui._teamCore = coreApi;

  // ✅ init
  window.MOBBR.initTeamUI = initTeamUI;

  // 初回：DOM準備後に呼ばれる想定だが、保険で1回だけ
  try{
    if (document.readyState === 'complete' || document.readyState === 'interactive'){
      setTimeout(()=>{ try{ initTeamUI(); }catch(e){} }, 0);
    }else{
      document.addEventListener('DOMContentLoaded', ()=>{ try{ initTeamUI(); }catch(e){} }, { once:true });
    }
  }catch(e){}

})();
