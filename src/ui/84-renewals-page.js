/* ---------------- contract renewals ---------------- */

function renderRenewals(el){
  const R = Y.renewals;
  const items = R.items;
  const billNames = Y.bills.map(b=>b.name).filter(Boolean);

  const rows = items.map((c,i)=>{
    const d = daysUntil(c.end);
    const pill = d===null ? '<span class="mut">no date</span>'
      : d < 0 ? '<span class="pill" style="border-color:var(--bad);color:var(--bad)">expired</span>'
      : d <= 7 ? `<span class="pill" style="border-color:var(--bad);color:var(--bad)">${d}d</span>`
      : d <= 30 ? `<span class="pill" style="border-color:var(--warn);color:var(--warn)">${d}d</span>`
      : d <= 60 ? `<span class="pill on">${d}d</span>`
      : `<span class="pill">${d}d</span>`;
    return `<tr>
      <td><input data-path="renewals.items.${i}.name" value="${esc(c.name)}" placeholder="Broadband" list="billNameList"></td>
      <td><input data-path="renewals.items.${i}.provider" value="${esc(c.provider)}" placeholder="Siro"></td>
      <td><input type="date" data-path="renewals.items.${i}.end" value="${esc(c.end||'')}" style="min-width:140px"></td>
      <td class="n">${pill}</td>
      <td class="n"><input class="num" style="text-align:right;width:90px" data-path="renewals.items.${i}.cost" data-type="number" value="${num(c.cost)}"></td>
      <td><input data-path="renewals.items.${i}.notes" value="${esc(c.notes)}" placeholder="Out of contract fee applies"></td>
      <td class="act">
        <button class="btn sm" data-renewed="${i}" title="Push the date on a year and reset the alerts">Renewed</button>
        <button class="btn sm danger" data-del-renewal="${i}">x</button></td>
    </tr>`;
  }).join('');

  const soon = upcomingRenewals(60);

  el.innerHTML = `
  <datalist id="billNameList">${billNames.map(n=>`<option value="${esc(n)}">`).join('')}</datalist>

  ${soon.length?`<div class="grid g4" style="margin-bottom:14px">
    ${soon.slice(0,4).map(c=>`<div class="kpi"><div class="lbl">${esc(c.name||'unnamed')}</div>
      <div class="val ${c.days<=14?'neg':c.days<=30?'amb':''}">${c.days}d</div>
      <div class="sub">${esc(c.provider||'')}${c.provider?' - ':''}${esc(c.end)}</div></div>`).join('')}
  </div>`:''}

  <div class="card">
    <h2>Contracts <span class="pill">${items.length}</span></h2>
    <div class="tw"><table>
      <thead><tr><th>Contract</th><th>Provider</th><th>Ends</th><th class="n">Left</th>
        <th class="n">Cost /mo</th><th>Notes</th><th></th></tr></thead>
      <tbody>${rows||'<tr><td colspan="7" class="empty">Nothing tracked yet. Add the ones with a fixed term - broadband, insurance, energy, mobile.</td></tr>'}</tbody>
    </table></div>
    <div class="row" style="margin-top:10px">
      <button class="btn primary" id="addRenewal">+ Add contract</button>
      <button class="btn" id="exportRenewals">Export CSV</button>
    </div>
    <div class="note" style="margin-bottom:6px">Quick add:</div>
    <div class="chips">${['Broadband','Mobile phone','Home insurance','Car insurance','Health insurance','Electricity','Gas','TV / streaming'].map(n=>
      `<button class="chip" data-renew-idea="${n}">+ ${n}</button>`).join('')}</div>
    <div class="note">Anything inside 60 days shows on your Home page, so you see it whenever you open the app.
      "Renewed" moves the end date on twelve months, ready for the next cycle.</div>
  </div>`;

  wireFields(el);
  $('#addRenewal').onclick = ()=>{
    R.items.push({id:uid(), name:'New contract', provider:'', end:'', cost:0, notes:''});
    save(); render();
  };
  $$('[data-del-renewal]',el).forEach(b=> b.onclick = ()=>{
    R.items.splice(+b.dataset.delRenewal,1); save(); render();
  });
  $$('[data-renewed]',el).forEach(b=> b.onclick = ()=>{
    const c = R.items[+b.dataset.renewed];
    const d = parseDate(c.end);
    if(!d){ toast('Set an end date first'); return; }
    c.end = iso(addMonths(d,12));
    save(); render();
    toast('Moved on to '+c.end);
  });
  $('#exportRenewals').onclick = ()=> downloadCSV('contracts-'+yearLabel()+'.csv', renewalsCSV());
  $$('[data-renew-idea]',el).forEach(b=> b.onclick = ()=>{
    R.items.push({id:uid(), name:b.dataset.renewIdea, provider:'', end:'', cost:0, notes:''});
    save(); render(); toast('Added - now set the date it ends');
  });
}

