
let products=[];
const API_BASE = localStorage.getItem("CELULAR_STAR_API") || "https://desktop-tl72une.tail367c47.ts.net/celularstar";

const demoProducts=[
{id:1,codigo:"TL-150129",brand:"Samsung",model:"Samsung A16 5G EE",short:"A16",specs:"8 GB RAM · 256 GB",colors:["#ff9d00","#654000"],branches:[["Sucursal MiniCentro San Vicente",20],["Sucursal Minicentro Zacatecoluca",15]]},
{id:2,codigo:"TL-150119",brand:"Samsung",model:"Samsung A16 LTE",short:"A16",specs:"4 GB RAM · 128 GB",colors:["#253a67","#62a8d9"],branches:[["Sucursal MiniCentro San Vicente",1]]}
];

function parseModel(raw){
  let name=(raw||"").replace(/^TELEFONO\s+/i,"").replace(/\s+(Dealer|Lock|Dual Sim)\s*$/i,"").trim();
  const brandMatch=name.match(/^(Samsung|Xiaomi|Redmi|Honor|Motorola|Oppo|Blu|Bmobile|Infinix|Realme|Logic|ZTE|Tecno|Ion)\b/i);
  let brand=brandMatch?brandMatch[1]:"Otros";
  if(/^Redmi$/i.test(brand)) brand="Xiaomi";
  brand=brand.charAt(0).toUpperCase()+brand.slice(1).toLowerCase();
  if(brand==="Bmobile") brand="Bmobile";
  const specMatch=name.match(/(\d+\s*(?:GB|MB)\s*\+\s*\d+\s*(?:GB|MB))/i);
  const specs=specMatch?specMatch[1].replace(/\s+/g," "):"";
  const display=name.replace(/\s+\d+\s*(?:GB|MB)\s*\+\s*\d+\s*(?:GB|MB).*$/i,"").trim();
  const short=display.replace(new RegExp("^"+brand+"\\s*","i"),"").split(" ").slice(-2).join(" ");
  return {brand,model:display,short:short||display,specs};
}

async function loadInventory(){
  try{
    const res=await fetch(`${API_BASE}/api/inventario`,{cache:"no-store"});
    if(!res.ok) throw new Error(`HTTP ${res.status}`);
    const body=await res.json();
    const rows=body.inventario||[];
    const map=new Map();
    rows.forEach(r=>{
      if(!map.has(r.codigo)){
        const m=parseModel(r.modelo);
        map.set(r.codigo,{id:r.codigo,codigo:r.codigo,...m,colors:["#ff9d00","#16243a"],branches:[]});
      }
      map.get(r.codigo).branches.push([r.sucursal,Number(r.stock_mostrar ?? r.stock)||0,r.codigo_almacen]);
    });
    products=[...map.values()];
    const branches=new Map();
    rows.forEach(r=>branches.set(String(r.codigo_almacen),r.sucursal));
    const branchSelect=$("#publicBranch");
    branchSelect.innerHTML='<option value="ALL">Todas las sucursales</option>'+[...branches.entries()].sort((a,b)=>a[1].localeCompare(b[1])).map(([code,name])=>`<option value="${code}">${name}</option>`).join("");
    branchSelect.onchange=()=>{activeBranch=branchSelect.value;render();};
    render();
    $("#models").textContent=products.length;
    $("#units").textContent=products.reduce((a,p)=>a+total(p),0);
  }catch(err){
    console.warn("API no disponible; usando datos demo:",err);
    products=demoProducts;
    render();
    $("#models").textContent=products.length;
    $("#units").textContent=products.reduce((a,p)=>a+total(p),0);
  }
}

let activeBrand="Todos", activeBranch="ALL", selected=null, maxQty=1;
const $=s=>document.querySelector(s), $$=s=>document.querySelectorAll(s);
const total=p=>p.branches.reduce((a,b)=>a+b[1],0);
function render(){
 const q=$("#search").value.trim().toLowerCase();
 const list=products.filter(p=>(activeBrand==="Todos"||p.brand===activeBrand)&&(`${p.brand} ${p.model} ${p.specs}`.toLowerCase().includes(q))&&(activeBranch==="ALL"||p.branches.some(b=>String(b[2])===activeBranch)));
 $("#products").innerHTML=list.map((p,i)=>{const vb=activeBranch==="ALL"?p.branches:p.branches.filter(b=>String(b[2])===activeBranch);const vt=vb.reduce((a,b)=>a+b[1],0);return `<article class="product">
 <div class="art"><div class="mock" style="--c1:${p.colors[0]};--c2:${p.colors[1]}"><div><small>${p.brand}</small><b>${p.short}</b></div></div></div>
 <div class="info"><small>${p.brand.toUpperCase()}</small><h3>${p.model}</h3><p class="spec">${p.specs}</p>
 <div class="stock"><i></i><b>${vt} unidades disponibles</b></div>
 <div class="branches">${vb.map(b=>`<span>${b[0]} <strong>${b[1]}</strong></span>`).join("")}</div>
 <button class="request" data-id="${p.id}">Consultar / Solicitar →</button></div></article>`}).join("");
 $("#count").textContent=`${list.length} equipo${list.length===1?"":"s"}`;
 $("#empty").style.display=list.length?"none":"block";
 $$(".request").forEach(b=>b.onclick=()=>openModal(+b.dataset.id));
 if(window.gsap){gsap.from(".product",{opacity:0,y:25,duration:.55,stagger:.08,ease:"power2.out"});}
}
function openModal(id){
 selected=products.find(p=>p.id===id); if(!selected)return;
 $("#mName").textContent=selected.model; $("#mSpecs").textContent=selected.specs; $("#mBrand").textContent=selected.brand; $("#mModel").textContent=selected.short; $("#mStock").textContent=`${total(selected)} disponibles`;
 const modalBranches=activeBranch==="ALL"?selected.branches:selected.branches.filter(b=>String(b[2])===activeBranch);
 $("#branch").innerHTML=modalBranches.map(b=>`<option value="${b[0]}" data-stock="${b[1]}" data-whs="${b[2]||""}">${b[0]} — ${b[1]} disponibles</option>`).join("");
 $("#qty").value=1; updateBranch(); $("#modal").classList.add("open"); document.body.style.overflow="hidden";
 if(window.gsap)gsap.from(".modal",{y:45,opacity:0,scale:.98,duration:.35,ease:"power2.out"});
}
function updateBranch(){const o=$("#branch").selectedOptions[0];maxQty=+(o?.dataset.stock||1);$("#available").textContent=`${maxQty} unidades disponibles en esta sucursal`;$("#limit").textContent=`Máximo: ${maxQty}`;if(+$("#qty").value>maxQty)$("#qty").value=maxQty}
function closeModal(){$("#modal").classList.remove("open");document.body.style.overflow=""}
$$("#filters button").forEach(b=>b.onclick=()=>{$$("#filters button").forEach(x=>x.classList.remove("active"));b.classList.add("active");activeBrand=b.dataset.brand;render()});
$("#search").addEventListener("input",render);
$("#clear").onclick=()=>{$("#search").value="";activeBrand="Todos";$$("#filters button").forEach(x=>x.classList.toggle("active",x.dataset.brand==="Todos"));render()};
$("#branch").onchange=updateBranch;
$("#minus").onclick=()=>$("#qty").value=Math.max(1,+$("#qty").value-1);
$("#plus").onclick=()=>$("#qty").value=Math.min(maxQty,+$("#qty").value+1);
$("#close").onclick=closeModal;$("#modal").onclick=e=>{if(e.target===$("#modal"))closeModal()};

$("#form").onsubmit=async e=>{e.preventDefault();const opt=$("#branch").selectedOptions[0];const payload={codigo:selected.codigo,codigo_almacen:opt.dataset.whs,cantidad:+$("#qty").value,nombre:$("#name").value,telefono:$("#tel").value,correo:$("#email").value,mensaje:$("#message").value};try{const r=await fetch(`${API_BASE}/api/solicitudes`,{method:"POST",headers:{"Content-Type":"application/json"},body:JSON.stringify(payload)});if(!r.ok)throw new Error();closeModal();Swal.fire({title:"Solicitud registrada",text:"Tu solicitud fue guardada correctamente.",icon:"success",confirmButtonColor:"#07111f"});e.target.reset()}catch(err){Swal.fire({title:"No se pudo enviar",text:"Verifica que la API esté encendida.",icon:"error",confirmButtonColor:"#07111f"})}};
window.addEventListener("scroll",()=>$("#header").classList.toggle("scrolled",scrollY>25));
loadInventory();
if(window.gsap&&!matchMedia("(prefers-reduced-motion: reduce)").matches){
 gsap.from(".hero-copy>*",{opacity:0,y:28,duration:.7,stagger:.09,ease:"power3.out"});
 gsap.from(".phone",{opacity:0,y:35,rotation:16,duration:1,ease:"power3.out"});
 gsap.from(".floating",{opacity:0,scale:.9,duration:.6,stagger:.15,delay:.55});
 gsap.registerPlugin(ScrollTrigger);
 gsap.from(".steps article",{scrollTrigger:{trigger:".steps",start:"top 82%"},opacity:0,y:30,duration:.6,stagger:.12});
}
