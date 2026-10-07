/* ---------- optional server sync ----------
   Self-hosting this (see homelab/) serves the page from a small server that also keeps
   your data as JSON, so the same data follows you between machines instead of living
   in one browser. That server marks its endpoint with an X-Penny-Keeper-Sync header, and
   nothing here turns on without it: opened from GitHub Pages, any other static host, or
   straight off disk, the probe below finds nothing, sync stays off, no status text
   appears and the page behaves exactly as it always has on localStorage alone.

   In that case the probe is also the only request the page ever makes - a GET to its own
   origin carrying no data - and no further ones follow. */
const SYNC_URL = 'data/penny-keeper-current.json';   // relative, so it holds up under a subpath
let syncOn = false, syncPushTimer = null, syncFailed = false;

async function initSync(){
  let res;
  try{ res = await fetch(SYNC_URL, {cache:'no-store'}); }
  catch(e){ return; }                                      // offline, file://, nothing listening
  if(res.headers.get('X-Penny-Keeper-Sync') !== '1') return;     // not a Penny Keeper server: say nothing, change nothing
  syncOn = true;
  if(res.status === 404){ setStatus('Sync on - nothing stored on the server yet'); return; }
  if(!res.ok){ setStatus('Sync on - server error, using the copy in this browser'); return; }
  let j;
  try{ j = await res.json(); }
  catch(e){ setStatus('Sync on - server copy would not parse, using this browser’s'); return; }
  if(!j || !j.years || typeof j.years!=='object' || !Object.keys(j.years).length){
    setStatus('Sync on - server copy was empty, using this browser’s'); return;
  }
  /* The server is the source of truth on load - last write wins, nothing is merged - so
     do not leave this open and editing on two machines at once. */
  DB = j;
  if(!DB.years[DB.active]) DB.active = Object.keys(DB.years).sort()[0];
  ensureDB();
  Object.values(DB.years).forEach(migrate);
  Y = DB.years[DB.active];
  CUR = safeCur(Y.currency);
  try{ localStorage.setItem(KEY, JSON.stringify(DB)); }catch(e){}
  applyTheme(); render({reset:true});
  setStatus('Loaded from the server');
}
function pushToServer(){
  if(!syncOn) return;
  clearTimeout(syncPushTimer);
  syncPushTimer = setTimeout(()=>{
    fetch(SYNC_URL, {method:'PUT', headers:{'Content-Type':'application/json'}, body:JSON.stringify(DB)})
      .then(res=>{ if(!res.ok) throw new Error('HTTP '+res.status); syncFailed = false; })
      .catch(()=>{                                         // one warning, not one per keystroke
        if(!syncFailed) setStatus('Saved in this browser - the server did not take it');
        syncFailed = true;
      });
  }, 600);
}
/* Best effort on the way out: sendBeacon bodies are capped (~64KB) and a full backup can
   run past that, so the debounced push above is what carries most edits. */
function flushServerPush(){
  if(!syncOn) return;
  clearTimeout(syncPushTimer);
  try{ navigator.sendBeacon && navigator.sendBeacon(SYNC_URL, new Blob([JSON.stringify(DB)],{type:'application/json'})); }
  catch(e){}
}

