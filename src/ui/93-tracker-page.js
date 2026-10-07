/* ---------------- budget tracker ----------------
   Plan what each part of a big project should cost, log what it really cost, and see how far ahead or behind
   you are. The logic is in src/engine/50-tracker.js; this is the page. */
let trackerPicking = false;      // view state: the "start a project" panel is open

function trackerPickerHtml(canCancel){
  const found = trackerStandalone();
  return `<div class="card">
    ${cardHead('Start a project','Pick a starting point - the usual stages are filled in, you add the costs. You can rename, add and remove anything afterwards.',
      canCancel ? '<button class="btn" data-act="cancelPick">Cancel</button>' : '')}
    <div class="actions-grid">
      ${TRACKER_TEMPLATES.map(t=>`<button class="action" data-act="tpl" data-tpl="${esc(t.key)}"><span class="ai">${t.icon}</span><span>${esc(t.name)}<small>${esc(t.blurb)}</small></span></button>`).join('')}
      <button class="action" data-act="tpl" data-tpl="blank"><span class="ai">📝</span><span>Start from nothing<small>Add your own stages</small></span></button>
    </div>
    <div class="row" style="margin-top:14px"><button class="btn" data-act="import">Import a file (.json)</button>
      <span class="note" style="margin:0">Files from the standalone Budget Tracker work too.</span></div>
  </div>
  ${found ? callout('info','🔎','Found projects from the standalone Budget Tracker in this browser',
      found.projects.length+' project'+(found.projects.length===1?'':'s')+' ('+esc(found.projects.map(p=>p.name).join(', '))+') can be brought across. The original is left untouched.',
      '<button class="btn primary sm" data-act="standalone">Bring them in</button>') : ''}`;
}

function renderTracker(el){
  const p = trackerProject();
  const picking = !p || trackerPicking;       // no project yet, or "+ New project" was pressed
  el.innerHTML =
    (picking ? (p ? '' : callout('tipc','🏗️','Nothing here yet','Use this for anything with a lot of moving parts: a renovation, a wedding, a build, a big holiday. It is separate from your household budget.')) + trackerPickerHtml(!!p) : '') +
    (p ? trackerBodyHtml(p) : '') + trackerFileInput();
  if(p) trackerCharts(p);
  wireTracker(el);
}
const trackerFileInput = () => '<input type="file" id="trkFile" accept=".json,application/json" hidden>';

function trackerBodyHtml(p){
  const T = DB.tracker, cur = p.currency, t = trackerTotals(p);
  const M = n => trackerMoney(n, cur), K = n => trackerMoneyK(n, cur);
  const scale = Math.max(t.funds, t.forecast, 1);
  const wd = v => (Math.max(0, v) / scale * 100).toFixed(2) + '%';
  const over = Math.max(0, t.forecast - t.funds);
  const left = Math.max(0, Math.min(t.toPay, t.funds - t.actual));
  const free = Math.max(0, t.funds - t.forecast);
  const seg = (v,c,l)=> v>0 ? `<i style="width:${wd(v)};background:${c}" title="${esc(l)}: ${esc(K(v))}"></i>` : '';
  const used = t.budget ? t.actual / t.budget * 100 : 0;
  const savings = (Y.savings.accounts||[]).filter(a=>num(a.opening)>0);

  return `
  <div class="card">
    <div class="row">
      <label class="f" style="flex:1;min-width:200px;margin:0"><span>Project ${ttHtml('Each project is separate, with its own stages, items and funding.')}</span>
        <select data-act="proj" aria-label="Project">${T.projects.map(x=>`<option value="${esc(x.id)}" ${x.id===p.id?'selected':''}>${esc(x.name)}</option>`).join('')}</select></label>
      <label class="f" style="width:90px;margin:0"><span>Currency</span><input data-act="cur" value="${esc(cur)}" maxlength="3" aria-label="Currency symbol"></label>
      <button class="btn" data-act="rename">Rename</button>
      <button class="btn" data-act="newProject">+ New project</button>
      <button class="btn danger" data-act="delProject">Delete</button>
    </div>
  </div>

  <div class="card">
    <div class="hero">
      <div>
        <div class="mut" style="color:var(--muted);font-weight:600" data-nott>Funds left after forecast ${ttHtml('Everything paying for the project minus what it is forecast to cost. Negative means you are short.')}</div>
        <div class="big ${t.headroom<0?'neg':'pos'}">${M(t.headroom)}</div>
        <p class="note" style="font-size:14px">${t.funds<=0 ? 'Add what is paying for it under <b>Funding</b> below to see how much is left.'
          : t.headroom>=0 ? 'You have enough set aside for the forecast, with <b>'+M(t.headroom)+'</b> to spare.'
          : 'You are <b>'+M(-t.headroom)+'</b> short once everything is paid. Cut an item, or add funding.'}</p>
      </div>
      <div>
        <div class="stack" aria-label="Spent, still to pay and unfunded">${seg(t.actual,PALETTE[0],'Spent')}${seg(left,PALETTE[1],'Still to pay')}${seg(over,PALETTE[2],'Not funded')}</div>
        <div class="legend">
          <span><i style="background:${PALETTE[0]}"></i>Spent<b>${esc(K(t.actual))}</b></span>
          <span><i style="background:${PALETTE[1]}"></i>Still to pay<b>${esc(K(t.toPay))}</b></span>
          ${over>0 ? `<span><i style="background:${PALETTE[2]}"></i>Not funded<b class="neg">${esc(K(over))}</b></span>` : `<span><i style="background:var(--surface2);border:1px solid var(--line)"></i>Unallocated<b>${esc(K(free))}</b></span>`}
        </div>
        <div class="note">Funding in total: <b>${esc(M(t.funds))}</b></div>
      </div>
    </div>
  </div>

  <div class="grid g4" style="margin-bottom:16px">
    <div class="kpi"><div class="lbl">Budget</div><div class="val">${esc(M(t.budget))}</div><div class="sub">what you planned</div></div>
    <div class="kpi"><div class="lbl">Spent so far</div><div class="val">${esc(M(t.actual))}</div><div class="sub">${t.budget?used.toFixed(0)+'% of the budget':'no budget yet'}</div></div>
    <div class="kpi"><div class="lbl">Forecast cost</div><div class="val">${esc(M(t.forecast))}</div><div class="sub">if nothing else changes</div></div>
    <div class="kpi"><div class="lbl">Over / under budget</div><div class="val ${t.variance<0?'neg':'pos'}">${esc(M(Math.abs(t.variance)))}</div><div class="sub">${t.variance<0?'over':'under'} budget</div></div>
  </div>

  ${t.stages.length ? `<div class="grid g2">
    <div class="card"><h2>Budget vs spent by stage</h2><div class="chartbox auto"><canvas id="cTrkBars"></canvas></div>
      ${legendHtml([{label:'Budget',color:PALETTE[0]},{label:'Spent',color:PALETTE[1]}])}</div>
    <div class="card"><h2>Where the money has gone</h2><div class="chartbox"><canvas id="cTrkDonut"></canvas></div><div id="trkLegend"></div></div>
  </div>` : ''}

  <div class="card-h" style="margin:6px 0 10px"><h2>Stages</h2>
    <div class="actions"><button class="btn primary" data-act="addStage">+ Add a stage</button></div>
    <div class="sub">Each phase of the project, with the items you are paying for inside it. Tick an item when it is paid.</div></div>
  ${p.sections.length ? p.sections.map(s=>trackerStageHtml(p, s, t)).join('') :
    `<div class="card">${emptyState('🧱','No stages yet','Add a stage for each phase of the project, then add the items you are paying for inside it.',
      '<button class="btn primary lg" data-act="addStage">+ Add a stage</button>')}</div>`}

  <div class="card">
    ${cardHead('Funding','Whatever is paying for this: savings, a loan, a grant, a client budget.','<button class="btn primary" data-act="addFund">+ Add a source</button>')}
    ${p.funding.length ? p.funding.map(f=>`<div class="trk-fund" data-f="${esc(f.id)}">
        <input data-act="fname" value="${esc(f.name)}" aria-label="Source">
        <input class="num" style="text-align:right" data-act="famount" inputmode="decimal" value="${esc(trackerAmountText(f.amount))}" placeholder="0" ${num(f.amount)?'':'data-need'} aria-label="Amount">
        <button class="btn sm danger" data-act="delFund" aria-label="Delete source">x</button></div>`).join('')
      : '<div class="empty">Nothing yet - add a source, or take a savings account from your household figures below.</div>'}
    ${savings.length ? `<div class="note" style="margin-bottom:6px">Take from your savings:</div><div class="chips">${savings.map(a=>
      `<button class="chip" data-act="fundFrom" data-name="${esc(a.name)}" data-amount="${num(a.opening)}">+ ${esc(a.name)} <small>${esc(fmt0(num(a.opening)))}</small></button>`).join('')}</div>` : ''}
  </div>

  <details class="more"><summary>How the forecast works</summary>
    <p class="note" style="margin-top:8px">The forecast is <b>what the project costs if nothing else changes</b>. An item you have not ticked off might still cost its budget, so it counts at whichever is higher: its budget, or what you have spent so far.
    Once you tick an item as paid, it counts at exactly what you paid. So as the work finishes the forecast settles onto the real cost, and the number at the top is how much of your funding is left.</p>
  </details>

  <div class="card">
    ${cardHead('Share or keep a copy','Your projects are part of your Penny Keeper backup. These are for sharing a project or opening it in a spreadsheet.')}
    <div class="row"><button class="btn" data-act="exportCsv">Export this project (.csv)</button>
      <button class="btn" data-act="exportJson">Export all projects (.json)</button>
      <button class="btn" data-act="import">Import (.json)</button></div>
  </div>`;
}

function trackerStageHtml(p, s, t){
  const cur = p.currency, st = t.stages.find(x=>x.id===s.id) || {budget:0, actual:0};
  const isOver = st.budget > 0 && st.actual > st.budget;
  const pctW = st.budget ? Math.min(100, st.actual / st.budget * 100) : (st.actual ? 100 : 0);
  const note = isOver ? 'over by '+trackerMoneyK(st.actual - st.budget, cur) : st.budget ? Math.round(st.actual / st.budget * 100)+'% used' : 'no budget';
  return `<div class="card" data-s="${esc(s.id)}">
    <div class="trk-stagehead">
      <button class="btn sm ghost" style="font-size:16px;padding:2px 8px" data-act="toggle" aria-expanded="${s.open}" aria-label="${s.open?'Collapse':'Expand'} stage">${s.open?'▾':'▸'}</button>
      <input data-act="sname" value="${esc(s.name)}" aria-label="Stage name" style="font-weight:650;flex:1;min-width:0">
      <div class="tot"><b class="num">${esc(trackerMoneyK(st.actual, cur))}</b> <span class="mut">/ ${esc(trackerMoneyK(st.budget, cur))}</span><br><span class="pill ${isOver?'bad':''}">${esc(note)}</span></div>
      <button class="btn sm danger" data-act="delSection" aria-label="Delete stage">x</button>
    </div>
    <div class="meter ${isOver?'bad':''}" style="margin:10px 0 4px"><i style="width:${pctW}%"></i></div>
    ${!s.open ? '' : `
    <div class="trk-head"><span title="Paid">✓</span><span>Item ${ttHtml('Tick the box when an item is paid. A ticked item counts at what you actually paid; an unticked one counts at its budget, or what you have spent if that is more.')}</span><span class="n">Budget</span><span class="n">Spent</span><span></span></div>
    ${s.items.map(i=>`<div class="trk-item ${i.done?'done':''}" data-s="${esc(s.id)}" data-i="${esc(i.id)}">
      <input type="checkbox" data-act="done" ${i.done?'checked':''} aria-label="Paid - this item is finished">
      <input class="iname" data-act="iname" value="${esc(i.name)}" aria-label="Item name">
      <span class="amts">
        <label class="a" data-label="Budget"><input class="num" data-act="budget" inputmode="decimal" value="${esc(trackerAmountText(i.budget))}" placeholder="0" ${(!i.done && !num(i.budget))?'data-need':''} aria-label="Budget"></label>
        <label class="a" data-label="Spent"><input class="num ${num(i.budget) && num(i.actual)>num(i.budget)?'over':''}" data-act="actual" inputmode="decimal" value="${esc(trackerAmountText(i.actual))}" placeholder="0" aria-label="Spent so far"></label>
      </span>
      <button class="btn sm danger" data-act="delItem" aria-label="Delete item">x</button>
    </div>`).join('') || '<div class="empty">No items yet - add the things you are paying for in this stage.</div>'}
    <div class="row" style="margin-top:10px"><button class="btn sm" data-act="addItem" data-s="${esc(s.id)}">+ Add an item</button></div>`}
  </div>`;
}

function trackerCharts(p){
  const t = trackerTotals(p);
  if(!t.stages.length) return;
  chart(()=>{
    const keep = CUR; CUR = safeCur(p.currency);          // the chart code formats with the global currency symbol
    try{
      hBars($('#cTrkBars'), t.stages.map(s=>s.name), [
        {name:'Budget', color:PALETTE[0], values:t.stages.map(s=>s.budget)},
        {name:'Spent',  color:PALETTE[1], values:t.stages.map(s=>s.actual)}]);
      const items = t.stages.map((s,i)=>({label:s.name, value:s.actual, color:PALETTE[i%PALETTE.length]})).filter(x=>x.value>0);
      donut($('#cTrkDonut'), items, {caption:'spent'});
      $('#trkLegend').innerHTML = items.length ? legendHtml(items) : '<div class="note">Fill in what has been spent and this fills up.</div>';
    } finally { CUR = keep; }
  });
}

/* one pair of delegated listeners for the whole page (the page is rebuilt on every edit, so listeners on the
   elements themselves would be lost; these sit on the section, which is not) */
function wireTracker(el){
  if(el.dataset.trkWired) return;
  el.dataset.trkWired = '1';
  const T = () => DB.tracker;
  const stage = id => { const p = trackerProject(); return p && p.sections.find(s=>s.id===id); };
  const item = (sid, iid) => { const s = stage(sid); return s && s.items.find(i=>i.id===iid); };
  const commit = ()=>{ save(); render(); };

  el.addEventListener('click', e=>{
    const btn = e.target.closest('[data-act]');
    if(!btn || /^(INPUT|SELECT)$/.test(btn.tagName)) return;
    const act = btn.dataset.act, p = trackerProject();
    const sec = e.target.closest('[data-s]'), row = e.target.closest('.trk-item'), fund = e.target.closest('.trk-fund');
    if(act==='tpl'){
      let np;
      if(btn.dataset.tpl==='blank'){
        const name = prompt('Name this project', 'My project'); if(name===null) return;
        np = trackerNewProject(name.trim() || 'My project');
      } else np = trackerFromTemplate(btn.dataset.tpl);
      T().projects.push(np); T().active = np.id; trackerPicking = false; commit();
      toast('Project created - now fill in the costs');
    }
    else if(act==='cancelPick'){ trackerPicking = false; render(); }
    else if(act==='newProject'){ trackerPicking = true; render({reset:true}); window.scrollTo({top:0}); }
    else if(act==='standalone'){
      const f = trackerStandalone(); if(!f) return;
      trackerAdd(f.projects); trackerPicking = false; commit(); toast('Brought across '+f.projects.length+' project'+(f.projects.length===1?'':'s'));
    }
    else if(act==='rename' && p){ const name = prompt('Rename project', p.name); if(name===null) return; p.name = name.trim() || p.name; commit(); }
    else if(act==='delProject' && p){
      if(!confirm('Delete "'+p.name+'" and everything in it? This cannot be undone.')) return;
      T().projects = T().projects.filter(x=>x.id!==p.id);
      T().active = T().projects[0] ? T().projects[0].id : '';
      commit(); toast('Project deleted');
    }
    else if(act==='addStage' && p){
      p.sections.push({id:uid(), name:'New stage', open:true, items:[]}); commit();
      const names = $$('input[data-act="sname"]', el); const last = names[names.length-1]; if(last){ last.focus(); last.select(); }
    }
    else if(act==='toggle'){ const s = stage(sec.dataset.s); s.open = !s.open; commit(); }
    else if(act==='delSection'){
      const s = stage(sec.dataset.s);
      if(s.items.length && !confirm('Delete "'+s.name+'" and its '+s.items.length+' item'+(s.items.length===1?'':'s')+'?')) return;
      p.sections = p.sections.filter(x=>x.id!==s.id); commit();
    }
    else if(act==='addItem'){
      stage(btn.dataset.s).items.push(trackerNewItem('New item', 0)); commit();
      const names = $$('[data-s="'+btn.dataset.s+'"] .iname', el); const last = names[names.length-1]; if(last){ last.focus(); last.select(); }
    }
    else if(act==='delItem'){ const s = stage(row.dataset.s); s.items = s.items.filter(i=>i.id!==row.dataset.i); commit(); }
    else if(act==='addFund' && p){ p.funding.push({id:uid(), name:'New source', amount:0}); commit(); }
    else if(act==='delFund' && p){ p.funding = p.funding.filter(f=>f.id!==fund.dataset.f); commit(); }
    else if(act==='fundFrom' && p){ p.funding.push({id:uid(), name:btn.dataset.name, amount:num(btn.dataset.amount)}); commit(); }
    else if(act==='exportJson'){ downloadText('budget-tracker-'+iso(new Date())+'.json', JSON.stringify(T(), null, 2)); toast('Saved your projects'); }
    else if(act==='exportCsv' && p){ downloadCSV(slug(p.name)+'-'+iso(new Date())+'.csv', trackerCsvRows(p)); }
    else if(act==='import'){ $('#trkFile').click(); }
  });

  el.addEventListener('change', e=>{
    const t = e.target; if(!t.dataset || !t.dataset.act) return;
    const act = t.dataset.act, p = trackerProject();
    const row = t.closest('.trk-item'), sec = t.closest('[data-s]'), fund = t.closest('.trk-fund');
    if(act==='proj'){ T().active = t.value; trackerPicking = false; commit(); }
    else if(act==='cur' && p){ p.currency = safeCur(t.value); commit(); }
    else if(act==='iname'){ item(row.dataset.s, row.dataset.i).name = t.value.trim() || 'Untitled'; commit(); }
    else if(act==='budget' || act==='actual'){ item(row.dataset.s, row.dataset.i)[act] = parseAmount(t.value); commit(); }
    else if(act==='done'){ item(row.dataset.s, row.dataset.i).done = t.checked; commit(); }
    else if(act==='sname'){ stage(sec.dataset.s).name = t.value.trim() || 'Untitled stage'; commit(); }
    else if(act==='fname' && p){ p.funding.find(f=>f.id===fund.dataset.f).name = t.value.trim() || 'Source'; commit(); }
    else if(act==='famount' && p){ p.funding.find(f=>f.id===fund.dataset.f).amount = parseAmount(t.value); commit(); }
  });
  /* Enter in a box commits it, like leaving it */
  el.addEventListener('keydown', e=>{ if(e.key==='Enter' && e.target.tagName==='INPUT' && e.target.dataset.act) e.target.blur(); });

  el.addEventListener('change', e=>{
    if(e.target.id !== 'trkFile') return;
    const f = e.target.files[0]; e.target.value = '';
    if(!f) return;
    const rd = new FileReader();
    rd.onload = ()=>{
      let n = null;
      try{ n = trackerNormalise(JSON.parse(rd.result)); }catch(err){ n = null; }
      if(!n || !n.projects.length){ toast('That file is not a budget tracker export'); return; }
      if(T().projects.length){
        if(confirm('Add '+n.projects.length+' project'+(n.projects.length===1?'':'s')+' to the ones you already have?')) trackerAdd(n.projects);
        else if(confirm('Replace ALL your projects with the ones in this file? This cannot be undone.')) DB.tracker = n;
        else return;
      } else DB.tracker = n;
      trackerPicking = false; commit(); toast('Imported '+n.projects.length+' project'+(n.projects.length===1?'':'s'));
    };
    rd.onerror = ()=> toast('Could not read that file');
    rd.readAsText(f);
  });
}
