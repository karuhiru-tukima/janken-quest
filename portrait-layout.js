/* Eye anchors measured on the existing 120px portraits. Ren (c5) is the reference.
 * This changes framing only; identities and original pixel art remain untouched. */
(() => {
  const anchors={1:[66,64,.92],2:[59,65,1.07],3:[61,64,1],4:[67,66,1],5:[60,66,1],6:[61,59,1.02],7:[61,87,.92],8:[59,62,.92],9:[66,68,1.08],10:[61,66,1.02],11:[62,63,.98],12:[62,66,1.04],13:[63,64,.96],14:[65,67,.96],15:[62,65,1],16:[62,64,1.04],17:[62,65,1],18:[65,65,.99]};
  function style(id){const [x,y,s]=anchors[id]||anchors[5];return `--face-scale:${s};--face-x:${(60-x*s)/1.2}%;--face-y:${(66-y*s)/1.2}%`;}
  function portrait(id,src){return `<span class="jq-face" style="${style(id)}"><img src="${src}" alt="" loading="eager" decoding="async"></span>`;}
  function face(id,url){
    if(id!==18)return `<span class="pxi cfc fc normalized-face" data-cid="${id}">${portrait(id,url('faces/c'+id))}</span>`;
    return `<span class="pxi cfc kaede-face normalized-face" data-cid="18" role="img" aria-label="カエデ・赤と青の姿"><span class="kaede-half red">${portrait(18,url('faces/c18'))}</span><span class="kaede-half blue"><span class="jq-face" style="${style(18)}"><span class="jq-kaede-blue" style="background-image:url('${url('chars/c18d')}')"></span></span></span></span>`;
  }
  window.JQPortraits={anchors,style,face};
})();
