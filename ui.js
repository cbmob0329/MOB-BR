/* =========================================================
   MOB BR - ui.js (FULL)
========================================================= */

(function(){
  'use strict';

  const UI = {};
  window.UI = UI;

  const DOM = {};
  const STATE = {
    auto: false,
    lastBg: null,
    battleEnemy: null,
    playerTeam: null,
  };

  document.addEventListener('DOMContentLoaded', init);

  function init(){
    cacheDom();
    ensureExtraLayers();
    bindEvents();
    syncPlayerPanel();
    setLog('準備中…');
  }

  function cacheDom(){
    DOM.scene      = document.getElementById('scene');
    DOM.sceneBg    = document.getElementById('sceneBg');
    DOM.teamPanel  = document.getElementById('teamPanel');
    DOM.teamImage  = document.getElementById('teamImage');
    DOM.logPanel   = document.getElementById('logPanel');
    DOM.logText    = document.getElementById('logText');
    DOM.btnAuto    = document.getElementById('btnAuto');
    DOM.btnNext    = document.getElementById('btnNext');
    DOM.resultPanel     = document.getElementById('resultPanel');
    DOM.resultTableWrap = document.getElementById('resultTableWrap');
    DOM.btnResultNext   = document.getElementById('btnResultNext');
    DOM.hudDate = document.getElementById('hudDate');
    DOM.hudMode = document.getElementById('hudMode');
  }

  function ensureExtraLayers(){
    if(!DOM.scene) return;

    DOM.playerName = document.getElementById('playerName');
    if(!DOM.playerName){
      DOM.playerName = document.createElement('div');
      DOM.playerName.id = 'playerName';
      DOM.playerName.style.position = 'absolute';
      DOM.playerName.style.left = '14px';
      DOM.playerName.style.top  = '12px';
      DOM.playerName.style.padding = '6px 10px';
      DOM.playerName.style.borderRadius = '10px';
      DOM.playerName.style.background = 'rgba(0,0,0,.55)';
      DOM.playerName.style.color = '#fff';
      DOM.playerName.style.fontWeight = '700';
      DOM.playerName.style.fontSize = '14px';
      DOM.playerName.style.pointerEvents = 'none';
      DOM.playerName.style.zIndex = 5;
      DOM.scene.appendChild(DOM.playerName);
    }

    DOM.enemyWrap = document.getElementById('enemyWrap');
    if(!DOM.enemyWrap){
      DOM.enemyWrap = document.createElement('div');
      DOM.enemyWrap.id = 'enemyWrap';
      DOM.enemyWrap.style.position = 'absolute';
      DOM.enemyWrap.style.right = '14px';
      DOM.enemyWrap.style.top = '12px';
      DOM.enemyWrap.style.width = '150px';
      DOM.enemyWrap.style.display = 'none';
      DOM.enemyWrap.style.zIndex = 6;

      DOM.enemyName = document.createElement('div');
      DOM.enemyName.id = 'enemyName';
      DOM.enemyName.style.padding = '6px 10px';
      DOM.enemyName.style.borderRadius = '10px';
      DOM.enemyName.style.background = 'rgba(0,0,0,.55)';
      DOM.enemyName.style.color = '#fff';
      DOM.enemyName.style.fontWeight = '700';
      DOM.enemyName.style.fontSize = '14px';
      DOM.enemyName.style.textAlign = 'center';
      DOM.enemyName.style.marginBottom = '6px';

      DOM.enemyImg = document.createElement('img');
      DOM.enemyImg.id = 'enemyImg';
      DOM.enemyImg.alt = '';
      DOM.enemyImg.style.width = '150px';
      DOM.enemyImg.style.height = 'auto';
      DOM.enemyImg.style.imageRendering = 'pixelated';
      DOM.enemyImg.style.filter = 'drop-shadow(0 6px 10px rgba(0,0,0,.35))';

      DOM.enemyWrap.appendChild(DOM.enemyName);
      DOM.enemyWrap.appendChild(DOM.enemyImg);
      DOM.scene.appendChild(DOM.enemyWrap);
    }
  }

  function bindEvents(){
    if(DOM.btnNext){
      DOM.btnNext.addEventListener('click', ()=>{
        if(window.Sim && typeof window.Sim.next === 'function'){
          window.Sim.next();
        }
      });
    }

    if(DOM.btnAuto){
      DOM.btnAuto.addEventListener('click', ()=>{
        STATE.auto = !STATE.auto;
        updateAutoBtn();
        if(window.Sim && typeof window.Sim.setAuto === 'function'){
          window.Sim.setAuto(STATE.auto);
        }
      });
      updateAutoBtn();
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

  function updateAutoBtn(){
    if(!DOM.btnAuto) return;
    DOM.btnAuto.textContent = STATE.auto ? 'AUTO: ON' : 'AUTO';
  }

  UI.showStep = function(step){
    const msg = String(step?.message ?? '');
    const bg  = step?.bg || null;
    const anim = !!step?.bgAnim;

    if(bg) setBackground(bg, anim);
    setLog(msg);

    if(step?.enemy) UI.setEnemy(step.enemy);

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
    STATE.battleEnemy = enemy || null;
    if(!STATE.battleEnemy){
      hideEnemy(); return;
    }
    if(DOM.enemyWrap){
      DOM.enemyWrap.style.display = '';
      DOM.enemyName.textContent = STATE.battleEnemy.name || '';
      DOM.enemyImg.src = withCacheBuster(STATE.battleEnemy.img || '');
    }
  };

  UI.clearEnemy = function(){
    STATE.battleEnemy = null;
    hideEnemy();
  };

  function setLog(text){
    if(DOM.logText) DOM.logText.textContent = text;
  }

  function setBackground(newBg, slide){
    if(!DOM.sceneBg) return;
    if(STATE.lastBg === newBg) return;

    if(!slide){
      DOM.sceneBg.src = withCacheBuster(newBg);
      STATE.lastBg = newBg;
      return;
    }

    const parent = DOM.sceneBg.parentElement;
    if(!parent){
      DOM.sceneBg.src = withCacheBuster(newBg);
      STATE.lastBg = newBg;
      return;
    }

    const oldImg = DOM.sceneBg;
    const newImg = oldImg.cloneNode(false);
    newImg.src = withCacheBuster(newBg);

    newImg.style.position = 'absolute';
    newImg.style.left = '0';
    newImg.style.top = '0';
    newImg.style.transform = 'translateX(100%)';
    newImg.style.transition = 'transform 420ms ease';

    oldImg.style.position = 'absolute';
    oldImg.style.left = '0';
    oldImg.style.top = '0';
    oldImg.style.transition = 'transform 420ms ease';
    oldImg.style.transform = 'translateX(0%)';

    parent.style.position = 'relative';
    parent.appendChild(newImg);

    requestAnimationFrame(()=>{
      oldImg.style.transform = 'translateX(-100%)';
      newImg.style.transform = 'translateX(0%)';
    });

    setTimeout(()=>{
      if(oldImg.parentElement) oldImg.parentElement.removeChild(oldImg);
      newImg.id = 'sceneBg';
      newImg.style.position = '';
      newImg.style.left = '';
      newImg.style.top = '';
      newImg.style.transform = '';
      newImg.style.transition = '';
      DOM.sceneBg = newImg;
      STATE.lastBg = newBg;
    }, 460);
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

  function hideEnemy(){
    if(DOM.enemyWrap) DOM.enemyWrap.style.display = 'none';
  }

  function syncPlayerPanel(){
    const player = getPlayerTeamGuess();
    STATE.playerTeam = player;

    if(DOM.playerName){
      DOM.playerName.textContent = player?.name || 'PLAYER';
    }
    if(player?.img && DOM.teamImage){
      DOM.teamImage.src = withCacheBuster(player.img);
    }
    if(DOM.teamImage){
      DOM.teamImage.style.imageRendering = 'pixelated';
    }
  }

  function getPlayerTeamGuess(){
    try{
      if(window.DataPlayer?.getTeam){
        const t = window.DataPlayer.getTeam();
        return { name: t?.name || 'PLAYER', img: t?.img || null };
      }
      if(window.PLAYER_TEAM){
        return { name: window.PLAYER_TEAM.name || 'PLAYER', img: window.PLAYER_TEAM.img || null };
      }
      const img = DOM.teamImage?.getAttribute('src') || 'P1.png';
      return { name: 'PLAYER', img };
    }catch(_e){
      const img = DOM.teamImage?.getAttribute('src') || 'P1.png';
      return { name: 'PLAYER', img };
    }
  }

  function withCacheBuster(path){
    if(!path) return path;
    if(path.includes('?v=')) return path;
    const d = new Date();
    const stamp = `${d.getFullYear()}${pad2(d.getMonth()+1)}${pad2(d.getDate())}`;
    return `${path}?v=${stamp}`;
  }
  function pad2(n){ return (n<10?'0':'')+n; }

})();
