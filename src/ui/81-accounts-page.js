/* ---------------- accounts ---------------- */
let showIban = false;
function renderAccounts(el){
  const list = Y.accounts;
  const owners = Array.from(new Set(['Joint', ...Y.people.map(p=>p.name), ...list.map(a=>a.owner).filter(Boolean)]));
  const types = Array.from(new Set(['Current','Savings','Credit Union','Deposit','Investment','Credit Card',
    'Mortgage','Loan','Pension','Other', ...list.map(a=>a.type).filter(Boolean), ...Y.payees.map(a=>a.type).filter(Boolean)]));

  const rows = list.map((a,i)=>{
    const ok = a.iban ? ibanValid(a.iban) : null;
    return `<tr>
      <td><input data-path="accounts.${i}.name" value="${esc(a.name)}" placeholder="Joint current"></td>
      <td><select data-path="accounts.${i}.owner">${owners.map(o=>`<option ${o===a.owner?'selected':''}>${esc(o)}</option>`).join('')}</select></td>
      <td><input data-path="accounts.${i}.bank" value="${esc(a.bank)}" placeholder="AIB"></td>
      <td><select data-path="accounts.${i}.type">${types.map(t=>`<option ${t===a.type?'selected':''}>${t}</option>`).join('')}</select></td>
      <td>${showIban
        ? `<input class="num" data-path="accounts.${i}.iban" value="${esc(ibanPretty(a.iban))}" style="min-width:230px" spellcheck="false">`
        : `<span class="num mut">${esc(ibanMask(a.iban)) || '<span class="mut">not set</span>'}</span>`}</td>
      <td>${a.iban ? (ok
        ? '<span class="pill on">valid</span>'
        : '<span class="pill" style="border-color:var(--bad);color:var(--bad)">check</span>') : ''}</td>
      <td><input data-path="accounts.${i}.notes" value="${esc(a.notes)}" placeholder="Salary goes here"></td>
      <td class="act">
        <button class="btn sm" data-up-acc="${i}" title="Move up" ${i===0?'disabled':''}>&uarr;</button>
        <button class="btn sm" data-down-acc="${i}" title="Move down" ${i===list.length-1?'disabled':''}>&darr;</button>
        <button class="btn sm" data-copy-iban="${i}" title="Copy IBAN">Copy</button>
        <button class="btn sm danger" data-del-acc="${i}">x</button></td>
    </tr>`;
  }).join('');

  const byOwner = {};
  list.forEach(a=>{ const o=a.owner||'Unassigned'; byOwner[o]=(byOwner[o]||0)+1; });

  const payeeRows = Y.payees.map((a,i)=>{
    const ok = a.iban ? ibanValid(a.iban) : null;
    return `<tr>
      <td><input data-path="payees.${i}.name" value="${esc(a.name)}" placeholder="Murphy Plumbing"></td>
      <td><input data-path="payees.${i}.owner" value="${esc(a.owner)}" placeholder="Anyone" list="ownerList"></td>
      <td><input data-path="payees.${i}.bank" value="${esc(a.bank)}" placeholder="BOI"></td>
      <td><select data-path="payees.${i}.type">${types.map(t=>`<option ${t===a.type?'selected':''}>${t}</option>`).join('')}</select></td>
      <td>${showIban
        ? `<input class="num" data-path="payees.${i}.iban" value="${esc(ibanPretty(a.iban))}" style="min-width:230px" spellcheck="false">`
        : `<span class="num mut">${esc(ibanMask(a.iban)) || '<span class="mut">not set</span>'}</span>`}</td>
      <td>${a.iban ? (ok
        ? '<span class="pill on">valid</span>'
        : '<span class="pill" style="border-color:var(--bad);color:var(--bad)">check</span>') : ''}</td>
      <td><input data-path="payees.${i}.notes" value="${esc(a.notes)}" placeholder="Kitchen job"></td>
      <td class="act">
        <button class="btn sm" data-up-payee="${i}" title="Move up" ${i===0?'disabled':''}>&uarr;</button>
        <button class="btn sm" data-down-payee="${i}" title="Move down" ${i===Y.payees.length-1?'disabled':''}>&darr;</button>
        <button class="btn sm" data-copy-payee="${i}" title="Copy IBAN">Copy</button>
        <button class="btn sm danger" data-del-payee="${i}">x</button></td>
    </tr>`;
  }).join('') || '<tr><td colspan="8" class="empty">No payees saved yet.</td></tr>';

  el.innerHTML = `
  <datalist id="ownerList">${owners.map(o=>`<option value="${esc(o)}">`).join('')}</datalist>
  <div class="card">
    <h2>Bank accounts <span class="pill">${list.length}</span></h2>
    <div class="row" style="margin-bottom:10px">
      <button class="btn" id="addAcc">+ Add account</button>
      <button class="btn" id="toggleIban">${showIban?'Hide IBANs':'Show IBANs'}</button>
      <div class="spacer"></div>
      <button class="btn" id="exportAcc">Export CSV</button>
    </div>
    <div class="tw"><table>
      <thead><tr><th>Account</th><th>Owner</th><th>Bank</th><th>Type</th><th>IBAN</th><th></th>
        <th>Notes</th><th></th></tr></thead>
      <tbody>${rows||'<tr><td colspan="8" class="empty">No accounts yet. Add the ones you actually use - it saves digging out a statement every time.</td></tr>'}</tbody>
    </table></div>
    ${list.length?`<div class="grid g4" style="margin-top:14px">
      ${Object.entries(byOwner).map(([o,n])=>`<div class="kpi"><div class="lbl">${esc(o)}</div>
        <div class="val">${n}</div><div class="sub">account${n===1?'':'s'}</div></div>`).join('')}
    </div>`:''}
    <div class="note">IBANs are hidden by default and validated with the standard checksum, so a typo shows up straight away.
      They are stored in this browser and included in JSON and CSV exports - keep those exports somewhere sensible.
      A BIC is on file for anyone who already had one entered - it's in the CSV export, just off this table.</div>
  </div>

  <div class="card">
    <h2>Payees <span class="pill">${Y.payees.length}</span></h2>
    <div class="row" style="margin-bottom:10px">
      <button class="btn" id="addPayee">+ Add payee</button>
      <div class="spacer"></div>
      <button class="btn" id="exportPayees">Export CSV</button>
    </div>
    <div class="tw"><table>
      <thead><tr><th>Payee</th><th>Owner</th><th>Bank</th><th>Type</th><th>IBAN</th><th></th>
        <th>Notes</th><th></th></tr></thead>
      <tbody>${payeeRows}</tbody>
    </table></div>
    <div class="note">Anyone you pay out to - a tradesman, the creche, a family member. The owner field is free text,
      so it can be a person, a company, or whatever you call them.</div>
  </div>`;

  wireFields(el);
  $('#addAcc').onclick = ()=>{
    Y.accounts.push({id:uid(), name:'New account', owner:'Joint', bank:'', type:'Current', iban:'', bic:'', notes:''});
    save(); render();
  };
  $('#toggleIban').onclick = ()=>{ showIban = !showIban; render(); };
  $$('[data-del-acc]',el).forEach(b=> b.onclick=()=>{
    if(confirm('Remove '+(Y.accounts[+b.dataset.delAcc].name||'this account')+'?')){
      Y.accounts.splice(+b.dataset.delAcc,1); save(); render();
    }
  });
  $$('[data-up-acc]',el).forEach(b=> b.onclick=()=>{ if(moveItem(Y.accounts,+b.dataset.upAcc,-1)){ save(); render(); } });
  $$('[data-down-acc]',el).forEach(b=> b.onclick=()=>{ if(moveItem(Y.accounts,+b.dataset.downAcc,1)){ save(); render(); } });
  $('#addPayee').onclick = ()=>{
    Y.payees.push({id:uid(), name:'New payee', owner:'', bank:'', type:'Current', iban:'', bic:'', notes:''});
    save(); render();
  };
  $$('[data-del-payee]',el).forEach(b=> b.onclick=()=>{
    if(confirm('Remove '+(Y.payees[+b.dataset.delPayee].name||'this payee')+'?')){
      Y.payees.splice(+b.dataset.delPayee,1); save(); render();
    }
  });
  $$('[data-up-payee]',el).forEach(b=> b.onclick=()=>{ if(moveItem(Y.payees,+b.dataset.upPayee,-1)){ save(); render(); } });
  $$('[data-down-payee]',el).forEach(b=> b.onclick=()=>{ if(moveItem(Y.payees,+b.dataset.downPayee,1)){ save(); render(); } });
  const copyIban = v =>{
    if(!v){ toast('No IBAN set'); return; }
    if(navigator.clipboard) navigator.clipboard.writeText(v).then(()=>toast('IBAN copied'), ()=>toast(v));
    else toast(v);
  };
  $$('[data-copy-iban]',el).forEach(b=> b.onclick=()=> copyIban(ibanClean(Y.accounts[+b.dataset.copyIban].iban)));
  $$('[data-copy-payee]',el).forEach(b=> b.onclick=()=> copyIban(ibanClean(Y.payees[+b.dataset.copyPayee].iban)));
  $('#exportAcc').onclick = ()=> downloadCSV('accounts-'+yearLabel()+'.csv', accountsCSV());
  $('#exportPayees').onclick = ()=> downloadCSV('payees-'+yearLabel()+'.csv', payeesCSV());
}

