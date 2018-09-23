function setup() {
  var my_element = select("#mysketch");
  var my_width = min(my_element.width, 1000);
  var my_canvas = createCanvas(my_width, my_width *0.6);
  my_canvas.parent("mysketch");

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
  //  my_model.update();
  //  console.log(my_model.state);
}

var my_model;

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
    OQ: 20,  // order quantity
    OP: 5  // ordering point
  };
  this.state = {
    time: 0,  // what time is it now?
    vol: 20,  // stock volume at hand
    ordered: [],  // quantities ordered
    outs: 0  // number of stockouts
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
    var total_ordered = 0;
    for(o of this.state.ordered) {
      total_ordered += o;
    }
    if(this.state.vol +total_ordered <= this.par.OP) {
      this.calendar.extend({  // a new order is issued
        time: this.state.time +this.par.LT,
        type: "refill"
      });
      this.state.ordered.push(this.par.OQ);
    }
  } else {
    this.state.outs ++;
  }
  this.calendar.extend({
    time: this.state.time +exp_rand(1 /this.par.MTB),
    type: "ship_out"
  });
}

Model.prototype.raise = function() {
  this.state.vol += this.state.ordered[0];
  this.state.ordered.shift();
}

Model.prototype.update = function() {
  var e = this.calendar.fire();
  this.state = Object.assign({}, this.state);
  this.state.ordered = this.state.ordered.concat();
  this.state.time = e.time;
  if(e.type == "over") {
    noLoop();
  } else if(e.type == "ship_out") {
    this.reduce();
  } else if(e.type == "refill") {
    this.raise();
  }
  this.stateLog.push(this.state);
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
