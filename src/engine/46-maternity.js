/* ---------------- maternity leave ----------------
   Walks the leave day by day so employer phases, the benefit window and part
   months all land correctly, then reports what each person is left with a week.
---------------------------------------------------*/
function phaseWeekly(ph, grossWeekly, stateWeekly, stateActive){
  if(!ph) return 0;
  if(ph.mode==='topup')   return Math.max(0, grossWeekly - (stateActive ? stateWeekly : 0));
  if(ph.mode==='percent') return grossWeekly * num(ph.amount)/100;
  if(ph.mode==='flat')    return num(ph.amount)*12/52;
  return 0;
}
function maternityPlan(){
  const M = Y.maternity;
  if(!M || !M.start || !Y.people.length) return null;
  const person = Y.people.find(p=>p.id===M.personId) || Y.people[0];
  const bands = Y.taxBands;
  const normal = calcTax(person, bands);
  const start = parseDate(M.start);
  if(!start) return null;

  const totalWeeks = Math.max(0, num(M.paidWeeks)) + Math.max(0, num(M.unpaidWeeks));
  const totalDays = Math.max(1, Math.round(totalWeeks*7));
  const end = addDays(start, totalDays);
  const stateDays = Math.max(0, Math.round(num(M.stateWeeks)*7));

  const grossWeekly = num(person.gross)/52;
  const stateWeekly = num(M.stateWeekly);
  const phases = (M.employerPhases||[]).filter(p=>p && num(p.weeks)>0);
  const phaseEndDay = [];
  let acc = 0;
  phases.forEach(p=>{ acc += Math.round(num(p.weeks)*7); phaseEndDay.push(acc); });
  const phaseAt = d => { for(let i=0;i<phases.length;i++) if(d < phaseEndDay[i]) return phases[i]; return null; };

  const prsiRate = num(bands.prsiRate2);
  const pensionPct = M.pausePension ? 0 : num(person.pensionPct)/100;
  const srcop = effectiveSrcop(person, bands);

  /* Income falls during leave, so the rate that bites is the leave YEAR's, not a normal
     year's - taxing a top-up at 40% when the year lands under the band overstates the
     gap badly. Done per calendar year, since leave usually straddles two. */
  const yrGross = {}, yrBenefit = {};
  for(let d=0; d<totalDays; d++){
    const yr = addDays(start,d).getFullYear(), stateActive = d < stateDays;
    yrGross[yr] = (yrGross[yr]||0) + phaseWeekly(phaseAt(d), grossWeekly, stateWeekly, stateActive)/7;
    yrBenefit[yr] = (yrBenefit[yr]||0) + (stateActive ? stateWeekly/7 : 0);
  }
  const yearRates = {};
  const ratesFor = yr => {
    if(yearRates[yr]) return yearRates[yr];
    const yStart = new Date(yr,0,1), yEnd = new Date(yr+1,0,1);
    const daysInYear = Math.round((yEnd-yStart)/86400000);
    const s = Math.max(yStart.getTime(), start.getTime()), e = Math.min(yEnd.getTime(), end.getTime());
    const leaveDays = e>s ? Math.round((e-s)/86400000) : 0;
    const workGross = num(person.gross)*(daysInYear-leaveDays)/daysInYear + (yrGross[yr]||0);
    const taxable = workGross + (yrBenefit[yr]||0) - workGross*(num(person.pensionPct)/100);
    const uscBand = bands.uscBands.find(b=> workGross <= num(b.to)) || bands.uscBands[bands.uscBands.length-1];
    return (yearRates[yr] = { marginal: taxable > srcop ? bands.highRate : bands.lowRate, usc: num(uscBand.rate) });
  };
  const employerNetOf = (g, yr) => {
    const r = ratesFor(yr), pension = g*pensionPct;
    return g - pension - (g-pension)*r.marginal - g*prsiRate - g*r.usc;
  };
  const benefitNetOf = b => b * (1 - num(M.benefitTaxPct)/100);

  const bucket = {};
  for(let d=0; d<totalDays; d++){
    const date = addDays(start,d), k = monthKey(date), stateActive = d < stateDays;
    const m = bucket[k] || (bucket[k] = {key:k, year:date.getFullYear(), leaveDays:0, empGross:0, stateGross:0,
      daysInMonth: new Date(date.getFullYear(), date.getMonth()+1, 0).getDate()});
    m.leaveDays++;
    m.empGross += phaseWeekly(phaseAt(d), grossWeekly, stateWeekly, stateActive)/7;
    m.stateGross += stateActive ? stateWeekly/7 : 0;
  }

  const js = jointShares();
  const sp = savingsSplit();
  const bt = billTotals('bill');
  const joint = bt.joint/12;
  const savingsAll = billTotals('savings').monthly;
  const theirSavings = (sp.rows.find(r=>r.id===person.id)||{total:0}).total;
  const savingsDuring = M.pauseSavings ? Math.max(0, savingsAll - theirSavings) : savingsAll;
  const otherNet = Y.people.filter(p=>p!==person).reduce((s,p)=> s + calcTax(p,bands).netMonthly, 0);

  const months = Object.keys(bucket).sort().map(k=>{
    const m = bucket[k];
    const empNet = employerNetOf(m.empGross, m.year);
    const stateNet = benefitNetOf(m.stateGross);
    const workedNet = normal.netMonthly * (m.daysInMonth - m.leaveDays)/m.daysInMonth;
    const actual = workedNet + empNet + stateNet;
    return {...m, empNet, stateNet, workedNet, actual, normalNet:normal.netMonthly,
      shortfall: normal.netMonthly - actual,
      householdIn: otherNet + actual, outflow: bt.monthly + savingsDuring,
      surplus: otherNet + actual - bt.monthly - savingsDuring};
  });
  if(!months.length) return null;

  const sum = k => months.reduce((s,m)=>s+m[k],0);
  const avgLeaveNet = sum('actual')/months.length;

  /* Weekly disposable per person: the Budget tab's own arithmetic, run twice - on
     normal pay, and on what they actually receive during the leave. */
  const perPerson = Y.people.map((p,i)=>{
    const onLeave = p===person;
    const net = calcTax(p,bands).netMonthly;
    const leaveNet = onLeave ? avgLeaveNet : net;
    const ownBills = (bt.byHolder[p.name]||0)/12;
    const jointBills = joint * (js.shares[i]||0);
    const sav = sp.rows[i] ? sp.rows[i].total : 0;
    const savLeave = (onLeave && M.pauseSavings) ? 0 : sav;
    const normalLeft = net - jointBills - ownBills - sav;
    const leaveLeft = leaveNet - jointBills - ownBills - savLeave;
    return {id:p.id, name:p.name, onLeave, net, leaveNet, ownBills, jointBills,
      savings:sav, savingsLeave:savLeave, normalLeft, leaveLeft,
      normalWeekly: normalLeft*12/52, leaveWeekly: leaveLeft*12/52,
      deltaWeekly: (leaveLeft-normalLeft)*12/52};
  });

  const gap = months.reduce((s,m)=> s + Math.min(0,m.surplus), 0);
  const worst = months.reduce((w,m)=> m.surplus < w.surplus ? m : w, months[0]);
  const rates = ratesFor(start.getFullYear());

  return {
    person, normal, months, start, end, totalWeeks, employerWeeks: acc/7,
    stateWeekly, grossWeekly, phases,
    marginal:rates.marginal, uscMarginal:rates.usc, prsiRate,
    normalMarginal: normal.taxable > srcop ? bands.highRate : bands.lowRate,
    otherNet, bills:bt.monthly, savingsAll, savingsDuring, theirSavings,
    normalSurplus: otherNet + normal.netMonthly - bt.monthly - savingsAll,
    perPerson, avgLeaveNet,
    totalShortfall: sum('shortfall'), totalState: sum('stateGross'), totalEmployer: sum('empGross'),
    totalSurplus: sum('surplus'), cashGap: -gap, worst,
    savingsOpening: (Y.savings.accounts||[]).reduce((s,a)=>s+num(a.opening),0)
  };
}
