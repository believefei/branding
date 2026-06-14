const canvas = document.getElementById("poster");
const ctx = canvas.getContext("2d");

const rawCsv = `hour,T,H,P,W,M
0,17.8,82,1023,6,24
1,18.8,77,1022,8,26
2,19.7,72,1022,10,28
3,20.7,68,1022,11,30
4,20.7,69,1022,10,29
5,20.6,69,1021,10,27
6,20.5,70,1021,9,25
7,19.9,75,1022,7,23
8,19.4,80,1022,5,22
9,18.8,84,1022,4,21
10,18.9,81,1022,6,20
11,19.0,80,1022,7,19
12,19.0,78,1022,8,20
13,18.9,77,1022,7,21
14,18.9,76,1021,6,22
15,18.9,76,1021,6,23
16,18.7,79,1021,6,24
17,18.4,83,1021,6,25
18,18.0,87,1021,5,26
19,17.4,91,1022,4,27
20,17.6,89,1022,4,28
21,17.5,88,1022,3,28
22,17.5,86,1022,3,27
23,17.5,86,1022,3,26`;

const rows = parseCsv(rawCsv);
const stats = summarize(rows);
const groups = chunkRows(rows, 6);

const palette = buildPalette(stats);

const poster = {
  size: 720,
  body: {
    x: 308,
    y: 86,
    radius: 118,
  },
  motion: {
    speed: 0.85 + normalizeValue(stats.avgW, stats.minW, stats.maxW) * 0.45,
    pulse: 0.04,
  },
  timeline: {
    secondsPerDay: 18,
  },
};

const limbAnchors = [
  { x: 214, y: 166, side: -1.56, bias: -0.46, depth: 0.22, scale: 0.84 },
  { x: 252, y: 182, side: -1.08, bias: -0.26, depth: 0.4, scale: 0.94 },
  { x: 292, y: 194, side: -0.52, bias: -0.08, depth: 0.66, scale: 1.04 },
  { x: 334, y: 198, side: 0.02, bias: 0.04, depth: 0.9, scale: 1.12 },
  { x: 380, y: 194, side: 0.62, bias: 0.18, depth: 0.72, scale: 1.08 },
  { x: 430, y: 176, side: 1.42, bias: 0.4, depth: 0.36, scale: 0.92 },
];

const limbData = groups.map((group, index) => deriveLimb(group, index));
const staticPaper = buildPaperTexture();

function animate(now) {
  const time = now * 0.001;
  const dataState = getDataState(time);
  const model = buildModel(time, dataState);
  drawScene(model, time, dataState);
  requestAnimationFrame(animate);
}

function buildModel(time, dataState) {
  return {
    limbs: limbData.map((limb, index) => buildLimbModel(limb, time, index, dataState)),
  };
}

function deriveLimb(group, index) {
  const avgT = average(group, "T");
  const avgH = average(group, "H");
  const avgP = average(group, "P");
  const avgW = average(group, "W");
  const avgM = average(group, "M");

  const tNorm = normalizeValue(avgT, stats.minT, stats.maxT);
  const hNorm = normalizeValue(avgH, stats.minH, stats.maxH);
  const pNorm = normalizeValue(avgP, stats.minP, stats.maxP);
  const wNorm = normalizeValue(avgW, stats.minW, stats.maxW);
  const mNorm = normalizeValue(avgM, stats.minM, stats.maxM);
  const anchor = limbAnchors[index];

  const direction = anchor.side;
  const length = lerp(340, 560, mNorm) * anchor.scale;
  const spread = lerp(34, 132, pNorm) * anchor.scale;

  return {
    group,
    anchor,
    phase: index * 0.8,
    sway: lerp(0.12, 0.34, wNorm) * lerp(0.9, 1.14, anchor.scale),
    maxRadius: lerp(22, 36, tNorm) * lerp(0.88, 1.12, anchor.depth),
    minRadius: lerp(6, 11, hNorm) * lerp(0.9, 1.05, anchor.scale),
    lineCount: group.length + 6,
    hook: lerp(24, 58, mNorm) * anchor.scale,
    direction,
    c1: {
      x: anchor.x + direction * lerp(16, 38, wNorm) + anchor.bias * 42,
      y: anchor.y + lerp(86, 138, tNorm),
    },
    c2: {
      x: anchor.x + direction * spread + anchor.bias * 92,
      y: anchor.y + length * lerp(0.42, 0.7, anchor.depth),
    },
    end: {
      x: anchor.x + direction * (spread + lerp(22, 78, pNorm)) + anchor.bias * 128,
      y: anchor.y + length * lerp(0.94, 1.14, anchor.depth),
    },
    toneShift: (index - 2.5) * 0.045,
    depth: anchor.depth,
  };
}

function buildLimbModel(limb, time, index, dataState) {
  const spine = sampleLimbSpine(limb, time, index, dataState);
  return {
    depth: limb.depth,
    spine,
    bodyCircles: buildBodyCircles(limb, spine, time, dataState),
  };
}

function sampleLimbSpine(limb, time, index, dataState) {
  const points = [];
  const windNorm = normalizeValue(dataState.W, stats.minW, stats.maxW);
  const pressureNorm = normalizeValue(dataState.P, stats.minP, stats.maxP);
  const moistureNorm = normalizeValue(dataState.M, stats.minM, stats.maxM);
  const tempNorm = normalizeValue(dataState.T, stats.minT, stats.maxT);
  const growSide = limb.direction * lerp(22, 92, pressureNorm) * lerp(0.82, 1.18, limb.depth);
  const crownLift = lerp(10, 34, moistureNorm);
  const curlStrength = lerp(26, 84, moistureNorm * 0.6 + windNorm * 0.4);
  const curlPhase = limb.phase + index * 0.45;

  for (let i = 0; i < limb.lineCount; i += 1) {
    const t = i / (limb.lineCount - 1);
    const sway =
      Math.sin(time * poster.motion.speed + limb.phase + t * 4.8 + index * 0.25) *
      (limb.sway + windNorm * 0.08) *
      easeInOut(Math.max(0, (t - 0.08) / 0.92));
    const reach = easeInOut(t);
    const organicBend =
      Math.sin(t * Math.PI * (1.2 + pressureNorm * 0.8) + limb.phase) *
      growSide *
      reach;
    const livingDrift =
      Math.sin(time * 0.55 + index * 0.9 + t * 5.2) *
      lerp(4, 18, tempNorm) *
      reach;
    const curlStart = clamp((t - 0.46) / 0.54, 0, 1);
    const curlReach = easeInOut(curlStart);
    const spiralX =
      Math.sin(curlPhase + t * Math.PI * (1.4 + pressureNorm) + time * 0.42) *
      curlStrength *
      curlReach;
    const spiralY =
      Math.cos(curlPhase * 0.8 + t * Math.PI * (1.2 + moistureNorm * 0.7)) *
      curlStrength *
      0.22 *
      curlReach;

    let p = cubicPoint(
      limb.anchor,
      { x: limb.c1.x + sway * 20 + organicBend * 0.18, y: limb.c1.y - crownLift },
      {
        x: limb.c2.x + sway * 28 + organicBend * 0.72 + spiralX * 0.22,
        y: limb.c2.y + sway * 8 - spiralY * 0.4,
      },
      {
        x:
          limb.end.x +
          sway * 12 +
          organicBend +
          livingDrift +
          spiralX * 0.5 +
          limb.anchor.bias * 32,
        y: limb.end.y - spiralY * 0.55,
      },
      t
    );

    p = {
      x: p.x + spiralX * 0.38,
      y: p.y - spiralY * 0.3,
    };

    if (t > 0.62) {
      const hookT = (t - 0.62) / 0.38;
      const loop = Math.sin(hookT * Math.PI * (1.2 + moistureNorm * 0.4));
      p = {
        x:
          p.x +
          limb.direction *
            (loop * limb.hook * lerp(0.28, 0.54, windNorm) +
              Math.sin(hookT * Math.PI * 2.15 + curlPhase) * curlStrength * 0.18),
        y:
          p.y +
          Math.sin(hookT * Math.PI * 1.1) * limb.hook * lerp(0.12, 0.24, moistureNorm) -
          hookT * lerp(4, 14, windNorm) +
          Math.cos(hookT * Math.PI * 1.8 + curlPhase) * curlStrength * 0.08,
      };
    }

    points.push(p);
  }

  return points;
}

function buildBodyCircles(limb, spine, time, dataState) {
  const humidNorm = normalizeValue(dataState.H, stats.minH, stats.maxH);
  const tempNorm = normalizeValue(dataState.T, stats.minT, stats.maxT);
  return spine.map((point, index) => {
    const t = index / (spine.length - 1);
    const baseRadius = lerp(limb.maxRadius, limb.minRadius, t);
    const pulse =
      1 +
      Math.sin(time * poster.motion.speed * 1.15 + index * 0.4 + limb.phase) *
        poster.motion.pulse;

    return {
      x: point.x,
      y: point.y,
      r: baseRadius * pulse * lerp(0.96, 1.08, tempNorm),
      fill: shiftColor(
        index % 3 === 0 ? palette.bodyDeep : palette.body,
        limb.toneShift + lerp(-0.02, 0.05, limb.depth)
      ),
      alpha: lerp(0.9, 1, limb.depth),
    };
  });
}

function drawScene(model, time, dataState) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = palette.paper;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(staticPaper, 0, 0);

  drawBackdropShapes(dataState);
  drawPosterGlow();
  drawBodyShadow();

  const orderedLimbs = [...model.limbs].sort((a, b) => a.depth - b.depth);

  for (const limb of orderedLimbs) {
    drawBodyCircles(limb.bodyCircles);
  }

  drawBody(dataState);

  drawDust();
}

function drawBackdropShapes(dataState) {
  const pressureNorm = normalizeValue(dataState.P, stats.minP, stats.maxP);
  const humidNorm = normalizeValue(dataState.H, stats.minH, stats.maxH);

  ctx.save();

  const wash = ctx.createRadialGradient(126, 126, 24, 126, 126, 260);
  wash.addColorStop(0, "rgba(255,255,255,0.24)");
  wash.addColorStop(0.5, "rgba(243,139,196,0.1)");
  wash.addColorStop(1, "rgba(243,139,196,0)");
  ctx.fillStyle = wash;
  ctx.beginPath();
  ctx.arc(126, 126, 258, 0, Math.PI * 2);
  ctx.fill();

  ctx.fillStyle = `rgba(152, 0, 95, ${lerp(0.05, 0.11, humidNorm).toFixed(3)})`;
  ctx.beginPath();
  ctx.ellipse(612, 610, 180 + pressureNorm * 70, 122, -0.42, 0, Math.PI * 2);
  ctx.fill();

  ctx.strokeStyle = `rgba(112, 0, 70, ${lerp(0.08, 0.16, pressureNorm).toFixed(3)})`;
  ctx.lineWidth = 2;
  ctx.beginPath();
  ctx.arc(104, 544, 244, -0.3, 0.78);
  ctx.stroke();

  ctx.restore();
}

function drawPosterGlow() {
  const gradient = ctx.createRadialGradient(254, 118, 18, 330, 198, 520);
  gradient.addColorStop(0, "rgba(255,255,255,0.4)");
  gradient.addColorStop(0.3, "rgba(250,232,244,0.12)");
  gradient.addColorStop(0.55, "rgba(247,236,227,0.12)");
  gradient.addColorStop(1, "rgba(247,236,227,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawBodyShadow() {
  const gradient = ctx.createRadialGradient(306, 196, 16, 318, 248, 164);
  gradient.addColorStop(0, "rgba(98, 0, 61, 0.22)");
  gradient.addColorStop(1, "rgba(98, 0, 61, 0)");
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.ellipse(314, 222, 158, 52, -0.12, 0, Math.PI * 2);
  ctx.fill();
}

function drawBody(dataState) {
  const split = lerp(0.18, 0.74, normalizeValue(dataState.P, stats.minP, stats.maxP));
  const topColor = shiftColor(palette.bodyDeep, normalizeValue(dataState.W, stats.minW, stats.maxW) * -0.08);
  const bottomColor = shiftColor(palette.rim, normalizeValue(dataState.H, stats.minH, stats.maxH) * 0.06);
  const gradient = ctx.createLinearGradient(
    poster.body.x,
    poster.body.y - poster.body.radius,
    poster.body.x,
    poster.body.y + poster.body.radius
  );
  gradient.addColorStop(0, topColor);
  gradient.addColorStop(split, mixHex(topColor, bottomColor, 0.35));
  gradient.addColorStop(1, bottomColor);

  ctx.save();
  ctx.shadowColor = "rgba(102, 16, 74, 0.18)";
  ctx.shadowBlur = 34;
  ctx.shadowOffsetY = 16;
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(poster.body.x, poster.body.y, poster.body.radius, 0, Math.PI * 2);
  ctx.fill();
  ctx.shadowColor = "transparent";
  ctx.lineWidth = 2.5;
  ctx.strokeStyle = "rgba(255,255,255,0.2)";
  ctx.stroke();
  ctx.fillStyle = "rgba(255,255,255,0.1)";
  ctx.beginPath();
  ctx.arc(poster.body.x - 24, poster.body.y - 28, poster.body.radius * 0.4, 0, Math.PI * 2);
  ctx.fill();
  ctx.restore();
}

function drawBodyCircles(circles) {
  ctx.save();

  for (let i = 0; i < circles.length; i += 1) {
    const c = circles[i];

    ctx.fillStyle = "rgba(107, 13, 67, 0.08)";
    ctx.beginPath();
    ctx.arc(c.x + 1.2, c.y + 3, c.r * 1.02, 0, Math.PI * 2);
    ctx.fill();

    ctx.globalAlpha = c.alpha;
    ctx.fillStyle = c.fill;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.beginPath();
    ctx.arc(c.x - c.r * 0.16, c.y - c.r * 0.18, c.r * 0.48, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.globalAlpha = 1;
  ctx.restore();
}

function drawDust() {
  ctx.save();
  ctx.fillStyle = palette.dust;

  for (let i = 0; i < 1200; i += 1) {
    const x = pseudoRandom(i * 13.1) * canvas.width;
    const y = pseudoRandom(i * 29.7) * canvas.height;
    const r = 0.4 + pseudoRandom(i * 5.3) * 1.6;
    ctx.beginPath();
    ctx.arc(x, y, r, 0, Math.PI * 2);
    ctx.fill();
  }

  ctx.restore();
}

function buildPalette(dataStats) {
  const warm = normalizeValue(dataStats.avgT, dataStats.minT, dataStats.maxT);
  const humid = normalizeValue(dataStats.avgH, dataStats.minH, dataStats.maxH);

  return {
    paper: "#f7f3ea",
    body: mixHex("#8e0057", "#b8006d", warm * 0.7),
    bodyDeep: mixHex("#63003b", "#87004f", warm * 0.55),
    rim: mixHex("#ef67b0", "#ff75bb", humid * 0.42),
    inner: "#faedf4",
    dot: mixHex("#cb307b", "#df468d", warm * 0.45),
    dust: "rgba(128, 100, 72, 0.08)",
  };
}

function buildPaperTexture() {
  const offscreen = document.createElement("canvas");
  offscreen.width = canvas.width;
  offscreen.height = canvas.height;
  const octx = offscreen.getContext("2d");
  const img = octx.createImageData(offscreen.width, offscreen.height);

  for (let y = 0; y < offscreen.height; y += 1) {
    for (let x = 0; x < offscreen.width; x += 1) {
      const i = (y * offscreen.width + x) * 4;
      const n = pseudoRandom(x * 0.37 + y * 0.91);
      const warm = Math.sin((x + y) * 0.013) * 4;
      const shade = 244 + n * 12 + warm;
      img.data[i] = shade + 4;
      img.data[i + 1] = shade + 1;
      img.data[i + 2] = shade - 6;
      img.data[i + 3] = 255;
    }
  }

  octx.putImageData(img, 0, 0);
  return offscreen;
}

function parseCsv(text) {
  const [headerLine, ...lines] = text.trim().split(/\r?\n/);
  const headers = headerLine.split(",");
  return lines.map((line) => {
    const values = line.split(",");
    const row = {};
    headers.forEach((header, index) => {
      row[header] = Number(values[index]);
    });
    return row;
  });
}

function getDataState(time) {
  const cycle = poster.timeline.secondsPerDay;
  const normalized = ((time % cycle) + cycle) % cycle / cycle;
  const exactIndex = normalized * rows.length;
  const i0 = Math.floor(exactIndex) % rows.length;
  const i1 = (i0 + 1) % rows.length;
  const t = exactIndex - Math.floor(exactIndex);
  const a = rows[i0];
  const b = rows[i1];

  return {
    hour: lerp(a.hour, b.hour, t),
    T: lerp(a.T, b.T, t),
    H: lerp(a.H, b.H, t),
    P: lerp(a.P, b.P, t),
    W: lerp(a.W, b.W, t),
    M: lerp(a.M, b.M, t),
  };
}

function summarize(data) {
  return {
    minT: minOf(data, "T"),
    maxT: maxOf(data, "T"),
    avgT: average(data, "T"),
    minH: minOf(data, "H"),
    maxH: maxOf(data, "H"),
    avgH: average(data, "H"),
    minP: minOf(data, "P"),
    maxP: maxOf(data, "P"),
    avgP: average(data, "P"),
    minW: minOf(data, "W"),
    maxW: maxOf(data, "W"),
    avgW: average(data, "W"),
    minM: minOf(data, "M"),
    maxM: maxOf(data, "M"),
    avgM: average(data, "M"),
  };
}

function chunkRows(data, groupCount) {
  const out = [];
  const size = Math.ceil(data.length / groupCount);
  for (let i = 0; i < groupCount; i += 1) {
    const start = i * size;
    const end = Math.min(data.length, start + size);
    if (start < end) out.push(data.slice(start, end));
  }
  return out;
}

function pointOnPolyline(points, t) {
  const target = t * (points.length - 1);
  const i = Math.floor(target);
  const f = target - i;
  const a = points[Math.max(0, i)];
  const b = points[Math.min(points.length - 1, i + 1)];
  return {
    x: lerp(a.x, b.x, f),
    y: lerp(a.y, b.y, f),
  };
}

function tangentOnPolyline(points, t) {
  const target = t * (points.length - 1);
  const i = Math.floor(target);
  const a = points[Math.max(0, i - 1)];
  const b = points[Math.min(points.length - 1, i + 1)];
  return normalize({
    x: b.x - a.x,
    y: b.y - a.y,
  });
}

function cubicPoint(p0, p1, p2, p3, t) {
  const mt = 1 - t;
  const mt2 = mt * mt;
  const t2 = t * t;
  return {
    x:
      p0.x * mt2 * mt +
      3 * p1.x * mt2 * t +
      3 * p2.x * mt * t2 +
      p3.x * t2 * t,
    y:
      p0.y * mt2 * mt +
      3 * p1.y * mt2 * t +
      3 * p2.y * mt * t2 +
      p3.y * t2 * t,
  };
}

function shiftColor(hex, amount) {
  const rgb = hexToRgb(hex);
  const hsl = rgbToHsl(rgb.r, rgb.g, rgb.b);
  hsl.l = clamp(hsl.l + amount, 0, 1);
  return hslToHex(hsl.h, hsl.s, hsl.l);
}

function mixHex(a, b, t) {
  const ca = hexToRgb(a);
  const cb = hexToRgb(b);
  return rgbToHex(
    Math.round(lerp(ca.r, cb.r, t)),
    Math.round(lerp(ca.g, cb.g, t)),
    Math.round(lerp(ca.b, cb.b, t))
  );
}

function hexToRgb(hex) {
  const clean = hex.replace("#", "");
  const bigint = parseInt(clean, 16);
  return {
    r: (bigint >> 16) & 255,
    g: (bigint >> 8) & 255,
    b: bigint & 255,
  };
}

function rgbToHex(r, g, b) {
  return `#${[r, g, b].map((n) => n.toString(16).padStart(2, "0")).join("")}`;
}

function rgbToHsl(r, g, b) {
  r /= 255;
  g /= 255;
  b /= 255;
  const max = Math.max(r, g, b);
  const min = Math.min(r, g, b);
  let h;
  let s;
  const l = (max + min) / 2;

  if (max === min) {
    h = s = 0;
  } else {
    const d = max - min;
    s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
    switch (max) {
      case r:
        h = (g - b) / d + (g < b ? 6 : 0);
        break;
      case g:
        h = (b - r) / d + 2;
        break;
      default:
        h = (r - g) / d + 4;
    }
    h /= 6;
  }

  return { h, s, l };
}

function hslToHex(h, s, l) {
  const hue2rgb = (p, q, t) => {
    if (t < 0) t += 1;
    if (t > 1) t -= 1;
    if (t < 1 / 6) return p + (q - p) * 6 * t;
    if (t < 1 / 2) return q;
    if (t < 2 / 3) return p + (q - p) * (2 / 3 - t) * 6;
    return p;
  };

  let r;
  let g;
  let b;

  if (s === 0) {
    r = g = b = l;
  } else {
    const q = l < 0.5 ? l * (1 + s) : l + s - l * s;
    const p = 2 * l - q;
    r = hue2rgb(p, q, h + 1 / 3);
    g = hue2rgb(p, q, h);
    b = hue2rgb(p, q, h - 1 / 3);
  }

  return rgbToHex(Math.round(r * 255), Math.round(g * 255), Math.round(b * 255));
}

function average(data, key) {
  return data.reduce((sum, row) => sum + row[key], 0) / data.length;
}

function minOf(data, key) {
  return Math.min(...data.map((row) => row[key]));
}

function maxOf(data, key) {
  return Math.max(...data.map((row) => row[key]));
}

function normalizeValue(value, min, max) {
  return max === min ? 0.5 : (value - min) / (max - min);
}

function normalize(v) {
  const len = Math.hypot(v.x, v.y) || 1;
  return { x: v.x / len, y: v.y / len };
}

function easeInOut(t) {
  return t * t * (3 - 2 * t);
}

function lerp(a, b, t) {
  return a + (b - a) * t;
}

function clamp(value, min, max) {
  return Math.max(min, Math.min(max, value));
}

function pseudoRandom(seed) {
  const x = Math.sin(seed * 127.1) * 43758.5453123;
  return x - Math.floor(x);
}

requestAnimationFrame(animate);
