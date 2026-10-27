/* ---------------- cost of owning ----------------
   A plan is a list of lines - what a purchase costs, what it saves, what it is worth at the end - and the page shows the net
   result of all of them: a headline, a year-by-year chart, where the money goes, and how far the answer moves if the figures
   are a bit off. The page is laid out as:

     the plans you have, with a net figure on each, and the buttons that act on one
     the headline answer (live)
     the form on the left - describe it, then the lines - and on the right, in a column that stays in view on a wide screen,
       the chart, what stands out, where the money goes, how sure you are, the numbers and a side-by-side of your plans

   There is no separate "save": every edit is kept as you type, in DB.tco. Typing never rebuilds the form (that would drop the
   cursor), so tcoLive redraws only the answer and the one-line explanations; adding, moving or removing a line rebuilds the
   page. The engine side is in engine/54-tco.js and the drawings in ui/97-tco-charts.js. */
const TCOUI = {focus:'', choosing:false};

const tcoData = () => DB.tco || (DB.tco = tcoStore(null));
function tcoCurrent(){ const S = tcoData(); return S.plans.find(x=>x.id === S.current) || S.plans[0] || null; }
const tcoRich = s => esc(s).replace(/\*\*(.+?)\*\*/g, '<b>$1</b>');
/* the other plans drawn on the chart, in the order they were ticked */
const tcoCmpIds = plan => (DB.ui.tcoCmp || []).filter(id => id !== plan.id && tcoData().plans.some(p=>p.id === id));
const tcoYears = n => n + ' year' + (n === 1 ? '' : 's');
const tcoNet = c => `<b class="${c.total.net < -0.5 ? 'neg' : c.total.net > 0.5 ? 'pos' : ''}">${esc(fmt0(c.total.net))}</b>`;
const tcoPays = (c, H) => c.breakEven.status === 'now' ? 'At once' : c.breakEven.status === 'at' ? tcoWhen(c.breakEven.years) : 'Not within ' + tcoYears(H);

/* how a field is shown in its box: zero is left blank on money fields, but a typed 0 matters on the few where blank means "use the default" */
function tcoShow(l, f){
  const v = l[f];
  if(f === 'label') return v;
  if(f === 'to' || f === 'growth') return blankish(v) ? '' : String(v);
  if(f === 'at' || f === 'every' || f === 'from' || f === 'weeks' || f === 'years') return String(v);
  return num(v) ? String(v) : '';
}
const tcoShowPlan = (p, f) => f === 'name' || f === 'notes' ? p[f] : f === 'discount' ? (num(p.discount) ? String(p.discount) : '') : String(p[f]);

function tcoIn(label, scope, field, value, o){
  o = o || {};
  const attr = scope === 'p' ? 'data-tp' : 'data-tl', lid = o.lid ? ` data-lid="${esc(o.lid)}"` : '';
  const fk = scope === 'p' ? 'p:' + field : 'l:' + o.lid + ':' + field, text = (o.t === 's');
  return `<label class="f"><span data-nott>${esc(label)}${o.opt ? ' <span class="opt">(optional)</span>' : ''}</span>
    <input ${attr}="${field}"${lid} data-t="${o.t || 'n'}" data-fk="${fk}" inputmode="${text ? 'text' : 'decimal'}" ${text ? '' : 'class="num" style="text-align:right"'} value="${esc(value)}"${o.ph !== undefined ? ` placeholder="${esc(o.ph)}"` : ''}${o.max ? ` maxlength="${o.max}"` : ''}>${o.hint ? `<div class="hint">${esc(o.hint)}</div>` : ''}</label>`;
}

/* ---------------- the plans, and starting one ---------------- */
function tcoChipsHtml(S){
  return `<div class="tco-chips" id="tcoChips" role="group" aria-label="Your plans"><span class="tco-chips-l" data-nott>Plans</span>
    ${S.plans.map(p=>{
      const c = tcoCalc(p);
      return `<button data-tact="plan" data-arg="${esc(p.id)}" aria-pressed="${p.id === S.current && !TCOUI.choosing}">${esc(p.name || 'Plan')}${c.empty ? '' : ` <span class="pill ${c.total.net < -0.5 ? 'bad' : 'good'}">${esc(fmt0(c.total.net))}</span>`}</button>`;
    }).join('')}</div>`;
}
function tcoTopHtml(S){
  return `<div class="card ps-noprint">
    ${tcoChipsHtml(S)}
    <div class="ps-top"><span class="spacer"></span>
      <button class="btn" data-tact="newplan">+ New plan</button>
      <button class="btn" data-tact="copy" title="A copy to try a different choice, such as the same car with a different fuel">Copy this plan</button>
      <button class="btn" data-tact="print">🖨️ Print</button>
      <button class="btn danger" data-tact="delete">Delete</button></div>
  </div>`;
}
function tcoStartHtml(hasPlans){
  return `${hasPlans ? '' : callout('tipc', '⚖️', 'Think beyond the price tag', 'A car is the price plus insurance, tax, fuel and servicing, less the bus fares and time it saves and what it sells for later. A home upgrade is the outlay and grants against years of lower bills, and perhaps a lower mortgage rate. List it all here and see the net result.')}
  <div class="card ps-noprint">
    <div class="card-h"><h2>${hasPlans ? 'Start another plan' : 'What are you thinking of spending on?'}</h2>
      <div class="sub">Pick the closest match. You can add, change or delete any line afterwards.</div>
      ${hasPlans ? '<div class="actions"><button class="btn sm" data-tact="cancelnew">Cancel</button></div>' : ''}</div>
    <div class="tco-starts">${Object.keys(TCO_TEMPLATES).map(k=>`<button class="tco-start" data-tact="start" data-arg="${k}"><span class="i" aria-hidden="true">${TCO_TEMPLATES[k].icon}</span><b>${esc(TCO_TEMPLATES[k].name)}</b><small>${esc(TCO_TEMPLATES[k].blurb)}</small></button>`).join('')}</div>
    <div class="row" style="margin-top:14px;align-items:center"><span class="note" style="margin:0">Want to see how it works first? Both examples use made-up numbers.</span>
      <button class="btn sm" data-tact="example" data-arg="car">A car instead of the bus</button>
      <button class="btn sm" data-tact="example" data-arg="home">Insulation and a heat pump</button></div>
  </div>`;
}

/* ---------------- the answer ---------------- */
function tcoHeadHtml(plan, c){
  const H = c.H, yrs = tcoYears(H), t = c.total, be = c.breakEven;
  if(c.empty) return `<div class="card tco-head"><div class="tco-hl">Fill in the costs and savings below</div>
    <div class="tco-sub">The net result over ${yrs} appears here as soon as there are amounts.</div></div>`;
  const ahead = t.net > 0.5, behind = t.net < -0.5;
  let hl, sub = [];
  if(ahead){
    hl = `Over ${yrs} this leaves you <b class="pos">${esc(fmt0(t.net))} better off</b>.`;
    sub.push(be.status === 'now' ? 'You are ahead from the start.' : 'It pays for itself in ' + tcoWhen(be.years) + '.');
  } else if(behind){
    hl = `Over ${yrs} this costs you <b class="neg">${esc(fmt0(-t.net))} more than it saves</b>.`;
    sub.push('That is about ' + fmt0(-t.perYear) + ' a year, or ' + fmt0(-t.perMonth) + ' a month, for what you get.');
    sub.push('It does not pay for itself within ' + yrs + '.');
  } else {
    hl = `Over ${yrs} this roughly <b>breaks even</b>.`;
  }
  if(num(plan.discount) > 0) sub.push('In today\'s money, allowing for ' + plan.discount + '% a year that your money could earn elsewhere, the net result is ' + fmt0(t.pv) + '.');
  const kpi = (lbl, val, s, cls) => `<div class="kpi"><div class="lbl" data-nott>${lbl}</div><div class="val ${cls || ''}">${val}</div><div class="sub">${s}</div></div>`;
  return `<div class="card tco-head ${ahead ? 'good' : behind ? 'bad' : ''}">
    <div class="tco-hl">${hl}</div>${sub.length ? `<div class="tco-sub">${sub.map(esc).join(' ')}</div>` : ''}
    <div class="grid g4" style="margin-top:12px">
      ${kpi('Paid up front', esc(fmt0(t.upfront)), 'today, after grants and trade-ins')}
      ${kpi('All the costs', esc(fmt0(t.cost)), 'over ' + yrs + ', up front included')}
      ${kpi('All the savings', esc(fmt0(t.save)), 'including what it is worth at the end')}
      ${kpi('Net result', esc(fmt0(t.net)), esc(fmt0(t.perYear)) + ' a year on average', t.net < -0.5 ? 'neg' : t.net > 0.5 ? 'pos' : '')}
      ${kpi('Pays for itself', esc(be.status === 'at' ? 'Year ' + Math.ceil(be.years) : be.status === 'now' ? 'At once' : 'Not in ' + H + ' yrs'), esc(be.status === 'at' ? tcoWhen(be.years) : be.status === 'now' ? 'nothing to pay back' : 'still behind at the end'))}
    </div>
    ${c.warns.length ? c.warns.map(w=> `<div class="note" style="color:var(--warn)">⚠️ ${esc(w)}</div>`).join('') : ''}
  </div>`;
}

function tcoOutHtml(plan, c){
  const S = tcoData(), others = S.plans.filter(p=>p.id !== plan.id), on = tcoCmpIds(plan);
  const ins = tcoInsights(plan, c), sens = tcoSens(plan), open = DB.ui.tcoTable === true, H = c.H;
  const table = open ? `<div class="tw"><table>
      <thead><tr><th data-nott>Year</th><th class="n" data-nott>Costs</th><th class="n" data-nott>Savings</th><th class="n" data-nott>Net</th><th class="n" data-nott>Running total</th></tr></thead>
      <tbody>${c.net.map((v, t)=>`<tr><td>${t ? t : 'Now'}</td><td class="n">${fmt0(c.cost[t])}</td><td class="n">${fmt0(c.save[t])}</td><td class="n ${v < -0.5 ? 'neg' : v > 0.5 ? 'pos' : ''}">${fmt0(v)}</td><td class="n"><b>${fmt0(c.cum[t])}</b></td></tr>`).join('')}</tbody>
      <tfoot><tr><td>Total</td><td class="n">${fmt0(c.total.cost)}</td><td class="n">${fmt0(c.total.save)}</td><td class="n">${fmt0(c.total.net)}</td><td></td></tr></tfoot></table></div>` : '';
  const side = S.plans.length > 1 ? `<div class="card ps-noprint"><div class="card-h"><h2>Your plans side by side</h2></div>
    <div class="tw"><table class="stack-m"><thead><tr><th data-nott>Plan</th><th data-nott>Years</th><th class="n" data-nott>Paid up front</th><th class="n" data-nott>Net result</th><th data-nott>Pays for itself</th><th></th></tr></thead>
      <tbody>${S.plans.map(p=>{
        const q = tcoCalc(p);
        return `<tr ${p.id === plan.id ? 'style="background:var(--accent-soft)"' : ''}><td class="first" data-label="Plan"><b>${esc(p.name)}</b></td><td data-label="Years">${p.horizon}</td>
          <td class="n" data-label="Paid up front">${q.empty ? '-' : esc(fmt0(q.total.upfront))}</td><td class="n" data-label="Net result">${q.empty ? '-' : tcoNet(q)}</td>
          <td data-label="Pays for itself">${q.empty ? '-' : esc(tcoPays(q, p.horizon))}</td>
          <td class="act"><button class="btn sm" data-tact="plan" data-arg="${esc(p.id)}">${p.id === plan.id ? 'On screen' : 'Open'}</button></td></tr>`;
      }).join('')}</tbody></table></div></div>` : '';
  return `<div class="card"><div class="card-h"><h2>Year by year</h2>
      <div class="sub">Each bar is one year on its own: <b class="pos">savings</b> going up, <b class="neg">costs</b> going down. The line is your running total - above zero, you are ahead.</div></div>
    ${others.length ? `<div class="tco-cmp ps-noprint"><span class="mut">Also show:</span>${others.map(p=>{
      const k = on.indexOf(p.id);
      return `<button class="btn sm" data-tact="cmp" data-arg="${esc(p.id)}" aria-pressed="${k >= 0}">${k >= 0 ? `<i class="sw o${k % 3}"></i>` : ''}${esc(p.name)}</button>`;
    }).join('')}</div>` : ''}
    <div class="chartbox auto" id="tcoChart"></div></div>
  ${ins.length ? `<div class="card"><div class="card-h"><h2>What stands out</h2></div><ul class="tco-ins">${ins.map(t=>`<li>${tcoRich(t)}</li>`).join('')}</ul></div>` : ''}
  <div class="card"><div class="card-h"><h2>Where the money goes</h2>
      <div class="sub">Each line added up over ${tcoYears(H)}. <b class="neg">Costs</b> to the left, <b class="pos">savings</b> to the right.</div></div>
    ${tcoBarsHtml(c)}</div>
  <div class="card"><div class="card-h"><h2>How sure are you?</h2>
      <div class="sub">Figures about the future are rarely exact. This shows how far the answer moves if you are a bit off.</div></div>
    <div class="tw"><table class="tco-sens"><thead><tr><th data-nott>If...</th><th class="n" data-nott>Net result</th><th data-nott>Pays for itself</th></tr></thead>
      <tbody>${sens.map(r=>`<tr><td>${esc(r.label)}</td><td class="n"><b class="${r.net < -0.5 ? 'neg' : r.net > 0.5 ? 'pos' : ''}">${esc(fmt0(r.net))}</b></td>
        <td>${esc(r.breakEven.status === 'now' ? 'At once' : r.breakEven.status === 'at' ? tcoWhen(r.breakEven.years) : 'Not within ' + tcoYears(H))}</td></tr>`).join('')}</tbody></table></div></div>
  <div class="card"><div class="card-h"><h2>The numbers, year by year</h2>
      <div class="actions ps-noprint"><button class="btn sm" data-tact="table" aria-expanded="${open}">${open ? 'Hide' : 'Show'}</button></div></div>${table}</div>
  ${side}`;
}

/* ---------------- the form ---------------- */
function tcoBasicsHtml(plan){
  return `<div class="card ps-noprint"><div class="card-h"><h2>1. Describe it</h2></div>
    ${tcoIn('Name of this plan', 'p', 'name', plan.name, {t:'s', max:60, ph:'e.g. Electric car'})}
    <div class="grid g3">
      ${tcoIn('Years to plan for', 'p', 'horizon', tcoShowPlan(plan, 'horizon'), {hint:'How long you expect to keep it, up to 40.'})}
      ${tcoIn('Prices rise by (% a year)', 'p', 'inflation', tcoShowPlan(plan, 'inflation'), {hint:'Applied to every line that repeats unless it has its own figure.'})}
      ${tcoIn('What savings would earn (%)', 'p', 'discount', tcoShowPlan(plan, 'discount'), {hint:'Optional. What your money could earn if you did not spend it. Fill it in and the answer is also shown in today\'s money.'})}
    </div>
    <label class="f"><span data-nott>Notes <span class="opt">(optional)</span></span><textarea data-tp="notes" data-t="s" data-fk="p:notes" rows="2" maxlength="500" placeholder="Why you are considering it, quotes, where the figures came from">${esc(plan.notes)}</textarea></label>
  </div>`;
}

function tcoActs(id, i, n){
  return `<div class="ps-acts">
      <button class="btn sm" data-tact="up" data-arg="${esc(id)}" data-fk="up:${esc(id)}" title="Move up" aria-label="Move this line up" ${i === 0 ? 'disabled' : ''}>&uarr;</button>
      <button class="btn sm" data-tact="down" data-arg="${esc(id)}" data-fk="down:${esc(id)}" title="Move down" aria-label="Move this line down" ${i === n - 1 ? 'disabled' : ''}>&darr;</button>
      <button class="btn sm danger" data-tact="del" data-arg="${esc(id)}" title="Remove" aria-label="Remove this line">x</button></div>`;
}
/* a line's colour follows what it does: a loan is always a cost, a mortgage rate change is a saving only if the rate falls */
function tcoLineClass(l){
  if(l.kind === 'loan') return 'cost';
  if(l.kind === 'mortgage'){ const m = tcoMortgage(l); return m.ready && m.yearly < 0 ? 'cost' : 'save'; }
  return l.dir === 'save' ? 'save' : 'cost';
}
function tcoNoteHtml(l, plan, c){
  const n = tcoLineNote(l, plan, c);
  return n ? '<b>' + esc(n) + '</b>' : '<span class="mut">' + esc(TCO_HINTS[l.key] || TCO_KINDS[l.kind].blurb) + '</span>';
}
function tcoLineHtml(l, i, n, plan, c){
  const id = l.id, k = l.kind, F = (label, field, o) => tcoIn(label, 'l', field, tcoShow(l, field), Object.assign({lid:id}, o));
  const span = F('From year', 'from', {hint:''}), to = F('To year', 'to', {ph:'the end'});
  const grow = F('Yearly price change (%)', 'growth', {t:'o', ph:String(plan.inflation)});
  let fields = '';
  if(k === 'once') fields = F('Amount', 'amount') + F('In year (0 = today)', 'at');
  else if(k === 'recur') fields = F('Amount', 'amount') + `<label class="f"><span data-nott>How often</span><select data-tl="per" data-lid="${esc(id)}" data-t="s" data-fk="l:${esc(id)}:per">${Object.keys(TCO_PER).map(p=>`<option value="${p}" ${l.per === p ? 'selected' : ''}>${esc(TCO_PER[p])}</option>`).join('')}</select></label>`
    + (l.per === 'every' ? F('Every how many years', 'every') : '') + span + to + grow;
  else if(k === 'drive') fields = F('Kilometres a year', 'km') + F('Uses per 100 km (litres or kWh)', 'use') + F('Price per litre or kWh', 'price') + span + to + grow;
  else if(k === 'time') fields = F('Hours saved a week', 'hours') + F('Weeks a year', 'weeks') + F('What an hour is worth', 'worth') + span + to + grow;
  else if(k === 'loan') fields = F('Amount borrowed', 'borrow') + F('Interest rate (% a year)', 'apr') + F('Years to repay', 'years');
  else if(k === 'value') fields = F('Worth to start with', 'base') + F('Changes by (% a year)', 'change', {hint:'Minus if it loses value.'});
  else if(k === 'mortgage') fields = F('Balance left', 'balance') + F('Years left', 'years') + F('Rate now (%)', 'rateNow') + F('New rate (%)', 'rateNew');
  const dir = (k === 'loan' || k === 'mortgage') ? '' : `<div class="ps-seg tco-dir" role="group" aria-label="Does this line cost you money or save you money?">
      <button data-tact="dir" data-arg="${esc(id)}:cost" aria-pressed="${l.dir === 'cost'}">Cost</button>
      <button data-tact="dir" data-arg="${esc(id)}:save" aria-pressed="${l.dir === 'save'}">Saving</button></div>`;
  const useMort = (k === 'mortgage' && (Y.mortgages || []).length) ? `<div class="row" style="margin:-4px 0 8px"><button class="btn sm" data-tact="usemort" data-arg="${esc(id)}">Use my mortgage for the balance, years and rate</button></div>` : '';
  return `<div class="tco-line ${tcoLineClass(l)}" data-lrow="${esc(id)}">
    <div class="tco-line-k">${esc(TCO_KINDS[k].name)}</div>
    <div class="tco-line-h">
      <input class="tco-label" data-tl="label" data-lid="${esc(id)}" data-t="s" data-fk="l:${esc(id)}:label" value="${esc(l.label)}" placeholder="${esc(TCO_KINDS[k].name)}" maxlength="70" aria-label="What this line is">
      ${dir}${tcoActs(id, i, n)}</div>
    <div class="tco-fields">${fields}</div>${useMort}
    <div class="tco-note" data-lnote="${esc(id)}">${tcoNoteHtml(l, plan, c)}</div>
  </div>`;
}
function tcoLinesHtml(plan, c){
  return `<div class="card ps-noprint"><div class="card-h"><h2>2. What changes <span class="pill" id="tcoCount">${plan.lines.length}</span></h2>
      <div class="sub">Compared with not doing it. <b class="neg">Red</b> lines are money going out; <b class="pos">green</b> lines are money coming in, or no longer going out. Leave a line empty and it counts for nothing.</div></div>
    ${plan.lines.length ? plan.lines.map((l, i)=> tcoLineHtml(l, i, plan.lines.length, plan, c)).join('') : '<div class="empty">No lines yet. Add the first one below.</div>'}
    <h3 class="sect">Add a line</h3>
    <div class="tco-add">${Object.keys(TCO_KINDS).map(k=>`<button class="btn sm" data-tact="addline" data-arg="${k}" title="${esc(TCO_KINDS[k].blurb)}">+ ${esc(TCO_KINDS[k].name)}</button>`).join('')}</div>
  </div>`;
}

/* ---------------- the page ---------------- */
function renderTco(el){
  const S = tcoData(), plan = tcoCurrent();
  if(!plan || TCOUI.choosing){
    el.innerHTML = (plan ? tcoTopHtml(S) : '') + tcoStartHtml(!!plan);
    tcoWire(el); return;
  }
  const c = tcoCalc(plan);
  el.innerHTML = `${tcoTopHtml(S)}
  <div id="tcoHead">${tcoHeadHtml(plan, c)}</div>
  <div class="tco-grid">
    <div class="tco-form">${tcoBasicsHtml(plan)}${tcoLinesHtml(plan, c)}</div>
    <div class="tco-out" id="tcoOut">${tcoOutHtml(plan, c)}</div>
  </div>`;
  tcoWire(el);
  chart(tcoDrawChart);
  if(TCOUI.focus){
    const t = $('[data-fk="' + TCOUI.focus + '"]', el); TCOUI.focus = '';
    if(t){ t.focus(); if(t.select && t.tagName === 'INPUT') t.select(); }
  }
}
function tcoDrawChart(){
  const box = $('#tcoChart'), plan = tcoCurrent(); if(!box || !plan) return;
  const W = Math.max(280, Math.floor(box.clientWidth) || 0), S = tcoData();
  const others = tcoCmpIds(plan).map(id=>{ const p = S.plans.find(x=>x.id === id); return {plan:p, calc:tcoCalc(p)}; });
  box.innerHTML = tcoChartSvg(tcoCalc(plan), others, W);
}
/* redraw just the answer and the one-line explanations, so typing is never interrupted */
function tcoLive(){
  const plan = tcoCurrent(); if(!plan) return;
  const c = tcoCalc(plan), head = $('#tcoHead'), out = $('#tcoOut'), chips = $('#tcoChips'), count = $('#tcoCount');
  if(head) head.innerHTML = tcoHeadHtml(plan, c);
  if(out) out.innerHTML = tcoOutHtml(plan, c);
  if(chips) chips.outerHTML = tcoChipsHtml(tcoData());
  if(count) count.textContent = plan.lines.length;
  plan.lines.forEach(l=>{
    const note = $('[data-lnote="' + l.id + '"]'), row = $('[data-lrow="' + l.id + '"]');
    if(note) note.innerHTML = tcoNoteHtml(l, plan, c);
    if(row) row.className = 'tco-line ' + tcoLineClass(l);
  });
  observeCharts();
  tcoDrawChart();
}

function tcoFromInput(i, structural){
  const plan = tcoCurrent(); if(!plan) return;
  const raw = i.value, t = i.dataset.t || 's';
  if(i.dataset.tp){
    const f = i.dataset.tp;
    if(f === 'name') plan.name = raw.slice(0, 60);
    else if(f === 'notes') plan.notes = raw.slice(0, 500);
    else if(f === 'horizon'){ const v = Math.round(num(raw)); if(v < 1) return; plan.horizon = clamp(v, 1, 40); }
    else if(f === 'inflation') plan.inflation = clamp(num(raw), -10, 30);
    else if(f === 'discount') plan.discount = clamp(num(raw), 0, 30);
  } else {
    const l = plan.lines.find(x=>x.id === i.dataset.lid); if(!l) return;
    const f = i.dataset.tl;
    l[f] = t === 's' ? raw : t === 'o' ? ((blankish(raw) || String(raw).trim() === '') ? '' : num(raw)) : num(raw);
    Object.assign(l, tcoNormaliseLine(l));
  }
  save(true);
  if(structural) render(); else tcoLive();
}
/* leaving a box: show what the plan actually holds (a typed 2.5 years became 3, 1,500 became 1500) */
function tcoTidy(i){
  const plan = tcoCurrent(); if(!plan) return;
  if(i.dataset.tp){ i.value = tcoShowPlan(plan, i.dataset.tp); return; }
  const l = plan.lines.find(x=>x.id === i.dataset.lid);
  if(l) i.value = tcoShow(l, i.dataset.tl);
}

function tcoAct(act, arg){
  const S = tcoData(), plan = tcoCurrent();
  if(act === 'plan'){ S.current = arg; TCOUI.choosing = false; save(true); render({reset:true}); return; }
  if(act === 'newplan'){ TCOUI.choosing = true; render({reset:true}); return; }
  if(act === 'cancelnew'){ TCOUI.choosing = false; render({reset:true}); return; }
  if(act === 'start' || act === 'example' || act === 'copy'){
    if(S.plans.length >= 30){ toast('That is the most plans you can keep - delete one first'); return; }
    let p;
    if(act === 'copy'){
      if(!plan) return;
      p = JSON.parse(JSON.stringify(plan)); p.id = uid(); p.name = (plan.name + ' (copy)').slice(0, 60); p.lines.forEach(l=>{ l.id = uid(); });
      S.plans.splice(S.plans.indexOf(plan) + 1, 0, p);
    } else { p = act === 'start' ? tcoBlank(arg) : tcoExample(arg); S.plans.push(p); }
    S.current = p.id; TCOUI.choosing = false; save(true); render({reset:true});
    toast(act === 'example' ? 'Example loaded - the numbers are made up' : act === 'copy' ? 'Copied - change the copy and compare the two' : 'Plan started - fill in what you know');
    return;
  }
  if(!plan) return;
  if(act === 'delete'){
    if(!confirm('Delete the plan "' + (plan.name || 'Plan') + '"? This cannot be undone.')) return;
    S.plans = S.plans.filter(x=>x.id !== plan.id); S.current = S.plans[0] ? S.plans[0].id : '';
    DB.ui.tcoCmp = (DB.ui.tcoCmp || []).filter(id => id !== plan.id);
    save(true); render({reset:true}); return;
  }
  if(act === 'addline'){ const l = tcoNewLine(arg); plan.lines.push(l); TCOUI.focus = 'l:' + l.id + ':label'; save(true); render(); return; }
  if(act === 'up' || act === 'down'){
    const i = plan.lines.findIndex(x=>x.id === arg), dir = act === 'up' ? -1 : 1;
    if(i >= 0 && moveItem(plan.lines, i, dir)){
      const at = i + dir;       // keep the keyboard on a button that still works, so a line can be walked up or down with repeated presses
      TCOUI.focus = (dir < 0 ? (at === 0 ? 'down:' : 'up:') : (at === plan.lines.length - 1 ? 'up:' : 'down:')) + arg;
      save(true); render();
    }
    return;
  }
  if(act === 'del'){ plan.lines = plan.lines.filter(x=>x.id !== arg); save(true); render(); return; }
  if(act === 'dir'){
    const [id, d] = String(arg).split(':'), l = plan.lines.find(x=>x.id === id);
    if(l){ l.dir = d === 'save' ? 'save' : 'cost'; save(true); render(); }
    return;
  }
  if(act === 'cmp'){
    const cur = tcoCmpIds(plan).slice(), k = cur.indexOf(arg);
    if(k >= 0) cur.splice(k, 1); else cur.push(arg);
    DB.ui.tcoCmp = cur; save(true); tcoLive(); return;
  }
  if(act === 'table'){ DB.ui.tcoTable = DB.ui.tcoTable !== true; save(true); tcoLive(); return; }
  if(act === 'usemort'){
    const l = plan.lines.find(x=>x.id === arg), m = (Y.mortgages || [])[0];
    if(!l || !m){ toast('Add your mortgage on the Mortgage page first'); return; }
    const pos = mortgagePosition(m);
    l.balance = Math.round(pos.balance); l.years = Math.round(pos.payments / 12 * 10) / 10; l.rateNow = pos.rate;
    save(true); render(); toast('Filled in from "' + (m.name || 'your mortgage') + '" - now enter the rate you would get'); return;
  }
  if(act === 'print'){ window.print(); return; }
}

function tcoWire(el){
  /* one set of handlers on the page itself, replaced (not added to) on every redraw */
  el.onclick = e=>{
    const b = e.target.closest('[data-tact]');
    if(b && !b.disabled) tcoAct(b.dataset.tact, b.dataset.arg);
  };
  el.oninput = e=>{
    const i = e.target.closest && e.target.closest('[data-tp],[data-tl]');
    if(i && i.tagName !== 'SELECT') tcoFromInput(i, false);
  };
  el.onchange = e=>{
    const i = e.target.closest && e.target.closest('[data-tp],[data-tl]');
    if(!i) return;
    if(i.tagName === 'SELECT') tcoFromInput(i, true); else tcoTidy(i);
  };
}
