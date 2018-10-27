// simple restaurant floor management simuation

function setup() {
  var my_element = select("#mysketch");
  var my_width = min(my_element.width, 800);

  var my_canvas = createCanvas(my_width, my_width);
  var stop_btn = createButton("Pause");
  var resume_btn = createButton("Resume");
  var start_btn = createButton("Restart");

  my_canvas.parent("mysketch");
  stop_btn.parent("buttons");
  resume_btn.parent("buttons");
  start_btn.parent("buttons");

  stop_btn.mousePressed(noLoop);
  resume_btn.mousePressed(loop);
  start_btn.mousePressed(start_again);

  frameRate(20);
  my_model = new Model();
}

function draw() {
  background(230, 240, 250);
  my_model.show();
  while(frameCount/20 >= my_model.calendar.events[0].time) {  // 20 frames per minute
    my_model.update();
  }
}

function start_again() {
  if(frameCount >= my_model.par.HRZ) {
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

// states: born, addressed, carried, cooked, ready, delivered, eaten, left, bassed, vanished
function Order(when, table) {
  this.table = table;
  this.when = when;
  this.state = "born";
  this.when_payed = undefined;
  this.stateLog = [{
     when: this.when,
     state: this.state
  }];
}

Order.prototype.change_state = function(when, to) {
  if(to != this.state) {
    this.when = when;
    this.state = to;
    this.stateLog.push({
      when: this.when,
      state: this.state
    });
    if(to == "cooked") {
      my_model.calendar.extend({
        time: tnorm_rand(my_model.par.MTC, my_model.par.SDC) +when,
        type: "finish_cooking",
        order: this
      });
    } else if(to == "eaten") {
      my_model.calendar.extend({
        time: tnorm_rand(my_model.par.MTE, my_model.par.SDE) +when,
        type: "eat_up",
        order: this,
        table: this.table
      });
    } else if(to == "bassed") {
      my_model.calendar.extend({
        time: tnorm_rand(my_model.par.MTR, my_model.par.SDR) +when,
        type: "create_order",
        table: this.table
      });
    }
  }
}

// states: vacant(white), addressed(blue), waiting(red), eating(green), left(black)
function Counter(name) {
  this.name = name;
  this.node = undefined;
  this.orders = [];
  this.when = 0;
  this.state = "vacant";  // no order / no dishes / empty queue
  this.stateLog = [{
     when: this.when,
     state: this.state
  }];
}

Counter.prototype.change_state = function(when, to) {
  if(to != this.state) {
    this.when = when;
    this.state = to;
    this.stateLog.push({
      when: this.when,
      state: this.state
    });
  }
}

Counter.prototype.remove_order = function(order) {  // only for kitchen & checkstand
  var index = this.orders.indexOf(order);  // when checkout or take_dish is started
  this.orders.splice(index, 1);
}

Counter.prototype.create_order = function(when) {  // only for tables
  this.change_state(when, "waiting");
  var order = new Order(when, this)
  this.orders.push(order);
  return order;
}

function Node(i, counter) {
  this.id = i;
  this.counter = counter;
}

function Path(counters) {  // 0: kitchen, NT +1: checkstand
  this.nodes = [];
  for(var i = 0; i < counters.length; i ++) {
    var node = new Node(i, counters[i])
    this.nodes.push(node);
    counters[i].node = node;
  }
}

// types: take_order, put_order, take_dish, put_dish, take_scrap, put_scrap, checkout
function Task(counter, order, type, when, todos) {
  this.counter = counter;  // where the task should be done
  this.order = order;
  this.type = type;
  this.when = when;  // when this task is requested
  this.who = undefined;  // for future extension to multi-agent model
  this.list = todos;  // in which list this task is included
}

Task.prototype.start = function(when, who) {
  this.who = who;
  this.list.remove_task(this);  // remove it from task list
  this.counter.change_state(when, "addressed");
  if(this.type != "checkout") {
    this.order.change_state(when, "addressed");
  }
  if(this.type == "checkout" || this.type == "take_dish") {
    this.counter.remove_order(this.order);
  }
}

Task.prototype.complete = function(when) {
  if(this.type == "take_order") {
    this.counter.change_state(when, "waiting");
    this.order.change_state(when, "carried");
    this.who.put_orders.add_task(new Task(this.who.model.kitchen, this.order, "put_order", when, this.who.put_orders));
  } else if(this.type == "put_order") {
    if(this.counter.orders.length > 0) {  // there are ready dishes at kitchen
      this.counter.change_state(when, "waiting");
    } else {
      this.counter.change_state(when, "vacant");
    }
    this.order.change_state(when, "cooked");
  } else if(this.type == "take_dish") {
    if(this.counter.orders.length > 0) {  // there are ready dishes at kitchen
      this.counter.change_state(when, "waiting");
    } else {
      this.counter.change_state(when, "vacant");
    }
    this.order.change_state(when, "delivered");
    this.who.put_dishes.add_task(new Task(this.order.table, this.order, "put_dish", when, this.who.put_dishes));
  } else if(this.type == "put_dish") {
    this.counter.change_state(when, "eating");
    this.order.change_state(when, "eaten");
  } else if(this.type == "take_scrap") {
    this.counter.change_state(when, "vacant");
    this.order.change_state(when, "bassed");
    this.who.put_scraps.add_task(new Task(this.who.model.kitchen, this.order, "put_scrap", when, this.who.put_scraps));
  } else if(this.type == "put_scrap") {
    if(this.counter.orders.length > 0) {  // there are ready dishes at kitchen
      this.counter.change_state(when, "waiting");
    } else {
      this.counter.change_state(when, "vacant");
    }
    this.order.change_state(when, "vanished");
  } else if(this.type == "checkout") {
    if(this.counter.orders.length > 0) {  // checkstand queue is not empty
      this.counter.change_state(when, "waiting");
    } else {
      this.counter.change_state(when, "vacant");
    }
    this.order.when_payed = when;
  }
}

function Todo() {  // task list
  this.tasks = [];
}

Todo.prototype.add_task = function(task) {
  for(var i = 0; i < this.tasks.length; i ++) {
    if(this.tasks[i].when > task.when) {
      this.tasks.splice(i, 0, task);
      return;
    }
  }
  this.tasks.push(task);
}

Todo.prototype.remove_task = function(task) {
  var index = this.tasks.indexOf(task);
  this.tasks.splice(index, 1);
}

function Clerk(model, loc) {
  this.model = model;
  this.location = loc;  // node
  this.state = undefined;  // state: standby, moving, working
  this.primary_task = undefined;  // task
  this.destination = undefined;  // node
  this.put_orders = new Todo();  // orders taken and still held
  this.put_dishes = new Todo();  // dishes on the tray
  this.put_scraps = new Todo();  // scraps on the tray
  this.dishes_ready = new Todo();  // cooked dishes at kitchen
  this.checkouts = new Todo();  // checkstand queue
  this.table_tasks = new Todo();  // may be further divided
  this.stateLog = []
}

Clerk.prototype.change_state = function(when, to) {
  this.state = to;
  this.stateLog.push({
    when: when,
    where: this.location,
    state: to
  });
}

Clerk.prototype.choose_next_node = function() {  // one step forward
  var where = this.location.id +Math.sign(this.destination.id -this.location.id)
  return this.model.path.nodes[where]
}

Clerk.prototype.set_destination = function() {  // this may be refined
  if(this.put_dishes.tasks.length > 0) {
    this.primary_task = this.put_dishes.tasks[0];
  } else if(this.put_scraps.tasks.length > 0) {
    this.primary_task = this.put_scraps.tasks[0];
  } else if(this.put_orders.tasks.length > 0) {
    this.primary_task = this.put_orders.tasks[0];
  } else {
    this.primary_task = undefined;
    var when_requested = this.model.par.HRZ;
    if(this.checkouts.tasks.length > 0 && this.checkouts.tasks[0].when < when_requested) {
      this.primary_task = this.checkouts.tasks[0]
      when_requested = this.primary_task.when;
    }
    if(this.dishes_ready.tasks.length > 0 && this.dishes_ready.tasks[0].when < when_requested) {
      this.primary_task = this.dishes_ready.tasks[0]
      when_requested = this.primary_task.when;
    }
    if(this.table_tasks.tasks.length > 0 && this.table_tasks.tasks[0].when < when_requested) {
      this.primary_task = this.table_tasks.tasks[0]
      when_requested = this.primary_task.when;
    }
  }
  if(this.primary_task == undefined) {
    this.destination = undefined;
  } else {
    this.destination = this.primary_task.counter.node;
  }
}

Clerk.prototype.choose_task = function() {  // this should be refined
  return undefined;
}

// simulation model
function Model() {
  this.par = {
    NT: 5,  // number of tables
    AT: 1,  // time for addressing a task
    WT: 0.1,  // time for walking between tables
    CAP: 3,  // maximum number of dishes held on a tray
    MTR: 3,  // mean time for getting ready to order
    MTC: 10,  // mean time for cooking
    MTE: 30,  // mean time for eating
    SDR: 1,  // standard deviation of the time for getting ready
    SDC: 3,  // standard deviation of the time for cooking
    SDE: 9,  // standard deviation of the time for eating
    HRZ: 350,  // horizon of simulation
  };
  this.kitchen = new Counter("kitchen");
  this.tables = [];
  for(var i = 1; i <= this.par.NT; i ++) {
    this.tables.push(new Counter("table" +i));
  }
  this.checkstand = new Counter("checkstand");
  this.path = new Path([this.kitchen].concat(this.tables).concat([this.checkstand]));
  this.clerk = new Clerk(this, this.kitchen.node);
  this.calendar = new Calendar([
    {time: 0, type: "arrive", at: this.kitchen.node},  // ready to start from the kitchen
    {time: this.par.HRZ, type: "over"}  // the end of simulation
  ]);
  for(var table of this.tables) {
    this.calendar.extend({
      time: tnorm_rand(this.par.MTR, this.par.SDR),
      type: "create_order",
      table: table
    });
  }
}

Model.prototype.update = function() {
  var e = this.calendar.fire();  // e: the next event
  if(e.type != "arrive" && this.clerk.state == "standby") {  // standby clerk is activated when something happens
    this.calendar.extend({
      time: e.time,
      type: "arrive",
      at: this.clerk.location
    });
  }
  if(e.type == "over") {  // simulation is over
    noLoop();
  } else if(e.type == "create_order") {  // a customer has chosen a menu to order
    var o = e.table.create_order(e.time);
    this.clerk.table_tasks.add_task(new Task(e.table, o, "take_order", e.time, this.clerk.table_tasks));
  } else if(e.type == "arrive") {  // the clerk has arrived at a node
    this.clerk.location = e.at;
    if(this.clerk.destination == undefined) {
      this.clerk.set_destination();
      if(this.clerk.destination == undefined) {  // no place to go
        this.clerk.change_state(e.time, "standby");  // wait here for a moment
      } else {
        this.calendar.extend({  // arrive at the same node and the same time
          time: e.time,
          type: "arrive",
          at: e.at
        });
      }
    } else {
      if(this.clerk.destination == this.clerk.location) {
        var do_it = this.clerk.primary_task;
      } else {
        var do_it = this.clerk.choose_task();
      }
      if(do_it == undefined) {
        this.clerk.change_state(e.time, "moving");  // move to the next node
        this.calendar.extend({
          time: e.time +this.par.WT,
          type: "arrive",
          at: this.clerk.choose_next_node()
        });
      } else {
        this.clerk.change_state(e.time, "working");  // carry out a task
        do_it.start(e.time, this.clerk);
        this.calendar.extend({
          time: e.time +this.par.AT,
          type: "complete_task",
          at: do_it.counter.node,
          task: do_it
        });
      }
    }
  } else if(e.type == "complete_task") {  // the clerk has finished a task
    e.task.complete(e.time);
    this.calendar.extend({  // arrive at the same node and the same time
      time: e.time,
      type: "arrive",
      at: e.at
    });
    if(e.task == this.clerk.primary_task) {
      this.clerk.primary_task = undefined;
      this.clerk.destination = undefined;
    }
  } else if(e.type == "finish_cooking") {  // a dish has been cooked ready
    this.clerk.dishes_ready.add_task(new Task(this.kitchen, e.order, "take_dish", e.time, this.clerk.dishes_ready));
    this.kitchen.change_state(e.time, "waiting");
    this.kitchen.orders.push(e.order);
  } else if(e.type == "eat_up") {  // a customer finishes eating
    this.clerk.table_tasks.add_task(new Task(e.order.table, e.order, "take_scrap", e.time, this.clerk.table_tasks));
    this.clerk.checkouts.add_task(new Task(this.checkstand, e.order, "checkout", e.time, this.clerk.checkouts));
    e.table.change_state(e.time, "left");
    this.checkstand.change_state(e.time, "waiting");
    this.checkstand.orders.push(e.order);
  }
}

// codes for visualization

Model.prototype.show = function() {
  var my_ratio = width /800;
  push();
  scale(my_ratio);
  textAlign(CENTER, CENTER);
  textSize(18);
  line(0, 325, 800, 325);
  translate(100, 150);
  this.path.show();
  this.clerk.show();
  translate(-50, 600);
  this.show_chart();
  pop();
}

Path.prototype.show = function() {
  line(0, 0, 600, 0);
  for(var i = 0; i < this.nodes.length; i ++) {
    push();
    if(i == 0 || i == this.nodes.length -1) {
      var offset = -60;
    } else {
      var offset = 60;
    }
    translate(100 *i, 0);
    line(0, 0, 0, offset);
    ellipseMode(CENTER);
    fill(0);
    ellipse(0, 0, 5, 5);
    translate(0, offset);
    this.nodes[i].counter.show();
    text(this.nodes[i].counter.name, 0, offset *3 /4);
    pop();
  }
}

Counter.prototype.show = function() {
  push();
  if(this.state == "vacant") {
    fill(255);
  } else if(this.state == "addressed") {
    fill(0, 0, 255);
  } else if(this.state == "eating") {
    fill(0, 255, 0);
  } else if(this.state == "left") {
    fill(0);
  } else if(this.state == "waiting") {
    colorMode(HSB);
    fill(0, (frameCount/20 -this.when) *5, 255);
  }
  rectMode(CENTER);
  rect(0, 0, 60, 60);
  pop();
}

Clerk.prototype.show = function() {
  push();
  translate(this.location.id *100, 0);
  ellipseMode(CENTER);
  fill(0, 0, 255);
  ellipse(0, 0, 20, 20);
  pop();
}

Model.prototype.show_chart = function() {
  for(var i = 0; i < 4; i ++) {  // time
    text(i *100, i *200, 20);
  }
  text("time", 700, 20);
  text("kit.", -20, 0 -350);  // kitcthen
  for(var i = 1; i <= 5; i ++) {  // tables
    text("tab"+i, -25, i *40 -350);
  }
  text("che.", -20, 6 *40 -350);  // checkstand
  text("work", -25, 7 *40 -350);  // clerk is working
  text("move", -25, 8 *40 -350);  // clerk is moving
  for(var i = 0; i < this.path.nodes.length; i ++) {
    push();
    translate(0, i *40 -350);
    this.path.nodes[i].counter.show_in_chart();
    pop();
  }
  push();
  translate(0, -70);
  this.clerk.show_in_chart("working");
  translate(0, 40);
  this.clerk.show_in_chart("moving");
  pop();
  stroke(255, 0, 0);
  line(frameCount/20 *2, 0, frameCount/20 *2, -380);
  stroke(0);
  line(0, 0, 700, 0);  // x axis
  line(0, 0, 0, -380);  // y axis
}

Counter.prototype.show_in_chart = function() {
  for(var i = 0; i < this.stateLog.length; i ++) {
    push();
    var x = this.stateLog[i].when *2;
    if(i == this.stateLog.length -1) {
      var w = (frameCount/20 -this.stateLog[i].when) *2;
    } else {
      var w = (this.stateLog[i +1].when -this.stateLog[i].when) *2;
    }
    if(this.stateLog[i].state == "vacant") {
      fill(255);
    } else if(this.stateLog[i].state == "addressed") {
      fill(0, 0, 255);
    } else if(this.stateLog[i].state == "waiting") {
      fill(255, 0, 0);
    } else if(this.stateLog[i].state == "eating") {
      fill(0, 255, 0);
    } else if(this.stateLog[i].state == "left") {
      fill(0);
    }
    strokeWeight(0);
    rect(x, -10, w, 20);
    pop();
  }
}

Clerk.prototype.show_in_chart = function(state) {
  for(var i = 0; i < this.stateLog.length; i ++) {
    push();
    var x = this.stateLog[i].when *2;
    if(i == this.stateLog.length -1) {
      var w = (frameCount/20 -this.stateLog[i].when) *2;
    } else {
      var w = (this.stateLog[i +1].when -this.stateLog[i].when) *2;
    }
    if(this.stateLog[i].state == state) {
      strokeWeight(0);
      fill(0, 0 ,255);
      rect(x, -10, w, 20);
    }
    pop();
  }
}
