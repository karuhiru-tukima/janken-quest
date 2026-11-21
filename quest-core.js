/* Quest progress lives with coins in jq-cards: one save commits both. */
(() => {
  'use strict';
  const content=window.JQQuestContent,stories=content.stories;
  const chapters=new Map(stories.flatMap(s=>s.chapters.map(c=>[c.id,c])));
  const of=id=>chapters.get(String(id));
  function state(cs) {
    const q=cs.quest&&typeof cs.quest==='object'?cs.quest:{};
    const cleared=[...new Set(Array.isArray(q.cleared)?q.cleared:[])].filter(id=>chapters.has(id));
    const medals=[...new Set(Array.isArray(q.medals)?q.medals:[])].filter(id=>cleared.includes(id));
    return {cleared,medals,auto:q.auto===true,background:['default','stories','tower'].includes(q.background)?q.background:'default',
      entryOff:[...new Set(Array.isArray(q.entryOff)?q.entryOff:[])].filter(id=>stories.some(s=>s.id===id))};
  }
  const complete=(cs,id)=>stories.find(s=>s.id===id)?.chapters.every(c=>state(cs).cleared.includes(c.id))||false;
  const framed=(cs,id)=>stories.find(s=>s.id===id)?.chapters.every(c=>state(cs).medals.includes(c.id))||false;
  const all=cs=>state(cs).cleared.length===54;
  const unlocked=(cs,id)=>{const c=of(id);return !!c&&(c.number===1||state(cs).cleared.includes(c.id.split('-')[0]+'-'+(c.number-1)));};
  const lines=(cs,id)=>stories.find(s=>s.id===id)?.chapters.filter(c=>state(cs).cleared.includes(c.id)).map(c=>c.line)||[];
  const titles=cs=>stories.filter(s=>complete(cs,s.id)).map(s=>s.honor).concat(all(cs)?[content.allTitle]:[]);
  function clear(cs,id,medal) {
    const c=of(id);if(!c||!unlocked(cs,id))throw Error('Quest is locked');
    const q=state(cs),first=!q.cleared.includes(id),newMedal=!!medal&&!q.medals.includes(id);
    if(first)q.cleared.push(id);if(newMedal)q.medals.push(id);
    cs.quest=q;cs.coins=Math.max(0,Number(cs.coins)||0)+(first?c.coins:0);
    return {first,coins:first?c.coins:0,newMedal,chapter:c,complete:complete(cs,+id.split('-')[0]),all:all(cs)};
  }
  const goals={
    inv:n=>`無敵で攻撃を${n}回防ぐ`,charge:n=>`チャージを${n}回解放する`,heal:n=>`癒しの掌で${n}回回復する`,
    guts:()=> '不屈で踏みとどまる',streak:n=>`${n}連勝する`,draw:n=>`あいこを${n}回つなぐ`,lossWin:()=> '負けで力を蓄えた後に勝つ',
    counter:n=>`返しの刃で${n}回反撃する`,seal:()=> '相手の常時能力を封じて勝負する',force:n=>`強制したグーに${n}回勝つ`,
    pierce:n=>`チョキで守り・反射を${n}回貫く`,scar:()=> '体力半分以下の傷の炎で攻撃する',steady:n=>`グーの負けを不動の拳で${n}回受ける`,
    time:()=> '7手目以降に勝つ',mitsuG:()=> 'グーの反射を使う',mitsuCP:()=> 'チョキの攻撃とパーの回復を使う',mitsuAll:()=> '三つの型すべてを使う',
    first:()=> '最初のじゃんけんで勝つ',atk:()=> '攻撃モードになる',def:()=> '防御モードになる',both:()=> '攻撃・防御の両モードになる',
  };
  const goalText=c=>goals[c.goal[0]](c.goal[1]);
  function snapshot(b,h,res,group) {
    return {h,res,hp:b.p.hp,max:b.p.max,charge:!!b.p.charge,inv:!!b.p.inv,guts:!!b.p.guts,first:!b.p.ichi,
      mode:b.p.mode,tk:b.p.tk||0,losses:b.p.losses||0,
      guarded:group.some(x=>x.e.shield||x.e.abil.includes('spike')),
      forced:group.some(x=>x.e.forcedNow),sealed:group.some(x=>x.e.abil.some(a=>['king','gale','regen','mirage','rock','thunder'].includes(a)))};
  }
  function track(b,prev,result) {
    if(!b.quest)return;
    const m=b.quest.stats||(b.quest.stats={}),p=b.p;
    const events=[...Object.values(result.imp).flat(),...Object.values(result.post).flat(),...result.after];
    const add=(key,n=1)=>{m[key]=(m[key]||0)+n;};
    if(prev.res==='win') {
      m.streak=Math.max(m.streak||0,p.streak);
      if(prev.charge)add('charge');
      if(prev.h===2&&events.some(e=>e.k==='heal'&&e.amt>0))add('heal');
      if(prev.losses>0)add('lossWin');
      if(prev.forced)add('force');
      if(prev.h===1&&prev.guarded&&!events.some(e=>e.k==='evade'))add('pierce');
      if(prev.hp<=prev.max/2)add('scar');
      if(prev.tk>=7)add('time');
      if(prev.first)add('first');
      if(prev.h===1)add('mitsuC');
    }
    if(prev.res==='draw') {add('draw');if(prev.h===2&&events.some(e=>e.k==='heal'&&e.amt>0))add('mitsuP');if(prev.charge)add('charge');}
    if(prev.res==='lose'&&prev.h===0)add('steady');
    if(events.some(e=>e.k==='block')&&prev.inv)add('inv');
    if(!prev.guts&&p.guts)add('guts');
    if(events.some(e=>e.k==='counter'&&e.amt>0)){add('counter');if(prev.h===0&&prev.res==='lose')add('mitsuG');}
    if(prev.sealed)add('seal');
    if(p.mode==='atk')m.atk=1;if(p.mode==='def')m.def=1;
  }
  function achieved(c,m={}) {
    const [key,n]=c.goal;
    if(key==='both')return !!m.atk&&!!m.def;
    if(key==='mitsuCP')return !!m.mitsuC&&!!m.mitsuP;
    if(key==='mitsuAll')return !!m.mitsuG&&!!m.mitsuC&&!!m.mitsuP;
    return (m[key]||0)>=n;
  }
  window.JQQuestCore={of,state,complete,framed,all,unlocked,lines,titles,clear,goalText,snapshot,track,achieved};
})();
