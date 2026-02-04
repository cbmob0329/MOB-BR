/* =========================================================
   MOB BR - ui.js (FULL)
   - ログ表示（流れない：1ブロック切替）
   - AUTO / NEXT
   - 紙芝居画像演出（背景差し替え・軽いスライド）
   - ポップアップ共通処理（NEXTのみ）
========================================================= */

(function(){
  'use strict';

  const el = {
    bgImage: document.getElementById('bgImage'),
    messageText: document.getElementById('messageText'),
    autoBtn: document.getElementById('autoBtn'),
    nextBtn: document.getElementById('nextBtn'),

    playerTeamName: document.getElementById('playerTeamName'),
    enemyTeamName: document.getElementById('enemyTeamName'),
    playerImage: document.getElementById('playerImage'),
    enemyImage: document.getElementById('enemyImage'),
  };

  const UIState = {
    auto: false,
    autoMs: 3000,
    timer: null,

    // “表示ステップ”は1個ずつ進む（流れない）
    steps: [],
    idx: -1,

    // ポップアップ中は進行停止
    popupOpen: false,

    // NEXT連打防止
    locked: false,
  };

  /* =========================
     PUBLIC API
  ========================== */
  const UI = {
    setMessage,
    setAuto,
    next,
    showPopup,
    applySimUpdate,
    showResult,
  };

  window.UI = UI;

  /* =========================
     AUTO
  ========================== */
  function setAuto(on){
    UIState.auto = !!on;
    if(UIState.auto){
      scheduleAutoTick();
    }else{
      clearAutoTick();
    }
  }

  function scheduleAutoTick(){
    clearAutoTick();
    if(!UIState.auto) return;
    if(UIState.popupOpen) return;
    UIState.timer = setTimeout(() => {
      UIState.timer = null;
      next();
    }, UIState.autoMs);
  }

  function clearAutoTick(){
    if(UIState.timer){
      clearTimeout(UIState.timer);
      UIState.timer = null;
    }
  }

  /* =========================
     CORE DISPLAY
  ========================== */
  function setMessage(text){
    el.messageText.textContent = String(text ?? '');
  }

  function setBackground(src, anim){
    if(!src) return;
    if(anim){
      // 軽い紙芝居演出：左右スライドを交互に
      const cls = (Math.random() < 0.5) ? 'slide-left' : 'slide-right';
      el.bgImage.classList.remove('slide-left','slide-right');
      // 強制再計算（アニメ確実化）
      void el.bgImage.offsetWidth;
      el.bgImage.classList.add(cls);
    }
    el.bgImage.src = src;
  }

  function showEnemy(teamId, teamName){
    if(teamId){
      el.enemyImage.src = `assets/${teamId}.png`;
      el.enemyImage.style.opacity = 1;
    }
    if(teamName){
      el.enemyTeamName.textContent = teamName;
      el.enemyTeamName.style.opacity = 1;
    }else{
      el.enemyTeamName.style.opacity = 0;
    }
  }

  function hideEnemy(){
    el.enemyImage.style.opacity = 0;
    el.enemyTeamName.style.opacity = 0;
    el.enemyImage.src = '';
    el.enemyTeamName.textContent = '';
  }

  function showPlayerTeamName(name){
    el.playerTeamName.textContent = name || '';
    el.playerTeamName.style.opacity = name ? 1 : 0;
  }

  /* =========================
     STEP SYSTEM (流れないログ)
  ========================== */

  // step: {
  //   message: string,
  //   bg?: string,
  //   bgAnim?: boolean,
  //   playerTeamName?: string,
  //   enemy?: { teamId?: string, name?: string } | null,
  //   hideEnemy?: boolean
  // }
  function pushSteps(steps, reset=false){
    if(!Array.isArray(steps) || steps.length === 0) return;

    if(reset){
      UIState.steps = [];
      UIState.idx = -1;
    }
    for(const s of steps){
      UIState.steps.push(s);
    }

    // まだ何も表示していなければ1つ目へ
    if(UIState.idx < 0){
      next();
    }else{
      // AUTOなら次のtickを予約
      scheduleAutoTick();
    }
  }

  function next(){
    if(UIState.locked) return;
    if(UIState.popupOpen) return;

    // ステップが無いなら何もしない（app側がメインで処理）
    if(UIState.steps.length === 0){
      scheduleAutoTick();
      return;
    }

    UIState.locked = true;
    setTimeout(() => { UIState.locked = false; }, 80);

    UIState.idx++;

    // 最後まで行ったら停止（sim/app側が次を供給する）
    if(UIState.idx >= UIState.steps.length){
      UIState.idx = UIState.steps.length - 1;
      scheduleAutoTick();
      return;
    }

    const step = UIState.steps[UIState.idx];

    // 背景
    if(step.bg){
      setBackground(step.bg, !!step.bgAnim);
    }

    // チーム名
    if(step.playerTeamName !== undefined){
      showPlayerTeamName(step.playerTeamName);
    }

    // 敵
    if(step.hideEnemy){
      hideEnemy();
    }else if(step.enemy){
      showEnemy(step.enemy.teamId, step.enemy.name);
    }

    // メッセージ
    if(step.message !== undefined){
      setMessage(step.message);
    }

    scheduleAutoTick();
  }

  /* =========================
     POPUP (共通処理)
     - NEXTのみ
  ========================== */
  function showPopup(lines, onClose){
    UIState.popupOpen = true;
    clearAutoTick();

    const overlay = document.createElement('div');
    overlay.id = 'popupOverlay';

    const panel = document.createElement('div');
    panel.id = 'popupPanel';

    const body = document.createElement('div');
    body.id = 'popupBody';

    const btn = document.createElement('button');
    btn.id = 'popupNext';
    btn.textContent = 'NEXT';

    const arr = Array.isArray(lines) ? lines : [String(lines ?? '')];
    for(const line of arr){
      const p = document.createElement('div');
      p.className = 'popupLine';
      p.textContent = String(line ?? '');
      body.appendChild(p);
    }

    panel.appendChild(body);
    panel.appendChild(btn);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    // ポップアップは“中央ログと同一思想”：1画面、NEXTのみ
    btn.addEventListener('click', () => {
      overlay.remove();
      UIState.popupOpen = false;
      if(typeof onClose === 'function') onClose();
      scheduleAutoTick();
    }, { once:true });

    injectPopupStyleOnce();
  }

  let _popupStyleInjected = false;
  function injectPopupStyleOnce(){
    if(_popupStyleInjected) return;
    _popupStyleInjected = true;

    const style = document.createElement('style');
    style.textContent = `
#popupOverlay{
  position:fixed; inset:0;
  display:flex; align-items:center; justify-content:center;
  background:rgba(0,0,0,.72);
  z-index:9999;
  padding: 16px;
}
#popupPanel{
  width:min(92vw, 560px);
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.16);
  background: linear-gradient(180deg, rgba(10,12,18,.92), rgba(10,12,18,.78));
  box-shadow: 0 14px 34px rgba(0,0,0,.6);
  overflow:hidden;
}
#popupBody{
  padding: 18px 16px 14px;
  text-align:center;
}
.popupLine{
  font-weight: 900;
  font-size: 16px;
  line-height: 1.4;
  color: #e5e7eb;
  text-shadow: 0 2px 10px rgba(0,0,0,.4);
  margin: 6px 0;
  word-break: keep-all;
}
#popupNext{
  width:100%;
  height: 52px;
  border: 0;
  border-top: 1px solid rgba(255,255,255,.12);
  background: rgba(20,24,32,.9);
  color: #e5e7eb;
  font-weight: 900;
  letter-spacing: .05em;
}
#popupNext:active{ transform: translateY(1px); }
    `;
    document.head.appendChild(style);
  }

  /* =========================
     SIM UPDATE APPLY
     - sim.js から渡される update を“表示ステップ”に変換して取り込む
  ========================== */
  function applySimUpdate(update){
    if(!update) return;

    // 1) steps配列で来る場合（推奨）
    if(Array.isArray(update.steps) && update.steps.length){
      pushSteps(update.steps, !!update.reset);
      return;
    }

    // 2) 単発更新（簡易）
    const step = {
      message: update.message ?? '',
      bg: update.bg ?? null,
      bgAnim: !!update.bgAnim,
      playerTeamName: update.playerTeamName,
      hideEnemy: !!update.hideEnemy,
      enemy: update.enemy ? { teamId: update.enemy.teamId, name: update.enemy.name } : null,
    };

    pushSteps([step], false);
  }

  /* =========================
     RESULT DISPLAY
     - resultは battle.png 背景で“順位表”を表示する想定
     - 表示はUIで行い、NEXTで閉じる
  ========================== */
  function showResult(result, onClose){
    // result: { type:'match'|'tournament', title, rows:[], noteLines:[] }
    // rows: [{rank, teamName, kp, ap, treasure, flag, total, placementP}]
    // ※ここでは「テーブル表示」するが“内部%”は出さない

    UIState.popupOpen = true;
    clearAutoTick();

    // 背景を battle に寄せる（表示責務のみ）
    if(result && result.bg){
      setBackground(result.bg, true);
    }

    const overlay = document.createElement('div');
    overlay.id = 'resultOverlay';

    const panel = document.createElement('div');
    panel.id = 'resultPanel';

    const head = document.createElement('div');
    head.id = 'resultHead';
    head.textContent = String(result?.title ?? 'RESULT');

    const body = document.createElement('div');
    body.id = 'resultBody';

    // noteLines（任意）
    const notes = Array.isArray(result?.noteLines) ? result.noteLines : [];
    if(notes.length){
      const noteBox = document.createElement('div');
      noteBox.className = 'resultNoteBox';
      for(const n of notes){
        const line = document.createElement('div');
        line.className = 'resultNote';
        line.textContent = String(n ?? '');
        noteBox.appendChild(line);
      }
      body.appendChild(noteBox);
    }

    // table
    const table = document.createElement('table');
    table.id = 'resultTable';

    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th>順位</th>
        <th>Squad</th>
        <th>KP</th>
        <th>AP</th>
        <th>Treasure</th>
        <th>Flag</th>
        <th>Total</th>
        <th>PlacementP</th>
      </tr>
    `;

    const tbody = document.createElement('tbody');
    const rows = Array.isArray(result?.rows) ? result.rows : [];
    for(const r of rows){
      const tr = document.createElement('tr');
      tr.innerHTML = `
        <td>${safe(r.rank)}</td>
        <td class="squad">${safe(r.teamName)}</td>
        <td>${safe(r.kp)}</td>
        <td>${safe(r.ap)}</td>
        <td>${safe(r.treasure)}</td>
        <td>${safe(r.flag)}</td>
        <td>${safe(r.total)}</td>
        <td>${safe(r.placementP)}</td>
      `;
      tbody.appendChild(tr);
    }

    table.appendChild(thead);
    table.appendChild(tbody);
    body.appendChild(table);

    const btn = document.createElement('button');
    btn.id = 'resultNext';
    btn.textContent = 'NEXT';

    panel.appendChild(head);
    panel.appendChild(body);
    panel.appendChild(btn);
    overlay.appendChild(panel);
    document.body.appendChild(overlay);

    btn.addEventListener('click', () => {
      overlay.remove();
      UIState.popupOpen = false;
      // ステップをクリア（result後は次のフェーズに移る）
      UIState.steps = [];
      UIState.idx = -1;

      if(typeof onClose === 'function') onClose();
      scheduleAutoTick();
    }, { once:true });

    injectResultStyleOnce();
  }

  function safe(v){
    if(v === null || v === undefined) return '';
    return String(v);
  }

  let _resultStyleInjected = false;
  function injectResultStyleOnce(){
    if(_resultStyleInjected) return;
    _resultStyleInjected = true;

    const style = document.createElement('style');
    style.textContent = `
#resultOverlay{
  position:fixed; inset:0;
  display:flex; align-items:center; justify-content:center;
  background:rgba(0,0,0,.72);
  z-index:9999;
  padding: 14px;
}
#resultPanel{
  width:min(96vw, 860px);
  max-height: 86svh;
  display:flex;
  flex-direction:column;
  border-radius: 14px;
  border: 1px solid rgba(255,255,255,.16);
  background: linear-gradient(180deg, rgba(10,12,18,.95), rgba(10,12,18,.78));
  box-shadow: 0 14px 34px rgba(0,0,0,.62);
  overflow:hidden;
}
#resultHead{
  padding: 12px 14px;
  font-weight: 1000;
  letter-spacing: .06em;
  border-bottom: 1px solid rgba(255,255,255,.12);
}
#resultBody{
  padding: 12px 12px;
  overflow:auto;
}
.resultNoteBox{
  border: 1px solid rgba(255,255,255,.12);
  border-radius: 12px;
  background: rgba(0,0,0,.35);
  padding: 10px 10px;
  margin-bottom: 10px;
}
.resultNote{
  font-weight: 800;
  font-size: 13px;
  color: #e5e7eb;
  margin: 4px 0;
}
#resultTable{
  width:100%;
  border-collapse: collapse;
  font-size: 12px;
}
#resultTable th, #resultTable td{
  padding: 8px 8px;
  border-bottom: 1px solid rgba(255,255,255,.10);
  text-align:center;
  white-space: nowrap;
}
#resultTable th{
  position: sticky;
  top: 0;
  background: rgba(0,0,0,.55);
  backdrop-filter: blur(6px);
  z-index: 1;
}
#resultTable td.squad{
  text-align:left;
  font-weight: 900;
}
#resultNext{
  width:100%;
  height: 52px;
  border: 0;
  border-top: 1px solid rgba(255,255,255,.12);
  background: rgba(20,24,32,.9);
  color: #e5e7eb;
  font-weight: 1000;
  letter-spacing: .05em;
}
#resultNext:active{ transform: translateY(1px); }
    `;
    document.head.appendChild(style);
  }

})();
