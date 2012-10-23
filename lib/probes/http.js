var proxy = require('../proxy'),
    gd = require('../graphdat'),
	timedContext = require('../timedContext');

module.exports = function(obj) {
	if(!gd.enabled) return;

    // server probe
    proxy.before(obj.Server.prototype, ['on', 'addListener'], function(obj, args) {
        if(args[0] !== 'request') return;

        proxy.callback(args, -1, function(obj, args) {
            var req = args[0];
            var res = args[1];

            req.graphdat = res.graphdat = new timedContext();
			req.gdcall = res.gdcall = req.graphdat.createCallShortcut();

            proxy.after(res, 'end', function(obj, args) {
	            var url = gd.express ? gd.express.getRoutePath(req) : req.url;
	            req.graphdat.exit(
		            function() {
			            return {
							'Type': 'HTTP',
							'Method': req.method,
							'URL': url,
							'Request headers': req.headers,
							'Status code': res.statusCode
						};
					},
					function() {
						return req.url;
					});
            });
        });
    });
};
