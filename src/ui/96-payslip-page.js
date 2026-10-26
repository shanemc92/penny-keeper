/* ---------------- payslips ----------------
   Two ways to look at one payslip, switched at the top of the page:

     Build it       a form on the left, the payslip taking shape on the right as you type. Tapping a box on the
                    drawing jumps to its field.
     Understand it  the drawing, large, with an explanation beside it. Tap any box for what it means, how it was worked
                    out with your numbers, and whether the sums agree. A walk-through underneath covers every box in order.

   What is on screen is the draft, DB.payslips.draft. "Save to history" copies it into DB.payslips.items; opening a saved
   payslip copies it back into the draft, so nothing saved changes until you press save again. The engine side is in
   engine/52-payslip.js and engine/53-payslip-explain.js, the drawings in ui/95-payslip-svg.js. */
const PSUI = {sel:'', focus:''};

const psData = () => DB.payslips || (DB.payslips = psStore(null));
function psDraft(){
  const S = psData();
  if(!S.draft){ S.draft = psBlank(); S.draftOf = ''; }
  return S.draft;
}
const psSavedCopy = () => { const S = psData(); return S.draftOf ? S.items.find(x=>x.id === S.draftOf) || null : null; };
/* is there something on screen that would be lost by replacing it? */
function psDirty(){
  const d = psDraft(), s = psSavedCopy();
  if(s) return psSig(d) !== psSig(s);
  const b = psBlank(d.layout); b.period = d.period;
  return psSig(d) !== psSig(b);
}
const psGet = (o, path) => path.split('.').reduce((r, k)=> r == null ? r : r[k], o);
function psSetPath(o, path, v){
  const parts = path.split('.'); let r = o;
  for(let i = 0; i < parts.length - 1; i++) r = r[parts[i]];
  r[parts[parts.length - 1]] = v;
}
const psRich = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
const psFirstLine = s => { const t = String(s || '').replace(/\*\*/g, ''), m = t.match(/^.*?[.!?](?=\s|$)/); return m ? m[0] : t; };
const psMode = () => DB.ui.psMode === 'read' ? 'read' : 'build';

let PS_THUMBS = null;
function psThumbs(){
  if(!PS_THUMBS){ PS_THUMBS = {}; Object.keys(PS_LAYOUTS).forEach(k=>{ PS_THUMBS[k] = psSvg(psExample(k), {plain:true}); }); }
  return PS_THUMBS;
}

/* the little "saved or not" marker in the toolbar, redrawn on its own while typing so nothing else on the page is rebuilt */
const psPillHtml = (dirty, saved) => dirty ? `<span class="pill warn" id="psPill" title="You have changes that are not saved to your history">Not saved yet</span>`
  : saved ? `<span class="pill good" id="psPill">Saved</span>` : `<span id="psPill"></span>`;

/* ---------------- the page ---------------- */
function renderPayslip(el){
  const S = psData(), d = psDraft(), c = psCalc(d), checks = psChecks(d, c), dirty = psDirty();
  const read = psMode() === 'read', saved = psSavedCopy();
  const order = psOrder(d).reduce((a, g)=> a.concat(g.keys), []);
  if(PSUI.sel && !order.includes(PSUI.sel)) PSUI.sel = '';
  const hasData = c.gross > 0 || c.totalDeds > 0 || d.employee.name || d.employer.name;

  el.innerHTML = `
  <div class="card ps-noprint">
    <div class="ps-top">
      <div class="ps-seg" role="group" aria-label="What to do">
        <button data-psact="mode" data-arg="build" aria-pressed="${!read}">✏️ Build it</button>
        <button data-psact="mode" data-arg="read" aria-pressed="${read}">🔎 Understand it</button>
      </div>
      <span class="spacer"></span>
      ${psPillHtml(dirty, saved)}
      <button class="btn" data-psact="new">+ New</button>
      <button class="btn" data-psact="example">Try an example</button>
      <button class="btn primary" data-psact="save" ${saved && !dirty ? 'disabled' : ''}>${saved ? '💾 Update saved payslip' : '💾 Save to history'}</button>
      ${saved ? `<button class="btn" data-psact="saveas">Save as a new one</button>` : ''}
      <button class="btn" data-psact="next" title="Start the next payslip: same lines, the next pay date, year-to-date figures carried forward">Next payslip &rarr;</button>
    </div>
    ${read ? '' : `<div class="note" style="margin-top:8px">Type in what your payslip says. Nothing is read from a file or sent anywhere, and saved payslips stay in this browser with the rest of your data. <b>They include your PPS number, so keep your backup file private.</b></div>`}
  </div>
  ${S.items.length ? psSavedHtml(S, d) : ''}
  ${!hasData && !S.items.length ? callout('tipc', '📄', 'New here?', 'Type in a payslip box by box and Penny Keeper explains every number on it - what it is, how it was worked out, and whether the sums agree. To see how it works first, load a made-up example.',
      '<button class="btn primary sm" data-psact="example">Try an example payslip</button>') : ''}
  ${read ? psReadHtml(d, c, checks, order) : psBuildHtml(d, c, checks)}`;

  psWire(el);
  if(PSUI.focus){
    const t = $('[data-fk="' + PSUI.focus + '"]', el); PSUI.focus = '';
    if(t){ const dt = t.closest('details'); if(dt) dt.open = true; t.focus(); }
  }
}

/* ---------------- saved payslips ---------------- */
function psSavedHtml(S, d){
  const items = S.items.slice().sort((a, b)=> a.period.date < b.period.date ? 1 : a.period.date > b.period.date ? -1 : 0);
  const rows = items.map(p=>{ const c = psCalc(p); return {p, c}; });
  const tot = rows.reduce((s, r)=>({g:s.g + r.c.shown.gross, n:s.n + r.c.shown.net}), {g:0, n:0});
  const open = DB.ui.psListOpen !== false;
  /* a plain card with a button rather than a <details>: the page restores which <details> were open by position, and this one comes and goes */
  return `<div class="card ps-noprint">
    <div class="card-h"><h2>📚 Your saved payslips <span class="pill">${items.length}</span></h2>
      <div class="actions">${open ? '<button class="btn sm ghost" data-psact="csv">Export as CSV</button>' : ''}
        <button class="btn sm" data-psact="togglelist" aria-expanded="${open}">${open ? 'Hide the list' : 'Show the list'}</button></div></div>
    ${open ? `<div class="tw"><table class="stack-m">
      <thead><tr><th data-nott>Paid</th><th data-nott>Period</th><th data-nott>Employer</th><th class="n" data-nott>Gross</th><th class="n" data-nott>Take-home</th><th></th></tr></thead>
      <tbody>${rows.map(({p, c})=>`<tr ${p.id === S.draftOf ? 'style="background:var(--accent-soft)"' : ''}>
        <td class="first" data-label="Paid"><b>${esc(psDate(p.period.date))}</b></td>
        <td data-label="Period">${esc(psPeriodWord(p))} ${p.period.number}${p.title ? ' - ' + esc(psClip(p.title, 24)) : ''}</td>
        <td data-label="Employer">${esc(p.employer.name || '-')}</td>
        <td class="n" data-label="Gross">${fmt(c.shown.gross)}</td>
        <td class="n" data-label="Take-home"><b>${fmt(c.shown.net)}</b></td>
        <td class="act"><button class="btn sm" data-psact="open" data-arg="${esc(p.id)}">${p.id === S.draftOf ? 'On screen' : 'Open'}</button>
          <button class="btn sm danger" data-psact="delete" data-arg="${esc(p.id)}" aria-label="Delete this saved payslip">x</button></td></tr>`).join('')}</tbody>
      <tfoot><tr><td>Total</td><td></td><td></td><td class="n">${fmt(tot.g)}</td><td class="n">${fmt(tot.n)}</td><td></td></tr></tfoot>
    </table></div>` : ''}
  </div>`;
}

/* ---------------- Build it ---------------- */
function psIn(d, label, path, o){
  o = o || {};
  const v = psGet(d, path), t = o.t || 's';
  const val = t === 'n' ? (num(v) || '') : t === 'np' ? (v === '' ? '' : num(v)) : v;
  const attrs = [t === 'd' ? 'type="date"' : '', (t === 'n' || t === 'np') ? 'inputmode="decimal" class="num" style="text-align:right"' : '', t === 'u' ? 'style="text-transform:uppercase"' : '',
    o.max ? 'maxlength="' + o.max + '"' : '', o.ph !== undefined ? 'placeholder="' + esc(o.ph) + '"' : ''].filter(Boolean).join(' ');
  return `<label class="f"><span data-nott>${esc(label)}${o.opt ? ' <span class="opt">(optional)</span>' : ''}</span>
    <input data-psp="${path}" data-t="${t}" data-fk="${o.fk || path}" value="${esc(val)}" ${attrs}>${o.hint ? `<div class="hint">${o.hint}</div>` : ''}</label>`;
}
function psSel(d, label, path, opts, o){
  o = o || {}; const v = psGet(d, path);
  return `<label class="f"><span data-nott>${esc(label)}</span><select data-psp="${path}" data-t="s" data-fk="${o.fk || path}">${opts.map(([val, text])=>`<option value="${esc(val)}" ${String(val) === String(v) ? 'selected' : ''}>${esc(text)}</option>`).join('')}</select>${o.hint ? `<div class="hint">${o.hint}</div>` : ''}</label>`;
}

/* the buttons at the end of a payment or deduction line: move it up, move it down, remove it. The order here is the order it is printed in. */
const psActs = (kind, id, i, n, noun) => `<div class="ps-acts">
      <button class="btn sm" data-psact="up${kind}" data-arg="${esc(id)}" data-fk="up:${esc(id)}" title="Move up" aria-label="Move this ${noun} up" ${i === 0 ? 'disabled' : ''}>&uarr;</button>
      <button class="btn sm" data-psact="down${kind}" data-arg="${esc(id)}" data-fk="down:${esc(id)}" title="Move down" aria-label="Move this ${noun} down" ${i === n - 1 ? 'disabled' : ''}>&darr;</button>
      <button class="btn sm danger" data-psact="del${kind}" data-arg="${esc(id)}" title="Remove" aria-label="Remove this ${noun}">x</button></div>`;

function psBuildHtml(d, c, checks){
  const payRows = d.payments.map((x, i)=>`<div class="ps-row">
      <div class="a" data-label="What was it"><input data-psp="payments.${i}.desc" data-t="s" data-fk="pay:${x.id}:desc" value="${esc(x.desc)}" aria-label="What was it" maxlength="40"></div>
      <div class="a" data-label="Type"><select data-psp="payments.${i}.kind" data-t="kind" data-list="payments" aria-label="Type">${Object.keys(PS_PAY_KINDS).map(k=>`<option value="${k}" ${k === x.kind ? 'selected' : ''}>${esc(PS_PAY_KINDS[k].label)}</option>`).join('')}</select></div>
      <div class="a" data-label="Hours"><input class="num" style="text-align:right" inputmode="decimal" data-psp="payments.${i}.hours" data-t="n" value="${num(x.hours) || ''}" placeholder="-" aria-label="Hours"></div>
      <div class="a" data-label="Amount"><input class="num" style="text-align:right" inputmode="decimal" data-psp="payments.${i}.amount" data-t="n" data-fk="pay:${x.id}" value="${num(x.amount) || ''}" placeholder="0.00" aria-label="Amount"></div>
      <label class="ps-chk" title="Is this taxable? This is the Y/N column"><input type="checkbox" data-psp="payments.${i}.taxable" data-t="b" ${x.taxable ? 'checked' : ''} ${x.kind === 'bik' ? 'disabled' : ''}> Taxable</label>
      ${psActs('pay', x.id, i, d.payments.length, 'payment')}</div>`).join('');
  const dedRows = d.deductions.map((x, i)=>`<div class="ps-row">
      <div class="a" data-label="What was it"><input data-psp="deductions.${i}.desc" data-t="s" data-fk="ded:${x.id}:desc" value="${esc(x.desc)}" aria-label="What was it" maxlength="40"></div>
      <div class="a" data-label="Type"><select data-psp="deductions.${i}.kind" data-t="kind" data-list="deductions" aria-label="Type">${Object.keys(PS_DED_KINDS).map(k=>`<option value="${k}" ${k === x.kind ? 'selected' : ''}>${esc(PS_DED_KINDS[k].label)}</option>`).join('')}</select></div>
      <div class="a" data-label="This pay"><input class="num" style="text-align:right" inputmode="decimal" data-psp="deductions.${i}.amount" data-t="n" data-fk="ded:${x.id}" value="${num(x.amount) || ''}" placeholder="0.00" aria-label="This pay"></div>
      <div class="a" data-label="Year to date"><input class="num" style="text-align:right" inputmode="decimal" data-psp="deductions.${i}.ytd" data-t="n" value="${num(x.ytd) || ''}" placeholder="0.00" aria-label="Year to date"></div>
      <label class="ps-chk" title="Does it come off before income tax is worked out? On the Sage layout this prints as G (Gross) in the T/N column; other deductions print N"><input type="checkbox" data-psp="deductions.${i}.pre" data-t="b" ${x.pre ? 'checked' : ''}> Before tax (G)</label>
      ${psActs('ded', x.id, i, d.deductions.length, 'deduction')}</div>`).join('');

  return `<div class="ps-build">
  <div class="ps-form ps-noprint">
    <div class="card">
      ${cardHead('1. Pick the layout', 'Choose the one that looks like your payslip, so you can match them box for box. The sums and the explanations are the same in every layout.')}
      <div class="ps-lays">${Object.keys(PS_LAYOUTS).map(k=>`<button class="ps-lay" data-psact="layout" data-arg="${k}" aria-pressed="${d.layout === k}">
        <div class="psv">${psThumbs()[k]}</div><b>${esc(PS_LAYOUTS[k].name)}</b><small>${esc(PS_LAYOUTS[k].blurb)}</small></button>`).join('')}</div>
      <div class="note">The layouts are drawn from scratch to follow the usual arrangement of an Irish payslip. They are not copies of any provider's own, and are not affiliated with or endorsed by any of them.</div>
    </div>
    <div class="card">
      ${cardHead('2. Who, and when')}
      <div class="grid g2">
        ${psIn(d, 'Employer', 'employer.name', {fk:'employer.name', max:60})}${psIn(d, 'Company reg. number', 'employer.regNo', {opt:1, max:30})}
        ${psIn(d, 'Your name', 'employee.name', {max:60})}${psIn(d, 'Employee number', 'employee.number', {opt:1, max:20})}
        ${psIn(d, 'PPS number', 'employee.ppsn', {t:'u', max:10, ph:'1234567T', hint:'Seven digits and one or two letters.'})}
        ${psIn(d, 'Department', 'employee.dept', {opt:1, max:20})}${psIn(d, 'Cost centre', 'employee.cost', {opt:1, max:20})}
        ${psSel(d, 'How often you are paid', 'period.freq', Object.keys(PS_FREQS).map(k=>[k, PS_FREQS[k].label]))}
        ${psIn(d, 'Pay period number', 'period.number', {t:'n', ph:'7', hint:'Which pay of the year: week 42, or month 7.'})}
        ${psIn(d, 'Payment date', 'period.date', {t:'d'})}
        ${psSel(d, 'Pay method', 'period.method', PS_METHODS.concat(PS_METHODS.includes(d.period.method) ? [] : [d.period.method]).map(m=>[m, m]))}
      </div>
    </div>
    <div class="card">
      ${cardHead('3. What you were paid', 'One line for each payment on the payslip.')}
      ${payRows}
      <div class="chips" style="margin-top:10px">${[['basic', 'Salary'], ['overtime', 'Overtime'], ['bonus', 'Bonus'], ['allowance', 'Allowance'], ['expense', 'Expenses'], ['bik', 'Benefit in kind']].map(([k, t])=>`<button class="chip" data-psact="addpay" data-arg="${k}">+ ${t}</button>`).join('')}</div>
    </div>
    <div class="card">
      ${cardHead('4. What came off', 'One line for each deduction. The year-to-date figure is the "balance" column. Tick <b>Before tax</b> for a pension or AVC: the Sage layout prints it as a <b>G</b> (Gross) in the T/N column.')}
      ${dedRows}
      <div class="chips" style="margin-top:10px">${[['paye', 'PAYE'], ['prsi', 'PRSI'], ['usc', 'USC'], ['pension', 'Pension'], ['avc', 'AVC'], ['health', 'Health insurance'], ['lpt', 'LPT'], ['union', 'Union'], ['other', 'Other']].map(([k, t])=>`<button class="chip" data-psact="addded" data-arg="${k}">+ ${t}</button>`).join('')}</div>
    </div>
    <details class="more"><summary>🧮 Summary boxes <span class="mut">(optional - leave empty and we add them up)</span></summary>
      <div class="grid g3" style="margin-top:8px">
        ${psIn(d, 'Gross pay', 'printed.gross', {t:'np', fk:'sum.gross', ph:psN(c.gross)})}${psIn(d, 'Total deductions', 'printed.deds', {t:'np', fk:'sum.deds', ph:psN(c.totalDeds)})}
        ${psIn(d, 'Non-tax adjustments', 'printed.nonTax', {t:'np', fk:'sum.nontax', ph:psN(c.nonTaxAdj)})}${psIn(d, 'Rounding', 'printed.rounding', {t:'np', fk:'sum.rounding', ph:'0.00'})}
        ${psIn(d, 'Net pay', 'printed.net', {t:'np', fk:'sum.net', ph:psN(c.net), hint:'Type what your payslip says and we will check it adds up.'})}
      </div>
    </details>
    <details class="more"><summary>📈 Year to date <span class="mut">(needed to check your PAYE)</span></summary>
      <div class="grid g3" style="margin-top:8px">
        ${psIn(d, 'Gross pay to date', 'cum.gross', {t:'n', fk:'cum.gross'})}${psIn(d, 'Non-tax deductions to date', 'cum.nonTaxDeds', {t:'n', fk:'cum.nonTaxDeds'})}
        ${psIn(d, 'Taxable pay to date', 'cum.taxable', {t:'n', fk:'cum.taxable'})}${psIn(d, 'Tax credit to date', 'cum.credit', {t:'n', fk:'cum.credit'})}
        ${psIn(d, 'Standard rate cut-off to date', 'cum.cutoff', {t:'n', fk:'cum.cutoff'})}${psIn(d, 'Tax paid to date', 'cum.taxPaid', {t:'n', fk:'cum.taxPaid'})}
      </div>
    </details>
    <details class="more"><summary>🏷️ Tax and PRSI details</summary>
      <div class="grid g3" style="margin-top:8px">
        ${psSel(d, 'How your tax is worked out', 'tax.basis', Object.keys(PS_BASES).map(k=>[k, PS_BASES[k]]), {fk:'tax.status', hint:'Cumulative is the normal one.'})}
        ${psSel(d, 'USC rates', 'tax.usc', Object.keys(PS_USC_MODES).map(k=>[k, PS_USC_MODES[k]]), {fk:'tax.usc'})}
        ${psIn(d, 'Status code on the payslip', 'tax.status', {t:'u', opt:1, max:6, fk:'tax.statuscode', ph:'N'})}
        ${psIn(d, 'Emergency status period', 'tax.emer', {t:'u', opt:1, max:6, fk:'tax.emer'})}
        ${psIn(d, 'Tax credit for this pay', 'tax.creditPeriod', {t:'n', fk:'tax.creditPeriod'})}${psIn(d, 'Cut-off for this pay', 'tax.cutoffPeriod', {t:'n', opt:1, fk:'tax.cutoffPeriod', hint:d.layout === 'sage' ? 'The Sage layout does not print this one.' : ''})}
        ${psIn(d, 'PRSI class', 'tax.prsiClass', {t:'u', max:6, fk:'tax.prsiClass', ph:'A1'})}${psIn(d, 'Insurable weeks so far', 'tax.insWeeks', {t:'n', fk:'tax.insWeeks'})}
      </div>
    </details>
    <details class="more"><summary>🏢 Employer costs <span class="mut">(shown on the payslip, not taken from you)</span></summary>
      <div class="grid g3" style="margin-top:8px">
        ${psIn(d, 'Employer PRSI this pay', 'er.prsiPeriod', {t:'n', fk:'er.prsi'})}${psIn(d, 'Employer PRSI to date', 'er.prsiYtd', {t:'n', fk:'er.prsiYtd'})}
        ${psIn(d, 'Employer pension this pay', 'er.pensPeriod', {t:'n', opt:1, fk:'er.pens', hint:'Shown as ER PENS TP on some payslips. Leave both pension boxes empty if yours does not show them.'})}${psIn(d, 'Employer pension to date', 'er.pensYtd', {t:'n', opt:1, fk:'er.pensYtd', hint:'Shown as ER PENS TY.'})}
        ${psIn(d, 'Benefit in kind to date', 'er.bikYtd', {t:'n', fk:'er.bikYtd'})}
      </div>
    </details>
    <div class="card" style="margin-top:16px">
      ${cardHead('Give it a name', 'Optional - it helps you spot this one in your saved list.')}
      <div style="max-width:380px">${psIn(d, 'Name', 'title', {max:60, ph:psTitle(Object.assign({}, d, {title:''}))})}</div>
    </div>
  </div>
  <div class="ps-live">
    <div class="card">
      <div class="card-h"><h2>Your payslip</h2><div class="actions"><button class="btn sm" data-psact="mode" data-arg="read">🔎 Explain it</button></div></div>
      <div class="psv" id="psSvg">${psSvg(d, {checks})}</div>
      <div class="note" id="psLiveNote">${psLiveNote(checks)}</div>
    </div>
  </div>
  </div>`;
}
function psLiveNote(checks){
  const nOk = checks.filter(x=>x.status === 'ok').length, nWarn = checks.filter(x=>x.status === 'warn').length;
  return 'Tap a box on the payslip to jump to its field. ' + (nWarn ? '<b class="amb">' + nWarn + ' check' + (nWarn === 1 ? '' : 's') + ' to look at</b> - open <b>Understand it</b> to see.' : nOk ? '<b class="pos">' + nOk + ' check' + (nOk === 1 ? '' : 's') + ' passed.</b>' : 'Fill in more boxes and the self-checks appear here.');
}

/* ---------------- Understand it ---------------- */
function psReadHtml(d, c, checks, order){
  const walk = psOrder(d).map(g=>`<h3 class="sect">${esc(g.title)}</h3><div class="ps-walk">${g.keys.map(k=>{
    const e = psExplain(d, c, checks, k); if(!e) return '';
    const st = e.checks.some(x=>x.status === 'warn') ? 'warn' : e.checks.some(x=>x.status === 'ok') ? 'ok' : '';
    return `<button class="ps-item ${PSUI.sel === k ? 'on' : ''}" data-psact="pick" data-arg="${esc(k)}">
      <span class="t">${esc(e.title)}${st ? `<i class="mk ${st}" aria-label="${st === 'ok' ? 'checked' : 'worth a look'}">${st === 'ok' ? '✓' : '!'}</i>` : ''}</span>
      <span class="s">${esc(psFirstLine(e.say[0]))}</span><span class="v num">${esc(e.value)}</span></button>`;
  }).join('')}</div>`).join('');
  return `<div class="ps-read">
    <div class="ps-main">
      <div class="card">
        <div class="card-h"><h2>${esc(psTitle(d))}</h2><div class="actions ps-noprint">
          <button class="btn sm" data-psact="mode" data-arg="build">✏️ Edit</button>
          <button class="btn sm" data-psact="svg">Download as SVG</button>
          <button class="btn sm" data-psact="print">🖨️ Print</button></div>
          <div class="sub ps-noprint">Tap any box to see what it means. A tick means the sums agree; an amber ! means it is worth a second look.</div></div>
        <div class="psv" id="psSvg">${psSvg(d, {checks, sel:PSUI.sel})}</div>
      </div>
      ${psChangeHtml(d, c)}
      <div class="card"><div class="card-h"><h2>Walk through it, box by box</h2><div class="sub">The same explanations as above, in the order you would read the payslip.</div></div>${walk}</div>
    </div>
    <div class="ps-side"><div class="card ps-panel" id="psPanel" aria-live="polite">${psPanelHtml(d, c, checks, PSUI.sel, order)}</div></div>
  </div>`;
}

const PS_SPLIT_COL = {paye:'var(--bad)', usc:'var(--need)', prsi:'var(--info)', pension:'#a97fc9', other:'var(--muted)', net:'var(--accent)'};
function psOverviewHtml(d, c, checks){
  if(!(c.gross > 0 || c.totalDeds > 0)) return `<div class="emptystate"><div class="big">📄</div><h3>Nothing to explain yet</h3><p>Type in the payments and deductions on your payslip and everything on it is explained here.</p>
    <button class="btn primary" data-psact="mode" data-arg="build">Start building it</button> <button class="btn" data-psact="example">Try an example</button></div>`;
  const split = psSplit(d, c), total = split.reduce((s, x)=> s + x.amount, 0) || 1;
  let x0 = 0;
  const bar = `<svg viewBox="0 0 400 22" preserveAspectRatio="none" class="ps-split" role="img" aria-label="How your pay was divided">${split.map(s=>{ const w = 400 * s.amount / total, r = `<rect x="${x0.toFixed(2)}" y="0" width="${Math.max(w, 1).toFixed(2)}" height="22" style="fill:${PS_SPLIT_COL[s.id]}"/>`; x0 += w; return r; }).join('')}</svg>`;
  const order = {warn:0, info:1, ok:2};
  const list = checks.slice().sort((a, b)=> order[a.status] - order[b.status]);
  return `<h2 style="font-size:19px">Your payslip at a glance</h2>
    <p style="margin:6px 0 10px">${c.gross > 0 ? `Of <b>${fmt(c.gross)}</b> gross pay you took home <b class="pos">${fmt(c.net)}</b> - that is <b>${(c.net / c.gross * 100).toFixed(1)} cent</b> in every euro.` : `You took home <b class="pos">${fmt(c.net)}</b>.`}</p>
    ${bar}
    <div class="legend">${split.map(s=>`<span><i style="background:${PS_SPLIT_COL[s.id]}"></i>${esc(s.label)}<b>${fmt(s.amount)}</b></span>`).join('')}</div>
    <h3 class="sect">Self-checks</h3>
    ${list.length ? list.map(x=>`<button class="ps-check ${x.status}" data-psact="pick" data-arg="${esc(x.key)}"><i class="mk ${x.status}">${x.status === 'ok' ? '✓' : x.status === 'warn' ? '!' : 'i'}</i><span><b>${esc(x.title)}</b><span>${esc(x.text)}</span></span></button>`).join('')
      : '<div class="note">Nothing to check yet. Fill in the PRSI, USC and PAYE lines and the year-to-date boxes and we compare them with what payroll should have worked out.</div>'}
    <div class="note">Tap a box on the payslip, or a line in the walk-through, for what it means. These checks are a second opinion made from the figures you typed - payroll knows things this page does not, so a difference is a reason to ask, not proof of a mistake. Not tax advice: confirm anything important on revenue.ie.</div>`;
}
function psPanelHtml(d, c, checks, key, order){
  const e = key ? psExplain(d, c, checks, key) : null;
  if(!e) return psOverviewHtml(d, c, checks);
  const i = order.indexOf(key);
  const ck = e.checks.map(x=>callout(x.status === 'ok' ? 'good' : x.status === 'warn' ? 'warn' : 'info', x.status === 'ok' ? '✓' : x.status === 'warn' ? '!' : 'ℹ️', esc(x.title), esc(x.text))).join('');
  return `<div class="ps-pnav ps-noprint">
      <button class="btn sm ghost" data-psact="pick" data-arg="">&larr; Overview</button><span class="spacer"></span>
      <button class="btn sm" data-psact="prev" ${i <= 0 ? 'disabled' : ''} aria-label="Previous box">&larr;</button>
      <span class="mut" style="font-size:12.5px">${i + 1} of ${order.length}</span>
      <button class="btn sm" data-psact="next-box" ${i >= order.length - 1 ? 'disabled' : ''} aria-label="Next box">&rarr;</button></div>
    <h2 style="font-size:19px;margin-top:10px">${esc(e.title)}</h2>
    <div class="ps-big num">${esc(e.value || '-')}</div>${e.sub ? `<div class="mut" style="font-size:13px">${esc(e.sub)}</div>` : ''}
    ${ck ? `<div style="margin-top:12px">${ck}</div>` : ''}
    ${e.say.map(t=>`<p style="margin:10px 0 0">${psRich(t)}</p>`).join('')}
    ${e.how.length ? `<h3 class="sect">How it is worked out</h3><table class="ps-calc"><tbody>${e.how.map(r=>`<tr class="${r[2] || ''}"><td>${esc(r[0])}</td><td class="num">${esc(r[1])}</td></tr>`).join('')}</tbody></table>` : ''}
    ${e.tip ? `<div class="callout tipc" style="margin-top:12px"><div class="ci">💡</div><div class="cb">${psRich(e.tip)}</div></div>` : ''}
    <div class="row ps-noprint" style="margin-top:8px"><button class="btn sm" data-psact="edit" data-arg="${esc(key)}">✏️ Edit this box</button></div>`;
}
/* compare with the payslip before this one */
function psChangeHtml(d, c){
  const S = psData(), date = d.period.date;
  const prev = S.items.filter(x=>x.id !== S.draftOf && x.period.date < date).sort((a, b)=> a.period.date < b.period.date ? 1 : -1)[0];
  if(!prev || !(c.gross > 0)) return '';
  const pc = psCalc(prev), rows = psCompare(pc, c);
  const big = rows.filter(r=>r.label !== 'Take-home pay' && r.label !== 'Gross pay').sort((a, b)=> Math.abs(b.diff) - Math.abs(a.diff))[0];
  const net = rows.find(r=>r.label === 'Take-home pay'), gross = rows.find(r=>r.label === 'Gross pay');
  const said = Math.abs(net.diff) < 0.005 ? 'Your take-home pay is the same as on your payslip of ' + psDate(prev.period.date) + '.'
    : 'Your take-home pay is <b>' + fmt(Math.abs(net.diff)) + (net.diff < 0 ? ' lower' : ' higher') + '</b> than on your payslip of ' + psDate(prev.period.date) + '.' +
      (Math.abs(gross.diff) >= 0.005 ? ' Gross pay moved by ' + fmt(gross.diff) + '.' : ' Gross pay is unchanged.') +
      (big && Math.abs(big.diff) >= 0.005 ? ' The biggest change after that is <b>' + esc(big.label) + '</b>, ' + (big.diff > 0 ? 'up ' : 'down ') + fmt(Math.abs(big.diff)) + '.' : '');
  return `<div class="card ps-noprint"><div class="card-h"><h2>Since your last payslip</h2><div class="sub">Compared with ${esc(psTitle(prev))}, paid ${esc(psDate(prev.period.date))}</div></div>
    <p style="margin:0 0 8px">${said}</p>
    <div class="tw"><table><thead><tr><th data-nott></th><th class="n" data-nott>Before</th><th class="n" data-nott>Now</th><th class="n" data-nott>Change</th></tr></thead><tbody>${rows.map(r=>`<tr><td>${esc(r.label)}</td><td class="n">${fmt(r.before)}</td><td class="n">${fmt(r.after)}</td>
      <td class="n ${Math.abs(r.diff) < 0.005 ? 'mut' : (r.label === 'Take-home pay' || r.label === 'Gross pay') ? (r.diff > 0 ? 'pos' : 'neg') : (r.diff > 0 ? 'amb' : 'pos')}">${Math.abs(r.diff) < 0.005 ? '-' : (r.diff > 0 ? '+' : '-') + fmt(Math.abs(r.diff))}</td></tr>`).join('')}</tbody></table></div></div>`;
}

/* ---------------- behaviour ---------------- */
/* redraw just the drawing and the little numbers that depend on the lines, so typing is never interrupted */
function psLive(){
  const d = psDraft(), c = psCalc(d), checks = psChecks(d, c), box = $('#psSvg');
  if(box) box.innerHTML = psSvg(d, {checks, sel:PSUI.sel});
  const ph = {gross:c.gross, deds:c.totalDeds, nonTax:c.nonTaxAdj, net:c.net};
  Object.keys(ph).forEach(k=>{ const i = $('[data-psp="printed.' + k + '"]'); if(i) i.placeholder = psN(ph[k]); });
  const note = $('#psLiveNote'); if(note) note.innerHTML = psLiveNote(checks);
  const dirty = psDirty(), saved = psSavedCopy(), pill = $('#psPill'), sb = $('[data-psact="save"]'), ti = $('[data-psp="title"]');
  if(pill) pill.outerHTML = psPillHtml(dirty, saved);
  if(sb) sb.disabled = !!saved && !dirty;
  if(ti) ti.placeholder = psTitle(Object.assign({}, d, {title:''}));
}
function psReselect(key){
  PSUI.sel = key || '';
  const d = psDraft(), c = psCalc(d), checks = psChecks(d, c), order = psOrder(d).reduce((a, g)=> a.concat(g.keys), []);
  const panel = $('#psPanel'); if(panel) panel.innerHTML = psPanelHtml(d, c, checks, PSUI.sel, order);
  $$('#psSvg .hs.sel').forEach(n=> n.classList.remove('sel'));
  if(PSUI.sel){ const n = $('#psSvg .hs[data-k="' + PSUI.sel + '"]'); if(n) n.classList.add('sel'); }
  $$('.ps-item').forEach(n=> n.classList.toggle('on', n.dataset.arg === PSUI.sel));
}
/* tapping a box: in Build it, go to its field; in Understand it, explain it */
function psPick(key){
  if(psMode() === 'build'){ psEdit(key); return; }
  psReselect(key);
  const panel = $('#psPanel');
  if(panel && window.matchMedia('(max-width: 1100px)').matches) panel.scrollIntoView({block:'nearest', behavior:'smooth'});
  else if(panel) panel.scrollTop = 0;
}
function psEdit(key){
  if(psMode() === 'read'){ DB.ui.psMode = 'build'; PSUI.focus = psFieldFor(key); save(true); render({reset:true}); return; }
  const t = $('[data-fk="' + psFieldFor(key) + '"]');
  if(!t) return;
  const dt = t.closest('details'); if(dt) dt.open = true;
  t.scrollIntoView({block:'center', behavior:'smooth'}); t.focus();
  if(t.select && t.type !== 'date') t.select();
}
/* the form field that holds a box's value: payment and deduction lines have several, and the amount is the one to land on */
const psFieldFor = key => key === 'tax.status' ? 'tax.status' : key;

function psSetFromInput(i){
  const t = i.dataset.t || 's', d = psDraft();
  let v = i.type === 'checkbox' ? i.checked : i.value;
  if(t === 'n') v = num(v); else if(t === 'np') v = String(v).trim() === '' ? '' : num(v); else if(t === 'u') v = String(v).toUpperCase().trim();
  psSetPath(d, i.dataset.psp, v);
  save(true); psLive();
}

function psKindChanged(list, i, kind){
  const d = psDraft(), row = d[list][i], isPay = list === 'payments', K = isPay ? PS_PAY_KINDS : PS_DED_KINDS;
  const old = row.kind; row.kind = kind;
  if(!row.desc.trim() || row.desc === K[old].desc) row.desc = K[kind].desc;
  if(isPay) row.taxable = K[kind].taxable; else row.pre = K[kind].pre;
  save(true); render();
}

function psConfirmReplace(what){
  return !psDirty() || confirm('The payslip on screen has changes that are not saved to your history. ' + what + ' anyway and lose them?');
}
function psSave(asNew){
  const S = psData(), d = psDraft(), snap = JSON.parse(JSON.stringify(d));
  snap.saved = new Date().toISOString();
  const at = (!asNew && S.draftOf) ? S.items.findIndex(x=>x.id === S.draftOf) : -1;
  if(at >= 0){ snap.id = S.draftOf; S.items[at] = snap; d.saved = snap.saved; save(); render(); toast('Saved payslip updated'); return; }
  snap.id = uid(); S.items.push(snap); S.draftOf = snap.id; d.id = snap.id; d.saved = snap.saved;
  save(); render(); toast('Saved to your history');
}
function psUse(p){
  const S = psData();
  S.draft = psNormalise(JSON.parse(JSON.stringify(p))); S.draftOf = ''; PSUI.sel = '';
}

function psAct(act, arg){
  const S = psData(), d = psDraft();
  if(act === 'mode'){ DB.ui.psMode = arg === 'read' ? 'read' : 'build'; save(true); render({reset:true}); return; }
  if(act === 'layout'){ d.layout = arg; save(true); render(); return; }
  if(act === 'pick'){ psPick(arg); return; }
  if(act === 'edit'){ psEdit(arg); return; }
  if(act === 'prev' || act === 'next-box'){
    const order = psOrder(d).reduce((a, g)=> a.concat(g.keys), []), i = order.indexOf(PSUI.sel);
    const j = act === 'prev' ? i - 1 : i + 1;
    if(order[j]) psReselect(order[j]);
    return;
  }
  if(act === 'new'){ if(!psConfirmReplace('Start a new payslip')) return; const b = psBlank(d.layout); S.draft = b; S.draftOf = ''; PSUI.sel = ''; DB.ui.psMode = 'build'; save(true); render({reset:true}); return; }
  if(act === 'example'){ if(!psConfirmReplace('Load the example')) return; psUse(psExample(d.layout)); save(true); render({reset:true}); toast('Example loaded - this is a made-up payslip'); return; }
  if(act === 'save'){ psSave(false); return; }
  if(act === 'saveas'){ psSave(true); return; }
  if(act === 'next'){
    if(psDirty() && hasPsData(d)){ toast('Save this payslip first, then start the next one'); return; }
    psUse(psNextFrom(d)); DB.ui.psMode = 'build'; save(true); render({reset:true}); toast('Next payslip started - update the figures that changed'); return;
  }
  if(act === 'open'){
    const p = S.items.find(x=>x.id === arg); if(!p) return;
    if(!psConfirmReplace('Open the saved one')) return;
    psUse(p); S.draftOf = p.id; save(true); render({reset:true}); return;
  }
  if(act === 'delete'){
    const p = S.items.find(x=>x.id === arg); if(!p) return;
    if(!confirm('Delete the saved payslip "' + psTitle(p) + '"? This cannot be undone.')) return;
    S.items = S.items.filter(x=>x.id !== arg); if(S.draftOf === arg) S.draftOf = '';
    save(); render(); return;
  }
  if(act === 'addpay'){ const x = psNewPay(arg); d.payments.push(x); PSUI.focus = 'pay:' + x.id + ':desc'; save(true); render(); return; }
  if(act === 'addded'){ const x = psNewDed(arg); d.deductions.push(x); PSUI.focus = 'ded:' + x.id + ':desc'; save(true); render(); return; }
  if(act === 'uppay' || act === 'downpay' || act === 'upded' || act === 'downded'){
    const list = act.slice(-3) === 'pay' ? d.payments : d.deductions, dir = act.indexOf('up') === 0 ? -1 : 1, i = list.findIndex(x=>x.id === arg);
    if(i >= 0 && moveItem(list, i, dir)){
      const at = i + dir;      // keep the keyboard on a button that still works, so a line can be walked up or down with repeated presses
      PSUI.focus = (dir < 0 ? (at === 0 ? 'down:' : 'up:') : (at === list.length - 1 ? 'up:' : 'down:')) + arg;
      save(true); render();
    }
    return;
  }
  if(act === 'delpay'){ d.payments = d.payments.filter(x=>x.id !== arg); save(true); render(); return; }
  if(act === 'delded'){ d.deductions = d.deductions.filter(x=>x.id !== arg); save(true); render(); return; }
  if(act === 'togglelist'){ DB.ui.psListOpen = DB.ui.psListOpen === false; save(true); render(); return; }
  if(act === 'csv'){ downloadCSV('payslips.csv', psCsvRows(S.items)); return; }
  if(act === 'svg'){ downloadText('payslip-' + d.period.date + '.svg', psSvg(d, {plain:true, size:true}), 'image/svg+xml'); toast('Payslip downloaded as an SVG image'); return; }
  if(act === 'print'){ window.print(); return; }
}
const hasPsData = d => d.employer.name || d.employee.name || d.payments.some(x=>num(x.amount)) || d.deductions.some(x=>num(x.amount) || num(x.ytd));

function psWire(el){
  /* one set of handlers on the page itself, replaced (not added to) on every redraw */
  el.onclick = e=>{
    const hs = e.target.closest('.hs');
    if(hs){ psPick(hs.dataset.k); return; }
    const b = e.target.closest('[data-psact]');
    if(b && !b.disabled) psAct(b.dataset.psact, b.dataset.arg);
  };
  el.onkeydown = e=>{
    const hs = e.target.closest && e.target.closest('.hs');
    if(hs && (e.key === 'Enter' || e.key === ' ')){ e.preventDefault(); psPick(hs.dataset.k); }
  };
  el.oninput = e=>{ const i = e.target.closest && e.target.closest('[data-psp]'); if(i && i.dataset.t !== 'kind') psSetFromInput(i); };
  el.onchange = e=>{
    const i = e.target.closest && e.target.closest('[data-psp]');
    if(i && i.dataset.t === 'kind') psKindChanged(i.dataset.list, +i.dataset.psp.split('.')[1], i.value);
    else if(i && (i.type === 'checkbox' || i.tagName === 'SELECT' || i.type === 'date')) psSetFromInput(i);
  };
}
