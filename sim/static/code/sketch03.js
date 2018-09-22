function setup() {
  var my_element = select("#mysketch");
  var my_width = min(my_element.width, 1000);
  var my_canvas = createCanvas(my_width, my_width *0.6);
  my_canvas.parent("mysketch");

  order_input = createInput("How many?");
  var order_btn = createButton("Order");
  var stop_btn = createButton("Pause");
  var resume_btn = createButton("Resume");

  order_input.parent("buttons");
  order_btn.parent("buttons");
  stop_btn.parent("buttons");
  resume_btn.parent("buttons");

  order_btn.mousePressed(place_order);
  stop_btn.mousePressed(noLoop);
  resume_btn.mousePressed(loop);

  frameRate(6);
  my_model = new Model();
}

function draw() {
  background(200);
  my_model.show_history();
  my_model.show_stock();
  while(frameCount >= my_model.calendar.events[0].time) {
    my_model.update();
  }
}

var my_model;
var order_input;

// exponential distribution
function exp_rand(lambda) {
  var x = -log(1 - random()) /lambda;
  return x;
}

// event calendar
function Calendar(initial) {
  this.events = initial;
}

// add a new event to the calendar
Calendar.prototype.extend = function(e) {
  for(var i = 0; i < this.events.length; i ++) {
    if(this.events[i].time > e.time) {
      this.events.splice(i, 0, e);
      return;
    }
  }
  this.events.push(e);
}

// get the next event from the calendar
Calendar.prototype.fire = function() {
  var e = this.events[0];
  this.events.shift();
  return e;
}

// simulation model
function Model() {
  this.par = {
    MTB: 2,  //mean time between shipments
    LT: 10,  // lead time to replenishment
    HC: 1,  // stock holding cost
    OC: 500,  // ordering cost
    SOP: 250,  // stock out penalty
    RV: 100,  // sales revenue
  };
  this.state = {
    time: 0,  // what time is it now?
    vol: 20,  // stock volume at hand
    ordered: [],  // quantities ordered
    outs: 0,  // number of stockouts
    hc: 0,  // total stock holding cost
    oc: 0,  // total ordering cost
    rv: 0,  // total revenue
  };
  this.calendar = new Calendar([
    {time:exp_rand(1 /this.par.MTB), type:"ship_out"},
    {time:900, type:"over"}
  ]);
  this.stateLog = [this.state];
}

Model.prototype.reduce = function() {
  if(this.state.vol > 0) {
    this.state.vol --;
    this.state.rv += this.par.RV;
  } else {
    this.state.outs ++;
  }
  this.calendar.extend({
    time: this.state.time +exp_rand(1 /this.par.MTB),
    type: "ship_out"
  });
  this.par.MTB = max(0.1, this.par.MTB +random(-0.1, 0.1))
}

Model.prototype.raise = function() {
  this.state.vol += this.state.ordered[0];
  this.state.ordered.shift();
}

Model.prototype.update = function() {
  var e = this.calendar.fire();
  this.state = Object.assign({}, this.state);
  this.state.hc += (e.time -this.state.time) *this.state.vol *this.par.HC;
  this.state.time = e.time;
  if(e.type == "over") {
    my_model.show_results();
    noLoop();
  } else if(e.type == "ship_out") {
    this.reduce();
  } else if(e.type == "refill") {
    this.raise();
  }
  this.stateLog.push(this.state);
}

Model.prototype.show_results = function() {
  background(200);
  var my_ratio = width /1000;
  push();
  scale(my_ratio);
  translate(50, 100);
  var my_score = this.state.rv -this.state.hc -this.state.oc -this.state.outs *this.par.SOP;
  textSize(40);
  text("Your Score: " +floor(my_score), 0, 0);
  textSize(20);
  text("Sales Revenue: " +floor(this.state.rv), 100, 100);
  text("Holding Cost: " +floor(this.state.hc), 100, 140);
  text("Ordering Cost: " +floor(this.state.oc), 100, 180);
  text("Stockout Penalty: " +floor(this.state.outs *this.par.SOP), 100, 220);
  pop();
}

Model.prototype.show_history = function() {
  var my_ratio = width /1000;
  push();
  scale(my_ratio);
  translate(50, 550);
  textSize(20);
  text("0", -5, 20);
  text("200", 180, 20);
  text("400", 380, 20);
  text("600", 580, 20);
  text("800", 780, 20);
  text("time", 890, 20);
  stroke(0, 0, 255);
  for(var i = 0; i < this.stateLog.length -1; i ++) {
    var from = this.stateLog[i];
    var to = this.stateLog[i +1];
    line(from.time, -5 *from.vol, to.time, -5 *from.vol);
    line(to.time, -5 *from.vol, to.time, -5 *to.vol);
  }
  stroke(255, 0, 0);
  line(frameCount, 0, frameCount, -150);
  stroke(0);
  strokeWeight(2);
  line(0, 0, 900, 0);
  line(0, 0, 0, -200);
  pop();
}

Model.prototype.show_stock = function() {
  var my_ratio = width /1000;
  push();
  scale(my_ratio);
  translate(50, 200);
  textSize(20);
  text("stock at hand", 100, 70);
  for (var i = 0; i < this.state.vol; i ++) {
    rect((i %10) *40, -floor(i /10) *40, 40, 40);
  }
  translate(500, 0);
  text("stockouts", 100, 70);
  fill(255, 0, 0);
  for (var i = 0; i < this.state.outs; i ++) {
    rect((i %10) *40, -floor(i /10) *40, 40, 40);
  }
  pop();
}

function place_order() {
  var oq = parseInt(order_input.value());
  if(Number.isNaN(oq)) oq = 0;
  my_model.calendar.extend({
    time: frameCount +my_model.par.LT,
    type: "refill"
  });
  my_model.state.ordered.push(oq);
  my_model.state.oc += my_model.par.OC;
}
