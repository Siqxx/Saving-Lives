/* ---------- CONFIG - replace these with your endpoints / keys ---------- */
const SCRIPT_URL = https://script.google.com/macros/s/AKfycbz9FmJzjWDQb4Klu3ba5rke_3Icv0qqHdi81mBDeAxbYLeX46GFD_9JQkuPJnu4vHLlyQ/exec; // GET returns rows JSON, POST accepts record
const DRIVE_UPLOAD_URL = https://script.google.com/macros/s/AKfycbx9efC0AU0DjFvHst8PPmRTffUVxc22UIMXbVVHMS2vS31KqnrUzIefasOijrARolxh4g/exec; // optional: receive file uploads for Drive
const GOOGLE_CLIENT_ID = 507773507877-t1prpckunc9l2700dgfflhfk6jf2de5c.apps.googleusercontent.com
; // optional for sign-in
/* --------------------------------------------------------------------- */

/* ---------- IndexedDB simple wrapper (same stores as earlier) ---------- */
let db;
const DB_NAME='mssu_v1', DB_VER=1;
function openDb(){
  return new Promise((res,rej)=>{
    const r=indexedDB.open(DB_NAME,DB_VER);
    r.onupgradeneeded = e=>{
      db=e.target.result;
      if(!db.objectStoreNames.contains('admin')) db.createObjectStore('admin',{keyPath:'id'});
      if(!db.objectStoreNames.contains('logistics')) db.createObjectStore('logistics',{keyPath:'id'});
      if(!db.objectStoreNames.contains('operation')) db.createObjectStore('operation',{keyPath:'id'});
      if(!db.objectStoreNames.contains('func')) db.createObjectStore('func',{keyPath:'id'});
      if(!db.objectStoreNames.contains('edits')) db.createObjectStore('edits',{keyPath:'id'});
    };
    r.onsuccess=()=>{db=r.result;res(db);};
    r.onerror= e=> rej(e);
  });
}
function put(store,obj){ return new Promise((res,rej)=>{ const tx=db.transaction(store,'readwrite').objectStore(store).put(obj); tx.onsuccess=()=>res(); tx.onerror= e=>rej(e); });}
function getAll(store){ return new Promise((res,rej)=>{ const arr=[]; const r=db.transaction(store).objectStore(store).openCursor(); r.onsuccess=e=>{ const c=e.target.result; if(c){ arr.push(c.value); c.continue(); } else res(arr); }; r.onerror=e=>rej(e); });}
function del(store,key){ return new Promise((res,rej)=>{ const r=db.transaction(store,'readwrite').objectStore(store).delete(key); r.onsuccess=()=>res(); r.onerror=e=>rej(e); });}

/* ---------- helpers ---------- */
function uid(){ return Date.now().toString(36)+'-'+Math.random().toString(36).slice(2,6); }
function fileToDataURL(file){ return new Promise((res,rej)=>{ const r=new FileReader(); r.onload=()=>res(r.result); r.onerror=rej; r.readAsDataURL(file); }); }
function nowISO(){ return new Date().toISOString(); }

/* ---------- APP INIT ---------- */
openDb().then(()=>{ console.log('DB opened'); loadAll(); }).catch(console.error);

/* load and render all */
async function loadAll(){
  const adm = await getAll('admin'); adm.forEach(renderAdminRow);
  updateAdminTally();
  // other stores can be loaded similarly (logistics, operation, func)
}

/* ---------- ADMIN: save with optional files ---------- */
async function saveAdminRecord(form, photoFile, soiFile){
  // form: object with fields (unit, pscDiv, item, name, designation, from, to,...)
  const rec = Object.assign({}, form);
  rec.id = uid();
  rec.createdAt = nowISO();
  rec.createdBy = window.currentUser || 'local';

  if(photoFile) rec.photo = await fileToDataURL(photoFile); else rec.photo = rec.photo || '';
  if(soiFile) rec.soi = { name: soiFile.name, data: await fileToDataURL(soiFile) };

  await put('admin', rec);
  // add edit log
  await put('edits', { id: uid(), recordId: rec.id, action: 'create', by: rec.createdBy, at: rec.createdAt, device: navigator.userAgent });

  // render and update tally
  renderAdminRow(rec);
  updateAdminTally();

  // try to sync to server
  try { await sendRecordToServer(rec); console.log('synced admin record'); }
  catch(e){ console.warn('sync failed (offline or error)', e); }
}

/* send to Apps Script endpoint - server side should write to Sheets and optionally Drive */
async function sendRecordToServer(rec){
  if(!SCRIPT_URL) throw new Error('SCRIPT_URL not configured');
  // POST JSON
  const resp = await fetch(SCRIPT_URL, {
    method: 'POST',
    headers: {'Content-Type':'application/json'},
    body: JSON.stringify({ type:'admin', record: rec })
  });
  if(!resp.ok) throw new Error('Server returned ' + resp.status);
  return resp.text();
}

/* ---------- Admin renderers ---------- */
function renderAdminRow(rec){
  const wrap = document.getElementById('adminList');
  if(!wrap) return; // page not loaded (iframe case)
  const div = document.createElement('div'); div.className='card'; div.dataset.id=rec.id;
  div.innerHTML = `
    <div style="display:flex;gap:10px;align-items:center">
      <div style="width:72px">${rec.photo?`<img src="${rec.photo}" style="width:72px;height:72px;object-fit:cover;border-radius:6px">`:'—'}</div>
      <div style="flex:1">
        <div style="font-weight:600">${rec.name} <span class="muted">(${rec.designation})</span></div>
        <div class="muted">${rec.unit || ''} ${rec.pscDiv?('• '+rec.pscDiv):''}</div>
        <div class="muted">Assign: ${rec.from||'—'} to ${rec.to||(rec.present?'Present':'—')}</div>
        <div class="muted">Status: ${rec.status} • Action: ${rec.action}</div>
      </div>
      <div style="display:flex;flex-direction:column;gap:6px">
        ${rec.soi?`<a class="file-link" href="${rec.soi.data}" download="${rec.soi.name}">📄 SOI</a>`:''}
        <button class="small" onclick="editAdmin('${rec.id}')">Edit</button>
        <button class="small" onclick="deleteAdmin('${rec.id}')">Delete</button>
      </div>
    </div>
  `;
  // ensure newest on top
  wrap.prepend(div);
}

/* update tally */
async function updateAdminTally(){
  const all = await getAll('admin');
  const total = all.length;
  const counts = {};
  all.forEach(r=> counts[r.status]= (counts[r.status]||0)+1);
  const parts = Object.entries(counts).map(([k,v])=>`${k}: ${v}`);
  const node = document.getElementById('adminTally');
  if(node) node.innerHTML = `<b>Total:</b> ${total} • ${parts.join(' • ')}`;
}

/* edit/delete */
async function editAdmin(id){
  const all = await getAll('admin');
  const rec = all.find(r=>r.id===id);
  if(!rec) return alert('Record not found');
  // populate parent form fields (admin.html will read these when present)
  // Because admin.html is in iframe, use postMessage to communicate if needed.
  // Simpler approach when same origin: directly set fields if available
  try {
    parent.document.getElementById('pageFrame').contentWindow.document.getElementById('itemNo').value = rec.item || '';
  } catch(e){}
  // simple approach: delete old record and let user save as new
  await del('admin', id);
  document.querySelector(`#adminList [data-id="${id}"]`)?.remove();
  updateAdminTally();
}

async function deleteAdmin(id){
  if(!confirm('Delete this personnel record?')) return;
  await del('admin',id);
  document.querySelector(`#adminList [data-id="${id}"]`)?.remove();
  await put('edits', { id: uid(), recordId: id, action: 'delete', by: window.currentUser||'local', at: nowISO(), device: navigator.userAgent });
  updateAdminTally();
}

/* ---------- Sync / load from server ---------- */
async function syncNow(){
  if(!SCRIPT_URL) return alert('Sync endpoint not configured');
  try{
    // GET remote rows (Apps Script should return JSON array)
    const r = await fetch(SCRIPT_URL);
    if(!r.ok) throw new Error('Fetch failed ' + r.status);
    const rows = await r.json(); // array of arrays or objects depends on your script
    // The Apps Script doGet used with our earlier template returns array of rows; adapt as needed
    // Here we expect each row to be: item, photoURL(base64 optional), name, designation, unitType, psc, status, from, to, remarks, action, soiLink
    // For simplicity, convert each row into record then store
    if(Array.isArray(rows) && rows.length>1){
      const header = rows[0];
      for(let i=1;i<rows.length;i++){
        const row = rows[i];
        // map by index
        const rec = {
          id: uid(),
          item: row[0], photo: row[1]||'', name: row[2], designation: row[3],
          unit: row[4], pscDiv: row[5], status: row[6], from: row[7], to: row[8],
          remarks: row[9], action: row[10], soi: row[11] ? {name: row[11], data: row[11]} : ''
        };
        await put('admin', rec);
      }
    }
    await loadAll();
    alert('Sync complete');
  }catch(e){ console.warn(e); alert('Sync failed: ' + e.message); }
}

/* ---------- Basic Google Sign-In placeholder ---------- */
function initGoogleSignIn(){ /* implement google gapi init when you have GOOGLE_CLIENT_ID */ }
function signInWithGoogle(){ /* implement gapi sign in, set window.currentUser and show signout */ }

/* export for admin.html to call */
window.saveAdminRecord = saveAdminRecord;
window.renderAdminList = async ()=>{ document.getElementById('adminList').innerHTML=''; (await getAll('admin')).forEach(renderAdminRow); updateAdminTally(); };
window.syncNow = syncNow;

/* on page load (when script.js included in admin.html) render list */
if(document.readyState==='complete' || document.readyState==='interactive'){
  setTimeout(()=>{ if(document.getElementById('adminList')) renderAdminList(); }, 200);
}
