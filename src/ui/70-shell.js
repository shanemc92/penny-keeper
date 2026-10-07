/* ---------------- app shell ---------------- */
const NAV = [
  {items:[['dashboard','🏠','Home','Your money at a glance'], ['setup','🧭','Set-up guide','Start here']]},
  {title:'Money in & out', items:[
    ['tax','💶','Take-home pay','Salary, tax and what you keep'],
    ['budget','🧾','Bills & budget','What you spend and save'],
    ['disposable','🛍️','Disposable income','Where spare money goes'],
    ['bank','🏦','Spending','Import a bank statement'],
    ['renewals','🔔','Renewals','Contracts ending soon']]},
  {title:'Saving & borrowing', items:[
    ['savings','🐖','Savings & goals','Rainy day, holidays, more'],
    ['loans','💳','Loans','Pay them off faster'],
    ['mortgage','🏡','Mortgage','Rates and overpaying'],
    ['networth','📊','Net worth','What you own minus owe']]},
  {title:'Irish tax help', items:[['reliefs','🧮','Credits & reliefs','Claim what you are owed']]},
  {title:'More tools', items:[
    ['energy','⚡','Electricity','Compare tariffs'],
    ['history','📈','Bill history','What bills really cost'],
    ['accounts','🗂️','Accounts & payees','Bank details in one place'],
    ['maternity','👶','Maternity leave','Plan the cash flow'],
    ['tracker','🏗️','Budget tracker','Renovation, wedding, build']]},
  {items:[['data','💾','Backup & settings','Back up, restore, export']]}
];
const ALL_TABS = NAV.flatMap(g=>g.items);
/* the optional maternity page is switched on in Backup & settings */
const tabEnabled = id => id!=='maternity' || !!(Y.maternity && Y.maternity.enabled);
/* the set-up guide can be hidden from the menu once it is done (and brought back in Backup & settings); links to it still open it */
const navVisible = id => tabEnabled(id) && (id!=='setup' || !DB.ui.hideSetup);
let active = 'dashboard';
const charts = [];   // redraw hooks for theme/resize
let RO = null, redrawTimer = null;
function redrawCharts(){
  clearTimeout(redrawTimer);
  redrawTimer = setTimeout(()=> charts.forEach(f=>{ try{ f(); }catch(e){ console.warn(e); } }), 100);
}
/* charts are sized from their container, so redraw whenever a container resizes */
function observeCharts(){
  if(!window.ResizeObserver) return;
  if(!RO) RO = new ResizeObserver(redrawCharts);
  RO.disconnect();
  $$('.chartbox').forEach(b=> RO.observe(b));
}

function renderTabs(){
  const sp = setupProgress();
  $('#tabs').innerHTML = NAV.map(g=>{
    const items = g.items.filter(([id])=>navVisible(id));
    if(!items.length) return '';
    return `<div class="navgroup">${g.title?`<h6>${esc(g.title)}</h6>`:''}${items.map(([id,ico,label,sub])=>{
      const badge = id==='setup' ? (sp.done===sp.total ? '<span class="ok" title="All done">✓</span>' : `<span class="dot" title="${sp.done} of ${sp.total} steps done"></span>`) : '';
      return `<button class="navbtn ${id===active?'active':''}" data-tab="${id}" ${id===active?'aria-current="page"':''}>
        <span class="ico" aria-hidden="true">${ico}</span><span class="lab">${esc(label)}<span class="sub">${esc(sub)}</span></span>${badge}</button>`;
    }).join('')}</div>`;
  }).join('');
}
function renderYears(){
  const ys = Object.keys(DB.years).sort();
  $('#yearSel').innerHTML = ys.map(k=>
    `<option value="${esc(k)}" ${k===DB.active?'selected':''}>${esc(yearLabel(DB.years[k]))}</option>`).join('');
}
function renderTop(){
  const p = PAGES[active] || {};
  $('#crumb').innerHTML = `<span aria-hidden="true">${p.ico||''}</span>${esc(p.title||'')}`;
  document.body.classList.toggle('nav-collapsed', !!DB.ui.navCollapsed);
  const lb = daysSinceBackup();
  $('#sidefoot').innerHTML = `🔒 Your data stays on this device.<br>` +
    (lb===null ? `<b style="color:var(--warn)">Not backed up yet</b> - <a href="#" data-go="data">back up</a>`
      : `Last backup: <b>${lb<=0?'today':lb+' day'+(lb===1?'':'s')+' ago'}</b>${lb>30?` - <a href="#" data-go="data">back up</a>`:''}`);
}
/* Every edit rebuilds the tab's innerHTML, which throws away where you were:
   the page scroll, the scroll inside any tall table, and which <details> were open.
   Deleting five rules in a row meant scrolling back down five times, so the view
   state is captured before the rebuild and put back after. */
function viewState(el){
  if(!el) return null;
  return {
    y: window.scrollY || window.pageYOffset || 0,
    boxes: $$('.tw', el).map(b=>[b.scrollTop, b.scrollLeft]),
    open: $$('details', el).map(d=>d.open)
  };
}
function restoreView(el, v){
  if(!el || !v) return;
  const details = $$('details', el);
  v.open.forEach((o,i)=>{ if(details[i]) details[i].open = o; });
  const boxes = $$('.tw', el);
  v.boxes.forEach((p,i)=>{ if(boxes[i]){ boxes[i].scrollTop = p[0]; boxes[i].scrollLeft = p[1]; } });
  window.scrollTo(0, v.y);
}
const RENDERERS = {};   // filled in once every page function exists (see init)

/* Editing a field fires "change" when you leave it, and every page rebuilds itself on change.
   Rebuilt in the middle of a Tab press, the page threw away the very field you were moving to, so
   you could not tab through a form; rebuilt in the middle of a click, it threw away the button you
   were pressing. So a rebuild requested from inside a change event is held until the event (and any
   mouse press) is over, then run, and keyboard focus is put back on the same field. */
let inChange = false, pendingRender = false, pendingOpts = null, mouseDown = false;
function focusKey(){
  const a = document.activeElement;
  if(!a || a===document.body || !a.closest) return null;
  const sec = a.closest('#pages > section'); if(!sec) return null;
  const all = $$('input,select,textarea', sec);
  let sel = null; try{ sel = [a.selectionStart, a.selectionEnd]; }catch(e){}
  return {sec:sec.id, id:a.id||'', path:a.dataset.path||'', extra:a.dataset.status||a.dataset.share||a.dataset.raise||'', idx:all.indexOf(a), sel};
}
function restoreFocus(k){
  if(!k) return;
  const sec = document.getElementById(k.sec); if(!sec) return;
  let el = k.id ? document.getElementById(k.id) : null;
  if(!el && k.path) el = $('[data-path="'+k.path+'"]', sec);
  if(!el && k.extra) el = $('[data-status="'+k.extra+'"],[data-share="'+k.extra+'"],[data-raise="'+k.extra+'"]', sec);
  if(!el && k.idx>=0) el = $$('input,select,textarea', sec)[k.idx];
  if(!el) return;
  el.focus({preventScroll:true});
  try{ if(k.sel && k.sel[0]!=null && el.setSelectionRange) el.setSelectionRange(k.sel[0], k.sel[1]); }catch(e){}
}
function flushRender(){
  if(!pendingRender || mouseDown || inChange) return;
  setTimeout(()=>{
    if(!pendingRender || mouseDown) return;
    const k = focusKey(), o = pendingOpts;
    doRender(o);
    restoreFocus(k);
  }, 0);
}
function render(opts){
  if(inChange){
    pendingRender = true;
    pendingOpts = Object.assign({}, pendingOpts||{}, opts||{});
    return;
  }
  doRender(opts);
}
function doRender(opts){
  pendingRender = false; pendingOpts = null;
  if(!tabEnabled(active)) active = 'dashboard';   // page switched off while sitting on it
  const el = $('#tab-'+active);
  const keep = (opts && opts.reset) ? null : viewState(el);
  charts.length = 0;
  CUR = safeCur(Y.currency);
  renderTabs(); renderYears(); renderTop();
  $$('#pages > section').forEach(s=>s.classList.remove('active'));
  el.classList.add('active');
  RENDERERS[active](el);
  el.insertAdjacentHTML('afterbegin', pageHead(active));
  markNeeds(el);
  addTooltips(el);
  charts.forEach(f=>{ try{ f(); }catch(e){ console.warn(e); } });
  observeCharts();
  restoreView(el, keep);
}
document.addEventListener('change', ()=>{ inChange = true; }, true);
document.addEventListener('change', ()=>{ inChange = false; flushRender(); });
document.addEventListener('mousedown', ()=>{ mouseDown = true; }, true);
document.addEventListener('mouseup', ()=>{ setTimeout(()=>{ mouseDown = false; flushRender(); }, 0); }, true);
function go(tab){
  if(tab==='setup' && active!=='setup') DB.ui.setupOpen = null;
  active = tab; DB.ui.last = tab;
  $('#side').classList.remove('on'); $('#scrim').classList.remove('on');
  render({reset:true}); window.scrollTo({top:0});
}
function chart(fn){ charts.push(fn); }

/* generic editable-table wiring: elements carry data-path="collection.index.field" */
function wireFields(root){
  $$('[data-path]', root).forEach(el=>{
    el.addEventListener('change', ()=>{
      const parts = el.dataset.path.split('.');
      let ref = Y;
      for(let i=0;i<parts.length-1;i++) ref = ref[parts[i]];
      const key = parts[parts.length-1];
      let v = el.type==='checkbox' ? el.checked : el.value;
      if(el.dataset.type==='number') v = num(v);
      if(el.dataset.type==='bool') v = !!v && v!=='false';
      /* bills are assigned to a person by name, so a rename has to carry their bills with it
         or they silently turn into unassigned bills and drop out of that person's share */
      if(/^people\.\d+\.name$/.test(el.dataset.path) && ref[key] !== v){
        const old = ref[key];
        Y.bills.forEach(b=>{ if(b.holder===old) b.holder = v; });
        Y.disposable.items.concat(Y.disposable.entries).forEach(x=>{ if(x.who===old) x.who = v; });
      }
      ref[key] = v;
      save();
      if(el.dataset.norender===undefined) render();
      else markNeeds($('#tab-'+active));
    });
  });
}

