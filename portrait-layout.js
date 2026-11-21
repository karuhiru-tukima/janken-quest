/* Eye anchors measured on the existing 120px portraits. Ren (c5) is the reference.
 * This changes framing only; identities and original pixel art remain untouched. */
(() => {
  // Coordinates use a 120px canvas, including the 128px Kaede source scaled to it.
  // Match the visible face, rather than hat, hair or shoulder width.
  const anchors={1:[74,59,.75],2:[61,58,.90],3:[68,54,1.06],4:[76,56,.95],5:[63,66,1],6:[68,54,1.08],7:[53,73,.75],8:[60,62,.95],9:[66,63,.95],10:[58,60,.95],11:[54,54,1.06],12:[66,62,.75],13:[70,54,.95],14:[70,53,.90],15:[73,54,1.08],16:[67,46,.82],17:[70,53,1.08],18:[65,53,.97]};
  function style(id){const [x,y,s]=anchors[id]||anchors[5];return `--face-scale:${s};--face-x:${(63-x*s)/1.2}%;--face-y:${(66-y*s)/1.2}%`;}
  function portrait(id,src){return `<span class="jq-face" style="${style(id)}"><img src="${src}" alt="" loading="eager" decoding="sync"></span>`;}
  function face(id,url){
    if(id!==18)return `<span class="pxi cfc fc normalized-face" data-cid="${id}">${portrait(id,url('faces/c'+id))}</span>`;
    return `<span class="pxi cfc kaede-face normalized-face" data-cid="18" role="img" aria-label="カエデ・赤と青の姿">${portrait(18,url('faces/c18-balanced'))}</span>`;
  }
  const cached=new Map();
  function preload(url){return Promise.all(Array.from({length:18},(_,i)=>{
    const src=url(i===17?'faces/c18-balanced':'faces/c'+(i+1));
    if(cached.has(src))return cached.get(src).ready;
    const img=new Image();const ready=new Promise(resolve=>{img.onload=()=>{if(img.decode)img.decode().catch(()=>{}).then(()=>resolve(true));else resolve(true);};img.onerror=()=>resolve(false);});
    cached.set(src,{img,ready});img.src=src;return ready;
  }));}
  window.JQPortraits={anchors,style,face,preload};
})();
