const $ = (s) => document.querySelector(s);
const $$ = (s) => [...document.querySelectorAll(s)];

const AUTO_API_URL = "https://script.google.com/macros/s/AKfycbzOrgYnoTIi1w0HQLqiRBIrQxSmoBOXQk4zyw06mfuAg0aDgj_0zo7G2Okme-MS8yxi/exec";
// URL Apps Script ditanam langsung agar website otomatis terhubung.
localStorage.setItem("wsit_api_url", AUTO_API_URL);

const state = {
  transactions: JSON.parse(localStorage.getItem("wsit_transactions") || "[]"),
  apiUrl: AUTO_API_URL,
  openingBalance: Number(localStorage.getItem("wsit_opening_balance") || 0),
  charts: {},
  dashboardMonth: localStorage.getItem("wsit_dashboard_month") || ""
};

const monthNames = ["Januari","Februari","Maret","April","Mei","Juni","Juli","Agustus","September","Oktober","November","Desember"];
const money = n => new Intl.NumberFormat("id-ID",{style:"currency",currency:"IDR",maximumFractionDigits:0}).format(Number(n)||0);
const dateText = d => new Intl.DateTimeFormat("id-ID",{day:"2-digit",month:"2-digit",year:"numeric"}).format(new Date(d+"T00:00:00"));
const today = () => new Date().toISOString().slice(0,10);
const currentMonth = () => new Date().toISOString().slice(0,7);

function saveLocal(){ localStorage.setItem("wsit_transactions", JSON.stringify(state.transactions)); }
function uid(){ return "TRX-"+Date.now()+"-"+Math.random().toString(36).slice(2,7).toUpperCase(); }
function showToast(msg){ const el=$("#toast"); el.textContent=msg; el.classList.add("show"); setTimeout(()=>el.classList.remove("show"),2600); }

function totals(list=state.transactions){
  const income=list.filter(x=>x.type==="income").reduce((s,x)=>s+Number(x.amount),0);
  const expense=list.filter(x=>x.type==="expense").reduce((s,x)=>s+Number(x.amount),0);
  return {income,expense,net:income-expense};
}

function validMonth(v){ return /^\d{4}-\d{2}$/.test(String(v||"")); }
function monthList(){
  const set = new Set(state.transactions.map(x=>String(x.date||"").slice(0,7)).filter(validMonth));
  set.add(currentMonth());
  return [...set].sort().reverse();
}

function go(page){
  $$(".nav-item").forEach(b=>b.classList.toggle("active",b.dataset.page===page));
  $$(".page").forEach(p=>p.classList.remove("active-page"));
  $(`#${page}Page`).classList.add("active-page");
  const titles={dashboard:["Dashboard","Ringkasan arus kas Anda"],transactions:["Transaksi","Kelola semua pemasukan dan pengeluaran"],reports:["Laporan","Analisis arus kas harian dan bulanan"],settings:["Pengaturan","Koneksi database dan saldo awal"]};
  $("#pageTitle").textContent=titles[page][0]; $("#pageSubtitle").textContent=titles[page][1];
  if(page==="dashboard") renderDashboard(); if(page==="transactions") renderTransactions(); if(page==="reports") renderReports();
}

function openModal(tx=null){
  $("#transactionModal").classList.remove("hidden");
  $("#modalTitle").textContent=tx?"Edit Transaksi":"Tambah Transaksi";
  $("#editId").value=tx?.id||"";
  document.querySelector(`input[name="type"][value="${tx?.type||"income"}"]`).checked=true;
  $("#amount").value=tx?.amount||"";
  $("#description").value=tx?.description||"";
  $("#transactionDate").value=tx?.date||today();
}
function closeModal(){ $("#transactionModal").classList.add("hidden"); $("#transactionForm").reset(); $("#transactionDate").value=today(); }

async function api(action, data={}){
  if(!state.apiUrl) return null;
  const payload=JSON.stringify({action,...data});
  const url=state.apiUrl + (state.apiUrl.includes("?") ? "&" : "?") + "payload=" + encodeURIComponent(payload);
  const res=await fetch(url,{method:"GET",cache:"no-store"});
  if(!res.ok) throw new Error(`HTTP ${res.status}`);
  return await res.json();
}

async function syncLoad(){
  if(!state.apiUrl){showToast("URL database belum diatur."); return;}
  try{
    const result=await api("list");
    if(result?.ok){
      state.transactions=result.transactions||[];
      saveLocal(); renderAll(); showToast("Data spreadsheet berhasil dimuat.");
      $("#dbStatus").textContent="Terhubung";
      $(".status-dot").style.background="#22c55e";
      if($("#dbStatusSettings")) $("#dbStatusSettings").textContent="Terhubung";
    }else throw new Error(result?.error||"Gagal memuat data");
  }catch(e){ $("#dbStatus").textContent="Gagal koneksi"; if($("#dbStatusSettings")) $("#dbStatusSettings").textContent="Gagal koneksi"; showToast("Koneksi gagal: "+e.message); }
}

async function saveTransaction(tx){
  const localIndex=state.transactions.findIndex(x=>x.id===tx.id);
  if(localIndex>=0) state.transactions[localIndex]=tx; else state.transactions.push(tx);
  saveLocal(); renderAll();
if(state.apiUrl){ setTimeout(()=>syncLoad(), 250); }
  if(state.apiUrl){
    try{
      const result=await api("upsert",{transaction:tx});
      if(!result?.ok) throw new Error(result?.error||"Gagal");
      $("#dbStatus").textContent="Terhubung"; $(".status-dot").style.background="#22c55e";
    }catch(e){showToast("Tersimpan lokal, spreadsheet gagal: "+e.message); return;}
  }
  showToast("Transaksi berhasil disimpan.");
}

function askDeleteConfirmation(id){
  return new Promise(resolve=>{
    const modal=$("#deleteConfirmModal");
    if(!modal){ resolve(confirm("Yakin ingin menghapus transaksi ini?")); return; }
    modal.classList.remove("hidden");
    document.body.classList.add("delete-alert-open");
    const yes=$("#confirmDeleteBtn"), no=$("#cancelDeleteBtn"), close=$("#closeDeleteConfirm");
    const finish=(result)=>{ modal.classList.add("hidden"); document.body.classList.remove("delete-alert-open"); yes.onclick=no.onclick=close.onclick=null; modal.onclick=null; resolve(result); };
    yes.onclick=()=>finish(true); no.onclick=()=>finish(false); close.onclick=()=>finish(false);
    modal.onclick=(e)=>{ if(e.target===modal) finish(false); };
  });
}

async function deleteTransaction(id){
  if(!(await askDeleteConfirmation(id))) return;
  state.transactions=state.transactions.filter(x=>x.id!==id); saveLocal(); renderAll();
  if(state.apiUrl){
    try{ await api("delete",{id}); }catch(e){showToast("Terhapus lokal, spreadsheet gagal."); return;}
  }
  showToast("Transaksi dihapus.");
}

function transactionRows(list){
  if(!list.length) return `<div class="empty">Belum ada transaksi.</div>`;
  return `<table><thead><tr><th>Tanggal</th><th>Jenis</th><th>Keterangan</th><th>Jumlah</th><th>Aksi</th></tr></thead><tbody>
  ${list.sort((a,b)=>b.date.localeCompare(a.date)).map(x=>`<tr>
    <td>${dateText(x.date)}</td>
    <td><span class="badge ${x.type==="income"?"badge-income":"badge-expense"}">${x.type==="income"?"Pemasukan":"Pengeluaran"}</span></td>
    <td>${escapeHtml(x.description)}</td>
    <td class="${x.type==="income"?"amount-income":"amount-expense"}">${x.type==="income"?"+":"−"} ${money(x.amount)}</td>
    <td><div class="row-actions"><button class="small-btn" onclick="editTx('${x.id}')">Edit</button><button class="small-btn delete" onclick="deleteTransaction('${x.id}')">Hapus</button></div></td>
  </tr>`).join("")}</tbody></table>`;
}
function escapeHtml(s){return String(s||"").replace(/[&<>"']/g,m=>({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#039;"}[m]));}
function editTx(id){openModal(state.transactions.find(x=>x.id===id));}

function renderDashboard(){
  const months=monthList();
  const sel=$("#dailyMonthSelect");
  const selected=state.dashboardMonth;
  const month=validMonth(selected) && months.includes(selected) ? selected : (months.includes(currentMonth()) ? currentMonth() : months[0]);
  state.dashboardMonth=month;
  localStorage.setItem("wsit_dashboard_month",month);
  sel.innerHTML=months.map(m=>`<option value="${m}">${monthNames[Number(m.slice(5))-1]} ${m.slice(0,4)}</option>`).join("");
  sel.value=month;
  updateDashboardMonth(month);
  $("#recentTransactions").innerHTML=transactionRows(state.transactions.slice().sort((a,b)=>String(b.date||"").localeCompare(String(a.date||""))).slice(0,5));
  drawMonthly();
}

function updateDashboardMonth(month){
  if(!validMonth(month)) return;
  state.dashboardMonth=month;
  localStorage.setItem("wsit_dashboard_month",month);
  const list=state.transactions.filter(x=>String(x.date||"").startsWith(month));
  const t=totals(list);
  const all=totals();
  // Saldo tetap seluruh periode; hanya 3 kartu berikut yang mengikuti bulan pilihan.
  $("#balanceValue").textContent=money(state.openingBalance+all.net);
  $("#incomeValue").textContent=money(t.income);
  $("#expenseValue").textContent=money(t.expense);
  $("#netValue").textContent=money(t.net);
  const label=`${monthNames[Number(month.slice(5))-1]} ${month.slice(0,4)}`;
  $("#incomeMeta").textContent=label;
  $("#expenseMeta").textContent=label;
  $("#netMeta").textContent=`${label} · Pemasukan − pengeluaran`;
  drawDaily(month);
}

function drawDaily(month){
  const list=state.transactions.filter(x=>String(x.date||"").startsWith(month));
  const days=new Date(Number(month.slice(0,4)),Number(month.slice(5)),0).getDate();
  const labels=[...Array(days)].map((_,i)=>String(i+1));
  const inc=labels.map(d=>sumDay(month, d, "income")), exp=labels.map(d=>sumDay(month,d,"expense"));
  replaceChart("dailyChart",{type:"line",data:{labels,datasets:[{label:"Pemasukan",data:inc,tension:.35,borderWidth:2},{label:"Pengeluaran",data:exp,tension:.35,borderWidth:2}]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:"bottom"}},scales:{y:{ticks:{callback:v=>money(v)}}}}});
  $("#dailyChartLabel").textContent=`${monthNames[Number(month.slice(5))-1]} ${month.slice(0,4)}`;
}
function sumDay(month,d,type){const day=month+"-"+String(d).padStart(2,"0");return state.transactions.filter(x=>x.date===day&&x.type===type).reduce((s,x)=>s+Number(x.amount),0)}
function drawMonthly(){
  const labels=monthList().slice().reverse().slice(-12);
  replaceChart("monthlyChart",{type:"bar",data:{labels:labels.map(m=>monthNames[Number(m.slice(5))-1].slice(0,3)+" "+m.slice(0,4)),datasets:[
    {label:"Pemasukan",data:labels.map(m=>totals(state.transactions.filter(x=>x.date.startsWith(m))).income),borderWidth:0},
    {label:"Pengeluaran",data:labels.map(m=>totals(state.transactions.filter(x=>x.date.startsWith(m))).expense),borderWidth:0}
  ]},options:{responsive:true,maintainAspectRatio:false,plugins:{legend:{position:"bottom"}},scales:{y:{ticks:{callback:v=>money(v)}}}}});
}
function replaceChart(id,cfg){if(state.charts[id])state.charts[id].destroy();state.charts[id]=new Chart($("#"+id),cfg)}

function renderTransactions(){
  const q=$("#searchInput").value.toLowerCase(), type=$("#typeFilter").value, month=$("#dateFilter").value;
  let list=state.transactions.filter(x=>(!q||String(x.description||"").toLowerCase().includes(q))&&(type==="all"||x.type===type)&&(!month||String(x.date||"").startsWith(month)));
  $("#allTransactions").innerHTML=transactionRows(list);
}
function renderReports(){
  const groups={};
  state.transactions.filter(x=>/^\d{4}-\d{2}-\d{2}$/.test(String(x.date||""))).forEach(x=>{const m=x.date.slice(0,7); groups[m]??={income:0,expense:0}; if(x.type==="income"||x.type==="expense") groups[m][x.type]+=Number(x.amount)||0;});
  const months=Object.keys(groups).sort().reverse();
  $("#monthlyReport").innerHTML=months.length?`<table><thead><tr><th>Bulan</th><th>Pemasukan</th><th>Pengeluaran</th><th>Bersih</th></tr></thead><tbody>${months.map(m=>`<tr><td>${monthNames[Number(m.slice(5))-1]} ${m.slice(0,4)}</td><td class="amount-income">${money(groups[m].income)}</td><td class="amount-expense">${money(groups[m].expense)}</td><td>${money(groups[m].income-groups[m].expense)}</td></tr>`).join("")}</tbody></table>`:`<div class="empty">Belum ada data laporan.</div>`;
  const month=$("#reportMonth").value||state.dashboardMonth||currentMonth(); $("#reportMonth").value=month;
  const days={}; state.transactions.filter(x=>x.date && x.date.startsWith(month)).forEach(x=>{days[x.date]??={income:0,expense:0}; if(x.type==="income"||x.type==="expense") days[x.date][x.type]+=Number(x.amount)||0;});
  const dates=Object.keys(days).sort().reverse();
  $("#dailyReport").innerHTML=dates.length?`<table><thead><tr><th>Tanggal</th><th>Pemasukan</th><th>Pengeluaran</th><th>Bersih</th></tr></thead><tbody>${dates.map(d=>`<tr><td>${dateText(d)}</td><td class="amount-income">${money(days[d].income)}</td><td class="amount-expense">${money(days[d].expense)}</td><td>${money(days[d].income-days[d].expense)}</td></tr>`).join("")}</tbody></table>`:`<div class="empty">Tidak ada transaksi pada bulan ini.</div>`;
}

function renderAll(){renderDashboard();renderTransactions();renderReports();}

$("#openAddBtn").onclick=()=>openModal();
$("#closeModal").onclick=closeModal; $("#cancelBtn").onclick=closeModal;
$("#dailyMonthSelect").onchange=e=>{ updateDashboardMonth(e.target.value); };
$("#transactionForm").onsubmit=async e=>{
  e.preventDefault();
  const id=$("#editId").value||uid();
  await saveTransaction({id,type:document.querySelector('input[name="type"]:checked').value,amount:Number($("#amount").value),description:$("#description").value.trim(),date:$("#transactionDate").value,createdAt:new Date().toISOString()});
  closeModal();
};
$$(".nav-item").forEach(b=>b.onclick=()=>go(b.dataset.page));
$$("[data-page-link]").forEach(b=>b.onclick=()=>go(b.dataset.pageLink));
["searchInput","typeFilter","dateFilter"].forEach(id=>$( "#"+id).addEventListener("input",renderTransactions));
$("#clearFilter").onclick=()=>{$("#searchInput").value="";$("#typeFilter").value="all";$("#dateFilter").value="";renderTransactions()};
$("#reportMonth").onchange=renderReports;

// URL database ditanam otomatis di AUTO_API_URL. Tidak perlu diisi manual.
$("#apiUrl").value=state.apiUrl; $("#openingBalance").value=state.openingBalance;
$("#loadServerBtn").onclick=syncLoad;
$("#saveOpeningBtn").onclick=()=>{state.openingBalance=Number($("#openingBalance").value||0);localStorage.setItem("wsit_opening_balance",state.openingBalance);renderDashboard();showToast("Saldo awal disimpan.")};
$("#exportCsvBtn").onclick=()=>{
  const rows=[["ID","Tipe","Jumlah","Keterangan","Tanggal","Dibuat"],...state.transactions.map(x=>[x.id,x.type,x.amount,x.description,x.date,x.createdAt])];
  const csv=rows.map(r=>r.map(v=>`"${String(v??"").replaceAll('"','""')}"`).join(",")).join("\n");
  const a=document.createElement("a");a.href=URL.createObjectURL(new Blob([csv],{type:"text/csv"}));a.download="arus-kas-wsit.csv";a.click();
};

renderAll();

// Sinkronkan otomatis saat website dibuka.
if (state.apiUrl) setTimeout(syncLoad, 300);
