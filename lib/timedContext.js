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
		},
		function(data1, data2) {
			data1.measureOk &= data2.measureOk;
			if(data1.measureOk) {
				data1.responseTimeSum += data2.responseTimeSum;
				data1.callCount += data2.callCount;
			}
			return data1;
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
			newCallback.graphdat._context.exit();
			newCallback.graphdat.returnToParent();
			callback.apply(this, arguments);
		};
		newCallback.graphdat = new timedContext();
		newCallback.gdcall = newCallback.graphdat.createCallShortcut();
		newCallback.graphdat.parentContext = this;
		return newCallback;
	},
	// call pattern
	//
	// ex:
	//		fun1(x,y,function(err) {});
	//
	//		function fun1(x,y,cb) { fun2(y,function(err) { cb(err); }); }
	//
	// We wish to time fun1 and then fun2 as a child of fun1.  Instrumentation:
	//
	//		req.graphdat.call(fun1, x, y, function(err) {});
	//
	//		function fun1(x,y,cb) { cb.graphdat.call(fun2,y,function(err) { cb(err); }); }
	//	
	// Pass function to call as first param, followed by arguments
	// Assumes last param is callback
	call:function(fnc)
	{
		if(gd.debug && gd.debug.context_trace) 
			gd.gdLog(gd.logType.Info, 'call in');

		var ctx = this;

		// Sanity check, no fnc or cb, just bail
		if (!fnc || arguments.length == 1)
			return;

		// Callback should be last
		var callback = arguments[arguments.length - 1];

		// Params to function follow after fnc
		var args = Array.prototype.slice.apply(arguments, [ 1 ]);
		
		// Hook the callback so we end the timer
		var newCallback = function()
		{
			// end the call
			ctx.end(fnc.name);
			
			// Call user supplied
			callback.apply(this, arguments);
		};
		
		// Set up a context on the callaback
		var ctxCallback = ctx.trace(newCallback);

		// Replace
		args[args.length-1] = ctxCallback;
		
		// Start the clock
		ctx.begin(fnc.name);
		
		// Call the function
		return fnc.apply(null, args);
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
						responsetime: data.responseTimeSum,
						callcount: data.callCount,
						cputime: data.time.cpuTime
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
	},

	// Creates a shortcut to graphdat.call with a closure
	createCallShortcut : function()
	{
		var ctx = this;
		
		return function()
		{
			ctx.call.apply(ctx, arguments);
		}
	}	
};

module.exports = timedContext;
