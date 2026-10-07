/* ---------- Irish tax year presets ----------
   Figures for 2022-2026 are from Revenue's "Tax rates, bands and reliefs" chart and its USC page.
   2027 is from the published Budget 2027 summaries (aftertax.ie, income.ie) - credits that the
   summaries do not state are carried forward from 2026 and marked as estimates. Always confirm
   against revenue.ie and your own Tax Credit Certificate.

   srcopSingle  standard rate band, single person
   srcopMax     standard rate band, married / civil partners with one income
   srcopParent  standard rate band, single parent (Single Person Child Carer Credit)
   srcopSecond  the most a second earner's own band can be (two-income couples)
   uscBands     [{to: cumulative income limit, rate}], the last band has no limit
   prsiExemptWeekly  employees earning this or less a week pay no PRSI */
const TAX_PRESETS = {
  2022:{ srcopSingle:36800, srcopMax:45800, srcopParent:40800, srcopSecond:27800, lowRate:.20, highRate:.40,
    prsiRate1:.04, prsiRate2:.04, prsiChangeMonth:10, prsiExemptWeekly:352,
    uscExempt:13000, uscBands:[{to:12012,rate:.005},{to:21295,rate:.02},{to:70044,rate:.045},{to:1e12,rate:.08}] },
  2023:{ srcopSingle:40000, srcopMax:49000, srcopParent:44000, srcopSecond:31000, lowRate:.20, highRate:.40,
    prsiRate1:.04, prsiRate2:.04, prsiChangeMonth:10, prsiExemptWeekly:352,
    uscExempt:13000, uscBands:[{to:12012,rate:.005},{to:22920,rate:.02},{to:70044,rate:.045},{to:1e12,rate:.08}] },
  2024:{ srcopSingle:42000, srcopMax:51000, srcopParent:46000, srcopSecond:33000, lowRate:.20, highRate:.40,
    prsiRate1:.04, prsiRate2:.0410, prsiChangeMonth:10, prsiExemptWeekly:352,
    uscExempt:13000, uscBands:[{to:12012,rate:.005},{to:25760,rate:.02},{to:70044,rate:.04},{to:1e12,rate:.08}] },
  2025:{ srcopSingle:44000, srcopMax:53000, srcopParent:48000, srcopSecond:35000, lowRate:.20, highRate:.40,
    prsiRate1:.0410, prsiRate2:.0420, prsiChangeMonth:10, prsiExemptWeekly:352,
    uscExempt:13000, uscBands:[{to:12012,rate:.005},{to:27382,rate:.02},{to:70044,rate:.03},{to:1e12,rate:.08}] },
  2026:{ srcopSingle:44000, srcopMax:53000, srcopParent:48000, srcopSecond:35000, lowRate:.20, highRate:.40,
    prsiRate1:.0420, prsiRate2:.0435, prsiChangeMonth:10, prsiExemptWeekly:352,
    uscExempt:13000, uscBands:[{to:12012,rate:.005},{to:28700,rate:.02},{to:70044,rate:.03},{to:1e12,rate:.08}] },
  2027:{ srcopSingle:46500, srcopMax:55500, srcopParent:50500, srcopSecond:37500, lowRate:.20, highRate:.40,
    prsiRate1:.0435, prsiRate2:.0450, prsiChangeMonth:10, prsiExemptWeekly:352,
    uscExempt:13000, uscBands:[{to:12012,rate:.005},{to:30300,rate:.02},{to:70044,rate:.03},{to:1e12,rate:.08}] }
};

/* ---------- tax credits by year (euro, per year) ----------
   One row per credit, one column per year in CREDIT_YEARS. */
const CREDIT_YEARS = [2022, 2023, 2024, 2025, 2026, 2027];
const CREDIT_TABLE = {
  single:       [1700, 1775, 1875, 2000, 2000, 2125],
  married:      [3400, 3550, 3750, 4000, 4000, 4250],
  widowChild:   [1700, 1775, 1875, 2000, 2000, 2125],
  widowNoChild: [2240, 2315, 2415, 2540, 2540, 2665],
  widowBereave: [3400, 3550, 3750, 4000, 4000, 4250],
  widowParent1: [3600, 3600, 3600, 3600, 3600, 3600],
  widowParent2: [3150, 3150, 3150, 3150, 3150, 3150],
  widowParent3: [2700, 2700, 2700, 2700, 2700, 2700],
  widowParent4: [2250, 2250, 2250, 2250, 2250, 2250],
  widowParent5: [1800, 1800, 1800, 1800, 1800, 1800],
  spccc:        [1650, 1650, 1750, 1900, 1900, 1900],
  ageSingle:    [245, 245, 245, 245, 245, 245],
  ageMarried:   [490, 490, 490, 490, 490, 490],
  homeCarer:    [1600, 1700, 1800, 1950, 1950, 2050],
  employee:     [1700, 1775, 1875, 2000, 2000, 2125],
  earned:       [1700, 1775, 1875, 2000, 2000, 2125],
  incapChild:   [3300, 3300, 3500, 3800, 3800, 3800],
  depRelative:  [245, 245, 245, 305, 305, 305],
  blindSingle:  [1650, 1650, 1650, 1950, 1950, 1950],
  blindOne:     [1650, 1650, 1650, 1950, 1950, 1950],
  blindBoth:    [3300, 3300, 3300, 3900, 3900, 3900],
  rent:         [500, 500, 1000, 1000, 1000, 1150],
  rentCouple:   [1000, 1000, 2000, 2000, 2000, 2300],
  mortInt:      [0, 1250, 1250, 1250, 625, 0]
};
/* 2027 amounts that the Budget summaries do not state. They are derived (a married credit is double the
   single one) or carried forward from 2026, and are shown as "confirm" wherever they appear. */
const CREDIT_EST_2027 = new Set(['married','widowChild','widowNoChild','widowBereave','widowParent1','widowParent2',
  'widowParent3','widowParent4','widowParent5','spccc','ageSingle','ageMarried','incapChild','depRelative',
  'blindSingle','blindOne','blindBoth','mortInt']);

/* the dependent relative's own income limit, by year (2027 not published) */
const DEP_RELATIVE_LIMIT = {2022:16156, 2023:16780, 2024:17404, 2025:18028, 2026:18548};

const creditIdx = year => Math.min(Math.max(year - CREDIT_YEARS[0], 0), CREDIT_YEARS.length-1);
const creditAmount = (key, year) => (CREDIT_TABLE[key]||[0])[creditIdx(year)];
const creditIsEstimate = (key, year) => year >= 2027 && CREDIT_EST_2027.has(key);

/* When a credit reaches you.
   Most credits are on your Tax Credit Certificate, so your employer applies them and they are already in each pay.
   The Rent Tax Credit and the Mortgage Interest Tax Credit are claimed on your Income Tax Return after the year
   ends (Revenue's rent credit page says so), so they come back as a refund instead and are NOT in the monthly
   take-home figure. A row can carry its own `when` ('pay' or 'refund') to override this, for example if you
   have arranged to have a credit paid through your pay. */
const CREDIT_REFUND_KEYS = new Set(['rent', 'rentCouple', 'mortInt']);
const CREDIT_REFUND_NAMES = new Set(['rent tax credit', 'rent tax credit (jointly assessed couple)', 'mortgage interest tax credit']);
const creditIsRefund = c => c.when === 'refund' || (c.when !== 'pay' && CREDIT_REFUND_NAMES.has(String(c.name||'').trim().toLowerCase()));

/* the credits the engine and the older code paths still read straight off the year's tax settings */
Object.keys(TAX_PRESETS).forEach(k=>{
  const y = +k, p = TAX_PRESETS[k];
  p.personalCredit = creditAmount('single', y);
  p.employeeCredit = creditAmount('employee', y);
  p.earnedCredit = creditAmount('earned', y);
  p.rentCredit = creditAmount('rent', y);
  p.homeCarer = creditAmount('homeCarer', y);
});

/* the settings for a year; years we hold no figures for use the nearest one we do */
const presetFor = y => {
  const ks = Object.keys(TAX_PRESETS).map(Number).sort((a,b)=>a-b);
  const k = ks.filter(x=>x<=y).pop() || ks[0];
  return JSON.parse(JSON.stringify(TAX_PRESETS[k]));
};

/* "Which rate band applies to me?" - plain-English choices. The band itself comes from
   effectiveSrcop(); `pick` is only the number stored on the person for the fixed cases. */
const BAND_STATUS = {
  single:  {label:'Single person',                          pick:p=>p.srcopSingle},
  parent:  {label:'Single parent (lone parent)',            pick:p=>p.srcopParent||p.srcopSingle},
  married1:{label:'Married / civil partners - one income',  pick:p=>p.srcopMax},
  married2:{label:'Married / civil partners - both working',pick:p=>p.srcopSingle},
  custom:  {label:'Something else (type it in)',            pick:null}
};

/* Income that the standard rate band is measured against: pay plus benefit-in-kind, less pension and AVC. */
function taxableOf(p){
  const gross = num(p.gross);
  return gross + num(p.bikMonthly)*12 - gross*(num(p.pensionPct)/100) - num(p.avcMonthly)*12;
}
/* The standard rate band that really applies to a person.
   Two people marked "married, both working" share the couple's allowance the way Revenue's limit works:
   each has their own band, and whatever one of them cannot use (their income is below it) passes to the
   other, up to the extra that a one-income couple would get (53,000 against 44,000 in 2026). Total tax for the
   household then matches Revenue's combined limit (88,000 in 2026), whoever earns what. */
function effectiveSrcop(p, b){
  const own = num(p.srcop) || num(b.srcopSingle);
  if(p.status !== 'married2') return own;
  const all = (typeof Y!=='undefined' && Y && Array.isArray(Y.people)) ? Y.people : [];
  const mates = all.filter(q=> q.id!==p.id && q.status==='married2');
  if(mates.length !== 1) return num(b.srcopSingle);
  const single = num(b.srcopSingle), extraMax = Math.max(num(b.srcopMax) - single, 0);
  const unused = Math.max(single - Math.max(taxableOf(mates[0]),0), 0);
  return single + Math.min(extraMax, unused);
}

/* ---------- personal credit by situation ---------- */
const PERSONAL_TYPES = {
  single:      {label:'Single person',                                              key:'single', share:1},
  married:     {label:'Married / civil partners - one income (the couple\'s credit)', key:'married', share:1},
  marriedHalf: {label:'Married / civil partners - both working (half each)',          key:'married', share:.5},
  widowChild:  {label:'Widowed / surviving civil partner - with dependent children',   key:'widowChild', share:1},
  widowNoChild:{label:'Widowed / surviving civil partner - no dependent children',     key:'widowNoChild', share:1},
  widowBereave:{label:'Widowed / surviving civil partner - year of bereavement',       key:'widowBereave', share:1}
};
const personalAmount = (type, year) => {
  const t = PERSONAL_TYPES[type] || PERSONAL_TYPES.single;
  return Math.round(creditAmount(t.key, year) * t.share * 100) / 100;
};
const defaultPersonalType = status => status==='married1' ? 'married' : status==='married2' ? 'marriedHalf' : 'single';

/* ---------- the full list of credits, for the picker and the Credits page ----------
   `name` is what is written on the person's credit row, and rows are matched back to this list by name. */
function creditLibrary(year){
  const A = k => creditAmount(k, year), E = k => creditIsEstimate(k, year);
  const row = (group, key, name, desc, extra) => Object.assign({group, key, name, amount:A(key), est:E(key), desc, when:CREDIT_REFUND_KEYS.has(key)?'refund':'pay'}, extra||{});
  const dep = DEP_RELATIVE_LIMIT[year];
  return [
    row('Work','employee','Employee Tax Credit','For PAYE employees (anyone paid through payroll).', {auto:true}),
    row('Work','earned','Earned Income Tax Credit','For self-employed people, instead of the Employee credit.', {legacy:['earned income credit']}),
    row('Family','homeCarer','Home Carer Tax Credit','A married couple or civil partners where one of you works at home caring for a child or dependent, on a low income. This is the most you can get.'),
    row('Family','spccc','Single Person Child Carer Credit','A lone parent caring for a child. It also gives you the single-parent rate band.'),
    row('Family','incapChild','Incapacitated Child Tax Credit','You have a child who is permanently incapacitated (under 18, or over 18 and became so before 21 or while in full-time education).'),
    row('Family','depRelative','Dependent Relative Tax Credit','You maintain a relative at your own expense.'+(dep?' Their income must not exceed '+fmt0(dep)+'.':' Check the relative income limit on revenue.ie.')),
    row('Family','widowParent1','Widowed Parent Tax Credit - 1st year after death','Widowed or surviving civil partner with dependent children - first year after the death.'),
    row('Family','widowParent2','Widowed Parent Tax Credit - 2nd year after death','Second year after the death.'),
    row('Family','widowParent3','Widowed Parent Tax Credit - 3rd year after death','Third year after the death.'),
    row('Family','widowParent4','Widowed Parent Tax Credit - 4th year after death','Fourth year after the death.'),
    row('Family','widowParent5','Widowed Parent Tax Credit - 5th year after death','Fifth year after the death.'),
    row('Housing','rent','Rent Tax Credit','You pay rent on your main home (a registered tenancy) and do not get HAP, RAS or similar. Single person, maximum. Claimed on your Income Tax Return after the year ends, so it comes back as a refund.'),
    row('Housing','rentCouple','Rent Tax Credit (jointly assessed couple)','The same credit for a jointly assessed couple - claim it once for the two of you. Refunded after the year ends.'),
    row('Housing','mortInt','Mortgage Interest Tax Credit','For some owner-occupiers (mortgage balance of 80,000 to 500,000 at the end of 2022) whose interest rose. Available for 2023 to 2026 only, with a lower maximum for 2026 - check the amount and whether you qualify on revenue.ie. Refunded after the year ends.'),
    row('Age and health','ageSingle','Age Tax Credit (single or widowed)','Aged 65 or over.', {legacy:['age tax credit']}),
    row('Age and health','ageMarried','Age Tax Credit (married or civil partners)','Aged 65 or over, or your spouse or civil partner is.'),
    row('Age and health','blindSingle','Blind Tax Credit (single person)','You are blind.', {legacy:['blind person\'s tax credit']}),
    row('Age and health','blindOne','Blind Tax Credit (one spouse or civil partner blind)','One of you is blind.'),
    row('Age and health','blindBoth','Blind Tax Credit (both spouses or civil partners blind)','Both of you are blind.')
  ];
}
/* does a credit row on a person belong to this entry in the library? */
function creditMatches(lib, rowName){
  const n = String(rowName||'').trim().toLowerCase();
  return n === lib.name.toLowerCase() || (lib.legacy||[]).includes(n);
}
const CREDIT_GROUPS = ['Work','Family','Housing','Age and health'];

/* Bring a person's credits up to the figures for a year: the personal credit follows their situation,
   and every other credit that is in the library takes that year's amount. Anything typed in by hand that
   is not in the library is left alone. */
function refreshCredits(p, year){
  const lib = creditLibrary(year);
  const type = p.personalType || defaultPersonalType(p.status);
  (p.credits||[]).forEach(c=>{
    if(/^personal/i.test(c.name)) c.amount = personalAmount(type, year);
    else if(/^employee|paye/i.test(c.name) && !lib.some(l=>creditMatches(l,c.name))) c.amount = creditAmount('employee', year);
    else { const l = lib.find(x=>creditMatches(x, c.name)); if(l) c.amount = l.amount; }
  });
}


