require('graphdat');

var http = require('http');
http.createServer(function (req, res)
{
	var x = 1;
	var y = 2;
	
	// delay
	res.gdcall(slowcall, x, y, function(err, sum)
	{
		if (err || sum != 3)
			console.error('invalid response from call');
		
		res.writeHead(200, {'Content-Type':'text/plain'});
		res.end('Hello World\n');
	});
	
}).listen(1337, '127.0.0.1');
console.log('Server running at http://127.0.0.1:1337/');

function slowcall(x,y,cb)
{
	setTimeout(function() {
		cb(null, x+y);
	}, 1000);
}
