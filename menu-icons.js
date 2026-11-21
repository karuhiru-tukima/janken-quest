(() => {
  const previous=window.JQArt.icon;
  const files={tower:'img/ui-extra/tower-v1.png',coop:'img/ui-extra/coop-v1.png'};
  window.JQArt.icon=name=>files[name]?files[name]+'?v='+window.JQ_VER:previous(name);
})();
