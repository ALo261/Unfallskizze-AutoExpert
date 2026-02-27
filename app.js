let selectedElement = null;
const svg = document.getElementById("canvas");

// ---------- Undo/Redo State ----------
const history = [];
let historyIndex = -1;
let suppressHistory = false;

function elToData(el) {
  const tag = el.tagName.toLowerCase();
  const attrs = {};
  for (const a of el.attributes) attrs[a.name] = a.value;

  return {
    tag,
    attrs,
    text: tag === "text" ? el.textContent : null
  };
}

function snapshot() {
  const items = [];

  for (const child of svg.children) {
    const tag = child.tagName.toLowerCase();

    // defs und grid nie in die history
    if (tag === "defs") continue;
    if (tag === "rect" && child.getAttribute("fill") === "url(#grid)") continue;

    // WICHTIG: komplettes Element inkl. Kinder speichern
    items.push(child.outerHTML);
  }

  return items;
}

function fixUseHrefs(root) {
  const XLINK_NS = "http://www.w3.org/1999/xlink";
  const uses = root.querySelectorAll ? root.querySelectorAll("use") : [];

  for (const u of uses) {
    const href = u.getAttribute("href");
    const xhref = u.getAttributeNS(XLINK_NS, "href");

    // Falls nur href da ist -> xlink:href setzen
    if (href && !xhref) {
      u.setAttributeNS(XLINK_NS, "xlink:href", href);
    }

    // Falls nur xlink:href da ist -> href setzen
    if (!href && xhref) {
      u.setAttribute("href", xhref);
    }
  }
}

function restore(items) {
  suppressHistory = true;

  // alles löschen außer <defs> und Grid-Rect
  for (const child of [...svg.children]) {
    const tag = child.tagName.toLowerCase();
    const isDefs = tag === "defs";
    const isGridRect = tag === "rect" && child.getAttribute("fill") === "url(#grid)";
    if (isDefs || isGridRect) continue;
    child.remove();
  }

  clearSelection();

  // Strings -> echte SVG-Elemente rekonstruieren
  const parser = new DOMParser();

  for (const html of items) {
    // Fragment in SVG einbetten, damit es korrekt geparst wird
    const doc = parser.parseFromString(
      `<svg xmlns="http://www.w3.org/2000/svg" xmlns:xlink="http://www.w3.org/1999/xlink">${html}</svg>`,
      "image/svg+xml"
    );

    const el = doc.documentElement.firstElementChild;
    if (!el) continue;

    // in das echte SVG übernehmen
    const imported = document.importNode(el, true);

    fixUseHrefs(imported);
    wireElement(imported);
    svg.appendChild(imported);
  }

  suppressHistory = false;
}

function pushHistory() {
  if (suppressHistory) return;

  const snap = snapshot();

  // wenn wir nach undo neue Aktion machen: "Zukunft" abschneiden
  history.splice(historyIndex + 1);
  history.push(snap);
  historyIndex = history.length - 1;
}

function undo() {
  if (historyIndex <= 0) return;
  historyIndex--;
  restore(history[historyIndex]);
}

function redo() {
  if (historyIndex >= history.length - 1) return;
  historyIndex++;
  restore(history[historyIndex]);
}

// Shortcuts
document.addEventListener("keydown", (e) => {
  const z = e.key.toLowerCase() === "z";
  const y = e.key.toLowerCase() === "y";
  const ctrl = e.ctrlKey || e.metaKey;

  if (!ctrl) return;

  if (z && !e.shiftKey) { e.preventDefault(); undo(); }
  else if (y || (z && e.shiftKey)) { e.preventDefault(); redo(); }
});

function makeDraggable(el) {
  let start = null;
  let offsetX = 0, offsetY = 0;
  let moved = false;

  el.addEventListener("pointerdown", (e) => {
    moved = false;

    // pointer capture -> sauberes Ziehen
    el.setPointerCapture(e.pointerId);

    const t = el.getAttribute("transform") || "";
    const match = t.match(/translate\(([^,]+),([^)]+)\)/);
    offsetX = match ? parseFloat(match[1]) : 0;
    offsetY = match ? parseFloat(match[2]) : 0;

    start = getSvgPoint(e);

    function move(evt) {
      moved = true;
      const p = getSvgPoint(evt);

      const dx = p.x - start.x;
      const dy = p.y - start.y;

      const grid = 3;
      const newX = Math.round((offsetX + dx) / grid) * grid;
      const newY = Math.round((offsetY + dy) / grid) * grid;

      const cur = el.getAttribute("transform") || "";
      const scaleMatch = cur.match(/scale\([^)]+\)/);
      const scale = scaleMatch ? scaleMatch[0] : "";

      const rotateMatch = cur.match(/rotate\([^)]+\)/);
      const rotate = rotateMatch ? rotateMatch[0] : "";

      el.setAttribute("transform", `translate(${newX},${newY}) ${scale} ${rotate}`);
    }

    function up() {
      svg.removeEventListener("pointermove", move);
      svg.removeEventListener("pointerup", up);
      svg.removeEventListener("pointercancel", up);

      if (moved) pushHistory();
    }

    svg.addEventListener("pointermove", move);
    svg.addEventListener("pointerup", up);
    svg.addEventListener("pointercancel", up);
  });
}

function getSvgPoint(evt) {
  const pt = svg.createSVGPoint();
  pt.x = evt.clientX;
  pt.y = evt.clientY;
  return pt.matrixTransform(svg.getScreenCTM().inverse());
}

function deleteSelected() {
    if (!selectedElement) return;

    selectedElement.remove();
    selectedElement = null;

    pushHistory();
}

function addCar() {

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");

    const x = 100;
    const y = 100;
    const scale = 0.2;   // Größe des Autos

    g.setAttribute("transform", `translate(${x},${y}) scale(${scale})`);
    g.setAttribute("fill", "#1f77b4");  // Auto-Farbe

    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", "#icon-car-top");
    use.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", "#icon-car-top");

    g.appendChild(use);

    wireElement(g);
    svg.appendChild(g);
    pushHistory();
}

function addRoad() {

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");

    const width = 400;
    const height = 120;

    g.setAttribute("transform", "translate(100,200)");

    // Straße
    const road = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    road.setAttribute("x", 0);
    road.setAttribute("y", 0);
    road.setAttribute("width", width);
    road.setAttribute("height", height);
    road.setAttribute("fill", "#555");

    // Mittellinie exakt gleiche Breite
    const line = document.createElementNS("http://www.w3.org/2000/svg", "line");
    line.setAttribute("x1", 0);
    line.setAttribute("y1", height / 2);
    line.setAttribute("x2", width);
    line.setAttribute("y2", height / 2);
    line.setAttribute("stroke", "#fff");
    line.setAttribute("stroke-width", 4);
    line.setAttribute("stroke-dasharray", "20 14");

    g.appendChild(road);
    g.appendChild(line);

    wireElement(g);
    svg.appendChild(g);
    pushHistory();
}

function addArrow() {
    const arrow = document.createElementNS("http://www.w3.org/2000/svg", "polygon");
    arrow.setAttribute("points", "0,0 40,15 0,30 10,15");
    arrow.setAttribute("fill", "red");
    arrow.setAttribute("transform", "translate(150,150)");

    wireElement(arrow);
    svg.appendChild(arrow);
    pushHistory();
}

function selectElement(el) {

    // alte Auswahl zurücksetzen
    if (selectedElement) {
        selectedElement.removeAttribute("stroke");
        selectedElement.removeAttribute("stroke-width");
    }

    selectedElement = el;

    el.setAttribute("stroke", "orange");
    el.setAttribute("stroke-width", "2");
}

// NEU: Auswahl löschen
function clearSelection() {
    if (selectedElement) {
        selectedElement.removeAttribute("stroke");
        selectedElement.removeAttribute("stroke-width");
    }
    selectedElement = null;
}

function rotateSelected(deltaDeg = 15) {
  if (!selectedElement) return;

  const bbox = selectedElement.getBBox();
  const cx = bbox.x + bbox.width / 2;
  const cy = bbox.y + bbox.height / 2;

  const transform = selectedElement.getAttribute("transform") || "";

  let angle = 0;
  const rotMatch = transform.match(/rotate\(([-\d.]+)/);
  if (rotMatch) angle = parseFloat(rotMatch[1]);

  angle += deltaDeg;

  const translateMatch = transform.match(/translate\([^)]+\)/);
  const translate = translateMatch ? translateMatch[0] : "";

  const scaleMatch = transform.match(/scale\([^)]+\)/);
  const scale = scaleMatch ? scaleMatch[0] : "";

  selectedElement.setAttribute(
    "transform",
    `${translate} ${scale} rotate(${angle}, ${cx}, ${cy})`
  );

  pushHistory();
}

function addText() {
    const textValue = prompt("Text eingeben:");
    if (!textValue) return;

    const txt = document.createElementNS("http://www.w3.org/2000/svg", "text");
    txt.textContent = textValue;
    txt.setAttribute("font-size", "18");
    txt.setAttribute("fill", "black");
    txt.setAttribute("transform", "translate(200,150)");
    txt.style.cursor = "move";

    wireElement(txt);
    svg.appendChild(txt);
    pushHistory();
}

function exportPNG() {
  // Tab sofort öffnen (Popup-Blocker)
  const previewWin = window.open("", "_blank");
  if (!previewWin) {
    alert("Popup blockiert. Bitte Popups für diese Seite erlauben.");
    return;
  }
  previewWin.document.write("<p>Erstelle PNG…</p>");

  try {
    // --- 1) Export-Größe aus viewBox holen ---
    const vb = svg.viewBox && svg.viewBox.baseVal ? svg.viewBox.baseVal : null;

    // Fallback, falls viewBox fehlt
    const exportW = vb && vb.width ? Math.round(vb.width) : (svg.clientWidth || 900);
    const exportH = vb && vb.height ? Math.round(vb.height) : (svg.clientHeight || 600);

    // --- 2) SVG serialisieren und width/height in den String injizieren ---
    const serializer = new XMLSerializer();
    let svgData = serializer.serializeToString(svg);

    // Namespace absichern
    if (!svgData.includes('xmlns="http://www.w3.org/2000/svg"')) {
      svgData = svgData.replace("<svg", '<svg xmlns="http://www.w3.org/2000/svg"');
    }
    if (!svgData.includes('xmlns:xlink="http://www.w3.org/1999/xlink"')) {
      svgData = svgData.replace("<svg", '<svg xmlns:xlink="http://www.w3.org/1999/xlink"');
    }

    // width/height setzen/ersetzen
    svgData = svgData.replace(/<svg([^>]*?)>/, (m, attrs) => {
      // vorhandenes width/height entfernen, dann sauber setzen
      attrs = attrs
        .replace(/\swidth="[^"]*"/, "")
        .replace(/\sheight="[^"]*"/, "");
      return `<svg${attrs} width="${exportW}" height="${exportH}">`;
    });

    // --- 3) SVG -> Blob URL ---
    const svgBlob = new Blob([svgData], { type: "image/svg+xml;charset=utf-8" });
    const svgUrl = URL.createObjectURL(svgBlob);

    // --- 4) Canvas exakt auf Exportgröße ---
    const canvas = document.createElement("canvas");
    canvas.width = exportW;
    canvas.height = exportH;
    const ctx = canvas.getContext("2d");

    const img = new Image();

    img.onload = () => {
      // Weißer Hintergrund
      ctx.fillStyle = "white";
      ctx.fillRect(0, 0, canvas.width, canvas.height);

      // WICHTIG: Bild auf volle Canvas-Größe zeichnen
      ctx.drawImage(img, 0, 0, canvas.width, canvas.height);

      URL.revokeObjectURL(svgUrl);

      // PNG erzeugen (Mobile sicher)
      canvas.toBlob((blob) => {
        if (!blob) {
          previewWin.location.href = canvas.toDataURL("image/png");
          return;
        }
        const pngUrl = URL.createObjectURL(blob);
        previewWin.location.href = pngUrl;

        setTimeout(() => URL.revokeObjectURL(pngUrl), 60_000);
      }, "image/png");
    };

    img.onerror = () => {
      URL.revokeObjectURL(svgUrl);
      previewWin.document.body.innerHTML = "<p>Export fehlgeschlagen (SVG konnte nicht gerendert werden).</p>";
    };

    img.src = svgUrl;

  } catch (err) {
    previewWin.document.body.innerHTML = "<p>Export-Fehler: " + String(err) + "</p>";
  }
}

function addTruck() {
    createVehicle("icon-truck-top", 0.3, "#043f05");
}

function addMotorcycle() {
    createVehicle("icon-motorcycle-top", 0.2, "#cc0000");
}

function addBicycle() {
    createVehicle("icon-bicycle-top", 0.15, "#0a0a0a");
}

function addCurve() {
  createVehicle("icon-curve", 0.58, "#555");
}

function addIntersection() {
  createVehicle("icon-intersection", 0.96, "#555");
}

function addPedestrian() {
  createVehicle("icon-pedestrian", 0.15, "#111"); // dunkel
}

function addTrafficLight() {
  createVehicle("icon-traffic-light", 0.2, "#333"); // Gehäuse/Mast
}

function addStop() {
  createVehicle("icon-stop", 0.15, "#333"); // Mastfarbe egal, Schild ist fix rot/weiß
}

function addYield() {
  createVehicle("icon-yield", 0.15, "#333");
}

function addPriority() {
  createVehicle("icon-priority", 0.15, "#333");
}

function addTree() {
  createVehicle("icon-tree", 0.25, "#333"); // Baum hat fixe Farben, scale passt
}

function createVehicle(symbolId, scale = 0.6, color = "#1f77b4") {

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");

    g.setAttribute("transform", `translate(150,150) scale(${scale})`);
    g.setAttribute("fill", color);
    g.setAttribute("stroke", color);

    const use = document.createElementNS("http://www.w3.org/2000/svg", "use");
    use.setAttribute("href", `#${symbolId}`);
    use.setAttributeNS("http://www.w3.org/1999/xlink", "xlink:href", `#${symbolId}`);

    g.appendChild(use);

    wireElement(g);
    svg.appendChild(g);
    pushHistory();
}

function wireElement(el) {
  // Klick = auswählen (NEU: stopPropagation, damit SVG-Hintergrund nicht abwählt)
  el.addEventListener("pointerdown", (e) => {
  e.stopPropagation();
  selectElement(el);
  });

  // Drag aktivieren
  makeDraggable(el);

  // Text editieren
  if (el.tagName.toLowerCase() === "text") {
    el.addEventListener("dblclick", () => {
      const newText = prompt("Text ändern:", el.textContent);
      if (newText !== null) {
        el.textContent = newText;
        pushHistory();
      }
    });
  }
}

// NEU: Klick ins Leere / aufs Raster -> Auswahl weg
svg.addEventListener("pointerdown", (e) => {
  const tag = e.target.tagName ? e.target.tagName.toLowerCase() : "";
  const isGridRect = tag === "rect" && e.target.getAttribute("fill") === "url(#grid)";
  if (e.target === svg || isGridRect) {
    clearSelection();
  }
});

document.addEventListener("keydown", e => {
    if (!selectedElement) return;

    if (e.key === "Delete") {
        selectedElement.remove();
        selectedElement = null;
        pushHistory();
    }
});

pushHistory();

function closeAllMenus(exceptId = null) {
  const menus = document.querySelectorAll(".dropdown-menu");
  menus.forEach(m => {
    if (exceptId && m.id === exceptId) return;
    m.style.display = "none";
  });
}

function toggleMenu(menuId) {
  const menu = document.getElementById(menuId);
  if (!menu) return;

  const isOpen = menu.style.display === "block";
  closeAllMenus(menuId);
  menu.style.display = isOpen ? "none" : "block";
}

function addCrosswalkRoad() {

    const g = document.createElementNS("http://www.w3.org/2000/svg", "g");

    const width = 400;
    const height = 120;

    g.setAttribute("transform", "translate(100,200)");

    // Asphalt
    const road = document.createElementNS("http://www.w3.org/2000/svg", "rect");
    road.setAttribute("x", 0);
    road.setAttribute("y", 0);
    road.setAttribute("width", width);
    road.setAttribute("height", height);
    road.setAttribute("fill", "#555");

    // Mittellinie links (unterbrochen beim Zebrastreifen)
    const lineLeft = document.createElementNS("http://www.w3.org/2000/svg", "line");
    lineLeft.setAttribute("x1", 0);
    lineLeft.setAttribute("y1", height / 2);
    lineLeft.setAttribute("x2", 160);
    lineLeft.setAttribute("y2", height / 2);
    lineLeft.setAttribute("stroke", "#fff");
    lineLeft.setAttribute("stroke-width", 4);
    lineLeft.setAttribute("stroke-dasharray", "20 14");

    // Mittellinie rechts
    const lineRight = document.createElementNS("http://www.w3.org/2000/svg", "line");
    lineRight.setAttribute("x1", 240);
    lineRight.setAttribute("y1", height / 2);
    lineRight.setAttribute("x2", width);
    lineRight.setAttribute("y2", height / 2);
    lineRight.setAttribute("stroke", "#fff");
    lineRight.setAttribute("stroke-width", 4);
    lineRight.setAttribute("stroke-dasharray", "20 14");

    // 1) Asphalt zuerst (unten)
    g.appendChild(road);

    // 2) Zebrastreifen (darüber)
    for (let y = 15; y <= 90; y += 15) {
        const stripe = document.createElementNS("http://www.w3.org/2000/svg", "rect");
        stripe.setAttribute("x", 165);
        stripe.setAttribute("y", y);
        stripe.setAttribute("width", 70);
        stripe.setAttribute("height", 8);
        stripe.setAttribute("fill", "#fff");
        g.appendChild(stripe);
    }

    // 3) Mittellinien zuletzt (oben)
    g.appendChild(lineLeft);
    g.appendChild(lineRight);

    wireElement(g);
    svg.appendChild(g);
    pushHistory();
}

function addRoundabout() {
  // 300x300, bei Bedarf kleiner machen: 0.8 / 0.7
  createVehicle("icon-roundabout", 0.8, "#555");
}

function addParking() {
  // 320x220
  createVehicle("icon-parking-8", 0.92, "#555");
}

function syncInfoHeight() {
  const info = document.getElementById("info");
  const canvas = document.getElementById("canvas");
  if (!info || !canvas) return;

  const h = canvas.getBoundingClientRect().height;
  info.style.height = `${Math.round(h)}px`;
}

// beim Laden + bei Resize
window.addEventListener("load", syncInfoHeight);
window.addEventListener("resize", syncInfoHeight);

// falls du dynamisch Layout änderst / Menüs umklappen etc.
setTimeout(syncInfoHeight, 0);