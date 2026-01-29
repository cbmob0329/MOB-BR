/* =========================================================
   sim_battle.js (FULL)
   - 戦闘シミュレーション（2チーム / 最大3チーム乱戦）
   - 依存：
     data_const.js        -> window.DATA_CONST
     data_items.js        -> window.DATA_ITEMS
     data_players.js      -> window.DATA_PLAYERS（キャラ定義。未実装でも動くよう保険あり）
   - 仕様（ユーザー確定ルール反映）：
     ・撤退なし／完全決着
     ・乱戦は最大3チーム
     ・Armorは基本100固定（戦闘中回復は可。最大100）
     ・行動順：Agility + Move*2 + rand(0..10) の降順
     ・ターゲット：基本ランダム／Techniqueで弱狙い
     ・命中：clamp( 50 + (Aim - Agility)*0.7, 15, 85 ) → 最終キャップ10..90
     ・ダメージ：BaseDamage * (0.85 + Aim/200 + Technique/250) * rand(0.9..1.1)
       1発最大ダメージ：45（クリ込みでも超えない）
     ・クリ：clamp(2 + Technique*0.6, 2, 8)% 、倍率×1.4
     ・TechniqueReq不足：HitChance -8%（固定）
     ・アイテム：戦闘中使用OK（自動／各キャラの行動開始時に1回だけ）
       優先：HP瀕死→HP回復、Armor削れ→Armor回復、何も無→攻撃/妨害
       1行動で1個まで（暴発しない）
     ・無効化（強すぎ防止）：同キャラ同戦闘で最大1回、チーム全体でも最大2回
     ・キル：HP0にした人(2pt)／アシスト：同ターンに削った別キャラ(1pt)
   ========================================================= */

(() => {
  'use strict';

  const CONST = window.DATA_CONST;
  const ITEMS = window.DATA_ITEMS;
  const PLAYERS = window.DATA_PLAYERS; // なくても動く（placeholder）

  if (!CONST) throw new Error('DATA_CONST not found. Load data_const.js before sim_battle.js');
  if (!ITEMS) throw new Error('DATA_ITEMS not found. Load data_items.js before sim_battle.js');

  // --------------------------
  // Utils
  // --------------------------
  const clamp = (v, a, b) => Math.max(a, Math.min(b, v));
  const rInt = (a, b) => (a + Math.floor(Math.random() * (b - a + 1)));
  const rFloat = (a, b) => (a + Math.random() * (b - a));
  const pick = (arr) => arr[Math.floor(Math.random() * arr.length)];

  const safeNum = (v, fallback = 0) => (Number.isFinite(Number(v)) ? Number(v) : fallback);

  // --------------------------
  // Battle context + fighters
  // --------------------------
  function makeFighter(charDef, team) {
    // charDef は data_players.js 由来を想定。ただし未定義でも動くようにフォールバック。
    const base = (charDef && charDef.stats) ? charDef.stats : (charDef || {});
    const name = (charDef && charDef.name) ? charDef.name : (base.name || 'Unknown');

    const maxHP = safeNum(base.HP, 100);
    const maxArmor = 100; // 固定前提（ただし戦闘中回復は最大100）

    return {
      // identity
      id: (charDef && charDef.id) ? charDef.id : `${team.id}_${name}_${rInt(1000, 9999)}`,
      name,
      teamId: team.id,
      teamName: team.name,

      // base stats
      base: {
        HP: maxHP,
        Armor: maxArmor,
        Mental: safeNum(base.Mental, 50),
        Move: safeNum(base.Move, 2),
        Aim: safeNum(base.Aim, 70),
        Agility: safeNum(base.Agility, 30),
        Technique: safeNum(base.Technique, 10),
        Support: safeNum(base.Support, 1),
        Hunt: safeNum(base.Hunt, 1),
      },

      // current
      cur: {
        hp: maxHP,
        armor: maxArmor,
        mental: safeNum(base.Mental, 50),
      },

      // buffs/debuffs (battle temporary)
      tmp: {
        aimBuff: 0,
        agiBuff: 0,
        techBuff: 0,
        dmgMul: 1,
        hitMul: 1, // percent multiplier (e.g. 0.98)
        critBonusPct: 0,
        // next attack mods / flags
        skipNextAction: false,
        // for "weak" definition
        tookHpDamage: false,
      },

      // ability/ult usage counters (per match)
      usage: {
        abilityUsed: 0,
        ultUsed: 0,
      },

      // per-battle limitations
      limits: {
        negatedOnceThisBattle: false,
      },

      // equipment/weapon (placeholder: will be set by sim / state)
      weapon: null, // { name, baseDamage, aimBonus, techReq, special? }

      // inventory (itemId -> count)
      inv: {},

      // skill definitions (optional)
      passive: charDef ? (charDef.passive || null) : null,
      ability: charDef ? (charDef.ability || null) : null,
      ult: charDef ? (charDef.ult || null) : null,
    };
  }

  function isAlive(f) {
    return f.cur.hp > 0;
  }

  function teamAliveCount(teamObj, fighters) {
    let n = 0;
    for (const f of fighters) if (f.teamId === teamObj.id && isAlive(f)) n++;
    return n;
  }

  function getTeamFighters(teamId, fighters) {
    return fighters.filter(f => f.teamId === teamId);
  }

  // --------------------------
  // Weapon helpers (spec準拠)
  // --------------------------
  function getWeaponBaseDamage(f) {
    const w = f.weapon;
    if (!w) return 20; // placeholder
    return safeNum(w.baseDamage, 20);
  }

  function getWeaponAimBonus(f) {
    const w = f.weapon;
    if (!w) return 0;
    return safeNum(w.aimBonus, 0);
  }

  function getWeaponTechReq(f) {
    const w = f.weapon;
    if (!w) return 0;
    return safeNum(w.techReq, 0);
  }

  // --------------------------
  // Core battle rules
  // --------------------------
  function computeSpeed(f) {
    return f.base.Agility + f.tmp.agiBuff + (f.base.Move * 2) + rInt(0, 10);
  }

  function computeEffectiveAim(f) {
    // バフ上限（Aimバフ最大+15：武器/アビ/ウルト/他合計）
    const aimBuffCapped = clamp(f.tmp.aimBuff + getWeaponAimBonus(f), -999, 15);
    return f.base.Aim + aimBuffCapped;
  }

  function computeEffectiveAgi(f) {
    // Agilityバフ上限 +10
    const agiBuffCapped = clamp(f.tmp.agiBuff, -999, 10);
    return f.base.Agility + agiBuffCapped;
  }

  function computeEffectiveTech(f) {
    return f.base.Technique + safeNum(f.tmp.techBuff, 0);
  }

  function computeHitChancePct(att, def) {
    const aim = computeEffectiveAim(att);
    const agi = computeEffectiveAgi(def);

    let hc = 50 + (aim - agi) * 0.7;
    hc = clamp(hc, 15, 85);

    // TechniqueReq不足なら -8%
    const req = getWeaponTechReq(att);
    const tech = computeEffectiveTech(att);
    if (tech < req) hc -= 8;

    // チーム/効果等：hitMul（例：0.98）を反映
    hc = hc * safeNum(att.tmp.hitMul, 1);

    // 最終命中率キャップ：10..90
    hc = clamp(hc, 10, 90);

    return hc;
  }

  function computeCritChancePct(att) {
    const tech = computeEffectiveTech(att);
    let cc = 2 + tech * 0.6;
    cc = clamp(cc, 2, 8);
    cc += safeNum(att.tmp.critBonusPct, 0);
    return clamp(cc, 0, 25); // 仕様では2..8だが、外部バフでも暴れない保険
  }

  function computeDamage(att) {
    const base = getWeaponBaseDamage(att);
    const aim = computeEffectiveAim(att);
    const tech = computeEffectiveTech(att);

    let dmg = base * (0.85 + aim / 200 + tech / 250) * rFloat(0.9, 1.1);
    dmg = dmg * safeNum(att.tmp.dmgMul, 1);

    return dmg;
  }

  function applyDamageToTarget(ctx, att, def, rawDamage, isCrit) {
    // クリ倍率
    let dmg = rawDamage;
    if (isCrit) dmg *= 1.4;

    // 1発最大45（クリ込みでも超えない）
    dmg = Math.min(dmg, 45);

    // 無効化判定（強すぎ防止）
    if (ctx.negationTeamCount[def.teamId] < 2 && !def.limits.negatedOnceThisBattle) {
      // def.tmp.negateNextDamage が立っていれば無効化
      if (def.tmp._negateNextDamage === true) {
        def.tmp._negateNextDamage = false;
        def.limits.negatedOnceThisBattle = true;
        ctx.negationTeamCount[def.teamId] += 1;
        ctx.log(`${def.teamName} ${def.name} はダメージを無効化！`);
        return { dealt: 0, negated: true, killed: false };
      }
    } else {
      // もう無効化できない場合はフラグ消す
      def.tmp._negateNextDamage = false;
    }

    // Armor先
    let dealtToArmor = 0;
    let dealtToHp = 0;

    let remaining = dmg;

    if (def.cur.armor > 0) {
      const use = Math.min(def.cur.armor, remaining);
      def.cur.armor -= use;
      remaining -= use;
      dealtToArmor += use;
    }
    if (remaining > 0 && def.cur.hp > 0) {
      const use = Math.min(def.cur.hp, remaining);
      def.cur.hp -= use;
      remaining -= use;
      dealtToHp += use;
      if (use > 0) def.tmp.tookHpDamage = true;
    }

    const killed = def.cur.hp <= 0;

    return { dealt: dealtToArmor + dealtToHp, negated: false, killed, dealtToArmor, dealtToHp };
  }

  // --------------------------
  // Target selection
  // --------------------------
  function isWeakTarget(t) {
    // 「弱ってる敵」= Armor0 または HP減少中（= hp < maxHP）
    return (t.cur.armor <= 0) || (t.cur.hp < t.base.HP);
  }

  function pickTarget(att, enemies) {
    const aliveEnemies = enemies.filter(isAlive);
    if (aliveEnemies.length === 0) return null;

    const tech = computeEffectiveTech(att);
    const weakRate = clamp(25 + tech * 4, 0, 80); // %
    const weakEnemies = aliveEnemies.filter(isWeakTarget);

    const roll = rInt(1, 100);
    if (weakEnemies.length > 0 && roll <= weakRate) {
      // 弱ってる中からランダム
      return pick(weakEnemies);
    }
    return pick(aliveEnemies);
  }

  // --------------------------
  // Item usage (auto)
  // --------------------------
  function countItem(inv, itemId) {
    return safeNum(inv[itemId], 0);
  }
  function decItem(inv, itemId) {
    inv[itemId] = Math.max(0, safeNum(inv[itemId], 0) - 1);
  }

  function chooseAutoItem(ctx, actor, allies, enemies) {
    // 1行動で1個まで。優先：
    // 1) 味方がデス（リスポーンオカリナ）※戦闘中使用可
    // 2) 自分が瀕死→HP回復
    // 3) 自分のArmor削れ→Armor回復
    // 4) 攻撃/妨害
    // ※「全回復するまで全部使う」暴発しない（1個のみ）
    const inv = actor.inv || {};
    const itemsById = ITEMS.getById;

    // 1) respawn
    const respawnId = 'ITEM_SP_OCARINA';
    if (countItem(inv, respawnId) > 0) {
      const deadAlly = allies.find(a => !isAlive(a));
      if (deadAlly) {
        return { itemId: respawnId, target: deadAlly };
      }
    }

    // HP瀕死判定：hp割合が低い（ここはテンポ優先で 35%以下）
    const hpRate = actor.cur.hp / Math.max(1, actor.base.HP);
    if (hpRate <= 0.35) {
      const cand = [
        'ITEM_HP_COTTONCANDY',
        'ITEM_HP_CHOCOLATE',
        'ITEM_HP_GUMMY',
      ];
      for (const id of cand) if (countItem(inv, id) > 0) return { itemId: id, target: actor };
    }

    // Armor削れ
    const arRate = actor.cur.armor / 100;
    if (arRate <= 0.55) {
      const cand = [
        'ITEM_AR_3SCOOP',
        'ITEM_AR_2SCOOP',
        'ITEM_AR_VANILLA',
      ];
      for (const id of cand) if (countItem(inv, id) > 0) return { itemId: id, target: actor };
    }

    // 攻撃/妨害（戦況で優先）
    // - ぷくぷく（全体AimDown）→敵が多い/命中勝負になりそうなら
    // - たい焼き（全体ダメ）→敵が残り少ない時の押し込み
    // - アークラムネ（単体スピードダウン）→一番強そう/先行しそうな敵へ
    const debuffAimAoE = 'ITEM_OFF_PUKUPUKU_LAUNCHER';
    if (countItem(inv, debuffAimAoE) > 0 && enemies.filter(isAlive).length >= 2) {
      return { itemId: debuffAimAoE, target: null };
    }
    const aoeDmg = 'ITEM_OFF_TAIYAKI_GRENADE';
    if (countItem(inv, aoeDmg) > 0) {
      return { itemId: aoeDmg, target: null };
    }
    const speedDown = 'ITEM_OFF_ARC_RAMUNE';
    if (countItem(inv, speedDown) > 0) {
      const t = pickTarget(actor, enemies);
      if (t) return { itemId: speedDown, target: t };
    }

    return null;
  }

  function applyItem(ctx, user, itemId, target, allies, enemies) {
    const it = ITEMS.getById(itemId);
    if (!it) return false;

    // 戦闘中使用OKなもののみ（育成系はここでは使わない）
    if (!ITEMS.isBattleUsable(itemId)) return false;

    // 消費
    decItem(user.inv, itemId);

    // 効果解釈
    const ef = it.effect || {};
    const kind = ef.kind;

    if (kind === ITEMS.EFFECT_KIND.HP_HEAL_FLAT) {
      const t = target || user;
      const before = t.cur.hp;
      const add = safeNum(ef.value, 0);
      t.cur.hp = Math.min(t.base.HP, t.cur.hp + add);
      ctx.log(`${user.name} は ${it.name} を使用！ ${t.name} のHP回復（${Math.round(before)}→${Math.round(t.cur.hp)}）`);
      return true;
    }

    if (kind === ITEMS.EFFECT_KIND.ARMOR_HEAL_FLAT) {
      const t = target || user;
      const before = t.cur.armor;
      const add = safeNum(ef.value, 0);
      t.cur.armor = Math.min(100, t.cur.armor + add);
      ctx.log(`${user.name} は ${it.name} を使用！ ${t.name} のArmor回復（${Math.round(before)}→${Math.round(t.cur.armor)}）`);
      return true;
    }

    if (kind === ITEMS.EFFECT_KIND.DAMAGE_AOE_FLAT) {
      const aliveEnemies = enemies.filter(isAlive);
      if (aliveEnemies.length === 0) return true;
      ctx.log(`${user.name} は ${it.name} を使用！ 全体攻撃！`);
      for (const e of aliveEnemies) {
        const res = applyDamageToTarget(ctx, user, e, safeNum(ef.value, 0), false);
        if (res.killed) {
          ctx.onKill(user, e);
        } else {
          ctx.onDamage(user, e, res.dealt);
        }
      }
      return true;
    }

    if (kind === ITEMS.EFFECT_KIND.DEBUFF_AIM_DOWN_AOE) {
      const aliveEnemies = enemies.filter(isAlive);
      if (aliveEnemies.length === 0) return true;

      // 敵Aimダウン：最大 -12（チーム全体の累積でも暴れないよう、相手側のtmpAimDebuffとして扱う）
      const down = clamp(safeNum(ef.value, 0), 0, 12);
      ctx.log(`${user.name} は ${it.name} を使用！ 敵全体Aimダウン（次の攻撃1回分）`);
      for (const e of aliveEnemies) {
        // 「次の攻撃1回分」なので e.tmp._nextAttackAimDebuff に積む（キャップ -12）
        e.tmp._nextAttackAimDebuff = clamp(safeNum(e.tmp._nextAttackAimDebuff, 0) + down, 0, 12);
      }
      return true;
    }

    if (kind === ITEMS.EFFECT_KIND.DEBUFF_SPEED_DOWN_ONE) {
      const t = target;
      if (!t || !isAlive(t)) return true;
      const down = clamp(safeNum(ef.value, 0), 0, 5);
      ctx.log(`${user.name} は ${it.name} を使用！ ${t.name} のスピードダウン（次の行動1回分）`);
      t.tmp._nextSpeedDown = clamp(safeNum(t.tmp._nextSpeedDown, 0) + down, 0, 5);
      return true;
    }

    if (kind === ITEMS.EFFECT_KIND.ABILITY_CHARGE_ADD) {
      // 実装方針：この試合、ユーザー(チーム)の「追加アビ回数」を+1（全員共通）として ctx.teamAbilityBonus に付与
      const add = clamp(safeNum(ef.value, 0), 0, 3);
      ctx.teamAbilityBonus[user.teamId] = safeNum(ctx.teamAbilityBonus[user.teamId], 0) + add;
      ctx.log(`${user.name} は ${it.name} を使用！ この試合のアビリティ使用回数+${add}`);
      return true;
    }

    if (kind === ITEMS.EFFECT_KIND.RESPAWN_FROM_DEATHBOX) {
      const dead = target;
      if (!dead || isAlive(dead)) return true;

      const hpPct = clamp(safeNum(ef.hpPercent, 0.35), 0.1, 0.6);
      dead.cur.hp = Math.max(1, Math.floor(dead.base.HP * hpPct));
      dead.cur.armor = clamp(safeNum(ef.armor, 0), 0, 100);
      dead.tmp.tookHpDamage = true;

      ctx.log(`${user.name} は ${it.name} を使用！ ${dead.name} が復活！`);
      return true;
    }

    // 未対応はログだけ（仕様違反の暴走防止）
    ctx.log(`${user.name} は ${it.name} を使用！（効果未実装）`);
    return true;
  }

  // --------------------------
  // Ability / Ult triggers (auto)
  // --------------------------
  function shouldUseAbility(ctx, teamId, allies, enemies) {
    // Fight系：戦闘発生した瞬間に1回目。ただし「もう勝ってる戦闘」では温存。
    // 判定基準（簡単）：
    // 自チーム生存人数 <= 敵チーム生存人数 → 使う
    // Armor合計が敵より20以上低い → 使う
    const allyAlive = allies.filter(isAlive).length;
    const enemyAlive = enemies.filter(isAlive).length;

    const allyArmor = allies.reduce((s, a) => s + (isAlive(a) ? a.cur.armor : 0), 0);
    const enemyArmor = enemies.reduce((s, e) => s + (isAlive(e) ? e.cur.armor : 0), 0);

    if (allyAlive <= enemyAlive) return true;
    if ((enemyArmor - allyArmor) >= 20) return true;
    return false;
  }

  function shouldUseUlt(ctx, allies, enemies, isBrawl) {
    // ウルト条件：
    // 味方Aliveが2人以下
    // 味方Armor合計が敵より30以上少ない
    // 乱戦で相手が2チームいる
    // ラスト1人になった
    const allyAlive = allies.filter(isAlive).length;
    const enemyAlive = enemies.filter(isAlive).length;

    const allyArmor = allies.reduce((s, a) => s + (isAlive(a) ? a.cur.armor : 0), 0);
    const enemyArmor = enemies.reduce((s, e) => s + (isAlive(e) ? e.cur.armor : 0), 0);

    if (allyAlive <= 2) return true;
    if ((enemyArmor - allyArmor) >= 30) return true;
    if (isBrawl) return true;
    if (allyAlive === 1) return true;
    // enemyAlive は参考程度
    return false;
  }

  function canUseAbilityForFighter(ctx, f) {
    const baseMax = 2; // 最大2回/試合
    const bonus = safeNum(ctx.teamAbilityBonus[f.teamId], 0);
    const maxUse = baseMax + bonus;
    return f.usage.abilityUsed < maxUse;
  }

  function canUseUltForFighter(ctx, f) {
    return f.usage.ultUsed < 1;
  }

  // 効果適用（このゲームの「強すぎ防止キャップ」をここで強制）
  function applyAbilityEffect(ctx, f, ability, allies, enemies) {
    // ability: { name, type, cpuEffect?, playerEffect?, effect? }
    // ここでは「effect」の汎用キーで処理（無ければログだけ）
    f.usage.abilityUsed += 1;

    const nm = (ability && ability.name) ? ability.name : 'アビリティ';
    ctx.log(`${f.teamName} ${f.name} が ${nm} を使用！`);

    // 汎用：Aimバフ（味方全体）
    if (ability && ability.effect && ability.effect.kind === 'TEAM_AIM_UP_ONCE') {
      const up = clamp(safeNum(ability.effect.value, 0), 0, 15);
      for (const a of allies) {
        if (!isAlive(a)) continue;
        // Aimバフ合計+15を超えないように tmp.aimBuff に積む（武器は別で加算）
        a.tmp.aimBuff = clamp(safeNum(a.tmp.aimBuff, 0) + up, -999, 15);
      }
      return;
    }

    // 汎用：敵Aimダウン（次の攻撃1回分）
    if (ability && ability.effect && ability.effect.kind === 'ENEMY_AIM_DOWN_NEXT') {
      const down = clamp(safeNum(ability.effect.value, 0), 0, 12); // デバフ上限-12
      for (const e of enemies) {
        if (!isAlive(e)) continue;
        e.tmp._nextAttackAimDebuff = clamp(safeNum(e.tmp._nextAttackAimDebuff, 0) + down, 0, 12);
      }
      return;
    }

    // 何も無い場合でも進行は止めない
  }

  function applyUltEffect(ctx, f, ult, allies, enemies) {
    f.usage.ultUsed += 1;

    const nm = (ult && ult.name) ? ult.name : 'ウルト';
    ctx.log(`${f.teamName} ${f.name} が ${nm} を使用！`);

    // 汎用：味方全員「被ダメ1回無効」付与（ただし制限は applyDamage側で管理）
    if (ult && ult.effect && ult.effect.kind === 'TEAM_NEGATE_NEXT_DAMAGE') {
      for (const a of allies) {
        if (!isAlive(a)) continue;
        a.tmp._negateNextDamage = true;
      }
      return;
    }

    // 汎用：敵1人を次の行動スキップ
    if (ult && ult.effect && ult.effect.kind === 'ENEMY_SKIP_NEXT') {
      const t = pickTarget(f, enemies);
      if (t) {
        t.tmp.skipNextAction = true;
        ctx.log(`→ ${t.name} は次の行動がスキップ！`);
      }
      return;
    }
  }

  // --------------------------
  // Passives (battle start)
  // --------------------------
  function applyTeamPassivesAtStart(ctx, teams, fighters) {
    // チームパッシブ（CPUチーム）を想定：team.passive に {name,effect} があれば適用
    for (const team of teams) {
      if (!team || !team.passive) continue;

      const allies = getTeamFighters(team.id, fighters);
      const p = team.passive;
      const pn = p.name || 'パッシブ';

      // "戦闘開始時"系のみここで反映（常時系は tmp に保持して計算で参照できる形に）
      // 代表パターン：
      // - teamAimPlusFlat
      // - teamAgiPlusFlat
      // - teamHitPlusPct (命中率+% => hitMul)
      // - enemyHitMinusPct (敵命中率-% => 敵のhitMul)
      // - teamArmorPlusStart (Armor+X max100)
      // - teamHpPlusStart
      // - teamDmgPlusPct
      // - enemyAimMinusFlatStart
      // - enemyAgiMinusFlat (battle only)
      // - mentalConsumeMinusPct / plusPct（ここはsim側のmental消費が未実装のため保留）
      //
      // ※データがまだ完全に揃っていなくても壊れないように、見つけたものだけ適用する。

      ctx.log(`${team.name} のパッシブ発動：${pn}`);

      // 味方Aim +N（開始時 or 常時）=> tmp.aimBuffへ（cap+15）
      if (p.teamAimPlus != null) {
        const up = clamp(safeNum(p.teamAimPlus, 0), -99, 15);
        for (const a of allies) a.tmp.aimBuff = clamp(safeNum(a.tmp.aimBuff, 0) + up, -999, 15);
      }

      // 味方Agility +N（常時）=> tmp.agiBuff（cap+10）
      if (p.teamAgiPlus != null) {
        const up = clamp(safeNum(p.teamAgiPlus, 0), -99, 10);
        for (const a of allies) a.tmp.agiBuff = clamp(safeNum(a.tmp.agiBuff, 0) + up, -999, 10);
      }

      // 味方命中率 +% => hitMul
      if (p.teamHitPlusPct != null) {
        const pct = clamp(safeNum(p.teamHitPlusPct, 0), -20, 20);
        for (const a of allies) a.tmp.hitMul = safeNum(a.tmp.hitMul, 1) * (1 + pct / 100);
      }

      // 味方ダメージ +% => dmgMul
      if (p.teamDmgPlusPct != null) {
        const pct = clamp(safeNum(p.teamDmgPlusPct, 0), -20, 20);
        for (const a of allies) a.tmp.dmgMul = safeNum(a.tmp.dmgMul, 1) * (1 + pct / 100);
      }

      // 戦闘開始時：味方Armor +X（最大100）
      if (p.teamArmorStartPlus != null) {
        const add = clamp(safeNum(p.teamArmorStartPlus, 0), -100, 100);
        for (const a of allies) a.cur.armor = clamp(a.cur.armor + add, 0, 100);
      }

      // 戦闘開始時：味方HP +X（最大HP）
      if (p.teamHpStartPlus != null) {
        const add = clamp(safeNum(p.teamHpStartPlus, 0), -999, 999);
        for (const a of allies) a.cur.hp = clamp(a.cur.hp + add, 0, a.base.HP);
      }
    }
  }

  // --------------------------
  // Battle engine
  // --------------------------
  function makeBattleContext() {
    const ctx = {
      logs: [],
      killPoints: Object.create(null),   // fighterId -> points
      assistPoints: Object.create(null), // fighterId -> points

      // 無効化制限
      negationTeamCount: Object.create(null), // teamId -> count

      // チュッパチャージ等で増えるアビ回数ボーナス（チーム単位）
      teamAbilityBonus: Object.create(null),

      // 同ターンのダメージ追跡（victimId -> Set(attackerId)）
      turnDamageMap: Object.create(null),

      log(s) {
        this.logs.push(String(s));
      },

      onDamage(att, victim, amount) {
        if (!att || !victim) return;
        if (!this.turnDamageMap[victim.id]) this.turnDamageMap[victim.id] = new Set();
        if (amount > 0) this.turnDamageMap[victim.id].add(att.id);
      },

      onKill(killer, victim) {
        // kill 2pt
        if (killer) {
          this.killPoints[killer.id] = safeNum(this.killPoints[killer.id], 0) + 2;
        }

        // assists: 同ターンに削った別キャラ
        const set = this.turnDamageMap[victim.id];
        if (set) {
          for (const aid of set) {
            if (!killer || aid === killer.id) continue;
            this.assistPoints[aid] = safeNum(this.assistPoints[aid], 0) + 1;
          }
        }

        this.log(`${killer ? killer.name : '??'} が ${victim.name} をキル！`);
      },
    };

    return ctx;
  }

  function resetTurnDamage(ctx) {
    ctx.turnDamageMap = Object.create(null);
  }

  function battleIsOver(teams, fighters) {
    const aliveTeams = [];
    for (const t of teams) {
      const cnt = teamAliveCount(t, fighters);
      if (cnt > 0) aliveTeams.push(t);
    }
    return aliveTeams.length <= 1;
  }

  function getAliveTeams(teams, fighters) {
    return teams.filter(t => teamAliveCount(t, fighters) > 0);
  }

  function applyNextAttackDebuffsIfAny(att) {
    // 次の攻撃1回分のAimデバフ
    const down = safeNum(att.tmp._nextAttackAimDebuff, 0);
    if (down > 0) {
      // ここは「攻撃する瞬間に一回だけ」適用。aimBuff を一時的に下げるのではなく、
      // 命中計算の前に tmp._tempAimPenalty として使う。
      att.tmp._tempAimPenalty = down;
      att.tmp._nextAttackAimDebuff = 0;
    } else {
      att.tmp._tempAimPenalty = 0;
    }
  }

  function applyNextSpeedDownIfAny(att) {
    const down = safeNum(att.tmp._nextSpeedDown, 0);
    if (down > 0) {
      att.tmp._tempSpeedDown = down;
      att.tmp._nextSpeedDown = 0;
    } else {
      att.tmp._tempSpeedDown = 0;
    }
  }

  function effectiveAimWithTempPenalty(att) {
    const aimBuffCapped = clamp(att.tmp.aimBuff + getWeaponAimBonus(att), -999, 15);
    const baseAim = att.base.Aim + aimBuffCapped;
    const pen = safeNum(att.tmp._tempAimPenalty, 0);
    return baseAim - pen;
  }

  function computeHitChancePctWithTemp(att, def) {
    // computeHitChancePct を tempAimPenalty 反映版で再計算
    const aim = effectiveAimWithTempPenalty(att);
    const agi = computeEffectiveAgi(def);

    let hc = 50 + (aim - agi) * 0.7;
    hc = clamp(hc, 15, 85);

    const req = getWeaponTechReq(att);
    const tech = computeEffectiveTech(att);
    if (tech < req) hc -= 8;

    hc = hc * safeNum(att.tmp.hitMul, 1);
    hc = clamp(hc, 10, 90);

    return hc;
  }

  function computeSpeedWithTemp(f) {
    // Move補正のコーチスキルは禁止（ここでは扱わない）
    // アイテム等の一時SpeedDownだけ反映（Move/Agilityへの影響として扱う）
    const speedDown = safeNum(f.tmp._tempSpeedDown, 0);
    const effMove = Math.max(0, f.base.Move - speedDown);
    const effAgi = computeEffectiveAgi(f);
    return effAgi + (effMove * 2) + rInt(0, 10);
  }

  // メイン：戦闘実行
  // teamsInBattle: [{id,name, passive?}, ...] length 2..3
  // teamRosters:   teamId -> [charDef,...]（charDefはdata_players形式でも可。最低 stats を持てばOK）
  // options:
  //   - weaponsByFighterName/team : 任意
  //   - inventoriesByTeamId : { [teamId]: { [fighterName]: {itemId:count,...} } }
  function runBattle(teamsInBattle, teamRosters, options = {}) {
    const teams = (teamsInBattle || []).slice(0, 3);
    if (teams.length < 2) throw new Error('runBattle requires at least 2 teams');
    const isBrawl = teams.length === 3;

    const ctx = makeBattleContext();

    // init negation counters
    for (const t of teams) ctx.negationTeamCount[t.id] = 0;

    // build fighters
    const fighters = [];
    for (const t of teams) {
      const roster = (teamRosters && teamRosters[t.id]) ? teamRosters[t.id] : [];
      for (const cd of roster) fighters.push(makeFighter(cd, t));
    }

    // apply inventories (optional)
    const invByTeam = options.inventoriesByTeamId || {};
    for (const f of fighters) {
      const teamInv = invByTeam[f.teamId] || {};
      const inv = teamInv[f.name] || teamInv[f.id] || null;
      if (inv && typeof inv === 'object') {
        f.inv = Object.assign({}, inv);
      }
    }

    // apply weapons (optional) - if none, placeholder
    // options.weaponsByTeamId: { [teamId]: { [fighterName]: weaponObj } }
    const wByTeam = options.weaponsByTeamId || {};
    for (const f of fighters) {
      const wt = wByTeam[f.teamId] || {};
      const w = wt[f.name] || wt[f.id] || null;
      if (w) f.weapon = Object.assign({}, w);
    }

    // battle start log
    ctx.log(`戦闘開始！ (${teams.map(t => t.name).join(' vs ')})`);

    // passives at start (team passives)
    applyTeamPassivesAtStart(ctx, teams, fighters);

    // battle loop
    let turn = 1;
    while (!battleIsOver(teams, fighters) && turn <= 200) {
      resetTurnDamage(ctx);
      ctx.log(`--- TURN ${turn} ---`);

      // 行動順決定（生存者のみ）
      const alive = fighters.filter(isAlive);

      // 次行動1回分デバフ（スピード）を行動順の前に反映
      // ※「次の行動1回分」なので、ここで temp を作って speed 計算に使う
      for (const f of alive) {
        applyNextSpeedDownIfAny(f);
      }

      // order
      const order = alive
        .map(f => ({ f, spd: computeSpeedWithTemp(f) }))
        .sort((a, b) => b.spd - a.spd)
        .map(x => x.f);

      for (const actor of order) {
        if (!isAlive(actor)) continue; // 途中で倒れた
        if (battleIsOver(teams, fighters)) break;

        // 行動スキップ（ウルト等）
        if (actor.tmp.skipNextAction) {
          actor.tmp.skipNextAction = false;
          ctx.log(`${actor.name} は行動不能でスキップ！`);
          continue;
        }

        const allies = getTeamFighters(actor.teamId, fighters);
        const enemies = fighters.filter(f => f.teamId !== actor.teamId);

        // 1) アイテム（行動の最初に1回だけ判定）
        const autoItem = chooseAutoItem(ctx, actor, allies, enemies);
        if (autoItem) {
          applyItem(ctx, actor, autoItem.itemId, autoItem.target, allies, enemies);
          // アイテム使用したら、そのターンの「攻撃」もするか？
          // ユーザーの定義では「自分の行動の最初に1回だけ判定」→アイテム使ったら残りは攻撃に移行してOK。
          // ただし「テンポ重視」で1行動1個の制限はアイテムにのみ適用、と解釈。
        }

        // 2) アビリティ（使うべきなら即使用）
        if (actor.ability && canUseAbilityForFighter(ctx, actor)) {
          // Fight系想定（他タイプは現段階では戦闘中に干渉しないのでログのみでもOK）
          const use = shouldUseAbility(ctx, actor.teamId, allies, enemies.filter(isAlive));
          if (use) {
            applyAbilityEffect(ctx, actor, actor.ability, allies, enemies.filter(isAlive));
          }
        }

        // 3) ウルト（勝負所）
        if (actor.ult && canUseUltForFighter(ctx, actor)) {
          const use = shouldUseUlt(ctx, allies, enemies.filter(isAlive), isBrawl);
          if (use) {
            applyUltEffect(ctx, actor, actor.ult, allies, enemies.filter(isAlive));
          }
        }

        // 4) 攻撃
        const target = pickTarget(actor, enemies);
        if (!target) continue;

        // 次の攻撃1回分のAimデバフを「攻撃の瞬間」適用
        applyNextAttackDebuffsIfAny(actor);

        const hit = computeHitChancePctWithTemp(actor, target);
        const roll = rInt(1, 100);
        if (roll <= hit) {
          const critChance = computeCritChancePct(actor);
          const critRoll = rInt(1, 100);
          const isCrit = critRoll <= critChance;

          const raw = computeDamage(actor);
          const res = applyDamageToTarget(ctx, actor, target, raw, isCrit);

          if (res.negated) {
            // 無効化ログは applyDamage 内で出る
          } else {
            const critTxt = isCrit ? '（CRIT）' : '';
            ctx.log(`${actor.name} が ${target.name} に命中！${critTxt}`);

            if (res.killed) {
              ctx.onKill(actor, target);
            } else {
              ctx.onDamage(actor, target, res.dealt);
            }
          }
        } else {
          ctx.log(`${actor.name} の攻撃は外れた…`);
        }

        // temp penalty clear
        actor.tmp._tempAimPenalty = 0;
        actor.tmp._tempSpeedDown = 0;

        // 全滅チェック（即終了）
        if (battleIsOver(teams, fighters)) break;
      }

      turn += 1;
    }

    // result
    const aliveTeams = getAliveTeams(teams, fighters);
    const winnerTeam = aliveTeams.length === 1 ? aliveTeams[0] : null;

    if (winnerTeam) {
      ctx.log(`${winnerTeam.name} チーム全滅勝利！`);
    } else {
      ctx.log(`戦闘終了（引き分け/上限到達）`);
    }

    // summarize points per fighter name
    const points = {
      kill: {},
      assist: {},
    };
    for (const f of fighters) {
      const k = safeNum(ctx.killPoints[f.id], 0);
      const a = safeNum(ctx.assistPoints[f.id], 0);
      if (k) points.kill[f.name] = k;
      if (a) points.assist[f.name] = a;
    }

    return {
      winnerTeamId: winnerTeam ? winnerTeam.id : null,
      winnerTeamName: winnerTeam ? winnerTeam.name : null,
      turns: turn - 1,
      logs: ctx.logs.slice(),
      fighters: fighters.map(f => ({
        id: f.id,
        name: f.name,
        teamId: f.teamId,
        teamName: f.teamName,
        hp: Math.max(0, Math.round(f.cur.hp)),
        armor: Math.max(0, Math.round(f.cur.armor)),
        alive: isAlive(f),
      })),
      points,
    };
  }

  // ---------------------------------------------------------
  // Export
  // ---------------------------------------------------------
  const exportObj = {
    runBattle,
  };

  Object.freeze(exportObj);
  window.SIM_BATTLE = exportObj;
})();
