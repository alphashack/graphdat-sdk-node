var gd = require('./graphdat'),
	stats = require('./stats'),
	context = require('./context');

var timedContext = function() {
	if(!(this instanceof timedContext)) return new timedContext();

	this._context = new context(
		function() {
			return {time: stats.time(true)};
		},
		function(data) {
			data.measureOk = data.time.measure();
		});
};

timedContext.prototype = {
	begin: function(name) {
		if(gd.debug && gd.debug.context_begin) gd.gdLog(gd.logType.Info, 'begin %s', name);
		this._context.enter(name);
	},
	end: function(name) {
		var data = this._context.leave(name);
		if(gd.debug && gd.debug.context_end) gd.gdLog(gd.logType.Info, 'end %s (%dms)', name, data.time.ms);
	},
	trace: function(callback) {
		if(gd.debug && gd.debug.context_trace) gd.gdLog(gd.logType.Info, 'trace in');
		callback.graphdat = this;
		return callback;
	},
	endoncall: function(callback, name) {
		var newCallback = function() {
			this._context.end(name);
			callback.apply(this, arguments);
		};
		if(callback.graphdat)
			newCallback.graphdat = callback.graphdat;
		return newCallback;
	},
	exit: function(dataFunc, labelFunc) {
		var rootContext;
		if(!this._context.validate()) {
			if(!gd.options.suppress || !gd.options.suppress.context_pop_automatic) gd.gdLog(gd.logType.Warning, 'popping context automatically, you have not ended each context you created, this might be an error (you can suppress this warning: context_pop_automatic)');
			rootContext = this._context.exit();
		}
		else {
			rootContext = this._context.done();
		}
		var context = this._context.flatten(
			function(data) {
				if(data.measureOk) {
					return {
						timestamp: data.time.timestamp,
						responsetime:data.time.ms,
						cputime: data.time.cpuTime
					}
				}
				return {};
			}
		);
		if(rootContext.measureOk) {
			var data = dataFunc();
			data.Context = context;
			var label = labelFunc();
			stats.sample(rootContext.time, data, label);
		}
	}
};

module.exports = timedContext;
