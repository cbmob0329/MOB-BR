'use strict';

/*
  MOB BR - ui_shop.catalog.js v17（フル）
  - 育成アイテム購入（EXP+5）
  - コーチスキル購入（所持だけ増やす。装備は後日チーム画面）
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){
  const core = window.MOBBR?.ui?.shopCore;
  if (!core){
    console.warn('[ui_shop.catalog] shopCore not found');
    return;
  }

  const DP = core.DP;

  // ===== keys =====
  const KEY_COACH_SKILLS_OWNED = 'mobbr_coachSkillsOwned';

  // ===== training items =====
  const TRAINING_ITEMS = [
    { id:'hp',      stat:'hp',      name:'タフネス極意の巻物', price:20000, desc:'体力のEXP +5' },
    { id:'mental',  stat:'mental',  name:'感動的な絵本',       price:10000, desc:'メンタルのEXP +5' },
    { id:'aim',     stat:'aim',     name:'秘伝の目薬',         price:20000, desc:'エイムのEXP +5' },
    { id:'agi',     stat:'agi',     name:'カモシカのステーキ', price:10000, desc:'敏捷性のEXP +5' },
    { id:'tech',    stat:'tech',    name:'高級なそろばん',     price:10000, desc:'テクニックのEXP +5' },
    { id:'support', stat:'support', name:'サポートディスク',   price:10000, desc:'サポートのEXP +5' }
  ];

  // ===== coach skills =====
  const COACH_SKILLS = [
    { id:'tactics_note', name:'戦術ノート', price:500,
      effectReal:'総合戦闘力に +1%', effectShow:'この試合、総合戦闘力が1%アップする', quote:'基本を徹底。丁寧に戦おう！' },
    { id:'mental_care', name:'メンタル整備', price:500,
      effectReal:'イベントのマイナス系（喧嘩／仲間割れ）発生率 -30%', effectShow:'この試合、チームの雰囲気が安定する', quote:'全員で勝つぞ！' },
    { id:'clutch_endgame', name:'終盤の底力', price:800,
      effectReal:'R5とR6の総合戦闘力に +3%（終盤だけ）', effectShow:'この試合、終盤の勝負で総合戦闘力が3%アップする', quote:'終盤一気に押すぞ！' },
    { id:'clearing', name:'クリアリング徹底', price:1000,
      effectReal:'勝者デスボックス抽選を軽減（0人寄り）', effectShow:'この試合、ファイトに勝った後に人数が残りやすい', quote:'周辺をしっかり見ろ！' },
    { id:'score_mind', name:'スコア意識', price:3000,
      effectReal:'お宝/フラッグイベントの発生率 +15%', effectShow:'この試合、お宝やフラッグを取りやすい', quote:'この試合はポイント勝負だ！' },
    { id:'igl_call', name:'IGL強化コール', price:5000,
      effectReal:'総合戦闘力に +4%', effectShow:'この試合、総合戦闘力が4%アップする', quote:'コールを信じろ！チャンピオン取るぞ！' },
    { id:'protagonist_move', name:'主人公ムーブ', price:50000,
      effectReal:'勝率補正 +6%／アシスト発生率 +15%', effectShow:'この試合、総合戦闘力が6%アップし、アシストも出やすくなる', quote:'チームの力を信じろ！' }
  ];

  function readJSON(key, def){
    try{
      const raw = localStorage.getItem(key);
      return raw ? JSON.parse(raw) : def;
    }catch{
      return def;
    }
  }
  function writeJSON(key, obj){
    localStorage.setItem(key, JSON.stringify(obj));
  }

  // ===== team read/write =====
  function readPlayerTeam(){
    try{
      const raw = localStorage.getItem(core.K.playerTeam);
      const team = raw ? JSON.parse(raw) : null;
      if (team && Array.isArray(team.members)) return team;
    }catch(e){}
    if (DP?.buildDefaultTeam) return DP.buildDefaultTeam();
    return { members:[
      { id:'A', slot:1, name:localStorage.getItem(core.K.m1)||'A', exp:{}, lv:{} },
      { id:'B', slot:2, name:localStorage.getItem(core.K.m2)||'B', exp:{}, lv:{} },
      { id:'C', slot:3, name:localStorage.getItem(core.K.m3)||'C', exp:{}, lv:{} }
    ]};
  }
  function writePlayerTeam(team){
    localStorage.setItem(core.K.playerTeam, JSON.stringify(team));
  }

  function normalizeExp(exp){
    if (DP?.normalizeExp) return DP.normalizeExp(exp);
    const keys = ['hp','mental','aim','agi','tech','support','scan'];
    const out = {};
    keys.forEach(k=> out[k] = Number(exp?.[k]) || 0);
    return out;
  }
  function normalizeLv(lv){
    if (DP?.normalizeLv) return DP.normalizeLv(lv);
    const keys = ['hp','mental','aim','agi','tech','support','scan'];
    const out = {};
    keys.forEach(k=> out[k] = Math.max(1, Number(lv?.[k]) || 1));
    return out;
  }

  function statLabel(stat){
    return DP?.STAT_LABEL?.[stat] || ({
      hp:'体力', mental:'メンタル', aim:'エイム', agi:'敏捷性', tech:'テクニック', support:'サポート', scan:'索敵'
    }[stat] || stat);
  }

  function applyExpPlus(team, memberId, stat, amount){
    const amt = Number(amount) || 0;
    const mem = (team.members || []).find(m => m.id === memberId);
    if (!mem) return { lvUp:false, beforeExp:0, afterExp:0, beforeLv:1, afterLv:1 };

    mem.exp = normalizeExp(mem.exp);
    mem.lv  = normalizeLv(mem.lv);

    const beforeExp = mem.exp[stat] || 0;
    const beforeLv  = mem.lv[stat]  || 1;

    mem.exp[stat] = (mem.exp[stat] || 0) + amt;

    let lvUp = false;
    while (mem.exp[stat] >= 20){
      mem.exp[stat] -= 20;
      mem.lv[stat] += 1;
      lvUp = true;
    }

    const afterExp = mem.exp[stat] || 0;
    const afterLv  = mem.lv[stat]  || 1;

    return { lvUp, beforeExp, afterExp, beforeLv, afterLv };
  }

  // ===== item shop =====
  function openItemShop(){
    core.hideGachaSection();
    core.showDynamicSection('育成アイテム購入');

    const body = document.getElementById('shopDynamicBody');
    if (!body) return;

    body.innerHTML = '';

    const list = document.createElement('div');
    list.className = 'shopList';

    TRAINING_ITEMS.forEach(item=>{
      const row = document.createElement('div');
      row.className = 'shopItemRow';

      const left = document.createElement('div');
      left.className = 'shopItemLeft';

      const name = document.createElement('div');
      name.className = 'shopItemName';
      name.textContent = `${statLabel(item.stat)}：${item.name}`;

      const desc = document.createElement('div');
      desc.className = 'shopItemDesc';
      desc.textContent = item.desc;

      left.appendChild(name);
      left.appendChild(desc);

      const right = document.createElement('div');
      right.className = 'shopItemRight';

      const price = document.createElement('div');
      price.className = 'shopPrice';
      price.textContent = `${core.fmtG(item.price)}G`;

      const buy = document.createElement('button');
      buy.type = 'button';
      buy.className = 'shopBuyBtn';
      buy.textContent = '購入';
      buy.disabled = (core.getGold() < item.price);

      buy.addEventListener('click', ()=>{
        core.confirmPop(`${item.price}Gです購入しますか？`, ()=>{
          if (!core.spendGold(item.price)){
            core.resultPop('Gが足りません。', '所持Gを確認してください。', ()=>{});
            return;
          }

          core.openMemberPick((memberId, memName)=>{
            const team = readPlayerTeam();
            const r = applyExpPlus(team, memberId, item.stat, 5);
            writePlayerTeam(team);

            if (window.MOBBR?.ui?.team?.render) window.MOBBR.ui.team.render();
            if (window.MOBBR?.initMainUI) window.MOBBR.initMainUI();

            core.setRecent(`ショップ：${memName} が ${statLabel(item.stat)}EXP +5 を得た`);

            const lvText = r.lvUp ? `（LvUP! ${r.beforeLv}→${r.afterLv}）` : '';
            core.resultPop(
              `${memName} は ${statLabel(item.stat)}の能力経験値が5上がった！${lvText}`,
              `EXP ${r.beforeExp}/20 → ${r.afterExp}/20`,
              ()=>{
                // 要件：その後メニューを閉じる（＝ショップを閉じる）
                core.close();
              }
            );
          });
        });
      });

      right.appendChild(price);
      right.appendChild(buy);

      row.appendChild(left);
      row.appendChild(right);

      list.appendChild(row);
    });

    body.appendChild(list);

    const note = document.createElement('div');
    note.className = 'shopTiny';
    note.textContent = '※購入後、使用するメンバーを選択します。選んだメンバーの対象能力EXPが+5されます。';
    body.appendChild(note);

    core.setRecent('ショップ：育成アイテム購入を開いた');
  }

  // ===== coach shop =====
  function readCoachOwned(){ return readJSON(KEY_COACH_SKILLS_OWNED, {}); }
  function writeCoachOwned(obj){ writeJSON(KEY_COACH_SKILLS_OWNED, obj || {}); }

  function openCoachShop(){
    core.hideGachaSection();
    core.showDynamicSection('コーチスキル購入（購入のみ）');

    const body = document.getElementById('shopDynamicBody');
    if (!body) return;

    body.innerHTML = '';

    const owned = readCoachOwned();
    const list = document.createElement('div');
    list.className = 'shopList';

    COACH_SKILLS.forEach(skill=>{
      const row = document.createElement('div');
      row.className = 'shopItemRow coachSkillRow';

      const left = document.createElement('div');
      left.className = 'shopItemLeft';

      const top = document.createElement('div');
      top.className = 'coachSkillTop';

      const name = document.createElement('div');
      name.className = 'coachSkillName';
      name.textContent = skill.name;

      const meta = document.createElement('div');
      meta.className = 'coachSkillMeta';
      meta.textContent = `所持：${Number(owned[skill.id]) || 0}`;

      top.appendChild(name);
      top.appendChild(meta);

      const eff = document.createElement('div');
      eff.className = 'coachSkillEffects';
      eff.textContent = `表示効果：${skill.effectShow}\n実際の効果：${skill.effectReal}`;

      const quote = document.createElement('div');
      quote.className = 'coachSkillQuote';
      quote.textContent = `コーチのセリフ：「${skill.quote}」`;

      left.appendChild(top);
      left.appendChild(eff);
      left.appendChild(quote);

      const right = document.createElement('div');
      right.className = 'shopItemRight';

      const price = document.createElement('div');
      price.className = 'shopPrice';
      price.textContent = `${core.fmtG(skill.price)}G`;

      const buy = document.createElement('button');
      buy.type = 'button';
      buy.className = 'shopBuyBtn';
      buy.textContent = '購入';
      buy.disabled = (core.getGold() < skill.price);

      buy.addEventListener('click', ()=>{
        core.confirmPop(`${skill.price}Gです購入しますか？`, ()=>{
          if (!core.spendGold(skill.price)){
            core.resultPop('Gが足りません。', '所持Gを確認してください。', ()=>{});
            return;
          }

          const o = readCoachOwned();
          o[skill.id] = (Number(o[skill.id]) || 0) + 1;
          writeCoachOwned(o);

          core.setRecent(`ショップ：コーチスキル「${skill.name}」を購入した`);
          core.resultPop(
            `「${skill.name}」を購入しました！`,
            `所持：${o[skill.id]}`,
            ()=>{
              // 自動で閉じない（要件：購入のみ）
              openCoachShop();
            }
          );
        });
      });

      right.appendChild(price);
      right.appendChild(buy);

      row.appendChild(left);
      row.appendChild(right);

      list.appendChild(row);
    });

    body.appendChild(list);

    const note = document.createElement('div');
    note.className = 'shopTiny';
    note.textContent = '※装備・有効化は後日「チーム画面」で実装します（ここでは所持だけ増えます）。';
    body.appendChild(note);

    core.setRecent('ショップ：コーチスキル購入を開いた');
  }

  // register
  core.registerCatalog({ openItemShop, openCoachShop });
})();
