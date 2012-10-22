require('graphdat');

var http = require('http');

http.createServer(function (req, res)
{
	req.gdcall(fun1, function()
	{
		res.writeHead(200, {'Content-Type':'text/plain'});
		res.end('Hello World\n');

	});
}).listen(1337, '127.0.0.1');
console.log('Server running at http://127.0.0.1:1337/');

function fun1(cb)
{
	var c = 0;
	
	iterate();
	
	function iterate()
	{
		if (c++ == 10)
		{
			cb();
			return;
		}
		
		cb.gdcall(fun2, function()
		{
			process.nextTick(iterate);	
		});
	}
}

function fun2(cb)
{
	setTimeout(function()
	{
		cb();
	}, 100);
}