/* ---------------- disposable income ---------------- */
function renderDisposable(el){
  const D = Y.disposable;
  const months = dispMonths();
  if(!months.includes(DB.ui.dispMonth)) DB.ui.dispMonth = dispDefaultMonth();
  const key = DB.ui.dispMonth;
  const S = disposableSummary(key), Hh = S.household;
  const people = Y.people, multi = people.length>1;
  const hasPay = household().net>0;
  const todayIso = iso(new Date());
  const holders = Array.from(new Set(['Joint', ...people.map(p=>p.name), ...D.items.map(i=>i.who), ...D.entries.map(e=>e.who)].filter(Boolean)));
  const whoOpts = cur => holders.map(h=>`<option ${h===cur?'selected':''}>${esc(h)}</option>`).join('');
  const catOpts = cur => DISPOSABLE_CATS.map(([c,ic])=>`<option value="${esc(c)}" ${c===cur?'selected':''}>${ic} ${esc(c)}</option>`).join('');
  const haveSub = new Set(D.items.map(i=>i.name.toLowerCase()));
  const shareText = S.rows.map(r=>esc(r.name)+' '+pct(r.share*100)).join(', ');

  /* the rows of "where it went": subscriptions first, then each category you have logged */
  const bars = (Hh.subs>0 ? [{icon:'🔁', name:'Subscriptions', amount:Hh.subs}] : []).concat(S.byCategory);
  const barMax = Math.max(...bars.map(b=>b.amount), 1), barTotal = bars.reduce((s,b)=>s+b.amount, 0);

  /* the same, split by who paid: one column per person, then Joint */
  const matrix = (()=>{
    const cell = (list, who, f)=> list.filter(x=>x.who===who).reduce((s,x)=>s+f(x), 0);
    const rows = [];
    if(Hh.subs>0) rows.push({label:'🔁 Subscriptions', vals:holders.map(h=>cell(D.items, h, dispMonthly))});
    S.byCategory.forEach(c=> rows.push({label:c.icon+' '+c.name, vals:holders.map(h=>S.entries.filter(e=>e.category===c.name && e.who===h).reduce((s,e)=>s+num(e.amount), 0))}));
    return rows;
  })();

  const monthNav = `<button class="btn sm" data-month="${months[months.indexOf(key)+1]||''}" aria-label="Earlier month" ${months.indexOf(key)>=months.length-1?'disabled':''}>&larr;</button>
    <select id="dMonth" aria-label="Month" style="width:auto">${months.map(m=>`<option value="${m}" ${m===key?'selected':''}>${esc(dispMonthLabel(m))}</option>`).join('')}</select>
    <button class="btn sm" data-month="${months[months.indexOf(key)-1]||''}" aria-label="Later month" ${months.indexOf(key)<=0?'disabled':''}>&rarr;</button>`;

  el.innerHTML = `
  ${!hasPay ? callout('tipc','💶','Add your pay first','Your disposable income is what is left after bills and savings, so it needs your salary and bills to work from.',
      `<button class="btn primary sm" data-go="tax">Add your salary</button> <button class="btn sm" data-go="budget">Add your bills</button>`) : ''}
  ${hasPay && Hh.spare<=0 ? callout('warn','⚠️','Nothing is left after bills and savings','Your bills and savings take all of your take-home pay, so anything logged here is spent on top. Look at Bills & budget first.') : ''}
  <div class="grid g4" style="margin-bottom:16px">
    <div class="kpi"><div class="lbl">Spare money / month</div><div class="val">${fmt0(Hh.spare)}</div><div class="sub">after bills and savings</div></div>
    <div class="kpi"><div class="lbl">Subscriptions / month</div><div class="val">${fmt0(Hh.subs)}</div><div class="sub">${D.items.filter(i=>num(i.amount)>0).length} regular ${D.items.length===1?'one':'ones'}, ${fmt0(Hh.subs*12)} a year</div></div>
    <div class="kpi"><div class="lbl" data-nott>Spent in ${esc(S.label)}</div><div class="val">${fmt0(Hh.spent)}</div><div class="sub">${S.entries.length} thing${S.entries.length===1?'':'s'} logged</div></div>
    <div class="kpi"><div class="lbl">Left this month</div><div class="val ${Hh.left>=0?'pos':'neg'}">${fmt0(Hh.left)}</div><div class="sub">${Hh.left>=0?fmt0(Hh.left*12/52)+' a week to spend':'overspent'}</div></div>
  </div>

  ${multi ? `<div class="card">
    ${cardHead('Per person', 'Each person\'s spare money, subscriptions and spending in '+esc(S.label))}
    <div class="tw"><table class="stack-m">
      <thead><tr><th>Person</th><th class="n">Spare money</th><th class="n">Subscriptions</th><th class="n">Spent</th><th class="n">Left to spend</th></tr></thead>
      <tbody>${S.rows.map(r=>`<tr>
        <td class="first" data-label="Person"><b>${esc(r.name)}</b></td>
        <td class="n" data-label="Spare money">${fmt(r.spare)}</td>
        <td class="n" data-label="Subscriptions">${fmt(r.subs)}</td>
        <td class="n" data-label="Spent">${fmt(r.spent)}</td>
        <td class="n ${r.left>=0?'pos':'neg'}" data-label="Left to spend"><b>${fmt(r.left)}</b></td></tr>`).join('')}
        ${S.stray>0.005 ? `<tr><td class="first" data-label="Person"><span class="mut">Someone no longer listed</span></td><td></td><td></td><td class="n" data-label="Spent">${fmt(S.stray)}</td><td></td></tr>` : ''}</tbody>
      <tfoot><tr><td>Household</td><td class="n">${fmt(Hh.spare)}</td><td class="n">${fmt(Hh.subs)}</td><td class="n">${fmt(Hh.spent)}</td><td class="n ${Hh.left>=0?'pos':'neg'}">${fmt(Hh.left)}</td></tr></tfoot>
    </table></div>
    <div class="note">Spare money is each person's pay less their own bills, their share of the joint bills and their savings. Anything marked <b>Joint</b> is shared out the same way as the joint bills (${shareText}).</div>
  </div>` : ''}

  <div class="card">
    ${cardHead('Subscriptions &amp; regular extras <span class="pill">'+D.items.length+'</span>', 'Things that come out every week, month or year and that you could live without',
      `<button class="btn primary" id="addSub">+ Add one</button>`)}
    ${D.items.length ? `<div class="tw"><table class="stack-m">
      <thead><tr><th>Name</th><th class="n">Amount</th><th>How often</th><th>Who pays</th><th class="n">Per month</th><th class="n">Per year</th><th></th></tr></thead>
      <tbody>${D.items.map((it,i)=>`<tr>
        <td class="first" data-label="Name"><input data-path="disposable.items.${i}.name" value="${esc(it.name)}" aria-label="Name" style="min-width:160px"></td>
        <td class="n" data-label="Amount"><input class="num" style="text-align:right;width:104px" data-path="disposable.items.${i}.amount" data-type="number" inputmode="decimal" value="${num(it.amount)||''}" placeholder="0.00" aria-label="Amount"></td>
        <td data-label="How often"><select data-path="disposable.items.${i}.freq" aria-label="How often" style="min-width:118px">${Object.keys(FREQ).map(f=>`<option ${f===it.freq?'selected':''}>${f}</option>`).join('')}</select></td>
        <td data-label="Who pays"><select data-path="disposable.items.${i}.who" aria-label="Who pays" style="min-width:104px">${whoOpts(it.who)}</select></td>
        <td class="n" data-label="Per month"><b>${fmt(dispMonthly(it))}</b></td>
        <td class="n" data-label="Per year">${fmt(dispMonthly(it)*12)}</td>
        <td class="act"><button class="btn sm danger" data-del-item="${esc(it.id)}" aria-label="Delete">x</button></td></tr>`).join('')}</tbody>
      <tfoot><tr><td>Total</td><td></td><td></td><td></td><td class="n">${fmt(Hh.subs)}</td><td class="n">${fmt(Hh.subs*12)}</td><td></td></tr></tfoot>
    </table></div>`
    : emptyState('🔁','No subscriptions yet','Tap the ideas below to add them, then fill in what each one costs - or add your own.')}
    <details class="more" ${D.items.length?'':'open'}><summary>⚡ Quick add common subscriptions</summary>
      <div class="chips" style="margin-top:8px">${SUBSCRIPTION_IDEAS.map(([n,f])=>
        `<button class="chip ${haveSub.has(n.toLowerCase())?'on':''}" data-addsub="${esc(n)}|${f}" ${haveSub.has(n.toLowerCase())?'disabled style="opacity:.6"':''}>${haveSub.has(n.toLowerCase())?'✓ ':'+ '}${esc(n)}</button>`).join('')}</div></details>
    <div class="note">Keep your essential bills in <a href="#" data-go="budget">Bills &amp; budget</a> and the optional extras here. A subscription entered in both places would be counted twice.</div>
  </div>

  <div class="card">
    ${cardHead('Where it went', 'Subscriptions plus everything you logged in the month', monthNav)}
    ${bars.length ? bars.map(b=>`<div class="row" style="align-items:center;gap:10px;margin:6px 0;flex-wrap:nowrap">
        <div style="width:176px;font-weight:600;font-size:13.5px;flex:none;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${b.icon} ${esc(b.name)}</div>
        <div class="meter" style="flex:1;height:16px"><i style="width:${b.amount/barMax*100}%"></i></div>
        <div class="num" style="width:84px;text-align:right;flex:none">${fmt0(b.amount)}</div>
        <div class="mut" style="width:44px;text-align:right;flex:none;font-size:12.5px">${barTotal?Math.round(b.amount/barTotal*100):0}%</div></div>`).join('')
      : emptyState('🍽️','Nothing to show for '+esc(S.label),'Add a subscription above, or log a meal out or a takeaway below, and the month fills in here.')}
    ${multi && matrix.length ? `<details class="more"><summary>👥 Per person, by category</summary>
      <div class="tw"><table><thead><tr><th>Category</th>${holders.map(h=>`<th class="n">${esc(h)}</th>`).join('')}<th class="n">Total</th></tr></thead>
        <tbody>${matrix.map(r=>`<tr><td>${esc(r.label)}</td>${r.vals.map(v=>`<td class="n">${v?fmt(v):'<span class="mut">-</span>'}</td>`).join('')}<td class="n"><b>${fmt(r.vals.reduce((a,b)=>a+b,0))}</b></td></tr>`).join('')}</tbody>
        <tfoot><tr><td>Total</td>${holders.map((h,hi)=>`<td class="n">${fmt(matrix.reduce((s,r)=>s+r.vals[hi],0))}</td>`).join('')}<td class="n">${fmt(barTotal)}</td></tr></tfoot></table></div>
      <div class="note">Who paid, before anything marked Joint is shared out. The Per person table above shares it.</div></details>` : ''}
  </div>

  <div class="card">
    ${cardHead('Log what you spent', 'A meal out, a takeaway, a coffee, a round - anything that is not in your regular bills')}
    <div class="row" style="align-items:flex-end">
      <label class="f" style="width:150px"><span>Date</span><input type="date" id="dDate" value="${key===monthKey(new Date())?todayIso:key+'-01'}"></label>
      <label class="f" style="flex:1;min-width:170px"><span>What was it</span><input id="dWhat" placeholder="e.g. Dinner at Dunne &amp; Crescenzi" maxlength="80"></label>
      <label class="f" style="width:190px"><span>Spent on</span><select id="dCat">${catOpts(DB.ui.dispCat||DISPOSABLE_CATS[0][0])}</select></label>
      <label class="f" style="width:130px"><span>Paid by</span><select id="dWho">${whoOpts(holders.includes(DB.ui.dispWho)?DB.ui.dispWho:'Joint')}</select></label>
      <label class="f" style="width:120px"><span>Amount</span><input class="num" id="dAmt" inputmode="decimal" placeholder="0.00" style="text-align:right"></label>
      <button class="btn primary" id="dAdd" style="margin-bottom:12px">+ Add</button>
    </div>
    ${S.entries.length ? `<div class="tw"><table class="stack-m">
      <thead><tr><th>Date</th><th>What</th><th>Spent on</th><th>Paid by</th><th class="n">Amount</th><th></th></tr></thead>
      <tbody>${S.entries.map(e=>{ const i = D.entries.indexOf(e); return `<tr>
        <td data-label="Date"><input type="date" data-path="disposable.entries.${i}.date" value="${esc(e.date)}" aria-label="Date" style="min-width:140px"></td>
        <td class="first" data-label="What"><input data-path="disposable.entries.${i}.what" value="${esc(e.what)}" aria-label="What" style="min-width:170px"></td>
        <td data-label="Spent on"><select data-path="disposable.entries.${i}.category" aria-label="Spent on" style="min-width:170px">${catOpts(e.category)}</select></td>
        <td data-label="Paid by"><select data-path="disposable.entries.${i}.who" aria-label="Paid by" style="min-width:104px">${whoOpts(e.who)}</select></td>
        <td class="n" data-label="Amount"><input class="num" style="text-align:right;width:104px" data-path="disposable.entries.${i}.amount" data-type="number" inputmode="decimal" value="${num(e.amount)||''}" aria-label="Amount"></td>
        <td class="act"><button class="btn sm danger" data-del-entry="${esc(e.id)}" aria-label="Delete">x</button></td></tr>`; }).join('')}</tbody>
      <tfoot><tr><td>Total</td><td></td><td></td><td></td><td class="n">${fmt(Hh.spent)}</td><td></td></tr></tfoot>
    </table></div>` : `<div class="note">Nothing logged for ${esc(S.label)} yet.</div>`}
    ${D.entries.length ? `<div class="row" style="margin-top:10px"><button class="btn sm ghost" id="dExport">Export everything logged as CSV</button></div>` : ''}
  </div>`;

  wireFields(el);
  const addEntry = ()=>{
    const amount = num($('#dAmt').value);
    if(!(amount>0)){ toast('Enter how much it was'); $('#dAmt').focus(); return; }
    const cat = $('#dCat').value, who = $('#dWho').value;
    const date = parseDate($('#dDate').value) ? $('#dDate').value : todayIso;
    D.entries.push({id:uid(), date, what:$('#dWhat').value.trim() || cat, category:cat, who, amount});
    DB.ui.dispCat = cat; DB.ui.dispWho = who; DB.ui.dispMonth = date.slice(0,7);
    save(); render();
    const w = $('#dWhat'); if(w) w.focus();
    toast('Added '+fmt(amount)+' under '+cat);
  };
  $('#dAdd').onclick = addEntry;
  ['#dWhat','#dAmt'].forEach(s=> $(s).addEventListener('keydown', e=>{ if(e.key==='Enter'){ e.preventDefault(); addEntry(); } }));
  $('#dMonth').onchange = e=>{ DB.ui.dispMonth = e.target.value; save(true); render({reset:true}); };
  $$('[data-month]', el).forEach(b=> b.onclick = ()=>{ if(b.dataset.month){ DB.ui.dispMonth = b.dataset.month; save(true); render({reset:true}); } });
  $('#addSub').onclick = ()=>{ D.items.push({id:uid(), name:'New subscription', amount:0, freq:'Monthly', who:'Joint'}); save(); render(); };
  $$('[data-addsub]', el).forEach(b=> b.onclick = ()=>{
    const [n,f] = b.dataset.addsub.split('|');
    if(D.items.some(i=>i.name.toLowerCase()===n.toLowerCase())){ toast('"'+n+'" is already on your list'); return; }
    D.items.push({id:uid(), name:n, amount:0, freq:f, who:'Joint'});
    save(); render(); toast('Added "'+n+'" - now fill in the amount');
  });
  $$('[data-del-item]', el).forEach(b=> b.onclick = ()=>{ const i = D.items.findIndex(x=>x.id===b.dataset.delItem); if(i>=0){ D.items.splice(i,1); save(); render(); } });
  $$('[data-del-entry]', el).forEach(b=> b.onclick = ()=>{ const i = D.entries.findIndex(x=>x.id===b.dataset.delEntry); if(i>=0){ D.entries.splice(i,1); save(); render(); } });
  if($('#dExport')) $('#dExport').onclick = ()=> downloadCSV('disposable-spending-'+yearLabel()+'.csv',
    [['Date','What','Spent on','Paid by','Amount']].concat(D.entries.slice().sort((a,b)=>a.date<b.date?-1:1).map(e=>[e.date, e.what, e.category, e.who, round2(num(e.amount))])));
}
