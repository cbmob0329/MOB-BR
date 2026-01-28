// data.js (ES Modules)
// Demo: fixed data store (balance tuning here)

// ===== Version =====
export const DATA_VERSION = "demo-data-v1";

// ===== Constants =====
export const MAX_ARMOR = 100;

// 20 teams total (Local CPU set). Player team will be handled separately in your player/team file.
export const CPU_LOCAL_TEAMS = [
  // ---- Local: Strong ----
  {
    id: "local_hammers",
    tier: "local_strong",
    name: "ハンマーズ",
    powerPct: 79,
    style: "勢いのあるムーブ",
    members: ["キスケ", "ヅッチー", "ブラウン"],
    passive: {
      name: "勢い加速",
      raw: "戦闘開始時、味方全員のAim+2",
      tags: [{ type: "on_battle_start" }, { type: "aim_add", value: 2, target: "ally_all" }],
    },
  },
  {
    id: "local_matsuyamers",
    tier: "local_strong",
    name: "マツヤマーズ",
    powerPct: 78,
    style: "着実なムーブ",
    members: ["トニトニ", "ロジャー", "マルティン"],
    passive: {
      name: "着実進行",
      raw: "毎ターン、味方全員のArmor+2 ※最大100",
      tags: [{ type: "per_turn" }, { type: "armor_add", value: 2, target: "ally_all", cap: MAX_ARMOR }],
    },
  },
  {
    id: "local_galaxy",
    tier: "local_strong",
    name: "ギャラクシー",
    powerPct: 73,
    style: "激しいムーブ",
    members: ["スターズ", "ロケッツ", "グルトン"],
    passive: {
      name: "銀河熱量",
      raw: "戦闘中、味方全員のAgility+2",
      tags: [{ type: "during_battle" }, { type: "agility_add", value: 2, target: "ally_all" }],
    },
  },
  {
    id: "local_beadamans",
    tier: "local_strong",
    name: "ビーダマンズ",
    powerPct: 72,
    style: "エイムに自信あり",
    members: ["フェニックス", "ワイバーン", "スフィンクス"],
    passive: {
      name: "照準安定",
      raw: "味方全員の命中率+3%",
      tags: [{ type: "always" }, { type: "hit_rate_add", valuePct: 3, target: "ally_all" }],
    },
  },
  {
    id: "local_makaimura",
    tier: "local_strong",
    name: "マカイムラ",
    powerPct: 71,
    style: "メンタル高め",
    members: ["クサチー", "メタッツ", "グレムリン"],
    passive: {
      name: "鋼メンタル",
      raw: "戦闘中、味方全員のMental消費-10%",
      tags: [{ type: "during_battle" }, { type: "mental_cost_mul", valuePct: -10, target: "ally_all" }],
    },
  },
  {
    id: "local_onsen",
    tier: "local_strong",
    name: "温泉愛好会",
    powerPct: 69,
    style: "どうごすけ / たかのこぞー / ひめひこっち",
    members: ["どうごすけ", "たかのこぞー", "ひめひこっち"],
    passive: {
      name: "湯けむり回復",
      raw: "戦闘開始時、味方全員HP+5",
      tags: [{ type: "on_battle_start" }, { type: "hp_add", value: 5, target: "ally_all" }],
    },
  },
  {
    id: "local_sanshoku",
    tier: "local_strong",
    name: "三色坊ちゃんズ",
    powerPct: 68,
    style: "もちもち / あまあま / まんぷく",
    members: ["もちもち", "あまあま", "まんぷく"],
    passive: {
      name: "三色バランス",
      raw: "味方全員のAim+1＆Agility+1",
      tags: [
        { type: "always" },
        { type: "aim_add", value: 1, target: "ally_all" },
        { type: "agility_add", value: 1, target: "ally_all" },
      ],
    },
  },

  // ---- Local: Mid ----
  {
    id: "local_firefighters",
    tier: "local_mid",
    name: "ファイアファイターズ",
    powerPct: 68,
    style: "炎の如く攻撃",
    members: ["キャンプ", "マキっち", "トカゲイヌ"],
    passive: {
      name: "火力上等",
      raw: "味方全員の攻撃ダメージ+5%",
      tags: [{ type: "always" }, { type: "damage_mul", valuePct: 5, target: "ally_all" }],
    },
  },
  {
    id: "local_ghostrider",
    tier: "local_mid",
    name: "ゴーストライダー",
    powerPct: 67,
    style: "お化け集団",
    members: ["ゴーストン", "ゴスクー", "おばけっち"],
    passive: {
      name: "ゴースト回避",
      raw: "味方全員の被弾率-3%",
      tags: [{ type: "always" }, { type: "hit_taken_rate_add", valuePct: -3, target: "ally_all" }],
    },
  },
  {
    id: "local_hoihoihoim",
    tier: "local_mid",
    name: "ホイホイホイム",
    powerPct: 66,
    style: "回復チーム",
    members: ["ホイスケ", "ホイミー", "ホームン"],
    passive: {
      name: "回復の輪",
      raw: "戦闘中、味方全員の回復アイテム効果+10%",
      tags: [{ type: "during_battle" }, { type: "heal_item_mul", valuePct: 10, target: "ally_all" }],
    },
  },
  {
    id: "local_turtlepunch",
    tier: "local_mid",
    name: "タートルパンチ",
    powerPct: 66,
    style: "カメの如し",
    members: ["クリケット", "ジャックハンマー", "UFO"],
    passive: {
      name: "シェルガード",
      raw: "味方全員のArmorダメージ-5%",
      tags: [{ type: "always" }, { type: "armor_damage_mul", valuePct: -5, target: "ally_all" }],
    },
  },
  {
    id: "local_koutetsu",
    tier: "local_mid",
    name: "鋼鉄部隊",
    powerPct: 63,
    style: "固い守り",
    members: ["タフネス", "スタミン", "タウリン"],
    passive: {
      name: "鉄壁構え",
      raw: "戦闘開始時、味方全員Armor+10 ※最大100",
      tags: [{ type: "on_battle_start" }, { type: "armor_add", value: 10, target: "ally_all", cap: MAX_ARMOR }],
    },
  },

  // ---- Local: Normal ----
  {
    id: "local_yamiuchi",
    tier: "local_normal",
    name: "ヤミウチ",
    powerPct: 66,
    style: "ヤンク / ウラウラ / ヤミール",
    members: ["ヤンク", "ウラウラ", "ヤミール"],
    passive: {
      name: "闇討ち",
      raw: "戦闘1ターン目だけ味方全員のAim+4",
      tags: [{ type: "turn_1_only" }, { type: "aim_add", value: 4, target: "ally_all" }],
    },
  },
  {
    id: "local_donguritai",
    tier: "local_normal",
    name: "ドングリ隊",
    powerPct: 58,
    style: "ドンドン / グリグリ / コロコロ",
    members: ["ドンドン", "グリグリ", "コロコロ"],
    passive: {
      name: "転がり連携",
      raw: "味方全員のMove+1 ※戦闘中のみ",
      tags: [{ type: "during_battle" }, { type: "move_add", value: 1, target: "ally_all" }],
    },
  },
  {
    id: "local_kaminadashi",
    tier: "local_normal",
    name: "カミナダシモナダ",
    powerPct: 58,
    style: "うみち / かぜち / なみち",
    members: ["うみち", "かぜち", "なみち"],
    passive: {
      name: "波風ムーブ",
      raw: "戦闘中、味方全員のAgility+1＆被弾率-1%",
      tags: [
        { type: "during_battle" },
        { type: "agility_add", value: 1, target: "ally_all" },
        { type: "hit_taken_rate_add", valuePct: -1, target: "ally_all" },
      ],
    },
  },
  {
    id: "local_ichiroku",
    tier: "local_normal",
    name: "イチロク",
    powerPct: 58,
    style: "タルト / ミカタル / まっちゃ",
    members: ["タルト", "ミカタル", "まっちゃ"],
    passive: {
      name: "地味に強い",
      raw: "HPが半分以下の時、味方全員のAim+2",
      tags: [{ type: "hp_half_or_less" }, { type: "aim_add", value: 2, target: "ally_all" }],
    },
  },
  {
    id: "local_yamanoko",
    tier: "local_normal",
    name: "ヤマノコ",
    powerPct: 58,
    style: "ハヤシ / コヤ / テンキ",
    members: ["ハヤシ", "コヤ", "テンキ"],
    passive: {
      name: "山の勘",
      raw: "戦闘開始時、敵の弱ってるキャラを狙う確率+10%",
      tags: [{ type: "on_battle_start" }, { type: "target_weak_bonus_pct", valuePct: 10 }],
    },
  },
  {
    id: "local_kirinomori",
    tier: "local_normal",
    name: "キリノモリ",
    powerPct: 57,
    style: "だいふく / まんじゅう / こな",
    members: ["だいふく", "まんじゅう", "こな"],
    passive: {
      name: "霧の迷彩",
      raw: "味方全員の被弾率-2%",
      tags: [{ type: "always" }, { type: "hit_taken_rate_add", valuePct: -2, target: "ally_all" }],
    },
  },
  {
    id: "local_pokopokopen",
    tier: "local_normal",
    name: "ポコポコペン",
    powerPct: 57,
    style: "らむね / さいだー / コロッケ",
    members: ["らむね", "さいだー", "コロッケ"],
    passive: {
      name: "ポコポコ調子",
      raw: "戦闘中、味方全員のCrit率+1%",
      tags: [{ type: "during_battle" }, { type: "crit_rate_add", valuePct: 1, target: "ally_all" }],
    },
  },
  {
    id: "local_potesara",
    tier: "local_normal",
    name: "ポテサラ隊",
    powerPct: 57,
    style: "ポテト / ハム / きゅうり",
    members: ["ポテト", "ハム", "きゅうり"],
    passive: {
      name: "腹持ち",
      raw: "戦闘開始時、味方全員HP+7",
      tags: [{ type: "on_battle_start" }, { type: "hp_add", value: 7, target: "ally_all" }],
    },
  },
];

// ===== Convenience =====
export const CPU_LOCAL_TEAM_BY_ID = Object.fromEntries(CPU_LOCAL_TEAMS.map(t => [t.id, t]));
export const CPU_LOCAL_TEAM_NAMES = CPU_LOCAL_TEAMS.map(t => t.name);

/**
 * Utility: sort teams by power% desc (useful for debug / display)
 */
export function sortTeamsByPowerDesc(teams) {
  return [...teams].sort((a, b) => (b.powerPct ?? 0) - (a.powerPct ?? 0));
}
