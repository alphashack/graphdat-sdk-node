var gd = require('./graphdat');
var sync = require('./sync');

if(!gd.values) {
  gd.state = {};
  gd.values = {};
  gd.samples = {root: [], related: []};
  gd.rpm = {last: 0, current: 0};
}

function Time(root) {
  this.root = root;

  this.begin = gd.micros();
  this.end = undefined;
  this.ms = undefined;

  this.cpuTime = root ? gd.cputime() : null;
};

Time.prototype.measure = function() {
  if(this.end) return false;

  this.end = gd.micros();
  this.ms = (this.end - this.begin) / 1000;
  this.begin = this.begin / 1000;
  this.end = this.end / 1000;

  if(this.cpuTime != null) this.cpuTime = (gd.cputime() - this.cpuTime) / 1000;

  return true;
};

exports.time = function(root) {
  return new Time(root);
};

exports.truncate = function(args) {
  if(!args) return undefined;

  if(typeof args === 'string') {
    return (args.length > 80 ? (args.substr(0, 80) + '...') : args);
  }

  var arr = [];
  var argsLen = (args.length > 10 ? 10 : args.length);
  for(var i = 0; i < argsLen; i++) {
    if(typeof args[i] === 'function') continue;
    if(typeof args[i] === 'string' && args[i].length > 80) {
      arr.push(args[i].substr(0, 80) + '...');
    }
    else {
      arr.push(args[i]);
    }
  }

  if(argsLen < args.length) arr.push('...');

  return arr;
};

exports.production = function() {
  return (gd.rpm.last > 10 || gd.rpm.current > 10);
};

exports.state = function(scope, name, value, unit) {
  if(!gd.state[scope]) gd.state[scope] = {};
  gd.state[scope][name + (unit ? ' (' + unit + ')' : '')] = value;
};

exports.value = function(scope, name, value, unit, op, context) {
  if(typeof context === 'undefined') context = "_root";
  var key = scope + ':' + name + ":" + context;
  if(!gd.values[key]) {
    gd.values[key] = {
      scope: scope,
      name: name,
      context: context,
      unit: unit,
      op: op,
      _sum: value,
      _count: 1
    };
  }
  else {
    gd.values[key]._sum += value;
    gd.values[key]._count++;
  }
};

exports.sample = function(time, sample, label) {
  sample._root = time.root;
  sample._begin = time.begin;
  sample._end = time.end;
  sample._ms = time.ms;
  sample._ts = time.begin;

  if(label && label.length > 80) label = label.substring(0, 80) + '...';
  sample._label = label;

  sample['Response time (ms)'] = sample._ms;
  sample['Timestamp (ms)'] = sample._ts;

  if(time.cpuTime) sample['CPU time (ms)'] = time.cpuTime;


  if(sample._root) {
    gd.rpm.current++;
    if(!exports.production()) {
      sync.add('samples', sample);
    }
    else {
      gd.samples.root.push(sample);
    }
  }
}

var send = function() {
  // sending values
  for (var key in gd.values) {
    var obj = gd.values[key];

    if(obj.op === 'sum') {
      sync.add('values', {scope: obj.scope, name: obj.name, context: obj.context, value: obj._sum, unit: obj.unit, op: obj.op, _ts: gd.millis()});
      if(obj.context === '_root') exports.state(obj.scope, obj.name, obj._sum, obj.unit);
    }
    else if(obj.op === 'avg') {
      var avg = Math.round(obj._sum / obj._count);
      sync.add('values', {scope: obj.scope, name: obj.name, context: obj.context, value: avg, unit: obj.unit, op: obj.op, _ts: gd.millis()});
      if(obj.context === '_root') exports.state(obj.scope, obj.name, avg, obj.unit);
    }
  }

  gd.values = {};

  // sending samples
  var slowest = gd.samples.root;
  slowest = slowest.sort(function(a, b) {
    return b._ms - a._ms;
  });

  for(var i = 0; i < (slowest.length < 10 ? slowest.length : 10); i++) {
    sync.add('samples', slowest[i]);
  }

  gd.samples.root = [];
  gd.samples.related = [];

  // rpm reset
  gd.rpm.last = gd.rpm.current;
  gd.rpm.current = 0;
};

if(!gd.statsIntervalId) {
  gd.statsIntervalId = setInterval(function() {
    try {
      send();
    }
    catch(e) {
      gd.error(e);
    }
  }, 800);
}
