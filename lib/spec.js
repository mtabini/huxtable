var dir = require('direktor');
var fs = require('fs');

var Spec = function Spec(structure) {
    this.default = structure.default || {};
    this.groups = structure.groups || {};
    this.hosts = structure.hosts || {};
};

function populate(destination, origin) {
    if (origin.username) {
        destination.username = origin.username;
    }
    
    if (origin.password) {
        destination.password = origin.password;
    }
    
    if (origin.privateKey) {
        destination.privateKey = origin.privateKey;
    }
    
    if (origin.passphrase) {
        destination.passphrase = origin.passphrase;
    }

    if (origin.hostname) {
        destination.hostname = origin.hostname;
    }
    
    destination.before = destination.before.concat(origin.before || []);
    destination.commands = destination.commands.concat(origin.commands || []);
    destination.after = destination.after.concat(origin.after || []);
    destination.error = destination.error.concat(origin.error || []);
}

Spec.prototype._renderCommandList = function _renderCommandList(list) {
    var result = [];
    var _this = this;
    
    list.forEach(function(command) {
        if (typeof command === 'string') {
            result.push(command);
        } else {
            var commandString = command.template;
            
            if (command.at.host) {
                result.push(commandString.replace('@', _this.hosts[command.at.host].hostname));
            } else if (command.at.group) {
                var group = _this.groups[command.at.group];
                
                group.hosts.forEach(function(host) {
                    result.push(commandString.replace('@', host));
                });
            }
        }
    });
    
    return result;
}

Spec.prototype._render = function _render(host) {
    var options = {
        host: host.hostname
    };

    if (host.username) {
        options.username = host.username;
    }
    
    if (host.password) {
        options.password = host.password;
    }
    
    if (host.privateKey) {
        try {
            options.privateKey = fs.readFileSync(host.privateKey);
        } catch (e) {
            options.privateKey = host.privateKey;
        }
    }
   
    if (host.passphrase) {
        options.passphrase = host.passphrase;
    }
 
    var task = new dir.Task(options);
    
    task.before = this._renderCommandList(host.before);
    task.commands = this._renderCommandList(host.commands);
    task.after = this._renderCommandList(host.after);
    task.error = this._renderCommandList(host.error);
    
    return task;
}

Spec.prototype.compile = function(callback) {
    var tasks = [];

    var _this = this;
    
    Object.keys(this.hosts).forEach(function(hostKey) {
        var host = _this.hosts[hostKey];
        
        var merged = {
            before : [],
            commands: [],
            after : [],
            error : []
        };
        
        populate(merged, _this.default);
        
        if (host.groups) {
            host.groups.forEach(function(groupId) {
                populate(merged, _this.groups[groupId]);
            });
        }
        populate(merged, host);
        
        tasks.push(_this._render.call(_this, merged));
    });
    
    return new dir.Session(tasks);
}

module.exports = Spec;
