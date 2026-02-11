'use strict';

/*
  sim_match_events.js v2（フル）
  ✅「試合最新版.txt」準拠：イベント一覧（重み抽選・表記セリフ・効果・表示画像）を確定反映

  仕様（最新版より）：
  - 8-4. イベント一覧（重み抽選・表記セリフ・効果 確定）
  - 8-3. 表示テンポ：中央ログは必ず3段固定
      1) 「イベント発生！」
      2) 「（イベント名）」
      3) 「表示セリフ（数値なし）」
  - 選択対象：eliminated=false のチームのみ
  - 効果の内部反映：
      * Aim/Mental/Agility の％効果は teamFightPower 計算時に乗算で反映
      * 効果はその試合中のみ（eventBuffsへ加算、試合終了時にリセット）
      * Treasure/Flag は result 用カウントとして保持
  - コーチスキル score_mind（プレイヤーチームのみ）：
      「お宝ゲット」を獲得したら Treasure +1 追加（合計+2）
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){

  // ===== Event Master（最新版の確定表）=====
  // weights は「%」表記だが、抽選は相対重みとして扱う（合計100である必要なし）
  // buff: { aim, mental, agi } は「%加算」（後段のteamFightPower側で乗算に変換する）
  const MASTER = [
    {
      id: 'strategy_meeting',
      name: '作戦会議',
      w: 35,
      icon: 'bup.png',
      buff: { agi: 1 },
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
      icon: 'bup.png',
      buff: { agi: 1 },
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
      icon: 'bup.png',
      buff: { aim: 1 },
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
      icon: 'bup.png',
      buff: { mental: 1 },
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
      icon: 'bup.png',
      buff: { aim: 2 },
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
      icon: 'bdeba.png',
      buff: { agi: -1 },
      lines: [
        '痛恨の判断ミス！',
        '移動で迷ってしまった..'
      ]
    },
    {
      id: 'fight',
      name: '喧嘩',
      w: 10,
      icon: 'bdeba.png',
      buff: { mental: -1 },
      lines: [
        'ムーブが噛み合わない！争ってしまった..',
        'ピンを見ていなかった..一時の言い争いだ'
      ]
    },
    {
      id: 'reload_miss',
      name: 'リロードミス',
      w: 5,
      icon: 'bdeba.png',
      buff: { aim: -2 },
      lines: [
        'リロードしていなかった！これはまずい'
      ]
    },
    {
      id: 'in_the_zone',
      name: 'ゾーンに入る',
      w: 5,
      icon: 'bup.png',
      buff: { aim: 3, mental: 3 },
      lines: [
        '全員がゾーンに入った!!優勝するぞ！',
        '全員が集中モード！終わらせよう！'
      ]
    },
    {
      id: 'champion_move',
      name: 'チャンピオンムーブ',
      w: 3,
      icon: 'bup.png',
      buff: { aim: 5, mental: 5 },
      lines: [
        'チャンピオンムーブが発動！全員覚醒モードだ！'
      ]
    },
    {
      id: 'treasure_get',
      name: 'お宝ゲット',
      w: 4,
      icon: 'bgeta.png',
      treasure: 1,
      lines: [
        'お宝をゲット！順位が有利に！'
      ]
    },
    {
      id: 'flag_get',
      name: 'フラッグゲット',
      w: 2,
      icon: 'bgetb.png',
      flag: 1,
      lines: [
        'フラッグをゲット！順位に大きく影響する！'
      ]
    }
  ];

  // ===== utils =====
  function pickWeighted(list){
    let total = 0;
    for (const e of list) total += (Number(e.w) || 0);
    let r = Math.random() * (total || 1);
    for (const e of list){
      r -= (Number(e.w) || 0);
      if (r <= 0) return e;
    }
    return list[0] || null;
  }

  function pickLine(lines){
    if (!Array.isArray(lines) || lines.length === 0) return '';
    const i = Math.floor(Math.random() * lines.length);
    return String(lines[i] ?? '');
  }

  function ensureEventBuffs(team){
    // eventBuffs は「%加算」を積む（後段のteamFightPower計算で乗算に変換する）
    if (!team.eventBuffs || typeof team.eventBuffs !== 'object'){
      team.eventBuffs = { aim: 0, mental: 0, agi: 0 };
    }else{
      if (!Number.isFinite(team.eventBuffs.aim)) team.eventBuffs.aim = 0;
      if (!Number.isFinite(team.eventBuffs.mental)) team.eventBuffs.mental = 0;
      if (!Number.isFinite(team.eventBuffs.agi)) team.eventBuffs.agi = 0;
    }
    return team.eventBuffs;
  }

  function applyEventToTeam(team, ev, ctx){
    if (!team || team.eliminated) return;

    // buffs
    const b = ensureEventBuffs(team);
    if (ev && ev.buff){
      if (Number.isFinite(ev.buff.aim)) b.aim += ev.buff.aim;
      if (Number.isFinite(ev.buff.mental)) b.mental += ev.buff.mental;
      if (Number.isFinite(ev.buff.agi)) b.agi += ev.buff.agi;
    }

    // treasure / flag
    if (ev && ev.treasure){
      let add = Number(ev.treasure) || 0;

      // ✅ score_mind：プレイヤーチームのみ
      // ctx.playerCoach.score_mind === true を想定（flow側が作る）
      if (add > 0 && team.isPlayer && ctx && ctx.playerCoach && ctx.playerCoach.score_mind){
        add += 1; // 合計+2
      }

      team.treasure = (Number(team.treasure) || 0) + add;
    }
    if (ev && ev.flag){
      const add = Number(ev.flag) || 0;
      team.flag = (Number(team.flag) || 0) + add;
    }
  }

  // ===== public: roll event for a team =====
  // 戻り値：UI表示用（3段ログ固定 + icon）
  function rollForTeam(team, round, ctx){
    if (!team || team.eliminated) return null;

    const ev = pickWeighted(MASTER);
    if (!ev) return null;

    const line = pickLine(ev.lines);

    applyEventToTeam(team, ev, ctx);

    return {
      // UI用：表示テンポ固定
      log1: 'イベント発生！',
      log2: ev.name,
      log3: line,

      // UI用：表示画像
      icon: ev.icon,

      // 内部参照用
      id: ev.id,
      name: ev.name
    };
  }

  // ===== public: reset buffs (end of match) =====
  function resetTeamMatchState(team){
    if (!team) return;
    team.eventBuffs = { aim: 0, mental: 0, agi: 0 };
    // treasure/flag は result 用に保持する設計もあり得るが、
    // 「試合終了時に必ずリセット」対象は eventBuffs と明記されているため、
    // ここでは treasure/flag は消さない（result 側が使用後にリセットする想定）。
  }

  // ===== public: expose =====
  window.MOBBR.sim.matchEvents = {
    MASTER,              // デバッグ/調整用（必要なら参照）
    rollForTeam,
    resetTeamMatchState
  };

})();
