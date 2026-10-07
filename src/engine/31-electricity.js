/* ---------- electricity: HDF parsing, banding, tariff costing ---------- */
function bandFor(date, b){
  const h = date.getHours() + date.getMinutes()/60;
  const ns = num(b.nightStart), ne = num(b.nightEnd);
  const inNight = ns > ne ? (h >= ns || h < ne) : (h >= ns && h < ne);
  if(inNight) return 'night';
  const ps = num(b.peakStart), pe = num(b.peakEnd);
  const inPeak = ps > pe ? (h >= ps || h < pe) : (h >= ps && h < pe);
  return inPeak ? 'peak' : 'day';
}
function parseHDFDate(s){
  const m = String(s||'').trim().match(/^(\d{2})-(\d{2})-(\d{4})[ T](\d{2}):(\d{2})/);
  if(m) return new Date(+m[3], +m[2]-1, +m[1], +m[4], +m[5]);
  const d = new Date(s);
  return isNaN(d) ? null : d;
}
/* Reads are the END of each interval and the value is average kW over it, so the
   interval that ends at 08:00 is 07:30-08:00 and belongs to the night band. */
function summariseUsage(text, bands){
  const lines = String(text).split(/\r?\n/);
  const head = (lines[0]||'').split(',').map(h=>h.trim().toLowerCase());
  const iVal = head.findIndex(h=>h.includes('read value'));
  const iType = head.findIndex(h=>h.includes('read type'));
  const iDate = head.findIndex(h=>h.includes('read date'));
  const iMprn = head.findIndex(h=>h.includes('mprn'));
  if(iVal<0 || iDate<0) return {error:'Need "Read Value" and "Read Date and End Time" columns - this should be the HDF file from ESB Networks.'};

  const pts = [];
  let mprn = '', skipped = 0;
  for(let i=1;i<lines.length;i++){
    const ln = lines[i]; if(!ln) continue;
    const c = ln.split(',');
    const type = iType>=0 ? (c[iType]||'') : 'kW';
    if(!/import/i.test(type) && iType>=0){ skipped++; continue; }
    const d = parseHDFDate(c[iDate]);
    const v = parseFloat(c[iVal]);
    if(!d || !isFinite(v)){ skipped++; continue; }
    if(!mprn && iMprn>=0) mprn = (c[iMprn]||'').trim();
    pts.push([d.getTime(), v, /kwh/i.test(type)]);
  }
  if(pts.length < 48) return {error:'Only '+pts.length+' readings found - that is not enough to summarise.'};
  pts.sort((a,b)=>a[0]-b[0]);

  // interval length from the most common gap between consecutive reads
  const gaps = {};
  for(let i=1;i<Math.min(pts.length,600);i++){
    const g = (pts[i][0]-pts[i-1][0])/60000;
    if(g>0 && g<=120) gaps[g] = (gaps[g]||0)+1;
  }
  const mins = +Object.keys(gaps).sort((a,b)=>gaps[b]-gaps[a])[0] || 30;
  const hours = mins/60;

  // window: the last 12 complete calendar months
  const last = new Date(pts[pts.length-1][0]);
  const endEx = new Date(last.getFullYear(), last.getMonth(), 1);      // start of the incomplete month
  const start = new Date(endEx.getFullYear(), endEx.getMonth()-12, 1);
  const first = new Date(pts[0][0]);
  const from = start < first ? new Date(first.getFullYear(), first.getMonth()+ (first.getDate()>1?1:0), 1) : start;

  const months = {};
  const slotN = Math.max(1, Math.round(1440/mins));
  const slotSum = new Array(slotN).fill(0), slotCnt = new Array(slotN).fill(0);
  let day=0, night=0, peak=0, used=0;
  for(const [t,v,isKwh] of pts){
    const end = new Date(t);
    const st = new Date(t - mins*60000);
    if(st < from || st >= endEx) continue;
    const kwh = isKwh ? v : v*hours;
    const b = bandFor(st, bands);
    const k = monthKey(st);
    const m = months[k] || (months[k] = {month:k, day:0, night:0, peak:0, total:0});
    m[b] += kwh; m.total += kwh;
    if(b==='day') day+=kwh; else if(b==='night') night+=kwh; else peak+=kwh;
    const si = Math.floor((st.getHours()*60 + st.getMinutes())/mins) % slotN;
    slotSum[si] += kwh; slotCnt[si]++;
    used++;
  }
  if(!used) return {error:'No readings fell inside the last complete year.'};
  const keys = Object.keys(months).sort();
  const r2 = n => Math.round(n*100)/100;
  return {
    mprn, from: iso(from), to: iso(new Date(endEx-86400000)),
    months: keys.length,
    intervals: used, intervalMins: mins,
    day: r2(day), night: r2(night), peak: r2(peak), total: r2(day+night+peak),
    byMonth: keys.map(k=>({month:k, day:r2(months[k].day), night:r2(months[k].night),
                            peak:r2(months[k].peak), total:r2(months[k].total)})),
    profile: slotSum.map((v,i)=> slotCnt[i] ? Math.round(v/slotCnt[i]*1000)/1000 : 0),
    importedAt: iso(new Date())
  };
}
/* Cost a tariff against the summarised year. Rates are cent per kWh. */
function offerCost(o, sum, vatPct){
  if(!sum) return null;
  const c = v => num(v)/100;
  const units = sum.day*c(o.day) + sum.night*c(o.night) + sum.peak*c(o.peak);
  const disc = units * (num(o.discount)/100);
  const standing = num(o.standing);
  let total = units - disc + standing;
  const vat = o.incVat ? 0 : total*(num(vatPct)/100);
  total += vat;
  const scale = sum.months ? 12/sum.months : 1;     // normalise a short window to a year
  return {
    units: units-disc, standing, vat, discount:disc,
    annual: total*scale, monthly: total*scale/12,
    dayCost: sum.day*c(o.day), nightCost: sum.night*c(o.night), peakCost: sum.peak*c(o.peak),
    effective: sum.total ? (total/sum.total)*100 : 0
  };
}
