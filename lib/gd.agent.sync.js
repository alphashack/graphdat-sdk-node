var net = require('net'),
    gd = require('./graphdat'),
    msgpack = require('./msgpack');

var pid = process.pid.toString();
var _socket = null;
var _lastWasError = false;
var _waiting = [];
var _lastHeartbeat = new Date();

function shouldReportError() {
	var report = !_lastWasError || !!gd.debug;
	_lastWasError = true;
	return report;
}

function connect(cb) {
    if(!gd.enabled)
	    return cb('Not connected. Graphdat was disabled by a config setting');

	var connectFunction = function() {
		gd.gdLog(gd.logType.Info, 'gd.agent.sync: connected (%s)', gd.socketDesc);
		cb(null, connection);
	};
	var connection;
	if(gd.socketFile) {
		connection = net.createConnection(gd.socketFile, connectFunction);
	}
	else {
	    connection = net.createConnection(gd.socketPort, gd.socketHost, connectFunction);
	}
	connection.on('error', function(err) {
		_socket = null;
		if(shouldReportError())
			gd.gdLog(gd.logType.Error, 'gd.agent.sync: connection failed (%s): ', gd.socketDesc, err);
		cb(err);
	});
}

function getSocket(cb) {
	if(_socket)
		return cb(null, _socket);

	_waiting.push(cb);

	if(_waiting.length > 1)
		return;

	connect(function(err, socket) {
		_socket = socket;

		_waiting.forEach(function(waitingcb) {
			waitingcb(err, _socket);
		});
		_waiting = [];
	});
}

function write(item) {
    getSocket(function(err, socket) {
	    if(err) {
		    if(shouldReportError())
			    gd.gdLog(gd.logType.Error, 'gd.agent.sync error: ', err);
		    return;
	    }

	    var msg = msgpack.encode(item);
	    var length = msg.length;

	    var bytes = new Array(4)
	    bytes[0] = length >> 24
	    bytes[1] = length >> 16
	    bytes[2] = length >> 8
	    bytes[3] = length

	    try {
		    socket.write(new Buffer(bytes));
		    if(gd.debug && gd.debug.sync_write) {
			    socket.write(msg, function() { gd.gdLog(gd.logType.Info, 'gd.agent.sync: Data sent to agent: %s', JSON.stringify(item))});
		    }
		    else {
			    socket.write(msg);
		    }
	    }
	    catch(ex) {
		    gd.gdLog(gd.logType.Error, 'gd.agent.sync exception: ', ex);
		    _socket = null;
	    }
    });
}

function writeHeartbeat() {
	getSocket(function(err, socket) {
		if(err) {
			if(shouldReportError())
				gd.gdLog(gd.logType.Error, 'gd.agent.sync error: ', err);
			return;
		}

		var length = 0;

		var bytes = new Array(4)
		bytes[0] = length >> 24
		bytes[1] = length >> 16
		bytes[2] = length >> 8
		bytes[3] = length

		try {
			var buff = new Buffer(bytes);
			if(gd.debug && gd.debug.heartbeat) {
				socket.write(buff, function() { gd.gdLog(gd.logType.Info, 'gd.agent.sync: Heartbeat')});
			}
			else {
				socket.write(buff);
			}
		}
		catch(ex) {
			gd.gdLog(gd.logType.Error, 'gd.agent.sync exception: ', ex);
			_socket = null;
		}
	});
}

function heartbeat(hasSentData) {
	var now = new Date();

	if(!hasSentData && now - _lastHeartbeat > 30000) {
		writeHeartbeat();
		hasSentData = true;
	}

	if(hasSentData)
		_lastHeartbeat = now;
}

exports.push = function(options, payload) {
    if(payload.samples) {
        payload.samples.forEach(function(sample) {
            if(sample.Type === 'HTTP') {
                var item = {
                    type: 'Sample',
                    source: sample.Type,
                    route: sample.Method + ' ' + sample.URL,
                    responsetime: sample._ms,
                    timestamp: sample._ts,
                    cputime: sample['CPU time (ms)'],
                    pid: pid,
                    context: sample.Context
                };
	            write(item);
            }
        });
	    heartbeat(true);
    }
};


if(!gd.heartbeatIntervalId) {
	gd.heartbeatIntervalId = setInterval(function() {
		try {
			heartbeat();
		}
		catch(e) {
			gd.error(e);
		}
	}, 10000);
}
