/* Normal icons use the approved common crop of the original standing art.
 * Reward portraits are rendered separately by quest-system.js. */
(() => {
  const anchors=Object.fromEntries(Array.from({length:18},(_,i)=>[i+1,[13,0,230]]));
  function style(){return '--face-scale:1;--face-x:0%;--face-y:0%;--face-height:100%';}
  const source=(id,url)=>url('faces/normal-crop-v1/c'+id);
  function face(id,url){
    const label=id===18?'カエデ・赤と青の姿':'';
    return `<span class="pxi cfc fc normalized-face" data-cid="${id}"${label?` role="img" aria-label="${label}"`:''}><span class="jq-face" style="${style()}"><img src="${source(id,url)}" style="left:0;top:0;width:100%;height:100%;object-fit:fill;transform:none" alt="" loading="eager" decoding="sync"></span></span>`;
  }
  const cached=new Map();
  function preload(url){return Promise.all(Array.from({length:18},(_,i)=>{
    const src=source(i+1,url);
    if(cached.has(src))return cached.get(src).ready;
    const img=new Image();const ready=new Promise(resolve=>{img.onload=()=>{if(img.decode)img.decode().catch(()=>{}).then(()=>resolve(true));else resolve(true);};img.onerror=()=>resolve(false);});
    cached.set(src,{img,ready});img.src=src;return ready;
  }));}
  window.JQPortraits={anchors,style,face,preload};
})();