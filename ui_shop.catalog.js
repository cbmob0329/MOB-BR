'use strict';

/*
  MOB BR - ui_shop.catalog.js v17（フル / 修正版）

  修正内容：
  - 購入ボタンのクリックが確実に発火するよう保険（stopPropagation）
  - 価格に応じたdisabled判定を毎回最新Gで行う
  - 確認ポップは core 側で最前面化済み（暗いのに何も出ない対策）
*/

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){
  const core = window.MOBBR?.ui?.shopCore || null;
  if (!core){
    console.warn('[ui_shop.catalog] ui_shop.core.js not found');
    return;
  }

  const DP = core.DP || null;
  const K  = core.K;

  const KEY_COACH_SKILLS_OWNED = 'mobbr_coachSkillsOwned';

  const TRAINING_ITEMS = [
    { id:'hp',      stat:'hp',      label:'体力',       name:'タフネス極意の巻物',  price:20000 },
    { id:'mental',  stat:'mental',  label:'メンタル',   name:'感動的な絵本',        price:10000 },
    { id:'aim',     stat:'aim',     label:'エイム',     name:'秘伝の目薬',          price:20000 },
    { id:'agi',     stat:'agi',     label:'敏捷性',     name:'カモシカのステーキ',  price:10000 },
    { id:'tech',    stat:'tech',    label:'テクニック', name:'高級なそろばん',      price:10000 },
    { id:'support', stat:'support', label:'サポート',   name:'サポートディスク',    price:10000 }
  ];

  const COACH_SKILLS = [
    { id:'tactics_note',      name:'戦術ノート',        price:500   },
    { id:'mental_care',       name:'メンタル整備',      price:500   },
    { id:'clutch_endgame',    name:'終盤の底力',        price:800   },
    { id:'clearing',          name:'クリアリング徹底',  price:1000  },
    { id:'score_mind',        name:'スコア意識',        price:3000  },
    { id:'igl_call',          name:'IGL強化コール',      price:5000  },
    { id:'protagonist_move',  name:'主人公ムーブ',      price:50000 }
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

  function readPlayerTeam(){
    try{
      const raw = localStorage.getItem(K.playerTeam);
      const team = raw ? JSON.parse(raw) : null;
      if (team && Array.isArray(team.members)) return team;
    }catch(e){}
    if (DP?.buildDefaultTeam) return DP.buildDefaultTeam();
    return { members:[
      { id:'A', slot:1, name:(localStorage.getItem(K.m1)||'A'), exp:{}, lv:{} },
      { id:'B', slot:2, name:(localStorage.getItem(K.m2)||'B'), exp:{}, lv:{} },
      { id:'C', slot:3, name:(localStorage.getItem(K.m3)||'C'), exp:{}, lv:{} }
    ]};
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

  function readCoachOwned(){
    return readJSON(KEY_COACH_SKILLS_OWNED, {});
  }
  function writeCoachOwned(obj){
    writeJSON(KEY_COACH_SKILLS_OWNED, obj || {});
  }

  function makeListRow(title, sub, priceG, onBuy){
    const row = document.createElement('div');
    row.className = 'shopItemRow';
    row.style.display = 'flex';
    row.style.justifyContent = 'space-between';
    row.style.alignItems = 'center';
    row.style.gap = '10px';
    row.style.padding = '10px';
    row.style.borderRadius = '12px';
    row.style.background = 'rgba(255,255,255,.08)';
    row.style.border = '1px solid rgba(255,255,255,.12)';

    const left = document.createElement('div');
    left.style.display = 'flex';
    left.style.flexDirection = 'column';
    left.style.gap = '4px';
    left.style.minWidth = '0';

    const t = document.createElement('div');
    t.style.fontWeight = '1000';
    t.style.fontSize = '14px';
    t.style.whiteSpace = 'nowrap';
    t.style.overflow = 'hidden';
    t.style.textOverflow = 'ellipsis';
    t.textContent = title;

    left.appendChild(t);

    if (sub){
      const s = document.createElement('div');
      s.style.fontSize = '12px';
      s.style.opacity = '0.9';
      s.textContent = sub;
      left.appendChild(s);
    }

    const right = document.createElement('div');
    right.style.display = 'flex';
    right.style.flexDirection = 'column';
    right.style.alignItems = 'flex-end';
    right.style.gap = '6px';

    const p = document.createElement('div');
    p.style.fontWeight = '1000';
    p.textContent = `${core.fmtG(priceG)}G`;

    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'saveBtn';
    btn.style.padding = '10px 12px';
    btn.style.fontWeight = '1000';
    btn.textContent = '購入';

    // ★毎回最新の所持Gで判定
    btn.disabled = (core.getGold() < priceG);

    btn.addEventListener('click', (e)=>{
      e.preventDefault();
      e.stopPropagation();
      onBuy();
    });

    right.appendChild(p);
    right.appendChild(btn);

    row.appendChild(left);
    row.appendChild(right);
    return row;
  }

  function makeCloseRow(onClose){
    const wrap = document.createElement('div');
    wrap.style.marginTop = '12px';
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'closeBtn';
    btn.textContent = '閉じる';
    btn.addEventListener('click', (e)=>{
      e.preventDefault();
      e.stopPropagation();
      onClose();
    });
    wrap.appendChild(btn);
    return wrap;
  }

  function openItemShop(){
    core.renderMeta();
    core.showDynamic('育成アイテム');

    const body = document.getElementById('shopDynamicBody');
    if (!body) return;

    const list = document.createElement('div');
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '10px';

    TRAINING_ITEMS.forEach(item=>{
      list.appendChild(makeListRow(
        `${item.label}：${item.name}`,
        `対象能力EXP +5`,
        item.price,
        ()=>{
          core.confirmPop(`${item.price}Gです購入しますか？`, ()=>{
            if (!core.spendGold(item.price)){
              core.resultPop('Gが足りません。', '所持Gを確認してください。', ()=>{});
              return;
            }

            core.openMemberPick((memberId, memberName)=>{
              const team = readPlayerTeam();
              const r = applyExpPlus(team, memberId, item.stat, 5);
              writePlayerTeam(team);

              if (window.MOBBR?.ui?.team?.render) window.MOBBR.ui.team.render();
              if (window.MOBBR?.initMainUI) window.MOBBR.initMainUI();

              core.setRecent(`ショップ：${memberName} が ${item.label}EXP +5 を得た`);

              const lvText = r.lvUp ? `（LvUP! ${r.beforeLv}→${r.afterLv}）` : '';
              core.resultPop(
                `${memberName} は ${item.label}の能力経験値が5上がった！${lvText}`,
                `EXP ${r.beforeExp}/20 → ${r.afterExp}/20`,
                ()=>{
                  // B：ショップ自体を閉じる
                  core.close();
                }
              );
            });
          });
        }
      ));
    });

    body.appendChild(list);
    body.appendChild(makeCloseRow(()=> core.showHome()));

    core.setRecent('ショップ：育成アイテムを開いた');
  }

  function openCoachShop(){
    core.renderMeta();
    core.showDynamic('コーチスキル');

    const body = document.getElementById('shopDynamicBody');
    if (!body) return;

    const owned = readCoachOwned();

    const list = document.createElement('div');
    list.style.display = 'flex';
    list.style.flexDirection = 'column';
    list.style.gap = '10px';

    COACH_SKILLS.forEach(skill=>{
      const cnt = Number(owned[skill.id]) || 0;

      list.appendChild(makeListRow(
        `${skill.name}`,
        `所持：${cnt}`,
        skill.price,
        ()=>{
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
              `${skill.name} を購入した！`,
              `所持：${o[skill.id]}`,
              ()=>{
                // 一覧を更新して続行
                openCoachShop();
              }
            );
          });
        }
      ));
    });

    body.appendChild(list);
    body.appendChild(makeCloseRow(()=> core.showHome()));

    core.setRecent('ショップ：コーチスキルを開いた');
  }

  core.registerCatalog({
    openItemShop,
    openCoachShop
  });
})();
