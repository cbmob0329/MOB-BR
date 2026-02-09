/* =========================================================
   MOB BR - sim_tournament_flow.js (FULL / UPDATED)
   ---------------------------------------------------------
   役割：
   ・大会中の「NEXT進行」を一元管理する
   ・各大会フェーズ（local / national / world / final）を切り替える
   ・UI → sim_tournament_xxx を“順番通り”に呼ぶだけの司令塔
   ---------------------------------------------------------
   追加（要件）：
   ・試合前コーチスキル使用（使う/使わない選択）
   ・消耗品：使用したら所持から削除（0なら装備からも外す）
   ・使えるスキルが無い時：
     「コーチスキルはもう使い切っている！選手を信じよう！」
   ---------------------------------------------------------
   依存：
   ・sim_tournament_local.js
   ・（将来）sim_tournament_national.js
   ・（将来）sim_tournament_world.js
   ・（将来）sim_tournament_final.js
========================================================= */

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){
  'use strict';

  const Flow = {};
  window.MOBBR.sim.tournamentFlow = Flow;

  /* =========================
     INTERNAL STATE
  ========================== */
  let current = {
    phase: null,        // 'local' | 'national' | 'world' | 'final'
    state: null,        // 各 sim_tournament_xxx の state
    busy: false         // NEXT多重防止
  };

  /* =========================
     COACH SKILLS (MASTER)
     ※ ui_team.js と同一IDで運用
  ========================== */
  const COACH_OWNED_KEY = 'mobbr_coachSkillsOwned';     // { id: count }
  const COACH_EQUIP_KEY = 'mobbr_coachSkillsEquipped';  // [id|null,id|null,id|null]

  const COACH_SKILLS = [
    { id:'tactics_note',  name:'戦術ノート',        effectLabel:'この試合、総合戦闘力が1%アップする', coachLine:'基本を徹底。丁寧に戦おう！', powerAdd: 1 },
    { id:'mental_care',   name:'メンタル整備',      effectLabel:'この試合、チームの雰囲気が安定する',   coachLine:'全員で勝つぞ！',             stable: true },
    { id:'endgame_power', name:'終盤の底力',        effectLabel:'この試合、終盤の勝負で総合戦闘力が3%アップする', coachLine:'終盤一気に押すぞ！', endgamePowerAdd: 3 },
    { id:'clearing',      name:'クリアリング徹底',  effectLabel:'この試合、ファイトに勝った後に人数が残りやすい', coachLine:'周辺をしっかり見ろ！', surviveBias: true },
    { id:'score_mind',    name:'スコア意識',        effectLabel:'この試合、お宝やフラッグを取りやすい', coachLine:'この試合はポイント勝負だ！', scoreBias: true },
    { id:'igl_call',      name:'IGL強化コール',      effectLabel:'この試合、総合戦闘力が4%アップする', coachLine:'コールを信じろ！チャンピオン取るぞ！', powerAdd: 4 },
    { id:'protagonist',   name:'主人公ムーブ',      effectLabel:'この試合、総合戦闘力が6%アップし、アシストも出やすくなる', coachLine:'チームの力を信じろ！', powerAdd: 6, assistBias: true }
  ];
  const COACH_BY_ID = Object.fromEntries(COACH_SKILLS.map(s=>[s.id,s]));

  /* =========================
     PUBLIC API
  ========================== */

  /**
   * 大会開始（ローカルから）
   */
  Flow.startLocalTournament = function(){
    const Local = window.MOBBR?.sim?.tournamentLocal;
    if (!Local){
      console.error('[Flow] sim_tournament_local.js not found');
      return;
    }

    current.phase = 'local';
    current.state = Local.create({ keepStorage: true });

    // 大会UIがあるなら最初から NEXT を Flow.next に繋ぐ
    const tUI = window.MOBBR?.ui?.tournament;
    if (tUI && typeof tUI.open === 'function'){
      tUI.open({
        bg: 'neonmain.png',
        playerImage: 'P1.png',
        enemyImage: '',
        title: 'ローカル大会',
        messageLines: ['ローカル大会 開始！'],
        nextLabel: 'NEXT',
        nextEnabled: true,
        onNext: Flow.next
      });
    }else{
      announce('ローカル大会 開始！');
    }
  };

  /**
   * NEXT ボタン押下時の共通入口
   * UI側は必ずこれだけ呼ぶ
   */
  Flow.next = function(){
    if (current.busy) return;
    current.busy = true;

    try{
      if (!current.phase){
        console.warn('[Flow] phase not set');
        return;
      }

      switch(current.phase){
        case 'local':
          nextLocal();
          break;

        case 'national':
          console.warn('[Flow] national not implemented yet');
          announce('ナショナル大会は未実装です');
          break;

        case 'world':
          console.warn('[Flow] world not implemented yet');
          announce('ワールド大会は未実装です');
          break;

        case 'final':
          console.warn('[Flow] final not implemented yet');
          announce('ファイナルは未実装です');
          break;

        default:
          console.warn('[Flow] unknown phase', current.phase);
      }
    }finally{
      // UIの連打防止：少しだけ間を置いて戻す
      setTimeout(()=>{ current.busy = false; }, 40);
    }
  };

  /**
   * 現在のフェーズ取得（UI確認用）
   */
  Flow.getPhase = function(){
    return current.phase;
  };

  /**
   * 強制リセット（デバッグ用）
   */
  Flow.resetAll = function(){
    current.phase = null;
    current.state = null;
    current.busy = false;

    hideCoachSelect();

    const Local = window.MOBBR?.sim?.tournamentLocal;
    if (Local && Local.reset) Local.reset();
  };

  /* =========================
     LOCAL FLOW
  ========================== */
  function nextLocal(){
    const Local = window.MOBBR.sim.tournamentLocal;
    const st = current.state;

    if (!st){
      console.error('[Flow] local state missing');
      return;
    }

    // まだ試合が残っている
    if (!Local.isFinished(st)){
      const matchNo = st.matchIndex + 1;

      // ★試合前：コーチスキル選択（ある場合）
      runPreMatchCoachSkill({
        phase: 'local',
        matchNo,
        onDone: (coachUse)=>{

          // coachUse は null（使わない/無し） or { id,name,...meta }
          // sim側に渡せる形で添付（sim_tournament_local.js が拾うなら使える）
          const matchOpt = {
            title: 'RESULT',
            subtitle: `ローカル大会 第${matchNo}試合`,
            coachSkill: coachUse ? sanitizeCoachUse(coachUse) : null
          };

          current.state = Local.playNextMatch(st, matchOpt);

          // 試合後に「現在の総合順位」を出したい場合はここ
          Local.openOverallUI(current.state, {
            title: 'OVERALL',
            subtitle: `ローカル大会 現在順位（${current.state.matchIndex}/5）`
          });
        }
      });

      return;
    }

    // 5試合すべて終了
    const finalOverall = Local.getFinalOverall(st);

    announce('ローカル大会 終了！');

    // ここで「上位10通過／敗退」を判定する（次フェーズ実装側）
    console.log('[Flow] Local Final Overall', finalOverall);

    // 次フェーズ（未実装）
    announce('次はナショナル大会！（※未実装）');
    current.phase = 'national';
  }

  /* =========================
     PRE-MATCH COACH SKILL
  ========================== */

  function sanitizeCoachUse(s){
    // 余計な参照を持たない（stateを汚さない）
    const id = String(s.id || '');
    const base = COACH_BY_ID[id] || {};
    return {
      id,
      name: String(base.name || s.name || ''),
      powerAdd: Number(base.powerAdd || 0),
      endgamePowerAdd: Number(base.endgamePowerAdd || 0),
      stable: !!base.stable,
      surviveBias: !!base.surviveBias,
      scoreBias: !!base.scoreBias,
      assistBias: !!base.assistBias
    };
  }

  function runPreMatchCoachSkill(ctx){
    const equipped = readCoachEquipped();
    const owned = readCoachOwned();

    // 装備中で、かつ所持があるものだけ「使える」
    const usableIds = [];
    for (const id of equipped){
      if (!id) continue;
      const cnt = Number(owned[id] || 0);
      if (cnt > 0 && COACH_BY_ID[id]) usableIds.push(id);
    }

    // 同一が複数枠に入っていても1回でOK（重複排除）
    const uniq = Array.from(new Set(usableIds));

    if (!uniq.length){
      // 使えるスキル無し → 指定セリフ
      announce('コーチスキルはもう使い切っている！選手を信じよう！');
      ctx.onDone && ctx.onDone(null);
      return;
    }

    // 選択UIを出す
    showCoachSelect({
      title: `試合前コーチスキル（第${ctx.matchNo}試合）`,
      list: uniq.map(id => {
        const s = COACH_BY_ID[id];
        const cnt = Number(owned[id] || 0);
        return {
          id,
          name: s.name,
          effect: s.effectLabel,
          line: s.coachLine,
          count: cnt
        };
      }),
      onSkip: ()=>{
        hideCoachSelect();
        ctx.onDone && ctx.onDone(null);
      },
      onPick: (id)=>{
        // 使用：所持を1減らす / 0なら装備からも外す
        consumeCoachSkill(id);
        hideCoachSelect();
        ctx.onDone && ctx.onDone({ id });
      }
    });
  }

  function readCoachOwned(){
    try{
      const obj = JSON.parse(localStorage.getItem(COACH_OWNED_KEY) || '{}');
      return (obj && typeof obj === 'object') ? obj : {};
    }catch{
      return {};
    }
  }

  function writeCoachOwned(obj){
    localStorage.setItem(COACH_OWNED_KEY, JSON.stringify(obj || {}));
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

  function writeCoachEquipped(arr){
    const out = Array.isArray(arr) ? arr.slice(0,3) : [null,null,null];
    const norm = out.map(v => (typeof v === 'string' && v.trim()) ? v : null);
    while (norm.length < 3) norm.push(null);
    localStorage.setItem(COACH_EQUIP_KEY, JSON.stringify(norm));
  }

  function consumeCoachSkill(id){
    id = String(id || '');
    if (!id) return;

    const owned = readCoachOwned();
    const cur = Number(owned[id] || 0);
    const next = Math.max(0, cur - 1);

    if (next <= 0){
      delete owned[id];

      // 装備から外す（同ID全部）
      const eq = readCoachEquipped();
      for (let i=0;i<eq.length;i++){
        if (eq[i] === id) eq[i] = null;
      }
      writeCoachEquipped(eq);
    }else{
      owned[id] = next;
    }

    writeCoachOwned(owned);
  }

  /* =========================
     COACH SELECT UI (INJECT)
  ========================== */
  let coachDom = null;

  function ensureCoachDom(){
    if (coachDom) return coachDom;

    const wrap = document.createElement('div');
    wrap.id = 'mobbrCoachSelect';
    wrap.style.position = 'fixed';
    wrap.style.inset = '0';
    wrap.style.zIndex = '999999';
    wrap.style.display = 'none';
    wrap.style.alignItems = 'center';
    wrap.style.justifyContent = 'center';
    wrap.style.background = 'rgba(0,0,0,.62)';
    wrap.style.padding = '10px';
    wrap.style.boxSizing = 'border-box';

    const card = document.createElement('div');
    card.style.width = 'min(560px, 96vw)';
    card.style.maxHeight = 'min(86vh, 860px)';
    card.style.background = 'rgba(15,18,24,.97)';
    card.style.border = '1px solid rgba(255,255,255,.12)';
    card.style.borderRadius = '16px';
    card.style.overflow = 'hidden';
    card.style.boxShadow = '0 18px 60px rgba(0,0,0,.65)';
    card.style.display = 'flex';
    card.style.flexDirection = 'column';

    const head = document.createElement('div');
    head.style.padding = '12px 12px 10px';
    head.style.borderBottom = '1px solid rgba(255,255,255,.10)';

    const ttl = document.createElement('div');
    ttl.id = 'mobbrCoachSelectTitle';
    ttl.style.fontWeight = '900';
    ttl.style.fontSize = '14px';
    ttl.style.color = '#fff';
    ttl.textContent = '試合前コーチスキル';

    const sub = document.createElement('div');
    sub.id = 'mobbrCoachSelectSub';
    sub.style.marginTop = '6px';
    sub.style.fontSize = '12px';
    sub.style.color = 'rgba(255,255,255,.82)';
    sub.style.whiteSpace = 'pre-wrap';
    sub.textContent = '使うスキルを選んでください（消耗品）';

    head.appendChild(ttl);
    head.appendChild(sub);

    const list = document.createElement('div');
    list.id = 'mobbrCoachSelectList';
    list.style.padding = '10px 12px 12px';
    list.style.overflow = 'auto';
    list.style.webkitOverflowScrolling = 'touch';
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '10px';

    const foot = document.createElement('div');
    foot.style.padding = '12px 12px 12px';
    foot.style.borderTop = '1px solid rgba(255,255,255,.10)';
    foot.style.display = 'flex';
    foot.style.gap = '10px';

    const btnSkip = document.createElement('button');
    btnSkip.id = 'mobbrCoachSelectSkip';
    btnSkip.type = 'button';
    btnSkip.textContent = '使わない';
    btnSkip.style.flex = '1';
    btnSkip.style.border = '1px solid rgba(255,255,255,.18)';
    btnSkip.style.background = 'rgba(255,255,255,.06)';
    btnSkip.style.color = '#fff';
    btnSkip.style.fontWeight = '900';
    btnSkip.style.borderRadius = '12px';
    btnSkip.style.padding = '12px 12px';
    btnSkip.style.minHeight = '44px';

    foot.appendChild(btnSkip);

    card.appendChild(head);
    card.appendChild(list);
    card.appendChild(foot);

    wrap.appendChild(card);
    document.body.appendChild(wrap);

    // 背景クリック無効（閉じない）
    wrap.addEventListener('click', (e)=>{
      e.preventDefault();
      e.stopPropagation();
    }, { passive:false });
    card.addEventListener('click', (e)=>e.stopPropagation());

    coachDom = {
      wrap,
      title: ttl,
      sub,
      list,
      btnSkip,
      onSkip: null,
      onPick: null
    };

    // bind
    btnSkip.addEventListener('click', (e)=>{
      e.preventDefault();
      e.stopPropagation();
      if (typeof coachDom.onSkip === 'function') coachDom.onSkip();
    });

    return coachDom;
  }

  function showCoachSelect(opt){
    const d = ensureCoachDom();

    d.onSkip = (typeof opt.onSkip === 'function') ? opt.onSkip : null;
    d.onPick = (typeof opt.onPick === 'function') ? opt.onPick : null;

    d.title.textContent = String(opt.title || '試合前コーチスキル');
    d.sub.textContent = '使うスキルを選んでください（消耗品）';

    d.list.innerHTML = '';

    const arr = Array.isArray(opt.list) ? opt.list : [];
    for (const item of arr){
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.style.border = '1px solid rgba(255,255,255,.14)';
      btn.style.background = 'rgba(255,255,255,.06)';
      btn.style.color = '#fff';
      btn.style.borderRadius = '14px';
      btn.style.padding = '10px 10px';
      btn.style.textAlign = 'left';
      btn.style.cursor = 'pointer';
      btn.style.touchAction = 'manipulation';

      const top = document.createElement('div');
      top.style.display = 'flex';
      top.style.justifyContent = 'space-between';
      top.style.alignItems = 'baseline';
      top.style.gap = '10px';

      const name = document.createElement('div');
      name.style.fontWeight = '900';
      name.style.fontSize = '14px';
      name.textContent = String(item.name || item.id || '');

      const cnt = document.createElement('div');
      cnt.style.fontWeight = '900';
      cnt.style.fontSize = '12px';
      cnt.style.opacity = '0.92';
      cnt.textContent = `所持：${Number(item.count||0)}`;

      top.appendChild(name);
      top.appendChild(cnt);

      const eff = document.createElement('div');
      eff.style.marginTop = '6px';
      eff.style.fontSize = '12px';
      eff.style.opacity = '0.92';
      eff.textContent = String(item.effect || '');

      const line = document.createElement('div');
      line.style.marginTop = '6px';
      line.style.fontSize = '12px';
      line.style.opacity = '0.92';
      line.textContent = `コーチ：「${String(item.line || '')}」`;

      btn.appendChild(top);
      btn.appendChild(eff);
      btn.appendChild(line);

      btn.addEventListener('click', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        const id = String(item.id || '');
        if (!id) return;
        if (typeof d.onPick === 'function') d.onPick(id);
      });

      d.list.appendChild(btn);
    }

    d.wrap.style.display = 'flex';
  }

  function hideCoachSelect(){
    if (!coachDom) return;
    coachDom.wrap.style.display = 'none';
    coachDom.onSkip = null;
    coachDom.onPick = null;
  }

  /* =========================
     UTIL
  ========================== */
  function announce(text){
    console.log('[ANNOUNCE]', text);

    const tUI = window.MOBBR?.ui?.tournament;
    if (tUI && typeof tUI.showMessage === 'function'){
      tUI.showMessage('大会', [String(text || '')], 'NEXT');
      tUI.setNextHandler(Flow.next);
      tUI.setNextEnabled(true);
      return;
    }

    const ui = window.MOBBR?.ui;
    if (ui && typeof ui.showMessage === 'function'){
      ui.showMessage(text);
    }
  }

})();
