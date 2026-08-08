const $=id=>document.getElementById(id);
const fields=['roleName','basicSalary','carAllowance','pensionPct','mileageRate','annualMiles','overnightAllowance','bonus','mileageTaxFree','overnightTaxFree','growthPct'];
let region='rUK', currentId=null;
const money=n=>new Intl.NumberFormat('en-GB',{style:'currency',currency:'GBP',maximumFractionDigits:0}).format(Number(n)||0);
const clamp=(x,a,b)=>Math.max(a,Math.min(b,x));
function personalAllowance(income){return clamp(12570-Math.max(0,income-100000)/2,0,12570)}
function bandTax(amount,bands){let tax=0,lower=0;for(const [upper,rate] of bands){const slice=Math.max(0,Math.min(amount,upper)-lower);tax+=slice*rate;lower=upper;if(amount<=upper)break}return tax}
function incomeTax(gross,reg){
 const pa=personalAllowance(gross), taxable=Math.max(0,gross-pa);
 if(reg==='scotland') return bandTax(taxable,[[3967,.19],[16956,.20],[31092,.21],[62430,.42],[112570,.45],[Infinity,.48]]);
 return bandTax(taxable,[[37700,.20],[125140-pa,.40],[Infinity,.45]]);
}
function ni(gross){return Math.max(0,Math.min(gross,50270)-12570)*.08+Math.max(0,gross-50270)*.02}
function fvAnnual(c,r,y){return r===0?c*y:c*((Math.pow(1+r,y)-1)/r)*(1+r)}
function state(){const s={region};fields.forEach(id=>s[id]=$(id).type==='checkbox'?$(id).checked:$(id).value);return s}
function calc(s=state()){
 const basic=Math.max(0,+s.basicSalary||0),car=Math.max(0,+s.carAllowance||0),bonus=Math.max(0,+s.bonus||0),overnight=Math.max(0,+s.overnightAllowance||0),miles=Math.max(0,+s.annualMiles||0),rate=Math.max(0,+s.mileageRate||0),mileage=miles*rate;
 const pension=basic*(Math.max(0,+s.pensionPct||0)/100);
 const taxableExtras=(s.mileageTaxFree?0:mileage)+(s.overnightTaxFree?0:overnight);
 const taxFreeExtras=(s.mileageTaxFree?mileage:0)+(s.overnightTaxFree?overnight:0);
 const taxableGross=basic+car+bonus+taxableExtras;
 const adjustedTaxGross=Math.max(0,taxableGross-pension);
 const tax=incomeTax(adjustedTaxGross,s.region||'rUK');
 const nationalInsurance=ni(taxableGross);
 const takeHome=taxableGross-tax-nationalInsurance-pension+taxFreeExtras;
 const growth=Math.max(0,+s.growthPct||0)/100;
 return {pension,taxableGross,tax,nationalInsurance,taxFreeExtras,takeHome,packageCash:basic+car+bonus+overnight+mileage,pension10:fvAnnual(pension,growth,10),pensionContrib10:pension*10};
}
function render(){
 const c=calc();
 $('monthlyTakeHome').textContent=money(c.takeHome/12);$('annualTakeHome').textContent=money(c.takeHome);$('monthlyPension').textContent=money(c.pension/12);
 $('pension10').textContent=money(c.pension10);$('pension10Contrib').textContent=`${money(c.pensionContrib10)} contributed`;
 $('packageCash').textContent=money(c.packageCash);$('taxableGross').textContent=money(c.taxableGross);$('incomeTax').textContent='−'+money(c.tax);
 $('nationalInsurance').textContent='−'+money(c.nationalInsurance);$('annualPension').textContent='−'+money(c.pension);$('taxFreeExtras').textContent='+'+money(c.taxFreeExtras);renderCompare();
}
function getProfiles(){try{return JSON.parse(localStorage.getItem('salaryProfilesV1'))||[]}catch{return []}}
function setProfiles(p){localStorage.setItem('salaryProfilesV1',JSON.stringify(p));refreshProfiles()}
function save(){
 let profiles=getProfiles(),data=state();
 if(currentId){const i=profiles.findIndex(x=>x.id===currentId);if(i>=0)profiles[i]={...profiles[i],...data,updated:Date.now()};else currentId=null}
 if(!currentId){currentId=crypto.randomUUID?crypto.randomUUID():String(Date.now());profiles.push({id:currentId,...data,updated:Date.now()})}
 setProfiles(profiles);$('saveState').textContent='Saved';setTimeout(()=>$('saveState').textContent='Local',1200);
}
function load(p){
 currentId=p.id;region=p.region||'rUK';fields.forEach(id=>{if(p[id]!==undefined){if($(id).type==='checkbox')$(id).checked=!!p[id];else $(id).value=p[id]}});
 document.querySelectorAll('[data-region]').forEach(b=>b.classList.toggle('active',b.dataset.region===region));render();$('profilesDialog').close();
}
function blank(){currentId=null;$('roleName').value='New role';['basicSalary','carAllowance','annualMiles','overnightAllowance','bonus'].forEach(id=>$(id).value='0');$('pensionPct').value='3';$('mileageRate').value='0.45';$('growthPct').value='5';render()}
function duplicate(){currentId=null;$('roleName').value=($('roleName').value||'Role')+' copy';save()}
function esc(s){return String(s).replace(/[&<>'"]/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;',"'":'&#39;','"':'&quot;'}[c]))}
function refreshProfiles(){
 const profiles=getProfiles(),list=$('profilesList'),select=$('compareSelect'),existing=select.value;list.innerHTML='';select.innerHTML='<option value="">Choose a saved role…</option>';
 profiles.sort((a,b)=>b.updated-a.updated).forEach(p=>{
   const c=calc(p),row=document.createElement('div');row.className='profile-item';
   row.innerHTML=`<button class="profile-main"><strong>${esc(p.roleName||'Unnamed role')}</strong><span>${money(c.takeHome/12)}/month · ${money(c.takeHome)}/year</span></button><button class="delete-btn">Delete</button>`;
   row.querySelector('.profile-main').onclick=()=>load(p);
   row.querySelector('.delete-btn').onclick=()=>{if(confirm(`Delete ${p.roleName||'this role'}?`)){setProfiles(getProfiles().filter(x=>x.id!==p.id));if(currentId===p.id)currentId=null}};
   list.appendChild(row);const o=document.createElement('option');o.value=p.id;o.textContent=p.roleName||'Unnamed role';select.appendChild(o);
 });
 if([...select.options].some(o=>o.value===existing))select.value=existing;renderCompare();
}
function renderCompare(){
 const id=$('compareSelect').value,area=$('compareArea'),deltaEl=$('monthlyDelta');
 if(!id){area.className='compare-empty';area.textContent='Save at least one role, then select it here.';deltaEl.textContent='';return}
 const p=getProfiles().find(x=>x.id===id);if(!p)return;
 const a=calc(),b=calc(p),dm=a.takeHome/12-b.takeHome/12,da=a.takeHome-b.takeHome,cls=dm>=0?'good':'bad';
 area.className='compare-grid';area.innerHTML=`<div class="compare-box"><span>Saved role</span><strong>${esc(p.roleName||'Saved role')}</strong></div><div class="compare-box"><span>Monthly difference</span><strong class="delta ${cls}">${dm>=0?'+':'−'}${money(Math.abs(dm))}</strong></div><div class="compare-box"><span>Saved monthly</span><strong>${money(b.takeHome/12)}</strong></div><div class="compare-box"><span>Annual difference</span><strong class="delta ${cls}">${da>=0?'+':'−'}${money(Math.abs(da))}</strong></div>`;
 deltaEl.textContent=`${dm>=0?'+':'−'}${money(Math.abs(dm))} / month vs ${p.roleName||'saved role'}`;deltaEl.className=cls;
}
document.querySelectorAll('input').forEach(el=>el.addEventListener('input',render));
document.querySelectorAll('[data-region]').forEach(b=>b.onclick=()=>{region=b.dataset.region;document.querySelectorAll('[data-region]').forEach(x=>x.classList.toggle('active',x===b));render()});
$('saveBtn').onclick=save;$('newBtn').onclick=blank;$('duplicateBtn').onclick=duplicate;$('profilesBtn').onclick=()=>{refreshProfiles();$('profilesDialog').showModal()};
$('closeDialog').onclick=()=>$('profilesDialog').close();$('compareSelect').onchange=renderCompare;$('clearCompare').onclick=()=>{$('compareSelect').value='';renderCompare()};
refreshProfiles();render();
if('serviceWorker'in navigator)window.addEventListener('load',()=>navigator.serviceWorker.register('./sw.js'));