'use strict';

/*
  ui_team.js v13
  - メンバー名の正は localStorage(mobbr_m1/m2/m3)
  - render() で playerTeam JSON にも同期して保存（ズレ防止）
  - チームで名前変更したら、メインにも必ず反映（initMainUI を呼ぶ）
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){
  const $ = (id) => document.getElementById(id);

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

  const DP = window.MOBBR?.data?.player;
  if (!DP){
    console.warn('[ui_team] data_player.js not found');
    return;
  }

  const dom = {
    btnTeam: $('btnTeam'),
    teamScreen: $('teamScreen'),
    btnCloseTeam: $('btnCloseTeam'),

    tCompany: $('tCompany'),
    tTeam: $('tTeam'),

    tNameA: $('tNameA'),
    tNameB: $('tNameB'),
    tNameC: $('tNameC'),

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

    slotBtns: [ $('slot1'), $('slot2'), $('slot3'), $('slot4'), $('slot5') ],
    slotName: [ $('slot1Name'), $('slot2Name'), $('slot3Name'), $('slot4Name'), $('slot5Name') ],
    slotDesc: [ $('slot1Desc'), $('slot2Desc'), $('slot3Desc'), $('slot4Desc'), $('slot5Desc') ],

    recordsEmpty: $('recordsEmpty'),
    recordsList: $('recordsList'),

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

  function syncNamesFromStorageIntoTeam(team){
    // ★これが肝：メインで変更した名前を、チームJSONにも毎回同期してズレを消す
    const nm1 = getStr(K.m1, 'A');
    const nm2 = getStr(K.m2, 'B');
    const nm3 = getStr(K.m3, 'C');

    const bySlot = [...team.members].sort((a,b)=> (a.slot||0)-(b.slot||0));
    if (bySlot[0]) bySlot[0].name = nm1;
    if (bySlot[1]) bySlot[1].name = nm2;
    if (bySlot[2]) bySlot[2].name = nm3;

    setJSON(K.playerTeam, team);
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

    // ここで常に同期（メイン変更を確実に反映）
    syncNamesFromStorageIntoTeam(team);

    if (dom.tCompany) dom.tCompany.textContent = getStr(K.company, 'CB Memory');
    if (dom.tTeam) dom.tTeam.textContent = getStr(K.team, 'PLAYER TEAM');

    const bySlot = [...team.members].sort((a,b)=> (a.slot||0)-(b.slot||0));
    writeMemberToDom(bySlot[0], dom.tNameA, dom.tA);
    writeMemberToDom(bySlot[1], dom.tNameB, dom.tB);
    writeMemberToDom(bySlot[2], dom.tNameC, dom.tC);

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

    // records（終了のみ）
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

  let bound = false;

  function bind(){
    if (bound) return;
    bound = true;

    if (dom.btnTeam) dom.btnTeam.addEventListener('click', open);
    if (dom.btnCloseTeam) dom.btnCloseTeam.addEventListener('click', close);

    function bindRename(nameBtn, storageKey){
      if (!nameBtn) return;

      nameBtn.addEventListener('click', ()=>{
        const cur = getStr(storageKey, '○○○');
        const v = prompt('メンバー名を変更', cur);
        if (v === null) return;
        const nv = v.trim();
        if (!nv) return;

        // 正は m1/m2/m3
        setStr(storageKey, nv);

        // 即同期＆保存
        const team = ensurePlayerTeam();
        syncNamesFromStorageIntoTeam(team);

        // メインにも反映
        if (window.MOBBR?.initMainUI) window.MOBBR.initMainUI();

        render();
      });
    }

    bindRename(dom.tNameA, K.m1);
    bindRename(dom.tNameB, K.m2);
    bindRename(dom.tNameC, K.m3);

    // coach slots
    for (let i=0;i<5;i++){
      const btn = dom.slotBtns[i];
      if (!btn) continue;

      btn.addEventListener('click', ()=>{
        const team = ensurePlayerTeam();
        const owned = ensureCoachOwned();

        const cur = team.coachSkills.equipped[i];

        if (cur){
          if (!confirm(`このスキルを解除しますか？\n\n${cur}`)) return;
          team.coachSkills.equipped[i] = null;
          setJSON(K.playerTeam, team);
          render();
          return;
        }

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

        const keys = [];
        for (let i=0; i<localStorage.length; i++){
          const k = localStorage.key(i);
          if (!k) continue;
          if (k.startsWith('mobbr_')) keys.push(k);
        }
        keys.forEach(k => localStorage.removeItem(k));

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

  initTeamUI();
})();
