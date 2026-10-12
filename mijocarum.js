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
/* Prom-Test — Միջոցառումներ (mijocarum.html). Логика интерфейса.
   Сейчас данные хранятся в localStorage браузера (функции saveVisit/removeVisit/useLocal).
   Для сайта: заменить их на AJAX-запросы к PHP (см. README-для-программиста.md). */

const MONTHS=["Հունվար","Փետրվար","Մարտ","Ապրիլ","Մայիս","Հունիս","Հուլիս","Օգոստոս","Սեպտեմբեր","Հոկտեմբեր","Նոյեմբեր","Դեկտեմբեր"];
const MSHORT=["հնվ","փտր","մրտ","ապր","մյս","հնս","հլս","օգս","սեպ","հոկ","նոյ","դեկ"];
const LKEY="promtest-visits-v1", LISTS_KEY="promtest-crm-lists-v1";
const AVC=["#765999","#2f7d8c","#b0604a","#4f7a3a","#8a5a9e","#3e5fa8","#9a6b1f","#a24d74"];
const $=id=>document.getElementById(id);
let visits=[], filter="active", repF="", editingId=null, curStatus="open", mode="loading", col=null, subs=null, downloads=null;
let mainV=[], subDocs={}, me=null, canEdit=false, canWrite=true, userCap=null, lists=null, cfgRef=null;

/* ---------- data: shared db inside claude.ai, browser storage elsewhere ---------- */
function loadLocal(){try{return JSON.parse(localStorage.getItem(LKEY)||"[]")}catch(e){return []}}
function saveLocal(){try{localStorage.setItem(LKEY,JSON.stringify(visits))}catch(e){}}
function uid(){return Date.now().toString(36)+Math.random().toString(36).slice(2,7)}
function clean(v){const b={};for(const k in v)if(k!=="id"&&k[0]!=="_")b[k]=v[k];return b}
function mayEdit(v){return mode!=="db"||canEdit||(v&&v._src==="sub"&&v._owner===me)}
function merge(){visits=[...mainV,...Object.entries(subDocs).flatMap(([u,d])=>Object.entries((d&&d.entries)||{}).map(([id,e])=>({...e,id,_src:"sub",_owner:u})))];render()}
async function writeSub(owner,id,body){const cur={...((subDocs[owner]&&subDocs[owner].entries)||{})}; if(body===null)delete cur[id]; else cur[id]=body; await subs.doc(owner).set({entries:cur})}
async function saveVisit(v){
  const id=v.id||uid(), body=clean(v);
  if(mode!=="db"){const i=visits.findIndex(e=>e.id===id); if(i>=0)visits[i]={id,...body}; else visits.push({id,...body}); saveLocal(); render(); return}
  const ex=visits.find(e=>e.id===id);
  if(ex){ if(ex.addedBy)body.addedBy=ex.addedBy; if(ex.addedAt)body.addedAt=ex.addedAt; if(ex.legacy)body.legacy=ex.legacy; if(ex.docCount)body.docCount=ex.docCount;
    if(ex._src==="sub")return writeSub(ex._owner,id,body); return col.doc(id).set(body); }
  if(me)body.addedBy=me; body.addedAt=new Date().toISOString();
  if(canEdit)return col.doc(id).set(body);
  if(!me)throw {code:"invalid_argument"};
  return writeSub(me,id,body);
}
async function removeVisit(id){
  if(mode!=="db"){visits=visits.filter(e=>e.id!==id); saveLocal(); render(); return}
  const ex=visits.find(e=>e.id===id); if(!ex)return;
  if(ex._src==="sub")return writeSub(ex._owner,id,null);
  return col.doc(id).delete();
}
function applyPerms(){
  const db=mode==="db";
  $("addBtn").hidden=db&&(!canWrite||(!canEdit&&!me));
  $("listsBtn").hidden=db&&!canEdit;
  if($("mode"))$("mode").textContent=!db?"":canEdit?"Ընդհանուր տվյալներ · լիարժեք իրավունք":(canWrite&&me)?"Կարող եք ավելացնել այց և խմբագրել ձեր ավելացրածը":"Միայն դիտում";
}
function useLocal(){try{lists=JSON.parse(localStorage.getItem(LISTS_KEY)||"null")}catch(e){lists=null} applyRenames(); addNewOrgs(); mode="local"; visits=loadLocal(); applyPerms(); render(); handleHash()}
async function init(){
  render();
  if(!window.claude||!window.claude.use){useLocal();return}
  const db=await window.claude.use("db");
  if(!db){useLocal();return}
  userCap=await window.claude.use("user");
  if(userCap){canEdit=await userCap.canEdit(); me=await userCap.id(); const w=await userCap.can("data.write"); canWrite=w!==false}
  mode="db"; col=db.collection("visits"); subs=db.collection("subs"); cfgRef=db.doc("config/lists");
  applyPerms();
  const onErr=e=>toast("Տվյալները չհաջողվեց բեռնել ("+e.code+")։ Թարմացրեք էջը։");
  col.onSnapshot(s=>{mainV=s.docs.map(d=>({id:d.id,...d.data(),_src:"main"})); merge()},onErr);
  subs.onSnapshot(s=>{subDocs={}; s.docs.forEach(d=>{subDocs[d.id]=d.data()}); merge()},onErr);
  cfgRef.onSnapshot(s=>{lists=s.exists?s.data():null; render(); renderListsBody()},onErr);
  window.claude.use("downloads").then(d=>{downloads=d});
}


/* one-time: add new companies to lists already saved in this browser */
function addNewOrgs(){ const NEW=["Cell Therapy Center"]; let done={}; try{done=JSON.parse(localStorage.getItem("promtest-crm-orgs-added")||"{}")}catch(e){}
  if(!lists||!Array.isArray(lists.orgs))return; let ch=false;
  NEW.forEach(o=>{ if(done[o])return; done[o]=1; if(!lists.orgs.includes(o)){lists.orgs.push(o);ch=true} });
  try{ if(ch)localStorage.setItem(LISTS_KEY,JSON.stringify(lists)); localStorage.setItem("promtest-crm-orgs-added",JSON.stringify(done)) }catch(e){} }
/* ---------- lists ---------- */
const LIST_DEFS=[["reps","Մենեջերներ"],["clinics","Կլինիկաներ / վայրեր"],["tests","Թեստեր"],["objections","Առարկություններ"],["eventTypes","Միջոցառման տեսակներ"],["orgs","Կազմակերպություններ"]];
const DEFAULT_LISTS={
  reps:["Արմինե","Լուսինե","Աննա Ա.","Աննա Շ.","Անահիտ","Սիրուշ","Վարդան","Դիանա Բ."],
  clinics:["8-րդ պոլիկլինիկա","15-րդ պոլիկլինիկա","Շենգավիթ ԲԿ","Սլավմեդ","Հրազդան ԲԿ","Իզմիրլյան ԲԿ","Երևան ԲԿ","Զեյթուն պոլիկլինիկա","Նորք-Մարաշ ԲԿ","Սուրբ Գրիգոր Լուսավորիչ ԲԿ"],
  tests:["Femoflor","Androflor","HPV","NIFTY","CA 125","HE4","Հորմոններ","Սկրինինգներ","Իմունոքվանտեքս","Սպերմոգրամմա","Բակ. անալիզ","Վիրուսներ","Աուտոիմուն"],
  objections:["Թանկ է","Աշխատում են այլ լաբորատորիայի հետ","Պատասխանը երկար է","Նմուշառման հարց","Պետք է մտածել","Պացիենտները չեն համաձայնում"],
  eventTypes:["Կլոր սեղան","Պրեզենտացիա","Կոնֆերանս","Վեբինար"],
  orgs:["Prom-Test","Diagnostica","PetCT","Proftest","Cell Therapy Center"]};
function L(k){return lists&&Array.isArray(lists[k])?lists[k]:DEFAULT_LISTS[k]}
function allLists(){const o={};LIST_DEFS.forEach(([k])=>o[k]=[...L(k)]);return o}
async function saveLists(next){ if(mode==="db")await cfgRef.set(next); else{lists=next; try{localStorage.setItem(LISTS_KEY,JSON.stringify(next))}catch(e){} render(); renderListsBody()} }

/* ---------- helpers ---------- */
const TODAY=new Date(); TODAY.setHours(0,0,0,0);
function d(iso){if(!iso)return null; const [y,m,dd]=iso.split("-").map(Number); return new Date(y,m-1,dd)}
function isoOf(x){return x.getFullYear()+"-"+String(x.getMonth()+1).padStart(2,"0")+"-"+String(x.getDate()).padStart(2,"0")}
function fmt(iso){const x=d(iso); return x?String(x.getDate()).padStart(2,"0")+"."+String(x.getMonth()+1).padStart(2,"0")+"."+x.getFullYear():""}
function esc(s){return String(s??"").replace(/[&<>"]/g,c=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;"}[c]))}
function toast(msg){const t=$("toast"); t.textContent=msg; t.hidden=false; clearTimeout(toast.t); toast.t=setTimeout(()=>t.hidden=true,3200)}
function arr(v){return Array.isArray(v)?v:String(v||"").split(/\s*[,;]\s*/).filter(Boolean)}
function docs(v){return String(v.doctors||"").split(/\n+/).map(x=>x.trim()).filter(Boolean)}
function docN(v){return docs(v).length||+v.docCount||0}
function initials(n){return String(n||"?").replace(/[^\p{L}\s]/gu,"").trim().split(/\s+/).map(w=>w[0]).join("").slice(0,2)||"?"}
function avColor(n){const i=L("reps").indexOf(n); let h=0; for(const c of String(n))h=(h*31+c.charCodeAt(0))>>>0; return AVC[(i>=0?i:h)%AVC.length]}
function av(n){return `<span class="av" style="background:${avColor(n)}" aria-hidden="true">${esc(initials(n))}</span>`}
/* միջոցառումը ավարտված է, եթե օրն անցել է */
function status(v){ const x=d(v.date); if(!x)return"plan"; if(x>TODAY)return"plan"; if(+x===+TODAY)return"today"; return"done"}
function daysBetween(a,b){return Math.round((a-b)/864e5)}
function stateLabel(v){const s=status(v), x=d(v.date);
  if(s==="done")return"Ավարտված"; if(s==="today")return"Այսօր";
  if(s==="plan"){const n=daysBetween(x,TODAY); return n===1?"Վաղը":n+" օր հետո"}
  const n=daysBetween(TODAY,x); return n>365?"Բաց · "+Math.floor(n/365)+" տարի":"Ուշացած "+n+" օր"}

/* ---------- render ---------- */
const PAGE="event"; /* այս էջը՝ միջոցառումներ */
let calY=TODAY.getFullYear(), calM=TODAY.getMonth(), tab=PAGE;
function kind(v){return v.kind==="event"?"event":"visit"}
const TXT_T={visit:{add:"+ Նոր այց",sub:"Բժիշկների և կլինիկաների այցեր, պայմանավորվածություններ և առարկություններ",hint:"Սեղմեք օրվա վրա՝ նոր այց ավելացնելու, կամ այցի վրա՝ բացելու համար",list:"Այցերի ցուցակ",unit:"այց",q:"Որոնել՝ կլինիկա, բժիշկ, թեստ, թեմա…"},
  event:{add:"+ Նոր միջոցառում",sub:"Կլոր սեղաններ, պրեզենտացիաներ և կոնֆերանսներ՝ բանախոսներով և մասնակիցներով",hint:"Սեղմեք օրվա վրա՝ նոր միջոցառում ավելացնելու, կամ միջոցառման վրա՝ բացելու համար",list:"Միջոցառումների ցուցակ",unit:"միջոցառում",q:"Որոնել՝ տեսակ, վայր, բանախոս, թեմա…"}};
function setTab(t){tab=t; document.querySelectorAll(".tabs button").forEach(b=>b.setAttribute("aria-selected",String(b.dataset.t===t)));
  const T=TXT_T[t]; $("addBtn").textContent=T.add; $("subline").textContent=T.sub; $("calHint").textContent=T.hint; $("listHead").textContent=T.list; $("q").placeholder=T.q; render()}
document.querySelectorAll(".tabs button").forEach(b=>b.onclick=()=>setTab(b.dataset.t));
function matches(v){
  const q=$("q").value.trim().toLowerCase(), clinic=$("clinicF").value;
  if(repF&&v.rep!==repF)return false;
  if(clinic&&v.clinic!==clinic)return false;
  const acc=$("accF")?$("accF").value:""; if(acc&&(v.access||"public")!==acc)return false;
  if(q&&![v.clinic,v.rep,v.doctors,v.etype,v.ename,v.speaker,arr(v.tests).join(" "),v.topic,v.agreement,arr(v.objections).join(" "),v.notes].join(" ").toLowerCase().includes(q))return false;
  return true}
function renderCal(){
  $("calTitle").textContent=MONTHS[calM]+" "+calY;
  const first=new Date(calY,calM,1), off=(first.getDay()+6)%7, start=new Date(calY,calM,1-off);
  const last=new Date(calY,calM+1,0), cells=Math.ceil((off+last.getDate())/7)*7;
  const by={}; visits.filter(v=>matches(v)&&kind(v)===PAGE).forEach(v=>{if(v.date)(by[v.date]=by[v.date]||[]).push(v)});
  const canAdd=!$("addBtn").hidden, narrow=matchMedia("(max-width:640px)").matches, max=narrow?6:3;
  let h=WD.map((w,i)=>`<div class="cal-wd${i>4?" we":""}">${w}</div>`).join("");
  for(let i=0;i<cells;i++){
    const x=new Date(start.getFullYear(),start.getMonth(),start.getDate()+i), iso=isoOf(x), wd=i%7;
    const vs=(by[iso]||[]).sort((a,b)=>(a.time||"99").localeCompare(b.time||"99"));
    const pills=vs.slice(0,max).map(v=>{const st=status(v), ev=kind(v)==="event";
      return `<span class="pill${ev?" event":""} ${st==="late"&&!ev?"late":st==="done"?"done":""}" data-id="${esc(v.id)}" role="button" tabindex="0" title="${esc((v.time?v.time+" · ":"")+(ev?(v.etype||"")+" · "+(v.ename||v.topic||""):"")+(v.clinic||"")+(v.rep?" · "+v.rep:""))}"><i class="dot" style="background:${v.rep?avColor(v.rep):"var(--past)"}"></i><span>${v.time?esc(v.time)+" ":""}${esc(ev?(v.etype||"Միջոցառում"):(v.clinic||"—"))}</span></span>`}).join("");
    h+=`<div class="day${x.getMonth()!==calM?" out":""}${wd>4?" we":""}${iso===isoOf(TODAY)?" today":""}" data-date="${iso}" role="button" tabindex="0" aria-label="${x.getDate()} ${MONTHS[x.getMonth()]}${vs.length?", "+vs.length+" այց":""}">
      <div class="dn"><b>${x.getDate()}</b>${canAdd?'<span class="plus" aria-hidden="true">+</span>':""}</div>
      <div class="pills">${pills}${vs.length>max?`<span class="more">+${vs.length-max}</span>`:""}</div></div>`;
  }
  $("calGrid").innerHTML=h;
}
function calClick(e){
  const p=e.target.closest(".pill"); if(p){openForm(p.dataset.id);return}
  const day=e.target.closest(".day"); if(!day)return;
  const vs=visits.filter(v=>v.date===day.dataset.date&&matches(v)&&kind(v)===tab);
  if($("addBtn").hidden){ if(vs.length)openForm(vs[0].id); return }
  openForm(null,day.dataset.date);
}
$("calGrid").addEventListener("click",calClick);
$("calGrid").addEventListener("keydown",e=>{if(e.key==="Enter"||e.key===" "){e.preventDefault(); calClick(e)}});
$("calPrev").onclick=()=>{calM--; if(calM<0){calM=11;calY--} renderCal()};
$("calNext").onclick=()=>{calM++; if(calM>11){calM=0;calY++} renderCal()};
$("calToday").onclick=()=>{calY=TODAY.getFullYear(); calM=TODAY.getMonth(); renderCal()};
let rzT; addEventListener("resize",()=>{clearTimeout(rzT); rzT=setTimeout(renderCal,150)});
function render(){
  const ym=isoOf(TODAY).slice(0,7), all=visits, T=TXT_T[tab];
  if($("cntVisit"))$("cntVisit").textContent=all.filter(v=>kind(v)==="visit"&&status(v)!=="done").length;
  if($("cntEvent"))$("cntEvent").textContent=all.filter(v=>kind(v)==="event"&&status(v)!=="done").length;
  { const visits=all.filter(v=>kind(v)===tab);
  const thisM=visits.filter(v=>(v.date||"").startsWith(ym));
  const late=visits.filter(v=>status(v)==="late").length;
  const plan=visits.filter(v=>status(v)==="plan"||status(v)==="today").length;
  const tc={}; visits.forEach(v=>arr(v.tests).forEach(t=>tc[t]=(tc[t]||0)+1));
  const top=Object.entries(tc).sort((a,b)=>b[1]-a[1]).slice(0,3).map(x=>x[0]);
  const part=visits.filter(v=>(v.date||"").slice(0,4)===ym.slice(0,4)).reduce((s,v)=>s+(+v.participants||0),0);
  $("summary").innerHTML=tab==="event"?`
    <div class="stat"><b>${thisM.length}</b><span>Միջոցառումներ այս ամիս</span></div>
    <div class="stat"><b>${plan}</b><span>Առաջիկա</span></div>
    <div class="stat"><b>${part}</b><span>Մասնակիցներ այս տարի</span></div>
    <div class="stat top"><b>${top.length?top.map(esc).join(" · "):"—"}</b><span>Ներկայացված թեստեր</span></div>`:`
    <div class="stat"><b>${thisM.length}</b><span>Այցեր այս ամիս</span></div>
    <div class="stat"><b>${plan}</b><span>Պլանավորված</span></div>
    <div class="stat top"><b>${top.length?top.map(esc).join(" · "):"—"}</b><span>Ամենաշատ քննարկված թեստեր</span></div>`;

  // reps strip
  const rc={}; visits.forEach(v=>{if(v.rep)rc[v.rep]=(rc[v.rep]||0)+(status(v)!=="done"?1:0)});
  window._rc=rc; }
  const rc=window._rc;
  const reps=(a=>{const m=new Map(); a.forEach(x=>{const n=String(x||"").replace(/\s+/g," ").trim(); if(n&&!m.has(n.toLowerCase()))m.set(n.toLowerCase(),n)}); return [...m.values()]})([...L("reps"),...visits.map(v=>v.rep)]);
  $("reps").innerHTML=`<button type="button" class="rep" data-r="" aria-pressed="${!repF}"><span class="av" style="background:var(--mark);color:var(--mark-ink)">✦</span>Բոլորը</button>`+
    reps.map(r=>`<button type="button" class="rep" data-r="${esc(r)}" aria-pressed="${repF===r}">${av(r)}${esc(r)} <em>${rc[r]||0}</em></button>`).join("");

  const cs=$("clinicF"), cur=cs.value, clinics=[...new Set([...L("clinics"),...visits.map(v=>v.clinic).filter(Boolean)])].sort((a,b)=>a.localeCompare(b,"hy"));
  cs.innerHTML='<option value="">Բոլոր կլինիկաները</option>'+clinics.map(c=>`<option${c===cur?" selected":""}>${esc(c)}</option>`).join("");

  renderCal();
  const list=$("list");
  if(mode==="loading"){list.innerHTML='<div class="empty">Բեռնվում է…</div>';return}
  if(!visits.some(v=>kind(v)===tab)){list.innerHTML=`<div class="empty"><strong>${tab==="event"?"Միջոցառումներ դեռ չկան":"Այցեր դեռ չկան"}</strong>${tab==="event"?"Այստեղ կերևան կլոր սեղանները, պրեզենտացիաները և կոնֆերանսները։ Սեղմեք օրացույցի օրվա վրա կամ կոճակին։":"Այստեղ կերևան մենեջերների այցերը՝ ըստ ամիսների։ Ավելացրեք առաջինը։"}
    ${$("addBtn").hidden?"":`<div class="actions"><button type="button" class="primary" onclick="openForm()">${T.add}</button></div>`}</div>`;return}

  const q=$("q").value.trim().toLowerCase(), clinic=cs.value;
  let rows=visits.filter(v=>{const s=status(v); if(kind(v)!==tab)return false;
    if(filter==="active"&&s==="done")return false;
    if(filter==="done"&&s!=="done")return false;
    return matches(v)});
  if(!rows.length){list.innerHTML='<div class="empty"><strong>Համընկնումներ չկան</strong>Փոխեք որոնումը, մենեջերին կամ ֆիլտրը։</div>';return}
  // active: upcoming first (soonest), then overdue (newest first); otherwise newest first
  const key=v=>v.date||"";
  if(filter==="active"){rows.sort((a,b)=>{const pa=status(a)==="late"?1:0,pb=status(b)==="late"?1:0; if(pa!==pb)return pa-pb; return pa?key(b).localeCompare(key(a)):key(a).localeCompare(key(b))})}
  else rows.sort((a,b)=>key(b).localeCompare(key(a)));

  const groups=[]; let last=null;
  rows.forEach(v=>{const late=filter==="active"&&status(v)==="late"; const k=late?"late":(v.date||"0000-00").slice(0,7);
    if(!last||last.k!==k){last={k,items:[]};groups.push(last)} last.items.push(v)});
  list.innerHTML=groups.map(g=>{
    let h; if(g.k==="late")h=tab==="event"?"Չփակված միջոցառումներ":"Բաց այցեր՝ ժամկետն անցած";
    else{const [y,m]=g.k.split("-").map(Number); h=m?MONTHS[m-1]+" "+y:"Առանց ամսաթվի"}
    return `<section class="month"><h2>${h} <small>${g.items.length} ${T.unit}</small></h2>${g.items.map(card).join("")}</section>`}).join("");
}
function card(v){
  if(kind(v)==="event")return eventCard(v);
  const s=status(v), x=d(v.date), n=docN(v), ds=docs(v);
  const who=ds.length?esc(ds.slice(0,2).join(", "))+(ds.length>2?` <i>+${ds.length-2}</i>`:""):(n?n+" բժիշկ":"");
  const chips=arr(v.tests).map(t=>`<span class="chip test">${esc(t)}</span>`).join("")+
    arr(v.objections).map(o=>`<span class="chip obj">${esc(o)}</span>`).join("")+
    (v.legacy?'<span class="chip">Հին CRM-ից</span>':"");
  return `<button type="button" class="ev ${s==="done"?"done":""}" data-id="${esc(v.id)}">
    <div class="date"><b>${x?x.getDate():"?"}</b><span>${x?MSHORT[x.getMonth()]+(x.getFullYear()!==TODAY.getFullYear()?"<br>"+x.getFullYear():""):""}${v.time?"<br>"+esc(v.time):""}</span></div>
    <div class="body">
      <div class="title">${esc(v.clinic||"Կլինիկա նշված չէ")}${n?`<small>${n} բժիշկ</small>`:""}</div>
      <div class="meta">${v.rep?`<span class="who">${av(v.rep)}${esc(v.rep)}</span>`:""}${who&&ds.length?`<span>${who}</span>`:""}</div>
      ${v.topic?`<div class="line"><i>Թեմա՝</i> ${esc(v.topic)}</div>`:""}
      ${v.agreement?`<div class="line"><i>Պայմանավորվածություն՝</i> ${esc(v.agreement)}</div>`:""}
      ${chips?`<div class="chips">${chips}</div>`:""}
    </div>
    <span class="state ${s}">${stateLabel(v)}</span></button>`;
}

function eventCard(v){
  const s=status(v), x=d(v.date);
  const chips=`<span class="chip kind">${esc(v.etype||"Միջոցառում")}</span>`+(v.access==="private"?'<span class="chip acc private">🔒 Private</span>':'<span class="chip acc public">🌐 Public</span>')+(v.org?`<span class="chip">${esc(v.org)}</span>`:"")+(v.participants?`<span class="chip">${esc(v.participants)} մասնակից</span>`:"")+arr(v.tests).map(t=>`<span class="chip test">${esc(t)}</span>`).join("");
  const lbl=s==="late"?"Չի փակվել":stateLabel(v);
  return `<button type="button" class="ev ${s==="done"?"done":""}" data-id="${esc(v.id)}">
    <div class="date"><b>${x?x.getDate():"?"}</b><span>${x?MSHORT[x.getMonth()]+(x.getFullYear()!==TODAY.getFullYear()?"<br>"+x.getFullYear():""):""}${v.time?"<br>"+esc(v.time):""}</span></div>
    <div class="body">
      <div class="title">${esc(v.ename||v.etype||"Միջոցառում")}${v.clinic?`<small>📍 ${esc(v.clinic)}</small>`:""}</div>
      <div class="meta">${v.rep?`<span class="who">${av(v.rep)}${esc(v.rep)}</span>`:""}${v.speaker?`<span>🎤 ${esc(v.speaker)}</span>`:""}</div>
      ${v.topic?`<div class="line"><i>Թեմա՝</i> ${esc(v.topic)}</div>`:""}
      <div class="chips">${chips}</div>
    </div>
    <span class="state ${s==="late"?"late":s}">${lbl}</span></button>`;
}

/* ---------- multi-select dropdowns ---------- */
function setupMsel(key,btnId,popId,listKey){
  const btn=$(btnId), pop=$(popId);
  const upd=()=>{const v=[...pop.querySelectorAll("input:checked")].map(i=>i.value); btn.textContent=v.length?v.join(", "):"— Ընտրել —"; btn.classList.toggle("ph",!v.length)};
  btn.addEventListener("click",()=>{const open=pop.hidden; closeAllMsel(); pop.hidden=!open; btn.setAttribute("aria-expanded",String(open)); if(open){const f=pop.querySelector("input"); if(f)f.focus()}});
  pop.addEventListener("change",upd);
  return {fill(val,ro){const cur=arr(val), base=L(listKey), opts=[...base,...cur.filter(x=>!base.includes(x))];
      pop.innerHTML=opts.map((v,i)=>`<label class="check"><input type="checkbox" id="${key}_${i}" value="${esc(v)}"${cur.includes(v)?" checked":""}${ro?" disabled":""}>${esc(v)}</label>`).join("")||'<span class="hint">Ցուցակը դատարկ է</span>';
      btn.disabled=ro; upd()},
    get(){return [...pop.querySelectorAll("input:checked")].map(i=>i.value)}, pop, btn};
}
const MS={tests:setupMsel("t","f_testsBtn","f_tests","tests"), obj:setupMsel("o","f_objBtn","f_obj","objections")};
function closeAllMsel(){Object.values(MS).forEach(m=>{m.pop.hidden=true; m.btn.setAttribute("aria-expanded","false")})}
document.addEventListener("click",e=>{if(!(e.target.closest&&e.target.closest(".msel-wrap")))closeAllMsel()});

/* ---------- date picker ---------- */
const WD=["Երկ","Երք","Չրք","Հնգ","Ուրբ","Շբթ","Կիր"];
function parseDMY(s){s=String(s||"").trim(); if(!s)return ""; const m=s.match(/^(\d{1,2})[.\/\-\s](\d{1,2})[.\/\-\s](\d{4})$/); if(!m)return null;
  const dd=+m[1],mo=+m[2],y=+m[3],x=new Date(y,mo-1,dd); return x.getFullYear()===y&&x.getMonth()===mo-1&&x.getDate()===dd?isoOf(x):null}
let dp=null;
function openDP(input){if(input.disabled)return; if(dp&&dp.input===input)return; closeDP();
  const iso=parseDMY(input.value), base=iso?d(iso):new Date(); dp={input,y:base.getFullYear(),m:base.getMonth()};
  const pop=document.createElement("div"); pop.className="dp"; pop.id="dp"; pop.setAttribute("role","dialog"); pop.setAttribute("aria-label","Օրացույց");
  input.parentNode.appendChild(pop); renderDP()}
function closeDP(){const p=$("dp"); if(p)p.remove(); dp=null}
function renderDP(){const pop=$("dp"); if(!pop||!dp)return;
  const sel=parseDMY(dp.input.value), today=isoOf(TODAY), offset=(new Date(dp.y,dp.m,1).getDay()+6)%7, days=new Date(dp.y,dp.m+1,0).getDate();
  let cells=""; for(let i=0;i<offset;i++)cells+="<span></span>";
  for(let n=1;n<=days;n++){const iso=isoOf(new Date(dp.y,dp.m,n)); cells+=`<button type="button" class="dp-d${iso===sel?" sel":""}${iso===today?" today":""}" data-iso="${iso}">${n}</button>`}
  pop.innerHTML=`<div class="dp-h"><button type="button" class="dp-nav" data-nav="-1" aria-label="Նախորդ ամիս">‹</button><b>${MONTHS[dp.m]} ${dp.y}</b><button type="button" class="dp-nav" data-nav="1" aria-label="Հաջորդ ամիս">›</button></div>
    <div class="dp-g">${WD.map(w=>`<i>${w}</i>`).join("")}${cells}</div><div class="dp-f"><button type="button" data-act="today">Այսօր</button><button type="button" data-act="clear">Մաքրել</button></div>`}
document.addEventListener("focusin",e=>{if(e.target.classList&&e.target.classList.contains("date-in"))openDP(e.target)});
document.addEventListener("click",e=>{const inp=e.target.closest&&e.target.closest(".date-in"); if(inp){openDP(inp);return}
  const b=e.target.closest&&e.target.closest(".dp button"); if(!b){if(dp&&!e.target.closest(".dp"))closeDP();return}
  e.preventDefault();
  if(b.dataset.nav){dp.m+=+b.dataset.nav; if(dp.m<0){dp.m=11;dp.y--} if(dp.m>11){dp.m=0;dp.y++} renderDP(); return}
  const input=dp.input; if(b.dataset.iso)input.value=fmt(b.dataset.iso); else if(b.dataset.act==="today")input.value=fmt(isoOf(TODAY)); else input.value="";
  closeDP(); input.focus(); closeDP()});
document.addEventListener("change",e=>{if(e.target.classList&&e.target.classList.contains("date-in")){const iso=parseDMY(e.target.value); if(iso)e.target.value=fmt(iso)}});

/* ---------- form ---------- */
function fillSelect(id,opts,cur){const o=[...opts]; if(cur&&!o.includes(cur))o.unshift(cur);
  $(id).innerHTML=`<option value="" disabled hidden${cur?"":" selected"}>— Ընտրել —</option>`+o.map(v=>`<option value="${esc(v)}"${v===cur?" selected":""}>${esc(v)}</option>`).join("")}
let curAccess="public";
function setAccess(a){curAccess=a==="private"?"private":"public"; document.querySelectorAll(".accseg button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.a===curAccess)))}
function setStatus(s){curStatus=s; document.querySelectorAll(".statusseg button").forEach(b=>b.setAttribute("aria-pressed",String(b.dataset.s===s)))}
const TXT={time:"f_time",doctors:"f_docs",topic:"f_topic",agreement:"f_agree",notes:"f_notes",ename:"f_ename",speaker:"f_speaker",participants:"f_part"};
let formKind="visit";
function openForm(id,date){
  editingId=id||null; const v=visits.find(e=>e.id===id)||{date:date||isoOf(TODAY),rep:repF||"",kind:tab};
  formKind=kind(v); const isE=formKind==="event"; $("form").dataset.kind=formKind;
  $("clinicLbl").textContent=isE?"Վայր / կլինիկա":"Կլինիկա *"; $("testsLbl").textContent=isE?"Ներկայացվող թեստեր":"Քննարկված թեստեր";
  $("delQ").textContent=isE?"Ջնջե՞լ այս միջոցառումը։":"Ջնջե՞լ այս այցը։";
  fillSelect("f_etype",L("eventTypes"),v.etype||""); fillSelect("f_org",L("orgs"),v.org||"");
  const ro=!!id&&!mayEdit(v);
  $("f_date").value=fmt(v.date); fillSelect("f_rep",L("reps"),v.rep||""); fillSelect("f_clinic",L("clinics"),v.clinic||"");
  for(const [k,el] of Object.entries(TXT))$(el).value=v[k]||"";
  if(!ds_ok(v)&&v.docCount)$("f_docs").placeholder=v.docCount+" բժիշկ (անունները չեն ներմուծվել)"; else $("f_docs").placeholder="";
  MS.tests.fill(v.tests,ro); MS.obj.fill(v.objections,ro); setStatus(v.status||"open"); setAccess(v.access);
  ["f_date","f_rep","f_clinic","f_etype","f_org",...Object.values(TXT)].forEach(i=>$(i).disabled=ro);
  document.querySelectorAll(".statusseg button,.accseg button").forEach(b=>b.disabled=ro);
  $("saveBtn").hidden=ro; $("cancelBtn").textContent=ro?"Փակել":"Չեղարկել";
  $("formTitle").textContent=isE?(!id?"Նոր միջոցառում":ro?"Միջոցառում":"Խմբագրել միջոցառումը"):(!id?"Նոր այց":ro?"Այց":"Խմբագրել այցը");
  $("delBtn").hidden=!id||(mode==="db"&&!canEdit); $("confirmBox").hidden=true; closeAllMsel(); $("overlay").hidden=false; (ro?$("closeBtn"):$(isE?"f_etype":"f_clinic")).focus();
}
function ds_ok(v){return docs(v).length>0}
function closeForm(){closeDP(); closeAllMsel(); $("overlay").hidden=true; editingId=null}
document.querySelectorAll(".statusseg button").forEach(b=>b.onclick=()=>setStatus(b.dataset.s));
document.querySelectorAll(".accseg button").forEach(b=>b.onclick=()=>setAccess(b.dataset.a));
$("form").addEventListener("submit",async ev=>{
  ev.preventDefault();
  const isE=formKind==="event";
  const o={kind:formKind,date:parseDMY($("f_date").value),rep:$("f_rep").value,clinic:$("f_clinic").value,tests:MS.tests.get()};
  for(const [k,el] of Object.entries(TXT))o[k]=$(el).value.trim();
  if(isE){o.access=curAccess; o.etype=$("f_etype").value; o.org=$("f_org").value; o.participants=o.participants.replace(/[^\d]/g,""); delete o.doctors; delete o.agreement}
  else{o.objections=MS.obj.get(); delete o.ename; delete o.speaker; delete o.participants}
  if(o.date===null){toast("Ամսաթիվը գրեք օր.ամիս.տարի ձևով, օր.՝ 15.10.2026");$("f_date").focus();return}
  if(isE?(!o.date||!o.etype):(!o.date||!o.clinic)){toast(isE?"Լրացրեք ամսաթիվը և միջոցառման տեսակը։":"Լրացրեք ամսաթիվը և կլինիկան։");return}
  if(editingId){o.id=editingId; if(!mayEdit(visits.find(e=>e.id===editingId))){toast("Կարող եք խմբագրել միայն ձեր ավելացրածը");return}}
  try{await saveVisit(o); closeForm(); toast("Պահպանված է")}catch(e){toast("Չհաջողվեց պահպանել"+(e.code==="invalid_argument"?"․ խմբագրելու իրավունք չունեք":""))}
});
$("delBtn").onclick=()=>$("confirmBox").hidden=false;
$("noDel").onclick=()=>$("confirmBox").hidden=true;
$("yesDel").onclick=async()=>{if(mode==="db"&&!canEdit)return; try{await removeVisit(editingId); closeForm(); toast("Ջնջված է")}catch(e){toast("Չհաջողվեց ջնջել")}};
$("closeBtn").onclick=$("cancelBtn").onclick=closeForm;
$("overlay").addEventListener("click",e=>{if(e.target.id==="overlay")closeForm()});
document.addEventListener("keydown",e=>{if(e.key!=="Escape")return; if(dp){closeDP();return} if(Object.values(MS).some(m=>!m.pop.hidden)){closeAllMsel();return} if(!$("overlay").hidden)closeForm(); else if(!$("listsOverlay").hidden)$("listsOverlay").hidden=true});
$("addBtn").onclick=()=>openForm();
$("list").addEventListener("click",e=>{const b=e.target.closest(".ev"); if(b)openForm(b.dataset.id)});
$("reps").addEventListener("click",e=>{const b=e.target.closest(".rep"); if(!b)return; repF=b.dataset.r; render()});
$("q").addEventListener("input",render); $("clinicF").addEventListener("change",render); if($("accF"))$("accF").addEventListener("change",render);
document.querySelectorAll(".seg button").forEach(b=>b.onclick=()=>{filter=b.dataset.f; document.querySelectorAll(".seg button").forEach(x=>x.setAttribute("aria-pressed",String(x===b))); render()});

/* ---------- lists manager ---------- */
function renderListsBody(){ if($("listsOverlay").hidden)return;
  $("listsBody").innerHTML=LIST_DEFS.filter(([k])=>PAGE==="event"?k!=="objections":k!=="eventTypes").map(([k,t])=>{const a=L(k);
    return `<section class="listsec"><h4>${t} <small>${a.length}</small></h4>
    <div class="chips">${a.map((v,i)=>`<span class="chip edit">${esc(v)}<button type="button" class="ren" data-k="${k}" data-ri="${i}" aria-label="Փոխել ${esc(v)}" title="Փոխել անունը բոլոր էջերում">✎</button><button type="button" data-k="${k}" data-i="${i}" aria-label="Հեռացնել ${esc(v)}">✕</button></span>`).join("")||'<span class="hint">Դատարկ է</span>'}</div>
    <form class="addrow" data-k="${k}"><input id="add_${k}" autocomplete="off" placeholder="Նոր անուն" aria-label="Նոր անուն՝ ${t}"><button type="submit">Ավելացնել</button></form><div class="similar" id="sim_${k}" hidden></div></section>`}).join("")}
$("listsBtn").onclick=()=>{$("listsOverlay").hidden=false; renderListsBody()};
$("listsClose").onclick=()=>$("listsOverlay").hidden=true;
$("listsOverlay").addEventListener("click",e=>{if(e.target.id==="listsOverlay")$("listsOverlay").hidden=true});
$("listsBody").addEventListener("click",async e=>{const b=e.target.closest("button[data-i]"); if(!b)return;
  const next=allLists(); const [v]=next[b.dataset.k].splice(+b.dataset.i,1);
  try{await saveLists(next); toast("Հեռացվեց՝ "+v)}catch(err){toast("Չհաջողվեց պահպանել")}});
$("listsBody").addEventListener("submit",async e=>{e.preventDefault(); const k=e.target.dataset.k, v=$("add_"+k).value.trim(); if(!v)return;
  const next=allLists(); if(next[k].some(x=>x.toLowerCase()===v.toLowerCase())){toast("Արդեն կա ցուցակում");return}
  if(showSimilar(k,true).length){toast("Ստուգեք՝ գուցե այդ անունն արդեն կա");return}
  next[k].push(v); try{await saveLists(next); $("add_"+k)&&$("add_"+k).focus()}catch(err){toast("Չհաջողվեց պահպանել")}});

/* ---------- CSV export ---------- */
const COLS=["Տեսակ","Ամսաթիվ","Ժամ","Մենեջեր","Կլինիկա / վայր","Միջոցառում","Կազմակերպություն","Բանախոս","Մասնակիցներ","Բժիշկներ","Թեստեր","Թեմա","Պայմանավորվածություն","Առարկություններ","Կարգավիճակ","Նշումներ"];
$("exportBtn").onclick=async()=>{
  const q=v=>/[",\n]/.test(v)?'"'+String(v).replace(/"/g,'""')+'"':v;
  const lines=[COLS.join(",")].concat([...visits].sort((a,b)=>(a.date||"").localeCompare(b.date||"")).map(v=>
    [kind(v)==="event"?(v.etype||"Միջոցառում"):"Այց",fmt(v.date),v.time,v.rep,v.clinic,v.ename,v.org,v.speaker,v.participants,docs(v).join("; ")||(v.docCount?v.docCount+" բժիշկ":""),arr(v.tests).join("; "),v.topic,v.agreement,arr(v.objections).join("; "),stateLabel(v),v.notes].map(x=>q(String(x||""))).join(",")));
  const data="﻿"+lines.join("\n"), filename="promtest-crm.csv";
  if(downloads){try{await downloads.save({filename,data})}catch(err){toast("Ներբեռնումը չեղարկվեց")}return}
  if(mode==="local"){const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([data],{type:"text/csv"}));a.download=filename;a.click();return}
  toast("Ներբեռնումը այս դիտման մեջ հասանելի չէ");
};
/* links from the start page: #new, #new-event, #events */
function handleHash(){const h=location.hash; if(!h)return;
  try{history.replaceState(null,"",location.pathname)}catch(e){}
  if(h==="#new")openForm();}

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

/* names already used in saved records (but missing from «Ցուցակներ») are added back, so they can be renamed with ✎ */
$("harvestBtn").onclick=async()=>{
  const next=allLists(), F={reps:v=>[v.rep],clinics:v=>[v.clinic],tests:v=>arr(v.tests),objections:v=>arr(v.objections),eventTypes:v=>[v.etype],orgs:v=>[v.org]}; let n=0;
  Object.keys(F).forEach(k=>{ if(!next[k])next[k]=[]; visits.forEach(v=>F[k](v).forEach(x=>{x=String(x||"").trim(); if(x&&!next[k].some(y=>y.toLowerCase()===x.toLowerCase())){next[k].push(x);n++}})) });
  if(!n){toast("Նոր անուններ չգտնվեցին");return}
  try{await saveLists(next); toast("Ավելացվեց "+n+" անուն")}catch(e){toast("Չհաջողվեց պահպանել")}
};
init();
