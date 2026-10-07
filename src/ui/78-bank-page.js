/* ---------------- bank ---------------- */
function renderBank(el){
  const rows = budgetVsActual();
  const {months,weeks} = analysisRange();
  const cats = Array.from(new Set([...Y.bills.map(b=>b.name), ...Y.rules.map(r=>r.category)])).filter(Boolean).sort();
  const uncatDescs = {};
  Y.txns.filter(t=>!t.category).forEach(t=>{ uncatDescs[t.desc]=(uncatDescs[t.desc]||0)+1; });
  const uncatList = Object.entries(uncatDescs).sort((a,b)=>b[1]-a[1]);

  const totalSpend = rows.reduce((s,r)=>s+r.spend,0);
  const totalBudget = rows.reduce((s,r)=>s+r.budgetPeriod,0);

  el.innerHTML = `
  <div class="card">
    <h2>1. Upload your bank statement</h2>
    <div class="row">
      <label class="f" style="flex:1;min-width:220px"><span>CSV file (AIB export or any bank CSV)</span>
        <input type="file" id="csvFile" accept=".csv,text/csv"></label>
      <label class="f"><span>On import</span>
        <select id="importMode"><option value="append">Add to existing</option><option value="replace">Replace all</option></select></label>
    </div>
    <div class="note">Works with most banks: columns called date, description, debit and credit are found automatically. Everything is read in your browser - nothing is uploaded.</div>
  </div>

  <div class="card">
    <h2>2. Choose the dates to look at</h2>
    <div class="row">
      <label class="f"><span>From</span><input type="date" data-path="analysis.from" value="${esc(Y.analysis.from)}"></label>
      <label class="f"><span>To</span><input type="date" data-path="analysis.to" value="${esc(Y.analysis.to)}"></label>
      <div class="spacer"></div>
      <div class="kpi"><div class="lbl">Period</div><div class="val">${months} mo</div><div class="sub">${weeks.toFixed(1)} weeks</div></div>
      <div class="kpi"><div class="lbl">Spend</div><div class="val">${fmt0(totalSpend)}</div><div class="sub">${fmt0(totalSpend/months)} / month</div></div>
      <div class="kpi"><div class="lbl">vs budget</div><div class="val ${totalSpend>totalBudget?'neg':'pos'}">${fmt0(totalSpend-totalBudget)}</div><div class="sub">budget ${fmt0(totalBudget)}</div></div>
    </div>
  </div>

  <div class="card">
    <h2>Where your money went</h2>
    <div class="tw"><table>
      <thead><tr><th>Category</th><th class="n">Spend</th><th class="n">Weekly avg</th><th class="n">Monthly avg</th>
        <th class="n">Monthly budget</th><th class="n">Over / under</th><th>Budget used</th><th class="n">Txns</th></tr></thead>
      <tbody>${rows.map(r=>`<tr>
        <td>${esc(r.category)} ${r.tracked?'':'<span class="pill">unbudgeted</span>'}</td>
        <td class="n">${fmt(r.spend)}</td>
        <td class="n">${fmt(r.weeklyActual)}</td>
        <td class="n">${fmt(r.monthlyActual)}</td>
        <td class="n">${r.monthlyBudget?fmt(r.monthlyBudget):'<span class="mut">-</span>'}</td>
        <td class="n ${r.varMonthly>0?'neg':'pos'}">${r.monthlyBudget?fmt(r.varMonthly):'<span class="mut">-</span>'}</td>
        <td>${r.monthlyBudget?barHtml(r.usePct):''}</td>
        <td class="n mut">${r.count}</td></tr>`).join('')
        || '<tr><td colspan="8" class="empty">Import a statement to see spending by category.</td></tr>'}</tbody>
      <tfoot><tr><td>Total</td><td class="n">${fmt(totalSpend)}</td><td class="n">${fmt(totalSpend/weeks)}</td>
        <td class="n">${fmt(totalSpend/months)}</td><td class="n">${fmt(totalBudget/months)}</td>
        <td class="n ${totalSpend>totalBudget?'neg':'pos'}">${fmt((totalSpend-totalBudget)/months)}</td><td colspan="2"></td></tr></tfoot>
    </table></div>
    <div class="row" style="margin-top:10px"><button class="btn" id="exportAnalysis">Export CSV</button></div>
  </div>

  <div class="card">
    <h2>3. Teach it your spending - category rules <span class="pill">${Y.rules.length}</span></h2>
    <div class="note" style="margin-top:0">A rule says "if the description contains this text, file it under this category" - for example <b>TESCO</b> &rarr; <b>Groceries</b>. The longest match wins, and new imports are sorted automatically.</div>
    <div class="tw" style="max-height:320px;overflow:auto"><table>
      <thead><tr><th>Description contains</th><th>Category</th><th></th></tr></thead>
      <tbody>${Y.rules.map((r,i)=>`<tr>
        <td><input data-path="rules.${i}.match" data-norender value="${esc(r.match)}"></td>
        <td><input list="catList" data-path="rules.${i}.category" data-norender value="${esc(r.category)}"></td>
        <td class="act"><button class="btn sm danger" data-del-rule="${i}">x</button></td></tr>`).join('')
        || '<tr><td colspan="3" class="empty">No rules yet.</td></tr>'}</tbody>
    </table></div>
    <datalist id="catList">${cats.map(c=>`<option value="${esc(c)}">`).join('')}</datalist>
    <div class="row" style="margin-top:10px">
      <button class="btn" id="addRule">+ Add rule</button>
      <button class="btn" id="applyRules">Apply rules to all</button>
      <button class="btn" id="exportRules">Export CSV</button>
    </div>
    ${uncatList.length?`<details style="margin-top:12px"><summary>${uncatList.length} unmatched description${uncatList.length===1?'':'s'}</summary>
      <div class="tw" style="max-height:260px;overflow:auto;margin-top:8px"><table>
        <thead><tr><th>Description</th><th class="n">Count</th><th>Assign category</th></tr></thead>
        <tbody>${uncatList.map(([d,n],i)=>`<tr><td>${esc(d)}</td><td class="n">${n}</td>
          <td><input list="catList" data-quickrule="${esc(d)}" placeholder="category"></td></tr>`).join('')}</tbody>
      </table></div></details>`:''}
  </div>

  <div class="card">
    <h2>Transactions <span class="pill">${Y.txns.length}</span></h2>
    <div class="row" style="margin-bottom:8px">
      <input id="txnFilter" placeholder="Filter description or category" style="max-width:280px">
      <div class="spacer"></div>
      <button class="btn" id="exportTxns">Export CSV</button>
      <button class="btn danger" id="clearTxns">Clear all</button>
    </div>
    <div class="tw" style="max-height:460px;overflow:auto"><table id="txnTable">
      <thead><tr><th>Date</th><th>Description</th><th class="n">Debit</th><th class="n">Credit</th><th class="n">Balance</th><th>Category</th></tr></thead>
      <tbody>${txnRows()}</tbody>
    </table></div>
    ${Y.txns.length>TXN_LIMIT?`<div class="note">Showing the ${TXN_LIMIT} most recent of ${Y.txns.length} transactions.
      Every one of them still counts towards the totals and the CSV export.</div>`:''}
  </div>`;

  wireFields(el);
  $('#csvFile').onchange = e=>{
    const f = e.target.files[0]; if(!f) return;
    const rd = new FileReader();
    rd.onload = ()=>{ importStatement(rd.result, $('#importMode').value); e.target.value=''; };
    rd.onerror = ()=>{ toast('Could not read that file'); e.target.value=''; };
    rd.readAsText(f);
  };
  $('#addRule').onclick = ()=>{ Y.rules.unshift({match:'',category:''}); save(); render(); };
  $$('[data-del-rule]',el).forEach(x=> x.onclick=()=>{ Y.rules.splice(+x.dataset.delRule,1); save(); render(); });
  $('#applyRules').onclick = ()=>{ const n = applyRules(true); save(); render(); toast(n+' transactions categorised'); };
  $$('[data-quickrule]',el).forEach(x=> x.onchange=()=>{
    const cat = x.value.trim(); if(!cat) return;
    Y.rules.push({match:x.dataset.quickrule, category:cat});
    applyRules(false); save(); render();
  });
  /* Swap a single cell for an input on demand rather than rendering 400 of them up
     front - that alone was most of this tab's render cost. */
  $$('[data-txncat]',el).forEach(td=> td.onclick = ()=>{
    if(td.querySelector('input')) return;
    const i = +td.dataset.txncat;
    const inp = document.createElement('input');
    inp.setAttribute('list','catList');
    inp.value = Y.txns[i].category || '';
    inp.style.minWidth = '110px';
    td.innerHTML = '';
    td.appendChild(inp);
    inp.focus(); inp.select();
    let done = false;
    const commit = ()=>{
      if(done) return; done = true;
      const v = inp.value.trim();
      if(v === (Y.txns[i].category||'')){ render(); return; }
      Y.txns[i].category = v; save(); render();
    };
    inp.onblur = commit;
    inp.onkeydown = e=>{
      if(e.key==='Enter'){ e.preventDefault(); commit(); }
      else if(e.key==='Escape'){ done = true; render(); }
    };
  });
  $('#txnFilter').oninput = e=>{
    const q = e.target.value.toLowerCase();
    $$('#txnTable tbody tr').forEach(tr=>{
      tr.style.display = tr.textContent.toLowerCase().includes(q)?'':'none';
    });
  };
  $('#clearTxns').onclick = ()=>{ if(confirm('Remove all '+Y.txns.length+' transactions for '+Y.year+'?')){ Y.txns=[]; save(); render(); } };
  $('#exportTxns').onclick = ()=> downloadCSV('transactions-'+yearLabel()+'.csv', txnCSV());
  $('#exportAnalysis').onclick = ()=> downloadCSV('analysis-'+yearLabel()+'.csv', analysisCSV());
  $('#exportRules').onclick = ()=> downloadCSV('rules-'+yearLabel()+'.csv', rulesCSV());
}
const TXN_LIMIT = 800;
function txnRows(){
  const cats = Array.from(new Set([...Y.bills.map(b=>b.name), ...Y.rules.map(r=>r.category)])).filter(Boolean).sort();
  return Y.txns.slice().map((t,i)=>({t,i}))
    .sort((a,b)=> (a.t.date<b.t.date?1:-1))
    .slice(0,TXN_LIMIT)
    .map(({t,i})=>`<tr>
      <td>${esc(t.date)}</td><td>${esc(t.desc)}</td>
      <td class="n">${t.debit?fmt(num(t.debit)):''}</td>
      <td class="n pos">${t.credit?fmt(num(t.credit)):''}</td>
      <td class="n mut">${t.balance!==''&&t.balance!=null?fmt(num(t.balance)):''}</td>
      <td class="tap" data-txncat="${i}">${t.category? esc(t.category) : '<span class="mut">uncategorised</span>'}</td>
    </tr>`).join('') || '<tr><td colspan="6" class="empty">No transactions.</td></tr>';
}
function parseCSV(text){
  const rows=[]; let row=[], cell='', q=false;
  text = text.replace(/^\uFEFF/,'');
  for(let i=0;i<text.length;i++){
    const ch = text[i];
    if(q){
      if(ch==='"'){ if(text[i+1]==='"'){ cell+='"'; i++; } else q=false; }
      else cell+=ch;
    } else {
      if(ch==='"') q=true;
      else if(ch===','){ row.push(cell); cell=''; }
      else if(ch==='\n'){ row.push(cell); rows.push(row); row=[]; cell=''; }
      else if(ch==='\r'){}
      else cell+=ch;
    }
  }
  if(cell.length||row.length){ row.push(cell); rows.push(row); }
  return rows.filter(r=> r.some(c=>String(c).trim()!==''));
}
function findCol(headers, ...keys){
  for(const k of keys){
    const i = headers.findIndex(h=> h.toLowerCase().replace(/[^a-z0-9]/g,'').includes(k));
    if(i>=0) return i;
  }
  return -1;
}
function importStatement(text, mode){
  const rows = parseCSV(text);
  if(rows.length<2){ toast('Could not read that CSV'); return; }
  const head = rows[0].map(h=>String(h).trim());
  const ci = {
    date: findCol(head,'date'),
    d1: findCol(head,'description1','description','details','narrative','reference'),
    d2: findCol(head,'description2'),
    d3: findCol(head,'description3'),
    debit: findCol(head,'debitamount','debit','withdrawal','moneyout','paidout'),
    credit: findCol(head,'creditamount','credit','deposit','moneyin','paidin'),
    amount: findCol(head,'amount','value'),
    balance: findCol(head,'balance'),
    type: findCol(head,'transactiontype','type')
  };
  if(ci.date<0 || ci.d1<0){ toast('Need at least a date and description column'); return; }
  const out=[];
  for(let r=1;r<rows.length;r++){
    const c = rows[r];
    const d = parseDate(normDate(c[ci.date]));
    if(!d) continue;
    let debit = ci.debit>=0? num(c[ci.debit]) : 0;
    let credit = ci.credit>=0? num(c[ci.credit]) : 0;
    if(ci.debit<0 && ci.credit<0 && ci.amount>=0){
      const a = num(c[ci.amount]);
      if(a<0) debit = Math.abs(a); else credit = a;
    }
    out.push({
      date: iso(d),
      desc: (c[ci.d1]||'').trim(),
      desc2: [ci.d2>=0?c[ci.d2]:'', ci.d3>=0?c[ci.d3]:''].filter(Boolean).join(' ').trim(),
      debit: debit||0, credit: credit||0,
      balance: ci.balance>=0? num(c[ci.balance]) : '',
      type: ci.type>=0? (c[ci.type]||'').trim() : '',
      category: ''
    });
  }
  if(!out.length){ toast('No rows recognised'); return; }
  if(mode==='replace') Y.txns = out;
  else {
    const seen = new Set(Y.txns.map(keyOf));
    let added=0;
    out.forEach(t=>{ if(!seen.has(keyOf(t))){ Y.txns.push(t); seen.add(keyOf(t)); added++; } });
    toast(added+' new transactions added ('+(out.length-added)+' duplicates skipped)');
  }
  const n = applyRules(false);
  save(); render();
  if(mode==='replace') toast(out.length+' transactions imported, '+n+' categorised');
}
const keyOf = t => [t.date,t.desc,t.debit,t.credit,t.balance].join('|');
function normDate(s){
  s = String(s||'').trim();
  const m = s.match(/^(\d{1,2})[\/\-.](\d{1,2})[\/\-.](\d{2,4})$/);
  if(m){ let y=+m[3]; if(y<100) y+=2000; return `${y}-${String(+m[2]).padStart(2,'0')}-${String(+m[1]).padStart(2,'0')}`; }
  return s;
}

/* per-person savings breakdown - inputs live on the Budget tab, this is the read-out */
function savingsBreakdownCard(){
  const bands = Y.taxBands;
  const nets = Y.people.map(p=> calcTax(p,bands).netMonthly);
  const totalNet = nets.reduce((a,b)=>a+b,0);
  const st = billTotals('savings');
  const sp = savingsSplit();
  const accountsMonthly = (Y.savings.accounts||[]).reduce((s,a)=>s+num(a.monthly),0);

  const rows = sp.rows.map((r,i)=>`<tr>
      <td>${esc(r.name)}</td>
      <td class="n">${fmt(r.own)}</td>
      <td class="n">${fmt(r.joint)}</td>
      <td class="n"><b>${fmt(r.total)}</b></td>
      <td class="n">${fmt(r.total*12)}</td>
      <td class="n">${nets[i]? pct(r.total/nets[i]*100) : '<span class="mut">-</span>'}</td>
    </tr>`).join('');

  return `<div class="card">
    <h2>Savings &amp; investments per person</h2>
    <div class="grid g4" style="margin-bottom:12px">
      <div class="kpi"><div class="lbl">Put aside / month</div><div class="val pos">${fmt0(st.monthly)}</div>
        <div class="sub">${fmt0(st.annual)} a year</div></div>
      <div class="kpi"><div class="lbl">Joint</div><div class="val">${fmt0(sp.jointMonthly)}</div>
        <div class="sub">${fmt0(sp.jointEach)} each, split evenly</div></div>
      <div class="kpi"><div class="lbl">Individual</div><div class="val">${fmt0(st.monthly - sp.jointMonthly)}</div>
        <div class="sub">held in one name</div></div>
      <div class="kpi"><div class="lbl">Savings rate</div>
        <div class="val ${totalNet && st.monthly/totalNet>=0.2?'pos':''}">${totalNet?pct(st.monthly/totalNet*100):'-'}</div>
        <div class="sub">of combined net pay</div></div>
    </div>
    <div class="tw"><table>
      <thead><tr><th>Person</th><th class="n">Own</th><th class="n">Share of joint</th>
        <th class="n">Total / month</th><th class="n">Annual</th><th class="n">% of their net pay</th></tr></thead>
      <tbody>${rows||'<tr><td colspan="6" class="empty">Add people on the Take-home pay page, and savings on the Bills &amp; budget page.</td></tr>'}</tbody>
      <tfoot><tr><td>Total</td>
        <td class="n">${fmt(st.monthly - sp.jointMonthly - sp.unassigned)}</td>
        <td class="n">${fmt(sp.jointMonthly)}</td>
        <td class="n">${fmt(st.monthly - sp.unassigned)}</td>
        <td class="n">${fmt((st.monthly - sp.unassigned)*12)}</td>
        <td class="n">${totalNet?pct((st.monthly-sp.unassigned)/totalNet*100):''}</td></tr></tfoot>
    </table></div>
    <div class="note">Savings amounts are set on the Bills &amp; budget page. Joint amounts are shared evenly between people, regardless of income.</div>
    ${sp.unassigned>0?`<div class="note">${fmt(sp.unassigned)} a month is assigned to a holder who is not set up as a person, so it is not counted in the split.</div>`:''}
    ${Math.abs(accountsMonthly-st.monthly)>1?`<div class="note">The accounts below add up to ${fmt(accountsMonthly)} a month, which does not match the ${fmt(st.monthly)} committed on the Bills &amp; budget page.</div>`:''}
  </div>`;
}

