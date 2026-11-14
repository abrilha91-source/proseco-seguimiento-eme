/* Seguimiento PROSECO · EME v1.1 — datos solo en el dispositivo (localStorage + IndexedDB). */
"use strict";
const VER = "1.1";
const LS = "proseco-eme-v1";
const CAT = window.PROSECO_CATALOGO || [];
const CATMAP = Object.fromEntries(CAT.map(c => [c.id, c]));
const SEM = { r: "Rojo · Hace falta", a: "Amarillo · Se está trabajando", v: "Verde · Ya se cumplió", "": "Sin definir" };
const SEMC = { r: "Hace falta", a: "Se está trabajando", v: "Ya se cumplió", "": "Sin definir" };
const SECN = { principal: "Formato (Educativa y Administrativa)", admin: "Solo evaluación administrativa" };
/* Estructura de «Datos generales» del formato (solo etiquetas; los valores los captura el plantel). */
const DG_ROWS = [
  { k: "efr", t: "Efectivos reales", cols: 4 }, { k: "gi", t: "Efectivos del Grupo de Inteligencia según planilla orgánica", cols: 4 },
  { k: "alim", t: "Efectivo de personal del servicio de alimentación", cols: 4 }, { k: "fem", t: "Efectivos reales de personal femenino", cols: 4 },
  { k: "les", t: "Cantidad de personal lesionado", cols: 4, gris: [0, 1] }, { k: "lesas", t: "Cantidad de personal lesionado en actos del servicio", cols: 4 },
  { k: "fal", t: "Cantidad de personal fallecido", cols: 4 }, { k: "falas", t: "Cantidad de personal fallecido en actos del servicio", cols: 4 },
  { k: "falt", t: "Cantidad total de faltistas (1/o., 2/o. y 3/er. día)", cols: 1 }, { k: "cargo", t: "Cantidad total de artículos de cargo de la unidad", cols: 1 },
  { k: "vye", t: "Cantidad de artículos de vestuario y equipo", cols: 2, lbl: ["Vestuario", "Equipo"] }, { k: "med", t: "Cantidad de equipos médicos y odontológicos", cols: 1 },
  { k: "comp", t: "Cantidad de equipos de cómputo en estado de uso (Operativos)", cols: 3, lbl: ["Internet", "Intranet", "Aislados"] },
  { k: "compm", t: "Cantidad de equipos de cómputo en mal estado", cols: 1 }, { k: "frig", t: "Cantidad de cámaras frigoríficas", cols: 1 },
  { k: "comu", t: "Cantidad de equipos de comunicaciones", cols: 1 }, { k: "ext", t: "Cantidad de extintores", cols: 1 },
  { k: "aero", t: "Cantidad de aeronaves", cols: 1 }, { k: "veh", t: "Cantidad de vehículos", cols: 1 }, { k: "agr", t: "Cantidad de agresiones", cols: 1 }];
const DG_HEAD = ["Grals.", "Jefes", "Ofs.", "Cdtes./Tropa"];

const $ = (s, r = document) => r.querySelector(s);
const $$ = (s, r = document) => [...r.querySelectorAll(s)];
const esc = s => String(s ?? "").replace(/[&<>"']/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;", "'": "&#39;" }[c]));
const uid = () => (crypto.randomUUID ? crypto.randomUUID() : Date.now().toString(36) + Math.random().toString(36).slice(2, 10));
const hoy = () => { const d = new Date(); return new Date(d - d.getTimezoneOffset() * 6e4).toISOString().slice(0, 10); };
const fFecha = s => { if (!s) return ""; const [y, m, d] = s.split("-"); return `${d}/${m}/${y}`; };
const fBytes = b => b < 1024 ? b + " B" : b < 1048576 ? (b / 1024).toFixed(1) + " KB" : (b / 1048576).toFixed(1) + " MB";
function toast(m) { const t = $("#toast"); t.textContent = m; t.classList.add("on"); clearTimeout(toast.h); toast.h = setTimeout(() => t.classList.remove("on"), 2600); }
function ask(title, msg, okTxt = "Confirmar", danger = false) {
  return new Promise(res => { const d = $("#dAsk"); $("#askT").textContent = title; $("#askM").innerHTML = msg; const b = $("#askOk"); b.textContent = okTxt; b.classList.toggle("danger", danger);
    d.returnValue = ""; d.onclose = () => res(d.returnValue === "ok"); d.showModal(); });
}

/* ---------- Estado ---------- */
function nuevoTrimestre(nombre = "", meses = "", anio = new Date().getFullYear()) {
  const ind = {}; CAT.forEach(c => ind[c.id] = indVacio());
  return { id: uid(), nombre, meses, anio, creado: new Date().toISOString(), dg: { gus: "", plantel: "", nivel: "", v: {} }, ind };
}
function indVacio() { return { sem: "", area: "", resultado: "", obs: "", notas: "", acciones: [] }; }
let S = load();
function load() {
  try { const s = JSON.parse(localStorage.getItem(LS)); if (s && s.trimestres) return normalizar(s); } catch (e) { }
  return { app: "proseco-seguimiento-eme", version: VER, trimestres: [], actual: null, guiaVista: false };
}
function normalizar(s) {
  s.trimestres.forEach(t => { t.ind = t.ind || {}; CAT.forEach(c => { t.ind[c.id] = Object.assign(indVacio(), t.ind[c.id] || {}); }); t.dg = t.dg || { v: {} }; t.dg.v = t.dg.v || {}; });
  if (!s.trimestres.find(t => t.id === s.actual)) s.actual = s.trimestres[0]?.id || null;
  return s;
}
function save() { localStorage.setItem(LS, JSON.stringify(S)); badge(); }
const T = () => S.trimestres.find(t => t.id === S.actual);

/* ---------- IndexedDB para archivos ---------- */
let _db;
function db() {
  if (_db) return _db;
  _db = new Promise((res, rej) => { const r = indexedDB.open("proseco-eme-adjuntos", 1);
    r.onupgradeneeded = () => { const s = r.result.createObjectStore("adj", { keyPath: "id" }); s.createIndex("tri", "tri"); };
    r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
  return _db;
}
async function idb(mode, fn) { const d = await db(); return new Promise((res, rej) => { const tx = d.transaction("adj", mode); const st = tx.objectStore("adj"); let out; Promise.resolve(fn(st)).then(v => out = v); tx.oncomplete = () => res(out); tx.onerror = () => rej(tx.error); }); }
const req = r => new Promise((res, rej) => { r.onsuccess = () => res(r.result); r.onerror = () => rej(r.error); });
const adjPut = rec => idb("readwrite", st => req(st.put(rec)));
const adjGet = id => idb("readonly", st => req(st.get(id)));
const adjDel = id => idb("readwrite", st => req(st.delete(id)));
const adjAll = () => idb("readonly", st => req(st.getAll()));
const adjClear = () => idb("readwrite", st => req(st.clear()));
async function adjMeta() { const all = await adjAll(); return all.map(a => ({ id: a.id, size: a.size })); }

function tipoArchivo(name, mime) {
  const e = (name.split(".").pop() || "").toLowerCase();
  if (/^image\//.test(mime) || ["jpg", "jpeg", "png", "gif", "webp", "heic", "bmp"].includes(e)) return "img";
  if (/^audio\//.test(mime) || ["mp3", "m4a", "wav", "ogg", "aac", "opus", "wma", "amr"].includes(e)) return "aud";
  if (mime === "application/pdf" || e === "pdf") return "pdf";
  if (["doc", "docx"].includes(e)) return "doc";
  if (["xls", "xlsx", "csv"].includes(e)) return "xls";
  return "otro";
}
const PERMITIDO = n => /\.(jpe?g|png|gif|webp|heic|bmp|pdf|docx?|xlsx?|csv|mp3|m4a|wav|ogg|aac|opus|wma|amr)$/i.test(n);

/* ---------- Navegación ---------- */
let vista = "pan";
const F = { q: "", sem: "todos", area: "todas", sec: "todas", mp: false, acc: "todas" };
function go(v) { vista = v; $$(".tabs button").forEach(b => b.setAttribute("aria-selected", b.dataset.v === v)); render(); window.scrollTo(0, 0); }
$$(".tabs button").forEach(b => b.onclick = () => go(b.dataset.v));
function badge() { const t = T(); const n = t ? CAT.filter(c => t.ind[c.id].sem === "r").length : 0; $("#cntR").textContent = n || ""; }
function header() {
  const t = T(); $("#gTri").textContent = t ? `${t.nombre}${t.meses ? " · " + t.meses : ""}` : "Sin trimestre";
  $("#gDate").textContent = new Date().toLocaleDateString("es-MX", { weekday: "long", day: "numeric", month: "long", year: "numeric" });
  const sel = $("#selTri"); sel.innerHTML = S.trimestres.length ? S.trimestres.map(x => `<option value="${x.id}" ${x.id === S.actual ? "selected" : ""}>${esc(x.nombre)}</option>`).join("") : `<option value="">— Crea un trimestre —</option>`;
}
$("#selTri").onchange = e => { S.actual = e.target.value; save(); render(); };
$("#btnNewTri").onclick = () => dlgTrimestre();
$("#btnTour").onclick = () => tour();

function conteo(t, ids = CAT.map(c => c.id)) { const c = { r: 0, a: 0, v: 0, "": 0 }; ids.forEach(i => c[t.ind[i].sem || ""]++); c.tot = ids.length; c.pct = c.tot ? Math.round(c.v * 100 / c.tot) : 0; return c; }
function barra(c) { const p = k => c.tot ? (c[k] * 100 / c.tot) : 0; return `<div class="bar" role="img" aria-label="Verde ${c.v}, amarillo ${c.a}, rojo ${c.r}, sin definir ${c[""]}"><i class="v" style="width:${p("v")}%"></i><i class="a" style="width:${p("a")}%"></i><i class="r" style="width:${p("r")}%"></i><i class="n" style="width:${p("")}%"></i></div>`; }
function sinTri() { return `<div class="card empty"><strong>Aún no hay trimestres</strong>Crea el primer trimestre para empezar a llevar los indicadores, o importa un respaldo.<div class="row" style="justify-content:center;margin-top:14px"><button class="btn" onclick="dlgTrimestre()">+ Crear trimestre</button><button class="btn ghost" onclick="go('res')">Importar respaldo</button><button class="btn ghost" onclick="tour()">▶ Ver la guía interactiva</button></div></div>`; }

function render() {
  header(); badge(); const v = $("#view"); v.onclick = null; v.onchange = null; const t = T();
  if (!t && !["gui", "res", "tri", "ins"].includes(vista)) { v.innerHTML = sinTri(); return; }
  ({ pan: vPan, ind: vInd, dg: vDg, tri: vTri, gui: vGui, res: vRes, ins: vIns })[vista](v, t);
}

/* ---------- Panorama ---------- */
function vPan(v, t) {
  const c = conteo(t); const ids = CAT.map(x => x.id);
  const areas = {}; ids.forEach(i => { const a = (t.ind[i].area || "").trim() || "(Sin asignar)"; (areas[a] = areas[a] || []).push(i); });
  const accs = []; ids.forEach(i => t.ind[i].acciones.forEach(a => accs.push({ i, a })));
  accs.sort((x, y) => (y.a.fecha || "").localeCompare(x.a.fecha || ""));
  const mp = ids.filter(i => t.ind[i].mp);
  v.innerHTML = `<h1>Panorama del trimestre</h1><p class="sub">${esc(t.nombre)}${t.meses ? " · " + esc(t.meses) : ""}${t.anio ? " · " + t.anio : ""} — ${c.tot} indicadores</p>
  <div class="grid g4" id="kpis">${["r", "a", "v", ""].map(k => `<button class="kpi ${k || "n"}" data-k="${k || "n"}"><b>${c[k]}</b><em>${k ? SEM[k].split(" · ")[0] : "Sin definir"}</em><br><span>${SEMC[k]} · ${c.tot ? Math.round(c[k] * 100 / c.tot) : 0} %</span></button>`).join("")}</div>
  <div class="card" style="margin-top:16px"><div class="row" style="justify-content:space-between"><h2 style="margin:0">Avance de cumplimiento</h2><strong style="font-size:22px;color:var(--v)">${c.pct} % en verde</strong></div>${barra(c)}
  <div class="legend"><span><i class="dot v"></i>Ya se cumplió</span><span><i class="dot a"></i>Se está trabajando</span><span><i class="dot r"></i>Hace falta</span><span><i class="dot"></i>Sin definir</span></div></div>
  <div class="grid g2">
   <div class="card"><h2>Por sección del formato</h2>${Object.keys(SECN).map(s => { const cc = conteo(t, CAT.filter(x => x.sec === s).map(x => x.id)); return `<h3>${SECN[s]} <small class="hint">(${cc.tot})</small></h3>${barra(cc)}<p class="hint">Verde ${cc.v} · Amarillo ${cc.a} · Rojo ${cc.r} · Sin definir ${cc[""]}</p>`; }).join("")}
   ${mp.length ? (() => { const cc = conteo(t, mp); return `<h3>Indicadores con menor puntuación <small class="hint">(${cc.tot})</small></h3>${barra(cc)}<p class="hint">Verde ${cc.v} · Amarillo ${cc.a} · Rojo ${cc.r} · Sin definir ${cc[""]}</p>`; })() : ""}</div>
   <div class="card"><h2>Por área responsable</h2>${Object.keys(areas).sort().map(a => { const cc = conteo(t, areas[a]); return `<h3>${esc(a)} <small class="hint">(${cc.tot})</small></h3>${barra(cc)}`; }).join("")}
   <p class="hint" style="margin-top:8px">El «Área responsable» se captura en cada indicador. Mientras esté vacío, aparece como «Sin asignar».</p></div>
  </div>
  <div class="card"><h2>Últimas acciones registradas</h2>${accs.length ? `<table class="t"><tr><th>Fecha</th><th>No.</th><th>Acción</th><th>Responsable</th><th class="c">Archivos</th></tr>${accs.slice(0, 8).map(({ i, a }) => `<tr><td>${fFecha(a.fecha)}</td><td><button class="lnk" onclick="abrirInd('${i}')">${noTxt(i)}</button></td><td>${esc(a.desc)}</td><td>${esc(a.resp || "")}</td><td class="c">${a.adj.length}</td></tr>`).join("")}</table>` : `<p class="hint">Todavía no hay acciones. Abre un indicador y usa «+ Agregar acción» para registrar lo que se hizo y adjuntar evidencias.</p>`}</div>
  <p class="hint">🔒 Los datos y archivos adjuntos se guardan solo en este equipo. Descarga un <button class="lnk" onclick="go('res')">respaldo completo</button> al terminar cada sesión.</p>`;
  $$("#kpis .kpi").forEach(b => b.onclick = () => { F.sem = b.dataset.k; go("ind"); });
}
const noTxt = i => { const c = CATMAP[i]; return (c.sec === "admin" ? "A-" : "") + c.no; };

/* ---------- Indicadores ---------- */
function filtrar(t) {
  const q = F.q.trim().toLowerCase();
  return CAT.filter(c => { const d = t.ind[c.id];
    if (F.sem !== "todos" && (d.sem || "n") !== F.sem) return false;
    if (F.sec !== "todas" && c.sec !== F.sec) return false;
    if (F.area === "__vacia" && d.area.trim()) return false;
    if (F.area !== "todas" && F.area !== "__vacia" && d.area.trim() !== F.area) return false;
    if (F.mp && !d.mp) return false;
    if (F.acc === "con" && !d.acciones.length) return false; if (F.acc === "sin" && d.acciones.length) return false;
    if (q && !(c.txt.toLowerCase().includes(q) || String(c.no) === q || d.area.toLowerCase().includes(q) || d.notas.toLowerCase().includes(q))) return false;
    return true; });
}
function areasUsadas(t) { return [...new Set(CAT.map(c => t.ind[c.id].area.trim()).filter(Boolean))].sort(); }
function vInd(v, t) {
  const areas = areasUsadas(t); const c = conteo(t);
  v.innerHTML = `<h1>Indicadores · semáforo</h1><p class="sub">Toca un color para cambiar el estado. Toca el texto para abrir el detalle: área responsable, observaciones, notas y <b>acciones con evidencias</b>.</p>
  <div class="chips" id="semChips">${[["todos", `Todos (${c.tot})`], ["r", `● Rojo (${c.r})`], ["a", `● Amarillo (${c.a})`], ["v", `● Verde (${c.v})`], ["n", `Sin definir (${c[""]})`]].map(([k, l]) => `<button class="chip" data-k="${k}" aria-pressed="${F.sem === k}">${l}</button>`).join("")}</div>
  <div class="filters" id="filtros">
   <label>Buscar<input id="fq" type="search" placeholder="Número, palabra, área o nota" value="${esc(F.q)}"></label>
   <label>Área responsable<select id="farea"><option value="todas">Todas</option><option value="__vacia" ${F.area === "__vacia" ? "selected" : ""}>Sin asignar</option>${areas.map(a => `<option ${F.area === a ? "selected" : ""}>${esc(a)}</option>`).join("")}</select></label>
   <label>Sección<select id="fsec"><option value="todas">Todas</option>${Object.entries(SECN).map(([k, l]) => `<option value="${k}" ${F.sec === k ? "selected" : ""}>${l}</option>`).join("")}</select></label>
   <label>Acciones<select id="facc"><option value="todas">Todas</option><option value="con" ${F.acc === "con" ? "selected" : ""}>Con acciones</option><option value="sin" ${F.acc === "sin" ? "selected" : ""}>Sin acciones</option></select></label>
   <label>Menor puntuación<select id="fmp"><option value="0">Todos</option><option value="1" ${F.mp ? "selected" : ""}>Solo menor puntuación</option></select></label>
  </div>
  <div class="row" style="justify-content:space-between;margin-bottom:10px"><span class="hint" id="nres"></span><span class="row"><button class="btn ghost sm" id="bMasivo">Cambiar color de los filtrados…</button></span></div>
  <div class="ilist" id="ilist"></div>`;
  const pint = () => { const L = filtrar(t); $("#nres").textContent = `${L.length} de ${CAT.length} indicadores`;
    $("#ilist").innerHTML = L.length ? L.map(c => filaInd(c, t.ind[c.id])).join("") : `<div class="empty"><strong>Sin resultados</strong>Cambia los filtros.</div>`; };
  pint();
  $$("#semChips .chip").forEach(b => b.onclick = () => { F.sem = b.dataset.k; vInd(v, t); });
  $("#fq").oninput = e => { F.q = e.target.value; pint(); };
  $("#farea").onchange = e => { F.area = e.target.value; pint(); };
  $("#fsec").onchange = e => { F.sec = e.target.value; pint(); };
  $("#facc").onchange = e => { F.acc = e.target.value; pint(); };
  $("#fmp").onchange = e => { F.mp = e.target.value === "1"; pint(); };
  $("#ilist").onclick = e => { const b = e.target.closest("[data-sem]"); if (b) { setSem(b.dataset.id, b.dataset.sem); vIndRefreshRow(b.dataset.id); return; }
    const x = e.target.closest("[data-open]"); if (x) abrirInd(x.dataset.open); };
  $("#bMasivo").onclick = async () => { const L = filtrar(t); if (!L.length) return;
    const d = document.createElement("dialog"); d.className = "sm"; d.innerHTML = `<form method="dialog" class="dlg"><h2>Cambiar color a ${L.length} indicadores</h2><p class="hint">Se aplica solo a los indicadores que ves con los filtros actuales.</p><div class="acts" style="justify-content:flex-start">${["r", "a", "v", ""].map(k => `<button class="btn ${k ? "" : "ghost"}" value="${k || "n"}" style="${k ? `background:var(--${k})` : ""}">${k ? SEM[k].split(" · ")[0] : "Sin definir"}</button>`).join("")}</div><div class="acts"><button class="btn ghost" value="">Cancelar</button></div></form>`;
    document.body.append(d); d.onclose = () => { const r = d.returnValue; d.remove(); if (!r) return; L.forEach(c => t.ind[c.id].sem = r === "n" ? "" : r); save(); vInd(v, t); toast(`${L.length} indicadores actualizados`); }; d.showModal(); };
}
function semBtns(id, s, big = false) { return `<div class="sem ${big ? "big" : ""}" role="group" aria-label="Semáforo">${["r", "a", "v"].map(k => `<button type="button" class="${k}" data-sem="${k}" data-id="${id}" aria-pressed="${s === k}" title="${SEM[k]}" aria-label="${SEM[k]}"></button>`).join("")}</div>`; }
function filaInd(c, d) {
  return `<div class="irow ${d.sem}" id="row-${c.id}"><div class="no">${c.sec === "admin" ? "A-" : ""}${c.no}<small>${c.sec === "admin" ? "Solo admva." : "Formato"}</small></div>
  <div class="tx" data-open="${c.id}"><p>${esc(c.txt)}</p><div class="meta"><span class="tag area ${d.area.trim() ? "" : "vacia"}">Área: ${d.area.trim() ? esc(d.area) : "sin asignar"}</span><span class="tag">${SEMC[d.sem]}</span>${d.mp ? `<span class="tag mp">Menor puntuación</span>` : ""}${d.acciones.length ? `<span class="tag acc">${d.acciones.length} acción(es) · ${d.acciones.reduce((n, a) => n + a.adj.length, 0)} archivo(s)</span>` : ""}</div></div>
  ${semBtns(c.id, d.sem)}</div>`;
}
function vIndRefreshRow(id) { const t = T(); const el = $("#row-" + id); if (el) el.outerHTML = filaInd(CATMAP[id], t.ind[id]); const c = conteo(t);
  $$("#semChips .chip").forEach(b => { const k = b.dataset.k; const n = k === "todos" ? c.tot : c[k === "n" ? "" : k]; b.textContent = b.textContent.replace(/\(\d+\)/, `(${n})`); }); }
function setSem(id, k) { const d = T().ind[id]; d.sem = d.sem === k ? "" : k; d.semFecha = new Date().toISOString(); save(); toast(`${noTxt(id)}: ${SEM[d.sem]}`); }

/* ---------- Detalle de indicador ---------- */
let abierto = null;
async function abrirInd(id) {
  abierto = id; const t = T(), c = CATMAP[id], d = t.ind[id]; const dl = $("#dInd");
  const mp = (d.mpEdu || []).length || (d.mpAdm || []).length;
  $("#indBody").innerHTML = `<div class="dhead"><div style="flex:1"><p class="hint">${c.sec === "admin" ? "Indicador solo de la evaluación administrativa" : "Formato para Planteles Militares"} · No. ${c.no} · ${esc(t.nombre)}</p><h2>${esc(c.txt)}</h2></div>
   <div>${semBtns(id, d.sem, true)}<div class="semlbl" id="semLbl">${SEMC[d.sem]}</div></div></div>
   ${mp ? `<div class="mpbox"><b>Señalado en «Indicadores con menor puntuación»</b>${(d.mpEdu || []).map(x => `<ul><li>Educativa (No. ${esc(x.no)}): respuesta «${esc(x.resp)}»${x.obs ? " — " + esc(x.obs) : ""}</li></ul>`).join("")}${(d.mpAdm || []).map(x => `<ul><li>Administrativa (No. ${esc(x.no)}): respuesta «${esc(x.resp)}»${x.obs ? " — " + esc(x.obs) : ""}</li></ul>`).join("")}</div>` : ""}
   <div class="grid g2"><label>Área responsable<input id="iArea" list="dlAreas" value="${esc(d.area)}" placeholder="Pendiente de definir"><datalist id="dlAreas">${areasUsadas(t).map(a => `<option value="${esc(a)}">`).join("")}</datalist></label>
   <label>Resultado / respuesta reportada<input id="iRes" value="${esc(d.resultado)}" placeholder="Ej. Sí, No o la cantidad"></label></div>
   <label>Observaciones del formato<textarea id="iObs" rows="2">${esc(d.obs)}</textarea></label>
   <label>Notas internas / evidencia esperada<textarea id="iNotas" rows="2" placeholder="Qué falta, a quién se pidió, qué documento sirve de evidencia">${esc(d.notas)}</textarea></label>
   <div class="row" style="justify-content:space-between;margin-top:6px"><h2 style="margin:0">Acciones realizadas para dar cumplimiento</h2><button class="btn sm" id="bAddAcc" type="button">+ Agregar acción</button></div>
   <div id="accList"></div>
   <div class="acts"><button class="btn ghost" id="bPrev" type="button">← Anterior</button><button class="btn ghost" id="bNext" type="button">Siguiente →</button><button class="btn" id="bClose" type="button">Guardar y cerrar</button></div>`;
  const guardarCampos = () => { d.area = $("#iArea").value; d.resultado = $("#iRes").value; d.obs = $("#iObs").value; d.notas = $("#iNotas").value; save(); };
  ["iArea", "iRes", "iObs", "iNotas"].forEach(k => $("#" + k).onchange = guardarCampos);
  $(".dhead .sem").onclick = e => { const b = e.target.closest("[data-sem]"); if (!b) return; setSem(id, b.dataset.sem); $$(".dhead .sem button").forEach(x => x.setAttribute("aria-pressed", x.dataset.sem === d.sem)); $("#semLbl").textContent = SEMC[d.sem]; };
  $("#bAddAcc").onclick = () => dlgAccion(id);
  const mover = n => { guardarCampos(); const L = vista === "ind" ? filtrar(t) : CAT; const i = L.findIndex(x => x.id === id); const nx = L[i + n]; if (nx) abrirInd(nx.id); };
  $("#bPrev").onclick = () => mover(-1); $("#bNext").onclick = () => mover(1);
  $("#bClose").onclick = () => { guardarCampos(); dl.close(); };
  dl.onclose = () => { abierto = null; revokeAll(); render(); };
  await pintarAcciones(id);
  if (!dl.open) dl.showModal();
}
let urls = [];
function revokeAll() { urls.forEach(u => URL.revokeObjectURL(u)); urls = []; }
const objURL = b => { const u = URL.createObjectURL(b); urls.push(u); return u; };
async function pintarAcciones(id) {
  const d = T().ind[id]; const box = $("#accList"); revokeAll();
  if (!d.acciones.length) { box.innerHTML = `<p class="hint">Sin acciones registradas. Agrega cada actividad realizada con su fecha y adjunta las evidencias (fotos, oficios en PDF o Word, tablas de Excel, audios).</p>`; return; }
  const L = [...d.acciones].sort((a, b) => (b.fecha || "").localeCompare(a.fecha || ""));
  let h = "";
  for (const a of L) {
    let fh = "";
    for (const fid of a.adj) { const f = await adjGet(fid); if (!f) { fh += `<div class="file"><span class="fn">Archivo no disponible en este dispositivo</span></div>`; continue; }
      const u = objURL(f.blob); const tp = tipoArchivo(f.name, f.type);
      const vis = tp === "img" ? `<img src="${u}" alt="${esc(f.name)}" data-big="${u}">` : tp === "aud" ? `<div class="ic aud">♪</div><audio controls preload="metadata" src="${u}"></audio>` : `<div class="ic ${tp}">${{ pdf: "PDF", doc: "W", xls: "X", otro: "?" }[tp]}</div>`;
      fh += `<div class="file">${vis}<span class="fn">${esc(f.name)}</span><span class="hint">${fBytes(f.size)}</span><span class="fb">${tp === "pdf" ? `<a class="lnk" href="${u}" target="_blank" rel="noopener">Abrir</a>` : ""}<a class="lnk" href="${u}" download="${esc(f.name)}">Descargar</a><button class="lnk del" data-delf="${fid}" data-acc="${a.id}">Eliminar</button></span></div>`; }
    h += `<div class="acc"><div class="ah"><b>${fFecha(a.fecha)}</b>${a.resp ? `<span class="tag">Resp.: ${esc(a.resp)}</span>` : ""}<span style="margin-left:auto" class="row"><button class="lnk" data-addf="${a.id}">+ Adjuntar</button><button class="lnk" data-edit="${a.id}">Editar</button><button class="lnk del" data-dela="${a.id}">Eliminar acción</button></span></div><p>${esc(a.desc)}</p>${fh ? `<div class="files">${fh}</div>` : ""}</div>`;
  }
  box.innerHTML = h;
  box.onclick = async e => { const x = e.target;
    if (x.dataset.big) { $("#imgBody").innerHTML = `<img src="${x.dataset.big}" style="max-width:100%;max-height:75vh;display:block;margin:auto">`; $("#dImg").showModal(); }
    if (x.dataset.delf) { const f = await adjGet(x.dataset.delf); if (await ask("Eliminar archivo", `¿Eliminar <b>${esc(f?.name || "archivo")}</b> de este dispositivo? No se puede deshacer.`, "Eliminar", true)) { await adjDel(x.dataset.delf); const a = d.acciones.find(y => y.id === x.dataset.acc); a.adj = a.adj.filter(z => z !== x.dataset.delf); save(); pintarAcciones(id); storageInfo(); toast("Archivo eliminado"); } }
    if (x.dataset.dela) { const a = d.acciones.find(y => y.id === x.dataset.dela); if (await ask("Eliminar acción", `¿Eliminar la acción del ${fFecha(a.fecha)}${a.adj.length ? ` y sus <b>${a.adj.length} archivo(s)</b>` : ""}? No se puede deshacer.`, "Eliminar", true)) { for (const f of a.adj) await adjDel(f); d.acciones = d.acciones.filter(y => y !== a); save(); pintarAcciones(id); storageInfo(); toast("Acción eliminada"); } }
    if (x.dataset.edit) dlgAccion(id, x.dataset.edit);
    if (x.dataset.addf) dlgAccion(id, x.dataset.addf, true);
  };
}
$("#imgClose").onclick = () => $("#dImg").close();
function dlgAccion(id, accId = null, soloArchivos = false) {
  const d = T().ind[id]; const a = accId ? d.acciones.find(x => x.id === accId) : null; const dl = $("#dAcc");
  $("#accT").textContent = soloArchivos ? "Adjuntar archivos" : a ? "Editar acción" : "Nueva acción · " + noTxt(id);
  $("#aFecha").value = a?.fecha || hoy(); $("#aDesc").value = a?.desc || ""; $("#aResp").value = a?.resp || ""; $("#aFiles").value = "";
  $("#aFilesHint").textContent = "Los archivos se guardan solo en este dispositivo (no se suben a internet).";
  dl.returnValue = ""; dl.showModal();
  $("#accForm").onsubmit = null;
  dl.onclose = async () => { if (dl.returnValue !== "ok") return;
    const files = [...$("#aFiles").files]; const malos = files.filter(f => !PERMITIDO(f.name)); const buenos = files.filter(f => PERMITIDO(f.name));
    const acc = a || { id: uid(), adj: [] }; acc.fecha = $("#aFecha").value || hoy(); acc.desc = $("#aDesc").value.trim(); acc.resp = $("#aResp").value.trim();
    for (const f of buenos) { const fid = uid(); await adjPut({ id: fid, tri: S.actual, ind: id, acc: acc.id, name: f.name, type: f.type || "", size: f.size, fecha: new Date().toISOString(), blob: f }); acc.adj.push(fid); }
    if (!a) d.acciones.push(acc); save(); await pintarAcciones(id); storageInfo();
    toast(`Acción guardada${buenos.length ? ` con ${buenos.length} archivo(s)` : ""}`);
    if (malos.length) setTimeout(() => toast(`No se adjuntaron ${malos.length} archivo(s) de tipo no permitido`), 2700);
  };
}

/* ---------- Datos generales ---------- */
function vDg(v, t) {
  const g = t.dg; const val = (k, i) => (g.v[k] || [])[i] ?? "";
  v.innerHTML = `<h1>Datos generales del plantel</h1><p class="sub">Dato del organismo al final del trimestre · ${esc(t.nombre)}. Se guarda al salir de cada casilla.</p>
  <div class="card"><div class="grid g3"><label>Gran Unidad Superior<input data-h="gus" value="${esc(g.gus || "")}"></label><label>Plantel Militar<input data-h="plantel" value="${esc(g.plantel || "")}"></label><label>Nivel<input data-h="nivel" value="${esc(g.nivel || "")}"></label></div></div>
  <div class="card"><table class="t" id="dgT"><tr><th>Dato</th>${DG_HEAD.map(h => `<th class="c">${h}</th>`).join("")}</tr>
  ${DG_ROWS.map(r => { if (r.cols === 4) return `<tr><td>${r.t}</td>${[0, 1, 2, 3].map(i => (r.gris || []).includes(i) ? `<td class="gris"></td>` : `<td class="c"><input data-k="${r.k}" data-i="${i}" value="${esc(val(r.k, i))}"></td>`).join("")}</tr>`;
    if (r.cols === 1) return `<tr><td>${r.t}</td><td colspan="4" class="c"><input data-k="${r.k}" data-i="0" value="${esc(val(r.k, 0))}" style="max-width:200px"></td></tr>`;
    const span = r.cols === 2 ? [2, 2] : [1, 1, 2];
    return `<tr><td>${r.t}</td>${r.lbl.map((l, i) => `<td colspan="${span[i]}" class="c"><span class="hint">${l}</span><input data-k="${r.k}" data-i="${i}" value="${esc(val(r.k, i))}"></td>`).join("")}</tr>`; }).join("")}</table></div>`;
  v.onchange = e => { const x = e.target; if (x.dataset.h) g[x.dataset.h] = x.value; if (x.dataset.k) { (g.v[x.dataset.k] = g.v[x.dataset.k] || [])[+x.dataset.i] = x.value; } save(); toast("Guardado"); };
}

/* ---------- Trimestres ---------- */
function dlgTrimestre() {
  const dl = $("#dTri"); $("#tNom").value = ""; $("#tMes").value = ""; $("#tAnio").value = new Date().getFullYear();
  $("#tBase").innerHTML = `<option value="">Estructura en blanco (catálogo de indicadores)</option>` + S.trimestres.map(t => `<option value="${t.id}" ${t.id === S.actual ? "selected" : ""}>${esc(t.nombre)}</option>`).join("");
  const opt = () => $("#tOpts").disabled = !$("#tBase").value; $("#tBase").onchange = opt; opt();
  dl.returnValue = ""; dl.showModal();
  dl.onclose = () => { if (dl.returnValue !== "ok") return; const nom = $("#tNom").value.trim(); if (!nom) return;
    const nt = nuevoTrimestre(nom, $("#tMes").value.trim(), +$("#tAnio").value || ""); const base = S.trimestres.find(t => t.id === $("#tBase").value);
    if (base) { CAT.forEach(c => { const b = base.ind[c.id]; if ($("#tCpArea").checked) nt.ind[c.id].area = b.area; if ($("#tCpSem").checked) nt.ind[c.id].sem = b.sem; });
      if ($("#tCpDg").checked) nt.dg = JSON.parse(JSON.stringify(base.dg)); else nt.dg = { gus: base.dg.gus || "", plantel: base.dg.plantel || "", nivel: base.dg.nivel || "", v: {} }; }
    S.trimestres.push(nt); S.actual = nt.id; save(); render(); toast("Trimestre creado: " + nom); };
}
function vTri(v) {
  const L = S.trimestres;
  v.innerHTML = `<h1>Trimestres</h1><p class="sub">Las evaluaciones PROSECO son trimestrales. Cada trimestre guarda su propio semáforo, área responsable, acciones y evidencias.</p>
  <div class="row" style="margin-bottom:14px"><button class="btn" onclick="dlgTrimestre()">+ Nuevo trimestre</button></div>
  ${L.length ? `<div class="card"><table class="t"><tr><th>Trimestre</th><th>Meses</th><th class="c">Año</th><th style="width:30%">Avance</th><th class="c">Verde</th><th class="c">Acciones</th><th></th></tr>
  ${L.map(t => { const c = conteo(t); const na = CAT.reduce((n, x) => n + t.ind[x.id].acciones.length, 0); return `<tr><td><b>${esc(t.nombre)}</b>${t.id === S.actual ? `<br><span class="tag acc">activo</span>` : ""}</td><td>${esc(t.meses || "")}</td><td class="c">${t.anio || ""}</td><td>${barra(c)}</td><td class="c">${c.pct} %</td><td class="c">${na}</td>
   <td><span class="row"><button class="lnk" data-act="${t.id}">Activar</button><button class="lnk" data-ren="${t.id}">Renombrar</button><button class="lnk del" data-del="${t.id}">Eliminar</button></span></td></tr>`; }).join("")}</table></div>
  <div class="card"><h2>Comparativo entre trimestres</h2>${L.length < 2 ? `<p class="hint">Cuando tengas dos o más trimestres, aquí verás cómo cambió cada indicador.</p>` : comparativo(L)}</div>` : sinTri()}`;
  v.onclick = async e => { const x = e.target;
    if (x.dataset.act) { S.actual = x.dataset.act; save(); render(); }
    if (x.dataset.ren) { const t = L.find(y => y.id === x.dataset.ren); const n = prompt("Nuevo nombre del trimestre", t.nombre); if (n && n.trim()) { t.nombre = n.trim(); const m = prompt("Meses que abarca", t.meses || ""); if (m !== null) t.meses = m.trim(); save(); render(); } }
    if (x.dataset.del) { const t = L.find(y => y.id === x.dataset.del); const na = CAT.reduce((n, y) => n + t.ind[y.id].acciones.reduce((m, a) => m + a.adj.length, 0), 0);
      if (await ask("Eliminar trimestre", `¿Eliminar <b>${esc(t.nombre)}</b> con su semáforo, acciones${na ? ` y <b>${na} archivo(s)</b>` : ""}? Te recomiendo descargar antes un respaldo completo. No se puede deshacer.`, "Eliminar", true)) {
        for (const c of CAT) for (const a of t.ind[c.id].acciones) for (const f of a.adj) await adjDel(f);
        S.trimestres = L.filter(y => y !== t); if (S.actual === t.id) S.actual = S.trimestres[0]?.id || null; save(); render(); toast("Trimestre eliminado"); } }
  };
}
function comparativo(L) {
  const cambia = CAT.filter(c => new Set(L.map(t => t.ind[c.id].sem)).size > 1);
  return `<table class="t cmp"><tr><th>Resumen</th>${L.map(t => `<th class="c">${esc(t.nombre)}</th>`).join("")}</tr>
  ${["v", "a", "r", ""].map(k => `<tr><td><i class="dot ${k}"></i>${SEMC[k]}</td>${L.map(t => `<td class="c">${conteo(t)[k]}</td>`).join("")}</tr>`).join("")}
  <tr><td><b>% en verde</b></td>${L.map(t => `<td class="c"><b>${conteo(t).pct} %</b></td>`).join("")}</tr></table>
  <h3>Indicadores que cambiaron de color (${cambia.length})</h3>
  ${cambia.length ? `<table class="t cmp"><tr><th>No.</th><th>Indicador</th>${L.map(t => `<th class="c">${esc(t.nombre)}</th>`).join("")}</tr>${cambia.map(c => `<tr><td>${noTxt(c.id)}</td><td>${esc(c.txt)}</td>${L.map(t => `<td class="c"><i class="dot ${t.ind[c.id].sem}" title="${SEMC[t.ind[c.id].sem]}"></i></td>`).join("")}</tr>`).join("")}</table>` : `<p class="hint">Ningún indicador cambió de color entre los trimestres.</p>`}`;
}

/* ---------- Guía ---------- */
function vGui(v) {
  v.innerHTML = `<div class="guide"><h1>Guía</h1><p class="sub">Qué es PROSECO, cómo se usa esta app y de dónde sale la información.</p>
  <div class="row" style="margin-bottom:14px"><button class="btn oro" onclick="tour()">▶ Iniciar la guía interactiva</button></div>
  <details open><summary>¿Qué es PROSECO?</summary>
   <p><b>PROSECO</b> es el <b>Programa Interno de Seguimiento y Control</b> en el Ejército, Fuerza Aérea y Guardia Nacional. El formato que usa el plantel se llama <i>«Formato para Planteles Militares (Evaluación Educativa y Administrativa)»</i>.</p>
   <p>El <b>Programa Sectorial de Defensa Nacional 2025-2030</b> (DOF, 1 de septiembre de 2025) lo menciona en el Objetivo 2, Estrategia 2.2, línea de acción <b>2.2.6</b>: <i>«Modernizar el programa Interno de Seguimiento y Control de Comandantes y Directores de los organismos del Ejército, Fuerza Aérea y Guardia Nacional, para garantizar el adecuado ejercicio del mando en sus funciones.»</i> La Estrategia 2.2 busca <i>«fortalecer el Sistema Administrativo a través de procesos, procedimientos y tecnologías para planificar, ejecutar y monitorear las actividades necesarias que permitan alcanzar las metas de Defensa.»</i></p>
   <p>Según el formato del plantel (4/o. Trimestre, Jun.–Ago. 2026), la evaluación tiene:</p>
   <ul><li><b>Datos generales</b> del organismo al final del trimestre (efectivos, lesionados, faltistas, artículos de cargo, equipo de cómputo, vehículos, etc.).</li>
   <li><b>125 indicadores numerados</b> (el No. 122 no aparece en el formato) con respuesta <i>Resultado</i> y <i>Observaciones</i>; en varios se anota por separado lo que contesta el área <b>Educativa</b> y el área <b>Administrativa</b>.</li>
   <li><b>5 indicadores de la evaluación administrativa</b> que no están en la educativa (labor social, comisiones reclutadoras, cadena de custodia, estudios por el art. 200 del R.G.S.I.UU.DD.II. y estudios de nivel superior).</li>
   <li>Una revisión de <b>«Indicadores con menor puntuación»</b> por área, con la justificación de cada uno.</li></ul>
   <div class="warnbox"><b>Lo que no se encontró en fuentes públicas:</b> la directiva que regula PROSECO, su escala de puntuación, los plazos de entrega y quién califica. No es información pública. Esta app <b>no inventa reglas oficiales</b>: el semáforo es una herramienta interna de seguimiento, no la calificación oficial.</div>
  </details>
  <details><summary>El semáforo</summary>
   <ul><li><i class="dot r"></i><b>Rojo · Hace falta:</b> el indicador no se cumple o falta la evidencia.</li>
   <li><i class="dot a"></i><b>Amarillo · Se está trabajando:</b> ya hay acciones en curso.</li>
   <li><i class="dot v"></i><b>Verde · Ya se cumplió:</b> cumplido y con evidencia.</li>
   <li><i class="dot"></i><b>Sin definir:</b> aún no se revisa. Así inicia cada indicador.</li></ul>
   <p>Toca el mismo color otra vez para regresarlo a «Sin definir». En «Indicadores» puedes filtrar por color, área, sección, acciones o menor puntuación y cambiar de color a todos los filtrados.</p>
   <p class="hint">Ojo: en el formato muchas preguntas son de «¿Se han presentado casos…?», donde la respuesta deseable es «No». El color indica si el plantel está bien en ese rubro, no si la respuesta es «Sí».</p>
  </details>
  <details><summary>Paso a paso</summary><ol class="steps">
   <li><b>Instala la app</b> en tu equipo (pestaña «Instalar y sin internet») para usarla sin conexión.</li>
   <li><b>Crea el trimestre</b> con «+ Nuevo trimestre» (ej. «1/er. Trimestre 2027 · Sep., Oct., Nov.»). Si ya tienes uno, puedes copiar su estructura y el área responsable.</li>
   <li><b>Captura los datos generales</b> en la pestaña «Datos generales».</li>
   <li><b>Revisa cada indicador</b> en «Indicadores» y ponle color.</li>
   <li><b>Asigna el área responsable</b> dentro de cada indicador (queda en blanco hasta que tengas esa información).</li>
   <li><b>Registra las acciones</b> realizadas para dar cumplimiento, con fecha, responsable y archivos de evidencia (fotos, PDF, Word, Excel, CSV o audio).</li>
   <li><b>Consulta el Panorama</b> para ver cuántos van en rojo, amarillo y verde.</li>
   <li><b>Exporta</b> a Excel o imprime, y <b>descarga el respaldo completo</b> con los archivos al terminar cada sesión de trabajo.</li>
   <li>Al iniciar el siguiente trimestre, créalo copiando la estructura y compara el avance en «Trimestres».</li></ol></details>
  <details><summary>Instalar la app y usarla sin internet</summary>
   <p>La app se puede <b>instalar</b> en celular, tableta o computadora y funciona <b>sin internet</b> después de abrirla una vez con conexión.</p>
   <ul><li><b>Android (Chrome):</b> botón «⤓ Instalar app» arriba, o menú ⋮ → «Instalar app» / «Agregar a pantalla principal».</li>
   <li><b>iPhone / iPad (Safari):</b> botón Compartir (cuadro con flecha ↑) → «Agregar a inicio» → «Agregar».</li>
   <li><b>Computadora Windows (Chrome o Edge):</b> ícono de instalar al final de la barra de direcciones, o el botón «⤓ Instalar app».</li></ul>
   <p>Para comprobar que funciona sin internet: abre la app instalada, activa el modo avión y vuelve a abrirla. Arriba verás «Sin conexión» y podrás seguir trabajando.</p>
   <p><button class="btn sm" onclick="go('ins')">Ver la guía de instalación paso a paso</button></p></details>
  <details><summary>¿Dónde se guardan los datos?</summary><p>Solo en este dispositivo y navegador: los textos en el almacenamiento local y los archivos adjuntos en la base de datos del navegador (IndexedDB). No se envía nada a internet. Si borras los datos del navegador o cambias de equipo, necesitas el <b>respaldo completo (.zip)</b> para recuperarlos.</p></details>
  <details><summary>Fuentes</summary><ul>
   <li>Formato «Indicadores PROSECO 4/o. Trimestre de la E.M.E. Jun., Jul., Ago.» (Noviembre 2026), proporcionado por el plantel. Estructura de datos generales e indicadores tomada de ahí.</li>
   <li>Programa Sectorial de Defensa Nacional 2025-2030, DOF 01-09-2025, Objetivo 2, Estrategia 2.2, línea de acción 2.2.6: <a href="https://sidof.segob.gob.mx/notas/5767018" target="_blank" rel="noopener">sidof.segob.gob.mx/notas/5767018</a></li>
   <li>Contexto (no habla de PROSECO): Reglamento para el Servicio Interior de las Unidades, Dependencias e Instalaciones del Ejército y Fuerza Aérea Mexicanos, arts. 123–124 (revistas de inspección): <a href="http://www.ordenjuridico.gob.mx/Documentos/Federal/html/wo88955.html" target="_blank" rel="noopener">ordenjuridico.gob.mx</a></li>
  </ul><p class="hint">Búsquedas realizadas el 14 de noviembre de 2026. No se encontró un documento público que describa el procedimiento de PROSECO; lo marcado como «no encontrado» debe confirmarse con la Dir. Gral. Educ. Mil. y R.U.D.E.F.A. y G.N.</p></details></div>`;
}

/* ---------- Respaldo y exportar ---------- */
async function storageInfo() {
  const el = $("#stInfo"); const all = await adjMeta(); const tot = all.reduce((n, a) => n + a.size, 0);
  let est = ""; try { const e = await navigator.storage.estimate(); est = ` · Espacio usado por la app: ${fBytes(e.usage || 0)} de ${fBytes(e.quota || 0)} disponibles`; } catch (e) { }
  const txt = `${all.length} archivo(s) adjunto(s): ${fBytes(tot)}${est}`; if (el) el.textContent = txt; $("#storeSt").textContent = `${all.length} archivos · ${fBytes(tot)}`; return txt;
}
function vRes(v) {
  v.innerHTML = `<h1>Respaldo y exportar</h1><p class="sub">Todo se guarda solo en este dispositivo. Descarga respaldos con frecuencia.</p>
  <div class="warnbox" style="margin-bottom:16px">Los datos y los archivos adjuntos viven <b>solo en este equipo y en este navegador</b>. Si se borran los datos del navegador, se desinstala la app o cambias de equipo, solo podrás recuperarlos con un <b>respaldo completo (.zip)</b>. Descárgalo al terminar cada sesión.</div>
  <div class="card"><h2>Almacenamiento</h2><p class="storage" id="stInfo">Calculando…</p><button class="btn ghost sm" id="bPersist">Pedir al navegador que no borre los datos</button></div>
  <div class="grid g2">
  <div class="card"><h2>Respaldo completo (.zip)</h2><p class="hint">Incluye todos los trimestres, semáforos, acciones y <b>los archivos adjuntos</b>. Úsalo para cambiar de equipo.</p><div class="row" style="margin-top:10px"><button class="btn" id="bZip">Descargar respaldo completo</button></div></div>
  <div class="card"><h2>Respaldo ligero (.json)</h2><p class="hint">Solo datos, sin archivos. Opción para incluir los archivos dentro del JSON (base64; pesa más).</p><div class="row" style="margin-top:10px"><button class="btn ghost" id="bJson">Descargar JSON sin archivos</button><button class="btn ghost" id="bJson64">JSON con archivos</button></div></div>
  </div>
  <div class="card"><h2>Importar respaldo</h2><p class="hint">Acepta el respaldo completo (.zip) o un .json de esta app.</p>
   <div class="row" style="margin-top:10px"><input type="file" id="fImp" accept=".zip,.json,application/json,application/zip" style="max-width:360px"></div>
   <fieldset class="chk" style="margin-top:10px"><label><input type="radio" name="modo" value="combinar" checked> Combinar: agrega los trimestres del respaldo (si ya existe el mismo trimestre, lo reemplaza)</label><label><input type="radio" name="modo" value="reemplazar"> Reemplazar todo lo de este dispositivo</label></fieldset>
   <div class="row" style="margin-top:10px"><button class="btn" id="bImp">Importar</button></div></div>
  <div class="card"><h2>Exportar el trimestre activo</h2><p class="hint">Excel con letra Noto Sans 10: indicadores con semáforo, datos generales, acciones y comparativo.</p>
   <div class="row" style="margin-top:10px"><button class="btn" id="bXlsx" ${T() ? "" : "disabled"}>Descargar Excel</button><button class="btn ghost" id="bPrint" ${T() ? "" : "disabled"}>Imprimir</button></div></div>
  <div class="card"><h2>Borrar todo</h2><p class="hint">Elimina trimestres y archivos de este dispositivo.</p><button class="btn danger sm" id="bWipe">Borrar todos los datos</button></div>`;
  storageInfo();
  $("#bPersist").onclick = async () => { const ok = navigator.storage?.persist ? await navigator.storage.persist() : false; toast(ok ? "El navegador conservará los datos" : "El navegador no lo permitió; descarga respaldos"); };
  $("#bZip").onclick = exportZip; $("#bJson").onclick = () => exportJson(false); $("#bJson64").onclick = () => exportJson(true);
  $("#bImp").onclick = async () => { const f = $("#fImp").files[0]; if (!f) return toast("Elige un archivo"); const modo = $("input[name=modo]:checked").value;
    if (modo === "reemplazar" && S.trimestres.length && !(await ask("Reemplazar todo", "Se borrarán los datos y archivos actuales de este dispositivo y se cargará el respaldo.", "Reemplazar", true))) return;
    try { const n = await importar(f, modo); toast(`Respaldo importado: ${n.t} trimestre(s), ${n.f} archivo(s)`); render(); } catch (e) { console.error(e); toast("No se pudo importar: " + e.message); } };
  $("#bXlsx").onclick = exportXlsx; $("#bPrint").onclick = imprimir;
  $("#bWipe").onclick = async () => { if (await ask("Borrar todo", "¿Borrar <b>todos</b> los trimestres y archivos de este dispositivo? Descarga antes un respaldo completo.", "Borrar todo", true)) { await adjClear(); S = { app: "proseco-seguimiento-eme", version: VER, trimestres: [], actual: null, guiaVista: true }; save(); render(); toast("Datos borrados"); } };
}
function bajar(blob, name) { const u = URL.createObjectURL(blob); const a = document.createElement("a"); a.href = u; a.download = name; document.body.append(a); a.click(); a.remove(); setTimeout(() => URL.revokeObjectURL(u), 4000); }
const sello = () => hoy().replace(/-/g, "");
const b64 = blob => new Promise(r => { const fr = new FileReader(); fr.onload = () => r(String(fr.result).split(",")[1]); fr.readAsDataURL(blob); });
async function exportJson(conArchivos) {
  const out = { ...JSON.parse(JSON.stringify(S)), exportado: new Date().toISOString() };
  if (conArchivos) { const all = await adjAll(); out.adjuntos = await Promise.all(all.map(async a => ({ id: a.id, tri: a.tri, ind: a.ind, acc: a.acc, name: a.name, type: a.type, size: a.size, fecha: a.fecha, b64: await b64(a.blob) }))); }
  bajar(new Blob([JSON.stringify(out, null, 1)], { type: "application/json" }), `PROSECO_respaldo_${conArchivos ? "con_archivos_" : ""}${sello()}.json`); toast("Respaldo descargado");
}
async function exportZip() {
  if (!window.JSZip) await cargar("vendor/jszip.min.js");
  const z = new JSZip(); const all = await adjAll();
  z.file("proseco_datos.json", JSON.stringify({ ...S, exportado: new Date().toISOString(), adjuntos: all.map(a => ({ id: a.id, tri: a.tri, ind: a.ind, acc: a.acc, name: a.name, type: a.type, size: a.size, fecha: a.fecha, ruta: `adjuntos/${a.id}__${a.name}` })) }, null, 1));
  all.forEach(a => z.file(`adjuntos/${a.id}__${a.name}`, a.blob));
  const blob = await z.generateAsync({ type: "blob" }); bajar(blob, `PROSECO_respaldo_completo_${sello()}.zip`); toast(`Respaldo completo descargado (${all.length} archivos)`);
}
function cargar(src) { return new Promise((res, rej) => { const s = document.createElement("script"); s.src = src; s.onload = res; s.onerror = () => rej(new Error("no se cargó " + src)); document.head.append(s); }); }
async function importar(file, modo) {
  let data, files = [];
  if (/\.zip$/i.test(file.name) || file.type.includes("zip")) {
    if (!window.JSZip) await cargar("vendor/jszip.min.js");
    const z = await JSZip.loadAsync(file); const j = z.file("proseco_datos.json"); if (!j) throw new Error("el .zip no contiene proseco_datos.json");
    data = JSON.parse(await j.async("string"));
    for (const m of data.adjuntos || []) { const zf = z.file(m.ruta); if (zf) files.push({ ...m, blob: new Blob([await zf.async("arraybuffer")], { type: m.type || "" }) }); }
  } else {
    data = JSON.parse(await file.text());
    for (const m of data.adjuntos || []) if (m.b64) { const bin = atob(m.b64); const u = new Uint8Array(bin.length); for (let i = 0; i < bin.length; i++) u[i] = bin.charCodeAt(i); files.push({ ...m, blob: new Blob([u], { type: m.type || "" }) }); }
  }
  if (!data || !Array.isArray(data.trimestres)) throw new Error("no es un respaldo de esta app");
  const inc = normalizar({ trimestres: data.trimestres, actual: data.actual });
  if (modo === "reemplazar") { await adjClear(); S.trimestres = []; }
  else { for (const t of inc.trimestres) { const old = S.trimestres.find(x => x.id === t.id); if (old) for (const c of CAT) for (const a of old.ind[c.id].acciones) for (const f of a.adj) await adjDel(f); } }
  inc.trimestres.forEach(t => { const i = S.trimestres.findIndex(x => x.id === t.id); if (i >= 0) S.trimestres[i] = t; else S.trimestres.push(t); });
  for (const f of files) await adjPut({ id: f.id, tri: f.tri, ind: f.ind, acc: f.acc, name: f.name, type: f.type, size: f.size ?? f.blob.size, fecha: f.fecha, blob: f.blob });
  S.actual = inc.actual || S.trimestres[0]?.id || null; save(); storageInfo();
  return { t: inc.trimestres.length, f: files.length };
}
/* Excel con xlsx-js-style: Noto Sans 10, encabezados combinados */
async function exportXlsx() {
  if (!window.XLSX) await cargar("vendor/xlsx.bundle.js");
  const t = T(); const wb = XLSX.utils.book_new();
  const B = { top: { style: "thin" }, bottom: { style: "thin" }, left: { style: "thin" }, right: { style: "thin" } };
  const st = (o = {}) => ({ font: { name: "Noto Sans", sz: 10, bold: !!o.b, color: o.fc ? { rgb: o.fc } : undefined }, alignment: { wrapText: true, vertical: "center", horizontal: o.h || "left" }, border: o.nb ? undefined : B, fill: o.fill ? { fgColor: { rgb: o.fill } } : undefined });
  const FILL = { r: "F4B6BF", a: "FFE08A", v: "B7E4C7", "": "FFFFFF" };
  const hoja = (rows, widths, merges, nombre) => { const ws = XLSX.utils.aoa_to_sheet(rows.map(r => r.map(c => (c && typeof c === "object" && "v" in c) ? c.v : c)));
    rows.forEach((r, i) => r.forEach((c, j) => { const ref = XLSX.utils.encode_cell({ r: i, c: j }); if (!ws[ref]) ws[ref] = { t: "s", v: "" }; ws[ref].s = (c && typeof c === "object" && c.s) ? c.s : st(); }));
    ws["!cols"] = widths.map(w => ({ wch: w })); ws["!merges"] = merges; XLSX.utils.book_append_sheet(wb, ws, nombre); };
  const tit = (txt, n) => [{ v: txt, s: st({ b: true, h: "center", nb: true }) }, ...Array(n - 1).fill({ v: "", s: st({ nb: true }) })];
  const H = (txt) => ({ v: txt, s: st({ b: true, h: "center", fill: "E8DCC8" }) });
  // Indicadores
  let rows = [tit("Programa Interno de Seguimiento y Control en el Ejército, Fuerza Aérea y Guardia Nacional (PROSECO)", 10), tit(`Seguimiento de indicadores · ${t.nombre}${t.meses ? " · " + t.meses : ""}`, 10), Array(10).fill({ v: "", s: st({ nb: true }) }),
    ["No.", "Sección", "Indicador", "Área responsable", "Semáforo", "Resultado", "Observaciones", "Menor puntuación", "Notas / evidencia", "Acciones realizadas"].map(H)];
  const merges = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 9 } }, { s: { r: 1, c: 0 }, e: { r: 1, c: 9 } }];
  CAT.forEach(c => { const d = t.ind[c.id]; const mp = [...(d.mpEdu || []).map(x => `Educativa ${x.no}: ${x.resp}${x.obs ? " – " + x.obs : ""}`), ...(d.mpAdm || []).map(x => `Administrativa ${x.no}: ${x.resp}${x.obs ? " – " + x.obs : ""}`)].join("\n");
    rows.push([{ v: noTxt(c.id), s: st({ h: "center" }) }, SECN[c.sec], c.txt, d.area, { v: SEMC[d.sem], s: st({ h: "center", fill: FILL[d.sem] }) }, d.resultado, d.obs, mp, d.notas,
      d.acciones.map(a => `${fFecha(a.fecha)}: ${a.desc}${a.resp ? " (" + a.resp + ")" : ""}${a.adj.length ? ` [${a.adj.length} archivo(s)]` : ""}`).join("\n")]); });
  // Filas con misma sección consecutiva: combinar celdas de «Sección»
  let ini = 4; for (let i = 5; i <= rows.length; i++) { if (i === rows.length || rows[i][1] !== rows[ini][1]) { if (i - 1 > ini) merges.push({ s: { r: ini, c: 1 }, e: { r: i - 1, c: 1 } }); ini = i; } }
  const c = conteo(t); rows.push(Array(10).fill({ v: "", s: st({ nb: true }) }));
  rows.push([{ v: `Resumen: Verde ${c.v} · Amarillo ${c.a} · Rojo ${c.r} · Sin definir ${c[""]} · ${c.pct} % cumplido`, s: st({ b: true, nb: true }) }, ...Array(9).fill({ v: "", s: st({ nb: true }) })]);
  merges.push({ s: { r: rows.length - 1, c: 0 }, e: { r: rows.length - 1, c: 9 } });
  hoja(rows, [7, 16, 60, 20, 16, 16, 34, 34, 30, 44], merges, "Indicadores");
  // Datos generales
  const g = t.dg; const val = (k, i) => (g.v[k] || [])[i] ?? "";
  rows = [tit("Datos generales (dato del organismo al final del trimestre)", 5), Array(5).fill({ v: "", s: st({ nb: true }) }), [H("Gran Unidad Superior"), { v: g.gus || "" }, "", "", ""], [H("Plantel Militar"), { v: g.plantel || "" }, "", "", ""], [H("Nivel"), { v: g.nivel || "" }, "", "", ""], Array(5).fill({ v: "", s: st({ nb: true }) }), [H("Dato"), ...DG_HEAD.map(H)]];
  const m2 = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 4 } }, { s: { r: 2, c: 1 }, e: { r: 2, c: 4 } }, { s: { r: 3, c: 1 }, e: { r: 3, c: 4 } }, { s: { r: 4, c: 1 }, e: { r: 4, c: 4 } }];
  DG_ROWS.forEach(r => { const i = rows.length; const ce = v => ({ v, s: st({ h: "center" }) });
    if (r.cols === 4) rows.push([r.t, ...[0, 1, 2, 3].map(k => (r.gris || []).includes(k) ? { v: "", s: st({ fill: "DDDDDD" }) } : ce(val(r.k, k)))]);
    else if (r.cols === 1) { rows.push([r.t, ce(val(r.k, 0)), "", "", ""]); m2.push({ s: { r: i, c: 1 }, e: { r: i, c: 4 } }); }
    else if (r.cols === 2) { rows.push([r.t, ce(`${r.lbl[0]}: ${val(r.k, 0)}`), "", ce(`${r.lbl[1]}: ${val(r.k, 1)}`), ""]); m2.push({ s: { r: i, c: 1 }, e: { r: i, c: 2 } }, { s: { r: i, c: 3 }, e: { r: i, c: 4 } }); }
    else { rows.push([r.t, ce(`${r.lbl[0]}: ${val(r.k, 0)}`), ce(`${r.lbl[1]}: ${val(r.k, 1)}`), ce(`${r.lbl[2]}: ${val(r.k, 2)}`), ""]); m2.push({ s: { r: i, c: 3 }, e: { r: i, c: 4 } }); } });
  hoja(rows, [58, 14, 14, 14, 16], m2, "Datos generales");
  // Acciones
  rows = [tit(`Acciones realizadas para dar cumplimiento · ${t.nombre}`, 6), Array(6).fill({ v: "", s: st({ nb: true }) }), ["No.", "Indicador", "Fecha", "Acción", "Responsable", "Archivos adjuntos"].map(H)];
  const m3 = [{ s: { r: 0, c: 0 }, e: { r: 0, c: 5 } }];
  for (const ci of CAT) { const L = t.ind[ci.id].acciones; if (!L.length) continue; const i0 = rows.length;
    for (const a of L) { const names = []; for (const f of a.adj) { const x = await adjGet(f); if (x) names.push(x.name); } rows.push([{ v: noTxt(ci.id), s: st({ h: "center" }) }, ci.txt, { v: fFecha(a.fecha), s: st({ h: "center" }) }, a.desc, a.resp || "", names.join("\n")]); }
    if (L.length > 1) { m3.push({ s: { r: i0, c: 0 }, e: { r: rows.length - 1, c: 0 } }, { s: { r: i0, c: 1 }, e: { r: rows.length - 1, c: 1 } }); } }
  hoja(rows, [7, 50, 12, 50, 22, 36], m3, "Acciones");
  // Comparativo
  const L = S.trimestres; rows = [tit("Comparativo entre trimestres", L.length + 2), Array(L.length + 2).fill({ v: "", s: st({ nb: true }) }), [H("No."), H("Indicador"), ...L.map(x => H(x.nombre))]];
  CAT.forEach(ci => rows.push([{ v: noTxt(ci.id), s: st({ h: "center" }) }, ci.txt, ...L.map(x => ({ v: SEMC[x.ind[ci.id].sem], s: st({ h: "center", fill: FILL[x.ind[ci.id].sem] }) }))]));
  rows.push([{ v: "", s: st() }, { v: "% en verde", s: st({ b: true }) }, ...L.map(x => ({ v: conteo(x).pct + " %", s: st({ b: true, h: "center" }) }))]);
  hoja(rows, [7, 60, ...L.map(() => 18)], [{ s: { r: 0, c: 0 }, e: { r: 0, c: L.length + 1 } }], "Comparativo");
  const out = XLSX.write(wb, { bookType: "xlsx", type: "array" });
  bajar(new Blob([out], { type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet" }), `PROSECO_${t.nombre.replace(/[^\wÁÉÍÓÚáéíóúÑñ.-]+/g, "_")}_${sello()}.xlsx`); toast("Excel descargado");
}
function imprimir() {
  const t = T(); const c = conteo(t);
  $("#printArea").innerHTML = `<div class="hd">${esc(t.dg.plantel || "")}<br>${new Date().toLocaleDateString("es-MX", { day: "numeric", month: "long", year: "numeric" })}</div>
  <h1>Programa Interno de Seguimiento y Control (PROSECO)<br>Seguimiento de indicadores · ${esc(t.nombre)}${t.meses ? " · " + esc(t.meses) : ""}</h1>
  <p>Verde ${c.v} · Amarillo ${c.a} · Rojo ${c.r} · Sin definir ${c[""]} · ${c.pct} % cumplido</p>
  <table><tr><th>No.</th><th>Indicador</th><th>Área responsable</th><th>Semáforo</th><th>Resultado</th><th>Acciones realizadas</th></tr>
  ${CAT.map(ci => { const d = t.ind[ci.id]; return `<tr><td>${noTxt(ci.id)}</td><td>${esc(ci.txt)}</td><td>${esc(d.area)}</td><td>${SEMC[d.sem]}</td><td>${esc(d.resultado)}</td><td>${d.acciones.map(a => `${fFecha(a.fecha)}: ${esc(a.desc)}`).join("<br>")}</td></tr>`; }).join("")}</table>
  <div class="firmas"><div>Elaboró</div><div>Autorizó</div><div>Vo. Bo.</div></div>`;
  window.print();
}

/* ---------- Guía interactiva (recorrido) ---------- */
const PASOS = [
  { v: null, sel: ".rail .tabs", t: "Menú", p: "Aquí cambias de sección: Panorama, Indicadores, Datos generales, Trimestres, Guía y Respaldo." },
  { v: null, sel: "#net", t: "Con o sin internet", p: "Aquí ves si hay conexión. Sin internet la app sigue funcionando: verás «Sin conexión» y tus datos siguen guardados en este equipo." },
  { v: null, sel: () => $("#btnInstall").hidden ? '.tabs [data-v="ins"]' : "#btnInstall", t: "Instalar la app", p: "Instálala en tu celular, tableta o computadora para abrirla como cualquier app y usarla sin internet. Si no aparece el botón, sigue los pasos de la pestaña «Instalar y sin internet»." },
  { v: null, sel: ".trisel", t: "Trimestre activo", p: "PROSECO se evalúa cada trimestre. Elige aquí el trimestre que estás trabajando; todo lo que captures se guarda en ese trimestre." },
  { v: null, sel: "#btnNewTri", t: "Nuevo trimestre", p: "Crea un trimestre nuevo. Puedes copiar la estructura y el área responsable del anterior; las acciones y evidencias empiezan vacías." },
  { v: "pan", sel: "#kpis", t: "Panorama con semáforo", p: "Cuántos indicadores hacen falta (rojo), se están trabajando (amarillo) o ya se cumplieron (verde). Toca una tarjeta para ver esos indicadores." },
  { v: "ind", sel: "#semChips", t: "Indicadores", p: "La sección exclusiva de indicadores. Filtra por color con estos botones." },
  { v: "ind", sel: "#filtros", t: "Filtros", p: "Busca por número o palabra y filtra por área responsable, sección del formato, acciones o menor puntuación." },
  { v: "ind", sel: ".irow .sem", t: "Cambiar el color", p: "Toca rojo, amarillo o verde. Si tocas el mismo color otra vez, vuelve a «Sin definir»." },
  { v: "ind", sel: ".irow .tx", t: "Abrir el indicador", p: "Toca el texto para capturar el área responsable (en blanco por ahora), resultado, observaciones, notas y las acciones con archivos." },
  { v: "dg", sel: "#dgT", t: "Datos generales", p: "Los datos del organismo al final del trimestre, con la misma estructura del formato." },
  { v: "tri", sel: "#view", t: "Trimestres y comparativo", p: "Administra los trimestres y compara cómo cambió el semáforo de un trimestre a otro." },
  { v: "res", sel: "#bZip", t: "Respaldo completo", p: "Descarga un .zip con todo, incluidos los archivos. Hazlo al terminar cada sesión: los datos solo viven en este dispositivo." },
  { v: "ins", sel: "#insPlat", t: "Guía de instalación", p: "Pasos para Android, iPhone/iPad y computadora con Windows, y cómo comprobar que funciona sin internet. Tu equipo aparece resaltado." },
  { v: "gui", sel: ".guide details", t: "Qué es PROSECO y fuentes", p: "Aquí está la explicación del programa, el significado del semáforo y las fuentes consultadas." }];
let paso = 0;
function tour(i = 0) {
  paso = i; const P = PASOS[i]; const L = $("#tourLayer");
  if (!P) { L.hidden = true; S.guiaVista = true; save(); return; }
  if (P.v && !T() && ["pan", "ind", "dg"].includes(P.v)) return tour(i + 1);
  if (P.v && vista !== P.v) go(P.v);
  L.hidden = false;
  requestAnimationFrame(() => { const el = $(typeof P.sel === "function" ? P.sel() : P.sel); if (!el) return tour(i + 1); el.scrollIntoView({ block: "center" }); setTimeout(() => {
    const r = el.getBoundingClientRect(); const h = $("#tourHole"); const pad = 6; const hh = Math.min(r.height, innerHeight - 40);
    Object.assign(h.style, { left: r.left - pad + "px", top: r.top - pad + "px", width: r.width + 2 * pad + "px", height: hh + 2 * pad + "px" });
    const b = $("#tourBox"); b.innerHTML = `<h3>${P.t}</h3><p>${P.p}</p><div class="tb"><small>${i + 1} de ${PASOS.length}</small><span class="row"><button class="btn ghost sm" id="tSkip">Salir</button>${i ? `<button class="btn ghost sm" id="tPrev">Atrás</button>` : ""}<button class="btn sm" id="tNext">${i === PASOS.length - 1 ? "Terminar" : "Siguiente"}</button></span></div>`;
    const bw = 360, bh = b.offsetHeight || 170; let top = r.bottom + 14, left = Math.min(Math.max(12, r.left), innerWidth - bw - 12);
    if (top + bh > innerHeight - 10) top = Math.max(10, r.top - bh - 14); if (top < 10 || hh > innerHeight - 260) { top = innerHeight - bh - 20; left = innerWidth - bw - 20; }
    Object.assign(b.style, { top: top + "px", left: left + "px" });
    $("#tNext").onclick = () => tour(i + 1); $("#tSkip").onclick = () => tour(PASOS.length); const pv = $("#tPrev"); if (pv) pv.onclick = () => tour(i - 1);
  }, 120); });
}
addEventListener("keydown", e => { if ($("#tourLayer").hidden) return; if (e.key === "Escape") tour(PASOS.length); if (e.key === "ArrowRight") tour(paso + 1); if (e.key === "ArrowLeft" && paso) tour(paso - 1); });

/* ---------- Instalar y sin conexión ---------- */
let instEvt = null;
const esStandalone = () => matchMedia("(display-mode: standalone)").matches || matchMedia("(display-mode: window-controls-overlay)").matches || navigator.standalone === true;
function plataforma() { const u = navigator.userAgent; if (/iPhone|iPad|iPod/.test(u) || (/Macintosh/.test(u) && navigator.maxTouchPoints > 1)) return "ios"; if (/Android/.test(u)) return "android"; return "pc"; }
function btnInstall() { $("#btnInstall").hidden = esStandalone(); }
addEventListener("beforeinstallprompt", e => { e.preventDefault(); instEvt = e; btnInstall(); if (vista === "ins") render(); });
addEventListener("appinstalled", () => { instEvt = null; toast("App instalada. Ya puedes abrirla desde tu pantalla de inicio o menú."); btnInstall(); if (vista === "ins") render(); });
matchMedia("(display-mode: standalone)").addEventListener?.("change", () => { btnInstall(); render(); });
async function instalar() {
  if (instEvt) { instEvt.prompt(); const r = await instEvt.userChoice.catch(() => ({})); instEvt = null; if (r.outcome === "accepted") toast("Instalando…"); btnInstall(); return; }
  go("ins"); toast(plataforma() === "ios" ? "En iPhone/iPad: Compartir → «Agregar a inicio»" : "Usa el menú del navegador → «Instalar app»");
}
$("#btnInstall").onclick = instalar;
/* navigator.onLine no basta (p. ej. red local sin internet): se confirma pidiendo un archivo pequeño al servidor de la app, sin caché. */
let enLinea = navigator.onLine;
async function sondeo() {
  let on = navigator.onLine;
  if (on && location.protocol.startsWith("http")) { try { const c = new AbortController(); const tm = setTimeout(() => c.abort(), 5000); const r = await fetch("manifest.json?ping=" + Date.now(), { cache: "no-store", signal: c.signal }); clearTimeout(tm); on = r.ok; } catch (e) { on = false; } }
  if (on !== enLinea) { enLinea = on; toast(on ? "Conexión restablecida" : "Sin conexión: tus datos siguen guardados en este equipo"); }
  red();
}
setInterval(sondeo, 30000);
function red() { const on = enLinea; const n = $("#net"); n.classList.toggle("off", !on); n.querySelector("span").textContent = on ? "En línea" : "Sin conexión"; n.title = on ? "Con conexión a internet" : "Sin conexión: tus datos siguen guardados en este equipo"; $("#offbar").hidden = on; }
addEventListener("online", sondeo); addEventListener("offline", sondeo); addEventListener("focus", sondeo); document.addEventListener("visibilitychange", () => { if (!document.hidden) sondeo(); });
async function swEstado() { if (!("serviceWorker" in navigator)) return { ok: false, txt: "Este navegador no permite el modo sin internet." }; const r = await navigator.serviceWorker.getRegistration(); if (!r) return { ok: false, txt: "Preparando el modo sin internet… abre la app una vez con conexión." };
  const ks = await caches.keys().catch(() => []); const c = ks.find(k => k.startsWith("proseco-seguimiento-eme-")); return c ? { ok: true, txt: `Lista para usarse sin internet (caché ${c}).` } : { ok: false, txt: "Descargando archivos para usar sin internet…" }; }
function vIns(v) {
  const p = plataforma(); const inst = esStandalone();
  const yo = k => p === k ? " yo" : ""; const tg = k => p === k ? `<span class="tag acc">tu equipo</span>` : "";
  v.innerHTML = `<h1>Instalar la app y usarla sin internet</h1><p class="sub">Versión ${VER}. Instálala una vez y ábrela como cualquier otra app, incluso sin conexión.</p>
  <div class="card"><div class="row" style="justify-content:space-between"><div>
   <h2 style="margin:0 0 4px">${inst ? "✅ Ya estás usando la app instalada" : "Estado de este equipo"}</h2>
   <p class="hint" id="swSt">Revisando…</p><p class="hint">Conexión: <b>${enLinea ? "en línea" : "sin conexión"}</b></p></div>
   ${inst ? "" : `<button class="btn oro" id="bInsNow">⤓ Instalar app</button>`}</div>
   ${!inst && !instEvt ? `<p class="hint" style="margin-top:8px">Si el botón no abre la ventana de instalación, sigue los pasos de tu equipo aquí abajo.</p>` : ""}</div>
  <div class="grid g3" id="insPlat">
   <div class="plat${yo("android")}"><h2>📱 Android (Chrome)${tg("android")}</h2><ol class="steps">
    <li>Abre la app en <b>Chrome</b> con internet.</li><li>Toca <b>«⤓ Instalar app»</b> arriba, o el menú <span class="kbd">⋮</span> → <b>«Instalar app»</b> (en algunos equipos dice «Agregar a pantalla principal»).</li>
    <li>Confirma con <b>«Instalar»</b>.</li><li>Busca el ícono <b>PROSECO EME</b> en tu pantalla de inicio.</li></ol></div>
   <div class="plat${yo("ios")}"><h2>🍎 iPhone / iPad (Safari)${tg("ios")}</h2><ol class="steps">
    <li>Abre la app en <b>Safari</b> (en iPhone debe ser Safari).</li><li>Toca <b>Compartir</b> <span class="kbd">□↑</span> (abajo en iPhone, arriba en iPad).</li>
    <li>Desliza y toca <b>«Agregar a inicio»</b>.</li><li>Toca <b>«Agregar»</b>. El ícono aparece en tu pantalla de inicio.</li></ol></div>
   <div class="plat${yo("pc")}"><h2>💻 Computadora Windows (Chrome o Edge)${tg("pc")}</h2><ol class="steps">
    <li>Abre la app en <b>Chrome</b> o <b>Edge</b> con internet.</li><li>Haz clic en el ícono de instalar <span class="kbd">⊕</span> / <span class="kbd">🖥↓</span> al final de la barra de direcciones, o en <b>«⤓ Instalar app»</b>.</li>
    <li>En Edge también: menú <span class="kbd">…</span> → <b>Aplicaciones</b> → <b>«Instalar este sitio como una aplicación»</b>. En Chrome: menú <span class="kbd">⋮</span> → <b>«Transmitir, guardar y compartir»</b> → <b>«Instalar página como app»</b>.</li>
    <li>Queda en el menú Inicio y puedes anclarla a la barra de tareas.</li></ol></div>
  </div>
  <div class="grid g2" style="margin-top:16px">
   <div class="card"><h2>Comprobar que funciona sin internet</h2><ol class="steps">
    <li>Abre la app <b>una vez con internet</b> y espera a que aquí diga «Lista para usarse sin internet».</li><li>Cierra la app.</li>
    <li>Activa el <b>modo avión</b> o desconecta el internet (Wi-Fi o cable).</li><li>Abre la app instalada: arriba verás <b>«Sin conexión»</b> y la barra amarilla.</li>
    <li>Cambia un color del semáforo o agrega una acción: todo se guarda igual.</li></ol></div>
   <div class="card"><h2>Tus datos</h2><div class="warnbox">Los datos y los archivos adjuntos viven <b>solo en este equipo</b>. Instalar la app no los sube a internet ni los pasa a otros equipos. <b>Haz respaldos:</b> «Respaldo y exportar» → «Descargar respaldo completo» (.zip con archivos).</div>
    <p class="hint" style="margin-top:10px">Si desinstalas la app o borras los datos del navegador, se borra lo guardado. Para pasar todo a otro equipo, importa ahí el respaldo .zip.</p>
    <p class="hint">Actualizaciones: cuando se publique una versión nueva, se descarga sola la siguiente vez que abras la app con internet; tus datos se conservan.</p>
    <button class="btn sm" onclick="go('res')">Ir a Respaldo y exportar</button></div></div>`;
  const b = $("#bInsNow"); if (b) b.onclick = instalar;
  swEstado().then(e => { const el = $("#swSt"); if (el) el.innerHTML = (e.ok ? "✅ " : "⏳ ") + esc(e.txt); });
}

/* ---------- Inicio ---------- */
$("#verTag").textContent = "v" + VER; btnInstall(); red(); sondeo();
render(); storageInfo();
if (!S.guiaVista) setTimeout(() => tour(0), 500);
if ("serviceWorker" in navigator && location.protocol !== "file:") navigator.serviceWorker.register("sw.js").catch(() => { });
window.instalar = instalar; window.dlgTrimestre = dlgTrimestre; window.go = go; window.tour = tour; window.abrirInd = abrirInd;
