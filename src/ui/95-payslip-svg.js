/* ---------------- payslips: the drawings ----------------
   A payslip is drawn as SVG - rectangles, arrows and text, no images - in the layout the person picks. Each layout is a
   function that takes a pen (g), the payslip (p) and its totals (c), draws, and returns its [width, height].

   Every box a layout draws that means something is also given a hotspot: g.hot(key, x, y, w, h, label). The keys are the ones
   psExplain() answers to. Hotspots are drawn last so they sit on top; a small tick or "!" is added to a hotspot whose box has a
   self-check (marks). With o.plain nothing interactive is drawn at all, which is what the downloaded SVG and the layout thumbnails use.

   The paper is always white with dark ink, in both themes: it is a document, not part of the page chrome. */

const PS_INK = '#1f2fb8';             // the blue of the Sage-style bars
const psN = v => num(v).toLocaleString('en-IE', {minimumFractionDigits:2, maximumFractionDigits:2});
const psDate = d => { const x = parseDate(d); return x ? String(x.getDate()).padStart(2, '0') + '/' + String(x.getMonth() + 1).padStart(2, '0') + '/' + x.getFullYear() : ''; };
const psClip = (s, n) => { s = String(s == null ? '' : s); return s.length > n ? s.slice(0, n - 1) + '…' : s; };
const psFreqCode = f => f === '4' ? '4' : f;

/* The text styles live inside the SVG so a downloaded file looks the same as the page. Class names start with q to stay clear of the page's own. */
const PS_SVG_STYLE = '<style>.qv,.qvb,.qvl,.ql,.qs,.qc,.qb,.qm,.qh,.qbig{font-family:Arial,Helvetica,"Segoe UI",sans-serif;fill:#14171f}' +
  '.qv{font-size:15px}.qvb{font-size:15px;font-weight:700}.qvl{font-size:18px}.ql{font-size:11.5px;font-weight:700;fill:#fff;letter-spacing:.2px}' +
  '.qs{font-size:11px;font-weight:700;fill:#fff}.qc{font-size:9.5px;font-weight:700;fill:' + PS_INK + '}.qb{font-size:10.5px;font-weight:700;fill:' + PS_INK + '}' +
  '.qm{font-size:11px;fill:#5b6573}.qh{font-size:12.5px;font-weight:700;fill:#fff}.qbig{font-size:34px;font-weight:700}' +
  '.hz{fill:transparent;stroke:transparent;stroke-width:2}.hs{cursor:pointer;outline:none}.hs:hover .hz,.hs:focus-visible .hz{fill:rgba(255,190,40,.2);stroke:#e8960c}' +
  '.hs.sel .hz{fill:rgba(255,190,40,.34);stroke:#e8960c;stroke-width:2.5}.mk-ok{fill:#2b7a30}.mk-warn{fill:#d77a00}.mkt{font:700 10px Arial,sans-serif;fill:#fff;text-anchor:middle}</style>';

/* The pen: collects shapes and hotspots, then wraps them in the <svg>. */
let psSeq = 0;
function psPen(o, marks){
  const parts = [], hots = [];
  const g = {
    id:'q' + (++psSeq),           // gradient and clip ids must differ between the drawings on one page
    raw:s=>{ parts.push(s); },
    rect:(x, y, w, h, a)=>{ parts.push('<rect x="' + x + '" y="' + y + '" width="' + w + '" height="' + h + '" ' + (a || '') + '/>'); },
    line:(x1, y1, x2, y2, a)=>{ parts.push('<line x1="' + x1 + '" y1="' + y1 + '" x2="' + x2 + '" y2="' + y2 + '" ' + (a || 'stroke="#c9d1dc" stroke-width="1"') + '/>'); },
    text:(x, y, s, cls, anchor, extra)=>{
      if(s === '' || s == null) return;
      parts.push('<text x="' + x + '" y="' + y + '" class="' + (cls || 'qv') + '"' + (anchor ? ' text-anchor="' + anchor + '"' : '') + (extra ? ' ' + extra : '') + '>' + esc(s) + '</text>');
    },
    hot:(key, x, y, w, h, label)=>{ if(!o.plain) hots.push({key, x, y, w, h, label}); },
    finish:(W, H, name)=>{
      const mark = h=>{
        const m = marks[h.key]; if(!m) return '';
        const cx = Math.min(h.x + h.w - 2, W - 7), cy = Math.max(h.y + 2, 7);          // astride the top-right corner, where it covers the least text
        return '<circle class="mk-' + m + '" cx="' + cx + '" cy="' + cy + '" r="6"/>' + (m === 'ok'
          ? '<polyline points="' + (cx - 3) + ',' + cy + ' ' + (cx - 0.8) + ',' + (cy + 2.4) + ' ' + (cx + 3.1) + ',' + (cy - 2.4) + '" fill="none" stroke="#fff" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round"/>'
          : '<text class="mkt" x="' + cx + '" y="' + (cy + 3.6) + '">!</text>');
      };
      const hs = hots.map(h=> '<g class="hs' + (o.sel === h.key ? ' sel' : '') + '" data-k="' + esc(h.key) + '" tabindex="0" role="button" aria-label="' + esc(h.label) + '">' +
        '<rect class="hz" x="' + h.x + '" y="' + h.y + '" width="' + h.w + '" height="' + h.h + '" rx="4"/>' + mark(h) + '</g>').join('');
      return '<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ' + W + ' ' + H + '"' + (o.size ? ' width="' + W + '" height="' + H + '"' : ' class="psv-svg"') +
        ' role="group" aria-label="' + esc('Payslip in the ' + name + ' layout') + '">' + PS_SVG_STYLE + '<rect width="' + W + '" height="' + H + '" fill="#fff"/>' + parts.join('') + hs + '</svg>';
    }
  };
  return g;
}

/* The one entry point. o: {plain, sel, size, checks}. */
function psSvg(p, o){
  o = o || {};
  const c = psCalc(p), marks = {};
  if(!o.plain) (o.checks || psChecks(p, c)).forEach(ck=>{ if(ck.status === 'warn') marks[ck.key] = 'warn'; else if(ck.status === 'ok' && marks[ck.key] !== 'warn') marks[ck.key] = 'ok'; });
  const g = psPen(o, marks), layout = PS_LAYOUTS[p.layout] ? p.layout : 'sage';
  const dim = {sage:psDrawSage, classic:psDrawClassic, modern:psDrawModern}[layout](g, p, c);
  return g.finish(dim[0], dim[1], PS_LAYOUTS[layout].name);
}

/* ================= Sage-style ================= */
function psDrawSage(g, p, c){
  const B = PS_INK, W = 1000, H = 578;
  const tag = (x, y, w, h, t)=>{
    g.raw('<polygon points="' + x + ',' + y + ' ' + (x + w - 9) + ',' + y + ' ' + (x + w) + ',' + (y + h / 2) + ' ' + (x + w - 9) + ',' + (y + h) + ' ' + x + ',' + (y + h) + '" fill="' + B + '"/>');
    g.text(x + 9, y + h / 2 + 4, t, 'ql');
  };
  const bar = (x, y, w, h, t)=>{ g.rect(x, y, w, h, 'rx="3" fill="' + B + '"'); g.text(x + w / 2, y + h / 2 + 4.5, t, 'qh', 'middle'); };
  const field = (key, label, tx, ty, tw, vx, val, hw, aria, cls)=>{
    tag(tx, ty, tw, 22, label); g.text(vx, ty + 16.5, val, cls || 'qvl');
    g.hot(key, tx, ty, hw, 22, aria + (val !== '' ? ': ' + val : ''));
  };
  /* top line */
  g.text(8, 17, p.employer.name, 'qvb');
  g.text(992, 17, p.employer.regNo ? 'Company Reg. Number: ' + p.employer.regNo : '', 'qvb', 'end');
  g.hot('employer.name', 6, 2, 440, 20, 'Employer: ' + p.employer.name);
  g.hot('employer.regNo', 560, 2, 434, 20, 'Company registration number: ' + p.employer.regNo);
  /* header rows */
  field('employee.name', 'EMP. NAME', 8, 28, 132, 150, psClip(p.employee.name, 26), 400, 'Employee name');
  field('employee.number', 'EMP.NUMBER', 8, 58, 132, 150, psClip(p.employee.number, 8), 200, 'Employee number');
  field('employee.dept', 'DEPT', 222, 58, 76, 308, psClip(p.employee.dept, 6), 130, 'Department');
  field('employee.cost', 'COST', 372, 58, 76, 458, psClip(p.employee.cost, 7), 150, 'Cost centre');
  field('period.freq', 'FREQUENCY', 540, 28, 116, 668, psFreqCode(p.period.freq), 150, 'Pay frequency');
  field('period.number', 'PAY PERIOD', 540, 58, 116, 668, String(c.no), 150, 'Pay period');
  field('employee.ppsn', 'PPS NUMBER', 706, 28, 132, 850, p.employee.ppsn, 288, 'PPS number');
  field('period.date', 'PAYMENT DATE', 706, 58, 132, 850, psDate(p.period.date), 288, 'Payment date');
  /* the two big tables */
  bar(8, 92, 396, 18, 'PAYMENT DETAILS'); bar(406, 92, 426, 18, 'DEDUCTION DETAILS');
  g.rect(8, 110, 396, 290, 'fill="none" stroke="' + B + '" stroke-width="1.2"'); g.rect(406, 110, 426, 290, 'fill="none" stroke="' + B + '" stroke-width="1.2"');
  g.line(8, 126, 404, 126, 'stroke="' + B + '"'); g.line(406, 126, 832, 126, 'stroke="' + B + '"');
  [140, 184, 290].forEach(x=> g.line(x, 110, x, 400, 'stroke="' + B + '" stroke-opacity=".55"'));
  [540, 584, 708].forEach(x=> g.line(x, 110, x, 400, 'stroke="' + B + '" stroke-opacity=".55"'));
  [['DESCRIPTION', 74], ['T/N', 162], ['HOURS', 237], ['VALUE', 347], ['DESCRIPTION', 473], ['T/N', 562], ['THIS PERIOD', 646], ['BALANCE', 770]].forEach(h=> g.text(h[1], 122, h[0], 'qc', 'middle'));
  const rows = Math.max(p.payments.length, p.deductions.length, 1), lh = Math.max(15, Math.min(21, 268 / rows)), fit = Math.floor(268 / lh);
  const rowY = i => 128 + i * lh, base = i => rowY(i) + lh * 0.74;
  p.payments.slice(0, fit).forEach((x, i)=>{
    g.text(14, base(i), psClip(x.desc, 17));
    g.text(162, base(i), x.taxable ? 'Y' : 'N', 'qv', 'middle');
    g.text(284, base(i), num(x.hours) ? psN(x.hours) : '', 'qv', 'end');
    g.text(398, base(i), psN(x.amount), 'qv', 'end');
    g.hot('pay:' + x.id, 9, rowY(i), 394, lh, (x.desc || 'Payment') + ': ' + psN(x.amount));
  });
  p.deductions.slice(0, fit).forEach((x, i)=>{
    g.text(412, base(i), psClip(x.desc, 17));
    g.text(562, base(i), psDedCode(x), 'qv', 'middle');
    g.text(702, base(i), psN(x.amount), 'qv', 'end');
    g.text(826, base(i), num(x.ytd) ? psN(x.ytd) : '', 'qv', 'end');
    g.hot('ded:' + x.id, 407, rowY(i), 424, lh, (x.desc || 'Deduction') + ': ' + psN(x.amount));
  });
  /* summary of pay, down the right */
  g.rect(842, 92, 150, 36, 'rx="6" fill="' + B + '"');
  g.text(917, 107, 'SUMMARY', 'qh', 'middle'); g.text(917, 122, 'OF PAY', 'qh', 'middle');
  [['GROSS PAY', 'sum.gross', psN(c.shown.gross)], ['TOTAL DEDS', 'sum.deds', psN(c.shown.deds)], ['NON-TAX ADJS.', 'sum.nontax', psN(c.shown.nonTax)],
   ['ROUNDING', 'sum.rounding', psN(c.rounding)], ['NETT PAY', 'sum.net', psN(c.shown.net)], ['PAY METHOD', 'period.method', psClip(p.period.method, 16)]].forEach((b, i)=>{
    const y = 134 + i * 72;
    g.rect(850, y, 134, 18, 'rx="9" fill="' + B + '"'); g.text(917, y + 13, b[0], 'qs', 'middle');
    g.rect(842, y + 18, 150, 50, 'rx="5" fill="#fff" stroke="' + B + '" stroke-width="1.2"');
    if(b[1] === 'period.method') g.text(917, y + 48, b[2], 'qv', 'middle'); else g.text(984, y + 50, b[2], 'qvl', 'end');
    g.hot(b[1], 842, y, 150, 68, b[0] + ': ' + b[2]);
  });
  /* the three boxes along the bottom */
  const panel = (x, w, title, list)=>{
    bar(x, 410, w, 18, title);
    g.rect(x, 428, w, 150 - 10, 'fill="#fff" stroke="' + B + '" stroke-width="1.2"');
    list.forEach((r, i)=>{
      const y = 434 + i * 22;
      g.text(x + 8, y + 15, r[0], 'qb'); g.text(x + w - 8, y + 15, r[2], 'qv', 'end');
      g.hot(r[1], x + 2, y, w - 4, 22, r[0] + ': ' + r[2]);
    });
  };
  const cum = p.cum;
  panel(8, 270, 'CUMULATIVE DETAILS', [['GROSS PAY', 'cum.gross', psN(cum.gross)], ['NON-TAX DEDS', 'cum.nonTaxDeds', psN(cum.nonTaxDeds)], ['TAXABLE PAY', 'cum.taxable', psN(cum.taxable)],
    ['TAX CREDIT', 'cum.credit', psN(cum.credit)], ['STD CUT OFF', 'cum.cutoff', psN(cum.cutoff)], ['TAX PAID', 'cum.taxPaid', psN(cum.taxPaid)]]);
  panel(282, 276, 'TAX/PRSI DETAILS', [['TAX/USC STATUS', 'tax.status', psClip(p.tax.status, 6)], ['EMER ST. PER', 'tax.emer', psClip(p.tax.emer, 6)],
    ['TAX CREDIT TTP', 'tax.creditPeriod', num(p.tax.creditPeriod) ? psN(p.tax.creditPeriod) : ''], ['PRSI CODE', 'tax.prsiClass', psClip(p.tax.prsiClass, 6)], ['TOTAL INS WK', 'tax.insWeeks', num(p.tax.insWeeks) ? String(num(p.tax.insWeeks)) : '']]);
  panel(562, 270, 'ADDITIONAL DETAILS', [["EMP'ER PRSI T.P.", 'er.prsi', psN(p.er.prsiPeriod)], ["EMP'ER PRSI T.D.", 'er.prsiYtd', psN(p.er.prsiYtd)]]
    .concat(psHasErPens(p) ? [['ER PENS TP', 'er.pens', psN(p.er.pensPeriod)], ['ER PENS TY', 'er.pensYtd', psN(p.er.pensYtd)]] : [], [['BIK YTD', 'er.bikYtd', psN(p.er.bikYtd)]]));
  return [W, H];
}

/* ================= classic page ================= */
function psDrawClassic(g, p, c){
  const W = 760, NAVY = '#17324d', LINE = '#cfd8e3', STRIPE = '#f1f4f8';
  const cell = (key, label, x, y, w, val)=>{ g.text(x, y, label, 'qm'); g.text(x, y + 17, val, 'qvb'); g.hot(key, x - 6, y - 12, w, 36, label + ': ' + val); };
  /* header band */
  g.rect(0, 0, W, 74, 'fill="' + NAVY + '"');
  g.text(24, 36, psClip(p.employer.name || 'Employer', 34), 'qbig', null, 'style="font-size:22px;fill:#fff"');
  g.text(24, 57, p.employer.regNo ? 'Company reg. no. ' + p.employer.regNo : '', 'qm', null, 'style="fill:#c9d6e6"');
  g.text(736, 32, 'PAYSLIP', 'qbig', 'end', 'style="font-size:22px;fill:#fff;letter-spacing:2px"');
  g.text(736, 52, 'Paid ' + psDate(p.period.date), 'qm', 'end', 'style="fill:#fff;font-size:12.5px"');
  g.text(736, 67, psPeriodWord(p) + ' ' + c.no + ' of ' + c.n, 'qm', 'end', 'style="fill:#c9d6e6"');
  g.hot('employer.name', 14, 8, 400, 30, 'Employer: ' + p.employer.name); g.hot('employer.regNo', 14, 42, 300, 24, 'Company registration number: ' + p.employer.regNo);
  g.hot('period.date', 520, 38, 224, 16, 'Payment date: ' + psDate(p.period.date)); g.hot('period.number', 520, 54, 224, 16, 'Pay period: ' + c.no);
  /* who */
  const cx = [30, 396];
  cell('employee.name', 'Employee', cx[0], 100, 330, psClip(p.employee.name, 30)); cell('employee.number', 'Employee number', cx[1], 100, 330, psClip(p.employee.number, 20));
  cell('employee.ppsn', 'PPS number', cx[0], 140, 330, p.employee.ppsn); cell('employee.dept', 'Department', cx[1], 140, 330, psClip(p.employee.dept, 20));
  cell('period.freq', 'Paid', cx[0], 180, 330, c.f.label); cell('employee.cost', 'Cost centre', cx[1], 180, 330, psClip(p.employee.cost, 20));
  cell('period.method', 'Pay method', cx[0], 220, 330, psClip(p.period.method, 24));
  g.line(24, 250, 736, 250);
  /* a table: heading band, rows, total */
  let y = 262;
  const head = (title, cols)=>{
    g.rect(24, y, 712, 24, 'fill="' + STRIPE + '"'); g.text(34, y + 16.5, title, 'qvb', null, 'style="fill:' + NAVY + ';letter-spacing:1px;font-size:12.5px"');
    cols.forEach(cc=> g.text(cc[0], y + 16.5, cc[1], 'qm', 'end')); y += 24;
  };
  const total = (key, label, val, cols)=>{
    g.line(24, y + 2, 736, y + 2, 'stroke="' + NAVY + '" stroke-width="1.5"'); g.text(34, y + 21, label, 'qvb'); g.text(736, y + 21, val, 'qvb', 'end'); (cols || []).forEach(cc=> g.text(cc[0], y + 21, cc[1], 'qvb', 'end'));
    g.hot(key, 24, y + 4, 712, 24, label + ': ' + val); y += 32;
  };
  head('PAYMENTS', [[500, 'Hours'], [620, 'Taxable'], [726, 'Amount']]);
  p.payments.forEach((x, i)=>{
    if(i % 2) g.rect(24, y, 712, 24, 'fill="#fafbfc"');
    g.text(34, y + 17, psClip(x.desc, 40)); g.text(500, y + 17, num(x.hours) ? psN(x.hours) : '', 'qv', 'end'); g.text(620, y + 17, x.taxable ? 'Yes' : 'No', 'qv', 'end'); g.text(726, y + 17, psN(x.amount), 'qv', 'end');
    g.hot('pay:' + x.id, 24, y, 712, 24, (x.desc || 'Payment') + ': ' + psN(x.amount)); y += 24;
  });
  total('sum.gross', 'Gross pay', psN(c.shown.gross)); y += 4;
  head('DEDUCTIONS', [[580, 'This pay'], [726, 'Year to date']]);
  p.deductions.forEach((x, i)=>{
    if(i % 2) g.rect(24, y, 712, 24, 'fill="#fafbfc"');
    g.text(34, y + 17, psClip(x.desc, 40) + (x.pre ? '  (before tax)' : '')); g.text(580, y + 17, psN(x.amount), 'qv', 'end'); g.text(726, y + 17, num(x.ytd) ? psN(x.ytd) : '', 'qv', 'end');
    g.hot('ded:' + x.id, 24, y, 712, 24, (x.desc || 'Deduction') + ': ' + psN(x.amount)); y += 24;
  });
  total('sum.deds', 'Total deductions', psN(c.shown.deds)); y += 2;
  [['Non-tax adjustments', 'sum.nontax', psN(c.shown.nonTax)], ['Rounding', 'sum.rounding', psN(c.rounding)]].forEach(r=>{
    g.text(34, y + 14, r[0], 'qm'); g.text(726, y + 14, r[2], 'qv', 'end', 'style="font-size:13px"'); g.hot(r[1], 24, y, 712, 20, r[0] + ': ' + r[2]); y += 20;
  });
  y += 10;
  /* net pay */
  g.rect(24, y, 712, 64, 'rx="10" fill="#e8f4ec" stroke="#2b7a30" stroke-width="1.5"');
  g.text(44, y + 28, 'NET PAY', 'qvb', null, 'style="letter-spacing:2px;font-size:13px;fill:#1b5c2f"');
  g.text(44, y + 49, 'Paid by ' + (p.period.method || 'bank transfer').toLowerCase() + ' on ' + psDate(p.period.date), 'qm');
  g.text(716, y + 45, psN(c.shown.net), 'qbig', 'end', 'style="fill:#1b5c2f"');
  g.hot('sum.net', 24, y, 712, 64, 'Net pay: ' + psN(c.shown.net)); y += 82;
  /* year to date and tax details, side by side */
  const box = (x, w, title, list)=>{
    g.rect(x, y, w, 26 + list.length * 22 + 8, 'rx="8" fill="#fff" stroke="' + LINE + '"'); g.text(x + 14, y + 18, title, 'qvb', null, 'style="font-size:12.5px;letter-spacing:1px;fill:' + NAVY + '"');
    list.forEach((r, i)=>{ const yy = y + 30 + i * 22; g.text(x + 14, yy + 14, r[0], 'qm', null, 'style="font-size:12px"'); g.text(x + w - 14, yy + 14, r[2], 'qv', 'end', 'style="font-size:13.5px"'); g.hot(r[1], x + 4, yy, w - 8, 22, r[0] + ': ' + r[2]); });
    return 26 + list.length * 22 + 8;
  };
  const cum = p.cum;
  const h1 = box(24, 346, 'YEAR TO DATE', [['Gross pay', 'cum.gross', psN(cum.gross)], ['Non-tax deductions', 'cum.nonTaxDeds', psN(cum.nonTaxDeds)], ['Taxable pay', 'cum.taxable', psN(cum.taxable)],
    ['Tax credit', 'cum.credit', psN(cum.credit)], ['Standard rate cut-off', 'cum.cutoff', psN(cum.cutoff)], ['Tax paid', 'cum.taxPaid', psN(cum.taxPaid)]]);
  box(390, 346, 'TAX AND PRSI', [['Tax basis', 'tax.status', psClip(p.tax.status || PS_BASES[p.tax.basis], 18)], ['Emergency status', 'tax.emer', psClip(p.tax.emer, 12)],
    ['Credit this pay', 'tax.creditPeriod', num(p.tax.creditPeriod) ? psN(p.tax.creditPeriod) : ''], ['Cut-off this pay', 'tax.cutoffPeriod', num(p.tax.cutoffPeriod) ? psN(p.tax.cutoffPeriod) : ''],
    ['PRSI class', 'tax.prsiClass', p.tax.prsiClass], ['Insurable weeks', 'tax.insWeeks', num(p.tax.insWeeks) ? String(num(p.tax.insWeeks)) : '']]);
  y += h1 + 14;
  /* employer's side */
  g.text(34, y + 4, 'EMPLOYER COSTS - NOT TAKEN FROM YOUR PAY', 'qm', null, 'style="font-size:10.5px;letter-spacing:1px"'); y += 10;
  const er = [['Employer PRSI this pay', 'er.prsi', psN(p.er.prsiPeriod)], ['Employer PRSI to date', 'er.prsiYtd', psN(p.er.prsiYtd)]]
    .concat(psHasErPens(p) ? [['Employer pension this pay', 'er.pens', psN(p.er.pensPeriod)], ['Employer pension to date', 'er.pensYtd', psN(p.er.pensYtd)]] : [], [['Benefit in kind to date', 'er.bikYtd', psN(p.er.bikYtd)]]);
  er.forEach((r, i)=>{
    const x = 24 + (i % 3) * 240, yy = y + Math.floor(i / 3) * 54; g.rect(x, yy, 232, 46, 'rx="8" fill="' + STRIPE + '"'); g.text(x + 12, yy + 18, r[0], 'qm', null, 'style="font-size:11.5px"'); g.text(x + 12, yy + 38, r[2], 'qvb');
    g.hot(r[1], x, yy, 232, 46, r[0] + ': ' + r[2]);
  });
  y += Math.ceil(er.length / 3) * 54 + 12;
  return [W, y];
}

/* ================= online portal ================= */
function psDrawModern(g, p, c){
  const W = 760, TEAL = '#0d7a69', LINE = '#e1e6ec', SOFT = '#f3f6f9';
  const split = psSplit(p, c), SPLIT_COL = {paye:'#d0625d', usc:'#d6a544', prsi:'#6f8fd0', pension:'#a97fc9', other:'#8a94a5', net:TEAL};
  /* who */
  const initials = (p.employee.name || '?').split(/[\s,]+/).filter(Boolean).slice(0, 2).map(s=>s.charAt(0).toUpperCase()).join('') || '?';
  g.raw('<circle cx="56" cy="52" r="26" fill="#e5f4f1"/>'); g.text(56, 59, initials, 'qvb', 'middle', 'style="font-size:18px;fill:' + TEAL + '"');
  g.text(96, 46, psClip(p.employee.name || 'Your name', 28), 'qvb', null, 'style="font-size:20px"'); g.text(96, 66, psClip(p.employer.name || 'Employer', 34), 'qm', null, 'style="font-size:12.5px"');
  g.text(548, 66, p.employer.regNo ? 'Reg. no. ' + p.employer.regNo : '', 'qm', 'end', 'style="font-size:12.5px"');
  g.hot('employee.name', 90, 24, 330, 28, 'Employee: ' + p.employee.name); g.hot('employer.name', 90, 52, 290, 20, 'Employer: ' + p.employer.name);
  g.hot('employer.regNo', 384, 52, 168, 20, 'Company registration number: ' + p.employer.regNo);
  g.rect(560, 28, 176, 36, 'rx="18" fill="' + SOFT + '"'); g.text(648, 51, 'Payslip  ' + psDate(p.period.date), 'qvb', 'middle', 'style="font-size:13.5px"');
  g.hot('period.date', 560, 28, 176, 36, 'Payment date: ' + psDate(p.period.date));
  /* hero */
  g.raw('<defs><linearGradient id="' + g.id + 'g" x1="0" y1="0" x2="1" y2="1"><stop offset="0" stop-color="#0d7a69"/><stop offset="1" stop-color="#0a5d6f"/></linearGradient></defs>');
  g.rect(24, 96, 712, 132, 'rx="18" fill="url(#' + g.id + 'g)"');
  g.text(48, 128, 'Take-home pay', 'qm', null, 'style="fill:#cfeee8;font-size:14px"');
  g.text(48, 180, psN(c.shown.net), 'qbig', null, 'style="font-size:50px;fill:#fff"');
  g.text(48, 206, 'Paid by ' + (p.period.method || 'bank transfer').toLowerCase() + ' on ' + psDate(p.period.date), 'qm', null, 'style="fill:#cfeee8;font-size:13px"');
  g.hot('sum.net', 30, 102, 420, 120, 'Net pay: ' + psN(c.shown.net));
  const prog = Math.min(c.no / c.n, 1);
  g.text(712, 128, c.f.label + ' pay', 'qm', 'end', 'style="fill:#cfeee8;font-size:13px"'); g.text(712, 156, psPeriodWord(p) + ' ' + c.no + ' of ' + c.n, 'qvb', 'end', 'style="fill:#fff;font-size:17px"');
  g.rect(540, 176, 172, 8, 'rx="4" fill="#ffffff" fill-opacity=".25"'); g.rect(540, 176, Math.max(172 * prog, 8), 8, 'rx="4" fill="#fff"');
  g.text(712, 206, 'Method: ' + psClip(p.period.method, 16), 'qm', 'end', 'style="fill:#cfeee8;font-size:12.5px"');
  g.hot('period.freq', 520, 112, 200, 28, 'Pay frequency: ' + c.f.label); g.hot('period.number', 520, 140, 200, 50, 'Pay period: ' + c.no); g.hot('period.method', 520, 190, 200, 24, 'Pay method: ' + p.period.method);
  /* where it went */
  let y = 256;
  g.text(24, y, 'Where your pay went', 'qvb', null, 'style="font-size:14px"'); y += 12;
  const total = split.reduce((s, x)=> s + x.amount, 0) || 1; let bx = 24;
  g.raw('<clipPath id="' + g.id + 'c"><rect x="24" y="' + y + '" width="712" height="18" rx="9"/></clipPath><g clip-path="url(#' + g.id + 'c)">');
  split.forEach(s=>{ const w = 712 * s.amount / total; g.rect(bx, y, w, 18, 'fill="' + SPLIT_COL[s.id] + '"'); bx += w; });
  g.raw('</g>');
  y += 36; let lx = 24;
  split.forEach(s=>{
    g.raw('<circle cx="' + (lx + 5) + '" cy="' + (y - 4) + '" r="5" fill="' + SPLIT_COL[s.id] + '"/>');
    g.text(lx + 15, y, s.label + '  ' + psN(s.amount), 'qm', null, 'style="font-size:11.5px;fill:#14171f"'); lx += 15 + (s.label.length + 9) * 6.2 + 8;
    if(lx > 640){ lx = 24; y += 18; }
  });
  y += 30;
  /* earnings and deductions */
  const list = (x, title, rows, totalLabel, totalKey, totalVal)=>{
    let yy = y;
    g.text(x, yy, title, 'qvb', null, 'style="font-size:14px"'); yy += 10;
    rows.forEach(r=>{
      yy += 26; g.text(x, yy - 8, psClip(r.label, 26), 'qv', null, 'style="font-size:14px"'); g.text(x + 340, yy - 8, r.val, 'qv', 'end', 'style="font-size:14px"');
      if(r.sub) g.text(x, yy + 5, r.sub, 'qm', null, 'style="font-size:10.5px"'), yy += 10;
      g.line(x, yy, x + 346, yy, 'stroke="' + LINE + '"'); g.hot(r.key, x - 4, yy - 24 - (r.sub ? 10 : 0), 354, 26 + (r.sub ? 10 : 0), r.label + ': ' + r.val);
    });
    yy += 26; g.text(x, yy - 6, totalLabel, 'qvb', null, 'style="font-size:14px"'); g.text(x + 340, yy - 6, totalVal, 'qvb', 'end', 'style="font-size:14px"');
    g.hot(totalKey, x - 4, yy - 24, 354, 28, totalLabel + ': ' + totalVal);
    return yy;
  };
  const e = list(24, 'Earnings', p.payments.map(x=>({key:'pay:' + x.id, label:x.desc || 'Payment', val:psN(x.amount), sub:x.kind === 'bik' ? 'notional - not paid to you' : x.taxable ? '' : 'not taxed'})), 'Gross pay', 'sum.gross', psN(c.shown.gross));
  const d = list(390, 'Deductions', p.deductions.map(x=>({key:'ded:' + x.id, label:x.desc || 'Deduction', val:psN(x.amount), sub:num(x.ytd) ? 'so far this year ' + psN(x.ytd) : ''})), 'Total deductions', 'sum.deds', psN(c.shown.deds));
  y = Math.max(e, d) + 10;
  [['Non-tax adjustments', 'sum.nontax', psN(c.shown.nonTax)], ['Rounding', 'sum.rounding', psN(c.rounding)]].forEach((r, i)=>{
    const x = 24 + i * 366; g.text(x, y + 14, r[0], 'qm'); g.text(x + 340, y + 14, r[2], 'qv', 'end', 'style="font-size:13.5px"'); g.hot(r[1], x - 4, y, 354, 22, r[0] + ': ' + r[2]);
  });
  y += 42;
  /* year so far, as tiles */
  g.text(24, y, 'Your year so far', 'qvb', null, 'style="font-size:14px"'); y += 12;
  const cum = p.cum;
  [['Gross pay', 'cum.gross', psN(cum.gross)], ['Taxable pay', 'cum.taxable', psN(cum.taxable)], ['Tax paid', 'cum.taxPaid', psN(cum.taxPaid)],
   ['Non-tax deductions', 'cum.nonTaxDeds', psN(cum.nonTaxDeds)], ['Tax credit', 'cum.credit', psN(cum.credit)], ['Standard rate cut-off', 'cum.cutoff', psN(cum.cutoff)]].forEach((t, i)=>{
    const x = 24 + (i % 3) * 240, yy = y + Math.floor(i / 3) * 62;
    g.rect(x, yy, 232, 54, 'rx="10" fill="' + SOFT + '"'); g.text(x + 14, yy + 20, t[0], 'qm', null, 'style="font-size:11.5px"'); g.text(x + 14, yy + 42, t[2], 'qvb', null, 'style="font-size:16px"');
    g.hot(t[1], x, yy, 232, 54, t[0] + ': ' + t[2]);
  });
  y += 140;
  /* settings and employer costs as chips */
  g.text(24, y, 'Tax settings and employer costs', 'qvb', null, 'style="font-size:14px"'); y += 12;
  const chips = [['Tax basis', 'tax.status', psClip(p.tax.status || PS_BASES[p.tax.basis], 14)], ['Emergency status', 'tax.emer', psClip(p.tax.emer, 10)],
    ['Credit this pay', 'tax.creditPeriod', num(p.tax.creditPeriod) ? psN(p.tax.creditPeriod) : ''], ['Cut-off this pay', 'tax.cutoffPeriod', num(p.tax.cutoffPeriod) ? psN(p.tax.cutoffPeriod) : ''],
    ['PRSI class', 'tax.prsiClass', p.tax.prsiClass], ['Insurable weeks', 'tax.insWeeks', num(p.tax.insWeeks) ? String(num(p.tax.insWeeks)) : ''],
    ['Employer PRSI', 'er.prsi', psN(p.er.prsiPeriod)], ['Employer PRSI to date', 'er.prsiYtd', psN(p.er.prsiYtd)],
    ...(psHasErPens(p) ? [['Employer pension', 'er.pens', psN(p.er.pensPeriod)], ['Employer pension to date', 'er.pensYtd', psN(p.er.pensYtd)]] : []),
    ['Benefit in kind to date', 'er.bikYtd', psN(p.er.bikYtd)],
    ['Employee number', 'employee.number', psClip(p.employee.number, 10)], ['Department', 'employee.dept', psClip(p.employee.dept, 10)], ['Cost centre', 'employee.cost', psClip(p.employee.cost, 10)],
    ['PPS number', 'employee.ppsn', p.employee.ppsn]];
  chips.forEach((t, i)=>{
    const x = 24 + (i % 4) * 180, yy = y + Math.floor(i / 4) * 52;
    g.rect(x, yy, 172, 44, 'rx="9" fill="#fff" stroke="' + LINE + '"'); g.text(x + 12, yy + 17, t[0], 'qm', null, 'style="font-size:10.5px"'); g.text(x + 12, yy + 35, t[2] === '' ? '-' : t[2], 'qvb', null, 'style="font-size:13.5px"');
    g.hot(t[1], x, yy, 172, 44, t[0] + ': ' + t[2]);
  });
  y += Math.ceil(chips.length / 4) * 52 + 14;
  return [W, y];
}
