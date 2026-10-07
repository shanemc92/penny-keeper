
function renderReliefs(el){
  const r = Y.reliefs, T = reliefTotals(), E = yearEndRefund(), lib = creditLibrary(Y.year);
  const earners = Y.people;

  const creditCards = earners.map((p,i)=>{
    const t = calcTax(p, Y.taxBands);
    const status = p.status || 'single';
    const ptype = p.personalType || defaultPersonalType(status);
    const chk = personalCheck(p);
    const item = c=>{
      const ci = (p.credits||[]).findIndex(x=>creditMatches(c,x.name));
      const on = ci>=0;
      return `<div class="row" style="align-items:center;gap:10px;padding:9px 0;border-bottom:1px solid var(--line)">
        <label style="display:flex;gap:10px;align-items:flex-start;flex:1;min-width:250px;cursor:pointer">
          <input type="checkbox" data-credit="${i}|${esc(c.key)}" ${on?'checked':''} style="margin-top:4px">
          <span><b>${esc(c.name)}</b> <span class="pill on">${fmt0(c.amount)}</span>${c.when==='refund'?' <span class="pill" title="Claimed on your Income Tax Return after the year ends, so it is a refund and not in your monthly pay">refund after year end</span>':''}${c.est?' <span class="pill warn" title="Not yet published for '+esc(Y.year)+' - the previous year\'s figure is shown">confirm</span>':''}
            <span class="hint" style="display:block;margin:0">${esc(c.desc)}</span></span></label>
        ${on?`<label class="f" style="margin:0;width:140px"><span class="sr">Amount</span>
          <input class="num" style="text-align:right" data-path="people.${i}.credits.${ci}.amount" data-type="number" value="${num(p.credits[ci].amount)}"></label>`:''}
      </div>`;
    };
    return `<div style="margin-bottom:22px">
      ${earners.length>1?`<h3 style="font-size:16px;margin:8px 0">${esc(p.name)}</h3>`:''}
      <h4 class="sect">Your personal credit</h4>
      <label class="f" style="max-width:600px"><span>Which personal credit applies to you?</span>
        <select data-ptype="${i}">${Object.entries(PERSONAL_TYPES).map(([k,v])=>`<option value="${k}" ${ptype===k?'selected':''}>${esc(v.label)} - ${fmt0(personalAmount(k,Y.year))}</option>`).join('')}</select>
        <div class="hint">A married couple's credit is one amount for the two of you; if you both work it is split, so each of you is shown half.</div></label>
      ${chk?`<div class="callout bad" style="margin:0 0 6px"><div class="ci">⚠️</div><div class="cb">Your personal credit is <b>${fmt0(chk.have)}</b>, but for "${esc(chk.label)}" in ${esc(Y.year)} Revenue gives <b>${fmt0(chk.want)}</b>.
        <br><button class="btn sm" data-fixpersonal="${i}">Use ${fmt0(chk.want)}</button></div></div>`:''}
      ${CREDIT_GROUPS.map(g=>`<h4 class="sect">${esc(g)}</h4>${lib.filter(c=>c.group===g).map(item).join('')}`).join('')}
      <div class="note">Total credits for ${esc(p.name)}: <b>${fmt(t.credits)}</b> a year. This is already used on the Take-home pay page.</div>
    </div>`;
  }).join('');

  const healthRows = r.health.map((h,i)=>`<tr>
    <td><input type="date" data-path="reliefs.health.${i}.date" value="${esc(h.date||'')}" style="min-width:140px"></td>
    <td><input data-path="reliefs.health.${i}.who" value="${esc(h.who||'')}" placeholder="Who" list="peopleList" style="min-width:110px"></td>
    <td><input data-path="reliefs.health.${i}.what" value="${esc(h.what||'')}" placeholder="GP, dentist, prescription..." style="min-width:200px"></td>
    <td class="n"><input class="num" style="text-align:right;width:100px" data-path="reliefs.health.${i}.amount" data-type="number" value="${num(h.amount)||''}"></td>
    <td class="n"><input class="num" style="text-align:right;width:100px" data-path="reliefs.health.${i}.refunded" data-type="number" value="${num(h.refunded)||''}"></td>
    <td class="act"><button class="btn sm danger" data-del-health="${i}" aria-label="Delete">x</button></td></tr>`).join('');

  const eligibleEarners = earners.filter(p=>num(p.gross)>0);
  const pensionRows = eligibleEarners.map(p=>{
    const i = earners.indexOf(p);
    const age = num(p.age);
    const lim = age ? pensionLimitPct(age) : 0;
    const allowed = lim/100 * Math.min(num(p.gross)+num(p.bonus), PENSION_EARNINGS_CAP);   // relevant earnings include a bonus
    const paid = num(p.gross)*num(p.pensionPct)/100 + avcYearly(p);
    const head = Math.max(allowed-paid,0);
    return `<tr>
      <td><b>${esc(p.name)}</b></td>
      <td class="n"><input class="num" style="text-align:right;width:80px" data-path="people.${i}.age" data-type="number" value="${age||''}" placeholder="age"></td>
      <td class="n">${age?lim+'%':'-'}</td>
      <td class="n">${age?fmt0(allowed):'-'}</td>
      <td class="n">${fmt0(paid)}</td>
      <td class="n ${head>0?'pos':''}"><b>${age?fmt0(head):'-'}</b></td>
      <td class="n">${age&&head>0?fmt0(head*marginalRate(p))+' <span class="mut">at '+(marginalRate(p)*100).toFixed(0)+'%</span>':'-'}</td></tr>`;
  }).join('');

  el.innerHTML = `
  <div class="grid g4" style="margin-bottom:16px">
    <div class="kpi"><div class="lbl" data-nott>Possible tax back</div><div class="val pos">${fmt0(E.total)}</div><div class="sub">after the year ends - not in take-home pay</div></div>
    <div class="kpi"><div class="lbl" data-nott>Credits claimed as a refund</div><div class="val">${fmt0(E.creditsTotal)}</div><div class="sub">${E.credits.length?esc(E.credits.map(c=>c.rows.map(r=>r.name).join(', ')).join(', ')):'rent, mortgage interest'}</div></div>
    <div class="kpi"><div class="lbl" data-nott>Health expenses relief</div><div class="val">${fmt0(T.healthRelief)}</div><div class="sub">20% of ${fmt0(Math.max(T.spent-T.refunded,0))}</div></div>
    <div class="kpi"><div class="lbl" data-nott>Remote working relief</div><div class="val">${fmt0(T.remoteSaving)}</div><div class="sub">tax saved at ${(T.mr*100).toFixed(0)}%</div></div>
    <div class="kpi"><div class="lbl" data-nott>Tuition fees relief</div><div class="val">${fmt0(T.tuition)}</div><div class="sub">20% of eligible fees</div></div>
  </div>
  ${callout('info','ℹ️','When you get the money','<b>Most credits are already in your pay</b> - they are on your Tax Credit Certificate, so your employer applies them every month. '+
    '<b>The Rent Tax Credit and the Mortgage Interest Tax Credit are claimed on your Income Tax Return after the year ends</b>, so they come back as a refund. '+
    'Health expenses and remote working relief can be claimed during the year through <b>Real Time Credits</b> in myAccount, which puts them into your pay, but most people claim afterwards - so this page shows them as an end-of-year refund too. '+
    'None of the refunds are in the monthly take-home figure. Revenue can ask for receipts, so keep them for six years.')}



  <datalist id="peopleList">${earners.map(p=>`<option value="${esc(p.name)}">`).join('')}</datalist>

  <div class="card">
    ${cardHead('1. Tax credits - tick what applies','Every credit Revenue lists for '+esc(Y.year)+'. Credits come straight off your tax bill, so they raise your take-home pay.')}
    <div class="callout warn"><div class="ci">🔎</div><div class="cb"><b class="ct">Confirm these on revenue.ie</b>
      The amounts are taken from Revenue's published tables for each year (2022 to 2026) and from the Budget summaries for 2027. Whether you qualify for a credit is up to you to check -
      read the conditions on <a href="${REVENUE_HOME}" target="_blank" rel="noopener">revenue.ie</a>, compare with the
      <a href="${REVENUE_CHART}" target="_blank" rel="noopener">rates and reliefs chart</a>, and check your Tax Credit Certificate in myAccount.
      ${Y.year>=2027?'Items marked <span class="pill warn">confirm</span> are not published for '+esc(Y.year)+' yet and show the previous figure.':''}</div></div>
    ${creditCards || '<div class="empty">Add a person on the Take-home pay page first.</div>'}
  </div>

  <div class="card">
    ${cardHead('Other allowances and reliefs on revenue.ie','Not tax credits, so they are not in the calculation, but worth knowing about.')}
    <ul style="margin:0 0 8px;padding-left:20px;line-height:1.7">
      <li><b>Employed person caring for an incapacitated individual</b> - an allowance of up to ${fmt0(75000)} of what you pay the carer.</li>
      <li><b>Guide dog allowance</b> - ${fmt0(825)}.</li>
      <li><b>Remote working, health expenses, tuition fees</b> - the calculators below.</li>
    </ul>
    <div class="note" style="margin-top:0">More to look up: donations and covenants, pensions and retirement, children, marital and civil status, real-time credits, lump sums, exempt incomes, the four-year rule for claiming refunds, and refunds if you are unemployed. See
      <a href="${REVENUE_HOME}" target="_blank" rel="noopener">Personal tax credits, reliefs and exemptions</a> on revenue.ie.</div>
  </div>

  <div class="card">
    ${cardHead('2. Health expenses - 20% back','Doctor, consultant, hospital, prescriptions, physio, glasses, and similar. Keep every receipt.',
      '<button class="btn primary" id="addHealth">+ Add expense</button>')}
    ${r.health.length ? `<div class="tw"><table>
      <thead><tr><th>Date</th><th>Who for</th><th>What</th><th class="n">Cost</th><th class="n">Refunded by insurer</th><th></th></tr></thead>
      <tbody>${healthRows}</tbody>
      <tfoot><tr><td colspan="3">Total</td><td class="n">${fmt(T.spent)}</td><td class="n">${fmt(T.refunded)}</td><td></td></tr></tfoot></table></div>
      <div class="callout good" style="margin:12px 0 0"><div class="ci">💶</div><div class="cb"><b class="ct">Relief: ${fmt(T.healthRelief)}</b>
        20% of ${fmt(Math.max(T.spent-T.refunded,0))} (cost minus anything your insurer paid back).</div></div>`
      : emptyState('🩺','No expenses logged yet','Add each receipt as it comes in. At year end you will know exactly what to claim.')}
    <div class="note">Routine dental treatment and routine eye tests generally do not qualify. Check the list on revenue.ie before claiming.</div>
  </div>

  <div class="card">
    ${cardHead('3. Remote working relief','If you work from home, you can claim 30% of the vouched cost of electricity, heating and broadband used for work.')}
    <div class="grid g4">
      <label class="f"><span>Days worked from home this year</span><input class="num" data-path="reliefs.remote.days" data-type="number" value="${num(r.remote.days)||''}"></label>
      <label class="f"><span>Electricity (whole year)</span><input class="num" data-path="reliefs.remote.elec" data-type="number" value="${num(r.remote.elec)||''}"></label>
      <label class="f"><span>Heating (whole year)</span><input class="num" data-path="reliefs.remote.heat" data-type="number" value="${num(r.remote.heat)||''}"></label>
      <label class="f"><span>Broadband (whole year)</span><input class="num" data-path="reliefs.remote.broadband" data-type="number" value="${num(r.remote.broadband)||''}"></label>
      <label class="f"><span>Share of use that is work (%) ${ttHtml('Roughly the share of a working day your home is in use for work. 8 working hours out of 24 is about 33%.')}</span><input class="num" data-path="reliefs.remote.share" data-type="number" value="${num(r.remote.share)}"></label>
    </div>
    ${T.eligible>0?`<div class="callout good" style="margin:6px 0 0"><div class="ci">💶</div><div class="cb"><b class="ct">Estimated saving: ${fmt(T.remoteSaving)}</b>
      ${fmt(T.eligible)} of costs apportioned to work, 30% of that (${fmt(T.remoteDeduction)}) is deductible, saving tax at ${(T.mr*100).toFixed(0)}%.</div></div>`:''}
    <div class="note">An estimate to help you plan. Revenue's rules on apportioning the costs have detail - check them on revenue.ie.</div>
  </div>

  <div class="card">
    ${cardHead('4. Tuition fees - 20% back','Third-level fees. The first '+fmt0(TUITION.disregardFull)+' (full-time) or '+fmt0(TUITION.disregardPart)+' (part-time) of each claim does not qualify, and at most '+fmt0(TUITION.maxFees)+' of fees counts for each course.',
      '<button class="btn primary" id="addTuition">+ Add a student</button>')}
    ${r.tuitionClaims.length ? `<div class="tw"><table class="stack-m">
      <thead><tr><th>Who</th><th>Course</th><th class="n">Fees paid</th><th class="n">Relief</th><th></th></tr></thead>
      <tbody>${r.tuitionClaims.map((c,i)=>`<tr>
        <td class="first" data-label="Who"><input data-path="reliefs.tuitionClaims.${i}.who" value="${esc(c.who||'')}" placeholder="Name" list="peopleList"></td>
        <td data-label="Course"><select data-path="reliefs.tuitionClaims.${i}.type"><option value="full" ${c.type==='part'?'':'selected'}>Full-time</option><option value="part" ${c.type==='part'?'selected':''}>Part-time</option></select></td>
        <td class="n" data-label="Fees paid"><input class="num" style="text-align:right;width:110px" data-path="reliefs.tuitionClaims.${i}.fees" data-type="number" value="${num(c.fees)||''}"></td>
        <td class="n pos" data-label="Relief"><b>${fmt(tuitionRelief(c))}</b></td>
        <td class="act"><button class="btn sm danger" data-del-tuition="${i}" aria-label="Delete">x</button></td></tr>`).join('')}</tbody>
      <tfoot><tr><td colspan="3">Total</td><td class="n pos">${fmt(T.tuition)}</td><td></td></tr></tfoot></table></div>`
      : '<div class="empty">Paying college fees? Add a student to see the relief.</div>'}
    ${num(r.tuition.eligible)>0?`<label class="f" style="max-width:300px;margin-top:10px"><span>Earlier entry: eligible fees</span><input class="num" data-path="reliefs.tuition.eligible" data-type="number" value="${num(r.tuition.eligible)||''}"><div class="hint">Entered before this page worked out the disregard. Clear it if you add students above.</div></label>`:''}
  </div>

  <div class="card">
    ${cardHead('5. Pension - are you using your tax relief?','Pension contributions get tax relief up to an age-based % of your earnings (earnings capped at '+fmt0(PENSION_EARNINGS_CAP)+').')}
    ${pensionRows ? `<div class="tw"><table>
      <thead><tr><th>Person</th><th class="n">Age</th><th class="n">Limit</th><th class="n">Most you can claim</th><th class="n">You pay in</th><th class="n">Room left</th><th class="n">Tax you would save</th></tr></thead>
      <tbody>${pensionRows}</tbody></table></div>
      <div class="note">"You pay in" is your own pension % and AVCs from the Take-home pay page. Employer contributions do not count against your limit. Extra AVCs are taxed relief at your top rate, but USC and PRSI are not reduced.</div>`
      : '<div class="empty">Add a salary on the Take-home pay page to see this.</div>'}
  </div>

  ${(()=>{ const items = [
      ['cert','Check your Tax Credit Certificate in Revenue myAccount - are the credits and rate band right?'],
      ['health','Collect health expense receipts and check what your insurer has already refunded'],
      ['rent','Renting? Make sure your landlord has registered the tenancy with the RTB and keep your rent receipts'],
      ['remote','Worked from home? Add up your electricity, heating and broadband bills'],
      ['pension','Check whether you have pension relief headroom (section 5 below)'],
      ['tuition','Paid college fees? Keep the receipts and any grant or refund letters'],
      ['review','Look at your Revenue end-of-year statement and claim anything missing']];
    const done = items.filter(([k])=>r.checklist[k]).length;
    return `<div class="card">${cardHead('✅ Year-end tax checklist', done+' of '+items.length+' done - tick them off as you go')}
      ${items.map(([k,t])=>`<label style="display:flex;gap:10px;align-items:flex-start;padding:7px 0;cursor:pointer;border-bottom:1px solid var(--line)">
        <input type="checkbox" data-check="${k}" ${r.checklist[k]?'checked':''} style="margin-top:4px"><span style="${r.checklist[k]?'text-decoration:line-through;color:var(--muted)':''}">${t}</span></label>`).join('')}</div>`; })()}`;

  wireFields(el);
  $$('[data-check]',el).forEach(c=> c.onchange = ()=>{ r.checklist[c.dataset.check] = c.checked; save(); render(); });
  $('#addTuition').onclick = ()=>{ r.tuitionClaims.push({id:uid(), who:(earners[0]||{}).name||'', type:'full', fees:0}); save(); render(); };
  $$('[data-del-tuition]',el).forEach(b=> b.onclick = ()=>{ r.tuitionClaims.splice(+b.dataset.delTuition,1); save(); render(); });
  $('#addHealth').onclick = ()=>{ r.health.unshift({id:uid(), date:iso(new Date()), who:(earners[0]||{}).name||'', what:'', amount:0, refunded:0}); save(); render(); };
  $$('[data-del-health]',el).forEach(b=> b.onclick = ()=>{ r.health.splice(+b.dataset.delHealth,1); save(); render(); });
  $$('[data-ptype]',el).forEach(sel=> sel.onchange = ()=>{ setPersonalType(Y.people[+sel.dataset.ptype], sel.value); DB.ui.done.credits = true; save(); render(); });
  $$('[data-fixpersonal]',el).forEach(btn=> btn.onclick = ()=>{ const q = Y.people[+btn.dataset.fixpersonal]; setPersonalType(q, q.personalType || defaultPersonalType(q.status)); save(); render(); toast('Personal credit updated'); });
  $$('[data-credit]',el).forEach(c=> c.onchange = ()=>{
    const [pi,key] = c.dataset.credit.split('|');
    const p = Y.people[+pi], def = lib.find(x=>x.key===key);
    if(!p || !def) return;
    if(c.checked) p.credits.push({name:def.name, amount:def.amount, when:def.when});
    else p.credits = p.credits.filter(x=>!creditMatches(def, x.name));
    DB.ui.done.credits = true;
    save(); render();
  });
}

