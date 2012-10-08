var proxy = require('../proxy'),
    stats = require('../stats'),
    gd = require('../graphdat'),
    context = require('../context');

module.exports = function(obj) {
    // server probe
    proxy.before(obj.Server.prototype, ['on', 'addListener'], function(obj, args) {
        if(args[0] !== 'request') return;

        proxy.callback(args, -1, function(obj, args) {
            var req = args[0];
            var res = args[1];

            req.graphdat = {
                context: new context(
                    function() {
                        return {time: stats.time(true)};
                    },
                    function(data) {
                        data.measureOk = data.time.measure();
                    }
                ),
                begin: function(name) {
                    if(gd.gdSync.debug && gd.gdSync.debug.http_begin) gd.gdLog(gd.logType.Info, 'begin %s', name);
                    req.graphdat.context.enter(
                        name,
                        function() {
                            return {time: stats.time(true)};
                        },
                        function(data) {
                            data.measureOk = data.time.measure();
                        }
                    );
                },
                end: function(name) {
                    var data = req.graphdat.context.leave(name);
                    if(gd.gdSync.debug && gd.gdSync.debug.http_end) gd.gdLog(gd.logType.Info, 'end %s (%dms)', name, data.time.ms);
                },
	            trace: function(callback) {
		            if(gd.gdSync.debug && gd.gdSync.debug.http_trace) gd.gdLog(gd.logType.Info, 'trace in');
		            callback.graphdat = req.graphdat;
		            return callback;
	            },
	            endoncall: function(callback, name) {
		            var newCallback = function() {
			            req.graphdat.end(name);
			            callback.apply(this, arguments);
		            };
		            if(callback.graphdat)
		                newCallback.graphdat = callback.graphdat;
		            return newCallback;
	            }
            };

            proxy.after(res, 'end', function(obj, args) {
                var rootContext;
                if(!req.graphdat.context.validate()) {
                    if(!gd.gdSync.suppress || !gd.gdSync.suppress.context_pop_automatic) gd.gdLog(gd.logType.Warning, 'popping context automatically, you have not ended each context you created, this might be an error (you can suppress this warning: context_pop_automatic)');
                    rootContext = req.graphdat.context.exit();
                }
                else {
                    rootContext = req.graphdat.context.done();
                }
                var context = req.graphdat.context.flatten(
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
                    stats.sample(
                        rootContext.time,
                        {
                            'Type': 'HTTP',
                            'Method': req.method,
                            'URL': req.url,
                            'Request headers': req.headers,
                            'Status code': res.statusCode,
                            'Context': context
                        },
                        req.url
                    );
                }

            });
        });
    });

    // client error probe
    proxy.after(obj, 'request', function(obj, args, ret) {
        var time = undefined;
        var opts = args[0];

        proxy.before(ret, 'end', function(obj, args) {
            time = opts.__time__ = !opts.__time__ ? stats.time() : undefined;
        });

        proxy.before(ret, ['on', 'addListener'], function(obj, args) {
            if(args[0] !== 'error') return;

            proxy.callback(args, -1, function(obj, args) {
                if(!time || !time.measure()) return;

                var error = (args && args.length > 0) ? (args[0] ? args[0].message : undefined) : undefined;

                var obj = {'Type': 'HTTP',
                    'Method': opts.method,
                    'URL': (opts.hostname || opts.host) + (opts.port ? ':' + opts.port : '') + (opts.path || '/'),
                    'Request headers': opts.headers,
                    'Error': error};
                stats.sample(time, obj, 'HTTP Client: ' + obj.URL);
            });
        });
    });


    // client probe
    proxy.before(obj, 'request', function(obj, args) {
        var opts = args[0];

        proxy.callback(args, -1, function(obj, args) {
            var res = args[0];
            proxy.before(res, ['on', 'addListener'], function(obj, args) {
                if(args[0] !== 'end') return;

                proxy.callback(args, -1, function(obj, args) {
                    var time = opts.__time__;
                    if(!time || !time.measure()) return;

                    var obj = {'Type': 'HTTP',
                        'Method': opts.method,
                        'URL': (opts.hostname || opts.host) + (opts.port ? ':' + opts.port : '') + (opts.path || '/'),
                        'Request headers': opts.headers,
                        'Response headers': res.headers,
                        'Status code': res.statusCode
                    }
                    stats.sample(time, obj, 'HTTP Client: ' + obj.URL);
                });
            });
        });
    });
};


