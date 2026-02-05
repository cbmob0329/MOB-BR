/* =========================================================
   MOB BR - ui.js (FULL)
   - 背景は #scene の固定枠に100%フィット（CSS側で統一）
   - プレイヤー絵は常に背景の手前
   - 交戦時のみ右に敵チーム絵を表示（cpu/teamId.png）
   - 名前プレート（チーム名 / メンバー名）を左右に表示
========================================================= */

(function(){
  'use strict';

  const UI = {};
  window.UI = UI;

  const DOM = {};
  const STATE = {
    auto: false,
    lastBg: null,
    player: { name:'プレイヤーチーム', members:'メンバー', img:'P1.png' },
    enemy: null,
  };

  document.addEventListener('DOMContentLoaded', init);

  function init(){
    cacheDom();
    ensureOverlay();
    bindEvents();
    syncPlayerPanel();
    setLog('準備中…');
  }

  function cacheDom(){
    DOM.scene   = document.getElementById('scene');
    DOM.bg      = document.getElementById('sceneBg');
    DOM.teamImg = document.getElementById('teamImage');

    DOM.logPanel = document.getElementById('logPanel');
    DOM.logText  = document.getElementById('logText');
    DOM.btnAuto  = document.getElementById('btnAuto');
    DOM.btnNext  = document.getElementById('btnNext');

    DOM.resultPanel = document.getElementById('resultPanel');
    DOM.resultTableWrap = document.getElementById('resultTableWrap');
    DOM.btnResultNext = document.getElementById('btnResultNext');

    DOM.hudDate = document.getElementById('hudDate');
    DOM.hudMode = document.getElementById('hudMode');
  }

  function ensureOverlay(){
    if(!DOM.scene) return;

    // 敵表示枠（無ければ作る）
    DOM.enemyWrap = document.getElementById('enemyWrap');
    if(!DOM.enemyWrap){
      DOM.enemyWrap = document.createElement('div');
      DOM.enemyWrap.id = 'enemyWrap';
      DOM.scene.appendChild(DOM.enemyWrap);
    }

    DOM.enemyImg = document.getElementById('enemyImg');
    if(!DOM.enemyImg){
      DOM.enemyImg = document.createElement('img');
      DOM.enemyImg.id = 'enemyImg';
      DOM.enemyImg.alt = '';
      DOM.enemyWrap.appendChild(DOM.enemyImg);
    }

    // 左右の名前プレート
    DOM.playerPlate = document.getElementById('playerNameplate');
    if(!DOM.playerPlate){
      DOM.playerPlate = document.createElement('div');
      DOM.playerPlate.id = 'playerNameplate';
      DOM.playerPlate.className = 'nameplate';
      DOM.scene.appendChild(DOM.playerPlate);
    }

    DOM.enemyPlate = document.getElementById('enemyNameplate');
    if(!DOM.enemyPlate){
      DOM.enemyPlate = document.createElement('div');
      DOM.enemyPlate.id = 'enemyNameplate';
      DOM.enemyPlate.className = 'nameplate';
      DOM.scene.appendChild(DOM.enemyPlate);
    }

    // 初期は敵は非表示
    hideEnemy();
  }

  function bindEvents(){
    if(DOM.btnNext){
      DOM.btnNext.addEventListener('click', ()=>{
        if(window.Sim && typeof window.Sim.next === 'function') window.Sim.next();
      });
    }

    if(DOM.btnAuto){
      DOM.btnAuto.addEventListener('click', ()=>{
        STATE.auto = !STATE.auto;
        DOM.btnAuto.textContent = STATE.auto ? 'AUTO: ON' : 'AUTO';
        if(window.Sim && typeof window.Sim.setAuto === 'function') window.Sim.setAuto(STATE.auto);
      });
      DOM.btnAuto.textContent = 'AUTO';
    }

    if(DOM.btnResultNext){
      DOM.btnResultNext.addEventListener('click', ()=>{
        if(typeof window.App?.onResultNext === 'function'){
          window.App.onResultNext();
          return;
        }
        if(DOM.resultPanel) DOM.resultPanel.style.display = 'none';
        if(DOM.scene) DOM.scene.style.display = '';
      });
    }
  }

  /* =========================
     Public API from Sim
  ========================== */
  UI.showStep = function(step){
    const msg = String(step?.message ?? '');
    const bg  = step?.bg || null;
    const anim = !!step?.bgAnim;

    if(bg) setBackground(bg, anim);
    setLog(msg);

    if(step?.enemy){
      UI.setEnemy(step.enemy);
    }else if(step?.clearEnemy){
      UI.clearEnemy();
    }

    if(DOM.hudMode){
      DOM.hudMode.textContent = STATE.auto ? 'MODE: AUTO' : 'MODE: VIEW';
    }
  };

  UI.showResult = function(out){
    const champion = out?.champion || '';
    const rows = Array.isArray(out?.rows) ? out.rows : [];

    if(DOM.scene) DOM.scene.style.display = 'none';
    if(DOM.resultPanel) DOM.resultPanel.style.display = '';
    renderResult(champion, rows);
  };

  UI.setEnemy = function(enemy){
    // enemy: { name, members, img }
    STATE.enemy = enemy || null;
    if(!STATE.enemy){ hideEnemy(); return; }

    DOM.enemyWrap.style.display = '';
    DOM.enemyImg.src = withCacheBuster(STATE.enemy.img || '');

    DOM.enemyPlate.innerHTML =
      `<div>${escapeHtml(STATE.enemy.name || '敵チーム')}</div>` +
      `<span class="sub">${escapeHtml(STATE.enemy.members || 'メンバー')}</span>`;
    DOM.enemyPlate.style.display = '';
  };

  UI.clearEnemy = function(){
    STATE.enemy = null;
    hideEnemy();
  };

  /* =========================
     Rendering helpers
  ========================== */
  function syncPlayerPanel(){
    // data_player.js に getTeam があれば使う（無ければ P1.png）
    try{
      if(window.DataPlayer?.getTeam){
        const t = window.DataPlayer.getTeam();
        STATE.player.name = t?.name || STATE.player.name;
        // メンバー名は3人まとめて表示（なければ固定）
        if(Array.isArray(t?.members)){
          STATE.player.members = t.members.map(m=>m.name).join(' / ');
        }
        STATE.player.img = t?.img || STATE.player.img;
      }
    }catch(_e){}

    if(DOM.teamImg){
      DOM.teamImg.src = withCacheBuster(STATE.player.img || 'P1.png');
    }
    DOM.playerPlate.innerHTML =
      `<div>${escapeHtml(STATE.player.name || 'プレイヤーチーム')}</div>` +
      `<span class="sub">${escapeHtml(STATE.player.members || 'メンバー')}</span>`;
  }

  function setLog(text){
    if(DOM.logText) DOM.logText.textContent = text;
  }

  function setBackground(newBg, slide){
    if(!DOM.bg) return;
    if(STATE.lastBg === newBg) return;

    // CSSで常に同枠表示なので、ここはsrc差し替えだけでOK
    if(!slide){
      DOM.bg.src = withCacheBuster(newBg);
      STATE.lastBg = newBg;
      return;
    }

    // スライド演出（任意）
    const parent = DOM.bg.parentElement;
    if(!parent){
      DOM.bg.src = withCacheBuster(newBg);
      STATE.lastBg = newBg;
      return;
    }

    const oldImg = DOM.bg;
    const newImg = oldImg.cloneNode(false);
    newImg.src = withCacheBuster(newBg);

    newImg.style.position = 'absolute';
    newImg.style.inset = '0';
    newImg.style.width = '100%';
    newImg.style.height = '100%';
    newImg.style.objectFit = 'cover';
    newImg.style.imageRendering = 'pixelated';
    newImg.style.transform = 'translateX(100%)';
    newImg.style.transition = 'transform 420ms ease';
    newImg.style.zIndex = '1';

    oldImg.style.transition = 'transform 420ms ease';
    oldImg.style.transform = 'translateX(0%)';

    parent.appendChild(newImg);

    requestAnimationFrame(()=>{
      oldImg.style.transform = 'translateX(-100%)';
      newImg.style.transform = 'translateX(0%)';
    });

    setTimeout(()=>{
      if(oldImg.parentElement) oldImg.parentElement.removeChild(oldImg);
      newImg.id = 'sceneBg';
      newImg.style.position = '';
      newImg.style.inset = '';
      newImg.style.transform = '';
      newImg.style.transition = '';
      DOM.bg = newImg;
      STATE.lastBg = newBg;
    }, 460);
  }

  function hideEnemy(){
    if(DOM.enemyWrap) DOM.enemyWrap.style.display = 'none';
    if(DOM.enemyPlate) DOM.enemyPlate.style.display = 'none';
  }

  function renderResult(champion, rows){
    if(!DOM.resultTableWrap) return;
    DOM.resultTableWrap.innerHTML = '';

    const title = document.createElement('div');
    title.style.fontWeight = '900';
    title.style.fontSize = '18px';
    title.style.margin = '10px 0 8px 0';
    title.style.textAlign = 'center';
    title.textContent = champion ? `CHAMPION : ${champion}` : 'RESULT';
    DOM.resultTableWrap.appendChild(title);

    const table = document.createElement('table');
    table.style.width = '100%';
    table.style.borderCollapse = 'collapse';
    table.style.fontSize = '13px';

    const thead = document.createElement('thead');
    const hr = document.createElement('tr');
    const headers = ['Place','Squad','KP','AP','Treasure','Flag','PlacementP','Total'];
    for(const h of headers){
      const th = document.createElement('th');
      th.textContent = h;
      th.style.textAlign = 'center';
      th.style.padding = '6px 4px';
      th.style.borderBottom = '1px solid rgba(255,255,255,.25)';
      th.style.background = 'rgba(0,0,0,.25)';
      th.style.color = '#fff';
      hr.appendChild(th);
    }
    thead.appendChild(hr);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for(let i=0;i<rows.length;i++){
      const r = rows[i];
      const tr = document.createElement('tr');
      tr.style.background = (i % 2 === 0) ? 'rgba(255,255,255,.05)' : 'rgba(0,0,0,.10)';
      tr.style.color = '#fff';

      addCell(tr, r.place);
      addCell(tr, r.name);
      addCell(tr, r.kp);
      addCell(tr, r.ap);
      addCell(tr, r.treasure);
      addCell(tr, r.flag);
      addCell(tr, r.placementP);
      addCell(tr, r.total);

      tbody.appendChild(tr);

      if(r.members && Array.isArray(r.members) && r.members.length){
        const tr2 = document.createElement('tr');
        tr2.style.background = 'rgba(0,0,0,.22)';
        tr2.style.color = '#fff';
        const td = document.createElement('td');
        td.colSpan = 8;
        td.style.padding = '6px 8px';
        td.style.borderBottom = '1px solid rgba(255,255,255,.12)';
        const parts = r.members.map(m=>`${m.name}: ${m.kills}K/${m.assists}A`);
        td.textContent = `Player Detail  |  ${parts.join('  /  ')}`;
        tr2.appendChild(td);
        tbody.appendChild(tr2);
      }
    }
    table.appendChild(tbody);
    DOM.resultTableWrap.appendChild(table);
  }

  function addCell(tr, v){
    const td = document.createElement('td');
    td.textContent = String(v ?? '');
    td.style.textAlign = 'center';
    td.style.padding = '6px 4px';
    td.style.borderBottom = '1px solid rgba(255,255,255,.10)';
    tr.appendChild(td);
  }

  function withCacheBuster(path){
    if(!path) return path;
    if(path.includes('?v=')) return path;
    const d = new Date();
    const stamp = `${d.getFullYear()}${pad2(d.getMonth()+1)}${pad2(d.getDate())}`;
    return `${path}?v=${stamp}`;
  }
  function pad2(n){ return (n<10?'0':'')+n; }

  function escapeHtml(s){
    return String(s ?? '')
      .replaceAll('&','&amp;')
      .replaceAll('<','&lt;')
      .replaceAll('>','&gt;')
      .replaceAll('"','&quot;')
      .replaceAll("'","&#39;");
  }

})();
