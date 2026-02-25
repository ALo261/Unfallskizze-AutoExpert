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
  // alle Elemente außer dem Grid-Background speichern
  const items = [];
  for (const child of svg.children) {
    const tag = child.tagName.toLowerCase();
    if (tag === "defs") continue; // defs nie speichern
    // Grid-Rect erkennen: rect mit fill="url(#grid)"
    if (tag === "rect" && child.getAttribute("fill") === "url(#grid)") continue;
    items.push(elToData(child));
  }
  return items;
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

  // neu aufbauen + Listener binden
  for (const it of items) {
    const el = document.createElementNS("http://www.w3.org/2000/svg", it.tag);

    for (const [k, v] of Object.entries(it.attrs)) el.setAttribute(k, v);
    if (it.tag === "text" && it.text !== null) el.textContent = it.text;

    wireElement(el);
    svg.appendChild(el);
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

      const grid = 40;
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

function rotateSelected() {

    if (!selectedElement) return;

    const bbox = selectedElement.getBBox();

    const cx = bbox.x + bbox.width / 2;
    const cy = bbox.y + bbox.height / 2;

    let angle = 0;

    const transform = selectedElement.getAttribute("transform") || "";

    // Aktuelle Rotation lesen
    if (transform.includes("rotate")) {
        const match = transform.match(/rotate\(([^,]+)/);
        if (match) angle = parseFloat(match[1]);
    }

    angle += 15;

    // Translation behalten
    const translateMatch = transform.match(/translate\([^)]+\)/);
    const translate = translateMatch ? translateMatch[0] : "";

    // Scale behalten (WICHTIG für Auto-Icon)
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

    const serializer = new XMLSerializer();
    const svgData = serializer.serializeToString(svg);

    const canvas = document.createElement("canvas");
    canvas.width = svg.clientWidth;
    canvas.height = svg.clientHeight;

    const ctx = canvas.getContext("2d");

    const img = new Image();
    img.onload = function () {
        ctx.fillStyle = "white";
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        ctx.drawImage(img, 0, 0);

        const link = document.createElement("a");
        link.download = "unfallskizze.png";
        link.href = canvas.toDataURL("image/png");
        link.click();
    };

    img.src = "data:image/svg+xml;base64," + btoa(unescape(encodeURIComponent(svgData)));
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
    createVehicle("icon-curve", 0.55,"#555");
}

function addIntersection() {
    createVehicle("icon-intersection", 0.75,"#555");
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
  el.addEventListener("mousedown", (e) => {
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
svg.addEventListener("mousedown", (e) => {
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