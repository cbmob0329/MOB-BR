'use strict';

/*
  MOB BR - ui_tournament.js v1（フル）
  - tournament.css 前提
  - 背景(neonmain.png) + 正方形(tent.png) + プレイヤー(P1.png) を重ねる
  - Flow から呼ばれる最低限APIを実装：
    open / setScene / showMessage / showResult / setNextHandler / setNextEnabled / close
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){
  const UI = {};
  window.MOBBR.ui.tournament = UI;

  let dom = null;
  let nextHandler = null;

  function ensureDom(){
    if (dom) return dom;

    const root = document.createElement('div');
    root.className = 'mobbrTui';
    root.setAttribute('aria-hidden', 'true');

    root.innerHTML = `
      <div class="tuiBg"><img id="tuiBgImg" src="" alt="" draggable="false"></div>
      <div class="tuiVeil"></div>

      <div class="tuiSafe">
        <div class="tuiWrap">

          <div class="tuiTop">
            <div class="tuiTitle" id="tuiTitle">大会</div>
            <button class="tuiClose" id="tuiClose" type="button">閉じる</button>
          </div>

          <div class="tuiStage">
            <div class="tuiSquare">
              <div class="tuiTent"><img id="tuiTentImg" src="" alt="" draggable="false"></div>
              <img class="tuiPlayer" id="tuiPlayerImg" src="" alt="" draggable="false">
            </div>
          </div>

          <div class="tuiBottom">
            <div class="tuiCard" id="tuiCard">
              <div class="tuiCardHead">
                <div class="h1" id="tuiH1">MESSAGE</div>
                <div class="h2" id="tuiH2"></div>
              </div>
              <div class="tuiCardBody" id="tuiBody"></div>
            </div>

            <button class="tuiNext" id="tuiNext" type="button">NEXT</button>
            <div class="tuiNote" id="tuiNote">※NEXTで進行</div>
          </div>

        </div>
      </div>
    `;

    document.body.appendChild(root);

    const $q = (id)=>root.querySelector(`#${id}`);

    const els = {
      root,
      bg: $q('tuiBgImg'),
      tent: $q('tuiTentImg'),
      player: $q('tuiPlayerImg'),
      title: $q('tuiTitle'),
      close: $q('tuiClose'),
      h1: $q('tuiH1'),
      h2: $q('tuiH2'),
      body: $q('tuiBody'),
      next: $q('tuiNext'),
      note: $q('tuiNote')
    };

    // click through防止
    root.addEventListener('click', (e)=>{
      e.preventDefault();
      e.stopPropagation();
    }, { passive:false });

    els.close.addEventListener('click', ()=>{
      UI.close();
    });

    els.next.addEventListener('click', (e)=>{
      e.preventDefault();
      if (typeof nextHandler === 'function') nextHandler();
    });

    dom = els;
    return dom;
  }

  function openRoot(){
    const d = ensureDom();
    d.root.classList.add('isOpen');
    d.root.style.display = 'block';
    d.root.setAttribute('aria-hidden', 'false');
  }

  function closeRoot(){
    const d = ensureDom();
    d.root.classList.remove('isOpen');
    d.root.style.display = 'none';
    d.root.setAttribute('aria-hidden', 'true');
  }

  function setImages(opt){
    const d = ensureDom();
    const bg = opt.bg || 'neonmain.png';
    const tent = opt.tent || 'tent.png';
    const p = opt.playerImage || 'P1.png';

    d.bg.src = bg;
    d.tent.src = tent;
    d.player.src = p;
  }

  function renderMessage(title, lines, nextLabel){
    const d = ensureDom();
    d.h1.textContent = String(title || 'MESSAGE');
    d.h2.textContent = '';
    const arr = Array.isArray(lines) ? lines : [String(lines || '')];
    d.body.innerHTML = `
      <div class="tuiLines">
        ${arr.map(s=>`<div class="tuiLine">${escapeHtml(String(s))}</div>`).join('')}
      </div>
    `;
    d.next.textContent = String(nextLabel || 'NEXT');
  }

  function renderResult(payload){
    const d = ensureDom();
    d.h1.textContent = String(payload.title || 'RESULT');
    d.h2.textContent = String(payload.sub || '');

    const rows = Array.isArray(payload.rows) ? payload.rows : [];
    const hi = String(payload.highlightTeamId || '');

    // columns: rank / team / pts / kills / assists / treasure / flag
    d.body.innerHTML = `
      <table class="tuiTable" aria-label="result">
        <thead>
          <tr>
            <th>順位</th>
            <th>チーム</th>
            <th>PT</th>
            <th>K</th>
            <th>A</th>
            <th>宝</th>
            <th>旗</th>
          </tr>
        </thead>
        <tbody>
          ${rows.map(r=>{
            const teamId = String(r.teamId ?? '');
            const cls = (hi && teamId && hi === teamId) ? 'tuiHi' : '';
            return `
              <tr class="${cls}">
                <td>${escapeHtml(String(r.rank ?? ''))}</td>
                <td>${escapeHtml(String(r.teamName ?? r.teamId ?? ''))}</td>
                <td>${escapeHtml(String(r.points ?? 0))}</td>
                <td>${escapeHtml(String(r.kills ?? 0))}</td>
                <td>${escapeHtml(String(r.assists ?? 0))}</td>
                <td>${escapeHtml(String(r.treasure ?? 0))}</td>
                <td>${escapeHtml(String(r.flag ?? 0))}</td>
              </tr>
            `;
          }).join('')}
        </tbody>
      </table>
    `;
  }

  function escapeHtml(s){
    return String(s)
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'","&#039;");
  }

  // ===== Public API =====

  UI.open = function(opt){
    openRoot();
    setImages(opt || {});
    const d = ensureDom();
    d.title.textContent = String(opt?.title || '大会');
    nextHandler = (typeof opt?.onNext === 'function') ? opt.onNext : null;

    renderMessage(
      opt?.title || '大会',
      opt?.messageLines || ['開始！', 'NEXTで進行します'],
      opt?.nextLabel || 'NEXT'
    );
    UI.setNextEnabled(opt?.nextEnabled !== false);
  };

  UI.setScene = function(opt){
    openRoot();
    setImages(opt || {});
    const d = ensureDom();
    d.title.textContent = String(opt?.title || '大会');
    nextHandler = (typeof opt?.onNext === 'function') ? opt.onNext : nextHandler;

    if (opt?.messageLines){
      renderMessage(opt.title || '大会', opt.messageLines, opt.nextLabel || 'NEXT');
    }
    if (typeof opt?.nextEnabled !== 'undefined') UI.setNextEnabled(opt.nextEnabled);
  };

  UI.showMessage = function(title, lines, nextLabel){
    openRoot();
    const d = ensureDom();
    d.title.textContent = '大会';
    renderMessage(title, lines, nextLabel || 'NEXT');
  };

  UI.showResult = function(payload){
    openRoot();
    renderResult(payload || {});
  };

  UI.setNextHandler = function(fn){
    nextHandler = (typeof fn === 'function') ? fn : null;
  };

  UI.setNextEnabled = function(on){
    const d = ensureDom();
    d.next.disabled = !on;
  };

  UI.close = function(){
    closeRoot();
  };

})();
