'use strict';

/* =========================================================
   MOB BR - ui_tournament_result.js v1（FULL）
   役割：
   - 1試合ごとの result（20チーム）表示
   - 現在の総合順位（ローカル=20 / 40大会=40）表示
   - NEXTで「次の試合へ」 or 「大会フェーズへ戻る」を進める器

   重要：
   - confirm() は使わない（UIのみ）
   - 既存のロック/被り問題を避けるため、最前面レイヤー＆ポインタ制御を内包
   - DOMが無い場合でも自動生成して動く（壊さない）

   使い方（外部から）：
   window.MOBBR.ui.tournamentResult.open({
     title: 'ローカル大会',
     subtitle: '第1試合 結果',
     matchIndex: 1,
     matchCount: 5,
     matchRows: [ {place, teamId, name, placementP, kp, ap, treasure, flag, total} ...20 ],
     overallRows: [ ...20 or 40 ],
     noteTop: 'ROUND RESULT',
     noteOverall: '総合順位（1/5）',
     onNext: ()=>{},
     onClose: ()=>{} // optional
   });

========================================================= */

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){
  const ui = window.MOBBR.ui;

  // ===== Utils =====
  const $ = (id)=>document.getElementById(id);
  const esc = (s)=>String(s ?? '').replace(/[&<>"']/g, m=>({
    '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'
  }[m]));
  const n = (v, d=0)=>Number.isFinite(Number(v)) ? Number(v) : d;

  // ===== IDs =====
  const IDS = {
    root: 'tournamentResultScreen',
    card: 'tournamentResultCard',
    title: 'tournamentResultTitle',
    subtitle: 'tournamentResultSubtitle',
    badge: 'tournamentResultBadge',
    listMatch: 'tournamentResultMatchList',
    listOverall: 'tournamentResultOverallList',
    noteTop: 'tournamentResultNoteTop',
    noteOverall: 'tournamentResultNoteOverall',
    btnNext: 'btnTournamentResultNext',
    btnClose: 'btnTournamentResultClose'
  };

  // ===== Style (inject once) =====
  function ensureStyle(){
    if ($('style_tournament_result_v1')) return;
    const st = document.createElement('style');
    st.id = 'style_tournament_result_v1';
    st.textContent = `
      /* overlay */
      #${IDS.root}{
        position: fixed; inset: 0;
        display: none;
        z-index: 999999; /* 最前面 */
        pointer-events: auto;
        background: rgba(0,0,0,.55);
        -webkit-backdrop-filter: blur(2px);
        backdrop-filter: blur(2px);
      }
      #${IDS.root}.show{ display:block; }

      #${IDS.card}{
        position:absolute; left:50%; top:50%;
        transform: translate(-50%,-50%);
        width: min(980px, 92vw);
        max-height: min(92vh, 920px);
        background: rgba(18,18,24,.92);
        border: 1px solid rgba(255,255,255,.14);
        border-radius: 18px;
        box-shadow: 0 14px 60px rgba(0,0,0,.55);
        overflow: hidden;
        display:flex; flex-direction:column;
      }

      #${IDS.card} *{ box-sizing:border-box; }

      .trHead{
        padding: 14px 14px 10px;
        border-bottom: 1px solid rgba(255,255,255,.10);
        display:flex; align-items:flex-start; gap:10px;
      }
      .trHeadLeft{ flex:1; min-width:0; }
      #${IDS.title}{
        font-weight: 900;
        font-size: 18px;
        line-height: 1.15;
        color: #f7f0c3;
        text-shadow: 0 2px 0 rgba(0,0,0,.45);
        letter-spacing: .02em;
      }
      #${IDS.subtitle}{
        margin-top: 6px;
        font-size: 12px;
        color: rgba(255,255,255,.78);
        line-height: 1.35;
      }
      #${IDS.badge}{
        flex:0 0 auto;
        padding: 6px 10px;
        border-radius: 999px;
        font-size: 12px;
        color: rgba(0,0,0,.85);
        background: linear-gradient(180deg, #f6d36f, #d49b2b);
        border: 1px solid rgba(0,0,0,.25);
        box-shadow: 0 2px 10px rgba(0,0,0,.25);
        white-space: nowrap;
      }

      .trBody{
        padding: 12px 12px 0;
        overflow: auto;
      }

      .trSection{
        margin-bottom: 12px;
        border: 1px solid rgba(255,255,255,.10);
        border-radius: 14px;
        overflow:hidden;
        background: rgba(0,0,0,.18);
      }
      .trSectionHead{
        display:flex; align-items:center; gap:10px;
        padding: 10px 10px;
        border-bottom: 1px solid rgba(255,255,255,.08);
        background: rgba(255,255,255,.04);
      }
      .trSectionHead .label{
        font-weight: 800;
        font-size: 12px;
        color: rgba(255,255,255,.88);
        letter-spacing: .06em;
      }
      .trSectionHead .note{
        font-size: 12px;
        color: rgba(255,255,255,.64);
        margin-left:auto;
      }

      .trTable{
        width:100%;
        border-collapse: collapse;
        font-size: 12px;
        color: rgba(255,255,255,.90);
      }
      .trTable thead th{
        position: sticky; top: 0;
        background: rgba(15,15,18,.96);
        border-bottom: 1px solid rgba(255,255,255,.10);
        padding: 8px 6px;
        text-align: left;
        font-weight: 800;
        z-index: 1;
      }
      .trTable tbody td{
        padding: 8px 6px;
        border-bottom: 1px solid rgba(255,255,255,.06);
        vertical-align: middle;
      }
      .trTable tbody tr:last-child td{ border-bottom: none; }

      .trRank{
        width: 48px;
        font-weight: 900;
      }
      .trTeam{
        min-width: 180px;
      }
      .trSmall{
        width: 76px;
        text-align: right;
        font-variant-numeric: tabular-nums;
      }
      .trTotal{
        width: 86px;
        text-align: right;
        font-weight: 900;
        font-variant-numeric: tabular-nums;
      }

      .trTop3{
        background: rgba(246,211,111,.10);
      }
      .trMe{
        outline: 2px solid rgba(120,220,255,.45);
        outline-offset: -2px;
        background: rgba(120,220,255,.08);
      }

      .trFoot{
        padding: 10px 12px;
        border-top: 1px solid rgba(255,255,255,.10);
        display:flex;
        gap:10px;
        background: rgba(0,0,0,.25);
      }
      .trBtn{
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
      .trBtn:active{ transform: translateY(1px); }

      /* NEXT subtle float */
      .trNextFloat{
        animation: trFloat 1.6s ease-in-out infinite;
      }
      @keyframes trFloat{
        0%{ transform: translateY(0); }
        50%{ transform: translateY(-3px); }
        100%{ transform: translateY(0); }
      }
    `;
    document.head.appendChild(st);
  }

  // ===== DOM build (if missing) =====
  function ensureDom(){
    let root = $(IDS.root);
    if (root) return;

    root = document.createElement('div');
    root.id = IDS.root;
    root.setAttribute('aria-hidden','true');

    root.innerHTML = `
      <div id="${IDS.card}" role="dialog" aria-modal="true">
        <div class="trHead">
          <div class="trHeadLeft">
            <div id="${IDS.title}">TOURNAMENT</div>
            <div id="${IDS.subtitle}"></div>
          </div>
          <div id="${IDS.badge}">RESULT</div>
        </div>

        <div class="trBody">
          <div class="trSection">
            <div class="trSectionHead">
              <div class="label" id="${IDS.noteTop}">ROUND RESULT</div>
              <div class="note"></div>
            </div>
            <div style="overflow:auto; max-height: 38vh;">
              <table class="trTable">
                <thead>
                  <tr>
                    <th class="trRank">#</th>
                    <th class="trTeam">TEAM</th>
                    <th class="trSmall">順位pt</th>
                    <th class="trSmall">K</th>
                    <th class="trSmall">A</th>
                    <th class="trSmall">宝</th>
                    <th class="trSmall">旗</th>
                    <th class="trTotal">TOTAL</th>
                  </tr>
                </thead>
                <tbody id="${IDS.listMatch}"></tbody>
              </table>
            </div>
          </div>

          <div class="trSection">
            <div class="trSectionHead">
              <div class="label" id="${IDS.noteOverall}">総合順位</div>
              <div class="note">スクロール可</div>
            </div>
            <div style="overflow:auto; max-height: 40vh;">
              <table class="trTable">
                <thead>
                  <tr>
                    <th class="trRank">#</th>
                    <th class="trTeam">TEAM</th>
                    <th class="trSmall">順位pt</th>
                    <th class="trSmall">K</th>
                    <th class="trSmall">A</th>
                    <th class="trSmall">宝</th>
                    <th class="trSmall">旗</th>
                    <th class="trTotal">TOTAL</th>
                  </tr>
                </thead>
                <tbody id="${IDS.listOverall}"></tbody>
              </table>
            </div>
          </div>
        </div>

        <div class="trFoot">
          <button class="trBtn" id="${IDS.btnClose}" type="button">閉じる</button>
          <button class="trBtn trNextFloat" id="${IDS.btnNext}" type="button">NEXT</button>
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

  // ===== Render =====
  function renderRows(tbodyEl, rows, opt){
    const list = Array.isArray(rows) ? rows.slice() : [];
    tbodyEl.innerHTML = '';

    if (!list.length){
      const tr = document.createElement('tr');
      tr.innerHTML = `<td colspan="8" style="padding:12px; color:rgba(255,255,255,.70)">データがありません</td>`;
      tbodyEl.appendChild(tr);
      return;
    }

    const playerTeamId = opt?.playerTeamId || '';

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

      const isTop3 = place >= 1 && place <= 3;
      const isMe = playerTeamId && teamId === playerTeamId;

      if (isTop3) tr.classList.add('trTop3');
      if (isMe) tr.classList.add('trMe');

      tr.innerHTML = `
        <td class="trRank">${esc(place)}</td>
        <td class="trTeam">${esc(name)}</td>
        <td class="trSmall">${esc(placementP)}</td>
        <td class="trSmall">${esc(kp)}</td>
        <td class="trSmall">${esc(ap)}</td>
        <td class="trSmall">${esc(treasure)}</td>
        <td class="trSmall">${esc(flag)}</td>
        <td class="trTotal">${esc(total)}</td>
      `;
      tbodyEl.appendChild(tr);
    }
  }

  // ===== Open/Close =====
  let _state = {
    onNext: null,
    onClose: null
  };

  function open(payload){
    ensureStyle();
    ensureDom();

    const root = $(IDS.root);
    const titleEl = $(IDS.title);
    const subEl = $(IDS.subtitle);
    const badgeEl = $(IDS.badge);
    const noteTopEl = $(IDS.noteTop);
    const noteOverallEl = $(IDS.noteOverall);
    const matchTbody = $(IDS.listMatch);
    const overallTbody = $(IDS.listOverall);

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

    noteTopEl.textContent = String(payload?.noteTop ?? 'ROUND RESULT');
    noteOverallEl.textContent = String(payload?.noteOverall ?? (matchIndex && matchCount ? `総合順位（${matchIndex}/${matchCount}）` : '総合順位'));

    // rows
    const playerTeamId =
      String(payload?.playerTeamId ?? window.MOBBR?.data?.player?.teamId ?? window.DataPlayer?.getTeam?.()?.teamId ?? '');

    renderRows(matchTbody, payload?.matchRows, { playerTeamId });
    renderRows(overallTbody, payload?.overallRows, { playerTeamId });

    _state.onNext = typeof payload?.onNext === 'function' ? payload.onNext : null;
    _state.onClose = typeof payload?.onClose === 'function' ? payload.onClose : null;

    // show
    root.classList.add('show');
    root.setAttribute('aria-hidden','false');

    // 既存UIが「何か被って押せない」系を防ぐ：body側のスクロールも止める
    document.documentElement.style.overflow = 'hidden';
    document.body.style.overflow = 'hidden';
  }

  function close(){
    const root = $(IDS.root);
    if (!root) return;

    root.classList.remove('show');
    root.setAttribute('aria-hidden','true');

    document.documentElement.style.overflow = '';
    document.body.style.overflow = '';

    const cb = _state.onClose;
    _state.onClose = null;
    if (cb) cb();
  }

  function next(){
    const cb = _state.onNext;
    if (cb){
      cb();
      return;
    }
    // fallback: close
    close();
  }

  function bindOnce(){
    ensureStyle();
    ensureDom();

    const btnClose = $(IDS.btnClose);
    const btnNext = $(IDS.btnNext);

    if (!btnClose._boundTR){
      btnClose._boundTR = true;
      btnClose.addEventListener('click', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        close();
      });
    }
    if (!btnNext._boundTR){
      btnNext._boundTR = true;
      btnNext.addEventListener('click', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        next();
      });
    }
  }

  function init(){
    bindOnce();
  }

  // 即動く（動的ロード対策）
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  }else{
    init();
  }

  // public
  ui.tournamentResult = { open, close, next };

})();
