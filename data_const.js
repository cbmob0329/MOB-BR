// data_const.js
// Central constants / small helpers (ES Modules)

/**
 * Core concept:
 * - 3人1パーティー / 20チーム / バトロワ大会シミュレーション  [oai_citation:0‡コンセプト.txt](sediment://file_00000000d3787208b417f5c635edd21b)
 * - 順位ポイントや各ポイントの固定値  [oai_citation:1‡試合の流れ.txt](sediment://file_00000000bdc47208a1e893508028aa29)
 * - 戦闘の上限制御（バフ/デバフ/無効化）  [oai_citation:2‡戦闘についてのまとめ.txt](sediment://file_00000000232c720882d68e5f8e1908d7)
 */

export const GAME_TITLE = 'MOB APEX SIM (Prototype)';
export const SAVE_KEY = 'mob_apex_sim_save_v1';

export const PARTY_SIZE = 3;       // 3人1パーティー  [oai_citation:3‡コンセプト.txt](sediment://file_00000000d3787208b417f5c635edd21b)
export const TEAM_COUNT = 20;      // 20チーム  [oai_citation:4‡コンセプト.txt](sediment://file_00000000d3787208b417f5c635edd21b)
export const MATCH_COUNT_DEFAULT = 5; // 1大会=基本5試合（result/総合処理）  [oai_citation:5‡試合の流れ.txt](sediment://file_00000000bdc47208a1e893508028aa29)

/** Status baseline */
export const ARMOR_BASE = 100;     // Armorは基本100固定  [oai_citation:6‡ステータスと育成機能について.txt](sediment://file_000000000a8c7208adbecbc084a7f937)
export const HP_BASE = 100;        // 表示・計算用の仮基準（個別値は data_players 側で上書き可）
export const SYNERGY_BASE = 20;    // 連携 初期=20  [oai_citation:7‡ステータスと育成機能について.txt](sediment://file_000000000a8c7208adbecbc084a7f937)
export const SYNERGY_MAX_HINT = 200; // 最大200くらい想定  [oai_citation:8‡ステータスと育成機能について.txt](sediment://file_000000000a8c7208adbecbc084a7f937)

/** Technique requirement penalty */
export const TECH_REQ_HITCHANCE_PENALTY = -0.08; // Technique < Req のとき命中率 -8%  [oai_citation:9‡戦闘についてのまとめ.txt](sediment://file_00000000232c720882d68e5f8e1908d7)

/** Battle caps (anti-overpower) */
export const CAP_AIM_BUFF = 15;      // Aimバフ上限 +15  [oai_citation:10‡戦闘についてのまとめ.txt](sediment://file_00000000232c720882d68e5f8e1908d7)
export const CAP_AGILITY_BUFF = 10;  // Agilityバフ上限 +10  [oai_citation:11‡戦闘についてのまとめ.txt](sediment://file_00000000232c720882d68e5f8e1908d7)
export const CAP_ENEMY_AIM_DOWN = -12; // 敵Aimダウン上限 -12  [oai_citation:12‡戦闘についてのまとめ.txt](sediment://file_00000000232c720882d68e5f8e1908d7)

export const CAP_NULLIFY_PER_ACTOR_PER_FIGHT = 1; // 同キャラ：戦闘内で無効化最大1回  [oai_citation:13‡戦闘についてのまとめ.txt](sediment://file_00000000232c720882d68e5f8e1908d7)
export const CAP_NULLIFY_PER_TEAM_PER_FIGHT = 2;  // チーム全体：無効化最大2回  [oai_citation:14‡戦闘についてのまとめ.txt](sediment://file_00000000232c720882d68e5f8e1908d7)

/** Scoring */
export const PLACEMENT_POINTS = (() => {
  // index = place (1..20)
  // 1位12 / 2位8 / 3位5 / 4位3 / 5位2 / 6〜10位1 / 11〜20位0  [oai_citation:15‡試合の流れ.txt](sediment://file_00000000bdc47208a1e893508028aa29)
  const arr = new Array(TEAM_COUNT + 1).fill(0);
  arr[1] = 12;
  arr[2] = 8;
  arr[3] = 5;
  arr[4] = 3;
  arr[5] = 2;
  for (let p = 6; p <= 10; p++) arr[p] = 1;
  for (let p = 11; p <= TEAM_COUNT; p++) arr[p] = 0;
  return arr;
})();

export const POINT_KILL = 2;     // キルポイント 2  [oai_citation:16‡試合の流れ.txt](sediment://file_00000000bdc47208a1e893508028aa29)
export const POINT_ASSIST = 1;   // アシストポイント 1  [oai_citation:17‡試合の流れ.txt](sediment://file_00000000bdc47208a1e893508028aa29)
export const POINT_TREASURE = 1; // お宝ゲット 1  [oai_citation:18‡試合の流れ.txt](sediment://file_00000000bdc47208a1e893508028aa29)
export const POINT_FLAG = 2;     // フラッグ 2  [oai_citation:19‡試合の流れ.txt](sediment://file_00000000bdc47208a1e893508028aa29)

/** Championship (match point) */
export const CHAMP_MATCHPOINT = 50; // 50ポイントで点灯 / 50以上でチャンピオン獲得で優勝  [oai_citation:20‡大会について.txt](sediment://file_00000000c42c7208bab2805623c5db7c)

/** Result / flow timings (UI側で参照) */
export const RESULT_SHOW_MS = 3000; // result画面 3秒  [oai_citation:21‡試合の流れ.txt](sediment://file_00000000bdc47208a1e893508028aa29)

/** Tie-break priority (final standings) */
export const TIEBREAK_PRIORITY = [
  'championCount',   // チャンピオン獲得数  [oai_citation:22‡試合の流れ.txt](sediment://file_00000000bdc47208a1e893508028aa29)
  'killPts',         // 合計キルポイント  [oai_citation:23‡試合の流れ.txt](sediment://file_00000000bdc47208a1e893508028aa29)
  'flagPts',         // フラッグポイント  [oai_citation:24‡試合の流れ.txt](sediment://file_00000000bdc47208a1e893508028aa29)
  'treasurePts',     // お宝ゲットポイント  [oai_citation:25‡試合の流れ.txt](sediment://file_00000000bdc47208a1e893508028aa29)
  'companyRank',     // 企業ランク  [oai_citation:26‡試合の流れ.txt](sediment://file_00000000bdc47208a1e893508028aa29)
  'playerWinsIfFullTie', // 全同点ならプレイヤーチーム優勝  [oai_citation:27‡試合の流れ.txt](sediment://file_00000000bdc47208a1e893508028aa29)
];

/** Utility helpers (no new files allowed) */
export const clamp = (v, min, max) => Math.max(min, Math.min(max, v));

export const lerp = (a, b, t) => a + (b - a) * t;

export const randInt = (min, max, rng = Math.random) => {
  // inclusive min..max
  const r = rng();
  return Math.floor(r * (max - min + 1)) + min;
};

export const pick = (arr, rng = Math.random) => {
  if (!arr || arr.length === 0) return null;
  return arr[Math.floor(rng() * arr.length)];
};

/**
 * Simple deterministic RNG (mulberry32)
 * - state側で seed を持って使う想定
 */
export function makeRng(seedUint32) {
  let t = (seedUint32 >>> 0) || 0x12345678;
  return function rng() {
    t += 0x6D2B79F5;
    let x = Math.imul(t ^ (t >>> 15), 1 | t);
    x ^= x + Math.imul(x ^ (x >>> 7), 61 | x);
    return ((x ^ (x >>> 14)) >>> 0) / 4294967296;
  };
}

/**
 * Points calculator (single match row)
 * place: 1..20
 */
export function calcMatchPoints({ place, kills = 0, assists = 0, treasures = 0, flags = 0 }) {
  const placement = PLACEMENT_POINTS[clamp(place | 0, 1, TEAM_COUNT)] || 0;
  const killPts = (kills | 0) * POINT_KILL;
  const assistPts = (assists | 0) * POINT_ASSIST;
  const treasurePts = (treasures | 0) * POINT_TREASURE;
  const flagPts = (flags | 0) * POINT_FLAG;
  const total = placement + killPts + assistPts + treasurePts + flagPts;
  return { placement, killPts, assistPts, treasurePts, flagPts, total };
}
