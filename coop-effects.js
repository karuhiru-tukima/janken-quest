/* Presentation metadata from the actual ability resolver; never part of match state. */
(() => {
  'use strict';
  const titles=['','鉄壁の拳','二刀の刃','癒しの掌','不屈の男','連撃の風','凪の構え','逆境の牙','岩の守り','返しの刃','封じの札','包みの掌','穿ちの刃','傷の炎','不動の拳','刻の構え','三つの型','一閃の刃','攻守の構え'];
  function describe({before,player,out,h,bossHand}){
    const own=[...out.pre,...out.imp,...out.after].filter(x=>x.side==='A').map(x=>x.ev),has=k=>own.some(e=>e.k===k),ch=player.ch,result=out.res,effects=[];
    const add=(name,detail,kind='character')=>{if(!effects.some(e=>e.name===name&&e.detail===detail))effects.push({name,detail,kind});};
    const ability=detail=>add(titles[ch],detail);
    if(ch===1){if(!before.inv&&player.inv)ability('次の負けを無敵で防ぐ');else if(before.inv&&!player.inv&&has('block'))ability('無敵でダメージを防いだ');}
    if(ch===2){if(has('charge'))ability('チャージを蓄えた');if(before.charge&&(result==='win'||result==='draw'))ability(result==='win'?'チャージで攻撃を強化':'チャージを解放した');}
    if(ch===3&&result==='win'&&h===2&&has('heal'))ability('HPを回復した');
    if(ch===4&&(has('guts')||own.some(e=>e.k==='block'&&e.text==='不屈の体')))ability(has('guts')?'踏みとどまり、HPを回復した':'不屈の体で耐えた');
    if(ch===5&&player.ab===5&&result==='win'&&player.streak>=2)ability('連勝で攻撃を強化');
    if(ch===6&&result==='draw'&&player.streak>before.streak)ability('あいこでも連勝数が増えた');
    if(ch===7&&player.losses>before.losses&&player.losses<=5)ability('逆境で攻撃力が上がった');
    if(ch===8&&(has('def')||result==='lose'&&player.hp<before.hp))ability('受けるダメージを軽減');
    if(ch===9&&own.some(e=>e.k==='counter'&&e.amt>0))ability('受けた攻撃に反撃した');
    if(ch===10&&out.lines.some(l=>l.includes('（封じ ')))ability('封じた相手への攻撃を強化');
    if(ch===11&&[...out.pre,...out.imp,...out.after].some(e=>e.side==='B'&&e.ev.k==='forceG'))ability('相手の次の手をグーに固定');
    if(ch===12&&result==='win'&&h===1)ability('守りを無視する攻撃');
    if(ch===13&&player.ab===13&&result==='win'&&before.hp<before.max)ability('減ったHPに応じて攻撃を強化');
    if(ch===14&&result==='lose'&&h===0)ability('相手の攻撃力アップを無効化');
    if(ch===15&&own.some(e=>e.k==='fool'&&e.text?.includes('刻の構え')))ability('刻の構えで攻守を強化');
    if(ch===16){if(result==='win'&&h===1)ability('チョキの一撃を強化');else if(result==='draw'&&h===2&&has('heal'))ability('パーの型でHPを回復');else if(result==='lose'&&h===0&&has('counter'))ability('グーの型で反射した');}
    if(ch===17){if(!before.ichi&&player.ichi)ability(result==='win'?'一閃で大ダメージ':'一閃に失敗し、HPが1になった');else if(before.doom&&player.hp<=0&&result!=='win')ability('一閃の代償で倒れた');}
    if(ch===18&&before.mode!==player.mode)ability(player.mode==='def'?'防御モードに切り替えた':'攻撃モードに切り替えた');
    for(const e of own){
      if(e.k==='heal'&&!effects.some(x=>x.detail.includes('回復')))add('アルカナ回復','アルカナの効果でHPを回復','card');
      if(e.k==='judge')add('世界の加護','HP1で耐えて盾を得た','card');
      if(e.k==='lucky')add('幸運','ダメージを防いだ','card');
      if(e.k==='block'&&e.text?.startsWith('盾'))add('アルカナの盾',e.text,'card');
      if(e.k==='fool'&&e.text&&!/^(刻の構え|攻撃モード|一閃)/.test(e.text))add(e.text.replace(/<[^>]*>/g,'').slice(0,40),'アルカナの効果が発動','card');
    }
    return effects;
  }
  window.JQCoopEffects={describe};
})();
