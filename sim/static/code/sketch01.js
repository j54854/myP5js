function setup() {
  var my_element = select("#mysketch");
  var my_canvas = createCanvas(my_element.width, 400);
  my_canvas.parent("mysketch");

  background(200);
  textSize(32);
  textAlign(CENTER, CENTER);
  text("Hello World!", width /2, height /2);
}

function draw() {
}
