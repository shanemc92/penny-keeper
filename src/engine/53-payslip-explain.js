/* ---------- payslips: what each box means ----------
   psExplain(p, c, checks, key) answers "what is this box?" for one box on the payslip, in plain English and with the
   person's own numbers filled in. `key` names the box: 'employee.ppsn', 'sum.net', 'pay:<id>' for a payment line,
   'ded:<id>' for a deduction line, and so on - the drawings (ui/95-payslip-svg.js) and the walk-through use the same keys.

   Text is plain, with **double stars** around words to put in bold; the page escapes it before turning those into <b>. The
   returned object is {key, title, value, sub, say:[paragraphs], how:[[label, value, 'sum'?]], tip, checks:[...]}, or null
   for a key that does not exist. Wording is deliberately about what the box usually means: payroll packages label things
   a little differently, and the page says so rather than pretending to know your payroll's exact wording. */

const PS_CLASS_NOTES = {
  A:'Class A covers most employees: people in the private sector, and public servants recruited since 6 April 1995. The number after the letter (A1 is the usual one) is a sub-class that mostly matters for how much your employer pays.',
  B:'Class B is for permanent, pensionable civil and public servants recruited before 6 April 1995. They pay less PRSI than class A and are covered for fewer benefits.',
  C:'Class C is for pensionable public servants recruited before 6 April 1995 (the Defence Forces and some others), who pay a lower rate of PRSI.',
  D:'Class D is for pensionable public servants recruited before 6 April 1995, who pay a lower rate of PRSI.',
  H:'Class H is for non-commissioned officers and other ranks of the Defence Forces.',
  J:'Class J is for people on very low pay (under 38 a week), employees aged 66 or over, and a few other groups. It gives cover for only some benefits.',
  K:'Class K is for public office holders.',
  M:'Class M is for people under 16, and a few others who pay no PRSI.',
  S:'Class S is for the self-employed and some company directors.'
};

function psExplain(p, c, checks, key){
  const R = psPrsiRates(c.date), b = presetFor(c.year), n = c.n, no = c.no, f = c.f;
  const M = fmt, pr = r => String(+(r * 100).toFixed(2)) + '%';
  const when = d => { const x = parseDate(d); return x ? x.toLocaleDateString('en-IE', {day:'numeric', month:'long', year:'numeric'}) : 'no date yet'; };
  const mine = (checks || []).filter(x=>x.key === key);
  const T = (title, o) => Object.assign({key, title, value:'', sub:'', say:[], how:[], tip:'', checks:mine}, o || {});
  const some = v => (v === '' || v == null) ? '-' : String(v);
  const lowNote = c.year === 2026 ? ' (up to 552 a week in 2026)' : '';
  const pctOf = (a, z) => z > 0 ? pr(a / z) : '-';

  /* ---------- the top of the payslip ---------- */
  const TOP = {
    'employer.name': () => T('Employer', {value:some(p.employer.name),
      say:['This is the company that pays you. By law your employer has to give you a payslip every time you are paid, showing your gross pay and each deduction taken from it.'],
      tip:'Keep your payslips. A mortgage, a loan or a rental application will ask for recent ones, and they are how you check your tax at the end of the year.'}),
    'employer.regNo': () => T('Company registration number', {value:some(p.employer.regNo),
      say:['The number the Companies Registration Office gave the company. It identifies the legal employer and has nothing to do with your own pay or tax.']}),
    'employee.name': () => T('Your name', {value:some(p.employee.name),
      say:['Your name as payroll has it. Revenue knows you by your PPS number rather than your name, but a wrong name can cause trouble with records like your P60, so tell payroll if it is not right.']}),
    'employee.number': () => T('Employee number', {value:some(p.employee.number),
      say:['Your ID inside this employer\'s payroll system. It is not a government number - it is just how payroll finds you. Quote it when you ring or email them about a payslip.']}),
    'employee.dept': () => T('Department', {value:some(p.employee.dept),
      say:['A code for the part of the business you work in. It is used for the company\'s own bookkeeping and has no effect on your pay or tax.']}),
    'employee.cost': () => T('Cost centre', {value:some(p.employee.cost),
      say:['A code for the budget your pay is charged to inside the company. Pure bookkeeping - it has no effect on what you are paid.']}),
    'employee.ppsn': () => T('PPS number', {value:some(p.employee.ppsn),
      say:['Your Personal Public Service number. Revenue and the Department of Social Protection identify you by it, and every time you are paid your employer reports the pay, tax, USC and PRSI to Revenue against this number.'],
      tip:'Treat your PPS number a bit like a password for your tax affairs and do not post it anywhere public. Penny Keeper keeps it only in this browser.'}),
    'period.freq': () => T('How often you are paid', {value:f.label, sub:n + ' pays a year',
      say:['On the payslip this is usually a letter: **W** is weekly, **F** fortnightly, **M** monthly and **4** four-weekly.',
        'It matters because every yearly figure - your tax credits, your tax cut-off point, the USC bands - is split across your pays so that you get a fair share of each one every time.'],
      how:[['Pays a year', String(n)], ['A yearly 4,000 of tax credit becomes', M(4000 / n) + ' a pay']]}),
    'period.number': () => T('Pay period number', {value:String(no), sub:'of ' + n + ' this year',
      say:['Which pay of the tax year this is. The Irish tax year is the calendar year, 1 January to 31 December, so period 1 is your first pay of January.',
        'Most people are taxed on a cumulative basis, and this number is what makes that work: by now ' + no + ' of your ' + n + ' pays have gone by, so ' + pr(no / n) + ' of your yearly credits and cut-off are available to set against your pay so far.'],
      how:[['Pays so far this year', no + ' of ' + n], ['Share of the year gone by', pr(no / n)]]}),
    'period.date': () => T('Payment date', {value:when(p.period.date), sub:'tax year ' + c.year,
      say:['The day you are paid. It matters for more than when the money arrives: it decides which tax year the pay belongs to, and which PRSI rate applies, because PRSI rates go up on 1 October.'],
      how:[['Tax year', String(c.year)], ['Employee PRSI rate on this date', pr(R.ee)], ['Employer PRSI rate on this date', pr(R.erHigh)]]}),
    'period.method': () => T('Pay method', {value:some(p.period.method),
      say:['How the money reaches you. A bank transfer is the usual way, and means your net pay is lodged to your account on the payment date. Some payslips leave this box blank.']})
  };

  /* ---------- the summary boxes ---------- */
  const lines = (list, sign) => list.filter(x=>num(x.amount) !== 0).map(x=>[(x.desc || 'Line') + (x.kind === 'bik' ? ' (notional)' : ''), (sign || '') + M(num(x.amount))]);
  const SUM = {
    'sum.gross': () => T('Gross pay', {value:M(c.shown.gross), sub:'before anything comes off',
      say:['Everything you earned in this pay, before a cent is taken off. It is the total of the payments that are marked as taxable.'],
      how:lines(p.payments.filter(x=>x.taxable)).concat([['Gross pay', M(c.gross), 'sum']]).concat(lines(p.payments.filter(x=>!x.taxable)).map(r=>['Not included: ' + r[0] + ' (not taxable)', r[1]])),
      tip:c.pre > 0 ? 'Gross pay is not the same as the pay you are taxed on. Your ' + M(c.pre) + ' of pension and similar deductions come off before income tax is worked out, so your taxable pay for this period is ' + M(c.taxablePay) + '.'
        : 'Gross pay and taxable pay are the same when nothing is taken off before tax (a pension contribution, for example, would be).'}),
    'sum.deds': () => T('Total deductions', {value:M(c.shown.deds), sub:pctOf(c.totalDeds, c.gross) + ' of gross pay',
      say:['Everything that came off your gross pay: tax, USC and PRSI, plus anything you have chosen or agreed to, such as a pension contribution or health insurance.'],
      how:lines(p.deductions).concat([['Total deductions', M(c.totalDeds), 'sum']])}),
    'sum.nontax': () => T('Non-tax adjustments', {value:M(c.shown.nonTax), sub:'moves your pay without being taxed',
      say:['Some things change your take-home pay without being taxed. Money paid back to you for expenses is added here; notional pay (benefit in kind) is taken back out, because it counts as pay for tax purposes but you never receive it as cash.'],
      how:lines(p.payments.filter(x=>!x.taxable && x.kind !== 'bik'), '+').concat(lines(p.payments.filter(x=>x.kind === 'bik'), '-')).concat([['Total', M(c.nonTaxAdj), 'sum']])}),
    'sum.rounding': () => T('Rounding', {value:M(c.rounding),
      say:['Some employers round your take-home pay to a tidy amount, such as the nearest 5 cent. The tiny difference shows here, and may be settled on a later payslip. Most payslips show nothing, or zero, in this box.']}),
    'sum.net': () => T('Net pay (take-home pay)', {value:M(c.shown.net), sub:c.gross > 0 ? 'you keep ' + (c.net / c.gross * 100).toFixed(1) + ' cent in every euro of gross' : '',
      say:['Net pay is what you actually receive: your gross pay, less the deductions, plus or minus any non-tax adjustments. It is the amount that lands in your bank account.'],
      how:[['Gross pay', M(c.gross)], ['Less total deductions', '-' + M(c.totalDeds)], ['Plus non-tax adjustments', M(c.nonTaxAdj)], ['Rounding', M(c.rounding)], ['Net pay', M(c.net), 'sum']],
      tip:'If the amount in your bank is different from this, look at the pay method and date, or whether part of your pay goes to another account.'})
  };

  /* ---------- year to date ---------- */
  const cum = p.cum, taxableTD = num(cum.taxable) || (num(cum.gross) - num(cum.nonTaxDeds)), paidTD = num(cum.taxPaid) || c.ytd.paye;
  const CUM = {
    'cum.gross': () => T('Gross pay to date', {value:M(num(cum.gross)), sub:'since 1 January',
      say:['All your gross pay so far this tax year. It is a running total: each payslip adds that pay to it. If you started this job part-way through the year it only counts pay from here, plus anything carried over from your last job\'s P45.'],
      how:no > 1 && num(cum.gross) > 0 ? [['Average per pay so far', M(num(cum.gross) / no)], ['This pay', M(c.gross)], ['If every pay was the same, a year would be', M(num(cum.gross) / no * n)]] : []}),
    'cum.nonTaxDeds': () => T('Non-tax deductions to date', {value:M(num(cum.nonTaxDeds)), sub:'since 1 January',
      say:['The total this year of deductions that are not tax - such as pension contributions. Where they come off before tax, they are the reason your taxable pay is lower than your gross pay.']}),
    'cum.taxable': () => {
      const cut = num(cum.cutoff), diff = cut > 0 ? taxableTD - cut : 0;
      return T('Taxable pay to date', {value:M(taxableTD), sub:'the pay you have been taxed on this year',
        say:['The part of your pay that income tax is charged on, added up for the year so far. It is your gross pay to date, less deductions such as pension that come off before tax.',
          cut > 0 ? (diff > 0 ? 'Your taxable pay is **' + M(diff) + ' above** your cut-off to date, so that much of your pay has been taxed at 40% and pay above the cut-off continues to be.' : 'Your taxable pay is **' + M(-diff) + ' below** your cut-off to date, so all of it has been taxed at 20%.') : ''].filter(Boolean),
        how:[['Gross pay to date', M(num(cum.gross))], ['Less non-tax deductions to date', '-' + M(num(cum.nonTaxDeds))], ['Taxable pay to date', M(num(cum.gross) - num(cum.nonTaxDeds)), 'sum']].concat(cut > 0 ? [['Standard rate cut-off to date', M(cut)]] : []),
        tip:'USC and PRSI are not worked out on taxable pay - they use your full gross pay, because pension contributions do not reduce them.'});
    },
    'cum.credit': () => T('Tax credit to date', {value:M(num(cum.credit)), sub:'your credits used so far this year',
      say:['Your yearly tax credits are shared evenly across your pays, and this is the part that has built up so far. It is taken off your tax, not off your pay.'],
      how:num(p.tax.creditPeriod) > 0 ? [['Credit for one pay', M(num(p.tax.creditPeriod))], ['× pays so far', String(no)], ['= credit to date', M(num(p.tax.creditPeriod) * no), 'sum']] : []}),
    'cum.cutoff': () => T('Standard rate cut-off to date', {value:M(num(cum.cutoff)), sub:'pay taxed at 20% so far this year',
      say:['Your cut-off point is the slice of pay taxed at 20%. Pay above it is taxed at 40%. Like your credits it is shared across the year\'s pays, and this is the amount that has built up so far.'],
      how:no > 0 && num(cum.cutoff) > 0 ? [['Full-year cut-off (worked back)', M(num(cum.cutoff) / no * n)], ['Share of the year gone by', pr(no / n)], ['Cut-off to date', M(num(cum.cutoff)), 'sum']] : [],
      tip:'Your cut-off comes from Revenue (your Tax Credit Certificate). A single person in ' + c.year + ' has ' + M(b.srcopSingle) + '; a married couple with one income has ' + M(b.srcopMax) + '.'}),
    'cum.taxPaid': () => T('Tax paid to date', {value:M(paidTD), sub:'PAYE collected so far this year',
      say:['All the income tax taken from you so far this year. It should equal the "balance" on your PAYE line. USC and PRSI are not included - they are separate.'],
      how:c.gross > 0 && num(cum.gross) > 0 ? [['Tax paid to date', M(paidTD)], ['Gross pay to date', M(num(cum.gross))], ['As a share of gross pay', pctOf(paidTD, num(cum.gross))]] : []})
  };

  /* ---------- tax and PRSI settings ---------- */
  const TAXKEYS = {
    'tax.status': () => {
      const base = {cumulative:['Your tax is being worked out on the cumulative basis - the normal one.', 'Each pay is added to a running total for the year and the tax on the whole total is worked out, less what you have already paid. That way a quiet month, a bonus or a missed pay all even out across the year.'],
        week1:['Your tax is being worked out on the Week 1 / Month 1 basis.', 'Each pay is treated on its own, as if it were the first of the year: you get one pay\'s worth of credits and cut-off and nothing evens out later. Revenue tells payroll which basis to use, and you can ask Revenue (myAccount or by phone) about it.'],
        emergency:['You are on the emergency basis.', 'Payroll has no valid credits or cut-off from Revenue for you, so no credits are given and, after the first few pays, all your pay is taxed at 40% with USC at 8%. Get in touch with Revenue, or check myAccount, so your details reach your employer - the extra tax is refunded once they do.']}[p.tax.basis];
      return T('Tax and USC status', {value:p.tax.status || PS_BASES[p.tax.basis], sub:PS_BASES[p.tax.basis] + ' basis, USC: ' + PS_USC_MODES[p.tax.usc].toLowerCase(),
        say:[p.tax.status ? 'The code **' + p.tax.status + '** on the payslip is payroll\'s shorthand for how your tax and USC are being worked out - ask payroll what it stands for on yours. What matters is the basis behind it, which you chose on the Build tab:' : 'This tells you how your tax and USC are being worked out.', base[0], base[1]],
        how:[['Tax basis', PS_BASES[p.tax.basis]], ['USC rates', PS_USC_MODES[p.tax.usc]]],
        tip:'The basis and your credits come to payroll from Revenue in a notice called an RPN (Revenue Payroll Notification). If anything looks off, the fix starts with Revenue, not payroll.'});
    },
    'tax.emer': () => T('Emergency status period', {value:some(p.tax.emer),
      say:['On some payslips this box records when emergency tax started, or for how many pays you have been taxed that way. If it is empty you have not been on the emergency basis. If it has something in it, check on Revenue myAccount that your credits and cut-off have been loaded.',
        'Packages word this box differently, so if you are not sure what yours means, ask payroll.']}),
    'tax.creditPeriod': () => {
      const yr = num(p.tax.creditPeriod) * n, single = creditAmount('single', c.year), emp = creditAmount('employee', c.year);
      return T('Tax credit for this pay', {value:M(num(p.tax.creditPeriod)), sub:yr > 0 ? M(yr) + ' over a year' : '',
        say:['Your yearly tax credits shared out across your pays. A tax credit is a fixed amount taken straight off your tax bill (not off your pay), so a credit of 100 saves you exactly 100 of tax. Most employees have two: the Personal credit and the Employee (PAYE) credit.'],
        how:num(p.tax.creditPeriod) > 0 ? [['Credit for this pay', M(num(p.tax.creditPeriod))], ['× pays a year', String(n)], ['= credits over a full year', M(yr), 'sum'], ['A single employee in ' + c.year, M(single + emp) + ' (' + M(single) + ' + ' + M(emp) + ')']] : [],
        tip:'Your exact credits are on your Tax Credit Certificate (Revenue myAccount). Extra credits such as Home Carer, Single Person Child Carer or an age credit are added to the total.'});
    },
    'tax.cutoffPeriod': () => T('Cut-off for this pay', {value:M(num(p.tax.cutoffPeriod)),
      say:['Your yearly standard rate cut-off point shared out across your pays: the amount of this pay that is taxed at 20% on the Week 1 / Month 1 basis. Pay above it is taxed at 40%.']}),
    'tax.prsiClass': () => {
      const cls = String(p.tax.prsiClass || '').toUpperCase(), note = PS_CLASS_NOTES[cls.charAt(0)];
      return T('PRSI class', {value:some(cls),
        say:[note || 'Your PRSI class says which kind of worker you are, and so what rate you and your employer pay and which benefits you are covered for. Ask payroll if you do not recognise yours.',
          cls.charAt(0) === 'A' || !cls ? 'As a class A employee you pay ' + pr(R.ee) + ' of your pay in PRSI on this date and your employer pays ' + pr(R.erHigh) + '.' : ''].filter(Boolean),
        tip:'If your class is not the one you expect (a second job, a change of job, turning 66), ask payroll to check it - the wrong class can affect your benefits.'});
    },
    'tax.insWeeks': () => T('Insurable weeks', {value:p.tax.insWeeks ? String(num(p.tax.insWeeks)) : '-', sub:'about ' + Math.round(52 * no / n) + ' weeks have gone by',
      say:['The number of weeks this year that count towards your social insurance record. Every week you are paid in this job counts, so a full year is 52. A long enough record is what qualifies you for the State pension and other benefits, so gaps matter.'],
      how:num(p.tax.insWeeks) > 0 ? [['Weeks counted so far', String(num(p.tax.insWeeks))], ['Weeks of the year gone by (about)', String(Math.round(52 * no / n))]] : []})
  };

  /* ---------- on top: the employer's side ---------- */
  const ER = {
    'er.prsi': () => T('Employer PRSI this pay', {value:M(num(p.er.prsiPeriod)), sub:c.gross > 0 && num(p.er.prsiPeriod) > 0 ? pr(num(p.er.prsiPeriod) / c.gross) + ' of your pay' : '',
      say:['Your employer pays PRSI on top of your pay, as a cost of employing you. It is not taken from you and does not reduce your take-home pay - it is shown so you can see what you cost.'],
      how:[['Pay it is charged on', M(c.gross)], ['Standard rate on ' + when(c.date), pr(R.erHigh)], ['Lower rate for low weekly pay' + lowNote, pr(R.erLow)]],
      tip:'Employer PRSI goes up in small steps each 1 October. The standard rate was ' + pr(R.erHigh) + ' on this payment date.'}),
    'er.prsiYtd': () => T('Employer PRSI to date', {value:M(num(p.er.prsiYtd)), sub:'since 1 January',
      say:['The running total of employer PRSI this year. Like the amount for this pay, it is paid by your employer on top of your wages.']}),
    'er.bikYtd': () => T('Benefit in kind to date', {value:M(num(p.er.bikYtd)), sub:'since 1 January',
      say:['The taxable value of perks given to you in kind this year, such as a company car or health insurance paid by your employer. You are not paid it in cash, but it counts as pay for tax, USC and PRSI, so payroll keeps a running total to report to Revenue.'],
      tip:'Zero is normal. It only applies if your employer provides a perk like this.'})
  };

  if(TOP[key]) return TOP[key]();
  if(SUM[key]) return SUM[key]();
  if(CUM[key]) return CUM[key]();
  if(TAXKEYS[key]) return TAXKEYS[key]();
  if(ER[key]) return ER[key]();
  if(key.indexOf('pay:') === 0) return psExplainPayment(p, c, mine, key, T);
  if(key.indexOf('ded:') === 0) return psExplainDeduction(p, c, mine, key, T);
  return null;
}

function psExplainPayment(p, c, mine, key, T){
  const x = p.payments.find(r=>'pay:' + r.id === key);
  if(!x) return null;
  const M = fmt, pr = r => String(+(r * 100).toFixed(2)) + '%', a = num(x.amount), k = PS_PAY_KINDS[x.kind];
  const say = {
    basic:['Your normal pay for this period.' + (a > 0 ? ' If it is the same every time, it is a yearly salary of ' + M(a * c.n) + ' before tax.' : '')],
    overtime:['Extra hours paid on top of your normal pay. It is taxed like the rest of your pay, but because it sits on top, it can be the part that falls above your cut-off and is taxed at 40%.'],
    bonus:['A one-off extra payment. It is taxed like normal pay, with PRSI and USC as well, and because it sits on top of your normal pay it may be taxed at 40%. That is why a bonus usually feels smaller than it looked.'],
    commission:['Pay based on what you sold or earned for the company. It is taxed like normal pay, with PRSI and USC as well.'],
    allowance:['A regular extra amount paid with your wages, such as a shift, on-call or travel allowance. Because it is marked taxable it is treated as pay, with tax, USC and PRSI on it. Genuine expenses paid back to you are different - they are marked as not taxable.'],
    bik:['Notional pay: the taxable value of a perk you get in kind, such as a company car or health insurance paid by your employer. You do not receive it as cash. Payroll adds its value to your pay so that tax, USC and PRSI are charged on it, then takes it back out when working out your net pay (you will see it under non-tax adjustments).'],
    expense:['Money paid back to you for costs of doing your job, such as mileage or subsistence. Revenue lets employers pay genuine, vouched expenses (or those at the approved rates) tax-free, so there is no tax, USC or PRSI on it and it is not part of your gross pay.'],
    other:['Another payment in your pay. Whether it is taxed depends on the Y/N column: Y means it counts as pay, N means it does not.']
  }[x.kind];
  const how = [];
  if(a > 0 && x.hours > 0) how.push(['Hours', String(x.hours)], ['Pay per hour', M(a / x.hours)]);
  if(x.kind === 'basic' && a > 0) how.push(['This pay', M(a)], ['× pays a year', String(c.n)], ['= a year, if the same every pay', M(a * c.n), 'sum']);
  how.push(['Taxable (the Y/N column)', x.kind === 'bik' ? 'Yes - notional' : x.taxable ? 'Yes - tax, USC and PRSI apply' : 'No - none of them apply']);
  if(x.taxable && c.gross > 0 && p.payments.filter(r=>r.taxable).length > 1) how.push(['Share of your gross pay', pr(a / c.gross)]);
  const tip = {bonus:'Close to half of a bonus can go in tax, USC and PRSI if it falls above your cut-off (40% tax, 3% or 8% USC and about 4% PRSI).',
    expense:'Only genuine, vouched expenses or those at Revenue\'s approved rates can be paid tax-free. Anything else would have been taxed like pay.',
    bik:'This is why a company car or employer-paid health insurance can raise your tax without a cent more reaching your bank account.'}[x.kind] || '';
  return T(x.desc || k.label, {value:M(a), sub:k.label + (x.kind === 'bik' ? ' - counted as pay, not paid to you' : x.taxable ? ' - taxable' : ' - not taxable'), say, how, tip});
}

function psExplainDeduction(p, c, mine, key, T){
  const x = p.deductions.find(r=>'ded:' + r.id === key);
  if(!x) return null;
  const M = fmt, pr = r => String(+(r * 100).toFixed(2)) + '%', a = num(x.amount), y = num(x.ytd), n = c.n, no = c.no;
  const b = presetFor(c.year), R = psPrsiRates(c.date);
  const out = {value:M(a), sub:y > 0 ? M(y) + ' so far this year' : '', say:[], how:[], tip:''};
  const timing = x.pre ? 'It comes off **before** income tax is worked out, so it lowers your taxable pay.' : 'It comes off **after** tax has been worked out, so it does not change your tax.';
  /* what the T/N column on the Sage layout is saying about this line */
  const code = x.pre ? '**G** in the T/N column most likely means **Gross**. Sage lets a deduction be taken from your gross pay (before income tax) or from your nett pay (after tax, PRSI and USC, shown as **N**), and a pension is normally set up as the Gross kind. Sage does not publish what the column shows on the printed payslip, so if you are not sure, ask payroll.'
    : psDedCode(x) === 'N' ? 'An **N** in the T/N column most likely means **Nett**: taken from your pay after tax, PRSI and USC, so it does not change them. A **G** would mean it came off your gross pay instead. Sage does not publish what the column shows on the printed payslip, so ask payroll if you are not sure.' : '';

  if(x.kind === 'paye'){
    const taxableTD = num(p.cum.taxable) || (num(p.cum.gross) - num(p.cum.nonTaxDeds)), cut = num(p.cum.cutoff), cred = num(p.cum.credit);
    out.say = ['PAYE stands for Pay As You Earn. It is your income tax, taken from each pay by your employer and sent to Revenue for you.',
      'Tax is **20%** on pay up to your cut-off point and **40%** on pay above it. Your tax credits are then taken off the tax - they come off the bill, not off your pay.',
      p.tax.basis === 'cumulative' ? 'Payroll does not work each pay out on its own. It totals the whole year so far, works out the tax on that, and takes off what you have already paid, so a bonus or a quiet month evens out over the year.' : ''].filter(Boolean);
    if(p.tax.basis === 'cumulative' && taxableTD > 0 && (cut > 0 || cred > 0)){
      const low = Math.min(taxableTD, cut), high = Math.max(taxableTD - cut, 0), before = low * b.lowRate + high * b.highRate, due = Math.max(before - cred, 0);
      const paid = num(p.cum.taxPaid) || y;
      out.how = [['Taxable pay so far this year', M(taxableTD)], ['The first ' + M(low) + ' at 20%', M(low * b.lowRate)], ['The other ' + M(high) + ' at 40%', M(high * b.highRate)],
        ['Tax before credits', M(before), 'sum'], ['Less tax credits so far', '-' + M(cred)], ['Tax due so far this year', M(due), 'sum'],
        ['Paid in earlier pays', M(paid - a)], ['So the tax for this pay', M(due - (paid - a)), 'sum']];
    } else if(p.tax.basis === 'week1' && (num(p.tax.cutoffPeriod) > 0 || num(p.tax.creditPeriod) > 0)){
      const cut = num(p.tax.cutoffPeriod), low = Math.min(c.taxablePay, cut), high = Math.max(c.taxablePay - cut, 0), before = low * b.lowRate + high * b.highRate;
      out.how = [['Taxable pay for this pay', M(c.taxablePay)], ['The first ' + M(low) + ' at 20%', M(low * b.lowRate)], ['The other ' + M(high) + ' at 40%', M(high * b.highRate)],
        ['Tax before credits', M(before), 'sum'], ['Less credit for this pay', '-' + M(num(p.tax.creditPeriod))], ['PAYE for this pay', M(Math.max(before - num(p.tax.creditPeriod), 0)), 'sum']];
    } else out.how = [['Taxable pay for this pay', M(c.taxablePay)], ['Rates', '20% up to your cut-off, then 40%']];
    out.tip = 'If your PAYE looks too high, the usual cause is credits that are missing from your Revenue record. Check your Tax Credit Certificate in Revenue myAccount.';
  } else if(x.kind === 'prsi'){
    const want = psPrsiExpected(c.gross, n, R);
    out.say = ['PRSI is Pay Related Social Insurance. Your contributions build your right to social welfare benefits such as the State pension, maternity benefit and Jobseeker\'s Benefit.',
      'It is charged on all your pay, including bonuses and benefit in kind. Your pension contributions do not reduce it, and tax credits do not either - only people on very low pay get a small PRSI credit.'];
    out.how = [['Pay PRSI is charged on', M(c.gross)], ['Rate on ' + c.date, pr(R.ee)], ['PRSI for this pay', M(want), 'sum']];
    if(psInCreditZone(c.gross, n, R)) out.how.splice(2, 0, ['Low-earner credit taken off', '-' + M(c.gross * R.ee - want)]);
    out.tip = 'The rate rises a little each 1 October (it is ' + pr(R.ee) + ' on this payment date). Your employer pays PRSI as well, on top of your wages - see the employer boxes.';
  } else if(x.kind === 'usc'){
    const mode = p.tax.basis === 'emergency' ? 'emergency' : p.tax.usc;
    out.say = ['USC is the Universal Social Charge. It is charged on your gross pay in bands: a very small percentage on the first slice, then more on each slice above it.',
      'Unlike income tax, your tax credits and cut-off have no effect on it, and your pension contributions do not reduce it. It is not charged at all if your income for the year is 13,000 or less.'];
    if(mode === 'emergency') out.how = [['Pay', M(c.gross)], ['Emergency USC rate', '8%'], ['USC', M(c.gross * 0.08), 'sum']];
    else {
      const bands = psUscBands(mode, b); let prev = 0, tot = 0; const rows = [];
      if(c.gross * n <= b.uscExempt && mode !== 'exempt') rows.push(['Yearly pay of ' + M(c.gross * n) + ' is under the ' + M(b.uscExempt) + ' exemption', M(0)]);
      else bands.forEach(band=>{
        const lim = band.to >= 1e11 ? Infinity : band.to / n, slice = Math.max(Math.min(c.gross, lim) - prev, 0);
        if(slice > 0 && band.rate > 0){ rows.push([M(slice) + ' at ' + pr(band.rate), M(slice * band.rate)]); tot += slice * band.rate; }
        prev = lim;
      });
      out.how = rows.concat([['USC for this pay', M(tot), 'sum']]);
    }
    out.tip = 'If you hold a full medical card, or you are 70 or over and your income is 60,000 or less, only the reduced USC rates (0.5% and 2%) apply. Tell payroll so they are used.';
  } else if(x.kind === 'lpt'){
    out.say = ['Local Property Tax is a yearly tax on the value of your home. If you chose to pay it through your pay, Revenue tells payroll how much to take, spread across the year\'s pays.'];
    out.how = [['This pay', M(a)], ['× pays a year', String(n)], ['= LPT over a full year', M(a * n), 'sum']];
    out.tip = 'You can change how you pay LPT, or stop the payroll deduction, with Revenue - not with your employer.';
  } else if(x.kind === 'pension'){
    out.say = ['Your own contribution to a workplace pension. ' + timing, code, 'Because it comes off before tax, you get income tax relief at your highest rate. It does **not** reduce USC or PRSI, which are still worked out on your full gross pay.'].filter(Boolean);
    out.how = c.gross > 0 ? [['Your contribution', M(a)], ['As a share of gross pay', pr(a / c.gross)], ['Taxable pay falls from', M(c.gross) + ' to ' + M(c.taxablePay)]] : [];
    out.tip = 'Because of the tax relief, putting 100 into a pension costs you only about 80 if you pay tax at 20%, or 60 if some of it would be taxed at 40%.';
  } else if(x.kind === 'avc'){
    out.say = ['An Additional Voluntary Contribution is extra money you choose to put into a pension through your pay. ' + timing, code, 'You get the same tax relief as for a normal pension contribution, but not on USC or PRSI.'].filter(Boolean);
    out.how = c.gross > 0 ? [['Your AVC', M(a)], ['As a share of gross pay', pr(a / c.gross)]] : [];
    out.tip = 'Tax relief is limited by your age, from 15% of your earnings under 30 up to 40% from 60, and applies to earnings up to 115,000.';
  } else if(x.kind === 'health'){
    out.say = ['Your health insurance premium, taken from your pay. ' + timing, 'Tax relief (20%, on up to 1,000 for an adult and 500 for a child) is normally given by the insurer, which charges you a lower premium, so you do not claim it again.', code].filter(Boolean);
    out.tip = 'If your employer pays part of your premium, that part is a benefit in kind and shows on the payments side instead.';
  } else if(x.kind === 'union'){
    out.say = ['A subscription to your trade union, taken from your pay. ' + timing, code].filter(Boolean);
  } else {
    out.say = ['A deduction your employer makes because you agreed to it or the law says so - a savings or credit union scheme, a uniform, parking, a loan repayment. ' + timing, code].filter(Boolean);
  }
  out.say.push('The **balance** is the total so far this year (' + M(y) + '). It goes up by this amount with each pay.');
  if(!(y > 0)) out.say.pop();
  return T(x.desc || PS_DED_KINDS[x.kind].label, out);
}

/* The order to read the boxes in, grouped: [{title, keys:[...]}]. Optional text boxes that were left empty are skipped. */
function psOrder(p){
  const c = psCalc(p), has = v => String(v || '').trim() !== '';
  const groups = [
    {title:'Who and when', keys:['employer.name'].concat(has(p.employer.regNo) ? ['employer.regNo'] : [], ['employee.name'], has(p.employee.number) ? ['employee.number'] : [],
      has(p.employee.dept) ? ['employee.dept'] : [], has(p.employee.cost) ? ['employee.cost'] : [], ['employee.ppsn', 'period.freq', 'period.number', 'period.date'])},
    {title:'What you were paid', keys:p.payments.map(x=>'pay:' + x.id)},
    {title:'What came off', keys:p.deductions.map(x=>'ded:' + x.id)},
    {title:'Your pay at a glance', keys:['sum.gross', 'sum.deds'].concat(c.nonTaxAdj !== 0 || c.shown.nonTax !== 0 ? ['sum.nontax'] : [], c.rounding !== 0 ? ['sum.rounding'] : [], ['sum.net', 'period.method'])},
    {title:'Your year so far', keys:['cum.gross', 'cum.nonTaxDeds', 'cum.taxable', 'cum.credit', 'cum.cutoff', 'cum.taxPaid']},
    {title:'The tax settings behind it', keys:['tax.status'].concat(has(p.tax.emer) ? ['tax.emer'] : [], ['tax.creditPeriod'], num(p.tax.cutoffPeriod) > 0 && p.layout !== 'sage' ? ['tax.cutoffPeriod'] : [], ['tax.prsiClass', 'tax.insWeeks'])},
    {title:'What your employer pays on top', keys:['er.prsi', 'er.prsiYtd', 'er.bikYtd']}
  ];
  return groups.filter(g=>g.keys.length);
}
