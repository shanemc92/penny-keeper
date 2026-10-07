/* ---------------- take-home pay (tax) ---------------- */
const raiseState = {};   // view state only: the "what if" amounts, never saved
const REVENUE_CHART = 'https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/tax-relief-charts/index.aspx';
const REVENUE_HOME = 'https://www.revenue.ie/en/personal-tax-credits-reliefs-and-exemptions/index.aspx';

/* one line under the rate band choice saying what band actually applies */
function bandNote(p, b){
  const eff = effectiveSrcop(p, b);
  let t = fmt0(eff)+' is taxed at '+(b.lowRate*100).toFixed(0)+'%, the rest at '+(b.highRate*100).toFixed(0)+'%.';
  if(p.status==='married2'){
    const mates = Y.people.filter(q=> q.id!==p.id && q.status==='married2');
    if(mates.length!==1) t += ' Give your partner the same setting so the couple\'s band is shared properly.';
    else if(eff > num(b.srcopSingle)) t += ' That includes '+fmt0(eff-num(b.srcopSingle))+' of band your partner cannot use.';
  }
  return t;
}
function resetTaxYear(){
  const p = presetFor(Y.year);
  Y.taxBands = p;
  Y.people.forEach(pp=>{
    const st = BAND_STATUS[pp.status];
    if(st && st.pick) pp.srcop = st.pick(p);
    refreshCredits(pp, Y.year);
  });
  save(); render(); toast('Reset to the '+Y.year+' figures');
}

function renderTax(el){
  const b = Y.taxBands;
  const lib = creditLibrary(Y.year);
  const H = household();
  const differs = taxBandsDiffer(b, presetFor(Y.year));

  const cards = Y.people.map((p,i)=>{
    const t = calcTax(p,b);
    const status = p.status || guessStatus(p,b);
    const deducts = t.paye + t.prsi + t.usc + t.pension + t.avc;
    const base = Math.max(t.gross, 1);
    const seg = (v,c,l)=> v>0 ? `<i style="width:${v/base*100}%;background:${c}" title="${l}: ${fmt0(v)}"></i>` : '';
    const keep = t.gross>0 ? t.net/t.gross*100 : 0;
    const addable = lib.filter(c=> !(p.credits||[]).some(x=>creditMatches(c,x.name)));
    const raise = raiseState[p.id]||0;
    const mr = marginalRate(p);
    const chk = personalCheck(p);
    const ptype = p.personalType || defaultPersonalType(status);
    return `<div class="card">
      <div class="card-h">
        <span class="avatar" aria-hidden="true">${esc((p.name||'?').trim().charAt(0).toUpperCase()||'?')}</span>
        <label class="f" style="margin:0;flex:1;min-width:150px;max-width:300px"><span class="sr">Name</span>
          <input data-path="people.${i}.name" value="${esc(p.name)}" aria-label="Name" style="font-weight:650;font-size:16px"></label>
        <div class="actions">${Y.people.length>1?`<button class="btn sm danger" data-del-person="${i}">Remove</button>`:''}</div>
      </div>

      <div class="grid g3">
        <label class="f"><span>Yearly salary (before tax)</span>
          <input class="num" data-path="people.${i}.gross" data-type="number" inputmode="decimal" value="${num(p.gross)||''}" placeholder="e.g. 55000">
          <div class="hint">${num(p.gross)>0 && num(p.gross)<7000 ? '<b class="amb">That looks like a monthly figure - enter the yearly amount (monthly &times; 12).</b>' : 'The yearly figure on your contract or payslip.'}</div></label>
        <label class="f"><span>Rate band for your situation</span>
          <select data-status="${i}">${Object.entries(BAND_STATUS).map(([k,v])=>`<option value="${k}" ${status===k?'selected':''}>${esc(v.label)}</option>`).join('')}</select>
          <div class="hint">${esc(bandNote(p,b))}</div></label>
        <label class="f"><span>Pension (% of salary)</span>
          <input class="num" data-path="people.${i}.pensionPct" data-type="number" inputmode="decimal" step="0.5" value="${num(p.pensionPct)||''}" placeholder="0">
          <div class="hint">Your workplace pension contribution.</div></label>
      </div>
      <div class="grid g4">
        <label class="f"><span>AVC</span>
          <div style="display:flex;gap:6px"><input class="num" style="min-width:0" data-path="people.${i}.${p.avcMode==='percent'?'avcPct':'avcMonthly'}" data-type="number" inputmode="decimal" step="${p.avcMode==='percent'?'0.5':'1'}" value="${num(p.avcMode==='percent'?p.avcPct:p.avcMonthly)||''}" placeholder="0">
            <select data-path="people.${i}.avcMode" aria-label="AVC: set amount or percentage" style="width:auto;flex:none"><option value="amount" ${p.avcMode==='percent'?'':'selected'}>${esc(CUR)} a month</option><option value="percent" ${p.avcMode==='percent'?'selected':''}>% of gross</option></select></div>
          ${avcYearly(p)>0 ? `<div class="hint">${p.avcMode==='percent' ? '= '+fmt(avcYearly(p)/12)+' a month' : (num(p.gross)>0 ? '= '+pct(avcYearly(p)/num(p.gross)*100)+' of gross' : '')}</div>` : ''}</label>
        <label class="f"><span>BIK / month</span><input class="num" data-path="people.${i}.bikMonthly" data-type="number" value="${num(p.bikMonthly)||''}" placeholder="0"></label>
        <label class="f"><span>Bonus (gross)</span><input class="num" data-path="people.${i}.bonus" data-type="number" value="${num(p.bonus)||''}" placeholder="0"></label>
        ${status==='custom'?`<label class="f"><span>Standard rate band</span><input class="num" data-path="people.${i}.srcop" data-type="number" value="${num(p.srcop)}"></label>`:''}
      </div>

      ${t.gross>0 ? `
      <div class="grid g4" style="margin:6px 0 14px">
        <div class="kpi"><div class="lbl" data-nott>Take-home per month</div><div class="val pos">${fmt0(t.netMonthly)}</div><div class="sub">${fmt0(t.net/52)} a week</div></div>
        <div class="kpi"><div class="lbl" data-nott>Take-home per year</div><div class="val">${fmt0(t.net)}</div><div class="sub">from ${fmt0(t.gross)} before tax</div></div>
        <div class="kpi"><div class="lbl" data-nott>You keep</div><div class="val">${keep.toFixed(0)}c</div><div class="sub">of every €1 you earn</div></div>
        ${t.refund>0.5?`<div class="kpi"><div class="lbl" data-nott>Refund after the year</div><div class="val pos">${fmt0(t.refund)}</div><div class="sub">credits claimed on your tax return - not in take-home</div></div>`:''}
      </div>
      <div class="stack" aria-label="Where your pay goes">
        ${seg(t.paye,PALETTE[2],'Income tax')}${seg(t.prsi,PALETTE[1],'PRSI')}${seg(t.usc,PALETTE[4],'USC')}${seg(t.pension+t.avc,PALETTE[3],'Pension')}${seg(Math.max(t.net,0),PALETTE[5],'Take-home')}
      </div>
      <div class="legend">
        <span><i style="background:${PALETTE[2]}"></i>Income tax<b>${fmt0(t.paye)}</b></span>
        <span><i style="background:${PALETTE[1]}"></i>PRSI<b>${fmt0(t.prsi)}</b></span>
        <span><i style="background:${PALETTE[4]}"></i>USC<b>${fmt0(t.usc)}</b></span>
        ${deducts-t.paye-t.prsi-t.usc>0?`<span><i style="background:${PALETTE[3]}"></i>Pension<b>${fmt0(t.pension+t.avc)}</b></span>`:''}
        <span><i style="background:${PALETTE[5]}"></i>Take-home<b>${fmt0(t.net)}</b></span>
      </div>` : `<div class="callout info" style="margin-top:4px"><div class="ci">☝️</div><div class="cb">Enter a yearly salary above to see your take-home pay.</div></div>`}

      <details class="more"><summary>Show the full calculation</summary>
        <div class="tw"><table>
          <thead><tr><th>Step</th><th class="n">Per year</th><th class="n">Per month</th></tr></thead>
          <tbody>
            <tr><td>Pay before tax${t.bik?' (including benefit-in-kind)':''}</td><td class="n">${fmt(t.grossPay)}</td><td class="n mut">${fmt(t.grossPay/12)}</td></tr>
            <tr><td>Pension + AVC</td><td class="n">${fmt(t.pension+t.avc)}</td><td class="n mut">${fmt((t.pension+t.avc)/12)}</td></tr>
            <tr><td>Taxable pay</td><td class="n">${fmt(t.taxable)}</td><td class="n mut">${fmt(t.taxable/12)}</td></tr>
            <tr><td>Tax at ${(b.lowRate*100).toFixed(0)}% (on the first ${fmt0(t.srcop)})</td><td class="n">${fmt(t.tax20)}</td><td class="n mut">${fmt(t.tax20/12)}</td></tr>
            <tr><td>Tax at ${(b.highRate*100).toFixed(0)}%</td><td class="n">${fmt(t.tax40)}</td><td class="n mut">${fmt(t.tax40/12)}</td></tr>
            <tr><td>Less tax credits</td><td class="n">-${fmt(Math.min(t.credits, t.liability))}</td><td class="n mut">-${fmt(Math.min(t.credits, t.liability)/12)}</td></tr>
            <tr><td><b>Income tax (PAYE)</b></td><td class="n"><b>${fmt(t.paye)}</b></td><td class="n mut">${fmt(t.paye/12)}</td></tr>
            <tr><td>PRSI</td><td class="n">${fmt(t.prsi)}</td><td class="n mut">${fmt(t.prsi/12)}</td></tr>
            <tr><td>USC</td><td class="n">${fmt(t.usc)}</td><td class="n mut">${fmt(t.usc/12)}</td></tr>
            <tr><td>Total deductions</td><td class="n neg">${fmt(t.deductions)}</td><td class="n mut">${fmt(t.deductions/12)}</td></tr>
          </tbody>
          <tfoot><tr><td>Take-home pay</td><td class="n pos">${fmt(t.net)}</td><td class="n pos">${fmt(t.netMonthly)}</td></tr>
            <tr><td>Overall tax rate</td><td class="n">${pct(t.effective)}</td><td></td></tr></tfoot>
        </table></div>
      </details>

      <h3 style="margin:18px 0 6px;font-size:15px">Tax credits for ${esc(Y.year)} ${ttHtml('Credits come straight off your tax bill. Everyone gets a personal credit and employees also get the Employee credit. The figures here follow Revenue\'s published amounts, but your own Tax Credit Certificate is what counts.')}</h3>
      <div class="callout warn" style="margin:6px 0 10px"><div class="ci">🔎</div><div class="cb"><b class="ct">Confirm these on revenue.ie</b>
        Credit amounts are filled in from Revenue's published tables and the Budget. Check them against your <b>Tax Credit Certificate</b> in myAccount and the
        <a href="${REVENUE_CHART}" target="_blank" rel="noopener">Revenue rates and reliefs chart</a>.${Y.year>=2027?' Some '+Y.year+' amounts are not published yet and carry the previous year\'s figure.':''}</div></div>
      <label class="f" style="max-width:520px"><span>Which personal credit applies to you?</span>
        <select data-ptype="${i}">${Object.entries(PERSONAL_TYPES).map(([k,v])=>`<option value="${k}" ${ptype===k?'selected':''}>${esc(v.label)} - ${fmt0(personalAmount(k,Y.year))}</option>`).join('')}</select></label>
      ${chk?`<div class="callout bad" style="margin:0 0 10px"><div class="ci">⚠️</div><div class="cb">Your personal credit is <b>${fmt0(chk.have)}</b>, but for "${esc(chk.label)}" in ${esc(Y.year)} Revenue gives <b>${fmt0(chk.want)}</b>.
        If your certificate agrees, update it.<br><button class="btn sm" data-fixpersonal="${i}">Use ${fmt0(chk.want)}</button></div></div>`:''}
      <div class="tw"><table>
        <thead><tr><th>Credit</th><th class="n">Per year</th><th>When you get it</th><th></th></tr></thead>
        <tbody>${(p.credits||[]).map((c,ci)=>{
          const l = lib.find(x=>creditMatches(x,c.name));
          return `<tr>
          <td><input data-path="people.${i}.credits.${ci}.name" value="${esc(c.name)}">${l&&l.est?` <span class="pill warn" title="Revenue has not published this ${esc(Y.year)} figure - it carries the previous year\'s amount">confirm</span>`:''}</td>
          <td class="n"><input class="num" style="text-align:right" data-path="people.${i}.credits.${ci}.amount" data-type="number" value="${num(c.amount)}"></td>
          <td><select data-path="people.${i}.credits.${ci}.when" aria-label="When you get it"><option value="pay" ${creditIsRefund(c)?'':'selected'}>In your pay</option><option value="refund" ${creditIsRefund(c)?'selected':''}>Refund after the year</option></select></td>
          <td class="act"><button class="btn sm danger" data-del-credit="${i}.${ci}" aria-label="Remove credit">x</button></td></tr>`; }).join('')
          || '<tr><td colspan="4" class="empty">No credits - your tax will be overstated. Add the personal and employee credits.</td></tr>'}
        </tbody>
        <tfoot><tr><td>In your pay</td><td class="n">${fmt(t.credits)}</td><td colspan="2"></td></tr>
          ${t.refundCredits>0?`<tr><td>Refund after the year</td><td class="n">${fmt(t.refundCredits)}</td><td colspan="2" class="mut">about ${fmt0(t.refund)} back</td></tr>`:''}</tfoot>
      </table></div>
      ${t.refundCredits>0?`<div class="callout info" style="margin:10px 0 0"><div class="ci">💶</div><div class="cb"><b class="ct">${fmt0(t.refund)} comes back after the year ends</b>
        Credits marked "Refund after the year" - such as the Rent Tax Credit - are claimed on your Income Tax Return once the year is over, so they are <b>not</b> in your monthly take-home pay.
        A credit can only give back tax you have actually paid. Change the setting on a row if yours is paid through your pay instead.</div></div>`:''}
      <div class="row" style="margin-top:8px">
        <select data-addcredit="${i}" style="max-width:420px" aria-label="Add a credit">
          <option value="">+ Add a credit...</option>
          ${CREDIT_GROUPS.map(g=>{ const items = addable.filter(c=>c.group===g); return items.length?`<optgroup label="${esc(g)}">${items.map(c=>`<option value="${esc(c.key)}">${esc(c.name)} (${fmt0(c.amount)}${c.est?', confirm':''})</option>`).join('')}</optgroup>`:''; }).join('')}
          <option value="custom">Something else (type it in)</option>
        </select>
        <button class="btn ghost sm" data-go="reliefs">See every credit and relief &rarr;</button>
      </div>

      ${num(p.bonus)>0?`<h3 style="margin:18px 0 6px;font-size:15px">Your bonus after tax</h3><div class="tw"><table>
        <tbody>
          <tr><td>Bonus before tax</td><td class="n">${fmt(t.bonus)}</td></tr>
          <tr><td>Income tax</td><td class="n">-${fmt(t.bTax)}</td></tr>
          <tr><td>PRSI</td><td class="n">-${fmt(t.bPrsi)}</td></tr>
          <tr><td>USC</td><td class="n">-${fmt(t.bUsc)}</td></tr>
        </tbody><tfoot><tr><td>You keep</td><td class="n pos">${fmt(t.bonusNet)}</td></tr></tfoot></table></div>`:''}

      ${t.gross>0?`<details class="more"><summary>🎯 What if I get a pay rise?</summary>
        <div class="row" style="margin-top:6px"><label class="f" style="max-width:240px"><span data-nott>Yearly pay rise (before tax)</span>
          <input class="num" data-raise="${i}" data-pid="${esc(p.id)}" inputmode="decimal" value="${raise||''}" placeholder="e.g. 3000"></label></div>
        <div id="raiseOut${i}">${raiseOut(p, raise, mr)}</div>
      </details>`:''}
    </div>`;
  }).join('');

  el.innerHTML = `
  ${differs ? callout('warn','⚠️','Your '+esc(Y.year)+' tax rates are not the built-in figures',
    'The rate bands, USC or PRSI saved for this year differ from the '+esc(Y.year)+' figures built in (taken from Revenue). If you changed them on purpose, ignore this. If not - for example the year was created by an older version - reset them so your take-home pay is right.',
    '<button class="btn primary sm" id="resetBands2">Use the built-in '+esc(Y.year)+' figures</button>') : ''}
  ${cards}
  ${Y.people.length>1 ? `<div class="card accent">${cardHead('Household total','Everyone\'s take-home pay added together')}
    <div class="grid g3">
      <div class="kpi"><div class="lbl" data-nott>Take-home per month</div><div class="val pos">${fmt0(H.net)}</div></div>
      <div class="kpi"><div class="lbl" data-nott>Take-home per year</div><div class="val">${fmt0(H.net*12)}</div></div>
      <div class="kpi"><div class="lbl" data-nott>Earners</div><div class="val">${Y.people.length}</div></div>
    </div></div>` : ''}
  <div class="row" style="margin:0 0 16px"><button class="btn" id="addPerson">+ Add another earner</button></div>
  ${budgetImpactCard()}

  <details class="more"><summary>⚙️ Tax rates for ${esc(Y.year)} - already filled in from Revenue. Tap to review or change.</summary>
    <p class="note">These are the ${esc(Y.year)} figures: ${(b.lowRate*100).toFixed(0)}% / ${(b.highRate*100).toFixed(0)}% income tax, USC ${b.uscBands.map(u=>String(+(u.rate*100).toFixed(2))).join(' / ')}%, and PRSI of ${(b.prsiRate1*100).toFixed(2)}% rising to ${(b.prsiRate2*100).toFixed(2)}%.
    You only need to change them if Revenue gives you different figures. <a href="${REVENUE_CHART}" target="_blank" rel="noopener">Revenue rates and bands</a>.</p>
    <div class="grid g4">
      <label class="f"><span>Standard rate band (single)</span><input class="num" data-path="taxBands.srcopSingle" data-type="number" value="${esc(b.srcopSingle)}"></label>
      <label class="f"><span>Standard rate band (single parent)</span><input class="num" data-path="taxBands.srcopParent" data-type="number" value="${esc(b.srcopParent)}"></label>
      <label class="f"><span>Standard rate band (married, one income)</span><input class="num" data-path="taxBands.srcopMax" data-type="number" value="${esc(b.srcopMax)}"></label>
      <label class="f"><span>Most a second earner's band can be</span><input class="num" data-path="taxBands.srcopSecond" data-type="number" value="${esc(b.srcopSecond)}"></label>
      <label class="f"><span>Low rate</span><input class="num" data-path="taxBands.lowRate" data-type="number" step="0.01" value="${esc(b.lowRate)}"></label>
      <label class="f"><span>High rate</span><input class="num" data-path="taxBands.highRate" data-type="number" step="0.01" value="${esc(b.highRate)}"></label>
      <label class="f"><span>PRSI rate (start of year)</span><input class="num" data-path="taxBands.prsiRate1" data-type="number" step="0.0001" value="${esc(b.prsiRate1)}"></label>
      <label class="f"><span>PRSI rate (after change)</span><input class="num" data-path="taxBands.prsiRate2" data-type="number" step="0.0001" value="${esc(b.prsiRate2)}"></label>
      <label class="f"><span>PRSI change month</span><input class="num" data-path="taxBands.prsiChangeMonth" data-type="number" value="${esc(b.prsiChangeMonth)}"></label>
      <label class="f"><span>No PRSI at or below (weekly pay)</span><input class="num" data-path="taxBands.prsiExemptWeekly" data-type="number" value="${esc(b.prsiExemptWeekly)}"></label>
      <label class="f"><span>USC exemption</span><input class="num" data-path="taxBands.uscExempt" data-type="number" value="${esc(b.uscExempt)}"></label>
    </div>
    <div class="tw"><table>
      <thead><tr><th>USC band</th><th class="n">Up to (total income)</th><th class="n">Rate</th><th></th></tr></thead>
      <tbody>${b.uscBands.map((u,i)=>`<tr>
        <td>Band ${i+1}</td>
        <td class="n"><input class="num" style="text-align:right" data-path="taxBands.uscBands.${i}.to" data-type="number" value="${esc(u.to)}"></td>
        <td class="n"><input class="num" style="text-align:right" data-path="taxBands.uscBands.${i}.rate" data-type="number" step="0.001" value="${esc(u.rate)}"></td>
        <td class="act"><button class="btn sm danger" data-del-usc="${i}" aria-label="Remove band">x</button></td></tr>`).join('')}</tbody>
    </table></div>
    <div class="row" style="margin-top:10px">
      <button class="btn sm" id="addUsc">+ Add band</button>
      <button class="btn sm" id="resetBands">Reset to ${esc(Y.year)} Revenue figures</button>
    </div>
    <div class="note">An estimate for planning, not a payslip or tax advice. It does not model week-1 basis, the PRSI credit for low earners, or reduced USC rates for medical card holders and over-70s. For two-income couples the band is shared between you automatically; if your certificate shows something different, choose "Something else" and type it in.</div>
  </details>`;

  wireFields(el);
  $('#addPerson').onclick = addPerson;
  if($('#startNext')) $('#startNext').onclick = newYear;
  if($('#resetBands2')) $('#resetBands2').onclick = resetTaxYear;
  $('#resetBands').onclick = resetTaxYear;
  $$('[data-status]', el).forEach(s=> s.onchange = ()=> setBandStatus(+s.dataset.status, s.value));
  $$('[data-ptype]', el).forEach(s=> s.onchange = ()=>{ setPersonalType(Y.people[+s.dataset.ptype], s.value); save(); render(); });
  $$('[data-fixpersonal]', el).forEach(btn=> btn.onclick = ()=>{
    const p = Y.people[+btn.dataset.fixpersonal];
    setPersonalType(p, p.personalType || defaultPersonalType(p.status)); save(); render(); toast('Personal credit updated');
  });
  $$('[data-del-person]',el).forEach(x=> x.onclick=()=>{
    const p = Y.people[+x.dataset.delPerson];
    if(p && (num(p.gross) || Y.bills.some(b=>b.holder===p.name)) && !confirm('Remove '+(p.name||'this person')+'? Their salary details are deleted. Bills assigned to them stay but become unassigned.')) return;
    Y.people.splice(+x.dataset.delPerson,1); save(); render(); });
  $$('[data-del-credit]',el).forEach(x=> x.onclick=()=>{
    const [pi,ci] = x.dataset.delCredit.split('.').map(Number);
    Y.people[pi].credits.splice(ci,1); save(); render(); });
  $$('[data-addcredit]',el).forEach(s=> s.onchange = ()=>{
    const p = Y.people[+s.dataset.addcredit]; if(!p || !s.value) return;
    if(s.value==='custom') p.credits.push({name:'Credit',amount:0});
    else { const c = lib.find(x=>x.key===s.value); if(c) p.credits.push({name:c.name, amount:c.amount, when:c.when}); }
    save(); render();
  });
  $$('[data-raise]',el).forEach(inp=> inp.oninput = ()=>{
    const i = +inp.dataset.raise, p = Y.people[i];
    raiseState[inp.dataset.pid] = num(inp.value);
    $('#raiseOut'+i).innerHTML = raiseOut(p, num(inp.value), marginalRate(p));
  });
  $$('[data-del-usc]',el).forEach(x=> x.onclick=()=>{ Y.taxBands.uscBands.splice(+x.dataset.delUsc,1); save(); render(); });
  $('#addUsc').onclick = ()=>{ Y.taxBands.uscBands.push({to:1e12, rate:.08}); save(); render(); };
}

function budgetImpactCard(){
  const ny = Y.year+1;
  if(!TAX_PRESETS[ny] || !Y.people.some(p=>num(p.gross)>0)) return '';
  const nb = presetFor(ny);
  const rows = Y.people.filter(p=>num(p.gross)>0).map(p=>{
    const now = calcTax(p, Y.taxBands), then = calcTax(nextYearPerson(p, ny, nb), nb);
    return {p, now, then, diff: then.netMonthly - now.netMonthly};
  });
  const total = rows.reduce((s,r)=>s+r.diff,0);
  return `<div class="card">
    ${cardHead('🇮🇪 What Budget '+ny+' means for you','Your same salary and credits, run through the '+ny+' rate bands, credits and USC bands. Assumes your pay does not change.',
      `<button class="btn" id="startNext">Set up ${ny}</button>`)}
    <div class="tw"><table>
      <thead><tr><th>Person</th><th class="n">${esc(Y.year)} take-home / month</th><th class="n">${ny} take-home / month</th><th class="n">Difference</th></tr></thead>
      <tbody>${rows.map(r=>`<tr><td><b>${esc(r.p.name)}</b></td><td class="n">${fmt(r.now.netMonthly)}</td><td class="n">${fmt(r.then.netMonthly)}</td>
        <td class="n ${r.diff>=0?'pos':'neg'}"><b>${r.diff>=0?'+':''}${fmt(r.diff)}</b></td></tr>`).join('')}</tbody>
      ${rows.length>1?`<tfoot><tr><td>Household</td><td></td><td></td><td class="n ${total>=0?'pos':'neg'}">${total>=0?'+':''}${fmt(total)} / month</td></tr></tfoot>`:''}
    </table></div>
    <div class="note">That is about <b>${fmt(Math.abs(total)*12)} a year ${total>=0?'more':'less'}</b> in the household's pocket. PRSI rises in October ${ny} (to ${(TAX_PRESETS[ny].prsiRate2*100).toFixed(2)}%), which is included. Credits Revenue has not published for ${ny} use the ${Y.year} amount. Custom credits you typed in are unchanged.</div>
  </div>`;
}
function raiseOut(p, raise, mr){
  if(!raise) return '<div class="note">Type an amount to see how much of it you would actually keep.</div>';
  const b = Y.taxBands;
  const a = calcTax(p,b), c = calcTax({...p, gross: num(p.gross)+raise}, b);
  const extra = c.net - a.net;
  const tax = (c.paye+c.prsi+c.usc) - (a.paye+a.prsi+a.usc);
  const pen = (c.pension+c.avc) - (a.pension+a.avc);
  return `<div class="grid g3" style="margin-top:6px">
    <div class="kpi"><div class="lbl" data-nott>Extra take-home / month</div><div class="val pos">${fmt0(extra/12)}</div><div class="sub">${fmt0(extra)} a year</div></div>
    <div class="kpi"><div class="lbl" data-nott>You keep</div><div class="val">${(extra/raise*100).toFixed(0)}c</div><div class="sub">of every extra €1</div></div>
    <div class="kpi"><div class="lbl" data-nott>Tax on the extra</div><div class="val neg">${fmt0(tax)}</div><div class="sub">income tax, PRSI and USC${pen>0.5?'; '+fmt0(pen)+' goes to your pension':''}</div></div></div>`;
}


