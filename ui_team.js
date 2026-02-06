'use strict';

/*
  MOB BR - ui_team.js v13

  目的：
  - チーム画面（#teamScreen）の中身を「確定仕様ベース」で実装
    1) 現在のメンバー（メイン）
       - 名前（タップで変更）
       - 能力ステータス（数値表示OK）
         体力 / メンタル / エイム / 敏捷性 / 技術 / サポート / 探知
       - パッシブ（文章）
       - ウルト（文章）
       - ※「％、勝率、補正値」は一切表示しない

    2) コーチスキル（装備枠）
       - 最大5枠
       - できるのは「装備／解除」だけ
       - 効果数値は非表示（文章だけ）

    3) 戦績（終了した大会のみ表示）
       - 大会名 / 総合順位 / 総合ポイント
       - 年間キル数（全員）/ 年間アシスト数（全員）
       - 年末企業ランク

    4) セーブ
       - 手動セーブ
       - セーブ削除（全リセット→タイトルへ→名称設定からやり直し）

  前提：
  - data_player.js が先に読み込まれていること（window.MOBBR.data.player）
  - HTMLに #teamScreen, #btnTeam, #btnCloseTeam, #tCompany/#tTeam/#tM1/#tM2/#tM3 が存在
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){
  // ===== Storage Keys（app.jsと同じ）=====
  const K = {
    company: 'mobbr_company',
    team: 'mobbr_team',
    m1: 'mobbr_m1',
    m2: 'mobbr_m2',
    m3: 'mobbr_m3',

    // 追加：チーム詳細（ステータス等）
    playerTeam: 'mobbr_playerTeam',           // JSON（存在しなければ data_player.js から生成）
    coachSkillsOwned: 'mobbr_coachSkillsOwned', // JSON 配列（文章のみ）※将来ガチャ等で増える想定
    records: 'mobbr_records',                 // JSON 配列（終了大会のみ表示）
    save1: 'mobbr_save1'                      // 手動セーブ1枠（まずは1枠でOK）
  };

  const $ = (id) => document.getElementById(id);

  const dom = {
    btnTeam: $('btnTeam'),
    teamScreen: $('teamScreen'),
    btnCloseTeam: $('btnCloseTeam'),
    teamPanel: $('teamScreen') ? $('teamScreen').querySelector('.teamPanel') : null,
    teamBody: $('teamScreen') ? $('teamScreen').querySelector('.teamBody') : null,

    // 既存（上部に出してる簡易表示）も残す：render時に更新
    tCompany: $('tCompany'),
    tTeam: $('tTeam'),
    tM1: $('tM1'),
    tM2: $('tM2'),
    tM3: $('tM3')
  };

  // data_player.js
  const DP = window.MOBBR?.data?.player;
  if (!DP){
    // data_player.js が無いと成立しないので、落とさずに静かに抜ける
    console.warn('[ui_team] data_player.js not found');
    return;
  }

  // ===== utils =====
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

  function ensurePlayerTeam(){
    // 既にあればそれを使う
    let team = getJSON(K.playerTeam, null);
    if (team && team.members && Array.isArray(team.members)) return team;

    // なければデフォルト生成
    team = DP.buildDefaultTeam();

    // 名前はローカルストレージの m1/m2/m3 を優先（UI統一）
    const nm1 = getStr(K.m1, '○○○');
    const nm2 = getStr(K.m2, '○○○');
    const nm3 = getStr(K.m3, '○○○');

    // membersは A/B/C 固定で入る想定。slot順で適用
    const bySlot = [...team.members].sort((a,b)=> (a.slot||0)-(b.slot||0));
    if (bySlot[0]) bySlot[0].name = nm1;
    if (bySlot[1]) bySlot[1].name = nm2;
    if (bySlot[2]) bySlot[2].name = nm3;

    // statsを正規化
    team.members = team.members.map(m => ({
      ...m,
      stats: DP.normalizeStats(m.stats)
    }));

    setJSON(K.playerTeam, team);
    return team;
  }

  function syncNamesToStorage(team){
    // teamの名前を m1/m2/m3 に同期（app.js 側の表示とも一致させる）
    const bySlot = [...team.members].sort((a,b)=> (a.slot||0)-(b.slot||0));
    if (bySlot[0]) setStr(K.m1, bySlot[0].name || getStr(K.m1,'○○○'));
    if (bySlot[1]) setStr(K.m2, bySlot[1].name || getStr(K.m2,'○○○'));
    if (bySlot[2]) setStr(K.m3, bySlot[2].name || getStr(K.m3,'○○○'));
  }

  function updateHeaderQuick(team){
    const company = getStr(K.company, 'CB Memory');
    const tname = getStr(K.team, 'PLAYER TEAM');
    const bySlot = [...team.members].sort((a,b)=> (a.slot||0)-(b.slot||0));

    if (dom.tCompany) dom.tCompany.textContent = company;
    if (dom.tTeam) dom.tTeam.textContent = tname;
    if (dom.tM1) dom.tM1.textContent = (bySlot[0]?.name ?? getStr(K.m1,'○○○'));
    if (dom.tM2) dom.tM2.textContent = (bySlot[1]?.name ?? getStr(K.m2,'○○○'));
    if (dom.tM3) dom.tM3.textContent = (bySlot[2]?.name ?? getStr(K.m3,'○○○'));
  }

  // ===== UI builders =====
  function clearBody(){
    if (!dom.teamBody) return;
    dom.teamBody.innerHTML = '';
  }

  function el(tag, cls, text){
    const n = document.createElement(tag);
    if (cls) n.className = cls;
    if (text !== undefined) n.textContent = text;
    return n;
  }

  function buildTabs(){
    const wrap = el('div', 'teamTabs');
    const tabs = [
      { key:'members', label:'メンバー' },
      { key:'coach',   label:'コーチスキル' },
      { key:'records', label:'戦績' },
      { key:'save',    label:'セーブ' }
    ];

    tabs.forEach(t=>{
      const b = el('button', 'teamTabBtn', t.label);
      b.type = 'button';
      b.dataset.tab = t.key;
      b.addEventListener('click', ()=>{
        setActiveTab(t.key);
      });
      wrap.appendChild(b);
    });

    return wrap;
  }

  function setActiveTab(key){
    const tabs = dom.teamBody.querySelectorAll('.teamTabBtn');
    tabs.forEach(b => b.classList.toggle('on', b.dataset.tab === key));

    const panels = dom.teamBody.querySelectorAll('.teamTabPanel');
    panels.forEach(p => p.style.display = (p.dataset.tab === key) ? 'block' : 'none');
  }

  function buildMembersPanel(team){
    const panel = el('div', 'teamTabPanel');
    panel.dataset.tab = 'members';

    const note = el('div', 'teamSectionNote', '※％・勝率・補正値は表示しません');
    note.style.opacity = '0.9';
    note.style.fontSize = '12px';
    panel.appendChild(note);

    const bySlot = [...team.members].sort((a,b)=> (a.slot||0)-(b.slot||0));
    bySlot.forEach((m)=>{
      const card = el('div', 'memberCard');

      // header row
      const head = el('div', 'memberHead');
      const left = el('div', 'memberHeadLeft');
      const right = el('div', 'memberHeadRight');

      const role = el('div', 'memberRole', `${m.id}（${m.role}）`);
      const nameBtn = el('button', 'memberNameBtn', (m.name || m.displayNameDefault || '○○○'));
      nameBtn.type = 'button';
      nameBtn.addEventListener('click', ()=>{
        const cur = (m.name || '○○○');
        const v = prompt('メンバー名を変更', cur);
        if (v === null) return;
        const nv = v.trim();
        if (!nv) return;
        m.name = nv;
        setJSON(K.playerTeam, team);
        syncNamesToStorage(team);
        render(); // 全体再描画
      });

      left.appendChild(role);
      right.appendChild(nameBtn);
      head.appendChild(left);
      head.appendChild(right);

      card.appendChild(head);

      // stats grid
      const stats = DP.normalizeStats(m.stats);
      const grid = el('div', 'memberStatsGrid');

      DP.STAT_KEYS.forEach(k=>{
        const row = el('div', 'statRow');
        const lab = el('div', 'statLabel', DP.STAT_LABEL[k] || k);
        const val = el('div', 'statVal', String(stats[k]));
        row.appendChild(lab);
        row.appendChild(val);
        grid.appendChild(row);
      });

      card.appendChild(grid);

      // passive / ult
      const p = el('div', 'skillLine');
      p.appendChild(el('div', 'skillLabel', 'パッシブ'));
      p.appendChild(el('div', 'skillText', m.passive || '未定'));

      const u = el('div', 'skillLine');
      u.appendChild(el('div', 'skillLabel', 'ウルト'));
      u.appendChild(el('div', 'skillText', m.ult || '未定'));

      card.appendChild(p);
      card.appendChild(u);

      panel.appendChild(card);
    });

    return panel;
  }

  function ensureCoachOwned(){
    const owned = getJSON(K.coachSkillsOwned, null);
    if (Array.isArray(owned)) return owned;
    // まだ何もない段階は空でOK
    setJSON(K.coachSkillsOwned, []);
    return [];
  }

  function buildCoachPanel(team){
    const panel = el('div', 'teamTabPanel');
    panel.dataset.tab = 'coach';

    const info = el('div', 'teamSectionNote',
      '最大5枠。できるのは「装備／解除」だけ。効果数値は表示しません（文章のみ）。'
    );
    panel.appendChild(info);

    const owned = ensureCoachOwned();

    // equipped（最大5）
    if (!team.coachSkills || !Array.isArray(team.coachSkills.equipped)){
      team.coachSkills = { maxSlots: 5, equipped: [null,null,null,null,null] };
    }
    while (team.coachSkills.equipped.length < 5) team.coachSkills.equipped.push(null);
    if (team.coachSkills.equipped.length > 5) team.coachSkills.equipped = team.coachSkills.equipped.slice(0,5);

    const slotsWrap = el('div', 'coachSlots');

    for (let i=0;i<5;i++){
      const cur = team.coachSkills.equipped[i];
      const b = el('button', 'coachSlotBtn', cur ? `SLOT${i+1}: ${cur}` : `SLOT${i+1}: 空`);
      b.type = 'button';

      b.addEventListener('click', ()=>{
        // 解除
        if (team.coachSkills.equipped[i]){
          if (!confirm(`このスキルを解除しますか？\n\n${team.coachSkills.equipped[i]}`)) return;
          team.coachSkills.equipped[i] = null;
          setJSON(K.playerTeam, team);
          render();
          return;
        }

        // 装備（候補がなければ文章入力で追加→装備）
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

        // 既存候補から選ぶ（簡易：番号選択）
        const list = owned.map((t,idx)=> `${idx+1}) ${t}`).join('\n');
        const pick = prompt(`装備するスキル番号を入力\n\n${list}`, '1');
        if (pick === null) return;
        const n = Number(pick);
        if (!Number.isFinite(n) || n < 1 || n > owned.length) return;

        team.coachSkills.equipped[i] = owned[n-1];
        setJSON(K.playerTeam, team);
        render();
      });

      slotsWrap.appendChild(b);
    }

    panel.appendChild(slotsWrap);

    // owned list（今後ガチャで増える想定のため表示だけ）
    const ownedTitle = el('div', 'teamSectionNote', '所持スキル（文章のみ）');
    ownedTitle.style.marginTop = '12px';
    panel.appendChild(ownedTitle);

    const ownedBox = el('div', 'ownedSkillsBox');
    if (!owned.length){
      ownedBox.appendChild(el('div', 'ownedSkillItem', '（未所持）'));
    }else{
      owned.forEach((t)=>{
        ownedBox.appendChild(el('div', 'ownedSkillItem', t));
      });
    }
    panel.appendChild(ownedBox);

    return panel;
  }

  function ensureRecords(){
    const rec = getJSON(K.records, null);
    if (Array.isArray(rec)) return rec;
    setJSON(K.records, []);
    return [];
  }

  function buildRecordsPanel(){
    const panel = el('div', 'teamTabPanel');
    panel.dataset.tab = 'records';

    const info = el('div', 'teamSectionNote', '※終了した大会のみ表示（未参加／途中敗退は非表示）');
    panel.appendChild(info);

    const all = ensureRecords();
    const finished = all.filter(r => r && r.finished === true);

    if (!finished.length){
      panel.appendChild(el('div', 'recordEmpty', '（表示できる戦績がありません）'));
      return panel;
    }

    finished.forEach((r)=>{
      const card = el('div', 'recordCard');

      const title = el('div', 'recordTitle', r.tourName || '大会');
      card.appendChild(title);

      const line1 = el('div', 'recordLine', `総合順位：${r.totalRank ?? '—'} / 総合ポイント：${r.totalPoint ?? '—'}`);
      card.appendChild(line1);

      // 年間キル/アシスト（全員）
      const line2 = el('div', 'recordLine',
        `年間キル数（全員）：${r.yearKillsAll ?? '—'} / 年間アシスト数（全員）：${r.yearAssistsAll ?? '—'}`
      );
      card.appendChild(line2);

      const line3 = el('div', 'recordLine', `年末企業ランク：${r.yearEndCompanyRank ?? '—'}`);
      card.appendChild(line3);

      panel.appendChild(card);
    });

    return panel;
  }

  function buildSavePanel(){
    const panel = el('div', 'teamTabPanel');
    panel.dataset.tab = 'save';

    const info = el('div', 'teamSectionNote', '手動セーブ／セーブ削除（全リセット→タイトルへ）');
    panel.appendChild(info);

    const btnSave = el('button', 'saveBtn', '手動セーブ');
    btnSave.type = 'button';
    btnSave.addEventListener('click', ()=>{
      const snapshot = exportSnapshot();
      setJSON(K.save1, snapshot);
      alert('セーブしました。');
    });

    const btnDelete = el('button', 'saveDeleteBtn', 'セーブ削除（全リセット）');
    btnDelete.type = 'button';
    btnDelete.addEventListener('click', ()=>{
      if (!confirm('セーブ削除すると、スケジュール/名前/戦績/持ち物/育成など全てリセットされます。\n本当に実行しますか？')) return;
      fullResetToTitle();
    });

    panel.appendChild(btnSave);
    panel.appendChild(btnDelete);

    const note = el('div', 'teamSectionNote',
      '※タイトル画面：白×緑チェック背景 + rogo.png + NEXT（他は表示しない）\n※NEXTでメインへ'
    );
    note.style.whiteSpace = 'pre-line';
    note.style.marginTop = '10px';
    panel.appendChild(note);

    return panel;
  }

  // ===== Snapshot / Reset =====
  function exportSnapshot(){
    const snapshot = {
      version: 'v13',
      ts: Date.now(),
      company: getStr(K.company, 'CB Memory'),
      team: getStr(K.team, 'PLAYER TEAM'),
      m1: getStr(K.m1, '○○○'),
      m2: getStr(K.m2, '○○○'),
      m3: getStr(K.m3, '○○○'),
      playerTeam: getJSON(K.playerTeam, ensurePlayerTeam()),
      coachSkillsOwned: getJSON(K.coachSkillsOwned, []),
      records: getJSON(K.records, [])
    };
    return snapshot;
  }

  function fullResetToTitle(){
    // mobbr_ で始まるものを全部消す（他プロジェクトに触らない）
    const keys = [];
    for (let i=0; i<localStorage.length; i++){
      const k = localStorage.key(i);
      if (!k) continue;
      if (k.startsWith('mobbr_')) keys.push(k);
    }
    keys.forEach(k => localStorage.removeItem(k));

    // タイトルへ戻す（titleScreen があればそれを表示）
    const title = $('titleScreen');
    const app = $('app');

    if (title && app){
      app.style.display = 'none';
      title.style.display = 'block';
    }else{
      // タイトルDOMがまだ無い場合はページ再読み込みでOK
      location.reload();
    }
  }

  // ===== Render =====
  function injectLocalStylesOnce(){
    if (document.getElementById('teamUiStylesV13')) return;
    const st = document.createElement('style');
    st.id = 'teamUiStylesV13';
    st.textContent = `
      /* ui_team.js v13 内部スタイル（既存レイアウトは崩さず、中身だけ整える） */
      .teamTabs{ display:flex; gap:8px; flex-wrap:wrap; margin-bottom:10px; }
      .teamTabBtn{
        border:0; border-radius:12px; padding:10px 12px;
        background: rgba(255,255,255,.12); color:#fff; font-weight:1000;
        touch-action: manipulation;
      }
      .teamTabBtn.on{ background: rgba(255,255,255,.9); color:#111; text-shadow:none; }
      .teamTabBtn:active{ transform: translateY(1px); opacity:.95; }

      .teamSectionNote{ font-size:13px; opacity:.92; }

      .memberCard{
        margin-top:12px;
        border-radius:14px;
        background: rgba(255,255,255,.08);
        border: 1px solid rgba(255,255,255,.18);
        padding: 12px;
      }
      .memberHead{ display:flex; align-items:center; justify-content:space-between; gap:10px; }
      .memberRole{ font-size:14px; font-weight:1000; opacity:.95; }
      .memberNameBtn{
        border:0; border-radius:12px; padding:10px 12px;
        background: rgba(255,255,255,.9); color:#111; font-weight:1000;
        touch-action: manipulation;
      }
      .memberNameBtn:active{ transform: translateY(1px); opacity:.95; }

      .memberStatsGrid{
        margin-top:10px;
        display:grid;
        grid-template-columns: 1fr 1fr;
        gap: 8px 10px;
      }
      .statRow{
        display:flex; align-items:center; justify-content:space-between;
        background: rgba(0,0,0,.25);
        border-radius: 10px;
        padding: 8px 10px;
      }
      .statLabel{ font-size:13px; opacity:.92; }
      .statVal{ font-size:14px; font-weight:1000; }

      .skillLine{
        margin-top:10px;
        display:flex; gap:10px; align-items:flex-start;
        background: rgba(0,0,0,.22);
        border-radius: 12px;
        padding: 10px;
      }
      .skillLabel{ min-width: 70px; font-size:13px; opacity:.92; }
      .skillText{ font-size:13px; font-weight:1000; line-height:1.35; }

      .coachSlots{ margin-top:10px; display:flex; flex-direction:column; gap:8px; }
      .coachSlotBtn{
        width:100%;
        border:0; border-radius:12px; padding:12px 12px;
        background: rgba(255,255,255,.12); color:#fff; font-weight:1000;
        text-align:left;
        touch-action: manipulation;
      }
      .coachSlotBtn:active{ transform: translateY(1px); opacity:.95; }
      .ownedSkillsBox{ margin-top:8px; display:flex; flex-direction:column; gap:6px; }
      .ownedSkillItem{
        background: rgba(0,0,0,.22);
        border-radius: 10px;
        padding: 8px 10px;
        font-size: 13px;
        font-weight: 1000;
      }

      .recordEmpty{ margin-top:12px; font-size:14px; opacity:.9; }
      .recordCard{
        margin-top:12px;
        border-radius:14px;
        background: rgba(255,255,255,.08);
        border: 1px solid rgba(255,255,255,.18);
        padding: 12px;
      }
      .recordTitle{ font-size:16px; font-weight:1000; margin-bottom:8px; }
      .recordLine{ font-size:13px; font-weight:1000; opacity:.96; line-height:1.35; }

      .saveBtn, .saveDeleteBtn{
        width:100%;
        border:0; border-radius:12px;
        padding: 12px 12px;
        font-weight:1000;
        touch-action: manipulation;
        margin-top: 10px;
      }
      .saveBtn{
        background: rgba(255,255,255,.9);
        color:#111;
        text-shadow:none;
      }
      .saveDeleteBtn{
        background: rgba(255, 80, 80, .9);
        color:#111;
        text-shadow:none;
      }
      .saveBtn:active, .saveDeleteBtn:active{ transform: translateY(1px); opacity:.95; }
    `;
    document.head.appendChild(st);
  }

  function render(){
    if (!dom.teamBody) return;

    injectLocalStylesOnce();

    const team = ensurePlayerTeam();
    updateHeaderQuick(team);

    clearBody();

    // ここから中身を確定仕様で構築
    const tabs = buildTabs();
    dom.teamBody.appendChild(tabs);

    const pMembers = buildMembersPanel(team);
    const pCoach = buildCoachPanel(team);
    const pRecords = buildRecordsPanel();
    const pSave = buildSavePanel();

    dom.teamBody.appendChild(pMembers);
    dom.teamBody.appendChild(pCoach);
    dom.teamBody.appendChild(pRecords);
    dom.teamBody.appendChild(pSave);

    setActiveTab('members');
  }

  // ===== Open/Close hooks =====
  function open(){
    // app.js 側が show を付けている前提でも、念のため
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

  function bind(){
    if (dom.btnTeam){
      dom.btnTeam.addEventListener('click', ()=>{
        // app.js でも showTeamScreen() が走るが、ここでも中身だけ保証
        // （二重でも副作用なし）
        open();
      });
    }
    if (dom.btnCloseTeam){
      dom.btnCloseTeam.addEventListener('click', close);
    }
  }

  // ===== export =====
  window.MOBBR.ui.team = { open, close, render };

  document.addEventListener('DOMContentLoaded', ()=>{
    bind();
    // 初期化だけ（画面は開かない）
    ensurePlayerTeam();
  });

})();
