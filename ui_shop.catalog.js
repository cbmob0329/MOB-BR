'use strict';

/*
  MOB BR - ui_shop.catalog.js v17（フル）
  - 育成アイテム購入：
    選択 → 確認 → メンバー選択 → 対象能力EXP +5 → 結果表示 → 自動でショップメニューへ戻る
  - コーチスキル購入：
    スキル選択 → 確認 → 購入完了表示（効果/セリフは表示しない）→ メニューへ戻る
  - confirm()は一切使わない（core.confirmPop/resultPopのみ）
  - 「購入できない」問題：クリック伝播停止＋modalBack制御をcoreに統一
  - ★重要：NEXT後の動的ロードでも必ず動くように init を「即実行」方式に変更
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){
  const core = window.MOBBR?.ui?.shopCore || null;
  if (!core){
    console.warn('[ui_shop.catalog] ui_shop.core.js not found');
    return;
  }

  const K = core.K;
  const DP = core.DP;

  // ===== 育成アイテム（EXP+5）=====
  const TRAINING_ITEMS = [
    { id:'hp',      stat:'hp',      label:'体力',      name:'タフネス極意の巻物', price:20000 },
    { id:'mental',  stat:'mental',  label:'メンタル',  name:'感動的な絵本',       price:10000 },
    { id:'aim',     stat:'aim',     label:'エイム',    name:'秘伝の目薬',         price:20000 },
    { id:'agi',     stat:'agi',     label:'敏捷性',    name:'カモシカのステーキ', price:10000 },
    { id:'tech',    stat:'tech',    label:'テクニック',name:'高級なそろばん',     price:10000 },
    { id:'support', stat:'support', label:'サポート',  name:'サポートディスク',   price:10000 }
  ];

  // ===== コーチスキル（購入のみ）=====
  const KEY_COACH_OWNED = 'mobbr_coachSkillsOwned';
  const COACH_SKILLS = [
    { id:'tactics_note',     name:'戦術ノート',        price:500 },
    { id:'mental_care',      name:'メンタル整備',      price:500 },
    { id:'clutch_endgame',   name:'終盤の底力',        price:800 },
    { id:'clearing',         name:'クリアリング徹底',  price:1000 },
    { id:'score_mind',       name:'スコア意識',        price:3000 },
    { id:'igl_call',         name:'IGL強化コール',      price:5000 },
    { id:'protagonist_move', name:'主人公ムーブ',      price:50000 }
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
    localStorage.setItem(key, JSON.stringify(obj || {}));
  }

  // ===== チーム読み書き（EXP/LV）=====
  function getStr(key, def){
    const v = localStorage.getItem(key);
    return (v === null || v === undefined || v === '') ? def : v;
  }

  function readPlayerTeam(){
    try{
      const raw = localStorage.getItem(K.playerTeam);
      const team = raw ? JSON.parse(raw) : null;
      if (team && Array.isArray(team.members)) return team;
    }catch(e){}

    if (DP?.buildDefaultTeam) return DP.buildDefaultTeam();

    // fallback
    return {
      members:[
        { id:'A', slot:1, name:getStr(K.m1,'A'), exp:{}, lv:{} },
        { id:'B', slot:2, name:getStr(K.m2,'B'), exp:{}, lv:{} },
        { id:'C', slot:3, name:getStr(K.m3,'C'), exp:{}, lv:{} }
      ]
    };
  }

  function writePlayerTeam(team){
    localStorage.setItem(K.playerTeam, JSON.stringify(team));
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

  function applyExpPlus(team, memberId, stat, amount){
    const mem = (team.members || []).find(m => m.id === memberId);
    if (!mem) return { lvUp:false, beforeExp:0, afterExp:0, beforeLv:1, afterLv:1 };

    mem.exp = normalizeExp(mem.exp);
    mem.lv  = normalizeLv(mem.lv);

    const beforeExp = mem.exp[stat] || 0;
    const beforeLv  = mem.lv[stat]  || 1;

    mem.exp[stat] = (mem.exp[stat] || 0) + (Number(amount) || 0);

    let lvUp = false;
    while (mem.exp[stat] >= 20){
      mem.exp[stat] -= 20;
      mem.lv[stat] += 1;
      lvUp = true;
    }

    return {
      lvUp,
      beforeExp,
      afterExp: mem.exp[stat] || 0,
      beforeLv,
      afterLv: mem.lv[stat] || 1
    };
  }

  function statLabel(stat){
    if (DP?.STAT_LABEL?.[stat]) return DP.STAT_LABEL[stat];
    const map = { hp:'体力', mental:'メンタル', aim:'エイム', agi:'敏捷性', tech:'テクニック', support:'サポート', scan:'索敵' };
    return map[stat] || stat;
  }

  function notifyTeamRender(){
    if (window.MOBBR?.ui?.team?.render) window.MOBBR.ui.team.render();
  }

  // ===== UI builders =====
  function buildList(title, rows){
    core.showDynamic(title);

    const body = document.getElementById('shopDynamicBody');
    if (!body) return;

    const list = document.createElement('div');
    list.className = 'shopList';

    rows.forEach(r=>{
      const row = document.createElement('div');
      row.className = 'shopRow';

      const left = document.createElement('div');
      left.className = 'shopRowLeft';

      const nm = document.createElement('div');
      nm.className = 'shopRowName';
      nm.textContent = r.name;

      const sub = document.createElement('div');
      sub.className = 'shopRowSub';
      sub.textContent = r.sub || '';

      left.appendChild(nm);
      if (r.sub) left.appendChild(sub);

      const right = document.createElement('div');
      right.className = 'shopRowRight';

      const price = document.createElement('div');
      price.className = 'shopPrice';
      price.textContent = `${core.fmtG(r.price)}G`;

      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'shopBuyBtn';
      btn.textContent = r.btnText || '購入';
      btn.disabled = !!r.disabled;

      btn.addEventListener('click', (e)=>{
        e.preventDefault();
        e.stopPropagation();
        r.onClick && r.onClick();
      });

      right.appendChild(price);
      right.appendChild(btn);

      row.appendChild(left);
      row.appendChild(right);
      list.appendChild(row);
    });

    body.appendChild(list);

    // 戻る（メニュー）
    const back = document.createElement('button');
    back.type = 'button';
    back.className = 'shopBuyBtn';
    back.style.marginTop = '12px';
    back.style.width = '100%';
    back.textContent = '戻る';
    back.addEventListener('click', (e)=>{
      e.preventDefault();
      e.stopPropagation();
      core.showHome();
    });
    body.appendChild(back);
  }

  // ===== 育成アイテム =====
  function openItemShop(){
    core.renderMeta();

    const rows = TRAINING_ITEMS.map(item=>{
      return {
        name: `${item.label}：${item.name}`,
        sub: '能力EXP +5',
        price: item.price,
        disabled: core.getGold() < item.price,
        btnText: '購入',
        onClick: ()=>{
          core.confirmPop(`${item.price}Gです購入しますか？`, ()=>{
            if (!core.spendGold(item.price)){
              core.resultPop('Gが足りません', '所持Gを確認してください。', ()=>{});
              return;
            }

            core.openMemberPick((memberId, memberName)=>{
              const team = readPlayerTeam();
              const r = applyExpPlus(team, memberId, item.stat, 5);
              writePlayerTeam(team);

              notifyTeamRender();
              if (window.MOBBR?.initMainUI) window.MOBBR.initMainUI();

              const lvText = r.lvUp ? `（LvUP! ${r.beforeLv}→${r.afterLv}）` : '';
              core.setRecent(`ショップ：${memberName} が ${statLabel(item.stat)}EXP +5`);

              core.resultPop(
                `${memberName} は ${statLabel(item.stat)}の能力経験値が5上がった！${lvText}`,
                `EXP ${r.beforeExp}/20 → ${r.afterExp}/20`,
                ()=>{
                  // 要件：その後メニューへ戻す
                  core.showHome();
                }
              );
            });
          });
        }
      };
    });

    // 閉じる（仕様に合わせる）
    rows.push({
      name:'閉じる',
      sub:'',
      price: 0,
      disabled:false,
      btnText:'閉じる',
      onClick: ()=> core.close()
    });

    buildList('育成アイテム', rows);
    core.setRecent('ショップ：育成アイテムを開いた');
  }

  // ===== コーチスキル =====
  function readCoachOwned(){
    return readJSON(KEY_COACH_OWNED, {});
  }
  function writeCoachOwned(obj){
    writeJSON(KEY_COACH_OWNED, obj || {});
  }

  function openCoachShop(){
    core.renderMeta();

    const owned = readCoachOwned();

    const rows = COACH_SKILLS.map(s=>{
      const cnt = Number(owned[s.id] || 0);
      return {
        name: s.name,
        sub: `所持：${cnt}`,
        price: s.price,
        disabled: core.getGold() < s.price,
        btnText: '購入',
        onClick: ()=>{
          core.confirmPop(`${s.price}Gです購入しますか？`, ()=>{
            if (!core.spendGold(s.price)){
              core.resultPop('Gが足りません', '所持Gを確認してください。', ()=>{});
              return;
            }

            const o = readCoachOwned();
            o[s.id] = (Number(o[s.id] || 0) + 1);
            writeCoachOwned(o);

            core.setRecent(`ショップ：${s.name} を購入した`);
            core.resultPop(`${s.name} を購入した！`, `所持：${o[s.id]}`, ()=>{
              // 購入後はメニューに戻す（要件）
              core.showHome();
            });
          });
        }
      };
    });

    // 閉じる
    rows.push({
      name:'閉じる',
      sub:'',
      price: 0,
      disabled:false,
      btnText:'閉じる',
      onClick: ()=> core.close()
    });

    buildList('コーチスキル', rows);
    core.setRecent('ショップ：コーチスキルを開いた');
  }

  function init(){
    core.registerCatalog({
      openItemShop,
      openCoachShop
    });
  }

  // ★ここが重要：NEXT後に動的ロードされても必ず init が動く
  if (document.readyState === 'loading'){
    document.addEventListener('DOMContentLoaded', init);
  }else{
    init();
  }
})();
