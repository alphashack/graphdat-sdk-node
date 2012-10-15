var _ = require("underscore");

var context = function(create, leave, logger) {
    if(!(this instanceof context)) return new context(create, leave, logger);

	this._create = create;
	this._leave = leave;
    this._logger = logger;
	this._root = new node(null, null, this);
	this._current = this._root;
};

var node = function(name, parent, context) {
    if(!(this instanceof node)) return new node(name, parent, context);

	this._name = name;
    this._parent = parent;
	this._context = context;
    this._children = [];

	this.enter(name);
};

node.prototype = {
	enter: function(name) {
		if(name && this._name != name) return this._context._logAndThrow('Context error: tried to (re)enter "' + name + '" but current context is "' + this._name + '"');
		this._payload = this._context._create ? this._context._create(this._payload) : null;
	},
    leave: function(name) {
        if(name && this._name != name) return this._context._logAndThrow('Context error: tried to leave "' + name + '" but current context is "' + this._name + '"');
        if(this._context._leave) this._context._leave(this._payload);
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
    flatten: function(build, obj, path) {
        if(!obj) obj = [];
        if(!path) path = '';
        if(path != '/') path = path + '/';
        var current = this.build(build);
        current.name = path = path + (this._name ? this._name.replace('/', '_') : '');
        obj.push(current);
        this._children.forEach(function(child) {
            child.flatten(build, obj, path);
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
    enter: function(name) {
	    var aNode = _.find(this._current._children, function(n) { return name === n._name; });
	    if(aNode) {
		    aNode.enter(name);

	    }
	    else {
		    aNode = new node(name, this._current, this);
	        this._current._children.push(aNode);
	    }
        this._current = aNode;
    },
    leave: function(name) {
        if(this._current === this._root) return this._logAndThrow('Context error: cannot "leave" from root, you might want "done"');
        this._current.leave(name);
        var payload = this._current._payload;
        this._current = this._current._parent;
        return payload;
    },
    done: function() {
        if(this._current != this._root) return this._logAndThrow('Context error: not at root when "done" called');
        this._current.leave();
        return this._current._payload;
    },
    exit: function() {
        while(this._current._parent != null) {
            this.leave();
        }
        return this.done();
    },
    validate: function() {
        return this._current === this._root;
    },
    objectify: function(build) {
        if(this._current != this._root) return this._logAndThrow('Context error: not at root when "objectify" called');
        return this._current.objectify(build);
    },
    flatten: function(build) {
        if(this._current != this._root) return this._logAndThrow('Context error: not at root when "flatten" called');
        return this._current.flatten(build);
    }
};

module.exports = context;
