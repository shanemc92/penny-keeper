/* ---------------- minimal xlsx writer (store-only zip, inline strings) ---------------- */
const CRC_TABLE = (()=>{ const t=new Uint32Array(256);
  for(let n=0;n<256;n++){ let c=n; for(let k=0;k<8;k++) c = c&1 ? 0xEDB88320^(c>>>1) : c>>>1; t[n]=c>>>0; }
  return t; })();
function crc32(buf){ let c=0xFFFFFFFF; for(let i=0;i<buf.length;i++) c = CRC_TABLE[(c^buf[i])&0xFF]^(c>>>8); return (c^0xFFFFFFFF)>>>0; }
const enc = s => new TextEncoder().encode(s);
function zipStore(files){
  const chunks=[], central=[]; let offset=0;
  const dv = n => { const b=new Uint8Array(4); new DataView(b.buffer).setUint32(0,n,true); return b; };
  const sv = n => { const b=new Uint8Array(2); new DataView(b.buffer).setUint16(0,n,true); return b; };
  for(const f of files){
    const name = enc(f.name), data = f.data;
    const crc = crc32(data);
    const local = [enc('PK\x03\x04'), sv(20), sv(0), sv(0), sv(0), sv(0), dv(crc), dv(data.length), dv(data.length), sv(name.length), sv(0), name, data];
    local.forEach(x=>chunks.push(x));
    central.push([enc('PK\x01\x02'), sv(20), sv(20), sv(0), sv(0), sv(0), sv(0), dv(crc), dv(data.length), dv(data.length),
      sv(name.length), sv(0), sv(0), sv(0), sv(0), dv(0), dv(offset), name]);
    offset += 30 + name.length + data.length;
  }
  const cdStart = offset; let cdSize = 0;
  central.forEach(parts=>{ parts.forEach(p=>{ chunks.push(p); cdSize += p.length; }); });
  chunks.push(enc('PK\x05\x06'), sv(0), sv(0), sv(files.length), sv(files.length), dv(cdSize), dv(cdStart), sv(0));
  let total=0; chunks.forEach(c=>total+=c.length);
  const out = new Uint8Array(total); let pos=0;
  chunks.forEach(c=>{ out.set(c,pos); pos+=c.length; });
  return out;
}
const xmlEsc = s => String(s)
  .replace(/[\u0000-\u0008\u000B\u000C\u000E-\u001F]/g,'')   // illegal in XML 1.0 - would corrupt the workbook
  .replace(/[&<>"']/g,m=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&apos;'}[m]));
function colName(i){ let s=''; i++; while(i>0){ const r=(i-1)%26; s=String.fromCharCode(65+r)+s; i=Math.floor((i-1)/26); } return s; }
function sheetXml(rows){
  const body = rows.map((r,ri)=>{
    const cells = r.map((v,ci)=>{
      const ref = colName(ci)+(ri+1);
      if(v===null||v===undefined||v==='') return '';
      if(typeof v==='number' && isFinite(v)) return `<c r="${ref}"><v>${v}</v></c>`;
      return `<c r="${ref}" t="inlineStr"><is><t xml:space="preserve">${xmlEsc(csvSafe(v))}</t></is></c>`;
    }).join('');
    return `<row r="${ri+1}">${cells}</row>`;
  }).join('');
  return `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<worksheet xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main"><sheetData>${body}</sheetData></worksheet>`;
}
function buildXlsx(sheets){
  const names = [], used = new Set();
  sheets.forEach(s=>{
    let n = String(s.name).replace(/[\\\/\?\*\[\]:]/g,'-').slice(0,31) || 'Sheet';
    let base=n, k=2; while(used.has(n)){ n = (base.slice(0,28)+' '+k++); }
    used.add(n); names.push(n);
  });
  const files = [];
  files.push({name:'[Content_Types].xml', data:enc(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Types xmlns="http://schemas.openxmlformats.org/package/2006/content-types">
<Default Extension="rels" ContentType="application/vnd.openxmlformats-package.relationships+xml"/>
<Default Extension="xml" ContentType="application/xml"/>
<Override PartName="/xl/workbook.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.sheet.main+xml"/>
${sheets.map((s,i)=>`<Override PartName="/xl/worksheets/sheet${i+1}.xml" ContentType="application/vnd.openxmlformats-officedocument.spreadsheetml.worksheet+xml"/>`).join('')}
</Types>`)});
  files.push({name:'_rels/.rels', data:enc(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
<Relationship Id="rId1" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/officeDocument" Target="xl/workbook.xml"/>
</Relationships>`)});
  files.push({name:'xl/workbook.xml', data:enc(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<workbook xmlns="http://schemas.openxmlformats.org/spreadsheetml/2006/main" xmlns:r="http://schemas.openxmlformats.org/officeDocument/2006/relationships">
<sheets>${names.map((n,i)=>`<sheet name="${xmlEsc(n)}" sheetId="${i+1}" r:id="rId${i+1}"/>`).join('')}</sheets>
</workbook>`)});
  files.push({name:'xl/_rels/workbook.xml.rels', data:enc(
    `<?xml version="1.0" encoding="UTF-8" standalone="yes"?>
<Relationships xmlns="http://schemas.openxmlformats.org/package/2006/relationships">
${names.map((n,i)=>`<Relationship Id="rId${i+1}" Type="http://schemas.openxmlformats.org/officeDocument/2006/relationships/worksheet" Target="worksheets/sheet${i+1}.xml"/>`).join('')}
</Relationships>`)});
  sheets.forEach((s,i)=> files.push({name:`xl/worksheets/sheet${i+1}.xml`, data:enc(sheetXml(s.rows))}));
  return zipStore(files);
}
function downloadXlsx(name, sheets){
  downloadBlob(name, new Blob([buildXlsx(sheets)],
    {type:'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet'}));
}

