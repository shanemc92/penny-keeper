/* ---------------- backup & settings ---------------- */
function backupAll(){
  DB.lastBackup = new Date().toISOString();
  save(true);
  downloadText('penny-keeper-backup-'+iso(new Date())+'.json', JSON.stringify(DB, null, 2));
  toast('Backup downloaded - keep it somewhere safe');
}
function loadDemoData(fromWelcome){
  if(!isBlankYear(Y) && !confirm('This replaces everything entered for '+yearLabel()+' with a fictional example household. Continue?')) return;
  try{
    const data = JSON.parse(DEMO_YEAR_JSON);
    data.year = Y.year;   // land it under whichever year slot is open
    DB.years[DB.active] = data;
    migrate(DB.years[DB.active]);
    Y = DB.years[DB.active]; CUR = safeCur(Y.currency);
    DB.ui.welcomed = true;
    save(); go('dashboard');
    toast('Example household loaded - explore, then clear it from Backup & settings');
  }catch(err){ console.warn('Load demo failed', err); toast('Could not load the example data'); }
}
function originalLedgerData(){
  try{
    const raw = localStorage.getItem('ledger.v1');
    if(!raw) return null;
    const j = JSON.parse(raw);
    return (j && j.years && Object.keys(j.years).length) ? j : null;
  }catch(e){ return null; }
}
function adoptDB(j, keepPrefs){
  if(keepPrefs){
    j.ui = Object.assign({}, DB.ui, j.ui||{});
    j.netWorth = j.netWorth || DB.netWorth;
    j.tracker = j.tracker || DB.tracker;
    j.theme = j.theme || DB.theme;
    j.lastBackup = j.lastBackup || DB.lastBackup;
  }
  DB = j;
  if(!DB.years[DB.active]) DB.active = Object.keys(DB.years).sort()[0];
  ensureDB();
  Object.values(DB.years).forEach(migrate);
  Y = DB.years[DB.active]; CUR = safeCur(Y.currency);
  applyTheme();
}
function renderData(el){
  const size = (()=>{ try{ return (new Blob([JSON.stringify(DB)]).size/1024).toFixed(1)+' KB'; }catch(e){ return '?'; } })();
  const blank = isBlankYear(Y);
  const lb = daysSinceBackup();
  const orig = originalLedgerData();
  el.innerHTML = `
  ${blank ? callout('tipc','🎬','Nothing entered yet for '+esc(yearLabel()),
    'Fill things in from the <a href="#" data-go="setup">Set-up guide</a>, or look around first with a made-up example household.',
    '<button class="btn primary" id="loadDemo">Load the example household</button>') : ''}
  <div class="card ${lb===null||lb>30?'accent':''}">
    ${cardHead('💾 Back up your data','Your information lives only in this browser. A backup is a small file you keep safe - email it to yourself or put it in cloud storage.')}
    <div class="row"><button class="btn primary lg" id="expAll">Download backup (all years)</button>
      <button class="btn" id="expJson">Just ${esc(yearLabel())}</button></div>
    <div class="note">${lb===null?'<b class="amb">You have not downloaded a backup yet.</b>':'Last backup: <b>'+(lb<=0?'today':lb+' day'+(lb===1?'':'s')+' ago')+'</b> ('+esc(DB.lastBackup.slice(0,10))+').'} Currently using ${size} of browser storage.</div>
  </div>

  <div class="card">
    ${cardHead('📂 Restore from a backup','Choose a backup file you downloaded earlier.')}
    <label class="f" style="max-width:420px"><span>Backup file (.json)</span><input type="file" id="impJson" accept=".json,application/json"></label>
    ${orig?`<div class="callout info"><div class="ci">🔎</div><div class="cb"><b class="ct">Found data from the older Ledger workbook in this browser</b>
      ${Object.keys(orig.years).length} year${Object.keys(orig.years).length===1?'':'s'} of data can be brought straight across. The older copy is left untouched.
      <br><button class="btn sm primary" id="impOrig">Import it now</button></div></div>`:''}
    <div class="note">Restoring replaces what is here with the contents of the file. A single-year file loads into that year.</div>
  </div>

  <div class="card">
    ${cardHead('📤 Export to Excel or CSV','For your accountant, or just to see the numbers in a spreadsheet.')}
    <div class="row"><button class="btn" id="expXlsx">Download workbook (.xlsx)</button><button class="btn" id="expAllCsv">Every sheet as CSV</button></div>
    <div class="note">The workbook has a sheet each for bills, tax, bank analysis, transactions, savings, history, loans and mortgages.</div>
  </div>

  <div class="card">
    ${cardHead('📅 Tax years and what-if copies','Each year has its own figures. Start a new year to roll your bills forward, or make a copy to try "what if" scenarios.')}
    <div class="tw"><table>
      <thead><tr><th>Year</th><th class="n">Bills</th><th class="n">Loans</th><th class="n">Transactions</th><th class="n">Budget /mo</th><th></th></tr></thead>
      <tbody>${Object.keys(DB.years).sort().map(y=>{
        const d = DB.years[y];
        const ann = d.bills.reduce((s,b)=> s+num(b.amount)*(FREQ[b.freq]||12), 0);
        return `<tr><td><b>${esc(yearLabel(d))}</b> ${y===DB.active?'<span class="pill on">open now</span>':`<button class="btn sm ghost" data-open-year="${esc(y)}">Open</button>`}</td>
          <td class="n">${d.bills.length}</td><td class="n">${d.loans.length}</td><td class="n">${d.txns.length}</td>
          <td class="n">${fmt(ann/12)}</td>
          <td class="act">${Object.keys(DB.years).length>1?`<button class="btn sm danger" data-del-year="${esc(y)}">Delete</button>`:''}</td></tr>`;
      }).join('')}</tbody>
    </table></div>
    <div class="row" style="margin-top:10px">
      <button class="btn" id="newYear2">+ New year from ${esc(yearLabel())}</button>
      <button class="btn" id="dupYear">Make a what-if copy</button>
    </div>
  </div>

  <div class="card">
    ${cardHead('⚙️ Preferences')}
    <div class="grid g3">
      <label class="f"><span>Theme</span><select id="themeSel"><option value="light" ${DB.theme==='light'?'selected':''}>Light</option><option value="dark" ${DB.theme==='dark'?'selected':''}>Dark</option></select></label>
      <label class="f"><span>Currency</span><input data-path="currency" value="${esc(Y.currency)}" maxlength="3"></label>
    </div>
    <label style="display:flex;gap:8px;align-items:flex-start;margin-top:4px"><input type="checkbox" id="setupToggle" ${DB.ui.hideSetup?'':'checked'} style="margin-top:4px">
      <span><b>Show the set-up guide in the menu</b><span class="hint" style="display:block;margin:0">Turn this off once you are set up to keep the menu shorter. You can turn it back on here whenever you like.</span></span></label>
    <label style="display:flex;gap:8px;align-items:flex-start;margin-top:10px"><input type="checkbox" id="matToggle" ${Y.maternity.enabled?'checked':''} style="margin-top:4px">
      <span><b>Maternity leave planner</b><span class="hint" style="display:block;margin:0">Models a period of leave - State benefit, employer top-up and the monthly shortfall. Shown under "More tools"; turn it off if you do not need it.</span></span></label>
    <div class="row" style="margin-top:12px"><button class="btn" id="replayTour">Replay the app tour</button><button class="btn" id="replayWelcome">Show the welcome screen</button></div>
  </div>

  ${!blank?`<div class="card">${cardHead('🎬 Example household','Replace this year with a made-up household to see how everything fits together.')}
    <button class="btn" id="loadDemo2">Load the example household</button></div>`:''}

  <div class="card">
    ${cardHead('🔒 Privacy')}
    <p style="margin:0">Everything you enter stays in this browser's local storage. There are no accounts, no analytics and no trackers, and nothing is sent anywhere.
    The page makes one request, to its own address, to check whether it is being served by a self-hosted sync server (<a href="homelab/README.md">see homelab</a>); that request carries none of your data.</p>
    <div class="note">Clearing your browser's site data erases it - which is why backups matter. Your backup also includes any projects in the Budget tracker.</div>
  </div>

  <div class="card">
    ${cardHead('⚠️ Danger zone')}
    <button class="btn danger" id="wipe">Erase everything in this browser</button>
    <div class="note">Download a backup first. This cannot be undone.</div>
  </div>`;

  wireFields(el);
  $('#expAll').onclick = backupAll;
  $('#expJson').onclick = ()=> downloadText('penny-keeper-'+yearLabel()+'.json', JSON.stringify({kind:'penny-keeper-year', year:Y.year, label:yearLabel(), data:Y}, null, 2));
  $('#expXlsx').onclick = ()=>{ downloadXlsx('finances-'+yearLabel()+'.xlsx', allSheets()); toast('Workbook downloaded'); };
  $('#expAllCsv').onclick = ()=>{
    const s = allSheets();
    s.forEach((sh,i)=> setTimeout(()=> downloadCSV(slug(sh.name)+'-'+yearLabel()+'.csv', sh.rows), i*350));
    toast('Downloading '+s.length+' files');
  };
  $('#impJson').onchange = e=>{
    const f = e.target.files[0]; if(!f) return;
    const rd = new FileReader();
    rd.onload = ()=>{
      /* Parsing and rendering are kept in separate try/catches: a JSON syntax error and a
         render-time crash from a missing field deserve different messages. */
      let parsedOk = false, n = 0;
      try{
        const j = JSON.parse(rd.result);
        if((j.kind==='penny-keeper-year' || j.kind==='ledger-year') && j.data){   // 'ledger-year' is what year files were called before the rename
          const yr = parseInt(j.year,10) || parseInt(j.data.year,10) || new Date().getFullYear();
          const key = String(j.label || j.data.label || yr);
          DB.years[key] = j.data; DB.active = key;
          Object.values(DB.years).forEach(migrate);
          Y = DB.years[DB.active]; CUR = safeCur(Y.currency);
        } else if(j.years && typeof j.years==='object' && Object.keys(j.years).length){
          adoptDB(j, true);
        } else { toast('That does not look like a Penny Keeper backup file'); e.target.value=''; return; }
        n = Y.txns.filter(t=>t.category).length;
        parsedOk = true;
      }catch(err){
        console.warn('Restore: file did not parse as JSON', err);
        toast('That file would not parse as JSON');
      }
      e.target.value = '';
      if(!parsedOk) return;
      try{
        save(); render();
        toast('Restored'+(n?' - '+n+' transactions categorised':''));
      }catch(err){
        console.warn('Restore: file parsed but a page failed to render', err);
        active = 'dashboard';
        try{ render({reset:true}); }catch(e2){ console.warn('Restore: Home also failed to render', e2); }
        toast('Restored, but something in that file looked odd - check the Bills and Take-home pay pages');
      }
    };
    rd.onerror = ()=>{ toast('Could not read that file'); e.target.value=''; };
    rd.readAsText(f);
  };
  if($('#impOrig')) $('#impOrig').onclick = ()=>{
    if(!isBlankYear(Y) && !confirm('This replaces what is currently in this app with the data from the older Ledger workbook. Continue?')) return;
    try{ adoptDB(JSON.parse(localStorage.getItem('ledger.v1')), true); save(); go('dashboard'); toast('Imported from the older Ledger workbook'); }
    catch(err){ console.warn(err); toast('Could not import it'); }
  };
  $$('[data-open-year]',el).forEach(x=> x.onclick = ()=>{ DB.active = x.dataset.openYear; Y = DB.years[DB.active]; CUR = safeCur(Y.currency); save(); render(); });
  $$('[data-del-year]',el).forEach(x=> x.onclick=()=>{
    const y = x.dataset.delYear;
    if(!confirm('Delete '+y+' permanently?')) return;
    delete DB.years[y];
    if(DB.active===y) DB.active = Object.keys(DB.years).sort()[0];
    Y = DB.years[DB.active]; save(); render();
  });
  $('#newYear2').onclick = newYear;
  $('#dupYear').onclick = duplicateYear;
  if($('#loadDemo')) $('#loadDemo').onclick = ()=> loadDemoData();
  if($('#loadDemo2')) $('#loadDemo2').onclick = ()=> loadDemoData();
  $('#themeSel').onchange = e=>{ DB.theme = e.target.value; applyTheme(); save(true); render(); };
  $('#matToggle').onchange = e=>{
    Y.maternity.enabled = e.target.checked;
    save(); render();
    if(e.target.checked) toast('Maternity leave added under More tools');
  };
  $('#setupToggle').onchange = e=>{
    DB.ui.hideSetup = !e.target.checked;
    save(true); render();
    toast(e.target.checked ? 'The set-up guide is back in the menu' : 'Set-up guide hidden from the menu');
  };
  $('#replayTour').onclick = startTour;
  $('#replayWelcome').onclick = showWelcome;
  $('#wipe').onclick = ()=>{
    if(!confirm('Erase all years, and your Budget tracker projects, from this browser? Download a backup first; this cannot be undone.')) return;
    [KEY].concat(EARLIER_KEYS).forEach(k=> localStorage.removeItem(k));
    load(); active = 'dashboard'; render(); toast('Cleared');
  };
}

