/* ---------------- electricity ---------------- */
function profileKpis(s){
  const pr = s.profile || [], mins = s.intervalMins||30;
  const perDay = pr.reduce((a,b)=>a+b,0);
  let hi = 0; pr.forEach((v,i)=>{ if(v>pr[hi]) hi=i; });
  const at = i => String(Math.floor(i*mins/60)).padStart(2,'0')+':'+String((i*mins)%60).padStart(2,'0');
  const share = v => pct(s.total ? v/s.total*100 : 0);
  return `
    <div class="kpi"><div class="lbl">Typical day</div><div class="val">${perDay.toFixed(1)}</div>
      <div class="sub">kWh</div></div>
    <div class="kpi"><div class="lbl">Busiest half hour</div><div class="val">${at(hi)}</div>
      <div class="sub">${(pr[hi]||0).toFixed(2)} kWh on average</div></div>
    <div class="kpi"><div class="lbl">Used at night</div><div class="val pos">${share(s.night)}</div>
      <div class="sub">cheapest rate</div></div>
    <div class="kpi"><div class="lbl">Used at peak</div><div class="val ${s.total&&s.peak/s.total>0.2?'neg':''}">${share(s.peak)}</div>
      <div class="sub">dearest rate</div></div>`;
}

function renderEnergy(el){
  const E = Y.energy, s = E.summary, b = E.bands;
  const offers = E.offers||[];
  const costed = offers.map(o=>({o, c:offerCost(o, s, E.vat)}));
  const valid = costed.filter(x=>x.c && x.c.annual>0);
  const cheapest = valid.length ? valid.reduce((a,x)=> x.c.annual<a.c.annual?x:a) : null;
  const current = costed.find(x=>x.o.current) || null;
  const elecBill = Y.bills.find(x=>/electric/i.test(x.name));

  const summaryCard = s ? `
    <div class="grid g4" style="margin-bottom:14px">
      <div class="kpi"><div class="lbl">Usage</div><div class="val">${Math.round(s.total).toLocaleString('en-IE')}</div>
        <div class="sub">kWh over ${s.months} month${s.months===1?'':'s'}</div></div>
      <div class="kpi"><div class="lbl">Day</div><div class="val">${Math.round(s.day).toLocaleString('en-IE')}</div>
        <div class="sub">${pct(s.total?s.day/s.total*100:0)} of usage</div></div>
      <div class="kpi"><div class="lbl">Night</div><div class="val">${Math.round(s.night).toLocaleString('en-IE')}</div>
        <div class="sub">${pct(s.total?s.night/s.total*100:0)} of usage</div></div>
      <div class="kpi"><div class="lbl">Peak</div><div class="val">${Math.round(s.peak).toLocaleString('en-IE')}</div>
        <div class="sub">${pct(s.total?s.peak/s.total*100:0)} of usage</div></div>
    </div>
    <div class="note" style="margin-top:0">${esc(s.from)} to ${esc(s.to)} &middot; ${num(s.intervals).toLocaleString('en-IE')} readings at
      ${num(s.intervalMins)} minutes${s.mprn?' &middot; MPRN '+esc(s.mprn):''} &middot; imported ${esc(s.importedAt)}.
      Only this summary is stored - the raw file is discarded.</div>` : '';

  const offerRows = costed.map((x,i)=>{
    const o = x.o, c = x.c;
    const diff = (current && current.c && c) ? c.annual - current.c.annual : null;
    return `<tr>
      <td><input data-path="energy.offers.${i}.name" value="${esc(o.name)}" style="min-width:130px"></td>
      <td class="n"><input class="num" style="text-align:right;width:72px" data-path="energy.offers.${i}.day" data-type="number" value="${num(o.day)}"></td>
      <td class="n"><input class="num" style="text-align:right;width:72px" data-path="energy.offers.${i}.night" data-type="number" value="${num(o.night)}"></td>
      <td class="n"><input class="num" style="text-align:right;width:72px" data-path="energy.offers.${i}.peak" data-type="number" value="${num(o.peak)}"></td>
      <td class="n"><input class="num" style="text-align:right;width:80px" data-path="energy.offers.${i}.standing" data-type="number" value="${num(o.standing)}"></td>
      <td class="n"><input class="num" style="text-align:right;width:64px" data-path="energy.offers.${i}.discount" data-type="number" value="${num(o.discount)}"></td>
      <td style="text-align:center"><input type="checkbox" data-path="energy.offers.${i}.incVat" ${o.incVat?'checked':''}></td>
      <td class="n">${c?fmt(c.annual):'<span class="mut">-</span>'}</td>
      <td class="n ${cheapest&&cheapest.o===o?'pos':''}"><b>${c?fmt(c.monthly):'-'}</b></td>
      <td class="n">${c?(c.effective).toFixed(2)+'c':''}</td>
      <td class="n ${diff===null?'':(diff<0?'pos':'neg')}">${diff===null?'<span class="mut">-</span>':(diff>0?'+':'')+fmt(diff)}</td>
      <td style="text-align:center"><input type="radio" name="curOffer" data-current="${i}" ${o.current?'checked':''} title="This is my current plan"></td>
      <td class="act"><button class="btn sm danger" data-del-offer="${i}">x</button></td>
    </tr>`;
  }).join('');

  el.innerHTML = `
  <div class="card">
    <h2>Smart meter usage</h2>
    ${summaryCard || '<div class="empty">No usage imported yet. Download your HDF file from the ESB Networks portal and drop it in below.</div>'}
    <div class="row" style="margin-top:12px">
      <label class="f" style="width:200px"><span>MPRN</span>
        <input class="num" id="mprnField" value="${esc(E.mprn||'')}" placeholder="10014385328"
          maxlength="16" spellcheck="false"></label>
      <button class="btn" id="copyMprn" style="margin-bottom:9px">Copy</button>
      <div style="margin-bottom:14px">${E.mprn
        ? (/^\d{11}$/.test(String(E.mprn).trim())
          ? '<span class="pill on">11 digits</span>'
          : '<span class="pill" style="border-color:var(--warn);color:var(--warn)">check length</span>')
        : ''}</div>
      <div class="spacer"></div>
      <label class="f" style="flex:1;min-width:220px"><span>HDF usage file (CSV)</span>
        <input type="file" id="hdfFile" accept=".csv,text/csv"></label>
      ${s?`<button class="btn danger" id="clearUsage" style="margin-bottom:9px">Clear usage</button>`:''}
    </div>
    ${s && s.mprn && E.mprn && String(s.mprn).trim()!==String(E.mprn).trim()
      ? `<div class="note">The imported file is for MPRN ${esc(s.mprn)}, which is not the one saved above.</div>` : ''}
    <div class="note">A year of half-hourly readings is around 17,500 rows. It is summarised in the browser and only the
      per-band monthly totals are saved, so the JSON stays small.</div>
  </div>

  <div class="card">
    <h2>Rate windows</h2>
    <div class="grid g4">
      <label class="f"><span>Night starts</span><input class="num" data-path="energy.bands.nightStart" data-type="number" value="${num(b.nightStart)}"></label>
      <label class="f"><span>Night ends</span><input class="num" data-path="energy.bands.nightEnd" data-type="number" value="${num(b.nightEnd)}"></label>
      <label class="f"><span>Peak starts</span><input class="num" data-path="energy.bands.peakStart" data-type="number" value="${num(b.peakStart)}"></label>
      <label class="f"><span>Peak ends</span><input class="num" data-path="energy.bands.peakEnd" data-type="number" value="${num(b.peakEnd)}"></label>
    </div>
    <div class="row">
      <label class="f" style="width:150px"><span>VAT % (if rates exclude it)</span>
        <input class="num" data-path="energy.vat" data-type="number" step="0.1" value="${num(E.vat)}"></label>
      <div class="spacer"></div>
      ${s?`<button class="btn" id="recalc">Re-band saved usage</button>`:''}
    </div>
    <div class="note">Hours on a 24-hour clock. Defaults are the common Irish windows: night 23:00-08:00, peak 17:00-19:00,
      day for everything else. Changing these needs the usage file re-imported (or use re-band, which redistributes
      monthly totals approximately).</div>
  </div>

  <div class="card">
    <h2>Offers <span class="pill">${offers.length}</span></h2>
    <div class="tw"><table>
      <thead><tr><th>Plan</th><th class="n">Day c/kWh</th><th class="n">Night</th><th class="n">Peak</th>
        <th class="n">Standing /yr</th><th class="n">Disc %</th><th>Inc VAT</th>
        <th class="n">Per year</th><th class="n">Per month</th><th class="n">Unit rate</th>
        <th class="n">vs current</th><th>Current</th><th></th></tr></thead>
      <tbody>${offerRows||'<tr><td colspan="13" class="empty">No offers yet.</td></tr>'}</tbody>
    </table></div>
    <div class="row" style="margin-top:10px">
      <button class="btn" id="addOffer">+ Add offer</button>
      <button class="btn" id="flatOffer">+ Add flat-rate offer</button>
      <button class="btn" id="exportOffers">Export CSV</button>
    </div>
    ${!s?'<div class="note">Import usage above to cost these out.</div>':''}
    ${cheapest&&current&&cheapest.o!==current.o?`<div class="note">
      <b>${esc(cheapest.o.name)}</b> is the cheapest on your usage - ${fmt(current.c.annual-cheapest.c.annual)} a year
      less than ${esc(current.o.name)}, or ${fmt((current.c.annual-cheapest.c.annual)/12)} a month.</div>`:''}
    ${cheapest&&elecBill?`<div class="note">Your budget has ${esc(elecBill.name)} at ${fmt(annualOf(elecBill)/12)} a month;
      the cheapest plan here works out at ${fmt(cheapest.c.monthly)}.</div>`:''}
  </div>

  ${s&&valid.length?`
  <div class="card">
    <h2>Annual cost by plan</h2>
    <div class="chartbox auto"><canvas id="cOffers"></canvas></div>
  </div>

  <div class="card">
    <h2>Where the cost falls</h2>
    <div class="chartbox auto"><canvas id="cBands"></canvas></div>
    ${legendHtml([{label:'Day',color:PALETTE[1]},{label:'Night',color:PALETTE[3]},{label:'Peak',color:PALETTE[2]}])}
  </div>`:''}

  ${s?`
  <div class="card">
    <h2>Usage by month</h2>
    <div class="chartbox" style="height:280px"><canvas id="cUsage"></canvas></div>
    ${legendHtml([{label:'Day',color:PALETTE[1]},{label:'Night',color:PALETTE[3]},{label:'Peak',color:PALETTE[2]},{label:'Total',color:css('--text')}])}
    <div class="tw" style="max-height:340px;overflow:auto;margin-top:10px"><table>
      <thead><tr><th>Month</th><th class="n">Day</th><th class="n">Night</th><th class="n">Peak</th><th class="n">Total kWh</th>
        ${current&&current.c?`<th class="n">Cost on ${esc(current.o.name)}</th>`:''}</tr></thead>
      <tbody>${s.byMonth.map(m=>{
        const c = current ? (m.day*num(current.o.day)+m.night*num(current.o.night)+m.peak*num(current.o.peak))/100 : null;
        return `<tr><td>${esc(m.month)}</td><td class="n">${num(m.day).toFixed(1)}</td><td class="n">${m.night.toFixed(1)}</td>
          <td class="n">${m.peak.toFixed(1)}</td><td class="n"><b>${m.total.toFixed(1)}</b></td>
          ${current&&current.c?`<td class="n">${fmt(c + num(current.o.standing)/12)}</td>`:''}</tr>`;
      }).join('')}</tbody>
      <tfoot><tr><td>Total</td><td class="n">${s.day.toFixed(1)}</td><td class="n">${s.night.toFixed(1)}</td>
        <td class="n">${s.peak.toFixed(1)}</td><td class="n">${s.total.toFixed(1)}</td>
        ${current&&current.c?`<td class="n">${fmt(current.c.annual)}</td>`:''}</tr></tfoot>
    </table></div>
    <div class="row" style="margin-top:10px"><button class="btn" id="exportUsage">Export CSV</button></div>
  </div>

  ${s.profile && s.profile.length ? `<div class="card">
    <h2>Your average day</h2>
    <div class="chartbox" style="height:280px"><canvas id="cProfile"></canvas></div>
    ${legendHtml([{label:'Day',color:PALETTE[1]},{label:'Night',color:PALETTE[3]},{label:'Peak',color:PALETTE[2]}])}
    <div class="grid g4" style="margin-top:12px">${profileKpis(s)}</div>
    <div class="note">Averaged over every day in the period. The shaded areas are the night and peak windows - the more
      usage you can shift out from under the peak shading, the better a day/night/peak plan pays off for you.</div>
  </div>` : `<div class="card"><div class="note" style="margin:0">Re-import your HDF file to get the average-day
    chart - the profile was added after this summary was saved.</div></div>`}`:''}`;

  wireFields(el);
  $('#hdfFile').onchange = e=>{
    const f = e.target.files[0]; if(!f) return;
    setStatus('Reading '+f.name+'...');
    const rd = new FileReader();
    rd.onload = ()=>{
      const out = summariseUsage(rd.result, Y.energy.bands);
      e.target.value = '';
      if(out.error){ setStatus('Ready'); toast(out.error); return; }
      Y.energy.summary = out;
      if(out.mprn && !String(Y.energy.mprn||'').trim()) Y.energy.mprn = out.mprn;
      save(); render();
      toast(Math.round(out.total).toLocaleString('en-IE')+' kWh summarised from '+out.intervals.toLocaleString('en-IE')+' readings');
    };
    rd.onerror = ()=>{ setStatus('Ready'); toast('Could not read that file'); e.target.value=''; };
    rd.readAsText(f);
  };
  $('#mprnField').onchange = e=>{
    Y.energy.mprn = e.target.value.replace(/\s+/g,'').slice(0,16);
    save(); render();
  };
  $('#copyMprn').onclick = ()=>{
    const v = String(Y.energy.mprn||'').trim();
    if(!v){ toast('No MPRN saved yet'); return; }
    if(navigator.clipboard) navigator.clipboard.writeText(v).then(()=>toast('MPRN copied'), ()=>toast(v));
    else toast(v);
  };
  if($('#clearUsage')) $('#clearUsage').onclick = ()=>{
    if(confirm('Clear the saved usage summary?')){ Y.energy.summary = null; save(); render(); }
  };
  if($('#recalc')) $('#recalc').onclick = ()=> toast('Re-import the HDF file to re-band accurately');
  $('#addOffer').onclick = ()=>{
    Y.energy.offers.push({id:uid(), name:'New offer', day:0, night:0, peak:0, standing:0, discount:0, incVat:true});
    save(); render();
  };
  $('#flatOffer').onclick = ()=>{
    const r = num(prompt('Single 24-hour rate in cent per kWh:', '25.86'));
    Y.energy.offers.push({id:uid(), name:'Flat rate plan', day:r, night:r, peak:r, standing:0, discount:0, incVat:true});
    save(); render();
  };
  $$('[data-del-offer]',el).forEach(x=> x.onclick=()=>{ Y.energy.offers.splice(+x.dataset.delOffer,1); save(); render(); });
  $$('[data-current]',el).forEach(x=> x.onchange=()=>{
    Y.energy.offers.forEach((o,i)=> o.current = (i === +x.dataset.current));
    save(); render();
  });
  $('#exportOffers').onclick = ()=> downloadCSV('electricity-offers-'+yearLabel()+'.csv', offersCSV());
  if($('#exportUsage')) $('#exportUsage').onclick = ()=> downloadCSV('electricity-usage-'+yearLabel()+'.csv', usageCSV());

  /* offer comparison needs priced offers; usage and profile only need a summary */
  if(s && valid.length) chart(()=>{
    const sorted = valid.slice().sort((a,b)=>a.c.annual-b.c.annual);
    hBars($('#cOffers'), sorted.map(x=>x.o.name+(x.o.current?' (current)':'')), [
      {name:'Per year', color:PALETTE[0], values:sorted.map(x=>x.c.annual)}
    ]);
    hBars($('#cBands'), sorted.map(x=>x.o.name), [
      {name:'Day', color:PALETTE[1], values:sorted.map(x=>x.c.dayCost)},
      {name:'Night', color:PALETTE[3], values:sorted.map(x=>x.c.nightCost)},
      {name:'Peak', color:PALETTE[2], values:sorted.map(x=>x.c.peakCost)}
    ]);
  });

  if(s){
    chart(()=>{
      if(s.profile && s.profile.length && $('#cProfile')){
        profileChart($('#cProfile'), s.profile, Y.energy.bands, s.intervalMins||30,
          {day:PALETTE[1], night:PALETTE[3], peak:PALETTE[2]});
      }
      lineChart($('#cUsage'), s.byMonth.map(m=>m.month), [
        {name:'Day', color:PALETTE[1], values:s.byMonth.map(m=>m.day)},
        {name:'Night', color:PALETTE[3], values:s.byMonth.map(m=>m.night)},
        {name:'Peak', color:PALETTE[2], values:s.byMonth.map(m=>m.peak)},
        {name:'Total', color:css('--text'), values:s.byMonth.map(m=>m.total), dash:true}
      ], {axisFormat: v=>Math.round(v).toString(), tipFormat: v=>v.toFixed(1)+' kWh'});
    });
  }
}

