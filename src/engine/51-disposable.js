/* ---------- disposable income ----------
   What is left once the bills and savings are paid is the household's disposable income. This tracker is for
   spending it: the subscriptions that come out every month, and the one-off things (a meal out, a takeaway, a
   round of drinks) that are easy to lose track of.

   It is deliberately separate from Bills & budget. Keep the essentials there and the optional extras here - a
   line entered in both places would be counted twice. Each person's spare money is worked out the same way the
   joint-bill split does it (their pay, less their own bills, their share of the joint bills and their savings),
   and anything marked Joint here is shared out in the same proportions as the joint bills. */
const DISPOSABLE_CATS = [
  ['Eating out','🍽️'], ['Takeaways','🥡'], ['Coffee & snacks','☕'], ['Drinks & nights out','🍻'],
  ['Entertainment','🎬'], ['Shopping & clothes','🛍️'], ['Hobbies & sport','🎯'], ['Gifts','🎁'],
  ['Days out & trips','🚗'], ['Personal care','💇'], ['Other','✨']
];
const SUBSCRIPTION_IDEAS = [
  ['Netflix','Monthly'], ['Disney+','Monthly'], ['Amazon Prime','Annual'], ['Spotify','Monthly'], ['Apple TV+','Monthly'],
  ['YouTube Premium','Monthly'], ['Sky / Now','Monthly'], ['Claude Pro','Monthly'], ['ChatGPT','Monthly'], ['iCloud / Google One','Monthly'],
  ['Gym membership','Monthly'], ['Game subscription','Monthly'], ['Magazine / newspaper','Monthly'], ['Audible','Monthly']
];
const blankDisposable = () => ({items:[], entries:[]});
const dispCatIcon = name => (DISPOSABLE_CATS.find(c=>c[0]===name) || ['','✨'])[1];
/* what a regular subscription costs per month, whatever it is charged by */
const dispMonthly = it => num(it.amount) * (FREQ[it.freq]||12) / 12;
const dispEntryMonth = e => { const d = parseDate(e.date); return d ? monthKey(d) : ''; };
function dispMonthLabel(key){
  const [yr, mo] = String(key).split('-').map(Number);
  return new Date(yr, (mo||1)-1, 1).toLocaleDateString('en-IE', {month:'long', year:'numeric'});
}
/* months to pick from, newest first: every month with something logged, plus this one */
function dispMonths(){
  const set = new Set(((Y.disposable||{}).entries||[]).map(dispEntryMonth).filter(Boolean));
  set.add(monthKey(new Date()));
  return Array.from(set).sort().reverse();
}
/* this month, unless it is empty and an earlier month is not - then the latest month that has something */
function dispDefaultMonth(){
  const now = monthKey(new Date());
  const used = dispMonths().filter(k=> ((Y.disposable||{}).entries||[]).some(e=>dispEntryMonth(e)===k));
  return (!used.length || used.includes(now)) ? now : used[0];
}

/* Everything the page shows for one month (key is 'YYYY-MM').
   Per person: spare money (after their bills and savings), what their subscriptions and spending come to
   (their own plus their share of anything marked Joint), and what is left. The household line adds
   everything up, including anything assigned to someone no longer in the household. */
function disposableSummary(key){
  const H = household(), js = jointShares().shares, sp = savingsSplit(), bt = H.bt;
  const jointBills = bt.joint/12;
  const D = Y.disposable || blankDisposable();
  const entries = (D.entries||[]).filter(e=> dispEntryMonth(e)===key);
  const sum = (list, f) => list.reduce((s,x)=> s+f(x), 0);
  const amt = e => num(e.amount);
  const of = (list, name, f) => sum(list.filter(x=>x.who===name), f);

  const rows = H.people.map((x,i)=>{
    const name = x.p.name;
    const spare = x.t.netMonthly - (bt.byHolder[name]||0)/12 - jointBills*js[i] - (sp.rows[i] ? sp.rows[i].total : 0);
    const subsOwn = of(D.items, name, dispMonthly), subsShared = of(D.items, 'Joint', dispMonthly)*js[i];
    const spentOwn = of(entries, name, amt), spentShared = of(entries, 'Joint', amt)*js[i];
    const subs = subsOwn + subsShared, spent = spentOwn + spentShared;
    return {id:x.p.id, name, share:js[i], spare, subsOwn, subsShared, subs, spentOwn, spentShared, spent, left: spare - subs - spent};
  });

  const byCat = {};
  entries.forEach(e=>{ const c = byCat[e.category] || (byCat[e.category] = {name:e.category, icon:dispCatIcon(e.category), amount:0, count:0}); c.amount += amt(e); c.count++; });
  const subs = sum(D.items, dispMonthly), spent = sum(entries, amt);
  const known = new Set(['Joint'].concat(Y.people.map(p=>p.name)));
  const stray = sum(D.items.filter(i=>!known.has(i.who)), dispMonthly) + sum(entries.filter(e=>!known.has(e.who)), amt);
  return {
    key, label: dispMonthLabel(key), rows, stray,
    household: {spare: H.left, subs, spent, left: H.left - subs - spent},
    byCategory: Object.values(byCat).sort((a,b)=> b.amount-a.amount),
    entries: entries.slice().sort((a,b)=> a.date<b.date ? 1 : a.date>b.date ? -1 : 0)
  };
}
