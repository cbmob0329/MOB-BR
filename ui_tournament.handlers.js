'use strict';

/* =========================================================
   ui_tournament.handlers.js（v3.6.17 split-2）FULL
   - 各 handleShow*** / buildTable 系
   - ✅変更:
     1) SKIPボタン/スキップ確認ロジックを完全廃止
     2) コーチスキルは「現状使わない」ため UIを廃止（選択させない）
        ※ flow 側の仕組みは壊さず、UIだけ無効化（将来の交戦スキル追加に備える）

   ✅ v3.6.12 変更（UI側）
   - FIX: 試合resultに currentOverall を “同じパネル内に混在表示” しない（分離）
   - ADD: 総合resultで「通過ライン色分け」
          Local上位10 / National上位8 / LastChance上位2 / WORLD予選上位10 / Losers上位10
   - ADD: WORLD FINALは「80pt点灯チーム」を色分け（state.worldFinalMP.litAtMatch）
   - 既存: 敵画像候補の生成で “空 → P1.png” に落ちない（coreの guessEnemyImageCandidates）

   ✅ v3.6.12 hotfix
   - FIX: handleEndTournament / handleEndNationalWeek が UIを閉じるだけで
          app.js の mobbr:goMain 経由週進行が走らないケースがあるため、
          ここで mobbr:goMain を必ず投げる（advanceWeeks を payload 優先、無ければ 1）

   ✅ v3.6.13 追加
   - ADD: 総合RESULTに「賞金 / 企業ランクUP」を表示
          state.lastTournamentReward を優先し、無い場合は tournamentResult.getTournamentReward(mode, rank) で補完

   ✅ v3.6.16 追加
   - ADD: ローカル / ナショナル / ラストチャンス / WORLD（予選 / losers / final）
          の到着演出・結果演出メッセージを強化
   - ADD: 総合RESULT下に大会ごとの結果メッセージBOXを追加
   - ADD: WORLD FINAL優勝時はメンバー名も表示

   ✅ v3.6.17 追加（今回）
   - FIX: MATCH1終了直後など「途中の総合RESULT」で
          報酬BOX / 大会結果コメントBOX が出てしまう問題を修正
   - ADD: 報酬BOX / 大会結果コメントBOX は
          “その大会 or フェーズの区切り結果画面” のときだけ表示
========================================================= */

window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};

(function(){

  const MOD = window.MOBBR.ui._tournamentMod;
  if (!MOD){
    console.error('[ui_tournament.handlers] core module missing');
    return;
  }

  const {
    TOURNEY_BACKDROP, ASSET, BATTLE_CHAT,

    getFlow, getState,
    sleep, shuffle,

    lockUI, unlockUI,

    setChampionMode, setResultStampMode,
    hidePanels, hideSplash,
    setEventIcon, showCenterStamp,
    resetEncounterGate, clearHold, setHold,
    setBattleMode,

    setBackdrop, setSquareBg, setChars, setNames, setNamesRich,
    setBanners, setLines,
    showSplash, showPanel, escapeHtml,
    syncSessionBar,
    preloadEventIcons,
    guessPlayerImageCandidates,
    guessEnemyImageCandidates,
    guessTeamImageCandidates,
    resolveFirstExisting,

    getMatchTotalFromState
  } = MOD;

  // =========================================================
  // ✅ app.js 責務（週進行/メイン復帰）へ必ず戻すヘルパ
  // =========================================================
  function dispatchGoMainFromPayload(payload, fallbackAdvanceWeeks){
    const p = payload && typeof payload === 'object' ? payload : {};
    const adv = Number(p.advanceWeeks ?? p.weeks ?? fallbackAdvanceWeeks ?? 1);
    const advanceWeeks = Math.max(0, Number.isFinite(adv) ? (adv|0) : 1);

    const detail = Object.assign({}, p, { advanceWeeks });

    try{
      window.dispatchEvent(new CustomEvent('mobbr:goMain', { detail }));
      return true;
    }catch(e){
      console.error('[ui_tournament.handlers] dispatch mobbr:goMain failed:', e);
      return false;
    }
  }

  function pickChats(n){
    const a = shuffle(BATTLE_CHAT);
    const out = a.slice(0, Math.max(1, n|0));
    if (out.length >= 6){
      const idx = 3 + ((Math.random()*3)|0);
      out[idx] = 'ウルト行くぞ！';
    }
    return out;
  }

  function buildTeamListTable(teams){
    const wrap = document.createElement('div');
    wrap.className = 'teamListWrap';

    const table = document.createElement('table');
    table.className = 'teamTable';
    table.innerHTML = `
      <thead>
        <tr>
          <th>TEAM</th>
          <th class="num">POWER</th>
          <th class="num">ALIVE</th>
          <th class="num">TRE</th>
          <th class="num">FLG</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tb = table.querySelector('tbody');

    (teams||[]).forEach(t=>{
      const tr = document.createElement('tr');
      if (t.isPlayer) tr.classList.add('isPlayer');
      tr.innerHTML = `
        <td>${escapeHtml(t.name || t.id || '')}</td>
        <td class="num">${escapeHtml(String(t.power ?? ''))}</td>
        <td class="num">${escapeHtml(String(t.alive ?? ''))}</td>
        <td class="num">${escapeHtml(String(t.treasure ?? 0))}</td>
        <td class="num">${escapeHtml(String(t.flag ?? 0))}</td>
      `;
      tb.appendChild(tr);
    });

    wrap.appendChild(table);
    return wrap;
  }

  function buildCurrentOverallTable(rows){
    const wrap = document.createElement('div');
    wrap.className = 'overallWrap';

    const table = document.createElement('table');
    table.className = 'tourneyTable';
    table.innerHTML = `
      <thead>
        <tr>
          <th>RANK</th>
          <th>TEAM</th>
          <th class="num">PT</th>
          <th class="num">PP</th>
          <th class="num">K</th>
          <th class="num">A</th>
          <th class="num">TRE</th>
          <th class="num">FLG</th>
        </tr>
      </thead>
      <tbody></tbody>
    `;
    const tb = table.querySelector('tbody');

    (rows||[]).forEach((r,i)=>{
      const tr = document.createElement('tr');
      const isPlayer = (String(r.id||'') === 'PLAYER') || !!r.isPlayer;
      if (isPlayer) tr.classList.add('isPlayer');

      tr.innerHTML = `
        <td>${escapeHtml(String(i+1))}</td>
        <td>${escapeHtml(String(r.name || r.squad || r.id || ''))}</td>
        <td class="num">${escapeHtml(String(r.total ?? 0))}</td>
        <td class="num">${escapeHtml(String(r.placementP ?? 0))}</td>
        <td class="num">${escapeHtml(String(r.kp ?? 0))}</td>
        <td class="num">${escapeHtml(String(r.ap ?? 0))}</td>
        <td class="num">${escapeHtml(String(r.treasure ?? 0))}</td>
        <td class="num">${escapeHtml(String(r.flag ?? 0))}</td>
      `;
      tb.appendChild(tr);
    });

    wrap.appendChild(table);
    return wrap;
  }

  function findChampionTeam(state, payload){
    const teams = Array.isArray(state?.teams) ? state.teams : [];
    const name = String(payload?.championName || payload?.line2 || '').trim();

    let t = null;

    if (payload?.championTeamId){
      const id = String(payload.championTeamId);
      t = teams.find(x=>String(x?.id||'') === id) || null;
      if (t) return t;
    }

    if (name){
      t = teams.find(x=>String(x?.name||'') === name) || null;
      if (t) return t;

      t = teams.find(x=>String(x?.name||'').includes(name)) || null;
      if (t) return t;
    }

    return null;
  }

  // =========================================================
  // 共通 helper
  // =========================================================
  function normMode(st){
    return String(st?.mode || '').trim().toLowerCase();
  }

  function normWorldPhase(st){
    return String(st?.worldPhase || st?.world?.phase || st?.phase || '').trim().toLowerCase();
  }

  function getPlayerRankFromTotalRows(totalArr){
    const arr = Array.isArray(totalArr) ? totalArr : [];
    const idx = arr.findIndex(r => String(r?.id || '') === 'PLAYER');
    return idx >= 0 ? (idx + 1) : 0;
  }

  function getPlayerRankFromPayloadRows(rows){
    const arr = Array.isArray(rows) ? rows : [];
    const row = arr.find(r => String(r?.id || '') === 'PLAYER');
    if (!row) return 0;
    const p = Number(row.placement ?? row.Placement ?? 0);
    return Number.isFinite(p) ? p : 0;
  }

  function getPlayerTeamName(st){
    try{
      const p = (st?.teams || []).find(x => String(x?.id || '') === 'PLAYER');
      if (p?.name) return String(p.name);
    }catch(_){}
    try{
      const defs = st?.national?.allTeamDefs;
      if (defs?.PLAYER?.name) return String(defs.PLAYER.name);
    }catch(_){}
    try{
      const raw = localStorage.getItem('mobbr_playerTeam');
      if (raw){
        const obj = JSON.parse(raw);
        const n = String(obj?.teamName || '').trim();
        if (n) return n;
      }
    }catch(_){}
    try{
      const n = String(localStorage.getItem('mobbr_team') || '').trim();
      if (n) return n;
    }catch(_){}
    return 'PLAYER TEAM';
  }

  function getPlayerMemberNames(st){
    const fallback = ['A','B','C'];

    try{
      const p = (st?.teams || []).find(x => String(x?.id || '') === 'PLAYER');
      if (Array.isArray(p?.members) && p.members.length >= 3){
        return [
          String(p.members[0]?.name || fallback[0]),
          String(p.members[1]?.name || fallback[1]),
          String(p.members[2]?.name || fallback[2]),
        ];
      }
    }catch(_){}

    try{
      const defs = st?.national?.allTeamDefs;
      const p = defs?.PLAYER;
      if (Array.isArray(p?.members) && p.members.length >= 3){
        return [
          String(p.members[0]?.name || fallback[0]),
          String(p.members[1]?.name || fallback[1]),
          String(p.members[2]?.name || fallback[2]),
        ];
      }
    }catch(_){}

    try{
      const raw = localStorage.getItem('mobbr_playerTeam');
      if (raw){
        const obj = JSON.parse(raw);
        const members = Array.isArray(obj?.members) ? obj.members : [];
        const a = members.find(x => String(x?.id || '') === 'A');
        const b = members.find(x => String(x?.id || '') === 'B');
        const c = members.find(x => String(x?.id || '') === 'C');
        return [
          String(a?.name || fallback[0]),
          String(b?.name || fallback[1]),
          String(c?.name || fallback[2]),
        ];
      }
    }catch(_){}

    return fallback.slice();
  }

  function buildArrivalLinesByState(st){
    const mode = normMode(st);
    const wp = normWorldPhase(st);

    if (mode === 'local'){
      return {
        line1: 'いよいよ今シーズンのローカル大会が開幕！',
        line2: '10位までに入ればナショナル大会へ！',
        line3: '1戦1戦大事にしよう！'
      };
    }

    if (mode === 'national'){
      return {
        line1: 'ナショナル大会が開幕！',
        line2: '上位8チームがワールドファイナルへ！',
        line3: '全国の猛者と決戦だ！'
      };
    }

    if (mode === 'lastchance'){
      return {
        line1: 'ラストチャンスが開幕！',
        line2: 'ナショナル9位〜28位が闘志を燃やす！',
        line3: '1位か2位でワールドファイナルへ進出出来る！ 全部出し切るぞ！'
      };
    }

    if (mode === 'world'){
      if (wp === 'losers'){
        return {
          line1: 'ワールドファイナル losers 開幕！',
          line2: 'ここで負ければ終わり、上位10だけが決勝へ！',
          line3: 'まだまだ諦めないで！'
        };
      }
      if (wp === 'final'){
        return {
          line1: 'いよいよワールドファイナル決勝！',
          line2: '80ポイントで点灯し、点灯状態のチャンピオンで優勝！',
          line3: '試合は最大12試合続きます！'
        };
      }
      return {
        line1: 'ワールドファイナル開幕！',
        line2: 'とうとう来たね世界大会。まずは予選リーグ突破を目指して頑張ろう！',
        line3: '予選リーグは上位10チームが決勝確定！ 11〜30位はlosersへ / 31位以下は敗退！'
      };
    }

    return {
      line1: '大会会場へ到着！',
      line2: '観客の熱気が一気に押し寄せる…！',
      line3: 'NEXTで開幕演出へ'
    };
  }

  function buildIntroLinesByState(st){
    const mode = normMode(st);
    const wp = normWorldPhase(st);

    if (mode === 'local'){
      return {
        line1: 'ローカル大会開幕！',
        line2: 'ここからシーズンの第一歩！',
        line3: 'NEXTでチーム紹介'
      };
    }

    if (mode === 'national'){
      return {
        line1: 'ナショナル大会開幕！',
        line2: '上位8チームが世界へ！',
        line3: 'NEXTでチーム紹介'
      };
    }

    if (mode === 'lastchance'){
      return {
        line1: 'ラストチャンス開幕！',
        line2: '狙うはたった2枠！',
        line3: 'NEXTでチーム紹介'
      };
    }

    if (mode === 'world'){
      if (wp === 'qual'){
        return {
          line1: 'ワールドファイナル予選 開幕！',
          line2: '上位10チームが決勝確定！',
          line3: 'NEXTでチーム紹介'
        };
      }
      if (wp === 'losers'){
        return {
          line1: 'losers 開幕！',
          line2: '上位10が決勝へ進出！',
          line3: 'NEXTでチーム紹介'
        };
      }
      if (wp === 'final'){
        return {
          line1: 'FINAL ROUND 開始！',
          line2: '点灯状態のチャンピオンで世界一！',
          line3: 'NEXTでチーム紹介'
        };
      }
    }

    return {
      line1: 'ローカル大会開幕！',
      line2: '本日の戦場へ——',
      line3: 'NEXTでチーム紹介'
    };
  }

  // =========================================================
  // ✅ 「この総合RESULTが途中経過か / 区切り結果か」を判定
  // =========================================================
  function isStageEndTournamentResult(st){
    const phase = String(st?.phase || '').trim().toLowerCase();
    const mode = normMode(st);
    const wp = normWorldPhase(st);

    // Local / LastChance / National の最終
    if (phase === 'local_total_result_wait_post') return true;
    if (phase === 'lastchance_total_result_wait_post') return true;
    if (phase === 'national_total_result_wait_post') return true;

    // World のフェーズ終了結果
    if (phase === 'world_qual_total_result_wait_branch') return true;
    if (phase === 'world_losers_total_result_wait_branch') return true;
    if (phase === 'world_total_result_wait_post') return true;

    // 予備判定
    if (mode === 'world' && wp === 'qual' && phase === 'world_eliminated_wait_end') return true;

    return false;
  }

  function shouldShowRewardBox(st){
    return isStageEndTournamentResult(st);
  }

  function shouldShowTournamentMessageBox(st){
    return isStageEndTournamentResult(st);
  }

  function buildTournamentResultMessage(st, totalArr){
    const mode = normMode(st);
    const wp = normWorldPhase(st);
    const rank = getPlayerRankFromTotalRows(totalArr);

    if (!rank) return null;

    if (mode === 'local'){
      if (rank === 1){
        return {
          title: 'ローカル大会結果',
          lines: [
            'やったね！1位でナショナル大会へ進出を決めたよ！',
            '自信を持って次へ備えよう！'
          ]
        };
      }
      if (rank >= 2 && rank <= 5){
        return {
          title: 'ローカル大会結果',
          lines: [
            '上位で突破！',
            '次はナショナル大会！',
            'しっかり準備しよう！'
          ]
        };
      }
      if (rank >= 6 && rank <= 9){
        return {
          title: 'ローカル大会結果',
          lines: [
            'なんとかナショナル出場権を獲得！',
            '頑張るぞ！'
          ]
        };
      }
      if (rank === 10){
        return {
          title: 'ローカル大会結果',
          lines: [
            'ボーダーでナショナル出場権を獲得！',
            '危なかった..'
          ]
        };
      }
      return {
        title: 'ローカル大会結果',
        lines: [
          `今回のローカル大会は${rank}位で終了。`,
          '次のシーズンに備えよう！'
        ]
      };
    }

    if (mode === 'national'){
      if (rank === 1){
        return {
          title: 'ナショナル大会結果',
          lines: [
            'やったー！1位でワールドファイナル進出を決めたよ！',
            '最高の形で世界へ！'
          ]
        };
      }
      if (rank >= 2 && rank <= 8){
        return {
          title: 'ナショナル大会結果',
          lines: [
            '世界大会決定！',
            'やったね！'
          ]
        };
      }
      if (rank >= 9 && rank <= 28){
        return {
          title: 'ナショナル大会結果',
          lines: [
            '突破ならず。',
            'でもラストチャンスの権利を手に入れた！',
            '最後まで諦めないで！'
          ]
        };
      }
      return {
        title: 'ナショナル大会結果',
        lines: [
          `今回のナショナル大会は${rank}位で終了。`,
          '次のシーズンに備えよう！'
        ]
      };
    }

    if (mode === 'lastchance'){
      if (rank === 1){
        return {
          title: 'ラストチャンス結果',
          lines: [
            'やったー！1位でワールドファイナル進出を決めたよ！',
            '世界一が見えて来た！'
          ]
        };
      }
      if (rank === 2){
        return {
          title: 'ラストチャンス結果',
          lines: [
            '2位で突破！',
            'やったね！',
            '帰ってトレーニングだ！'
          ]
        };
      }
      return {
        title: 'ラストチャンス結果',
        lines: [
          `${rank}位で終了。`,
          'また次のシーズンで頑張ろう！'
        ]
      };
    }

    if (mode === 'world' && wp === 'qual'){
      if (rank >= 1 && rank <= 10){
        return {
          title: 'ワールドファイナル予選結果',
          lines: [
            '決勝確定！',
            '世界一が見えて来た！'
          ]
        };
      }
      if (rank >= 11 && rank <= 30){
        return {
          title: 'ワールドファイナル予選結果',
          lines: [
            'losersへ！',
            'まだまだ諦めないで！'
          ]
        };
      }
      return {
        title: 'ワールドファイナル予選結果',
        lines: [
          `${rank}位で終了！`,
          `世界${rank}位！自信を持って！`
        ]
      };
    }

    if (mode === 'world' && wp === 'losers'){
      if (rank >= 1 && rank <= 10){
        return {
          title: 'WORLD losers 結果',
          lines: [
            '決勝へ！',
            'これが最後の戦いだよ！'
          ]
        };
      }
      return {
        title: 'WORLD losers 結果',
        lines: [
          '惜しくもここで敗退！',
          '世界の壁は厚いね。',
          'また頑張ろう！'
        ]
      };
    }

    if (mode === 'world' && wp === 'final'){
      if (rank === 1){
        return {
          title: 'WORLD FINAL 結果',
          lines: [
            'やったね！世界一だよ！世界一！',
            '賞金何に使うのかな？',
            'とにかくおめでとう！',
            '世界王者！'
          ]
        };
      }
      if (rank >= 2 && rank <= 9){
        return {
          title: 'WORLD FINAL 結果',
          lines: [
            `今回は${rank}位でフィニッシュ！`,
            `世界${rank}位。`,
            'よく頑張ったね！'
          ]
        };
      }
      return {
        title: 'WORLD FINAL 結果',
        lines: [
          `${rank}位で世界大会終了！`,
          '本当にお疲れ様！'
        ]
      };
    }

    return null;
  }

  function buildTournamentMessageBox(st, totalArr){
    if (!shouldShowTournamentMessageBox(st)) return null;

    const info = buildTournamentResultMessage(st, totalArr);
    if (!info) return null;

    const wrap = document.createElement('div');
    wrap.className = 'coachHint';
    wrap.style.marginTop = '10px';
    wrap.style.padding = '12px';
    wrap.style.borderRadius = '12px';
    wrap.style.border = '1px solid rgba(255,255,255,.14)';
    wrap.style.background = 'rgba(255,255,255,.07)';
    wrap.style.lineHeight = '1.55';

    const title = document.createElement('div');
    title.style.fontWeight = '1000';
    title.style.fontSize = '13px';
    title.style.marginBottom = '6px';
    title.textContent = String(info.title || '大会結果');
    wrap.appendChild(title);

    const body = document.createElement('div');
    body.style.fontSize = '12px';
    body.style.opacity = '0.97';
    body.innerHTML = (Array.isArray(info.lines) ? info.lines : [])
      .map(x => escapeHtml(String(x || '')))
      .join('<br>');
    wrap.appendChild(body);

    return wrap;
  }

  function getNoticeLines(payload, st){
    const p1 = String(payload?.line1 || '').trim();
    const p2 = String(payload?.line2 || '').trim();
    const p3 = String(payload?.line3 || '').trim();

    if (p1 || p2 || p3){
      return {
        line1: p1,
        line2: p2,
        line3: p3 || 'NEXTで進行'
      };
    }

    const mode = normMode(st);
    const wp = normWorldPhase(st);

    if (mode === 'world' && wp === 'final'){
      return {
        line1: 'WORLD FINAL',
        line2: '決戦の時だ！',
        line3: 'NEXTで進行'
      };
    }

    return {
      line1: '',
      line2: '',
      line3: 'NEXTで進行'
    };
  }

  // =========================================================
  // ✅ 通過ライン / 点灯ライン（色分け用）
  // =========================================================
  function getQualLineByState(st){
    const mode = String(st?.mode || '').toLowerCase();
    const wp = String(st?.worldPhase || st?.phase || '').toLowerCase();

    if (mode === 'local') return { line: 10, label: 'TOP10通過' };
    if (mode === 'national') return { line: 8, label: 'TOP8通過' };
    if (mode === 'lastchance') return { line: 2, label: 'TOP2通過' };

    if (mode === 'world'){
      if (wp === 'qual') return { line: 10, label: 'TOP10通過' };
      if (wp === 'losers') return { line: 10, label: 'TOP10通過' };
      if (wp === 'final') return { line: 0, label: '' };
      if (wp === 'eliminated') return { line: 0, label: '' };
    }
    return { line: 0, label: '' };
  }

  function getWorldFinalLitSet(st){
    try{
      const mp = st?.worldFinalMP;
      const lit = mp?.litAtMatch;
      if (!lit || typeof lit !== 'object') return new Set();
      const s = new Set();
      for (const k of Object.keys(lit)){
        const id = String(k||'');
        if (!id) continue;
        s.add(id);
      }
      return s;
    }catch(_){
      return new Set();
    }
  }

  function applyRowHighlight(tr, opts){
    if (!tr) return;

    if (opts?.qualified){
      tr.classList.add('isQualified');
      tr.style.background = 'rgba(80, 200, 120, 0.12)';
    }
    if (opts?.cut){
      tr.classList.add('isCut');
      tr.style.opacity = '0.72';
    }
    if (opts?.lit){
      tr.classList.add('isLit');
      tr.style.background = 'rgba(255, 215, 0, 0.14)';
      tr.style.boxShadow = 'inset 0 0 0 1px rgba(255, 215, 0, 0.35)';
    }
  }

  // =========================================================
  // ✅ 賞金 / 企業ランクUP 表示
  // =========================================================
  function fmtGold(n){
    const v = Number(n || 0);
    return `${v.toLocaleString('ja-JP')}G`;
  }

  function fmtRankUp(n){
    const v = Number(n || 0);
    return `+${v}`;
  }

  function resolvePlayerFinalRankFromTotal(total){
    const arr = Array.isArray(total) ? total : Object.values(total || {});
    const idx = arr.findIndex(r => String(r?.id || '') === 'PLAYER');
    return idx >= 0 ? (idx + 1) : 0;
  }

  function getRewardInfoFromState(st, totalArr){
    try{
      const last = st?.lastTournamentReward;
      if (last && typeof last === 'object'){
        const gold = Number(last.gold || 0);
        const rankUp = Number(last.rankUp || 0);
        const rank = Number(last.rank || 0) || resolvePlayerFinalRankFromTotal(totalArr);
        return { rank, gold, rankUp };
      }
    }catch(_){}

    try{
      const rank = resolvePlayerFinalRankFromTotal(totalArr);
      const R = window.MOBBR?.sim?.tournamentResult;
      if (R && typeof R.getTournamentReward === 'function'){
        const rw = R.getTournamentReward(st?.mode, rank) || {};
        return {
          rank,
          gold: Number(rw.gold || 0),
          rankUp: Number(rw.rankUp || 0)
        };
      }
    }catch(_){}

    return { rank:0, gold:0, rankUp:0 };
  }

  function buildRewardBox(st, totalArr){
    if (!shouldShowRewardBox(st)) return null;

    const info = getRewardInfoFromState(st, totalArr);
    const rank = Number(info.rank || 0);
    const gold = Number(info.gold || 0);
    const rankUp = Number(info.rankUp || 0);

    const isRewarded = (gold > 0 || rankUp > 0);
    if (!isRewarded) return null;

    const wrap = document.createElement('div');
    wrap.className = 'coachHint';
    wrap.style.marginTop = '10px';
    wrap.style.padding = '12px';
    wrap.style.borderRadius = '12px';
    wrap.style.border = '1px solid rgba(255,255,255,.14)';
    wrap.style.background = 'rgba(255,215,0,.08)';
    wrap.style.lineHeight = '1.45';

    const title = document.createElement('div');
    title.style.fontWeight = '1000';
    title.style.fontSize = '13px';
    title.textContent = 'PLAYER 報酬';
    wrap.appendChild(title);

    const body = document.createElement('div');
    body.style.marginTop = '6px';
    body.style.fontSize = '12px';
    body.style.opacity = '0.95';
    body.innerHTML = `
      最終順位：${escapeHtml(String(rank))}位<br>
      賞金：${escapeHtml(fmtGold(gold))}<br>
      企業ランク：${escapeHtml(fmtRankUp(rankUp))}
    `;
    wrap.appendChild(body);

    return wrap;
  }

  async function handleShowArrival(payload){
    lockUI();
    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels();
      setEventIcon('');
      showCenterStamp('');
      resetEncounterGate();
      clearHold();
      setBattleMode(false);

      const st = getState() || {};
      const auto = buildArrivalLinesByState(st);

      const line1 = String(payload?.line1 || '').trim() || auto.line1;
      const line2 = String(payload?.line2 || '').trim() || auto.line2;
      const line3 = String(payload?.line3 || '').trim() || auto.line3;

      setBackdrop(TOURNEY_BACKDROP);
      setSquareBg('');
      setChars('', '');
      setNames('', '');
      hideSplash();

      showSplash(line1, line2);
      setLines(line1, line2, line3);
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handleShowIntroText(){
    lockUI();
    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels(); hideSplash(); showCenterStamp(''); setEventIcon('');
      resetEncounterGate();
      clearHold();
      setBattleMode(false);

      const st = getState();
      if (!st) return;

      setBackdrop(TOURNEY_BACKDROP);
      const sq = await resolveFirstExisting([st.ui?.squareBg || ASSET.tent, ASSET.tent]);
      setSquareBg(sq || ASSET.tent);

      const leftResolved = await resolveFirstExisting(MOD.guessPlayerImageCandidates(st.ui?.leftImg || 'P1.png'));
      setChars(leftResolved, '');
      setNames('', '');

      setBanners(st.bannerLeft, st.bannerRight);

      const auto = buildIntroLinesByState(st);
      const l1 = st.ui?.center3?.[0] || auto.line1;
      const l2 = st.ui?.center3?.[1] || auto.line2;
      const l3 = st.ui?.center3?.[2] || auto.line3;
      setLines(l1, l2, l3);

      MOD.preloadEventIcons();
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handleShowAutoSession(payload){
    lockUI();
    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels();
      setEventIcon('');
      showCenterStamp('');
      resetEncounterGate();
      clearHold();
      setBattleMode(false);

      setBackdrop(TOURNEY_BACKDROP);
      setSquareBg('');
      setChars('', '');
      setNames('', '');
      hideSplash();

      const t1 = payload?.title || payload?.line1 || '';
      const t2 = payload?.sub || payload?.line2 || '';

      showSplash(t1, t2);
      setLines(payload?.line1 || t1 || '', payload?.line2 || t2 || '', payload?.line3 || 'NEXTで進行');
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handleShowAutoSessionDone(payload){
    lockUI();
    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels();
      setEventIcon('');
      showCenterStamp('');
      resetEncounterGate();
      clearHold();
      setBattleMode(false);

      setBackdrop(TOURNEY_BACKDROP);
      setSquareBg('');
      setChars('', '');
      setNames('', '');
      hideSplash();

      const t1 = payload?.title || payload?.line1 || '全試合終了！';
      const t2 = payload?.sub || payload?.line2 || '現在の総合ポイントはこちら！';

      showSplash(t1, t2);
      setLines(payload?.line1 || t1, payload?.line2 || t2, payload?.line3 || 'NEXTでRESULT表示');
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handleShowTeamList(payload){
    lockUI();
    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels(); hideSplash(); showCenterStamp(''); setEventIcon('');
      resetEncounterGate();
      clearHold();
      setBattleMode(false);

      const st = getState();
      if (!st) return;

      setBackdrop(TOURNEY_BACKDROP);
      const sq = await resolveFirstExisting([st.ui?.squareBg || ASSET.tent, ASSET.tent]);
      setSquareBg(sq || ASSET.tent);

      const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st.ui?.leftImg || 'P1.png'));
      setChars(leftResolved, '');
      setNames('', '');

      setBanners(st.bannerLeft, st.bannerRight);

      const teams = Array.isArray(payload?.teams) ? payload.teams : (Array.isArray(st.teams) ? st.teams : []);
      showPanel('参加チーム', buildTeamListTable(teams));

      setLines('✨ 本日のチームをご紹介！', '（NEXTで進行）', '');
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handleShowCoachSelect(payload){
    lockUI();
    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels(); hideSplash(); showCenterStamp(''); setEventIcon('');
      resetEncounterGate();
      clearHold();
      setBattleMode(false);

      const st = getState();
      if (!st) return;

      setBackdrop(TOURNEY_BACKDROP);
      const sq = await resolveFirstExisting([st.ui?.squareBg || ASSET.tent, ASSET.tent]);
      setSquareBg(sq || ASSET.tent);

      const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st.ui?.leftImg || 'P1.png'));
      setChars(leftResolved, '');
      setNames('', '');

      setBanners(st.bannerLeft, st.bannerRight);

      const wrap = document.createElement('div');
      wrap.className = 'coachWrap';

      const hint = document.createElement('div');
      hint.className = 'coachHint';
      hint.textContent = 'コーチスキルは現在廃止（未使用）です。NEXTで進行します。';
      wrap.appendChild(hint);

      showPanel('コーチ', wrap);

      setLines(
        st.ui?.center3?.[0] || 'それでは試合を開始します！',
        st.ui?.center3?.[1] || '（コーチスキル無し）',
        st.ui?.center3?.[2] || 'NEXTで進行'
      );
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handleShowDropStart(){
    lockUI();
    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels(); hideSplash(); showCenterStamp(''); setEventIcon('');
      resetEncounterGate();
      clearHold();
      setBattleMode(false);

      const st = getState();
      if (!st) return;

      setBackdrop(TOURNEY_BACKDROP);
      setSquareBg(ASSET.tent);

      setBanners(st.bannerLeft, st.bannerRight);
      setNames('', '');

      const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st.ui?.leftImg || 'P1.png'));
      setChars(leftResolved, '');

      setLines(st.ui?.center3?.[0] || '🚀 バトルスタート！', st.ui?.center3?.[1] || '降下開始…！', st.ui?.center3?.[2] || 'NEXTで着地');
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handleShowDropLanded(payload){
    lockUI();
    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels(); hideSplash(); showCenterStamp(''); setEventIcon('');
      resetEncounterGate();
      clearHold();
      setBattleMode(false);

      const st = getState();
      if (!st) return;

      setBackdrop(TOURNEY_BACKDROP);

      const areaBg = String(payload?.bg || st.ui?.bg || '');
      const areaResolved = await resolveFirstExisting([areaBg]);
      if (areaResolved) setSquareBg(areaResolved);

      const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st.ui?.leftImg || 'P1.png'));
      setChars(leftResolved, '');
      setNames('', '');

      setLines(st.ui?.center3?.[0] || '', st.ui?.center3?.[1] || '', st.ui?.center3?.[2] || '');
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handleShowRoundStart(payload){
    lockUI();
    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels(); hideSplash(); showCenterStamp(''); setEventIcon('');
      resetEncounterGate();
      clearHold();
      setBattleMode(false);

      const st = getState();
      if (!st) return;

      setBackdrop(TOURNEY_BACKDROP);

      const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st.ui?.leftImg || 'P1.png'));
      setChars(leftResolved, '');
      setNames('', '');

      setBanners(st.bannerLeft, st.bannerRight);
      setLines(`⚔️ Round ${payload?.round || st.round} 開始！`, '油断するな。ここからが勝負だ。', '');
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handleShowEvent(payload){
    lockUI();
    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels(); hideSplash(); showCenterStamp('');
      resetEncounterGate();
      clearHold();
      setBattleMode(false);

      const st = getState();
      setBackdrop(TOURNEY_BACKDROP);

      const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st?.ui?.leftImg || 'P1.png'));
      setChars(leftResolved, '');
      setNames('', '');

      preloadEventIcons();
      setEventIcon(payload?.icon ? String(payload.icon) : '');

      setBanners(st?.bannerLeft || '', st?.bannerRight || '');

      if (st?.ui?.center3){
        const l1 = st.ui.center3[0] || 'イベント発生！';
        const l2 = st.ui.center3[1] || '';
        const l3 = st.ui.center3[2] || '';
        setLines(l1, l2, l3);
      }else{
        const l1 = payload?.log1 || 'イベント発生！';
        const l2 = payload?.log2 || '';
        const l3 = payload?.log3 || '';
        setLines(l1, l2, l3);
      }
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handlePrepareBattles(){
    lockUI();
    try{
      setChampionMode(false);
      setResultStampMode(false);
      setBattleMode(false);
      setBackdrop(TOURNEY_BACKDROP);
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handleShowEncounter(payload){
    lockUI();
    try{
      setChampionMode(false);
      setResultStampMode(false);

      MOD._setEncounterGatePhase(1);
      MOD._setPendingBattleReq(null);
      clearHold();

      hidePanels();
      setEventIcon('');
      showCenterStamp('');
      hideSplash();

      setBattleMode(false);

      const st = getState();
      if (!st) return;

      setBackdrop(TOURNEY_BACKDROP);
      setBanners(st.bannerLeft, st.bannerRight);

      const meName = payload?.meName || '';
      const foeName = payload?.foeName || '';
      const foeId = payload?.foeTeamId || '';

      const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st.ui?.leftImg || 'P1.png'));

      const rightCands = []
        .concat(guessEnemyImageCandidates(st.ui?.rightImg || ''))
        .concat(guessTeamImageCandidates(foeId));

      const rightResolved = await resolveFirstExisting(rightCands);

      setNames('', '');
      setChars(leftResolved, '');

      showSplash('⚠️ 接敵‼︎', `${foeName}チームを発見！`);
      setLines('⚠️ 接敵‼︎', `${foeName}チームを発見！`, 'NEXTで敵を表示');

      MOD._setLocalNextAction(()=>{
        lockUI();
        try{
          MOD._setEncounterGatePhase(2);

          showCenterStamp('');
          hideSplash();

          setBattleMode(true);

          setNamesRich(
            meName, payload?.meMembers,
            foeName, payload?.foeMembers
          );

          setChars(leftResolved, rightResolved);
          setLines('⚠️ 接敵‼︎', `${meName} vs ${foeName}‼︎`, 'NEXTで交戦開始');

          MOD._setLocalNextAction(()=>{
            lockUI();
            try{
              const pend = MOD._getPendingBattleReq();
              if (pend){
                MOD._setPendingBattleReq(null);
                MOD._setEncounterGatePhase(0);
                (async()=>{ await handleShowBattle(pend); })();
                return;
              }
              const flow = getFlow();
              if (!flow) return;
              MOD._setEncounterGatePhase(0);
              flow.step();
              MOD.render();
            }finally{
              unlockUI();
            }
          });
        }finally{
          unlockUI();
        }
      });

      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handleShowBattle(payload){
    lockUI();
    MOD._setBusy(true);
    MOD.setNextEnabled(false);

    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels(); hideSplash(); setEventIcon('');
      clearHold();

      const st = getState();
      if (!st) return;

      setBattleMode(true);
      setBackdrop(TOURNEY_BACKDROP);

      setResultStampMode(false);
      showCenterStamp(ASSET.brbattle);

      const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st.ui?.leftImg || 'P1.png'));

      const foeId = payload?.foeTeamId || '';

      const rightCands = []
        .concat(guessEnemyImageCandidates(st.ui?.rightImg || ''))
        .concat(guessTeamImageCandidates(foeId));

      const rightResolved = await resolveFirstExisting(rightCands);

      const meName = payload?.meName || '';
      const foeName = payload?.foeName || '';

      setNamesRich(
        meName, payload?.meMembers,
        foeName, payload?.foeMembers
      );

      setChars(leftResolved, rightResolved);

      setLines('交戦開始‼︎', '一瞬で決めるぞ！', '');
      await sleep(420);

      const chats = pickChats(10);
      for (let i=0;i<chats.length;i++){
        setLines(chats[i], '', '');
        await sleep(140);
        setLines('', '', '');
        await sleep(90);
      }

      setResultStampMode(true);
      showCenterStamp(payload?.win ? ASSET.brwin : ASSET.brlose);

      if (payload?.win){
        const winLines = (payload?.final)
          ? ['チャンピオンだ―！！','みんなよくやった！！','獲ったぞー！！']
          : ['よし！次に備えるぞ！','やったー！勝ったぞ！','ナイスー！'];
        setLines('✅ 勝利！', winLines[(Math.random()*winLines.length)|0], '');
      }else{
        const loseLines = ['やられた..','次だ次！','負けちまった..'];
        setLines('❌ 敗北…', loseLines[(Math.random()*loseLines.length)|0], '');
      }

      await sleep(Number(payload?.holdMs || 2000));

      setResultStampMode(false);
      syncSessionBar();
    }finally{
      MOD._setBusy(false);
      unlockUI();
      MOD.setNextEnabled(true);
    }
  }

  async function handleShowMove(payload){
    lockUI();
    MOD._setBusy(true);
    MOD.setNextEnabled(false);

    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels(); hideSplash(); showCenterStamp(''); setEventIcon('');
      resetEncounterGate();
      clearHold();

      const st = getState();
      if (!st) return;

      setBattleMode(false);

      setBackdrop(TOURNEY_BACKDROP);
      setSquareBg(ASSET.ido);

      const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st.ui?.leftImg || 'P1.png'));
      setChars(leftResolved, '');
      setNames('', '');

      const toBg = String(payload?.toBg || '');
      const toResolved = await resolveFirstExisting([toBg]);

      setLines(payload?.log1 || '移動中…', payload?.log2 || '', payload?.log3 || '');
      await sleep(360);

      if (toResolved) setSquareBg(toResolved);

      setLines(
        payload?.arrive1 || (payload?.toAreaName ? `📍 ${String(payload.toAreaName)}に到着！` : '📍 到着！'),
        payload?.arrive2 || '周囲を警戒しろ。',
        payload?.arrive3 || ''
      );

      syncSessionBar();
    }finally{
      MOD._setBusy(false);
      unlockUI();
      MOD.setNextEnabled(true);
    }
  }

  async function handleShowChampion(payload){
    lockUI();
    try{
      setChampionMode(true);
      setResultStampMode(false);
      hidePanels(); hideSplash(); setEventIcon('');
      resetEncounterGate();
      clearHold();
      setBattleMode(false);

      setBackdrop(TOURNEY_BACKDROP);

      showCenterStamp('');
      setResultStampMode(false);

      const st = getState();

      const leftResolved = await resolveFirstExisting(guessPlayerImageCandidates(st?.ui?.leftImg || 'P1.png'));

      const champTeam = findChampionTeam(st, payload);
      const champName = String(payload?.championName || champTeam?.name || payload?.line2 || '').trim();

      let champImg = '';
      if (champTeam?.id){
        const cands = []
          .concat(guessEnemyImageCandidates(champTeam?.img || ''))
          .concat(guessTeamImageCandidates(champTeam.id));
        champImg = await resolveFirstExisting(cands);
      }

      setChars(leftResolved, champImg || '');
      setNames('', champName || '');

      const isWorldChampion = !!payload?.worldChampion || !!payload?.isWorldFinal;
      if (isWorldChampion){
        const members = champTeam?.members && Array.isArray(champTeam.members)
          ? champTeam.members.slice(0,3).map(m=>String(m?.name || '')).filter(Boolean)
          : [];
        const memberLine = members.length ? `メンバーは ${members.join('、')}！` : 'おめでとう！';

        setLines(
          `${champName}が点灯状態でチャンピオンを獲得！`,
          `世界王者は ${champName}！`,
          memberLine
        );
      }else{
        setLines(
          payload?.line1 || '🏆 この試合のチャンピオンは…',
          champName || '',
          payload?.line3 || '‼︎'
        );
      }

      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handleShowMatchResult(payload){
    lockUI();
    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels(); hideSplash(); showCenterStamp(''); setEventIcon('');
      resetEncounterGate();
      setHold('showMatchResult');
      setBattleMode(false);

      setBackdrop(TOURNEY_BACKDROP);
      setSquareBg(ASSET.tent);

      const srcRows = Array.isArray(payload?.rows) ? payload.rows : [];

      const wrap = document.createElement('div');
      wrap.className = 'resultWrap';

      const table = document.createElement('table');
      table.className = 'resultTable';
      table.innerHTML = `
        <thead>
          <tr>
            <th>TEAM</th>
            <th class="num">PP</th>
            <th class="num">K</th>
            <th class="num">A</th>
            <th class="num">TRE</th>
            <th class="num">FLG</th>
            <th class="num">TOTAL</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;
      const tb = table.querySelector('tbody');

      srcRows.forEach(r=>{
        const tr = document.createElement('tr');
        const isPlayer = (String(r.id||'') === 'PLAYER') || !!r.isPlayer;
        if (isPlayer) tr.classList.add('isPlayer');

        const place = Number(r.placement ?? r.Placement ?? 0);
        const name = String(r.name ?? r.squad ?? r.id ?? '');

        const PlacementP = Number(r.PlacementP ?? r.placementP ?? 0);
        const KP = Number(r.KP ?? r.kp ?? 0);
        const AP = Number(r.AP ?? r.ap ?? 0);
        const Treasure = Number(r.Treasure ?? r.treasure ?? 0);
        const Flag = Number(r.Flag ?? r.flag ?? 0);
        const Total = Number(r.Total ?? r.total ?? 0);

        const teamLabel = `${place ? `#${place} ` : ''}${name}`;

        tr.innerHTML = `
          <td>${escapeHtml(teamLabel)}</td>
          <td class="num">${escapeHtml(String(PlacementP))}</td>
          <td class="num">${escapeHtml(String(KP))}</td>
          <td class="num">${escapeHtml(String(AP))}</td>
          <td class="num">${escapeHtml(String(Treasure))}</td>
          <td class="num">${escapeHtml(String(Flag))}</td>
          <td class="num">${escapeHtml(String(Total))}</td>
        `;
        tb.appendChild(tr);
      });

      wrap.appendChild(table);

      const playerPlace = getPlayerRankFromPayloadRows(srcRows);
      if (playerPlace > 0){
        const note = document.createElement('div');
        note.className = 'coachHint';
        note.style.marginTop = '10px';
        note.textContent = `PLAYER 今回の順位：${playerPlace}位`;
        wrap.appendChild(note);
      }

      showPanel(`MATCH ${payload?.matchIndex || ''} RESULT`, wrap);

      setLines('📊 試合結果', 'NEXTで総合RESULTへ', '');
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handleShowTournamentResult(payload){
    lockUI();
    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels(); hideSplash(); showCenterStamp(''); setEventIcon('');
      resetEncounterGate();
      setHold('showTournamentResult');
      setBattleMode(false);

      setBackdrop(TOURNEY_BACKDROP);
      setSquareBg(ASSET.tent);

      const st = getState() || {};
      const total = payload?.total || {};
      const arr = Object.values(total);

      arr.sort((a,b)=>{
        const pa = Number(a.sumTotal ?? a.total ?? 0);
        const pb = Number(b.sumTotal ?? b.total ?? 0);
        if (pb !== pa) return pb - pa;

        const ka = Number(a.sumKP ?? a.KP ?? a.kp ?? 0);
        const kb = Number(b.sumKP ?? b.KP ?? b.kp ?? 0);
        if (kb !== ka) return kb - ka;

        const ppa = Number(a.sumPlacementP ?? a.PP ?? a.placementP ?? 0);
        const ppb = Number(b.sumPlacementP ?? b.PP ?? b.placementP ?? 0);
        if (ppb !== ppa) return ppb - ppa;

        return String(a.name || a.squad || a.id || '').localeCompare(String(b.name || b.squad || b.id || ''));
      });

      const q = getQualLineByState(st);
      const litSet = getWorldFinalLitSet(st);
      const isWorldFinal = (String(st.mode||'').toLowerCase()==='world' && String(st.worldPhase||st.phase||'').toLowerCase()==='final');

      const wrap = document.createElement('div');
      wrap.className = 'tourneyWrap';

      const hint = document.createElement('div');
      hint.className = 'coachHint';

      if (isWorldFinal){
        const mp = Number(st?.worldFinalMP?.matchPoint ?? 80);
        hint.textContent = `WORLD FINAL：${mp}pt点灯チーム（次試合以降のチャンピオンで優勝）`;
      }else if (q.line > 0){
        hint.textContent = `通過ライン：${q.label}`;
      }else{
        hint.textContent = '総合ポイント';
      }
      wrap.appendChild(hint);

      const rewardBox = buildRewardBox(st, arr);
      if (rewardBox) wrap.appendChild(rewardBox);

      const messageBox = buildTournamentMessageBox(st, arr);
      if (messageBox) wrap.appendChild(messageBox);

      const table = document.createElement('table');
      table.className = 'tourneyTable';
      table.innerHTML = `
        <thead>
          <tr>
            <th>TEAM</th>
            <th class="num">PT</th>
            <th class="num">PP</th>
            <th class="num">K</th>
            <th class="num">A</th>
            <th class="num">TRE</th>
            <th class="num">FLG</th>
          </tr>
        </thead>
        <tbody></tbody>
      `;
      const tb = table.querySelector('tbody');

      arr.forEach((r,i)=>{
        const rank = i + 1;

        const tr = document.createElement('tr');
        const id = String(r.id ?? '');
        const isPlayer = (id === 'PLAYER') || !!r.isPlayer;
        if (isPlayer) tr.classList.add('isPlayer');

        const teamName = String(r.name ?? r.squad ?? r.id ?? '');
        let teamLabel = `#${rank} ${teamName}`;

        const lit = isWorldFinal && litSet.has(id);
        if (lit){
          teamLabel = `🟡 ${teamLabel}`;
        }

        const PT = Number(r.sumTotal ?? r.total ?? 0);
        const PP = Number(r.sumPlacementP ?? r.PP ?? r.placementP ?? 0);
        const K  = Number(r.sumKP ?? r.KP ?? r.kp ?? 0);
        const A  = Number(r.sumAP ?? r.AP ?? r.ap ?? 0);
        const TRE = Number(r.sumTreasure ?? r.Treasure ?? r.treasure ?? 0);
        const FLG = Number(r.sumFlag ?? r.Flag ?? r.flag ?? 0);

        tr.innerHTML = `
          <td>${escapeHtml(teamLabel)}</td>
          <td class="num">${escapeHtml(String(PT))}</td>
          <td class="num">${escapeHtml(String(PP))}</td>
          <td class="num">${escapeHtml(String(K))}</td>
          <td class="num">${escapeHtml(String(A))}</td>
          <td class="num">${escapeHtml(String(TRE))}</td>
          <td class="num">${escapeHtml(String(FLG))}</td>
        `;

        const qualified = (!isWorldFinal && q.line > 0 && rank <= q.line);
        const cut = (!isWorldFinal && q.line > 0 && rank > q.line);

        applyRowHighlight(tr, { qualified, cut, lit });

        tb.appendChild(tr);
      });

      wrap.appendChild(table);
      showPanel('TOURNAMENT RESULT', wrap);

      setLines('🏁 総合RESULT', '（NEXTで進行）', '');
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handleShowNationalNotice(payload){
    lockUI();
    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels(); setEventIcon('');
      resetEncounterGate();
      clearHold();
      setBattleMode(false);

      const st = getState() || {};
      const lines = getNoticeLines(payload, st);

      setBackdrop(TOURNEY_BACKDROP);
      setSquareBg('');

      setChars('', '');
      setNames('', '');
      showCenterStamp('');
      showSplash(lines.line1 || '', lines.line2 || '');

      setLines(lines.line1 || '', lines.line2 || '', lines.line3 || 'NEXTで進行');
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  async function handleEndTournament(payload){
    lockUI();
    try{
      MOD.close();
    }finally{
      unlockUI();
    }

    try{
      const ok = dispatchGoMainFromPayload(payload, 1);
      if (!ok){
        window.dispatchEvent(new CustomEvent('mobbr:goMain', { detail:{ advanceWeeks:1, tournamentFinished:true } }));
      }
    }catch(e){
      console.error('[ui_tournament.handlers] handleEndTournament goMain failed:', e);
    }
  }

  async function handleEndNationalWeek(payload){
    lockUI();
    try{
      MOD.close();
    }finally{
      unlockUI();
    }

    try{
      const weeks = Number(payload?.weeks ?? payload?.advanceWeeks ?? 1) || 1;

      dispatchGoMainFromPayload(Object.assign({}, payload || {}, {
        nationalFinished: payload?.nationalFinished ?? true,
        tournamentFinished: payload?.tournamentFinished ?? true,
        advanceWeeks: weeks
      }), weeks);
    }catch(e){
      console.error('[ui_tournament] endNationalWeek notify error:', e);
      try{
        window.dispatchEvent(new CustomEvent('mobbr:goMain', { detail:{ advanceWeeks:1, tournamentFinished:true, nationalFinished:true } }));
      }catch(_){}
    }
  }

  async function handleNextMatch(payload){
    lockUI();
    try{
      setChampionMode(false);
      setResultStampMode(false);
      hidePanels(); hideSplash(); showCenterStamp(''); setEventIcon('');
      resetEncounterGate();
      clearHold();
      setBattleMode(false);

      setBackdrop(TOURNEY_BACKDROP);
      setSquareBg(ASSET.tent);

      const st = getState() || {};
      const total = getMatchTotalFromState(st);
      const mi = Number(payload?.matchIndex ?? st.matchIndex ?? st.match ?? 0) || 0;

      setLines('➡️ 次の試合へ', `MATCH ${mi} / ${total}`, 'NEXTで進行');
      syncSessionBar();
    }finally{
      unlockUI();
    }
  }

  Object.assign(MOD, {
    handleShowArrival,
    handleShowIntroText,
    handleShowAutoSession,
    handleShowAutoSessionDone,
    handleShowTeamList,
    handleShowCoachSelect,
    handleShowDropStart,
    handleShowDropLanded,
    handleShowRoundStart,
    handleShowEvent,
    handlePrepareBattles,
    handleShowEncounter,
    handleShowBattle,
    handleShowMove,
    handleShowChampion,
    handleShowMatchResult,
    handleShowTournamentResult,
    handleShowNationalNotice,
    handleEndTournament,
    handleEndNationalWeek,
    handleNextMatch
  });

})();

// ✅ splitロード検知（app.js の [CHECK] ui_tournament split 用）
window.MOBBR = window.MOBBR || {};
window.MOBBR.ui = window.MOBBR.ui || {};
window.MOBBR.ui._tournamentHandlers = true;
