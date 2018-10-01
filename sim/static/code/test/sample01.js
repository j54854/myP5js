function setup() {
  var my_element = select("#mysketch");
  var my_width = min(my_element.width, 800);

  var my_canvas = createCanvas(my_width, my_width);
  var stop_btn = createButton("Pause");
  var resume_btn = createButton("Resume");
  var start_btn = createButton("Restart");

  my_canvas.parent("mysketch");
  stop_btn.parent("buttons");  //
  resume_btn.parent("buttons");
  start_btn.parent("buttons");

  stop_btn.mousePressed(noLoop);
  resume_btn.mousePressed(loop);
  start_btn.mousePressed(start_again);

  frameRate(12);
  my_model = new Model();
}

function draw() {
  background(230, 240, 250);
  my_model.show();
  while(frameCount >= my_model.calendar.events[0].time) {
    my_model.update();
    console.log(my_model.customers);
  }
}

function start_again() {
  if(frameCount >= 350) {
    my_model = new Model();
    frameCount = 0;
    loop();
  }
}

var my_model;

// exponential distribution
function exp_rand(lambda) {
  return -log(1 -random()) /lambda;
}

// truncated normal distribution
function tnorm_rand(mean, sd) {
  do {
    var x = randomGaussian(mean, sd);
  } while(x <= 0);
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

// customer model
function Customer(id, now) {
  this.id = id;
  this.size = this.set_size();  // how many people you are
  this.place = undefined;  // where you are now?
  this.table = [];  // table(s) assigned
  this.arrived = now;  // when arrived
  this.seated = undefined;  // when seated
  this.left = undefined;  // when left
}

Customer.prototype.set_size = function() {
  var dice = random();
  if(dice < 0.1) {  // tentative distribution (to be modified)
    return 1;
  } else if(dice < 0.7) {
    return floor(random(2, 4));
  } else {
    return floor(random(4, 8));
  }
}

function Customers() {
  this.num = 0;
  this.waiting_people = 0;
  this.balked = [];  // customers who left without waiting
  this.queued = [];  // customers who are waiting in the queue
  this.served = [];  // customers who are being served at tables
  this.left = [];  // customers who left after finishing meal
}

Customers.prototype.arrive = function(now) {
  var c = new Customer(this.num, now);
  this.num ++;
  if(this.waiting_people > 10) {  // (too) simple balking rule
    c.left = now;
    c.place = "balked";
    this.balked.push(c);
  } else {
    c.place = "queued";
    this.queued.push(c);
    this.waiting_people += c.size;
  }
}

Customers.prototype.take_seat = function(c, now) {  // seated to a table
  c.seated = now;
  c.place = "served";
  this.served.push(c);
  for(var i = 0; i < this.queued.length; i ++) {
    if(this.queued[i] == c) {
      this.queued.splice(i, 1);
      this.waiting_people -= c.size;
      break;
    }
  }
  for(var t of c.table) {
      t.free = false;
      t.who = c;
  }
}

Customers.prototype.leave = function(c, now) {  // finish meal & leave restaurant
  c.left = now;
  c.place = "left";
  this.left.push(c);
  for(var i = 0; i < this.served.length; i ++) {
    if(this.served[i] == c) {
      this.served.splice(i, 1);
      break;
    }
  }
  for(var t of c.table) {
      t.free = true;
      t.who = undefined;
  }
}

// table model
function Table(id) {
  this.id = id;
  this.free = true;  // if not, this table is occupied
  this.who = undefined;  // customers at the table
}

function Tables(N) {  // N: total number of tables
  this.tables = [];
  for(var i = 0; i < N; i ++) {  // serially located tables
    this.tables.push(new Table(i));
  }
}

Tables.prototype.get_candidates = function(num) {  // num: # of necessary tables
  var candidates = [];  // set of possible combinations of num tables
  var chain = 0;
  for(var i = 0; i < this.tables.length; i ++) {
    if(this.tables[i].free) {
      chain ++;
    } else {
      chain = 0;
    }
    if(chain == num) {
      var candidate = [];
      for(var j = i -num +1; j <= i; j ++) {
        candidate.push(this.tables[j]);
      }
      candidates.push(candidate);
      chain --;
    }
  }
  return candidates;
}

// simulation model
function Model() {
  this.par = {
    NT: 7,  // number of tables
    MTB: 10,  // mean time between arrivals
    MET: 30,  // mean eating time
    SD: 8,  // standard deviation
  };
  this.customers = new Customers();
  this.tables = new Tables(this.par.NT);
  this.calendar = new Calendar([
    {time:0, type:"arrival"},  // arrival of the 1st customer
    {time:350, type:"over"}  // the end of simulation
  ]);
}

Model.prototype.update = function() {
  var e = this.calendar.fire();  // e: the next event
  if(e.type == "over") {
    noLoop();  //  simulation is over
  } else if(e.type == "arrival") {
    this.customers.arrive(e.time);
    this.calendar.extend({
      time: e.time +exp_rand(1 /this.par.MTB),
      type: "arrival"  // arraival of next customer
    });
    this.seat_customers(e.time);
  } else if(e.type == "departure") {
    this.customers.leave(e.who, e.time);
    this.seat_customers(e.time);
  }
}

Model.prototype.seat_customers = function(now) {
  while(this.customers.queued.length > 0) {  // are there waiting customer(s)?
    var c = this.customers.queued[0];  // 1st customer in the queue
    var table_num = ceil(c.size /2);  // how many tables needed?
    var candidates = this.tables.get_candidates(table_num);
    if(candidates.length == 0) {
      return;
    }
    c.table = random(candidates);  // (too) simple seating rule
    this.customers.take_seat(c, now);
    this.calendar.extend({
      time: now +tnorm_rand(this.par.MET, this.par.SD),
      type: "departure",
      who: c  // customer c finishes meal
    });
  }
  return;
}

// codes for model visualization

Model.prototype.show = function() {
  var my_ratio = width /800;
  push();
  scale(my_ratio);
  textAlign(CENTER, CENTER);
  textSize(18);
  line(0, 400, 800, 400);
  text("waiting queue", 100, 50);
  translate(50, 100);
  this.customers.show_queue();
  translate(0, 125);
  this.tables.show();
  translate(0, 525);
  this.show_chart();
  pop();
}

Customers.prototype.show_queue = function() {
  var x = 0;
  var y = 0;
  for (var c of this.queued) {
    for(var i = 0; i < c.size; i++) {
      ellipse(x, y, 40, 40);
      text(c.id, x, y)
      x += 40;
      if(x > 700) {
        x = 0;
        y = 40;
      }
    }
  }
}

Tables.prototype.show = function() {
  var c = undefined;
  for(var i = 0; i < this.tables.length; i ++) {
    push();
    if(this.tables[i].free) {
      fill(0);
    } else {
      fill(255);
    }
    rect(i *100 +10, 0, 80, 80);
    pop();
    text("table"+i, i *100 +50, 120);
    if(!this.tables[i].free) {
      text(this.tables[i].who.id, i *100 +50, 50);
    }
  }
}

Model.prototype.show_chart = function() {
  for(var i = 0; i < 4; i ++) {  // time
    text(i *100, i *200, 20);
  }
  text("time", 700, 20);
  for(var i = 0; i < 7; i ++) {  // table id
    text(i, -10, i *40 -280);
  }
  for(var c of this.customers.left.concat(this.customers.served)) {
    c.show_in_chart();
  }
  stroke(255, 0, 0);
  line(frameCount *2, 0, frameCount *2, -320);
  stroke(0);
  line(0, 0, 700, 0);
  line(0, 0, 0, -320);
}

Customer.prototype.show_in_chart = function() {
  var x = this.seated *2;
  var h = (this.table[this.table.length -1].id -this.table[0].id +1) *40 -4;
  var y = this.table[0].id *40 -298;
  if(this.place == "left") {
    var w = (this.left -this.seated) *2;
  } else {
    var w = (frameCount -this.seated) *2;
  }
  push();
  stroke(0, 0, 255);
  rect(x, y, w, h);
  pop();
  text(this.id, x +w /2, y +h/2);
}
