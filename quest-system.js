(() => {
  'use strict';
  function create(api) {
    const {$,esc,getS,getCS,saveCS,openInfo,closeInfo,charFace,enemyPrevHTML,TPL,towerLoad}=api;
    const core=window.JQQuestCore,content=window.JQQuestContent;
    const find=id=>content.stories.find(s=>s.id===id);
    const state=()=>core.state(getCS());
    let selected=getS().charId,reading=0,dialogCleanup=()=>{};
    const rewardText=c=>`${c.coins}コイン・ホームのセリフ`+(c.number===3?'・称号・別アイコン・登場演出':'');
    function face(id,variant=false,frame=false) {
      const s=find(id),atlas=window.JQMotionAtlases['c'+id];
      let picture=charFace(id);
      if(variant&&atlas) {
        const portrait=a=>{const f=a.frames[26],size=Math.max(f[2]-f[0],(f[3]-f[1])*.53),x=f[0],y=f[1];return `<span class="q-victory-portrait" style="background-image:url('${a.src}');background-size:${a.width/size*100}% ${a.height/size*100}%;background-position:${x/(a.width-size)*100}% ${y/(a.height-size)*100}%"></span>`;};
        picture=portrait(atlas);
        if(id===18&&window.JQMotionAtlases.c18d)picture=`<span class="q-story-half red">${picture}</span><span class="q-story-half blue">${portrait(window.JQMotionAtlases.c18d)}</span>`;
      }
      return `<span class="q-portrait${variant?' story':''}${frame?' mastery':''}" style="--q-color:${api.charOf(id).color}">${picture}${variant?`<span class="q-emblem">${s.emblem}</span>`:''}</span>`;
    }
    function open(id=selected) {
      dialogCleanup();
      selected=find(id)?id:getS().charId;
      const s=find(selected),q=state(),cs=getCS(),live=getS().battle;
      const picker=`<label class="q-picker">物語を選ぶ<select id="q-character">${content.stories.map(x=>`<option value="${x.id}"${x.id===s.id?' selected':''}>${x.name}　${x.chapters.filter(c=>q.cleared.includes(c.id)).length}/3話</option>`).join('')}</select></label>`;
      const cards=s.chapters.map(c=>{
        const done=q.cleared.includes(c.id),medal=q.medals.includes(c.id),can=core.unlocked(cs,c.id);
        return `<section class="q-chapter${done?' clear':''}"><div class="row spread"><h3>第${c.number}話　${esc(c.title)}</h3><span class="q-status">${medal?'★ お題達成':done?'クリア':can?'挑戦可能':'前の話をクリアで解放'}</span></div><p>${esc(c.summary)}</p>
          <p class="sub">相手：${c.enemies.map(k=>esc(TPL[k].name)).join(' → ')}</p><p class="sub">追加のお題：${esc(core.goalText(c))}（物語の進行には不要）</p>
          <p class="q-rewards">初回：${esc(rewardText(c))}</p><button type="button" class="btn${can?' primary':''}" data-q-chapter="${c.id}"${can?'':' disabled'}>${done?'もう一度読む・挑む':'物語を読む'}</button></section>`;
      }).join('');
      openInfo('キャラ個別クエスト',`<div class="q-overview"><span class="badge">${face(s.id,core.complete(cs,s.id),core.framed(cs,s.id))}</span><div><b>${esc(s.name)}「${esc(s.title)}」</b><p class="sub">全18人・54話のうち ${q.cleared.length}話クリア／勲章 ${q.medals.length}/54</p></div></div>${picker}
        ${live?.quest&&!live.over?`<button type="button" class="btn" id="q-resume">途中のクエストに戻る：${esc(core.of(live.quest.id).title)}</button>`:''}${cards}
        <p class="sub">装備中のカードで戦います。各話の初回報酬は一度だけ。お題は再挑戦でも達成できます。</p>`,[['報酬・タイトル背景','',()=>rewards(s.id)]]);
      $('q-character').onchange=()=>open(+$('q-character').value);
      $('info-body').querySelectorAll('[data-q-chapter]').forEach(b=>b.onclick=()=>preview(b.dataset.qChapter));
      if($('q-resume'))$('q-resume').onclick=()=>{closeInfo();api.resumeBattle();};
    }
    function preview(id) {
      const c=core.of(id);if(!c||!core.unlocked(getCS(),id))return;
      const s=find(+id.split('-')[0]);selected=s.id;
      openInfo(`${s.name} 第${c.number}話　${c.title}`,`<p>${esc(c.summary)}</p><div class="info-sec"><h3>出てくる相手</h3>${c.enemies.map((k,i)=>enemyPrevHTML(TPL[k],`${i+1}体目`)).join('')}</div>
        <p>追加のお題：${esc(core.goalText(c))}</p><p class="sub">勝利で次の話へ。お題は達成できなくても進めます。</p><p class="q-rewards">初回報酬：${esc(rewardText(c))}</p>`,[['話の一覧','',()=>open(s.id)],['会話を始める','primary',()=>dialogue(c,'before',()=>requestBattle(c))]]);
    }
    function dialogue(c,kind,onEnd) {
      dialogCleanup();
      const token=++reading,s=find(+c.id.split('-')[0]),rows=c[kind];let index=0,auto=state().auto,autoTimer=0;
      const cancelTimer=()=>{clearTimeout(autoTimer);autoTimer=0;};
      const end=()=>{dialogCleanup();reading++;onEnd();};
      const advance=()=>{if(reading!==token)return;cancelTimer();if(++index<rows.length)draw();else end();};
      const schedule=()=>{
        cancelTimer();
        if(!auto||document.hidden)return;
        const delay=Math.min(14000,Math.max(2800,1800+rows[index].text.length*85));
        autoTimer=setTimeout(()=>{if(reading!==token||$('info').hidden||!$('q-dialogue-auto')){dialogCleanup();return;}if(!document.hidden)advance();},delay);
      };
      const visibility=()=>{if(document.hidden)cancelTimer();else schedule();};
      document.addEventListener('visibilitychange',visibility);
      dialogCleanup=()=>{cancelTimer();document.removeEventListener('visibilitychange',visibility);};
      const actor=row=>{
        const name=row.speaker;
        const enemy=c.enemies.map(k=>TPL[k]).find(e=>e.name.includes(name)||name.includes(e.name))
          || Object.values(TPL).find(e=>e.name===name||e.name.includes(name)&&name.length>=3);
        if(enemy)return {name,src:window.JQArt.actor('e',enemy.tk).body,enemyKey:enemy.tk,boss:!!enemy.boss};
        const role=/子|子供/.test(name)?'child':/師|老人|頭領/.test(name)?'master':/鍛冶|鉱夫|職人/.test(name)?'worker':/商人|座長/.test(name)?'merchant':/兵|受付|審判|門番|見張り/.test(name)?'soldier':/薬|手当|係員/.test(name)?'healer':/旅人|配達/.test(name)?'traveler':'villager';
        return {name,role,atlas:true};
      };
      const draw=()=>{
        const row=rows[index];
        const participants=rows.slice(0,index+1).filter(d=>d.speaker!==s.name&&d.speaker!=='語り');
        const blocking=window.JQQuestStaging.layout(c,kind,index);
        const isProtected=name=>blocking.cast.some(x=>x.name===name);
        const defending=blocking.protecting;
        const other=actor(defending?([...participants].reverse().find(d=>!isProtected(d.speaker))||{speaker:TPL[c.enemies[0]].name}):(participants[participants.length-1]||rows.find(d=>d.speaker!==s.name&&d.speaker!=='語り')||{speaker:'旅人'}));
        const allies=blocking.cast.map(person=>({...actor({speaker:person.name}),...person}));
        const narrator=row.speaker==='語り',heroTalk=row.speaker===s.name;
        openInfo(`${s.name} 第${c.number}話　${c.title}`,`<div class="q-story-toolbar"><span>${kind==='before'?'物語':'後日談'}　${index+1}/${rows.length}</span><div><button type="button" class="btn sm" id="q-dialogue-auto" aria-pressed="${auto}">オート：${auto?'ON':'OFF'}</button><button type="button" class="btn sm" id="q-dialogue-log">会話ログ</button><button type="button" class="btn sm" id="q-dialogue-skip">スキップ</button></div></div>
          <div class="q-story-scene${defending?' q-protect-scene':''}" data-scene="${c.stage?.scene||'village'}" data-phase="${kind}" data-allies="${allies.filter(a=>a.side==='left').length}"><span class="q-location">${esc(c.stage?.location||c.title)}</span>
            ${allies.map((ally,i)=>`<div class="q-story-person protected${ally.side==='far'?' far':''}${blocking.retreating?' retreating':''}${row.speaker===ally.name?' speaking':''}" data-side="${ally.side}" data-facing="${ally.facing}" style="--cast-order:${i}">${ally.atlas?`<span class="q-npc-sprite" data-role="${ally.role}" role="img" aria-label="${esc(ally.name)}"></span>`:`<img src="${ally.src}" data-quest-enemy="${ally.enemyKey}" alt="${esc(ally.name)}">`}<span>${esc(ally.name)}${blocking.retreating?'（避難へ）':''}</span></div>`).join('')}
            <div class="q-story-person hero${heroTalk?' speaking':''}"><img src="img/chars/c${s.id}.png" alt="${s.name}"><span>${s.name}</span></div>
            <div class="q-story-person guest${!narrator&&!heroTalk&&!isProtected(row.speaker)?' speaking':''}" data-facing="left" data-boss="${other.boss?'true':'false'}">${other.atlas?`<span class="q-npc-sprite" data-role="${other.role}" role="img" aria-label="${esc(other.name)}"></span>`:`<img src="${other.src}" data-quest-enemy="${other.enemyKey}" alt="${esc(other.name)}">`}<span class="q-person-name">${esc(other.name)}</span></div>
          </div>
          <div class="q-dialogue${narrator?' narration':''}" aria-live="polite"><span class="q-speaker">${narrator?esc(c.stage?.location||'物語'):esc(row.speaker)}</span><p>${esc(row.text)}</p></div>`,[
          ['話の一覧','',()=>{dialogCleanup();reading++;open(s.id);}],
          [index+1<rows.length?'次へ':kind==='before'?'戦闘へ':'クリア報酬へ','primary',advance],
        ]);
        $('q-dialogue-skip').onclick=()=>{if(reading!==token)return;end();};
        $('q-dialogue-auto').onclick=()=>{auto=!auto;const q=state();q.auto=auto;getCS().quest=q;saveCS();$('q-dialogue-auto').textContent='オート：'+(auto?'ON':'OFF');$('q-dialogue-auto').setAttribute('aria-pressed',String(auto));schedule();};
        $('q-dialogue-log').onclick=()=>{
          cancelTimer();
          openInfo('ここまでの会話',`<div class="q-conversation-log">${rows.slice(0,index+1).map(d=>`<p><b>${esc(d.speaker==='語り'?'情景':d.speaker)}</b><br>${esc(d.text)}</p>`).join('')}</div>`,[['会話に戻る','primary',draw],['会話スキップ','',()=>{if(reading!==token)return;end();}]]);
        };
        $('info').querySelector('.info-modal').scrollTop=0;
        schedule();
      };draw();
    }
    function requestBattle(c) {
      const b=getS().battle;
      if(b&&!b.over) {
        openInfo('途中のバトルがあります','<p>現在のバトルに戻るか、終了してこのクエストを始めるか選んでください。</p>',[
          ['元のバトルに戻る','',()=>{closeInfo();api.resumeBattle();}],
          ['終了してクエストへ','primary',()=>api.begin(c)],
        ]);return;
      }
      api.begin(c);
    }
    function finish(b,won) {
      const c=core.of(b.quest.id),s=find(b.quest.charId);
      if(!c||getS().charId!==s.id)throw Error('Invalid quest battle');
      b.over=true;
      if(won) {
        const reward=core.clear(getCS(),c.id,core.achieved(c,b.quest.stats));
        saveCS();api.leaveBattle();
        dialogue(c,'after',()=>showClear(s,c,reward));
      } else {
        const enemy=b.slots.find(Boolean);api.leaveBattle();
        openInfo(`${c.title}　再挑戦`, `<p>ここまでのクリア記録や報酬は失われません。</p><p class="sub">${enemy?`${esc(enemy.name)}：${esc(enemy.hint)}`:''}</p><p>お題は任意です。まずは勝利を目指してみよう。</p>`,[
          ['話の一覧','',()=>open(s.id)],['もう一度','primary',()=>api.begin(c)],
        ]);
      }
    }
    function showClear(s,c,r) {
      const cs=getCS(),buttons=[['話の一覧','',()=>open(s.id)],['報酬を見る','',()=>rewards(s.id)]];
      if(c.number<3)buttons.push(['次の話へ','primary',()=>preview(s.chapters[c.number].id)]);
      else buttons.push(['ホームへ','primary',()=>{closeInfo();api.home();}]);
      openInfo(`第${c.number}話 クリア！`, `<div class="q-clear"><span class="badge">${face(s.id,core.complete(cs,s.id),core.framed(cs,s.id))}</span><h3>${esc(c.title)}</h3><p>${r.first?`+${r.coins}コイン`:'初回報酬は受け取り済みです'}</p>
        ${r.first?`<p>ホームのセリフ解放<br>「${esc(c.line)}」</p>`:''}<p>${r.newMedal?'★ お題の勲章を獲得！':state().medals.includes(c.id)?'★ お題達成済み':`お題：${esc(core.goalText(c))}　再挑戦できます`}</p>
        ${c.number===3?`<p>称号「${esc(s.honor)}」・別アイコン・専用登場演出を解放！</p>`:''}
        ${core.framed(cs,s.id)?'<p>3話のお題達成：専用の飾り枠を解放！</p>':''}${r.all?`<p>全54話クリア！ 称号「${content.allTitle}」と18人のタイトル背景を解放！</p>`:''}</div>`,buttons);
    }
    function backgrounds() {return [{id:'default',name:'いつもの夜',owned:true},{id:'tower',name:'試練の塔・制覇の夜明け',owned:towerLoad().best>=50},{id:'stories',name:'十八の物語・旅の仲間たち',owned:core.all(getCS())}];}
    function backgroundOptions() {const q=state();return backgrounds().map(b=>`<option value="${b.id}"${q.background===b.id?' selected':''}${b.owned?'':' disabled'}>${b.name}${b.owned?'':'（未解放）'}</option>`).join('');}
    function chooseBackground(value) {
      if(!backgrounds().some(b=>b.id===value&&b.owned))return;
      const q=state();q.background=value;getCS().quest=q;saveCS();prepareTitle();
    }
    function rewards(id=selected) {
      selected=id;
      const s=find(id),cs=getCS(),q=state(),done=core.complete(cs,id),mastery=core.framed(cs,id);
      openInfo('報酬・タイトル背景',`<div class="q-overview"><span class="badge">${face(id,done,mastery)}</span><div><b>${s.name}の報酬</b><p class="sub">${s.chapters.filter(c=>q.cleared.includes(c.id)).length}/3話・勲章 ${s.chapters.filter(c=>q.medals.includes(c.id)).length}/3</p></div></div>
        <ul class="q-reward-list">${s.chapters.map(c=>`<li>${q.cleared.includes(c.id)?'✓':'□'} 第${c.number}話：${esc(rewardText(c))}</li>`).join('')}<li>${done?'✓':'□'} 称号「${s.honor}」</li><li>${mastery?'✓':'□'} 勲章3つ：専用の飾り枠</li></ul>
        <p class="sub">別アイコン・飾り枠・称号は、ホーム左上のプロフィールから選べます。</p>
        ${done?`<label class="pf-chk"><input id="q-entry-enabled" type="checkbox"${q.entryOff.includes(id)?'':' checked'}>${s.name}の専用登場演出を使う</label><button type="button" class="btn" id="q-entry-preview">登場演出を見る</button><div id="q-entry-stage" class="q-entry-stage"></div>`:''}
        <label class="pf-row">タイトル画面の背景<select id="q-background">${backgroundOptions()}</select></label>
        <p class="sub">塔50階突破で「制覇の夜明け」、全54話クリアで「旅の仲間たち」が解放されます。51階以降も塔に挑戦できます。</p>
        <button type="button" class="btn" id="q-background-preview">選んだ背景を見る</button>
        <p>${core.all(cs)?'✓':'□'} 全54話：称号「${content.allTitle}」</p>`,[['クエストへ','',()=>open(id)]]);
      $('q-background').onchange=()=>chooseBackground($('q-background').value);
      $('q-background-preview').onclick=previewBackground;
      if(done) {
        $('q-entry-enabled').onchange=()=>{const q=state();q.entryOff=q.entryOff.filter(x=>x!==id);if(!$('q-entry-enabled').checked)q.entryOff.push(id);getCS().quest=q;saveCS();};
        $('q-entry-preview').onclick=()=>entry($('q-entry-stage'),id,true);
      }
    }
    function titleArt(value) {
      if(value==='stories')return `<img class="q-reward-title" src="img/quest-scenes/stories-title-v1.png" alt=""><div class="q-party-title" aria-hidden="true">${content.stories.map(s=>`<img src="img/chars/c${s.id}.png" alt="" loading="eager">`).join('')}</div>`;
      if(value==='tower')return '<img class="q-reward-title" src="img/quest-scenes/tower-title-v1.png" alt="">';
      return '';
    }
    function prepareTitle() {
      const boot=$('boot');if(!boot)return;
      const q=state(),chosen=backgrounds().find(b=>b.id===q.background&&b.owned)?.id||'default';
      boot.dataset.questBackground=chosen;
      let art=$('q-title-art');if(!art){art=document.createElement('div');art.id='q-title-art';boot.prepend(art);}art.innerHTML=titleArt(chosen);
      if(backgrounds().filter(b=>b.owned).length>1) {
        let picker=$('q-title-picker');if(!picker){picker=document.createElement('label');picker.id='q-title-picker';picker.className='q-title-picker';picker.innerHTML='タイトル背景<select id="q-title-choice"></select>';boot.querySelector('.boot-in').append(picker);}
        $('q-title-choice').innerHTML=backgroundOptions();$('q-title-choice').onchange=()=>chooseBackground($('q-title-choice').value);
      }
    }
    function previewBackground() {
      const q=state(),value=backgrounds().some(b=>b.id===q.background&&b.owned)?q.background:'default';
      openInfo('タイトル背景のプレビュー',`<div class="q-background-preview" data-quest-background="${value}">${titleArt(value)}<div class="q-preview-logo">じゃんけん<br>クエスト</div></div><p class="sub">選択は保存済みです。次にスタート画面を開くと表示されます。</p>`,[['報酬へ戻る','',()=>rewards()]]);
    }
    function entry(target,id,force=false) {
      if(!target||(!force&&(!core.complete(getCS(),id)||state().entryOff.includes(id))))return;
      const s=find(id),effect=document.createElement('div');effect.className='q-entry-effect q-entry-'+id;effect.style.setProperty('--q-accent',api.charOf(id).color);
      effect.innerHTML=`<span class="q-entry-symbol">${s.emblem}</span><b>${s.entry}</b>`;effect.setAttribute('role','status');
      target.querySelectorAll('.q-entry-effect').forEach(el=>el.remove());target.append(effect);
      if(!window.matchMedia('(prefers-reduced-motion: reduce)').matches)effect.addEventListener('animationend',event=>{if(event.target===effect)effect.remove();});
      setTimeout(()=>effect.remove(),2600);
    }
    return {open,preview,finish,rewards,face,entry,prepareTitle,chooseBackground,backgrounds};
  }
  window.JQQuests={create};
})();
