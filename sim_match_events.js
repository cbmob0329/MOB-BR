'use strict';

/*
  sim_match_events.js v2（フル）
  ✅「試合最新版.txt」運用向け（大会側から呼ばれる “イベント抽選エンジン” ）
  - rollForTeam(team, round, ctx) を提供（3段ログ / アイコン / 効果反映）
  - resetTeamMatchState(team) を提供（試合中バフ・イベント履歴のリセット）
  - eventBuffs（aim/mental/agi の%加算）を更新
  - Treasure / Flag を更新（勝敗に直結させない）
  - ✅ downs_total は「A運用」：内部だけで常に数値として保持（UIに出さない）
  - 同ラウンド重複なし（同チーム内）：R2〜R5で2回呼ばれても別イベントになる
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){

  // ===== helpers =====
  function clamp(n, lo, hi){
    const v = Number(n);
    if (!Number.isFinite(v)) return lo;
    return Math.max(lo, Math.min(hi, v));
  }

  function ensureTeamShape(team){
    if (!team) return;

    // A) バグりにくい：必ず数値で保持（UIには出さない）
    if (!Number.isFinite(Number(team.downs_total))) team.downs_total = 0;

    if (!Number.isFinite(Number(team.treasure))) team.treasure = 0;
    if (!Number.isFinite(Number(team.flag))) team.flag = 0;

    if (!team.eventBuffs || typeof team.eventBuffs !== 'object'){
      team.eventBuffs = { aim:0, mental:0, agi:0 };
    }else{
      if (!Number.isFinite(Number(team.eventBuffs.aim))) team.eventBuffs.aim = 0;
      if (!Number.isFinite(Number(team.eventBuffs.mental))) team.eventBuffs.mental = 0;
      if (!Number.isFinite(Number(team.eventBuffs.agi))) team.eventBuffs.agi = 0;
    }

    // 同ラウンド重複防止用の履歴（試合中のみ）
    if (!team._evUsedByRound || typeof team._evUsedByRound !== 'object'){
      team._evUsedByRound = Object.create(null);
    }
  }

  function pickOne(arr){
    if (!arr || arr.length === 0) return '';
    return arr[(Math.random() * arr.length) | 0];
  }

  function weightedPick(list){
    // list: [{id, w}, ...]
    let sum = 0;
    for (const x of list) sum += Math.max(0, Number(x.w) || 0);
    if (sum <= 0) return null;

    let r = Math.random() * sum;
    for (const x of list){
      r -= Math.max(0, Number(x.w) || 0);
      if (r <= 0) return x;
    }
    return list[list.length - 1] || null;
  }

  function getUsedSet(team, round){
    ensureTeamShape(team);
    const key = String(round|0);
    let s = team._evUsedByRound[key];
    if (!s){
      s = new Set();
      team._evUsedByRound[key] = s;
    }else if (!(s instanceof Set)){
      // 念のため：壊れてたら復旧
      s = new Set(Array.isArray(s) ? s : []);
      team._evUsedByRound[key] = s;
    }
    return s;
  }

  function markUsed(team, round, evId){
    const s = getUsedSet(team, round);
    s.add(String(evId || ''));
  }

  function isUsed(team, round, evId){
    const s = getUsedSet(team, round);
    return s.has(String(evId || ''));
  }

  // ===== Event master (確定) =====
  // アイコンは「直下」前提（フォルダ無し）
  const ICON_UP   = 'bup.png';
  const ICON_DEBA = 'bdeba.png';
  const ICON_GETA = 'bgeta.png';
  const ICON_GETB = 'bgetb.png';

  const EVENTS = [
    {
      id: 'strategy_meeting',
      name: '作戦会議',
      w: 35,
      icon: ICON_UP,
      eff: { agi:+1 },
      lines: [
        '次の戦闘に向けて作戦会議！連携力がアップした！',
        'ここで作戦会議！連携力アップ！',
        '次の移動について作戦会議！連携がアップ！'
      ]
    },
    {
      id: 'supply_trade',
      name: '物資交換',
      w: 35,
      icon: ICON_UP,
      eff: { agi:+1 },
      lines: [
        '物資をお互いに交換！連携力がアップした！',
        '物資を交換した！連携力アップ！',
        '物資をチェックし、準備万端！連携がアップ！'
      ]
    },
    {
      id: 'huddle',
      name: '円陣',
      w: 35,
      icon: ICON_UP,
      eff: { aim:+1 },
      lines: [
        '円陣を組んだ！ファイト力アップ！',
        '絶対勝つぞ！円陣で気合い注入！',
        '円陣によりファイト力アップ！'
      ]
    },
    {
      id: 'calm_scan',
      name: '冷静な索敵',
      w: 35,
      icon: ICON_UP,
      eff: { mental:+1 },
      lines: [
        '落ち着いて索敵！次の戦闘は先手を取れそうだ！',
        'それぞれが索敵！戦闘に備える！',
        '敵発見！さあどう動く！'
      ]
    },
    {
      id: 'rare_weapon',
      name: 'レア武器ゲット',
      w: 10,
      icon: ICON_UP,
      eff: { aim:+2 },
      lines: [
        'レア武器をゲット！戦闘が有利に！',
        'これは..レア武器発見！やったね！',
        'レア武器を拾った！一気に押していこう！'
      ]
    },
    {
      id: 'bad_call',
      name: '判断ミス',
      w: 15,
      icon: ICON_DEBA,
      eff: { agi:-1 },
      lines: [
        '痛恨の判断ミス！',
        '移動で迷ってしまった..'
      ]
    },
    {
      id: 'fight',
      name: '喧嘩',
      w: 10,
      icon: ICON_DEBA,
      eff: { mental:-1 },
      lines: [
        'ムーブが噛み合わない！争ってしまった..',
        'ピンを見ていなかった..一時の言い争いだ'
      ]
    },
    {
      id: 'reload_miss',
      name: 'リロードミス',
      w: 5,
      icon: ICON_DEBA,
      eff: { aim:-2 },
      lines: [
        'リロードしていなかった！これはまずい'
      ]
    },
    {
      id: 'in_the_zone',
      name: 'ゾーンに入る',
      w: 5,
      icon: ICON_UP,
      eff: { aim:+3, mental:+3 },
      lines: [
        '全員がゾーンに入った!!優勝するぞ！',
        '全員が集中モード！終わらせよう！'
      ]
    },
    {
      id: 'champ_move',
      name: 'チャンピオンムーブ',
      w: 3,
      icon: ICON_UP,
      eff: { aim:+5, mental:+5 },
      lines: [
        'チャンピオンムーブが発動！全員覚醒モードだ！'
      ]
    },
    {
      id: 'treasure',
      name: 'お宝ゲット',
      w: 4,
      icon: ICON_GETA,
      eff: { treasure:+1 },
      lines: [
        'お宝をゲット！順位が有利に！'
      ]
    },
    {
      id: 'flag',
      name: 'フラッグゲット',
      w: 2,
      icon: ICON_GETB,
      eff: { flag:+1 },
      lines: [
        'フラッグをゲット！順位に大きく影響する！'
      ]
    },
  ];

  function applyEffect(team, ev, ctx){
    ensureTeamShape(team);
    const eff = ev?.eff || {};

    // %バフ（試合中のみ）
    if (Number.isFinite(Number(eff.aim)))    team.eventBuffs.aim    = clamp(team.eventBuffs.aim    + Number(eff.aim),    -99, 99);
    if (Number.isFinite(Number(eff.mental))) team.eventBuffs.mental = clamp(team.eventBuffs.mental + Number(eff.mental), -99, 99);
    if (Number.isFinite(Number(eff.agi)))    team.eventBuffs.agi    = clamp(team.eventBuffs.agi    + Number(eff.agi),    -99, 99);

    // スコア系（勝敗に直結させない）
    if (Number.isFinite(Number(eff.treasure))){
      let add = Number(eff.treasure) | 0;

      // コーチスキル score_mind：Treasure取得時に +1 追加（合計+2）
      const scoreMind = !!(ctx && ctx.playerCoach && ctx.playerCoach.score_mind);
      if (scoreMind && ev && ev.id === 'treasure'){
        add += 1;
      }

      team.treasure = clamp((team.treasure|0) + add, 0, 9999);
    }

    if (Number.isFinite(Number(eff.flag))){
      team.flag = clamp((team.flag|0) + (Number(eff.flag)|0), 0, 9999);
    }
  }

  function rollForTeam(team, round, ctx){
    if (!team) return null;
    ensureTeamShape(team);

    // eliminated は呼び出し側で弾く想定だが、念のため
    if (team.eliminated) return null;

    const r = clamp(round, 1, 6);

    // R6 基本なし（呼ばれたら null 返す）
    if (r === 6) return null;

    // 同ラウンド重複なし：使われてないイベントだけで抽選
    const candidates = EVENTS.filter(ev => !isUsed(team, r, ev.id));
    if (candidates.length === 0){
      // ここに来るのは通常ありえないが、保険で全体から
      const ev0 = EVENTS[(Math.random() * EVENTS.length) | 0];
      if (!ev0) return null;
      applyEffect(team, ev0, ctx);
      return {
        id: ev0.id,
        icon: ev0.icon || '',
        name: ev0.name || '',
        log1: 'イベント発生！',
        log2: String(ev0.name || ''),
        log3: pickOne(ev0.lines) || ''
      };
    }

    const pick = weightedPick(candidates.map(ev => ({ id: ev.id, w: ev.w })));
    const ev = pick ? candidates.find(x => x.id === pick.id) : candidates[(Math.random() * candidates.length) | 0];
    if (!ev) return null;

    markUsed(team, r, ev.id);
    applyEffect(team, ev, ctx);

    return {
      id: ev.id,
      icon: ev.icon || '',
      name: ev.name || '',
      log1: 'イベント発生！',
      log2: String(ev.name || ''),
      log3: pickOne(ev.lines) || ''
    };
  }

  function resetTeamMatchState(team){
    if (!team) return;

    // A運用：存在させて常に数値（初期0）
    if (!Number.isFinite(Number(team.downs_total))) team.downs_total = 0;
    else team.downs_total = 0;

    // 試合中のみのバフをリセット
    team.eventBuffs = { aim:0, mental:0, agi:0 };

    // 同ラウンド重複防止の履歴をリセット
    team._evUsedByRound = Object.create(null);
  }

  window.MOBBR.sim.matchEvents = {
    rollForTeam,
    resetTeamMatchState,

    // デバッグ等で参照したい場合用（任意）
    _EVENTS: EVENTS.slice()
  };

})();
