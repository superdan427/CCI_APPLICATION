let facets = [];
let totalFacets = 659;
let pinkFacet;

function setup() {
  createCanvas(windowWidth, windowHeight);
  // Create 658 blue 'structural' facets
  for (let i = 0; i < totalFacets - 1; i++) {
    facets.push(new Facet(random(width), random(height), false));
  }
  // The 1 Pink "Signal" facet
  pinkFacet = new Facet(width / 2, height / 2, true);
  
  rectMode(CENTER);
}

function draw() {
  background('#F5F8FB'); // Palantir Light Base

  // 1. Draw the "Infrastructure" (The Overlapping Planes)
  noStroke();
  for (let f of facets) {
    f.interact(pinkFacet.pos);
    f.display();
  }

  // 2. Draw the Pink Facet (The Human Element)
  pinkFacet.move();
  pinkFacet.display();

  // 3. Palantir UI Overlays (Technical Labels)
  drawTechnicalUI();
}

class Facet {
  constructor(x, y, isSpecial) {
    this.pos = createVector(x, y);
    this.originalPos = createVector(x, y);
    this.isSpecial = isSpecial;
    this.w = random(20, 80);
    this.h = random(5, 40);
    this.angle = random(TWO_PI);
    this.col = isSpecial ? color('#DB2C6F') : color(16, 107, 163, 20); // Pink vs Faint Blue
  }

  move() {
    // Pink facet follows a complex, non-linear path (Modern Art feel)
    this.pos.x = noise(frameCount * 0.005) * width;
    this.pos.y = noise(frameCount * 0.005 + 100) * height;
    this.angle += 0.02;
  }

  interact(target) {
    if (!this.isSpecial) {
      let d = dist(this.pos.x, this.pos.y, target.x, target.y);
      if (d < 150) {
        // "Refraction": Blue facets tilt away from the pink facet
        this.angle = lerp(this.angle, atan2(target.y - this.pos.y, target.x - this.pos.x), 0.1);
        this.col = color(16, 107, 163, 60); // Get slightly darker when "active"
      } else {
        this.col = color(16, 107, 163, 20);
      }
    }
  }

  display() {
    push();
    translate(this.pos.x, this.pos.y);
    rotate(this.angle);
    fill(this.col);
    
    if (this.isSpecial) {
      // The Pink facet is a sharp, non-rounded wedge
      stroke('#DB2C6F');
      strokeWeight(1);
      triangle(-15, 15, 15, 15, 0, -30);
    } else {
      // Structural facets are thin 1px rectangles (Blueprint style)
      stroke(16, 107, 163, 30);
      rect(0, 0, this.w, this.h);
    }
    pop();
  }
}

function drawTechnicalUI() {
  fill('#182026');
  textFont('monospace');
  textSize(10);
  text("FACET_COUNT: 659", 40, 40);
  text("SYSTEM_STATE: ASYMMETRIC_STABILITY", 40, 55);
  
  // 1px hairline border around the "canvas"
  noFill();
  stroke('#D8E1E8');
  rect(width/2, height/2, width - 60, height - 60);
}
