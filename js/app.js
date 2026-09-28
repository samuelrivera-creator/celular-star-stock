let products=[],activeBrand="Todos",activeBranch="ALL",selected=null,maxQty=1;
const API_BASE=localStorage.getItem("CELULAR_STAR_API")||"https://desktop-tl72une.tail367c47.ts.net/celularstar";
const $=s=>document.querySelector(s),$$=s=>document.querySelectorAll(s);
const totalBranches=bs=>bs.reduce((a,b)=>a+(Number(b[1])||0),0);

function parseModel(raw){
 let n=(raw||"").replace(/^TELEFONO\s+/i,"").trim();
 n=n.replace(/\s+(Dealer|Lock|Dual Sim)\s*$/i,"").trim();
 const bm=n.match(/^(Samsung|Xiaomi|Redmi|Honor|Motorola|Oppo|Blu|Bmobile|Infinix|Realme|Logic|ZTE|Tecno|Ion)\b/i);
 let brand=bm?bm[1]:"Otros"; if(/^Redmi$/i.test(brand))brand="Xiaomi";
 brand=brand.charAt(0).toUpperCase()+brand.slice(1).toLowerCase();
 const sm=n.match(/(\d+\s*(?:GB|MB)\s*\+\s*\d+\s*(?:GB|MB))/i);
 const specs=sm?sm[1].replace(/\s+/g," "):"";
 const model=n.replace(/\s+\d+\s*(?:GB|MB)\s*\+\s*\d+\s*(?:GB|MB).*$/i,"").trim();
 const short=model.replace(/^(Samsung|Xiaomi|Redmi|Honor|Motorola|Oppo|Blu|Bmobile|Infinix|Realme|Logic|ZTE|Tecno|Ion)\s*/i,"").split(" ").slice(-2).join(" ");
 return {brand,model,short:short||model,specs};
}
function isPublicBranch(name){return /^Sucursal/i.test(name||"")&&!/\bVP\b/i.test(name||"");}
async function loadInventory(){
 try{
  const r=await fetch(`${API_BASE}/api/inventario`,{cache:"no-store"}); if(!r.ok)throw Error("API");
  const j=await r.json(); const rows=(j.inventario||[]).filter(x=>isPublicBranch(x.sucursal));
  const map=new Map(), branches=new Map();
  rows.forEach(r=>{
   branches.set(String(r.codigo_almacen),r.sucursal);
   if(!map.has(r.codigo)){const m=parseModel(r.modelo);map.set(r.codigo,{id:r.codigo,codigo:r.codigo,...m,colors:["#ff9d00","#16243a"],branches:[]});}
   map.get(r.codigo).branches.push([r.sucursal,Number(r.stock_mostrar??r.stock)||0,String(r.codigo_almacen)]);
  });
  products=[...map.values()];
  const sel=$("#publicBranch");
  sel.innerHTML='<option value="ALL">Todas las sucursales</option>'+[...branches.entries()].sort((a,b)=>a[1].localeCompare(b[1])).map(([c,n])=>`<option value="${c}">${n}</option>`).join("");
  sel.onchange=()=>{activeBranch=sel.value;render()};
  $("#models").textContent=products.length;$("#units").textContent=products.reduce((a,p)=>a+totalBranches(p.branches),0);render();
 }catch(e){console.error(e);$("#products").innerHTML="";$("#empty").style.display="block";$("#empty h3").textContent="No pudimos cargar el inventario";$("#empty p").textContent="Intenta nuevamente en unos momentos."}
}
function visibleBranches(p){return activeBranch==="ALL"?p.branches:p.branches.filter(b=>b[2]===activeBranch)}
function render(){
 const q=$("#search").value.trim().toLowerCase();
 const list=products.filter(p=>(activeBrand==="Todos"||p.brand===activeBrand)&&(`${p.brand} ${p.model} ${p.specs}`.toLowerCase().includes(q))&&visibleBranches(p).length);
 $("#products").innerHTML=list.map(p=>{const vb=visibleBranches(p),stock=totalBranches(vb);return `<article class="product">
 <div class="art"><div class="mock" style="--c1:${p.colors[0]};--c2:${p.colors[1]}"><div><small>${p.brand}</small><b>${p.short}</b></div></div></div>
 <div class="info"><small>${p.brand.toUpperCase()}</small><h3>${p.model}</h3><p class="spec">${p.specs}</p>
 <div class="stock"><i></i><b>${stock} unidades disponibles</b></div>
 <div class="branches">${vb.map(b=>`<span>${b[0]} <strong>${b[1]}</strong></span>`).join("")}</div>
 <button type="button" class="request" data-id="${p.codigo}">Consultar / Solicitar →</button></div></article>`}).join("");
 $("#count").textContent=`${list.length} equipo${list.length===1?"":"s"}`;$("#empty").style.display=list.length?"none":"block";
 $$(".request").forEach(b=>b.addEventListener("click",()=>openModal(b.dataset.id)));
 if(window.gsap)gsap.from(".product",{opacity:0,y:20,duration:.4,stagger:.05});
}
function openModal(code){
 selected=products.find(p=>p.codigo===code);if(!selected)return;
 const bs=visibleBranches(selected);if(!bs.length)return;
 $("#mName").textContent=selected.model;$("#mSpecs").textContent=selected.specs;$("#mBrand").textContent=selected.brand;$("#mModel").textContent=selected.short;$("#mStock").textContent=`${totalBranches(bs)} disponibles`;
 $("#branch").innerHTML=bs.map(b=>`<option value="${b[0]}" data-stock="${b[1]}" data-whs="${b[2]}">${b[0]} — ${b[1]} disponibles</option>`).join("");
 $("#qty").value=1;updateBranch();$("#modal").classList.add("open");document.body.style.overflow="hidden";
 if(window.gsap)gsap.from(".modal",{y:35,opacity:0,duration:.3});
}
function updateBranch(){const o=$("#branch").selectedOptions[0];maxQty=Number(o?.dataset.stock)||1;$("#available").textContent=`${maxQty} unidades disponibles en esta sucursal`;$("#limit").textContent=`Máximo: ${maxQty}`;$("#qty").value=Math.min(Number($("#qty").value)||1,maxQty)}
function closeModal(){$("#modal").classList.remove("open");document.body.style.overflow=""}
$$("#filters button").forEach(b=>b.onclick=()=>{$$("#filters button").forEach(x=>x.classList.remove("active"));b.classList.add("active");activeBrand=b.dataset.brand;render()});
$("#search").oninput=render;$("#clear").onclick=()=>{$("#search").value="";activeBrand="Todos";activeBranch="ALL";$("#publicBranch").value="ALL";$$("#filters button").forEach(x=>x.classList.toggle("active",x.dataset.brand==="Todos"));render()};
$("#branch").onchange=updateBranch;$("#minus").onclick=()=>$("#qty").value=Math.max(1,Number($("#qty").value)-1);$("#plus").onclick=()=>$("#qty").value=Math.min(maxQty,Number($("#qty").value)+1);$("#close").onclick=closeModal;$("#modal").onclick=e=>{if(e.target===$("#modal"))closeModal()};
$("#form").onsubmit=async e=>{e.preventDefault();const o=$("#branch").selectedOptions[0];const payload={codigo:selected.codigo,codigo_almacen:o.dataset.whs,cantidad:Number($("#qty").value),nombre:$("#name").value.trim(),telefono:$("#tel").value.trim(),correo:$("#email").value.trim(),mensaje:$("#message").value.trim()};
 try{const r=await fetch(`${API_BASE}/api/solicitudes`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});const j=await r.json();if(!r.ok)throw Error(j.error||"Error");closeModal();Swal.fire({title:"Solicitud registrada",text:"Tu solicitud fue enviada correctamente.",icon:"success",confirmButtonColor:"#07111f"});e.target.reset()}
 catch(err){Swal.fire({title:"No se pudo enviar",text:err.message,icon:"error",confirmButtonColor:"#07111f"})}};
window.addEventListener("scroll",()=>$("#header").classList.toggle("scrolled",scrollY>25));
loadInventory();
if(window.gsap&&!matchMedia("(prefers-reduced-motion: reduce)").matches){gsap.from(".hero-copy>*",{opacity:0,y:25,duration:.6,stagger:.08});gsap.from(".phone",{opacity:0,y:30,rotation:15,duration:.9})}
