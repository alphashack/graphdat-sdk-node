require('graphdat');

var http = require('http');
http.createServer(function (req, res)
{
	req.graphdat.begin('timer');
	
	slowcall(function()
	{
		req.graphdat.end('timer');
		
		res.writeHead(200, {'Content-Type':'text/plain'});
		res.end('Hello World\n');
	}, 1000);
}).listen(1337, '127.0.0.1');
console.log('Server running at http://127.0.0.1:1337/');


function slowcall(cb)
{
	setTimeout(cb, 1000);
}