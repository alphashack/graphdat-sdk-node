if(global._graphdat) return global._graphdat;

var fs = require('fs'),
	util = require('util'),
	path = require('path'),
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
	this.version = '0.4.1';
	this.logType = logType;
};

exports = module.exports = global._graphdat = new Graphdat();

var start = function() {
	var gd = global._graphdat;

	gd.enabled = true;
	gd.debug = false;
	gd.disabledProbes = {};
	gd.options = {};
	gd.socketFile = process.platform !== 'win32' ? '/tmp/gd.agent.sock' : undefined;
	gd.socketHost = 'localhost';
	gd.socketPort = '26873';
	gd.socketDesc = gd.socketFile ? gd.socketFile : gd.socketHost + ':' + gd.socketPort;

	setupLogger();

	// trying to load timekit
	try { timekit = require('timekit'); } catch(err) { gd.error(err) }

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

		if(probes[args[0]] && !gd.disabledProbes[args[0]]) {
			ret.__required__ = true;
			require('./probes/' + args[0])(ret);
		}
	});
};

var setupLogger = function() {
	var gd = global._graphdat;

	// default logger switches between console loggers (unless external is defined)
	if(typeof gd.gdLogger != 'function') {
		gd.gdLogger = function(logType, message/*[,object]*/) {
			var fun = logFunctions[logType] ? logFunctions[logType] : logFunctions.Log;
			var args = Array.prototype.slice.apply(arguments, [ 1 ]);
			fun.apply(gd, args);
		}
	}

	// internal logger to wrap message
	gd.gdLog = function(logType, message/*[,object]*/) {
		message = 'Graphdat ' + logType + (message ? ': ' + message : '');
		var args = Array.prototype.slice.apply(arguments);
		gd.gdLogger.apply(gd, args);
	}
}

var optionsReport = function() {
	var gd = global._graphdat;

	gd.gdLog(gd.logType.Info, 'Graphdat is %s', gd.enabled ? 'enabled' : 'disabled');
	if(gd.debug) gd.gdLog(gd.logType.Info, 'Graphdat is in debug mode');
	if(gd.enabled || gd.debug) {
		gd.gdLog(gd.logType.Info, 'Will send to agent on %s', gd.socketDesc);
	}
}

Graphdat.prototype.config = function(opt) {
	if(typeof opt !== 'undefined') {
		this.options = opt;
		if(typeof opt.enabled !== 'undefined') {
			this.enabled = !!opt.enabled;
		}
		if(typeof opt.debug !== 'undefined') {
			this.debug = opt.debug;
		}
		if(typeof opt.disabledProbes !== 'undefined') {
			this.disabledProbes = opt.disabledProbes;
		}
		if(typeof opt.logger !== 'undefined') {
			this.gdLogger = opt.logger;
			setupLogger();
		}
		if(process.platform == 'win32') {
			if(typeof opt.port !== 'undefined') {
				this.socketPort = opt.port;
			}
		}
		else {
			if(typeof opt.socketFile !== 'undefined') {
				this.socketFile = opt.socketFile;
			}
		}
	}
	optionsReport();
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
    if(this.debug && msg) this.gdLog(this.logType.Log, msg);
};

Graphdat.prototype.error = function(e) {
    if(e) {
		if(e.stack) {
			this.gdLog(this.logType.Error, e, e.stack);
		}
		else {
			this.gdLog(this.logType.Error, e);
		}
	}
};

Graphdat.prototype.dump = function(obj) {
    if(this.debug) this.gdLog(this.logType.Info, util.inspect(obj, false, 10, true));
};

start();
