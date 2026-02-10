'use strict';

/* =========================================================
   MOB BR - ui_tournament.js v1.0 (FULL)
   ---------------------------------------------------------
   目的：
   - 大会用の表示（intro/message/result）を1枚のCSS前提で統一
   - DOMはこのファイルが自前生成（index側に大会DOM不要）
   - sim側UIは呼ばない。Flow がここを呼ぶ
   ---------------------------------------------------------
   公開API（Flowから使用）：
   window.MOBBR.ui.tournament = {
     open({bg, playerImage, title, messageLines, nextLabel, nextEnabled, onNext, highlightTeamId})
     close()
     setScene({...openと同様})
     showMessage(title, lines, nextLabel)
     showResult({title, sub, rows, highlightTeamId})
     setNextHandler(fn)
     setNextEnabled(bool)
   }
========================================================= */

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){
  const T = {};
  window.MOBBR.ui.tournament = T;

  let dom = null;
  let nextHandler = null;
  let hiTeamId = '';

  function ensureDom(){
    if (dom) return dom;

    const root = document.createElement('div');
    root.className = 'mobbrTui';
    root.id = 'mobbrTournamentUI';
    root.setAttribute('aria-hidden', 'true');

    // bg
    const bg = document.createElement('div');
    bg.className = 'tuiBg';
    const bgImg = document.createElement('img');
    bgImg.alt = '';
    bgImg.draggable = false;
    bg.appendChild(bgImg);

    const veil = document.createElement('div');
    veil.className = 'tuiVeil';

    const safe = document.createElement('div');
    safe.className = 'tuiSafe';

    const wrap = document.createElement('div');
    wrap.className = 'tuiWrap';

    // top
    const top = document.createElement('div');
    top.className = 'tuiTop';

    const title = document.createElement('div');
    title.className = 'tuiTitle';
    title.textContent = '大会';

    const btnClose = document.createElement('button');
    btnClose.type = 'button';
    btnClose.className = 'tuiClose';
    btnClose.textContent = '閉じる';

    top.appendChild(title);
    top.appendChild(btnClose);

    // stage square
    const stage = document.createElement('div');
    stage.className = 'tuiStage';

    const square = document.createElement('div');
    square.className = 'tuiSquare';

    const tent = document.createElement('div');
    tent.className = 'tuiTent';
    const tentImg = document.createElement('img');
    tentImg.alt = '';
    tentImg.draggable = false;
    tent.appendChild(tentImg);

    const playerImg = document.createElement('img');
    playerImg.className = 'tuiPlayer';
    playerImg.alt = 'PLAYER';
    playerImg.draggable = false;

    square.appendChild(tent);
    square.appendChild(playerImg);
    stage.appendChild(square);

    // card (message/result)
    const card = document.createElement('div');
    card.className = 'tuiCard';

    const cardHead = document.createElement('div');
    cardHead.className = 'tuiCardHead';

    const h1 = document.createElement('div');
    h1.className = 'h1';
    h1.textContent = 'MESSAGE';

    const h2 = document.createElement('div');
    h2.className = 'h2';
    h2.textContent = '';

    cardHead.appendChild(h1);
    cardHead.appendChild(h2);

    const cardBody = document.createElement('div');
    cardBody.className = 'tuiCardBody';

    card.appendChild(cardHead);
    card.appendChild(cardBody);

    // bottom
    const bottom = document.createElement('div');
    bottom.className = 'tuiBottom';

    const btnNext = document.createElement('button');
    btnNext.type = 'button';
    btnNext.className = 'tuiNext';
    btnNext.textContent = 'NEXT';

    const note = document.createElement('div');
    note.className = 'tuiNote';
    note.textContent = '※演出表示のみ';

    bottom.appendChild(btnNext);
    bottom.appendChild(note);

    wrap.appendChild(top);
    wrap.appendChild(stage);
    wrap.appendChild(card);
    wrap.appendChild(bottom);

    safe.appendChild(wrap);

    root.appendChild(bg);
    root.appendChild(veil);
    root.appendChild(safe);

    // attach
    document.body.appendChild(root);

    // events
    btnNext.addEventListener('click', (e)=>{
      e.preventDefault();
      if (btnNext.disabled) return;
      if (typeof nextHandler === 'function') nextHandler();
    });

    btnClose.addEventListener('click', (e)=>{
      e.preventDefault();
      T.close();
      // 大会を閉じたことが分かるようにメインに戻す（任意）
      // main側は表示されたままなので “閉じる” は overlay を消すだけ
    });

    // 誤タップで裏が押せないように
    root.addEventListener('click', (e)=>{
      e.preventDefault();
      e.stopPropagation();
    }, { passive:false });

    dom = {
      root,
      bgImg,
      tentImg,
      title,
      h1,
      h2,
      body: cardBody,
      btnNext
    };

    return dom;
  }

  function openBase(opt){
    const d = ensureDom();

    // hide main overlay interference（裏側が押せないのが目的なのでこれでOK）
    d.root.classList.add('isOpen');
    d.root.setAttribute('aria-hidden','false');

    // bg
    d.bgImg.src = String(opt.bg || 'neonmain.png');

    // tent + player
    d.tentImg.src = String(opt.tentImage || 'tent.png');
    d.tentImg.onerror = ()=>{ /* tent missingでも落とさない */ };

    d.title.textContent = String(opt.title || '大会');

    // player（衣装差し替え前提）
    d.playerImage = d.playerImage || null;
    // (playerImageはdomにあるので直接設定)
    const player = d.root.querySelector('.tuiPlayer');
    if (player) player.src = String(opt.playerImage || 'P1.png');

    // next
    if (typeof opt.onNext === 'function') nextHandler = opt.onNext;
    if (typeof opt.nextEnabled === 'boolean') T.setNextEnabled(opt.nextEnabled);
    if (opt.nextLabel) d.btnNext.textContent = String(opt.nextLabel);

    // message
    if (Array.isArray(opt.messageLines)){
      T.showMessage(opt.title || '大会', opt.messageLines, opt.nextLabel || 'NEXT');
    }
  }

  // ===== public =====
  T.open = function(opt){
    hiTeamId = String(opt?.highlightTeamId || '');
    openBase(opt || {});
  };

  T.setScene = function(opt){
    // open中の内容差し替え
    const d = ensureDom();
    if (!d.root.classList.contains('isOpen')){
      T.open(opt);
      return;
    }
    hiTeamId = String(opt?.highlightTeamId || hiTeamId || '');
    openBase(opt || {});
  };

  T.close = function(){
    const d = ensureDom();
    d.root.classList.remove('isOpen');
    d.root.setAttribute('aria-hidden','true');
    // 次ハンドラは残してもOKだが、閉じたら誤爆しないように無効化
    T.setNextEnabled(false);
  };

  T.setNextHandler = function(fn){
    nextHandler = (typeof fn === 'function') ? fn : null;
  };

  T.setNextEnabled = function(on){
    const d = ensureDom();
    d.btnNext.disabled = !on;
  };

  T.showMessage = function(title, lines, nextLabel){
    const d = ensureDom();
    d.h1.textContent = String(title || 'MESSAGE');
    d.h2.textContent = '';

    if (nextLabel) d.btnNext.textContent = String(nextLabel);

    const arr = Array.isArray(lines) ? lines : [String(lines || '')];

    const box = document.createElement('div');
    box.className = 'tuiLines';
    arr.forEach(t=>{
      const line = document.createElement('div');
      line.className = 'tuiLine';
      line.textContent = String(t);
      box.appendChild(line);
    });

    d.body.innerHTML = '';
    d.body.appendChild(box);

    // messageは基本NEXT可
    T.setNextEnabled(true);
  };

  T.showResult = function(opt){
    const d = ensureDom();
    const o = opt || {};

    d.h1.textContent = String(o.title || 'RESULT');
    d.h2.textContent = String(o.sub || '');

    const rows = Array.isArray(o.rows) ? o.rows : [];
    const highlight = String(o.highlightTeamId || hiTeamId || '');

    const table = document.createElement('table');
    table.className = 'tuiTable';

    const thead = document.createElement('thead');
    thead.innerHTML = `
      <tr>
        <th style="width:52px;">順位</th>
        <th>チーム</th>
        <th style="width:70px;">PT</th>
        <th style="width:56px;">K</th>
        <th style="width:56px;">A</th>
      </tr>
    `;
    table.appendChild(thead);

    const tbody = document.createElement('tbody');

    // rowsは Flow側で normalize されて {rank, teamId, teamName, points, kills, assists, treasure, flag}
    rows.slice(0, 20).forEach(r=>{
      const tr = document.createElement('tr');
      const teamId = String(r.teamId || '');
      if (highlight && teamId && teamId === highlight){
        tr.className = 'tuiHi';
      }
      const rank = Number(r.rank || 0) || 0;
      const name = String(r.teamName || r.name || teamId || '');
      const pt = Number(r.points ?? r.total ?? 0) || 0;
      const k = Number(r.kills ?? r.kp ?? 0) || 0;
      const a = Number(r.assists ?? r.ap ?? 0) || 0;

      tr.innerHTML = `
        <td>${rank}</td>
        <td>${escapeHtml(name)}</td>
        <td>${pt}</td>
        <td>${k}</td>
        <td>${a}</td>
      `;
      tbody.appendChild(tr);
    });

    table.appendChild(tbody);

    d.body.innerHTML = '';
    d.body.appendChild(table);

    // result表示でもNEXT可
    T.setNextEnabled(true);
  };

  function escapeHtml(s){
    return String(s ?? '')
      .replace(/&/g,'&amp;')
      .replace(/</g,'&lt;')
      .replace(/>/g,'&gt;')
      .replace(/"/g,'&quot;')
      .replace(/'/g,'&#39;');
  }
})();
