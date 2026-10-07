/* ---------------- budget tracker: plan and track the cost of a project ----------------
   For anything with a lot of moving parts - a renovation, a wedding, a build. Each project has stages, each stage
   has items with a planned cost and an actual one, and the project has funding (what is paying for it).
   Projects live in DB.tracker, so backups, restore and sync cover them like everything else. The data format is
   that of the standalone Budget Tracker tool, so its export files import here unchanged:

     {v:2, active, projects:[{id, name, currency, funding:[{id, name, amount}],
                              sections:[{id, name, open, items:[{id, name, budget, actual, done}]}]}]} */

const TRACKER_STANDALONE_KEY = 'budget-tracker';     // where the standalone tool keeps its projects, read once to bring them across

const trackerBlank = () => ({v:2, active:'', projects:[]});
const trackerNewProject = (name, currency) => ({id:uid(), name:name || 'New project', currency:currency || '€', funding:[], sections:[]});
const trackerNewItem = (name, budget) => ({id:uid(), name:name || 'New item', budget:num(budget), actual:0, done:false});

/* Tidy anything that claims to be tracker data: a whole export, a single project, or a bare list of stages.
   Returns null if it is none of those. Missing fields are filled in rather than assumed. */
function trackerNormalise(data){
  if(!data || typeof data !== 'object') return null;
  let projects = null;
  if(Array.isArray(data.projects)) projects = data.projects;
  else if(Array.isArray(data.sections)) projects = [{id:uid(), name:data.name || data.project || 'Imported project',
    currency:data.currency, funding:data.funding, sections:data.sections}];
  if(!projects) return null;
  const obj = x => x && typeof x === 'object';
  projects = projects.filter(obj);
  projects.forEach(p=>{
    p.id = p.id || uid();
    p.name = String(p.name || 'Project');
    p.currency = safeCur(p.currency);
    p.funding = (Array.isArray(p.funding) ? p.funding : []).filter(obj);
    p.funding.forEach(f=>{ f.id = f.id || uid(); f.name = String(f.name || 'Source'); f.amount = parseAmount(f.amount); });
    p.sections = (Array.isArray(p.sections) ? p.sections : []).filter(obj);
    p.sections.forEach(s=>{
      s.id = s.id || uid(); s.name = String(s.name || 'Stage'); s.open = s.open !== false;
      s.items = (Array.isArray(s.items) ? s.items : []).filter(obj);
      s.items.forEach(i=>{ i.id = i.id || uid(); i.name = String(i.name || 'Item'); i.budget = parseAmount(i.budget); i.actual = parseAmount(i.actual); i.done = !!i.done; });
    });
  });
  return {v:2, active:projects.some(p=>p.id===data.active) ? data.active : (projects[0] ? projects[0].id : ''), projects};
}

/* Forgiving number entry: "18k", "18.5k", "1,250", "EUR 18 000" and "18000" all mean what they look like. */
function parseAmount(v){
  if(v == null) return 0;
  let s = String(v).trim().toLowerCase().replace(/[^0-9.k-]/g, '');
  if(!s) return 0;
  let mult = 1;
  if(s.endsWith('k')){ mult = 1000; s = s.slice(0, -1); }
  const n = parseFloat(s);
  return isFinite(n) ? round2(n * mult) : 0;
}

/* The numbers for a project. Forecast is "what this costs if nothing else changes": an item that is not ticked
   off forecasts at whichever is higher, its budget or what has been spent so far, because it might still cost
   its budget; a ticked-off item is finished, so it forecasts at what was actually paid. */
function trackerTotals(p){
  let budget = 0, actual = 0, forecast = 0;
  const stages = p.sections.map(s=>{
    let b = 0, a = 0, f = 0;
    s.items.forEach(i=>{
      const ib = num(i.budget), ia = num(i.actual);
      b += ib; a += ia; f += i.done ? ia : Math.max(ib, ia);
    });
    budget += b; actual += a; forecast += f;
    return {id:s.id, name:s.name, budget:b, actual:a, forecast:f};
  });
  const funds = p.funding.reduce((t, f)=> t + num(f.amount), 0);
  return {stages, budget, actual, forecast, funds, toPay:Math.max(0, forecast - actual), headroom:funds - forecast,
          variance:budget - forecast};
}

/* a spreadsheet-friendly list of the items, with the totals underneath */
function trackerCsvRows(p){
  const t = trackerTotals(p);
  const rows = [['Project', p.name], [], ['Stage', 'Item', 'Budget', 'Spent', 'Variance', 'Done']];
  p.sections.forEach(s=> s.items.forEach(i=>
    rows.push([s.name, i.name, num(i.budget), num(i.actual), num(i.budget) - num(i.actual), i.done ? 'yes' : 'no'])));
  rows.push([], ['TOTAL', '', t.budget, t.actual, t.budget - t.actual, ''],
    ['FUNDING', '', t.funds, '', '', ''], ['FORECAST', '', t.forecast, '', '', ''], ['HEADROOM', '', t.headroom, '', '', '']);
  return rows;
}

/* Starting points: the usual stages, with items to price. Amounts are left for you to fill in. */
const TRACKER_TEMPLATES = [
  {key:'renovation', icon:'🏠', name:'Home renovation', blurb:'Strip-out through to decorating',
    funding:['Savings', 'Loan', 'Grant (e.g. SEAI)'],
    stages:[['Strip out & structure', ['Skip hire & clearance', 'Structural work', 'Building control & fees']],
      ['Electrics & plumbing', ['Rewire', 'Plumbing', 'Heating system']],
      ['Windows & doors', ['Windows', 'External doors', 'Internal doors']],
      ['Kitchen', ['Units & worktops', 'Appliances', 'Fitting']],
      ['Bathroom', ['Suite & fittings', 'Tiling', 'Fitting']],
      ['Floors & decorating', ['Flooring', 'Painting', 'Lighting']]]},
  {key:'wedding', icon:'💍', name:'Wedding', blurb:'Venue to honeymoon',
    funding:['Joint savings', 'Family contributions'],
    stages:[['Venue & catering', ['Venue deposit', 'Food & drink', 'Cake']],
      ['Outfits & rings', ['Dress', 'Suits', 'Rings']],
      ['People & music', ['Photographer', 'Videographer', 'Band or DJ']],
      ['Flowers & styling', ['Flowers', 'Decorations', 'Stationery']],
      ['Travel & honeymoon', ['Guest transport', 'Honeymoon']]]},
  {key:'holiday', icon:'✈️', name:'Holiday', blurb:'Travel, stay and spending',
    funding:['Holiday savings'],
    stages:[['Getting there', ['Flights', 'Airport transfers', 'Travel insurance']],
      ['Where you stay', ['Accommodation']],
      ['While you are there', ['Food & drink', 'Activities', 'Spending money']]]}
];
function trackerFromTemplate(key){
  const t = TRACKER_TEMPLATES.find(x=>x.key===key);
  const p = trackerNewProject(t ? t.name : 'My project');
  if(!t) return p;
  p.funding = t.funding.map(n=>({id:uid(), name:n, amount:0}));
  p.sections = t.stages.map(([name, items])=>({id:uid(), name, open:true, items:items.map(n=>trackerNewItem(n, 0))}));
  return p;
}

const trackerProject = () => { const T = DB.tracker; return T.projects.find(p=>p.id===T.active) || T.projects[0] || null; };
const trackerHasData = () => DB.tracker.projects.some(p=> p.sections.length || p.funding.length);

/* projects saved by the standalone Budget Tracker in this browser, if any, tidied up ready to bring across */
function trackerStandalone(){
  try{
    const raw = localStorage.getItem(TRACKER_STANDALONE_KEY);
    const n = raw ? trackerNormalise(JSON.parse(raw)) : null;
    return n && n.projects.some(p=> p.sections.length || p.funding.length) ? n : null;
  }catch(e){ return null; }
}

/* add projects to the ones already here (their ids are made fresh if they clash) */
function trackerAdd(projects){
  const T = DB.tracker, ids = new Set(T.projects.map(p=>p.id));
  projects.forEach(p=>{ if(ids.has(p.id)) p.id = uid(); ids.add(p.id); T.projects.push(p); });
  if(projects.length) T.active = projects[0].id;
}

/* money for a project, in the project's own currency symbol: whole units, and "12.5k" once it is large */
const trackerMoney = (n, cur) => (n < 0 ? '-' : '') + cur + Math.round(Math.abs(n)).toLocaleString('en-IE');
const trackerMoneyK = (n, cur) => Math.abs(n) >= 10000 ? (n < 0 ? '-' : '') + cur + (Math.abs(n)/1000).toFixed(Math.abs(n) % 1000 ? 1 : 0) + 'k' : trackerMoney(n, cur);
/* an amount as it is shown in a box: grouped thousands, no trailing zeros, and nothing at all for zero */
const trackerAmountText = v => num(v) ? num(v).toLocaleString('en-IE', {maximumFractionDigits:2}) : '';
