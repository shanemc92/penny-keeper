/* ---------- savings projection ---------- */
function projectSavings(){
  const s = Y.savings;
  const start = parseDate(s.startDate) || new Date(Y.year,0,1);
  const months = clamp(num(s.months)||24, 1, 600);
  const g = num(s.growthPct)/100/12;
  const rows=[];
  let bal = s.accounts.map(a=>num(a.opening));
  for(let m=0;m<=months;m++){
    const date = addMonths(start,m);
    if(m>0){
      bal = bal.map((v,i)=>{
        const a = s.accounts[i];
        const adj = (a.adjust&&a.adjust[monthKey(date)])?num(a.adjust[monthKey(date)]):0;
        return round2(v*(1+g) + num(a.monthly) - adj);
      });
    }
    rows.push({date:iso(date), values:bal.slice(), total:round2(bal.reduce((x,y)=>x+y,0))});
  }
  return rows;
}


/* ---------------- savings & goals ---------------- */
function goalFigures(g){
  const target = num(g.target), saved = num(g.saved);
  const remaining = Math.max(target-saved,0);
  const due = parseDate(g.due);
  const today = new Date(); today.setHours(0,0,0,0);
  let months = null;
  if(due){ months = Math.max(Math.round(daysBetween(today, due)/30.4375), 0); if(due>today && months===0) months = 1; }
  const monthly = (months && remaining>0) ? remaining/months : 0;
  const prog = target>0 ? clamp(saved/target*100,0,100) : 0;
  return {target, saved, remaining, due, months, monthly, prog, late: !!(due && due<today && remaining>0)};
}
