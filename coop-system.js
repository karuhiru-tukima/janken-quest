/* Two peers publish only their own presence. Commit/reveal and state acknowledgements
   keep both clients on the same turn; a missing peer never becomes a rewarded win. */
(() => {
  'use strict';
  const C=window.JQCoopContent,K=window.JQCoopCore;
  function create(api){
    const {$,esc}=api;let run=null,joining=false,token=0,selection='stone',shown=false,tick=0;
    const root=document.createElement('section');root.id='coop-overlay';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','共闘ボス討伐');document.body.append(root);
    const art=b=>`<span class="coop-boss-art" style="--bx:${b.index%4};--by:${Math.floor(b.index/4)}" role="img" aria-label="${esc(b.name)}"></span>`;
    const ownerOK=r=>run===r&&api.user()?.uid===r.uid;
    const nonce=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
    function shell(title,html){shown=true;root.hidden=false;if($('wrap'))$('wrap').inert=true;root.innerHTML=`<div class="coop-wrap"><div class="row spread"><h2>${esc(title)}</h2><button class="btn sm" id="coop-close">${run?'退出':'閉じる'}</button></div>${html}<p id="coop-error" role="status"></p></div>`;$('coop-close').onclick=()=>{if(run){if(!run.state||run.state.status!=='playing')leave();else{const e=$('coop-error');e.innerHTML='途中で退出すると討伐報酬はありません。 <button class="btn sm" id="coop-leave">退出する</button>';$('coop-leave').onclick=leave;}}else hide();};}
    function hide(){shown=false;root.hidden=true;root.innerHTML='';if($('wrap'))$('wrap').inert=false;api.afterClose?.();}
    async function leave(){const old=run;run=null;token++;clearInterval(tick);tick=0;if(old){old.unsubscribe?.();try{await old.room.leave();}catch{}}hide();}
    function error(message){if($('coop-error'))$('coop-error').textContent=message;}
    const lobby=window.JQCoopLobby.create({api,shell,art,rewards,join:(id,ch,password)=>{selection=id;return join(password,ch);}});
    function open(){if(run){draw();return;}lobby.open();}
    async function join(password,ch){if(joining)return;if(!password){error('あいことばを入力してください。');return;}joining=true;const attempt=++token;$('coop-join').disabled=true;
      let room;try{const user=await api.onlineUser();if(attempt!==token)return;const hash=await api.sha('jq-coop-v1|'+password);room=await api.join('coop-v1-'+hash.slice(0,40),user.uid);if(attempt!==token){await room.leave();return;}
        const r={room,uid:user.uid,epoch:attempt,peers:[],local:{v:1,ch,nick:api.nick().slice(0,12),coop:1,boss:selection,nonce:nonce(),cards:api.cards(ch),rounds:{}},state:null,match:'',busy:false,again:false,deadline:0,computed:0,selectedAction:'attack',selectedTarget:0,stampAt:0,completed:false,missing:0};run=r;await room.presence(r.local);if(run!==r)return;
        r.unsubscribe=room.onPeers(({peers})=>{if(run!==r)return;r.peers=peers;pump(r);},()=>abort(r,'通信を確認できませんでした。退出して、もう一度参加してください。'));
        tick=setInterval(()=>{if(!ownerOK(r)){leave();return;}if(r.missing&&Date.now()-r.missing>30000){abort(r,'仲間との通信が戻らなかったため中止しました。報酬は発生しません。');return;}if(r.state?.status==='playing'&&r.deadline&&Date.now()>=r.deadline&&!r.local.rounds[r.state.turn])pick(r.state.players[r.side].hp<=0?{h:0,a:'guard',target:0}:{h:Math.floor(Math.random()*3),a:'guard',target:r.side});const timer=$('coop-timer');if(timer&&r.deadline)timer.textContent=String(Math.max(0,Math.ceil((r.deadline-Date.now())/1000)));},250);draw();
      }catch(e){if(room&&(!run||run.room!==room))try{await room.leave();}catch{}error('部屋に入れませんでした。通信を確認して再試行してください。');if($('coop-join'))$('coop-join').disabled=false;}finally{joining=false;}
    }
    async function publish(r,patch){if(!ownerOK(r))return;Object.assign(r.local,patch);await r.room.presence(r.local);}
    function abort(r,message){if(run!==r)return;r.failed=message;r.deadline=0;draw();}
    async function pump(r){if(r.busy){r.again=true;return;}r.busy=true;
      try{do{r.again=false;if(!ownerOK(r)||r.failed)break;if(r.completed){r.missing=0;draw();break;}
        const peers=r.peers.filter(p=>p.presence?.coop===1).sort((a,b)=>a.peer<b.peer?-1:a.peer>b.peer?1:0);
        if(peers.length>2&&!r.match){abort(r,'この部屋は満員です。別のあいことばを使ってください。');break;}
        if(peers.some(p=>p.peer===r.uid&&p.presence.nonce!==r.local.nonce)){abort(r,'同じアカウントが別の画面から参加しました。1人につき1画面で参加してください。');break;}
        if(!r.match){if(peers.length<2){draw();break;}if(peers.some(p=>p.presence.v!==1||p.presence.boss!==r.local.boss||!api.validChar(p.presence.ch)||typeof p.presence.nonce!=='string')){abort(r,'2人のボス選択またはゲームのバージョンが違います。同じ設定で入り直してください。');break;}
          r.roster=peers.map(p=>({uid:p.peer,nonce:p.presence.nonce,ch:p.presence.ch,cards:api.cleanCards(p.presence.cards),nick:String(p.presence.nick||'仲間').slice(0,12)}));r.side=r.roster.findIndex(p=>p.uid===r.uid);if(r.side<0)throw Error('missing self');
          r.match=await api.sha(JSON.stringify([r.local.boss,r.roster]));if(!ownerOK(r))break;r.state=K.create(r.local.boss,r.roster,r.match,api.make);api.playEntryVoice?.(r.local.ch);r.digest=await api.sha(JSON.stringify(r.state));await publish(r,{match:r.match,ack:{turn:0,hash:r.digest}});r.again=true;}
        const other=r.peers.find(p=>p.peer===r.roster[1-r.side].uid)?.presence;
        if(!other||other.nonce!==r.roster[1-r.side].nonce){if(!r.missing){r.missing=Date.now();draw();}break;}r.missing=0;
        if(!other.match){draw();break;}if(other.match!==r.match){abort(r,'参加情報が一致しません。入り直してください。');break;}
        const done=r.state.turn-1;
        if(other.ack?.turn===done&&other.ack.hash!==r.digest){abort(r,'戦闘結果が一致しないため中止しました。報酬は発生しません。');break;}
        if(r.state.status!=='playing'){
          if(other.ack?.turn===done&&other.ack.hash===r.digest&&!r.completed){r.completed=true;if(r.state.status==='win'&&ownerOK(r)){K.reward(api.cs(),r.state.id,r.match);api.save();}r.deadline=0;}draw();break;
        }
        // Never choose another turn until both peers have acknowledged the previous one.
        if(!other.ack||other.ack.turn<done){draw();break;}if(!r.deadline)r.deadline=Date.now()+20000;
        const turn=r.state.turn,mine=r.local.rounds[turn],theirs=other.rounds?.[turn];
        if(!mine||!theirs){draw();break;}
        if(!mine.rv){await publish(r,{rounds:{...r.local.rounds,[turn]:{...mine,rv:r.secret}}});r.again=true;continue;}
        if(!theirs.rv){draw();break;}
        const rv=[mine.rv,theirs.rv],cs=[mine.c,theirs.c];for(let i=0;i<2;i++){const v=rv[i];if(!K.validPick(v?.p)||typeof v.s!=='string'||v.s.length!==32||await api.sha(r.match+'|'+turn+'|'+JSON.stringify(v))!==cs[i])throw Error('commit mismatch');}
        if(!ownerOK(r))break;const ordered=r.side===0?rv:[rv[1],rv[0]];r.state=K.step(r.state,ordered.map(v=>v.p),ordered.map(v=>v.s),api.duel);r.deadline=0;r.secret=null;r.digest=await api.sha(JSON.stringify(r.state));await publish(r,{ack:{turn,hash:r.digest}});r.again=true;draw();
      }while(r.again&&ownerOK(r));}catch(e){console.warn('共闘を中止',e);abort(r,'通信または行動情報を確認できませんでした。退出して再参加してください。');}finally{r.busy=false;if(r.again&&ownerOK(r)&&!r.failed)pump(r);}
    }
    async function pick(p){const r=run;if(!r||r.failed||r.missing||!r.state||r.state.status!=='playing'||r.local.rounds[r.state.turn]||!r.deadline||r.picking)return;r.picking=true;try{const turn=r.state.turn,v={p,s:nonce()},c=await api.sha(r.match+'|'+turn+'|'+JSON.stringify(v));if(!ownerOK(r)||r.state.turn!==turn)return;r.secret=v;await publish(r,{rounds:{...r.local.rounds,[turn]:{c}}});pump(r);}catch{abort(r,'行動を送信できませんでした。通信を確認してください。');}finally{r.picking=false;draw();}}
    function draw(){const r=run;if(!r){if(shown)open();return;}const b=K.find(r.local.boss);if(r.failed){shell('共闘を中止',`<p role="alert">${esc(r.failed)}</p><p>コイン・メダルは消費されません。</p>`);return;}
      if(!r.state){shell('仲間を待っています',`${art(b)}<h3>${esc(b.name)}</h3><p>同じあいことば・同じボスで参加してください。</p>`);return;}
      const s=r.state,f=K.forecast(s,r.side),locked=!!r.local.rounds[s.turn],over=s.status!=='playing',q=K.progress(api.cs());
      shell(over?(s.status==='win'?'討伐成功！':'討伐失敗'):'共闘ボス討伐',`<div class="row spread"><b>${esc(b.name)}</b><span>${Math.min(s.turn,40)}/40ターン</span></div>
      <div class="coop-battle q-story-scene" data-scene="${b.scene}"><div class="coop-party">${s.players.map((p,i)=>`<div class="coop-hero${p.hp<=0?' down':''}"><img src="img/chars/c${p.ch}.png" alt="${esc(api.charName(p.ch))}"><span>${i+1}：${esc(r.roster[i].nick)}${i===r.side?'（あなた）':''}</span><meter min="0" max="${p.max}" value="${p.hp}"></meter><small>HP ${p.hp.toFixed(1)}/${p.max}</small></div>`).join('')}</div><div class="coop-enemy">${art(b)}<meter min="0" max="${s.max}" value="${s.hp}"></meter><small>HP ${s.hp.toFixed(1)}/${s.max}${b.rule==='heads'||b.rule==='twins'?`（左 ${s.parts[0]}／右 ${s.parts[1]}）`:''}</small></div></div>
      ${over?`<p class="q-rewards">${!r.completed?'仲間と戦闘結果を照合しています…':s.status==='win'?`${b.coins}コイン＋メダル${b.medals}枚を獲得！ 所持メダル ${q.medals}枚`:'作戦を変えて、もう一度挑もう。'}</p>`:`<p class="coop-forecast" role="status">${esc(f.text)}</p><p>${r.missing?'仲間との通信を待っています（最大30秒）':!r.deadline?'仲間と前の結果を確認しています…':locked?'選択済み。仲間の行動を待っています…':`残り <b id="coop-timer">${Math.max(0,Math.ceil((r.deadline-Date.now())/1000))}</b>秒`}</p>
      <div class="coop-stamps">${['グーでいこう','チョキでいこう','パーでいこう','手を分けよう','回復お願い','グーなし','チョキなし','パーなし'].map((x,i)=>`<button class="btn sm" data-coop-stamp="${i}">${x}</button>`).join('')}</div><p class="sub">仲間の合図：${esc(['グーでいこう','チョキでいこう','パーでいこう','手を分けよう','回復お願い','グーなし','チョキなし','パーなし'][r.peers.find(p=>p.peer===r.roster[1-r.side].uid)?.presence?.signal?.k]||'―')}</p>
      <div class="row coop-choices"><label>行動<select id="coop-action">${Object.entries(C.actions).map(([key,label])=>`<option value="${key}"${r.selectedAction===key?' selected':''}>${label}</option>`).join('')}</select></label>${['heads','twins'].includes(b.rule)?`<label>狙う相手<select id="coop-target"><option value="0"${r.selectedTarget===0?' selected':''}>左</option><option value="1"${r.selectedTarget===1?' selected':''}>右</option></select></label>`:''}</div>
      <div class="coop-hands">${C.hands.map((h,i)=>`<button class="btn primary" data-coop-hand="${i}"${locked||r.missing||!r.deadline?' disabled':''}>${h}</button>`).join('')}</div><p class="sub">防御：被害を65%軽減。支援：味方の被害を30%軽減しHPを12%回復。救助：倒れている仲間をHP35%で復帰。支援・救助では攻撃しません。</p>`}
      <details${over?' open':''}><summary>直前の戦闘ログ</summary>${s.log.map(l=>`<p class="sub">${esc(l)}</p>`).join('')}</details>`);
      if($('coop-action'))$('coop-action').onchange=()=>r.selectedAction=$('coop-action').value;if($('coop-target'))$('coop-target').onchange=()=>r.selectedTarget=+$('coop-target').value;
      root.querySelectorAll('[data-coop-hand]').forEach(btn=>btn.onclick=()=>pick({h:+btn.dataset.coopHand,a:r.selectedAction,target:r.selectedTarget}));
      root.querySelectorAll('[data-coop-stamp]').forEach(btn=>btn.onclick=()=>{if(Date.now()-r.stampAt<1200)return;r.stampAt=Date.now();publish(r,{signal:{k:+btn.dataset.coopStamp,n:r.stampAt}}).catch(()=>error('合図を送れませんでした。'));});
    }
    function rewards(){const cs=api.cs(),q=K.progress(cs);shell('討伐メダル交換',`<p>所持メダル ${q.medals}枚／討伐 ${q.cleared.length}/15</p><p class="sub">そのボスを一度倒すと交換できます。称号・枠・背景は性能に影響しません。</p>${C.bosses.map(b=>`<section class="q-chapter"><div class="coop-preview">${art(b)}<div><h3>${esc(b.name)}</h3><p>${esc(b.story)}</p><p>${esc(b.hint)}</p><b>${q.cleared.includes(b.id)?'討伐済み':'未討伐'}</b></div></div><div class="row">${[['title','称号',3],['frame','枠',6],['background','背景',10]].map(([t,label,cost])=>{const owned=q.owned.includes(b.id+':'+t);return `<button class="btn sm" data-coop-buy="${b.id}:${t}"${owned||!q.cleared.includes(b.id)||q.medals<cost*(b.tier+1)?' disabled':''}>${label}${owned?'：交換済み':`：${cost*(b.tier+1)}枚`}</button>${owned&&t!=='title'?`<button class="btn sm" data-coop-use="${b.id}:${t}">${q[t]===b.id?'使用中':'使う'}</button>`:''}`;}).join('')}</div></section>`).join('')}
      <p>15体全討伐：称号「${C.allTitle}」＋集合背景を自動解放。</p>${q.cleared.length===15?'<button class="btn" data-coop-use="all:background">集合背景を使う</button>':''}<div class="row"><button class="btn" id="coop-unset">共闘の枠・背景を外す</button><button class="btn primary" id="coop-return">ボス選択へ</button></div>`);
      root.querySelectorAll('[data-coop-buy]').forEach(btn=>btn.onclick=()=>{const [id,type]=btn.dataset.coopBuy.split(':');if(K.exchange(cs,id,type)){api.save();prepareTitle();}rewards();});
      root.querySelectorAll('[data-coop-use]').forEach(btn=>btn.onclick=()=>{const [id,type]=btn.dataset.coopUse.split(':'),now=K.progress(cs);if(now.owned.includes(id+':'+type)||id==='all'&&now.cleared.length===15){now[type]=id;cs.coop=now;api.save();prepareTitle();rewards();}});
      $('coop-unset').onclick=()=>{const now=K.progress(cs);now.frame='';now.background='';cs.coop=now;api.save();prepareTitle();rewards();};$('coop-return').onclick=open;
    }
    function prepareTitle(){const q=K.progress(api.cs()),boot=$('boot');if(!boot)return;let layer=$('coop-title-art');if(!layer){layer=document.createElement('div');layer.id='coop-title-art';boot.prepend(layer);}const b=K.find(q.background);layer.hidden=!b&&q.background!=='all';layer.innerHTML=b?`<div class="coop-title-emblem">${art(b)}</div>`:q.background==='all'?`<div class="coop-title-party">${C.bosses.map(art).join('')}</div>`:'';if(b){boot.style.setProperty('--coop-color',['#314d49','#34485f','#453350','#514331','#523044'][b.tier]);}boot.classList.toggle('coop-title-on',!layer.hidden);}
    return {open,leave,rewards,prepareTitle,art};
  }
  window.JQCoop={create};
})();
