function setup() {
  var my_element = select("#mysketch");
//  var unit = min(el.width, 1000) /1000;
  var my_canvas = createCanvas(1000 , 600);
  my_canvas.parent("mysketch");
  frameRate(5);
  my_model = new Model();
}

function draw() {
  background(200);
  my_model.update();
  my_model.show_title();
  my_model.show_order();
  my_model.show_stock();
  my_model.show_history();
}

function Calendar(initial) {
  this.events = initial;
}

Calendar.prototype.extend = function(e) {
  for(var i = 0; i < this.events.length; i ++) {
    if(this.events[i].time > e.time) {
      this.events.splice(i, 0, e);
      return;
    }
  }
  this.events.push(e);
  return;
}

Calendar.prototype.fire = function() {
  var e = this.events[0];
  this.events.shift();
  return e;
}

function Model() {
  this.par = {
    AD: 0.5,  // average demand quantity
    LT: 43,  // lead time
    HC: 1,  // stock holding cost
    OC: 1,  // ordering cost
    SOP: 100,  // stock out penalty
    OQ: 20,  // order quantity
    RP: 25  // reprenishment point
  };
  this.state = {
    time: 0,  // what time is it now?
    vol: this.par.OQ,  // stock volume at hand
    ordered: [],  // quantity ordered
    holding_cost: 0,  // total stock holding cost
    ordering_cost: 0,  // total ordering cost
    penalty: 0  // total stock out penalty
  };
  this.calendar = new Calendar([
    {time:exp_rand(this.par.AD), type:"out"},
    {time:900, type:"end"}
  ]);
  this.stateLog = [];
  this.eventLog = [this.state];
}

Model.prototype.reduce = function() {
  if(this.state.vol > 0) {
    this.state.vol --;
    var total_ordered = 0;
    for(oq of this.state.ordered) {
      total_ordered += oq;
    }
    if(this.state.vol +total_ordered <= this.par.RP) {
      this.calendar.extend({
        time: this.state.time +this.par.LT,
        type: "in"
      });
      this.state.ordered.push(this.par.OQ);
      this.state.ordeing_cost += this.par.OC;
    }
  } else {
    this.state.penalty += this.par.SOP;
  }
  this.calendar.extend({
    time: this.state.time +exp_rand(this.par.AD),
    type: "out"
  });
  return;
}

Model.prototype.raise = function() {
  this.state.vol += this.state.ordered[0];
  this.state.ordered.shift();
}

Model.prototype.update = function() {
  var e = this.calendar.fire();
  this.eventLog.push(e);
  this.state = Object.assign({}, this.state);
  this.state.holding_cost += (e.time -this.state.time) *this.state.vol *this.par.HC;
  this.state.time = e.time;
  if(e.type == "end") {
//    this.show_results();
    noLoop();
  } else if(e.type == "out") {
      this.reduce();
  } else if(e.type == "in") {
    this.raise();
  }
  this.stateLog.push(this.state);
}

Model.prototype.show_title = function() {
    push();
    translate(50, 40);
    textSize(24);
    text("AD: " +this.par.AD +" / LT: " +this.par.LT +" / HC: " +this.par.HC +" / OC: " +this.par.OC +" / SOP: " +this.par.SOP, 0, 0);
    pop();
}

Model.prototype.show_stock = function() {
    push();
    translate(550, 240);
    for (var i = 0; i < this.state.vol; i ++) {
      rect((i %10) *40, -Math.floor(i /10) *40, 40, 40);
    }
    textSize(24);
    text("stock at hand", 100, 70);
    pop();
}

Model.prototype.show_order = function() {
    push();
    translate(50, 240);
    var total_ordered = 0;
    for(oq of this.state.ordered) {
      total_ordered += oq;
    }
    for (var i = 0; i < total_ordered; i ++) {
      rect((i %10) *40, -Math.floor(i /10) *40, 40, 40);
    }
    textSize(24);
    text("quantity ordered", 100, 70);
    pop();
}

Model.prototype.show_history = function() {
    push();
    translate(50, 550);
    for(var i = 0; i < this.stateLog.length -1; i ++) {
      var from = this.stateLog[i];
      var to = this.stateLog[i +1];
      line(from.time, -5 *from.vol, to.time, -5 *from.vol);
      line(to.time, -5 *from.vol, to.time, -5 *to.vol);
    }
    strokeWeight(2);
    line(0, 0, 900, 0);
    line(0, 0, 0, -200);
    textSize(20);
    text("0", -5, 20);
    text("200", 180, 20);
    text("400", 380, 20);
    text("600", 580, 20);
    text("800", 780, 20);
    text("day", 890, 20);
    pop();
}

// exponential distribution
function exp_rand(lambda) {
  var x = -log(1 - random()) /lambda;
  return x;
}

// truncated normal distribution
function norm_rand(mean, sd) {
  var x = -1;
  while(x <= 0) {
    x = randomGaussian(mean, sd);
  }
  return x;
}
