/* ---------------- reliefs and credits that come back after the year ends ----------------
   Health expenses, remote working and tuition fees are claimed from Revenue once the year is over. Revenue
   also lets health and remote working expenses be claimed during the year ("Real Time Credits" in myAccount),
   which spreads the relief into your pay, but that needs a claim each time - so they are treated as an estimated
   refund, not as part of the monthly take-home figure. */

/* pension tax relief: the share of earnings (capped) that can be paid in, by age */
const PENSION_LIMITS = [[30,15],[40,20],[50,25],[55,30],[60,35],[200,40]];   // age under X -> % of earnings
const pensionLimitPct = age => (PENSION_LIMITS.find(([a])=> age<a)||[0,40])[1];
const PENSION_EARNINGS_CAP = 115000;

/* tuition fees: 20% of the fees above a disregard (3,000 full-time, 1,500 part-time), counting at most 7,000 of
   fees for each course and person */
const TUITION = {rate:0.20, maxFees:7000, disregardFull:3000, disregardPart:1500};
function tuitionRelief(c){
  const disregard = c.type==='part' ? TUITION.disregardPart : TUITION.disregardFull;
  return Math.max(Math.min(num(c.fees), TUITION.maxFees) - disregard, 0) * TUITION.rate;
}

function reliefTotals(){
  const r = Y.reliefs;
  const spent = r.health.reduce((s,h)=>s+num(h.amount),0);
  const refunded = r.health.reduce((s,h)=>s+Math.min(num(h.refunded), num(h.amount)),0);   // a refund cannot exceed its own cost
  const healthRelief = Math.max(spent-refunded,0) * 0.20;
  const rm = r.remote;
  const eligible = (num(rm.elec)+num(rm.heat)+num(rm.broadband)) * Math.min(num(rm.days),365)/365 * clamp(num(rm.share),0,100)/100;
  const earner = Y.people.find(p=>num(p.gross)>0) || Y.people[0];
  const mr = earner ? marginalRate(earner) : Y.taxBands.lowRate;
  const remoteDeduction = eligible * 0.30;
  const remoteSaving = remoteDeduction * mr;
  const tuition = (r.tuitionClaims||[]).reduce((s,c)=>s+tuitionRelief(c),0) + num(r.tuition && r.tuition.eligible) * TUITION.rate;
  return {spent, refunded, healthRelief, eligible, remoteDeduction, remoteSaving, mr, tuition,
          total: healthRelief + remoteSaving + tuition};
}

/* Everything the household can expect back from Revenue after the year ends: the credits that are claimed
   on the tax return (rent, mortgage interest) plus the reliefs above. An estimate - not part of take-home pay. */
function yearEndRefund(){
  let creditsTotal = 0;
  const credits = [];
  Y.people.forEach(p=>{
    const t = calcTax(p, Y.taxBands);
    const rows = (p.credits||[]).filter(creditIsRefund).filter(c=>num(c.amount)>0);
    if(rows.length){
      credits.push({person:p.name, rows:rows.map(c=>({name:c.name, amount:num(c.amount)})), claimed:t.refundCredits, refund:t.refund});
      creditsTotal += t.refund;
    }
  });
  const R = reliefTotals();
  return {credits, creditsTotal, health:R.healthRelief, remote:R.remoteSaving, tuition:R.tuition,
          reliefs:R.total, total:creditsTotal + R.total};
}
