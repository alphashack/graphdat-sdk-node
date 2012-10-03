/*
 * Copyright (c) 2012 Dmitri Melikyan
 *
 * Permission is hereby granted, free of charge, to any person obtaining a 
 * copy of this software and associated documentation files (the 
 * "Software"), to deal in the Software without restriction, including 
 * without limitation the rights to use, copy, modify, merge, publish, 
 * distribute, sublicense, and/or sell copies of the Software, and to permit 
 * persons to whom the Software is furnished to do so, subject to the 
 * following conditions:
 * 
 * The above copyright notice and this permission notice shall be included 
 * in all copies or substantial portions of the Software.
 * 
 * THE SOFTWARE IS PROVIDED "AS IS", WITHOUT WARRANTY OF ANY KIND, EXPRESS 
 * OR IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF 
 * MERCHANTABILITY, FITNESS FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN 
 * NO EVENT SHALL THE AUTHORS OR COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, 
 * DAMAGES OR OTHER LIABILITY, WHETHER IN AN ACTION OF CONTRACT, TORT OR 
 * OTHERWISE, ARISING FROM, OUT OF OR IN CONNECTION WITH THE SOFTWARE OR 
 * THE USE OR OTHER DEALINGS IN THE SOFTWARE.
 */


var proxy = require('../proxy');
var stats = require('../stats');


var commands = [
  'get',
  'gets',
  'getMulti',
  'set',
  'replace',
  'add',
  'cas',
  'append',
  'prepend',
  'increment',
  'decrement',
  'incr',
  'decr',
  'del',
  'delete',
  'version',
  'flush',
  'stats',
  'slabs',
  'items',
  'flushAll',
  'statsSettings',
  'statsSlabs',
  'statsItems',
  'cachedump'
];


module.exports = function(obj) {
  commands.forEach(function(command) {
    proxy.before(obj.prototype, command, function(obj, args) {
      // ignore, getMulti will be called
      if(command === 'get' && Array.isArray(args[0])) return;

      var client = obj;
      var trace = stats.trace();
      var params = args;
      var time = stats.time();

      proxy.callback(args, -1, function(obj, args) {
        if(!time.measure()) return;

        var error = (args && args.length > 0) ? (args[0] ? args[0].message : undefined) : undefined;

        stats.value('Memcached', 'Requests per minute', 1, undefined, 'sum');
        stats.value('Memcached', 'Average response time', time.ms, 'ms', 'avg');

        var obj = {'Type': 'Memcached',
            'Servers': client.servers, 
            'Command': command, 
            'Params': stats.truncate(params),
            'Stack trace': trace,
            'Error': error};

        stats.sample(time, obj, 'Memcached: ' + obj['Command']);
      });
    });
  });
};

