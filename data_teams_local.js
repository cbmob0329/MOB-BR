/* =========================================================
   data_teams_local.js (FULL)
   - ローカル大会に登場するCPUチーム定義
   - プレイヤーチームは data_players.js 側で管理
   - ここでは「ローカルチームの固定メンバー＆パッシブ」を定義する
   ========================================================= */

(() => {
  'use strict';

  const CONST = window.DATA_CONST;
  if (!CONST) throw new Error('DATA_CONST not found. Load data_const.js before data_teams_local.js');

  // ---------------------------------------------------------
  // ローカルチーム一覧（ユーザー指定の完成版をそのまま反映）
  // 形式：
  // {
  //   id, name, tier, powerPct,
  //   styleText,
  //   members: [{ name },{ name },{ name }],
  //   passive: { name, desc, applyTiming, effect }
  // }
  // ---------------------------------------------------------

  const TEAMS_LOCAL = [
    // =========================
    // 強豪チーム
    // =========================
    {
      id: 'L_HAMMERS',
      group: 'LOCAL_STRONG',
      name: 'ハンマーズ',
      powerPct: 79,
      styleText: '勢いのあるムーブ',
      members: [
        { name: 'キスケ' },
        { name: 'ヅッチー' },
        { name: 'ブラウン' },
      ],
      passive: {
        name: '勢い加速',
        desc: '戦闘開始時、味方全員のAim+2',
        applyTiming: 'BATTLE_START',
        effect: { statsAddTeam: { Aim: 2 } },
      },
    },
    {
      id: 'L_MATSUYAMERS',
      group: 'LOCAL_STRONG',
      name: 'マツヤマーズ',
      powerPct: 78,
      styleText: '着実なムーブ',
      members: [
        { name: 'トニトニ' },
        { name: 'ロジャー' },
        { name: 'マルティン' },
      ],
      passive: {
        name: '着実進行',
        desc: '毎ターン、味方全員のArmor+2（最大100）',
        applyTiming: 'TURN_START',
        effect: { armorRegenTeam: 2, armorMax: 100 },
      },
    },
    {
      id: 'L_GALAXY',
      group: 'LOCAL_STRONG',
      name: 'ギャラクシー',
      powerPct: 73,
      styleText: '激しいムーブ',
      members: [
        { name: 'スターズ' },
        { name: 'ロケッツ' },
        { name: 'グルトン' },
      ],
      passive: {
        name: '銀河熱量',
        desc: '戦闘中、味方全員のAgility+2',
        applyTiming: 'BATTLE_START',
        effect: { statsAddTeam: { Agility: 2 } },
      },
    },
    {
      id: 'L_BEADAMANS',
      group: 'LOCAL_STRONG',
      name: 'ビーダマンズ',
      powerPct: 72,
      styleText: 'エイムに自信あり',
      members: [
        { name: 'フェニックス' },
        { name: 'ワイバーン' },
        { name: 'スフィンクス' },
      ],
      passive: {
        name: '照準安定',
        desc: '味方全員の命中率+3%',
        applyTiming: 'BATTLE_START',
        effect: { pctAddTeam: { hitChance: +3 } },
      },
    },
    {
      id: 'L_MAKAIMURA',
      group: 'LOCAL_STRONG',
      name: 'マカイムラ',
      powerPct: 71,
      styleText: 'メンタル高め',
      members: [
        { name: 'クサチー' },
        { name: 'メタッツ' },
        { name: 'グレムリン' },
      ],
      passive: {
        name: '鋼メンタル',
        desc: '戦闘中、味方全員のMental消費-10%',
        applyTiming: 'BATTLE_START',
        effect: { pctAddTeam: { mentalCost: -10 } },
      },
    },
    {
      id: 'L_ONSEN_LOVERS',
      group: 'LOCAL_STRONG',
      name: '温泉愛好会',
      powerPct: 69,
      styleText: '',
      members: [
        { name: 'どうごすけ' },
        { name: 'たかのこぞー' },
        { name: 'ひめひこっち' },
      ],
      passive: {
        name: '湯けむり回復',
        desc: '戦闘開始時、味方全員HP+5',
        applyTiming: 'BATTLE_START',
        effect: { hpHealTeam: 5 },
      },
    },
    {
      id: 'L_SANSHOKU',
      group: 'LOCAL_STRONG',
      name: '三色坊ちゃんズ',
      powerPct: 68,
      styleText: '',
      members: [
        { name: 'もちもち' },
        { name: 'あまあま' },
        { name: 'まんぷく' },
      ],
      passive: {
        name: '三色バランス',
        desc: '味方全員のAim+1＆Agility+1',
        applyTiming: 'BATTLE_START',
        effect: { statsAddTeam: { Aim: 1, Agility: 1 } },
      },
    },

    // =========================
    // 中堅チーム
    // =========================
    {
      id: 'L_FIREFIGHTERS',
      group: 'LOCAL_MIDDLE',
      name: 'ファイアファイターズ',
      powerPct: 68,
      styleText: '炎の如く攻撃',
      members: [
        { name: 'キャンプ' },
        { name: 'マキっち' },
        { name: 'トカゲイヌ' },
      ],
      passive: {
        name: '火力上等',
        desc: '味方全員の攻撃ダメージ+5%',
        applyTiming: 'BATTLE_START',
        effect: { pctAddTeam: { damage: +5 } },
      },
    },
    {
      id: 'L_GHOSTRIDER',
      group: 'LOCAL_MIDDLE',
      name: 'ゴーストライダー',
      powerPct: 67,
      styleText: 'お化け集団',
      members: [
        { name: 'ゴーストン' },
        { name: 'ゴスクー' },
        { name: 'おばけっち' },
      ],
      passive: {
        name: 'ゴースト回避',
        desc: '味方全員の被弾率-3%',
        applyTiming: 'BATTLE_START',
        effect: { pctAddTeam: { hitTaken: -3 } },
      },
    },
    {
      id: 'L_HOIHoi',
      group: 'LOCAL_MIDDLE',
      name: 'ホイホイホイム',
      powerPct: 66,
      styleText: '回復チーム',
      members: [
        { name: 'ホイスケ' },
        { name: 'ホイミー' },
        { name: 'ホームン' },
      ],
      passive: {
        name: '回復の輪',
        desc: '戦闘中、味方全員の回復アイテム効果+10%',
        applyTiming: 'BATTLE_START',
        effect: { pctAddTeam: { healItem: +10 } },
      },
    },
    {
      id: 'L_TURTLEPUNCH',
      group: 'LOCAL_MIDDLE',
      name: 'タートルパンチ',
      powerPct: 66,
      styleText: 'カメの如し',
      members: [
        { name: 'クリケット' },
        { name: 'ジャックハンマー' },
        { name: 'UFO' },
      ],
      passive: {
        name: 'シェルガード',
        desc: '味方全員のArmorダメージ-5%',
        applyTiming: 'BATTLE_START',
        effect: { pctAddTeam: { armorDamageTaken: -5 } },
      },
    },
    {
      id: 'L_STEELFORCE',
      group: 'LOCAL_MIDDLE',
      name: '鋼鉄部隊',
      powerPct: 63,
      styleText: '固い守り',
      members: [
        { name: 'タフネス' },
        { name: 'スタミン' },
        { name: 'タウリン' },
      ],
      passive: {
        name: '鉄壁構え',
        desc: '戦闘開始時、味方全員Armor+10（最大100）',
        applyTiming: 'BATTLE_START',
        effect: { armorHealTeam: 10, armorMax: 100 },
      },
    },

    // =========================
    // 通常チーム
    // =========================
    {
      id: 'L_YAMIUCHI',
      group: 'LOCAL_NORMAL',
      name: 'ヤミウチ',
      powerPct: 66,
      styleText: '',
      members: [
        { name: 'ヤンク' },
        { name: 'ウラウラ' },
        { name: 'ヤミール' },
      ],
      passive: {
        name: '闇討ち',
        desc: '戦闘1ターン目だけ味方全員のAim+4',
        applyTiming: 'TURN1_ONLY',
        effect: { statsAddTeam: { Aim: 4 } },
      },
    },
    {
      id: 'L_DONGURI',
      group: 'LOCAL_NORMAL',
      name: 'ドングリ隊',
      powerPct: 58,
      styleText: '',
      members: [
        { name: 'ドンドン' },
        { name: 'グリグリ' },
        { name: 'コロコロ' },
      ],
      passive: {
        name: '転がり連携',
        desc: '味方全員のMove+1（戦闘中のみ）',
        applyTiming: 'BATTLE_START',
        // Move補正は禁止ルールのため、ここは実装上「Move」には触れない。
        // 代替として「行動順乱数+1相当」なども勝手に入れない（相談必須）。
        // ここでは "noteOnly" として保持し、効果は適用しない。
        effect: { noteOnly: 'FORBID_MOVE_MOD' },
      },
      forbidden: { reason: 'Move補正は禁止ルールのため効果適用しない（設計上は保持のみ）' },
    },
    {
      id: 'L_KAMINADASHI',
      group: 'LOCAL_NORMAL',
      name: 'カミナダシモナダ',
      powerPct: 58,
      styleText: '',
      members: [
        { name: 'うみち' },
        { name: 'かぜち' },
        { name: 'なみち' },
      ],
      passive: {
        name: '波風ムーブ',
        desc: '戦闘中、味方全員のAgility+1＆被弾率-1%',
        applyTiming: 'BATTLE_START',
        effect: { statsAddTeam: { Agility: 1 }, pctAddTeam: { hitTaken: -1 } },
      },
    },
    {
      id: 'L_ICHIROKU',
      group: 'LOCAL_NORMAL',
      name: 'イチロク',
      powerPct: 58,
      styleText: '',
      members: [
        { name: 'タルト' },
        { name: 'ミカタル' },
        { name: 'まっちゃ' },
      ],
      passive: {
        name: '地味に強い',
        desc: 'HPが半分以下の時、味方全員のAim+2',
        applyTiming: 'HP_BELOW_HALF',
        effect: { statsAddTeam: { Aim: 2 } },
      },
    },
    {
      id: 'L_YAMANOKO',
      group: 'LOCAL_NORMAL',
      name: 'ヤマノコ',
      powerPct: 58,
      styleText: '',
      members: [
        { name: 'ハヤシ' },
        { name: 'コヤ' },
        { name: 'テンキ' },
      ],
      passive: {
        name: '山の勘',
        desc: '戦闘開始時、敵の弱ってるキャラを狙う確率+10%',
        applyTiming: 'BATTLE_START',
        effect: { pctAddTeam: { finishFocus: +10 } },
      },
    },
    {
      id: 'L_KIRINOMORI',
      group: 'LOCAL_NORMAL',
      name: 'キリノモリ',
      powerPct: 57,
      styleText: '',
      members: [
        { name: 'だいふく' },
        { name: 'まんじゅう' },
        { name: 'こな' },
      ],
      passive: {
        name: '霧の迷彩',
        desc: '味方全員の被弾率-2%',
        applyTiming: 'BATTLE_START',
        effect: { pctAddTeam: { hitTaken: -2 } },
      },
    },
    {
      id: 'L_POKOPOKOPEN',
      group: 'LOCAL_NORMAL',
      name: 'ポコポコペン',
      powerPct: 57,
      styleText: '',
      members: [
        { name: 'らむね' },
        { name: 'さいだー' },
        { name: 'コロッケ' },
      ],
      passive: {
        name: 'ポコポコ調子',
        desc: '戦闘中、味方全員のCrit率+1%',
        applyTiming: 'BATTLE_START',
        effect: { pctAddTeam: { critChance: +1 } },
      },
    },
    {
      id: 'L_POTESARA',
      group: 'LOCAL_NORMAL',
      name: 'ポテサラ隊',
      powerPct: 57,
      styleText: '',
      members: [
        { name: 'ポテト' },
        { name: 'ハム' },
        { name: 'きゅうり' },
      ],
      passive: {
        name: '腹持ち',
        desc: '戦闘開始時、味方全員HP+7',
        applyTiming: 'BATTLE_START',
        effect: { hpHealTeam: 7 },
      },
    },
  ];

  // ---------------------------------------------------------
  // 公開
  // ---------------------------------------------------------
  window.DATA_TEAMS_LOCAL = Object.freeze({
    list: Object.freeze(TEAMS_LOCAL.slice()),
    byId: Object.freeze(
      TEAMS_LOCAL.reduce((acc, t) => {
        acc[t.id] = t;
        return acc;
      }, Object.create(null))
    ),
  });
})();
