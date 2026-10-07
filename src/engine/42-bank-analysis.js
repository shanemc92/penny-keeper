/* ---------- bank analysis ---------- */
function analysisRange(){
  const from = parseDate(Y.analysis.from)||new Date(Y.year,0,1);
  const to = parseDate(Y.analysis.to)||new Date(Y.year+1,0,1);
  const months = Math.max((to.getFullYear()-from.getFullYear())*12 + (to.getMonth()-from.getMonth()), 1);
  const weeks = Math.max(daysBetween(from,to)/7, 1);
  return {from, to, months, weeks};
}
function txnsInRange(){
  const {from,to} = analysisRange();
  return Y.txns.filter(t=>{ const d=parseDate(t.date); return d && d>=from && d<to; });
}
function categorise(desc, rules){
  const d = (desc||'').trim().toLowerCase();
  if(!d) return '';
  let bestLen = 0, bestCat = '';
  for(const r of (rules || Y.rules)){
    const m = (r.match||'').trim().toLowerCase();
    if(!m || !r.category) continue;
    if(d === m) return r.category;
    if(d.includes(m) && m.length > bestLen){ bestLen = m.length; bestCat = r.category; }
  }
  return bestCat;
}
function applyRules(force, year){
  const y = year || Y;
  let n=0;
  for(const t of (y.txns||[])){
    if(t.category && !force) continue;
    const c = categorise(t.desc, y.rules||[]);
    if(c && c!==t.category){ t.category=c; n++; }
  }
  return n;
}
function budgetVsActual(){
  const {months,weeks} = analysisRange();
  const rows = {};
  for(const b of Y.bills){
    const k = b.name;
    if(!rows[k]) rows[k] = {category:k, spend:0, budgetAnnual:0, count:0, tracked:true};
    rows[k].budgetAnnual += annualOf(b);
  }
  for(const t of txnsInRange()){
    const k = t.category || 'Uncategorised';
    if(!rows[k]) rows[k] = {category:k, spend:0, budgetAnnual:0, count:0, tracked:false};
    rows[k].spend += num(t.debit);
    rows[k].count++;
  }
  const out = Object.values(rows).map(r=>{
    r.monthlyActual = r.spend/months;
    r.weeklyActual = r.spend/weeks;
    r.monthlyBudget = r.budgetAnnual/12;
    r.varMonthly = r.monthlyActual - r.monthlyBudget;
    r.budgetPeriod = r.monthlyBudget*months;
    r.varPeriod = r.spend - r.budgetPeriod;
    r.usePct = r.budgetPeriod>0 ? r.spend/r.budgetPeriod*100 : (r.spend>0?999:0);
    return r;
  });
  out.sort((a,b)=> b.spend-a.spend);
  return out;
}

