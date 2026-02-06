'use strict';

/*
  MOB BR - ui_team.js v13
  app.js の loadScript() で「NEXT後に読み込まれる」前提。
  → DOMContentLoaded に依存せず、initTeamUI() を公開して即実行。

  ※あなたの index.html の teamScreen は “完成HTML” が既にある。
  なので .teamBody を探して作り直す方式は捨てて、
  既存IDへ値を流し込む方式に変更。
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){
  const $ = (id) => document.getElementById(id);

  // ---- storage keys ----
  const K = {
    company: 'mobbr_company',
    team: 'mobbr_team',
    m1: 'mobbr_m1',
    m2: 'mobbr_m2',
    m3: 'mobbr_m3',

    playerTeam: 'mobbr_playerTeam',
    coachSkillsOwned: 'mobbr_coachSkillsOwned',
    records: 'mobbr_records',
    save1: 'mobbr_save1'
  };

  function getStr(key, def){
    const v = localStorage.getItem(key);
    return (v === null || v === undefined || v === '') ? def : v;
  }
  function setStr(key, val){ localStorage.setItem(key, String(val)); }

  function getJSON(key, def){
    try{
      const raw = localStorage.getItem(key);
      if (!raw) return def;
      return JSON.parse(raw);
    }catch(e){
      return def;
    }
  }
  function setJSON(key, obj){
    localStorage.setItem(key, JSON.stringify(obj));
  }

  // data_player.js
  const DP = window.MOBBR?.data?.player;
  if (!DP){
    console.warn('[ui_team] data_player.js not found');
    return;
  }

  // ---- DOM ----
  const dom = {
    // open/close
    btnTeam: $('btnTeam'),
    teamScreen: $('teamScreen'),
    btnCloseTeam: $('btnCloseTeam'),

    // meta
    tCompany: $('tCompany'),
    tTeam: $('tTeam'),

    // names
    tNameA: $('tNameA'),
    tNameB: $('tNameB'),
    tNameC: $('tNameC'),

    // stats
    tA: {
      hp:$('tA_hp'), mental:$('tA_mental'), aim:$('tA_aim'), agi:$('tA_agi'),
      tech:$('tA_tech'), support:$('tA_support'), scan:$('tA_scan'),
      passive:$('tA_passive'), ult:$('tA_ult')
    },
    tB: {
      hp:$('tB_hp'), mental:$('tB_mental'), aim:$('tB_aim'), agi:$('tB_agi'),
      tech:$('tB_tech'), support:$('tB_support'), scan:$('tB_scan'),
      passive:$('tB_passive'), ult:$('tB_ult')
    },
    tC: {
      hp:$('tC_hp'), mental:$('tC_mental'), aim:$('tC_aim'), agi:$('tC_agi'),
      tech:$('tC_tech'), support:$('tC_support'), scan:$('tC_scan'),
      passive:$('tC_passive'), ult:$('tC_ult')
    },

    // coach slots
    slotBtns: [ $('slot1'), $('slot2'), $('slot3'), $('slot4'), $('slot5') ],
    slotName: [ $('slot1Name'), $('slot2Name'), $('slot3Name'), $('slot4Name'), $('slot5Name') ],
    slotDesc: [ $('slot1Desc'), $('slot2Desc'), $('slot3Desc'), $('slot4Desc'), $('slot5Desc') ],

    // records
    recordsEmpty: $('recordsEmpty'),
    recordsList: $('recordsList'),

    // save
    btnManualSave: $('btnManualSave'),
    btnDeleteSave: $('btnDeleteSave')
  };

  function ensurePlayerTeam(){
    let team = getJSON(K.playerTeam, null);
    if (team && Array.isArray(team.members)) return team;

    team = DP.buildDefaultTeam();

    // 初期名は localStorage を優先
    const nm1 = getStr(K.m1, 'A');
    const nm2 = getStr(K.m2, 'B');
    const nm3 = getStr(K.m3, 'C');

    const bySlot = [...team.members].sort((a,b)=> (a.slot||0)-(b.slot||0));
    if (bySlot[0]) bySlot[0].name = nm1;
    if (bySlot[1]) bySlot[1].name = nm2;
    if (bySlot[2]) bySlot[2].name = nm3;

    team.members = team.members.map(m => ({ ...m, stats: DP.normalizeStats(m.stats) }));
    setJSON(K.playerTeam, team);
    return team;
  }

  function syncNamesToStorage(team){
    const bySlot = [...team.members].sort((a,b)=> (a.slot||0)-(b.slot||0));
    if (bySlot[0]) setStr(K.m1, bySlot[0].name || getStr(K.m1,'A'));
    if (bySlot[1]) setStr(K.m2, bySlot[1].name || getStr(K.m2,'B'));
    if (bySlot[2]) setStr(K.m3, bySlot[2].name || getStr(K.m3,'C'));
  }

  function ensureCoachOwned(){
    const owned = getJSON(K.coachSkillsOwned, null);
    if (Array.isArray(owned)) return owned;
    setJSON(K.coachSkillsOwned, []);
    return [];
  }

  function ensureRecords(){
    const rec = getJSON(K.records, null);
    if (Array.isArray(rec)) return rec;
    setJSON(K.records, []);
    return [];
  }

  function writeMemberToDom(member, nameBtn, t){
    if (!member) return;

    const stats = DP.normalizeStats(member.stats);
    if (nameBtn) nameBtn.textContent = member.name || member.displayNameDefault || '○○○';

    if (t.hp) t.hp.textContent = String(stats.hp);
    if (t.mental) t.mental.textContent = String(stats.mental);
    if (t.aim) t.aim.textContent = String(stats.aim);
    if (t.agi) t.agi.textContent = String(stats.agi);
    if (t.tech) t.tech.textContent = String(stats.tech);
    if (t.support) t.support.textContent = String(stats.support);
    if (t.scan) t.scan.textContent = String(stats.scan);

    if (t.passive) t.passive.textContent = member.passive || '未定';
    if (t.ult) t.ult.textContent = member.ult || '未定';
  }

  function render(){
    const team = ensurePlayerTeam();

    // meta
    if (dom.tCompany) dom.tCompany.textContent = getStr(K.company, 'CB Memory');
    if (dom.tTeam) dom.tTeam.textContent = getStr(K.team, 'PLAYER TEAM');

    const bySlot = [...team.members].sort((a,b)=> (a.slot||0)-(b.slot||0));
    const A = bySlot[0];
    const B = bySlot[1];
    const C = bySlot[2];

    writeMemberToDom(A, dom.tNameA, dom.tA);
    writeMemberToDom(B, dom.tNameB, dom.tB);
    writeMemberToDom(C, dom.tNameC, dom.tC);

    // coach slots
    if (!team.coachSkills || !Array.isArray(team.coachSkills.equipped)){
      team.coachSkills = { maxSlots: 5, equipped: [null,null,null,null,null] };
    }
    while (team.coachSkills.equipped.length < 5) team.coachSkills.equipped.push(null);
    if (team.coachSkills.equipped.length > 5) team.coachSkills.equipped = team.coachSkills.equipped.slice(0,5);

    for (let i=0;i<5;i++){
      const cur = team.coachSkills.equipped[i];
      if (dom.slotName[i]) dom.slotName[i].textContent = cur ? String(cur) : '未装備';
      if (dom.slotDesc[i]) dom.slotDesc[i].textContent = cur ? 'タップで解除' : '装備／解除のみ（効果数値は非表示）';
    }

    // records（終了した大会のみ表示）
    const all = ensureRecords();
    const finished = all.filter(r => r && r.finished === true);

    if (dom.recordsList) dom.recordsList.innerHTML = '';
    if (dom.recordsEmpty){
      dom.recordsEmpty.style.display = finished.length ? 'none' : 'block';
    }

    if (dom.recordsList && finished.length){
      finished.forEach((r)=>{
        const card = document.createElement('div');
        card.className = 'recordCard';
        card.innerHTML = `
          <div class="recordTitle">${(r.tourName || '大会')}</div>
          <div class="recordLine">総合順位：${(r.totalRank ?? '—')} / 総合ポイント：${(r.totalPoint ?? '—')}</div>
          <div class="recordLine">年間キル数（全員）：${(r.yearKillsAll ?? '—')} / 年間アシスト数（全員）：${(r.yearAssistsAll ?? '—')}</div>
          <div class="recordLine">年末企業ランク：${(r.yearEndCompanyRank ?? '—')}</div>
        `;
        dom.recordsList.appendChild(card);
      });
    }
  }

  function open(){
    if (dom.teamScreen){
      dom.teamScreen.classList.add('show');
      dom.teamScreen.setAttribute('aria-hidden', 'false');
    }
    render();
  }

  function close(){
    if (dom.teamScreen){
      dom.teamScreen.classList.remove('show');
      dom.teamScreen.setAttribute('aria-hidden', 'true');
    }
  }

  // ---- events ----
  let bound = false;

  function bind(){
    if (bound) return;
    bound = true;

    // open/close
    if (dom.btnTeam) dom.btnTeam.addEventListener('click', open);
    if (dom.btnCloseTeam) dom.btnCloseTeam.addEventListener('click', close);

    // rename member
    function bindRename(nameBtn, slotIndex){
      if (!nameBtn) return;
      nameBtn.addEventListener('click', ()=>{
        const team = ensurePlayerTeam();
        const bySlot = [...team.members].sort((a,b)=> (a.slot||0)-(b.slot||0));
        const m = bySlot[slotIndex];
        if (!m) return;

        const cur = m.name || m.displayNameDefault || '○○○';
        const v = prompt('メンバー名を変更', cur);
        if (v === null) return;
        const nv = v.trim();
        if (!nv) return;

        m.name = nv;
        setJSON(K.playerTeam, team);
        syncNamesToStorage(team);

        // ui_main 側の表示も更新
        if (window.MOBBR?.initMainUI) window.MOBBR.initMainUI();

        render();
      });
    }

    bindRename(dom.tNameA, 0);
    bindRename(dom.tNameB, 1);
    bindRename(dom.tNameC, 2);

    // coach slots
    for (let i=0;i<5;i++){
      const btn = dom.slotBtns[i];
      if (!btn) continue;

      btn.addEventListener('click', ()=>{
        const team = ensurePlayerTeam();
        const owned = ensureCoachOwned();

        const cur = team.coachSkills.equipped[i];

        // 解除
        if (cur){
          if (!confirm(`このスキルを解除しますか？\n\n${cur}`)) return;
          team.coachSkills.equipped[i] = null;
          setJSON(K.playerTeam, team);
          render();
          return;
        }

        // 装備（所持が無いなら文章追加→装備）
        if (!owned.length){
          const v = prompt('装備するコーチスキル（文章）を入力', '（例）戦闘開始時にチームの集中力が上がる');
          if (v === null) return;
          const nv = v.trim();
          if (!nv) return;
          owned.push(nv);
          setJSON(K.coachSkillsOwned, owned);
          team.coachSkills.equipped[i] = nv;
          setJSON(K.playerTeam, team);
          render();
          return;
        }

        // 既存から番号選択
        const list = owned.map((t,idx)=> `${idx+1}) ${t}`).join('\n');
        const pick = prompt(`装備するスキル番号を入力\n\n${list}`, '1');
        if (pick === null) return;
        const n = Number(pick);
        if (!Number.isFinite(n) || n < 1 || n > owned.length) return;

        team.coachSkills.equipped[i] = owned[n-1];
        setJSON(K.playerTeam, team);
        render();
      });
    }

    // save
    if (dom.btnManualSave){
      dom.btnManualSave.addEventListener('click', ()=>{
        const snapshot = {
          version: 'v13',
          ts: Date.now(),
          company: getStr(K.company, 'CB Memory'),
          team: getStr(K.team, 'PLAYER TEAM'),
          m1: getStr(K.m1, 'A'),
          m2: getStr(K.m2, 'B'),
          m3: getStr(K.m3, 'C'),
          playerTeam: getJSON(K.playerTeam, ensurePlayerTeam()),
          coachSkillsOwned: getJSON(K.coachSkillsOwned, []),
          records: getJSON(K.records, [])
        };
        setJSON(K.save1, snapshot);
        alert('セーブしました。');
      });
    }

    if (dom.btnDeleteSave){
      dom.btnDeleteSave.addEventListener('click', ()=>{
        if (!confirm('セーブ削除すると、スケジュール/名前/戦績/持ち物/育成など全てリセットされます。\n本当に実行しますか？')) return;

        // mobbr_ のみ削除（他プロジェクトに触らない）
        const keys = [];
        for (let i=0; i<localStorage.length; i++){
          const k = localStorage.key(i);
          if (!k) continue;
          if (k.startsWith('mobbr_')) keys.push(k);
        }
        keys.forEach(k => localStorage.removeItem(k));

        // タイトルへ戻す
        window.dispatchEvent(new CustomEvent('mobbr:goTitle'));
      });
    }
  }

  function initTeamUI(){
    bind();
    ensurePlayerTeam();
    render();
  }

  window.MOBBR.initTeamUI = initTeamUI;
  window.MOBBR.ui.team = { open, close, render };

  // 動的ロードでも確実に起動
  initTeamUI();
})();
