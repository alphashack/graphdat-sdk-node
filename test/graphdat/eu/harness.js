var _fs = require('fs');
var _http = require('http');
var _util = require('util');
var _spawn = require('child_process').spawn;
var _stub = require('./agent-stub.js');

// Time allowed between launch of app and start detected
var APP_START_WAIT_MAX = 3000;

// Time allowed between last request and instrumentation all data received
var DATA_WAIT_MAX = 3000;

// Time variance allowed for response durations, as ms
var RESPONSE_TIME_VARIANCE = 100;

var _failed = 0;
var _succeeded = 0;
var _skipped = 0;

var _verbose = false;

runTests();

function errout()
{
	console.error.apply(console, arguments);
}
function infout()
{
	console.log.apply(console, arguments);
}

function runTests()
{
	var tests = _fs.readdirSync('./tests');

	var servers = tests.filter(function(e) { return e.split('.')[1] == 'server'; });
	var scenarios = tests.filter(function(e) { return e.split('.')[1] == 'scenario'; });

	var idx = 0;

	iterateTests();

	function iterateTests()
	{
		if (idx >= servers.length)
		{
			finish();
			return;
		}

		var svr = servers[idx++];

		var testName = svr.split('.')[0];

		var i = scenarios.indexOf(testName + '.scenario.json');
		if(process.argv[2] && testName.indexOf(process.argv[2]) !== 0)
		{
			infout('Skipping %s', testName);
			_skipped++;
			process.nextTick(iterateTests);
		}
		else if (i == -1)
		{
			errout('Missing matching scenario for %s, skipping test', svr);
			_skipped++;
			process.nextTick(iterateTests);
		}
		else
		{
			runSingleTest(svr, scenarios[i], function(err)
			{
				if (err)
				{
					_failed++;
					errout('Unexpected error running %s: "%s"', svr.split('.')[0], err);
				}
				else
					_succeeded++;

				//setTimeout(iterateTests, 1000);
				process.nextTick(iterateTests);
			});
		}
	}
}

function finish()
{
	if (!_failed && !_skipped)
		infout('\033[32mFinished - all successful!\033[0m');
	else
		infout('%sFinished - %d failed, %d succeeded, %d skipped\033[0m', _failed ? '\033[31m' : '\033[33m', _failed, _succeeded, _skipped);

	process.exit(0);
}

var f = false;

function runSingleTest(svrfile,scnfile,cb)
{
	var testname = svrfile.split('.')[0];

	infout('Running test "%s"', testname);

	var scn;
	try
	{
		scn =  readScenario(scnfile);
	}
	catch(ex)
	{
		cb('could not parse scenario: "' + ex + '"');
	}

	var stub = new _stub();

	stub.on('bound', launch);
	stub.on('data', handleData);
	stub.on('disconnect', handleDisconnect);

	var fTestComplete = false;
	var fTestStarted = false;
	var fDisconnected = false;

	var proc;
	var stdout = '';
	var stderr = '';

	function launch()
	{
		proc = _spawn(process.argv[0], [svrfile],{cwd:__dirname + '/tests/',env:process.env});

		proc.on('close', function(code)
		{
			if (!fTestComplete)
				cb('server exited before test was complete\nstdout:\n' + stdout + '\n\nstderr:\n' + stderr);
		});

		var startwait = setTimeout(function()
		{
			fTestComplete = true;
			stop();
			cb('start was not detected in time, got:\n' + stdout + '\ncould not find: ' +  scn.expect.start);

		}, APP_START_WAIT_MAX);

		proc.stdout.on('data', function(data)
		{
			//console.log('stdout: ' + data.toString());
			stdout += data.toString();

			if (!fTestStarted)
			{
				var re = new RegExp(scn.expect.start, 'g');
				if (re.exec(stdout) != null)
				{
					fTestStarted = true;
					clearTimeout(startwait);

					// Why do I have to do this?
					setTimeout(iterateRequests, 10);
				}
			}
		});

		proc.stderr.on('data', function(data)
		{
			//console.log('err: ' + data.toString());
			stderr += data.toString();
		});
	}

	function stop()
	{
		if (proc)
		{
			proc.kill('SIGTERM');
			proc = null;
		}
	}

	function handleDisconnect()
	{
		//console.log('disconnect');

		stub.stop(function()
		{
			stub.removeAllListeners();

			fDisconnected = true;
			if (fTestComplete || fDataComplete)
				validate();
		});
	}
	var iRequest = 0;

	function iterateRequests()
	{
		if (iRequest >= scn.requests.length)
		{
			completeTest();
			return;
		}

		var reqopt = scn.requests[iRequest++];

		var opt = {host:'localhost', port:reqopt.port || 80, path:reqopt.path, method:reqopt.method || 'GET'};

		var req = _http.request(opt, function(res)
		{
			res.on('end', function()
			{
				iterateRequests();
			});
		});
		req.end();
	}

	var allData = [];
	var fDataComplete = false;
	var endwait;

	function handleData(data)
	{
		allData.push(data);

		if (allData.length < scn.expect.data.length)
			return;

		fDataComplete = true;

		if (endwait)
		{
			clearTimeout(endwait);
			endwait = null;
		}

		stopAndValidate();
	}

	function stopAndValidate()
	{
		stop();

		if (fDisconnected)
			validate();
	}

	function validate()
	{
		// Check for errors
		if (scn.expect.noerror && stderr.length > 0)
		{
			return cb('Unexpected runtime errors found -->\n' + stderr);
		}

		for(var i=0; i < allData.length; i++)
		{
			try
			{
				compareData(scn.expect.data[i], allData[i]);
			}
			catch(ex)
			{
				return cb(_util.format('instrumentation data incorrect, expected -->\n%s\n\nreceived -->\n%s\n\n%s', JSON.stringify(scn.expect.data[i],null,3), JSON.stringify(allData[i], null, 3), ex));
			}
		}

		// All good, we can leave
		cb();
	}

	function completeTest()
	{
		fTestComplete = true;

		if (fDataComplete)
			stopAndValidate();
		else
		{
			endwait = setTimeout(function()
			{
				_stub.removeAllListeners('data');
				cb('data was not detected in time, expected ' + scn.expect.data.length + ' data item(s), got ' + allData.length);
			}
		, DATA_WAIT_MAX);
		}
	}
}

function readScenario(file)
{
	var scn = require(__dirname + '/tests/' + file);

	if (!scn.expect)
		throw 'Missing "expect" property';
	if (!scn.expect.start)
		throw 'Missing "expect.start" property';
	if (!scn.expect.data)
		throw 'Missing "expect.data" property';
	if (!scn.requests)
		throw 'Missing "requests" property';
	if (!scn.requests.length)
		throw 'requests list is empty';

	return scn;
}

// Compares scenario data (ds) to actual data (da)
function compareData(ds,da)
{
	compareObject(ds,da,['type','source','route']);

	if (!ds.context)
		return;

	if (!da.context)
		throw 'Did not receive a context but expected one';

	if (da.context.length != ds.context.length)
		throw 'Received ' + da.context.length + ' context items, expected ' + ds.context.length;

	checkResponseTime(ds.responsetime, da.responsetime, 'root request');

	for(var i=0; i < ds.context.length; i++)
	{
		compareObject(ds.context[i], da.context[i],['callcount','name']);
		checkResponseTime(ds.context[i].responsetime, da.context[i].responsetime, 'context ' + ds.context[i].name);
	}
}

// scenario to actual object compare, only caring about req properties
function compareObject(s,a,req)
{
	req.forEach(function(prop)
	{
		if ((prop in s) && s[prop] != a[prop])
			throw 'Recieved "' + a[prop] + '" for "' + prop + '", expected "' + s[prop] + '"';
	});
}

function checkResponseTime(scenario, actual, context)
{
	if (scenario && !actual)
		throw 'A response time is missing for ' + context;

	if (!scenario && actual)
		return;

	var delta = Math.abs(scenario - actual);

	if (delta > RESPONSE_TIME_VARIANCE)
		throw 'Response time of ' + scenario + ' expected, variance of +-' + RESPONSE_TIME_VARIANCE + 'ms, but ' + actual + ' was received for ' + context;
}
