if(global._graphdat) return global._graphdat;

var fs = require('fs'),
	os = require('os'),
	util = require('util'),
	path = require('path'),
	events = require('events'),
	cluster = require('cluster'),
	timekit = undefined;

// The only log types we will use
var logType = {
    Log: 'Log',
    Info: 'Info',
    Warning: 'Warning',
    Error: 'Error'
};

// Mapping of log type to default console logger
var logFunctions = {
    Log: console.log,
    Info: console.info,
    Warning: console.warn,
    Error: console.error
};

var Graphdat = function() {
	this.version = '0.2.0';
	this.master = cluster.isMaster;

	this.logType = logType;

	events.EventEmitter.call(this);
};

util.inherits(Graphdat, events.EventEmitter);
exports = module.exports = global._graphdat = new Graphdat();

var start = function(self) {
	var opt = {gdSync: {}};
	self.debug = opt.debug;
	self.disabledProbes = typeof opt.disabledProbes === 'undefined' ? {} : opt.disabledProbes;
	self.gdSync = opt.gdSync;
	self.gdLogger = opt.gdSync ? opt.gdSync.logger : undefined;

	// default logger switches between console loggers (unless external is defined)
	if(typeof self.gdLogger != 'function') {
		self.gdLogger = function(logType, message/*[,object]*/) {
			var fun = logFunctions[logType] ? logFunctions[logType] : logFunctions.Log;
			var args = Array.prototype.slice.apply(arguments, [ 1 ]);
			fun.apply(self, args);
		}
	}

	// internal logger to wrap message
	self.gdLog = function(logType, message/*[,object]*/) {
		message = 'graphdat ' + logType + (message ? ': ' + message : '');
		var args = Array.prototype.slice.apply(arguments);
		self.gdLogger.apply(self, args);
	}

	// trying to load timekit
	try { timekit = require('timekit'); } catch(err) { self.error(err) }

	// preparing probes
	var probes = {};
	var files = fs.readdirSync(path.dirname(require.resolve('./graphdat')) + '/probes');
	files.forEach(function(file) {
		var m = file.match('^(.*)+\.js$');
		if(m && m.length == 2) probes[m[1]] = true;
	});

	var proxy = require('./proxy');
	proxy.after(module.__proto__, 'require', function(obj, args, ret) {
		if(ret.__required__) return;

		var builtin = true;
		if(!args[0].match(/^[^\/\\]+$/)) {
			builtin = false;
		}

		if(!builtin) {
			path.exists(args[0] + '.probe', function(exists) {
				if(exists) {
					ret.__required__ = true;
					require(args[0] + '.probe')(ret);
				}
			});
		}
		else if(probes[args[0]] && !self.disabledProbes[args[0]]) {
			ret.__required__ = true;
			require('./probes/' + args[0])(ret);
		}
	});

	// expose tools for non-builtin modules
	self.proxy = require('./proxy');
	self.stats = require('./stats');
	self.sync = require('./sync');
};

Graphdat.prototype.micros = function() {
    return timekit ? timekit.time() : new Date().getTime() * 1000;
};

Graphdat.prototype.millis = function() {
    return timekit ? timekit.time() / 1000 : new Date().getTime();
};

Graphdat.prototype.cputime = function() {
    return timekit ? timekit.cputime() : undefined;
};

Graphdat.prototype.log = function(msg) {
    if(this.debug && msg) console.log('Graphdat:', msg);
};

Graphdat.prototype.error = function(e) {
    if(this.debug && e) console.error('Graphdat error:', e, e.stack);
};

Graphdat.prototype.dump = function(obj) {
    if(this.debug) console.log(util.inspect(obj, false, 10, true));
};

start(global._graphdat);
