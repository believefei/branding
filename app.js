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
const groups = chunkRows(rows, 4);

const palette = buildPalette(stats);

const poster = {
  size: 720,
  body: {
    x: 360,
    y: 120,
    radius: 78,
  },
  motion: {
    speed: 0.85 + normalizeValue(stats.avgW, stats.minW, stats.maxW) * 0.45,
    pulse: 0.04,
  },
};

const limbAnchors = [
  { x: 300, y: 192, side: -0.9 },
  { x: 342, y: 195, side: -0.28 },
  { x: 378, y: 195, side: 0.28 },
  { x: 420, y: 192, side: 0.9 },
];

const limbData = groups.map((group, index) => deriveLimb(group, index));
const staticPaper = buildPaperTexture();

function animate(now) {
  const time = now * 0.001;
  const model = buildModel(time);
  drawScene(model, time);
  requestAnimationFrame(animate);
}

function buildModel(time) {
  return {
    limbs: limbData.map((limb, index) => buildLimbModel(limb, time, index)),
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
  const length = lerp(320, 500, mNorm);
  const spread = lerp(18, 70, pNorm);

  return {
    group,
    anchor,
    phase: index * 0.8,
    sway: lerp(0.08, 0.24, wNorm),
    maxRadius: lerp(24, 34, tNorm),
    minRadius: lerp(6, 11, hNorm),
    lineCount: group.length + 5,
    hook: lerp(14, 32, mNorm),
    direction,
    c1: {
      x: anchor.x + direction * lerp(8, 18, wNorm),
      y: anchor.y + lerp(80, 120, tNorm),
    },
    c2: {
      x: anchor.x + direction * spread,
      y: anchor.y + length * 0.62,
    },
    end: {
      x: anchor.x + direction * (spread + lerp(8, 24, pNorm)),
      y: anchor.y + length,
    },
    toneShift: (index - 1.5) * 0.06,
    suckerSide: direction < 0 ? 1 : -1,
  };
}

function buildLimbModel(limb, time, index) {
  const spine = sampleLimbSpine(limb, time, index);
  return {
    spine,
    bodyCircles: buildBodyCircles(limb, spine, time),
  };
}

function sampleLimbSpine(limb, time, index) {
  const points = [];

  for (let i = 0; i < limb.lineCount; i += 1) {
    const t = i / (limb.lineCount - 1);
    const sway =
      Math.sin(time * poster.motion.speed + limb.phase + t * 4 + index * 0.25) *
      limb.sway *
      easeInOut(Math.max(0, (t - 0.15) / 0.85));

    let p = cubicPoint(
      limb.anchor,
      { x: limb.c1.x + sway * 20, y: limb.c1.y },
      { x: limb.c2.x + sway * 28, y: limb.c2.y + sway * 8 },
      { x: limb.end.x + sway * 12, y: limb.end.y },
      t
    );

    if (t > 0.76) {
      const hookT = (t - 0.76) / 0.24;
      p = {
        x: p.x + limb.direction * Math.sin(hookT * Math.PI) * limb.hook * 0.22,
        y: p.y + Math.sin(hookT * Math.PI) * limb.hook * 0.08 - hookT * 8,
      };
    }

    points.push(p);
  }

  return points;
}

function buildBodyCircles(limb, spine, time) {
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
      r: baseRadius * pulse,
      fill: shiftColor(index % 3 === 0 ? palette.bodyDeep : palette.body, limb.toneShift),
    };
  });
}

function drawScene(model, time) {
  ctx.clearRect(0, 0, canvas.width, canvas.height);
  ctx.fillStyle = palette.paper;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
  ctx.drawImage(staticPaper, 0, 0);

  drawPosterGlow();

  for (const limb of model.limbs) {
    drawBodyCircles(limb.bodyCircles);
  }

  drawBody();

  drawDust();
}

function drawPosterGlow() {
  const gradient = ctx.createRadialGradient(360, 180, 30, 360, 180, 420);
  gradient.addColorStop(0, "rgba(255,255,255,0.32)");
  gradient.addColorStop(0.45, "rgba(247,236,227,0.14)");
  gradient.addColorStop(1, "rgba(247,236,227,0)");
  ctx.fillStyle = gradient;
  ctx.fillRect(0, 0, canvas.width, canvas.height);
}

function drawBody() {
  const split = lerp(0.28, 0.72, normalizeValue(stats.avgP, stats.minP, stats.maxP));
  const topColor = palette.bodyDeep;
  const bottomColor = palette.rim;
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
  ctx.fillStyle = gradient;
  ctx.beginPath();
  ctx.arc(poster.body.x, poster.body.y, poster.body.radius, 0, Math.PI * 2);
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

    ctx.fillStyle = c.fill;
    ctx.beginPath();
    ctx.arc(c.x, c.y, c.r, 0, Math.PI * 2);
    ctx.fill();

    ctx.fillStyle = "rgba(255,255,255,0.04)";
    ctx.beginPath();
    ctx.arc(c.x - c.r * 0.16, c.y - c.r * 0.18, c.r * 0.48, 0, Math.PI * 2);
    ctx.fill();
  }

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
