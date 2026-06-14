int W = 514;
int H = 721;

color bgColor = #F7F3EA;
color bodyColor = #96005E;
color rimColor = #F06AB3;
color innerColor = #F9EAF2;
color dotColor = #D63A87;

ArrayList<PVector> spine;
ArrayList<PVector> leftEdge;
ArrayList<PVector> rightEdge;

void settings() {
  size(W, H);
  smooth(8);
}

void setup() {
  noLoop();
}

void draw() {
  randomSeed(12);
  noiseSeed(12);

  background(bgColor);
  drawPaperTexture();

  buildTentacle();
  drawTentacleBody();
  drawHead();
  drawNeckPocket();
  drawSuckers();

  applyBodyGrain();
  drawDust();
}

void keyPressed() {
  if (key == 's' || key == 'S') {
    saveFrame("octopus-####.png");
  } else {
    redraw();
  }
}

void buildTentacle() {
  spine = new ArrayList<PVector>();
  leftEdge = new ArrayList<PVector>();
  rightEdge = new ArrayList<PVector>();

  PVector[] ctrl = {
    new PVector(208, 206),
    new PVector(206, 290),
    new PVector(206, 395),
    new PVector(216, 515),
    new PVector(244, 608),
    new PVector(306, 680),
    new PVector(383, 676),
    new PVector(432, 622),
    new PVector(406, 574),
    new PVector(347, 586),
    new PVector(333, 632),
    new PVector(369, 652),
    new PVector(407, 632),
    new PVector(429, 592),
    new PVector(421, 548)
  };

  int samples = 220;
  for (int i = 0; i < samples; i++) {
    float u = map(i, 0, samples - 1, 0, ctrl.length - 3);
    int seg = floor(u);
    seg = constrain(seg, 0, ctrl.length - 4);
    float t = u - seg;

    float x = curvePoint(ctrl[seg].x, ctrl[seg + 1].x, ctrl[seg + 2].x, ctrl[seg + 3].x, t);
    float y = curvePoint(ctrl[seg].y, ctrl[seg + 1].y, ctrl[seg + 2].y, ctrl[seg + 3].y, t);
    spine.add(new PVector(x, y));
  }

  for (int i = 0; i < spine.size(); i++) {
    PVector p = spine.get(i);
    PVector prev = spine.get(max(0, i - 1));
    PVector next = spine.get(min(spine.size() - 1, i + 1));

    PVector tangent = PVector.sub(next, prev);
    tangent.normalize();
    PVector normal = new PVector(-tangent.y, tangent.x);

    float t = i / float(spine.size() - 1);
    float halfW = tentacleHalfWidth(t);

    if (t > 0.73) {
      float pinch = map(t, 0.73, 1.0, 1.0, 0.45);
      halfW *= pinch;
    }

    leftEdge.add(PVector.add(p, PVector.mult(normal, halfW)));
    rightEdge.add(PVector.sub(p, PVector.mult(normal, halfW)));
  }
}

float tentacleHalfWidth(float t) {
  if (t < 0.08) return lerp(40, 47, t / 0.08);
  if (t < 0.55) return lerp(47, 34, (t - 0.08) / 0.47);
  if (t < 0.78) return lerp(34, 22, (t - 0.55) / 0.23);
  return lerp(22, 7, (t - 0.78) / 0.22);
}

void drawTentacleBody() {
  noStroke();
  fill(bodyColor);

  beginShape();
  for (int i = 0; i < leftEdge.size(); i++) {
    vertex(leftEdge.get(i).x, leftEdge.get(i).y);
  }
  for (int i = rightEdge.size() - 1; i >= 0; i--) {
    vertex(rightEdge.get(i).x, rightEdge.get(i).y);
  }
  endShape(CLOSE);
}

void drawHead() {
  float cx = 251;
  float cy = 116;
  float outer = 154;
  float inner = 123;

  noStroke();
  fill(rimColor);
  ellipse(cx, cy, outer, outer);

  fill(innerColor);
  ellipse(cx, cy, inner, inner);

  fill(255, 22);
  ellipse(cx - 8, cy - 8, 100, 96);

  noFill();
  stroke(dotColor);
  strokeWeight(3);
  ellipse(cx, cy, 16, 16);
}

void drawNeckPocket() {
  noStroke();
  fill(rimColor);
  beginShape();
  vertex(190, 176);
  bezierVertex(184, 197, 187, 217, 201, 229);
  bezierVertex(216, 241, 236, 242, 250, 230);
  bezierVertex(263, 217, 263, 195, 247, 178);
  endShape(CLOSE);

  fill(innerColor);
  beginShape();
  vertex(196, 183);
  bezierVertex(192, 199, 194, 212, 205, 221);
  bezierVertex(216, 230, 230, 230, 240, 221);
  bezierVertex(248, 211, 248, 196, 238, 184);
  endShape(CLOSE);
}

void drawSuckers() {
  float[] mainTs = {0.10, 0.17, 0.25, 0.33, 0.41, 0.49, 0.57, 0.64, 0.70, 0.75, 0.80};
  float[] mainSizes = {45, 43, 41, 39, 36, 33, 30, 27, 23, 20, 17};

  for (int i = 0; i < mainTs.length; i++) {
    PVector p = pointOnSpine(mainTs[i]);
    PVector inward = inwardNormal(mainTs[i]);
    float offset = lerp(18, 9, i / float(mainTs.length - 1));
    PVector c = PVector.add(p, PVector.mult(inward, offset));
    if (i == 0) c.x += 5;
    if (i == 1) c.x += 2;
    drawSucker(c.x, c.y, mainSizes[i]);
  }

  float[] tipTs = {0.835, 0.858, 0.882, 0.905, 0.928, 0.949, 0.968, 0.984};
  for (int i = 0; i < tipTs.length; i++) {
    PVector p = pointOnSpine(tipTs[i]);
    PVector inward = inwardNormal(tipTs[i]);
    float d = lerp(15, 8, i / float(tipTs.length - 1));
    PVector c = PVector.add(p, PVector.mult(inward, 6));
    drawSucker(c.x, c.y, d);
  }
}

PVector pointOnSpine(float t) {
  int idx = int(constrain(t, 0, 1) * (spine.size() - 1));
  return spine.get(idx).copy();
}

PVector inwardNormal(float t) {
  int idx = int(constrain(t, 0, 1) * (spine.size() - 1));
  idx = constrain(idx, 1, spine.size() - 2);
  PVector prev = spine.get(idx - 1);
  PVector next = spine.get(idx + 1);
  PVector tangent = PVector.sub(next, prev);
  tangent.normalize();
  PVector normal = new PVector(tangent.y, -tangent.x);
  normal.normalize();
  return normal;
}

void drawSucker(float x, float y, float d) {
  noStroke();
  fill(rimColor);
  ellipse(x, y, d, d);

  fill(innerColor);
  ellipse(x, y, d * 0.74, d * 0.74);

  fill(255, 16);
  ellipse(x - d * 0.08, y - d * 0.08, d * 0.42, d * 0.42);

  fill(dotColor);
  ellipse(x, y, max(3.5, d * 0.1), max(3.5, d * 0.1));
}

void applyBodyGrain() {
  loadPixels();
  for (int y = 0; y < height; y++) {
    for (int x = 0; x < width; x++) {
      int idx = y * width + x;
      color c = pixels[idx];
      float r = red(c);
      float g = green(c);
      float b = blue(c);

      if (r < 230 && b < 200) {
        float n = noise(x * 0.045, y * 0.045);
        float grain = randomGaussian() * 8;
        pixels[idx] = color(
          constrain(r + grain + map(n, 0, 1, -7, 7), 0, 255),
          constrain(g + grain * 0.35, 0, 255),
          constrain(b + grain * 0.5, 0, 255)
          );
      }
    }
  }
  updatePixels();
}

void drawPaperTexture() {
  loadPixels();
  for (int y = 0; y < height; y++) {
    for (int x = 0; x < width; x++) {
      float n = noise(x * 0.012, y * 0.012);
      float grain = randomGaussian() * 5;
      float warm = map(n, 0, 1, -7, 7);
      pixels[y * width + x] = color(
        constrain(red(bgColor) + grain + warm, 0, 255),
        constrain(green(bgColor) + grain + warm * 0.65, 0, 255),
        constrain(blue(bgColor) + grain, 0, 255)
        );
    }
  }
  updatePixels();
}

void drawDust() {
  noStroke();
  for (int i = 0; i < 1000; i++) {
    float x = random(width);
    float y = random(height);
    fill(130, 108, 76, random(4, 14));
    ellipse(x, y, random(0.8, 2.1), random(0.8, 2.1));
  }
}
