/* ---------------- household summaries used by more than one page ---------------- */
/* whole calendar days since the last backup download, or null if there never was one */
function daysSinceBackup(){
  if(!DB.lastBackup) return null;
  const d = new Date(DB.lastBackup); if(isNaN(d)) return null;
  d.setHours(0,0,0,0);
  const t = new Date(); t.setHours(0,0,0,0);
  return Math.round((t-d)/86400000);
}

/* ---------------- shared sums ---------------- */
function household(){
  const bands = Y.taxBands;
  const people = Y.people.map(p=>({p, t:calcTax(p,bands)}));
  const net = people.reduce((s,x)=>s+x.t.netMonthly,0);
  const bt = billTotals('bill'), st = billTotals('savings');
  return {people, net, bt, st, bills:bt.monthly, save:st.monthly, left: net - bt.monthly - st.monthly};
}

const savingsTotal = () => (Y.savings.accounts||[]).reduce((s,a)=>s+num(a.opening),0);

const marginalRate = p => { const b = Y.taxBands, t = calcTax(p,b); return t.taxable >= t.srcop ? b.highRate : b.lowRate; };

const isDefaultName = n => /^person \d+$/i.test(String(n||'').trim());

/* ---------------- set-up progress ---------------- */
function setupSteps(){
  const billsN = Y.bills.filter(b=>kindOf(b)==='bill' && num(b.amount)>0).length;
  const savN = Y.bills.filter(b=>kindOf(b)==='savings' && num(b.amount)>0).length + (Y.savings.accounts||[]).filter(a=>num(a.opening)||num(a.monthly)).length;
  const done = DB.ui.done || {};
  return [
    {id:'you', n:1, title:'About you and your pay', sub:'Names and salaries',
      ok: Y.people.some(p=>num(p.gross)>0)},
    {id:'bills', n:2, title:'Your regular bills', sub:'Rent, energy, insurance, phone...',
      ok: billsN>=3},
    {id:'save', n:3, title:'Savings and goals', sub:'Money you put aside',
      ok: savN>=1},
    {id:'credits', n:4, title:'Check your tax credits', sub:'Make sure you claim everything',
      ok: !!done.credits},
    {id:'backup', n:5, title:'Back up your data', sub:'So nothing is ever lost',
      ok: !!DB.lastBackup}
  ];
}

function setupProgress(){
  const s = setupSteps();
  return {steps:s, done:s.filter(x=>x.ok).length, total:s.length, next:s.find(x=>!x.ok)};
}

/* bills falling due and contracts ending in the next N days, soonest first */
function comingUp(days){
  const out = [];
  const today = new Date(); today.setHours(0,0,0,0);
  Y.bills.forEach(b=>{
    const d = nextDueFrom(b); if(!d) return;
    const n = daysBetween(today, d);
    if(n>=0 && n<=days) out.push({date:d, name:b.name||'Bill', amount:num(b.amount),
      note: (n===0?'Due today':n===1?'Due tomorrow':'Due in '+n+' days')+' - '+(b.holder||'Joint')});
  });
  upcomingRenewals(days).forEach(c=>{
    const d = parseDate(c.end); if(!d || c.days<0) return;
    out.push({date:d, name:(c.name||'Contract')+' ends', amount:0,
      note: (c.provider?c.provider+' - ':'')+'time to compare prices'});
  });
  return out.sort((a,b)=>a.date-b.date).slice(0,8);
}

/* ---------------- net worth ---------------- */
function netWorthFigures(){
  const N = DB.netWorth;
  const accts = (Y.savings.accounts||[]).map(a=>({name:a.name||'Savings account', value:num(a.opening), auto:true, src:'savings'}));
  const loans = Y.loans.map(l=>({name:l.name||'Loan', value:loanPosition(l).balance, auto:true, src:'loans'})).filter(x=>x.value>0);
  const morts = (Y.mortgages||[]).map(m=>({name:(m.lender?m.lender+' ':'')+'mortgage', value:mortgagePosition(m).balance, auto:true, src:'mortgage'})).filter(x=>x.value>0);
  const assets = [...accts, ...N.assets.map(a=>({...a, value:num(a.value)}))];
  const liabs = [...morts, ...loans, ...N.liabs.map(a=>({...a, value:num(a.value)}))];
  const A = assets.reduce((s,x)=>s+x.value,0), L = liabs.reduce((s,x)=>s+x.value,0);
  return {assets, liabs, A, L, net:A-L};
}
