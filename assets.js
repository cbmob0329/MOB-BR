/* assets.js (FULL)
   MOB BR
   VERSION: v1

   役割:
   - 画像/音声アセットの一元管理
   - プリロード（失敗してもゲームは止めない）
   - 取得用ヘルパーを提供

   ルール:
   - ここでは「登録」と「取得」だけ
   - 表示ロジックや状態遷移は持たない
*/

(() => {
  'use strict';

  /* =========================
     アセット定義
  ========================= */
  const IMAGES = {
    // メイン
    haikeimain: './img/haikeimain.png',
    rogo:       './img/rogo.png',
    main1:      './img/main1.png',
    P1:         './img/P1.png',

    // 紙芝居
    map:        './img/map.png',
    ido:        './img/ido.png',
    battle:     './img/battle.png',
    winner:     './img/winner.png',

    // サブ
    shop:       './img/shop.png',
  };

  const SOUNDS = {
    // 例: click: './se/click.wav',
  };

  /* =========================
     内部キャッシュ
  ========================= */
  const _imgCache = new Map();
  const _sndCache = new Map();

  /* =========================
     ロード関数
  ========================= */
  function loadImage(key){
    if (_imgCache.has(key)) return Promise.resolve(_imgCache.get(key));
    const src = IMAGES[key];
    if (!src) return Promise.reject(new Error(`Image key not found: ${key}`));

    return new Promise((resolve) => {
      const img = new Image();
      img.onload = () => { _imgCache.set(key, img); resolve(img); };
      img.onerror = () => { resolve(null); }; // 失敗しても止めない
      img.src = src;
    });
  }

  function loadSound(key){
    if (_sndCache.has(key)) return Promise.resolve(_sndCache.get(key));
    const src = SOUNDS[key];
    if (!src) return Promise.reject(new Error(`Sound key not found: ${key}`));

    return new Promise((resolve) => {
      const a = new Audio();
      a.oncanplaythrough = () => { _sndCache.set(key, a); resolve(a); };
      a.onerror = () => { resolve(null); };
      a.src = src;
      a.load();
    });
  }

  /* =========================
     プリロード
  ========================= */
  function preloadAll(){
    const imgTasks = Object.keys(IMAGES).map(k => loadImage(k));
    const sndTasks = Object.keys(SOUNDS).map(k => loadSound(k));
    return Promise.allSettled([...imgTasks, ...sndTasks]);
  }

  /* =========================
     取得ヘルパー
  ========================= */
  function getImage(key){
    return _imgCache.get(key) || null;
  }
  function getSound(key){
    return _sndCache.get(key) || null;
  }

  /* =========================
     公開
  ========================= */
  window.Assets = {
    IMAGES,
    SOUNDS,
    preloadAll,
    loadImage,
    loadSound,
    getImage,
    getSound,
  };

})();
