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

EventEmitter = require('events').EventEmitter;

var gd = require('./graphdat');

exports.before = function(obj, meths, hook) {
  if(!Array.isArray(meths)) meths = [meths];

  meths.forEach(function(meth) {
    var orig = obj[meth];
    if(!orig) return;

    obj[meth] = function() {
      try { hook(this, arguments); } catch(e) { gd.error(e); }
      return orig.apply(this, arguments);
    };
  });
};

exports.after = function(obj, meths, hook) {
  if(!Array.isArray(meths)) meths = [meths];

  meths.forEach(function(meth) {
    var orig = obj[meth];
    if(!orig) return;

    obj[meth] = function() {
      var ret = orig.apply(this, arguments);
      try { hook(this, arguments, ret); } catch(e) { gd.error(e) }
      return ret;
    };
  });
};

exports.callback = function(args, pos, hookBefore, hookAfter) {
  if(args.length <= pos) return false;
  if(pos === -1) pos = args.length - 1;

  var orig = (typeof args[pos] === 'function') ? args[pos] : undefined;
  if(!orig) return;

  args[pos] = function() {
    if(hookBefore) try { hookBefore(this, arguments); } catch(e) { gd.error(e); }
    var ret = orig.apply(this, arguments);
    if(hookAfter) try { hookAfter(this, arguments); } catch(e) { gd.error(e); }
    return ret;
  };

  orig.__proxy__ = args[pos];
};

exports.getter = function(obj, props, hook) {
  if(!Array.isArray(props)) props = [props];

  props.forEach(function(prop) {
    var orig = obj.__lookupGetter__(prop);
    if(!orig) return;

    obj.__defineGetter__(prop, function() {
      var ret = orig.apply(this, arguments);
      try { hook(this, ret); } catch(e) { gd.error(e) }
      return ret;
    });
  });
};

if(!EventEmitter.prototype.__patched__) {
  /* make sure a wrapped listener can be removed */
  exports.before(EventEmitter.prototype, 'removeListener', function(obj, args) {
    if(args.length > 1 && args[1] && args[1].__proxy__) {
      args[1] = args[1].__proxy__;
    }
  });

  EventEmitter.prototype.__patched__ = true;
}
