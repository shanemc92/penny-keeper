/* ---------------- maternity tab ---------------- */
function renderMaternity(el){
  const M = Y.maternity;
  const plan = maternityPlan();
  const kpi = (lbl,val,sub,cls)=>`<div class="kpi"><div class="lbl">${lbl}</div>
    <div class="val ${cls||''}">${val}</div><div class="sub">${sub||''}</div></div>`;

  const phases = M.employerPhases||[];
  let weekCursor = 0;
  const phaseRows = phases.map((ph,i)=>{
    const from = weekCursor + 1;
    weekCursor += num(ph.weeks);
    const to = weekCursor;
    const weekly = plan ? phaseWeekly(ph, plan.grossWeekly, plan.stateWeekly, from <= num(M.stateWeeks)) : 0;
    return `<tr>
      <td class="n mut">Weeks ${from}-${to}</td>
      <td class="n"><input class="num" style="text-align:right;width:70px" data-path="maternity.employerPhases.${i}.weeks" data-type="number" value="${num(ph.weeks)}"></td>
      <td><select data-path="maternity.employerPhases.${i}.mode">${Object.entries(EMPLOYER_MODES).map(([k,v])=>
        `<option value="${k}" ${ph.mode===k?'selected':''}>${esc(v)}</option>`).join('')}</select></td>
      <td class="n">${ph.mode==='topup'
        ? '<span class="mut">-</span>'
        : `<input class="num" style="text-align:right;width:90px" data-path="maternity.employerPhases.${i}.amount" data-type="number" value="${num(ph.amount)}">`}</td>
      <td class="n">${plan?fmt(weekly):'<span class="mut">-</span>'}</td>
      <td class="n mut">${plan?fmt(weekly*52/12)+'/mo':''}</td>
      <td class="act"><button class="btn sm danger" data-del-phase="${i}">x</button></td>
    </tr>`;
  }).join('');
  const coveredWeeks = weekCursor;
  const leaveWeeks = num(M.paidWeeks)+num(M.unpaidWeeks);

  /* --- inputs, always on screen --- */
  const setup = `
  <div class="card">
    <h2>Leave</h2>
    <div class="grid g4">
      <label class="f"><span>Who is taking it</span>
        <select data-path="maternity.personId">
          ${Y.people.map(p=>`<option value="${esc(p.id)}" ${p.id===M.personId?'selected':''}>${esc(p.name)}</option>`).join('')
            || '<option value="">Add people on the Take-home pay page</option>'}
        </select></label>
      <label class="f"><span>Start date</span><input type="date" data-path="maternity.start" value="${esc(M.start||'')}"></label>
      <label class="f"><span>Paid leave (weeks)</span><input class="num" data-path="maternity.paidWeeks" data-type="number" value="${num(M.paidWeeks)}"></label>
      <label class="f"><span>Unpaid leave after (weeks)</span><input class="num" data-path="maternity.unpaidWeeks" data-type="number" value="${num(M.unpaidWeeks)}"></label>
    </div>
    <div class="row" style="margin-top:2px">
      <button class="btn sm" data-preset="26,0">26 paid</button>
      <button class="btn sm" data-preset="26,16">26 + 16 unpaid</button>
      <button class="btn sm" data-preset="26,8">26 + 8 unpaid</button>
      <div class="spacer"></div>
      ${plan?`<span class="pill">${plan.months.length} months &middot; back ${iso(plan.end)}</span>`:''}
    </div>
    <div class="note">Statutory entitlement is 26 weeks paid plus up to 16 weeks additional unpaid.</div>
  </div>

  <div class="card">
    <h2>State pay</h2>
    <div class="grid g4">
      <label class="f"><span>Maternity Benefit / week</span><input class="num" data-path="maternity.stateWeekly" data-type="number" value="${num(M.stateWeekly)}"></label>
      <label class="f"><span>Paid for (weeks)</span><input class="num" data-path="maternity.stateWeeks" data-type="number" value="${num(M.stateWeeks)}"></label>
      <label class="f"><span>Taxed at %</span><input class="num" data-path="maternity.benefitTaxPct" data-type="number" value="${num(M.benefitTaxPct)}"></label>
    </div>
    <div class="note" style="margin-top:0">2026 rate is ${fmt(299)} a week. Taxable, but exempt from PRSI and USC -
      Revenue collects it by trimming credits and rate band, which normally lands at 20% while income is down.</div>
  </div>

  <div class="card">
    <h2>Employer pay</h2>
    <div class="tw"><table>
      <thead><tr><th>Period</th><th class="n">Weeks</th><th>Pays</th><th class="n">Rate</th>
        <th class="n">Per week</th><th class="n">Equivalent</th><th></th></tr></thead>
      <tbody>${phaseRows || '<tr><td colspan="7" class="empty">No employer pay - benefit only. Add a period if they top up.</td></tr>'}</tbody>
    </table></div>
    <div class="row" style="margin-top:10px">
      <button class="btn" id="addPhase">+ Add period</button>
      ${!phases.length?`<button class="btn" id="quickFull">Full pay for 26 weeks</button>
        <button class="btn" id="quickHalf">Full pay 12 wks, then half for 14</button>`:''}
      <div class="spacer"></div>
      ${coveredWeeks>0?`<span class="pill ${coveredWeeks>leaveWeeks?'':'on'}">${coveredWeeks} of ${leaveWeeks} weeks covered</span>`:''}
    </div>
    ${coveredWeeks>leaveWeeks?`<div class="note">Employer periods run to week ${coveredWeeks}, past the ${leaveWeeks} weeks of
      leave - anything beyond the leave is ignored.</div>`:''}
    <div class="row" style="margin-top:6px">
      <label style="width:auto;margin-right:18px"><input type="checkbox" data-path="maternity.pausePension" ${M.pausePension?'checked':''}> Pension contributions pause</label>
      <label style="width:auto"><input type="checkbox" data-path="maternity.pauseSavings" ${M.pauseSavings?'checked':''}> Stop their savings for the period</label>
    </div>
  </div>`;

  if(!plan){
    el.innerHTML = setup + `<div class="card"><div class="empty">Pick who is taking the leave and a start date to see the impact.</div></div>`;
    wireMaternity(el); return;
  }

  const p = plan;
  const covers = p.cashGap <= p.savingsOpening;

  /* --- weekly disposable per person, against the Budget tab --- */
  const disposable = `
  <div class="card">
    <h2>Weekly disposable income per person</h2>
    <div class="tw"><table>
      <thead><tr><th>Person</th><th class="n">Net / month</th><th class="n">Joint bills</th><th class="n">Own bills</th>
        <th class="n">Savings</th><th class="n">Left / month</th>
        <th class="n">Weekly now</th><th class="n">Weekly on leave</th><th class="n">Change</th></tr></thead>
      <tbody>${p.perPerson.map(r=>`<tr>
        <td>${esc(r.name)} ${r.onLeave?'<span class="pill on">on leave</span>':''}</td>
        <td class="n">${fmt(r.leaveNet)}${r.onLeave?` <span class="mut">was ${fmt(r.net)}</span>`:''}</td>
        <td class="n">${fmt(r.jointBills)}</td>
        <td class="n">${fmt(r.ownBills)}</td>
        <td class="n">${fmt(r.savingsLeave)}${r.onLeave&&M.pauseSavings?' <span class="pill">paused</span>':''}</td>
        <td class="n ${r.leaveLeft>=0?'':'neg'}"><b>${fmt(r.leaveLeft)}</b></td>
        <td class="n mut">${fmt(r.normalWeekly)}</td>
        <td class="n ${r.leaveWeekly>=0?'pos':'neg'}"><b>${fmt(r.leaveWeekly)}</b></td>
        <td class="n ${r.deltaWeekly>=0?'pos':'neg'}">${r.deltaWeekly>=0?'+':''}${fmt(r.deltaWeekly)}</td></tr>`).join('')}</tbody>
      <tfoot><tr><td>Household</td>
        <td class="n">${fmt(p.perPerson.reduce((s,r)=>s+r.leaveNet,0))}</td>
        <td class="n">${fmt(p.perPerson.reduce((s,r)=>s+r.jointBills,0))}</td>
        <td class="n">${fmt(p.perPerson.reduce((s,r)=>s+r.ownBills,0))}</td>
        <td class="n">${fmt(p.perPerson.reduce((s,r)=>s+r.savingsLeave,0))}</td>
        <td class="n">${fmt(p.perPerson.reduce((s,r)=>s+r.leaveLeft,0))}</td>
        <td class="n mut">${fmt(p.perPerson.reduce((s,r)=>s+r.normalWeekly,0))}</td>
        <td class="n">${fmt(p.perPerson.reduce((s,r)=>s+r.leaveWeekly,0))}</td>
        <td class="n ${p.perPerson.reduce((s,r)=>s+r.deltaWeekly,0)>=0?'pos':'neg'}">${fmt(p.perPerson.reduce((s,r)=>s+r.deltaWeekly,0))}</td></tr></tfoot>
    </table></div>
    <div class="note">Bill shares follow whatever split the Bills &amp; budget page is set to. The leave figure is the average across
      the ${p.months.length} months - month by month it moves as the benefit and employer periods start and stop.</div>
  </div>`;

  el.innerHTML = setup + `
  <div class="grid g4" style="margin-bottom:14px">
    ${kpi('Their income drops by', fmt0(p.totalShortfall), `over ${p.months.length} months`, 'neg')}
    ${kpi('Worst month', fmt0(Math.abs(Math.min(0,p.worst.surplus))), p.worst.surplus<0?`short in ${esc(p.worst.key)}`:'no month falls short',
        p.worst.surplus<0?'neg':'pos')}
    ${kpi('Total to bridge', fmt0(p.cashGap), p.cashGap>0?'from savings':'nothing needed', p.cashGap>0?'amb':'pos')}
    ${kpi('Savings today', fmt0(p.savingsOpening), covers
        ? `covers it, ${fmt0(p.savingsOpening-p.cashGap)} left`
        : `short by ${fmt0(p.cashGap-p.savingsOpening)}`, covers?'pos':'neg')}
  </div>

  ${disposable}

  <div class="card">
    <h2>Month by month</h2>
    <div class="tw"><table>
      <thead><tr><th>Month</th><th class="n">Days off</th><th class="n">Worked</th>
        <th class="n">Employer</th><th class="n">Benefit</th><th class="n">Take-home</th>
        <th class="n">Normally</th><th class="n">Down by</th>
        <th class="n">Household in</th><th class="n">Out</th><th class="n">Surplus</th></tr></thead>
      <tbody>${p.months.map(m=>`<tr>
        <td>${esc(m.key)}</td>
        <td class="n mut">${m.leaveDays}/${m.daysInMonth}</td>
        <td class="n">${m.workedNet>0.5?fmt(m.workedNet):'<span class="mut">-</span>'}</td>
        <td class="n">${m.empNet>0.5?fmt(m.empNet):'<span class="mut">-</span>'}</td>
        <td class="n">${m.stateNet>0.5?fmt(m.stateNet):'<span class="mut">-</span>'}</td>
        <td class="n"><b>${fmt(m.actual)}</b></td>
        <td class="n mut">${fmt(m.normalNet)}</td>
        <td class="n neg">${fmt(m.shortfall)}</td>
        <td class="n">${fmt(m.householdIn)}</td>
        <td class="n">${fmt(m.outflow)}</td>
        <td class="n ${m.surplus>=0?'pos':'neg'}"><b>${fmt(m.surplus)}</b></td></tr>`).join('')}</tbody>
      <tfoot><tr><td>Total</td><td></td>
        <td class="n">${fmt(p.months.reduce((s,m)=>s+m.workedNet,0))}</td>
        <td class="n">${fmt(p.months.reduce((s,m)=>s+m.empNet,0))}</td>
        <td class="n">${fmt(p.months.reduce((s,m)=>s+m.stateNet,0))}</td>
        <td class="n">${fmt(p.months.reduce((s,m)=>s+m.actual,0))}</td>
        <td class="n mut">${fmt(p.normal.netMonthly*p.months.length)}</td>
        <td class="n neg">${fmt(p.totalShortfall)}</td>
        <td colspan="2"></td>
        <td class="n ${p.totalSurplus>=0?'pos':'neg'}">${fmt(p.totalSurplus)}</td></tr></tfoot>
    </table></div>
    <div class="note">Normally the household runs ${fmt(p.normalSurplus)} a month spare; through the leave it averages
      ${fmt(p.totalSurplus/p.months.length)}.</div>
  </div>

  <div class="card">
    <h2>Income through the leave</h2>
    <div class="chartbox" style="height:280px"><canvas id="cMat"></canvas></div>
    ${legendHtml([{label:'Their take-home',color:PALETTE[0]},{label:'Normal take-home',color:PALETTE[9]},
                  {label:'Household in',color:PALETTE[5]},{label:'Bills + savings',color:PALETTE[2]}])}
  </div>

  <div class="card">
    <h2>What it costs</h2>
    <div class="grid g3">
      ${kpi('Benefit received', fmt0(p.totalState), `${num(M.stateWeeks)} weeks at ${fmt(p.stateWeekly)}`)}
      ${kpi('Employer pay', fmt0(p.totalEmployer), p.phases.length?`${p.employerWeeks} weeks across ${p.phases.length} period${p.phases.length===1?'':'s'}`:'no top-up')}
      ${kpi('Savings paused', M.pauseSavings?fmt0(p.theirSavings)+'/mo':'No',
            M.pauseSavings?`${fmt0(p.theirSavings*p.months.length)} not put away`:'contributions continue')}
    </div>
    <div class="note">Pausing their savings closes the monthly cash gap, but it does not change where the household ends
      up - the money either goes into a savings account or stays in the current account to cover the bills. It matters
      when the savings are somewhere you would rather not dip into.</div>
    <div class="note">Estimates only. Employer pay is costed at the rates for the <b>leave year</b> -
      ${(p.marginal*100).toFixed(0)}% income tax, ${(p.prsiRate*100).toFixed(2)}% PRSI, ${(p.uscMarginal*100).toFixed(1)}% USC.
      ${p.normalMarginal!==p.marginal
        ? `They normally pay ${(p.normalMarginal*100).toFixed(0)}% at the margin, but income drops far enough during the
           leave to fall into the ${(p.marginal*100).toFixed(0)}% band.` : ''}
      A refund often turns up after year end once a full year of credits is spread over reduced income; this does not try
      to predict it.</div>
  </div>`;

  wireMaternity(el);
  chart(()=>{
    lineChart($('#cMat'), p.months.map(m=>m.key), [
      {name:'Their take-home', color:PALETTE[0], values:p.months.map(m=>m.actual), fill:true},
      {name:'Normal take-home', color:PALETTE[9], values:p.months.map(m=>m.normalNet), dash:true},
      {name:'Household in', color:PALETTE[5], values:p.months.map(m=>m.householdIn)},
      {name:'Bills + savings', color:PALETTE[2], values:p.months.map(m=>m.outflow), dash:true}
    ]);
  });
}

function wireMaternity(el){
  const M = Y.maternity;
  wireFields(el);
  $$('[data-preset]',el).forEach(b=> b.onclick = ()=>{
    const [paid,unpaid] = b.dataset.preset.split(',').map(Number);
    M.paidWeeks = paid; M.unpaidWeeks = unpaid; save(); render();
  });
  if($('#addPhase')) $('#addPhase').onclick = ()=>{
    const used = (M.employerPhases||[]).reduce((s,p)=>s+num(p.weeks),0);
    const left = Math.max(1, num(M.paidWeeks)+num(M.unpaidWeeks) - used);
    M.employerPhases.push({id:uid(), weeks:left, mode:'topup', amount:0});
    save(); render();
  };
  if($('#quickFull')) $('#quickFull').onclick = ()=>{
    M.employerPhases = [{id:uid(), weeks:26, mode:'topup', amount:0}]; save(); render();
  };
  if($('#quickHalf')) $('#quickHalf').onclick = ()=>{
    M.employerPhases = [{id:uid(), weeks:12, mode:'topup', amount:0},
                        {id:uid(), weeks:14, mode:'percent', amount:50}];
    save(); render();
  };
  $$('[data-del-phase]',el).forEach(b=> b.onclick = ()=>{
    M.employerPhases.splice(+b.dataset.delPhase,1); save(); render();
  });
}

