(() => {
  'use strict';
  const C=window.JQCoopContent,find=id=>C.bosses.find(b=>b.id===id),copy=x=>JSON.parse(JSON.stringify(x)),round=n=>Math.round(n*100)/100;
  const outcome=(a,b)=>a===b?0:(a-b+3)%3===2?1:-1;
  function rng(seed){let n=2166136261;for(const c of seed){n=Math.imul(n^c.charCodeAt(0),16777619);}return()=>{n=(Math.imul(n,1664525)+1013904223)|0;return(n>>>0)/4294967296;};}
  function create(id,players,seed,make){const b=find(id);if(!b||players.length!==2)throw Error('Invalid encounter');return {id,seed,turn:1,hp:b.hp,max:b.hp,players:players.map(p=>make(p.ch,p.cards)),last:[null,null],heat:0,clock:4,bound:-1,egg:false,parts:[b.hp/2,b.hp/2],deadTurns:0,log:['討伐開始！ '+b.name],status:'playing'};}
  function pattern(s){const b=find(s.id);return b.rule==='final'?['same','split','interrupt'][(s.turn-1)%3]:b.rule;}
  function forecast(s,side){const b=find(s.id),r=rng(s.seed+'|forecast|'+s.turn),base=Math.floor(r()*3),p=pattern(s),target=(s.turn-1)%2;
    let favored=base;if(p==='mirror'&&s.last[target]!==null)favored=(s.last[target]+2)%3;
    let text={same:'結界：同じ手で2人とも勝てば大きく崩せる',focus:`集中攻撃：${target+1}人目を狙っている`,shell:'鉄の殻：2人の同時勝利で開く',heads:'双頭：左右を分担して同時に倒そう',lightning:'帯電：同じ手で雷を分散できる',clues:'霧：2人の手がかりを合わせよう',heat:`炉心の熱 ${s.heat}/4：支援で冷却`,bind:s.bound>=0?`${s.bound+1}人目が拘束中：相方の支援で解放`:'長い腕：4ターンごとに仲間を捕まえる',mirror:'鏡の構え：前回の手を狙ってくる',clock:`大技まで砂 ${s.clock}：同時勝利で巻き戻す`,rebirth:s.egg?'再生の卵：支援で回復を抑えよう':'残火：倒した後の再生にも備えよう',repeat:'型の記録：前回と違う手で挑もう',twins:'日と月：別々の竜を狙ってHPを揃えよう',roles:`王の命令：${target+1}人目は攻撃、${2-target}人目は支援`,split:'連続攻撃：違う手で被害を軽減',interrupt:'大技の溜め：2人の同時勝利で阻止'}[p];
    if(p==='clues')text+=`／あなたの手がかり：${C.hands[(favored+1+side)%3]}は出さない`;
    else text+=`／${C.hands[favored]}が出やすい`;
    return {text,favored,target,pattern:p};
  }
  function hand(s,index,salts){const f=forecast(s,index),r=rng(s.seed+'|'+s.turn+'|'+salts.join('|')+'|'+index);if(f.pattern==='clues')return f.favored;return r()<.75?f.favored:Math.floor(r()*3);}
  function validPick(p){return !!p&&Number.isInteger(p.h)&&p.h>=0&&p.h<=2&&Object.hasOwn(C.actions,p.a)&&Number.isInteger(p.target)&&p.target>=0&&p.target<=1;}
  function step(prev,picks,salts,duel){if(prev.status!=='playing'||picks.length!==2||!picks.every(validPick))throw Error('Invalid turn');const s=copy(prev),b=find(s.id),f=forecast(s,0),pat=f.pattern,logs=[],startHP=s.players.map(p=>p.hp),alive=startHP.map(h=>h>0),wins=[false,false],damage=[0,0],incoming=[0,0];
    const same=picks[0].h===picks[1].h,support=picks.map((p,i)=>alive[i]&&p.a==='support'),target=f.target;
    const heal=(i,n)=>{if(s.players[i].hp>0)s.players[i].hp=round(Math.min(s.players[i].max,s.players[i].hp+n));};
    for(let i=0;i<2;i++){
      if(!alive[i])continue;
      const p=s.players[i],pick=picks[i],bh=hand(s,i,salts),wasFirst=!p.ichi,old=copy(p);wins[i]=outcome(pick.h,bh)===1;
      const result=duel(p,bh,pick.h,b,s,salts.join('|')+'|'+i);s.players[i]=result.player;
      const actualHand=result.bossHand??bh;wins[i]=outcome(pick.h,actualHand)===1;
      damage[i]=Math.max(0,result.damage);incoming[i]=Math.max(0,old.hp-result.player.hp);
      if(p.ch===17&&wasFirst&&wins[i])damage[i]=Math.min(damage[i],old.atk*6);
      if(pick.a!=='attack')damage[i]*=pick.a==='guard'?.35:0;
      if(pick.a==='guard'){incoming[i]*=.35;}
      if(support[1-i])incoming[i]*=.7;
      if(pat==='focus'){incoming[i]*=i===target?1.6:.25;}
      if(pat==='lightning'&&s.turn%3===0)incoming[i]*=same?.5:1.8;
      if(pat==='split')incoming[i]*=same?1.7:.45;
      if(pat==='repeat'&&pick.h===s.last[i]){damage[i]*=.4;incoming[i]*=1.5;logs.push(`${i+1}人目の同じ型を読まれた！`);}
      if(pat==='roles'&&((i===target&&pick.a!=='attack')||(i!==target&&pick.a!=='support'))){damage[i]*=.4;incoming[i]+=1;logs.push(`${i+1}人目に王冠の呪い！`);}
      if(pat==='bind'&&s.bound===i)damage[i]=0;
      // Preserve all original ability/card healing and lethal protection while scaling incoming hits.
      if(old.hp-result.player.hp>0)s.players[i].hp=round(Math.max(0,old.hp-incoming[i]));
      logs.push(`${i+1}人目 ${C.hands[pick.h]}／${C.actions[pick.a]} → 敵 ${C.hands[actualHand]}（${wins[i]?'勝ち':pick.h===actualHand?'あいこ':'負け'}）`);
    }
    const both=alive.every(Boolean)&&wins.every(Boolean);
    if(pat==='same'){const ok=same&&both;damage[0]*=ok?2:.35;damage[1]*=ok?2:.35;if(ok)logs.push('同じ手の連携で結界破壊！');}
    if(pat==='shell'){damage[0]*=both?2:.4;damage[1]*=both?2:.4;if(both)logs.push('2人の同時勝利！ 鉄の殻が開いた！');}
    if(pat==='heat'){s.heat=Math.max(0,s.heat+picks.filter((p,i)=>alive[i]&&p.a==='attack').length-support.filter(Boolean).length*2);if(s.heat>=4){s.players.forEach(p=>{p.hp=round(Math.max(0,p.hp-3));});s.heat=0;logs.push('炉心が過熱！ 全員に3ダメージ');}}
    if(pat==='clock'){s.clock=Math.min(6,s.clock+(both?2:-1));if(s.clock<=0){s.players.forEach(p=>p.hp=round(Math.max(0,p.hp-4)));s.clock=4;logs.push('時の砂が尽きた！ 全員に4ダメージ');}}
    if(pat==='interrupt'&&!both){s.players.forEach(p=>p.hp=round(Math.max(0,p.hp-(s.hp<s.max/2?4:3))));logs.push('大技を止められなかった！');}
    if(pat==='bind'){if(s.bound>=0&&support[1-s.bound]){logs.push('仲間を拘束から救出！');s.bound=-1;}else if(s.bound>=0)s.players[s.bound].hp=Math.max(0,s.players[s.bound].hp-1);if(s.turn%4===0&&s.bound<0){s.bound=target;logs.push(`${target+1}人目が腕に捕まった！`);}}
    // Rescue is simultaneous: a hero who was alive when choosing can rescue an already downed partner.
    for(let i=0;i<2;i++)if(alive[i]&&picks[i].a==='rescue'&&!alive[1-i]){s.players[1-i].hp=round(s.players[1-i].max*.35);s.players[1-i].doom=false;logs.push(`${i+1}人目が仲間を救助！`);}
    for(let i=0;i<2;i++)if(support[i]){heal(i,s.players[i].max*.05);heal(1-i,s.players[1-i].max*.12);}
    if(pat==='heads'||pat==='twins'){
      for(let i=0;i<2;i++)s.parts[picks[i].target]=round(Math.max(0,s.parts[picks[i].target]-damage[i]));
      if(s.parts.some(h=>h<=0)&&s.parts.some(h=>h>0)){s.deadTurns++;if(pat==='twins'||s.deadTurns>=3){const dead=s.parts.findIndex(h=>h<=0);s.parts[dead]=round(s.max*.12);s.deadTurns=0;logs.push('残った相方の力で再生した！');}}
      s.hp=round(s.parts[0]+s.parts[1]);
    }else s.hp=round(Math.max(0,s.hp-damage[0]-damage[1]));
    if(pat==='rebirth'&&!s.egg&&s.hp<=0){s.egg=true;s.hp=round(s.max*.35);logs.push('残火が卵に変わった！');}
    else if(pat==='rebirth'&&s.egg&&s.hp>0&&!support.some(Boolean)){s.hp=round(Math.min(s.max*.35,s.hp+2));logs.push('炎が卵を再生した。支援で抑えよう');}
    s.last=picks.map(p=>p.h);s.log=logs.concat(`ボスへ ${round(damage[0]+damage[1])} ダメージ`);
    // A party wipe is a loss even when the boss falls simultaneously.
    s.status=s.players.every(p=>p.hp<=0)?'lose':s.hp<=0?'win':s.turn>=40?'lose':'playing';s.turn++;
    return s;
  }
  function progress(cs){const q=cs.coop||{};return {medals:Math.max(0,Number(q.medals)||0),cleared:[...new Set(Array.isArray(q.cleared)?q.cleared:[])].filter(find),receipts:Array.isArray(q.receipts)?q.receipts.filter(x=>typeof x==='string').slice(-100):[],owned:Array.isArray(q.owned)?q.owned.filter(x=>typeof x==='string'):[],frame:typeof q.frame==='string'?q.frame:'',background:typeof q.background==='string'?q.background:''};}
  function reward(cs,id,match){const b=find(id),q=progress(cs);if(!b||typeof match!=='string'||!match)throw Error('Invalid reward');if(q.receipts.includes(match))return false;q.receipts.push(match);q.receipts=q.receipts.slice(-100);q.medals+=b.medals;if(!q.cleared.includes(id))q.cleared.push(id);cs.coop=q;cs.coins=Math.max(0,Number(cs.coins)||0)+b.coins;return true;}
  function exchange(cs,id,type){const b=find(id),q=progress(cs),key=id+':'+type;if(!b||!['title','frame','background'].includes(type)||!q.cleared.includes(id)||q.owned.includes(key))return false;const cost=({title:3,frame:6,background:10}[type])*(b.tier+1);if(q.medals<cost)return false;q.medals-=cost;q.owned.push(key);if(type!=='title')q[type]=id;cs.coop=q;return true;}
  const titles=cs=>{const q=progress(cs);return C.bosses.filter(b=>q.owned.includes(b.id+':title')).map(b=>b.title).concat(q.cleared.length===15?[C.allTitle]:[]);};
  window.JQCoopCore={find,rng,create,forecast,hand,step,progress,reward,exchange,titles,validPick,outcome};
})();
