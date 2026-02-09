/* =========================================================
   MOB BR - ui_match_battle.js (FULL)
   - 交戦中レイアウト（画像の「バトルレイアウト.png」準拠）
   - 背景(Area画像) + 上部BATTLEバナー + 左右チーム表示 + チーム名枠 + 中央ログ枠
   ---------------------------------------------------------
   役割：
   ・SimBattle（sim_battle.js）が作る「戦闘ログ/交戦データ」を受け取り
   ・“見た目”として表示するだけ（勝敗計算はしない）

   想定フォルダ（ユーザー構成）：
   - マップ背景：maps/
   - CPUチーム画像：cpu/<teamId>.png
   - プレイヤー画像：ルート or 任意（RULES.UI.playerImgBase で指定）

   使い方（例）：
     // 1) 初期化（表示したい親要素を渡す）
     UIMatchBattle.mount(document.getElementById('gameView'));

     // 2) 交戦開始の表示
     UIMatchBattle.show({
       bgImg: 'maps/neonmain.png',
       player: { teamId:'player', name:'チームA', members:['A','B','C'], img:'P1.png' },
       enemy:  { teamId:'local07', name:'ハンマーズ', members:['X','Y','Z'] }, // imgは自動でcpu/<teamId>.png
       logText: 'ここにログ',
     });

     // 3) ログ更新（NEXTで進める等）
     UIMatchBattle.setLog('IGLがコール！戦闘準備！');

     // 4) 非表示
     UIMatchBattle.hide();
========================================================= */

(function(){
  'use strict';

  const UIMatchBattle = {};
  window.UIMatchBattle = UIMatchBattle;

  // -------------------------
  // 外部上書き可（window.RULES.UI）
  // -------------------------
  const CONF = {
    // 画像ベース
    mapImgBase: 'maps/',
    cpuImgBase: 'cpu/',
    playerImgBase: '', // 例: ''（ルート） or 'player/' など

    // バナー
    bannerImg: 'battle.png', // 無ければテキストで代替
    bannerText: 'BATTLE!!',

    // レイアウト（相対）
    maxW: 620,
    maxH: 620,
    padding: 14,

    // チーム名枠
    nameBoxW: 190,
    nameBoxH: 64,
    nameBoxBg: 'rgba(40,60,200,0.85)',
    nameBoxBorder: '#ffd400',
    nameBoxText: '#ffeaa7',

    // キャラ表示サイズ
    teamImgW: 180,
    teamImgH: 180,

    // ログ枠
    logBoxWRate: 0.86,
    logBoxH: 92,
    logBoxBg: '#1f8f3a',
    logBoxBorder: '#ff2a2a',
    logTextColor: '#ff2a2a',

    // Z
    zBase: 2000
  };

  if (window.RULES?.UI){
    Object.assign(CONF, window.RULES.UI);
  }

  // -------------------------
  // 内部状態
  // -------------------------
  let _mounted = false;
  let _host = null;
  let _root = null;

  // DOM refs
  let _bg = null;
  let _bannerWrap = null;
  let _bannerImg = null;
  let _bannerText = null;

  let _leftBox = null;
  let _rightBox = null;

  let _leftTeamImg = null;
  let _rightTeamImg = null;

  let _logBox = null;
  let _logText = null;

  // -------------------------
  // PUBLIC
  // -------------------------
  UIMatchBattle.mount = function(host){
    if (!host) throw new Error('UIMatchBattle.mount(host) host is required');
    _host = host;

    if (!_mounted){
      injectStyleOnce();
      buildDom();
      _mounted = true;
    }

    // 初期は非表示
    hideRoot();
    return true;
  };

  UIMatchBattle.isMounted = function(){
    return !!_mounted;
  };

  UIMatchBattle.show = function(payload){
    ensureMounted();

    // payload
    const bgImg = payload?.bgImg || '';
    const player = payload?.player || null;
    const enemy  = payload?.enemy  || null;
    const logText = payload?.logText ?? '';

    // 背景
    setBg(bgImg);

    // バナー
    setBanner(payload?.bannerImg, payload?.bannerText);

    // 左右チーム表示
    setTeam('left', player);
    setTeam('right', enemy);

    // ログ
    setLog(logText);

    showRoot();
  };

  UIMatchBattle.hide = function(){
    if (!_mounted) return;
    hideRoot();
  };

  UIMatchBattle.setLog = function(text){
    ensureMounted();
    setLog(text);
  };

  UIMatchBattle.setTeams = function(player, enemy){
    ensureMounted();
    setTeam('left', player);
    setTeam('right', enemy);
  };

  UIMatchBattle.setBackground = function(bgImg){
    ensureMounted();
    setBg(bgImg);
  };

  // -------------------------
  // DOM
  // -------------------------
  function buildDom(){
    // root
    _root = document.createElement('div');
    _root.className = 'mobbr-battle-root';
    _root.style.zIndex = String(CONF.zBase);

    // background
    _bg = document.createElement('div');
    _bg.className = 'mobbr-battle-bg';
    _root.appendChild(_bg);

    // banner
    _bannerWrap = document.createElement('div');
    _bannerWrap.className = 'mobbr-battle-banner';
    _bannerImg = document.createElement('img');
    _bannerImg.className = 'mobbr-battle-banner-img';
    _bannerImg.alt = 'BATTLE';
    _bannerText = document.createElement('div');
    _bannerText.className = 'mobbr-battle-banner-text';
    _bannerText.textContent = CONF.bannerText;

    _bannerWrap.appendChild(_bannerImg);
    _bannerWrap.appendChild(_bannerText);
    _root.appendChild(_bannerWrap);

    // name boxes
    _leftBox = document.createElement('div');
    _leftBox.className = 'mobbr-battle-namebox mobbr-left';
    _leftBox.innerHTML = `<div class="mobbr-battle-name">チーム名</div><div class="mobbr-battle-member">メンバー名</div>`;
    _root.appendChild(_leftBox);

    _rightBox = document.createElement('div');
    _rightBox.className = 'mobbr-battle-namebox mobbr-right';
    _rightBox.innerHTML = `<div class="mobbr-battle-name">チーム名</div><div class="mobbr-battle-member">メンバー名</div>`;
    _root.appendChild(_rightBox);

    // team images
    _leftTeamImg = document.createElement('img');
    _leftTeamImg.className = 'mobbr-battle-teamimg mobbr-left';
    _leftTeamImg.alt = 'player';
    _root.appendChild(_leftTeamImg);

    _rightTeamImg = document.createElement('img');
    _rightTeamImg.className = 'mobbr-battle-teamimg mobbr-right';
    _rightTeamImg.alt = 'enemy';
    _root.appendChild(_rightTeamImg);

    // log
    _logBox = document.createElement('div');
    _logBox.className = 'mobbr-battle-logbox';
    _logText = document.createElement('div');
    _logText.className = 'mobbr-battle-logtext';
    _logText.textContent = '';
    _logBox.appendChild(_logText);
    _root.appendChild(_logBox);

    // attach
    _host.appendChild(_root);
  }

  // -------------------------
  // Setters
  // -------------------------
  function setBg(bgImg){
    const url = resolveMapImg(bgImg);
    _bg.style.backgroundImage = url ? `url("${url}")` : 'none';
  }

  function setBanner(img, text){
    const bannerImg = (img != null && img !== '') ? img : CONF.bannerImg;
    const bannerText = (text != null && text !== '') ? text : CONF.bannerText;

    _bannerText.textContent = bannerText;

    if (bannerImg){
      _bannerImg.src = bannerImg;
      _bannerImg.style.display = 'block';
      _bannerText.style.display = 'none'; // 画像があるならテキスト非表示
      _bannerImg.onerror = function(){
        // 画像無い場合：テキストにフォールバック
        _bannerImg.style.display = 'none';
        _bannerText.style.display = 'flex';
      };
    }else{
      _bannerImg.style.display = 'none';
      _bannerText.style.display = 'flex';
    }
  }

  function setTeam(side, team){
    const isLeft = side === 'left';
    const box = isLeft ? _leftBox : _rightBox;
    const img = isLeft ? _leftTeamImg : _rightTeamImg;

    const nameEl = box.querySelector('.mobbr-battle-name');
    const memEl  = box.querySelector('.mobbr-battle-member');

    const name = team?.name || 'チーム名';
    const members = team?.members || null;

    nameEl.textContent = name;

    if (Array.isArray(members) && members.length){
      memEl.textContent = members.join(' / ');
    }else if (typeof team?.memberText === 'string' && team.memberText){
      memEl.textContent = team.memberText;
    }else{
      memEl.textContent = 'メンバー名';
    }

    const imgSrc = resolveTeamImg(team, isLeft);
    if (imgSrc){
      img.src = imgSrc;
      img.style.visibility = 'visible';
      img.onerror = function(){
        img.style.visibility = 'hidden';
      };
    }else{
      img.style.visibility = 'hidden';
    }
  }

  function setLog(text){
    const t = (text == null) ? '' : String(text);
    _logText.textContent = t;
  }

  // -------------------------
  // URL resolve
  // -------------------------
  function resolveMapImg(bgImg){
    if (!bgImg) return '';
    // すでに maps/ が入ってる or http 等ならそのまま
    if (/^(https?:)?\/\//.test(bgImg)) return bgImg;
    if (bgImg.startsWith(CONF.mapImgBase)) return bgImg;
    // ファイル名だけなら maps/ を付ける
    if (!bgImg.includes('/')) return CONF.mapImgBase + bgImg;
    return bgImg;
  }

  function resolveTeamImg(team, isPlayerSide){
    if (!team) return '';
    if (team.img) return team.img;

    // 左＝プレイヤー想定
    if (isPlayerSide){
      const tid = team.teamId || '';
      // 明示で imgName / playerImg が来たら使う
      if (team.imgName) return CONF.playerImgBase + team.imgName;
      if (team.playerImg) return CONF.playerImgBase + team.playerImg;

      // teamId が 'P1.png' 的に来ることは無い想定。なければ空。
      // ルートに P1.png を置く運用なら、呼び出し側で {img:'P1.png'} を渡してOK
      return '';
    }

    // 右＝CPU（teamId.png を cpu/ から）
    const cpuId = team.teamId || '';
    if (!cpuId) return '';
    return CONF.cpuImgBase + cpuId + '.png';
  }

  // -------------------------
  // Show/Hide
  // -------------------------
  function hideRoot(){
    if (_root) _root.style.display = 'none';
  }
  function showRoot(){
    if (_root) _root.style.display = 'block';
  }

  function ensureMounted(){
    if (!_mounted || !_root) throw new Error('UIMatchBattle is not mounted. Call UIMatchBattle.mount(host) first.');
  }

  // -------------------------
  // CSS
  // -------------------------
  let _styleInjected = false;
  function injectStyleOnce(){
    if (_styleInjected) return;
    _styleInjected = true;

    const css = `
      .mobbr-battle-root{
        position: relative;
        width: 100%;
        max-width: ${CONF.maxW}px;
        aspect-ratio: 1 / 1;
        margin: 0 auto;
        overflow: hidden;
        user-select: none;
        -webkit-user-select: none;
      }

      .mobbr-battle-bg{
        position: absolute;
        inset: 0;
        background-size: cover;
        background-position: center;
        transform: translateZ(0);
      }

      .mobbr-battle-banner{
        position: absolute;
        top: 10px;
        left: 50%;
        transform: translateX(-50%);
        width: 62%;
        height: 74px;
        display: flex;
        align-items: center;
        justify-content: center;
        pointer-events: none;
      }
      .mobbr-battle-banner-img{
        max-width: 100%;
        max-height: 100%;
        object-fit: contain;
        display: block;
      }
      .mobbr-battle-banner-text{
        width: 100%;
        height: 100%;
        display: none;
        align-items: center;
        justify-content: center;
        font-weight: 900;
        font-size: 34px;
        letter-spacing: 1px;
        color: #ffd400;
        text-shadow: 0 3px 0 rgba(0,0,0,0.6);
      }

      .mobbr-battle-namebox{
        position: absolute;
        top: 96px;
        width: ${CONF.nameBoxW}px;
        height: ${CONF.nameBoxH}px;
        background: ${CONF.nameBoxBg};
        border: 4px solid ${CONF.nameBoxBorder};
        box-sizing: border-box;
        display: flex;
        flex-direction: column;
        justify-content: center;
        padding: 6px 10px;
        gap: 4px;
        pointer-events: none;
      }
      .mobbr-battle-namebox.mobbr-left{ left: 24px; }
      .mobbr-battle-namebox.mobbr-right{ right: 24px; }

      .mobbr-battle-name{
        font-size: 16px;
        font-weight: 900;
        color: ${CONF.nameBoxText};
        line-height: 1.05;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
      }
      .mobbr-battle-member{
        font-size: 13px;
        font-weight: 800;
        color: ${CONF.nameBoxText};
        line-height: 1.05;
        white-space: nowrap;
        overflow: hidden;
        text-overflow: ellipsis;
        opacity: 0.95;
      }

      .mobbr-battle-teamimg{
        position: absolute;
        bottom: 132px;
        width: ${CONF.teamImgW}px;
        height: ${CONF.teamImgH}px;
        object-fit: contain;
        image-rendering: pixelated;
        pointer-events: none;
      }
      .mobbr-battle-teamimg.mobbr-left{ left: 40px; }
      .mobbr-battle-teamimg.mobbr-right{ right: 40px; }

      .mobbr-battle-logbox{
        position: absolute;
        left: 50%;
        transform: translateX(-50%);
        bottom: 28px;
        width: calc(${Math.round(CONF.logBoxWRate*100)}% - 0px);
        height: ${CONF.logBoxH}px;
        background: ${CONF.logBoxBg};
        border: 6px solid ${CONF.logBoxBorder};
        box-sizing: border-box;
        display: flex;
        align-items: center;
        justify-content: center;
        padding: 10px 14px;
        pointer-events: none;
      }
      .mobbr-battle-logtext{
        width: 100%;
        font-size: 28px;
        font-weight: 900;
        color: ${CONF.logTextColor};
        text-align: center;
        line-height: 1.2;
        text-shadow: 0 2px 0 rgba(0,0,0,0.20);
        word-break: keep-all;
        overflow: hidden;
        display: -webkit-box;
        -webkit-line-clamp: 2;
        -webkit-box-orient: vertical;
      }

      @media (max-width: 420px){
        .mobbr-battle-namebox{
          width: ${Math.round(CONF.nameBoxW*0.86)}px;
          height: ${Math.round(CONF.nameBoxH*0.92)}px;
          top: 86px;
        }
        .mobbr-battle-teamimg{
          width: ${Math.round(CONF.teamImgW*0.86)}px;
          height: ${Math.round(CONF.teamImgH*0.86)}px;
          bottom: 126px;
        }
        .mobbr-battle-logtext{ font-size: 24px; }
        .mobbr-battle-banner{ height: 64px; }
        .mobbr-battle-banner-text{ font-size: 30px; }
      }
    `;

    const style = document.createElement('style');
    style.type = 'text/css';
    style.appendChild(document.createTextNode(css));
    document.head.appendChild(style);
  }

})();
