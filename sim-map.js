/* =========================================================
   MOB BR - sim-map.js (FULL)
   - マップ定義（Area 1〜25）
   - 降下配置（R1：16分散 + 被り4箇所）
   - 移動（ラウンド終了時：次ラウンドの候補エリアへ再配置）
   ---------------------------------------------------------
   提供：window.SimMap
   - getArea(areaId)
   - getAreaName(areaId)
   - getAreaImg(areaId)
   - deployR1(teams) -> { overlappedAreas: [..] }
   - moveAllAliveTo(teams, targetAreas)
   - teamsInArea(teams, areaId)
========================================================= */

(function(){
  'use strict';

  const SimMap = {};
  window.SimMap = SimMap;

  /* =========================
     AREA DEFINITIONS
     mapについて.txt 準拠（画像名固定）
  ========================== */
  const AREA = {
    // R1-R2
    1:{  name:'ネオン噴水西',  img:'assets/neonhun.png' },
    2:{  name:'ネオン噴水東',  img:'assets/neonhun.png' },
    3:{  name:'ネオン噴水南',  img:'assets/neonhun.png' },
    4:{  name:'ネオン噴水北',  img:'assets/neonhun.png' },
    5:{  name:'ネオン中心街',  img:'assets/neonmain.png' },
    6:{  name:'ネオンジム',    img:'assets/neongym.png' },
    7:{  name:'ネオンペイント街西', img:'assets/neonstreet.png' },
    8:{  name:'ネオンペイント街東', img:'assets/neonstreet.png' },
    9:{  name:'ネオンパプリカ広場西', img:'assets/neonpap.png' },
    10:{ name:'ネオンパプリカ広場東', img:'assets/neonpap.png' },
    11:{ name:'ネオンパルクール広場西', img:'assets/neonpal.png' },
    12:{ name:'ネオンパルクール広場東', img:'assets/neonpal.png' },
    13:{ name:'ネオン裏路地西', img:'assets/neonura.png' },
    14:{ name:'ネオン裏路地東', img:'assets/neonura.png' },
    15:{ name:'ネオン裏路地南', img:'assets/neonura.png' },
    16:{ name:'ネオン裏路地北', img:'assets/neonura.png' },

    // R3
    17:{ name:'ネオン大橋', img:'assets/neonbrige.png' },
    18:{ name:'ネオン工場', img:'assets/neonfact.png' },
    19:{ name:'ネオンどんぐり広場西', img:'assets/neondon.png' },
    20:{ name:'ネオンどんぐり広場東', img:'assets/neondon.png' },

    // R4
    21:{ name:'ネオンスケボー広場', img:'assets/neonske.png' },
    22:{ name:'ネオン秘密基地', img:'assets/neonhimi.png' },

    // R5
    23:{ name:'ネオンライブハウス', img:'assets/neonlivehouse.png' },
    24:{ name:'ネオンライブステージ', img:'assets/neonlivestage.png' },

    // R6
    25:{ name:'ネオン街最終エリア', img:'assets/neonfinal.png' },
  };

  /* =========================
     PUBLIC API
  ========================== */

  SimMap.getArea = function(areaId){
    return AREA[areaId] || null;
  };

  SimMap.getAreaName = function(areaId){
    return (AREA[areaId] && AREA[areaId].name) ? AREA[areaId].name : (`Area${areaId}`);
  };

  SimMap.getAreaImg = function(areaId){
    return (AREA[areaId] && AREA[areaId].img) ? AREA[areaId].img : 'assets/main1.png';
  };

  // R1降下：20チームを確定配置
  // 仕様：
  // - 20チームシャッフル
  // - 先頭16チームを Area1〜16 に1チームずつ
  // - 残り4チームを「被りAreaを4つ選び」そこへ1チームずつ追加（=被り4箇所）
  // 戻り値：{ overlappedAreas:[4つ] }
  SimMap.deployR1 = function(teams){
    const list = (teams || []).slice();
    shuffleInPlace(list);

    // 先頭16
    for(let i=0;i<16 && i<list.length;i++){
      list[i].areaId = i + 1;
    }

    // 被り4箇所を選ぶ
    const overlapped = shuffle(range(1,16)).slice(0,4);

    // 残り4
    for(let i=16;i<20 && i<list.length;i++){
      list[i].areaId = overlapped[i - 16];
    }

    // 元teams配列の参照先を更新したい場合があるので、
    // teamId一致で areaId を反映（安全策）
    const byId = new Map(list.map(t => [t.teamId, t]));
    for(const t of teams){
      const src = byId.get(t.teamId);
      if(src) t.areaId = src.areaId;
    }

    return { overlappedAreas: overlapped.slice() };
  };

  // ラウンド終了時の移動（全生存チーム）
  // targetAreas: [areaId, ...]（次ラウンドの候補集合）
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
      if(!t) continue;
      if(t.eliminated) continue;
      if(t.areaId === areaId) out.push(t);
    }
    return out;
  };

  /* =========================
     HELPERS
  ========================== */
  function range(a,b){
    const out = [];
    for(let i=a;i<=b;i++) out.push(i);
    return out;
  }

  function shuffle(arr){
    const a = arr.slice();
    shuffleInPlace(a);
    return a;
  }

  function shuffleInPlace(a){
    for(let i=a.length-1;i>0;i--){
      const j = Math.floor(Math.random()*(i+1));
      const tmp = a[i]; a[i] = a[j]; a[j] = tmp;
    }
  }

})();
