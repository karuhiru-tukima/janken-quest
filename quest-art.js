/* Costume variants drawn with the existing repo-native pixel renderer. */
(() => {
  'use strict';
  const art=window.JQArt;
  for(const v of window.JQQuestContent.variants) {
    const base=v.player?art.ALLY[v.player]:art.ENEMY[v.base];
    const head=base.head;
    const costume=p=>{
      const ink=art.OUT,metal='#d4c5a0',dark=art.tone(v.color,-.35);
      if(v.mark==='crown') {p.rect(10,5,20,3,dark);for(const x of [11,18,25])p.rect(x,1,4,7,metal);p.rect(18,5,4,3,v.color);}
      else if(v.mark==='mask') {p.rect(9,16,22,6,dark);p.rect(17,18,6,2,v.color);}
      else if(v.mark==='band') {p.rect(9,8,22,3,v.color);p.tri(29,9,37,7,34,14,dark);}
      else if(v.mark==='scar') {p.line(24,11,27,19,ink);p.line(25,11,28,19,metal);}
      else if(v.mark==='gem') {p.rect(17,5,6,6,ink);p.rect(18,6,4,4,metal);p.rect(19,6,2,2,v.color);}
      else if(v.mark==='seal') {p.rect(27,9,6,13,metal);p.rect(29,11,2,7,dark);p.rect(28,14,4,2,dark);}
    };
    const body=base.body;
    art.ENEMY[v.key]=Object.assign({},base,{cloth:v.color,pants:art.tone(v.color,-.4),sleeve:art.tone(v.color,-.15),trim:'#d4c5a0',
      ...(head?{head:p=>{head(p);costume(p);}}:{hair:p=>{base.hair?.(p);costume(p);}}),
      body:p=>{
        body?.(p);
        if(v.mark==='shield'){p.rect(10,25,12,12,art.OUT);p.rect(11,26,10,10,v.color);p.rect(15,27,2,8,'#d4c5a0');}
        if(v.mark==='spikes')for(const x of [10,17,24])p.tri(x,24,x+5,24,x+2,19,'#d4c5a0');
        if(v.mark==='chain')for(let y=25;y<35;y+=3){p.rect(14,y,13,2,'#343343');p.rect(15,y,10,1,'#b0a9aa');}
        p.rect(18,29,4,4,art.OUT);p.rect(19,30,2,2,'#d4c5a0');
      },
    });
  }
  const people={
    traveler:['#6c7968','#795b43','#c1a16e'],villager:['#78658c','#513b32','#baa17a'],child:['#b48548','#513733','#d2a963'],
    worker:['#767c85','#554234','#c6baa0'],master:['#78817b','#c2b6a4','#ac8b60'],merchant:['#875d58','#342c35','#be986b'],
    soldier:['#5b7085','#3b3434','#c1c6c9'],healer:['#789181','#573b31','#d1c5a7'],
  };
  for(const [key,[cloth,hair,trim]] of Object.entries(people))art.ENEMY['q-npc-'+key]={
    cloth,pants:art.tone(cloth,-.4),shoes:'#44323a',trim,handSkin:'#e9c19e',skin:'#e9c19e',
    face:{shape:'std',eye:'#382e38',brow:key==='master'?'thick':'normal',browColor:hair},
    hair:p=>{p.ell(20,5,11,7,hair);p.rect(9,5,4,10,hair);p.rect(27,5,4,10,hair);p.rect(11,4,18,4,hair);if(key==='worker')p.rect(7,3,26,4,trim);if(key==='soldier'){p.rect(8,1,24,8,cloth);p.rect(8,8,24,2,trim);}if(key==='master'){p.rect(10,13,3,7,hair);p.rect(27,13,3,7,hair);}},
    body:p=>{p.rect(18,24,4,11,trim);if(key==='traveler'||key==='merchant'){p.rect(25,25,9,12,'#574334');p.rect(26,26,7,9,trim);}if(key==='healer')p.rect(14,28,12,4,trim);},
  };
  const previous=art.actor,rendered=new Map(),sheets=new Map(),loads=new Map();
  const registry=new Map(window.JQQuestContent.variants.map((v,i)=>[v.key,{sheet:Math.floor(i/12)+1,cell:i%12}]));
  const oldHas=window.JQVisual.hasEnemy;
  window.JQVisual.hasEnemy=key=>{const r=registry.get(key);return !!(r&&sheets.has(r.sheet))||oldHas(key);};
  art.actor=(kind,key)=>{
    const item=kind==='e'&&registry.get(key),sheet=item&&sheets.get(item.sheet);
    if(!sheet){if(item)load(item.sheet);return previous(kind,key);}
    if(rendered.has(key))return rendered.get(key);
    const cw=sheet.image.naturalWidth/4,ch=sheet.image.naturalHeight/3;
    const sx=Math.round(item.cell%4*cw),sy=Math.round(Math.floor(item.cell/4)*ch),right=Math.round((item.cell%4+1)*cw),bottom=Math.round((Math.floor(item.cell/4)+1)*ch);
    let l=right,t=bottom,r=sx,b=sy;
    // Bounds are read per atlas cell. The generated PNG alpha is preserved;
    // no background replacement or recolouring is applied.
    for(let y=sy;y<bottom;y++)for(let x=sx;x<right;x++)if(sheet.alpha[(y*sheet.width+x)*4+3]>=128){l=Math.min(l,x);r=Math.max(r,x+1);t=Math.min(t,y);b=Math.max(b,y+1);}
    if(r<=l||b<=t)return previous(kind,key);
    const cv=document.createElement('canvas');cv.width=256;cv.height=320;
    const g=cv.getContext('2d');g.imageSmoothingEnabled=false;
    const scale=Math.min(232/(r-l),286/(b-t)),dw=Math.round((r-l)*scale),dh=Math.round((b-t)*scale);
    g.drawImage(sheet.image,l,t,r-l,b-t,Math.round((256-dw)/2),310-dh,dw,dh);
    const fc=document.createElement('canvas');fc.width=96;fc.height=96;
    const fg=fc.getContext('2d');fg.imageSmoothingEnabled=false;const size=Math.min(r-l,(b-t)*.55);
    fg.drawImage(sheet.image,l+(r-l-size)/2,t,size,size,0,0,96,96);
    const result={body:cv.toDataURL(),face:fc.toDataURL(),arm:'',hand:[0,1,2].map(art.handIcon),generated:true,quest:true};
    rendered.set(key,result);return result;
  };
  function load(n) {
    if(loads.has(n))return loads.get(n);
    const promise=new Promise(resolve=>{
    const image=new Image();image.onload=()=>{try {
      const cv=document.createElement('canvas');cv.width=image.naturalWidth;cv.height=image.naturalHeight;
      const g=cv.getContext('2d',{willReadFrequently:true});g.drawImage(image,0,0);
      sheets.set(n,{image,width:cv.width,alpha:g.getImageData(0,0,cv.width,cv.height).data});
      document.querySelectorAll('img[data-quest-enemy]').forEach(im=>{if(registry.get(im.dataset.questEnemy)?.sheet===n)im.src=art.actor('e',im.dataset.questEnemy).body;});
      document.dispatchEvent(new CustomEvent('jq-art-loaded',{detail:'enemies-quest-'+n}));resolve(true);
    }catch(error){loads.delete(n);console.warn('専用の敵画像を読み込めませんでした',error);resolve(false);}
    };image.onerror=()=>{loads.delete(n);resolve(false);};image.src='img/quest-scenes/enemy-cast-0'+n+'-pixel.png?v='+window.JQ_VER;
    });loads.set(n,promise);return promise;
  }
  // Load only atlases needed by the selected episode; normal startup does not
  // download six megabytes of unrelated quest enemies.
  window.JQQuestArtReadyFor=keys=>Promise.all([...new Set(keys.map(k=>registry.get(k)?.sheet).filter(Boolean))].map(load));
})();
