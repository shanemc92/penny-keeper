/* ---------------- init ---------------- */
function applyTheme(){
  document.documentElement.dataset.theme = DB.theme || 'light';
  $('#themeBtn').textContent = (DB.theme==='dark') ? 'Light' : 'Dark';
}
function closeSide(){ $('#side').classList.remove('on'); if(!$('#drawer').classList.contains('on') && !$('#modal').classList.contains('on')) $('#scrim').classList.remove('on'); }
function init(){
  load();
  applyTheme();
  $('#pages').innerHTML = ALL_TABS.map(([id])=>`<section id="tab-${id}" aria-label="${esc(id)}"></section>`).join('');
  Object.assign(RENDERERS, {
    dashboard:renderDashboard, setup:renderSetup, tax:renderTax, budget:renderBudget, bank:renderBank,
    renewals:renderRenewals, savings:renderSavingsPage, loans:renderLoans, mortgage:renderMortgage,
    networth:renderNetWorth, reliefs:renderReliefs, energy:renderEnergy, history:renderHistory,
    accounts:renderAccounts, maternity:renderMaternity, tracker:renderTracker, data:renderData
  });
  if(DB.ui.last && RENDERERS[DB.ui.last] && tabEnabled(DB.ui.last)) active = DB.ui.last;
  wireTooltips();
  render({reset:true});

  $('#tabs').addEventListener('click', e=>{ const b = e.target.closest('.navbtn'); if(b) go(b.dataset.tab); });
  /* any element carrying data-go jumps to that page - links, buttons and the sidebar footer alike */
  document.addEventListener('click', e=>{
    const a = e.target.closest && e.target.closest('[data-go]');
    if(a){ e.preventDefault(); go(a.dataset.go); }
  });
  $('#yearSel').onchange = e=>{ DB.active = e.target.value; Y = DB.years[DB.active]; CUR = safeCur(Y.currency); save(); render(); };
  $('#newYear').onclick = newYear;
  $('#themeBtn').onclick = ()=>{ DB.theme = (DB.theme==='dark')?'light':'dark'; applyTheme(); save(true); render(); };
  $('#helpBtn').onclick = openDrawer;
  $('#burger').onclick = ()=>{
    if(window.matchMedia('(max-width: 900px)').matches){            // phone or narrow window: slide the menu over the page
      const open = !$('#side').classList.contains('on');
      $('#side').classList.toggle('on', open); $('#scrim').classList.toggle('on', open);
    } else {                                                          // wide screen: fold the menu away to give the page more room
      DB.ui.navCollapsed = !DB.ui.navCollapsed; save(true);
      document.body.classList.toggle('nav-collapsed', DB.ui.navCollapsed);
      redrawCharts();
    }
  };
  $('#scrim').onclick = ()=>{ closeSide(); closeDrawer(); closeModal(); $('#scrim').classList.remove('on'); };
  window.addEventListener('resize', redrawCharts);
  /* the write is debounced, so make sure it lands if the tab is closed straight after an edit */
  window.addEventListener('pagehide', flushSave);
  document.addEventListener('visibilitychange', ()=>{ if(document.visibilityState==='hidden') flushSave(); });
  setStatus('');
  if(!DB.ui.welcomed && isBlankYear(Y)) showWelcome();
  /* localStorage has already rendered above, so the page is never blank while this is in
     flight, and on anything but a Penny Keeper server it does nothing at all. */
  initSync();
}
init();

