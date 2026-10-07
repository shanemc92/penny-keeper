/* ---------- loan amortisation (daily interest, matches the workbook) ---------- */
function amortise(loan, useProposed){
  const rate = num(loan.rate)/100;
  const daily = rate/365.25;
  const rpy = FREQ[loan.freq]||12;
  const step = loan.freq;
  const start = parseDate(loan.startDate) || new Date();
  const normal = num(loan.repayment);
  const boosted = num(loan.proposedRepayment)||normal;
  /* Overpayments usually start partway through a loan, so the schedule pays the
     normal amount up to that date and the higher one from then on. No date means
     the higher amount applies from the start, which is how it behaved before. */
  const boostFrom = useProposed ? parseDate(loan.proposedStart) : null;
  const payAt = d => useProposed && (!boostFrom || d >= boostFrom) ? boosted : normal;
  const extras = loan.extras||{};
  let bal = num(loan.opening), date = new Date(start.getTime());
  const rows=[]; let interest=0, paid=0, n=0;
  while(bal > 0.005 && n < 1200){
    n++;
    const prev = new Date(date.getTime());
    if(step==='Weekly') date = addDays(date,7);
    else if(step==='Fortnightly') date = addDays(date,14);
    else if(step==='Quarterly') date = addMonths(date,3);
    else if(step==='Annual') date = addMonths(date,12);
    else date = addMonths(date,1);
    const int = round2(daily*bal*daysBetween(prev,date));
    const pay = payAt(date);
    const extra = useProposed ? num(extras[n]) : 0;
    let principal = Math.min(bal, Math.max(pay - int, 0) + extra);
    if(pay - int <= 0){ rows.push({n, date:iso(date), opening:bal, interest:int, principal:0, payment:int, balance:bal, stalled:true}); break; }
    const payment = principal + int;
    const closing = round2(bal - principal);
    rows.push({n, date:iso(date), opening:round2(bal), interest:int, principal:round2(principal), payment:round2(payment), balance:closing, extra});
    interest += int; paid += payment; bal = closing;
  }
  return {rows, interest:round2(interest), paid:round2(paid), payments:rows.length,
          end: rows.length? rows[rows.length-1].date : '', repayment:payAt(new Date()), cleared: bal<=0.005};
}

/* Where a loan actually stands today: what is still owed, and what interest is yet
   to be charged between now and the final payment. Everything before today has
   already happened, so it is excluded. */
function loanPosition(loan, precomputed){
  const sch = precomputed || amortise(loan, true);
  const today = new Date(); today.setHours(0,0,0,0);
  const future = sch.rows.filter(r => parseDate(r.date) >= today);
  const balance = future.length ? future[0].opening : 0;      // owed before the next payment lands
  const remainingInterest = round2(future.reduce((s,r)=> s + r.interest, 0));
  const paidInterest = round2(sch.interest - remainingInterest);
  return {
    balance: round2(balance), remainingInterest, paidInterest,
    toPay: round2(balance + remainingInterest),
    payments: future.length, next: future.length ? future[0].date : '',
    end: sch.end, cleared: !future.length, schedule: sch
  };
}
function monthsBetween(a,b){   // DATEDIF "m" semantics: whole months only
  let m = (b.getFullYear()-a.getFullYear())*12 + (b.getMonth()-a.getMonth());
  if(b.getDate() < a.getDate()) m--;
  return m;
}
function calcRepayment(loan){
  // level repayment to clear by the target end date
  const rate = num(loan.rate)/100, rpy = FREQ[loan.freq]||12;
  const start = parseDate(loan.startDate), end = parseDate(loan.endDate);
  if(!start||!end) return 0;
  const months = monthsBetween(start,end);
  const nper = rpy*(months/12);
  if(nper<=0) return 0;
  const i = Math.pow(rate/365.25+1, 365.25/rpy)-1;
  const pv = num(loan.opening);
  if(i===0) return round2(pv/nper);
  return round2(pv*i/(1-Math.pow(1+i,-nper)));
}

