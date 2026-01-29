/* =====================================================
   data_const.js  (FULL)
   MOB Tournament Simulation
   固定定数 / スケジュール / 大会定義 / マップID枠
   ===================================================== */

window.DATA_CONST = (function () {

  /* =========================
     固定ルール（ゲーム根幹）
     ========================= */
  const CONST = {
    PARTY_SIZE: 3,
    LOCAL_TEAM_COUNT: 20,     // ローカル大会：20チーム
    // ナショナル/ワールドは「別ルールで増える」想定だが、今は土台だけ
    MAX_TEAM_COUNT: 40,

    ARMOR_BASE: 100,          // Armor 基本100固定（上限も100扱い）
    SYNERGY_BASE: 20,         // 連携（初期）
    SYNERGY_MAX: 200,

    // 仕様：未画像は assets.js プレースホルダ表示（ここでは画像名を列挙）
    IMAGES: {
      PLAYER_TEAM_DEFAULT: 'P1.png',
      MAIN_BG: 'haikeimain.png',   // 既存運用（なければ assets.js がプレースホルダ化）
      MAIN_SCREEN: 'main.png',     // 仕様ファイル名（あなたのコンセプト）
      MAIN_SCREEN_ALT: 'main1.png',// 既存運用（今回index/game側が参照）
      MAP: 'map.png',
      MOVE: 'ido.png',
      SHOP: 'shop.png',
      HEAL: 'heal.png',
      BATTLE: 'battle.png',
      WINNER: 'winner.png'
    }
  };

  /* =========================
     スケジュール表示（UI用）
     ※あなたが共有してくれた表記をそのまま採用
     ========================= */
  const scheduleText = [
    '2月第1週',
    'SP1 ローカル大会',
    '',
    '3月第1週',
    'SP1 ナショナル大会',
    'A & B  C & D  A & C',
    '3月第2週',
    'B & C',
    'A & D',
    'B & D',
    '3月第3週',
    'ナショナル大会ラストチャンス',
    '4月第1週',
    'SP1 ワールドファイナル',
    '',
    '7月第1週',
    'SP2 ローカル大会',
    '',
    '8月第1週',
    'SP2 ナショナル大会',
    'A & B  C & D  A & C',
    '8月第2週',
    'B & C',
    'A & D',
    'B & D',
    '8月第3週',
    'SP2 ナショナル大会ラストチャンス',
    '9月第1週',
    'SP2 ワールドファイナル',
    '',
    '11月第1週',
    'チャンピオンシップ ローカル大会',
    '',
    '12月第1週',
    'チャンピオンシップ ナショナル大会',
    'A & B  C & D  A & C',
    '12月第2週',
    'B & C',
    'A & D',
    'B & D',
    '12月第3週',
    'チャンピオンシップ ナショナル大会ラストチャンス',
    '',
    '1月第2週',
    'チャンピオンシップ ワールドファイナル'
  ].join('\n');

  /* =========================
     大会（年週）定義
     - 「年週」で確定させるため、まずは1989年の標準スケジュールを作る
     - 月第n週 → だいたい「(月-1)*4 + n」週として扱う（暫定）
       ※厳密カレンダーではなく“ゲーム内週”として運用
     - 例：2月第1週 = 5週、3月第1週 = 9週、4月第1週 = 13週、7月第1週 = 25週...
     - チャンピオンシップ ワールドだけ「翌年1月第2週」として year+1 で定義
     ========================= */

  function w(month, nthWeek) {
    return (month - 1) * 4 + nthWeek; // 1月第1週=1, 2月第1週=5 ...
  }

  function label(month, nthWeek) {
    return `${month}月第${nthWeek}週`;
  }

  // tournaments: [{year, week, key, name, tier, seasonKey, dateLabel}]
  const tournaments = [
    // ---- SP1 ----
    { year: 1989, week: w(2,1),  key: 'SP1_LOCAL',     name: 'SP1 ローカル大会',           tier: 'LOCAL',    seasonKey: 'SP1',   dateLabel: label(2,1) },
    { year: 1989, week: w(3,1),  key: 'SP1_NATIONAL',  name: 'SP1 ナショナル大会',         tier: 'NATIONAL', seasonKey: 'SP1',   dateLabel: label(3,1) },
    { year: 1989, week: w(4,1),  key: 'SP1_WORLD',     name: 'SP1 ワールドファイナル',     tier: 'WORLD',    seasonKey: 'SP1',   dateLabel: label(4,1) },

    // ---- SP2 ----
    { year: 1989, week: w(7,1),  key: 'SP2_LOCAL',     name: 'SP2 ローカル大会',           tier: 'LOCAL',    seasonKey: 'SP2',   dateLabel: label(7,1) },
    { year: 1989, week: w(8,1),  key: 'SP2_NATIONAL',  name: 'SP2 ナショナル大会',         tier: 'NATIONAL', seasonKey: 'SP2',   dateLabel: label(8,1) },
    { year: 1989, week: w(9,1),  key: 'SP2_WORLD',     name: 'SP2 ワールドファイナル',     tier: 'WORLD',    seasonKey: 'SP2',   dateLabel: label(9,1) },

    // ---- CHAMP ----
    { year: 1989, week: w(11,1), key: 'CHAMP_LOCAL',   name: 'チャンピオンシップ ローカル大会', tier: 'LOCAL',    seasonKey: 'CHAMP', dateLabel: label(11,1) },
    { year: 1989, week: w(12,1), key: 'CHAMP_NATIONAL',name: 'チャンピオンシップ ナショナル大会',tier: 'NATIONAL', seasonKey: 'CHAMP', dateLabel: label(12,1) },

    // 翌年：1月第2週（year+1, week=2）
    { year: 1990, week: w(1,2),  key: 'CHAMP_WORLD',   name: 'チャンピオンシップ ワールドファイナル', tier: 'WORLD', seasonKey: 'CHAMP', dateLabel: label(1,2) }
  ];

  /* =========================
     マップID（場所）枠：ID1〜ID32
     - 現時点では名前が未確定なので仮置き
     - 後であなたが「ID◯は◯◯」と指定したらここを更新して確定させる
     ========================= */
  const mapAreas = [];
  for (let i = 1; i <= 32; i++) {
    mapAreas.push({
      id: i,
      key: `AREA_${String(i).padStart(2, '0')}`,
      name: `エリア${i}`,     // 仮名（後で確定）
      // 後でルート/隣接/危険度/物資などを追加する想定
      tags: [],
      note: ''
    });
  }

  /* =========================
     公開
     ========================= */
  return {
    CONST,
    scheduleText,
    tournaments,
    mapAreas
  };
})();
