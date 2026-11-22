/* Shared character atlases and hand artwork; presentation never changes battle state. */
(() => {
  'use strict';
  function create(api){
    const views=new WeakMap();
    let bossAtlas;
    function fitBoss(root,id){
      const art=root.querySelector('.coop-enemy .coop-boss-art'),boss=window.JQCoopContent.bosses.find(b=>b.id===id);if(!art||!boss)return;
      if(!bossAtlas)bossAtlas=new Promise((resolve,reject)=>{const image=new Image();image.onload=()=>resolve(image);image.onerror=reject;image.src='img/coop/bosses-v2.png?v='+window.JQ_VER;});
      bossAtlas.then(image=>{
        if(!art.isConnected)return;
        const w=image.naturalWidth/4,h=image.naturalHeight/4,sx=boss.index%4*w,sy=Math.floor(boss.index/4)*h;
        const sample=document.createElement('canvas');sample.width=w;sample.height=h;const g=sample.getContext('2d',{willReadFrequently:true});g.drawImage(image,sx,sy,w,h,0,0,w,h);
        const data=g.getImageData(0,0,w,h).data;let l=w,t=h,r=0,b=0;
        for(let y=0;y<h;y++)for(let x=0;x<w;x++)if(data[(y*w+x)*4+3]>=224){l=Math.min(l,x);t=Math.min(t,y);r=Math.max(r,x+1);b=Math.max(b,y+1);}
        if(r<=l||b<=t)return;
        const canvas=document.createElement('canvas');canvas.width=256;canvas.height=256;canvas.className='coop-boss-fitted';canvas.setAttribute('aria-hidden','true');
        const out=canvas.getContext('2d');out.imageSmoothingEnabled=false;const scale=Math.min(236/(r-l),236/(b-t)),dw=Math.round((r-l)*scale),dh=Math.round((b-t)*scale);
        out.drawImage(sample,l,t,r-l,b-t,Math.round((256-dw)/2),248-dh,dw,dh);art.replaceChildren(canvas);art.style.backgroundImage='none';
      }).catch(()=>{bossAtlas=null;});
    }
    function mount(root,state){
      const figures=[...root.querySelectorAll('.coop-hero-figure')];
      const actors=figures.map((figure,i)=>{
        const player=state.players[i],actor=api.actor(player.ch,player.mode);
        const mark=figure.querySelector('.coop-member-mark');figure.replaceChildren(actor);if(mark)figure.append(mark);actor.classList.add('coop-actor');
        actor.setAttribute('aria-label',api.name(player.ch));
        api.play(actor,player.hp<=0?'lose':state.status==='win'?'win':'idle',{loop:state.status==='win'});
        return actor;
      });
      views.set(root,{figures,actors,enemy:root.querySelector('.coop-enemy'),battle:root.querySelector('.coop-battle')});
      fitBoss(root,state.id);
    }
    async function round(root,previous,next,picks,bossHands,valid,effects=[]){
      let view=views.get(root);if(!view?.battle?.isConnected)return;
      const {figures,actors,enemy,battle}=view;
      const wait=ms=>new Promise(resolve=>setTimeout(resolve,api.duration(ms)));
      root.querySelectorAll('.coop-hands button,.coop-stamps button,.coop-choices select,.coop-choices .jq-select-trigger').forEach(b=>b.disabled=true);
      const call=document.createElement('div');call.className='coop-janken-call';call.setAttribute('role','status');battle.append(call);
      const active=previous.players.map(p=>p.hp>0),reduced=window.matchMedia('(prefers-reduced-motion: reduce)').matches;
      for(const word of ['じゃん','けん']){
        if(!valid())return;call.textContent=word;
        actors.forEach((actor,i)=>{if(active[i])api.play(actor,'G',{fps:10});});
        if(!reduced)enemy?.animate?.([{translate:'0 0'},{translate:'0 -5px'},{translate:'0 0'}],{duration:api.duration(360),easing:'ease-out'});
        await wait(420);
      }
      if(!valid())return;call.textContent='ぽん！';
      const enemyHands=document.createElement('div');enemyHands.className='coop-enemy-hands';enemyHands.setAttribute('aria-label','仲間それぞれに対するボスの手');
      actors.forEach((actor,i)=>{
        if(!active[i])return;
        api.play(actor,['G','C','P'][picks[i].h],{fps:20});
        const bubble=document.createElement('div');bubble.className='coop-hand-bubble';bubble.innerHTML=api.hand(picks[i].h);figures[i].append(bubble);
        const reply=document.createElement('div');reply.className='coop-enemy-hand';reply.setAttribute('aria-label',String(i+1)+'人目へのボスの手');reply.innerHTML='<small>'+String(i+1)+'へ</small>'+api.hand(bossHands[i]);enemyHands.append(reply);
      });
      enemy?.prepend(enemyHands);
      if(!reduced)enemy?.animate?.([{translate:'0 0'},{translate:'-7px 0'},{translate:'0 0'}],{duration:api.duration(300),easing:'ease-out'});
      await wait(1050);
      if(!valid())return;call.textContent=next.status==='win'?'討伐！':'決着';
      let activated=false;
      effects.forEach((items,i)=>{const effect=items[0];if(!effect)return;activated=true;const pop=document.createElement('div');pop.className='coop-ability-pop';pop.dataset.kind=effect.kind;const label=document.createElement('small');label.textContent=effect.kind==='card'?'アルカナ':'能力発動';const name=document.createElement('b');name.textContent=effect.name;pop.append(label,name);figures[i].append(pop);});
      if(activated)call.hidden=true;
      actors.forEach((actor,i)=>api.play(actor,next.players[i].hp<=0?'lose':next.status==='win'?'win':next.players[i].hp<previous.players[i].hp?'hurt':'idle',{then:'idle'}));
      if(!reduced&&next.hp<previous.hp)enemy?.animate?.([{translate:'0 0',filter:'brightness(1)'},{translate:'5px 0',filter:'brightness(1.8)'},{translate:'-4px 0',filter:'brightness(1)'},{translate:'0 0'}],{duration:api.duration(360)});
      await wait(activated?1250:450);
    }
    return {mount,round};
  }
  window.JQCoopStage={create};
})();
