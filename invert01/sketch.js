// ═══════════════════════════════════════════════════════
// THREADBARE — sketch.js
// A counter-product page. All visuals drawn in p5.js.
// ═══════════════════════════════════════════════════════

// ── STATE ──
let state = "home"; // "home" | "product"
let garments = [];
let activeGarment = 0;
let activeSlide = 0;
let fonts = {};
let loaded = false;

// Slide types per garment
const SLIDE_LABELS = ["FACTORY", "WORKERS", "FIBRE", "ROUTE", "PRODUCT PAGE"];

// ── PANEL BUTTON TRACKING ──
let _panelViewBtnX = 0;
let _panelViewBtnY = 0;
let _panelViewBtnW = 0;
const _panelViewBtnH = 46;

// ── ANIMATION STATE ──
let workerDotsPlaced = 0;
let workerAnimStart = 0;
let fibreAnimStart = 0;
let highlightedWorker = -1;
let slideEnterTime = 0;

// ── MEDIA CONTAINERS ──
// Videos and images loaded per garment
// Structure: garmentMedia[i] = { label, satellite, shipping, cosPage, cosModels[] }
let garmentMedia = [{}, {}, {}, {}];

// ── COLOURS ──
const BG = [255, 255, 255];
const FG = [15, 15, 15];
const FG_DIM = [90, 90, 90];
const ACCENT = [0, 0, 0];
const GRID_LINE = [210, 210, 210];

// ── TRANSITIONS ──
let transProgress = 0;
let transTarget = null; // { state, garment }
let transDir = 1; // 1 = opening, -1 = closing

// ═══════════════════════════════════════════════════════
// SETUP — async media loading
// ═══════════════════════════════════════════════════════
async function setup() {
  createCanvas(windowWidth, windowHeight);
  textFont("monospace");
  textAlign(LEFT, TOP);
  noStroke();

  // Load garment data
  const ids = ["COS01", "COS02", "COS03", "COS04"];
  for (let i = 0; i < ids.length; i++) {
    try {
      const data = await loadJSON(`data/${ids[i]}.json`);
      garments[i] = data;
    } catch (e) {
      console.warn(`Could not load data/${ids[i]}.json — using placeholder`);
      garments[i] = makePlaceholder(ids[i], i);
    }
  }

  // Load media for each garment
  for (let i = 0; i < garments.length; i++) {
    const g = garments[i];
    const m = g.media || {};
    garmentMedia[i] = {};

    // Label photo
    if (m.label) {
      try {
        garmentMedia[i].label = await loadImage(m.label);
      } catch (e) {
        console.warn(`Missing: ${m.label}`);
      }
    }

    // Satellite video
    if (m.satellite) {
      try {
        garmentMedia[i].satellite = createVideo(m.satellite);
        garmentMedia[i].satellite.hide();
        garmentMedia[i].satellite.volume(0);
      } catch (e) {
        console.warn(`Missing: ${m.satellite}`);
      }
    }

    // Shipping video
    if (m.shipping) {
      try {
        garmentMedia[i].shipping = createVideo(m.shipping);
        garmentMedia[i].shipping.hide();
        garmentMedia[i].shipping.volume(0);
      } catch (e) {
        console.warn(`Missing: ${m.shipping}`);
      }
    }

    // COS page screenshot
    if (m.cos_page) {
      try {
        garmentMedia[i].cosPage = await loadImage(m.cos_page);
      } catch (e) {
        console.warn(`Missing: ${m.cos_page}`);
      }
    }

    // COS model photos
    garmentMedia[i].cosModels = [];
    if (m.cos_models) {
      for (const path of m.cos_models) {
        try {
          const img = await loadImage(path);
          garmentMedia[i].cosModels.push(img);
        } catch (e) {
          console.warn(`Missing: ${path}`);
        }
      }
    }
  }

  loaded = true;
  console.log("THREADBARE loaded. Garments:", garments.length);
}

function makePlaceholder(id, idx) {
  const names = ["Beige Cardigan", "Grey T-Shirt", "Striped Shirt", "Blue Overshirt"];
  return {
    garment_id: id,
    short_desc: names[idx] || id,
    label_text: names[idx] || id,
    brand: "COS",
    price: "£--",
    country: "Made in --",
    composition: [{ component: "", fibre: "Unknown", percentage: 100, colour: [150, 150, 150] }],
    care: "--",
    factory: { name: "Data not loaded", address: "--", country: "--", workers: 0, lat: 0, lng: 0 },
    route: { from: "--", to: "--", via: "--" },
    media: {}
  };
}

// ═══════════════════════════════════════════════════════
// DRAW
// ═══════════════════════════════════════════════════════
function draw() {
  background(...BG);
  if (!loaded) {
    drawLoading();
    return;
  }

  if (state === "home") {
    drawHome();
  } else if (state === "product") {
    drawProduct();
  }
}

// ═══════════════════════════════════════════════════════
// HOME — 4 quadrant grid
// ═══════════════════════════════════════════════════════
function drawHome() {
  const w = width;
  const h = height;
  const cx = w / 2;
  const cy = h / 2;

  // Draw cross lines
  stroke(...GRID_LINE);
  strokeWeight(1);
  line(cx, 0, cx, h);
  line(0, cy, w, cy);
  noStroke();

  // Draw each quadrant
  for (let i = 0; i < 4; i++) {
    const col = i % 2;
    const row = floor(i / 2);
    const qx = col * cx;
    const qy = row * cy;
    const qw = cx;
    const qh = cy;

    drawQuadrant(i, qx, qy, qw, qh);
  }

}

function drawQuadrant(idx, x, y, w, h) {
  const g = garments[idx];
  if (!g) return;

  const mx = mouseX;
  const my = mouseY;
  const hover = mx > x && mx < x + w && my > y && my < y + h;

  // Hover highlight
  if (hover) {
    fill(0, 0, 0, 10);
    rect(x, y, w, h);
    cursor(HAND);
  }

  // Label image (if loaded)
  const media = garmentMedia[idx];
  if (media && media.label) {
    push();
    tint(255, 28); // very faint
    const imgAspect = media.label.width / media.label.height;
    const boxAspect = w / h;
    let iw, ih;
    if (imgAspect > boxAspect) {
      iw = w;
      ih = w / imgAspect;
    } else {
      ih = h;
      iw = h * imgAspect;
    }
    image(media.label, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
    pop();
  }

  // Text overlay
  const padding = constrain(w * 0.08, 20, 50);
  const tx = x + padding;
  const ty = y + h * 0.35;

  let lineGap = constrain(h * 0.055, 22, 35);

  // Garment name (large)
  fill(0);
  textSize(constrain(w * 0.06, 16, 32));
  textStyle(NORMAL);
  text(g.short_desc || g.label_text, tx, ty);

  // Below the name, evenly spaced
  let infoY = ty + constrain(w * 0.08, 28, 45);
  fill(120);
  textSize(constrain(w * 0.035, 11, 18));

  text(g.brand || "COS", tx, infoY);
  infoY += lineGap;

  const compStr = g.composition.map(c => c.percentage + "% " + c.fibre).join(", ");
  text(compStr, tx, infoY);
  infoY += lineGap;

  text(g.country, tx, infoY);
  infoY += lineGap;

  text(g.care, tx, infoY);

  // Garment index
  fill(...FG_DIM);
  textSize(constrain(w * 0.025, 9, 14));
  textAlign(RIGHT, BOTTOM);
  text(`${idx + 1} / 4`, x + w - padding, y + h - padding * 0.6);
  textAlign(LEFT, TOP);
}

// ═══════════════════════════════════════════════════════
// PRODUCT PAGE — carousel + side panel
// ═══════════════════════════════════════════════════════
function drawProduct() {
  const g = garments[activeGarment];
  if (!g) return;

  // Layout: 63% carousel | 37% panel
  const splitX = width * 0.78;

  // ── CAROUSEL (left) ──
  drawCarousel(g, 0, 0, splitX, height);

  // ── SIDE PANEL (right) ──
  drawPanel(g, splitX, 0, width - splitX, height);

  // ── Divider line ──
  stroke(...GRID_LINE);
  strokeWeight(1);
  line(splitX, 0, splitX, height);
  noStroke();
}

// ── CAROUSEL ──
function drawCarousel(g, x, y, w, h) {
  push();
  // Clip to carousel area
  drawingContext.save();
  drawingContext.beginPath();
  drawingContext.rect(x, y, w, h);
  drawingContext.clip();

  // Draw active slide
  switch (activeSlide) {
    case 0: drawSlideFactory(g, x, y, w, h); break;
    case 1: drawSlideWorkers(g, x, y, w, h); break;
    case 2: drawSlideFibre(g, x, y, w, h); break;
    case 3: drawSlideRoute(g, x, y, w, h); break;
    case 4: drawSlideCosPage(g, x, y, w, h); break;
  }

  drawingContext.restore();

  // Slide indicator dots at bottom
  const dotY = y + h - 30;
  const dotSpacing = 18;
  const dotsW = SLIDE_LABELS.length * dotSpacing;
  const dotStartX = x + (w - dotsW) / 2;

  for (let i = 0; i < SLIDE_LABELS.length; i++) {
    fill(i === activeSlide ? [...FG] : [...FG_DIM, 80]);
    circle(dotStartX + i * dotSpacing + dotSpacing / 2, dotY, i === activeSlide ? 7 : 5);
  }

  // Slide label
  fill(...FG_DIM);
  textSize(constrain(w * 0.016, 10, 14));
  textAlign(CENTER, TOP);
  text(SLIDE_LABELS[activeSlide], x + w / 2, dotY + 10);
  textAlign(LEFT, TOP);

  // Nav arrows
  const arrowY = y + h / 2;
  const arrowSize = constrain(w * 0.025, 14, 24);
  fill(...FG_DIM);

  if (activeSlide > 0) {
    // Left arrow
    textSize(arrowSize);
    textAlign(CENTER, CENTER);
    text("‹", x + 25, arrowY);
  }
  if (activeSlide < SLIDE_LABELS.length - 1) {
    // Right arrow
    textSize(arrowSize);
    textAlign(CENTER, CENTER);
    text("›", x + w - 25, arrowY);
  }
  textAlign(LEFT, TOP);

  pop();
}

// ── SLIDE 1: FACTORY ──
function drawSlideFactory(g, x, y, w, h) {
  const media = garmentMedia[activeGarment];

  // Try to show satellite video
  if (media && media.satellite) {
    const vid = media.satellite;
    if (vid.elt && vid.elt.readyState >= 2) {
      const vAspect = vid.width / vid.height;
      const bAspect = w / h;
      let vw, vh;
      if (vAspect > bAspect) {
        vw = w;
        vh = w / vAspect;
      } else {
        vh = h;
        vw = h * vAspect;
      }
      image(vid, x + (w - vw) / 2, y + (h - vh) / 2, vw, vh);
    } else {
      drawPlaceholderSlide(x, y, w, h, "SATELLITE ZOOM", "Drop satellite.mp4 into media/" + g.garment_id + "/");
    }
  } else {
    // Placeholder — draw a representation
    drawPlaceholderSlide(x, y, w, h, "SATELLITE ZOOM", "Drop satellite.mp4 into media/" + g.garment_id + "/");
  }

  // Caption overlay at bottom
  const factory = g.factory || {};
  const captionH = constrain(h * 0.15, 80, 130);
  const px = x + 30;
  const py = y + h - captionH - 70;

  textSize(constrain(w * 0.022, 12, 20));
  fill(0, 0, 0, 120);
  text(factory.name || "Factory name", px + 1, py + 1, w - 60);
  fill(255);
  text(factory.name || "Factory name", px, py, w - 60);

  textSize(constrain(w * 0.016, 10, 15));
  fill(0, 0, 0, 120);
  text(factory.address || "Address", px + 1, py + 29, w - 60);
  fill(255);
  text(factory.address || "Address", px, py + 28, w - 60);

  const coordStr = `${factory.lat ? factory.lat.toFixed(4) : "--"}°N, ${factory.lng ? factory.lng.toFixed(4) : "--"}°E`;
  fill(0, 0, 0, 120);
  text(coordStr, px + 1, py + 51);
  fill(255);
  text(coordStr, px, py + 50);
}

// ── SLIDE 2: WORKERS (split view — grid left, counter right) ──
// Adapted from Palantir Infrastructure Audit divided view
let workerCurrentVal = 0;
let workerTargetVal = 0;
let workerTriggered = false;

function drawSlideWorkers(g, x, y, w, h) {
  const factory = g.factory || {};
  const totalWorkers = factory.workers || 0;

  if (totalWorkers === 0) {
    drawPlaceholderSlide(x, y, w, h, "WORKERS", "No worker count in data");
    return;
  }

  // Trigger animation after 2-second delay
  if (!workerTriggered && millis() - slideEnterTime > 2000) {
    workerTargetVal = totalWorkers;
    workerTriggered = true;
  }

  // Slow weighted lerp
  workerCurrentVal = lerp(workerCurrentVal, workerTargetVal, 0.015);
  if (abs(workerCurrentVal - workerTargetVal) < 0.5) workerCurrentVal = workerTargetVal;
  let roundedVal = round(workerCurrentVal);

  const BLUE = [0, 0, 255];

  // ── Title ──
  // (removed — added in post-production)

  // ── LEFT SIDE: Grid of blocks ──
  let sideMargin = w * 0.08;
  let gridW = w * 0.5;
  let gridH = h * 0.65;
  let gridStartX = x + w * 0.06;
  let gridStartY = y + (h - gridH) / 2;

  // Derive cols/rows so all totalWorkers blocks fit exactly
  let cols = max(1, ceil(sqrt(totalWorkers * gridW / gridH)));
  let rows = ceil(totalWorkers / cols);
  let spacingX = gridW / cols;
  let spacingY = gridH / rows;
  let cellSize = min(spacingX, spacingY) * 0.82;

  fill(...BLUE);
  noStroke();

  for (let i = 0; i < roundedVal; i++) {
    let bx = gridStartX + (i % cols) * spacingX;
    let by = gridStartY + floor(i / cols) * spacingY;
    rect(bx, by, cellSize, cellSize);
  }

  // ── RIGHT SIDE: Large counter ──
  push();
  fill(...BLUE);
  textSize(constrain(w * 0.15, 60, 140));
  textAlign(RIGHT, CENTER);
  textFont("monospace");
  text(roundedVal.toString(), x + w - sideMargin, y + h * 0.5);

  if (workerCurrentVal > workerTargetVal * 0.95) {
    let workerLabelAlpha = constrain((workerCurrentVal - workerTargetVal * 0.95) / (workerTargetVal * 0.05) * 255, 0, 255);
    fill(100, 100, 100, workerLabelAlpha);
    textSize(constrain(w * 0.025, 14, 22));
    textAlign(RIGHT, TOP);
    text("workers", x + w - sideMargin, y + h * 0.5 + constrain(w * 0.08, 35, 75));
  }
  pop();

  textAlign(LEFT, TOP);
}

// ── SLIDE 3: FIBRE COMPOSITION CIRCLE ──
function drawSlideFibre(g, x, y, w, h) {
  const comp = g.composition || [];
  if (comp.length === 0) {
    drawPlaceholderSlide(x, y, w, h, "FIBRE", "No composition data");
    return;
  }
  const greyscalePalette = [
    [30, 30, 30],
    [100, 100, 100],
    [170, 170, 170],
    [210, 210, 210]
  ];
  const sortedComp = [...comp].sort((a, b) => b.percentage - a.percentage);

  const cx = x + w * 0.45;
  const cy = y + h * 0.42;
  const r = min(w, h) * 0.28;

  const elapsed = (millis() - slideEnterTime) / 1000;
  const animDuration = 2.5; // seconds for full circle
  const progress = constrain(elapsed / animDuration, 0, 1);
  const totalAngle = progress * TWO_PI;

  let currentAngle = -HALF_PI; // start at 12 o'clock

  noFill();
  strokeCap(ROUND);

  for (let i = 0; i < sortedComp.length; i++) {
    const c = sortedComp[i];
    const segmentAngle = (c.percentage / 100) * TWO_PI;
    const drawAngle = min(segmentAngle, max(0, totalAngle - (currentAngle + HALF_PI)));

    if (drawAngle > 0) {
      const col = greyscalePalette[min(i, greyscalePalette.length - 1)];
      stroke(...col);
      strokeWeight(constrain(r * 0.12, 4, 16));
      arc(cx, cy, r * 2, r * 2, currentAngle, currentAngle + drawAngle);

      // Label once segment is drawn
      if (drawAngle >= segmentAngle * 0.5) {
        const labelAngle = currentAngle + drawAngle / 2;
        const labelRadius = r + constrain(r * 0.35, 45, 80);
        const lx = cx + cos(labelAngle) * labelRadius;
        const ly = cy + sin(labelAngle) * (r + 35);
        noStroke();
        fill(...col);
        textSize(constrain(w * 0.022, 11, 18));
        textAlign(CENTER, CENTER);
        text(`${c.percentage}%`, lx, ly - 9);
        text(c.fibre, lx, ly + 9);
        noFill();
      }
    }

    currentAngle += segmentAngle;
  }

  noStroke();

  fill(...FG_DIM);
  textSize(constrain(w * 0.018, 10, 15));
  textAlign(CENTER, CENTER);
  text("composition", cx, cy);

  textAlign(LEFT, TOP);
}

// ── SLIDE 4: SHIPPING ROUTE ──
function drawSlideRoute(g, x, y, w, h) {
  const media = garmentMedia[activeGarment];

  if (media && media.shipping) {
    const vid = media.shipping;
    if (vid.elt && vid.elt.readyState >= 2) {
      const vAspect = vid.width / vid.height;
      const bAspect = w / h;
      let vw, vh;
      if (vAspect > bAspect) {
        vw = w;
        vh = w / vAspect;
      } else {
        vh = h;
        vw = h * vAspect;
      }
      image(vid, x + (w - vw) / 2, y + (h - vh) / 2, vw, vh);
    } else {
      drawRoutePlaceholder(g, x, y, w, h);
    }
  } else {
    drawRoutePlaceholder(g, x, y, w, h);
  }

}

function drawRoutePlaceholder(g, x, y, w, h) {
  // Simple animated line from left to right representing the route
  const elapsed = (millis() - slideEnterTime) / 1000;
  const progress = constrain(elapsed / 4, 0, 1);

  const routeY = y + h * 0.45;
  const startX = x + w * 0.1;
  const endX = x + w * 0.9;
  const routeW = endX - startX;

  // Route line
  stroke(...FG_DIM, 40);
  strokeWeight(1);
  line(startX, routeY, endX, routeY);

  // Animated progress
  stroke(...ACCENT);
  strokeWeight(2);
  line(startX, routeY, startX + routeW * progress, routeY);
  noStroke();

  // Moving dot
  fill(...ACCENT);
  circle(startX + routeW * progress, routeY, 8);

  // Node labels
  fill(...FG_DIM);
  textSize(constrain(w * 0.014, 9, 13));
  textAlign(CENTER, TOP);
  text(g.route.from || "Export", startX, routeY + 15);
  text(g.route.to || "Import", endX, routeY + 15);

  // Title
  fill(...FG);
  textSize(constrain(w * 0.03, 16, 28));
  textAlign(CENTER, CENTER);
  text("ESTIMATED SHIPPING ROUTE", x + w / 2, y + h * 0.2);

  fill(...FG_DIM);
  textSize(constrain(w * 0.014, 9, 13));
  text("Drop shipping.mp4 into media/ for vessel tracking footage", x + w / 2, y + h * 0.7);
  textAlign(LEFT, TOP);
}

// ── SLIDE 5: COS PRODUCT PAGE ──
function drawSlideCosPage(g, x, y, w, h) {
  const media = garmentMedia[activeGarment];

  if (media && media.cosPage) {
    const img = media.cosPage;
    const iAspect = img.width / img.height;
    const bAspect = w / h;
    let iw, ih;
    if (iAspect > bAspect) { ih = h; iw = h * iAspect; }
    else { iw = w; ih = w / iAspect; }
    image(img, x + (w - iw) / 2, y + (h - ih) / 2, iw, ih);
  } else {
    drawPlaceholderSlide(x, y, w, h, "COS PRODUCT PAGE",
      "This is what you normally see first.\nScreenshot the real COS page and save as cos_page.png");
  }

  /*
  fill(255, 255, 255, 220);
  rect(x, y, w, 45);
  fill(...FG_DIM);
  textSize(constrain(w * 0.016, 10, 14));
  textAlign(CENTER, CENTER);
  text("Finally here's a photo of the garment", x + w / 2, y + 22);
  textAlign(LEFT, TOP);
  */
}

// ── SIDE PANEL ──
function drawPanel(g, x, y, w, h) {
  // Background
  fill(...BG);
  rect(x, y, w, h);

  const pad = constrain(w * 0.1, 15, 40);
  let ty = y + pad;

  // Back arrow
  fill(...FG_DIM);
  textSize(constrain(w * 0.04, 12, 18));
  text("← Back", x + pad, ty);
  ty += 50;

  // Brand
  fill(...FG_DIM);
  textSize(constrain(w * 0.035, 10, 14));
  text(g.brand || "COS", x + pad, ty);
  ty += 25;

  // Product name
  fill(...FG);
  textSize(constrain(w * 0.065, 16, 28));
  textStyle(NORMAL);
  text(g.label_text || g.short_desc, x + pad, ty, w - pad * 2);
  ty += constrain(w * 0.065, 16, 28) * 2.2;

  // Price
  fill(...FG);
  textSize(constrain(w * 0.055, 14, 24));
  text(g.price || "", x + pad, ty);
  ty += 45;

  // Divider
  stroke(...GRID_LINE);
  strokeWeight(1);
  line(x + pad, ty, x + w - pad, ty);
  noStroke();
  ty += 20;

  // Legal minimum label
  fill(...FG_DIM);
  textSize(constrain(w * 0.028, 9, 12));
  text("The legal minimum info required on a label.", x + pad, ty);
  ty += 22;

  fill(0);
  textSize(constrain(w * 0.04, 11, 16));

  text("Brand", x + pad, ty);
  ty += 26;

  text("Composition", x + pad, ty);
  ty += 26;

  text("Last country of processing", x + pad, ty);
  ty += 26;

  text("Care instructions", x + pad, ty);
  ty += 26;

  // Divider
  stroke(...GRID_LINE);
  line(x + pad, ty, x + w - pad, ty);
  noStroke();
  ty += 20;

  // "View garment" button (styled like Add to bag)
  const btnW = w - pad * 2;
  const btnH = 46;
  const btnX = x + pad;
  const btnY = ty;

  _panelViewBtnX = btnX;
  _panelViewBtnY = btnY;
  _panelViewBtnW = btnW;

  const overBtn = mouseX > btnX && mouseX < btnX + btnW && mouseY > btnY && mouseY < btnY + btnH;
  fill(overBtn ? 245 : 250, overBtn ? 245 : 250, overBtn ? 245 : 250);
  stroke(...GRID_LINE);
  strokeWeight(1);
  rect(btnX, btnY, btnW, btnH, 2);
  noStroke();

  fill(...FG);
  textSize(constrain(w * 0.035, 10, 14));
  textAlign(CENTER, CENTER);
  text("VIEW GARMENT ↓", btnX + btnW / 2, btnY + btnH / 2);
  textAlign(LEFT, TOP);
  ty += btnH + 30;

  // Garment navigation at bottom
  const navY = y + h - 70;
  fill(...FG_DIM);
  textSize(constrain(w * 0.03, 9, 13));
  textAlign(CENTER, CENTER);
  text(`${activeGarment + 1} / ${garments.length}`, x + w / 2, navY);

  // Prev / Next garment
  if (activeGarment > 0) {
    text("← prev", x + w * 0.2, navY);
  }
  if (activeGarment < garments.length - 1) {
    text("next →", x + w * 0.8, navY);
  }
  textAlign(LEFT, TOP);
}

// ── PLACEHOLDER SLIDE ──
function drawPlaceholderSlide(x, y, w, h, title, subtitle) {
  fill(...FG, 8);
  rect(x + w * 0.05, y + h * 0.05, w * 0.9, h * 0.9);

  fill(...FG);
  textSize(constrain(w * 0.04, 18, 36));
  textAlign(CENTER, CENTER);
  text(title, x + w / 2, y + h * 0.4);

  fill(...FG_DIM);
  textSize(constrain(w * 0.018, 10, 15));
  text(subtitle || "", x + w / 2, y + h * 0.52, w * 0.7);
  textAlign(LEFT, TOP);
}

// ── LOADING SCREEN ──
function drawLoading() {
  fill(...FG);
  textSize(16);
  textAlign(CENTER, CENTER);
  text("THREADBARE", width / 2, height / 2 - 20);
  fill(...FG_DIM);
  textSize(12);
  text("loading...", width / 2, height / 2 + 10);
  textAlign(LEFT, TOP);
}

// ═══════════════════════════════════════════════════════
// INTERACTION
// ═══════════════════════════════════════════════════════
function mousePressed() {
  if (!loaded) return;

  if (state === "home") {
    // Check which quadrant was clicked
    const cx = width / 2;
    const cy = height / 2;
    for (let i = 0; i < 4; i++) {
      const col = i % 2;
      const row = floor(i / 2);
      const qx = col * cx;
      const qy = row * cy;
      if (mouseX > qx && mouseX < qx + cx && mouseY > qy && mouseY < qy + cy) {
        enterProduct(i);
        return;
      }
    }
  }

  if (state === "product") {
    const splitX = width * 0.78;

    // Carousel navigation — left/right areas
    if (mouseX < splitX) {
      const carouselW = splitX;
      if (mouseX < 60 && activeSlide > 0) {
        changeSlide(activeSlide - 1);
        return;
      }
      if (mouseX > carouselW - 60 && activeSlide < SLIDE_LABELS.length - 1) {
        changeSlide(activeSlide + 1);
        return;
      }
    }

    // Panel interactions
    if (mouseX > splitX) {
      const panelW = width - splitX;
      const pad = constrain(panelW * 0.1, 15, 40);

      // Back button (top area of panel)
      if (mouseY < 80) {
        state = "home";
        stopAllMedia();
        return;
      }

      // View garment button
      if (
        mouseX > _panelViewBtnX && mouseX < _panelViewBtnX + _panelViewBtnW &&
        mouseY > _panelViewBtnY && mouseY < _panelViewBtnY + _panelViewBtnH
      ) {
        changeSlide(SLIDE_LABELS.length - 1);
        return;
      }

      // Garment nav (bottom of panel)
      const navY = height - 70;
      if (mouseY > navY - 20 && mouseY < navY + 20) {
        if (mouseX < splitX + (width - splitX) * 0.5 && activeGarment > 0) {
          enterProduct(activeGarment - 1);
          return;
        }
        if (mouseX > splitX + (width - splitX) * 0.5 && activeGarment < garments.length - 1) {
          enterProduct(activeGarment + 1);
          return;
        }
      }
    }
  }
}

function keyPressed() {
  if (!loaded) return;

  if (state === "product") {
    if (keyCode === LEFT_ARROW && activeSlide > 0) {
      changeSlide(activeSlide - 1);
      return false;
    }
    if (keyCode === RIGHT_ARROW && activeSlide < SLIDE_LABELS.length - 1) {
      changeSlide(activeSlide + 1);
      return false;
    }
    if (keyCode === ESCAPE) {
      state = "home";
      stopAllMedia();
    }
    // Number keys 1-4 to jump to garment
    if (key >= '1' && key <= '4') {
      enterProduct(int(key) - 1);
    }
  }

  if (state === "home") {
    if (key >= '1' && key <= '4') {
      enterProduct(int(key) - 1);
    }
  }
}

// ═══════════════════════════════════════════════════════
// HELPERS
// ═══════════════════════════════════════════════════════
function enterProduct(idx) {
  stopAllMedia();
  activeGarment = constrain(idx, 0, garments.length - 1);
  activeSlide = 0;
  highlightedWorker = -1;
  workerCurrentVal = 0;
  workerTargetVal = 0;
  workerTriggered = false;
  slideEnterTime = millis();
  state = "product";

  // Start satellite video if on slide 0
  playCurrentSlideMedia();
}

function changeSlide(newSlide) {
  stopCurrentSlideMedia();
  activeSlide = newSlide;
  slideEnterTime = millis();
  highlightedWorker = -1;
  workerCurrentVal = 0;
  workerTargetVal = 0;
  workerTriggered = false;
  playCurrentSlideMedia();
}

function playCurrentSlideMedia() {
  const media = garmentMedia[activeGarment];
  if (!media) return;

  if (activeSlide === 0 && media.satellite) {
    media.satellite.time(0);
    media.satellite.play();
  }
  if (activeSlide === 3 && media.shipping) {
    media.shipping.time(0);
    media.shipping.play();
  }
}

function stopCurrentSlideMedia() {
  const media = garmentMedia[activeGarment];
  if (!media) return;

  if (media.satellite) media.satellite.pause();
  if (media.shipping) media.shipping.pause();
}

function stopAllMedia() {
  for (const m of garmentMedia) {
    if (m.satellite) m.satellite.pause();
    if (m.shipping) m.shipping.pause();
  }
}

function windowResized() {
  resizeCanvas(windowWidth, windowHeight);
}
