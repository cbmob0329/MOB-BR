'use strict';

/* =========================================================
   MOB BR - ui_match_result.js v1（B）
   ---------------------------------------------------------
   B方式：DOMは index.html 側に「用意してある前提」で動かす
   （ただし、無い場合は最低限だけ自動生成して落ちないようにする）

   目的：
   ・1試合ごとの result（20チーム）表示
   ・現在の総合順位（20 or 40）表示
   ・NEXTで「次の試合へ」進行（コールバック）
   ・ショップ戻り後に画面が半透明で固まる系を潰す：
     - overlay を最前面(z-index)＋pointer-events制御＋body scroll lock

   公開API：
     window.MOBBR.ui.matchResult.open(payload)
     window.MOBBR.ui.matchResult.close()
     window.MOBBR.ui.matchResult.setNext(fn)

   payload:
     {
       title, subtitle,
       matchIndex, matchCount,
       matchRows: [{place, teamId, name, placementP, kp, ap, treasure, flag, total}, ...],
       overallRows: [...],
       playerTeamId,
       onNext, onClose
     }
========================================================= */

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){
  const ui = window.MOBBR.ui;

  const $ = (id)=>document.getElementById(id);
  const esc = (s)=>String(s ?? '').replace(/[&<>"']/g, m=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
  const n = (v, d=0)=>Number.isFinite(Number(v)) ? Number(v) : d;

  // ===== B方式の固定DOM（推奨）=====
  const IDS = {
    screen: 'matchResultScreen',
    title: 'matchResultTitle',
    subtitle: 'matchResultSubtitle',
    badge: 'matchResultBadge',

    listMatch: 'matchResultList',
    listOverall: 'matchOverallList',

    noteTop: 'matchResultNoteTop',
    noteOverall: 'matchResultNoteOverall',

    btnNext: 'btnMatchResultNext',
    btnClose: 'btnMatchResultClose',
  };

  // ===== 最低限のCSS（既存CSSがあっても被らないようにID指定中心）=====
  function ensureStyle(){
    if ($('style_ui_match_result_v1')) return;
    const st = document.createElement('style');
    st.id = 'style_ui_match_result_v1';
    st.textContent = `
      #${IDS.screen}{
        position: fixed; inset:0;
        display:none;
        z-index: 999999; /* 最前面 */
        pointer-events:auto;
        background: rgba(0,0,0,.55);
        -webkit-backdrop-filter: blur(2px);
        backdrop-filter: blur(2px);
      }
      #${IDS.screen}.show{ display:block; }

      #${IDS.screen} .mrCard{
        position:absolute; left:50%; top:50%;
        transform: translate(-50%,-50%);
        width: min(980px, 92vw);
        max-height: min(92vh, 920px);
        overflow:hidden;
        border-radius: 18px;
        border: 1px solid rgba(255,255,255,.14);
        background: rgba(18,18,24,.92);
        box-shadow: 0 14px 60px rgba(0,0,0,.55);
        display:flex; flex-direction:column;
      }

      #${IDS.screen} .mrHead{
        padding: 14px 14px 10px;
        border-bottom: 1px solid rgba(255,255,255,.10);
        display:flex; gap:10px; align-items:flex-start;
      }
      #${IDS.title}{
        font-weight: 900; font-size: 18px; line-height:1.15;
        color:#f7f0c3;
        text-shadow: 0 2px 0 rgba(0,0,0,.45);
        letter-spacing:.02em;
      }
      #${IDS.subtitle}{
        margin-top:6px;
        font-size:12px;
        color: rgba(255,255,255,.78);
        line-height:1.35;
      }
      #${IDS.badge}{
        margin-left:auto;
        padding: 6px 10px;
        border-radius: 999px;
        font-size: 12px;
        color: rgba(0,0,0,.85);
        background: linear-gradient(180deg, #f6d36f, #d49b2b);
        border: 1px solid rgba(0,0,0,.25);
        box-shadow: 0 2px 10px rgba(0,0,0,.25);
        white-space: nowrap;
      }

      #${IDS.screen} .mrBody{
        padding: 12px 12px 0;
        overflow:auto;
      }

      #${IDS.screen} .mrSection{
        margin-bottom: 12px;
        border: 1px solid rgba(255,255,255,.10);
        border-radius: 14px;
        overflow:hidden;
        background: rgba(0,0,0,.18);
      }
      #${IDS.screen} .mrSectionHead{
        display:flex; align-items:center; gap:10px;
        padding: 10px 10px;
        border-bottom: 1px solid rgba(255,255,255,.08);
        background: rgba(255,255,255,.04);
      }
      #${IDS.noteTop}, #${IDS.noteOverall}{
        font-weight: 800;
        font-size: 12px;
        color: rgba(255,255,255,.88);
        letter-spacing: .06em;
      }
      #${IDS.screen} .mrTableWrap{
        overflow:auto;
        max-height: 38vh;
      }

      #${IDS.screen} table{
        width:100%;
        border-collapse:collapse;
        font-size: 12px;
        color: rgba(255,255,255,.90);
      }
      #${IDS.screen} thead th{
        position: sticky;
        top: 0;
        background: rgba(15,15,18,.96);
        border-bottom: 1px solid rgba(255,255,255,.10);
        padding: 8px 6px;
        text-align:left;
        font-weight: 800;
        z-index: 1;
      }
      #${IDS.screen} tbody td{
        padding: 8px 6px;
        border-bottom: 1px solid rgba(255,255,255,.06);
        vertical-align: middle;
      }
      #${IDS.screen} tbody tr:last-child td{ border-bottom:none; }

      #${IDS.screen} .mrRank{ width:48px; font-weight:900; }
      #${IDS.screen} .mrTeam{ min-width:180px; }
      #${IDS.screen} .mrSmall{ width:76px; text-align:right; font-variant-numeric: tabular-nums; }
      #${IDS.screen} .mrTotal{ width:86px; text-align:right; font-weight:900; font-variant-numeric: tabular-nums; }

      #${IDS.screen} .mrTop3{ background: rgba(246,211,111,.10); }
      #${IDS.screen} .mrMe{
        outline: 2px solid rgba(120,220,255,.45);
        outline-offset: -2px;
        background: rgba(120,220,255,.08);
      }

      #${IDS.screen} .mrFoot{
        padding: 10px 12px;
        border-top: 1px solid rgba(255,255,255,.10);
        display:flex;
        gap:10px;
        background: rgba(0,0,0,.25);
      }
      #${IDS.btnClose}, #${IDS.btnNext}{
        appearance:none;
        border: 1px solid rgba(255,255,255,.16);
        background: rgba(255,255,255,.06);
        color: rgba(255,255,255,.92);
        border-radius: 12px;
        padding: 10px 12px;
        font-weight: 900;
        font-size: 13px;
        flex:1;
        cursor:pointer;
      }
      #${IDS.btnNext}{
        animation: mrFloat 1.6s ease-in-out infinite;
      }
      @keyframes mrFloat{
        0%{ transform: translateY(0); }
        50%{ transform: translateY(-3px); }
        100%{ transform: translateY(0); }
      }
    `;
    document.head.appendChild(st);
  }

  // ===== DOMが無い場合の最低限生成（Bでも落ちない）=====
  function ensureDom(){
    if ($(IDS.screen)) return;

    const root = document.createElement('div');
    root.id = IDS.screen;
    root.setAttribute('aria-hidden','true');

    root.innerHTML = `
      <div class="mrCard" role="dialog" aria-modal="true">
        <div class="mrHead">
          <div style="flex:1; min-width:0;">
            <div id="${IDS.title}">MATCH RESULT</div>
            <div id="${IDS.subtitle}"></div>
          </div>
          <div id="${IDS.badge}">RESULT</div>
        </div>

        <div class="mrBody">
          <div class="mrSection">
            <div class="mrSectionHead">
              <div id="${IDS.noteTop}">ROUND RESULT</div>
              <div style="margin-left:auto; font-size:12px; color:rgba(255,255,255,.64)">20 teams</div>
            </div>
            <div class="mrTableWrap">
              <table>
                <thead>
                  <tr>
                    <th class="mrRank">#</th>
                    <th class="mrTeam">TEAM</th>
                    <th class="mrSmall">順位pt</th>
                    <th class="mrSmall">K</th>
                    <th class="mrSmall">A</th>
                    <th class="mrSmall">宝</th>
                    <th class="mrSmall">旗</th>
                    <th class="mrTotal">TOTAL</th>
                  </tr>
                </thead>
                <tbody id="${IDS.listMatch}"></tbody>
              </table>
            </div>
          </div>

          <div class="mrSection">
            <div class="mrSectionHead">
              <div id="${IDS.noteOverall}">総合順位</div>
              <div style="margin-left:auto; font-size:12px; color:rgba(255,255,255,.64)">scroll</div>
            </div>
            <div class="mrTableWrap" style="max-height:40vh;">
              <table>
                <thead>
                  <tr>
                    <th class="mrRank">#</th>
                    <th class="mrTeam">TEAM</th>
                    <th class="mrSmall">順位pt</th>
                    <th class="mrSmall">K</th>
                    <th class="mrSmall">A</th>
                    <th class="mrSmall">宝</th>
                    <th class="mrSmall">旗</th>
                    <th class="mrTotal">TOTAL</th>
                  </tr>
                </thead>
                <tbody id="${IDS.listOverall}"></tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="mrFoot">
          <button id="${IDS.btnClose}" type="button">閉じる</button>
          <button id="${IDS.btnNext}" type="button">NEXT</button>
        </div>
      </div>
    `;

    // 背景タップで閉じない（誤操作防止）
    root.addEventListener('click', (e)=>{
      if (e.target === root){
        e.preventDefault();
        e.stopPropagation();
      }
    });

    document.body.appendChild(root);
  }

  // ===== render =====
  function renderRows(tbody, rows, playerTeamId){
    const list = Array.isArray(rows) ? rows : [];
    tbody.innerHTML = '';

    if (!list.length){
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="8" style="padding:12px; color:rgba(255,255,255,.70)">データがありません</td>`;
      tbody.appendChild(tr);
      return;
    }

    for (const r of list){
      const place = n(r.place, 0);
      const teamId = String(r.teamId ?? '');
      const name = String(r.name ?? '');
      const placementP = n(r.placementP, 0);
      const kp = n(r.kp, 0);
      const ap = n(r.ap, 0);
      const treasure = n(r.treasure, 0);
      const flag = n(r.flag, 0);
      const total = n(r.total, 0);

      const tr = document.createElement('tr');

      if (place >= 1 && place <= 3) tr.classList.add('mrTop3');
      if (playerTeamId && teamId === playerTeamId) tr.classList.add('mrMe');

      tr.innerHTML = `
        <td class="mrRank">${esc(place)}</td>
        <td class="mrTeam">${esc(name)}</td>
        <td class="mrSmall">${esc(placementP)}</td>
        <td class="mrSmall">${esc(kp)}</td>
        <td class="mrSmall">${esc(ap)}</td>
        <td class="mrSmall">${esc(treasure)}</td>
        <td class="mrSmall">${esc(flag)}</td>
        <td class="mrTotal">${esc(total)}</td>
      `;
      tbody.appendChild(tr);
    }
  }

  // ===== state =====
  let state = {
    onNext: null,
    onClose: null
  };

  function lockBodyScroll(){
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
  }
  function unlockBodyScroll(){
    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';
  }

  // ===== open/close =====
  function open(payload){
    ensureStyle();
    ensureDom();

    const screen = $(IDS.screen);
    const titleEl = $(IDS.title);
    const subEl = $(IDS.subtitle);
    const badgeEl = $(IDS.badge);

    const noteTopEl = $(IDS.noteTop);
    const noteOverallEl = $(IDS.noteOverall);

    const tbodyMatch = $(IDS.listMatch);
    const tbodyOverall = $(IDS.listOverall);

    const title = String(payload?.title ?? '大会');
    const subtitle = String(payload?.subtitle ?? '');
    const matchIndex = n(payload?.matchIndex, 0);
    const matchCount = n(payload?.matchCount, 0);

    titleEl.textContent = title;

    const subParts = [];
    if (subtitle) subParts.push(subtitle);
    if (matchIndex > 0 && matchCount > 0) subParts.push(`（${matchIndex}/${matchCount}）`);
    subEl.textContent = subParts.join(' ');

    badgeEl.textContent = 'RESULT';

    const noteTop = String(payload?.noteTop ?? 'ROUND RESULT');
    const noteOverall = String(payload?.noteOverall ?? (matchIndex && matchCount ? `総合順位（${matchIndex}/${matchCount}）` : '総合順位'));
    noteTopEl.textContent = noteTop;
    noteOverallEl.textContent = noteOverall;

    const playerTeamId =
      String(payload?.playerTeamId
        ?? window.MOBBR?.data?.player?.teamId
        ?? window.DataPlayer?.getTeam?.()?.teamId
        ?? '');

    renderRows(tbodyMatch, payload?.matchRows, playerTeamId);
    renderRows(tbodyOverall, payload?.overallRows, playerTeamId);

    state.onNext = (typeof payload?.onNext === 'function') ? payload.onNext : null;
    state.onClose = (typeof payload?.onClose === 'function') ? payload.onClose : null;

    screen.classList.add('show');
    screen.setAttribute('aria-hidden','false');
    lockBodyScroll();
  }

  function close(){
    const screen = $(IDS.screen);
    if (!screen) return;

    screen.classList.remove('show');
    screen.setAttribute('aria-hidden','true');
    unlockBodyScroll();

    const cb = state.onClose;
    state.onClose = null;
    if (cb) cb();
  }

  function setNext(fn){
    state.onNext = (typeof fn === 'function') ? fn : null;
  }

  function next(){
    if (state.onNext){
      state.onNext();
      return;
    }
    close();
  }

  // ===== bind =====
  let bound = false;
  function bind(){
    if (bound) return;
    bound = true;

    ensureStyle();
    ensureDom();

    const btnClose = $(IDS.btnClose);
    const btnNext = $(IDS.btnNext);
    const screen = $(IDS.screen);

    if (btnClose){
      btnClose.addEventListener('click', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        close();
      });
    }
    if (btnNext){
      btnNext.addEventListener('click', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        next();
      });
    }

    // overlay 内のクリックを外へ漏らさない（背面が押せて固まる/ズレる対策）
    if (screen){
      screen.addEventListener('pointerdown', (e)=>{
        e.stopPropagation();
      }, { passive:false });
      screen.addEventListener('touchstart', (e)=>{
        e.stopPropagation();
      }, { passive:false });
    }
  }

  function init(){
    bind();
  }

  // 即動く（動的ロード対策）
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  }else{
    init();
  }

  ui.matchResult = { open, close, next, setNext };
})();
