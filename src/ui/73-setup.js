/* ---------------- set-up guide ---------------- */
const COMMON_BILLS = [
  ['Rent','Monthly'],['Mortgage repayment','Monthly'],['Electricity','Monthly'],['Gas / heating oil','Monthly'],
  ['Broadband','Monthly'],['Mobile phone','Monthly'],['TV licence','Annual'],['Home insurance','Annual'],
  ['Car insurance','Annual'],['Motor tax','Annual'],['NCT','Annual'],['Health insurance','Monthly'],
  ['Life / mortgage protection','Monthly'],['Groceries','Weekly'],['Fuel / transport','Weekly'],['Childcare','Monthly'],
  ['Bin collection','Quarterly'],['Local Property Tax','Annual'],['Streaming & subscriptions','Monthly'],['Gym','Monthly'],
  ['Eating out','Monthly'],['Clothing','Monthly'],['Gifts & Christmas','Annual'],['School costs','Annual'],['Pet costs','Monthly']
];
const COMMON_SAVINGS = [
  ['Emergency fund','Monthly'],['Holiday','Monthly'],['Christmas','Monthly'],['Pension top-up (AVC)','Monthly'],
  ['Car / NCT fund','Monthly'],['House deposit','Monthly'],['Children\'s savings','Monthly'],['Investments','Monthly'],['Rainy day','Monthly']
];
function addBillFromTemplate(name, freq, kind){
  if(Y.bills.some(b=> kindOf(b)===kind && b.name.toLowerCase()===name.toLowerCase())) return false;
  Y.bills.push({id:uid(), name, freq, holder:'Joint', amount:0, nextDue:'', kind});
  return true;
}

function renderSetup(el){
  const sp = setupProgress();
  /* the open step is sticky: it is chosen once on arrival and then only changes when you press
     Continue or open another, so finishing a step never collapses it while you are still using it */
  if(!DB.ui.setupOpen) DB.ui.setupOpen = sp.next ? sp.next.id : 'backup';
  const open = DB.ui.setupOpen;
  const nextOf = id => { const i = sp.steps.findIndex(x=>x.id===id); return sp.steps[i+1] ? sp.steps[i+1].id : null; };
  const pctDone = Math.round(sp.done/sp.total*100);
  const H = household();

  /* step bodies */
  const bodyYou = `
    <p class="note" style="margin-top:12px">Add everyone whose income goes into the household. You can add a partner now or later.</p>
    ${Y.people.map((p,i)=>`<div class="row" style="align-items:flex-end;border-bottom:1px solid var(--line);padding:6px 0 4px">
      <label class="f" style="flex:1;min-width:150px"><span>Name</span><input data-path="people.${i}.name" value="${esc(p.name)}" placeholder="e.g. Aoife"></label>
      <label class="f" style="flex:1;min-width:170px"><span>Yearly salary (before tax)</span><input class="num" data-path="people.${i}.gross" data-type="number" inputmode="decimal" value="${num(p.gross)||''}" placeholder="e.g. 55000">
        ${num(p.gross)>0 && num(p.gross)<7000?'<div class="hint"><b class="amb">Looks like a monthly figure - enter the yearly amount.</b></div>':''}</label>
      <label class="f" style="flex:1.3;min-width:210px"><span>Rate band for your situation</span>
        <select data-status="${i}">${Object.entries(BAND_STATUS).map(([k,v])=>`<option value="${k}" ${(p.status||'single')===k?'selected':''}>${esc(v.label)}</option>`).join('')}</select></label>
      <div class="kpi" style="min-width:150px;margin-bottom:12px"><div class="lbl" data-nott>Take-home / month</div>
        <div class="val pos" style="font-size:20px">${fmt0(calcTax(p,Y.taxBands).netMonthly)}</div></div>
      ${Y.people.length>1?`<button class="btn sm danger" data-del-person="${i}" style="margin-bottom:12px">Remove</button>`:''}
    </div>`).join('')}
    <div class="row" style="margin-top:12px">
      <button class="btn" id="addPerson">+ Add another earner</button>
      <button class="btn ghost" data-go="tax">Pension, bonus and other details &rarr;</button>
    </div>`;

  const billsNow = Y.bills.filter(b=>kindOf(b)==='bill');
  const bodyBills = `
    <p class="note" style="margin-top:12px">Tap the ones that apply to you. They are added with a €0 amount - then type in what each one costs.</p>
    <div class="chips" style="margin:10px 0">${COMMON_BILLS.map(([n,f])=>{
      const has = billsNow.some(b=>b.name.toLowerCase()===n.toLowerCase());
      return `<button class="chip ${has?'on':''}" data-addbill="${esc(n)}|${f}|bill">${has?'✓ ':'+ '}${esc(n)}</button>`; }).join('')}</div>
    ${billsNow.length?`<div class="tw"><table><thead><tr><th>Bill</th><th class="n">Amount</th><th>How often</th><th></th></tr></thead><tbody>
      ${billsNow.map(b=>{ const i = Y.bills.indexOf(b); return `<tr>
        <td><input data-path="bills.${i}.name" value="${esc(b.name)}"></td>
        <td class="n"><input class="num" style="text-align:right" data-path="bills.${i}.amount" data-type="number" inputmode="decimal" value="${num(b.amount)||''}" placeholder="0.00" data-need></td>
        <td><select data-path="bills.${i}.freq">${Object.keys(FREQ).map(f=>`<option ${f===b.freq?'selected':''}>${f}</option>`).join('')}</select></td>
        <td class="act"><button class="btn sm danger" data-del-bill="${esc(b.id)}" aria-label="Remove">x</button></td></tr>`; }).join('')}
    </tbody></table></div>`:''}
    <div class="row" style="margin-top:12px"><button class="btn" id="addBlankBill">+ Add something else</button>
      <button class="btn ghost" data-go="budget">Open the full Bills page &rarr;</button></div>`;

  const savNow = Y.bills.filter(b=>kindOf(b)==='savings');
  const bodySave = `
    <p class="note" style="margin-top:12px">Money you put aside rather than spend. Pick any that apply, then enter how much goes in each month.</p>
    <div class="chips" style="margin:10px 0">${COMMON_SAVINGS.map(([n,f])=>{
      const has = savNow.some(b=>b.name.toLowerCase()===n.toLowerCase());
      return `<button class="chip ${has?'on':''}" data-addbill="${esc(n)}|${f}|savings">${has?'✓ ':'+ '}${esc(n)}</button>`; }).join('')}</div>
    ${savNow.length?`<div class="tw"><table><thead><tr><th>Savings</th><th class="n">Amount</th><th>How often</th><th></th></tr></thead><tbody>
      ${savNow.map(b=>{ const i = Y.bills.indexOf(b); return `<tr>
        <td><input data-path="bills.${i}.name" value="${esc(b.name)}"></td>
        <td class="n"><input class="num" style="text-align:right" data-path="bills.${i}.amount" data-type="number" inputmode="decimal" value="${num(b.amount)||''}" placeholder="0.00" data-need></td>
        <td><select data-path="bills.${i}.freq">${Object.keys(FREQ).map(f=>`<option ${f===b.freq?'selected':''}>${f}</option>`).join('')}</select></td>
        <td class="act"><button class="btn sm danger" data-del-bill="${esc(b.id)}" aria-label="Remove">x</button></td></tr>`; }).join('')}
    </tbody></table></div>`:''}
    <div class="row" style="margin-top:12px"><button class="btn ghost" data-go="savings">Set goals and an emergency fund &rarr;</button></div>`;

  const bodyCredits = `
    <p style="margin-top:12px">Many people miss out on credits like the <b>Rent Tax Credit</b>, <b>Home Carer credit</b> or <b>health expenses relief</b>.
    The Credits & reliefs page lists the Irish ones, lets you tick what applies and estimates what you could claim back.</p>
    <div class="row"><button class="btn primary" data-go="reliefs">Open Credits & reliefs</button>
      <button class="btn" id="markCredits">${DB.ui.done&&DB.ui.done.credits?'✓ Marked as checked':'I have checked - mark as done'}</button></div>`;

  const bodyBackup = `
    <p style="margin-top:12px">Your information is stored <b>only in this browser</b> - nothing is sent online. That keeps it private, but it means clearing your browser data would erase it.
    A backup is a small file you keep somewhere safe (email it to yourself, or save it to cloud storage).</p>
    <div class="row"><button class="btn primary" id="setupBackup">Download my backup</button>
      <button class="btn ghost" data-go="data">More options &rarr;</button></div>
    ${DB.lastBackup?`<div class="note">Last backup: ${esc(DB.lastBackup.slice(0,10))}</div>`:''}`;

  const bodies = {you:bodyYou, bills:bodyBills, save:bodySave, credits:bodyCredits, backup:bodyBackup};

  const extras = [
    ['bank','🏦','Import a bank statement','See where the money really goes', Y.txns.length>0],
    ['loans','💳','Add a loan','See the interest you could save', Y.loans.length>0],
    ['mortgage','🏡','Add your mortgage','Rates, overpayments, balance', (Y.mortgages||[]).length>0],
    ['renewals','🔔','Track contract renewals','Broadband, insurance, energy', Y.renewals.items.length>0],
    ['energy','⚡','Compare electricity tariffs','Upload your smart-meter file', !!(Y.energy.summary)],
    ['networth','📊','Work out your net worth','Own minus owe', (DB.netWorth.snaps||[]).length>0 || (DB.netWorth.assets||[]).length>0],
    ['tracker','🏗️','Track a big project','Renovation, wedding or build', trackerHasData()]
  ];

  el.innerHTML = `
  <div class="card">
    <div class="progress">
      <div class="ring" style="--p:${pctDone}"><span>${pctDone}%</span></div>
      <div><h2 style="margin:0">${sp.done===sp.total?'You are all set up 🎉':'Getting started'}</h2>
        <div class="note" style="margin:4px 0 0">${sp.done} of ${sp.total} steps complete. ${sp.done===sp.total?'Everything else is optional - explore from the menu.':'Take them in order, or open any step.'}</div></div>
    </div>
    ${DB.ui.hideSetup
      ? `<div class="row" style="margin-top:12px;align-items:center"><button class="btn" id="showSetup">Show the set-up guide in the menu again</button><span class="hint" style="margin:0">It is hidden from the menu at the moment.</span></div>`
      : sp.done===sp.total
        ? `<div class="row" style="margin-top:12px;align-items:center"><button class="btn" id="hideSetup">Hide the set-up guide</button><span class="hint" style="margin:0">Takes it out of the menu. You can bring it back any time in Backup &amp; settings.</span></div>` : ''}
  </div>
  ${sp.steps.map(s=>`<div class="step ${s.ok?'done':''} ${(sp.next&&sp.next.id===s.id)?'cur':''} ${open===s.id?'open':''}" data-step="${s.id}">
    <header data-toggle="${s.id}" tabindex="0" role="button" aria-expanded="${open===s.id}">
      <div class="snum">${s.ok?'✓':s.n}</div>
      <h3>${esc(s.title)}<small>${esc(s.sub)}</small></h3>
      <span class="pill ${s.ok?'good':''}">${s.ok?'Done':'To do'}</span>
    </header>
    <div class="body">${bodies[s.id]}${nextOf(s.id)?`<div class="row" style="margin-top:16px;justify-content:flex-end"><button class="btn ${s.ok?'primary':''}" data-next-step="${nextOf(s.id)}">${s.ok?'Continue':'Skip for now'} to step ${s.n+1} &rarr;</button></div>`:''}</div>
  </div>`).join('')}
  <h3 style="margin:24px 0 10px">Optional extras</h3>
  <div class="actions-grid">${extras.map(([id,ico,t,d,ok])=>`<button class="action" data-go="${id}"><span class="ai">${ico}</span>
    <span>${esc(t)} ${ok?'<span class="pill good">added</span>':''}<small>${esc(d)}</small></span></button>`).join('')}</div>`;

  wireFields(el);
  $$('[data-toggle]', el).forEach(h=>{
    const t = ()=>{ DB.ui.setupOpen = (DB.ui.setupOpen===h.dataset.toggle ? '-' : h.dataset.toggle); save(true); render(); };
    h.onclick = t; h.onkeydown = e=>{ if(e.key==='Enter'||e.key===' '){ e.preventDefault(); t(); } };
  });
  $$('[data-status]', el).forEach(s=> s.onchange = ()=> setBandStatus(+s.dataset.status, s.value));
  $$('[data-next-step]', el).forEach(b=> b.onclick = ()=>{ DB.ui.setupOpen = b.dataset.nextStep; save(true); render({reset:true}); window.scrollTo({top:0}); });
  $$('[data-addbill]', el).forEach(b=> b.onclick = ()=>{
    const [n,f,k] = b.dataset.addbill.split('|');
    if(!addBillFromTemplate(n,f,k)){
      const i = Y.bills.findIndex(x=>kindOf(x)===k && x.name.toLowerCase()===n.toLowerCase());
      if(i>=0 && !num(Y.bills[i].amount)) Y.bills.splice(i,1);    // un-tap a chip that has no amount yet
      else { toast('Already on your list'); return; }
    }
    save(); render();
  });
  $$('[data-del-bill]', el).forEach(b=> b.onclick = ()=>{
    const i = Y.bills.findIndex(x=>x.id===b.dataset.delBill); if(i>=0){ Y.bills.splice(i,1); save(); render(); } });
  $$('[data-del-person]', el).forEach(b=> b.onclick = ()=>{ Y.people.splice(+b.dataset.delPerson,1); save(); render(); });
  $('#addPerson').onclick = addPerson;
  if($('#addBlankBill')) $('#addBlankBill').onclick = ()=>{ Y.bills.push({id:uid(), name:'New bill', freq:'Monthly', holder:'Joint', amount:0, nextDue:'', kind:'bill'}); save(); render(); };
  if($('#markCredits')) $('#markCredits').onclick = ()=>{ DB.ui.done = DB.ui.done||{}; DB.ui.done.credits = !DB.ui.done.credits; save(true); render(); };
  if($('#setupBackup')) $('#setupBackup').onclick = ()=>{ backupAll(); render(); };
  if($('#hideSetup')) $('#hideSetup').onclick = ()=>{ DB.ui.hideSetup = true; save(true); go('dashboard'); toast('Set-up guide hidden - bring it back in Backup & settings'); };
  if($('#showSetup')) $('#showSetup').onclick = ()=>{ DB.ui.hideSetup = false; save(true); render(); toast('The set-up guide is back in the menu'); };
}

function addPerson(){
  const p = presetFor(Y.year);
  Y.people.push({id:uid(), name:'Person '+(Y.people.length+1), gross:0, pensionPct:0, avcMode:'amount', avcMonthly:0, avcPct:0,
    bikMonthly:0, srcop:p.srcopSingle, status:'single', personalType:'single', bonus:0,
    credits:[{name:'Personal Tax Credit',amount:p.personalCredit},{name:'Employee Tax Credit',amount:p.employeeCredit}]});
  save(); render();
}
/* choosing a situation sets the rate band, the personal credit that goes with it, and for a single parent
   the Single Person Child Carer Credit that the higher band depends on */
function setBandStatus(i, key){
  const p = Y.people[i]; if(!p) return;
  p.status = key;
  const def = BAND_STATUS[key];
  if(def && def.pick) p.srcop = def.pick(Y.taxBands);
  if(key !== 'custom') setPersonalType(p, defaultPersonalType(key));
  if(key==='parent' && !(p.credits||[]).some(c=>/single person child/i.test(c.name)))
    p.credits.push({name:'Single Person Child Carer Credit', amount:creditAmount('spccc', Y.year)});
  save(); render();
}

