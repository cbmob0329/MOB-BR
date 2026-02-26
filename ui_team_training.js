'use strict';

/*
  MOB BR - ui_team_training.js v17-split（FULL）
  - 元 ui_team.js v17（フル）から「育成（能力アップ/能力獲得）」部分を分離
  - ui_team_core.js が提供する coreApi に attach して動作
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.uiTeamTraining = window.MOBBR.uiTeamTraining || {};

(function(){

  let T = null; // coreApi

  function attach(coreApi){
    T = coreApi || null;

    // coreが先にロードされているケース対応
    if (!T && window.MOBBR?._uiTeamCore) T = window.MOBBR._uiTeamCore;

    if (!T){
      console.warn('[ui_team_training] coreApi missing');
      return;
    }

    // core側へ showMsg を差し込み
    T.showMsg = showMsg;

    // 初回UI生成
    ensureTrainingUI();
  }

  // coreが先にロードされて training が後から来ても attach できるように
  if (!window.MOBBR.uiTeamTraining.attach){
    window.MOBBR.uiTeamTraining.attach = attach;
  }

  // coreが既に存在するなら即 attach
  if (window.MOBBR?._uiTeamCore){
    attach(window.MOBBR._uiTeamCore);
  }

  // =========================================================
  // 育成（能力アップ / 能力獲得）
  // =========================================================

  const UP_STATS = [
    { key:'hp',     label:'体力'   },
    { key:'aim',    label:'エイム' },
    { key:'tech',   label:'技術'   },
    { key:'mental', label:'メンタル' }
  ];

  function baseCostForStat(statKey){
    if (statKey === 'hp')     return { muscle:10, tech:0,  mental:0 };
    if (statKey === 'aim')    return { muscle:4,  tech:4,  mental:2 };
    if (statKey === 'tech')   return { muscle:2,  tech:8,  mental:0 };
    if (statKey === 'mental') return { muscle:0,  tech:2,  mental:8 };
    return { muscle:0, tech:0, mental:0 };
  }

  // スキル定義（確定仕様）
  const SKILLS = [
    // IGL
    {
      id:'igl_inspire',
      role:'IGL',
      name:'閃きと輝き',
      cost:{ muscle:50, tech:50, mental:60 },
      baseChance: 1.0,
      trigger:'接敵時',
      type:'buff_team',
      baseEffect: 10,
      desc:'接敵時に発動。チーム全員のステータスを10%アップ。'
    },
    {
      id:'igl_control',
      role:'IGL',
      name:'空間制圧',
      cost:{ muscle:30, tech:60, mental:80 },
      baseChance: 0.5,
      trigger:'接敵時',
      type:'debuff_enemy_power',
      baseEffect: 5,
      desc:'接敵時に発動。敵チームの総合戦闘力を5ダウン。'
    },

    // Attacker
    {
      id:'atk_speedstar',
      role:'アタッカー',
      name:'スピードスター',
      cost:{ muscle:70, tech:20, mental:30 },
      baseChance: 1.0,
      trigger:'接敵時',
      type:'buff_self_aim',
      baseEffect: 20,
      desc:'接敵時に発動。自身のエイムが20%アップ。'
    },
    {
      id:'atk_physical',
      role:'アタッカー',
      name:'フィジカルモンスター',
      cost:{ muscle:90, tech:40, mental:60 },
      baseChance: 0.5,
      trigger:'マッチ開始時',
      type:'buff_match_aim',
      baseEffect: 50,
      desc:'マッチ開始時に発動。発動した試合中、エイムが50%アップ。'
    },

    // Support
    {
      id:'sup_shingan',
      role:'サポーター',
      name:'心眼',
      cost:{ muscle:20, tech:30, mental:40 },
      baseChance: 1.0,
      trigger:'マッチ開始時',
      type:'block_debuff',
      baseEffect: 100,
      desc:'マッチ開始時に発動。発動した試合でデバフイベントが発生しなくなる。'
    },
    {
      id:'sup_godcover',
      role:'サポーター',
      name:'神カバー',
      cost:{ muscle:30, tech:30, mental:20 },
      baseChance: 5.0,
      trigger:'接敵時',
      type:'buff_others',
      baseEffect: 5,
      desc:'接敵時に発動。自分以外の全能力を5%アップ。'
    }
  ];

  const SKILL_BY_ID = Object.fromEntries(SKILLS.map(s => [s.id, s]));

  // ===== UI injection =====
  let trainingUI = null;

  function findTeamPanel(){
    if (!T?.dom?.teamScreen) return null;
    return T.dom.teamScreen.querySelector?.('.teamPanel') || T.dom.teamScreen;
  }

  function createSectionTitle(text){
    const t = document.createElement('div');
    t.style.fontWeight = '1000';
    t.style.fontSize = '14px';
    t.style.opacity = '0.98';
    t.style.marginTop = '10px';
    t.textContent = text;
    return t;
  }

  function createSubText(text){
    const s = document.createElement('div');
    s.style.marginTop = '6px';
    s.style.fontSize = '12px';
    s.style.opacity = '0.92';
    s.style.lineHeight = '1.35';
    s.textContent = text;
    return s;
  }

  function createTabRow(){
    const row = document.createElement('div');
    row.style.display = 'grid';
    row.style.gridTemplateColumns = 'repeat(3, minmax(0, 1fr))';
    row.style.gap = '8px';
    row.style.marginTop = '10px';
    return row;
  }

  function createTabBtn(label, active){
    const b = document.createElement('button');
    b.type = 'button';
    b.style.border = '1px solid rgba(255,255,255,.16)';
    b.style.borderRadius = '12px';
    b.style.padding = '10px 10px';
    b.style.fontWeight = '1000';
    b.style.fontSize = '13px';
    b.style.cursor = 'pointer';
    b.style.touchAction = 'manipulation';
    b.style.background = active ? 'rgba(255,255,255,.86)' : 'rgba(255,255,255,.10)';
    b.style.color = active ? '#111' : '#fff';
    b.textContent = label;
    b.addEventListener('touchstart', ()=>{}, {passive:true});
    b.onmousedown = ()=>{};
    return b;
  }

  function createCard(){
    const c = document.createElement('div');
    c.style.borderRadius = '14px';
    c.style.padding = '12px';
    c.style.background = 'rgba(255,255,255,.10)';
    c.style.border = '1px solid rgba(255,255,255,.14)';
    return c;
  }

  function createMiniPill(text){
    const p = document.createElement('div');
    p.style.display = 'inline-block';
    p.style.padding = '4px 8px';
    p.style.borderRadius = '999px';
    p.style.fontSize = '11px';
    p.style.fontWeight = '1000';
    p.style.border = '1px solid rgba(255,255,255,.18)';
    p.style.background = 'rgba(0,0,0,.25)';
    p.style.opacity = '0.95';
    p.textContent = text;
    return p;
  }

  function createPrimaryBtn(text){
    const b = document.createElement('button');
    b.type = 'button';
    b.style.width = '100%';
    b.style.border = '1px solid rgba(255,255,255,.18)';
    b.style.borderRadius = '14px';
    b.style.padding = '12px 12px';
    b.style.fontWeight = '1000';
    b.style.fontSize = '14px';
    b.style.background = 'rgba(255,255,255,.86)';
    b.style.color = '#111';
    b.style.cursor = 'pointer';
    b.style.touchAction = 'manipulation';
    b.addEventListener('touchstart', ()=>{}, {passive:true});
    b.onmousedown = ()=>{};
    b.textContent = text;
    return b;
  }

  function createGhostBtn(text){
    const b = document.createElement('button');
    b.type = 'button';
    b.style.width = '100%';
    b.style.border = '1px solid rgba(255,255,255,.16)';
    b.style.borderRadius = '14px';
    b.style.padding = '12px 12px';
    b.style.fontWeight = '1000';
    b.style.fontSize = '14px';
    b.style.background = 'rgba(255,255,255,.10)';
    b.style.color = '#fff';
    b.style.cursor = 'pointer';
    b.style.touchAction = 'manipulation';
    b.addEventListener('touchstart', ()=>{}, {passive:true});
    b.onmousedown = ()=>{};
    b.textContent = text;
    return b;
  }

  function ensureTrainingUI(){
    if (!T) return null;

    const panel = findTeamPanel();
    if (!panel) return null;

    const existing = panel.querySelector?.('#teamTrainingSection');
    if (existing){
      trainingUI = {
        root: existing,
        memberTabs: existing.querySelector('.ttMemberTabs'),
        ptRow: existing.querySelector('.ttPointRow'),
        upArea: existing.querySelector('.ttUpArea'),
        skillArea: existing.querySelector('.ttSkillArea'),
        msg: existing.querySelector('.ttMsg')
      };
      return trainingUI;
    }

    const section = document.createElement('div');
    section.id = 'teamTrainingSection';
    section.style.marginTop = '12px';

    section.appendChild(createSectionTitle('育成（能力アップ / 能力獲得）'));
    section.appendChild(createSubText('タップで右に + が増えます。決定でまとめて反映します。足りない時は反映しません。'));

    const memberTabs = createTabRow();
    memberTabs.className = 'ttMemberTabs';
    section.appendChild(memberTabs);

    const ptRow = document.createElement('div');
    ptRow.className = 'ttPointRow';
    ptRow.style.display = 'flex';
    ptRow.style.flexWrap = 'wrap';
    ptRow.style.gap = '8px';
    ptRow.style.marginTop = '10px';
    section.appendChild(ptRow);

    const msg = document.createElement('div');
    msg.className = 'ttMsg';
    msg.style.marginTop = '8px';
    msg.style.fontSize = '12px';
    msg.style.lineHeight = '1.35';
    msg.style.opacity = '0.95';
    msg.style.display = 'none';
    msg.style.padding = '10px 10px';
    msg.style.borderRadius = '12px';
    msg.style.border = '1px solid rgba(255,255,255,.16)';
    msg.style.background = 'rgba(0,0,0,.25)';
    section.appendChild(msg);

    section.appendChild(createSectionTitle('能力アップ'));
    const upArea = document.createElement('div');
    upArea.className = 'ttUpArea';
    upArea.style.marginTop = '10px';
    section.appendChild(upArea);

    section.appendChild(createSectionTitle('能力獲得（スキル取得 / 強化）'));
    const skillArea = document.createElement('div');
    skillArea.className = 'ttSkillArea';
    skillArea.style.marginTop = '10px';
    section.appendChild(skillArea);

    panel.appendChild(section);

    trainingUI = { root: section, memberTabs, ptRow, upArea, skillArea, msg };
    return trainingUI;
  }

  function showMsg(text){
    const ui = ensureTrainingUI();
    if (!ui || !ui.msg) return;
    ui.msg.textContent = String(text || '');
    ui.msg.style.display = text ? 'block' : 'none';
  }

  // ===== pending state (not saved) =====
  let ttSelectedId = 'A';
  let pendingUp = {
    A: { hp:0, aim:0, tech:0, mental:0 },
    B: { hp:0, aim:0, tech:0, mental:0 },
    C: { hp:0, aim:0, tech:0, mental:0 }
  };
  let pendingSkill = { A:{}, B:{}, C:{} };

  function resetPending(){
    pendingUp = {
      A: { hp:0, aim:0, tech:0, mental:0 },
      B: { hp:0, aim:0, tech:0, mental:0 },
      C: { hp:0, aim:0, tech:0, mental:0 }
    };
    pendingSkill = { A:{}, B:{}, C:{} };
  }

  function getMemById(team, id){
    return (team?.members || []).find(m => String(m?.id) === String(id));
  }

  const PTS_KEYS = ['muscle','tech','mental'];
  const PTS_LABEL = { muscle:'筋力', tech:'技術力', mental:'精神力' };

  function formatPtsCost(cost){
    const parts = [];
    for (const k of PTS_KEYS){
      const v = Number(cost?.[k] || 0);
      if (v > 0) parts.push(`${PTS_LABEL[k]}${v}`);
    }
    return parts.join(' / ') || '0';
  }

  function calcStatCost(mem, statKey, addCount){
    const base = baseCostForStat(statKey);
    const cur = Number(mem?.upgradeCount?.[statKey] || 0);

    const sum = { muscle:0, tech:0, mental:0 };

    for (let i=0;i<addCount;i++){
      const inc = cur + i;
      for (const k of PTS_KEYS){
        const b = Number(base[k] || 0);
        if (b <= 0) continue;
        sum[k] += (b + inc);
      }
    }
    return sum;
  }

  function calcSkillCost(mem, skillId, addCount){
    const def = SKILL_BY_ID[skillId];
    if (!def) return { muscle:0, tech:0, mental:0 };

    const curPlus = T.clamp0to30(Number(mem?.skills?.[skillId]?.plus || 0));
    const sum = { muscle:0, tech:0, mental:0 };

    for (let i=0;i<addCount;i++){
      const p = curPlus + i;
      const inc2 = p * 2;
      for (const k of PTS_KEYS){
        const b = Number(def.cost?.[k] || 0);
        if (b <= 0) continue;
        sum[k] += (b + inc2);
      }
    }
    return sum;
  }

  function hasEnoughPts(mem, cost){
    for (const k of PTS_KEYS){
      const have = Number(mem?.points?.[k] || 0);
      const need = Number(cost?.[k] || 0);
      if (have < need) return false;
    }
    return true;
  }

  function consumePts(mem, cost){
    for (const k of PTS_KEYS){
      mem.points[k] = T.clamp0(Number(mem.points[k] || 0) - Number(cost?.[k] || 0));
    }
  }

  function applyPendingToTeam(team){
    const ids = ['A','B','C'];
    const totalCostByMem = {
      A:{muscle:0,tech:0,mental:0},
      B:{muscle:0,tech:0,mental:0},
      C:{muscle:0,tech:0,mental:0}
    };

    // 1) cost集計
    for (const id of ids){
      const mem = getMemById(team, id);
      if (!mem) continue;

      for (const s of ['hp','aim','tech','mental']){
        const add = Number(pendingUp?.[id]?.[s] || 0);
        if (add > 0){
          const c = calcStatCost(mem, s, add);
          for (const k of PTS_KEYS) totalCostByMem[id][k] += c[k];
        }
      }

      const pmap = pendingSkill[id] || {};
      for (const sid in pmap){
        const add = Number(pmap[sid] || 0);
        if (add > 0){
          const c = calcSkillCost(mem, sid, add);
          for (const k of PTS_KEYS) totalCostByMem[id][k] += c[k];
        }
      }
    }

    // 2) 不足判定（誰か1人でも不足なら全員反映しない）
    for (const id of ids){
      const mem = getMemById(team, id);
      if (!mem) continue;
      if (!hasEnoughPts(mem, totalCostByMem[id])){
        return { ok:false, reason:'ポイントが足りません' };
      }
    }

    // 3) 反映
    for (const id of ids){
      const mem = getMemById(team, id);
      if (!mem) continue;

      consumePts(mem, totalCostByMem[id]);

      for (const s of ['hp','aim','tech','mental']){
        const add = Number(pendingUp?.[id]?.[s] || 0);
        if (add <= 0) continue;

        mem.stats = mem.stats || {};
        mem.stats[s] = T.clamp0to99(Number(mem.stats[s] || 0) + add);
        mem.upgradeCount[s] = T.clamp(Number(mem.upgradeCount[s] || 0) + add, 0, 999999);
      }

      mem.skills = mem.skills || {};
      const pmap = pendingSkill[id] || {};
      for (const sid in pmap){
        const add = Number(pmap[sid] || 0);
        if (add <= 0) continue;

        if (!mem.skills[sid]) mem.skills[sid] = { plus:0 };
        const cur = T.clamp0to30(Number(mem.skills[sid].plus || 0));
        const next = T.clamp0to30(cur + add);
        mem.skills[sid].plus = next;
      }
    }

    return { ok:true };
  }

  function formatChance(def, plus){
    const base = Number(def?.baseChance || 0);
    const p = T.clamp0to30(Number(plus || 0));
    const v = Math.min(100, base + p);
    return `${v.toFixed(1)}%`;
  }

  function formatEffect(def, plus){
    const base = Number(def?.baseEffect || 0);
    const p = T.clamp0to30(Number(plus || 0));
    const v = base + p;
    if (def?.type === 'block_debuff'){
      return 'デバフイベント発生なし';
    }
    return `${v}%`;
  }

  function renderPtsRow(mem){
    const ui = ensureTrainingUI();
    if (!ui || !ui.ptRow) return;
    ui.ptRow.innerHTML = '';

    for (const k of PTS_KEYS){
      const pill = createMiniPill(`${PTS_LABEL[k]}：${Number(mem?.points?.[k] || 0)}`);
      ui.ptRow.appendChild(pill);
    }
  }

  function renderMemberTabs(team){
    const ui = ensureTrainingUI();
    if (!ui || !ui.memberTabs) return;

    ui.memberTabs.innerHTML = '';

    const ids = ['A','B','C'];
    ids.forEach(id=>{
      const mem = getMemById(team, id);
      const name = T.getMemberNameById(id);
      const role = T.getMemberRole(mem);
      const label = role ? `${name}（${role}）` : name;

      const btn = createTabBtn(label, ttSelectedId === id);
      btn.addEventListener('click', ()=>{
        ttSelectedId = id;
        showMsg('');
        render();
      });
      ui.memberTabs.appendChild(btn);
    });
  }

  function renderUpArea(team){
    const ui = ensureTrainingUI();
    if (!ui || !ui.upArea) return;

    ui.upArea.innerHTML = '';

    const mem = getMemById(team, ttSelectedId);
    if (!mem) return;

    const card = createCard();

    const head = document.createElement('div');
    head.style.display = 'flex';
    head.style.justifyContent = 'space-between';
    head.style.alignItems = 'baseline';
    head.style.gap = '10px';

    const left = document.createElement('div');
    left.style.fontWeight = '1000';
    left.style.fontSize = '14px';
    left.textContent = `${T.getMemberNameById(mem.id)}：能力アップ`;

    const right = document.createElement('div');
    right.style.display = 'flex';
    right.style.gap = '6px';
    right.style.flexWrap = 'wrap';
    right.appendChild(createMiniPill('上限 99'));
    right.appendChild(createMiniPill('必要：+1ずつ増加'));

    head.appendChild(left);
    head.appendChild(right);
    card.appendChild(head);

    const note = document.createElement('div');
    note.style.marginTop = '8px';
    note.style.fontSize = '12px';
    note.style.opacity = '0.92';
    note.style.lineHeight = '1.35';
    note.textContent = 'タップで + を保留します。決定でまとめて反映します。';
    card.appendChild(note);

    const list = document.createElement('div');
    list.style.marginTop = '10px';
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '10px';

    UP_STATS.forEach(st=>{
      const row = document.createElement('div');
      row.style.display = 'grid';
      row.style.gridTemplateColumns = '1fr auto';
      row.style.gap = '10px';
      row.style.alignItems = 'center';

      const info = document.createElement('div');

      const curVal = T.clamp0to99(Number(mem?.stats?.[st.key] || 0));
      const pend = Number(pendingUp?.[mem.id]?.[st.key] || 0);
      const after = T.clamp0to99(curVal + pend);

      const line1 = document.createElement('div');
      line1.style.fontWeight = '1000';
      line1.style.fontSize = '13px';
      line1.textContent = `${st.label}：${curVal}  →  ${after}${pend>0 ? `（+${pend}）` : ''}`;

      const c1 = pend > 0 ? calcStatCost(mem, st.key, pend) : { muscle:0, tech:0, mental:0 };
      const base = baseCostForStat(st.key);

      const line2 = document.createElement('div');
      line2.style.marginTop = '4px';
      line2.style.fontSize = '12px';
      line2.style.opacity = '0.92';
      line2.textContent = `基礎：${formatPtsCost(base)} / 保留分コスト：${pend>0 ? formatPtsCost(c1) : '0'}`;

      info.appendChild(line1);
      info.appendChild(line2);

      const btnCol = document.createElement('div');
      btnCol.style.display = 'flex';
      btnCol.style.flexDirection = 'column';
      btnCol.style.gap = '6px';
      btnCol.style.minWidth = '120px';

      const plusBtn = createGhostBtn('＋1');
      plusBtn.style.padding = '10px 10px';
      plusBtn.addEventListener('click', ()=>{
        const cur = T.clamp0to99(Number(mem?.stats?.[st.key] || 0));
        const pendNow = Number(pendingUp?.[mem.id]?.[st.key] || 0);
        if (cur + pendNow >= 99){
          showMsg('ステータス上限（99）です。');
          return;
        }
        pendingUp[mem.id][st.key] = pendNow + 1;
        showMsg('');
        render();
      });

      const minusBtn = createGhostBtn('－1');
      minusBtn.style.padding = '10px 10px';
      minusBtn.addEventListener('click', ()=>{
        const pendNow = Number(pendingUp?.[mem.id]?.[st.key] || 0);
        if (pendNow <= 0) return;
        pendingUp[mem.id][st.key] = pendNow - 1;
        showMsg('');
        render();
      });

      const pendTag = document.createElement('div');
      pendTag.style.textAlign = 'right';
      pendTag.style.fontSize = '12px';
      pendTag.style.fontWeight = '1000';
      pendTag.style.opacity = '0.95';
      pendTag.textContent = pend > 0 ? `保留：+${pend}` : '保留：0';

      btnCol.appendChild(plusBtn);
      btnCol.appendChild(minusBtn);
      btnCol.appendChild(pendTag);

      row.appendChild(info);
      row.appendChild(btnCol);
      list.appendChild(row);
    });

    card.appendChild(list);

    const btns = document.createElement('div');
    btns.style.marginTop = '12px';
    btns.style.display = 'grid';
    btns.style.gridTemplateColumns = '1fr 1fr';
    btns.style.gap = '10px';

    const btnCommit = createPrimaryBtn('決定（保留を反映）');
    btnCommit.addEventListener('click', ()=>{
      const team2 = T.clone(team);
      T.ensureTeamMeta(team2);

      const res = applyPendingToTeam(team2);
      if (!res.ok){
        showMsg(res.reason || 'ポイントが足りません');
        return;
      }

      T.writePlayerTeam(team2);
      resetPending();
      showMsg('反映しました。');

      T.renderTeamPower();
      T.render();
    });

    const btnClear = createGhostBtn('保留をクリア');
    btnClear.addEventListener('click', ()=>{
      resetPending();
      showMsg('保留をクリアしました。');
      render();
    });

    btns.appendChild(btnCommit);
    btns.appendChild(btnClear);
    card.appendChild(btns);

    ui.upArea.appendChild(card);
  }

  function renderSkillArea(team){
    const ui = ensureTrainingUI();
    if (!ui || !ui.skillArea) return;

    ui.skillArea.innerHTML = '';

    const mem = getMemById(team, ttSelectedId);
    if (!mem) return;

    const card = createCard();

    const head = document.createElement('div');
    head.style.display = 'flex';
    head.style.justifyContent = 'space-between';
    head.style.alignItems = 'baseline';
    head.style.gap = '10px';

    const left = document.createElement('div');
    left.style.fontWeight = '1000';
    left.style.fontSize = '14px';
    left.textContent = `${T.getMemberNameById(mem.id)}：能力獲得（スキル）`;

    const right = document.createElement('div');
    right.style.display = 'flex';
    right.style.gap = '6px';
    right.style.flexWrap = 'wrap';
    right.appendChild(createMiniPill('上限 +30'));
    right.appendChild(createMiniPill('必要：+2ずつ増加'));

    head.appendChild(left);
    head.appendChild(right);
    card.appendChild(head);

    const note = document.createElement('div');
    note.style.marginTop = '8px';
    note.style.fontSize = '12px';
    note.style.opacity = '0.92';
    note.style.lineHeight = '1.35';
    note.textContent = '取得/強化は + を保留し、決定でまとめて反映します。';
    card.appendChild(note);

    const role = T.getMemberRole(mem);

    const list = document.createElement('div');
    list.style.marginTop = '10px';
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '10px';

    const skills = SKILLS.filter(s => !role || s.role === role);
    if (!skills.length){
      const none = document.createElement('div');
      none.style.opacity = '0.92';
      none.style.fontSize = '13px';
      none.textContent = 'このメンバーのロールに対応するスキルがありません。';
      list.appendChild(none);
    }

    skills.forEach(def=>{
      const row = document.createElement('div');
      row.style.borderRadius = '12px';
      row.style.padding = '12px';
      row.style.background = 'rgba(0,0,0,.18)';
      row.style.border = '1px solid rgba(255,255,255,.14)';

      const top = document.createElement('div');
      top.style.display = 'flex';
      top.style.justifyContent = 'space-between';
      top.style.alignItems = 'baseline';
      top.style.gap = '10px';

      const name = document.createElement('div');
      name.style.fontWeight = '1000';
      name.style.fontSize = '14px';
      name.textContent = def.name;

      const tag = document.createElement('div');
      tag.style.display = 'flex';
      tag.style.gap = '6px';
      tag.style.flexWrap = 'wrap';
      tag.appendChild(createMiniPill(def.role));
      tag.appendChild(createMiniPill(def.trigger));

      top.appendChild(name);
      top.appendChild(tag);

      const curPlus = T.clamp0to30(Number(mem?.skills?.[def.id]?.plus || 0));
      const pend = T.clamp0to30(Number((pendingSkill[mem.id] || {})[def.id] || 0));
      const nextPlus = T.clamp0to30(curPlus + pend);

      const line1 = document.createElement('div');
      line1.style.marginTop = '8px';
      line1.style.fontSize = '12px';
      line1.style.opacity = '0.95';
      line1.textContent = def.desc;

      const chanceText = formatChance(def, nextPlus);
      const effText = formatEffect(def, nextPlus);
      const resetNote = (def.trigger === '接敵時') ? '（交戦後リセット）' : '';

      const line2 = document.createElement('div');
      line2.style.marginTop = '6px';
      line2.style.fontSize = '12px';
      line2.style.opacity = '0.95';
      line2.textContent =
        `現在：+${curPlus} → +${nextPlus}${pend>0 ? `（保留+${pend}）` : ''} / 発動率：${chanceText} / 効果：${effText} ${resetNote}`;

      const costNow = calcSkillCost(mem, def.id, 1);
      const costPend = pend > 0 ? calcSkillCost(mem, def.id, pend) : { muscle:0, tech:0, mental:0 };

      const line3 = document.createElement('div');
      line3.style.marginTop = '6px';
      line3.style.fontSize = '12px';
      line3.style.opacity = '0.92';
      line3.textContent =
        `取得/強化コスト（次+1）：${formatPtsCost(costNow)} / 保留分コスト：${pend>0 ? formatPtsCost(costPend) : '0'}`;

      const btnRow = document.createElement('div');
      btnRow.style.marginTop = '10px';
      btnRow.style.display = 'grid';
      btnRow.style.gridTemplateColumns = '1fr 1fr';
      btnRow.style.gap = '8px';

      const btnPlus = createGhostBtn('＋1');
      btnPlus.style.padding = '10px 10px';
      btnPlus.addEventListener('click', ()=>{
        const cur = T.clamp0to30(Number(mem?.skills?.[def.id]?.plus || 0));
        const pendNow = T.clamp0to30(Number((pendingSkill[mem.id] || {})[def.id] || 0));
        if (cur + pendNow >= 30){
          showMsg('スキル強化上限（+30）です。');
          return;
        }
        pendingSkill[mem.id] = pendingSkill[mem.id] || {};
        pendingSkill[mem.id][def.id] = pendNow + 1;
        showMsg('');
        render();
      });

      const btnMinus = createGhostBtn('－1');
      btnMinus.style.padding = '10px 10px';
      btnMinus.addEventListener('click', ()=>{
        const pendNow = T.clamp0to30(Number((pendingSkill[mem.id] || {})[def.id] || 0));
        if (pendNow <= 0) return;
        pendingSkill[mem.id][def.id] = pendNow - 1;
        showMsg('');
        render();
      });

      btnRow.appendChild(btnPlus);
      btnRow.appendChild(btnMinus);

      row.appendChild(top);
      row.appendChild(line1);
      row.appendChild(line2);
      row.appendChild(line3);
      row.appendChild(btnRow);

      list.appendChild(row);
    });

    card.appendChild(list);

    const btns = document.createElement('div');
    btns.style.marginTop = '12px';
    btns.style.display = 'grid';
    btns.style.gridTemplateColumns = '1fr 1fr';
    btns.style.gap = '10px';

    const btnCommit = createPrimaryBtn('決定（保留を反映）');
    btnCommit.addEventListener('click', ()=>{
      const team2 = T.clone(team);
      T.ensureTeamMeta(team2);

      const res = applyPendingToTeam(team2);
      if (!res.ok){
        showMsg(res.reason || 'ポイントが足りません');
        return;
      }

      T.writePlayerTeam(team2);
      resetPending();
      showMsg('反映しました。');

      T.renderTeamPower();
      T.render();
    });

    const btnClear = createGhostBtn('保留をクリア');
    btnClear.addEventListener('click', ()=>{
      resetPending();
      showMsg('保留をクリアしました。');
      render();
    });

    btns.appendChild(btnCommit);
    btns.appendChild(btnClear);
    card.appendChild(btns);

    ui.skillArea.appendChild(card);
  }

  function render(){
    if (!T) return;

    const team = T.migrateAndPersistTeam();
    const mem = getMemById(team, ttSelectedId) || getMemById(team, 'A');
    if (!mem) return;

    renderMemberTabs(team);
    renderPtsRow(mem);
    renderUpArea(team);
    renderSkillArea(team);
  }

  // 外部公開（core から呼ぶ）
  window.MOBBR.uiTeamTraining.render = render;

})();
