'use strict';

/*
  sim_match_events.js v2（フル）
  - 重み抽選
  - 同ラウンド重複なし
  - eliminated除外
  - eventBuffsへ内部加算（%はログ非表示）
  - Treasure / Flag 加算
  - score_mind（コーチフラグ）対応：Treasure取得時 +1 追加
  - 返却形式：{ icon, log1, log2, log3 }（tournament_core互換）
  - アイコン画像は直下：bup.png / bdeba.png / bgeta.png / bgetb.png
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.sim = window.MOBBR.sim || {};

(function(){

  const ICON_UP   = 'bup.png';
  const ICON_DEB  = 'bdeba.png';
  const ICON_TRE  = 'bgeta.png';
  const ICON_FLAG = 'bgetb.png';

  function clamp(n, lo, hi){
    const v = Number(n);
    if (!Number.isFinite(v)) return lo;
    return Math.max(lo, Math.min(hi, v));
  }

  function ensureShape(team){
    if (!team) return;
    if (!team.eventBuffs || typeof team.eventBuffs !== 'object'){
      team.eventBuffs = { aim:0, mental:0, agi:0 };
    }else{
      if (!Number.isFinite(Number(team.eventBuffs.aim))) team.eventBuffs.aim = 0;
      if (!Number.isFinite(Number(team.eventBuffs.mental))) team.eventBuffs.mental = 0;
      if (!Number.isFinite(Number(team.eventBuffs.agi))) team.eventBuffs.agi = 0;
    }
    if (!team._eventHistory || typeof team._eventHistory !== 'object'){
      team._eventHistory = {};
    }
    if (!Number.isFinite(Number(team.treasure))) team.treasure = 0;
    if (!Number.isFinite(Number(team.flag))) team.flag = 0;
  }

  const EVENTS = [
    // ====== UP系 ======
    {
      id:'tactics',
      weight:35,
      icon:ICON_UP,
      name:'作戦会議',
      apply:(t)=>{ t.eventBuffs.agi += 1; },
      lines:[
        '次の戦闘に向けて作戦会議！連携力がアップした！',
        'ここで作戦会議！連携力アップ！',
        '次の移動について作戦会議！連携がアップ！'
      ]
    },
    {
      id:'supply',
      weight:35,
      icon:ICON_UP,
      name:'物資交換',
      apply:(t)=>{ t.eventBuffs.agi += 1; },
      lines:[
        '物資をお互いに交換！連携力がアップした！',
        '物資を交換した！連携力アップ！',
        '物資をチェックし、準備万端！連携がアップ！'
      ]
    },
    {
      id:'circle',
      weight:35,
      icon:ICON_UP,
      name:'円陣',
      apply:(t)=>{ t.eventBuffs.aim += 1; },
      lines:[
        '円陣を組んだ！ファイト力アップ！',
        '絶対勝つぞ！円陣で気合い注入！',
        '円陣によりファイト力アップ！'
      ]
    },
    {
      id:'search',
      weight:35,
      icon:ICON_UP,
      name:'冷静な索敵',
      apply:(t)=>{ t.eventBuffs.mental += 1; },
      lines:[
        '落ち着いて索敵！次の戦闘は先手を取れそうだ！',
        'それぞれが索敵！戦闘に備える！',
        '敵発見！さあどう動く！'
      ]
    },
    {
      id:'rare',
      weight:10,
      icon:ICON_UP,
      name:'レア武器ゲット',
      apply:(t)=>{ t.eventBuffs.aim += 2; },
      lines:[
        'レア武器をゲット！戦闘が有利に！',
        'これは..レア武器発見！やったね！',
        'レア武器を拾った！一気に押していこう！'
      ]
    },

    // ====== DEBUFF ======
    {
      id:'mistake',
      weight:15,
      icon:ICON_DEB,
      name:'判断ミス',
      apply:(t)=>{ t.eventBuffs.agi -= 1; },
      lines:[
        '痛恨の判断ミス！',
        '移動で迷ってしまった..'
      ]
    },
    {
      id:'fight',
      weight:10,
      icon:ICON_DEB,
      name:'喧嘩',
      apply:(t)=>{ t.eventBuffs.mental -= 1; },
      lines:[
        'ムーブが噛み合わない！争ってしまった..',
        'ピンを見ていなかった..一時の言い争いだ'
      ]
    },
    {
      id:'reload',
      weight:5,
      icon:ICON_DEB,
      name:'リロードミス',
      apply:(t)=>{ t.eventBuffs.aim -= 2; },
      lines:[
        'リロードしていなかった！これはまずい'
      ]
    },

    // ====== 超UP ======
    {
      id:'zone',
      weight:5,
      icon:ICON_UP,
      name:'ゾーンに入る',
      apply:(t)=>{
        t.eventBuffs.aim += 3;
        t.eventBuffs.mental += 3;
      },
      lines:[
        '全員がゾーンに入った!!優勝するぞ！',
        '全員が集中モード！終わらせよう！'
      ]
    },
    {
      id:'champion',
      weight:3,
      icon:ICON_UP,
      name:'チャンピオンムーブ',
      apply:(t)=>{
        t.eventBuffs.aim += 5;
        t.eventBuffs.mental += 5;
      },
      lines:[
        'チャンピオンムーブが発動！全員覚醒モードだ！'
      ]
    },

    // ====== ポイント系 ======
    {
      id:'treasure',
      weight:4,
      icon:ICON_TRE,
      name:'お宝ゲット',
      apply:(t, ctx)=>{
        t.treasure += 1;
        if (ctx?.playerCoach?.score_mind){
          t.treasure += 1; // 合計+2
        }
      },
      lines:[
        'お宝をゲット！順位が有利に！'
      ]
    },
    {
      id:'flag',
      weight:2,
      icon:ICON_FLAG,
      name:'フラッグゲット',
      apply:(t)=>{
        t.flag += 1;
      },
      lines:[
        'フラッグをゲット！順位に大きく影響する！'
      ]
    }
  ];

  function weightedPick(pool){
    const total = pool.reduce((s,e)=>s + (e.weight||0), 0);
    let r = Math.random() * Math.max(1, total);
    for (const e of pool){
      r -= (e.weight||0);
      if (r <= 0) return e;
    }
    return pool[pool.length - 1];
  }

  function rollForTeam(team, round, ctx){
    if (!team || team.eliminated) return null;

    ensureShape(team);

    const r = clamp(round, 1, 6);
    const usedSet = team._eventHistory[r] || new Set();

    const pool = EVENTS.filter(e => !usedSet.has(e.id));
    if (pool.length === 0) return null;

    const ev = weightedPick(pool);

    if (!team._eventHistory[r]) team._eventHistory[r] = new Set();
    team._eventHistory[r].add(ev.id);

    ev.apply(team, ctx);

    const line = ev.lines[(Math.random() * ev.lines.length) | 0] || '';
    return {
      icon: ev.icon,
      log1: 'イベント発生！',
      log2: `（${ev.name}）`,
      log3: line
    };
  }

  function resetTeamMatchState(team){
    if (!team) return;
    team.eventBuffs = { aim:0, mental:0, agi:0 };
    team._eventHistory = {};
  }

  window.MOBBR.sim.matchEvents = {
    rollForTeam,
    resetTeamMatchState
  };

})();
