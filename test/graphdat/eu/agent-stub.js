var _net = require('net');
var _fs = require('fs');
var _util = require('util');
var _events = require('events');
var _gd = require('../../../lib/graphdat.js');
var _msgpack = require('../../../lib/msgpack.js');

module.exports = SockServer;

function SockServer()
{
	var _self = this;
	
	_events.EventEmitter.call(this);
	
	var _buff;
	var _expecting;

	var _server = _net.createServer(function (c)
	{
		//console.log('Got connect->');
		
		c.on('end', function ()
		{
			_buff = null;
			_expecting = 0;
			
			_self.emit('disconnect');
		});
		c.on('data', function (buf)
		{
			if (!_buff)
				_buff = buf;
			else
				_buff = Buffer.concat([_buff, buf]);
			
			while(drain());
		});
		c.on('error', function(err)
		{
			console.error(err);	
		});
	});
	
	_server.on('error', function(err)
	{
		console.log('err %j', err);	
	});
	
	// Kill socket file if it is in use
	if (_fs.existsSync(_gd.socketFile))
		_fs.unlink(_gd.socketFile);
	
	_server.listen(_gd.socketFile, function ()
	{ 
		_self.emit('bound');
	});

	process.on('SIGTERM', closeServer);
	process.on('SIGINT', closeServer);
	process.on('SIGKILL', closeServer);
	process.on('exit', closeServer);
	process.on('uncaughtException', handleUncaught);


	this.stop = closeServer;

	// Returns true if msg found, false if not
	function drain()
	{
		if (!_expecting)
		{
			if (_buff.length < 4)
				return false;

			_expecting = (_buff[0] << 24) + (_buff[1] << 16) + (_buff[2] << 8) + (_buff[3]);

			_buff = _buff.slice(4);
		}

		if (_buff.length < _expecting)
			return false;

		var msg = _buff.slice(0,_expecting);

		_buff = _buff.slice(_expecting);

		var json = _msgpack.decode(msg);

		_self.emit('data', json);

		return true;
	}

	function handleUncaught(err)
	{
		
		console.log('Uncaught exception:\n%s', err.stack);
		closeServer();
	}
	function closeServer(cb)
	{
		process.removeListener('SIGTERM', closeServer);
		process.removeListener('SIGINT', closeServer);
		process.removeListener('SIGKILL', closeServer);
		process.removeListener('exit', closeServer);
		process.removeListener('uncaughtException', closeServer);

		if (_server)
		{
			//console.log('closing server');
			
			_server.close(cb);
			_server = null;
		}
		else if (cb)
			cb();
	}
}

_util.inherits(SockServer, _events.EventEmitter);
