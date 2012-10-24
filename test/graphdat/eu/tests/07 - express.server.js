require('graphdat');

var express = require('express'),
	app = express();

var registerRoutes = function(app) {
	app.get("/fun/:id", function (req, res) {
		req.graphdat.begin("fun");

		res.send({
			         success: true
		         });
	});
}

registerRoutes(app);

app.listen(1337, function() {
	console.log('Server running at http://127.0.0.1:1337/');
});
