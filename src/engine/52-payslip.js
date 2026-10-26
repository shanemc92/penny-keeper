/* ---------- payslips: build one, check the sums, keep the ones you want ----------
   The Payslips page lets someone type in what their payslip says, draws it in the layout their payroll package uses,
   and explains every box. This file is the data and the maths behind it - plain objects and sums, no page code - so
   the tests can run it.

   Where it lives: DB.payslips = {v:1, items:[...saved payslips], draft:{...}, draftOf:'id of the saved one being edited'}.
   It is deliberately not part of a tax year: a payslip belongs to the date it was paid, and a "what-if copy" of a year
   should not duplicate someone's payroll history. It sits beside DB.tracker and DB.netWorth and travels with every backup.

   Every figure is typed in by the person from their own payslip. The checks (psChecks) recompute what Irish payroll
   should have produced from the same inputs and say whether it agrees, in plain words. They are a second opinion, not an
   authority: payroll software knows things this page does not (previous employment, a mid-year change to credits),
   so a difference is worded as "worth asking about", never as "wrong". */

/* The way the payslip is drawn. It changes nothing about the maths. */
const PS_LAYOUTS = {
  sage:   {name:'Sage Payroll', blurb:'The classic Irish layout: blue section bars and summary boxes down the right-hand side.'},
  classic:{name:'Classic page', blurb:'A plain A4-style page: payments, then deductions, then net pay, with year-to-date figures underneath.'},
  modern: {name:'Online portal', blurb:'The card style used by online payroll portals and phone apps, with take-home pay up front.'}
};

const PS_FREQS = {
  W:  {label:'Weekly',      n:52, unit:'week'},
  F:  {label:'Fortnightly', n:26, unit:'fortnight'},
  '4':{label:'Four-weekly', n:13, unit:'four-week period'},
  M:  {label:'Monthly',     n:12, unit:'month'}
};

/* What each payment is. `taxable` is the default for the Y/N column; `cash` false means it is never paid to you (notional pay). */
const PS_PAY_KINDS = {
  basic:     {label:'Salary or wages',                  desc:'Salary',                taxable:true,  cash:true},
  overtime:  {label:'Overtime',                         desc:'Overtime',              taxable:true,  cash:true},
  bonus:     {label:'Bonus',                            desc:'Bonus',                 taxable:true,  cash:true},
  commission:{label:'Commission',                       desc:'Commission',            taxable:true,  cash:true},
  allowance: {label:'Allowance (taxable)',              desc:'Allowance',             taxable:true,  cash:true},
  bik:       {label:'Benefit in kind (notional pay)',   desc:'BIK',                   taxable:true,  cash:false},
  expense:   {label:'Expenses paid back (not taxed)',   desc:'Travel & subsistence',  taxable:false, cash:true},
  other:     {label:'Other payment',                    desc:'Other payment',         taxable:true,  cash:true}
};
/* What each deduction is. `pre` means it comes off before income tax is worked out (so it reduces taxable pay). */
const PS_DED_KINDS = {
  paye:   {label:'PAYE (income tax)',       desc:'PAYE',             pre:false},
  prsi:   {label:'PRSI',                    desc:'PRSI',             pre:false},
  usc:    {label:'USC',                     desc:'USC',              pre:false},
  lpt:    {label:'Local Property Tax',      desc:'LPT',              pre:false},
  pension:{label:'Pension',                 desc:'Pension',          pre:true},
  avc:    {label:'AVC (extra pension)',     desc:'AVC',              pre:true},
  health: {label:'Health insurance',        desc:'Health insurance', pre:false},
  union:  {label:'Union subscription',      desc:'Union subs',       pre:false},
  other:  {label:'Other deduction',         desc:'Other deduction',  pre:false}
};
/* The T/N column of a deduction as the Sage layout prints it: G for one taken from gross pay (before income tax), N for one taken from nett pay,
   and nothing for the three statutory ones. Sage's own set-up help lists the types as Gross and Nett; it does not say what the printed column shows, so the
   explanations hedge. */
const psDedCode = x => x.pre ? 'G' : (x.kind === 'paye' || x.kind === 'prsi' || x.kind === 'usc') ? '' : 'N';
/* The employer pension lines are optional: they are drawn, explained and walked through only when one of them has a figure. */
const psHasErPens = p => num(p.er.pensPeriod) !== 0 || num(p.er.pensYtd) !== 0;
const PS_BASES = {cumulative:'Cumulative', week1:'Week 1 / Month 1', emergency:'Emergency'};
const PS_USC_MODES = {ordinary:'Ordinary rates', reduced:'Reduced rates (medical card or aged 70+)', exempt:'Exempt (income under 13,000)'};
const PS_METHODS = ['Bank transfer', 'Cheque', 'Cash'];
const PS_PRSI_CREDIT_TO = 424;      // weekly pay at which the low-earner PRSI credit has tapered to nothing (credit is up to 12 from 352.01)

/* Employer PRSI, Class A: [from, standard rate, lower rate used on low weekly pay]. The 2024-10 and 2025-10 steps and the 2026-10
   step are from the Budget PRSI roadmap; 2027-10 is the rate already in law. Earlier years held at 11.05% / 8.8%. */
const PS_EMPLOYER_PRSI = [
  ['2022-01-01', .1105, .088], ['2024-10-01', .1115, .089], ['2025-10-01', .1125, .09],
  ['2026-10-01', .114, .0915], ['2027-10-01', .1155, .093]
];

const psPayDefault = kind => (PS_PAY_KINDS[kind] || PS_PAY_KINDS.other).desc;
const psDedDefault = kind => (PS_DED_KINDS[kind] || PS_DED_KINDS.other).desc;
function psNewPay(kind, amount){
  const k = PS_PAY_KINDS[kind] ? kind : 'other';
  return {id:uid(), desc:PS_PAY_KINDS[k].desc, kind:k, taxable:PS_PAY_KINDS[k].taxable, hours:0, amount:num(amount)};
}
function psNewDed(kind, amount){
  const k = PS_DED_KINDS[kind] ? kind : 'other';
  return {id:uid(), desc:PS_DED_KINDS[k].desc, kind:k, pre:PS_DED_KINDS[k].pre, amount:num(amount), ytd:0};
}

function psBlank(layout){
  const d = new Date();
  return {
    id:uid(), saved:'', layout:PS_LAYOUTS[layout] ? layout : 'sage', title:'',
    employer:{name:'', regNo:''},
    employee:{name:'', number:'', dept:'', cost:'', ppsn:''},
    period:{freq:'M', number:d.getMonth()+1, date:iso(d), method:'Bank transfer'},
    payments:[psNewPay('basic')],
    deductions:[psNewDed('paye'), psNewDed('prsi'), psNewDed('usc')],
    /* the summary boxes as printed; left empty they are worked out from the lines above */
    printed:{gross:'', deds:'', nonTax:'', rounding:'', net:''},
    cum:{gross:0, nonTaxDeds:0, taxable:0, credit:0, cutoff:0, taxPaid:0},
    tax:{basis:'cumulative', status:'', emer:'', creditPeriod:0, cutoffPeriod:0, prsiClass:'A1', insWeeks:0, usc:'ordinary'},
    er:{prsiPeriod:0, prsiYtd:0, pensPeriod:0, pensYtd:0, bikYtd:0}
  };
}

/* Tidy anything that claims to be a payslip - a saved one, or one from a restored backup. Missing fields are filled in. */
function psNormalise(p){
  const b = psBlank(p && p.layout);
  if(!p || typeof p !== 'object') return b;
  const obj = v => (v && typeof v === 'object') ? v : {};
  const str = (v, d, max) => (v == null ? d : String(v)).slice(0, max || 80);
  const q = {id:str(p.id, uid(), 24) || uid(), saved:str(p.saved, '', 30), layout:b.layout, title:str(p.title, '', 60)};
  const em = obj(p.employer), ee = obj(p.employee), pe = obj(p.period);
  q.employer = {name:str(em.name, ''), regNo:str(em.regNo, '', 30)};
  q.employee = {name:str(ee.name, ''), number:str(ee.number, '', 20), dept:str(ee.dept, '', 20), cost:str(ee.cost, '', 20), ppsn:str(ee.ppsn, '', 12).toUpperCase()};
  q.period = {freq:PS_FREQS[pe.freq] ? pe.freq : 'M', number:clamp(Math.round(num(pe.number)) || 1, 1, 60),
    date:parseDate(pe.date) ? iso(parseDate(pe.date)) : b.period.date, method:str(pe.method, b.period.method, 30)};
  q.payments = (Array.isArray(p.payments) ? p.payments : []).filter(x=>x && typeof x === 'object').map(x=>{
    const k = PS_PAY_KINDS[x.kind] ? x.kind : 'other';
    return {id:str(x.id, uid(), 24) || uid(), desc:str(x.desc, psPayDefault(k), 40), kind:k,
      taxable:k === 'bik' ? true : (typeof x.taxable === 'boolean' ? x.taxable : PS_PAY_KINDS[k].taxable), hours:num(x.hours), amount:num(x.amount)};
  });
  q.deductions = (Array.isArray(p.deductions) ? p.deductions : []).filter(x=>x && typeof x === 'object').map(x=>{
    const k = PS_DED_KINDS[x.kind] ? x.kind : 'other';
    return {id:str(x.id, uid(), 24) || uid(), desc:str(x.desc, psDedDefault(k), 40), kind:k,
      pre:typeof x.pre === 'boolean' ? x.pre : PS_DED_KINDS[k].pre, amount:num(x.amount), ytd:num(x.ytd)};
  });
  const seen = new Set();
  q.payments.concat(q.deductions).forEach(x=>{ while(seen.has(x.id)) x.id = uid(); seen.add(x.id); });
  const pr = obj(p.printed);
  q.printed = {}; Object.keys(b.printed).forEach(k=>{ q.printed[k] = blankish(pr[k]) || String(pr[k]).trim() === '' ? '' : num(pr[k]); });
  const cu = obj(p.cum), ta = obj(p.tax), er = obj(p.er);
  q.cum = {}; Object.keys(b.cum).forEach(k=>{ q.cum[k] = num(cu[k]); });
  q.tax = {basis:PS_BASES[ta.basis] ? ta.basis : 'cumulative', status:str(ta.status, '', 12), emer:str(ta.emer, '', 12),
    creditPeriod:num(ta.creditPeriod), cutoffPeriod:num(ta.cutoffPeriod), prsiClass:str(ta.prsiClass, 'A1', 6).toUpperCase(),
    insWeeks:num(ta.insWeeks), usc:PS_USC_MODES[ta.usc] ? ta.usc : 'ordinary'};
  q.er = {}; Object.keys(b.er).forEach(k=>{ q.er[k] = num(er[k]); });
  return q;
}

/* The whole store, as it sits in DB.payslips. */
function psStore(s){
  const o = (s && typeof s === 'object') ? s : {};
  const items = (Array.isArray(o.items) ? o.items : []).filter(x=>x && typeof x === 'object').map(psNormalise);
  const seen = new Set();
  items.forEach(x=>{ while(seen.has(x.id)) x.id = uid(); seen.add(x.id); });
  return {v:1, items, draft:(o.draft && typeof o.draft === 'object') ? psNormalise(o.draft) : null,
    draftOf:items.some(x=>x.id === o.draftOf) ? o.draftOf : ''};
}
/* what makes two payslips "the same" when deciding whether there is anything unsaved: everything but the ids and the save time */
const psSig = p => JSON.stringify(p, (k, v) => (k === 'id' || k === 'saved') ? undefined : v);

const psPeriodWord = p => { const u = (PS_FREQS[p.period.freq] || PS_FREQS.M).unit; return u.charAt(0).toUpperCase() + u.slice(1); };
function psTitle(p){
  if(p.title && p.title.trim()) return p.title.trim();
  const d = parseDate(p.period.date);
  return psPeriodWord(p) + ' ' + p.period.number + ' - ' + (d ? d.toLocaleDateString('en-IE', {day:'numeric', month:'short', year:'numeric'}) : 'no date');
}

/* ---------------- the sums ---------------- */

/* PRSI and USC change dates and rates by year, so look them up for the payment date. */
function psPrsiRates(dateIso){
  const d = parseDate(dateIso) || new Date();
  const b = presetFor(d.getFullYear());
  let er = PS_EMPLOYER_PRSI[0];
  PS_EMPLOYER_PRSI.forEach(r=>{ if(iso(d) >= r[0]) er = r; });
  return {ee:(d.getMonth()+1) >= num(b.prsiChangeMonth) ? b.prsiRate2 : b.prsiRate1, erHigh:er[1], erLow:er[2],
    exemptWeekly:num(b.prsiExemptWeekly), year:d.getFullYear()};
}
/* What PRSI on one pay should be for a Class A employee. Nothing at 352 a week or less; between 352.01 and 424 a week a credit of
   up to 12 a week is taken off, tapering to nothing. Everything is scaled to the pay period. */
function psPrsiExpected(pay, n, R){
  const weekly = pay * n / 52;
  if(weekly <= R.exemptWeekly) return 0;
  let owed = pay * R.ee;
  if(weekly <= PS_PRSI_CREDIT_TO) owed -= Math.max(0, 12 - (weekly - 352.01) / 6) * 52 / n;
  return Math.max(0, owed);
}
const psInCreditZone = (pay, n, R) => { const w = pay * n / 52; return w > R.exemptWeekly && w <= PS_PRSI_CREDIT_TO; };

function psUscBands(mode, b){
  if(mode === 'exempt') return [{to:1e12, rate:0}];
  if(mode === 'reduced') return [{to:b.uscBands[0].to, rate:b.uscBands[0].rate}, {to:1e12, rate:b.uscBands[1].rate}];
  return b.uscBands;
}
/* USC on all the pay so far this year. The year's bands are shared out over the periods, which is the same as working out
   the USC on the pay as if it carried on all year and taking the share that has gone by. */
function psUscToDate(cumGross, no, n, mode, b){
  if(mode === 'emergency') return Math.max(cumGross, 0) * 0.08;
  return uscFor(Math.max(cumGross, 0) * n / no, psUscBands(mode, b), mode === 'exempt' ? 1e12 : b.uscExempt) * no / n;
}
/* Income tax on pay to date: 20% up to the cut-off to date, 40% above it, less the credits to date. */
function psPayeToDate(taxable, cutoff, credit, b){
  const t = Math.max(taxable, 0), c = Math.max(cutoff, 0);
  return Math.max(0, Math.min(t, c) * b.lowRate + Math.max(t - c, 0) * b.highRate - credit);
}

/* Every total the page shows, worked out from the lines. `shown` swaps in a printed figure where the person typed one. */
function psCalc(p){
  const f = PS_FREQS[p.period.freq] || PS_FREQS.M, n = f.n;
  const sum = (list, fn) => round2(list.reduce((s, x) => s + fn(x), 0));
  const amt = x => num(x.amount);
  const pays = p.payments, deds = p.deductions;
  const gross = sum(pays.filter(x=>x.taxable), amt);
  const notional = sum(pays.filter(x=>x.kind === 'bik'), amt);
  const nonTaxPaid = sum(pays.filter(x=>!x.taxable && x.kind !== 'bik'), amt);
  const nonTaxAdj = round2(nonTaxPaid - notional);
  const of = k => sum(deds.filter(x=>x.kind === k), amt);
  const ytdOf = k => sum(deds.filter(x=>x.kind === k), x=>num(x.ytd));
  const totalDeds = sum(deds, amt);
  const pre = sum(deds.filter(x=>x.pre), amt);
  const rounding = blankish(p.printed.rounding) ? 0 : num(p.printed.rounding);
  const net = round2(gross - totalDeds + nonTaxAdj + rounding);
  const d = parseDate(p.period.date) || new Date();
  const show = (k, v) => blankish(p.printed[k]) ? v : num(p.printed[k]);
  return {
    f, n, no:Math.max(1, Math.round(num(p.period.number)) || 1), year:d.getFullYear(), date:iso(d),
    gross, notional, nonTaxPaid, nonTaxAdj, totalDeds, pre, taxablePay:round2(gross - pre), rounding, net,
    paye:of('paye'), prsi:of('prsi'), usc:of('usc'), lpt:of('lpt'), pension:round2(of('pension') + of('avc')),
    ytd:{paye:ytdOf('paye'), prsi:ytdOf('prsi'), usc:ytdOf('usc')},
    shown:{gross:show('gross', gross), deds:show('deds', totalDeds), nonTax:show('nonTax', nonTaxAdj), rounding, net:show('net', net)}
  };
}

/* ---------------- the self-checks ----------------
   Each check is {id, key, status, title, text}. `key` names the box on the payslip it is about. status is 'ok' (it agrees),
   'warn' (it does not, and that is worth a question to payroll or a second look at what was typed) or 'info' (a note, or
   a check that could not be done and why). */
function psChecks(p, c){
  const out = [];
  const add = (id, key, status, title, text) => out.push({id, key, status, title, text});
  const b = presetFor(c.year), R = psPrsiRates(c.date), n = c.n, no = c.no;
  const cls = String(p.tax.prsiClass || '').trim().toUpperCase(), classA = !cls || cls.charAt(0) === 'A';
  const basis = p.tax.basis;
  const rate = r => String(+(r * 100).toFixed(2)) + '%';
  const first = k => p.deductions.find(x=>x.kind === k);
  const rowKey = k => { const r = first(k); return r ? 'ded:' + r.id : ''; };
  const near = (a, z, tol) => Math.abs(a - z) <= tol;

  /* the three printed totals, if they were typed in */
  [['gross', 'sum.gross', 'Gross pay', c.gross, 'Add up the payments marked taxable. A line may be missing, or marked taxable when it is not.'],
   ['deds', 'sum.deds', 'Total deductions', c.totalDeds, 'A deduction may be missing from the list above, or one amount may have been mistyped.']].forEach(([k, key, label, got, hint])=>{
    if(blankish(p.printed[k])) return;
    if(near(num(p.printed[k]), got, 0.02)) add(k, key, 'ok', label + ' adds up', 'The lines you typed add up to ' + fmt(got) + ', the same as the total on your payslip.');
    else add(k, key, 'warn', label + ' does not add up', 'Your payslip says ' + fmt(num(p.printed[k])) + ' but the lines add up to ' + fmt(got) + '. ' + hint);
  });
  if(!blankish(p.printed.net)){
    if(near(num(p.printed.net), c.net, 0.02)) add('net', 'sum.net', 'ok', 'Net pay adds up', 'Gross pay, less deductions, plus any non-tax adjustment comes to ' + fmt(c.net) + ', the same as your payslip.');
    else add('net', 'sum.net', 'warn', 'Net pay does not add up', 'Gross ' + fmt(c.gross) + ' - deductions ' + fmt(c.totalDeds) + (c.nonTaxAdj ? ' + non-tax adjustments ' + fmt(c.nonTaxAdj) : '') +
      ' comes to ' + fmt(c.net) + ', but your payslip says ' + fmt(num(p.printed.net)) + '. Check the amounts you typed, or whether payroll made an adjustment that is not in the list.');
  }

  /* employee PRSI */
  if(first('prsi') && c.gross > 0){
    const key = rowKey('prsi');
    if(!classA) add('prsi', key, 'info', 'PRSI not checked', 'Your PRSI class is ' + cls + ', and only class A (most employees) can be checked here. Other classes pay different rates.');
    else {
      const want = round2(psPrsiExpected(c.gross, n, R)), tol = psInCreditZone(c.gross, n, R) ? 0.15 : 0.03;
      if(near(c.prsi, want, tol)){
        add('prsi', key, 'ok', 'PRSI matches',
          want === 0 ? 'Pay this low (at or under ' + fmt(R.exemptWeekly) + ' a week) pays no PRSI, and none was taken.'
          : 'PRSI of ' + rate(R.ee) + ' on ' + fmt(c.gross) + ' is ' + fmt(want) + (psInCreditZone(c.gross, n, R) ? ', after the low-earner PRSI credit' : '') + ' - the same as your payslip.');
      } else {
        add('prsi', key, 'warn', 'PRSI is different',
          'We get ' + fmt(want) + ' (' + rate(R.ee) + ' of ' + fmt(c.gross) + ') but your payslip shows ' + fmt(c.prsi) +
          '. The rate changed on 1 October, so a pay date either side of it matters; a different PRSI class or pay that PRSI is not charged on would also explain it.');
      }
    }
  }
  /* employer PRSI */
  if(num(p.er.prsiPeriod) > 0 && c.gross > 0 && classA){
    const hi = round2(c.gross * R.erHigh), lo = round2(c.gross * R.erLow), got = num(p.er.prsiPeriod);
    if(near(got, hi, 0.03)) add('erprsi', 'er.prsi', 'ok', 'Employer PRSI matches', 'The standard employer rate on ' + fmt(c.gross) + ' is ' + rate(R.erHigh) + ', which is ' + fmt(hi) + ' - the same as your payslip.');
    else if(near(got, lo, 0.03)) add('erprsi', 'er.prsi', 'ok', 'Employer PRSI matches', 'On pay this low your employer pays the lower rate of ' + rate(R.erLow) + ', which is ' + fmt(lo) + ' - the same as your payslip.');
    else add('erprsi', 'er.prsi', 'warn', 'Employer PRSI is different', 'Employer PRSI of ' + fmt(got) + ' is ' + rate(got / c.gross) + ' of ' + fmt(c.gross) + '. For a payment on ' + c.date +
      ' the usual rates are ' + rate(R.erHigh) + ' and ' + rate(R.erLow) + '. A different PRSI class, or pay the PRSI base does not include, would explain it.');
  }
  /* USC */
  if(first('usc') && c.gross > 0){
    const key = rowKey('usc'), mode = basis === 'emergency' ? 'emergency' : p.tax.usc;
    const ytd = c.ytd.usc, cumGross = num(p.cum.gross);
    const useYtd = basis === 'cumulative' && ytd > 0 && cumGross > 0;
    const want = round2(useYtd ? psUscToDate(cumGross, no, n, mode, b) : psUscToDate(c.gross, 1, n, mode, b));
    const got = useYtd ? ytd : c.usc, tol = Math.max(useYtd ? 1 : 0.5, want * 0.015);
    const what = useYtd ? 'so far this year' : 'this period';
    if(near(got, want, tol)) add('usc', key, 'ok', 'USC matches', 'Working USC out on ' + fmt(useYtd ? cumGross : c.gross) + ' of pay ' + what + ' gives ' + fmt(want) + ' - close enough to the ' + fmt(got) + ' on your payslip.');
    else add('usc', key, 'warn', 'USC is different', 'We get ' + fmt(want) + ' ' + what + ' on ' + (mode === 'ordinary' ? 'the ordinary USC rates' : mode === 'reduced' ? 'the reduced USC rates' : mode === 'exempt' ? 'an exemption' : 'the 8% emergency rate') +
      ', your payslip shows ' + fmt(got) + '. Reduced rates (medical card, or aged 70+) and an exemption are set in the Tax and PRSI details; pay that varied a lot, or income from an earlier job, can also move it.');
  }
  /* PAYE */
  if(first('paye') && c.gross > 0){
    const key = rowKey('paye'), taxableTD = num(p.cum.taxable) || (num(p.cum.gross) - num(p.cum.nonTaxDeds));
    const cutoffTD = num(p.cum.cutoff), creditTD = num(p.cum.credit);
    const paidTD = num(p.cum.taxPaid) || c.ytd.paye;
    if(basis === 'emergency'){
      add('paye', key, 'info', 'PAYE not checked', 'You are on the emergency basis, which ignores your credits and (after the first few weeks) puts all your pay at 40%, so there is nothing to compare it with here.');
    } else if(basis === 'cumulative' && taxableTD > 0 && (cutoffTD > 0 || creditTD > 0) && paidTD > 0){
      const want = round2(psPayeToDate(taxableTD, cutoffTD, creditTD, b));
      if(near(paidTD, want, 0.15)) add('paye', key, 'ok', 'PAYE adds up', 'The tax to date works out at ' + fmt(want) + ' from your taxable pay, cut-off and credits to date, ' + (near(paidTD, want, 0.005) ? 'the same as' : 'within rounding of') + ' the ' + fmt(paidTD) + ' on your payslip.');
      else add('paye', key, 'warn', 'PAYE is different', 'From your year-to-date taxable pay, cut-off and credits we get tax to date of ' + fmt(want) + ', but your payslip says ' + fmt(paidTD) +
        ' (' + fmt(Math.abs(paidTD - want)) + ' ' + (paidTD > want ? 'more' : 'less') + '). Check the year-to-date figures you typed; if they match your payslip, ask payroll - a credit may have changed part-way through the year.');
    } else if(basis === 'week1' && (num(p.tax.cutoffPeriod) > 0 || num(p.tax.creditPeriod) > 0)){
      const want = round2(psPayeToDate(c.taxablePay, num(p.tax.cutoffPeriod), num(p.tax.creditPeriod), b));
      if(near(c.paye, want, 0.1)) add('paye', key, 'ok', 'PAYE adds up', 'On the week 1 / month 1 basis this pay stands alone: ' + fmt(c.taxablePay) + ' taxed at 20% up to ' + fmt(num(p.tax.cutoffPeriod)) + ' and 40% above, less ' + fmt(num(p.tax.creditPeriod)) + ' of credit, is ' + fmt(want) + ' - the same as your payslip.');
      else add('paye', key, 'warn', 'PAYE is different', 'On the week 1 / month 1 basis we get ' + fmt(want) + ' for this pay but your payslip shows ' + fmt(c.paye) + '. Check the credit and cut-off for this period in the Tax and PRSI details.');
    } else {
      add('paye', key, 'info', 'PAYE not checked yet', basis === 'cumulative'
        ? 'Fill in the year-to-date boxes (taxable pay, tax credit, cut-off and tax paid) and we can check your PAYE against them.'
        : 'Fill in this period\'s tax credit and cut-off in the Tax and PRSI details and we can check your PAYE.');
    }
  }
  /* credits and cut-off */
  if(num(p.cum.credit) > 0 && num(p.tax.creditPeriod) > 0){
    const want = round2(num(p.tax.creditPeriod) * no);
    if(near(num(p.cum.credit), want, 0.06 + 0.005 * no)) add('credit', 'cum.credit', 'ok', 'Credits add up', 'Your credit for one period (' + fmt(num(p.tax.creditPeriod)) + ') times ' + no + ' periods is ' + fmt(want) + ', which is the credit to date on your payslip.');
    else add('credit', 'cum.credit', 'info', 'Credits changed during the year', 'One period\'s credit times ' + no + ' would be ' + fmt(want) + ', but the credit to date is ' + fmt(num(p.cum.credit)) + '. That happens when Revenue changes your credits part-way through the year, or you started mid-year.');
  }
  if(num(p.tax.creditPeriod) > 0){
    const yr = round2(num(p.tax.creditPeriod) * n);
    const single = creditAmount('single', c.year), emp = creditAmount('employee', c.year);
    const combos = [['a single person with the Employee credit', single + emp], ['a married couple or civil partners on one income, with the Employee credit', creditAmount('married', c.year) + emp],
      ['a single parent with the Employee credit', single + creditAmount('spccc', c.year) + emp]];
    const hit = combos.find(x=>near(yr, x[1], 3));
    if(hit) add('creditYear', 'tax.creditPeriod', 'ok', 'Credits look standard', 'Over a year your credits come to ' + fmt(yr) + ', which is what ' + hit[0] + ' gets in ' + c.year + '.');
    else add('creditYear', 'tax.creditPeriod', 'info', 'Credits are not the usual amount', 'Over a year your credits come to ' + fmt(yr) + '. The usual figure for a single person in ' + c.year + ' is ' + fmt(single + emp) + '. That is fine if you have extra credits or a different situation - your Tax Credit Certificate on Revenue myAccount shows the exact figures.');
  }
  if(num(p.cum.cutoff) > 0){
    const yr = round2(num(p.cum.cutoff) / no * n);
    const bands = [['a single person', b.srcopSingle], ['a single parent', b.srcopParent], ['a married couple or civil partners on one income', b.srcopMax]];
    const hit = bands.find(x=>near(yr, x[1], 3));
    if(hit) add('cutoff', 'cum.cutoff', 'ok', 'Cut-off looks standard', 'The cut-off to date works out at ' + fmt(yr) + ' for a full year, which is the ' + c.year + ' band for ' + hit[0] + '.');
    else add('cutoff', 'cum.cutoff', 'info', 'Cut-off is not a standard band', 'The cut-off to date works out at ' + fmt(yr) + ' for a full year. The ' + c.year + ' bands are ' + fmt(b.srcopSingle) + ' (single), ' + fmt(b.srcopParent) + ' (single parent) and ' + fmt(b.srcopMax) +
      ' (married, one income). Couples who both work share their bands, so another figure is normal; if you are single, check your certificate.');
  }
  if(num(p.cum.gross) > 0 && num(p.cum.taxable) > 0){
    const want = round2(num(p.cum.gross) - num(p.cum.nonTaxDeds));
    if(near(num(p.cum.taxable), want, 0.06)) add('taxable', 'cum.taxable', 'ok', 'Taxable pay adds up', 'Gross pay to date less non-tax deductions to date is ' + fmt(want) + ', the same as taxable pay to date.');
    else add('taxable', 'cum.taxable', 'info', 'Taxable pay is not gross less deductions', 'Gross pay to date less the non-tax deductions to date is ' + fmt(want) + ', but taxable pay to date is ' + fmt(num(p.cum.taxable)) + '. Payroll can treat some items (pension, benefit in kind, pay from a previous job) differently, so this is a note, not an error.');
  }
  if(num(p.cum.gross) > 0 && c.gross > 0 && no > 1){
    const avg = num(p.cum.gross) / no;
    if(Math.abs(avg - c.gross) / Math.max(avg, 1) > 0.05)
      add('average', 'cum.gross', 'info', c.gross > avg ? 'This pay is above your average' : 'This pay is below your average',
        'Your pay to date averages ' + fmt(avg) + ' over ' + no + ' periods, and this payslip is ' + fmt(c.gross) + '. Overtime, a bonus, unpaid leave or a pay rise would all show up like this.');
  }
  if(num(p.tax.insWeeks) > 0){
    const w = num(p.tax.insWeeks), want = Math.round(52 * no / n);
    if(w > 53) add('weeks', 'tax.insWeeks', 'warn', 'Too many insurable weeks', 'There are only 52 or 53 weeks in a year, but this says ' + w + '.');
    else if(w < want - 2) add('weeks', 'tax.insWeeks', 'info', 'Fewer insurable weeks than weeks gone by', 'About ' + want + ' weeks of the year have gone by, but ' + w + ' are counted. That is normal if you started this job part-way through the year or had unpaid leave.');
    else add('weeks', 'tax.insWeeks', 'ok', 'Insurable weeks look right', w + ' insurable weeks fits with about ' + want + ' weeks of the year having gone by.');
  }
  if(p.employee.ppsn){
    if(/^\d{7}[A-Z]{1,2}$/.test(p.employee.ppsn)) add('ppsn', 'employee.ppsn', 'ok', 'PPS number is in the right form', 'Seven digits followed by one or two letters is how every PPS number looks.');
    else add('ppsn', 'employee.ppsn', 'warn', 'PPS number looks wrong', 'A PPS number is seven digits followed by one or two letters, like 1234567T. Check what you typed against your payslip.');
  }
  if(basis === 'emergency') add('emergency', 'tax.status', 'warn', 'You are on emergency tax', 'Emergency tax means payroll does not have your credits and cut-off from Revenue. Sort it out with Revenue (myAccount) or your employer, and the extra tax is refunded once your details arrive.');
  if(no > n + 1) add('periodNo', 'period.number', 'warn', 'Pay period number looks high', 'A ' + c.f.label.toLowerCase() + ' payslip has ' + n + ' periods a year, but this says period ' + no + '.');
  return out;
}

/* Where each euro went: take-home pay and each kind of deduction, for the bar on the page. */
function psSplit(p, c){
  return [
    {id:'paye', label:'Income tax (PAYE)', amount:c.paye}, {id:'usc', label:'USC', amount:c.usc}, {id:'prsi', label:'PRSI', amount:c.prsi},
    {id:'pension', label:'Pension and AVC', amount:c.pension},
    {id:'other', label:'Other deductions', amount:round2(c.totalDeds - c.paye - c.usc - c.prsi - c.pension)},
    {id:'net', label:'Your take-home pay', amount:c.net}
  ].filter(x=>x.amount > 0.004);
}

/* What changed between two payslips: [label, before, after]. */
function psCompare(a, b){
  const rows = [['Gross pay', a.gross, b.gross], ['Income tax (PAYE)', a.paye, b.paye], ['USC', a.usc, b.usc], ['PRSI', a.prsi, b.prsi],
    ['Pension and AVC', a.pension, b.pension], ['Other deductions', round2(a.totalDeds - a.paye - a.usc - a.prsi - a.pension), round2(b.totalDeds - b.paye - b.usc - b.prsi - b.pension)],
    ['Take-home pay', a.net, b.net]];
  return rows.map(r=>({label:r[0], before:r[1], after:r[2], diff:round2(r[2] - r[1])}));
}

/* The next payslip in the run: same lines, the next period, and every year-to-date figure carried forward by this one. */
function psNextFrom(src){
  const p = psNormalise(JSON.parse(JSON.stringify(src))), c = psCalc(p), n = c.n, no = c.no;
  p.id = uid(); p.saved = ''; p.title = '';
  const d = parseDate(p.period.date) || new Date();
  const atMonthEnd = d.getDate() === new Date(d.getFullYear(), d.getMonth() + 1, 0).getDate();
  let nd;
  if(p.period.freq === 'M'){ nd = addMonths(d, 1); if(atMonthEnd) nd = new Date(nd.getFullYear(), nd.getMonth() + 1, 0); }
  else nd = addDays(d, p.period.freq === 'W' ? 7 : p.period.freq === 'F' ? 14 : 28);
  const newYear = nd.getFullYear() !== d.getFullYear();
  const credit = num(p.tax.creditPeriod) || (no ? num(p.cum.credit) / no : 0);
  const cutoff = num(p.tax.cutoffPeriod) || (no ? num(p.cum.cutoff) / no : 0);
  const bik = round2(p.payments.filter(x=>x.kind === 'bik').reduce((s, x)=>s + num(x.amount), 0));
  p.period.date = iso(nd);
  Object.keys(p.printed).forEach(k=>{ p.printed[k] = ''; });
  if(newYear){
    p.period.number = 1;
    Object.keys(p.cum).forEach(k=>{ p.cum[k] = 0; });
    p.deductions.forEach(x=>{ x.ytd = 0; });
    p.er.prsiYtd = 0; p.er.pensYtd = 0; p.er.bikYtd = 0; p.tax.insWeeks = 0;
    return p;
  }
  p.period.number = no + 1;
  p.cum.gross = round2(num(p.cum.gross) + c.gross);
  p.cum.nonTaxDeds = round2(num(p.cum.nonTaxDeds) + c.pre);
  p.cum.taxable = round2(num(p.cum.taxable) + c.taxablePay);
  p.cum.credit = round2(num(p.cum.credit) + credit);
  p.cum.cutoff = round2(num(p.cum.cutoff) + cutoff);
  p.cum.taxPaid = round2(num(p.cum.taxPaid) + c.paye);
  p.deductions.forEach(x=>{ x.ytd = round2(num(x.ytd) + num(x.amount)); });
  p.er.prsiYtd = round2(num(p.er.prsiYtd) + num(p.er.prsiPeriod));
  p.er.pensYtd = round2(num(p.er.pensYtd) + num(p.er.pensPeriod));
  p.er.bikYtd = round2(num(p.er.bikYtd) + bik);
  if(num(p.tax.insWeeks) > 0) p.tax.insWeeks += Math.round(52 * (no + 1) / n) - Math.round(52 * no / n);
  return p;
}

/* A made-up monthly payslip for July 2026, worked out with the same formulas the checks use, so everything on it agrees. */
function psExample(layout){
  const year = 2026, b = presetFor(year), n = 12, no = 7, salary = 3900, pensionPct = 5, expenses = 120;
  const pension = round2(salary * pensionPct / 100), taxableM = salary - pension;
  const cutoffM = b.srcopSingle / n, creditM = (creditAmount('single', year) + creditAmount('employee', year)) / n;
  const payeTo = k => psPayeToDate(taxableM * k, cutoffM * k, creditM * k, b);
  const uscTo = k => psUscToDate(salary * k, k, n, 'ordinary', b);
  const R = psPrsiRates('2026-07-31');
  const p = psBlank(layout);
  p.employer = {name:'Example Ltd', regNo:'123456'};
  p.employee = {name:'Sample Employee', number:'0012', dept:'OPS', cost:'100', ppsn:'1234567T'};
  p.period = {freq:'M', number:no, date:'2026-07-31', method:'Bank transfer'};
  const prsi = round2(salary * R.ee);
  p.payments = [psNewPay('basic', salary), psNewPay('expense', expenses)];
  const ded = (kind, amount, ytd) => { const x = psNewDed(kind, amount); x.ytd = round2(ytd); return x; };
  p.deductions = [ded('paye', round2(payeTo(no) - payeTo(no - 1)), payeTo(no)), ded('prsi', prsi, prsi * no), ded('usc', round2(uscTo(no) - uscTo(no - 1)), uscTo(no)), ded('pension', pension, pension * no)];
  p.cum = {gross:salary * no, nonTaxDeds:pension * no, taxable:taxableM * no, credit:round2(creditM * no), cutoff:round2(cutoffM * no), taxPaid:round2(payeTo(no))};
  p.tax = {basis:'cumulative', status:'N', emer:'', creditPeriod:round2(creditM), cutoffPeriod:round2(cutoffM), prsiClass:'A1', insWeeks:30, usc:'ordinary'};
  p.er = {prsiPeriod:round2(salary * R.erHigh), prsiYtd:round2(salary * R.erHigh * no), pensPeriod:pension, pensYtd:round2(pension * no), bikYtd:0};   // the employer matches the 5%
  return p;
}

/* A summary line per saved payslip, for the spreadsheet export. */
function psCsvRows(items){
  const rows = [['Payment date', 'Period', 'Employer', 'Employee', 'Gross pay', 'PAYE', 'USC', 'PRSI', 'Pension and AVC', 'Other deductions', 'Total deductions',
    'Non-tax adjustments', 'Net pay', 'Employer PRSI', 'Employer pension', 'Gross pay to date', 'Tax paid to date']];
  items.slice().sort((a, b)=> a.period.date < b.period.date ? -1 : a.period.date > b.period.date ? 1 : 0).forEach(p=>{
    const c = psCalc(p);
    rows.push([p.period.date, psPeriodWord(p) + ' ' + p.period.number, p.employer.name, p.employee.name, c.shown.gross, c.paye, c.usc, c.prsi, c.pension,
      round2(c.totalDeds - c.paye - c.usc - c.prsi - c.pension), c.shown.deds, c.shown.nonTax, c.shown.net, num(p.er.prsiPeriod), num(p.er.pensPeriod), num(p.cum.gross), num(p.cum.taxPaid) || c.ytd.paye]);
  });
  return rows;
}
