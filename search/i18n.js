/* =========================================================================
   The Miller Group: Spanish for the client side of the app.
   - I18N.lang is "en" or "es": from ?lang=es, the visitor's saved choice,
     or a Spanish browser. The header has an Español / English switch.
   - Newer modules (costs, transaction guide, homeowner portal, client
     updates) write both languages themselves. Everything else on the
     client side is translated here: exact phrases from DICT, and RULES for
     phrases with numbers, names, and dates. The agent workspace and the
     MLS's required IDX disclaimer stay in English, and so does each
     listing's description (it comes from the MLS as written).
   ========================================================================= */
(function () {
  const KEY = "tmg-lang";
  let saved = ""; try { saved = localStorage.getItem(KEY) || ""; } catch (e) {}
  const param = (new URLSearchParams(location.search).get("lang") || "").toLowerCase();
  const lang = ["es", "en"].includes(param) ? param : ["es", "en"].includes(saved) ? saved : /^es\b/i.test(navigator.language || "") ? "es" : "en";
  if (param) { try { localStorage.setItem(KEY, param); } catch (e) {} }
  const I = window.I18N = { lang, set(l) { try { localStorage.setItem(KEY, l); } catch (e) {} const u = new URL(location.href); u.searchParams.delete("lang"); location.replace(u.toString()); } };
  document.documentElement.lang = lang;

  const DICT = {
    "Saved on this device": "Guardado en este dispositivo", "Synced": "Sincronizado", "Shortlists synced": "Listas sincronizadas", "Connecting…": "Conectando…", "Link copied": "Enlace copiado",
    "That change didn’t save. Check your connection and try again.": "Ese cambio no se guardó. Revise su conexión e inténtelo de nuevo.",
    "Any price": "Cualquier precio", "Any beds": "Recámaras", "All types": "Todos los tipos", "House": "Casa", "Townhome": "Casa adosada", "Condo": "Condominio", "Land": "Terreno",
    "For sale + coming soon": "En venta + próximamente", "For sale": "En venta", "Coming soon": "Próximamente", "Coming Soon": "Próximamente", "Pending": "Pendiente", "Active": "Activa", "Off-market": "Fuera del mercado",
    "Newest": "Más recientes", "Price: low to high": "Precio: de menor a mayor", "Price: high to low": "Precio: de mayor a menor", "Largest": "Más grandes",
    "Neighborhood, city, or address": "Vecindario, ciudad o dirección", "Search homes": "Buscar casas", "Max price": "Precio máximo", "Minimum bedrooms": "Mínimo de recámaras", "Home type": "Tipo de casa", "Status": "Estado", "Sort": "Ordenar",
    "Search": "Buscar", "Map": "Mapa", "Shortlists": "Mis listas", "Agent": "Agente", "My portal": "Mi portal", "See your transaction timeline, your home’s value and equity after closing, updates from your agent, and your showing days. We’ll email you a sign-in link. No password needed.": "Vea el calendario de su transacción, el valor y la plusvalía de su casa después del cierre, las novedades de su agente y sus días de visitas. Le enviaremos un enlace por correo para iniciar sesión. No necesita contraseña.", "When your agent shares your transaction guide or sets up your homeowner portal, it shows up here. Your saved homes are under Shortlists.": "Cuando su agente comparta la guía de su transacción o prepare su portal de propietario, aparecerá aquí. Sus casas guardadas están en Mis listas.", "Agent tools": "Herramientas para agentes", "Sign in to your client portal": "Inicie sesión en su portal de cliente", "Email me a sign-in link": "Envíenme un enlace para iniciar sesión", "Nothing here yet": "Todavía no hay nada aquí", "Sections": "Secciones",
    "Sample listings for preview. Live MLS listings appear here once the IDX feed is connected.": "Anuncios de muestra. Los anuncios reales del MLS aparecerán aquí cuando se conecte el servicio IDX.",
    "Save this search": "Guardar esta búsqueda", "Manage": "Administrar", "Miller Group off-market listing": "Anuncio fuera del mercado de The Miller Group", "Draft": "Borrador",
    "No homes match": "Ninguna casa coincide", "Try a wider price range or fewer filters.": "Pruebe un rango de precios más amplio o menos filtros.",
    "Save to a shortlist": "Guardar en una lista", "Saved. Change shortlists": "Guardada. Cambiar de lista",
    "Downtown": "Centro", "Tap a price to preview the home.": "Toque un precio para ver la casa.", "Map of listings in central Denver": "Mapa de anuncios en el centro de Denver",
    "New shortlist": "Nueva lista", "Start a shortlist": "Empiece una lista", "‹ All shortlists": "‹ Todas las listas", "Delete": "Eliminar", "Love it": "Me encanta", "Maybe": "Tal vez", "Pass": "Descartar",
    "Remove from collection": "Quitar de la lista", "Your showing days": "Sus días de visitas", "Showing day": "Día de visitas", "Miller Picks": "Selección Miller", "‹ Miller Picks": "‹ Selección Miller",
    "Beds": "Recámaras", "Baths": "Baños", "Sq ft": "Pies²", "Name": "Nombre", "Email": "Correo electrónico", "Phone": "Teléfono", "Message": "Mensaje", "Request a showing": "Pedir una visita", "Save": "Guardar",
    "Close": "Cerrar", "Home details": "Detalles de la casa", "Messages": "Mensajes", "Edit": "Editar",
    "No collections yet. Name your first one below.": "Aún no tiene listas. Ponga nombre a la primera abajo.", "Create": "Crear", "New shortlist, e.g. Wash Park favorites": "Nueva lista, p. ej., Favoritas de Wash Park", "New shortlist name": "Nombre de la nueva lista", "Done": "Listo",
    "Messaging works once you’re signed in to this page. You can also call or text": "Los mensajes funcionan cuando inicia sesión en esta página. También puede llamar o enviar un mensaje de texto al",
    "Write a message": "Escriba un mensaje", "Send": "Enviar", "Remove home from message": "Quitar la casa del mensaje",
    "Sign in": "Iniciar sesión", "Sign out": "Cerrar sesión", "Email me a link": "Envíenme un enlace", "Check your email for a sign-in link.": "Revise su correo para el enlace de inicio de sesión.",
    "Save homes, message your agent, and pick up where you left off on any device. We’ll email you a sign-in link.": "Guarde casas, escriba a su agente y continúe donde se quedó en cualquier dispositivo. Le enviaremos un enlace para iniciar sesión.",
    "Share": "Compartir", "Share this app": "Compartir esta app", "Get pre-qualified": "Precalifíquese", "Open house": "Casa abierta"
  };
  const MON = { Jan: "ene", Feb: "feb", Mar: "mar", Apr: "abr", May: "may", Jun: "jun", Jul: "jul", Aug: "ago", Sep: "sept", Oct: "oct", Nov: "nov", Dec: "dic" };
  const WD = { Mon: "lun", Tue: "mar", Wed: "mié", Thu: "jue", Fri: "vie", Sat: "sáb", Sun: "dom" };
  const date = s => s.replace(/\b(Mon|Tue|Wed|Thu|Fri|Sat|Sun), (Jan|Feb|Mar|Apr|May|Jun|Jul|Aug|Sep|Oct|Nov|Dec) (\d{1,2})\b/g, (m, w, mo, d) => `${WD[w]}, ${d} ${MON[mo]}`).replace(/^Today\b/, "Hoy").replace(/^Tomorrow\b/, "Mañana");
  const TYPE = t => DICT[t] || t;
  const homes = n => `${n} ${n === "1" ? "casa" : "casas"}`;
  const RULES = [
    [/^Up to (\$[\d.]+[KM])$/, (m, a) => `Hasta ${a}`],
    [/^(\d)\+ beds$/, (m, n) => `${n}+ recámaras`],
    [/^(\d+) homes?$/, (m, n) => homes(n)],
    [/^(\d+) homes? · (.+)$/, (m, n, d) => `${homes(n)} · ${d}`],
    [/^(\d+) loves?$/, (m, n) => `${n} me encanta`], [/^(\d+) maybe$/, (m, n) => `${n} tal vez`], [/^(\d+) pass$/, (m, n) => `${n} ${n === "1" ? "descartada" : "descartadas"}`],
    [/^(\d+) bd · (\d+) ba · ([\d,]+) sq ft(?: · (.+))?$/, (m, b, ba, sf, t) => `${b} rec · ${ba} ${ba === "1" ? "baño" : "baños"} · ${sf} pies²${t ? " · " + TYPE(t) : ""}`],
    [/^Open house (.+)$/, (m, r) => `Casa abierta ${date(r)}`],
    [/^Listing courtesy of (.+)$/, (m, o) => `Anuncio cortesía de ${o}`],
    [/^Open (.+)$/, (m, a) => `Abrir ${a}`],
    [/^Illustration of (.+)$/, (m, t) => `Ilustración: ${TYPE(t)}`],
    [/^Note on (.+)$/, (m, a) => `Nota sobre ${a}`],
    [/^Add a note for (.+)$/, (m, n) => `Agregue una nota para ${n}`],
    [/^Group homes you like, react to each one, and leave notes\. (.+) sees the same board\.$/, (m, n) => `Agrupe las casas que le gustan, califique cada una y deje notas. ${n} ve la misma lista.`],
    [/^(.+) · (Active|Coming Soon|Pending|Off-market)$/, (m, a, st) => `${a} · ${DICT[st]}`],
    [/^(.+) · Built (\d{4})(.*)$/, (m, t, y, rest) => `${TYPE(t)} · Construida en ${y}${rest.replace(/ · ([\d.]+) acre lot/, " · terreno de $1 acres")}`],
    [/^I’d like to see (.+)\.$/, (m, a) => `Me gustaría ver ${a}.`],
    [/^Request sent\. (.+) will reach out shortly\.$/, (m, n) => `Solicitud enviada. ${n} se comunicará con usted pronto.`],
    [/^Request not sent from this preview\. Call or text (.+) to set up a showing\.$/, (m, p) => `La solicitud no se envió desde esta vista previa. Llame o envíe un mensaje al ${p} para programar una visita.`],
    [/^Date to be set · (\d+) homes$/, (m, n) => `Fecha por definir · ${homes(n)}`],
    [/^(.+) · (\d+) homes$/, (m, d, n) => `${date(d)} · ${homes(n)}`],
    [/^Saved to (.+)$/, (m, n) => `Guardada en ${n}`]
  ];
  function tr(s) {
    const k = s.replace(/\s+/g, " ").trim(); if (!k) return null;
    if (DICT[k]) return DICT[k];
    for (const [re, fn] of RULES) { const m = re.exec(k); if (m) { const out = fn(...m); if (out) return out; } }
    const d = date(k); return d !== k ? d : null;
  }
  I.tr = tr;
  const ZONES = "header, nav.tabs, #dataBanner, #v-search, #v-map, #v-collections, #v-portal, #dlgListing, #dlgSave, #dlgChat, #dlgAuth";
  const SKIP = ".remarks, .cost, .cg, .ho, .cn-pre, .chatlog, [data-i18n-skip], #disclaimer, script, style, textarea:not(#lMsg)";
  function inZone(el) { return el && el.closest && el.closest(ZONES) && !el.closest(SKIP) && !el.closest("#v-agent"); }
  function walk(root) {
    if (lang !== "es" || !root) return;
    const el = root.nodeType === 1 ? root : root.parentElement; if (!el) return;
    if (root.nodeType === 3) { if (inZone(el)) { const t = tr(root.nodeValue); if (t) root.nodeValue = root.nodeValue.replace(root.nodeValue.trim(), t); } return; }
    const tw = document.createTreeWalker(root, NodeFilter.SHOW_TEXT); let n; const list = [];
    while ((n = tw.nextNode())) list.push(n);
    list.forEach(n => { if (!inZone(n.parentElement)) return; const t = tr(n.nodeValue); if (t) n.nodeValue = n.nodeValue.replace(n.nodeValue.trim(), t); });
    [root, ...root.querySelectorAll("[placeholder],[aria-label],[title]")].forEach(e => { if (!e.getAttribute || !inZone(e)) return; ["placeholder", "aria-label", "title"].forEach(a => { const v = e.getAttribute(a); if (v) { const t = tr(v); if (t) e.setAttribute(a, t); } }); });
  }
  I.walk = walk;
  if (lang === "es") {
    const mo = new MutationObserver(ms => ms.forEach(m => m.addedNodes.forEach(walk)));
    const start = () => { walk(document.body); mo.observe(document.body, { childList: true, subtree: true }); };
    if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", start); else start();
  }
  // Header switch
  function button() {
    const host = document.querySelector(".brand"); if (!host || document.getElementById("langBtn")) return;
    const b = document.createElement("button"); b.type = "button"; b.id = "langBtn"; b.className = "btn ghost small"; b.setAttribute("data-i18n-skip", "");
    b.lang = lang === "es" ? "en" : "es"; b.textContent = lang === "es" ? "English" : "Español";
    b.setAttribute("aria-label", lang === "es" ? "Switch to English" : "Ver en español");
    b.addEventListener("click", () => I.set(lang === "es" ? "en" : "es"));
    host.appendChild(b);
  }
  if (document.readyState === "loading") document.addEventListener("DOMContentLoaded", button); else button();
})();
