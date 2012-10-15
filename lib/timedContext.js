var gd = require('./graphdat'),
	stats = require('./stats'),
	context = require('./context');

// A context that tracks the time used in each block and sends to the agent on exit.
var timedContext = function() {
	if(!(this instanceof timedContext)) return new timedContext();

	// Begin the root block
	var initMillis = gd.millis();
	this._context = new context(
		function(data) {
			if(!data) data = {
				firstTimestampOffset: gd.millis() - initMillis,
				responseTimeSum: 0,
				callCount: 0
			};
			data.callCount++;
			data.measureOk = false;
			data.time = stats.time(true);
			return data;
		},
		function(data) {
			data.measureOk = data.time.measure();
			if(data.measureOk) {
				data.responseTimeSum += data.time.ms;
			}
		});
};

timedContext.prototype = {
	// enter a block
	begin: function(name) {
		if(gd.debug && gd.debug.context_begin) gd.gdLog(gd.logType.Info, 'begin %s', name);
		this._context.enter(name);
	},
	// leave a block
	end: function(name) {
		var data = this._context.leave(name);
		if(gd.debug && gd.debug.context_end) gd.gdLog(gd.logType.Info, 'end %s (%dms)', name, data.time.ms);
	},
	trace: function(callback) {
		if(gd.debug && gd.debug.context_trace) gd.gdLog(gd.logType.Info, 'trace in');
		var newCallback = function() {
			callback.apply(this, arguments);
			newCallback.graphdat._context.exit();
			newCallback.graphdat.returnToParent();
		}
		newCallback.graphdat = new timedContext();
		newCallback.graphdat.parentContext = this;
		return newCallback;
	},
	// leave a block when the callback is called
	endoncall: function(callback, name) {
		var newCallback = function() {
			this._context.end(name);
			callback.apply(this, arguments);
		};
		if(callback.graphdat)
			newCallback.graphdat = callback.graphdat;
		return newCallback;
	},
	// exit all blocks and send to agent
	exit: function(sampleFunc, labelFunc) {
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
						firsttimestampoffset: data.firstTimestampOffset,
						responsetimesum: data.responseTimeSum,
						callcount: data.callCount
					}
				}
				return {};
			}
		);
		if(rootContext.measureOk) {
			var sample = sampleFunc();
			sample.Context = context;
			var label = labelFunc();
			stats.sample(rootContext.time, sample, label);
		}
	},
	returnToParent: function() {
		this.parentContext._context.merge(this._context);
	}
};

module.exports = timedContext;
