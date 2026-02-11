'use strict';

/*
  MOB BR - sim_match_events.js v1（フル）
  試合最新版.txt 準拠（8-3 / 8-4 / 8-5）
  - イベント抽選（重み）
  - 表示テンポ（必ず3段固定）
  - 効果は内部のみ（％や数値はログに出さない）
  - eliminated=true のチームは抽選対象外
  - R2〜R5は2回（同一ラウンドでイベント重複なし）→ flow側が2回呼ぶ前提だが、ここでもガード
  - Treasure/Flag は result用カウント
  - score_mind 装備中：Treasure/Flag 取得時に +1 追加（合計+2）
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){

  const EVENT_MASTER = [
    {
      id: 'strategy_meeting',
      name: '作戦会議',
      weight: 35,
      icon: 'bup.png',
      effect: { agiPct: +1 },
      lines: [
        '次の戦闘に向けて作戦会議！連携力がアップした！',
        'ここで作戦会議！連携力アップ！',
        '次の移動について作戦会議！連携がアップ！'
      ]
    },
    {
      id: 'supply_trade',
      name: '物資交換',
      weight: 35,
      icon: 'bup.png',
      effect: { agiPct: +1 },
      lines: [
        '物資をお互いに交換！連携力がアップした！',
        '物資を交換した！連携力アップ！',
        '物資をチェックし、準備万端！連携がアップ！'
      ]
    },
    {
      id: 'huddle',
      name: '円陣',
      weight: 35,
      icon: 'bup.png',
      effect: { aimPct: +1 },
      lines: [
        '円陣を組んだ！ファイト力アップ！',
        '絶対勝つぞ！円陣で気合い注入！',
        '円陣によりファイト力アップ！'
      ]
    },
    {
      id: 'calm_scan',
      name: '冷静な索敵',
      weight: 35,
      icon: 'bup.png',
      effect: { mentalPct: +1 },
      lines: [
        '落ち着いて索敵！次の戦闘は先手を取れそうだ！',
        'それぞれが索敵！戦闘に備える！',
        '敵発見！さあどう動く！'
      ]
    },
    {
      id: 'rare_weapon',
      name: 'レア武器ゲット',
      weight: 10,
      icon: 'bup.png',
      effect: { aimPct: +2 },
      lines: [
        'レア武器をゲット！戦闘が有利に！',
        'これは..レア武器発見！やったね！',
        'レア武器を拾った！一気に押していこう！'
      ]
    },
    {
      id: 'bad_call',
      name: '判断ミス',
      weight: 15,
      icon: 'bdeba.png',
      effect: { agiPct: -1 },
      lines: [
        '痛恨の判断ミス！',
        '移動で迷ってしまった..'
      ]
    },
    {
      id: 'argument',
      name: '喧嘩',
      weight: 10,
      icon: 'bdeba.png',
      effect: { mentalPct: -1 },
      lines: [
        'ムーブが噛み合わない！争ってしまった..',
        'ピンを見ていなかった..一時の言い争いだ'
      ]
    },
    {
      id: 'reload_miss',
      name: 'リロードミス',
      weight: 5,
      icon: 'bdeba.png',
      effect: { aimPct: -2 },
      lines: [
        'リロードしていなかった！これはまずい'
      ]
    },
    {
      id: 'zone_mode',
      name: 'ゾーンに入る',
      weight: 5,
      icon: 'bup.png',
      effect: { aimPct: +3, mentalPct: +3 },
      lines: [
        '全員がゾーンに入った!!優勝するぞ！',
        '全員が集中モード！終わらせよう！'
      ]
    },
    {
      id: 'champion_move',
      name: 'チャンピオンムーブ',
      weight: 3,
      icon: 'bup.png',
      effect: { aimPct: +5, mentalPct: +5 },
      lines: [
        'チャンピオンムーブが発動！全員覚醒モードだ！'
      ]
    },
    {
      id: 'treasure',
      name: 'お宝ゲット',
      weight: 4,
      icon: 'bgeta.png',
      effect: { treasure: +1 },
      lines: [
        'お宝をゲット！順位が有利に！'
      ]
    },
    {
      id: 'flag',
      name: 'フラッグゲット',
      weight: 2,
      icon: 'bgetb.png',
      effect: { flag: +1 },
      lines: [
        'フラッグをゲット！順位に大きく影響する！'
      ]
    }
  ];

  const BY_ID = Object.fromEntries(EVENT_MASTER.map(e => [e.id, e]));

  function randInt(n){
    return Math.floor(Math.random() * n);
  }
  function pickOne(arr){
    if (!arr || arr.length === 0) return null;
    return arr[randInt(arr.length)];
  }

  function weightedPick(list, bannedIdsSet){
    const candidates = [];
    let total = 0;

    for (const e of list){
      if (bannedIdsSet && bannedIdsSet.has(e.id)) continue;
      const w = Number(e.weight) || 0;
      if (w <= 0) continue;
      total += w;
      candidates.push({ e, w });
    }

    if (candidates.length === 0) return null;

    let r = Math.random() * total;
    for (const c of candidates){
      r -= c.w;
      if (r <= 0) return c.e;
    }
    return candidates[candidates.length - 1].e;
  }

  // プレイヤーチーム判定（kind === 'player' を優先。無ければ先頭）
  function getPlayerTeam(state){
    const teams = Array.isArray(state?.teams) ? state.teams : [];
    const p = teams.find(t => t && t.kind === 'player');
    return p || teams[0] || null;
  }

  function ensureTeamEventFields(team){
    if (!team) return;
    if (!team.eventBuffs || typeof team.eventBuffs !== 'object'){
      team.eventBuffs = { aimPct: 0, mentalPct: 0, agiPct: 0 };
    }else{
      if (!Number.isFinite(team.eventBuffs.aimPct)) team.eventBuffs.aimPct = 0;
      if (!Number.isFinite(team.eventBuffs.mentalPct)) team.eventBuffs.mentalPct = 0;
      if (!Number.isFinite(team.eventBuffs.agiPct)) team.eventBuffs.agiPct = 0;
    }

    if (!Number.isFinite(team.treasure)) team.treasure = 0;
    if (!Number.isFinite(team.flag)) team.flag = 0;

    // 同ラウンド重複なし用（idセット）
    if (!team._roundEventUsed || typeof team._roundEventUsed !== 'object'){
      team._roundEventUsed = {};
    }
  }

  // コーチ装備取得（playerのみ）
  function readCoachEquipped(){
    try{
      const arr = JSON.parse(localStorage.getItem('mobbr_coachSkillsEquipped') || '[]');
      if (!Array.isArray(arr)) return [];
      return arr.map(v => (typeof v === 'string' ? v.trim() : '')).filter(Boolean);
    }catch{
      return [];
    }
  }

  function hasCoachSkill(id){
    const eq = readCoachEquipped();
    return eq.includes(id);
  }

  // 3段固定表示（UIがあれば委譲、無ければログで代替）
  function showEvent3Lines(eventName, line, icon){
    const U = window.MOBBR?.ui?.match;

    // UIが「キュー」に積めるならそっち（後でui_match.jsで実装する前提）
    if (U && typeof U.enqueue === 'function'){
      U.enqueue({
        type: 'event',
        icon: icon || '',
        lines: ['イベント発生！', eventName, line]
      });
      return;
    }

    // 最低限：即時ログ（3段を順に出す）
    if (U && typeof U.log === 'function'){
      U.log('イベント発生！', '');
      U.log(eventName, '');
      U.log(line, '');
      return;
    }

    // さらに保険（console）
    console.log('[EVENT]', 'イベント発生！', eventName, line, icon || '');
  }

  // 効果内部反映（％は加算で保持→後で計算側で乗算にする）
  function applyEventEffect(team, ev){
    ensureTeamEventFields(team);

    const eff = ev.effect || {};

    if (Number.isFinite(eff.aimPct)) team.eventBuffs.aimPct += eff.aimPct;
    if (Number.isFinite(eff.mentalPct)) team.eventBuffs.mentalPct += eff.mentalPct;
    if (Number.isFinite(eff.agiPct)) team.eventBuffs.agiPct += eff.agiPct;

    // Treasure/Flag（result用）
    if (Number.isFinite(eff.treasure)){
      const baseAdd = eff.treasure;
      team.treasure += baseAdd;

      // score_mind：取得が伸びる（+1追加 → 合計+2相当）
      if (hasCoachSkill('score_mind')){
        team.treasure += 1;
      }
    }

    if (Number.isFinite(eff.flag)){
      const baseAdd = eff.flag;
      team.flag += baseAdd;

      if (hasCoachSkill('score_mind')){
        team.flag += 1;
      }
    }
  }

  // ラウンド切替時に必ず呼ぶ想定（Flow側で round++ の前後で）
  function resetRoundUsed(state){
    const teams = Array.isArray(state?.teams) ? state.teams : [];
    for (const t of teams){
      if (!t) continue;
      t._roundEventUsed = {};
    }
  }

  // メイン：イベント1回分実行（Flowから呼ぶ）
  // - state.round を参照
  // - playerが脱落してたら何もしない（プレイヤー視点ログ無しのため）
  function run(state){
    if (!state || !Array.isArray(state.teams)) return;

    const round = Number(state.round) || 1;

    const player = getPlayerTeam(state);
    if (!player) return;
    if (player.eliminated) return; // 視点ログを出さない + 効果も不要

    ensureTeamEventFields(player);

    // R2〜R5は2回呼ばれる前提だが、同ラウンド内重複をここでもガード
    const used = new Set(Object.keys(player._roundEventUsed || {}).filter(k => player._roundEventUsed[k]));

    const ev = weightedPick(EVENT_MASTER, used);
    if (!ev) return;

    // 同ラウンド重複禁止の記録
    player._roundEventUsed[ev.id] = true;

    const line = pickOne(ev.lines) || '';
    showEvent3Lines(ev.name, line, ev.icon);

    applyEventEffect(player, ev);

    // debug用に保持（任意）
    if (!player._eventHistory) player._eventHistory = [];
    player._eventHistory.push({ r: round, id: ev.id, name: ev.name });
  }

  window.MOBBR.sim.matchEvents = {
    master: EVENT_MASTER,
    byId: BY_ID,
    run,
    resetRoundUsed
  };

})();
