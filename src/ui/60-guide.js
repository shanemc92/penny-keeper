/* ---------------- guidance layer ----------------
   Everything that makes the app self-explaining lives here: the page headers, the "?" tooltips
   that are attached to labels automatically, the amber "fill this in" highlighting, the help
   drawer with the glossary, and the first-run welcome and tour. None of it touches the data. */

const PAGES = {
  dashboard:{ico:'🏠', title:'Home',
    lead:'Your money at a glance: what comes in, what goes out, and what is left.'},
  setup:{ico:'🧭', title:'Set-up guide',
    lead:'Five short steps and your finances are up and running. Do them in order or skip around - your progress is saved as you go.'},
  tax:{ico:'💶', title:'Take-home pay',
    lead:'Enter your salary and see exactly how much lands in your bank account after tax, PRSI and USC.',
    steps:['Enter your salary','Check your rate band and credits','See your take-home pay'],
    tips:['Boxes with an <b>amber outline</b> are the ones we are waiting on - start there.',
      'This year\'s Irish tax rates and credits are already filled in. You rarely need to change them.',
      'For exact figures, copy the rate band and credits from your <b>Revenue Tax Credit Certificate</b> (myAccount on revenue.ie).',
      'Two earners? Use <b>+ Add another earner</b>. The Bills page can then share joint bills between you.',
      'Credits are listed for every year. They follow the figures on revenue.ie - <b>confirm yours there</b>.',
      'Credits claimed on your tax return after the year ends (rent, mortgage interest) are <b>not</b> in your monthly take-home pay. They are shown as a refund instead.']},
  budget:{ico:'🧾', title:'Bills & budget',
    lead:'List what you spend and put aside. Everything is converted into weekly, monthly and yearly figures for you.',
    steps:['Add your bills','Add your savings','Check what is left over'],
    tips:['Type each bill the way it is charged - e.g. <b>€160, Annually</b> - and it is converted to a monthly cost automatically.',
      'Use <b>Quick add</b> to drop in common Irish bills (TV licence, motor tax, NCT, Local Property Tax...) then fill in the amounts.',
      '"Who pays" decides whose bills they are. <b>Joint</b> bills are shared between everyone in the household.',
      'Savings are kept separate from bills so "what I spend" and "what I put away" never get mixed up. Use the arrow button to move a line across.',
      'Add the next payment date and the bill shows up under <b>Coming up</b> on the Home page.']},
  disposable:{ico:'🛍️', title:'Disposable income',
    lead:'Where the spare money goes: subscriptions, meals out, takeaways and treats - for the household and for each person.',
    steps:['Add your subscriptions','Log what you spend','See where it went'],
    tips:['<b>Spare money</b> is what is left of your take-home pay after bills and savings. This page is for spending it.',
      'Put the essentials (rent, electricity, insurance) in <b>Bills &amp; budget</b> and the optional extras here, so nothing is counted twice.',
      'Add anything that comes out regularly under <b>Subscriptions</b>: streaming, a gym, an AI plan, a magazine. Yearly ones are turned into a monthly cost.',
      'Log a meal out or a takeaway in a few seconds - type what it was, pick a category and who paid, and press Enter.',
      '<b>Joint</b> things are shared between you in the same proportions as your joint bills.',
      'Use the arrows or the month list on <b>Where it went</b> to look back at earlier months.']},
  bank:{ico:'🏦', title:'Spending',
    lead:'Upload a statement from your bank and see where your money really goes compared with your plan.',
    steps:['Download a CSV from online banking','Upload it here','Teach it your categories'],
    tips:['In your online banking choose the account, then <b>Export / Download transactions</b> as <b>CSV</b>. Most Irish banks offer this.',
      'The file is read in your browser. <b>Nothing is uploaded</b> anywhere.',
      'A <b>rule</b> says "any payment containing TESCO is Groceries". Add a few rules and every future import sorts itself.',
      'Uploading the same statement twice is safe - duplicates are skipped.']},
  renewals:{ico:'🔔', title:'Renewals',
    lead:'Keep track of when contracts end so you can switch before you roll onto a higher price.',
    tips:['Good ones to add: broadband, mobile, insurance (home, car, health), energy and anything with a fixed term.',
      'Anything ending within 60 days shows on your Home page.',
      'Press <b>Renewed</b> when you have sorted it and the date moves on a year.']},
  history:{ico:'📈', title:'Bill history',
    lead:'A log of what your bills really cost each month, so next year\'s budget is based on facts instead of guesses.'},
  savings:{ico:'🐖', title:'Savings & goals',
    lead:'Build a rainy-day fund, save towards goals, and see where your savings will be in the years ahead.',
    steps:['Set an emergency fund target','Add goals you are saving for','Track your accounts'],
    tips:['An emergency fund of <b>3 to 6 months of bills</b> is the usual target.',
      'For each goal we work out how much to put away every month to reach it on time.',
      'Press <b>Add to my budget</b> on a goal and it becomes a savings line on the Bills page.',
      'Took money out of an account? Press <b>Log</b> next to it so the projection stays honest.']},
  loans:{ico:'💳', title:'Loans',
    lead:'See the true cost of a loan, and how much interest you save by paying a little more.',
    steps:['Add the loan','Try a higher repayment','See the interest you save'],
    tips:['Use this for car loans, credit union loans and personal loans. <b>Mortgages have their own page.</b>',
      'Put the higher repayment in <b>Proposed repayment</b> and the savings appear straight away.',
      'Unsure of the balance? Use the figure from your latest statement and today\'s date as the start date.']},
  mortgage:{ico:'🏡', title:'Mortgage',
    lead:'Model your fixed and variable rates, see what happens when a fixed rate ends, and see the effect of overpaying.',
    steps:['Enter the amount, term and rates','Add statements to keep it accurate','Try overpayments'],
    tips:['Your <b>offer letter</b> has the amount, term and rates. Your annual statement keeps the balance accurate.',
      'When the rate changes the lender recalculates your repayment over the remaining term. That is built in.',
      'Overpaying shortens the term rather than lowering the repayment, which is the Irish default.',
      'Many fixed rates cap overpayments (often 10% a year) before a break fee. You will see a warning if you go over.']},
  networth:{ico:'📊', title:'Net worth',
    lead:'Everything you own minus everything you owe. Take a snapshot now and then to watch it grow.',
    steps:['Check what we pulled in','Add other things you own or owe','Save a snapshot'],
    tips:['Savings, loans and your mortgage are pulled in automatically from the other pages.',
      'Add your home value, car, pension pot and investments by hand.',
      'Save a snapshot every few months. The chart builds up over time.']},
  reliefs:{ico:'🧮', title:'Credits & reliefs',
    lead:'Claim every Irish tax credit and relief you are entitled to, and see roughly how much tax you could get back.',
    steps:['Tick the credits that apply','Log health expenses and other claims','See your possible refund'],
    tips:['<b>Credits</b> come straight off your tax bill. Ticking one here adds it to your Take-home pay calculation.',
      '<b>Reliefs</b> (health expenses, remote working, tuition fees) are claimed from Revenue after the year, via myAccount.',
      'Keep receipts. Revenue can ask to see them for up to six years.',
      'Rent and mortgage interest credits, and health, remote working and tuition relief, come back <b>after the year ends</b>, so they are an estimated refund and are not in your monthly pay.',
      'These are estimates to help you plan. Always check the current rules on <b>revenue.ie</b>.']},
  energy:{ico:'⚡', title:'Electricity',
    lead:'Upload your smart-meter data and see which tariff - day/night/peak or a flat rate - would cost you least.',
    steps:['Download your usage file from ESB Networks','Upload it here','Add the offers you are comparing'],
    tips:['Log in to <b>ESB Networks</b> (myaccount.esbnetworks.ie) and download your <b>HDF</b> file - half-hourly usage for your meter.',
      'Enter each offer\'s unit rates in <b>cent per kWh</b>, as shown on the supplier\'s price plan.',
      'The chart shows when you use power through a typical day, shaded by rate band.']},
  accounts:{ico:'🗂️', title:'Accounts & payees',
    lead:'Your bank accounts and the people and companies you pay, with IBANs kept in one safe place.',
    tips:['IBANs are hidden by default. Click to reveal or copy.','Each IBAN is checked as you type, so a mistyped digit is caught straight away.']},
  maternity:{ico:'👶', title:'Maternity leave',
    lead:'Plan the cash flow of a period of leave - state benefit, any employer top-up, and what is left after bills.'},
  tracker:{ico:'🏗️', title:'Budget tracker',
    lead:'Plan what each part of a big project should cost, log what it really cost, and see how far ahead or behind you are - a renovation, a wedding, a house build.',
    steps:['Start a project','Add the costs you expect','Log what you really pay'],
    tips:['This is separate from your household budget. Each <b>project</b> has its own stages, items and funding.',
      'Pick a starting point (renovation, wedding, holiday) and the usual stages are filled in - you add the costs.',
      'Every item has a <b>budget</b> and a <b>spent</b> figure. Tick an item when it is paid and the forecast uses what you really paid.',
      'List what is paying for it under <b>Funding</b>, and the top of the page shows how much is left once everything is paid.',
      'You can type amounts like <b>18k</b> or <b>1,250</b>. Your projects are saved with the rest of your data and are in your backup.']},
  data:{ico:'💾', title:'Backup & settings',
    lead:'Your data lives only in this browser. Download a backup regularly so you never lose it.'}
};

/* Tooltip text for field labels, table headings and figures. Matched on the visible text, so the
   same wording gets the same help wherever it appears. */
const LABEL_TIPS = {
  /* pay */
  'gross annual salary':'Your yearly pay before anything is taken off. It is on your contract and at the top of your payslip. Only know the monthly figure? Multiply by 12.',
  'yearly salary (before tax)':'Your yearly pay before anything is taken off. It is on your contract and at the top of your payslip. Only know the monthly figure? Multiply by 12.',
  'pension %':'The percentage of your pay that goes into a workplace pension. It reduces your income tax, so it costs you less than it looks.',
  'pension (% of salary)':'The percentage of your pay that goes into a workplace pension. It reduces your income tax, so it costs you less than it looks.',
  'avc / month':'Additional Voluntary Contributions: extra pension payments you make yourself each month. They also get tax relief, up to age-based limits.',
  'bik / month':'Benefit-in-kind: the monthly taxable value of perks from your employer, such as a company car or health insurance. See your payslip.',
  'standard rate band':'How much of your income is taxed at the lower 20% rate. Anything above it is taxed at 40%. It depends on your situation: single, married or a single parent.',
  'standard rate band (single)':'How much income is taxed at the lower 20% rate for a single person. Above it, 40% applies.',
  'bonus (gross)':'A bonus before tax. It is usually taxed at your top rate, so you keep much less than the headline figure.',
  'standard rate band (single parent)':'The 20% band for a single parent who qualifies for the Single Person Child Carer Credit. It is higher than the single band.',
  'standard rate band (married, one income)':'The 20% band when only one of a married couple or civil partners has income.',
  'most a second earner\'s band can be':'When both of a couple work, this is the most that the lower earner\'s band can be. Together the two bands never exceed twice the single band.',
  'no prsi at or below (weekly pay)':'Employees earning this much a week or less pay no PRSI.',
  'which personal credit applies to you?':'Everyone gets a personal credit. The amount depends on your situation - single, married, or widowed. Check your Tax Credit Certificate.',
  'up to (total income)':'The total income at which this USC rate stops applying. Each band applies to the slice of income between the previous limit and this one.',
  'budget':'What you plan to pay for everything in this project.',
  'spent so far':'What has actually been paid so far.',
  'forecast cost':'What the project costs if nothing else changes. An item that is not ticked off counts at its budget, or at what you have spent if that is more. A ticked-off item counts at what you paid.',
  'over / under budget':'Your total budget minus the forecast. Over means the forecast is higher than you planned.',
  'when you get it':'In your pay: your employer applies it every month. Refund after the year: you claim it on your tax return once the year is over (like the Rent Tax Credit), so it is not in monthly take-home pay.',
  'low rate':'The lower income tax rate - 20% in Ireland.',
  'high rate':'The higher income tax rate - 40% in Ireland, charged on income above the standard rate band.',
  'prsi rate (start of year)':'PRSI (Pay Related Social Insurance) pays for social welfare benefits and the State pension. This is the rate up to the change month.',
  'prsi rate (after change)':'The PRSI rate from the change month onward. It has been rising each October.',
  'prsi change month':'The month number when PRSI goes up. 10 means October.',
  'usc exemption':'Universal Social Charge is not charged at all if your total income for the year is below this amount.',
  'rate band for your situation':'Pick the one that matches you and the right standard rate band is filled in. Your Revenue Tax Credit Certificate shows the exact figure.',
  /* budget */
  'split joint bills by':'How shared (Joint) bills are divided between the people in the household.',
  'amount':'How much each payment is, in euro.',
  'how often':'How often this is charged. It is converted to weekly, monthly and yearly figures for you.',
  'who pays':'Whose bill this is. Joint bills are shared between everyone in the household.',
  'next payment':'The next time this is due. Optional - when filled in, the bill appears under "Coming up" on the Home page.',
  'per month':'What this works out at each month. A yearly bill is divided by 12.',
  'annual':'What this adds up to over a full year.',
  'weekly':'What this works out at each week.',
  'spare money / month':'Take-home pay minus bills and savings: the money you are free to spend. This is what the tracker spends down.',
  'subscriptions / month':'Everything regular on your list, turned into a monthly cost. A yearly subscription is divided by 12.',
  'left this month':'Spare money, less subscriptions, less what you logged for the month shown. Negative means overspent.',
  'spare money':'This person\'s take-home pay minus their own bills, their share of the joint bills and their savings.',
  'subscriptions':'Their own subscriptions plus their share of anything marked Joint, per month.',
  'spent':'What was logged for the month shown: their own, plus their share of anything marked Joint.',
  'left to spend':'Spare money minus subscriptions minus spending. Negative means they spent more than they had free.',
  'paid by':'Whose money it came out of. Joint is shared between everyone in the same proportions as your joint bills.',
  'spent on':'What kind of spending this was, so the month can be broken down by category.',
  'what was it':'A few words so you recognise it later - the restaurant, the shop, the occasion.',
  'upcoming':'The next payment date, rolled forward from the date you entered.',
  'actual /mo':'What your imported bank statement says you really spent each month in this category.',
  'budget used':'Real spending as a share of the budget. Past the vertical line means over budget.',
  'to lodge / month':'What each person needs to transfer into the joint account each month to cover their share.',
  'left over':'Take-home pay minus your own bills, your share of joint bills and your savings.',
  /* loans */
  'opening balance':'How much you owed at the start date - the amount on your first statement.',
  'interest rate %':'The yearly interest rate on the loan, shown on your loan agreement or statement.',
  'frequency':'How often you make a repayment.',
  'start date':'When the loan began, or the date your opening balance is from.',
  'current repayment':'What you pay each period right now.',
  'proposed repayment':'A bigger repayment to try out. Costs and payoff date are recalculated so you can see the interest you would save.',
  'overpayment starts':'The date the bigger repayment begins. Leave it blank to apply it from the start.',
  'target end date':'When you would like to be debt free. We work out the repayment needed to get there.',
  'owed today':'The balance outstanding right now, based on the repayment schedule.',
  'still to pay':'Everything still to be paid: the balance plus the interest still to come.',
  'interest saved':'Interest you avoid by paying the proposed amount instead of the current one.',
  'interest - current':'Total interest if you carry on paying the current amount.',
  'interest - proposed':'Total interest with the proposed repayment.',
  'total to pay':'Everything you would pay back in total, capital and interest.',
  /* mortgage */
  'amount borrowed':'The original loan amount from your mortgage offer.',
  'drawdown date':'The date the lender released the money. Interest starts from here.',
  'term - years':'The length of the mortgage from your offer letter, in whole years.',
  'term - extra months':'Any months on top of the whole years. Leave at 0 if it is a round number of years.',
  'lender':'Your bank or mortgage provider.',
  'property value':'What the property is worth. Used to work out your loan to value (LTV).',
  'loan to value':'The mortgage as a percentage of the property value. Lower is better and often earns a better rate.',
  'repayment now (statement)':'The repayment on your latest statement. Fill this in if you have overpaid before, because the lender keeps collecting the contract amount.',
  'insurance / month':'Mortgage protection or home insurance collected with your repayment. It changes what leaves your account but not the balance.',
  'fixed overpay allowance %':'Most lenders let you overpay up to this percentage a year while on a fixed rate, before a break fee. It is in your offer letter.',
  'interest charged':'The interest your lender charged, from the statement. Optional - used to check the model against reality.',
  'overpayment / month':'An extra amount paid every month on top of the normal repayment.',
  /* bank */
  'csv file (aib export or any bank csv)':'The transactions file from your online banking. Choose the account, then Export or Download as CSV.',
  'on import':'"Add to existing" keeps what you have and skips duplicates. "Replace all" starts fresh with this file.',
  'from':'The first date to include.',
  'to':'The last date to include.',
  'description contains':'Any transaction whose description contains this text is given the category on the right. The longest match wins.',
  /* energy */
  'mprn':'Meter Point Reference Number: the 11-digit number on your electricity bill that identifies your meter.',
  'hdf usage file (csv)':'The Harmonised Downloadable File from ESB Networks - half-hourly readings for your meter.',
  'night starts':'The hour the cheap night rate begins (0-23). 23 means 11pm.',
  'night ends':'The hour the night rate ends. 8 means 8am.',
  'peak starts':'The hour the expensive peak rate begins. 17 means 5pm.',
  'peak ends':'The hour the peak rate ends. 19 means 7pm.',
  'vat % (if rates exclude it)':'VAT on electricity is 9%. It is only added to offers where you have not ticked that the rates include VAT.',
  'used at night':'The share of your electricity used during the night rate band.',
  'used at peak':'The share of your electricity used during the peak rate band.',
  /* maternity */
  'who is taking it':'Whose income changes during the leave.',
  'paid leave (weeks)':'Weeks of paid maternity leave. The standard is 26.',
  'unpaid leave after (weeks)':'Optional extra unpaid weeks after the paid leave, up to 16.',
  'maternity benefit / week':'The weekly State payment during paid leave. It is taxable but has no PRSI or USC.',
  'paid for (weeks)':'How many weeks the State benefit is paid for.',
  'taxed at %':'The tax rate applied to the benefit. Revenue usually collects 20% by trimming your credits.',
  /* savings */
  'months to project':'How far into the future to forecast your savings.',
  'annual growth %':'The yearly interest or investment return you expect. Leave at 0 to be cautious.',
  'put aside / month':'The total you commit to savings and investments each month.',
  'savings rate':'The share of your take-home pay you save. 10% to 20% is a good target.',
  'balance today':'What your savings accounts hold right now.',
  'projected':'Where the savings forecast ends up at the end of the period.',
  /* misc */
  'currency':'The symbol shown beside amounts, e.g. € or £.'
};

/* Plain-English glossary for the Help drawer. */
const TERMS = [
  ['PAYE','Pay As You Earn. Income tax taken from your wages before you get them.'],
  ['PRSI','Pay Related Social Insurance. A contribution that builds your entitlement to social welfare benefits and the State pension.'],
  ['USC','Universal Social Charge. A separate charge on your gross income, on top of income tax. Lower earners pay it at lower rates.'],
  ['Standard rate band','The slice of income taxed at 20%. Income above it is taxed at 40%. Also called the standard rate cut-off point.'],
  ['Tax credit','An amount taken straight off your tax bill. Everyone gets a Personal credit and employees get an Employee (PAYE) credit.'],
  ['Tax relief','A way of reducing the income that is taxed or the tax you pay, e.g. relief on pension contributions or health expenses.'],
  ['Tax Credit Certificate','The document from Revenue showing your credits and rate band for the year. Find it in myAccount at revenue.ie.'],
  ['BIK','Benefit-in-kind. A perk from your employer (company car, health insurance) that is taxed as if it were pay.'],
  ['AVC','Additional Voluntary Contribution. Extra pension payments you choose to make on top of your normal ones.'],
  ['Gross vs net','Gross is before tax and deductions. Net (take-home) is what reaches your bank account.'],
  ['Joint bills','Bills shared by the household. They can be split by income, by agreed percentages or so everyone is left with the same spending money.'],
  ['Disposable income','What is left of your take-home pay after the bills and savings are paid - the money you are free to spend on things like subscriptions, eating out and treats.'],
  ['Sinking fund','Money put aside a little each month for a known future cost, like an NCT, a holiday or Christmas.'],
  ['Emergency fund','Savings for the unexpected, such as a car repair or job loss. 3 to 6 months of bills is the usual target.'],
  ['APR / interest rate','The yearly cost of borrowing. Mortgage and loan figures on these pages use the interest rate on your statement.'],
  ['Fixed rate','A mortgage rate that stays the same for a set period (often 1 to 5 years), then rolls onto a follow-on rate.'],
  ['Break fee','A charge for overpaying beyond your lender\'s allowance, or leaving, during a fixed rate period.'],
  ['LTV','Loan to value: the mortgage as a percentage of the home\'s value.'],
  ['Overpayment','Paying more than the required repayment. It reduces the balance faster and cuts the total interest.'],
  ['MPRN','Meter Point Reference Number. The 11-digit number that identifies your electricity meter.'],
  ['HDF','Harmonised Downloadable File. Your half-hourly smart-meter usage from ESB Networks.'],
  ['Day / Night / Peak','Time-of-use electricity rates. Night is cheapest, peak (early evening) is dearest.'],
  ['Standing charge','A fixed daily or yearly fee for being connected, charged whether or not you use electricity.'],
  ['LPT','Local Property Tax. A yearly tax on residential property, paid to Revenue.'],
  ['Remote working relief','Tax relief on 30% of the vouched cost of electricity, heating and broadband used while working from home.'],
  ['Health expenses relief','20% tax relief on qualifying medical, dental and similar costs not reimbursed by insurance.'],
  ['Rent Tax Credit','A credit for people who pay rent for their main home and are not receiving other housing supports.'],
  ['Home Carer credit','A credit for a married couple or civil partners where one cares for dependants at home and has low income.'],
  ['TRS','Tax Relief at Source. Health insurance premiums are quoted net of tax relief already given.'],
  ['DIRT','Deposit Interest Retention Tax. Tax taken from interest on savings accounts.'],
  ['Net worth','Everything you own minus everything you owe.']
];

/* Not a tab stop: the icon sits before its input, so a focusable "?" made Tab land on help instead of the
   next field. Hover or tap still shows it, and screen readers read the text from aria-label. */
const ttHtml = t => `<span class="tt" tabindex="-1" role="img" aria-label="Help: ${esc(t)}" data-tip="${esc(t)}">?</span>`;
const normKey = s => String(s||'').replace(/\s+/g,' ').trim().toLowerCase();

/* Attach "?" help to every label, column heading and figure we have wording for. Runs after each
   render, so pages never have to remember to ask for it. */
function addTooltips(root){
  $$('label.f > span, th, .kpi .lbl, .hc .t', root).forEach(n=>{
    if(n.querySelector('.tt') || n.dataset.nott!==undefined) return;
    const clean = s => normKey(s).replace(/\s*[↑↓]$/,'');
    const key = clean(n.firstChild && n.firstChild.nodeType===3 ? n.firstChild.textContent : n.textContent);
    const tip = LABEL_TIPS[key] || LABEL_TIPS[clean(n.textContent)];
    if(tip) n.insertAdjacentHTML('beforeend', ttHtml(tip));
  });
}

let tipEl = null, tipFor = null;
function showTip(t){
  if(!tipEl) tipEl = $('#tipbox');
  tipFor = t;
  tipEl.textContent = t.dataset.tip;
  tipEl.classList.add('on');
  const r = t.getBoundingClientRect(), w = tipEl.offsetWidth, h = tipEl.offsetHeight;
  let x = r.left + r.width/2 - w/2;
  x = Math.max(8, Math.min(x, window.innerWidth - w - 8));
  let y = r.top - h - 10;
  if(y < 8) y = r.bottom + 10;
  tipEl.style.left = x+'px'; tipEl.style.top = y+'px';
  t.classList.add('open');
}
function hideTip(){
  if(tipEl) tipEl.classList.remove('on');
  if(tipFor) tipFor.classList.remove('open');
  tipFor = null;
}
function wireTooltips(){
  document.addEventListener('mouseover', e=>{ const t = e.target.closest && e.target.closest('.tt'); if(t) showTip(t); });
  document.addEventListener('mouseout', e=>{ const t = e.target.closest && e.target.closest('.tt'); if(t) hideTip(); });
  document.addEventListener('focusin', e=>{ const t = e.target.closest && e.target.closest('.tt'); if(t) showTip(t); });
  document.addEventListener('focusout', e=>{ if(e.target.closest && e.target.closest('.tt')) hideTip(); });
  /* capture phase: a "?" sitting inside a sortable column heading must not also sort it */
  document.addEventListener('click', e=>{
    const t = e.target.closest && e.target.closest('.tt');
    if(!t) { hideTip(); return; }
    e.stopPropagation(); e.preventDefault();
    if(tipFor===t && $('#tipbox').classList.contains('on') && t.dataset.sticky){ t.dataset.sticky=''; hideTip(); }
    else { showTip(t); t.dataset.sticky='1'; }
  }, true);
  document.addEventListener('keydown', e=>{ if(e.key==='Escape'){ hideTip(); closeDrawer(); closeModal(); endTour(); closeSide(); } });
  window.addEventListener('scroll', hideTip, {passive:true});
}

/* ---- the amber "we need this" highlight ----
   Each entry is a path pattern for a field the maths cannot do without. A field only lights up
   while it is empty or zero, so the highlight disappears as soon as the box is filled in. */
const NEEDS = [
  /^people\.\d+\.gross$/,
  /^bills\.\d+\.amount$/,
  /^loans\.\d+\.(opening|rate|repayment)$/,
  /^mortgages\.\d+\.principal$/,
  /^renewals\.items\.\d+\.end$/,
  /^energy\.offers\.\d+\.(day|night)$/
];
function markNeeds(root){
  const lit = new Set();      // a field can match both rules; count it once
  const empty = inp => inp.type==='date' ? !inp.value : !num(inp.value);
  $$('[data-path]', root).forEach(inp=>{
    const need = NEEDS.some(re=>re.test(inp.dataset.path)) && empty(inp);
    inp.classList.toggle('need', need);
    if(need) lit.add(inp);
  });
  $$('[data-need]', root).forEach(inp=>{
    const need = empty(inp);
    inp.classList.toggle('need', need);
    if(need) lit.add(inp);
  });
  const n = lit.size;
  const old = $('#needbar', root); if(old) old.remove();
  const head = $('.pagehead', root);
  if(n && head){
    head.insertAdjacentHTML('afterend', `<div class="callout warn" id="needbar"><div class="ci">👉</div>
      <div class="cb"><b class="ct">${n} box${n===1?'':'es'} on this page need${n===1?'s':''} your input</b>
      Boxes with an amber outline are the ones the figures are waiting on. They turn normal as soon as you fill them in.</div></div>`);
  }
  return n;
}

function pageHead(id){
  const p = PAGES[id]; if(!p) return '';
  const steps = p.steps ? `<div class="stepstrip">${p.steps.map((s,i)=>`<span class="st"><i>${i+1}</i>${esc(s)}</span>`).join('')}</div>` : '';
  const tips = p.tips ? `<details class="howto"><summary>💡 How this page works</summary>
    <div class="box"><ul>${p.tips.map(t=>`<li>${t}</li>`).join('')}</ul></div></details>` : '';
  return `<div class="pagehead"><h1><span class="ico" aria-hidden="true">${p.ico}</span>${esc(p.title)}</h1>
    <p class="lead">${p.lead}</p>${steps}${tips}</div>`;
}

/* ---------- small building blocks the pages share ---------- */
const callout = (kind, icon, title, body, extra) => `<div class="callout ${kind}"><div class="ci">${icon}</div>
  <div class="cb">${title?`<b class="ct">${title}</b>`:''}${body||''}${extra||''}</div></div>`;
const cardHead = (title, sub, actions) => `<div class="card-h"><h2>${title}</h2>
  ${actions?`<div class="actions">${actions}</div>`:''}${sub?`<div class="sub">${sub}</div>`:''}</div>`;
const emptyState = (icon, title, text, btns) => `<div class="emptystate"><div class="big">${icon}</div>
  <h3>${title}</h3><p>${text}</p>${btns||''}</div>`;

/* ---------- help drawer ---------- */
function openDrawer(){
  const p = PAGES[active] || {};
  $('#drawer').innerHTML = `<header><h2>Help</h2><button class="btn sm" id="closeDrawer" aria-label="Close help">Close</button></header>
    <div class="dbody">
      <div class="callout tipc"><div class="ci">👋</div><div class="cb"><b class="ct">New here?</b>
        Take the 30-second tour of how it is laid out.<br>
        <button class="btn sm" id="tourBtn">Start the tour</button>
        <button class="btn sm" id="setupBtn">Open the set-up guide</button></div></div>
      ${p.tips?`<h3 style="margin:14px 0 6px">On this page: ${esc(p.title)}</h3><ul style="margin:0;padding-left:20px">${p.tips.map(t=>`<li style="margin:6px 0">${t}</li>`).join('')}</ul>`:''}
      <h3 style="margin:18px 0 8px">Glossary</h3>
      <input id="glSearch" type="search" placeholder="Search: PRSI, USC, credit, fixed rate...">
      <div id="glList"></div>
      <div class="note" style="margin-top:16px">This app gives estimates to help you plan. It is not tax advice - check anything important against <b>revenue.ie</b>. All your data stays in this browser.</div>
    </div>`;
  const fill = q=>{
    q = normKey(q);
    $('#glList').innerHTML = TERMS.filter(([t,d])=> !q || normKey(t+' '+d).includes(q))
      .map(([t,d])=>`<div class="gl"><b>${esc(t)}</b><span>${esc(d)}</span></div>`).join('') || '<div class="empty">Nothing matches that.</div>';
  };
  fill('');
  $('#glSearch').oninput = e=> fill(e.target.value);
  $('#closeDrawer').onclick = closeDrawer;
  $('#tourBtn').onclick = ()=>{ closeDrawer(); startTour(); };
  $('#setupBtn').onclick = ()=>{ closeDrawer(); go('setup'); };
  $('#drawer').classList.add('on'); $('#scrim').classList.add('on');
}
function closeDrawer(){ $('#drawer').classList.remove('on'); if(!$('#modal').classList.contains('on')) $('#scrim').classList.remove('on'); }

/* ---------- welcome + tour ---------- */
function closeModal(){ $('#modal').classList.remove('on'); if(!$('#drawer').classList.contains('on')) $('#scrim').classList.remove('on'); }
function showWelcome(){
  const m = $('#modal');
  m.innerHTML = `<h2>${$('.brand .mark').outerHTML}Welcome to Penny Keeper</h2>
    <p class="mut" style="color:var(--muted)">Penny Keeper helps an Irish household understand its money: take-home pay, bills, savings, loans, your mortgage and tax credits.
    It runs entirely in your browser - <b>nothing is sent anywhere</b>.</p>
    <div class="opts">
      <button class="opt" data-w="setup"><span class="oi">🧭</span><span><b>Set me up step by step</b><small>Five short steps. Takes about five minutes.</small></span></button>
      <button class="opt" data-w="demo"><span class="oi">🎬</span><span><b>Show me an example household</b><small>Fills in made-up data so you can see how it all works.</small></span></button>
      <button class="opt" data-w="tour"><span class="oi">🗺️</span><span><b>Give me a quick tour</b><small>30 seconds, then explore on your own.</small></span></button>
      <button class="opt" data-w="restore"><span class="oi">📂</span><span><b>I already have a backup</b><small>Restore a backup file you saved earlier.</small></span></button>
    </div>
    <div style="margin-top:14px;text-align:right"><button class="btn ghost" data-w="skip">Skip for now</button></div>`;
  m.classList.add('on'); $('#scrim').classList.add('on');
  $$('[data-w]', m).forEach(b=> b.onclick = ()=>{
    const w = b.dataset.w;
    DB.ui.welcomed = true; save(true);
    closeModal();
    if(w==='setup') go('setup');
    else if(w==='demo') loadDemoData(true);
    else if(w==='tour') startTour();
    else if(w==='restore') go('data');
  });
}

let tourI = 0, tourSteps = [];
function startTour(){
  const small = window.innerWidth <= 900;
  tourSteps = [
    {sel: (small || DB.ui.navCollapsed) ? '#burger' : '#side', title:'The menu', text:'Everything lives here, grouped by what you want to do. 🏠 Home shows the big picture; 🧭 Set-up guide walks you through getting started.'},
    {sel:'#yearSel', title:'Tax year', text:'Each tax year has its own figures. Use "+ Year" to roll your bills and savings into a new year, or Backup & settings to make a what-if copy.'},
    {sel:'#burger', title:'Menu button', text:'On a big screen this folds the menu away to give the page the full width. On a phone it slides the menu open.'},
    {sel:'#helpBtn', title:'Help is always here', text:'The glossary explains PAYE, PRSI, USC and more in plain English. Look for the small ? icons next to labels too.'},
    {sel:'#pages .pagehead', title:'Every page explains itself', text:'Each page starts with what it is for, the steps to follow, and "How this page works". Amber boxes are the ones that need your input.'}
  ];
  tourI = 0; showTourStep();
}
function showTourStep(){
  const s = tourSteps[tourI], tgt = $(s.sel), spot = $('#spot'), card = $('#tourcard');
  if(!tgt){ endTour(); return; }
  tgt.scrollIntoView({block:'center'});
  const r = tgt.getBoundingClientRect(), pad = 6;
  Object.assign(spot.style, {display:'block', left:(r.left-pad)+'px', top:(r.top-pad)+'px', width:(r.width+pad*2)+'px', height:(r.height+pad*2)+'px'});
  card.innerHTML = `<h3>${esc(s.title)}</h3><div style="color:var(--muted);font-size:14px">${esc(s.text)}</div>
    <div class="tf"><span class="mut" style="color:var(--muted);font-size:12px">${tourI+1} of ${tourSteps.length}</span><span class="spacer"></span>
    <button class="btn sm ghost" id="tourSkip">Skip</button>
    ${tourI?'<button class="btn sm" id="tourBack">Back</button>':''}
    <button class="btn sm primary" id="tourNext">${tourI===tourSteps.length-1?'Done':'Next'}</button></div>`;
  card.style.display = 'block';
  const cw = card.offsetWidth, ch = card.offsetHeight;
  let x = Math.max(12, Math.min(r.left, window.innerWidth-cw-12));
  let y = r.bottom + 16; if(y+ch > window.innerHeight-12) y = Math.max(12, r.top - ch - 16);
  if(r.height > window.innerHeight*0.5){            // a tall target such as the menu: sit beside it, not on it
    x = Math.min(r.right + 18, window.innerWidth - cw - 12);
    y = Math.max(12, Math.min(r.top + 60, window.innerHeight - ch - 12));
  }
  card.style.left = x+'px'; card.style.top = y+'px';
  $('#tourSkip').onclick = endTour;
  if($('#tourBack')) $('#tourBack').onclick = ()=>{ tourI--; showTourStep(); };
  $('#tourNext').onclick = ()=>{ if(tourI>=tourSteps.length-1) endTour(); else { tourI++; showTourStep(); } };
}
function endTour(){ $('#spot').style.display='none'; $('#tourcard').style.display='none'; }

