/* ---------- bills / budget ---------- */
const annualOf = b => num(b.amount) * (FREQ[b.freq]||12);
const kindOf = b => (b.kind==='savings' ? 'savings' : 'bill');
const billsOfKind = k => Y.bills.filter(b=> !k || kindOf(b)===k);

/* Anything that looks like money put aside rather than money spent. Only ever
   applied once, to rows saved before the bill/savings split existed. */
function guessKind(name){
  const n = String(name||'');
  if(/\b(loan|insurance|mortgage|rent|repayment)\b/i.test(n)) return 'bill';
  if(/\b(saving|savings|invest|investment|investments|pension|avc|deposit|fund|isa|etf|shares?|equities|brokerage|nest ?egg)\b/i.test(n)) return 'savings';
  return 'bill';
}
function billTotals(kind){
  const t = {annual:0, monthly:0, weekly:0, byHolder:{}, joint:0};
  for(const b of billsOfKind(kind)){
    const a = annualOf(b);
    t.annual += a;
    const h = b.holder||'Joint';
    t.byHolder[h] = (t.byHolder[h]||0) + a;
    if(h==='Joint') t.joint += a;
  }
  t.monthly = t.annual/12; t.weekly = t.annual/52;
  return t;
}
const SPLIT_MODES = {
  income:'Share of net income',
  manual:'Manual percentages',
  disposable:'Even weekly disposable income'
};
/* Work out each person's share of the joint bills.
   - income:     pro-rata on net pay
   - manual:     whatever was typed, kept raw and only normalised for the maths
   - disposable: solve so everyone is left with the same amount per week
   Returns raw entered values (for the inputs) and normalised shares (for the money). */
function jointShares(){
  const people = Y.people, n = people.length;
  const even = n ? 1/n : 1;
  if(!n) return {shares:[], raw:[], rawSum:0, capped:false};

  const bands = Y.taxBands;
  const nets = people.map(p=> calcTax(p,bands).netMonthly);
  const bt = billTotals('bill');
  const joint = bt.joint/12;
  const sp = savingsSplit();

  if(Y.splitMode==='manual'){
    const raw = people.map(p=> Y.splitManual[p.id]!==undefined ? num(Y.splitManual[p.id]) : even);
    const rawSum = raw.reduce((a,b)=>a+b,0);
    return {raw, rawSum, shares: rawSum>0 ? raw.map(v=>v/rawSum) : raw.map(()=>even), capped:false};
  }

  if(Y.splitMode==='disposable'){
    // spare_i = net_i - own bills_i - savings_i ; leftover_i = spare_i - joint*s_i
    const spare = people.map((p,i)=> nets[i] - (bt.byHolder[p.name]||0)/12 - (sp.rows[i]?sp.rows[i].total:0));
    if(joint<=0) return {shares:people.map(()=>even), raw:people.map(()=>even), rawSum:1, capped:false};
    const target = (spare.reduce((a,b)=>a+b,0) - joint) / n;   // the equal leftover
    let sh = spare.map(v => (v - target)/joint);
    // nobody pays a negative share or more than the whole pot
    const capped = sh.some(v=> v<0 || v>1);
    sh = sh.map(v=> clamp(v,0,1));
    const sum = sh.reduce((a,b)=>a+b,0);
    sh = sum>0 ? sh.map(v=>v/sum) : people.map(()=>even);
    return {shares:sh, raw:sh, rawSum:1, capped};
  }

  const totalNet = nets.reduce((a,b)=>a+b,0);
  const sh = nets.map(v=> totalNet ? v/totalNet : even);
  return {shares:sh, raw:sh, rawSum:1, capped:false};
}

/* Savings per person: their own commitments plus an even share of the joint pot. */
function savingsSplit(){
  const st = billTotals('savings');
  const heads = Y.people.length || 1;
  const jointEach = (st.joint/12)/heads;
  const rows = Y.people.map(p=>{
    const own = (st.byHolder[p.name]||0)/12;
    return {id:p.id, name:p.name, own, joint:jointEach, total:own+jointEach};
  });
  const unassigned = Object.entries(st.byHolder)
    .filter(([h])=> h!=='Joint' && !Y.people.some(p=>p.name===h))
    .reduce((s,[,a])=>s+a/12, 0);
  return {rows, jointMonthly:st.joint/12, jointEach, totalMonthly:st.monthly, unassigned, heads};
}
/* Roll a due date forward to the next occurrence on or after today. Worked out
   directly rather than stepped one period at a time - a weekly bill dated years back
   used to take hundreds of iterations and needed a loop guard to stay safe. */
function nextDueFrom(b){
  if(!b.nextDue) return null;
  const d = parseDate(b.nextDue); if(!d) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  d.setHours(0,0,0,0);
  if(d >= today) return d;
  const step = b.freq;
  if(step==='Weekly' || step==='Fortnightly'){
    const days = step==='Weekly' ? 7 : 14;
    const periods = Math.ceil(daysBetween(d, today)/days);
    return addDays(d, periods*days);
  }
  const months = step==='Monthly' ? 1 : step==='Quarterly' ? 3 : 12;
  const gap = (today.getFullYear()-d.getFullYear())*12 + (today.getMonth()-d.getMonth());
  let periods = Math.floor(gap/months);
  let x = addMonths(d, periods*months);
  while(x < today) x = addMonths(d, (++periods)*months);   // at most one or two passes
  return x;
}


/* The next twelve months of bills, month by month. A bill with a payment date lands in the months it
   is really charged (so the big annual ones show up as spikes); a bill with no date is spread evenly. */
function yearAhead(){
  const today = new Date(); today.setHours(0,0,0,0);
  const first = new Date(today.getFullYear(), today.getMonth(), 1);
  const months = [];
  for(let i=0;i<12;i++){ const d = addMonths(first,i);
    months.push({key:monthKey(d), label:d.toLocaleDateString('en-IE',{month:'short', year:'2-digit'})+(i===0 && today.getDate()>1 ? ' (rest)' : ''), dated:0, spread:0, items:[]}); }
  const idx = {}; months.forEach((m,i)=> idx[m.key] = i);
  const end = addMonths(first,12);
  /* the n-th payment after the first, counted from the first date rather than from the previous one:
     31 Jan + 1 month is 28 Feb, but 31 Jan + 2 months must be 31 Mar, not 28 Mar */
  const nth = (d,f,n)=> f==='Weekly'?addDays(d,7*n): f==='Fortnightly'?addDays(d,14*n): addMonths(d, n*(f==='Monthly'?1:f==='Quarterly'?3:12));
  let datedCount = 0;
  for(const b of billsOfKind('bill')){
    const amt = num(b.amount); if(!amt) continue;
    const first = nextDueFrom(b);
    if(!first){ months.forEach(m=> m.spread += annualOf(b)/12); continue; }
    datedCount++;
    for(let n=0; n<400; n++){
      const d = nth(first, b.freq, n);
      if(d >= end) break;
      const m = months[idx[monthKey(d)]]; if(!m) continue;
      m.dated += amt;
      const it = m.items.find(x=>x.name===b.name);
      if(it){ it.amount += amt; it.count++; } else m.items.push({name:b.name, amount:amt, count:1});
    }
  }
  months.forEach(m=> m.total = m.dated + m.spread);
  return {months, datedCount};
}
