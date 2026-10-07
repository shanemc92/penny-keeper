/* ---------- IBAN ---------- */
function ibanClean(s){ return String(s||'').replace(/[\s-]/g,'').toUpperCase(); }
function ibanPretty(s){ return ibanClean(s).replace(/(.{4})/g,'$1 ').trim(); }
function ibanMask(s){
  const v = ibanClean(s);
  if(v.length < 8) return v ? '\u2022'.repeat(v.length) : '';
  return v.slice(0,4)+' '+'\u2022'.repeat(Math.max(0,v.length-8)).replace(/(.{4})/g,'$1 ').trim()+' '+v.slice(-4);
}
function ibanValid(s){
  const v = ibanClean(s);
  if(!/^[A-Z]{2}[0-9]{2}[A-Z0-9]{6,30}$/.test(v)) return false;
  const r = v.slice(4)+v.slice(0,4);
  const digits = r.replace(/[A-Z]/g, c=> c.charCodeAt(0)-55);
  let rem = 0;
  for(let i=0;i<digits.length;i++) rem = (rem*10 + (+digits[i])) % 97;
  return rem === 1;
}

