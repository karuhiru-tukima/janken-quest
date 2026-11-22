/* Two to four peers write only their own presence. Every frozen party member must commit, reveal and acknowledge before advancing or receiving rewards. */
(() => {
  'use strict';
  const C=window.JQCoopContent,K=window.JQCoopCore;
  function create(api){
    const {$,esc}=api;let run=null,joining=false,token=0,selection='stone',shown=false,tick=0;
    const root=document.createElement('section');root.id='coop-overlay';root.hidden=true;root.setAttribute('role','dialog');root.setAttribute('aria-modal','true');root.setAttribute('aria-label','共闘ボス討伐');document.body.append(root);
    const exitDialog=document.createElement('section');exitDialog.id='coop-exit-dialog';exitDialog.hidden=true;exitDialog.setAttribute('role','alertdialog');exitDialog.setAttribute('aria-modal','true');exitDialog.setAttribute('aria-labelledby','coop-exit-title');exitDialog.setAttribute('aria-describedby','coop-exit-description');document.body.append(exitDialog);
    let exitFocus=null;
    function cancelExit(){exitDialog.hidden=true;root.inert=false;($('coop-close')||exitFocus)?.focus?.();}
    function confirmExit(){
      exitFocus=$('coop-close');root.inert=true;exitDialog.hidden=false;
      const playing=run?.state?.status==='playing';
      exitDialog.innerHTML='<div class="coop-exit-card"><span class="coop-exit-mark" aria-hidden="true">！</span><h2 id="coop-exit-title">共闘から退出しますか？</h2><p id="coop-exit-description">'+(playing?'戦闘の途中で退出すると、今回の討伐報酬は受け取れません。仲間の共闘も中止になります。':run?.completed?'獲得した討伐報酬は保存されています。':'待合室を退出します。参加中の仲間には退出したことが伝わります。')+'</p><div class="coop-exit-actions"><button class="btn primary" id="coop-exit-cancel">共闘に戻る</button><button class="btn" id="coop-exit-confirm">退出する</button></div></div>';
      $('coop-exit-cancel').onclick=cancelExit;$('coop-exit-confirm').onclick=()=>{cancelExit();return leave();};$('coop-exit-cancel').focus?.();
    }
    exitDialog.onkeydown=e=>{if(e.key==='Escape'){e.preventDefault();cancelExit();}if(e.key==='Tab'){const a=$('coop-exit-cancel'),b=$('coop-exit-confirm');if(e.shiftKey&&document.activeElement===a){e.preventDefault();b.focus();}else if(!e.shiftKey&&document.activeElement===b){e.preventDefault();a.focus();}}};
    const art=b=>`<span class="coop-boss-art" style="--bx:${b.index%4};--by:${Math.floor(b.index/4)}" role="img" aria-label="${esc(b.name)}"></span>`;
    const ownerOK=r=>run===r&&api.user()?.uid===r.uid;
    const nonce=()=>Array.from(crypto.getRandomValues(new Uint8Array(16)),x=>x.toString(16).padStart(2,'0')).join('');
    function shell(title,html){root.dataset.mode=run?.state?.status==='playing'&&!run.failed?'battle':'';shown=true;root.hidden=false;if($('wrap'))$('wrap').inert=true;root.innerHTML=`<div class="coop-wrap"><div class="row spread coop-header"><h2>${esc(title)}</h2><button class="btn sm" id="coop-close">${run?'退出':'閉じる'}</button></div>${html}<p id="coop-error" role="status"></p></div>`;$('coop-close').onclick=()=>run?confirmExit():hide();}
    function hide(){shown=false;root.hidden=true;root.innerHTML='';if($('wrap'))$('wrap').inert=false;api.afterClose?.();}
    async function leave(){const old=run;run=null;token++;cancelExit();clearInterval(tick);tick=0;if(old){old.unsubscribe?.();try{await old.room.leave();}catch{}}hide();}
    function error(message){if($('coop-error'))$('coop-error').textContent=message;}
    const lobby=window.JQCoopLobby.create({api,shell,art,rewards,join:(id,ch,password,mode)=>{selection=id;return join(password,ch,mode);}});
    function open(){if(run){draw();return;}lobby.open();}
    async function join(password,ch,mode='join'){if(joining)return;if(!password){error('あいことばを入力してください。');return;}joining=true;const attempt=++token;for(const id of ['coop-join','coop-create'])if($(id))$(id).disabled=true;
      let room,ownedPresence=false;try{const user=await api.onlineUser();if(attempt!==token)return;const hash=await api.sha('jq-coop-v3|'+password);room=await api.join('coop-v3-'+hash.slice(0,40),user.uid);if(attempt!==token){await room.leave({keepPresence:true});return;}
        const existing=(await room.inspect()).filter(p=>p.presence?.coop===3);
        if(mode==='create'&&existing.length)throw Error('coop:そのあいことばの部屋はすでにあります。「部屋に参加」を選ぶか、別のあいことばで作成してください。');
        if(mode!=='create'&&!existing.length)throw Error('coop:そのあいことばの部屋は見つかりません。先に「部屋を作る」を押してください。');
        if(existing.some(p=>p.presence.boss!==selection))throw Error('coop:その部屋は別のボスを選んでいます。同じボスを選んで参加してください。');
        if(existing.some(p=>p.presence.match||p.presence.start))throw Error('coop:この部屋は出撃済みです。次の部屋に参加してください。');
        if(existing.length>=4)throw Error('coop:この部屋は4人で満員です。別の部屋に参加してください。');
        if(attempt!==token){await room.leave({keepPresence:true});return;}
        const r={room,uid:user.uid,epoch:attempt,peers:[],password,local:{v:3,ch,nick:api.nick().slice(0,12),coop:3,creator:mode==='create',joinedAt:Date.now(),ready:false,boss:selection,nonce:nonce(),cards:api.cards(ch),rounds:{}},state:null,match:'',busy:false,again:false,deadline:0,computed:0,selectedAction:'attack',selectedTarget:0,stampAt:0,completed:false,missing:0};run=r;ownedPresence=true;await room.presence(r.local);if(run!==r)return;
        r.unsubscribe=room.onPeers(({peers})=>{if(run!==r)return;r.peers=peers;pump(r);},()=>abort(r,'通信を確認できませんでした。退出して、もう一度参加してください。'));
        tick=setInterval(()=>{if(!ownerOK(r)){leave();return;}if(r.missing&&Date.now()-r.missing>30000){abort(r,'仲間との通信が戻らなかったため中止しました。報酬は発生しません。');return;}if(r.state?.status==='playing'&&r.deadline&&Date.now()>=r.deadline&&!r.local.rounds[r.state.turn])pick(r.state.players[r.side].hp<=0?{h:0,a:'guard',target:0}:{h:Math.floor(Math.random()*3),a:'guard',target:r.side%2});const timer=$('coop-timer');if(timer&&r.deadline)timer.textContent=String(Math.max(0,Math.ceil((r.deadline-Date.now())/1000)));},250);draw();
      }catch(e){if(run?.room===room){run?.unsubscribe?.();run=null;clearInterval(tick);tick=0;}if(room)try{await room.leave({keepPresence:!ownedPresence});}catch{}error(e.message?.startsWith('coop:')?e.message.slice(5):'部屋に入れませんでした。通信を確認して再試行してください。');}finally{joining=false;if(!run)for(const id of ['coop-join','coop-create'])if($(id))$(id).disabled=false;}
    }
    async function publish(r,patch){if(!ownerOK(r))return;Object.assign(r.local,patch);await r.room.presence(r.local);}
    function abort(r,message){if(run!==r)return;r.failed=message;r.deadline=0;draw();}
    const party=r=>r.peers.filter(p=>p.presence?.coop===3).map(p=>p.peer===r.uid&&p.presence.nonce===r.local.nonce?{...p,presence:r.local}:p).sort((a,b)=>(a.presence.joinedAt-b.presence.joinedAt)||(a.peer<b.peer?-1:a.peer>b.peer?1:0));
    const compatible=(r,p)=>p.presence.v===3&&p.presence.boss===r.local.boss&&api.validChar(p.presence.ch)&&typeof p.presence.nonce==='string'&&Number.isFinite(p.presence.joinedAt);
    async function launch(r){
      if(!ownerOK(r)||r.state||r.launching)return;const slots=party(r).slice(0,4);
      if(slots.length<2||slots[0].peer!==r.uid||!slots.every(p=>p.presence.ready&&compatible(r,p)))return;
      r.launching=true;try{await publish(r,{start:{roster:slots.map(p=>({uid:p.peer,nonce:p.presence.nonce}))}});pump(r);}catch{abort(r,'出撃を送信できませんでした。');}finally{r.launching=false;}
    }
    async function pump(r){if(r.busy){r.again=true;return;}r.busy=true;
      try{do{r.again=false;if(!ownerOK(r)||r.failed)break;if(r.completed){r.missing=0;draw();break;}
        const own=r.peers.find(p=>p.peer===r.uid)?.presence;
        if(own&&own.nonce!==r.local.nonce){abort(r,'同じアカウントが別の画面から参加しました。1人につき1画面で参加してください。');break;}
        const peers=party(r);
        if(!r.match){
          const creators=peers.filter(p=>p.presence.creator);
          if(r.local.creator&&creators.length>1&&creators[0].peer!==r.uid){abort(r,'同じあいことばで部屋が作成されました。別のあいことばで作成するか、退出して「部屋に参加」を選んでください。');await r.room.leave();break;}
          const proposal=peers.find(p=>p.presence.start)?.presence.start;
          if(!proposal){
            if(peers.some(p=>p.presence.match)){abort(r,'この部屋はすでに出撃しています。別のあいことばで参加してください。');break;}
            if(peers.findIndex(p=>p.peer===r.uid)>=4){abort(r,'この部屋は4人で満員です。別のあいことばを使ってください。');break;}
            if(peers.slice(0,4).some(p=>!compatible(r,p))){abort(r,'ボス選択またはゲームのバージョンが違います。同じ設定で入り直してください。');break;}
            draw();break;
          }
          const ids=proposal.roster;
          if(!Array.isArray(ids)||ids.length<2||ids.length>4||new Set(ids.map(x=>x.uid)).size!==ids.length)throw Error('invalid roster');
          if(!ids.some(x=>x.uid===r.uid&&x.nonce===r.local.nonce)){abort(r,'この部屋は出撃済み、または満員です。別のあいことばを使ってください。');break;}
          const leader=peers.find(p=>p.peer===ids[0].uid);
          if(!leader?.presence.start||JSON.stringify(leader.presence.start)!==JSON.stringify(proposal))throw Error('invalid leader');
          const members=ids.map(x=>peers.find(p=>p.peer===x.uid&&p.presence.nonce===x.nonce));
          if(members.some(p=>!p)){abort(r,'出撃前に仲間が退出しました。入り直してください。');break;}
          if(members.some(p=>!compatible(r,p)||!p.presence.ready))throw Error('party not ready');
          r.roster=members.map(p=>({uid:p.peer,nonce:p.presence.nonce,ch:p.presence.ch,cards:api.cleanCards(p.presence.cards),nick:String(p.presence.nick||'仲間').slice(0,12)}));r.side=r.roster.findIndex(p=>p.uid===r.uid);
          r.match=await api.sha(JSON.stringify([r.local.boss,r.roster]));if(!ownerOK(r))break;
          r.state=K.create(r.local.boss,r.roster,r.match,api.make);api.playEntryVoice?.(r.local.ch);r.digest=await api.sha(JSON.stringify(r.state));await publish(r,{match:r.match,ack:{turn:0,hash:r.digest}});r.again=true;
        }
        const members=r.roster.map(p=>p.uid===r.uid?r.local:r.peers.find(x=>x.peer===p.uid&&x.presence.nonce===p.nonce)?.presence);
        if(members.some(p=>!p)){if(!r.missing){r.missing=Date.now();draw();}break;}r.missing=0;
        if(members.some(p=>!p.match)){draw();break;}
        if(members.some(p=>p.match!==r.match)){abort(r,'参加情報が一致しません。入り直してください。');break;}
        const done=r.state.turn-1;
        if(members.some(p=>p.ack?.turn===done&&p.ack.hash!==r.digest)){abort(r,'戦闘結果が一致しないため中止しました。報酬は発生しません。');break;}
        if(r.state.status!=='playing'){
          if(members.every(p=>p.ack?.turn===done&&p.ack.hash===r.digest)&&!r.completed){r.completed=true;if(r.state.status==='win'&&ownerOK(r)){K.reward(api.cs(),r.state.id,r.match);api.save();}r.deadline=0;}draw();break;
        }
        // No player can move ahead before every party member acknowledges the previous result.
        if(members.some(p=>!p.ack||p.ack.turn<done)){draw();break;}if(!r.deadline)r.deadline=Date.now()+20000;
        const turn=r.state.turn,commits=members.map(p=>p.rounds?.[turn]),mine=commits[r.side];
        if(commits.some(p=>!p)){draw();break;}
        if(!mine.rv){await publish(r,{rounds:{...r.local.rounds,[turn]:{...mine,rv:r.secret}}});r.again=true;continue;}
        if(commits.some(p=>!p.rv)){draw();break;}
        const ordered=commits.map(p=>p.rv);
        for(let i=0;i<ordered.length;i++){const v=ordered[i];if(!K.validPick(v?.p)||typeof v.s!=='string'||v.s.length!==32||await api.sha(r.match+'|'+turn+'|'+K.encodePick(v))!==commits[i].c)throw Error('commit mismatch');}
        if(!ownerOK(r))break;
        const previous=r.state,picks=ordered.map(v=>v.p),bossHands=Array(previous.players.length).fill(null),alive=previous.players.map((p,i)=>p.hp>0?i:-1).filter(i=>i>=0);let duelIndex=0;
        r.state=K.step(previous,picks,ordered.map(v=>v.s),(...args)=>{const result=api.duel(...args);bossHands[alive[duelIndex++]]=result.bossHand??args[1];return result;});r.deadline=0;r.secret=null;
        if(api.animateRound){r.presenting=true;try{await api.animateRound(root,previous,r.state,picks,bossHands,()=>ownerOK(r)&&!r.failed);}catch(e){console.warn('共闘の演出を省略',e);}finally{r.presenting=false;}}
        if(!ownerOK(r)||r.failed)break;
        r.digest=await api.sha(JSON.stringify(r.state));await publish(r,{ack:{turn,hash:r.digest}});r.again=true;draw();
      }while(r.again&&ownerOK(r));}catch(e){console.warn('共闘を中止',e);abort(r,'通信または行動情報を確認できませんでした。退出して再参加してください。');}finally{r.busy=false;if(r.again&&ownerOK(r)&&!r.failed)pump(r);}
    }
    async function pick(p){const r=run;if(!r||r.failed||r.missing||!r.state||r.state.status!=='playing'||r.local.rounds[r.state.turn]||!r.deadline||r.picking)return;r.picking=true;try{const turn=r.state.turn,v={p,s:nonce()},c=await api.sha(r.match+'|'+turn+'|'+K.encodePick(v));if(!ownerOK(r)||r.state.turn!==turn)return;r.secret=v;await publish(r,{rounds:{...r.local.rounds,[turn]:{c}}});pump(r);}catch{abort(r,'行動を送信できませんでした。通信を確認してください。');}finally{r.picking=false;draw();}}
    function waiting(r,b){
      const slots=party(r).slice(0,4),leader=slots[0]?.peer===r.uid,count=slots.length,scale=K.scaling(Math.max(2,count)),ready=count>=2&&slots.every(p=>p.presence.ready&&compatible(r,p));
      shell('共闘の待合室',art(b)+'<h3>'+esc(b.name)+'</h3><p>あいことば：<b>'+esc(r.password)+'</b></p><p>参加 '+count+'/4人・2〜4人で挑戦</p><div class="coop-wait-party">'+Array.from({length:4},(_,i)=>{const p=slots[i];return p?'<div class="coop-wait-member">'+api.charPortrait(p.presence.ch)+'<b>'+esc(p.presence.nick||'仲間')+(p.peer===r.uid?'（あなた）':'')+'</b><span>'+(i===0?'リーダー・':'')+(p.presence.ready?'準備完了':'準備中')+'</span></div>':'<div class="coop-wait-member empty">仲間を募集中</div>';}).join('')+'</div><p class="coop-forecast">'+(count<2?'2人以上で出撃できます。2人時のボスHP ':count+'人で出撃時：ボスHP ')+Math.round(b.hp*scale.hp*100)/100+'／攻撃力 '+Math.round(scale.attack*100)+'%</p><p class="sub">人数に合わせてボスの強さが変わります。全員が準備完了したら、リーダーが出撃を選びます。</p><div class="row"><button class="btn primary" id="coop-ready">'+(r.local.ready?'準備を取り消す':'準備完了')+'</button>'+(leader?'<button class="btn primary" id="coop-launch"'+(!ready?' disabled':'')+'>'+(count<2?'仲間を待つ':'この'+count+'人で出撃')+'</button>':'<span class="sub">リーダーの出撃を待っています</span>')+'</div>');
      $('coop-ready').onclick=async()=>{try{await publish(r,{ready:!r.local.ready});pump(r);}catch{abort(r,'準備状態を送信できませんでした。');}};
      if($('coop-launch'))$('coop-launch').onclick=()=>launch(r);
    }
    function draw(){const r=run;if(!r){if(shown)open();return;}if(r.presenting&&!r.failed)return;const b=K.find(r.local.boss);if(r.failed){shell('共闘を中止',`<p role="alert">${esc(r.failed)}</p><p>コイン・メダルは消費されません。</p>`);return;}
      if(!r.state){waiting(r,b);return;}
      const s=r.state,f=K.forecast(s,r.side),locked=!!r.local.rounds[s.turn],over=s.status!=='playing',q=K.progress(api.cs());
      shell(over?(s.status==='win'?'討伐成功！':'討伐失敗'):'共闘ボス討伐',`<div class="row spread coop-battle-meta"><b>${esc(b.name)}</b><span>${s.players.length}人・${Math.min(s.turn,40)}/40ターン</span></div>
      <div class="coop-battle q-story-scene" data-count="${s.players.length}" data-scene="${b.scene}"><div class="coop-party">${s.players.map((p,i)=>`<div class="coop-hero${p.hp<=0?' down':''}"><div class="coop-hero-figure"><img src="img/chars/c${p.ch}.png" alt="${esc(api.charName(p.ch))}"></div><small class="coop-member-number">${i+1}${i===r.side?'・あなた':''}</small><span class="coop-player-name" title="${esc(r.roster[i].nick)}">${esc(r.roster[i].nick)}</span><meter min="0" max="${p.max}" value="${p.hp}"></meter><small>HP ${p.hp.toFixed(1)}/${p.max}</small></div>`).join('')}</div><div class="coop-enemy">${art(b)}<meter min="0" max="${s.max}" value="${s.hp}"></meter><small>HP ${s.hp.toFixed(1)}/${s.max}${b.rule==='heads'||b.rule==='twins'?`（左 ${s.parts[0]}／右 ${s.parts[1]}）`:''}</small></div></div>
      ${over?`<p class="q-rewards">${!r.completed?'仲間と戦闘結果を照合しています…':s.status==='win'?`${b.coins}コイン＋メダル${b.medals}枚を獲得！ 所持メダル ${q.medals}枚`:'作戦を変えて、もう一度挑もう。'}</p>`:`<p class="coop-forecast" role="status">${esc(f.text)}</p><p class="coop-turn-status">${r.missing?'仲間との通信を待っています（最大30秒）':!r.deadline?'仲間と前の結果を確認しています…':locked?'選択済み。仲間の行動を待っています…':`残り <b id="coop-timer">${Math.max(0,Math.ceil((r.deadline-Date.now())/1000))}</b>秒`}</p>
      <div class="coop-command-tools"><details class="coop-chat" id="coop-chat"${r.chatOpen?' open':''}><summary>チャット</summary><div class="coop-chat-panel"><div class="coop-stamps">${['グーでいこう','チョキでいこう','パーでいこう','手を分けよう','回復お願い','グーなし','チョキなし','パーなし'].map((x,i)=>`<button class="btn sm" data-coop-stamp="${i}">${x}</button>`).join('')}</div><div class="coop-chat-messages">${r.roster.filter(p=>p.uid!==r.uid).map(p=>'<p><b>'+esc(p.nick)+"</b><span>"+esc(['グーでいこう','チョキでいこう','パーでいこう','手を分けよう','回復お願い','グーなし','チョキなし','パーなし'][r.peers.find(x=>x.peer===p.uid)?.presence?.signal?.k]||'―')+'</span></p>').join('')}</div></div></details>
      <div class="row coop-choices"><label>行動<select id="coop-action">${Object.entries(C.actions).map(([key,label])=>`<option value="${key}"${r.selectedAction===key?' selected':''}>${label}</option>`).join('')}</select></label>${['heads','twins'].includes(b.rule)?`<label>狙う相手<select id="coop-target"><option value="0"${r.selectedTarget===0?' selected':''}>左</option><option value="1"${r.selectedTarget===1?' selected':''}>右</option></select></label>`:''}</div></div>
      <div class="coop-hands">${C.hands.map((h,i)=>`<button class="btn primary" data-coop-hand="${i}"${locked||r.missing||!r.deadline?' disabled':''}>${h}</button>`).join('')}</div>`}
      <details class="coop-battle-info${over?' coop-info-result':''}"${over?' open':''}><summary>ルール・戦闘ログ</summary><div class="coop-info-panel"><p class="sub">防御：被害を65%軽減。支援：ほかの仲間の被害を30%軽減しHPを12%回復（同じターンの支援は重複しません）。救助：倒れている仲間を1人、HP35%で復帰。支援・救助では攻撃しません。</p>${s.log.map(l=>`<p class="sub">${esc(l)}</p>`).join('')}</div></details>`);
      if($('coop-action'))$('coop-action').onchange=()=>r.selectedAction=$('coop-action').value;if($('coop-target'))$('coop-target').onchange=()=>r.selectedTarget=+$('coop-target').value;
      if($('coop-chat'))$('coop-chat').ontoggle=()=>{r.chatOpen=$('coop-chat').open;};
      root.querySelectorAll('[data-coop-hand]').forEach(btn=>btn.onclick=()=>pick({h:+btn.dataset.coopHand,a:r.selectedAction,target:r.selectedTarget}));
      root.querySelectorAll('[data-coop-stamp]').forEach(btn=>btn.onclick=()=>{if(Date.now()-r.stampAt<1200)return;r.stampAt=Date.now();publish(r,{signal:{k:+btn.dataset.coopStamp,n:r.stampAt}}).catch(()=>error('合図を送れませんでした。'));});
      api.mountStage?.(root,s);
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
