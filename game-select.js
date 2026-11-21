/* Keep game state in its existing select controls, with a game-owned chooser UI. */
(() => {
  'use strict';
  const controls=new Map();let active=null,queued=false,previousOverflow='';
  const dialog=document.createElement('dialog');dialog.className='jq-choice-dialog';
  dialog.setAttribute('aria-labelledby','jq-choice-title');
  dialog.innerHTML='<section class="jq-choice-panel"><header><h2 id="jq-choice-title"></h2><button type="button" class="jq-choice-close" aria-label="選択画面を閉じる">×</button></header><input class="jq-choice-search" type="search" aria-label="選択肢を絞り込む" placeholder="ことばで探す"><div class="jq-choice-list" role="listbox" aria-labelledby="jq-choice-title"></div><p class="jq-choice-empty" hidden>見つかりませんでした</p></section>';
  const title=dialog.querySelector('h2'),search=dialog.querySelector('input'),list=dialog.querySelector('[role="listbox"]'),empty=dialog.querySelector('.jq-choice-empty');
  function label(select){
    const explicit=select.getAttribute('aria-label');if(explicit)return explicit;
    const owner=select.labels?.[0];if(!owner)return '選んでください';
    const copy=owner.cloneNode(true);copy.querySelectorAll('select,button,input,.jq-select,.sub').forEach(e=>e.remove());
    return copy.textContent.trim()||'選んでください';
  }
  function sync(select,button){
    const text=select.selectedOptions[0]?.textContent||'選んでください';
    if(button.firstElementChild.textContent!==text)button.firstElementChild.textContent=text;
    const disabled=select.disabled||!select.options.length;if(button.disabled!==disabled)button.disabled=disabled;
    const name=label(select)+': '+text;if(button.getAttribute('aria-label')!==name)button.setAttribute('aria-label',name);
  }
  function close(){if(dialog.open)dialog.close();}
  function render(){
    if(!active)return;const select=active.select,query=search.value.trim().toLocaleLowerCase();
    list.replaceChildren();let count=0;
    function option(o,parent){
      if(o.hidden||query&&!((o.parentElement.label||'')+' '+o.textContent).toLocaleLowerCase().includes(query))return;
      const button=document.createElement('button');button.type='button';button.className='jq-choice-option';button.setAttribute('role','option');
      button.setAttribute('aria-selected',String(o.selected));button.disabled=o.disabled||o.parentElement.disabled===true;
      const check=document.createElement('span');check.className='jq-choice-check';check.textContent=o.selected?'◆':'';check.setAttribute('aria-hidden','true');
      const text=document.createElement('span');text.textContent=o.textContent;button.append(check,text);
      button.onclick=()=>{if(!active||select.disabled||button.disabled||o.disabled||o.parentElement.disabled===true)return;select.value=o.value;select.dispatchEvent(new Event('input',{bubbles:true}));select.dispatchEvent(new Event('change',{bubbles:true}));refresh();close();};
      parent.append(button);count++;
    }
    for(const child of select.children){
      if(child.tagName==='OPTGROUP'){
        const group=document.createElement('div');group.className='jq-choice-group';group.setAttribute('role','group');group.setAttribute('aria-label',child.label);
        const heading=document.createElement('h3');heading.textContent=child.label;group.append(heading);
        for(const o of child.children)option(o,group);if(group.children.length>1)list.append(group);
      }else if(child.tagName==='OPTION')option(child,list);
    }
    empty.hidden=count>0;
  }
  function open(select,button){
    if(button.disabled)return;if(dialog.open)close();active={select,button};
    title.textContent=label(select);search.value='';search.hidden=select.options.length<10;render();
    previousOverflow=document.body.style.overflow;document.body.style.overflow='hidden';button.setAttribute('aria-expanded','true');dialog.showModal();
    const selected=list.querySelector('[aria-selected="true"]:not(:disabled)');
    (search.hidden?(selected||list.querySelector('button:not(:disabled)')||dialog.querySelector('button')):search).focus();
    selected?.scrollIntoView({block:'nearest'});
  }
  function refresh(){
    for(const [select,button] of controls){if(!select.isConnected){if(active?.select===select)close();controls.delete(select);}else sync(select,button);}
    for(const select of document.querySelectorAll('select:not([data-jq-select])')){
      select.dataset.jqSelect='true';select.classList.add('jq-native-select');select.setAttribute('aria-hidden','true');select.tabIndex=-1;
      const wrapper=document.createElement('span');wrapper.className='jq-select';select.before(wrapper);wrapper.append(select);
      const button=document.createElement('button');button.type='button';button.className='jq-select-trigger';button.setAttribute('aria-haspopup','listbox');button.setAttribute('aria-expanded','false');button.setAttribute('aria-controls','jq-choice-options');
      button.innerHTML='<span></span><span class="jq-select-arrow" aria-hidden="true">▼</span>';wrapper.append(button);controls.set(select,button);sync(select,button);
      button.onclick=event=>{event.preventDefault();open(select,button);};
      select.addEventListener('change',()=>sync(select,button));
    }
  }
  list.id='jq-choice-options';dialog.querySelector('.jq-choice-close').onclick=close;
  dialog.addEventListener('click',event=>{if(event.target===dialog)close();});
  dialog.addEventListener('close',()=>{const old=active;active=null;document.body.style.overflow=previousOverflow;if(old){old.button.setAttribute('aria-expanded','false');if(old.button.isConnected)old.button.focus();}});
  list.addEventListener('keydown',event=>{
    const buttons=[...list.querySelectorAll('button:not(:disabled)')],at=buttons.indexOf(document.activeElement);let next;
    if(event.key==='ArrowDown')next=buttons[(at+1)%buttons.length];else if(event.key==='ArrowUp')next=buttons[(at-1+buttons.length)%buttons.length];else if(event.key==='Home')next=buttons[0];else if(event.key==='End')next=buttons.at(-1);else return;
    event.preventDefault();next?.focus();
  });
  search.addEventListener('input',render);
  document.body.append(dialog);refresh();
  const observer=new MutationObserver(()=>{if(queued)return;queued=true;queueMicrotask(()=>{queued=false;refresh();});});
  observer.observe(document.body,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:['disabled','selected','label','hidden']});
})();
