/* New artwork shares one atlas per group; gameplay and saved progress are unchanged. */
(() => {
  'use strict';
  const art = window.JQArt, config = window.JQVisualAssets;
  const old = {actor: art.actor, icon: art.icon, handIcon: art.handIcon, paintCard: art.paintCard};
  const sheets = new Map(), icons = new Map(), actors = new Map();
  const canvas = (w, h) => Object.assign(document.createElement('canvas'), {width:w, height:h});
  const load = ([key, file]) => new Promise(resolve => {
    const im = new Image();
    im.onload = () => {
      const cv=canvas(im.naturalWidth, im.naturalHeight), g=cv.getContext('2d');
      g.drawImage(im,0,0);
      if (!key.startsWith('cards-')) {
        const pixels=g.getImageData(0,0,cv.width,cv.height);
        for(let i=3;i<pixels.data.length;i+=4) pixels.data[i]=pixels.data[i]>=224?255:0;
        g.putImageData(pixels,0,0);
      }
      sheets.set(key,cv); resolve();
    };
    im.onerror=()=>resolve();
    im.src=file+'?v='+encodeURIComponent(window.JQ_VER||'');
  });
  function draw(g, item, x,y,w,h) {
    const sheet=sheets.get(item.sheet); if(!sheet)return false;
    g.imageSmoothingEnabled=false;
    g.drawImage(sheet,...item.rect,x,y,w,h); return true;
  }
  // Tight atlas boxes can contain a few detached pixels from the next sprite.
  // Remove only tiny disconnected fragments after rendering, keeping every large accessory.
  function cleanSilhouette(cv) {
    const g=cv.getContext('2d'),im=g.getImageData(0,0,cv.width,cv.height),p=im.data;
    const seen=new Uint8Array(cv.width*cv.height),queue=new Uint32Array(seen.length),w=cv.width;
    for(let start=0;start<seen.length;start++) {
      if(seen[start]||!p[start*4+3])continue;
      let head=0,tail=1;queue[0]=start;seen[start]=1;
      while(head<tail){const i=queue[head++],x=i%w;
        for(const j of [x?i-1:-1,x+1<w?i+1:-1,i-w,i+w])if(j>=0&&j<seen.length&&!seen[j]&&p[j*4+3]){seen[j]=1;queue[tail++]=j;}
      }
      if(tail<64)for(let n=0;n<tail;n++)p[queue[n]*4+3]=0;
    }
    g.putImageData(im,0,0);
  }
  art.icon = name => {
    if(icons.has(name))return icons.get(name);
    const item=config.icons[name]; if(!item||!sheets.has(item.sheet))return old.icon(name);
    const cv=canvas(96,96),g=cv.getContext('2d'),[, ,w,h]=item.rect;
    const scale=88/Math.max(w,h),dw=Math.round(w*scale),dh=Math.round(h*scale);
    draw(g,item,Math.round((96-dw)/2),Math.round((96-dh)/2),dw,dh);
    const url=cv.toDataURL();icons.set(name,url);return url;
  };
  art.handIcon = h => sheets.has(config.icons['hand'+h]?.sheet) ? art.icon('hand'+h) : old.handIcon(h);
  art.actor = (kind,key) => {
    if(kind!=='e'||!config.enemies[key]||!sheets.has(config.enemies[key].sheet))return old.actor(kind,key);
    if(actors.has(key))return actors.get(key);
    const item=config.enemies[key],cv=canvas(256,320),g=cv.getContext('2d');
    const [,,w,h]=item.rect,scale=Math.min(232/w,286/h),dw=Math.round(w*scale),dh=Math.round(h*scale);
    draw(g,item,Math.round((256-dw)/2),310-dh,dw,dh);
    cleanSilhouette(cv);
    const face=canvas(96,96),fg=face.getContext('2d');fg.imageSmoothingEnabled=false;
    // Crop from the original silhouette, so portraits use the same artwork as battles.
    const crop=Math.min(w,h*.56),sx=item.rect[0]+Math.max(0,(w-crop)/2),sy=item.rect[1];
    fg.drawImage(sheets.get(item.sheet),sx,sy,crop,crop,0,0,96,96);
    const result={body:cv.toDataURL(),face:face.toDataURL(),arm:'',hand:[0,1,2].map(art.handIcon),generated:true};
    actors.set(key,result);return result;
  };
  const rarity=['#ba9672','#b5d7ed','#c19bff','#ffe393'];
  const star=(g,x,y,size,color)=>{
    g.fillStyle=color;g.beginPath();
    for(let i=0;i<10;i++){const a=-Math.PI/2+i*Math.PI/5,r=i%2?size*.45:size;g.lineTo(Math.round(x+Math.cos(a)*r),Math.round(y+Math.sin(a)*r));}
    g.closePath();g.fill();
  };
  art.paintCard = cv => {
    const d=cv.dataset,item=config.cards[d.id];
    if(d.art!=='unknown'&&(!item||!sheets.has(item.sheet)))return old.paintCard(cv);
    cv.width=192;cv.height=288;
    const g=cv.getContext('2d'),r=Math.max(0,Math.min(3,+d.r||0)),rc=rarity[r];
    g.fillStyle='#141c3b';g.fillRect(0,0,192,288);
    if(d.art==='unknown') {
      g.fillStyle='#273962';g.fillRect(12,12,168,264);
      for(let y=24;y<264;y+=24)for(let x=24;x<180;x+=24)star(g,x,y,3,'#49658d');
      const ico=config.icons.cards;if(ico)draw(g,ico,35,80,122,122);
      g.fillStyle='#fff1c2';g.font='bold 40px Georgia,serif';g.textAlign='center';g.fillText('?',96,237);
    } else {
      draw(g,item,8,8,176,272);
      g.fillStyle='rgba(15,24,50,.92)';g.fillRect(15,15,162,25);g.fillRect(15,246,162,27);
      g.fillStyle='#fff2cf';g.font='bold 17px Georgia,serif';g.textAlign='center';g.textBaseline='middle';g.fillText(d.label||'',96,28);
      for(let i=0;i<=r;i++)star(g,96+(i-r/2)*18,260,6,rc);
    }
    const frame=(inset,color)=>{g.strokeStyle=color;g.lineWidth=2;g.strokeRect(inset,inset,192-2*inset,288-2*inset);};
    frame(2,'#111931');frame(5,rc);frame(9,'#5b472f');
    for(const x of [5,177])for(const y of [5,273]){g.fillStyle=rc;g.fillRect(x,y,10,10);g.fillStyle='#fff1cb';g.fillRect(x+3,y+3,3,3);}
    cv.dataset.visualArt='v2';
  };
  const ready=Promise.all(Object.entries(config.sheets).map(load)).then(()=>{
    document.querySelectorAll('[data-ico]').forEach(el=>{el.innerHTML='<img class="pxi" src="'+art.icon(el.dataset.ico)+'" alt="">';});
    document.querySelectorAll('[data-hand]').forEach(el=>{const h=+el.dataset.hand;el.innerHTML='<img class="pxi hand-art" src="'+art.handIcon(h)+'" alt="'+['グー','チョキ','パー'][h]+'">';});
  });
  window.JQVisual={ready,hasEnemy:key=>!!config.enemies[key]&&sheets.has(config.enemies[key].sheet),loaded:()=>sheets.size};
})();
