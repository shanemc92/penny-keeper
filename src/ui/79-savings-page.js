/* ---------------- savings ---------------- */
function renderSavings(el){
  const s = Y.savings;
  const proj = projectSavings();
  const monthlyIn = s.accounts.reduce((x,a)=>x+num(a.monthly),0);
  const now = s.accounts.reduce((x,a)=>x+num(a.opening),0);
  const end = proj.length? proj[proj.length-1].total : 0;

  el.innerHTML = savingsBreakdownCard() + `
  <div class="card">
    <h2>Plan</h2>
    <div class="row">
      <label class="f"><span>Start</span><input type="date" data-path="savings.startDate" value="${esc(s.startDate||'')}"></label>
      <label class="f"><span>Months to project</span><input class="num" data-path="savings.months" data-type="number" value="${num(s.months)}"></label>
      <label class="f"><span>Annual growth %</span><input class="num" data-path="savings.growthPct" data-type="number" step="0.1" value="${num(s.growthPct)}"></label>
      <div class="spacer"></div>
      <div class="kpi"><div class="lbl">Saving / month</div><div class="val">${fmt0(monthlyIn)}</div><div class="sub">${fmt0(monthlyIn*12)} a year</div></div>
      <div class="kpi"><div class="lbl">Balance today</div><div class="val">${fmt0(now)}</div></div>
      <div class="kpi"><div class="lbl">Projected</div><div class="val pos">${fmt0(end)}</div><div class="sub">${proj.length?proj[proj.length-1].date:''}</div></div>
    </div>
  </div>

  <div class="card">
    <h2>Accounts</h2>
    <div class="tw"><table>
      <thead><tr><th>Account</th><th class="n">Opening</th><th class="n">Monthly</th><th class="n">Deducted</th><th class="n">Projected end</th><th></th></tr></thead>
      <tbody>${s.accounts.map((a,i)=>`<tr>
        <td><input data-path="savings.accounts.${i}.name" value="${esc(a.name)}"></td>
        <td class="n"><input class="num" style="text-align:right" data-path="savings.accounts.${i}.opening" data-type="number" value="${num(a.opening)}"></td>
        <td class="n"><input class="num" style="text-align:right" data-path="savings.accounts.${i}.monthly" data-type="number" value="${num(a.monthly)}"></td>
        <td class="n">${(()=>{ const d = deductedTotal(a);
          return d ? `<span class="neg">${fmt(d)}</span>` : '<span class="mut">-</span>'; })()}
          <button class="btn sm" data-dip="${i}" title="Log money taken out">Log</button></td>
        <td class="n">${proj.length?fmt(proj[proj.length-1].values[i]):''}</td>
        <td class="act"><button class="btn sm danger" data-del-acct="${i}">x</button></td></tr>`).join('')
        || '<tr><td colspan="6" class="empty">No savings accounts yet.</td></tr>'}</tbody>
      <tfoot><tr><td>Total</td><td class="n">${fmt(now)}</td><td class="n">${fmt(monthlyIn)}</td>
        <td class="n neg">${fmt(s.accounts.reduce((x,a)=>x+deductedTotal(a),0))}</td>
        <td class="n">${fmt(end)}</td><td></td></tr></tfoot>
    </table></div>
    <div class="row" style="margin-top:10px">
      <button class="btn" id="addAcct">+ Add account</button>
      <button class="btn" id="exportSavings">Export CSV</button>
    </div>
    ${dipRows(s)}
  </div>

  <div class="card">
    <h2>Projection</h2>
    <div class="chartbox" style="height:320px"><canvas id="cProj"></canvas></div>
    ${legendHtml(s.accounts.slice(0,8).map((a,i)=>({label:a.name,color:PALETTE[i%PALETTE.length]})).concat([{label:'Total',color:css('--text')}]))}
  </div>

  <div class="card">
    <h2>Balances by month</h2>
    <div class="tw" style="max-height:380px;overflow:auto"><table>
      <thead><tr><th>Month</th>${s.accounts.map(a=>`<th class="n">${esc(a.name)}</th>`).join('')}<th class="n">Total</th></tr></thead>
      <tbody>${proj.map(r=>`<tr><td>${r.date.slice(0,7)}</td>${r.values.map(v=>`<td class="n">${fmt(v)}</td>`).join('')}
        <td class="n"><b>${fmt(r.total)}</b></td></tr>`).join('')}</tbody>
    </table></div>
  </div>`;

  wireFields(el);
  $('#addAcct').onclick = ()=>{ s.accounts.push({name:'Account '+(s.accounts.length+1), opening:0, monthly:0, adjust:{}}); save(); render(); };
  $$('[data-dip]',el).forEach(b=> b.onclick = ()=>{
    const a = s.accounts[+b.dataset.dip];
    const amt = num(prompt('How much came out of '+(a.name||'this account')+'?', ''));
    if(!amt) return;
    const when = (prompt('Which month? (YYYY-MM)', monthKey(new Date()))||'').trim();
    if(!/^\d{4}-\d{2}$/.test(when)){ toast('Need a month like 2026-03'); return; }
    a.adjust = a.adjust||{};
    a.adjust[when] = round2(num(a.adjust[when]) + amt);
    save(); render(); toast(fmt(amt)+' logged against '+when);
  });
  $$('[data-undip]',el).forEach(b=> b.onclick = ()=>{
    const [ai,mk] = b.dataset.undip.split('|');
    const a = s.accounts[+ai];
    if(a && a.adjust) delete a.adjust[mk];
    save(); render();
  });
  $$('[data-del-acct]',el).forEach(x=> x.onclick=()=>{ s.accounts.splice(+x.dataset.delAcct,1); save(); render(); });
  $('#exportSavings').onclick = ()=> downloadCSV('savings-'+yearLabel()+'.csv', savingsCSV());
  chart(()=>{
    const series = s.accounts.slice(0,8).map((a,i)=>({name:a.name, color:PALETTE[i%PALETTE.length], values:proj.map(r=>r.values[i])}));
    series.push({name:'Total', color:css('--text'), values:proj.map(r=>r.total), dash:true});
    lineChart($('#cProj'), proj.map(r=>r.date.slice(0,7)), series);
  });
}

const deductedTotal = a => Object.values((a && a.adjust) || {}).reduce((s,v)=>s+num(v),0);
/* Every dip into a savings account, listed so it can be corrected or removed.
   projectSavings() already subtracts these in the month they happened. */
function dipRows(s){
  const all = [];
  s.accounts.forEach((a,i)=> Object.entries(a.adjust||{}).forEach(([mk,v])=>
    all.push({i, name:a.name, mk, v:num(v)})));
  if(!all.length) return '';
  all.sort((x,y)=> x.mk<y.mk?1:-1);
  return `<details style="margin-top:10px"><summary>Money taken out (${all.length})</summary>
    <div class="tw" style="max-height:260px;overflow:auto;margin-top:8px"><table>
      <thead><tr><th>Month</th><th>Account</th><th class="n">Amount</th><th></th></tr></thead>
      <tbody>${all.map(d=>`<tr><td>${esc(d.mk)}</td><td>${esc(d.name)}</td>
        <td class="n neg">${fmt(d.v)}</td>
        <td class="act"><button class="btn sm danger" data-undip="${d.i}|${esc(d.mk)}">x</button></td></tr>`).join('')}</tbody>
    </table></div></details>`;
}

