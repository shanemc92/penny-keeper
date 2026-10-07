/* ---------------- export helpers ---------------- */
const slug = s => String(s||'sheet').toLowerCase().replace(/[^a-z0-9]+/g,'-').replace(/^-|-$/g,'')||'sheet';
/* A cell starting = + - @ (or a leading tab/CR) is executed as a formula by Excel,
   Sheets and LibreOffice. A bill named =HYPERLINK(...) would fire on open, so any
   text cell that starts with one is prefixed with an apostrophe on the way out. */
function csvSafe(v){
  const s = (v===null||v===undefined)?'':String(v);
  if(typeof v === 'number') return s;
  return /^[=+\-@\t\r]/.test(s) && !/^-?\d*\.?\d+$/.test(s) ? "'"+s : s;
}
function toCSV(rows){
  return rows.map(r=> r.map(c=>{
    const s = csvSafe(c);
    return /[",\n]/.test(s) ? '"'+s.replace(/"/g,'""')+'"' : s;
  }).join(',')).join('\r\n');
}
function downloadBlob(name, blob){
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href=url; a.download=name; document.body.appendChild(a); a.click();
  setTimeout(()=>{ URL.revokeObjectURL(url); a.remove(); },500);
}
function downloadCSV(name, rows){ downloadBlob(name, new Blob(['\uFEFF'+toCSV(rows)],{type:'text/csv;charset=utf-8'})); }
function downloadText(name, text, type){ downloadBlob(name, new Blob([text],{type:type||'application/json'})); }

/* sheet builders - shared by CSV and XLSX export */
function billsCSV(kind){
  const list = billsOfKind(kind);
  const rows=[['Item','Type','Frequency','Holder','Amount','Annual','Monthly','Weekly','Next due']];
  list.forEach(b=>{ const a=annualOf(b);
    rows.push([b.name, kindOf(b)==='savings'?'Savings':'Bill', b.freq, b.holder, num(b.amount),
      round2(a), round2(a/12), round2(a/52), b.nextDue||'']); });
  const t=billTotals(kind);
  rows.push(['Total','','','',round2(list.reduce((s,b)=>s+num(b.amount),0)),
    round2(t.annual),round2(t.monthly),round2(t.weekly),'']);
  return rows;
}
function savingsSplitCSV(){
  const sp = savingsSplit(), bands = Y.taxBands;
  const rows=[['Person','Own /month','Share of joint /month','Total /month','Annual','% of net pay']];
  sp.rows.forEach((r,i)=>{
    const net = Y.people[i] ? calcTax(Y.people[i],bands).netMonthly : 0;
    rows.push([r.name, round2(r.own), round2(r.joint), round2(r.total), round2(r.total*12),
      net?round2(r.total/net*100):'']);
  });
  rows.push(['Joint pot','', round2(sp.jointMonthly), round2(sp.jointEach)+' each','','']);
  return rows;
}
function taxCSV(){
  const b=Y.taxBands;
  const rows=[['Person','Gross','BIK','Pension','AVC','Taxable','Tax 20%','Tax 40%','Credits','PAYE','PRSI','USC','Deductions','Net annual','Net monthly','Effective %']];
  Y.people.forEach(p=>{ const t=calcTax(p,b);
    rows.push([p.name,round2(t.gross),round2(t.bik),round2(t.pension),round2(t.avc),round2(t.taxable),
      round2(t.tax20),round2(t.tax40),round2(t.credits),round2(t.paye),round2(t.prsi),round2(t.usc),
      round2(t.deductions),round2(t.net),round2(t.netMonthly),round2(t.effective)]); });
  return rows;
}
function analysisCSV(){
  const rows=[['Category','Spend','Weekly average','Monthly average','Monthly budget','Over/under monthly','Annual budget','Over/under period','Budget used %','Transactions']];
  budgetVsActual().forEach(r=> rows.push([r.category,round2(r.spend),round2(r.weeklyActual),round2(r.monthlyActual),
    round2(r.monthlyBudget),round2(r.varMonthly),round2(r.budgetAnnual),round2(r.varPeriod),round2(r.usePct),r.count]));
  return rows;
}
function txnCSV(){
  const rows=[['Date','Description','Detail','Debit','Credit','Balance','Type','Category']];
  Y.txns.forEach(t=> rows.push([t.date,t.desc,t.desc2||'',num(t.debit),num(t.credit),t.balance===''?'':num(t.balance),t.type||'',t.category||'']));
  return rows;
}
function rulesCSV(){
  const rows=[['Description contains','Category']];
  Y.rules.forEach(r=> rows.push([r.match,r.category]));
  return rows;
}
function savingsCSV(){
  const proj = projectSavings();
  const rows=[['Month', ...Y.savings.accounts.map(a=>a.name), 'Total']];
  proj.forEach(r=> rows.push([r.date, ...r.values.map(v=>round2(v)), round2(r.total)]));
  const dips = [];
  Y.savings.accounts.forEach(a=> Object.entries(a.adjust||{}).forEach(([mk,v])=> dips.push([mk, a.name, num(v)])));
  if(dips.length){
    rows.push([]); rows.push(['Money taken out']); rows.push(['Month','Account','Amount']);
    dips.sort((x,y)=> x[0]<y[0]?-1:1).forEach(d=> rows.push(d));
  }
  return rows;
}
function historyCSV(){
  const rows=[['Month','Category','Amount']];
  Y.history.slice().sort((a,b)=> a.month<b.month?-1:1).forEach(r=> rows.push([r.month,r.category,num(r.amount)]));
  return rows;
}
function accountsCSV(){
  const rows=[['Account','Owner','Bank','Type','IBAN','BIC','Notes','IBAN valid']];
  Y.accounts.forEach(a=> rows.push([a.name,a.owner,a.bank,a.type,ibanPretty(a.iban),a.bic||'',a.notes||'',
    a.iban?(ibanValid(a.iban)?'yes':'no'):'']));
  return rows;
}
function renewalsCSV(){
  const rows=[['Contract','Provider','Ends','Days left','Cost /mo','Notes']];
  (Y.renewals && Y.renewals.items || []).forEach(c=>{
    const d = daysUntil(c.end);
    rows.push([c.name, c.provider||'', c.end||'', d===null?'':d, num(c.cost), c.notes||'']);
  });
  return rows;
}
function payeesCSV(){
  const rows=[['Payee','Owner','Bank','Type','IBAN','BIC','Notes','IBAN valid']];
  Y.payees.forEach(a=> rows.push([a.name,a.owner,a.bank,a.type,ibanPretty(a.iban),a.bic||'',a.notes||'',
    a.iban?(ibanValid(a.iban)?'yes':'no'):'']));
  return rows;
}
function profileCSV(){
  const s = Y.energy.summary;
  const rows=[['Time','Average kWh','Band']];
  if(!s || !s.profile) return rows;
  const mins = s.intervalMins||30;
  s.profile.forEach((v,i)=>{
    const t = new Date(2026,0,1, Math.floor(i*mins/60), (i*mins)%60);
    rows.push([String(t.getHours()).padStart(2,'0')+':'+String(t.getMinutes()).padStart(2,'0'),
      v, bandFor(t, Y.energy.bands)]);
  });
  return rows;
}
function usageCSV(){
  const s = Y.energy.summary;
  const rows=[['Month','Day kWh','Night kWh','Peak kWh','Total kWh']];
  if(!s) return rows;
  s.byMonth.forEach(m=> rows.push([m.month,m.day,m.night,m.peak,m.total]));
  rows.push(['Total',s.day,s.night,s.peak,s.total]);
  rows.push([]);
  rows.push(['Period',s.from+' to '+s.to,'MPRN',(Y.energy.mprn||s.mprn||''),'Readings',s.intervals]);
  return rows;
}
function offersCSV(){
  const s = Y.energy.summary;
  const rows=[['Plan','Day c/kWh','Night c/kWh','Peak c/kWh','Standing /yr','Discount %','Inc VAT',
               'Day cost','Night cost','Peak cost','Per year','Per month','Effective c/kWh','Current']];
  (Y.energy.offers||[]).forEach(o=>{
    const c = offerCost(o, s, Y.energy.vat);
    rows.push([o.name,num(o.day),num(o.night),num(o.peak),num(o.standing),num(o.discount),o.incVat?'yes':'no',
      c?round2(c.dayCost):'', c?round2(c.nightCost):'', c?round2(c.peakCost):'',
      c?round2(c.annual):'', c?round2(c.monthly):'', c?round2(c.effective):'', o.current?'yes':'']);
  });
  return rows;
}
function loanCSV(l){
  const o=amortise(l,false), p=amortise(l,true);
  const rows=[['Payment','Date','Opening','Interest','Principal','Repayment','Balance','Extra']];
  p.rows.forEach(r=> rows.push([r.n,r.date,r.opening,r.interest,r.principal,r.payment,r.balance,r.extra||0]));
  rows.push([]);
  rows.push(['Current schedule','Interest',o.interest,'Payments',o.payments,'Ends',o.end]);
  rows.push(['Proposed schedule','Interest',p.interest,'Payments',p.payments,'Ends',p.end]);
  rows.push(['Saving','Interest',round2(o.interest-p.interest),'Payments sooner',o.payments-p.payments]);
  return rows;
}
function loansSummaryCSV(){
  const rows=[['Loan','Opening','Rate %','Frequency','Repayment','Proposed','Interest now','Interest proposed','Interest saved','Payments now','Payments proposed','Ends']];
  Y.loans.forEach(l=>{ const o=amortise(l,false), p=amortise(l,true);
    rows.push([l.name,num(l.opening),num(l.rate),l.freq,num(l.repayment),num(l.proposedRepayment),
      o.interest,p.interest,round2(o.interest-p.interest),o.payments,p.payments,p.end]); });
  return rows;
}
function mortgageCSV(m){
  const s = mortgageSchedule(m), base = mortgageSchedule(m,{noExtra:true});
  const rows=[['#','Date','Row','Rate %','Opening','Interest','Principal','Payment','Insurance','Extra',
    'Balance','Lender balance','Adjustment','Note']];
  s.rows.forEach(r=> rows.push([r.n, r.date, r.statement?'statement':'payment', r.rate, r.opening, r.interest,
    r.statement?'':r.principal, r.statement?'':r.payment, r.statement?'':num(r.insurance), r.extra||0, r.balance,
    blankish(r.statedBalance)?'':r.statedBalance, r.statement?r.adjust:'', r.note||'']));
  rows.push([]);
  rows.push(['Borrowed',num(m.principal),'Drawdown',m.startDate||'','Term (months)',num(m.termMonths)]);
  rows.push(['Insurance',num(m.insuranceMonthly),'Interest charged',MORT_BASES[basisOf(m)],
    'Adjusted by statements',s.adjusted]);
  rows.push(['Rate schedule']);
  rows.push(['From','Rate %','Type']);
  mortRates(m).forEach(r=> rows.push([r.from, num(r.rate), RATE_KINDS[r.kind]||r.kind||'']));
  rows.push([]);
  rows.push(['With overpayments','Interest',s.interest,'Payments',s.payments,'Ends',s.end]);
  rows.push(['Without overpayments','Interest',base.interest,'Payments',base.payments,'Ends',base.end]);
  rows.push(['Saving','Interest',round2(base.interest-s.interest),'Payments sooner',base.payments-s.payments]);
  return rows;
}
function mortgagesSummaryCSV(){
  const rows=[['Mortgage','Lender','Borrowed','Drawdown','Term (months)','Rate now %','Type','Balance today',
    'Repayment','Interest to come','Total interest','Paid off by','LTV %']];
  (Y.mortgages||[]).forEach(m=>{
    const s = mortgageSchedule(m), p = mortgagePosition(m,s);
    rows.push([m.name, m.lender||'', num(m.principal), m.startDate||'', num(m.termMonths), p.rate,
      RATE_KINDS[p.kind]||p.kind||'', p.balance, p.nextPayment, p.remainingInterest, s.interest, s.end,
      num(m.propertyValue)>0? round2(p.ltv):'']);
  });
  return rows;
}
function allSheets(){
  const s = [
    {name:'Bills', rows:billsCSV('bill')},
    {name:'Savings Commitments', rows:billsCSV('savings')},
    {name:'Savings Split', rows:savingsSplitCSV()},
    {name:'Tax', rows:taxCSV()},
    {name:'Bank Analysis', rows:analysisCSV()},
    {name:'Transactions', rows:txnCSV()},
    {name:'Rules', rows:rulesCSV()},
    {name:'Savings', rows:savingsCSV()},
    {name:'History', rows:historyCSV()},
    {name:'Accounts', rows:accountsCSV()},
    {name:'Payees', rows:payeesCSV()},
    {name:'Contracts', rows:renewalsCSV()}
  ];
  if(Y.energy && Y.energy.summary) s.push({name:'Electricity Usage', rows:usageCSV()});
  if(Y.energy && (Y.energy.offers||[]).length) s.push({name:'Electricity Offers', rows:offersCSV()});
  if(Y.energy && Y.energy.summary && Y.energy.summary.profile) s.push({name:'Electricity Profile', rows:profileCSV()});
  if(Y.loans.length) s.push({name:'Loans', rows:loansSummaryCSV()});
  Y.loans.forEach(l=> s.push({name:('Loan '+l.name).slice(0,28), rows:loanCSV(l)}));
  if((Y.mortgages||[]).length) s.push({name:'Mortgages', rows:mortgagesSummaryCSV()});
  (Y.mortgages||[]).forEach(m=> s.push({name:('Mortgage '+m.name).slice(0,28), rows:mortgageCSV(m)}));
  return s;
}

