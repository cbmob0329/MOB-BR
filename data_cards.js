'use strict';

/*
  MOB BR - data_cards.js v14（SSR最高レア版）

  役割：
  - コレクションカードの「唯一の定義元」
    - id / name / rarity / imagePath（cards/配下）
  - SSRを最高レアとして扱う（UR/LRは未実装）
  - 仕様テーブル（所持ボーナス、重ね、11枚目以降のG変換、排出率、CP仕様）

  注意：
  - UI表示はここではしない（ui_card/ui_shop 側で使う）
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.data = window.MOBBR.data || {};

(function(){
  // ===== Rarity (SSR is MAX for now) =====
  const RARITY = {
    R: 'R',
    SR: 'SR',
    SSR: 'SSR'
  };

  // ===== Bonus tables (percent values) =====
  // base% + (stackBonus% * (count-1))  ※最大10枚まで
  const BONUS = {
    R:   { base: 0.05, stack: 0.01, maxCount: 10 },
    SR:  { base: 0.08, stack: 0.02, maxCount: 10 },
    SSR: { base: 0.11, stack: 0.04, maxCount: 10 }
  };

  // ===== Convert (11th+) =====
  const CONVERT_G = {
    R: 1000,
    SR: 3000,
    SSR: 10000
  };

  // ===== Gacha probabilities (SSR is top) =====
  // 通常：R 85% / SR 12% / SSR 3%  （SSR最高化のため端数調整）
  const GACHA_RATE_NORMAL = [
    { rarity: 'R',   p: 0.85 },
    { rarity: 'SR',  p: 0.12 },
    { rarity: 'SSR', p: 0.03 }
  ];

  // SR以上確定（100CP）：SR 80% / SSR 20%（UR無しの置き換え）
  const GACHA_RATE_SR_PLUS = [
    { rarity: 'SR',  p: 0.80 },
    { rarity: 'SSR', p: 0.20 }
  ];

  // ===== CP =====
  const CP = {
    key: 'mobbr_cp',         // storage側で統合してもOK
    perPull: 1,
    exchangeCost: 100
  };

  // ===== Card master list =====
  // 画像はすべて cards/ フォルダ配下
  const CARDS = [
    // ---- R ----
    { id:'R1',  name:'回復準備', image:'R1.png',  rarity:'R' },
    { id:'R2',  name:'医療キット', image:'R2.png',  rarity:'R' },
    { id:'R3',  name:'医療パック', image:'R3.png',  rarity:'R' },
    { id:'R4',  name:'回復タワー', image:'R4.png',  rarity:'R' },
    { id:'R5',  name:'UFOキャッチャー', image:'R5.png',  rarity:'R' },
    { id:'R6',  name:'射的', image:'R6.png',  rarity:'R' },
    { id:'R7',  name:'ハンドガン', image:'R7.png',  rarity:'R' },
    { id:'R8',  name:'縄跳び', image:'R8.png',  rarity:'R' },
    { id:'R9',  name:'インベーダー', image:'R9.png',  rarity:'R' },
    { id:'R10', name:'滝修行', image:'R10.png', rarity:'R' },
    { id:'R11', name:'メダルゲーム', image:'R11.png', rarity:'R' },
    { id:'R12', name:'考え事', image:'R12.png', rarity:'R' },
    { id:'R13', name:'小休憩', image:'R13.png', rarity:'R' },
    { id:'R14', name:'のんびり', image:'R14.png', rarity:'R' },
    { id:'R15', name:'魚釣り', image:'R15.png', rarity:'R' },
    { id:'R16', name:'弾薬チェック', image:'R16.png', rarity:'R' },
    { id:'R17', name:'アタッシュケース', image:'R17.png', rarity:'R' },
    { id:'R18', name:'降下', image:'R18.png', rarity:'R' },
    { id:'R19', name:'武器を選ぶ', image:'R19.png', rarity:'R' },
    { id:'R20', name:'焚火', image:'R20.png', rarity:'R' },
    { id:'R21', name:'話し合い', image:'R21.png', rarity:'R' },
    { id:'R22', name:'ダッシュ', image:'R22.png', rarity:'R' },
    { id:'R23', name:'デスボックス', image:'R23.png', rarity:'R' },
    { id:'R24', name:'話し合い2', image:'R24.png', rarity:'R' },
    { id:'R25', name:'2人でダッシュ', image:'R25.png', rarity:'R' },
    { id:'R26', name:'20位だった', image:'R26.png', rarity:'R' },
    { id:'R27', name:'パズル', image:'R27.png', rarity:'R' },
    { id:'R28', name:'ショットガン', image:'R28.png', rarity:'R' },
    { id:'R29', name:'貯金', image:'R29.png', rarity:'R' },
    { id:'R30', name:'スナイパー', image:'R30.png', rarity:'R' },
    { id:'R31', name:'ハムエッグ', image:'R31.png', rarity:'R' },
    { id:'R32', name:'射撃練習', image:'R32.png', rarity:'R' },
    { id:'R33', name:'回復中', image:'R33.png', rarity:'R' },
    { id:'R34', name:'これください', image:'R34.png', rarity:'R' },
    { id:'R35', name:'M', image:'R35.png', rarity:'R' },
    { id:'R36', name:'O', image:'R36.png', rarity:'R' },
    { id:'R37', name:'B', image:'R37.png', rarity:'R' },
    { id:'R38', name:'BR', image:'R38.png', rarity:'R' },

    // ---- SR ----
    { id:'SR1',  name:'ハッピーバースデー', image:'SR1.png',  rarity:'SR' },
    { id:'SR2',  name:'ギャラクシー', image:'SR2.png',  rarity:'SR' },
    { id:'SR3',  name:'マツヤマーズ', image:'SR3.png',  rarity:'SR' },
    { id:'SR4',  name:'ビーダマンズ', image:'SR4.png',  rarity:'SR' },
    { id:'SR5',  name:'スモークキャッツ', image:'SR5.png',  rarity:'SR' },
    { id:'SR6',  name:'ゴーストライダー', image:'SR6.png',  rarity:'SR' },
    { id:'SR7',  name:'タートルパンチ', image:'SR7.png',  rarity:'SR' },
    { id:'SR8',  name:'三色坊ちゃんズ', image:'SR8.png',  rarity:'SR' },
    { id:'SR9',  name:'温泉愛好会', image:'SR9.png',  rarity:'SR' },
    { id:'SR10', name:'ヤマノコ', image:'SR10.png', rarity:'SR' },
    { id:'SR11', name:'トランプ大会', image:'SR11.png', rarity:'SR' },
    { id:'SR12', name:'イチロクマルマルーズ', image:'SR12.png', rarity:'SR' },
    { id:'SR13', name:'平和の象徴', image:'SR13.png', rarity:'SR' },
    { id:'SR14', name:'ミュータントゴブリンズ', image:'SR14.png', rarity:'SR' },
    { id:'SR15', name:'仮面ファイターバトロンズ', image:'SR15.png', rarity:'SR' },
    { id:'SR16', name:'名探偵シャーロック', image:'SR16.png', rarity:'SR' },
    { id:'SR17', name:'大会情報', image:'SR17.png', rarity:'SR' },
    { id:'SR18', name:'みんなで確認！', image:'SR18.png', rarity:'SR' },
    { id:'SR19', name:'月に誓う', image:'SR19.png', rarity:'SR' },
    { id:'SR20', name:'ダークス', image:'SR20.png', rarity:'SR' },
    { id:'SR21', name:'みんなで演習！', image:'SR21.png', rarity:'SR' },
    { id:'SR22', name:'影ふみ隊', image:'SR22.png', rarity:'SR' },
    { id:'SR23', name:'カワウソミュージック', image:'SR23.png', rarity:'SR' },
    { id:'SR24', name:'バクハツ工房', image:'SR24.png', rarity:'SR' },
    { id:'SR25', name:'カリブガブリチュウ', image:'SR25.png', rarity:'SR' },
    { id:'SR26', name:'ぐーたら', image:'SR26.png', rarity:'SR' },
    { id:'SR27', name:'不思議なダイス', image:'SR27.png', rarity:'SR' },
    { id:'SR28', name:'ライトスモモンズ', image:'SR28.png', rarity:'SR' },
    { id:'SR29', name:'撃ち合い', image:'SR29.png', rarity:'SR' },
    { id:'SR30', name:'喧嘩', image:'SR30.png', rarity:'SR' },
    { id:'SR31', name:'グレネード確認', image:'SR31.png', rarity:'SR' },
    { id:'SR32', name:'ネオン街', image:'SR32.png', rarity:'SR' },
    { id:'SR33', name:'二丁拳銃', image:'SR33.png', rarity:'SR' },
    { id:'SR34', name:'サクラバースト', image:'SR34.png', rarity:'SR' },
    { id:'SR35', name:'東のリーク団', image:'SR35.png', rarity:'SR' },
    { id:'SR36', name:'グレネードマスター', image:'SR36.png', rarity:'SR' },
    { id:'SR37', name:'屋上スナイパー', image:'SR37.png', rarity:'SR' },

    // ---- SSR ----
    { id:'SSR1',  name:'ハンマーズ', image:'SSR1.png',  rarity:'SSR' },
    { id:'SSR2',  name:'セトコーポレーション', image:'SSR2.png',  rarity:'SSR' },
    { id:'SSR3',  name:'悪霊連合', image:'SSR3.png',  rarity:'SSR' },
    { id:'SSR4',  name:'10年公演アンルーシア', image:'SSR4.png',  rarity:'SSR' },
    { id:'SSR5',  name:'スペースバーガーズ', image:'SSR5.png',  rarity:'SSR' },
    { id:'SSR6',  name:'アカツキ', image:'SSR6.png',  rarity:'SSR' },
    { id:'SSR7',  name:'シンビオッツ', image:'SSR7.png',  rarity:'SSR' },
    { id:'SSR8',  name:'ナンバーD', image:'SSR8.png',  rarity:'SSR' },
    { id:'SSR9',  name:'ワールドアーティスト', image:'SSR9.png',  rarity:'SSR' },
    { id:'SSR10', name:'ベロニカイレブンズ', image:'SSR10.png', rarity:'SSR' },
    { id:'SSR11', name:'ジュラシックラプトルズ', image:'SSR11.png', rarity:'SSR' },
    { id:'SSR12', name:'デストロイネコヤシキ', image:'SSR12.png', rarity:'SSR' },
    { id:'SSR13', name:'ホークス', image:'SSR13.png', rarity:'SSR' },
    { id:'SSR14', name:'ダブルマレフィセント', image:'SSR14.png', rarity:'SSR' },
    { id:'SSR15', name:'ドレスドンキホーテ', image:'SSR15.png', rarity:'SSR' },
    { id:'SSR16', name:'シルバーウルフキッド', image:'SSR16.png', rarity:'SSR' },
    { id:'SSR17', name:'スリラー団', image:'SSR17.png', rarity:'SSR' },
    { id:'SSR18', name:'ホールケーキファミリーズ', image:'SSR18.png', rarity:'SSR' },
    { id:'SSR19', name:'フリーズマスターズ', image:'SSR19.png', rarity:'SSR' },
    { id:'SSR20', name:'IFブラックオーダー', image:'SSR20.png', rarity:'SSR' },
    { id:'SSR21', name:'アンドロメダ', image:'SSR21.png', rarity:'SSR' },
    { id:'SSR22', name:'ファーストレジェンズ', image:'SSR22.png', rarity:'SSR' },
    { id:'SSR23', name:'鬼ヶ島', image:'SSR23.png', rarity:'SSR' },
    { id:'SSR24', name:'マリーンオフィス', image:'SSR24.png', rarity:'SSR' }
  ].map(c => ({
    ...c,
    imagePath: `cards/${c.image}`
  }));

  // ===== helpers =====
  function parseId(id){
    // "R38" / "SR12" / "SSR24" -> {prefix:'R'|'SR'|'SSR', num:38}
    const m = String(id).match(/^(SSR|SR|R)(\d+)$/);
    if (!m) return { prefix:'', num: 0 };
    return { prefix: m[1], num: Number(m[2]) || 0 };
  }

  function sortById(a,b){
    const pa = parseId(a.id);
    const pb = parseId(b.id);
    const order = { R:1, SR:2, SSR:3 };
    const da = order[pa.prefix] || 99;
    const db = order[pb.prefix] || 99;
    if (da !== db) return da - db;
    return pa.num - pb.num;
  }

  const CARDS_SORTED = [...CARDS].sort(sortById);

  const byId = {};
  for (const c of CARDS_SORTED) byId[c.id] = c;

  function getAll(){ return CARDS_SORTED; }
  function getById(id){ return byId[id] || null; }

  function listByRarity(rarity){
    return CARDS_SORTED.filter(c => c.rarity === rarity);
  }

  // count(1..10) -> percent
  function calcSingleCardPercent(rarity, count){
    const rule = BONUS[rarity];
    if (!rule) return 0;
    const n = Math.max(0, Math.min(rule.maxCount, Number(count)||0));
    if (n <= 0) return 0;
    return rule.base + rule.stack * (n - 1);
  }

  // ===== expose =====
  window.MOBBR.data.cards = {
    RARITY,
    BONUS,
    CONVERT_G,
    GACHA_RATE_NORMAL,
    GACHA_RATE_SR_PLUS,
    CP,

    getAll,
    getById,
    listByRarity,
    calcSingleCardPercent
  };
})();
