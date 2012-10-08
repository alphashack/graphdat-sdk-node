var gd = require('./graphdat');
var sync = require('./gd.agent.sync');

if(!gd.payload) {
	gd.payload = {};
	gd.nextId = Math.round(Math.random() * Math.pow(10, 9));
}

function clone(source, depth) {
	if(!depth) depth = 0;
	if(depth > 20) return {};

	var target = {};

	for(var prop in source) {
		var val = source[prop];
		if(val == undefined || prop.match(/^_/)) continue;

		if(typeof val === 'string' || typeof val === 'number') {
			target[prop] = source[prop];
		}
		else if(typeof val === 'object') {
			target[prop] = clone(val, depth + 1);
		}
	}

	return target;
}

exports.add = function(type, obj) {
	obj._id = gd.nextId++;

	if(type === 'samples') {
		gd.emit('sample', clone(obj));
	}

	if(gd.payload[type]) {
		gd.payload[type].push(obj);
	}
	else {
		gd.payload[type] = [obj];
	}

	// cleanup
	if(gd.payload.length > 1000) {
		gd.payload.splice(1000);
	}
};

var hasData = function() {
	for(var key in gd.payload) {
		return true;
	}
};

var send = function() {
	// nothing to send or emit
	if(!hasData()) return;

	gd.payload['version'] = gd.version;

	gd.dump(gd.payload);

	if(!gd.payloadSending) {
		gd.payloadSending = gd.payload;
		gd.payload = {};
	}

	if(gd.enabled) {
		sync.push(gd.options, gd.payloadSending, function(err) {
			if(err) {
				gd.error(err);
				return;
			}
			gd.log('Graphdat payload pushed');
		});
	}

	// cleanup
	gd.payloadSending = null;
}

if(!gd.syncIntervalId) {
	gd.syncIntervalId = setInterval(function() {
		try {
			send();
		}
		catch(e) {
			gd.error(e);
		}
	}, 900);
}
