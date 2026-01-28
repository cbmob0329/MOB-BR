// data.js
// 固定データ置き場（ここを触ればバランス調整できる）
// - チーム一覧（20/40に拡張しやすい）
// - 選手データ（仮：後で差し替えしやすい構造）
// - ポイント表
// - 確率テーブル（イベント/戦闘）
// - 定数（R数、試合数、上限制約など）

/* =========================
   定数（ゲーム全体）
========================= */
export const CONST = {
  TEAM_COUNT_LOCAL: 20,
  TEAM_COUNT_NATIONAL: 40,

  MATCHES_PER_TOURNAMENT: 5,
  ROUNDS_PER_MATCH: 6,

  AUTO_INTERVAL_MS: 3000,

  // 戦闘系（あなたの「上限」仕様に寄せた）
  MAX_HITRATE: 0.98,         // 命中率上限（例）
  MIN_HITRATE: 0.02,         // 命中率下限（例）
  MAX_CRIT: 0.40,            // クリ率上限（例）
  MAX_DMG_REDUCE: 0.70,      // ダメ軽減上限（例）
  MAX_DMG_BOOST: 1.00,       // ダメ増加上限（例：+100%）
};

/* =========================
   ポイント表（例：順位ポイント）
   ※本田さんの意図：ここを触れば調整できる
========================= */
export const POINTS = {
  // 20チーム順位ポイント（例。必要なら丸ごと差し替え）
  placement20: [
    25, 20, 18, 16, 14,
    12, 10,  9,  8,  7,
     6,  5,  4,  3,  2,
     1,  1,  1,  1,  1,
  ],

  // キルポイント（例）
  killPoint: 1,

  // “優勝回数”を同点処理で使う想定（表示はuiで）
};

/* =========================
   チーム定義
   - 20チーム（ローカル用）
   - 後で40に増やせるようID体系は一貫させる
========================= */
export const TEAM = {
  PLAYER_ID: 'T01',
  // ローカル20（仮名。後で自由に変更OK）
  list20: [
    { id: 'T01', name: 'PLAYER TEAM', isPlayer: true },
    { id: 'T02', name: 'TEAM A' },
    { id: 'T03', name: 'TEAM B' },
    { id: 'T04', name: 'TEAM C' },
    { id: 'T05', name: 'TEAM D' },
    { id: 'T06', name: 'TEAM E' },
    { id: 'T07', name: 'TEAM F' },
    { id: 'T08', name: 'TEAM G' },
    { id: 'T09', name: 'TEAM H' },
    { id: 'T10', name: 'TEAM I' },
    { id: 'T11', name: 'TEAM J' },
    { id: 'T12', name: 'TEAM K' },
    { id: 'T13', name: 'TEAM L' },
    { id: 'T14', name: 'TEAM M' },
    { id: 'T15', name: 'TEAM N' },
    { id: 'T16', name: 'TEAM O' },
    { id: 'T17', name: 'TEAM P' },
    { id: 'T18', name: 'TEAM Q' },
    { id: 'T19', name: 'TEAM R' },
    { id: 'T20', name: 'TEAM S' },
  ],

  // ナショナル40（デフォルト生成：20の続き + 仮名）
  // ※本名に差し替えやすいように配列を作っておく
  list40: null,
};

TEAM.list40 = (() => {
  const base = [...TEAM.list20];
  for (let i = 21; i <= 40; i++) {
    const id = `T${String(i).padStart(2, '0')}`;
    base.push({ id, name: `TEAM ${id}` });
  }
  return base;
})();

/* =========================
   選手データ（1チーム3人想定）
   仕様に合わせ、項目は後で増やせるようにしてある
========================= */
export const PLAYERS = {
  // 1人のベース能力（仮）
  defaultStats: {
    hp: 100,
    atk: 10,
    def: 5,
    spd: 10,       // 行動順/ターゲット優先などに使える
    aim: 0.55,     // 命中の基礎
    crit: 0.06,    // クリ率
  },

  // 1チーム3名のテンプレ（仮）
  // 実運用では teamId で引けるようにしてある
  byTeamId: null,
};

// 20チーム分を自動生成（後で自由に手で差し替えてOK）
PLAYERS.byTeamId = (() => {
  const out = {};
  for (const t of TEAM.list40) {
    const seed = parseInt(t.id.replace('T', ''), 10) || 1;

    // ちょい差（遊びの範囲で）
    const tweak = (n) => (Math.sin(seed * 997 + n * 37) + 1) / 2;

    const makeOne = (idx) => {
      const b = PLAYERS.defaultStats;
      const aim = clamp01(b.aim + (tweak(idx) - 0.5) * 0.12);
      const crit = clamp01(b.crit + (tweak(idx + 10) - 0.5) * 0.06);
      const atk = Math.round(b.atk + (tweak(idx + 20) - 0.5) * 6);
      const def = Math.round(b.def + (tweak(idx + 30) - 0.5) * 4);
      const spd = Math.round(b.spd + (tweak(idx + 40) - 0.5) * 6);

      return {
        id: `${t.id}_P${idx}`,
        name: `P${idx}`,
        role: idx === 1 ? 'FRONT' : (idx === 2 ? 'MID' : 'BACK'),
        stats: { hp: b.hp, atk, def, spd, aim, crit },
        ability: null,  // 後で実装（デモではnullでもOK）
        ult: null,      // 後で実装
      };
    };

    out[t.id] = [makeOne(1), makeOne(2), makeOne(3)];
  }
  return out;
})();

/* =========================
   イベント（R1〜R6）確率テーブル（仮）
   - sim.js側で「どのイベントが起きるか」をここ参照で抽選
   - テキストはui表示にも使える
========================= */
export const EVENTS = {
  // ラウンドごとに抽選の重み（weight）
  // ※本田さんの「ほぼ完成仕様」に合わせて後から差し替えできる箱
  byRound: {
    R1: [
      { key: 'DROP_OK',     label: '安定降下', weight: 40 },
      { key: 'DROP_BAD',    label: '降下ミス', weight: 12 },
      { key: 'EARLY_FIGHT', label: '初動ファイト', weight: 26 },
      { key: 'LOOT_BIG',    label: '大漁漁り', weight: 22 },
    ],
    R2: [
      { key: 'FIGHT',       label: '交戦', weight: 45 },
      { key: 'THIRD',       label: '漁夫', weight: 18 },
      { key: 'LOOT',        label: '漁り', weight: 22 },
      { key: 'ROTATE_BAD',  label: '移動事故', weight: 15 },
    ],
    R3: [
      { key: 'FIGHT',       label: '交戦', weight: 46 },
      { key: 'THIRD',       label: '漁夫', weight: 20 },
      { key: 'ULT',         label: '必殺技発動', weight: 14 },
      { key: 'POSITION',    label: '強ポジ確保', weight: 20 },
    ],
    R4: [
      { key: 'FIGHT',       label: '交戦', weight: 50 },
      { key: 'ULT',         label: '必殺技発動', weight: 18 },
      { key: 'CLUTCH',      label: 'クラッチ', weight: 16 },
      { key: 'MISTAKE',     label: '判断ミス', weight: 16 },
    ],
    R5: [
      { key: 'FIGHT',       label: '交戦', weight: 54 },
      { key: 'ULT',         label: '必殺技発動', weight: 22 },
      { key: 'PINCH',       label: 'ピンチ', weight: 24 },
    ],
    R6: [
      { key: 'FINAL',       label: '最終決戦', weight: 70 },
      { key: 'ULT',         label: '必殺技発動', weight: 30 },
    ],
  },

  // イベントの“演出テンプレ”（重要シーンモーダル等で使う）
  // simがsceneを作る時に参照できるようにしておく
  templates: {
    DROP_OK:     { title: '安定降下', desc: '全員が落ち着いて漁りに入った。' },
    DROP_BAD:    { title: '降下ミス', desc: '降下が乱れ、序盤から不利を背負う。' },
    EARLY_FIGHT: { title: '初動ファイト', desc: '降下直後に交戦が発生！' },
    LOOT_BIG:    { title: '大漁漁り', desc: '装備が整った。' },

    FIGHT:       { title: '交戦', desc: '接敵！撃ち合いが始まる。' },
    THIRD:       { title: '漁夫', desc: '第三勢力が襲いかかる！' },
    LOOT:        { title: '漁り', desc: 'リソースを確保して次に備える。' },
    ROTATE_BAD:  { title: '移動事故', desc: '移動中に挟まれた…！' },

    ULT:         { title: '必殺技', desc: 'ここで切る！大技が炸裂。' },
    POSITION:    { title: '強ポジ', desc: '有利ポジションを確保した。' },

    CLUTCH:      { title: 'クラッチ', desc: '不利をひっくり返した！' },
    MISTAKE:     { title: '判断ミス', desc: '判断が噛み合わず崩れる。' },

    PINCH:       { title: 'ピンチ', desc: '残りわずか…耐えろ！' },
    FINAL:       { title: '最終決戦', desc: '最後のリング。全てを賭ける。' },
  },
};

/* =========================
   同点処理の優先度（設定で変更可）
   ※具体ルールは sim.js 側で適用
========================= */
export const TIEBREAK = {
  // 例：総ポイント → 優勝回数 → 総キル → 直近順位 → 乱数
  order: ['totalPoints', 'wins', 'totalKills', 'bestPlacement', 'rng'],
};

/* =========================
   ユーティリティ
========================= */
export function clamp01(x) {
  if (x < 0) return 0;
  if (x > 1) return 1;
  return x;
}

export function getTeams(count = 20) {
  if (count === 40) return TEAM.list40;
  return TEAM.list20;
}

export function getTeamName(teamId) {
  const t = TEAM.list40.find(x => x.id === teamId);
  return t?.name ?? teamId;
}

export function isPlayerTeam(teamId) {
  return teamId === TEAM.PLAYER_ID;
}
