function renderNetWorth(el){
  const N = DB.netWorth, F = netWorthFigures();
  const snaps = N.snaps.slice().sort((a,b)=>a.date<b.date?-1:1);
  const prev = snaps.length ? snaps[snaps.length-1] : null;
  const change = prev ? F.net - prev.net : 0;
  const row = (x, kind, i)=> x.auto
    ? `<tr><td>${esc(x.name)} <span class="pill">from ${x.src==='savings'?'Savings':x.src==='loans'?'Loans':'Mortgage'}</span></td>
        <td class="n">${fmt(x.value)}</td><td class="act"><button class="btn sm ghost" data-go="${x.src}">Edit</button></td></tr>`
    : `<tr><td><input data-nw="${kind}|${x.id}|name" value="${esc(x.name)}"></td>
        <td class="n"><input class="num" style="text-align:right;width:130px" data-nw="${kind}|${x.id}|value" value="${num(x.value)||''}" inputmode="decimal"></td>
        <td class="act"><button class="btn sm danger" data-nw-del="${kind}|${x.id}" aria-label="Delete">x</button></td></tr>`;
  const assetIdeas = ['Home value','Car','Pension pot','Investments','Prize bonds / Credit union','Other'];
  const liabIdeas = ['Credit card','Car finance','Student loan','Other debt'];
  el.innerHTML = `
  <div class="grid g3" style="margin-bottom:16px">
    <div class="kpi"><div class="lbl" data-nott>What you own</div><div class="val pos">${fmt0(F.A)}</div></div>
    <div class="kpi"><div class="lbl" data-nott>What you owe</div><div class="val neg">${fmt0(F.L)}</div></div>
    <div class="kpi"><div class="lbl" data-nott>Net worth</div><div class="val ${F.net>=0?'pos':'neg'}">${fmt0(F.net)}</div>
      <div class="sub">${prev?(change>=0?'up ':'down ')+fmt0(Math.abs(change))+' since '+esc(prev.date):'save a snapshot to start tracking'}</div></div>
  </div>
  <div class="grid" style="grid-template-columns:repeat(auto-fit,minmax(380px,1fr))">
    <div class="card">
      ${cardHead('What you own','Savings are pulled in automatically',`<button class="btn" id="addAsset">+ Add</button>`)}
      <div class="tw"><table><thead><tr><th>Item</th><th class="n">Value</th><th></th></tr></thead>
        <tbody>${F.assets.map((x,i)=>row(x,'assets',i)).join('') || '<tr><td colspan="3" class="empty">Nothing yet.</td></tr>'}</tbody>
        <tfoot><tr><td>Total</td><td class="n">${fmt(F.A)}</td><td></td></tr></tfoot></table></div>
      <div class="chips" style="margin-top:10px">${assetIdeas.map(n=>`<button class="chip" data-nw-add="assets|${esc(n)}">+ ${esc(n)}</button>`).join('')}</div>
    </div>
    <div class="card">
      ${cardHead('What you owe','Loans and your mortgage are pulled in automatically',`<button class="btn" id="addLiab">+ Add</button>`)}
      <div class="tw"><table><thead><tr><th>Item</th><th class="n">Owed</th><th></th></tr></thead>
        <tbody>${F.liabs.map((x,i)=>row(x,'liabs',i)).join('') || '<tr><td colspan="3" class="empty">Nothing owed - lovely.</td></tr>'}</tbody>
        <tfoot><tr><td>Total</td><td class="n">${fmt(F.L)}</td><td></td></tr></tfoot></table></div>
      <div class="chips" style="margin-top:10px">${liabIdeas.map(n=>`<button class="chip" data-nw-add="liabs|${esc(n)}">+ ${esc(n)}</button>`).join('')}</div>
    </div>
  </div>
  <div class="card">
    ${cardHead('Your net worth over time','Save a snapshot every few months and the line builds up.',
      `<button class="btn primary" id="snapNow">📸 Save a snapshot today</button>`)}
    ${snaps.length>=2 ? `<div class="chartbox"><canvas id="cNW"></canvas></div>
      ${legendHtml([{label:'Net worth',color:PALETTE[0]},{label:'Owned',color:PALETTE[5]},{label:'Owed',color:PALETTE[2]}])}`
      : emptyState('📈', snaps.length?'One snapshot saved':'No snapshots yet', 'Save a snapshot now, and another in a few months - the chart appears once there are two.')}
    ${snaps.length?`<details class="more"><summary>Saved snapshots (${snaps.length})</summary><div class="tw"><table>
      <thead><tr><th>Date</th><th class="n">Owned</th><th class="n">Owed</th><th class="n">Net worth</th><th></th></tr></thead>
      <tbody>${snaps.slice().reverse().map(s=>`<tr><td>${esc(s.date)}</td><td class="n">${fmt(s.assets)}</td><td class="n">${fmt(s.liabs)}</td>
        <td class="n"><b>${fmt(s.net)}</b></td><td class="act"><button class="btn sm danger" data-snap-del="${esc(s.date)}" aria-label="Delete">x</button></td></tr>`).join('')}</tbody></table></div></details>`:''}
  </div>`;

  const find = (kind,id)=> DB.netWorth[kind].find(x=>x.id===id);
  $('#addAsset').onclick = ()=>{ N.assets.push({id:uid(), name:'New asset', value:0}); save(); render(); };
  $('#addLiab').onclick = ()=>{ N.liabs.push({id:uid(), name:'New debt', value:0}); save(); render(); };
  $$('[data-nw-add]',el).forEach(b=> b.onclick = ()=>{ const [k,n] = b.dataset.nwAdd.split('|'); N[k].push({id:uid(), name:n, value:0}); save(); render(); });
  $$('[data-nw]',el).forEach(inp=> inp.onchange = ()=>{
    const [k,id,f] = inp.dataset.nw.split('|'); const it = find(k,id); if(!it) return;
    it[f] = f==='value' ? num(inp.value) : inp.value; save(); render(); });
  $$('[data-nw-del]',el).forEach(b=> b.onclick = ()=>{
    const [k,id] = b.dataset.nwDel.split('|'); const i = N[k].findIndex(x=>x.id===id);
    if(i>=0){ N[k].splice(i,1); save(); render(); } });
  $('#snapNow').onclick = ()=>{
    const d = iso(new Date());
    N.snaps = N.snaps.filter(s=>s.date!==d);
    N.snaps.push({date:d, assets:round2(F.A), liabs:round2(F.L), net:round2(F.net)});
    save(); render(); toast('Snapshot saved');
  };
  $$('[data-snap-del]',el).forEach(b=> b.onclick = ()=>{ N.snaps = N.snaps.filter(s=>s.date!==b.dataset.snapDel); save(); render(); });
  if(snaps.length>=2) chart(()=> lineChart($('#cNW'), snaps.map(s=>s.date), [
    {name:'Net worth', color:PALETTE[0], values:snaps.map(s=>s.net), fill:true},
    {name:'Owned', color:PALETTE[5], values:snaps.map(s=>s.assets), dash:true},
    {name:'Owed', color:PALETTE[2], values:snaps.map(s=>s.liabs), dash:true}
  ]));
}

