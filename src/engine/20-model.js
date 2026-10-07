/* ---------- data model ---------- */
function blankYear(year, seed){
  const p = presetFor(year);
  return {
    year: year,
    currency: '€',
    taxBands: p,
    people: seed ? seed.people : [
      {id:uid(), name:'Person 1', gross:0, pensionPct:0, avcMonthly:0, bikMonthly:0,
       srcop:p.srcopSingle, credits:[{name:'Personal Tax Credit',amount:p.personalCredit},{name:'Employee Tax Credit',amount:p.employeeCredit}],
       bonus:0}
    ],
    splitMode:'income',            // 'income' = pro-rata on net pay, 'manual'
    splitManual:{},                // personId -> share 0-1
    lodgeIncludesSavings: true,    // does "amount to lodge into the joint account" include joint savings
    bills: seed ? seed.bills : [],
    loans: seed ? seed.loans : [],
    mortgages: seed ? seed.mortgages : [],
    savings: seed ? seed.savings : {startDate: year+'-01-01', months:24, growthPct:0, accounts:[]},
    maternity: seed ? seed.maternity : blankMaternity(),
    renewals: seed ? seed.renewals : blankRenewals(),
    rules: seed ? seed.rules : [],
    accounts: seed ? seed.accounts : [],
    payees: seed ? seed.payees : [],
    energy: seed ? seed.energy : blankEnergy(),
    txns: [],
    history: seed ? seed.history : [],
    analysis: {from: year+'-01-01', to: (year+1)+'-01-01'}
  };
}

/* Standard Irish smart-tariff windows. Suppliers vary, so they are editable. */
function blankEnergy(){
  return {
    mprn: '',
    bands:{ nightStart:23, nightEnd:8, peakStart:17, peakEnd:19 },
    vat: 9,
    summary: null,
    offers: [
      {id:uid(), name:'Current plan', day:0, night:0, peak:0, standing:0, discount:0, incVat:true, current:true}
    ]
  };
}

/* Maternity Benefit is taxable but exempt from PRSI and USC - Revenue collects the
   tax by reducing credits and rate band, which usually works out at the 20% rate
   while income is down. 2026 rate is 299 a week for 26 weeks, plus up to 16 unpaid. */
function blankMaternity(){
  return {
    enabled:false, personId:'', start:'',
    paidWeeks:26, unpaidWeeks:0,
    stateWeekly:299, stateWeeks:26, benefitTaxPct:20,
    employerPhases:[],
    pausePension:true, pauseSavings:false
  };
}
const EMPLOYER_MODES = {
  topup:'Full pay (tops up the benefit)',
  percent:'% of normal salary',
  flat:'Flat amount per month'
};

function isBlankYear(y){
  if(!y) return true;
  const untouchedPerson = y.people.length<=1 && (!y.people[0] || (!num(y.people[0].gross) && !num(y.people[0].bonus)));
  return y.bills.length===0 && y.loans.length===0 && (y.mortgages||[]).length===0 && y.txns.length===0 &&
    y.accounts.length===0 && y.payees.length===0 && y.savings.accounts.length===0 &&
    y.history.length===0 && untouchedPerson;
}

/* Contract renewals. Nothing runs in the background - the app is only ever a page in
   a browser - so renewals surface on the dashboard whenever it is open, and that is
   deliberately all they do. */
function blankRenewals(){
  return { items:[] };
}
const daysUntil = d => {
  const t = parseDate(d); if(!t) return null;
  const today = new Date(); today.setHours(0,0,0,0);
  t.setHours(0,0,0,0);
  return Math.round((t - today)/86400000);
};
/* Everything renewing within the window, soonest first - used by the dashboard. */
function upcomingRenewals(withinDays){
  const w = withinDays===undefined ? 60 : withinDays;
  return (Y.renewals && Y.renewals.items || [])
    .map(c => ({...c, days: daysUntil(c.end)}))
    .filter(c => c.days !== null && c.days <= w)
    .sort((a,b)=> a.days - b.days);
}

const KEY = 'penny-keeper.v1';   // not 'ledger.v1', which an older workbook used, so the two never overwrite each other
const EARLIER_KEYS = ['household-finance.v1', 'ledger.easy.v1'];   // names it was saved under before - read once, then saved under KEY

function storedDB(){
  for(const k of [KEY].concat(EARLIER_KEYS)){ const v = localStorage.getItem(k); if(v) return v; }
  return null;
}
let DB = null, Y = null;

function load(){
  try{ DB = JSON.parse(storedDB()); }catch(e){ DB = null; }
  if(!DB || !DB.years || !Object.keys(DB.years).length){
    const y = new Date().getFullYear();
    DB = {version:1, active:String(y), theme:(window.matchMedia && matchMedia('(prefers-color-scheme: dark)').matches)?'dark':'light', years:{}};
    DB.years[String(y)] = blankYear(y);
  }
  if(!DB.years[DB.active]) DB.active = Object.keys(DB.years).sort()[0];
  ensureDB();
  Object.values(DB.years).forEach(migrate);
  Y = DB.years[DB.active];
  CUR = safeCur(Y.currency);
}
