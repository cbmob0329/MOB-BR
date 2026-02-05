/* =========================================================
   MOB BR - ui.js (FULL)
   試合の流れ.txt の「紙芝居表示」を担当
   ---------------------------------------------------------
   - 背景（Area / main1 / ido / battle）
   - 左：プレイヤー絵（装備中P?.png）
   - 右：敵チーム絵（交戦時のみ）※将来拡張用
   - 中央：RPGセリフ枠（ログ統一）
   - AUTO / NEXT
   - result（20チーム表示）
========================================================= */

(function(){
  'use strict';

  const UI = {};
  window.UI = UI;

  const DOM = {};
  const STATE = {
    auto: false,
    lastBg: null,
    battleEnemy: null,   // { teamId, name, img }
    playerTeam: null,    // { name, img }
  };

  // ---------------------------------------------------------
  // Init
  // ---------------------------------------------------------
  document.addEventListener('DOMContentLoaded', init);

  function init(){
    cacheDom();
    ensureExtraLayers();
    bindEvents();
    syncPlayerPanel();
    // 初期表示
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

    // HUDはあれば使う（無くてもOK）
    DOM.hudDate = document.getElementById('hudDate');
    DOM.hudMode = document.getElementById('hudMode');
  }

  // index.html を変えずに、必要レイヤーを足す
  function ensureExtraLayers(){
    if(!DOM.scene) return;

    // 左プレイヤー名
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

    // 右：敵チーム（交戦時のみ表示）— 将来 sim 側から情報が来たらここに出す
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
        // 次へ（大会遷移などは app.js 側に寄せる）
        if(typeof window.App?.onResultNext === 'function'){
          window.App.onResultNext();
          return;
        }
        // fallback：result閉じてシーン戻す
        if(DOM.resultPanel) DOM.resultPanel.style.display = 'none';
        if(DOM.scene) DOM.scene.style.display = '';
      });
    }
  }

  function updateAutoBtn(){
    if(!DOM.btnAuto) return;
    DOM.btnAuto.textContent = STATE.auto ? 'AUTO: ON' : 'AUTO';
  }

  // ---------------------------------------------------------
  // Public UI API (Sim から呼ばれる)
  // ---------------------------------------------------------
  UI.showStep = function(step){
    // step: { message, bg, bgAnim, enemy?:{...} }
    const msg = String(step?.message ?? '');
    const bg  = step?.bg || null;
    const anim = !!step?.bgAnim;

    // 背景
    if(bg){
      setBackground(bg, anim);
    }

    // ログ（中央枠に統一）
    setLog(msg);

    // （将来拡張）敵チーム表示
    if(step?.enemy){
      UI.setEnemy(step.enemy);
    }else{
      // 現状simから敵情報が来ないので、UI側で勝手に変化させない
      // 明示セットされたものだけ出す
    }

    // HUD補助（あれば）
    if(DOM.hudMode){
      DOM.hudMode.textContent = STATE.auto ? 'MODE: AUTO' : 'MODE: VIEW';
    }
  };

  UI.showResult = function(out){
    // out: { champion, rows }
    const champion = out?.champion || '';
    const rows = Array.isArray(out?.rows) ? out.rows : [];

    // 表示切替
    if(DOM.scene) DOM.scene.style.display = 'none';
    if(DOM.resultPanel) DOM.resultPanel.style.display = '';

    // テーブル生成（20チーム）
    renderResult(champion, rows);
  };

  // （将来）交戦時に sim から敵情報を渡したい時用
  UI.setEnemy = function(enemy){
    // enemy: { teamId, name, img }
    STATE.battleEnemy = enemy || null;
    if(!STATE.battleEnemy){
      hideEnemy();
      return;
    }
    if(DOM.enemyWrap){
      DOM.enemyWrap.style.display = '';
      DOM.enemyName.textContent = STATE.battleEnemy.name || '';
      DOM.enemyImg.src = STATE.battleEnemy.img || '';
    }
  };

  UI.clearEnemy = function(){
    STATE.battleEnemy = null;
    hideEnemy();
  };

  // ---------------------------------------------------------
  // Rendering
  // ---------------------------------------------------------
  function setLog(text){
    if(DOM.logText){
      DOM.logText.textContent = text;
    }
  }

  function setBackground(newBg, slide){
    if(!DOM.sceneBg) return;
    if(STATE.lastBg === newBg){
      return;
    }

    if(!slide){
      DOM.sceneBg.src = withCacheBuster(newBg);
      STATE.lastBg = newBg;
      return;
    }

    // 横スライド：旧BG→左へ、新BG→右から入る
    const parent = DOM.sceneBg.parentElement;
    if(!parent){
      DOM.sceneBg.src = withCacheBuster(newBg);
      STATE.lastBg = newBg;
      return;
    }

    const oldImg = DOM.sceneBg;
    const newImg = oldImg.cloneNode(false);
    newImg.src = withCacheBuster(newBg);

    // newImgを右に待機
    newImg.style.position = 'absolute';
    newImg.style.left = '0';
    newImg.style.top = '0';
    newImg.style.transform = 'translateX(100%)';
    newImg.style.transition = 'transform 420ms ease';
    newImg.style.zIndex = oldImg.style.zIndex || 1;

    // oldImgもabsolute化してスライド
    oldImg.style.position = 'absolute';
    oldImg.style.left = '0';
    oldImg.style.top = '0';
    oldImg.style.transition = 'transform 420ms ease';
    oldImg.style.transform = 'translateX(0%)';

    parent.style.position = 'relative';
    parent.appendChild(newImg);

    // 次フレームで動かす
    requestAnimationFrame(()=>{
      oldImg.style.transform = 'translateX(-100%)';
      newImg.style.transform = 'translateX(0%)';
    });

    // 片付け
    setTimeout(()=>{
      // 新しいimgを正規の sceneBg として扱うため差し替え
      if(oldImg.parentElement){
        oldImg.parentElement.removeChild(oldImg);
      }
      newImg.id = 'sceneBg';
      newImg.style.position = '';
      newImg.style.left = '';
      newImg.style.top = '';
      newImg.style.transform = '';
      newImg.style.transition = '';
      newImg.style.zIndex = '';

      // DOM参照更新
      DOM.sceneBg = newImg;

      STATE.lastBg = newBg;
    }, 460);
  }

  function renderResult(champion, rows){
    if(!DOM.resultTableWrap) return;

    // クリア
    DOM.resultTableWrap.innerHTML = '';

    // タイトル（チャンピオン）
    const title = document.createElement('div');
    title.style.fontWeight = '900';
    title.style.fontSize = '18px';
    title.style.margin = '10px 0 8px 0';
    title.style.textAlign = 'center';
    title.textContent = champion ? `CHAMPION : ${champion}` : 'RESULT';
    DOM.resultTableWrap.appendChild(title);

    // 表ヘッダ
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

    // rows が不足しても 20枠まで埋める（表示崩れ防止）
    const list = rows.slice(0);
    // place 昇順に整列済みを想定（sim-result.js がそう返す）
    for(let i=0;i<list.length;i++){
      const r = list[i];
      const tr = document.createElement('tr');

      // 行スタイル
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

      // プレイヤー個人成績（3人分）を行の下に追記（任意）
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

  // ---------------------------------------------------------
  // Player panel sync
  // ---------------------------------------------------------
  function syncPlayerPanel(){
    // プレイヤー絵：装備中P?.png（現状は index.html の teamImage をそのまま使う）
    // ただし、外部で装備が変わる可能性があるので hook を用意
    const player = getPlayerTeamGuess();
    STATE.playerTeam = player;

    if(DOM.playerName){
      DOM.playerName.textContent = player?.name || 'PLAYER';
    }
    // 画像は index.html の初期値を尊重（勝手に変えない）
    // ただし player.img があれば差し替え可能
    if(player?.img && DOM.teamImage){
      DOM.teamImage.src = withCacheBuster(player.img);
    }

    // ピクセル表現
    if(DOM.teamImage){
      DOM.teamImage.style.imageRendering = 'pixelated';
    }
  }

  function getPlayerTeamGuess(){
    // data_player.js の実装に依存しないための安全取得
    // あり得る候補を順に見る（存在しなければ最小限）
    try{
      if(window.DataPlayer?.getTeam){
        const t = window.DataPlayer.getTeam();
        return {
          name: t?.name || 'PLAYER',
          img: t?.img || null
        };
      }
      if(window.PLAYER_TEAM){
        return {
          name: window.PLAYER_TEAM.name || 'PLAYER',
          img: window.PLAYER_TEAM.img || null
        };
      }
      // index.html の teamImage をそのまま採用
      const img = DOM.teamImage?.getAttribute('src') || 'assets/P1.png';
      return { name: 'PLAYER', img };
    }catch(_e){
      const img = DOM.teamImage?.getAttribute('src') || 'assets/P1.png';
      return { name: 'PLAYER', img };
    }
  }

  // ---------------------------------------------------------
  // Cache bust helper
  // ---------------------------------------------------------
  function withCacheBuster(path){
    // すでに ?v= が付いているなら触らない
    if(!path) return path;
    if(path.includes('?v=')) return path;
    // GitHub反映遅延対策：軽い乱数ではなく、日次固定（キャッシュ破壊しすぎ防止）
    const d = new Date();
    const stamp = `${d.getFullYear()}${pad2(d.getMonth()+1)}${pad2(d.getDate())}`;
    return `${path}?v=${stamp}`;
  }
  function pad2(n){ return (n<10?'0':'')+n; }

})();
