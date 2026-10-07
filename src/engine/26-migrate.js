/* Currency reaches the DOM through fmt() in a hundred places and year through
   headings and filenames, so neither is escaped at each use - they are normalised
   here instead, on the way in. */
function safeCur(v){
  const s = String(v==null?'\u20ac':v).replace(/[<>&"'`]/g,'').trim();
  return s.slice(0,3) || '\u20ac';
}
/* Runs on every year, from every entry point: startup, a JSON restore, a new-year
   roll-forward. A restored file can be any age or come from a hand-edited or partial
   export, so every field a render pass touches is defaulted here rather than assumed
   - the alternative is a render-time crash that gets mislabelled "won't parse" further
   up the chain, when the JSON parsed fine and the problem is a missing field. */
/* DB.years is keyed by a label rather than a bare year, so the same tax year can hold
   several scenarios ("2026", "2026-2"). y.year stays numeric because the tax presets
   key off it; y.label is what gets shown and used in filenames. */
function yearLabel(y){ const t = y||Y; return String(t.label || t.year || ''); }
function yearKey(label, exclude){
  let base = String(label||'').trim().replace(/[^\w \-.]/g,'').slice(0,24) || 'year';
  let k = base, n = 2;
  while(DB.years[k] && k!==exclude) k = base+'-'+(n++);
  return k;
}
function migrate(y){
  y.currency = safeCur(y.currency);
  y.year = parseInt(y.year,10) || new Date().getFullYear();
  if(!y.label) y.label = String(y.year);
  if(!Array.isArray(y.people)) y.people = [];
  if(!Array.isArray(y.bills)) y.bills = [];
  if(!Array.isArray(y.loans)) y.loans = [];
  if(!Array.isArray(y.rules)) y.rules = [];
  if(!Array.isArray(y.txns)) y.txns = [];
  if(!Array.isArray(y.history)) y.history = [];
  if(!y.savings || typeof y.savings!=='object') y.savings = {startDate:y.year+'-01-01', months:24, growthPct:0, accounts:[]};
  if(!Array.isArray(y.savings.accounts)) y.savings.accounts = [];
  if(!y.analysis || typeof y.analysis!=='object') y.analysis = {from:y.year+'-01-01', to:(y.year+1)+'-01-01'};
  if(!y.analysis.from) y.analysis.from = y.year+'-01-01';
  if(!y.analysis.to) y.analysis.to = (y.year+1)+'-01-01';
  if(!y.taxBands || typeof y.taxBands!=='object') y.taxBands = presetFor(y.year);
  if(!Array.isArray(y.taxBands.uscBands) || !y.taxBands.uscBands.length) y.taxBands.uscBands = presetFor(y.year).uscBands;
  y.people.forEach(p=>{ if(!Array.isArray(p.credits)) p.credits = []; if(!p.id) p.id = uid(); });
  if(y.energy && y.energy.summary) y.energy.summary.intervalMins = num(y.energy.summary.intervalMins)||30;
  y.bills.forEach(b=>{ if(!b.kind) b.kind = guessKind(b.name); });
  y.loans.forEach(l=>{ delete l.ppi; });                    // PPI never worked; removed
  if(!Array.isArray(y.mortgages)) y.mortgages = [];
  y.mortgages.forEach(m=>{
    if(!m.id) m.id = uid();
    if(!Array.isArray(m.rates)) m.rates = [];
    if(!Array.isArray(m.lumps)) m.lumps = [];
    if(!Array.isArray(m.statements)) m.statements = [];
    /* a rate with no date has no effect and never shows in the table, so it just sits
       there confusing the next person to look - drop it rather than keep a ghost row */
    m.rates = m.rates.filter(r=> r && r.from);
    m.rates.forEach(r=>{ if(!r.id) r.id = uid(); if(!RATE_KINDS[r.kind]) r.kind = 'variable'; });
    m.lumps.forEach(l=>{ if(!l.id) l.id = uid(); });
    m.statements.forEach(s=>{ if(!s.id) s.id = uid(); });
    m.termMonths = clamp(Math.round(num(m.termMonths)), 0, 1200);
    if(blankish(m.allowancePct)) m.allowancePct = 10;        // most Irish lenders allow 10% a year on a fix
    // mortgage protection and home insurance were separate fields; they are one line now
    if(blankish(m.insuranceMonthly)) m.insuranceMonthly = round2(num(m.lifeMonthly) + num(m.homeMonthly));
    delete m.lifeMonthly; delete m.homeMonthly;
    m.basis = basisOf(m);                                    // daily 1/365 unless told otherwise
  });
  if(!y.accounts) y.accounts = [];
  if(!y.payees) y.payees = [];
  if(!SPLIT_MODES[y.splitMode]) y.splitMode = 'income';
  if(!y.splitManual) y.splitManual = {};
  if(typeof y.lodgeIncludesSavings !== 'boolean') y.lodgeIncludesSavings = true;
  if(!y.energy) y.energy = blankEnergy();
  if(!y.energy.bands) y.energy.bands = blankEnergy().bands;
  if(y.energy.vat === undefined) y.energy.vat = 9;
  if(!y.energy.offers) y.energy.offers = [];
  if(y.energy.mprn === undefined) y.energy.mprn = (y.energy.summary && y.energy.summary.mprn) || '';
  if(!y.renewals) y.renewals = blankRenewals();
  if(!Array.isArray(y.renewals.items)) y.renewals.items = [];
  delete y.renewals.ntfy;                                   // dropped: see blankRenewals
  y.renewals.items.forEach(c=>{ if(!c.id) c.id = uid(); delete c.sent; });
  if(!y.maternity) y.maternity = blankMaternity();
  const mm = y.maternity;
  if(!mm.employerPhases){
    // fold the old single-policy fields into the first phase
    mm.employerPhases = (mm.employerMode && mm.employerMode!=='none' && num(mm.employerWeeks)>0)
      ? [{id:uid(), weeks:num(mm.employerWeeks), mode:mm.employerMode, amount:num(mm.employerAmount)}]
      : [];
    delete mm.employerMode; delete mm.employerWeeks; delete mm.employerAmount;
  }
  mm.employerPhases.forEach(p=>{ if(!EMPLOYER_MODES[p.mode]) p.mode='topup'; if(!p.id) p.id=uid(); });
  /* Imported JSON carries rules but bare transactions, which left the dashboard with no
     actuals. Only auto-run on a year that has never been categorised - once anything is
     categorised, a blank category is treated as a deliberate choice and left alone. */
  if((y.txns||[]).length && !(y.txns||[]).some(t=>t.category)) applyRules(false, y);
  migrateEasy(y);
}


/* ---------------- additions to the data model ----------------
   Everything here is additive: a backup from an earlier version loads cleanly, with these fields
   filled in with defaults. */
function ensureDB(){
  if(!DB.ui || typeof DB.ui!=='object') DB.ui = {};
  delete DB.ui.mode;                                   // the old Simple / Full switch no longer exists
  if(!DB.ui.done || typeof DB.ui.done!=='object') DB.ui.done = {};
  DB.tracker = trackerNormalise(DB.tracker) || trackerBlank();         // Budget tracker projects
  if(!DB.netWorth || typeof DB.netWorth!=='object') DB.netWorth = {};
  ['assets','liabs','snaps'].forEach(k=>{ if(!Array.isArray(DB.netWorth[k])) DB.netWorth[k] = []; });
  DB.netWorth.assets.forEach(a=>{ if(!a.id) a.id = uid(); });
  DB.netWorth.liabs.forEach(a=>{ if(!a.id) a.id = uid(); });
  if(DB.theme!=='dark' && DB.theme!=='light') DB.theme = 'light';
}

function migrateEasy(y){
  if(!Array.isArray(y.goals)) y.goals = [];
  y.goals.forEach(g=>{ if(!g.id) g.id = uid(); });
  if(!y.emergency || typeof y.emergency!=='object') y.emergency = {months:3, saved:0};
  if(!num(y.emergency.months)) y.emergency.months = 3;
  if(!y.reliefs || typeof y.reliefs!=='object') y.reliefs = {};
  const r = y.reliefs;
  if(!Array.isArray(r.health)) r.health = [];
  r.health.forEach(h=>{ if(!h.id) h.id = uid(); });
  if(!r.checklist || typeof r.checklist!=='object') r.checklist = {};
  if(!r.remote || typeof r.remote!=='object') r.remote = {days:0, elec:0, heat:0, broadband:0, share:33};
  if(!r.tuition || typeof r.tuition!=='object') r.tuition = {eligible:0};
  if(!Array.isArray(r.tuitionClaims)) r.tuitionClaims = [];
  r.tuitionClaims.forEach(c=>{ if(!c.id) c.id = uid(); });
  /* tax-year figures added since older backups were made */
  const preset = presetFor(y.year);
  ['srcopParent','srcopSecond','earnedCredit','rentCredit','homeCarer','prsiExemptWeekly'].forEach(k=>{
    if(y.taxBands[k]===undefined) y.taxBands[k] = preset[k];
  });
  y.people.forEach(p=>{ if(!p.status) p.status = guessStatus(p, y.taxBands); });
  /* the disposable-income tracker */
  if(!y.disposable || typeof y.disposable!=='object') y.disposable = blankDisposable();
  const dp = y.disposable;
  if(!Array.isArray(dp.items)) dp.items = [];
  if(!Array.isArray(dp.entries)) dp.entries = [];
  dp.items.forEach(it=>{
    if(!it.id) it.id = uid();
    it.name = String(it.name||''); it.amount = num(it.amount);
    it.who = it.who ? String(it.who) : 'Joint';
    if(!FREQ[it.freq]) it.freq = 'Monthly';
  });
  dp.entries.forEach(e=>{
    if(!e.id) e.id = uid();
    e.date = String(e.date||''); e.what = String(e.what||''); e.amount = num(e.amount);
    e.who = e.who ? String(e.who) : 'Joint';
    if(!DISPOSABLE_CATS.some(c=>c[0]===e.category)) e.category = 'Other';
  });
}
