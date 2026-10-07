/* ---------------- loans ---------------- */
function renderLoans(el){
  if(!Y.loans.length){
    el.innerHTML = `<div class="card">${emptyState('💳','No loans yet',
      'Add a car loan, credit union loan or personal loan to see what it really costs, and how much interest you save by paying a little extra. (Mortgages have their own page.)',
      '<button class="btn primary lg" id="addLoan">+ Add a loan</button>')}</div>`;
    $('#addLoan').onclick = addLoan; return;
  }
  /* each schedule is a full amortisation run, so work them out once here and reuse
     them in the rows, the summary and the chart below */
  const schedules = Y.loans.map(l=>{
    const prop = amortise(l,true);
    return {orig: amortise(l,false), prop, pos: loanPosition(l, prop)};
  });
  el.innerHTML = Y.loans.map((l,i)=>{
    const orig = schedules[i].orig, prop = schedules[i].prop, pos = schedules[i].pos;
    const calc = calcRepayment(l);
    const saveInt = orig.interest - prop.interest;
    const sooner = orig.payments - prop.payments;
    return `<div class="card">
      <div class="row" style="margin-bottom:10px">
        <label class="f" style="flex:1;min-width:160px"><span>Loan</span><input data-path="loans.${i}.name" value="${esc(l.name)}"></label>
        <button class="btn sm danger" data-del-loan="${i}">x</button>
      </div>
      <h3 class="sect">The loan</h3>
      <div class="grid g4">
        <label class="f"><span>Opening balance</span><input class="num" data-path="loans.${i}.opening" data-type="number" value="${num(l.opening)}"></label>
        <label class="f"><span>Interest rate %</span><input class="num" data-path="loans.${i}.rate" data-type="number" step="0.01" value="${num(l.rate)}"></label>
        <label class="f"><span>Frequency</span><select data-path="loans.${i}.freq">${Object.keys(FREQ).map(f=>`<option ${f===l.freq?'selected':''}>${f}</option>`).join('')}</select></label>
        <label class="f"><span>Start date</span><input type="date" data-path="loans.${i}.startDate" value="${esc(l.startDate||'')}"></label>
      </div>
      <h3 class="sect">What if you paid it off faster? ${ttHtml('Put a bigger repayment in "Proposed repayment" and the interest you would save appears below.')}</h3>
      <div class="grid g4">
        <label class="f"><span>Current repayment</span><input class="num" data-path="loans.${i}.repayment" data-type="number" value="${num(l.repayment)}"></label>
        <label class="f"><span>Proposed repayment</span><input class="num" data-path="loans.${i}.proposedRepayment" data-type="number" value="${num(l.proposedRepayment)}"></label>
        <label class="f"><span>Overpayment starts</span><input type="date" data-path="loans.${i}.proposedStart" value="${esc(l.proposedStart||'')}"></label>
        <label class="f"><span>Target end date</span><input type="date" data-path="loans.${i}.endDate" value="${esc(l.endDate||'')}"></label>
      </div>
      ${calc? `<div class="note">To clear by the target date the repayment would need to be <b>${fmt(calc)}</b> per ${esc(String(l.freq).toLowerCase().replace('ly',''))}.</div>`:''}
      ${l.proposedStart? `<div class="note">Normal repayments up to ${esc(l.proposedStart)}, then ${fmt(num(l.proposedRepayment)||num(l.repayment))} from that date on.</div>`:''}

      <div class="grid g4" style="margin:12px 0">
        <div class="kpi"><div class="lbl">Owed today</div><div class="val">${fmt0(pos.balance)}</div>
          <div class="sub">${pos.cleared?'cleared':'+ '+fmt0(pos.remainingInterest)+' interest to come'}</div></div>
        <div class="kpi"><div class="lbl">Still to pay</div><div class="val">${fmt0(pos.toPay)}</div>
          <div class="sub">${pos.payments} payment${pos.payments===1?'':'s'} left${pos.next?', next '+esc(pos.next):''}</div></div>
        <div class="kpi"><div class="lbl">Interest - current</div><div class="val">${fmt0(orig.interest)}</div><div class="sub">${orig.payments} payments to ${orig.end}</div></div>
        <div class="kpi"><div class="lbl">Interest - proposed</div><div class="val">${fmt0(prop.interest)}</div><div class="sub">${prop.payments} payments to ${prop.end}</div></div>
        <div class="kpi"><div class="lbl">Interest saved</div><div class="val ${saveInt>0?'pos':''}">${fmt0(saveInt)}</div><div class="sub">${sooner>0?sooner+' payments sooner':'no change'}</div></div>
        <div class="kpi"><div class="lbl">Total to pay</div><div class="val">${fmt0(prop.paid)}</div><div class="sub">was ${fmt0(orig.paid)}</div></div>
      </div>

      <div class="chartbox" style="height:280px"><canvas id="cLoan${i}"></canvas></div>
      ${legendHtml([{label:'Current schedule',color:PALETTE[2]},{label:'Proposed',color:PALETTE[0]}])}

      <details style="margin-top:10px"><summary>Schedule &amp; one-off overpayments (${prop.rows.length} rows)</summary>
        <div class="tw" style="max-height:340px;overflow:auto;margin-top:8px"><table>
          <thead><tr><th class="n">#</th><th>Date</th><th class="n">Opening</th><th class="n">Interest</th>
            <th class="n">Principal</th><th class="n">Payment</th><th class="n">Balance</th><th class="n">Extra</th></tr></thead>
          <tbody>${prop.rows.map(r=>`<tr>
            <td class="n">${r.n}</td><td>${r.date}</td><td class="n">${fmt(r.opening)}</td>
            <td class="n">${fmt(r.interest)}</td><td class="n">${fmt(r.principal)}</td>
            <td class="n">${fmt(r.payment)}</td><td class="n">${fmt(r.balance)}</td>
            <td class="n"><input class="num" style="text-align:right;width:80px" data-extra="${i}.${r.n}" value="${num((l.extras||{})[r.n])||''}"></td>
          </tr>`).join('')}</tbody>
        </table></div>
      </details>
      <div class="row" style="margin-top:10px">
        <button class="btn sm" data-export-loan="${i}">Export schedule CSV</button>
      </div>
    </div>`;
  }).join('') + `<button class="btn primary" id="addLoan">+ Add loan</button>`;

  wireFields(el);
  $('#addLoan').onclick = addLoan;
  $$('[data-del-loan]',el).forEach(x=> x.onclick=()=>{ Y.loans.splice(+x.dataset.delLoan,1); save(); render(); });
  $$('[data-extra]',el).forEach(x=> x.onchange=()=>{
    const [li,n] = x.dataset.extra.split('.');
    const l = Y.loans[+li]; l.extras = l.extras||{};
    const v = num(x.value);
    if(v) l.extras[n]=v; else delete l.extras[n];
    save(); render();
  });
  $$('[data-export-loan]',el).forEach(x=> x.onclick=()=>{
    const l = Y.loans[+x.dataset.exportLoan];
    downloadCSV(slug(l.name)+'-schedule.csv', loanCSV(l));
  });
  Y.loans.forEach((l,i)=> chart(()=>{
    const o = schedules[i].orig, p = schedules[i].prop;
    const n = Math.max(o.rows.length, p.rows.length);
    const labels = Array.from({length:n},(_,k)=> (o.rows[k]||p.rows[k]).date.slice(0,7));
    const pad = (rows)=> Array.from({length:n},(_,k)=> rows[k]? rows[k].balance : 0);
    lineChart($('#cLoan'+i), labels, [
      {name:'Current', color:PALETTE[2], values:pad(o.rows)},
      {name:'Proposed', color:PALETTE[0], values:pad(p.rows), fill:true}
    ]);
  }));
}
function addLoan(){
  Y.loans.push({id:uid(), name:'New loan', opening:0, rate:5, freq:'Monthly',
    repayment:0, proposedRepayment:0, startDate:iso(new Date()), endDate:'', extras:{}});
  save(); render();
}

