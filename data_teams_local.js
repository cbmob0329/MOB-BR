// data_teams_local.js
// ローカルチーム定義（CPUチーム確定.txt より）
// ここでは「ローカル：強豪/中堅/通常」だけを収録

export const LOCAL_TEAMS = [
  // --- ローカル：強豪チーム ---
  {
    id: "local_hammers",
    name: "ハンマーズ",
    category: "local",
    tier: "strong",
    powerPct: 79,
    style: "勢いのあるムーブ",
    members: ["キスケ", "ヅッチー", "ブラウン"],
    passive: {
      name: "勢い加速",
      description: "戦闘開始時、味方全員のAim+2",
      effects: [
        { trigger: "battle_start", type: "stat_add", target: "ally_all", stat: "aim", value: 2 },
      ],
    },
  },
  {
    id: "local_matsuyamers",
    name: "マツヤマーズ",
    category: "local",
    tier: "strong",
    powerPct: 78,
    style: "着実なムーブ",
    members: ["トニトニ", "ロジャー", "マルティン"],
    passive: {
      name: "着実進行",
      description: "毎ターン、味方全員のArmor+2（最大100）",
      effects: [
        { trigger: "turn_start", type: "stat_add", target: "ally_all", stat: "armor", value: 2, cap: 100 },
      ],
    },
  },
  {
    id: "local_galaxy",
    name: "ギャラクシー",
    category: "local",
    tier: "strong",
    powerPct: 73,
    style: "激しいムーブ",
    members: ["スターズ", "ロケッツ", "グルトン"],
    passive: {
      name: "銀河熱量",
      description: "戦闘中、味方全員のAgility+2",
      effects: [
        { trigger: "battle_active", type: "stat_add", target: "ally_all", stat: "agility", value: 2 },
      ],
    },
  },
  {
    id: "local_beadmans",
    name: "ビーダマンズ",
    category: "local",
    tier: "strong",
    powerPct: 72,
    style: "エイムに自信あり",
    members: ["フェニックス", "ワイバーン", "スフィンクス"],
    passive: {
      name: "照準安定",
      description: "味方全員の命中率+3%",
      effects: [
        { trigger: "battle_active", type: "rate_add", target: "ally_all", rate: "hit", valuePct: 3 },
      ],
    },
  },
  {
    id: "local_makaimura",
    name: "マカイムラ",
    category: "local",
    tier: "strong",
    powerPct: 71,
    style: "メンタル高め",
    members: ["クサチー", "メタッツ", "グレムリン"],
    passive: {
      name: "鋼メンタル",
      description: "戦闘中、味方全員のMental消費-10%",
      effects: [
        { trigger: "battle_active", type: "cost_mul", target: "ally_all", resource: "mental", multiplier: 0.9 },
      ],
    },
  },
  {
    id: "local_onsen_aikoukai",
    name: "温泉愛好会",
    category: "local",
    tier: "strong",
    powerPct: 69,
    style: "（記載なし）",
    members: ["どうごすけ", "たかのこぞー", "ひめひこっち"],
    passive: {
      name: "湯けむり回復",
      description: "戦闘開始時、味方全員HP+5",
      effects: [
        { trigger: "battle_start", type: "stat_add", target: "ally_all", stat: "hp", value: 5 },
      ],
    },
  },
  {
    id: "local_sanshoku_bocchanz",
    name: "三色坊ちゃんズ",
    category: "local",
    tier: "strong",
    powerPct: 68,
    style: "（記載なし）",
    members: ["もちもち", "あまあま", "まんぷく"],
    passive: {
      name: "三色バランス",
      description: "味方全員のAim+1＆Agility+1",
      effects: [
        { trigger: "battle_active", type: "stat_add", target: "ally_all", stat: "aim", value: 1 },
        { trigger: "battle_active", type: "stat_add", target: "ally_all", stat: "agility", value: 1 },
      ],
    },
  },

  // --- ローカル：中堅チーム ---
  {
    id: "local_firefighters",
    name: "ファイアファイターズ",
    category: "local",
    tier: "mid",
    powerPct: 68,
    style: "炎の如く攻撃",
    members: ["キャンプ", "マキっち", "トカゲイヌ"],
    passive: {
      name: "火力上等",
      description: "味方全員の攻撃ダメージ+5%",
      effects: [
        { trigger: "battle_active", type: "damage_mul", target: "ally_all", multiplier: 1.05 },
      ],
    },
  },
  {
    id: "local_ghost_rider",
    name: "ゴーストライダー",
    category: "local",
    tier: "mid",
    powerPct: 67,
    style: "お化け集団",
    members: ["ゴーストン", "ゴスクー", "おばけっち"],
    passive: {
      name: "ゴースト回避",
      description: "味方全員の被弾率-3%",
      effects: [
        { trigger: "battle_active", type: "rate_add", target: "ally_all", rate: "hitTaken", valuePct: -3 },
      ],
    },
  },
  {
    id: "local_hoihoihoim",
    name: "ホイホイホイム",
    category: "local",
    tier: "mid",
    powerPct: 66,
    style: "回復チーム",
    members: ["ホイスケ", "ホイミー", "ホームン"],
    passive: {
      name: "回復の輪",
      description: "戦闘中、味方全員の回復アイテム効果+10%",
      effects: [
        { trigger: "battle_active", type: "heal_item_mul", target: "ally_all", multiplier: 1.1 },
      ],
    },
  },
  {
    id: "local_turtle_punch",
    name: "タートルパンチ",
    category: "local",
    tier: "mid",
    powerPct: 66,
    style: "カメの如し",
    members: ["クリケット", "ジャックハンマー", "UFO"],
    passive: {
      name: "シェルガード",
      description: "味方全員のArmorダメージ-5%",
      effects: [
        { trigger: "battle_active", type: "armor_damage_mul", target: "ally_all", multiplier: 0.95 },
      ],
    },
  },
  {
    id: "local_koutetsu_butai",
    name: "鋼鉄部隊",
    category: "local",
    tier: "mid",
    powerPct: 63,
    style: "固い守り",
    members: ["タフネス", "スタミン", "タウリン"],
    passive: {
      name: "鉄壁構え",
      description: "戦闘開始時、味方全員Armor+10（最大100）",
      effects: [
        { trigger: "battle_start", type: "stat_add", target: "ally_all", stat: "armor", value: 10, cap: 100 },
      ],
    },
  },

  // --- ローカル：通常チーム ---
  {
    id: "local_yamiuchi",
    name: "ヤミウチ",
    category: "local",
    tier: "normal",
    powerPct: 66,
    style: "（記載なし）",
    members: ["ヤンク", "ウラウラ", "ヤミール"],
    passive: {
      name: "闇討ち",
      description: "戦闘1ターン目だけ味方全員のAim+4",
      effects: [
        { trigger: "turn_1_only", type: "stat_add", target: "ally_all", stat: "aim", value: 4 },
      ],
    },
  },
  {
    id: "local_donguri",
    name: "ドングリ隊",
    category: "local",
    tier: "normal",
    powerPct: 58,
    style: "（記載なし）",
    members: ["ドンドン", "グリグリ", "コロコロ"],
    passive: {
      name: "転がり連携",
      description: "味方全員のMove+1（戦闘中のみ）",
      effects: [
        { trigger: "battle_active", type: "stat_add", target: "ally_all", stat: "move", value: 1 },
      ],
    },
  },
  {
    id: "local_kaminadashi_monad",
    name: "カミナダシモナダ",
    category: "local",
    tier: "normal",
    powerPct: 58,
    style: "（記載なし）",
    members: ["うみち", "かぜち", "なみち"],
    passive: {
      name: "波風ムーブ",
      description: "戦闘中、味方全員のAgility+1＆被弾率-1%",
      effects: [
        { trigger: "battle_active", type: "stat_add", target: "ally_all", stat: "agility", value: 1 },
        { trigger: "battle_active", type: "rate_add", target: "ally_all", rate: "hitTaken", valuePct: -1 },
      ],
    },
  },
  {
    id: "local_ichiroku",
    name: "イチロク",
    category: "local",
    tier: "normal",
    powerPct: 58,
    style: "（記載なし）",
    members: ["タルト", "ミカタル", "まっちゃ"],
    passive: {
      name: "地味に強い",
      description: "HPが半分以下の時、味方全員のAim+2",
      effects: [
        { trigger: "hp_below_half", type: "stat_add", target: "ally_all", stat: "aim", value: 2 },
      ],
    },
  },
  {
    id: "local_yamanoko",
    name: "ヤマノコ",
    category: "local",
    tier: "normal",
    powerPct: 58,
    style: "（記載なし）",
    members: ["ハヤシ", "コヤ", "テンキ"],
    passive: {
      name: "山の勘",
      description: "戦闘開始時、敵の弱ってるキャラを狙う確率+10%",
      effects: [
        { trigger: "battle_start", type: "targeting_add", side: "enemy", key: "focus_weak", valuePct: 10 },
      ],
    },
  },
  {
    id: "local_kirinomori",
    name: "キリノモリ",
    category: "local",
    tier: "normal",
    powerPct: 57,
    style: "（記載なし）",
    members: ["だいふく", "まんじゅう", "こな"],
    passive: {
      name: "霧の迷彩",
      description: "味方全員の被弾率-2%",
      effects: [
        { trigger: "battle_active", type: "rate_add", target: "ally_all", rate: "hitTaken", valuePct: -2 },
      ],
    },
  },
  {
    id: "local_pokopokopen",
    name: "ポコポコペン",
    category: "local",
    tier: "normal",
    powerPct: 57,
    style: "（記載なし）",
    members: ["らむね", "さいだー", "コロッケ"],
    passive: {
      name: "ポコポコ調子",
      description: "戦闘中、味方全員のCrit率+1%",
      effects: [
        { trigger: "battle_active", type: "rate_add", target: "ally_all", rate: "crit", valuePct: 1 },
      ],
    },
  },
  {
    id: "local_potesara",
    name: "ポテサラ隊",
    category: "local",
    tier: "normal",
    powerPct: 57,
    style: "（記載なし）",
    members: ["ポテト", "ハム", "きゅうり"],
    passive: {
      name: "腹持ち",
      description: "戦闘開始時、味方全員HP+7",
      effects: [
        { trigger: "battle_start", type: "stat_add", target: "ally_all", stat: "hp", value: 7 },
      ],
    },
  },
];

export function getLocalTeamById(id) {
  return LOCAL_TEAMS.find((t) => t.id === id) || null;
}

export function listLocalTeamsSortedByPowerDesc() {
  return [...LOCAL_TEAMS].sort((a, b) => (b.powerPct - a.powerPct) || a.name.localeCompare(b.name, "ja"));
}
