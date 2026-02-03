// Bezier Stripe Sampler (mobile-friendly)
// Preview: max 1200 px longer side
// Export HQ: original image resolution (1x), no UI

let imgFull = null;   // original resolution
let imgPrev = null;   // preview (scaled down)
let previewScaleX = 1;
let previewScaleY = 1;

let showUI = true;
let pts = [];
let dragging = -1;

let xAtY = [];
let validAtY = [];

let cnv;

const PREVIEW_MAX = 1200; // longer side max

// DOM
let elFile, btnToggleUI, btnExportHQ, btnReset, elInfo, elStatus;

function setup() {
  // start with a small placeholder canvas
  cnv = createCanvas(10, 10);
  cnv.parent("sketch-holder");
  noLoop();

  // DOM refs
  elFile = document.getElementById("fileInput");
  btnToggleUI = document.getElementById("toggleUI");
  btnExportHQ = document.getElementById("exportHQ");
  btnReset = document.getElementById("resetCurve");
  elInfo = document.getElementById("infoText");
  elStatus = document.getElementById("statusText");

  console.log("[init] dom refs", {
    fileInput: !!elFile,
    toggleUI: !!btnToggleUI,
    exportHQ: !!btnExportHQ,
    resetCurve: !!btnReset,
    infoText: !!elInfo,
    statusText: !!elStatus,
    p5Loaded: typeof loadImage === "function",
  });

  elFile.addEventListener("change", onFilePicked);

  btnToggleUI.addEventListener("click", () => {
    showUI = !showUI;
    btnToggleUI.textContent = showUI ? "Skrýt UI" : "Zobrazit UI";
    redraw();
  });

  btnReset.addEventListener("click", () => {
    if (!imgPrev) return;
    resetCurveDefault();
    updateCurveMap();
    redraw();
  });

  btnExportHQ.addEventListener("click", async () => {
    if (!imgFull || !imgPrev) return;
    await exportHQ();
  });

  setStatus("");
  setInfo("Nahraj fotku a začni 🙂");
}

function draw() {
  background(0);

  if (!imgPrev) {
    // nothing loaded yet
    return;
  }

  // draw preview image
  image(imgPrev, 0, 0);

  // generate stripes based on curve map
  imgPrev.loadPixels();

  for (let y = 0; y < height; y++) {
    if (!validAtY[y]) continue;

    const x = xAtY[y];
    const c = imgPrev.get(constrain(x, 0, width - 1), y);

    noStroke();
    fill(c);
    rect(0, y, width, 1);

    // sampling marker only if UI visible
    if (showUI) {
      stroke(255);
      strokeWeight(3);
      point(x, y);
    }
  }

  if (showUI) drawBezierUI();
}

// ---------- File loading / preview scaling ----------

function onFilePicked(e) {
  console.log("[file] change event", e);
  const file = e.target.files && e.target.files[0];
  if (!file) return;
  console.log("[file] picked", {
    name: file.name,
    type: file.type,
    size: file.size,
  });

  setStatus("Načítám fotku…");
  setInfo("");

  const reader = new FileReader();
  reader.onload = () => {
    console.log("[file] FileReader.onload", {
      resultType: typeof reader.result,
      resultSize: reader.result ? String(reader.result).length : 0,
    });
    if (!reader.result) {
      setStatus("Chyba: prazdny vysledek FileReaderu.");
      return;
    }
    loadImage(reader.result, (loaded) => {
      console.log("[file] loadImage success", loaded && loaded.width, loaded && loaded.height);
      imgFull = loaded;

      // build preview
      const { w, h } = calcPreviewSize(imgFull.width, imgFull.height, PREVIEW_MAX);
      imgPrev = imgFull.get();      // copy
      imgPrev.resize(w, h);

      previewScaleX = imgFull.width / imgPrev.width;
      previewScaleY = imgFull.height / imgPrev.height;

      resizeCanvas(imgPrev.width, imgPrev.height, true); // ne-redraw při resize

      resetCurveDefault();
      updateCurveMap();

      // enable buttons
      btnToggleUI.disabled = false;
      btnExportHQ.disabled = false;
      btnReset.disabled = false;

      btnToggleUI.textContent = "Skrýt UI";
      showUI = true;

      setStatus("Hotovo ✅");
      setInfo(`Preview: ${imgPrev.width}×${imgPrev.height} | Export: ${imgFull.width}×${imgFull.height}`);

      redraw();
      setTimeout(() => setStatus(""), 1200);
    }, (err) => {
      console.error("[file] loadImage fail", err);
      setStatus("Nepodařilo se načíst obrázek.");
    });
  };
  reader.onerror = (err) => {
    console.error("[file] FileReader.onerror", err);
    setStatus("Chyba pĹ™i ÄŤtenĂ­ souboru.");
  };
  reader.onabort = () => {
    console.warn("[file] FileReader.onabort");
    setStatus("ÄŚtenĂ­ souboru bylo pĹ™eruĹˇeno.");
  };
  reader.readAsDataURL(file);
}

function calcPreviewSize(w, h, maxLongSide) {
  const longSide = Math.max(w, h);
  if (longSide <= maxLongSide) return { w, h };
  const s = maxLongSide / longSide;
  return { w: Math.round(w * s), h: Math.round(h * s) };
}

// ---------- Bezier curve (single cubic) ----------

function resetCurveDefault() {
  // 4 points: P0, P1, P2, P3
  pts = [
    createVector(width * 0.15, height * 0.25),
    createVector(width * 0.75, height * 0.15),
    createVector(width * 0.25, height * 0.85),
    createVector(width * 0.85, height * 0.75),
  ];
}

if (showUI && pts && pts.length >= 4) drawBezierUI();

function drawBezierUI() {
  if (!pts || pts.length < 4) return;
  // control polygon
  stroke(255, 90);
  strokeWeight(1);
  noFill();
  beginShape();
  for (const p of pts) vertex(p.x, p.y);
  endShape();

  // bezier curve
  stroke(255);
  strokeWeight(2);
  noFill();
  bezier(
    pts[0].x, pts[0].y,
    pts[1].x, pts[1].y,
    pts[2].x, pts[2].y,
    pts[3].x, pts[3].y
  );

  // draggable points (bigger for touch)
  for (let i = 0; i < pts.length; i++) {
    const p = pts[i];
    noStroke();
    fill(i === dragging ? 255 : 255, 220);
    circle(p.x, p.y, 28);
  }
}

// Map curve points -> x for each y (approx by sampling)
function updateCurveMap() {
  xAtY = new Array(height).fill(0);
  validAtY = new Array(height).fill(false);
  const bestDist = new Array(height).fill(Infinity);

  const samples = 3500;

  for (let i = 0; i <= samples; i++) {
    const t = i / samples;

    const x = bezierPoint(pts[0].x, pts[1].x, pts[2].x, pts[3].x, t);
    const y = bezierPoint(pts[0].y, pts[1].y, pts[2].y, pts[3].y, t);

    const yy = Math.floor(y);
    if (yy < 0 || yy >= height) continue;

    const d = Math.abs(y - yy);
    if (d < bestDist[yy]) {
      bestDist[yy] = d;
      xAtY[yy] = Math.floor(x);
      validAtY[yy] = true;
    }
  }

  // fill small gaps
  for (let y = 1; y < height - 1; y++) {
    if (!validAtY[y] && validAtY[y - 1] && validAtY[y + 1]) {
      xAtY[y] = Math.floor((xAtY[y - 1] + xAtY[y + 1]) * 0.5);
      validAtY[y] = true;
    }
  }
}

// ---------- Touch/mouse interaction ----------

function pickPoint(mx, my) {
  // bigger hit radius for finger
  const r = 22;
  for (let i = 0; i < pts.length; i++) {
    if (dist(mx, my, pts[i].x, pts[i].y) <= r) return i;
  }
  return -1;
}

function mousePressed() {
  if (!imgPrev) return;
  dragging = pickPoint(mouseX, mouseY);
}

function mouseDragged() {
  if (!imgPrev) return;
  if (dragging !== -1) {
    pts[dragging].x = constrain(mouseX, 0, width);
    pts[dragging].y = constrain(mouseY, 0, height);
    updateCurveMap();
    redraw();
  }
}

function mouseReleased() {
  dragging = -1;
}

function touchStarted(e) {
  if (e?.target !== cnv?.elt) return true; // tap mimo canvas => nech prohlížeč dělat click
  mousePressed();
  e.preventDefault();
  return false;
}

function touchMoved(e) {
  if (e?.target !== cnv?.elt) return true;
  mouseDragged();
  e.preventDefault();
  return false;
}

function touchEnded(e) {
  if (e?.target !== cnv?.elt) return true;
  mouseReleased();
  e.preventDefault();
  return false;
}

// ---------- HQ export ----------

async function exportHQ() {
  try {
    setStatus("Exportuju HQ…");
    disableControls(true);

    // Build HQ control points (scale from preview coords)
    const ptsHQ = pts.map(p => createVector(p.x * previewScaleX, p.y * previewScaleY));

    // Offscreen render
    const pg = createGraphics(imgFull.width, imgFull.height);
    pg.noSmooth(); // optional: crisp
    pg.image(imgFull, 0, 0);

    // Build curve map for HQ
    const h = imgFull.height;
    const w = imgFull.width;

    const xAtY_HQ = new Array(h).fill(0);
    const validAtY_HQ = new Array(h).fill(false);
    const bestDist = new Array(h).fill(Infinity);

    const samples = 6000;

    for (let i = 0; i <= samples; i++) {
      const t = i / samples;
      const x = bezierPoint(ptsHQ[0].x, ptsHQ[1].x, ptsHQ[2].x, ptsHQ[3].x, t);
      const y = bezierPoint(ptsHQ[0].y, ptsHQ[1].y, ptsHQ[2].y, ptsHQ[3].y, t);

      const yy = Math.floor(y);
      if (yy < 0 || yy >= h) continue;

      const d = Math.abs(y - yy);
      if (d < bestDist[yy]) {
        bestDist[yy] = d;
        xAtY_HQ[yy] = Math.floor(x);
        validAtY_HQ[yy] = true;
      }
    }

    // small gap fill
    for (let y = 1; y < h - 1; y++) {
      if (!validAtY_HQ[y] && validAtY_HQ[y - 1] && validAtY_HQ[y + 1]) {
        xAtY_HQ[y] = Math.floor((xAtY_HQ[y - 1] + xAtY_HQ[y + 1]) * 0.5);
        validAtY_HQ[y] = true;
      }
    }

    imgFull.loadPixels();

    // Draw stripes into pg
    for (let y = 0; y < h; y++) {
      if (!validAtY_HQ[y]) continue;

      const x = constrain(xAtY_HQ[y], 0, w - 1);
      const c = imgFull.get(x, y);

      pg.noStroke();
      pg.fill(c);
      pg.rect(0, y, w, 1);
    }

    // Download as PNG (works well on Android)
    await downloadCanvasAsPng(pg.canvas, makeFileName());

    setStatus("Hotovo ✅ (soubor stažen)");
    setTimeout(() => setStatus(""), 1600);
  } catch (err) {
    console.error(err);
    setStatus("Export selhal. Zkus menší fotku nebo to znovu.");
  } finally {
    disableControls(false);
  }
}

function makeFileName() {
  const ts = new Date();
  const pad = (n) => String(n).padStart(2, "0");
  const name = `bezier_stripes_${ts.getFullYear()}-${pad(ts.getMonth()+1)}-${pad(ts.getDate())}_${pad(ts.getHours())}-${pad(ts.getMinutes())}-${pad(ts.getSeconds())}.png`;
  return name;
}

function downloadCanvasAsPng(canvasEl, filename) {
  return new Promise((resolve, reject) => {
    if (!canvasEl.toBlob) {
      reject(new Error("toBlob not supported"));
      return;
    }
    canvasEl.toBlob((blob) => {
      if (!blob) {
        reject(new Error("Blob is null"));
        return;
      }
      const url = URL.createObjectURL(blob);
      const a = document.createElement("a");
      a.href = url;
      a.download = filename;
      document.body.appendChild(a);
      a.click();
      a.remove();
      setTimeout(() => URL.revokeObjectURL(url), 2000);
      resolve();
    }, "image/png");
  });
}

// ---------- UI helpers ----------

function setInfo(text) {
  elInfo.textContent = text;
}

function setStatus(text) {
  elStatus.textContent = text;
}

function disableControls(disabled) {
  // file input necháme aktivní
  btnToggleUI.disabled = disabled || !imgPrev;
  btnExportHQ.disabled = disabled || !imgPrev;
  btnReset.disabled = disabled || !imgPrev;
}
