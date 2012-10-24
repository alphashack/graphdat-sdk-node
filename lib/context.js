var _ = require("underscore");

var MAX_NAME_LENGTH = 1024;
var MAX_CONTEXT_DEPTH = 64;

var context = function(create, leave, combine, logger) {
    if(!(this instanceof context)) return new context(create, leave, combine, logger);

	this._create = create;
	this._leave = leave;
	this._combine = combine;
	this._logger = logger === null || typeof logger === "function" ? logger : console.log;
	this._root = new node(null, null, this);
	this._current = this._root;
};

var node = function(name, parent, context) {
    if(!(this instanceof node)) return new node(name, parent, context);

	this._name = name;
	this._context = context;
	this._parents = [];
	this._children = [];
	this._enterDone = 0;
	this._leaveDone = 0;

	this.enter(name, parent);
};

node.prototype = {
	_hasParent: function() {
		return this._parents.length > 0;
	},
	enter: function(name, parent) {
		if(name && this._name != name) return this._context._logAndThrow('Context error: tried to (re)enter "' + name + '" but target context is "' + this._name + '"');
		if(parent) this._parents.push(parent);
		this._payload = this._context._create ? this._context._create(this._payload) : null;
		this._enterDone++;
	},
	_leave: function(name) {
		if(name && this._name != name) return this._context._logAndThrow('Context error: tried to _leave "' + name + '" but current context is "' + this._name + '"');
		if(this._context._leave) {
			this._context._leave(this._payload);
		}
		this._leaveDone++;
		return this._parents[this._parents.length - 1];
	},
    leave: function(name) {
	    if(name && this._name != name) return this._context._logAndThrow('Context error: tried to leave "' + name + '" but current context is "' + this._name + '"');
        if(this._leaveDone < this._enterDone) { // might have called client leave already when recursing
	        if(this._context._leave) {
			    this._context._leave(this._payload);
	        }
	        this._leaveDone++;
        }
	    return this._parents.pop();
    },
    build: function(build) {
        var obj;
        if(build) obj = build(this._payload);
        return obj ? obj : {};
    },
    objectify: function(build, obj) {
        var current = this.build(build);
        if(this._name) current.name = this._name;
        this._children.forEach(function(child) {
            if(!current.children) current.children = [];
            child.objectify(build, current.children);
        });
        if(obj) obj.push(current);
        return current;
    },
    flatten: function(build, obj, path, depth) {
        if(!obj) obj = [];
        if(!path) path = '';
        if(path != '/') path = path + '/';
	    if(!depth) depth = 0
	    depth++;
	    if(depth > MAX_CONTEXT_DEPTH) {
		    this._context._logAndThrow('Context error: call stack too deep (max ' + MAX_CONTEXT_DEPTH + ')');
		    return obj;
	    }
	    var current = this.build(build);
        current.name = path = path + (this._name ? this._name.replace(/\//g, '_') : '');
	    if(current.name.length > MAX_NAME_LENGTH) {
		    this._context._logAndThrow('Context error: name too long (max ' + MAX_NAME_LENGTH + ')');
	        return obj;
	    }
	    obj.push(current);
        this._children.forEach(function(child) {
            child.flatten(build, obj, path, depth);
        });
        return obj;
    }
};

context.prototype = {
    _logAndThrow: function(ex) {
        if(this._logger) {
            this._logger(ex);
        }
        //throw ex;
    },
	_findAncestor: function(name) {
		var ancestors = [];
		var current = {node: this._current, parentIndex: this._current._parents.length - 1};
		while(current.parentIndex >= 0) {
			var parent = current.node._parents[current.parentIndex--];
			if(parent._name === name)
				return parent;
			var again = _.find(ancestors, function(a) { return a._name === parent._name; });
			if(again) {
				current = again;
			}
			else
			{
				current = {node: parent, parentIndex: parent._parents.length - 1};
				ancestors.push(current);
			}
		}
		return null;
	},
    enter: function(name) {
	    if(name && name === this._current._name)
	    {
		    // simple recursive
		    this.leave(name);
	    }
	    var aNode;
	    if(aNode = this._findAncestor(name)) {
		    // deep recursion
		    aNode._leave(name); // leave without popping the parent, later pop the parent but do not call client leave
		    aNode.enter(name, this._current);
	    }
	    else if(aNode = _.find(this._current._children, function(n) { return name === n._name; })) {
		    // re-enter
		    aNode.enter(name, this._current);
	    }
	    else {
		    // new
		    aNode = new node(name, this._current, this);
	        this._current._children.push(aNode);
	    }
	    this._current = aNode;
    },
    leave: function(name) {
	    if(this._current === this._root) return this._logAndThrow('Context error: cannot "leave" from root, you might want "done"');
        var parent = this._current.leave(name);
        var payload = this._current._payload;
        this._current = parent;
	    return payload;
    },
    done: function() {
        if(this._current !== this._root) return this._logAndThrow('Context error: not at root when "done" called');
        this._current.leave();
        return this._current._payload;
    },
    exit: function() {
        while(this._current._hasParent()) {
            this.leave();
        }
        return this.done();
    },
    validate: function() {
        return this._current === this._root;
    },
    objectify: function(build) {
        if(this._current !== this._root) return this._logAndThrow('Context error: not at root when "objectify" called');
        return this._current.objectify(build);
    },
    flatten: function(build) {
	    if(this._current !== this._root) return this._logAndThrow('Context error: not at root when "flatten" called');
        return this._current.flatten(build);
    },
	merge: function(other) {
		var parent = this;
		var parentCurrent = parent._current;
		var otherChildren = other._root._children;

		mergeChildren(parent, parentCurrent, otherChildren);
	}
};

var mergeChildren = function (parent, parentCurrent, otherChildren) {
	otherChildren.forEach(function(child) {
		var dup = _.find(parentCurrent._children, function(c) { return c._name === child._name; });
		if(child._name && dup) {
			if(parent._combine)
				dup._payload = parent._combine(dup._payload, child._payload);

			mergeChildren(parent, dup, child._children);
		}
		else {
			parentCurrent._children.push(child);
		}
	});
}

module.exports = context;
