let saveTimer=null, savePending=false;
function flushSave(){
  if(!savePending) return;
  clearTimeout(saveTimer); savePending=false;
  try{ localStorage.setItem(KEY, JSON.stringify(DB)); }catch(e){}
  flushServerPush();
}
function save(quiet){
  clearTimeout(saveTimer);
  savePending = true;
  saveTimer = setTimeout(()=>{
    savePending = false;
    try{
      localStorage.setItem(KEY, JSON.stringify(DB));
      if(!quiet) setStatus('Saved '+new Date().toLocaleTimeString('en-IE',{hour:'2-digit',minute:'2-digit'}));
    }catch(e){ setStatus('Storage full - export a backup'); }
    pushToServer();
  },200);
}
function setStatus(t){ $('#status').textContent = t; }
let toastTimer=null;
function toast(msg){
  const el=$('#toast'); el.textContent=msg; el.classList.add('show');
  clearTimeout(toastTimer); toastTimer=setTimeout(()=>el.classList.remove('show'),2200);
}

