function setup() {
  var my_element = select("#mysketch");
  var my_width = min(my_element.width, 1000);
  var my_canvas = createCanvas(my_width, my_width *0.6);
  my_canvas.parent("mysketch");

  background(200);
  textSize(32);
  textAlign(CENTER, CENTER);
  text("Hello World!", width /2, height /2);
}

function draw() {
}
