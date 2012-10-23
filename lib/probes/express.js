var gd = require('../graphdat');

module.exports = function(obj) {
	gd.express = {
		getRoutePath: function(req) {
			if(req.route && req.route.path)
				return req.route.path;
			return req.url;
		}
	}
}
