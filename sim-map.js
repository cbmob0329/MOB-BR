/* =========================================================
   MOB BR - sim-map.js (FULL)
   - エリア定義（mapについて.txt 準拠）
   - 降下配置（R1：16分散 + 被り4箇所）
   - 移動（ラウンド終了時）
   ---------------------------------------------------------
   画像は maps/ 配下（ユーザー構成）
========================================================= */

(function(){
  'use strict';

  const SimMap = {};
  window.SimMap = SimMap;

  const IMG = () => (window.RULES?.MAP?.areaImgBase || 'maps/');

  // mapについて.txt のエリア一覧そのまま
  const AREA = {
    1:{  name:'ネオン噴水西',  img:'neonhun.png' },
    2:{  name:'ネオン噴水東',  img:'neonhun.png' },
    3:{  name:'ネオン噴水南',  img:'neonhun.png' },
    4:{  name:'ネオン噴水北',  img:'neonhun.png' },
    5:{  name:'ネオン中心街',  img:'neonmain.png' },
    6:{  name:'ネオンジム',    img:'neongym.png' },
    7:{  name:'ネオンペイント街西', img:'neonstreet.png' },
    8:{  name:'ネオンペイント街東', img:'neonstreet.png' },
    9:{  name:'ネオンパプリカ広場西', img:'neonpap.png' },
    10:{ name:'ネオンパプリカ広場東', img:'neonpap.png' },
    11:{ name:'ネオンパルクール広場西', img:'neonpal.png' },
    12:{ name:'ネオンパルクール広場東', img:'neonpal.png' },
    13:{ name:'ネオン裏路地西', img:'neonura.png' },
    14:{ name:'ネオン裏路地東', img:'neonura.png' },
    15:{ name:'ネオン裏路地南', img:'neonura.png' },
    16:{ name:'ネオン裏路地北', img:'neonura.png' },
    17:{ name:'ネオン大橋', img:'neonbrige.png' },
    18:{ name:'ネオン工場', img:'neonfact.png' },
    19:{ name:'ネオンどんぐり広場西', img:'neondon.png' },
    20:{ name:'ネオンどんぐり広場東', img:'neondon.png' },
    21:{ name:'ネオンスケボー広場', img:'neonske.png' },
    22:{ name:'ネオン秘密基地', img:'neonhimi.png' },
    23:{ name:'ネオンライブハウス', img:'neonlivehouse.png' },
    24:{ name:'ネオンライブステージ', img:'neonlivestage.png' },
    25:{ name:'ネオン街最終エリア', img:'neonfinal.png' },
  };

  SimMap.getArea = function(areaId){
    return AREA[areaId] || null;
  };

  SimMap.getAreaName = function(areaId){
    return AREA[areaId]?.name || `Area${areaId}`;
  };

  SimMap.getAreaImg = function(areaId){
    const f = AREA[areaId]?.img;
    if(!f) return window.RULES?.MAP?.screens?.main1 || 'main.png';
    return IMG() + f;
  };

  // R1降下：20チームを確定配置（16分散＋被り4箇所）
  SimMap.deployR1 = function(teams){
    const list = (teams || []).slice();
    shuffleInPlace(list);

    // 先頭16 → Area1〜16
    for(let i=0;i<16 && i<list.length;i++){
      list[i].areaId = i + 1;
    }

    // 被り4箇所（Area1〜16から4つ）
    const overlapped = shuffle(range(1,16)).slice(0,4);

    // 残り4 → 被りへ
    for(let i=16;i<20 && i<list.length;i++){
      list[i].areaId = overlapped[i - 16];
    }

    // 元配列へ反映
    const byId = new Map(list.map(t => [t.teamId, t]));
    for(const t of teams){
      const src = byId.get(t.teamId);
      if(src) t.areaId = src.areaId;
    }

    return { overlappedAreas: overlapped.slice() };
  };

  SimMap.moveAllAliveTo = function(teams, targetAreas){
    const targets = (targetAreas || []).slice();
    if(targets.length === 0) return;
    for(const t of teams || []){
      if(t && !t.eliminated){
        t.areaId = targets[Math.floor(Math.random() * targets.length)];
      }
    }
  };

  SimMap.teamsInArea = function(teams, areaId){
    const out = [];
    for(const t of teams || []){
      if(!t || t.eliminated) continue;
      if(t.areaId === areaId) out.push(t);
    }
    return out;
  };

  function range(a,b){ const out=[]; for(let i=a;i<=b;i++) out.push(i); return out; }
  function shuffle(arr){ const a=arr.slice(); shuffleInPlace(a); return a; }
  function shuffleInPlace(a){
    for(let i=a.length-1;i>0;i--){
      const j=Math.floor(Math.random()*(i+1));
      const tmp=a[i]; a[i]=a[j]; a[j]=tmp;
    }
  }

})();
