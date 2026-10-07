/* ---------- tax engine ---------- */
function uscFor(income, bands, exempt){
  if(income <= exempt) return 0;
  let prev=0, total=0;
  for(const b of bands){
    if(income > prev){ total += (Math.min(income,b.to)-prev)*b.rate; prev=b.to; }
  }
  return total;
}
function calcTax(person, bands){
  const p = person, b = bands;
  const gross = num(p.gross);
  const bik = num(p.bikMonthly)*12;
  const pension = gross*(num(p.pensionPct)/100);
  const avc = avcYearly(p);
  const grossPay = gross + bik;                       // incl. notional pay
  const taxable = grossPay - pension - avc;
  const srcop = effectiveSrcop(p, b);                 // the band that applies to this person
  const taxOn = x => Math.max(Math.min(x, srcop),0)*b.lowRate + Math.max(x - srcop, 0)*b.highRate;
  const tax20 = Math.max(Math.min(taxable, srcop),0) * b.lowRate;
  const tax40 = Math.max(taxable - srcop, 0) * b.highRate;
  const liability = tax20 + tax40;
  /* credits that are in your pay reduce the tax taken each month; the ones that are claimed after the year
     ends (rent, mortgage interest) are worked out separately as a refund, not in take-home pay */
  const credits = (p.credits||[]).filter(c=>!creditIsRefund(c)).reduce((s,c)=>s+num(c.amount),0);
  const refundCredits = (p.credits||[]).filter(creditIsRefund).reduce((s,c)=>s+num(c.amount),0);
  const paye = Math.max(liability - credits, 0);
  const refund = paye - Math.max(liability - credits - refundCredits, 0);   // a credit cannot refund more tax than was paid
  const m1 = clamp(num(b.prsiChangeMonth)-1, 0, 12), m2 = 12-m1;
  /* employees earning at or under the weekly threshold pay no PRSI at all */
  const prsiOn = x => (x/52 <= num(b.prsiExemptWeekly)) ? 0 : (x*b.prsiRate1/12)*m1 + (x*b.prsiRate2/12)*m2;
  const prsi = prsiOn(grossPay);
  const usc = uscFor(grossPay, b.uscBands, b.uscExempt);
  const deductions = paye + prsi + usc + pension + avc;
  const net = gross - deductions;
  /* a bonus is the extra tax on top of normal pay, so one that straddles the band is split correctly */
  const bonus = num(p.bonus);
  const bTax = Math.max(taxOn(taxable + bonus) - credits, 0) - paye;
  const bPrsi = prsiOn(grossPay + bonus) - prsi;
  const bUsc = uscFor(grossPay + bonus, b.uscBands, b.uscExempt) - usc;
  const bonusNet = bonus - bTax - bPrsi - bUsc;
  return {gross, bik, pension, avc, grossPay, taxable, tax20, tax40, liability, credits, refundCredits, refund, paye,
          prsi, usc, deductions, net, netMonthly:net/12, srcop,
          bonus, bTax, bPrsi, bUsc, bonusNet,
          effective: grossPay? (paye+prsi+usc)/grossPay*100 : 0};
}


function guessStatus(p, bands){
  const s = num(p.srcop);
  if(!s || s===num(bands.srcopSingle)) return 'single';
  if(s===num(bands.srcopMax)) return 'married1';
  if(bands.srcopParent && s===num(bands.srcopParent)) return 'parent';
  return 'custom';
}

/* is the saved year's tax setup different from the figures built in for that year? */
function taxBandsDiffer(b, p){
  const keys = ['srcopSingle','srcopMax','srcopParent','srcopSecond','lowRate','highRate','prsiRate1','prsiRate2','prsiChangeMonth','prsiExemptWeekly','uscExempt'];
  if(keys.some(k=> num(b[k]) !== num(p[k]))) return true;
  const a = (b.uscBands||[]).map(x=>[num(x.to), num(x.rate)].join(':')).join('|');
  return a !== p.uscBands.map(x=>[x.to, x.rate].join(':')).join('|');
}

/* the personal credit that should be on this person's list, and a note if what they have is different */
function personalCheck(p){
  const type = p.personalType || defaultPersonalType(p.status);
  const want = personalAmount(type, Y.year);
  const row = (p.credits||[]).find(c=>/^personal/i.test(c.name));
  if(p.status==='custom') return null;
  if(!row) return {want, have:0, label:PERSONAL_TYPES[type].label};
  if(Math.abs(num(row.amount)-want) > 0.5) return {want, have:num(row.amount), label:PERSONAL_TYPES[type].label};
  return null;
}

function setPersonalType(p, type){
  p.personalType = type;
  let row = (p.credits||[]).find(c=>/^personal/i.test(c.name));
  if(!row){ row = {name:'Personal Tax Credit', amount:0}; p.credits.unshift(row); }
  row.amount = personalAmount(type, Y.year);
}

/* "What does next year's Budget mean for me?" - the same salary run through next year's published
   figures: new rate bands, credits and USC bands. Only offered when those figures are built in. */
function nextYearPerson(p, ny, nb){
  const q = JSON.parse(JSON.stringify(p));
  const st = BAND_STATUS[q.status];
  if(st && st.pick) q.srcop = st.pick(nb);
  refreshCredits(q, ny);
  return q;
}
