/* ---------------- history ---------------- */
let histSel = null;   // view state only - never written to the year data
function renderHistory(el){
  const h = Y.history;
  const months = Array.from(new Set(h.map(r=>r.month))).sort();
  const cats = Array.from(new Set(h.map(r=>r.category))).filter(Boolean).sort();
  const grid = {};
  h.forEach(r=>{ grid[r.month] = grid[r.month]||{}; grid[r.month][r.category] = (grid[r.month][r.category]||0)+num(r.amount); });
  const catTotal = c => h.filter(r=>r.category===c).reduce((s,r)=>s+num(r.amount),0);

  el.innerHTML = `
  <div class="card">
    <h2>Historical bill payments</h2>
    <div class="note" style="margin-top:0">Actuals you have already paid, kept across years. Use it to sanity-check the budget you set for ${esc(Y.year)}.</div>
    <div class="row" style="margin:10px 0">
      <label class="f" style="width:130px"><span>Month</span><input type="month" id="hMonth" value="${monthKey(new Date())}"></label>
      <label class="f" style="width:180px"><span>Category</span><input list="catList2" id="hCat" placeholder="Electricity"></label>
      <label class="f" style="width:120px"><span>Amount</span><input class="num" id="hAmt" value=""></label>
      <button class="btn" id="hAdd">Add</button>
      <div class="spacer"></div>
      <button class="btn" id="hFromTxns">Build from transactions</button>
      <button class="btn" id="exportHistory">Export CSV</button>
      <label class="f" style="width:200px;margin:0"><span>Import CSV (replaces)</span>
        <input type="file" id="hImport" accept=".csv,text/csv"></label>
    </div>
    <datalist id="catList2">${Y.bills.map(b=>`<option value="${esc(b.name)}">`).join('')}</datalist>
  </div>

  ${cats.length?`<div class="card">
    <h2>Trend</h2>
    <div class="row" style="margin-bottom:8px">
      <label class="f" style="width:200px"><span>Category</span>
        <select id="hSel">${cats.map(c=>`<option ${c===(histSel||cats[0])?'selected':''}>${esc(c)}</option>`).join('')}</select></label>
    </div>
    <div class="chartbox"><canvas id="cHist"></canvas></div>
  </div>`:''}

  <div class="card">
    <h2>Log <span class="pill">${h.length}</span></h2>
    <div class="tw" style="max-height:480px;overflow:auto"><table>
      <thead><tr><th>Month</th>${cats.map(c=>`<th class="n">${esc(c)}</th>`).join('')}<th class="n">Total</th></tr></thead>
      <tbody>${months.slice().reverse().map(m=>{
        const row = grid[m]||{};
        const tot = Object.values(row).reduce((a,b)=>a+b,0);
        return `<tr><td>${esc(m)}</td>${cats.map(c=>`<td class="n">${row[c]?fmt(row[c]):'<span class="mut">-</span>'}</td>`).join('')}
          <td class="n"><b>${fmt(tot)}</b></td></tr>`;
      }).join('') || `<tr><td colspan="${cats.length+2}" class="empty">Nothing logged yet.</td></tr>`}</tbody>
      <tfoot><tr><td>Average / month</td>${cats.map(c=>{
        const ms = months.filter(m=>grid[m]&&grid[m][c]!=null).length||1;
        return `<td class="n">${fmt(catTotal(c)/ms)}</td>`;
      }).join('')}<td></td></tr></tfoot>
    </table></div>
  </div>`;

  $('#hAdd').onclick = ()=>{
    const m = $('#hMonth').value, c = $('#hCat').value.trim(), a = num($('#hAmt').value);
    if(!m||!c){ toast('Month and category needed'); return; }
    Y.history.push({month:m, category:c, amount:a});
    save(); render();
  };
  $('#hFromTxns').onclick = ()=>{
    const seen = new Set(Y.history.map(r=>r.month+'|'+r.category));
    const agg = {};
    Y.txns.filter(t=>t.category && num(t.debit)>0).forEach(t=>{
      const k = t.date.slice(0,7)+'|'+t.category;
      agg[k] = (agg[k]||0)+num(t.debit);
    });
    let n=0;
    Object.entries(agg).forEach(([k,v])=>{
      if(seen.has(k)) return;
      const [month,category]=k.split('|');
      Y.history.push({month, category, amount:round2(v)}); n++;
    });
    save(); render(); toast(n+' months added from transactions');
  };
  $('#exportHistory').onclick = ()=> downloadCSV('history-'+yearLabel()+'.csv', historyCSV());
  $('#hImport').onchange = e=>{
    const f = e.target.files[0]; if(!f) return;
    const rd = new FileReader();
    rd.onload = ()=>{
      const rows = parseCSV(rd.result);
      e.target.value = '';
      if(!rows.length){ toast('Nothing in that file'); return; }
      const head = rows[0].map(h=>String(h).trim().toLowerCase());
      const iM = head.findIndex(h=>h.includes('month'));
      const iC = head.findIndex(h=>h.includes('categ'));
      const iA = head.findIndex(h=>h.includes('amount'));
      if(iM<0||iC<0||iA<0){ toast('Need Month, Category and Amount columns'); return; }
      const out = [];
      for(let r=1;r<rows.length;r++){
        const c = rows[r];
        const m = String(c[iM]||'').trim().slice(0,7);
        const cat = String(c[iC]||'').trim();
        if(!/^\d{4}-\d{2}$/.test(m) || !cat) continue;
        out.push({month:m, category:cat, amount:num(c[iA])});
      }
      if(!out.length){ toast('No usable rows - months need to look like 2026-03'); return; }
      if(Y.history.length && !confirm('Replace all '+Y.history.length+' existing history rows with '+out.length+' from this file?')) return;
      Y.history = out;
      save(); render();
      toast(out.length+' history rows imported');
    };
    rd.onerror = ()=>{ toast('Could not read that file'); e.target.value=''; };
    rd.readAsText(f);
  };
  const sel = $('#hSel');
  if(sel){
    sel.onchange = ()=>{ histSel = sel.value; render(); };
    chart(()=>{
      const c = histSel||cats[0];
      const ms = months.filter(m=>grid[m]&&grid[m][c]!=null);
      lineChart($('#cHist'), ms, [{name:c, color:PALETTE[0], values:ms.map(m=>grid[m][c]), fill:true}]);
    });
  }
}

/* swap an item with its neighbour; returns false at either end so callers can skip re-rendering */
function moveItem(arr, i, dir){
  const j = i + dir;
  if(j < 0 || j >= arr.length) return false;
  [arr[i], arr[j]] = [arr[j], arr[i]];
  return true;
}

