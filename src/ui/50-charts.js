/* ---------------- charts (canvas, no libraries) ----------------
   Sizing rule: the .chartbox owns the dimensions. We set the canvas
   CSS size in px and the backing store to css * dpr, so the element
   can never feed its own attribute height back into layout.
-----------------------------------------------------------------*/
function css(v){ return getComputedStyle(document.documentElement).getPropertyValue(v).trim(); }

function prep(cv, height){
  const box = cv.parentNode;
  const w = Math.max(Math.floor(box.clientWidth) || 0, 260);
  const h = Math.max(Math.floor(height || box.clientHeight) || 0, 150);
  const dpr = Math.min(window.devicePixelRatio || 1, 2);
  cv.style.width = w+'px';
  cv.style.height = h+'px';
  cv.width = Math.round(w*dpr);
  cv.height = Math.round(h*dpr);
  const c = cv.getContext('2d');
  if(!c) return null;
  c.setTransform(dpr,0,0,dpr,0,0);
  c.clearRect(0,0,w,h);
  c.font = '11px ui-monospace,Menlo,Consolas,monospace';
  c.textBaseline = 'middle';
  return {c,w,h};
}

function shortNum(v){
  const a = Math.abs(v);
  const s = a>=1e6 ? (a/1e6).toFixed(a>=1e7?0:1)+'m'
          : a>=1e4 ? Math.round(a/1e3)+'k'
          : a>=1e3 ? (a/1e3).toFixed(1)+'k'
          : Math.round(a).toString();
  return (v<0?'-':'')+CUR+s;
}
function ticks(min,max,n){
  const out=[]; for(let i=0;i<=n;i++) out.push(min+(max-min)*i/n); return out;
}
/* nice round upper bound so gridlines land on sane numbers */
function niceBounds(min,max){
  if(max===min){ max = min+1; }
  const span = max-min;
  const step = Math.pow(10, Math.floor(Math.log10(span/4)));
  const mult = [1,2,2.5,5,10].find(m=> span/4 <= step*m) || 10;
  const s = step*mult;
  return {lo: Math.floor(min/s)*s, hi: Math.ceil(max/s)*s, step:s};
}
function gridY(c,w,h,pad,lo,hi,n,fmtV){
  fmtV = fmtV || shortNum;
  c.save();
  c.strokeStyle = css('--line'); c.fillStyle = css('--muted'); c.lineWidth = 1;
  c.textAlign='right';
  ticks(lo,hi,n).forEach(v=>{
    const y = Math.round(h-pad.b-(v-lo)/(hi-lo||1)*(h-pad.t-pad.b))+.5;
    c.beginPath(); c.moveTo(pad.l,y); c.lineTo(w-pad.r,y); c.stroke();
    c.fillText(fmtV(v), pad.l-8, y);
  });
  c.restore();
}
function axisWidth(c,lo,hi,n,fmtV){
  fmtV = fmtV || shortNum;
  let m=0; ticks(lo,hi,n).forEach(v=> m=Math.max(m, c.measureText(fmtV(v)).width));
  return Math.ceil(m)+14;
}
function roundRect(c,x,y,w,h,r){
  r = Math.min(r, h/2, w/2);
  c.beginPath();
  c.moveTo(x+r,y); c.lineTo(x+w-r,y); c.quadraticCurveTo(x+w,y,x+w,y+r);
  c.lineTo(x+w,y+h-r); c.quadraticCurveTo(x+w,y+h,x+w-r,y+h);
  c.lineTo(x+r,y+h); c.quadraticCurveTo(x,y+h,x,y+h-r);
  c.lineTo(x,y+r); c.quadraticCurveTo(x,y,x+r,y); c.closePath(); c.fill();
}
function ellipsis(c,s,maxw){
  s = String(s);
  if(c.measureText(s).width <= maxw) return s;
  while(s.length>1 && c.measureText(s+'\u2026').width > maxw) s = s.slice(0,-1);
  return s+'\u2026';
}

/* ---- horizontal grouped bars: category labels read straight across,
        so nothing rotates and nothing collides ---- */
function hBars(cv, labels, series){
  const rowH = series.length>1 ? 15 : 20;
  const gap = 16;
  const height = labels.length ? labels.length*(series.length*rowH+gap) + 34 : 150;
  const p = prep(cv, height); if(!p) return;
  const {c,w,h} = p;

  let max=0, min=0;
  series.forEach(s=>s.values.forEach(v=>{ if(isFinite(v)){ max=Math.max(max,v); min=Math.min(min,v);} }));
  const nb = niceBounds(Math.min(min,0), max||1);
  let labelW = 0;
  labels.forEach(l=> labelW = Math.max(labelW, c.measureText(l).width));
  labelW = Math.min(Math.ceil(labelW)+12, Math.max(90, w*0.32));
  const pad = {l:labelW, r:56, t:6, b:24};
  const plotW = w-pad.l-pad.r;
  const X = v => pad.l + (v-nb.lo)/(nb.hi-nb.lo||1)*plotW;

  // vertical gridlines + value scale along the bottom
  c.save();
  c.strokeStyle=css('--line'); c.fillStyle=css('--muted'); c.textAlign='center'; c.lineWidth=1;
  ticks(nb.lo,nb.hi,4).forEach(v=>{
    const x = Math.round(X(v))+.5;
    c.beginPath(); c.moveTo(x,pad.t); c.lineTo(x,h-pad.b); c.stroke();
    c.fillText(shortNum(v), x, h-pad.b+11);
  });
  c.restore();

  const band = series.length*rowH+gap;
  labels.forEach((lb,i)=>{
    const top = pad.t + i*band + gap/2;
    c.fillStyle = css('--text'); c.textAlign='right';
    c.fillText(ellipsis(c,lb,pad.l-12), pad.l-10, top + series.length*rowH/2);
    series.forEach((s,k)=>{
      const v = s.values[i]||0;
      const y = top + k*rowH;
      const x0 = X(Math.min(0,v)), x1 = X(Math.max(0,v));
      c.fillStyle = s.color;
      roundRect(c, x0, y+1, Math.max(2,x1-x0), rowH-3, 2);
      c.fillStyle = css('--muted'); c.textAlign='left';
      c.fillText(shortNum(v), x1+6, y+rowH/2);
    });
  });
}

/* ---- line / area ---- */
function lineChart(cv, labels, series, opts){
  opts = opts||{};
  const p = prep(cv, opts.height); if(!p) return;
  const {c,w,h} = p;
  const n = labels.length;
  if(!n){ c.fillStyle=css('--muted'); c.textAlign='center'; c.fillText('No data yet', w/2, h/2); return; }

  let max=-Infinity, min=Infinity;
  series.forEach(s=>s.values.forEach(v=>{ if(isFinite(v)){ max=Math.max(max,v); min=Math.min(min,v);} }));
  if(!isFinite(max)){ max=1; min=0; }
  const nb = niceBounds(min>0?0:min, max);
  const axisFmt = opts.axisFormat || shortNum;
  const pad = {l:axisWidth(c,nb.lo,nb.hi,4,axisFmt), r:14, t:10, b:26};
  gridY(c,w,h,pad,nb.lo,nb.hi,4,axisFmt);

  const X = i => pad.l + (n<2 ? (w-pad.l-pad.r)/2 : i*(w-pad.l-pad.r)/(n-1));
  const Yv = v => h-pad.b-(v-nb.lo)/(nb.hi-nb.lo||1)*(h-pad.t-pad.b);

  series.forEach(s=>{
    const pts = s.values.map((v,i)=>[X(i), Yv(isFinite(v)?v:nb.lo)]);
    if(s.fill && pts.length>1){
      c.beginPath(); pts.forEach((q,i)=> i?c.lineTo(q[0],q[1]):c.moveTo(q[0],q[1]));
      c.lineTo(pts[pts.length-1][0], Yv(nb.lo)); c.lineTo(pts[0][0], Yv(nb.lo)); c.closePath();
      c.globalAlpha=.12; c.fillStyle=s.color; c.fill(); c.globalAlpha=1;
    }
    c.strokeStyle=s.color; c.lineWidth=2; c.lineJoin='round'; c.lineCap='round';
    c.beginPath(); pts.forEach((q,i)=> i?c.lineTo(q[0],q[1]):c.moveTo(q[0],q[1]));
    if(s.dash) c.setLineDash([5,4]);
    c.stroke(); c.setLineDash([]);
    if(pts.length===1){ c.fillStyle=s.color; c.beginPath(); c.arc(pts[0][0],pts[0][1],3,0,7); c.fill(); }
  });

  // x labels: only as many as actually fit
  c.fillStyle=css('--muted');
  const lw = Math.max(...labels.map(l=>c.measureText(l).width)) + 16;
  const every = Math.max(1, Math.ceil(n/Math.max(1,Math.floor((w-pad.l-pad.r)/lw))));
  labels.forEach((lb,i)=>{
    if(i % every) return;
    const x = X(i);
    if(x > w-pad.r-lw/2 && i!==n-1) return;
    c.textAlign = i===0 ? 'left' : 'center';
    c.fillText(lb, i===0? pad.l : x, h-pad.b+12);
  });
  attachTip(cv, {labels, series, X, Yv, pad, w, h, tipFormat: opts.tipFormat || fmt});
}

/* ---- donut ---- */
function donut(cv, items, opts){
  opts = opts||{};
  const p = prep(cv, opts.height); if(!p) return;
  const {c,w,h} = p;
  const total = items.reduce((s,i)=>s+Math.max(0,i.value),0);
  const cx=w/2, cy=h/2, r=Math.max(20, Math.min(w,h)/2-10), ir=r*0.62;
  if(total<=0){
    c.strokeStyle=css('--line'); c.lineWidth=r-ir;
    c.beginPath(); c.arc(cx,cy,(r+ir)/2,0,Math.PI*2); c.stroke();
    c.fillStyle=css('--muted'); c.textAlign='center'; c.fillText('No data', cx, cy);
    return;
  }
  let a=-Math.PI/2;
  items.forEach(it=>{
    const sweep = Math.max(0,it.value)/total*Math.PI*2;
    if(sweep<=0) return;
    c.beginPath(); c.moveTo(cx,cy); c.arc(cx,cy,r,a,a+sweep); c.closePath();
    c.fillStyle = it.color; c.fill();
    // hairline separator so adjacent slices stay distinct
    c.strokeStyle = css('--surface'); c.lineWidth=1.5;
    c.beginPath(); c.moveTo(cx,cy); c.lineTo(cx+Math.cos(a)*r, cy+Math.sin(a)*r); c.stroke();
    a += sweep;
  });
  c.globalCompositeOperation='destination-out';
  c.beginPath(); c.arc(cx,cy,ir,0,Math.PI*2); c.fill();
  c.globalCompositeOperation='source-over';
  c.fillStyle=css('--text'); c.textAlign='center';
  c.font='600 15px ui-monospace,Menlo,Consolas,monospace';
  c.fillText(shortNum(total), cx, cy-6);
  c.font='10px ui-monospace,Menlo,Consolas,monospace'; c.fillStyle=css('--muted');
  c.fillText(opts.caption||'total', cx, cy+10);
}

/* ---- average day: one bar per interval, coloured by the rate band it falls in ---- */
function profileChart(cv, profile, bands, mins, colors){
  const p = prep(cv, 260); if(!p) return;
  const {c,w,h} = p;
  const n = profile.length;
  if(!n){ c.fillStyle=css('--muted'); c.textAlign='center'; c.fillText('No profile saved', w/2, h/2); return; }

  const max = Math.max(...profile, 0.001);
  const nb = niceBounds(0, max);
  const fmtY = v => v.toFixed(2);
  const pad = {l:axisWidth(c,nb.lo,nb.hi,4,fmtY), r:12, t:10, b:26};
  const plotW = w-pad.l-pad.r, plotH = h-pad.t-pad.b;

  // band backgrounds first, so the bars read against their window
  let runStart = 0;
  const bandAt = i => bandFor(new Date(2026,0,1, Math.floor(i*mins/60), (i*mins)%60), bands);
  for(let i=0;i<=n;i++){
    if(i===n || bandAt(i)!==bandAt(runStart)){
      const x0 = pad.l + runStart/n*plotW, x1 = pad.l + i/n*plotW;
      const b = bandAt(runStart);
      if(b!=='day'){
        c.globalAlpha = .07; c.fillStyle = colors[b];
        c.fillRect(x0, pad.t, x1-x0, plotH); c.globalAlpha = 1;
      }
      runStart = i;
    }
  }
  gridY(c,w,h,pad,nb.lo,nb.hi,4,fmtY);

  const bw = plotW/n;
  profile.forEach((v,i)=>{
    const bh = Math.max(1, (v-nb.lo)/(nb.hi-nb.lo||1)*plotH);
    c.fillStyle = colors[bandAt(i)];
    roundRect(c, pad.l+i*bw+0.5, h-pad.b-bh, Math.max(1,bw-1), bh, 1.5);
  });

  // x labels: two-digit hour only, every 3h when there is no room for more
  c.fillStyle = css('--muted'); c.textBaseline='middle';
  const perHour = 60/mins;
  const labelW = c.measureText('00').width + 10;
  const step = (24/2+1)*labelW <= plotW ? 2 : 3;   // every 2h when there is room, 3h on a phone
  for(let hr=0; hr<=24; hr+=step){
    const x = pad.l + (hr*perHour)/n*plotW;
    c.textAlign = hr===0?'left':(hr===24?'right':'center');
    c.fillText(String(hr).padStart(2,'0'), clamp(x,pad.l,w-pad.r), h-pad.b+12);
  }
}

/* ---- shared hover tooltip for line charts ---- */
function attachTip(cv, ctx){
  const box = cv.parentNode;
  let tip = box.querySelector('.tip');
  if(!tip){ tip = document.createElement('div'); tip.className='tip'; box.appendChild(tip); }
  cv._tip = ctx;
  if(cv._tipBound) return;
  cv._tipBound = true;
  const move = e=>{
    const d = cv._tip; if(!d) return;
    const rect = cv.getBoundingClientRect();
    const x = e.clientX-rect.left, y = e.clientY-rect.top;
    if(x < d.pad.l-8 || x > d.w-d.pad.r+8){ tip.classList.remove('on'); return; }
    const n = d.labels.length;
    const step = n<2 ? 1 : (d.w-d.pad.l-d.pad.r)/(n-1);
    const i = clamp(Math.round((x-d.pad.l)/step), 0, n-1);
    const tf = d.tipFormat || fmt;
    tip.innerHTML = '<b>'+esc(d.labels[i])+'</b>'+ d.series.map(s=>
      `<span><i style="background:${s.color}"></i>${esc(s.name||'')} ${tf(s.values[i]||0)}</span>`).join('<br>');
    tip.classList.add('on');
    const tw = tip.offsetWidth, th = tip.offsetHeight;
    tip.style.left = clamp(d.X(i)-tw/2, 2, Math.max(2,d.w-tw-2))+'px';
    tip.style.top  = clamp(y-th-12, 2, Math.max(2,d.h-th-2))+'px';
  };
  cv.addEventListener('mousemove', move);
  cv.addEventListener('mouseleave', ()=> tip.classList.remove('on'));
}

const PALETTE = ['#4fb3a3','#d6a544','#d0625d','#6f8fd0','#a97fc9','#6faf6c','#c98a5a','#5aa9c9','#c96f9b','#8a94a5'];
function legendHtml(items){
  return '<div class="legend">'+items.map(i=>`<span><i style="background:${i.color}"></i>${esc(i.label)}</span>`).join('')+'</div>';
}
function esc(s){ return String(s??'').replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[m])); }

