/* ---------- cost of owning: what a big spend really costs, and saves, over the years ----------
   A price tag is only the start. A car also needs insurance, tax, servicing and fuel; it may save a bus fare and an hour a
   day; it loses value. A better-insulated house costs a lot now and saves on bills for years, and may even earn a lower
   mortgage rate. The Cost of owning page lets someone list every one of those things for a purchase they are thinking
   about and see the net result: year by year, in total, and when (if ever) it pays for itself. This file is the data and
   the maths behind it - plain objects and sums, no page code - so the tests can run it.

   Where it lives: DB.tco = {v:1, plans:[...], current:'id of the plan on screen'}. Like payslips it is not part of a tax
   year (a plan looks years ahead and a "what-if copy" of a year should not duplicate it) and it travels with every backup.

   Everything is a difference from "do nothing": a cost is money out, a saving is money kept or earned, and the answer is
   the two added up. Money is counted in the year it moves: year 0 is today (the price, a grant, selling the old one),
   year 1 is the next twelve months, and so on to the end of the plan. Prices rise by a yearly percentage (a line can have
   its own, otherwise the plan's general one). It is an estimate built from the figures typed in, not a forecast. */

const TCO_KINDS = {
  once:    {name:'One-off cost or saving', blurb:'Paid or received once: the price, a grant, selling the old one, a repair in year 5.'},
  recur:   {name:'Regular cost or saving', blurb:'Comes or goes on a schedule: insurance, servicing, bus fares you no longer pay.'},
  drive:   {name:'Driving costs', blurb:'Fuel or electricity, worked out from the kilometres you drive.'},
  time:    {name:'Time saved', blurb:'Hours you get back each week, with a value put on an hour.'},
  loan:    {name:'A loan for it', blurb:'Borrowing some of the money. The interest is the extra cost.'},
  value:   {name:'Worth at the end', blurb:'What it could be sold for, or adds to your home, when the plan ends.'},
  mortgage:{name:'Mortgage rate change', blurb:'A lower (or higher) mortgage rate, for example from a better BER.'}
};
const TCO_PER = {week:'a week', month:'a month', year:'a year', every:'every few years'};
const TCO_TEMPLATES = {
  car:  {icon:'🚗', name:'Buying a car', plan:'Car', blurb:'The price, insurance, tax, fuel and upkeep, against the bus fares and time it saves and what it sells for later.'},
  home: {icon:'🏠', name:'Upgrading your home', plan:'Home upgrade', blurb:'Insulation, a heat pump, solar panels or windows: the outlay and grants, against bill savings, a better BER and a lower mortgage rate.'},
  buy:  {icon:'🛒', name:'Another big purchase', plan:'Big purchase', blurb:'Anything with a price, running costs and perhaps something it saves you.'},
  blank:{icon:'✏️', name:'Start from nothing', plan:'New plan', blurb:'An empty plan: add just the lines you need.'}
};
/* the one-line help under a line that came from a template, by the line's key */
const TCO_HINTS = {
  'car.price':'The full price, even if you borrow some of it. The interest on a loan is added separately below.',
  'car.grant':'Grants and discounts that bring the price down, such as an electric vehicle grant. Check the current amounts before you rely on them.',
  'car.trade':'What you get for selling or trading in a car you are replacing. Delete this line if you are not replacing one.',
  'car.loan':'If you borrow some of the money: how much, the interest rate and the years to repay. Only the interest counts as an extra cost, because the price is already counted above.',
  'car.insurance':'Your insurance quote. If you are replacing a car, enter the difference only if you enter the old car\'s costs as savings below; otherwise enter the full cost.',
  'car.tax':'Motor tax depends on the car, mainly its emissions.',
  'car.service':'Servicing and the NCT, averaged out over a year.',
  'car.tyres':'Tyres, brakes and the bigger repairs that come every few years.',
  'car.fuel':'Fuel or electricity: kilometres a year, how much the car uses per 100 km, and the price per litre or kWh.',
  'car.park':'Parking, tolls and anything else only the car costs.',
  'car.bus':'What you spend now that you would no longer pay: bus, train, taxis, a Leap card, or the running costs of a car you are getting rid of.',
  'car.oldfuel':'The fuel for a car you are replacing. It counts as a saving because you stop paying it.',
  'car.time':'Hours the car saves you each week. Put a value on an hour; a cautious figure is about half your take-home pay per hour. Leave it at 0 to keep time out of the sums.',
  'car.resale':'What you could sell it for at the end. Start with the price and how much value it loses each year; cars lose the most in the first few years.',
  'car.old':'If you are selling an old car, what it would still be worth at the end if you kept it. You give that up, so it counts as a cost.',
  'home.work':'The full cost of the work, including VAT and any assessment fees.',
  'home.grant':'Grants reduce the outlay, such as SEAI home energy grants. Check what is available, and the conditions, before you commit.',
  'home.loan':'If you borrow for the work: how much, the interest rate and the years to repay.',
  'home.bills':'How much less you expect to spend each year on heating, electricity or fuel. Last year\'s bills are the best starting point; a BER assessor\'s report gives an estimate. Energy prices can rise faster than the general figure, so set this line\'s yearly change if you want.',
  'home.running':'Anything new that costs you more to run, such as the extra electricity a heat pump uses.',
  'home.upkeep':'Servicing, filters and maintenance the upgrade needs.',
  'home.replace':'A part that wears out and has to be replaced every so many years.',
  'home.mortgage':'Some lenders offer a lower rate on a better-rated (higher BER) home. Enter your balance, the years left, today\'s rate and the rate you would get.',
  'home.value':'Better-rated homes can sell for more, but be cautious: enter a figure you are confident of, or leave it at 0.',
  'buy.price':'The full price, even if you borrow some of it.',
  'buy.loan':'If you borrow some of the money: how much, the interest rate and the years to repay.',
  'buy.running':'What it costs to run: power, fuel, subscriptions, consumables.',
  'buy.upkeep':'Servicing, repairs and insurance.',
  'buy.saves':'What it saves you or earns you, month by month, compared with doing nothing.',
  'buy.resale':'What you could sell it for at the end.'
};

function tcoNewLine(kind, o){
  const k = TCO_KINDS[kind] ? kind : 'recur';
  return Object.assign({id:uid(), key:'', kind:k, label:'', dir:(k === 'time' || k === 'value' || k === 'mortgage') ? 'save' : 'cost',
    amount:0, at:0, per:'year', every:3, from:1, to:'', growth:'',
    km:0, use:0, price:0, hours:0, weeks:46, worth:0, borrow:0, apr:0, years:5, base:0, change:0, balance:0, rateNow:0, rateNew:0}, o || {});
}
function tcoLines(template){
  const L = (kind, key, label, o) => tcoNewLine(kind, Object.assign({key, label}, o || {}));
  if(template === 'car') return [
    L('once', 'car.price', 'Price of the car'),
    L('once', 'car.grant', 'Grants or discounts', {dir:'save'}),
    L('once', 'car.trade', 'Selling or trading in the old car', {dir:'save'}),
    L('loan', 'car.loan', 'Loan for the car', {years:4}),
    L('recur', 'car.insurance', 'Insurance'),
    L('recur', 'car.tax', 'Motor tax'),
    L('recur', 'car.service', 'Servicing and NCT'),
    L('recur', 'car.tyres', 'Tyres and bigger repairs', {per:'every', every:3}),
    L('drive', 'car.fuel', 'Fuel or electricity'),
    L('recur', 'car.park', 'Parking and tolls', {per:'month'}),
    L('recur', 'car.bus', 'Bus, train or taxi fares you no longer pay', {dir:'save', per:'month'}),
    L('drive', 'car.oldfuel', 'Fuel for the car you are replacing', {dir:'save'}),
    L('time', 'car.time', 'Time saved'),
    L('value', 'car.resale', 'What it could be sold for at the end', {change:-12}),
    L('value', 'car.old', 'What the old car would still have been worth', {dir:'cost', change:-12})
  ];
  if(template === 'home') return [
    L('once', 'home.work', 'Cost of the work'),
    L('once', 'home.grant', 'Grants', {dir:'save'}),
    L('loan', 'home.loan', 'Loan for the work', {years:7}),
    L('recur', 'home.bills', 'Less spent on heating and electricity', {dir:'save'}),
    L('recur', 'home.running', 'Extra running costs'),
    L('recur', 'home.upkeep', 'Servicing and upkeep'),
    L('recur', 'home.replace', 'Replacing a part', {per:'every', every:12}),
    L('mortgage', 'home.mortgage', 'Lower mortgage rate (better BER)', {years:20}),
    L('value', 'home.value', 'Value added to the home', {change:0})
  ];
  if(template === 'buy') return [
    L('once', 'buy.price', 'Price'),
    L('loan', 'buy.loan', 'Loan', {years:3}),
    L('recur', 'buy.running', 'Running costs', {per:'month'}),
    L('recur', 'buy.upkeep', 'Servicing and repairs'),
    L('recur', 'buy.saves', 'What it saves you', {dir:'save', per:'month'}),
    L('value', 'buy.resale', 'What it could be sold for at the end', {change:-10})
  ];
  return [];
}
function tcoBlank(template){
  const t = TCO_TEMPLATES[template] ? template : 'blank';
  return {id:uid(), name:TCO_TEMPLATES[t].plan, template:t, horizon:8, inflation:2, discount:0, notes:'', lines:tcoLines(t)};
}

/* Tidy anything that claims to be a plan - one from a restored backup, say. Missing fields are filled in, and nothing
   typed in by hand can send a sum to infinity. */
function tcoNormaliseLine(x){
  const b = tcoNewLine(x && TCO_KINDS[x.kind] ? x.kind : 'recur');
  if(!x || typeof x !== 'object') return b;
  const n = (v, lo, hi) => clamp(num(v), lo, hi);
  const opt = (v, lo, hi) => (blankish(v) || String(v).trim() === '') ? '' : clamp(num(v), lo, hi);
  const str = (v, d, max) => (v == null ? d : String(v)).slice(0, max);
  return {id:str(x.id, b.id, 24) || b.id, key:str(x.key, '', 20), kind:b.kind, label:str(x.label, '', 70), dir:x.dir === 'save' ? 'save' : (x.dir === 'cost' ? 'cost' : b.dir),
    amount:n(x.amount, -1e9, 1e9), at:Math.round(n(x.at, 0, 60)), per:TCO_PER[x.per] ? x.per : 'year', every:Math.max(1, Math.round(n(x.every, 1, 60))) || 3,
    from:Math.max(1, Math.round(n(x.from, 1, 60))) || 1, to:opt(x.to, 0, 60) === '' ? '' : Math.round(opt(x.to, 0, 60)), growth:opt(x.growth, -50, 100),
    km:n(x.km, 0, 1e6), use:n(x.use, 0, 1e4), price:n(x.price, 0, 1e6), hours:n(x.hours, -168, 168), weeks:n(x.weeks, 0, 52), worth:n(x.worth, 0, 1e5),
    borrow:n(x.borrow, 0, 1e9), apr:n(x.apr, 0, 100), years:n(x.years, 0, 60), base:n(x.base, 0, 1e9), change:n(x.change, -100, 1000),
    balance:n(x.balance, 0, 1e9), rateNow:n(x.rateNow, 0, 100), rateNew:n(x.rateNew, 0, 100)};
}
function tcoNormalise(p){
  const b = tcoBlank('blank');
  if(!p || typeof p !== 'object') return b;
  const str = (v, d, max) => (v == null ? d : String(v)).slice(0, max);
  const lines = (Array.isArray(p.lines) ? p.lines : []).filter(x=>x && typeof x === 'object').slice(0, 60).map(tcoNormaliseLine);
  const seen = new Set();
  lines.forEach(l=>{ while(seen.has(l.id)) l.id = uid(); seen.add(l.id); });
  return {id:str(p.id, b.id, 24) || b.id, name:str(p.name, 'Plan', 60), template:TCO_TEMPLATES[p.template] ? p.template : 'blank',
    horizon:Math.round(num(p.horizon)) >= 1 ? clamp(Math.round(num(p.horizon)), 1, 40) : 8,
    inflation:blankish(p.inflation) ? 2 : clamp(num(p.inflation), -10, 30), discount:blankish(p.discount) ? 0 : clamp(num(p.discount), 0, 30),
    notes:str(p.notes, '', 500), lines};
}
/* The whole store, as it sits in DB.tco. */
function tcoStore(s){
  const o = (s && typeof s === 'object') ? s : {};
  const plans = (Array.isArray(o.plans) ? o.plans : []).filter(x=>x && typeof x === 'object').slice(0, 30).map(tcoNormalise);
  const seen = new Set();
  plans.forEach(x=>{ while(seen.has(x.id)) x.id = uid(); seen.add(x.id); });
  return {v:1, plans, current:plans.some(x=>x.id === o.current) ? o.current : (plans[0] ? plans[0].id : '')};
}

/* ---------------- the sums ---------------- */

/* A loan paid off monthly: the repayment, and the interest in each year of it (index 1 is the first twelve months). */
function tcoLoan(borrow, apr, years){
  const P = num(borrow), n = Math.round(num(years) * 12), r = num(apr) / 100 / 12, byYear = [0];
  if(!(P > 0) || n <= 0) return {payment:0, byYear, total:0, months:0};
  const pay = r > 0 ? P * r / (1 - Math.pow(1 + r, -n)) : P / n;
  let bal = P;
  for(let m = 1; m <= n; m++){
    const i = bal * r, y = Math.ceil(m / 12);
    byYear[y] = (byYear[y] || 0) + i; bal -= pay - i;
  }
  for(let y = 1; y < byYear.length; y++) byYear[y] = byYear[y] || 0;
  return {payment:pay, byYear, total:byYear.reduce((s, v)=> s + v, 0), months:n};
}
/* A mortgage at one rate against another over what is left of it: what the lower rate saves each month. Both rates have
   to be filled in, otherwise there is nothing to compare. */
function tcoMortgage(l){
  const bal = num(l.balance), months = Math.round(num(l.years) * 12), a = num(l.rateNow), b = num(l.rateNew);
  const ready = bal > 0 && months > 0 && a > 0 && b > 0;
  const before = ready ? mortPayment(bal, a, months, '12') : 0, after = ready ? mortPayment(bal, b, months, '12') : 0;
  return {ready, before, after, monthly:before - after, yearly:(before - after) * 12};
}
/* what a repeating line comes to in a year, at today's prices */
function tcoYearly(l){
  if(l.kind === 'drive') return num(l.km) * num(l.use) / 100 * num(l.price);
  if(l.kind === 'time') return num(l.hours) * num(l.weeks) * num(l.worth);
  return num(l.amount) * (l.per === 'week' ? 52 : l.per === 'month' ? 12 : 1);
}
const tcoGrowth = (l, plan) => blankish(l.growth) ? num(plan.inflation) : num(l.growth);
const tcoLabel = l => (l.label && l.label.trim()) || TCO_KINDS[l.kind].name;
const tcoSign = l => l.dir === 'save' ? 1 : -1;

/* Money in (+) or out (-) for each year 0..horizon. Year 0 is today; a line that repeats starts in year 1. */
function tcoFlows(l, plan){
  const H = plan.horizon, f = new Array(H + 1).fill(0), s = tcoSign(l);
  const grow = 1 + tcoGrowth(l, plan) / 100, price = t => Math.pow(grow, Math.max(0, t - 1));
  const from = clamp(Math.round(num(l.from)) || 1, 1, H), to = blankish(l.to) ? H : clamp(Math.round(num(l.to)), 0, H);
  if(l.kind === 'once'){
    const t = Math.round(num(l.at));
    if(t >= 0 && t <= H) f[t] = s * num(l.amount) * price(t);
  } else if(l.kind === 'recur' && l.per === 'every'){
    const n = Math.max(1, Math.round(num(l.every)));
    for(let t = n; t <= H; t += n) if(t >= from && t <= to) f[t] = s * num(l.amount) * price(t);
  } else if(l.kind === 'recur' || l.kind === 'drive' || l.kind === 'time'){
    const y = tcoYearly(l);
    for(let t = from; t <= to; t++) f[t] = s * y * price(t);
  } else if(l.kind === 'loan'){
    const ln = tcoLoan(l.borrow, l.apr, l.years);
    for(let t = 1; t <= H; t++) f[t] = -(ln.byYear[t] || 0);
  } else if(l.kind === 'value'){
    f[H] = s * num(l.base) * Math.pow(1 + num(l.change) / 100, H);
  } else if(l.kind === 'mortgage'){
    const m = tcoMortgage(l), last = Math.min(H, Math.ceil(num(l.years)));
    for(let t = 1; t <= last; t++) f[t] = m.yearly;
  }
  return f;
}

/* When the running total (cum, one figure per year from year 0) climbs out of the red for good: 'now' if it never was in it,
   'never' if it is still in it at the end, otherwise how many years in, worked out within the year. */
function tcoBreakEven(cum){
  let last = -1;
  cum.forEach((c, i)=>{ if(c < -0.005) last = i; });
  if(last === -1) return {status:'now', years:0};
  if(last === cum.length - 1) return {status:'never', years:null};
  const a = cum[last], b = cum[last + 1];
  return {status:'at', years:last + (-a) / (b - a)};
}
/* "about 6 years and 3 months" */
function tcoWhen(years){
  const m = Math.round(years * 12), y = Math.floor(m / 12), mo = m % 12;
  if(m <= 0) return 'straight away';
  const parts = [];
  if(y) parts.push(y + ' year' + (y === 1 ? '' : 's'));
  if(mo) parts.push(mo + ' month' + (mo === 1 ? '' : 's'));
  return 'about ' + parts.join(' and ');
}

/* The whole result for a plan. o.save and o.cost scale everything gained or spent, to ask "what if I am a bit off?". */
function tcoCalc(plan, o){
  o = o || {};
  const H = plan.horizon, sF = o.save == null ? 1 : o.save, cF = o.cost == null ? 1 : o.cost, d = num(plan.discount) / 100;
  const cost = new Array(H + 1).fill(0), save = cost.slice(), lines = [], warns = [];
  plan.lines.forEach(l=>{
    const flows = tcoFlows(l, plan).map(v => v > 0 ? v * sF : v * cF);
    flows.forEach((v, t)=>{ if(v > 0) save[t] += v; else cost[t] -= v; });
    lines.push({id:l.id, kind:l.kind, label:tcoLabel(l), flows, total:flows.reduce((s, v)=> s + v, 0)});
    if(l.kind === 'loan' && num(l.borrow) > 0 && num(l.years) > H) warns.push('The loan "' + tcoLabel(l) + '" runs for ' + num(l.years) + ' years but your plan ends after ' + H + ', so only the first ' + H + ' years of its interest are counted.');
    if(l.kind === 'once' && num(l.amount) && Math.round(num(l.at)) > H) warns.push('"' + tcoLabel(l) + '" happens after your plan ends, so it is not counted.');
    if(l.kind === 'recur' && l.per === 'every' && num(l.amount) && Math.max(1, Math.round(num(l.every))) > H) warns.push('"' + tcoLabel(l) + '" repeats every ' + Math.max(1, Math.round(num(l.every))) + ' years, which is longer than your plan, so it is not counted.');
    if(l.kind === 'mortgage' && (num(l.balance) || num(l.rateNow) || num(l.rateNew)) && !tcoMortgage(l).ready) warns.push('"' + tcoLabel(l) + '" needs the balance, the years left and both rates before it can be worked out.');
  });
  const net = cost.map((c, t)=> save[t] - c), cum = [];
  net.forEach((v, t)=>{ cum[t] = (t ? cum[t - 1] : 0) + v; });
  const sum = a => a.reduce((s, v)=> s + v, 0);
  const total = {cost:sum(cost), save:sum(save), net:cum[H], upfront:cost[0] - save[0], pv:sum(net.map((v, t)=> v / Math.pow(1 + d, t)))};
  total.perYear = total.net / H; total.perMonth = total.net / H / 12;
  return {H, cost, save, net, cum, lines, warns, total, breakEven:tcoBreakEven(cum), empty:!lines.some(l=> Math.abs(l.total) > 0.005)};
}
/* the answer under a few "what if I am a bit off" cases */
function tcoSens(plan){
  return [['As you entered it', {}], ['Savings and end value 20% lower', {save:0.8}], ['Costs 20% higher', {cost:1.2}], ['Both of those together', {save:0.8, cost:1.2}]]
    .map(([label, o])=>{ const c = tcoCalc(plan, o); return {label, net:c.total.net, breakEven:c.breakEven}; });
}

/* A few plain sentences about what is driving the answer: the biggest cost, the biggest saving, and how much rests on the value
   put on time, which is a judgement rather than money. **x** marks bold. */
function tcoInsights(plan, c){
  const out = [], costs = c.lines.filter(l=> l.total < -0.005).sort((a, b)=> a.total - b.total), gains = c.lines.filter(l=> l.total > 0.005).sort((a, b)=> b.total - a.total);
  const share = (v, all) => all > 0 ? Math.round(Math.abs(v) / all * 100) : 0;
  if(costs.length) out.push('Your biggest cost is **' + costs[0].label + '**: ' + fmt0(-costs[0].total) + ', ' + share(costs[0].total, c.total.cost) + '% of everything you spend.');
  if(gains.length) out.push('Your biggest saving is **' + gains[0].label + '**: ' + fmt0(gains[0].total) + ', ' + share(gains[0].total, c.total.save) + '% of everything you gain.');
  const time = c.lines.filter(l=> l.kind === 'time').reduce((s, l)=> s + l.total, 0);
  if(Math.abs(time) > 0.005) out.push('The value put on your time makes up ' + fmt0(time) + ' of that. Leave it out and the net result is **' + fmt0(c.total.net - time) + '**.');
  return out;
}

/* One plain sentence on what a line comes to, for the line itself. */
function tcoLineNote(l, plan, calc){
  const H = plan.horizon, row = calc.lines.find(x=>x.id === l.id), tot = row ? row.total : 0, over = ' over ' + H + ' year' + (H === 1 ? '' : 's');
  const g = tcoGrowth(l, plan), rise = g ? ', rising ' + (Math.round(g * 10) / 10) + '% a year' : '';
  if(l.kind === 'once') return num(l.amount) ? (Math.round(num(l.at)) > H ? 'After your plan ends, so not counted.' : (Math.round(num(l.at)) ? 'In year ' + Math.round(num(l.at)) + ': ' : 'Now: ') + fmt0(Math.abs(tot))) : '';
  if(l.kind === 'recur' && l.per === 'every') return num(l.amount) ? fmt0(num(l.amount)) + ' every ' + Math.max(1, Math.round(num(l.every))) + ' years' + rise + ' = ' + fmt0(Math.abs(tot)) + over : '';
  if(l.kind === 'recur' || l.kind === 'drive' || l.kind === 'time'){
    const y = Math.abs(tcoYearly(l));
    return y ? fmt0(y) + ' a year' + rise + ' = ' + fmt0(Math.abs(tot)) + over : '';
  }
  if(l.kind === 'loan'){
    const ln = tcoLoan(l.borrow, l.apr, l.years);
    return ln.months ? 'Repayments of ' + fmt0(ln.payment) + ' a month; ' + fmt0(ln.total) + ' interest in total' + (Math.abs(tot) < ln.total - 0.5 ? ' (' + fmt0(Math.abs(tot)) + ' of it within your plan)' : '') : '';
  }
  if(l.kind === 'value') return num(l.base) ? 'Worth ' + fmt0(Math.abs(tot)) + ' after ' + H + ' year' + (H === 1 ? '' : 's') : '';
  if(l.kind === 'mortgage'){
    const m = tcoMortgage(l);
    return m.ready ? 'Repayment goes from ' + fmt0(m.before) + ' to ' + fmt0(m.after) + ' a month: ' + fmt0(Math.abs(m.monthly)) + (m.monthly < 0 ? ' more' : ' less') + ', ' + fmt0(Math.abs(tot)) + over : '';
  }
  return '';
}

/* ---------------- worked examples (made up) ---------------- */
function tcoSet(plan, key, o){ const l = plan.lines.find(x=>x.key === key); if(l) Object.assign(l, o); return l; }
function tcoExample(template){
  if(template === 'home'){
    const p = tcoBlank('home');
    p.name = 'Insulation and heat pump (example)'; p.horizon = 15;
    tcoSet(p, 'home.work', {amount:22000}); tcoSet(p, 'home.grant', {amount:7500});
    tcoSet(p, 'home.loan', {borrow:10000, apr:5.5, years:7});
    tcoSet(p, 'home.bills', {amount:2100, growth:3}); tcoSet(p, 'home.running', {amount:700, growth:3});
    tcoSet(p, 'home.upkeep', {amount:150}); tcoSet(p, 'home.replace', {amount:1500});
    tcoSet(p, 'home.mortgage', {balance:210000, years:22, rateNow:4.1, rateNew:3.85});
    tcoSet(p, 'home.value', {base:8000});
    return p;
  }
  const p = tcoBlank('car');
  p.name = 'A car instead of the bus (example)'; p.horizon = 8;
  p.lines = p.lines.filter(l=> ['car.grant', 'car.trade', 'car.oldfuel', 'car.old'].indexOf(l.key) < 0);
  tcoSet(p, 'car.price', {amount:14000}); tcoSet(p, 'car.loan', {borrow:8000, apr:7.5, years:4});
  tcoSet(p, 'car.insurance', {amount:900}); tcoSet(p, 'car.tax', {amount:280}); tcoSet(p, 'car.service', {amount:450});
  tcoSet(p, 'car.tyres', {amount:500}); tcoSet(p, 'car.fuel', {km:12000, use:6.5, price:1.75}); tcoSet(p, 'car.park', {amount:25});
  tcoSet(p, 'car.bus', {amount:130}); tcoSet(p, 'car.time', {hours:6, worth:10}); tcoSet(p, 'car.resale', {base:14000, change:-12});
  return p;
}

/* A summary line per plan, for the spreadsheet export. */
function tcoCsvRows(plans){
  const rows = [['Plan', 'Years', 'Paid up front', 'Total costs', 'Total savings and end value', 'Net impact', 'Pays for itself after (years)', 'Prices rise (% a year)']];
  plans.forEach(p=>{
    const c = tcoCalc(p), be = c.breakEven;
    rows.push([p.name, p.horizon, round2(c.total.upfront), round2(c.total.cost), round2(c.total.save), round2(c.total.net),
      be.status === 'never' ? 'not within the plan' : round2(be.years), p.inflation]);
  });
  return rows;
}
