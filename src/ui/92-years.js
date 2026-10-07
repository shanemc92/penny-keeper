/* ---------------- year management ---------------- */
/* A full copy of the current year under a new label - for "what if things change in
   March" scenarios, or just a safe sandbox to try figures in. Everything comes across,
   transactions included, because the point is to compare like with like. */
function duplicateYear(){
  const suggested = yearKey(yearLabel()+'-2');
  const input = prompt('Name for the copy (everything in '+yearLabel()+' is copied across):', suggested);
  if(input===null) return;
  const label = String(input).trim();
  if(!label){ toast('Needs a name'); return; }
  const key = yearKey(label);
  const copy = JSON.parse(JSON.stringify(Y));
  copy.label = label;
  DB.years[key] = copy;
  DB.active = key;
  Y = copy; CUR = safeCur(Y.currency);
  save(); render();
  toast('Copied to '+label);
}
function newYear(){
  const years = Object.keys(DB.years).map(Number);
  const suggested = Math.max(...years)+1;
  const input = prompt('New year to create (bills, loans, mortgage, savings and rules carry over):', suggested);
  if(!input) return;
  const y = parseInt(input,10);
  if(!y || y<1990 || y>2200){ toast('Enter a year like '+suggested); return; }
  if(DB.years[y] && !confirm(y+' already exists. Overwrite it?')) return;
  const src = Y;
  const seed = {
    people: JSON.parse(JSON.stringify(src.people)),
    bills: JSON.parse(JSON.stringify(src.bills)),
    loans: JSON.parse(JSON.stringify(src.loans)),
    mortgages: JSON.parse(JSON.stringify(src.mortgages||[])),
    savings: JSON.parse(JSON.stringify(src.savings)),
    rules: JSON.parse(JSON.stringify(src.rules)),
    history: JSON.parse(JSON.stringify(src.history)),
    accounts: JSON.parse(JSON.stringify(src.accounts||[])),
    payees: JSON.parse(JSON.stringify(src.payees||[])),
    energy: JSON.parse(JSON.stringify(src.energy||blankEnergy())),
    maternity: JSON.parse(JSON.stringify(src.maternity||blankMaternity()))
  };
  if(seed.energy) seed.energy.summary = null;   // new year, re-import the usage file
  const nd = blankYear(y, seed);
  const p = presetFor(y);
  nd.goals = JSON.parse(JSON.stringify(src.goals||[]));
  nd.emergency = JSON.parse(JSON.stringify(src.emergency||{months:3, saved:0}));
  nd.renewals = JSON.parse(JSON.stringify(src.renewals||{items:[]}));   // contract end dates are real dates, so they carry over
  migrate(nd);                                                         // fills every field a page reads, as a restore would
  nd.people.forEach(pp=>{
    const st = BAND_STATUS[pp.status];
    if(st && st.pick) pp.srcop = st.pick(p); else if(!pp.srcop) pp.srcop = p.srcopSingle;
    refreshCredits(pp, y);
  });
  nd.savings.startDate = y+'-01-01';
  nd.splitMode = src.splitMode; nd.splitManual = JSON.parse(JSON.stringify(src.splitManual||{}));
  nd.lodgeIncludesSavings = src.lodgeIncludesSavings!==false;
  nd.currency = src.currency;
  DB.years[String(y)] = nd;
  DB.active = String(y);
  Y = nd; save(); render();
  toast(y+' created - transactions start empty');
}

