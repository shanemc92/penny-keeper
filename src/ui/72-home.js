/* ---------------- home ---------------- */
function renderDashboard(el){
  const H = household();
  const {people, net, bt, st} = H;
  const rows = budgetVsActual();
  const {months} = analysisRange();
  const spend = rows.reduce((s,r)=>s+r.spend,0);
  const sp = setupProgress();
  const blank = isBlankYear(Y);
  const left = H.left;
  const mortPos = (Y.mortgages||[]).map(m=> mortgagePosition(m));
  const loanPos = Y.loans.map(l=> loanPosition(l));
  const proj = projectSavings();
  const projEnd = proj.length ? proj[proj.length-1].total : 0;
  const top = rows.filter(r=>r.spend>0).slice(0,9);
  const savRate = net>0 ? H.save/net*100 : 0;
  const billShare = net>0 ? H.bills/net*100 : 0;
  const emergSaved = num(Y.emergency.saved) || savingsTotal();
  const emergMonths = H.bills>0 ? emergSaved/H.bills : 0;
  const lb = daysSinceBackup();

  const refundNow = yearEndRefund();
  const hc = (cls, title, val, desc, tip) => `<div class="hc ${cls}"><div class="t">${title}${tip?ttHtml(tip):''}</div><div class="v">${val}</div><div class="d">${desc}</div></div>`;

  /* where each euro goes */
  const base = Math.max(net, H.bills + H.save, 1);
  const seg = (v,c,l)=> v>0 ? `<i style="width:${v/base*100}%;background:${c}" title="${l}"></i>` : '';

  const upcoming = comingUp(30);
  const nudges = [];
  if(blank) nudges.push(callout('tipc','🚀','Welcome! Nothing is entered yet',DB.ui.hideSetup ? 'Add your pay and bills to get going, or look around with an example household.' : 'Start with the set-up guide - it takes about five minutes and the whole app comes to life.',
    (DB.ui.hideSetup ? `<button class="btn primary" data-go="tax">Add your salary</button> ` : `<button class="btn primary" data-go="setup">Start the set-up guide</button> `)+`<button class="btn" id="homeDemo">${DB.ui.hideSetup?'See':'Or see'} an example household</button>`));
  else if(sp.done<sp.total && sp.next && !DB.ui.hideSetup) nudges.push(callout('tipc','🧭',`Set-up is ${Math.round(sp.done/sp.total*100)}% done`,
    `Next up: <b>${esc(sp.next.title)}</b> - ${esc(sp.next.sub.toLowerCase())}.`,
    `<button class="btn primary sm" data-go="setup">Continue set-up</button>`));
  if(!blank && (lb===null || lb>30)) nudges.push(callout('warn','💾', lb===null?'You have not backed up yet':'Your last backup was '+lb+' days ago',
    'Everything is stored in this browser only. A backup takes one click.',`<button class="btn sm" data-go="data">Back up now</button>`));

  el.innerHTML = `
  ${nudges.join('')}

  <div class="card">
    <div class="hero">
      <div>
        <div class="mut" style="color:var(--muted);font-weight:600">${net>0?'Left over each month':'Your monthly picture'}</div>
        ${net>0 ? `<div class="big ${left>=0?'pos':'neg'}">${fmt0(left)} <small>/ month</small></div>
          <p class="note" style="font-size:14px">${left>=0
            ? `After bills and savings you have about <b>${fmt0(left*12/52)} a week</b> to spend as you like.`
            : `You are committing <b>${fmt0(-left)} a month more</b> than you take home. Trim a bill or lower a savings amount.`}</p>`
          : `<div class="big mut">-</div><p class="note" style="font-size:14px">Enter your salary on the <a href="#" data-go="tax">Take-home pay</a> page and this fills in.</p>`}
      </div>
      <div>
        <div class="stack" aria-label="Where your take-home pay goes">${net>0 ? seg(H.bills,PALETTE[1],'Bills')+seg(H.save,PALETTE[5],'Savings')+seg(Math.max(left,0),PALETTE[0],'Left over') : ''}</div>
        <div class="legend">
          <span><i style="background:${PALETTE[1]}"></i>Bills<b>${fmt0(H.bills)}</b></span>
          <span><i style="background:${PALETTE[5]}"></i>Savings<b>${fmt0(H.save)}</b></span>
          <span><i style="background:${PALETTE[0]}"></i>Left over<b class="${left<0?'neg':''}">${fmt0(left)}</b></span>
        </div>
        <div class="note">Out of <b>${fmt0(net)}</b> take-home a month${people.length?' ('+people.map(x=>esc(x.p.name)).join(' + ')+')':''}. Bills come to ${fmt0(bt.annual)} a year.</div>
      </div>
    </div>
  </div>

  <h3 style="margin:22px 0 10px">Financial health check</h3>
  <div class="health">
    ${hc(net<=0?'':savRate>=15?'good':savRate>=5?'warn':'bad','Savings rate', net>0?pct(savRate):'-',
      net>0 ? (savRate>=15?'Great - you are saving a healthy share.':savRate>=5?'A decent start. 10-20% of take-home is a common target.':'Try to build this towards 10% or more.') : 'Needs your salary first.',
      'The share of your take-home pay that you put aside. 10% to 20% is a good target.')}
    ${hc(H.bills<=0?'':emergMonths>=3?'good':emergMonths>=1?'warn':'bad','Emergency cover', H.bills>0?emergMonths.toFixed(1)+' months':'-',
      H.bills>0 ? (emergMonths>=3?'Your savings would cover your bills for a few months.':'Aim for 3 to 6 months of bills in an emergency fund.') : 'Add your bills first.',
      'How many months of bills your savings would cover if your income stopped.')}
    ${hc(net<=0?'':billShare<=50?'good':billShare<=65?'warn':'bad','Bills vs take-home', net>0?pct(billShare):'-',
      net>0 ? (billShare<=50?'Comfortable - plenty of room left.':billShare<=65?'Getting tight. Look for bills to trim.':'Bills take most of your pay.') : 'Needs your salary first.',
      'The share of your take-home pay that goes on bills. Under half is comfortable.')}
    ${refundNow.total>0.5 ? hc('good','Tax back after the year', fmt0(refundNow.total),
      'From credits claimed on your tax return and reliefs like health expenses. <a href="#" data-go="reliefs">See Credits &amp; reliefs</a>',
      'An estimate of what Revenue could pay back once the year has ended. It is not part of your monthly take-home pay.') : ''}
    ${hc(lb===null?(blank?'':'warn'):lb<=30?'good':'warn','Backup', lb===null?'None yet':lb<=0?'Today':lb+' days ago',
      lb===null||lb>30?'<a href="#" data-go="data">Download a backup</a> so nothing is lost.':'You are covered.',
      'Your data only exists in this browser. A downloaded backup protects you if it is ever cleared.')}
  </div>

  <div class="grid g2" style="margin-top:22px">
    <div class="card">
      ${cardHead('Coming up','Bills due and contracts ending soon')}
      ${upcoming.length ? `<div class="upnext"><ul>${upcoming.map(u=>`<li>
        <div class="when"><b>${u.date.getDate()}</b>${u.date.toLocaleDateString('en-IE',{month:'short'})}</div>
        <div style="flex:1;min-width:0"><b>${esc(u.name)}</b><div class="note" style="margin:0">${esc(u.note)}</div></div>
        ${u.amount?`<div class="num">${fmt(u.amount)}</div>`:''}</li>`).join('')}</ul></div>`
        : `<div class="empty">Nothing due in the next 30 days.<br><span class="note">Add <b>next payment</b> dates on the <a href="#" data-go="budget">Bills page</a> and they appear here.</span></div>`}
    </div>
    <div class="card">
      ${cardHead('Quick actions','Jump straight in')}
      <div class="actions-grid">
        <button class="action" data-go="budget"><span class="ai">🧾</span><span>Add a bill<small>Track what you spend</small></span></button>
        <button class="action" data-go="bank"><span class="ai">🏦</span><span>Import a statement<small>See real spending</small></span></button>
        <button class="action" data-go="reliefs"><span class="ai">🧮</span><span>Check tax credits<small>Claim what you are owed</small></span></button>
        <button class="action" data-go="savings"><span class="ai">🐖</span><span>Set a savings goal<small>Holiday, car, rainy day</small></span></button>
        <button class="action" id="printHome"><span class="ai">🖨️</span><span>Print or save as PDF<small>A one-page summary</small></span></button>
      </div>
    </div>
  </div>

  ${(Y.loans.length||mortPos.length||savingsTotal()) ? `<div class="grid g4" style="margin-bottom:16px">
    <div class="kpi"><div class="lbl">Savings today</div><div class="val">${fmt0(savingsTotal())}</div><div class="sub">${proj.length?'projected '+fmt0(projEnd)+' in '+(Y.savings.months||0)+' months':'add accounts on Savings'}</div></div>
    ${Y.loans.length?`<div class="kpi"><div class="lbl">Loans still to pay</div><div class="val">${fmt0(loanPos.reduce((s,p)=>s+p.balance+p.remainingInterest,0))}</div><div class="sub">${Y.loans.length} loan${Y.loans.length===1?'':'s'}, including interest</div></div>`:''}
    ${mortPos.length?`<div class="kpi"><div class="lbl">Mortgage balance</div><div class="val">${fmt0(mortPos.reduce((s,p)=>s+p.balance,0))}</div><div class="sub">${fmt0(mortPos.reduce((s,p)=>s+p.remainingInterest,0))} interest to term</div></div>`:''}
  </div>` : ''}

  <details class="plain" ${Y.txns.length?'open':''}>
    <summary>📊 Charts and spending trends ${Y.txns.length?'':'(import a bank statement to fill these in)'}</summary>
    <div class="grid g2" style="margin-top:12px">
      <div class="card"><h2>Budget vs actual (monthly)</h2>
        <div class="chartbox auto"><canvas id="cBudget"></canvas></div>
        ${legendHtml([{label:'Budget',color:PALETTE[0]},{label:'Actual',color:PALETTE[1]}])}
        ${top.length?'':'<div class="empty">Import a bank statement on the Spending page to compare against your budget.</div>'}</div>
      <div class="card"><h2>Where the money goes</h2>
        <div class="chartbox"><canvas id="cShare"></canvas></div><div id="shareLegend"></div></div>
      <div class="card"><h2>Spend by month</h2>
        <div class="chartbox"><canvas id="cMonthly"></canvas></div>
        ${legendHtml([{label:'Spend',color:PALETTE[2]},{label:'Budget',color:PALETTE[0]}])}</div>
      <div class="card"><h2>Savings projection</h2>
        <div class="chartbox"><canvas id="cSave"></canvas></div>
        <div class="note">${Y.savings.accounts.length? esc(Y.savings.accounts.map(a=>a.name).join(', ')) : 'Add accounts on the Savings page.'}</div></div>
    </div>
  </details>

  ${(()=>{ const a = attentionList(rows, Y.txns.filter(t=>!t.category).length);
     return a ? `<div class="card"><h2>Needs your attention</h2>${a}</div>` : ''; })()}`;

  if($('#homeDemo')) $('#homeDemo').onclick = ()=> loadDemoData(true);
  if($('#printHome')) $('#printHome').onclick = ()=> window.print();

  chart(()=>{
    hBars($('#cBudget'), top.map(r=>r.category), [
      {name:'Budget', color:PALETTE[0], values:top.map(r=>r.monthlyBudget)},
      {name:'Actual', color:PALETTE[1], values:top.map(r=>r.monthlyActual)}
    ]);
    const items = top.map((r,i)=>({label:r.category, value:r.spend, color:PALETTE[i%PALETTE.length]}));
    donut($('#cShare'), items, {caption:'spend'});
    $('#shareLegend').innerHTML = items.length? legendHtml(items) : '<div class="note">No categorised spend in the selected range.</div>';
    const byMonth = {};
    for(const t of txnsInRange()){
      const k = monthKey(parseDate(t.date));
      byMonth[k] = (byMonth[k]||0) + num(t.debit);
    }
    const mk = Object.keys(byMonth).sort();
    lineChart($('#cMonthly'), mk, [
      {name:'Spend', color:PALETTE[2], values:mk.map(k=>byMonth[k]), fill:true},
      {name:'Budget', color:PALETTE[0], values:mk.map(()=>bt.monthly+st.monthly), dash:true}
    ]);
    lineChart($('#cSave'), proj.map(r=>r.date.slice(0,7)), [
      {name:'Savings', color:PALETTE[5], values:proj.map(r=>r.total), fill:true}
    ]);
  });
}
function attentionList(rows, uncat){
  const out = [];
  const over = rows.filter(r=>r.budgetPeriod>0 && r.varPeriod>0).sort((a,b)=>b.varPeriod-a.varPeriod).slice(0,5);
  const expired = upcomingRenewals(60).filter(c=>c.days<0);
  if(expired.length) out.push(`<b>Contracts that have ended</b><ul style="margin:6px 0 12px">`+
    expired.map(c=>`<li>${esc(c.name||'unnamed')}${c.provider?' ('+esc(c.provider)+')':''} - ended ${-c.days} day${c.days===-1?'':'s'} ago. You may be on a higher price.</li>`).join('')+`</ul>`);
  if(over.length) out.push(`<b>Over budget in the analysis period</b><ul style="margin:6px 0 12px">`+
    over.map(r=>`<li>${esc(r.category)} - ${fmt(r.varPeriod)} over (${pct(r.usePct)} of budget)</li>`).join('')+`</ul>`);
  if(uncat) out.push(`<b>${uncat} transaction${uncat===1?'':'s'} without a category.</b> Add rules on the <a href="#" data-go="bank">Spending page</a>.`);
  return out.join('');
}

