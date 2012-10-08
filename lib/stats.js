var gd = require('./graphdat');
var sync = require('./sync');

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
	sync.add('samples', sample);
  }
}
