/* ---------- Irish mortgage engine ----------
   Two things make a mortgage behave differently from the personal loans above, and
   both of them are why this is a separate tab rather than another loan row.

   Interest accrues daily on the cleared balance - Irish lenders quote 1/365th of the
   annual rate - and is charged monthly. And the repayment is not a figure you pick:
   the lender re-solves it over whatever is left of the ORIGINAL term every time the
   rate changes, which is exactly what lands in the post when a fixed period ends.
   Overpaying does not reduce the repayment, it shortens the term, so that is what
   happens here too.

   The monthly payments are always modelled. A statement is a reading from the lender
   rather than a payment - most people get one a year, covering twelve payments, so
   treating each one as a payment would count the year twice over. What a statement is
   good for is the balance on it: that is taken as correct on its date and the drift
   the model has built up since the last one is adjusted away. Day-count and rounding
   conventions differ between lenders and none of them publish theirs, so the model
   alone drifts by a few euro a year - the adjustments are what keep it honest. */
const MORT_BASIS = 365;
const RATE_KINDS = {fixed:'Fixed', variable:'Variable', tracker:'Tracker'};
/* How the lender works out the interest it charges, which is not a detail: on a 370k
   balance the difference between these is about 20 a year, one way or the other, and
   it is the thing to change first if every statement comes out the same amount off.
   "Monthly" charges a flat twelfth of the annual rate at each payment and does no day
   counting at all, which is what a lot of Irish lenders actually do despite quoting a
   daily rate. The stub between drawdown and the first payment is always daily. */
/* listed separately because object keys that look like integers sort numerically, which
   would put the non-default option first in the dropdown */
const MORT_BASES = {'365':'Daily, 1/365th', '12':'Monthly, 1/12th'};
const MORT_BASIS_ORDER = ['365','12'];
const basisOf = m => MORT_BASES[String(m && m.basis)] ? String(m.basis) : '365';

function blankMortgage(){
  const today = iso(new Date());
  return {id:uid(), name:'Home mortgage', lender:'', startDate:today,
    principal:0, termMonths:360, propertyValue:0, repayment:0, basis:'365',
    rates:[{id:uid(), from:today, rate:3.9, kind:'fixed'}],
    overpayMonthly:0, overpayFrom:'', allowancePct:10,
    insuranceMonthly:0, lumps:[], statements:[]};
}
/* Rate entries are effective-from dates, so there is no such thing as a gap or an
   overlap - the latest one that has started is the one in force. A hand-edited
   restore might not be in order, so sort rather than trust the array. */
function mortRates(m){
  return (m.rates||[]).filter(r=> r && r.from)
    .slice().sort((a,b)=> String(a.from) < String(b.from) ? -1 : 1);
}
function mortRateAt(m, date){
  const rs = mortRates(m);
  if(!rs.length) return {rate:0, kind:'variable', from:''};
  let cur = rs[0];
  for(const r of rs){ const d = parseDate(r.from); if(d && d<=date) cur = r; else break; }
  return cur;
}
/* Level repayment that clears `bal` over `months`, using the monthly rate that matches
   how the lender charges, so a schedule left alone lands on zero at the end of the term. */
function mortPayment(bal, annualPct, months, basis){
  if(months<=0 || bal<=0.005) return 0;
  const b = MORT_BASES[String(basis)] ? String(basis) : '365';
  const i = b==='12' ? num(annualPct)/100/12
          : Math.pow(1 + num(annualPct)/100/MORT_BASIS, MORT_BASIS/12) - 1;
  if(i<=0) return round2(bal/months);
  return round2(bal*i/(1-Math.pow(1+i,-months)));
}
/* Interest between two dates, split at any rate change in between. The balance does
   not move between payments, so summing each segment's days is exact. Only the daily
   bases come through here; a monthly lender charges per payment, not per day. */
function mortInterest(m, bal, from, to){
  if(bal<=0.005 || !(to>from)) return 0;
  const div = MORT_BASIS;
  const rs = mortRates(m);
  let total = 0, cursor = new Date(from.getTime());
  while(cursor < to){
    let next = to;
    for(const r of rs){ const d = parseDate(r.from); if(d && d>cursor && d<next){ next = d; break; } }
    total += bal * (num(mortRateAt(m,cursor).rate)/100/div) * daysBetween(cursor,next);
    cursor = next;
  }
  return round2(total);
}
/* opts.noExtra runs the same mortgage with the overpayments and lump sums taken back
   out, which is the only honest way to say what they actually saved. */
function mortgageSchedule(m, opts){
  opts = opts||{};
  const start = parseDate(m.startDate);
  const term = clamp(Math.round(num(m.termMonths)), 0, 1200);
  const principal = num(m.principal);
  const out = {rows:[], interest:0, paid:0, extra:0, insurance:0, payments:0, end:'', balance:0,
               cleared:false, anchors:0, adjusted:0, lastAnchor:'', stalled:false};
  if(!start || principal<=0.005 || !term) return out;

  const lumps = (opts.noExtra ? [] : (m.lumps||[]))
    .filter(l=> l && l.date && num(l.amount)>0)
    .map(l=>({date:parseDate(l.date), amount:num(l.amount), note:String(l.note||'')}))
    .filter(l=> l.date).sort((a,b)=> a.date-b.date);
  const stmts = (m.statements||[])
    .filter(s=> s && s.date)
    .map(s=>({date:parseDate(s.date),
              amount:   blankish(s.amount)   ? null : num(s.amount),
              interest: blankish(s.interest) ? null : num(s.interest),
              balance:  blankish(s.balance)  ? null : num(s.balance),
              note:String(s.note||'')}))
    .filter(s=> s.date).sort((a,b)=> a.date-b.date);
  const overAmt = opts.noExtra ? 0 : num(m.overpayMonthly);
  const overFrom = parseDate(m.overpayFrom);
  const insMonthly = num(m.insuranceMonthly);
  const basis = basisOf(m);
  const monthly = basis === '12';   // charged per payment, not per day
  let payCount = 0;

  let bal = principal, cursor = new Date(start.getTime()), li = 0, si = 0, n = 0;
  let interestTotal = 0, paidTotal = 0, extraTotal = 0, insTotal = 0;
  let sinceInterest = 0, sincePaid = 0;      // running totals since the last statement
  const rows = [];

  /* A lump sum landing mid-month reduces the balance for the rest of that month, but
     the interest it saves is not charged until the monthly charge date. Walking the
     gap in segments split at each lump keeps both of those true. */
  const advance = (from, to, charge)=>{
    let acc = 0, lump = 0; const notes = [];
    let seg = new Date(from.getTime());
    while(li < lumps.length && lumps[li].date <= to){
      const L = lumps[li];
      const at = L.date < seg ? seg : L.date;
      if(charge==='daily') acc += mortInterest(m, bal, seg, at);
      bal = round2(Math.max(0, bal - L.amount));
      lump += L.amount; if(L.note) notes.push(L.note);
      seg = at; li++;
    }
    /* A monthly lender charges a flat twelfth at the payment and counts no days, so the
       lump is off the balance before the charge is worked out. */
    if(charge==='monthly') acc = bal * num(mortRateAt(m,to).rate)/100/12;
    else if(charge==='daily') acc += mortInterest(m, bal, seg, to);
    return {interest:round2(acc), lump:round2(lump), note:notes.join('; ')};
  };

  /* Settle any statements that fall due, as readings rather than payments. The interest
     accrued since the last payment is charged here first, because a lender's statement
     balance includes it - that is what keeps the adjustment down to a correction instead
     of a whole month of interest. Then the balance on the statement is taken as correct
     and the difference is recorded, so a schedule built from once-a-year statements
     tracks the real account instead of drifting away from it. */
  const settle = (upto, inclusive)=>{
    while(si < stmts.length && rows.length<1200 &&
          (inclusive ? stmts[si].date <= upto : stmts[si].date < upto)){
      const s = stmts[si++];
      const opening = bal, from = new Date(cursor.getTime());
      /* Under a monthly basis nothing accrues between payments, so a statement date
         carries no interest of its own - except the drawdown stub, before any payment
         has been taken, which every lender charges daily. */
      const ev = advance(cursor, s.date, (monthly && payCount>0) ? 'none' : 'daily');
      const modelled = round2(bal + ev.interest);
      const adjust = s.balance===null ? 0 : round2(s.balance - modelled);
      bal = s.balance===null ? modelled : s.balance;
      interestTotal += ev.interest; extraTotal += ev.lump; paidTotal += ev.lump;
      sinceInterest = round2(sinceInterest + ev.interest);
      rows.push({n:++n, date:iso(s.date), statement:true, rate:num(mortRateAt(m,from).rate),
        opening:round2(opening), interest:ev.interest, principal:0, payment:0, insurance:0,
        extra:ev.lump, balance:round2(bal), adjust,
        statedBalance:s.balance, statedInterest:s.interest, statedPaid:s.amount,
        periodInterest:sinceInterest, periodPaid:round2(sincePaid),
        note:[ev.note, s.note].filter(Boolean).join('; ')});
      out.anchors++; out.adjusted = round2(out.adjusted + adjust); out.lastAnchor = iso(s.date);
      cursor = s.date; sinceInterest = 0; sincePaid = 0;
    }
  };

  let k = 1, rateKey = null, repayment = 0;
  let stated = num(m.repayment) > 0;   // dropped at the first rate change
  while(bal>0.005 && rows.length<1200 && k<=term+600){
    const payDate = addMonths(start, k);
    settle(payDate, false);                 // statements dated before this payment land first
    if(bal<=0.005) break;

    const r = mortRateAt(m, payDate);
    const key = String(r.from)+'@'+num(r.rate);
    if(key !== rateKey){
      /* Coming off recorded statements, the repayment on the statement beats anything
         derived: after overpayments the lender is still collecting the contractual
         amount, not one re-solved off the lower balance. A rate change supersedes it,
         because re-solving is exactly what the lender does at that point. */
      if(rateKey !== null) stated = false;
      rateKey = key;
      repayment = stated ? num(m.repayment) : mortPayment(bal, r.rate, Math.max(1, term-k+1), basis);
    }
    const opening = bal, from = new Date(cursor.getTime());
    const shownRate = num(mortRateAt(m, monthly ? payDate : from).rate);
    const ev = advance(cursor, payDate, monthly ? 'monthly' : 'daily');
    const over = (!overFrom || payDate >= overFrom) ? overAmt : 0;
    let pay = round2(repayment + over);
    const due = round2(bal + ev.interest);
    if(pay <= ev.interest && ev.lump<=0){
      // repayment does not even cover the interest - flag it rather than loop forever
      rows.push({n:++n, date:iso(payDate), rate:shownRate, opening:round2(opening),
        interest:ev.interest, principal:0, payment:pay, extra:0, balance:bal,
        actual:false, stalled:true});
      out.stalled = true; break;
    }
    /* The repayment is a whole number of cents, so it never divides the balance exactly
       and a few euro are left after the last scheduled payment - enough to spawn a whole
       extra row for 3 quid. A lender clears that with the final payment, so if less than
       a tenth of a payment would be left over, this one takes it. A real shortfall, from
       a rate rise the repayment never caught up with, is far bigger than that and still
       runs on into the extra rows it deserves. */
    if(pay > due || due - pay < pay*0.1) pay = due;
    const principalPaid = round2(pay - ev.interest);
    bal = round2(bal - principalPaid);
    if(bal < 0.005) bal = 0;
    /* Insurance rides along with the direct debit but is not a mortgage payment - it
       never touches the balance, it just makes the figure leaving the account real. */
    rows.push({n:++n, date:iso(payDate), rate:shownRate, opening:round2(opening),
      interest:ev.interest, principal:principalPaid, payment:pay, insurance:insMonthly,
      extra:round2(over+ev.lump), balance:bal, note:ev.note});
    interestTotal += ev.interest; paidTotal += pay + ev.lump; extraTotal += over + ev.lump;
    insTotal += insMonthly; payCount++;
    sinceInterest = round2(sinceInterest + ev.interest);
    sincePaid = round2(sincePaid + pay + ev.lump);
    cursor = payDate; k++;
    settle(payDate, true);                  // a statement dated on a payment day reads after it
  }
  out.rows = rows;
  out.interest = round2(interestTotal);
  out.paid = round2(paidTotal);
  out.extra = round2(extraTotal);
  out.insurance = round2(insTotal);
  out.payments = rows.filter(r=> !r.statement).length;
  out.end = (()=>{ const p = rows.filter(r=> !r.statement); return p.length ? p[p.length-1].date : ''; })();
  out.balance = bal;
  out.cleared = bal<=0.005;
  return out;
}
/* Where the mortgage stands today: everything dated before today has happened. */
function mortgagePosition(m, precomputed){
  const s = precomputed || mortgageSchedule(m);
  const today = new Date(); today.setHours(0,0,0,0);
  const future = s.rows.filter(r=> parseDate(r.date) >= today);
  const past = s.rows.filter(r=> parseDate(r.date) < today);
  const balance = future.length ? future[0].opening
                : past.length ? past[past.length-1].balance : num(m.principal);
  const start = parseDate(m.startDate);
  const term = clamp(Math.round(num(m.termMonths)), 0, 1200);
  const originalEnd = (start && term) ? iso(addMonths(start, term)) : '';
  const cur = mortRateAt(m, today);
  const value = num(m.propertyValue);
  /* statement rows carry no payment, so the next one due is the next real payment */
  const futurePays = future.filter(r=> !r.statement);
  const lastAnchor = past.filter(r=> r.statement).pop();
  const ins = num(m.insuranceMonthly);
  const nextPayment = futurePays.length ? futurePays[0].payment : 0;
  return {
    balance: round2(balance),
    remainingInterest: round2(future.reduce((t,r)=> t+r.interest, 0)),
    paidInterest: round2(past.reduce((t,r)=> t+r.interest, 0)),
    toPay: round2(balance + future.reduce((t,r)=> t+r.interest, 0)),
    payments: futurePays.length, next: futurePays.length ? futurePays[0].date : '',
    nextPayment, insurance: ins, outlay: round2(nextPayment + ins),
    rate: num(cur.rate), kind: cur.kind || 'variable',
    ltv: value>0 ? balance/value*100 : 0,
    end: s.end, originalEnd,
    lastAnchor: lastAnchor ? lastAnchor.date : '',
    lastAnchorBalance: lastAnchor ? lastAnchor.balance : null,
    monthsSooner: (s.end && originalEnd) ? monthsBetween(parseDate(s.end), parseDate(originalEnd)) : 0,
    cleared: !futurePays.length && s.cleared, schedule: s
  };
}
/* Irish lenders cap what you can overpay while on a fixed rate before a break fee
   applies - commonly 10% a year, but it varies by lender and sits in your loan offer,
   so the allowance is editable and this only ever warns. The fee itself depends on
   funding rates on the day, which nobody publishes, so it is deliberately not guessed. */
function fixedOverpayWarnings(m, sch){
  const allow = num(m.allowancePct);
  if(allow<=0) return [];
  const byYear = {};
  for(const r of sch.rows){
    if(num(r.extra)<=0) continue;
    const d = parseDate(r.date); if(!d) continue;
    if((mortRateAt(m,d).kind||'variable') !== 'fixed') continue;
    const y = d.getFullYear();
    if(!byYear[y]) byYear[y] = {year:y, extra:0, opening:num(r.opening)};
    byYear[y].extra += num(r.extra);
  }
  return Object.values(byYear)
    .map(v=> ({year:v.year, extra:round2(v.extra), allowed:round2(v.opening*allow/100)}))
    .filter(v=> v.extra > v.allowed + 0.005)
    .sort((a,b)=> a.year-b.year);
}

