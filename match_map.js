'use strict';

/*
  MOB BR - match_map.js v2（フル / マップ定義＋降下＋移動）

  役割：
  - マップ「モブバトルロイヤルステージ」定義（Area1〜25）
    - areaId / name / image（背景PNG）
  - R別に使われるAreaプール（R1〜R6）
  - 試合開始時の「ランダム降下」
    - 20チーム / 25エリアなので、使われないエリアが出ることがある（仕様）
  - Round終了時の移動（R1〜R5）
  - R6 は最終エリア（Area25：neonfinal.png）固定

  注意：
  - ここでは「リング収縮」などは扱わない（目的地扱いなので、R別エリア制御のみ）
  - 「降下禁止エリア」の指定が将来入っても、"初動だけ禁止／移動で入るのはOK" を守れるよう、
    初動の候補プールを切り分け可能な形にしている（今は全R1候補OK）

  やらない：
  - 戦闘 / 勝敗 / イベント / UI / ログ

  依存：
  - match_state.js（必須）
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.match = window.MOBBR.match || {};

(function(){
  const MS = window.MOBBR?.match?.state;
  if (!MS){
    console.warn('[match_map] match_state.js not found');
    return;
  }

  // =========================
  // マップ概要（仕様）
  // =========================
  const MAP = {
    id: 'mobbr_stage',
    name: 'モブバトルロイヤルステージ',
    areaCount: 25,
    teamsPerMatch: 20,

    // 最終目的地（あなたのエリア表に合わせて Area25）
    // ※文面に「ID32」とあったが、25エリア定義なので 25 を正とする
    finalAreaId: 25,
    finalAreaName: 'ネオン街最終エリア'
  };

  // =========================
  // エリア定義（唯一の正）
  // =========================
  const AREAS = [
    // R1-R2（Area1〜16）
    { id: 1,  name:'ネオン噴水西',        image:'neonhun.png' },
    { id: 2,  name:'ネオン噴水東',        image:'neonhun.png' },
    { id: 3,  name:'ネオン噴水南',        image:'neonhun.png' },
    { id: 4,  name:'ネオン噴水北',        image:'neonhun.png' },
    { id: 5,  name:'ネオン中心街',        image:'neonmain.png' },
    { id: 6,  name:'ネオンジム',          image:'neongym.png' },
    { id: 7,  name:'ネオンペイント街西',  image:'neonstreet.png' },
    { id: 8,  name:'ネオンペイント街東',  image:'neonstreet.png' },
    { id: 9,  name:'ネオンパプリカ広場西', image:'neonpap.png' },
    { id:10,  name:'ネオンパプリカ広場東', image:'neonpap.png' },
    { id:11,  name:'ネオンパルクール広場西', image:'neonpal.png' },
    { id:12,  name:'ネオンパルクール広場東', image:'neonpal.png' },
    { id:13,  name:'ネオン裏路地西',      image:'neonura.png' },
    { id:14,  name:'ネオン裏路地東',      image:'neonura.png' },
    { id:15,  name:'ネオン裏路地南',      image:'neonura.png' },
    { id:16,  name:'ネオン裏路地北',      image:'neonura.png' },

    // R3（Area17〜20）
    { id:17,  name:'ネオン大橋',          image:'neonbrige.png' },
    { id:18,  name:'ネオン工場',          image:'neonfact.png' },
    { id:19,  name:'ネオンどんぐり広場西', image:'neondon.png' },
    { id:20,  name:'ネオンどんぐり広場東', image:'neondon.png' },

    // R4（Area21〜22）
    { id:21,  name:'ネオンスケボー広場',   image:'neonske.png' },
    { id:22,  name:'ネオン秘密基地',       image:'neonhimi.png' },

    // R5（Area23〜24）
    { id:23,  name:'ネオンライブハウス',   image:'neonlivehouse.png' },
    { id:24,  name:'ネオンライブステージ', image:'neonlivestage.png' },

    // R6（Area25）
    { id:25,  name:'ネオン街最終エリア',   image:'neonfinal.png' }
  ];

  const AREA_BY_ID = {};
  for (const a of AREAS) AREA_BY_ID[a.id] = a;

  function getArea(areaId){
    return AREA_BY_ID[Number(areaId)] || null;
  }

  // =========================
  // R別の使用エリア（仕様確定）
  // =========================
  const AREAS_BY_ROUND = {
    1: range(1, 16),   // R1
    2: range(1, 16),   // R2
    3: range(17, 20),  // R3
    4: range(21, 22),  // R4
    5: range(23, 24),  // R5
    6: [25],           // R6（固定）
  };

  // =========================
  // 降下（ランダム降下）
  //  - 20チーム / 25エリアなので未使用エリアが出ることがある
  //  - ただしゲーム進行がRでエリア帯が変わるので、初動はR1帯(1〜16)から降下する
  //  - 将来「初動降下禁止エリア」を追加しても、ここで除外すればOK（移動は別処理）
  // =========================
  function initialDrop(state){
    if (!state || !Array.isArray(state.teams)) return;

    const activeTeams = state.teams; // 全20想定（match_state 側が保証）
    const pool = [...AREAS_BY_ROUND[1]]; // 初動候補（R1帯）

    // 20チームに対して pool=16 なので、重複は必ず出る（仕様OK）
    // 「被り4」固定ではなく「完全ランダム」で割り当てる（より仕様に近い）
    // ※もし「被り4固定」に戻したいなら、ここを前回式に戻せる
    for (const t of activeTeams){
      t.areaId = pool[Math.floor(Math.random() * pool.length)];
    }

    // round は R1開始へ
    state.round = 1;
  }

  // =========================
  // Round終了時の移動（R1〜R5）
  //  - R6は最終エリア固定
  // =========================
  function moveAfterRound(state){
    if (!state) return;

    const cur = Number(state.round) || 1;
    const next = cur + 1;

    const nextAreas = AREAS_BY_ROUND[next];
    if (!nextAreas) return;

    // R6：全員 Area25 固定（生存のみ）
    if (next === 6){
      MS.getActiveTeams(state).forEach(t => { t.areaId = 25; });
      state.round = 6;
      return;
    }

    // R1〜R5：次ラウンド帯の中でランダム移動
    const pool = [...nextAreas];
    MS.getActiveTeams(state).forEach(t=>{
      t.areaId = pool[Math.floor(Math.random() * pool.length)];
    });

    state.round = next;
  }

  // =========================
  // util
  // =========================
  function range(a, b){
    const out = [];
    for (let i = a; i <= b; i++) out.push(i);
    return out;
  }

  // =========================
  // 公開API
  // =========================
  window.MOBBR.match.map = {
    VERSION: 'v2',

    MAP,
    AREAS,
    AREAS_BY_ROUND,

    getArea,

    // core behaviors
    initialDrop,
    moveAfterRound
  };
})();
