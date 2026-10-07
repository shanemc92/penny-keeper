/* ---------------- mortgage ---------------- */
function renderMortgage(el){
  const list = Y.mortgages || (Y.mortgages = []);
  if(!list.length){
    el.innerHTML = `<div class="card">${emptyState('🏡','No mortgage yet',
      'Add your mortgage to see your balance, what happens when your fixed rate ends, and how much you save by overpaying. Have your offer letter or latest statement to hand.',
      '<button class="btn primary lg" id="addMortgage">+ Add my mortgage</button>')}</div>`;
    $('#addMortgage').onclick = addMortgage;
    return;
  }
  /* Statements and lump sums get entered in whatever order you find them, but they only
     make sense read down the page in date order - and the engine sorts them anyway, so
     an unsorted table just disagrees with the schedule below it. Sort the real arrays
     rather than a copy, because the row inputs address records by index. A row whose
     date has been cleared sorts last instead of jumping to the top mid-edit. */
  const byDate = (a,b)=>{
    const x = (a && a.date) || '9999', y = (b && b.date) || '9999';
    return x < y ? -1 : x > y ? 1 : 0;
  };
  list.forEach(m=>{
    if(Array.isArray(m.statements)) m.statements.sort(byDate);
    if(Array.isArray(m.lumps)) m.lumps.sort(byDate);
  });

  /* each of these is a full run through the life of the mortgage, so do them once
     here and reuse them in the KPIs, the rate table, the chart and the schedule */
  const calcs = list.map(m=>{
    const sch = mortgageSchedule(m);
    return {sch, base: mortgageSchedule(m,{noExtra:true}), pos: mortgagePosition(m,sch),
            warn: fixedOverpayWarnings(m, sch)};
  });

  el.innerHTML = list.map((m,i)=>{
    const sch = calcs[i].sch, base = calcs[i].base, pos = calcs[i].pos, warn = calcs[i].warn;
    const term = clamp(Math.round(num(m.termMonths)),0,1200);
    const rs = mortRates(m);
    const savedInt = round2(base.interest - sch.interest);
    const sooner = base.payments - sch.payments;
    const outlay = pos.outlay;
    /* the first actual payment on or after the step - statement rows carry no payment,
       so landing on one shows a repayment of nothing, which a rate starting in the
       drawdown month otherwise does every time */
    const stepAt = from =>{
      const d = parseDate(from); if(!d) return null;
      return sch.rows.find(r=> !r.statement && parseDate(r.date) >= d) || null;
    };
    return `<div class="card">
      <div class="row" style="margin-bottom:10px">
        <label class="f" style="flex:1;min-width:150px"><span>Mortgage</span>
          <input data-path="mortgages.${i}.name" value="${esc(m.name)}"></label>
        <label class="f" style="flex:1;min-width:110px"><span>Lender</span>
          <input data-path="mortgages.${i}.lender" value="${esc(m.lender||'')}" placeholder="AIB"></label>
        <button class="btn sm danger" data-del-mortgage="${i}" title="Remove">x</button>
      </div>
      <h3 class="sect">The mortgage</h3>
      <div class="grid g4">
        <label class="f"><span>Amount borrowed</span><input class="num" data-path="mortgages.${i}.principal" data-type="number" value="${num(m.principal)}"></label>
        <label class="f"><span>Drawdown date</span><input type="date" data-path="mortgages.${i}.startDate" value="${esc(m.startDate||'')}"></label>
        <label class="f"><span>Term - years</span><input class="num" data-term="${i}.years" value="${Math.floor(term/12)}"></label>
        <label class="f"><span>Term - extra months</span><input class="num" data-term="${i}.months" value="${term%12}"></label>
        <label class="f"><span>Property value</span><input class="num" data-path="mortgages.${i}.propertyValue" data-type="number" value="${num(m.propertyValue)}"></label>
      </div>
      <h3 class="sect">Overpaying? ${ttHtml('Paying more than you have to shortens the mortgage and cuts the interest. Enter a monthly amount and the date it starts.')}</h3>
      <div class="grid g4">
        <label class="f"><span>Overpayment / month</span><input class="num" data-path="mortgages.${i}.overpayMonthly" data-type="number" value="${num(m.overpayMonthly)}"></label>
        <label class="f"><span>Overpayment starts</span><input type="date" data-path="mortgages.${i}.overpayFrom" value="${esc(m.overpayFrom||'')}"></label>
      </div>
      <div>
      <h3 class="sect">Lender details ${ttHtml('Optional. Fill these in from your statement for a more accurate picture, or leave them as they are.')}</h3>
      <div class="grid g4">
        <label class="f"><span>Repayment now (statement)</span><input class="num" data-path="mortgages.${i}.repayment" data-type="number" value="${num(m.repayment)}"></label>
        <label class="f"><span>Insurance / month</span><input class="num" data-path="mortgages.${i}.insuranceMonthly" data-type="number" value="${num(m.insuranceMonthly)}"></label>
        <label class="f"><span>Interest charged</span><select data-path="mortgages.${i}.basis">${MORT_BASIS_ORDER.map(b=>
          `<option value="${b}" ${b===basisOf(m)?'selected':''}>${MORT_BASES[b]}</option>`).join('')}</select></label>
        <label class="f"><span>Fixed overpay allowance %</span><input class="num" data-path="mortgages.${i}.allowancePct" data-type="number" step="0.5" value="${num(m.allowancePct)}"></label>
      </div></div>
      <div class="note">${term? Math.floor(term/12)+'y '+(term%12)+'m term':'Set a term'}${
        pos.originalEnd? ', contracted to end '+esc(pos.originalEnd):''}. Leave the repayment at 0 to have it
        worked out from the rate and the term - set it to the figure on your statement once you are mid-mortgage,
        because after overpayments the lender keeps collecting the contractual amount rather than a re-solved one.</div>

      <div class="grid g4" style="margin:12px 0">
        <div class="kpi"><div class="lbl">Balance today</div><div class="val">${fmt0(pos.balance)}</div>
          <div class="sub">${pos.cleared?'cleared':'of '+fmt0(num(m.principal))+' borrowed'}</div></div>
        <div class="kpi"><div class="lbl">Repayment</div><div class="val">${fmt0(pos.nextPayment)}</div>
          <div class="sub">${ratePct(pos.rate)} ${esc(RATE_KINDS[pos.kind]||pos.kind||'')}${pos.next?', next '+esc(pos.next):''}</div></div>
        <div class="kpi"><div class="lbl">Leaves the account</div><div class="val">${fmt0(outlay)}</div>
          <div class="sub">${num(m.insuranceMonthly)>0? fmt0(pos.nextPayment)+' + '+fmt(num(m.insuranceMonthly))+' insurance' : 'no insurance with it'}</div></div>
        <div class="kpi"><div class="lbl">Interest still to pay</div><div class="val">${fmt0(pos.remainingInterest)}</div>
          <div class="sub">${fmt0(pos.paidInterest)} charged so far</div></div>
        <div class="kpi"><div class="lbl">Total cost of credit</div><div class="val">${fmt0(sch.interest)}</div>
          <div class="sub">${fmt0(num(m.principal)+sch.interest)} repaid in all</div></div>
        <div class="kpi"><div class="lbl">Paid off by</div><div class="val">${esc(sch.end?sch.end.slice(0,7):'-')}</div>
          <div class="sub">${pos.monthsSooner>0? pos.monthsSooner+' months early':'as contracted'}</div></div>
        <div class="kpi"><div class="lbl">Interest saved</div><div class="val ${savedInt>0?'pos':''}">${fmt0(savedInt)}</div>
          <div class="sub">${sooner>0? sooner+' payments sooner':'nothing overpaid'}</div></div>
        ${num(m.propertyValue)>0? `<div class="kpi"><div class="lbl">Loan to value</div><div class="val">${pct(pos.ltv)}</div>
          <div class="sub">on ${fmt0(num(m.propertyValue))}</div></div>`:''}
      </div>

      <h3 style="margin:16px 0 6px;font-size:14px">Interest rate schedule</h3>
      <div class="tw"><table>
        <thead><tr><th>From</th><th class="n">Rate %</th><th>Type</th><th>Until</th>
          <th class="n">Balance then</th><th class="n">Repayment</th><th></th></tr></thead>
        <tbody>${rs.length? rs.map((r,ri)=>{
          const idx = (m.rates||[]).indexOf(r), nxt = rs[ri+1], st = stepAt(r.from);
          return `<tr>
            <td><input type="date" data-path="mortgages.${i}.rates.${idx}.from" value="${esc(r.from||'')}" style="min-width:140px"></td>
            <td class="n"><input class="num" style="text-align:right;width:80px" data-path="mortgages.${i}.rates.${idx}.rate" data-type="number" step="0.01" value="${num(r.rate)}"></td>
            <td><select data-path="mortgages.${i}.rates.${idx}.kind">${Object.keys(RATE_KINDS).map(k=>
              `<option value="${k}" ${k===r.kind?'selected':''}>${RATE_KINDS[k]}</option>`).join('')}</select></td>
            <td class="mut">${nxt? esc(nxt.from):'end of term'}</td>
            <td class="n">${st? fmt0(st.opening):'-'}</td>
            <td class="n">${st? fmt0(st.payment):'-'}</td>
            <td class="act">${rs.length>1?`<button class="btn sm danger" data-del-rate="${i}.${idx}">x</button>`:''}</td></tr>`;
        }).join('') : `<tr><td colspan="7" class="empty">Add the rate you drew down on.</td></tr>`}</tbody>
      </table></div>
      <div class="row" style="margin-top:8px">
        <button class="btn sm" data-add-rate="${i}">+ Add rate change</button>
        <span class="note" style="margin:0">Each row runs from its date until the next one starts. Put the
          follow-on rate in now, dated the day your fix ends, and the repayment column tells you what it becomes.</span>
      </div>
      ${warn.length? `<div class="note" style="color:var(--warn);border-color:var(--warn)">
        The overpayments above go past the ${pct(num(m.allowancePct))} a year this fixed rate allows in
        ${warn.map(w=> esc(w.year)+' ('+fmt0(w.extra)+' against '+fmt0(w.allowed)+')').join(', ')}.
        That usually triggers a break funding fee, and the amount depends on funding rates on the day, so check
        your loan offer - nothing above accounts for one.</div>`:''}

      <div class="chartbox" style="height:280px"><canvas id="cMort${i}"></canvas></div>
      ${legendHtml([{label:'No overpayments',color:PALETTE[2]},{label:'Plan',color:PALETTE[0]}])}

      <h3 style="margin:16px 0 6px;font-size:14px">Statements <span class="pill">${(m.statements||[]).length}</span></h3>
      <div class="tw"><table>
        <thead><tr><th>Date</th><th class="n">Balance on it</th><th class="n">Adjustment</th>
          <th class="n">Interest on it</th><th class="n">We modelled</th>
          <th class="n">Paid on it</th><th class="n">We modelled</th><th>Note</th><th></th></tr></thead>
        <tbody>${(m.statements||[]).length? (m.statements||[]).map((s,si)=>{
          const row = sch.rows.find(r=> r.statement && s.date && r.date===iso(parseDate(s.date)));
          const adj = row ? row.adjust : null;
          const gap = (row && !blankish(s.interest)) ? round2(num(s.interest) - row.periodInterest) : null;
          return `<tr>
            <td><input type="date" data-path="mortgages.${i}.statements.${si}.date" value="${esc(s.date||'')}" style="min-width:140px"></td>
            <td class="n"><input class="num" style="text-align:right;width:100px" data-path="mortgages.${i}.statements.${si}.balance" value="${esc(s.balance??'')}" placeholder="off the statement"></td>
            <td class="n ${adj===null||!row?'mut':(Math.abs(adj)<50?'pos':'neg')}">${row? (adj? fmt(adj):'-') : '-'}</td>
            <td class="n"><input class="num" style="text-align:right;width:90px" data-path="mortgages.${i}.statements.${si}.interest" value="${esc(s.interest??'')}" placeholder="optional"></td>
            <td class="n mut">${row? fmt(row.periodInterest) : '-'}${gap!==null&&Math.abs(gap)>=1?` <span class="${Math.abs(gap)<50?'':'neg'}">(${gap>0?'+':''}${fmt(gap)})</span>`:''}</td>
            <td class="n"><input class="num" style="text-align:right;width:90px" data-path="mortgages.${i}.statements.${si}.amount" value="${esc(s.amount??'')}" placeholder="optional"></td>
            <td class="n mut">${row? fmt(row.periodPaid) : '-'}</td>
            <td><input data-path="mortgages.${i}.statements.${si}.note" value="${esc(s.note||'')}"></td>
            <td class="act"><button class="btn sm danger" data-del-stmt="${i}.${si}">x</button></td></tr>`;
        }).join('') : `<tr><td colspan="9" class="empty">None yet. A statement is a reading, not a payment - the
          monthly payments are modelled either way. Put in the balance off each one and the schedule is pinned to
          what the lender actually says, once a year is plenty.</td></tr>`}</tbody>
      </table></div>
      <div class="row" style="margin-top:8px">
        <button class="btn sm" data-add-stmt="${i}">+ Add statement</button>
        <span class="note" style="margin:0">Only the date and the balance matter. Everything since the statement
          before it is adjusted onto that balance, so an annual statement is enough to keep years of modelling
          honest - the adjustment column is the drift it took out. Interest and paid are optional, purely to check
          the model against. If the interest comes out the same amount off every year, that is the wrong
          "interest charged" setting above rather than an error - try the other one and watch this column.</span>
      </div>

      <h3 style="margin:16px 0 6px;font-size:14px">Lump sums</h3>
      <div class="tw"><table>
        <thead><tr><th>Date</th><th class="n">Amount</th><th>Note</th><th></th></tr></thead>
        <tbody>${(m.lumps||[]).length? (m.lumps||[]).map((l,lx)=>`<tr>
          <td><input type="date" data-path="mortgages.${i}.lumps.${lx}.date" value="${esc(l.date||'')}" style="min-width:140px"></td>
          <td class="n"><input class="num" style="text-align:right;width:100px" data-path="mortgages.${i}.lumps.${lx}.amount" data-type="number" value="${num(l.amount)}"></td>
          <td><input data-path="mortgages.${i}.lumps.${lx}.note" value="${esc(l.note||'')}" placeholder="Bonus"></td>
          <td class="act"><button class="btn sm danger" data-del-lump="${i}.${lx}">x</button></td></tr>`).join('')
          : `<tr><td colspan="4" class="empty">None. A lump sum comes off the balance on its own date, so it
            starts saving interest from that day rather than at the end of the month.</td></tr>`}</tbody>
      </table></div>
      <div class="row" style="margin-top:8px">
        <button class="btn sm" data-add-lump="${i}">+ Add lump sum</button>
        <span class="note" style="margin:0">A lump comes off the balance on its own date. If it landed before a
          statement you have entered, that statement's balance already reflects it either way.</span>
      </div>

      <details style="margin-top:12px"><summary>Full schedule - ${sch.payments} payments,
        ${sch.anchors} statement${sch.anchors===1?'':'s'}${sch.anchors?', '+fmt(sch.adjusted)+' adjusted in total':''}</summary>
        <div class="tw" style="max-height:340px;overflow:auto;margin-top:8px"><table>
          <thead><tr><th class="n">#</th><th>Date</th><th></th><th class="n">Rate</th><th class="n">Opening</th>
            <th class="n">Interest</th><th class="n">Principal</th><th class="n">Payment</th>
            ${num(m.insuranceMonthly)>0?'<th class="n">Out</th>':''}
            <th class="n">Extra</th><th class="n">Balance</th></tr></thead>
          <tbody>${sch.rows.map(r=>`<tr>
            <td class="n">${r.n}</td><td>${esc(r.date)}</td>
            <td>${r.statement?`<span class="pill on">statement${r.adjust?' '+(r.adjust>0?'+':'')+fmt(r.adjust):''}</span>`:''}${r.stalled?'<span class="pill" style="border-color:var(--bad);color:var(--bad)">short</span>':''}</td>
            <td class="n mut">${ratePct(r.rate)}</td><td class="n">${fmt(r.opening)}</td>
            <td class="n">${fmt(r.interest)}</td><td class="n">${r.statement?'':fmt(r.principal)}</td>
            <td class="n">${r.statement?'':fmt(r.payment)}</td>
            ${num(m.insuranceMonthly)>0?`<td class="n mut">${r.statement?'':fmt(r.payment+num(r.insurance))}</td>`:''}
            <td class="n">${r.extra?fmt(r.extra):''}</td>
            <td class="n">${fmt(r.balance)}</td></tr>`).join('')}</tbody>
        </table></div>
      </details>
      ${sch.stalled? `<div class="note" style="color:var(--bad)">At that point the repayment stops covering the
        interest, so the balance stops falling - check the rate schedule and the repayment figure.</div>`:''}
      <div class="row" style="margin-top:10px">
        <button class="btn sm" data-export-mort="${i}">Export schedule CSV</button>
        <span class="note" style="margin:0">Nothing here feeds the Bills &amp; budget page - add the repayment there as a bill
          if you want it in the household budget.</span>
      </div>
    </div>`;
  }).join('') + `<button class="btn primary" id="addMortgage">+ Add mortgage</button>`;

  wireFields(el);
  $('#addMortgage').onclick = addMortgage;
  $$('[data-del-mortgage]',el).forEach(x=> x.onclick=()=>{
    const i = +x.dataset.delMortgage;
    if(!confirm('Delete '+(list[i].name||'this mortgage')+', including its statement history?')) return;
    list.splice(i,1); save(); render();
  });
  /* years and months are two boxes over one stored figure, so each one has to read
     the other half back off the total it is editing */
  $$('[data-term]',el).forEach(x=> x.onchange=()=>{
    const parts = x.dataset.term.split('.');
    const m = list[+parts[0]], t = clamp(Math.round(num(m.termMonths)),0,1200);
    const years = parts[1]==='years' ? Math.max(0,Math.round(num(x.value))) : Math.floor(t/12);
    const months = parts[1]==='months' ? Math.max(0,Math.round(num(x.value))) : t%12;
    m.termMonths = clamp(years*12+months, 1, 1200);
    save(); render();
  });
  $$('[data-add-rate]',el).forEach(x=> x.onclick=()=>{
    const m = list[+x.dataset.addRate];
    const rs = mortRates(m), last = rs[rs.length-1];
    /* a new step lands a year after the last one - roughly where a fix rolls off, and
       the date is the first thing you change anyway */
    const from = (last && last.from) ? iso(addMonths(parseDate(last.from),12)) : iso(new Date());
    m.rates.push({id:uid(), from, rate: last? num(last.rate):3.9, kind:'variable'});
    save(); render();
  });
  $$('[data-del-rate]',el).forEach(x=> x.onclick=()=>{
    const p = x.dataset.delRate.split('.').map(Number);
    list[p[0]].rates.splice(p[1],1); save(); render();
  });
  $$('[data-add-stmt]',el).forEach(x=> x.onclick=()=>{
    const m = list[+x.dataset.addStmt];
    m.statements = m.statements||[];
    /* a year on from the last one, since annual is what most lenders send - the balance
       is the only field worth filling in, so everything else starts blank */
    const prev = (m.statements||[]).map(s=>s.date).filter(Boolean).sort().pop();
    const date = prev ? iso(addMonths(parseDate(prev),12)) : iso(new Date());
    m.statements.push({id:uid(), date, amount:'', interest:'', balance:'', note:''});
    save(); render();
  });
  $$('[data-del-stmt]',el).forEach(x=> x.onclick=()=>{
    const p = x.dataset.delStmt.split('.').map(Number);
    list[p[0]].statements.splice(p[1],1); save(); render();
  });
  $$('[data-add-lump]',el).forEach(x=> x.onclick=()=>{
    const m = list[+x.dataset.addLump];
    m.lumps = m.lumps||[];
    m.lumps.push({id:uid(), date: iso(new Date()), amount:0, note:''});
    save(); render();
  });
  $$('[data-del-lump]',el).forEach(x=> x.onclick=()=>{
    const p = x.dataset.delLump.split('.').map(Number);
    list[p[0]].lumps.splice(p[1],1); save(); render();
  });
  $$('[data-export-mort]',el).forEach(x=> x.onclick=()=>{
    const m = list[+x.dataset.exportMort];
    downloadCSV(slug(m.name||'mortgage')+'-schedule.csv', mortgageCSV(m));
  });
  list.forEach((m,i)=> chart(()=>{
    const s = calcs[i].sch, b = calcs[i].base;
    const n = Math.max(s.rows.length, b.rows.length);
    if(!n) return;
    const labels = Array.from({length:n},(_,k)=> (s.rows[k]||b.rows[k]).date.slice(0,7));
    const pad = rows => Array.from({length:n},(_,k)=> rows[k]? rows[k].balance : 0);
    lineChart($('#cMort'+i), labels, [
      {name:'No overpayments', color:PALETTE[2], values:pad(b.rows)},
      {name:'Plan', color:PALETTE[0], values:pad(s.rows), fill:true}
    ]);
  }));
}
function addMortgage(){
  (Y.mortgages || (Y.mortgages=[])).push(blankMortgage());
  save(); render();
}

