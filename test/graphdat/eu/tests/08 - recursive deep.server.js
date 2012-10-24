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

	A();

	function A()
	{
		cb.graphdat.begin('A');

		B();
	}

	function B()
	{
		cb.graphdat.begin('B');

		C();
	}

	function C()
	{
		cb.graphdat.begin('C');

		if (++c >= 10)
		{
			cb();
			return;
		}

		A();
	}
}
