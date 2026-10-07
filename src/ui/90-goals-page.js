function goalsHtml(){
  const E = Y.emergency, H = household();
  const target = E.months * H.bills;
  const saved = num(E.saved) || savingsTotal();
  const prog = target>0 ? clamp(saved/target*100,0,100) : 0;
  const cover = H.bills>0 ? saved/H.bills : 0;
  const goals = Y.goals.map((g,i)=>{ const f = goalFigures(g); return `<div class="card" style="margin-bottom:12px;box-shadow:none;background:var(--surface2);border-color:transparent">
    <div class="row" style="align-items:flex-end">
      <label class="f" style="flex:2;min-width:160px;margin:0"><span>Goal</span><input data-path="goals.${i}.name" value="${esc(g.name)}"></label>
      <label class="f" style="flex:1;min-width:110px;margin:0"><span>Target amount</span><input class="num" data-path="goals.${i}.target" data-type="number" value="${num(g.target)||''}" data-need></label>
      <label class="f" style="flex:1;min-width:110px;margin:0"><span>Saved so far</span><input class="num" data-path="goals.${i}.saved" data-type="number" value="${num(g.saved)||''}"></label>
      <label class="f" style="flex:1;min-width:140px;margin:0"><span>Needed by</span><input type="date" data-path="goals.${i}.due" value="${esc(g.due||'')}"></label>
      <button class="btn sm danger" data-del-goal="${i}" aria-label="Delete goal">x</button>
    </div>
    <div class="meter ${f.prog>=100?'good':''}" style="margin:14px 0 6px"><i style="width:${f.prog}%"></i></div>
    <div class="row" style="align-items:center">
      <span class="note" style="margin:0">${f.target>0?`<b>${fmt0(f.saved)}</b> of ${fmt0(f.target)} (${f.prog.toFixed(0)}%)`:'Enter a target amount.'}
        ${f.prog>=100?' - 🎉 goal reached!':f.monthly>0?` - save <b>${fmt0(Math.ceil(f.monthly))} a month</b> for ${f.months} month${f.months===1?'':'s'}`:f.late?' - the date has passed':f.remaining>0&&!f.due?' - add a date to see the monthly amount':''}</span>
      <span class="spacer"></span>
      ${f.monthly>0?`<button class="btn sm" data-goal-budget="${i}">Add to my budget</button>`:''}
    </div></div>`; }).join('');
  return `<div class="card">
    ${cardHead('Emergency fund','Savings for the unexpected - a car repair, a boiler, a gap between jobs.')}
    <div class="grid g3">
      <label class="f"><span>Months of bills to cover</span>
        <select data-path="emergency.months" data-type="number">${[1,3,6,9,12].map(m=>`<option value="${m}" ${E.months===m?'selected':''}>${m} month${m===1?'':'s'}${m===3?' (minimum)':m===6?' (recommended)':''}</option>`).join('')}</select></label>
      <label class="f"><span>Saved for emergencies so far ${ttHtml('Leave this at 0 and we use the total of your savings accounts instead.')}</span>
        <input class="num" data-path="emergency.saved" data-type="number" value="${num(E.saved)||''}" placeholder="${fmt0(savingsTotal())} (all savings)"></label>
      <div class="kpi" style="align-self:start"><div class="lbl" data-nott>Target</div><div class="val">${fmt0(target)}</div><div class="sub">${E.months} × ${fmt0(H.bills)} of bills</div></div>
    </div>
    ${H.bills>0 ? `<div class="meter ${prog>=100?'good':prog>=50?'':'warn'}" style="margin:2px 0 6px"><i style="width:${prog}%"></i></div>
      <div class="note" style="margin:0">${fmt0(saved)} saved covers <b>${cover.toFixed(1)} months</b> of bills ${prog>=100?' - fully funded 🎉':''}</div>`
      : '<div class="note">Add your bills on the Bills page and the target is worked out for you.</div>'}
  </div>
  <div class="card">
    ${cardHead('Savings goals','A holiday, a new car, a wedding, a deposit. Set a target and a date and we work out the monthly amount.',
      '<button class="btn primary" id="addGoal">+ Add a goal</button>')}
    ${goals || emptyState('🎯','No goals yet','Goals turn "I should save" into a number you can act on.',
       `<div class="chips" style="justify-content:center">${['Holiday','New car','Christmas','House deposit','Wedding','Home improvements'].map(n=>`<button class="chip" data-goal-idea="${esc(n)}">+ ${esc(n)}</button>`).join('')}</div>`)}
  </div>`;
}
function renderSavingsPage(el){
  renderSavings(el);
  const box = document.createElement('div');
  box.id = 'goalsBox';
  box.innerHTML = goalsHtml();
  el.insertBefore(box, el.firstChild);
  wireFields(box);
  const add = n=>{ Y.goals.push({id:uid(), name:n||'New goal', target:0, saved:0, due:''}); save(); render(); };
  $('#addGoal', box).onclick = ()=> add();
  $$('[data-goal-idea]', box).forEach(b=> b.onclick = ()=> add(b.dataset.goalIdea));
  $$('[data-del-goal]', box).forEach(b=> b.onclick = ()=>{ Y.goals.splice(+b.dataset.delGoal,1); save(); render(); });
  $$('[data-goal-budget]', box).forEach(b=> b.onclick = ()=>{
    const g = Y.goals[+b.dataset.goalBudget], f = goalFigures(g);
    const name = 'Goal: '+g.name;
    let bill = Y.bills.find(x=>x.name===name && kindOf(x)==='savings');
    if(!bill){ bill = {id:uid(), name, freq:'Monthly', holder:'Joint', amount:0, nextDue:'', kind:'savings'}; Y.bills.push(bill); }
    bill.amount = Math.ceil(f.monthly);
    save(); render(); toast('Added to your budget as '+fmt0(bill.amount)+' a month');
  });
}

