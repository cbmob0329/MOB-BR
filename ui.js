/* =====================================================
   ui.js  (FULL)
   MOB Tournament Simulation
   UIポップアップ / メニュー表示 / 確認ダイアログ
   ===================================================== */

const UI = {};
window.UI = UI;

UI.dom = {
  overlay: document.getElementById('overlay'),
  popup: document.getElementById('popup'),
  popupContent: document.getElementById('popup-content'),
  popupClose: document.getElementById('popup-close'),
};

UI.init = function () {
  // 画面外タップで閉じる（基本ルール）
  UI.dom.overlay.addEventListener('click', () => UI.closePopup());
  UI.dom.popupClose.addEventListener('click', () => UI.closePopup());
};

/* =========================
   Popup Core
   ========================= */

UI.openPopup = function (html) {
  UI.dom.popupContent.innerHTML = html;
  UI.dom.overlay.classList.remove('hidden');
  UI.dom.popup.classList.remove('hidden');
};

UI.closePopup = function () {
  UI.dom.popupContent.innerHTML = '';
  UI.dom.overlay.classList.add('hidden');
  UI.dom.popup.classList.add('hidden');
};

UI.confirm = function (message, onYes, onNo) {
  const html = `
    <div style="font-weight:800; font-size:14px; margin-bottom:10px;">確認</div>
    <div style="margin-bottom:14px;">${UI.escapeHtml(message)}</div>
    <div style="display:flex; gap:10px;">
      <button id="ui_yes" style="${UI.btnStyle('primary')}">はい</button>
      <button id="ui_no" style="${UI.btnStyle('secondary')}">いいえ</button>
    </div>
  `;
  UI.openPopup(html);

  const yesBtn = document.getElementById('ui_yes');
  const noBtn = document.getElementById('ui_no');

  yesBtn.addEventListener('click', () => {
    UI.closePopup();
    if (typeof onYes === 'function') onYes();
  });

  noBtn.addEventListener('click', () => {
    UI.closePopup();
    if (typeof onNo === 'function') onNo();
  });
};

UI.toast = function (message) {
  // 軽量：ログへ流す（本格トーストは後で）
  if (window.Game && typeof Game.log === 'function') {
    Game.log(message);
  }
};

/* =========================
   Menus
   ========================= */

UI.openTeamMenu = function () {
  const html = `
    <div style="font-weight:900; font-size:15px; margin-bottom:10px;">チーム</div>

    <div style="display:grid; gap:10px;">
      <button class="ui-menu-btn" data-action="members">現在のメンバー</button>
      <button class="ui-menu-btn" data-action="edit">チーム編成</button>
      <button class="ui-menu-btn" data-action="record">戦績</button>
      <button class="ui-menu-btn" data-action="offer">プレイヤーオファー</button>
      <button class="ui-menu-btn" data-action="save">セーブ</button>
    </div>

    <style>
      .ui-menu-btn{
        width:100%;
        height:44px;
        border-radius:14px;
        border:1px solid rgba(255,255,255,0.12);
        background:rgba(255,255,255,0.08);
        color:#f3f4f6;
        font-weight:900;
        cursor:pointer;
      }
      .ui-menu-btn:active{ transform: scale(1.01); }
      .ui-subtitle{ font-weight:900; margin:10px 0 6px; }
      .ui-table{ width:100%; border-collapse:collapse; font-size:12px; }
      .ui-table th,.ui-table td{ border:1px solid rgba(255,255,255,0.12); padding:6px; }
      .ui-muted{ opacity:0.9; font-size:12px; }
    </style>
  `;
  UI.openPopup(html);

  UI.bindMenuButtons((action) => {
    if (action === 'members') UI.openTeamMembers();
    if (action === 'edit') UI.openTeamEdit();
    if (action === 'record') UI.openTeamRecord();
    if (action === 'offer') UI.openTeamOffer();
    if (action === 'save') UI.openSaveMenu();
  });
};

UI.openTournamentMenu = function () {
  const html = `
    <div style="font-weight:900; font-size:15px; margin-bottom:10px;">大会</div>

    <div style="display:grid; gap:10px;">
      <button class="ui-menu-btn" data-action="enter">大会に出場</button>
      <button class="ui-menu-btn" data-action="ongoing">参加中の大会</button>
      <button class="ui-menu-btn" data-action="results">大会結果</button>
      <button class="ui-menu-btn" data-action="schedule">スケジュール</button>
    </div>

    <div class="ui-muted" style="margin-top:10px;">
      ※大会期間中は修行ができません（ショップなどは利用可能）
    </div>

    <style>
      .ui-menu-btn{
        width:100%;
        height:44px;
        border-radius:14px;
        border:1px solid rgba(255,255,255,0.12);
        background:rgba(255,255,255,0.08);
        color:#f3f4f6;
        font-weight:900;
        cursor:pointer;
      }
      .ui-menu-btn:active{ transform: scale(1.01); }
      .ui-muted{ opacity:0.9; font-size:12px; }
    </style>
  `;
  UI.openPopup(html);

  UI.bindMenuButtons((action) => {
    if (action === 'enter') UI.openTournamentEnter();
    if (action === 'ongoing') UI.openTournamentOngoing();
    if (action === 'results') UI.openTournamentResults();
    if (action === 'schedule') UI.openTournamentSchedule();
  });
};

UI.openTrainingMenu = function () {
  // ここは「横スライドUI」が必要だが、まずは骨組み（後で強化）
  const html = `
    <div style="font-weight:900; font-size:15px; margin-bottom:10px;">修行</div>

    <div class="ui-muted" style="margin-bottom:10px;">
      まずは修行メニューの土台です。後で「横スライド＆中央強調」のUIに拡張します。
    </div>

    <div style="display:grid; gap:10px;">
      <button class="ui-menu-btn" data-action="syageki">射撃</button>
      <button class="ui-menu-btn" data-action="dash">ダッシュ</button>
      <button class="ui-menu-btn" data-action="paz">パズル</button>
      <button class="ui-menu-btn" data-action="zitugi">実戦</button>
      <button class="ui-menu-btn" data-action="taki">滝</button>
      <button class="ui-menu-btn" data-action="kenq">研究</button>
      <button class="ui-menu-btn" data-action="sougou">総合</button>
    </div>

    <div style="display:flex; gap:10px; margin-top:12px;">
      <button id="ui_nextweek" style="${UI.btnStyle('secondary')}">次の週へ</button>
      <button id="ui_close" style="${UI.btnStyle('secondary')}">戻る</button>
    </div>

    <style>
      .ui-menu-btn{
        width:100%;
        height:44px;
        border-radius:14px;
        border:1px solid rgba(255,255,255,0.12);
        background:rgba(255,255,255,0.08);
        color:#f3f4f6;
        font-weight:900;
        cursor:pointer;
      }
      .ui-menu-btn:active{ transform: scale(1.01); }
      .ui-muted{ opacity:0.9; font-size:12px; }
    </style>
  `;
  UI.openPopup(html);

  // 修行選択（後で「誰を派遣」へ繋ぐ）
  UI.bindMenuButtons((action) => {
    UI.toast(`修行「${UI.trainingName(action)}」を選択（派遣UIは後で実装）`);
  });

  document.getElementById('ui_nextweek').addEventListener('click', () => {
    UI.closePopup();
    if (window.Game && typeof Game.nextWeek === 'function') Game.nextWeek();
  });
  document.getElementById('ui_close').addEventListener('click', () => UI.closePopup());
};

UI.openShopMenu = function () {
  // 背景を shop.png に切り替えるのは assets.js 側で制御するが、
  // ここでは骨組みのみ（後で購入/ガチャ/個数選択を実装）
  const html = `
    <div style="font-weight:900; font-size:15px; margin-bottom:10px;">ショップ</div>

    <div class="ui-muted" style="margin-bottom:10px;">
      「いらっしゃいませ！」（購入処理は後で実装）
    </div>

    <div style="display:grid; gap:10px;">
      <button class="ui-menu-btn" data-action="buy">アイテムを購入</button>
      <button class="ui-menu-btn" data-action="coachgacha">コーチスキルガチャ</button>
    </div>

    <div style="display:flex; gap:10px; margin-top:12px;">
      <button id="ui_shop_close" style="${UI.btnStyle('secondary')}">閉じる</button>
    </div>

    <style>
      .ui-menu-btn{
        width:100%;
        height:44px;
        border-radius:14px;
        border:1px solid rgba(255,255,255,0.12);
        background:rgba(255,255,255,0.08);
        color:#f3f4f6;
        font-weight:900;
        cursor:pointer;
      }
      .ui-menu-btn:active{ transform: scale(1.01); }
      .ui-muted{ opacity:0.9; font-size:12px; }
    </style>
  `;
  UI.openPopup(html);

  // 背景切替（Assetsが用意されたら実体化）
  if (window.Assets && typeof Assets.setMainImage === 'function') {
    Assets.setMainImage('shop.png');
  }

  UI.bindMenuButtons((action) => {
    if (action === 'buy') UI.toast('アイテム購入（後で実装）');
    if (action === 'coachgacha') UI.toast('コーチスキルガチャ（後で実装）');
  });

  document.getElementById('ui_shop_close').addEventListener('click', () => {
    UI.closePopup();
    if (window.Assets && typeof Assets.setMainImage === 'function') {
      Assets.setMainImage('main1.png');
    }
  });
};

/* =========================
   Team Sub Screens
   ========================= */

UI.openTeamMembers = function () {
  const team = State.playerTeam;
  const members = team.members || [];

  const rows = members.map((m) => {
    const s = m.stats || {};
    return `
      <tr>
        <td>${UI.escapeHtml(m.name || '???')}</td>
        <td>${UI.n(s.HP)}</td>
        <td>${UI.n(s.Mental)}</td>
        <td>${UI.n(s.Move)}</td>
        <td>${UI.n(s.Aim)}</td>
        <td>${UI.n(s.Agility)}</td>
        <td>${UI.n(s.Technique)}</td>
        <td>${UI.n(s.Support)}</td>
        <td>${UI.n(s.Hunt)}</td>
      </tr>
    `;
  }).join('');

  const html = `
    <div class="ui-subtitle">現在のメンバー</div>
    <div class="ui-muted" style="margin-bottom:8px;">
      連携（Synergy）はチーム総合にのみ表示（後で拡張）
    </div>

    <table class="ui-table">
      <thead>
        <tr>
          <th>名前</th><th>HP</th><th>Mental</th><th>Move</th><th>Aim</th>
          <th>Agility</th><th>Technique</th><th>Support</th><th>Hunt</th>
        </tr>
      </thead>
      <tbody>
        ${rows || `<tr><td colspan="9">メンバー未設定</td></tr>`}
      </tbody>
    </table>

    <div style="margin-top:10px;" class="ui-muted">
      パッシブ／アビリティ／ウルト表示は data_players.js 側の実体に合わせて拡張します。
    </div>

    <div style="display:flex; gap:10px; margin-top:12px;">
      <button id="ui_back" style="${UI.btnStyle('secondary')}">戻る</button>
    </div>

    <style>
      .ui-subtitle{ font-weight:900; margin:0 0 6px; }
      .ui-table{ width:100%; border-collapse:collapse; font-size:12px; }
      .ui-table th,.ui-table td{ border:1px solid rgba(255,255,255,0.12); padding:6px; text-align:center; }
      .ui-muted{ opacity:0.9; font-size:12px; }
    </style>
  `;
  UI.openPopup(html);
  document.getElementById('ui_back').addEventListener('click', () => UI.openTeamMenu());
};

UI.openTeamEdit = function () {
  const html = `
    <div class="ui-subtitle">チーム編成</div>
    <div class="ui-muted">
      所属キャラ一覧 → 加える/外す/装備変更 は後で実装します。<br>
      まずは「3人1チーム」の枠組みを維持します。
    </div>

    <div style="margin-top:12px; display:flex; gap:10px;">
      <button id="ui_back" style="${UI.btnStyle('secondary')}">戻る</button>
    </div>

    <style>
      .ui-subtitle{ font-weight:900; margin:0 0 6px; }
      .ui-muted{ opacity:0.9; font-size:12px; line-height:1.5; }
    </style>
  `;
  UI.openPopup(html);
  document.getElementById('ui_back').addEventListener('click', () => UI.openTeamMenu());
};

UI.openTeamRecord = function () {
  const html = `
    <div class="ui-subtitle">戦績</div>
    <div class="ui-muted">
      年ごとの大会結果・個人キル/アシスト・年末企業ランク等をここに表示します。<br>
      まずは State に履歴が溜まる土台を作って、後で表示を増やします。
    </div>

    <div style="margin-top:12px; display:flex; gap:10px;">
      <button id="ui_back" style="${UI.btnStyle('secondary')}">戻る</button>
    </div>

    <style>
      .ui-subtitle{ font-weight:900; margin:0 0 6px; }
      .ui-muted{ opacity:0.9; font-size:12px; line-height:1.5; }
    </style>
  `;
  UI.openPopup(html);
  document.getElementById('ui_back').addEventListener('click', () => UI.openTeamMenu());
};

UI.openTeamOffer = function () {
  const html = `
    <div class="ui-subtitle">プレイヤーオファー</div>
    <div class="ui-muted">
      オファー可能キャラ一覧 → 詳細表示 → オファー確認 → 成功/失敗<br>
      ここは data_players.js のデータ確定後に実装を厚くします。
    </div>

    <div style="margin-top:12px; display:flex; gap:10px;">
      <button id="ui_back" style="${UI.btnStyle('secondary')}">戻る</button>
    </div>

    <style>
      .ui-subtitle{ font-weight:900; margin:0 0 6px; }
      .ui-muted{ opacity:0.9; font-size:12px; line-height:1.5; }
    </style>
  `;
  UI.openPopup(html);
  document.getElementById('ui_back').addEventListener('click', () => UI.openTeamMenu());
};

UI.openSaveMenu = function () {
  const html = `
    <div class="ui-subtitle">セーブ</div>
    <div class="ui-muted">
      セーブ／ロード／削除 を実装します（localStorage予定）。<br>
      まず State の整合が取れた段階で反映します。
    </div>

    <div style="margin-top:12px; display:flex; gap:10px;">
      <button id="ui_back" style="${UI.btnStyle('secondary')}">戻る</button>
    </div>

    <style>
      .ui-subtitle{ font-weight:900; margin:0 0 6px; }
      .ui-muted{ opacity:0.9; font-size:12px; line-height:1.5; }
    </style>
  `;
  UI.openPopup(html);
  document.getElementById('ui_back').addEventListener('click', () => UI.openTeamMenu());
};

/* =========================
   Tournament Sub Screens
   ========================= */

UI.openTournamentEnter = function () {
  // 現在週に大会があるかをチェック → Game側のトリガーと同様
  const ev = State.getTournamentAtCurrentTime();
  if (!ev) {
    UI.toast('今週は大会がありません');
    return;
  }

  UI.confirm(
    `大会「${ev.name}」に出発しますか？`,
    () => {
      UI.closePopup();
      if (window.Game && typeof Game.startTournament === 'function') Game.startTournament(ev);
    }
  );
};

UI.openTournamentOngoing = function () {
  const info = State.currentTournament || null;
  const html = `
    <div class="ui-subtitle">参加中の大会</div>
    <div class="ui-muted">
      ${info ? UI.escapeHtml(`大会名：${info.name}\n進行状況：${info.phase || '進行中'}\n総合順位：${info.rank || '---'}`) : '現在、参加中の大会はありません'}
    </div>

    <div style="margin-top:12px; display:flex; gap:10px;">
      <button id="ui_back" style="${UI.btnStyle('secondary')}">戻る</button>
    </div>

    <style>
      .ui-subtitle{ font-weight:900; margin:0 0 6px; }
      .ui-muted{ opacity:0.9; font-size:12px; line-height:1.5; white-space:pre-wrap; }
    </style>
  `;
  UI.openPopup(html);
  document.getElementById('ui_back').addEventListener('click', () => UI.openTournamentMenu());
};

UI.openTournamentResults = function () {
  const html = `
    <div class="ui-subtitle">大会結果</div>
    <div class="ui-muted">
      終了した大会のみ表示します。<br>
      ローカル：20チーム総合（1〜20位）<br>
      ナショナル／ワールド：40チーム総合（1〜40位）※スクロール表示
    </div>

    <div style="margin-top:12px; display:flex; gap:10px;">
      <button id="ui_back" style="${UI.btnStyle('secondary')}">戻る</button>
    </div>

    <style>
      .ui-subtitle{ font-weight:900; margin:0 0 6px; }
      .ui-muted{ opacity:0.9; font-size:12px; line-height:1.5; }
    </style>
  `;
  UI.openPopup(html);
  document.getElementById('ui_back').addEventListener('click', () => UI.openTournamentMenu());
};

UI.openTournamentSchedule = function () {
  const list = State.getScheduleText();
  const html = `
    <div class="ui-subtitle">スケジュール</div>
    <div class="ui-muted" style="white-space:pre-wrap;">${UI.escapeHtml(list)}</div>

    <div style="margin-top:12px; display:flex; gap:10px;">
      <button id="ui_back" style="${UI.btnStyle('secondary')}">戻る</button>
    </div>

    <style>
      .ui-subtitle{ font-weight:900; margin:0 0 6px; }
      .ui-muted{ opacity:0.9; font-size:12px; line-height:1.5; }
    </style>
  `;
  UI.openPopup(html);
  document.getElementById('ui_back').addEventListener('click', () => UI.openTournamentMenu());
};

/* =========================
   Helpers
   ========================= */

UI.bindMenuButtons = function (onAction) {
  const btns = UI.dom.popupContent.querySelectorAll('.ui-menu-btn');
  btns.forEach((b) => {
    b.addEventListener('click', () => {
      const action = b.getAttribute('data-action');
      if (typeof onAction === 'function') onAction(action);
    });
  });
};

UI.btnStyle = function (kind) {
  const base = `
    width:100%;
    height:44px;
    border-radius:14px;
    border:1px solid rgba(255,255,255,0.12);
    color:#f3f4f6;
    font-weight:900;
    cursor:pointer;
  `;
  if (kind === 'primary') {
    return base + `
      background: rgba(80,160,255,0.22);
    `;
  }
  return base + `
    background: rgba(255,255,255,0.08);
  `;
};

UI.escapeHtml = function (s) {
  return String(s)
    .replaceAll('&', '&amp;')
    .replaceAll('<', '&lt;')
    .replaceAll('>', '&gt;')
    .replaceAll('"', '&quot;')
    .replaceAll("'", '&#39;');
};

UI.n = function (v) {
  if (v === undefined || v === null || Number.isNaN(v)) return '-';
  return String(v);
};

UI.trainingName = function (key) {
  switch (key) {
    case 'syageki': return '射撃';
    case 'dash': return 'ダッシュ';
    case 'paz': return 'パズル';
    case 'zitugi': return '実戦';
    case 'taki': return '滝';
    case 'kenq': return '研究';
    case 'sougou': return '総合';
    default: return '不明';
  }
};
