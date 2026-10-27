/* ---------------- cost of owning: the drawings ----------------
   Both are plain SVG. The year-by-year chart is drawn at the width of its box (so its text stays the size of the page's
   text on a phone as well as on a desktop) and redrawn when the box changes size; the bars for "where the money goes" are
   stretched to fit and carry no text of their own. Colours come from the page's variables, so dark mode follows. */
const tcoR = n => Math.round(n * 10) / 10;

/* One bar per year - savings up, costs down - and a line for the running total. `others` are other plans drawn as thin dashed lines. */
function tcoChartSvg(c, others, W){
  const small = W < 440, Ht = small ? 250 : 300, L = small ? 50 : 58, R = 12, T = 22, B = 36;
  const H = Math.max.apply(null, [c.H].concat(others.map(o=> o.calc.H)));
  let lo = 0, hi = 0;
  c.save.forEach(v=>{ hi = Math.max(hi, v); }); c.cost.forEach(v=>{ lo = Math.min(lo, -v); });
  [c.cum].concat(others.map(o=> o.calc.cum)).forEach(s=> s.forEach(v=>{ lo = Math.min(lo, v); hi = Math.max(hi, v); }));
  const nb = niceBounds(lo, hi), span = (nb.hi - nb.lo) || 1;
  const step = (W - L - R) / (H + 1), X = t => L + step * (t + 0.5), Y = v => T + (nb.hi - v) / span * (Ht - T - B);
  const bw = clamp(step * 0.6, 3, 30), every = H > 24 ? 5 : H > 12 ? 2 : 1;
  let g = '', ax = '';
  for(let v = nb.lo; v <= nb.hi + nb.step * 0.001; v += nb.step){
    const y = tcoR(Y(v));
    g += `<line class="tc-grid" x1="${L}" x2="${W - R}" y1="${y}" y2="${y}"/>`;
    ax += `<text class="tc-ax" x="${L - 6}" y="${tcoR(y + 4)}" text-anchor="end">${esc(shortNum(v))}</text>`;
  }
  let bars = '', hits = '';
  for(let t = 0; t <= c.H; t++){
    const sv = c.save[t], cs = c.cost[t], x = tcoR(X(t) - bw / 2);
    if(sv > 0.005) bars += `<rect class="tc-save" x="${x}" y="${tcoR(Y(sv))}" width="${tcoR(bw)}" height="${tcoR(Math.max(1, Y(0) - Y(sv)))}"/>`;
    if(cs > 0.005) bars += `<rect class="tc-cost" x="${x}" y="${tcoR(Y(0))}" width="${tcoR(bw)}" height="${tcoR(Math.max(1, Y(-cs) - Y(0)))}"/>`;
    hits += `<rect x="${tcoR(X(t) - step / 2)}" y="${T}" width="${tcoR(step)}" height="${Ht - T - B}" fill="transparent"><title>${t ? 'Year ' + t : 'Now'}: costs ${esc(fmt0(cs))}, savings ${esc(fmt0(sv))}, running total ${esc(fmt0(c.cum[t]))}</title></rect>`;
  }
  const pts = a => a.map((v, t)=> tcoR(X(t)) + ',' + tcoR(Y(v))).join(' ');
  const lines = others.map((o, i)=> `<polyline class="tc-o tc-o${i % 3}" points="${pts(o.calc.cum)}"/>`).join('');
  const dots = c.H <= 20 ? c.cum.map((v, t)=> `<circle class="tc-dot" cx="${tcoR(X(t))}" cy="${tcoR(Y(v))}" r="3.5"/>`).join('') : '';
  let xl = '';
  for(let t = 0; t <= H; t++) if(t % every === 0 || t === H) xl += `<text class="tc-ax" x="${tcoR(X(t))}" y="${Ht - B + 15}" text-anchor="middle">${t ? t : 'Now'}</text>`;
  const last = c.cum[c.H], endY = last >= 0 ? Y(last) - 10 : Y(last) + 17;
  const end = `<text class="tc-end" x="${tcoR(X(c.H) + bw / 2)}" y="${tcoR(endY)}" text-anchor="end">${esc(fmt0(last))}</text>`;
  let be = '';
  if(c.breakEven.status === 'at'){
    const bx = X(c.breakEven.years), anchor = bx < L + 60 ? 'start' : bx > W - R - 60 ? 'end' : 'middle';
    be = `<line class="tc-be" x1="${tcoR(bx)}" x2="${tcoR(bx)}" y1="${T - 4}" y2="${Ht - B}"/><text class="tc-bel" x="${tcoR(bx)}" y="${T - 8}" text-anchor="${anchor}">pays for itself</text>`;
  }
  const label = 'Chart of what you are ahead or behind after each year: it starts at ' + fmt0(c.cum[0]) + ' now and ends at ' + fmt0(last) + ' after ' + c.H + ' year' + (c.H === 1 ? '' : 's') + '.';
  return `<svg class="tco-svg" viewBox="0 0 ${W} ${Ht}" width="${W}" height="${Ht}" role="img" aria-label="${esc(label)}">
    ${g}${ax}<line class="tc-zero" x1="${L}" x2="${W - R}" y1="${tcoR(Y(0))}" y2="${tcoR(Y(0))}"/>${bars}${lines}${be}
    <polyline class="tc-line" points="${pts(c.cum)}"/>${dots}${xl}${end}
    <text class="tc-ax" x="${W - R}" y="${Ht - 3}" text-anchor="end">years from today</text>${hits}</svg>`;
}

/* every line's total over the plan, costs to the left and savings to the right, biggest first */
function tcoBarsHtml(c){
  const rows = c.lines.filter(l=> Math.abs(l.total) > 0.005).sort((a, b)=> Math.abs(b.total) - Math.abs(a.total));
  if(!rows.length) return '<div class="empty">Nothing to show yet.</div>';
  const max = Math.abs(rows[0].total);
  return `<div class="tco-bars">${rows.map(r=>{
    const w = Math.max(1.5, Math.abs(r.total) / max * 48), pos = r.total > 0;
    return `<div class="tco-row"><span class="l">${esc(r.label)}</span>
      <svg class="b" viewBox="0 0 100 14" preserveAspectRatio="none" aria-hidden="true" focusable="false"><line class="tc-zero" x1="50" x2="50" y1="0" y2="14"/><rect class="${pos ? 'tc-save' : 'tc-cost'}" x="${tcoR(pos ? 50 : 50 - w)}" y="2" width="${tcoR(w)}" height="10"/></svg>
      <span class="v num ${pos ? 'pos' : 'neg'}">${pos ? '+' : ''}${esc(fmt0(r.total))}</span></div>`;
  }).join('')}</div>`;
}
