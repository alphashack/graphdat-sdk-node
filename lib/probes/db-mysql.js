var gd = require('../graphdat'),
	proxy = require('../proxy'),
	stats = require('../stats');

module.exports = function(obj) {
	if(!gd.enabled) return;

	proxy.before(obj.Database.prototype, 'connect', function(obj, args) {

        proxy.after(obj, 'query', function(obj, args, ret) {
            var time = stats.time();

            proxy.before(ret, 'execute', function(obj, args) {
                var callbackArg = 0;
                for(var i = 0; i < args.length; i++) {
                    if(typeof args[i] === 'function') callbackArg = i;
                }

                proxy.callback(args, callbackArg, function(obj, args) {
                    if(!time.measure()) return;

                    var command = obj.sql();
                    var error = (args && args.length > 0) ? (args[0] ? args[0].message : undefined) : undefined;

                    var obj = {'Type': 'Db-MySQL',
                        'Command': command,
                        'Error': error};

                    stats.sample(time, obj, 'Db-MySQL: ' + obj['Command']);
                });
            });
        });
    });
};
