/* one-time: people are shown as first name + surname initial (Աննա Շ.); different spellings of the same person become one */
(function mergeKnownNames(){ try{ if(localStorage.getItem("promtest-names-short-v2"))return;
  const P={"աննա շագրիյան":"Աննա Շ.","աննա շ":"Աննա Շ.","աննա աբազյան":"Աննա Ա.","աննա":"Աննա Ա.","դիանա բեգլարյան":"Դիանա Բ.","դիանա":"Դիանա Բ.","diana b.":"Դիանա Բ.","ասյա սարգսյան":"Ասյա Ս."};
  const fx=x=>{ if(typeof x!=="string")return x; const n=P[x.replace(/\s+/g," ").trim().toLowerCase()]; return n||x };
  const fixVal=v=>Array.isArray(v)?[...new Set(v.map(fx))]:fx(v);
  ["promtest-lists-v1","promtest-crm-lists-v1"].forEach(k=>{const o=JSON.parse(localStorage.getItem(k)||"null"); if(!o)return; Object.keys(o).forEach(f=>{if(Array.isArray(o[f]))o[f]=fixVal(o[f])}); localStorage.setItem(k,JSON.stringify(o))});
  ["promtest-events-v1","promtest-visits-v1"].forEach(k=>{const a=JSON.parse(localStorage.getItem(k)||"null"); if(!Array.isArray(a))return; a.forEach(r=>{["rep","responsible"].forEach(f=>{if(r[f])r[f]=fx(r[f])})}); localStorage.setItem(k,JSON.stringify(a))});
  const R=JSON.parse(localStorage.getItem("promtest-renames")||"{}"); Object.assign(R,P); localStorage.setItem("promtest-renames",JSON.stringify(R));
  localStorage.setItem("promtest-names-short-v2","1");
}catch(e){} })();
const MONTHS=["Հունվար","Փետրվար","Մարտ","Ապրիլ","Մայիս","Հունիս","Հուլիս","Օգոստոս","Սեպտեմբեր","Հոկտեմբեր","Նոյեմբեր","Դեկտեմբեր"];
const MSHORT=["հնվ","փտր","մրտ","ապր","մյս","հնս","հլս","օգս","սեպ","հոկ","նոյ","դեկ"];
const LKEY="promtest-events-v1";
const $=id=>document.getElementById(id);
let events=[], filter="upcoming", editingId=null, mode="loading", col=null, subs=null, downloads=null;
/* Permissions (shared mode): editors/owner write "events" and may delete anything;
   everyone else with the link (Contributor) adds into their own "subs/<id>" doc and can edit only those; nobody but editors sees Delete. */
let mainEvents=[], subDocs={}, me=null, canEdit=false, canWrite=true, userCap=null, names={};

/* ---------- data layer: shared db inside claude.ai, localStorage elsewhere ---------- */
function loadLocal(){try{return JSON.parse(localStorage.getItem(LKEY)||"[]")}catch(e){return []}}
function saveLocal(){try{localStorage.setItem(LKEY,JSON.stringify(events))}catch(e){}}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function clean(ev){const b={};for(const k in ev)if(k!=="id"&&k[0]!=="_")b[k]=ev[k];return b}
function mayEdit(ev){return mode!=="db"||canEdit||(ev&&ev._src==="sub"&&ev._owner===me)}
function merge(){
  events=[...mainEvents,...Object.entries(subDocs).flatMap(([u,d])=>Object.entries((d&&d.entries)||{}).map(([id,e])=>({...e,id,_src:"sub",_owner:u})))];
  render(); resolveNames();
}
async function writeSub(owner,id,body){
  const cur={...((subDocs[owner]&&subDocs[owner].entries)||{})};
  if(body===null)delete cur[id]; else cur[id]=body;
  await subs.doc(owner).set({entries:cur});
}
async function saveEvent(ev){
  const id=ev.id||uid(); const body=clean(ev);
  if(mode!=="db"){const i=events.findIndex(e=>e.id===id); if(i>=0)events[i]={id,...body}; else events.push({id,...body}); saveLocal(); render(); return}
  const ex=events.find(e=>e.id===id);
  if(ex){ if(ex.addedBy)body.addedBy=ex.addedBy; if(ex.addedAt)body.addedAt=ex.addedAt;
    if(ex._src==="sub")return writeSub(ex._owner,id,body);
    return col.doc(id).set(body); }
  if(me){body.addedBy=me;} body.addedAt=new Date().toISOString();
  if(canEdit)return col.doc(id).set(body);
  if(!me)throw {code:"invalid_argument"};
  return writeSub(me,id,body);
}
async function removeEvent(id){
  if(mode!=="db"){events=events.filter(e=>e.id!==id); saveLocal(); render(); return}
  const ex=events.find(e=>e.id===id); if(!ex)return;
  if(ex._src==="sub")return writeSub(ex._owner,id,null);
  return col.doc(id).delete();
}
async function resolveNames(){
  if(!userCap)return;
  const ids=[...new Set(events.map(e=>e.addedBy).filter(x=>x&&!(x in names)))]; if(!ids.length)return;
  try{const ps=await userCap.profiles(ids); let changed=false;
    ids.forEach(i=>{names[i]=(ps[i]&&ps[i].name)||""; if(names[i])changed=true}); if(changed)render();}catch(e){}
}
function applyPerms(){
  const db=mode==="db";
  $("addBtn").hidden=db&&(!canWrite||(!canEdit&&!me));
  $("listsBtn").hidden=db&&!canEdit;
  if($("mode"))$("mode").textContent=!db?"":
    canEdit?"Ընդհանուր տվյալներ · դուք ունեք լիարժեք իրավունք":
    (canWrite&&me)?"Կարող եք ավելացնել միջոցառում և խմբագրել ձեր ավելացրածը":"Միայն դիտում";
}
function mergeSeedLists(){ // names newly added to SEED_LISTS (data.js) join lists already saved in this browser
  const seed=window.SEED_LISTS; if(!seed||!lists)return; let prev={}, changed=false;
  try{prev=JSON.parse(localStorage.getItem(LISTS_KEY+"-seed")||"{}")}catch(e){}
  for(const [k] of LIST_DEFS)for(const v of seed[k]||[]){ if(!(prev[k]||[]).includes(v)&&!(lists[k]||[]).includes(v)){(lists[k]=lists[k]||[]).push(v);changed=true} }
  try{ if(changed)localStorage.setItem(LISTS_KEY,JSON.stringify(lists)); localStorage.setItem(LISTS_KEY+"-seed",JSON.stringify(seed)) }catch(e){}
}
if(window.setupOrderLinks)setupOrderLinks();
function useLocal(){try{lists=JSON.parse(localStorage.getItem(LISTS_KEY)||"null")}catch(e){lists=null} mergeSeedLists(); applyRenames(); mode="local"; events=loadLocal(); if(!events.length&&window.SEED_EVENTS){events=window.SEED_EVENTS.map(e=>({...e})); saveLocal();} if(lists&&Array.isArray(lists.people)&&lists.people.includes("Diana B.")){lists.people=lists.people.filter(x=>x!=="Diana B."); if(!lists.people.includes("Դիանա Բ."))lists.people.push("Դիանա Բ."); try{localStorage.setItem(LISTS_KEY,JSON.stringify(lists))}catch(e){}} if(events.some(e=>e.responsible==="Diana B.")){events.forEach(e=>{if(e.responsible==="Diana B.")e.responsible="Դիանա Բ."}); saveLocal();} applyPerms(); render(); if(location.hash==="#new"){try{history.replaceState(null,"",location.pathname)}catch(e){} openForm();}}
async function init(){
  render();
  if(!window.claude||!window.claude.use){useLocal();return}
  const db=await window.claude.use("db");
  if(!db){useLocal();return}
  userCap=await window.claude.use("user");
  if(userCap){ canEdit=await userCap.canEdit(); me=await userCap.id(); const w=await userCap.can("data.write"); canWrite=w!==false; }
  mode="db"; col=db.collection("events"); subs=db.collection("subs");
  applyPerms();
  const onErr=e=>{toast("Տվյալները չհաջողվեց բեռնել ("+e.code+")։ Թարմացրեք էջը։")};
  col.onSnapshot(s=>{mainEvents=s.docs.map(d=>({id:d.id,...d.data(),_src:"main"})); merge();},onErr);
  cfgRef=db.doc("config/lists");
  cfgRef.onSnapshot(s=>{lists=s.exists?s.data():null; renderListsBody();},onErr);
  subs.onSnapshot(s=>{subDocs={}; s.docs.forEach(d=>{subDocs[d.id]=d.data()}); merge();},onErr);
  window.claude.use("downloads").then(d=>{downloads=d});
}

/* ---------- helpers ---------- */
const TODAY=new Date(); TODAY.setHours(0,0,0,0);
function d(iso){if(!iso)return null; const [y,m,dd]=iso.split("-").map(Number); return new Date(y,m-1,dd)}
function status(ev){const s=d(ev.start), e=d(ev.end)||s; if(!s)return"up"; if(e<TODAY)return"past"; if(s<=TODAY)return"now"; return"up"}
function daysTo(ev){return Math.round((d(ev.start)-TODAY)/864e5)}
function fmt(iso){const x=d(iso); return x?String(x.getDate()).padStart(2,"0")+"."+String(x.getMonth()+1).padStart(2,"0")+"."+x.getFullYear():""}
function fmtRange(ev){if(!ev.end||ev.end===ev.start)return fmt(ev.start); const a=d(ev.start),b=d(ev.end); return a.getMonth()===b.getMonth()?a.getDate()+"–"+fmt(ev.end):fmt(ev.start)+"–"+fmt(ev.end)}
function esc(s){return String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}
function toast(msg){const t=$("toast"); t.textContent=msg; t.hidden=false; clearTimeout(toast.t); toast.t=setTimeout(()=>t.hidden=true,3200)}
function plural(n){return n+" օր"}

/* ---------- render ---------- */
function render(){
  const up=events.filter(e=>status(e)!=="past").sort((a,b)=>(a.start||"").localeCompare(b.start||""));
  const next=up[0];
  const noMat=up.filter(e=>!e.materials).length;
  $("summary").innerHTML=`
    <div class="stat"><b>${events.length}</b><span>Ընդհանուր</span></div>
    <div class="stat"><b>${up.length}</b><span>Առաջիկա</span></div>
    <div class="stat"><b>${noMat}</b><span>Առանց տպագրական նյութի</span></div>
    <div class="stat next"><b>${next?esc(next.name):"—"}</b><span>${next?(status(next)==="now"?"Ընթանում է հիմա":"Հաջորդը՝ "+plural(daysTo(next))+" հետո · "+fmtRange(next)):"Առաջիկա միջոցառում չկա"}</span></div>`;

  const people=(a=>{const m=new Map(); a.forEach(x=>{const n=String(x||"").replace(/\s+/g," ").trim(); if(n&&!m.has(n.toLowerCase()))m.set(n.toLowerCase(),n)}); return [...m.values()]})([...L("people"),...events.map(e=>e.responsible)]);
  const sel=$("person"), cur=sel.value;
  renderReps(people,cur);
  sel.innerHTML='<option value="">Բոլոր պատասխանատուները</option>'+people.map(p=>`<option${p===cur?" selected":""}>${esc(p)}</option>`).join("");
  fillLists();

  const q=$("q").value.trim().toLowerCase(), person=sel.value;
  let rows=events.filter(e=>{
    const st=status(e);
    if(filter==="upcoming"&&st==="past")return false;
    if(filter==="past"&&st!=="past")return false;
    if(person&&e.responsible!==person)return false;
    if(q&&![e.name,e.location,e.audience,e.org,e.format,e.materials,e.notes].join(" ").toLowerCase().includes(q))return false;
    return true;});
  if(filter==="all"){ // this month and later first (ascending), then earlier months from newest to oldest
    const curM=isoOf(TODAY).slice(0,7);
    rows.sort((a,b)=>{const ma=(a.start||"").slice(0,7), mb=(b.start||"").slice(0,7), ra=ma>=curM?0:1, rb=mb>=curM?0:1;
      if(ra!==rb)return ra-rb; if(ma!==mb)return ra===0?ma.localeCompare(mb):mb.localeCompare(ma); return (a.start||"").localeCompare(b.start||"");});
  } else rows.sort((a,b)=>(a.start||"").localeCompare(b.start||"")*(filter==="past"?-1:1));

  renderCal();
  const list=$("list");
  if(mode==="loading"){list.innerHTML='<div class="empty">Բեռնվում է…</div>';return}
  if(!events.length){list.innerHTML=`<div class="empty"><strong>Միջոցառումներ դեռ չկան</strong>
    Ավելացրեք առաջինը՝ «+ Նոր միջոցառում» կոճակով։
    <div class="actions">${$("addBtn").hidden?"":'<button type="button" class="primary" onclick="openForm()">+ Նոր միջոցառում</button>'}</div></div>`;return}
  if(!rows.length){list.innerHTML='<div class="empty"><strong>Համընկնումներ չկան</strong>Փոխեք որոնումը կամ ֆիլտրը։</div>';return}

  const groups={};
  rows.forEach(e=>{const k=(e.start||"0000-00").slice(0,7); (groups[k]=groups[k]||[]).push(e)});
  list.innerHTML=Object.entries(groups).map(([k,evs])=>{
    const [y,m]=k.split("-").map(Number);
    return `<section class="month"><h2>${m?MONTHS[m-1]+" "+y:"Առանց ամսաթվի"} <small>${evs.length} միջոցառում</small></h2>
    ${evs.map(card).join("")}</section>`}).join("");
}
function card(e){
  const st=status(e), s=d(e.start);
  const day=s?(e.end&&e.end!==e.start&&d(e.end).getMonth()===s.getMonth()?s.getDate()+"–"+d(e.end).getDate():s.getDate()):"?";
  const label=st==="past"?"Անցած":st==="now"?"Հիմա":(daysTo(e)===0?"Այսօր":plural(daysTo(e))+" հետո");
  const chips=[e.format,e.org].filter(Boolean).map(x=>`<span class="chip">${esc(x)}</span>`).join("")+
    (e.materials?`<span class="chip">🖨 ${esc(e.materials)}</span>`:(st!=="past"?'<span class="chip warn">Տպագրական նյութ նշված չէ</span>':""))+
    (e.addedBy&&names[e.addedBy]?`<span class="chip">Ավելացրել է՝ ${esc(names[e.addedBy])}</span>`:"");
  return `<button type="button" class="ev ${st==="past"?"past":""}" data-id="${esc(e.id)}">
    <div class="date"><b>${day}</b><span>${s?MSHORT[s.getMonth()]:""}${e.time?"<br>"+esc(e.time):""}</span></div>
    <div class="body"><div class="title">${esc(e.name)}</div>
      <div class="meta">${e.location?`<span>📍 ${esc(e.location)}</span>`:""}${e.responsible?`<span>👤 ${esc(e.responsible)}</span>`:""}</div>
      ${e.audience?`<div class="meta">${esc(e.audience)}</div>`:""}
      <div class="chips">${chips}</div></div>
    <span class="state ${st}">${label}</span></button>`;
}
function fillLists(){
  const map={};
  for(const [id,f] of Object.entries(map)){$(id).innerHTML=[...new Set(events.map(e=>e[f]).filter(Boolean))].map(v=>`<option value="${esc(v)}">`).join("")}
}

/* ---------- choice lists: organizations, responsible people, printed materials ---------- */
const LISTS_KEY="promtest-lists-v1";
const LIST_DEFS=[["formats","Ներկայացման ձևաչափեր","format"],["orgs","Կազմակերպություններ","org"],["people","Պատասխանատուներ","responsible"],["materials","Տպագրական նյութեր","materials"]];
const DEFAULT_LISTS=window.SEED_LISTS||{formats:["Հովանավոր"],orgs:["Prom-Test"],people:["Դիանա Բ.","Աննա Ա.","Աննա Շ."],materials:["Roll-up","Բուկլետ","Թռուցիկ","Պաստառ"]};
let lists=null, cfgRef=null;
function L(k){return lists&&Array.isArray(lists[k])?lists[k]:(DEFAULT_LISTS[k]||[])}
function splitMat(s){return String(s||"").split(/\s*[,;]\s*/).map(x=>x.trim()).filter(Boolean)}
function allLists(){const o={};LIST_DEFS.forEach(([k])=>o[k]=[...L(k)]);return o}
async function saveLists(next){
  if(mode==="db"){await cfgRef.set(next)}
  else{lists=next; try{localStorage.setItem(LISTS_KEY,JSON.stringify(next))}catch(e){} renderListsBody();}
}
function fillSelect(id,arr,cur){
  const opts=[...arr]; if(cur&&!opts.includes(cur))opts.unshift(cur);
  $(id).innerHTML=`<option value="" disabled hidden${cur?"":" selected"}>— Ընտրել —</option>`+opts.map(v=>`<option value="${esc(v)}"${v===cur?" selected":""}>${esc(v)}</option>`).join("");
}
function fillChecks(val){
  const cur=splitMat(val), base=L("materials"), opts=[...base,...cur.filter(x=>!base.includes(x))];
  $("f_mat").innerHTML=opts.length?opts.map((v,i)=>`<label class="check"><input type="checkbox" id="mat_${i}" value="${esc(v)}"${cur.includes(v)?" checked":""}>${esc(v)}</label>`).join(""):'<span class="hint">Ցուցակը դատարկ է։ Ավելացրեք նյութեր «Ցուցակներ» բաժնում։</span>';
}
function renderListsBody(){
  if($("listsOverlay").hidden)return;
  $("listsBody").innerHTML=LIST_DEFS.map(([k,t])=>{const arr=L(k);
    return `<section class="listsec"><h4>${t} <small>${arr.length}</small></h4>
    <div class="chips">${arr.map((v,i)=>`<span class="chip edit">${esc(v)}<button type="button" class="ren" data-k="${k}" data-ri="${i}" aria-label="Փոխել ${esc(v)}" title="Փոխել անունը բոլոր էջերում">✎</button><button type="button" data-k="${k}" data-i="${i}" aria-label="Հեռացնել ${esc(v)}">✕</button></span>`).join("")||'<span class="hint">Դատարկ է</span>'}</div>
    <form class="addrow" data-k="${k}"><input id="add_${k}" autocomplete="off" placeholder="Նոր անուն" aria-label="Նոր անուն՝ ${t}"><button type="submit">Ավելացնել</button></form><div class="similar" id="sim_${k}" hidden></div></section>`}).join("");
}
$("listsBtn").onclick=()=>{$("listsOverlay").hidden=false; renderListsBody();};
$("listsClose").onclick=()=>$("listsOverlay").hidden=true;
$("listsOverlay").addEventListener("click",e=>{if(e.target.id==="listsOverlay")$("listsOverlay").hidden=true});
$("listsBody").addEventListener("click",async e=>{
  const b=e.target.closest("button[data-i]"); if(!b)return;
  const next=allLists(); const [v]=next[b.dataset.k].splice(+b.dataset.i,1);
  try{await saveLists(next); toast("Հեռացվեց՝ "+v)}catch(err){toast("Չհաջողվեց պահպանել")}
});
$("listsBody").addEventListener("submit",async e=>{
  e.preventDefault(); const k=e.target.dataset.k, inp=$("add_"+k), v=inp.value.trim(); if(!v)return;
  const next=allLists(); if(next[k].some(x=>x.toLowerCase()===v.toLowerCase())){toast("Արդեն կա ցուցակում");return}
  if(showSimilar(k,true).length){toast("Ստուգեք՝ գուցե այդ անունն արդեն կա");return}
  next[k].push(v);
  try{await saveLists(next); $("add_"+k)&&$("add_"+k).focus()}catch(err){toast("Չհաջողվեց պահպանել")}
});
$("harvestBtn").onclick=async()=>{
  const next=allLists(); let n=0;
  for(const [k,,field] of LIST_DEFS){
    const vals=field==="materials"?events.flatMap(e=>splitMat(e.materials)):events.map(e=>(e[field]||"").trim()).filter(Boolean);
    for(const v of vals)if(!next[k].some(x=>x.toLowerCase()===v.toLowerCase())){next[k].push(v);n++}
  }
  if(!n){toast("Նոր անուններ չգտնվեցին");return}
  try{await saveLists(next); toast("Ավելացվեց "+n+" անուն")}catch(err){toast("Չհաջողվեց պահպանել")}
};

/* ---------- date picker: day.month.year with an Armenian calendar ---------- */
const DATE_KEYS=["start","end","regDate"];
const WD=["Երկ","Երք","Չրք","Հնգ","Ուրբ","Շբթ","Կիր"];
function isoOf(x){return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0")}
function parseDMY(s){
  s=String(s||"").trim(); if(!s)return "";
  const m=s.match(/^(\d{1,2})[.\/\-\s](\d{1,2})[.\/\-\s](\d{4})$/); if(!m)return null;
  const dd=+m[1],mo=+m[2],y=+m[3],x=new Date(y,mo-1,dd);
  return x.getFullYear()===y&&x.getMonth()===mo-1&&x.getDate()===dd?isoOf(x):null;
}
let dp=null;
function openDP(input){
  if(input.disabled)return; if(dp&&dp.input===input)return; closeDP();
  const iso=parseDMY(input.value), base=iso?d(iso):new Date();
  dp={input,y:base.getFullYear(),m:base.getMonth()};
  const pop=document.createElement("div"); pop.className="dp"; pop.id="dp"; pop.setAttribute("role","dialog"); pop.setAttribute("aria-label","Օրացույց");
  input.parentNode.appendChild(pop); renderDP();
}
function closeDP(){const p=$("dp"); if(p)p.remove(); dp=null}
function renderDP(){
  const pop=$("dp"); if(!pop||!dp)return;
  const sel=parseDMY(dp.input.value), today=isoOf(TODAY);
  const offset=(new Date(dp.y,dp.m,1).getDay()+6)%7, days=new Date(dp.y,dp.m+1,0).getDate();
  let cells=""; for(let i=0;i<offset;i++)cells+="<span></span>";
  for(let n=1;n<=days;n++){const iso=isoOf(new Date(dp.y,dp.m,n));
    cells+=`<button type="button" class="dp-d${iso===sel?" sel":""}${iso===today?" today":""}" data-iso="${iso}">${n}</button>`}
  pop.innerHTML=`<div class="dp-h"><button type="button" class="dp-nav" data-nav="-1" aria-label="Նախորդ ամիս">‹</button><b>${MONTHS[dp.m]} ${dp.y}</b><button type="button" class="dp-nav" data-nav="1" aria-label="Հաջորդ ամիս">›</button></div>
    <div class="dp-g">${WD.map(w=>`<i>${w}</i>`).join("")}${cells}</div>
    <div class="dp-f"><button type="button" data-act="today">Այսօր</button><button type="button" data-act="clear">Մաքրել</button></div>`;
}
document.addEventListener("focusin",e=>{if(e.target.classList&&e.target.classList.contains("date-in"))openDP(e.target)});
document.addEventListener("click",e=>{
  const inp=e.target.closest&&e.target.closest(".date-in"); if(inp){openDP(inp);return}
  const b=e.target.closest&&e.target.closest(".dp button");
  if(!b){ if(dp&&!e.target.closest(".dp"))closeDP(); return }
  e.preventDefault();
  if(b.dataset.nav){dp.m+=+b.dataset.nav; if(dp.m<0){dp.m=11;dp.y--} if(dp.m>11){dp.m=0;dp.y++} renderDP(); return}
  const input=dp.input;
  if(b.dataset.iso)input.value=fmt(b.dataset.iso);
  else if(b.dataset.act==="today")input.value=fmt(isoOf(TODAY));
  else if(b.dataset.act==="clear")input.value="";
  closeDP(); input.focus(); closeDP();
});
document.addEventListener("input",e=>{ if(!dp||e.target!==dp.input)return; const iso=parseDMY(e.target.value); if(iso){const x=d(iso);dp.y=x.getFullYear();dp.m=x.getMonth();renderDP()} });
document.addEventListener("change",e=>{ if(!e.target.classList||!e.target.classList.contains("date-in"))return; const iso=parseDMY(e.target.value); if(iso)e.target.value=fmt(iso); });

/* ---------- printed materials: dropdown with checkboxes (several can be chosen) ---------- */
function updateMatBtn(){
  const v=[...$("f_mat").querySelectorAll("input:checked")].map(i=>i.value), b=$("f_matBtn");
  b.textContent=v.length?v.join(", "):"— Ընտրել —"; b.classList.toggle("ph",!v.length);
}
function closeMat(){$("f_mat").hidden=true; $("f_matBtn").setAttribute("aria-expanded","false")}
$("f_matBtn").addEventListener("click",()=>{const p=$("f_mat"); p.hidden=!p.hidden; $("f_matBtn").setAttribute("aria-expanded",String(!p.hidden)); if(!p.hidden){const f=p.querySelector("input"); if(f)f.focus();}});
$("f_mat").addEventListener("change",updateMatBtn);
document.addEventListener("click",e=>{ if(!$("f_mat").hidden&&!(e.target.closest&&e.target.closest(".msel-wrap")))closeMat(); });

/* ---------- form ---------- */
const F={name:"f_name",start:"f_start",end:"f_end",time:"f_time",regDate:"f_reg",org:"f_org",format:"f_format",location:"f_location",responsible:"f_resp",audience:"f_aud",notes:"f_notes"};
function openForm(id,date){
  editingId=id||null; const ev=events.find(e=>e.id===id)||{regDate:new Date().toISOString().slice(0,10),start:date||""};
  fillSelect("f_format",L("formats"),ev.format||""); fillSelect("f_org",L("orgs"),ev.org||""); fillSelect("f_resp",L("people"),ev.responsible||""); fillChecks(ev.materials);
  for(const [k,el] of Object.entries(F))if(k!=="org"&&k!=="responsible"&&k!=="format")$(el).value=DATE_KEYS.includes(k)?fmt(ev[k]):(ev[k]||"");
  const ro=!!id&&!mayEdit(ev);
  for(const el of Object.values(F))$(el).disabled=ro;
  $("f_mat").querySelectorAll("input").forEach(i=>i.disabled=ro);
  $("f_matBtn").disabled=ro; closeMat(); updateMatBtn();
  $("saveBtn").hidden=ro; $("cancelBtn").textContent=ro?"Փակել":"Չեղարկել";
  $("formTitle").textContent=!id?"Նոր միջոցառում":ro?"Միջոցառում":"Խմբագրել";
  $("delBtn").hidden=!id||(mode==="db"&&!canEdit); $("confirmBox").hidden=true; $("overlay").hidden=false; $("f_name").focus();
}
function closeForm(){closeDP(); closeMat(); $("overlay").hidden=true; editingId=null}
$("form").addEventListener("submit",async ev=>{
  ev.preventDefault();
  const o={}; for(const [k,el] of Object.entries(F))o[k]=$(el).value.trim();
  for(const k of DATE_KEYS){const v=parseDMY(o[k]); if(v===null){toast("Ամսաթիվը գրեք օր.ամիս.տարի ձևով, օր.՝ 25.10.2026");$(F[k]).focus();return} o[k]=v;}
  o.materials=[...$("f_mat").querySelectorAll("input:checked")].map(i=>i.value).join(", ");
  if(!o.name||!o.start){toast("Լրացրեք անվանումը և սկզբի ամսաթիվը։");return}
  if(o.end&&o.end<o.start){toast("Ավարտը չի կարող լինել սկզբից շուտ։");return}
  if(editingId)o.id=editingId;
  if(editingId&&!mayEdit(events.find(e=>e.id===editingId))){toast("Կարող եք խմբագրել միայն ձեր ավելացրածը");return}
  try{await saveEvent(o); closeForm(); toast("Պահպանված է")}catch(e){toast("Չհաջողվեց պահպանել"+(e.code==="invalid_argument"?"․ դուք խմբագրելու իրավունք չունեք":""))}
});
$("delBtn").onclick=()=>$("confirmBox").hidden=false;
$("noDel").onclick=()=>$("confirmBox").hidden=true;
$("yesDel").onclick=async()=>{if(mode==="db"&&!canEdit)return;try{await removeEvent(editingId); closeForm(); toast("Ջնջված է")}catch(e){toast("Չհաջողվեց ջնջել")}};
$("closeBtn").onclick=$("cancelBtn").onclick=closeForm;
$("overlay").addEventListener("click",e=>{if(e.target.id==="overlay")closeForm()});
document.addEventListener("keydown",e=>{if(e.key!=="Escape")return; if(dp){closeDP();return} if(!$("f_mat").hidden){closeMat();$("f_matBtn").focus();return} if(!$("overlay").hidden)closeForm(); else if(!$("listsOverlay").hidden)$("listsOverlay").hidden=true;});
$("addBtn").onclick=()=>openForm();
$("list").addEventListener("click",e=>{const b=e.target.closest(".ev"); if(b)openForm(b.dataset.id)});
$("q").addEventListener("input",render); $("person").addEventListener("change",render);
/* employees strip: same look as Այցեր / Միջոցառումներ, works together with the select */
const AVC=["#765999","#2f7d8c","#b0604a","#4f7a3a","#8a5a9e","#3e5fa8","#9a6b1f","#a24d74"];
function initials(n){return String(n||"?").replace(/[^\p{L}\s]/gu,"").trim().split(/\s+/).map(w=>w[0]).join("").slice(0,2)||"?"}
function avColor(n,list){const i=list.indexOf(n); let h=0; for(const c of String(n))h=(h*31+c.charCodeAt(0))>>>0; return AVC[(i>=0?i:h)%AVC.length]}
function renderReps(people,cur){ const box=$("reps"); if(!box)return;
  const cnt={}; events.forEach(e=>{if(e.responsible&&status(e)!=="past")cnt[e.responsible]=(cnt[e.responsible]||0)+1});
  box.innerHTML=`<button type="button" class="rep" data-r="" aria-pressed="${!cur}"><span class="av" style="background:var(--mark);color:var(--mark-ink)">✦</span>Բոլորը</button>`+
    people.map(p=>`<button type="button" class="rep" data-r="${esc(p)}" aria-pressed="${p===cur}"><span class="av" style="background:${avColor(p,people)}" aria-hidden="true">${esc(initials(p))}</span>${esc(p)} <em>${cnt[p]||0}</em></button>`).join("");
}
$("reps").addEventListener("click",e=>{const b=e.target.closest(".rep"); if(!b)return; $("person").value=b.dataset.r; render()});
document.querySelectorAll(".seg button").forEach(b=>b.onclick=()=>{filter=b.dataset.f;document.querySelectorAll(".seg button").forEach(x=>x.setAttribute("aria-pressed",x===b));render()});

/* ---------- CSV export (Google Sheets column order) ---------- */
const COLS=["Գրանցման ամսաթիվ","Միջոցառման ամսաթիվ","Ժամ","Կազմակերպություն","Ներկայացման ձևաչափ","Միջոցառման անվանում","Վայր","Պատասխանատու","Թիրախային լսարան","Տպագրական նյութեր"];
$("exportBtn").onclick=async()=>{
  const q=v=>/[",\n]/.test(v)?'"'+String(v).replace(/"/g,'""')+'"':v;
  const lines=[COLS.join(",")].concat([...events].sort((a,b)=>(a.start||"").localeCompare(b.start||"")).map(e=>
    [fmt(e.regDate),fmtRange(e),e.time,e.org,e.format,e.name,e.location,e.responsible,e.audience,e.materials].map(v=>q(v||"")).join(",")));
  const data="﻿"+lines.join("\n"), filename="promtest-events.csv";
  if(downloads){try{await downloads.save({filename,data});}catch(err){toast("Ներբեռնումը չեղարկվեց")}return}
  if(mode==="local"){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([data],{type:"text/csv"}));a.download=filename;a.click();return}
  toast("Ներբեռնումը այս դիտման մեջ հասանելի չէ");
};


/* ---------- month calendar (same as Այցեր / Միջոցառումներ) ---------- */
let calY=TODAY.getFullYear(), calM=TODAY.getMonth();
const CAL_WD=["Երկ","Երք","Չրք","Հնգ","Ուրբ","Շբթ","Կիր"];
function calMatch(e){
  const q=$("q").value.trim().toLowerCase(), person=$("person").value;
  if(person&&e.responsible!==person)return false;
  if(q&&![e.name,e.location,e.audience,e.org,e.format,e.materials,e.notes].join(" ").toLowerCase().includes(q))return false;
  return true}
function renderCal(){
  if(!$("calGrid"))return;
  $("calTitle").textContent=MONTHS[calM]+" "+calY;
  const first=new Date(calY,calM,1), off=(first.getDay()+6)%7, startD=new Date(calY,calM,1-off);
  const last=new Date(calY,calM+1,0), cells=Math.ceil((off+last.getDate())/7)*7;
  const by={}; events.filter(calMatch).forEach(e=>{const s=d(e.start); if(!s)return; const en=d(e.end)||s;
    for(let x=new Date(s);x<=en;x.setDate(x.getDate()+1)){const k=isoOf(x);(by[k]=by[k]||[]).push(e)}});
  const narrow=matchMedia("(max-width:640px)").matches, max=narrow?6:3, today=isoOf(TODAY);
  let h=CAL_WD.map((w,i)=>`<div class="cal-wd${i>4?" we":""}">${w}</div>`).join("");
  for(let i=0;i<cells;i++){
    const x=new Date(startD.getFullYear(),startD.getMonth(),startD.getDate()+i), k=isoOf(x), wd=i%7;
    const vs=(by[k]||[]).sort((a,b)=>(a.time||"99").localeCompare(b.time||"99"));
    const pills=vs.slice(0,max).map(e=>`<span class="pill part${status(e)==="past"?" past":""}" data-id="${esc(e.id)}" role="button" tabindex="0" title="${esc((e.time?e.time+" · ":"")+e.name+(e.location?" · "+e.location:""))}"><i class="dot" style="background:var(--accent)"></i><span>${e.time?esc(e.time)+" ":""}${esc(e.name)}</span></span>`).join("");
    h+=`<div class="day${x.getMonth()!==calM?" out":""}${wd>4?" we":""}${k===today?" today":""}" data-date="${k}" role="button" tabindex="0" aria-label="${x.getDate()} ${MONTHS[x.getMonth()]}${vs.length?", "+vs.length+" միջոցառում":""}">
      <div class="dn"><b>${x.getDate()}</b>${$("addBtn").hidden?"":'<span class="plus" aria-hidden="true">+</span>'}</div>
      <div class="pills">${pills}${vs.length>max?`<span class="more">+${vs.length-max}</span>`:""}</div></div>`;
  }
  $("calGrid").innerHTML=h;
}
function calClick(e){
  const p=e.target.closest(".pill"); if(p){openForm(p.dataset.id);return}
  const day=e.target.closest(".day"); if(!day)return;
  if($("addBtn").hidden){const v=events.find(x=>x.start===day.dataset.date); if(v)openForm(v.id); return}
  openForm(null,day.dataset.date);
}
$("calGrid").addEventListener("click",calClick);
$("calGrid").addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault(); calClick(e)}});
$("calPrev").onclick=()=>{calM--; if(calM<0){calM=11;calY--} renderCal()};
$("calNext").onclick=()=>{calM++; if(calM>11){calM=0;calY++} renderCal()};
$("calToday").onclick=()=>{calY=TODAY.getFullYear(); calM=TODAY.getMonth(); renderCal()};
addEventListener("resize",()=>{clearTimeout(renderCal.t); renderCal.t=setTimeout(renderCal,150)});
renderCal();

/* ---------- similar names in «Ցուցակներ»: suggest an existing one before adding a near-duplicate ---------- */
function simNorm(s){return String(s||"").toLowerCase().replace(/[^\p{L}\p{N}]+/gu," ").trim()}
function simLev(a,b){const m=a.length,n=b.length; if(!m)return n; if(!n)return m; let p=[...Array(n+1).keys()];
  for(let i=1;i<=m;i++){const c=[i]; for(let j=1;j<=n;j++)c[j]=Math.min(p[j]+1,c[j-1]+1,p[j-1]+(a[i-1]===b[j-1]?0:1)); p=c} return p[n]}
function similarNames(v,arr){
  const a=simNorm(v); if(a.length<2)return [];
  const aw=a.split(" "), flat=a.replace(/ /g,"");
  return arr.map(x=>{const b=simNorm(x), bf=b.replace(/ /g,""), bw=b.split(" "); let s=0;
    if(bf===flat)s=100;
    else if(flat.length>=3&&(bf.includes(flat)||flat.includes(bf)))s=80;
    else{ const d=simLev(flat,bf); if(d<=Math.max(1,Math.floor(Math.max(flat.length,bf.length)*.25)))s=70-d;
      aw.forEach(w=>bw.forEach(u=>{ if(w.length>=3&&w===u)s=Math.max(s,60); else if(w.length>=1&&u.length>=1&&(u.startsWith(w)||w.startsWith(u))&&Math.min(w.length,u.length)>=(aw.length>1?1:3))s=Math.max(s,40) })) }
    return {x,s}}).filter(o=>o.s>=40).sort((p,q)=>q.s-p.s).slice(0,4).map(o=>o.x);
}
function showSimilar(k,force){
  const inp=$("add_"+k), box=$("sim_"+k); if(!inp||!box)return [];
  const v=inp.value.trim(), list=similarNames(v,L(k)).filter(x=>x.toLowerCase()!==v.toLowerCase());
  if(!v||!list.length){box.hidden=true; box.innerHTML=""; return []}
  box.innerHTML=`<span>Նման անուն արդեն կա․ ընտրեք, եթե նույնն է՝</span>`+
    list.map(x=>`<button type="button" class="sim-use" data-k="${esc(k)}" data-v="${esc(x)}">${esc(x)}</button>`).join("")+
    (force?`<button type="button" class="sim-add" data-k="${esc(k)}">Ոչ, ավելացնել որպես նոր</button>`:"");
  box.hidden=false; return list;
}
$("listsBody").addEventListener("input",e=>{const t=e.target; if(t.id&&t.id.startsWith("add_"))showSimilar(t.id.slice(4),false)});
$("listsBody").addEventListener("click",async e=>{
  const u=e.target.closest(".sim-use"); if(u){const k=u.dataset.k; $("add_"+k).value=""; showSimilar(k); toast("«"+u.dataset.v+"»-ն արդեն ցուցակում է"); return}
  const a=e.target.closest(".sim-add"); if(a){const k=a.dataset.k, v=$("add_"+k).value.trim(); if(!v)return;
    const next=allLists(); next[k].push(v); try{await saveLists(next); toast("Ավելացվեց՝ "+v)}catch(err){toast("Չհաջողվեց պահպանել")}}
});

/* ---------- ✎ rename in «Ցուցակներ»: the new name replaces the old one in every list and every saved record on all pages ---------- */

/* renames done on any page are remembered and applied to this page's lists too (also when the lists were never saved) */
function applyRenames(){ let R={}; try{R=JSON.parse(localStorage.getItem("promtest-renames")||"{}")}catch(e){} if(!Object.keys(R).length)return;
  const map=x=>{let v=x, guard=0; while(R[String(v).toLowerCase()]&&guard++<10)v=R[String(v).toLowerCase()]; return v};
  const base=lists||allLists(); let ch=!lists; const out={};
  Object.keys(base).forEach(k=>{ if(!Array.isArray(base[k])){out[k]=base[k];return} const m=[...new Set(base[k].map(map))]; if(JSON.stringify(m)!==JSON.stringify(base[k]))ch=true; out[k]=m });
  if(ch){lists=out; try{localStorage.setItem(LISTS_KEY,JSON.stringify(lists))}catch(e){}} }
function renameEverywhere(oldV,newV){
  try{const R=JSON.parse(localStorage.getItem("promtest-renames")||"{}"); R[String(oldV).toLowerCase()]=newV; delete R[String(newV).toLowerCase()]; localStorage.setItem("promtest-renames",JSON.stringify(R))}catch(e){}
  if(!lists){ try{lists=allLists(); localStorage.setItem(LISTS_KEY,JSON.stringify(lists))}catch(e){} }
  const sameList=x=>String(x).trim().toLowerCase()===String(oldV).trim().toLowerCase();
  const fix=v=>{ if(Array.isArray(v))return [...new Set(v.map(x=>sameList(x)?newV:x))];
    if(typeof v==="string"){ if(sameList(v))return newV;
      if(v.includes(",")){const parts=v.split(/\s*,\s*/); if(parts.some(sameList))return [...new Set(parts.map(x=>sameList(x)?newV:x))].join(", ")} }
    return v };
  let n=0;
  ["promtest-lists-v1","promtest-crm-lists-v1"].forEach(key=>{ try{const o=JSON.parse(localStorage.getItem(key)||"null"); if(!o)return;
    Object.keys(o).forEach(k=>{ if(Array.isArray(o[k])){const b=JSON.stringify(o[k]); o[k]=fix(o[k]); if(JSON.stringify(o[k])!==b)n++} });
    localStorage.setItem(key,JSON.stringify(o))}catch(e){} });
  ["promtest-events-v1","promtest-visits-v1"].forEach(key=>{ try{const a=JSON.parse(localStorage.getItem(key)||"null"); if(!Array.isArray(a))return;
    a.forEach(r=>Object.keys(r).forEach(f=>{ if(f==="id"||f==="kind"||f==="status")return; const b=JSON.stringify(r[f]); r[f]=fix(r[f]); if(JSON.stringify(r[f])!==b)n++ }));
    localStorage.setItem(key,JSON.stringify(a))}catch(e){} });
  return n;
}
$("listsBody").addEventListener("click",e=>{
  const b=e.target.closest("button[data-ri]"); if(!b)return;
  const k=b.dataset.k, old=L(k)[+b.dataset.ri]; if(old==null)return;
  const chip=b.closest(".chip");
  chip.innerHTML=`<form class="ren-form"><input value="${esc(old)}" aria-label="Նոր անուն"><button type="submit">✓</button><button type="button" class="ren-x">✕</button></form>`;
  const inp=chip.querySelector("input"); inp.focus(); inp.select();
  chip.querySelector(".ren-x").onclick=()=>renderListsBody();
  chip.querySelector("form").onsubmit=ev=>{ev.preventDefault(); ev.stopPropagation(); const nv=inp.value.replace(/\s+/g," ").trim();
    if(!nv||nv===old){renderListsBody();return}
    renameEverywhere(old,nv); toast("«"+old+"» → «"+nv+"»՝ բոլոր էջերում"); setTimeout(()=>location.reload(),700)};
});
init();
