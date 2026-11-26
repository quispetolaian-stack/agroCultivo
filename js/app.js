const DEMO_USER = "admin";
const DEMO_PASSWORD = "agro123";
const STORAGE_KEY = "agrocontrol_data_v1";
const emptyData = { crops: [], supplies: [], irrigation: [], activities: [] };
let data = loadData();
let currentType = "";
let editingId = null;

const $ = (id) => document.getElementById(id);
const today = () => new Date().toISOString().slice(0, 10);
const makeId = () => Date.now().toString(36) + Math.random().toString(36).slice(2, 7);
const escapeHTML = (value) => String(value ?? "").replace(/[&<>"']/g, char => ({"&":"&amp;","<":"&lt;",">":"&gt;",'"':"&quot;","'":"&#39;"}[char]));
function loadData() {
  try { return {...emptyData, ...JSON.parse(localStorage.getItem(STORAGE_KEY) || "{}")}; }
  catch { return structuredClone(emptyData); }
}
function saveData() { localStorage.setItem(STORAGE_KEY, JSON.stringify(data)); }
function formatDate(value) {
  if (!value) return "—";
  const date = new Date(value + "T00:00:00");
  return Number.isNaN(date.getTime()) ? value : date.toLocaleDateString("es-BO");
}
function showToast(message) {
  const toast = $("toast"); toast.textContent = message; toast.classList.add("show");
  clearTimeout(showToast.timer); showToast.timer = setTimeout(() => toast.classList.remove("show"), 2500);
}
function showApp() {
  $("loginView").classList.add("hidden"); $("appView").classList.remove("hidden");
  $("todayLabel").textContent = new Date().toLocaleDateString("es-BO", {weekday:"long", day:"numeric", month:"long", year:"numeric"});
  renderAll();
}
$("loginForm").addEventListener("submit", event => {
  event.preventDefault();
  const user = $("username").value.trim(), pass = $("password").value;
  if (user === DEMO_USER && pass === DEMO_PASSWORD) {
    sessionStorage.setItem("agrocontrol_session", "active"); $("loginError").textContent = ""; showApp();
  } else $("loginError").textContent = "Usuario o contraseña incorrectos. Verifica tus datos.";
});
$("logoutBtn").addEventListener("click", () => {
  sessionStorage.removeItem("agrocontrol_session"); $("appView").classList.add("hidden"); $("loginView").classList.remove("hidden");
  $("password").value = ""; $("username").focus();
});
if (sessionStorage.getItem("agrocontrol_session") === "active") showApp();

const sectionNames = {dashboard:"Monitoreo del invernadero", crops:"Cultivos", supplies:"Insumos", irrigation:"Riego", activities:"Actividades"};
document.querySelectorAll(".nav-link").forEach(button => button.addEventListener("click", () => navigate(button.dataset.section)));
function navigate(section) {
  Object.keys(sectionNames).forEach(key => $(key + "Section").classList.toggle("hidden", key !== section));
  document.querySelectorAll(".nav-link").forEach(btn => btn.classList.toggle("active", btn.dataset.section === section));
  $("pageTitle").textContent = sectionNames[section]; $("sidebar").classList.remove("open");
}
$("menuToggle").addEventListener("click", () => $("sidebar").classList.toggle("open"));

const configs = {
  crop: {title:"Nuevo cultivo", key:"crops", fields:[
    ["name","Nombre del cultivo","text",true],["variety","Variedad","text",false],["plot","Parcela","text",true],["date","Fecha de siembra","date",true],["status","Estado","select",true,["En crecimiento","Listo para cosecha","Cosechado"]]
  ]},
  supply: {title:"Nuevo insumo", key:"supplies", fields:[
    ["name","Nombre del insumo","text",true],["category","Categoría","select",true,["Semillas","Fertilizantes","Herramientas","Plaguicidas","Otros"]],["quantity","Cantidad","number",true],["unit","Unidad","select",true,["kg","g","L","ml","unidades","sacos"]]
  ]},
  irrigation: {title:"Registrar riego", key:"irrigation", fields:[
    ["date","Fecha","date",true],["crop","Cultivo o parcela","text",true],["amount","Cantidad de agua (litros)","number",true],["duration","Duración (minutos)","number",false],["notes","Observaciones","textarea",false]
  ]},
  activity: {title:"Nueva actividad", key:"activities", fields:[
    ["name","Actividad realizada","text",true],["crop","Cultivo o parcela","text",true],["date","Fecha","date",true],["responsible","Responsable","text",false],["status","Estado","select",true,["Pendiente","En proceso","Completada"]]
  ]}
};
document.querySelectorAll("[data-open-modal]").forEach(btn => btn.addEventListener("click", () => openModal(btn.dataset.openModal)));
function openModal(type, record = null) {
  currentType = type; editingId = record?.id || null;
  const config = configs[type]; $("modalTitle").textContent = editingId ? "Editar registro" : config.title;
  $("modalError").textContent = "";
  $("modalFields").innerHTML = config.fields.map(([name,label,kind,required,options]) => {
    const value = record?.[name] ?? (name === "date" ? today() : "");
    let control = "";
    if (kind === "select") control = `<select id="field_${name}" ${required ? "required" : ""}><option value="">Seleccionar...</option>${options.map(opt => `<option ${value === opt ? "selected" : ""}>${opt}</option>`).join("")}</select>`;
    else if (kind === "textarea") control = `<textarea id="field_${name}" placeholder="${label}">${escapeHTML(value)}</textarea>`;
    else control = `<input id="field_${name}" type="${kind}" value="${escapeHTML(value)}" ${required ? "required" : ""} ${kind === "number" ? 'min="0" step="any"' : ""} placeholder="${label}">`;
    return `<div class="field ${kind === "textarea" ? "full-field" : ""}"><label for="field_${name}">${label}${required ? " *" : ""}</label>${control}</div>`;
  }).join("");
  $("modalBackdrop").classList.remove("hidden");
}
function closeModal() { $("modalBackdrop").classList.add("hidden"); $("recordForm").reset(); editingId = null; }
$("closeModal").addEventListener("click", closeModal);
$("cancelModal").addEventListener("click", closeModal);
$("modalBackdrop").addEventListener("click", e => { if (e.target === $("modalBackdrop")) closeModal(); });
$("recordForm").addEventListener("submit", event => {
  event.preventDefault();
  const config = configs[currentType], record = {};
  for (const [name] of config.fields) record[name] = $("field_" + name).value.trim();
  if (config.fields.some(([name,,kind,required]) => required && !record[name]) || (record.quantity !== undefined && Number(record.quantity) < 0) || (record.amount !== undefined && Number(record.amount) < 0)) {
    $("modalError").textContent = "Completa los campos obligatorios y utiliza cantidades válidas."; return;
  }
  if (record.quantity !== undefined) record.quantity = Number(record.quantity);
  if (record.amount !== undefined) record.amount = Number(record.amount);
  if (record.duration !== undefined) record.duration = record.duration === "" ? "" : Number(record.duration);
  const list = data[config.key];
  if (editingId) {
    const index = list.findIndex(item => item.id === editingId);
    if (index >= 0) list[index] = {...list[index], ...record};
    showToast("Registro actualizado correctamente.");
  } else {
    list.unshift({id:makeId(), ...record, createdAt:new Date().toISOString()});
    showToast("Registro guardado correctamente.");
  }
  saveData(); closeModal(); renderAll();
});
function actionButtons(type, id) {
  return `<div class="row-actions"><button class="action-btn" data-edit="${type}" data-id="${id}">Editar</button><button class="action-btn delete" data-delete="${type}" data-id="${id}">Eliminar</button></div>`;
}
function bindActions() {
  document.querySelectorAll("[data-edit]").forEach(btn => btn.addEventListener("click", () => {
    const config = configs[btn.dataset.edit], record = data[config.key].find(item => item.id === btn.dataset.id);
    if (record) openModal(btn.dataset.edit, record);
  }));
  document.querySelectorAll("[data-delete]").forEach(btn => btn.addEventListener("click", () => {
    const type = btn.dataset.delete, config = configs[type];
    if (confirm("¿Seguro que deseas eliminar este registro?")) {
      data[config.key] = data[config.key].filter(item => item.id !== btn.dataset.id);
      saveData(); renderAll(); showToast("Registro eliminado.");
    }
  }));
}
function renderTable(type, tbodyId, emptyId, rows) {
  const config = configs[type], list = data[config.key];
  $(tbodyId).innerHTML = rows(list);
  $(emptyId).classList.toggle("hidden", list.length !== 0);
}
function renderCrops() {
  const query = ($("cropSearch")?.value || "").toLowerCase();
  const list = data.crops.filter(x => [x.name,x.variety,x.plot].join(" ").toLowerCase().includes(query));
  $("cropsTable").innerHTML = list.map(x => `<tr><td><strong>${escapeHTML(x.name)}</strong></td><td>${escapeHTML(x.variety || "—")}</td><td>${escapeHTML(x.plot)}</td><td>${formatDate(x.date)}</td><td><span class="tag">${escapeHTML(x.status)}</span></td><td>${actionButtons("crop",x.id)}</td></tr>`).join("");
  $("cropsEmpty").classList.toggle("hidden", list.length !== 0);
}
function renderSupplies() {
  const query = ($("supplySearch")?.value || "").toLowerCase();
  const list = data.supplies.filter(x => [x.name,x.category].join(" ").toLowerCase().includes(query));
  $("suppliesTable").innerHTML = list.map(x => `<tr><td><strong>${escapeHTML(x.name)}</strong></td><td>${escapeHTML(x.category)}</td><td>${x.quantity}</td><td>${escapeHTML(x.unit)}</td><td><span class="tag ${x.quantity <= 5 ? "low" : ""}">${x.quantity <= 5 ? "Stock bajo" : "Disponible"}</span></td><td>${actionButtons("supply",x.id)}</td></tr>`).join("");
  $("suppliesEmpty").classList.toggle("hidden", list.length !== 0);
}
function renderIrrigation() {
  renderTable("irrigation","irrigationTable","irrigationEmpty",list => list.map(x => `<tr><td>${formatDate(x.date)}</td><td>${escapeHTML(x.crop)}</td><td>${x.amount} L</td><td>${x.duration ? x.duration+" min" : "—"}</td><td>${escapeHTML(x.notes || "—")}</td><td>${actionButtons("irrigation",x.id)}</td></tr>`).join(""));
}
function renderActivities() {
  renderTable("activity","activitiesTable","activitiesEmpty",list => list.map(x => `<tr><td><strong>${escapeHTML(x.name)}</strong></td><td>${escapeHTML(x.crop)}</td><td>${formatDate(x.date)}</td><td>${escapeHTML(x.responsible || "—")}</td><td><span class="tag ${x.status === "Pendiente" ? "low" : ""}">${escapeHTML(x.status)}</span></td><td>${actionButtons("activity",x.id)}</td></tr>`).join(""));
}
function renderDashboard() {
  if ($("statCrops")) $("statCrops").textContent = data.crops.length;
  if ($("statSupplies")) $("statSupplies").textContent = data.supplies.length;
  if ($("statIrrigation")) $("statIrrigation").textContent = data.irrigation.length;
  if ($("statActivities")) $("statActivities").textContent = data.activities.length;
  const items = [
    ...data.crops.map(x => ({icon:"🌱",title:"Cultivo: "+x.name,detail:"Parcela "+x.plot,date:x.createdAt})),
    ...data.supplies.map(x => ({icon:"📦",title:"Insumo: "+x.name,detail:x.quantity+" "+x.unit,date:x.createdAt})),
    ...data.irrigation.map(x => ({icon:"💧",title:"Riego: "+x.crop,detail:x.amount+" litros",date:x.createdAt})),
    ...data.activities.map(x => ({icon:"☷",title:x.name,detail:x.crop,date:x.createdAt}))
  ].sort((a,b) => (b.date || "").localeCompare(a.date || "")).slice(0,5);
  if ($("recentList")) {
    $("recentList").innerHTML = items.length ? items.map(x => `<div class="recent-item"><div class="recent-dot">${x.icon}</div><div><strong>${escapeHTML(x.title)}</strong><small>${escapeHTML(x.detail)} · ${x.date ? new Date(x.date).toLocaleDateString("es-BO") : "Registro"}</small></div></div>`).join("") : `<p class="empty-state">Aún no hay movimientos. Registra tu primer cultivo o insumo.</p>`;
  }
}
function renderDashboardExtras() {
  const now = new Date();
  $("dashboardDate").textContent = now.toLocaleDateString("es-BO",{day:"2-digit",month:"short",year:"numeric"});
  $("dateRange").textContent = now.toLocaleDateString("es-BO",{day:"2-digit",month:"short",year:"numeric"});
  $("activitySplitLabel").textContent = `Actividades: ${data.activities.length}`;
  const alerts = [];
  data.supplies.filter(x => Number(x.quantity) <= 5).forEach(x => alerts.push({icon:"⚠",title:`Stock bajo: ${x.name}`,detail:`Quedan ${x.quantity} ${x.unit}`}));
  data.activities.filter(x => x.status === "Pendiente").forEach(x => alerts.push({icon:"◷",title:`Pendiente: ${x.name}`,detail:`${x.crop} · ${formatDate(x.date)}`}));
  $("alertCount").textContent = alerts.length;
  $("dashboardAlerts").innerHTML = alerts.length ? alerts.slice(0,4).map(x => `<div class="alert-row"><span class="alert-icon">${x.icon}</span><div><strong>${escapeHTML(x.title)}</strong><small>${escapeHTML(x.detail)}</small></div></div>`).join("") : `<p class="muted">No hay alertas por el momento.</p>`;
  const counts=[data.crops.length,data.supplies.length,data.irrigation.length,data.activities.length];
  document.querySelectorAll("#moduleChart .chart-column").forEach((col,i)=>{
    const n=Math.max(1,Math.min(6,counts[i]));
    col.querySelector(".chart-dots").innerHTML=Array.from({length:n},()=>"<i></i>").join("");
  });
}
function renderAll() { renderDashboard(); renderDashboardExtras(); renderCrops(); renderSupplies(); renderIrrigation(); renderActivities(); bindActions(); }
$("cropSearch").addEventListener("input", renderCrops);
$("supplySearch").addEventListener("input", renderSupplies);

document.querySelectorAll("[data-go-section]").forEach(button => button.addEventListener("click", () => navigate(button.dataset.goSection)));
$("refreshDashboard").addEventListener("click", () => { renderAll(); showToast("Panel actualizado."); });