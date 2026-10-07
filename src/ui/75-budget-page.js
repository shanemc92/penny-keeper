/* ---------------- bills & budget ---------------- */
const SPLIT_HELP = {
  income:'Fair by income: whoever earns more pays a bigger share.',
  manual:'You choose the percentages yourselves.',
  disposable:'Everyone is left with the same spending money each week, after their own bills, savings and their share of the joint bills.'
};
function renderBudget(el){
  const bands = Y.taxBands;
  const H = household();
  const people = H.people, bt = H.bt, st = H.st;
  const joint = bt.joint/12;
  const sp = savingsSplit();
  const js = jointShares();
  const manual = Y.splitMode==='manual';
  const rawPctSum = manual ? js.rawSum*100 : 100;
  const toLodgeTotal = joint + (Y.lodgeIncludesSavings ? sp.jointMonthly : 0);
  const showEffective = manual && Math.abs(rawPctSum-100)>0.05;
  const actualByName = {};
  budgetVsActual().forEach(r=> actualByName[r.category]=r);
  const holders = Array.from(new Set(['Joint', ...Y.people.map(p=>p.name), ...Y.bills.map(b=>b.holder).filter(Boolean)]));
  const left = H.left;
  const showSplit = people.length>1;

  el.innerHTML = `
  <div class="grid g4" style="margin-bottom:16px">
    <div class="kpi"><div class="lbl" data-nott>Take-home pay / month</div><div class="val">${fmt0(H.net)}</div>
      <div class="sub">${H.net>0?people.map(x=>esc(x.p.name)).join(' + '):'<a href="#" data-go="tax">Add your salary</a>'}</div></div>
    <div class="kpi"><div class="lbl" data-nott>Bills / month</div><div class="val">${fmt0(bt.monthly)}</div><div class="sub">${fmt0(bt.annual)} a year</div></div>
    <div class="kpi"><div class="lbl" data-nott>Savings / month</div><div class="val">${fmt0(st.monthly)}</div><div class="sub">${H.net>0?pct(st.monthly/H.net*100)+' of take-home':fmt0(st.annual)+' a year'}</div></div>
    <div class="kpi"><div class="lbl" data-nott>Left over / month</div><div class="val ${left>=0?'pos':'neg'}">${fmt0(left)}</div><div class="sub">${H.net<=0?'needs your salary':left>=0?fmt0(left*12/52)+' a week to spend':'over-committed'}</div></div>
  </div>
  ${left<0 && H.net>0 ? callout('bad','⚠️','You are committing more than you take home','Your bills and savings add up to '+fmt0(-left)+' a month more than your take-home pay. Look for a bill to cut, or lower a savings amount.') : ''}

  ${billTable('bill','Bills','Everything you spend money on regularly', billsOfKind('bill'), holders, actualByName, bt)}
  ${billTable('savings','Savings &amp; investments','Money you put aside instead of spending', billsOfKind('savings'), holders, actualByName, st)}

  ${showSplit ? `<div class="card">
    ${cardHead('Sharing joint bills','Who pays what from the shared (Joint) bills')}
    <div class="row" style="margin-bottom:6px">
      <label class="f" style="width:290px"><span>Split joint bills by</span>
        <select id="splitMode">${Object.entries(SPLIT_MODES).map(([k,v])=>
          `<option value="${k}" ${Y.splitMode===k?'selected':''}>${v}</option>`).join('')}</select>
        <div class="hint">${SPLIT_HELP[Y.splitMode]||''}</div></label>
      ${manual?`<button class="btn" id="normSplit" style="margin-bottom:22px">Balance to 100%</button>`:''}
      <div class="spacer"></div>
      <label style="width:auto;margin-bottom:12px;display:flex;align-items:center;gap:6px">
        <input type="checkbox" id="lodgeSavings" ${Y.lodgeIncludesSavings?'checked':''}> Include joint savings in the transfer</label>
      <div class="kpi" style="min-width:180px;margin-bottom:6px"><div class="lbl">To lodge / month</div>
        <div class="val">${fmt0(toLodgeTotal)}</div>
        <div class="sub">${Y.lodgeIncludesSavings? fmt0(joint)+' bills + '+fmt0(sp.jointMonthly)+' savings' : fmt0(joint)+' bills only'}</div></div>
    </div>
    <div class="tw"><table>
      <thead><tr><th>Person</th><th class="n">Take-home / month</th><th class="n">Share</th>${showEffective?'<th class="n">Effective</th>':''}
        <th class="n">To lodge / month</th><th class="n">Own bills</th><th class="n">Savings</th>
        <th class="n">Left over</th><th class="n">Weekly</th></tr></thead>
      <tbody>${people.map((x,i)=>{
        const share = js.shares[i];
        const billsShare = joint*share;
        const savShare = Y.lodgeIncludesSavings ? (sp.jointEach||0) : 0;
        const toLodge = billsShare + savShare;
        const own = (bt.byHolder[x.p.name]||0)/12;
        const sav = sp.rows[i] ? sp.rows[i].total : 0;
        const leftP = x.t.netMonthly - billsShare - own - sav;
        return `<tr>
          <td><b>${esc(x.p.name)}</b></td>
          <td class="n">${fmt(x.t.netMonthly)}</td>
          <td class="n">${manual
            ? `<input class="num" style="width:76px;text-align:right" data-share="${esc(x.p.id)}" value="${(js.raw[i]*100).toFixed(1)}">`
            : pct(share*100)}</td>
          ${showEffective?`<td class="n mut">${pct(share*100)}</td>`:''}
          <td class="n"><b>${fmt(toLodge)}</b>${Y.lodgeIncludesSavings?` <span class="mut">(${fmt(billsShare)}+${fmt(savShare)})</span>`:''}</td>
          <td class="n">${fmt(own)}</td>
          <td class="n">${fmt(sav)}</td>
          <td class="n ${leftP>=0?'pos':'neg'}"><b>${fmt(leftP)}</b></td>
          <td class="n mut">${fmt(leftP*12/52)}</td></tr>`;
      }).join('')}</tbody>
      <tfoot><tr><td>Total</td><td class="n">${fmt(H.net)}</td><td colspan="${showEffective?2:1}"></td>
        <td class="n">${fmt(toLodgeTotal)}</td>
        <td class="n">${fmt(bt.annual/12)}</td>
        <td class="n">${fmt(sp.rows.reduce((s,r)=>s+r.total,0))}</td>
        <td colspan="2"></td></tr></tfoot>
    </table></div>
    ${showEffective ? `<div class="note">Your percentages add up to ${pct(rawPctSum)}, so they are scaled to fit - "Effective" is what is actually charged. "Balance to 100%" rewrites them.</div>` : ''}
    ${Y.splitMode==='disposable'
      ? `<div class="note">Shares are solved so everyone is left with the same amount each week.${js.capped
         ? ' One person could not cover their solved share, so it was capped and the rest rebalanced - leftovers will not come out exactly level.' : ''}</div>`
      : `<div class="note">Joint savings are always shared evenly, whatever the income split.</div>`}
    <div class="note">"To lodge" is what each person should transfer into the joint account each month.</div>
  </div>` : ''}

  ${yearAheadCard()}

  <div class="card">
    ${cardHead('By holder','Each person\'s own bills and savings')}
    <div class="grid g4">
      ${holders.map(h=>{
        const b = (bt.byHolder[h]||0)/12, sv = (st.byHolder[h]||0)/12;
        if(!b && !sv) return '';
        return `<div class="kpi"><div class="lbl" data-nott>${esc(h)}</div>
          <div class="val">${fmt0(b+sv)}</div>
          <div class="sub">${fmt0(b)} bills + ${fmt0(sv)} savings</div></div>`;
      }).join('') || '<div class="note">No bills yet.</div>'}
    </div>
  </div>`;

  wireFields(el);
  wireBillChips(el);
  $$('[data-sort]', el).forEach(th=> th.onclick = ()=>{
    const [kind,col] = th.dataset.sort.split('.');
    const st = billSort[kind];
    if(st.col===col) st.dir = -st.dir; else { st.col = col; st.dir = 1; }
    render();
  });
  if($('#lodgeSavings')) $('#lodgeSavings').onchange = e=>{ Y.lodgeIncludesSavings = e.target.checked; save(); render(); };
  if($('#splitMode')) $('#splitMode').onchange = e=>{
    const was = jointShares();
    Y.splitMode = e.target.value;
    if(Y.splitMode==='manual' && !Object.keys(Y.splitManual).length)
      Y.people.forEach((p,i)=> Y.splitManual[p.id] = was.shares[i]);
    save(); render();
  };
  $$('[data-share]', el).forEach(inp=> inp.onchange = ()=>{
    Y.splitManual[inp.dataset.share] = clamp(num(inp.value),0,1000)/100;
    save(); render();
  });
  if($('#normSplit')) $('#normSplit').onclick = ()=>{
    const js2 = jointShares();
    Y.people.forEach((p,i)=> Y.splitManual[p.id] = js2.shares[i]);
    save(); render(); toast('Percentages balanced to 100%');
  };
  $$('[data-add]', el).forEach(btn=> btn.onclick = ()=>{
    const kind = btn.dataset.add;
    Y.bills.push({id:uid(), name: kind==='savings'?'New savings':'New bill', freq:'Monthly',
      holder:'Joint', amount:0, nextDue:'', kind});
    save(); render();
  });
  $$('[data-del-bill]', el).forEach(b=> b.onclick = ()=>{
    const i = Y.bills.findIndex(x=>x.id===b.dataset.delBill);
    if(i>=0){ Y.bills.splice(i,1); save(); render(); }
  });
  $$('[data-move]', el).forEach(b=> b.onclick = ()=>{
    const bill = Y.bills.find(x=>x.id===b.dataset.move);
    if(bill){ bill.kind = kindOf(bill)==='savings'?'bill':'savings'; save(); render(); }
  });
  $$('[data-export]', el).forEach(b=> b.onclick = ()=>{
    const k = b.dataset.export;
    downloadCSV((k==='savings'?'savings-commitments-':'bills-')+yearLabel()+'.csv', billsCSV(k));
  });
}
/* chips that drop a ready-made line into the list */
function wireBillChips(el){
  $$('[data-addbill]', el).forEach(b=> b.onclick = ()=>{
    const [n,f,k] = b.dataset.addbill.split('|');
    if(!addBillFromTemplate(n,f,k)){ toast('"'+n+'" is already on your list'); return; }
    save(); render(); toast('Added "'+n+'" - now fill in the amount');
  });
}

function yearAheadCard(){
  if(!billsOfKind('bill').some(b=>num(b.amount)>0)) return '';
  const Ya = yearAhead();
  const max = Math.max(...Ya.months.map(m=>m.total), 1);
  const avg = Ya.months.reduce((s,m)=>s+m.total,0)/12;
  return `<details class="more" ${Ya.datedCount?'open':''}><summary>📅 Your year ahead - which months cost the most</summary>
    ${Ya.datedCount ? '' : '<div class="note">Add <b>next payment</b> dates to your bills (especially the yearly ones) and the big months show up here. For now every bill is spread evenly.</div>'}
    <div style="margin-top:10px">${Ya.months.map(m=>{
      const heavy = Ya.datedCount && m.total > avg*1.25;
      return `<div class="row" style="align-items:center;gap:10px;margin:5px 0;flex-wrap:nowrap" ${m.items.length?`title="${esc(m.items.map(i=>i.name+(i.count>1?' x'+i.count:'')+' '+fmt0(i.amount)).join(', '))}"`:''}>
        <div style="width:84px;font-weight:600;font-size:13px;flex:none">${esc(m.label)}</div>
        <div class="meter" style="flex:1;height:16px"><i style="width:${m.total/max*100}%;${heavy?'background:var(--warn)':''}"></i></div>
        <div class="num" style="width:78px;text-align:right;flex:none">${fmt0(m.total)}</div>
        <div class="mut" style="width:34%;font-size:12.5px;white-space:nowrap;overflow:hidden;text-overflow:ellipsis">${m.items.slice().sort((x,y)=>y.amount-x.amount).slice(0,3).map(i=>esc(i.name)+(i.count>1?' x'+i.count:'')).join(', ')}${m.items.length>3?' +'+(m.items.length-3):''}</div></div>`;
    }).join('')}</div>
    <div class="note">Average ${fmt0(avg)} a month. Amber months are well above average - a good reason to put a little aside every month towards the yearly bills. Hover a month to see what is due.</div>
  </details>`;
}

/* View-only sort for the Budget tables. The underlying array keeps whatever manual
   order it has - this sorts a copy for display, so data-path indexes still point at
   the real records. */
const billSort = {bill:{col:null, dir:1}, savings:{col:null, dir:1}};
const BILL_COLS = {
  name:   b => String(b.name||'').toLowerCase(),
  freq:   b => FREQ[b.freq]||0,
  holder: b => String(b.holder||'').toLowerCase(),
  amount: b => num(b.amount),
  annual: b => annualOf(b),
  monthly:b => annualOf(b)/12,
  weekly: b => annualOf(b)/52,
  due:    b => b.nextDue || '9999'
};
function sortBills(kind, list){
  const st = billSort[kind];
  if(!st.col || !BILL_COLS[st.col]) return list;
  const key = BILL_COLS[st.col];
  return list.slice().sort((a,b)=>{
    const x = key(a), y = key(b);
    return (x<y ? -1 : x>y ? 1 : 0) * st.dir;
  });
}
function sortableTh(kind, col, label, cls){
  const st = billSort[kind];
  const on = st.col===col;
  const arrow = on ? (st.dir===1 ? ' ↑' : ' ↓') : '';
  return `<th class="${cls||''}" data-sort="${kind}.${col}" style="cursor:pointer;user-select:none"
    title="Click to sort by ${esc(label)}">${label}${arrow}</th>`;
}
function billTable(kind, title, sub, rows, holders, actualByName, totals){
  const isSav = kind==='savings';
  rows = sortBills(kind, rows);
  const templates = isSav ? COMMON_SAVINGS : COMMON_BILLS;
  const have = new Set(billsOfKind(kind).map(b=>b.name.toLowerCase()));
  const body = rows.map(b=>{
    const i = Y.bills.indexOf(b);
    const a = annualOf(b), act = actualByName[b.name];
    const due = nextDueFrom(b);
    const usage = act && act.monthlyBudget>0 ? act.monthlyActual/act.monthlyBudget*100 : null;
    /* the date typed in may be in the past (a monthly bill first dated last March); say when it is next due */
    const rolled = due && b.nextDue && iso(due)!==b.nextDue ? `<span class="hint" style="display:block;margin:2px 0 0">next: ${iso(due)}</span>` : '';
    return `<tr>
      <td class="first" data-label="Name"><input data-path="bills.${i}.name" value="${esc(b.name)}" aria-label="Name" style="min-width:150px"></td>
      <td class="n" data-label="Amount"><input class="num" style="text-align:right;width:104px" data-path="bills.${i}.amount" data-type="number" inputmode="decimal" value="${num(b.amount)||''}" placeholder="0.00" aria-label="Amount"></td>
      <td data-label="How often"><select data-path="bills.${i}.freq" aria-label="How often" style="min-width:118px">${Object.keys(FREQ).map(f=>`<option ${f===b.freq?'selected':''}>${f}</option>`).join('')}</select></td>
      <td data-label="Who pays"><select data-path="bills.${i}.holder" aria-label="Who pays" style="min-width:104px">${holders.map(h=>`<option ${h===b.holder?'selected':''}>${esc(h)}</option>`).join('')}</select></td>
      <td data-label="Next payment"><input type="date" data-path="bills.${i}.nextDue" value="${esc(b.nextDue||'')}" style="min-width:140px" aria-label="Next payment">${rolled}</td>
      <td class="n" data-label="Per month"><b>${fmt(a/12)}</b></td>
      <td class="n" data-label="Annual">${fmt(a)}</td>
      <td class="n" data-label="Weekly">${fmt(a/52)}</td>
      <td class="n" data-label="Actual /mo">${act?fmt(act.monthlyActual):'<span class="mut">-</span>'}</td>
      <td data-label="Budget used">${usage===null?'<span class="mut">-</span>':barHtml(usage)}</td>
      <td class="act">
        <button class="btn sm" data-move="${esc(b.id)}" title="Move to ${isSav?'Bills':'Savings & investments'}">${isSav?'&rarr; Bills':'&rarr; Savings'}</button>
        <button class="btn sm danger" data-del-bill="${esc(b.id)}" aria-label="Delete">x</button></td>
    </tr>`;
  }).join('');
  const chips = `<div class="chips" style="margin-top:8px">${templates.map(([n,f])=>
    `<button class="chip ${have.has(n.toLowerCase())?'on':''}" data-addbill="${esc(n)}|${f}|${kind}" ${have.has(n.toLowerCase())?'disabled style="opacity:.6"':''}>${have.has(n.toLowerCase())?'✓ ':'+ '}${esc(n)}</button>`).join('')}</div>`;
  return `<div class="card">
    ${cardHead(title+` <span class="pill">${rows.length}</span>`, sub,
      `<button class="btn primary" data-add="${kind}">+ Add ${isSav?'savings':'a bill'}</button>`)}
    ${rows.length ? `<div class="tw"><table class="stack-m">
      <thead><tr>${sortableTh(kind,'name',isSav?'Savings for':'Bill')}${sortableTh(kind,'amount','Amount','n')}${sortableTh(kind,'freq','How often')}${sortableTh(kind,'holder','Who pays')}
        ${sortableTh(kind,'due','Next payment')}${sortableTh(kind,'monthly','Per month','n')}
        ${sortableTh(kind,'annual','Annual','n')}${sortableTh(kind,'weekly','Weekly','n')}
        <th class="n">Actual /mo</th><th>Budget used</th><th></th></tr></thead>
      <tbody>${body}</tbody>
      <tfoot><tr><td>Total</td><td></td><td></td><td></td><td></td>
        <td class="n">${fmt(totals.monthly)}</td>
        <td class="n">${fmt(totals.annual)}</td><td class="n">${fmt(totals.weekly)}</td>
        <td colspan="3"></td></tr></tfoot>
    </table></div>`
    : emptyState(isSav?'🐖':'🧾', isSav?'Nothing put aside yet':'No bills yet',
        isSav?'Tap one of the ideas below, or add your own.':'Tap the common Irish bills below to add them, then fill in the amounts - or add your own.')}
    <details class="more" ${rows.length?'':'open'}><summary>⚡ Quick add common ${isSav?'savings':'Irish bills'}</summary>${chips}</details>
    ${rows.length?`<div class="row" style="margin-top:10px"><button class="btn sm ghost" data-export="${kind}">Export CSV</button></div>`:''}
  </div>`;
}

function barHtml(usePct){
  const p = clamp(usePct,0,160);
  const w = p/160*100;
  const over = Math.round(usePct) > 100;   // 100.00000000000001 is on budget, not over it
  return `<div class="bar" title="${usePct.toFixed(0)}% of budget">
    <i class="${over?'over':'under'}" style="width:${w}%"></i>
    <b style="left:${100/160*100}%"></b>
    <em>${usePct>999?'-':Math.round(usePct)+'%'}</em></div>`;
}

