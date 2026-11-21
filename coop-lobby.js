/* Visual selection follows the game's portrait cards and boss artwork. */
(() => {
  'use strict';
  function create({api,shell,art,join,rewards}){
    const {$,esc}=api,C=window.JQCoopContent,K=window.JQCoopCore;
    let selected='stone',character=api.character(),filter=-1,password='',returnTo='boss',beforeChoice=character;
    const currentChar=()=>api.chars.find(c=>c.id===character)||api.chars[0];
    function remember(){if($('coop-password'))password=$('coop-password').value;}
    const party=()=>`<div class="coop-party-choice"><span class="coop-choice-face">${api.charPortrait(character)}</span><div><span class="sub">出撃するキャラ</span><b>${esc(currentChar().name)}</b></div><button class="btn sm" id="coop-change-char">キャラを選ぶ</button></div>`;
    const bindParty=where=>{$('coop-change-char').onclick=()=>{remember();returnTo=where;beforeChoice=character;characters();};};
    function open(){const q=K.progress(api.cs());shell('共闘ボス討伐',`${party()}<div class="row spread"><p>挑むボスを選ぼう</p><button class="btn sm" id="coop-rewards">討伐図鑑・メダル交換</button></div>
      <div class="tabs coop-difficulty" role="group" aria-label="ボスの難易度">${['すべて','入門','初級','中級','上級','最上級'].map((name,i)=>`<button class="tab${filter===i-1?' on':''}" data-coop-tier="${i-1}" aria-pressed="${filter===i-1}">${name}</button>`).join('')}</div>
      <div class="coop-boss-grid">${C.bosses.filter(b=>filter<0||b.tier===filter).map(b=>`<button class="coop-boss-tile${q.cleared.includes(b.id)?' cleared':''}" data-coop-boss="${b.id}"><span class="coop-tier">${b.difficulty}</span>${art(b)}<b>${esc(b.name)}</b><span class="sub">${b.coins}コイン／メダル${b.medals}枚</span>${q.cleared.includes(b.id)?'<span class="coop-cleared">討伐済み</span>':''}</button>`).join('')}</div><p class="sub">同じボス・同じあいことばで最大4人が参加。全員の準備完了後、リーダーが出撃します。</p>`);
      bindParty('boss');$('coop-rewards').onclick=rewards;
      document.querySelectorAll('[data-coop-tier]').forEach(b=>b.onclick=()=>{filter=+b.dataset.coopTier;open();});
      document.querySelectorAll('[data-coop-boss]').forEach(b=>b.onclick=()=>{selected=b.dataset.coopBoss;detail();});
    }
    function detail(){const b=K.find(selected),ch=currentChar(),cards=api.cardInfo(character);shell(b.name,`<button class="btn sm coop-back" id="coop-back-boss">ボス一覧へ</button>
      <div class="coop-preview-scene q-story-scene" data-scene="${b.scene}"><div class="coop-preview-hero"><img src="img/chars/c${character}.png" alt="${esc(ch.name)}"><span>${esc(ch.name)}</span></div><div class="coop-preview-boss">${art(b)}<span>${esc(b.name)}</span></div></div>
      <div class="row spread"><span class="coop-tier">${b.difficulty}</span><b class="q-rewards">${b.coins}コイン＋メダル${b.medals}枚</b></div><p>${esc(b.story)}</p><p class="coop-forecast">${esc(b.hint)}</p>
      ${party()}<details class="coop-loadout"><summary>能力・装備を見る</summary><p>${ch.ab}</p><div class="coop-equipped">${cards.length?cards.map(x=>`<span>${esc(x.name)}<small>${esc(x.rarity)} Lv${x.level}</small></span>`).join(''):'<span class="sub">装備なし</span>'}</div><p class="sub">装備の変更はアルカナ画面から行えます。</p></details>
      <form id="coop-join-form"><label class="field">あいことば<input class="txt" id="coop-password" maxlength="40" autocomplete="off" placeholder="友だちと同じ言葉を入力" value="${esc(password)}"></label><button type="submit" class="btn primary" id="coop-join">このボスに挑む</button></form>
      <details class="coop-rules"><summary>共闘のルール</summary><p class="sub">2〜4人で参加。全員の準備完了後にリーダーが出撃します。人数に合わせてボスのHP・攻撃力と連携条件が変わります。攻撃・防御・支援・救助を選び、全員の手を同時に公開。1手20秒、時間切れは防御。通信が途切れたら30秒待って中止。40ターンまで。各自のHPは通常対戦の2倍。キャラ能力・アルカナは対戦と同じ計算を使い、セツナのボスへの初手即死は攻撃力6倍の一撃になります。</p></details>`);
      bindParty('detail');$('coop-back-boss').onclick=()=>{remember();open();};$('coop-password').oninput=remember;
      $('coop-join-form').onsubmit=e=>{e.preventDefault();remember();join(selected,character,password.trim());};
    }
    function characters(){const ch=currentChar();shell('出撃するキャラ',`<button class="btn sm coop-back" id="coop-back-char">戻る</button><div class="coop-selected-character"><img src="img/chars/c${character}.png" alt="${esc(ch.name)}"><div><h3>${esc(ch.name)} <small>${esc(ch.title)}</small></h3><p>${ch.ab}</p></div></div>
      <div class="coop-char-grid">${api.chars.map(c=>`<button class="coop-char-tile${c.id===character?' selected':''}" data-coop-character="${c.id}" aria-pressed="${c.id===character}"><span class="coop-choice-face">${api.charPortrait(c.id)}</span><b>${esc(c.name)}</b></button>`).join('')}</div><button class="btn primary" id="coop-confirm-char">${esc(ch.name)}にする</button>`);
      const back=()=>returnTo==='detail'?detail():open();$('coop-back-char').onclick=()=>{character=beforeChoice;back();};$('coop-confirm-char').onclick=back;
      document.querySelectorAll('[data-coop-character]').forEach(b=>b.onclick=()=>{character=+b.dataset.coopCharacter;characters();});
    }
    return {open};
  }
  window.JQCoopLobby={create};
})();
