let ml;
let postureValue = 0;
let badPostureTime = 0;
let inWarning = false;
let inViolation = false;
let violationCounter = 0;
let pavlokTriggered = false; //only obce 
let pavlokToken = ""
let catImg;

async function setup() {
  createCanvas(windowWidth, windowHeight);
  ml = new MLBridge();
  ml.onPrediction((data) => {
    if (data.regression) {
      let key = Object.keys(data.regression)[0];
      postureValue = data.regression[key];
    }
  });
  //catImg = await loadImage('cat.jpg');
}


function draw() {
  
  if (postureValue <= 0.95) {

    background(0, 250, 0);
    inWarning = false;
    inViolation = false;
    badPostureTime = 0;
    pavlokTriggered = false; 
  
    
    fill(255);
    textSize(72);
    textAlign(CENTER, CENTER);
    text("POSTURE: GOOD", width/2, height/2);
    
  } else { 

    
    if (!inWarning && !inViolation) {
      inWarning = true;
      badPostureTime = millis();
}
    
    let elapsedTime = (millis() - badPostureTime) / 1000;
    
    if (elapsedTime >= 5 && !inViolation) {

      inViolation = true;
      violationCounter++;
}
    
    if (inViolation) {

      if (!pavlokTriggered) {
        triggerPavlok(100);
        pavlokTriggered = true; 
        ;
     }
      

      if (frameCount % 10 < 5) {
        background(255, 0, 0);
      } else {
        background(150, 0, 0);
      }

      fill(255);
      textSize(96);
      textAlign(CENTER, CENTER);
      text("VIOLATION!!", width/2, height/2);
      imageMode(CENTER);
      //image (catImg, width/2, height/2 + 150, 200, 200);
      
    } else {

      background(255, 165, 0);
      fill(0);
      textSize(64);
      textAlign(CENTER, CENTER);
      text("FIX POSTURE NOW", width/2, height/2 - 50);
      
      textSize(128);
      let remainingTime = Math.ceil(5 - elapsedTime);
      text(remainingTime, width/2, height/2 + 80);
    }
  }
  

  fill(255);
  textAlign(LEFT);
  textSize(24);
  text("Posture: " + postureValue.toFixed(2), 20, 40);
  text("Violations: " + violationCounter, 20, 80);
}

function triggerPavlok(intensity) {
  console.log("Triggering vibe ONCE");
  
  fetch('https://api.pavlok.com/api/v5/stimulus/send', {
    method: 'POST',
    headers: {
      'Authorization': 'Bearer ' + pavlokToken,
      'Content-Type': 'application/json'
    },
    body: JSON.stringify({
      stimulus: {
        stimulusType: "vibe",
        stimulusValue: intensity
      }
    })
  })
  .then(response => console.log("Vibe sent:", response.status))
  .catch(error => console.error('Pavlok Error:', error));
}