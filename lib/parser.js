require('js-yaml');
var path = require('path');
var Spec = require(path.join(__dirname, 'spec'));
var expect = require('chai').expect;

function validateListOfCommands(list, structure) {
    list.forEach(function(command) {
        if (typeof command === 'string') {
            // OK.
        } else if (command instanceof Object) {
            expect(command, 'A command hash must include both a `template` and an `at` property.').to.include.keys('template', 'at');
            
            expect(command.template).to.be.a('string', 'The template portion of a command hash must be a string.');
            expect(command.at).to.be.an('object', 'The at portion of a command hash must be a hash');
            
            if (command.at.host) {
                expect(structure.hosts).to.be.an('object', 'The host property is not a hash.');
                expect(structure.hosts, 'The host ' + command.at.host + ' does not exist.').to.include.keys([command.at.host]);
            } else if (command.at.group) {
                expect(structure.groups).to.be.an('object');
                expect(structure.groups, 'The group ' + command.at.group + ' does not exist.').to.include.keys([command.at.group]);
            } else {
                throw new Error('Command\'s at group has neither a host nor a group.');
            }
        } else {
            throw new Error('Invalid command ');
        }
    });
}

function validateCommandLists(obj, structure) {
    ['before','commands','after','error'].forEach(function(section) {
        if (obj[section]) {
            expect(obj[section]).to.be.an('array', 'The section ' + section + ' is not an array.');
            validateListOfCommands(obj[section], structure);
        }
    });
}

function validate(structure, callback) {
    try {
        expect(structure).to.be.an('object', 'The spec file did not yield a hash.');
        
        validateCommandLists(structure.default, structure);
        
        if (structure.groups) {
            expect(structure.groups).to.be.an('object', 'The groups property of the spec is not a hash.');
            
            Object.keys(structure.groups).forEach(function(groupId) {
                var group = structure.groups[groupId];
                
                expect(group).to.be.an('object', 'The group ' + groupId + ' is not a hash.');
                validateCommandLists(structure.groups[groupId], structure);
                
                group.hosts = [];
            });
        } else {
            structure.groups = [];
        }
        
        expect(structure.hosts).to.be.an('object', 'The hosts property of the spec is not a hash.');
        var hostnames = [];
        
        Object.keys(structure.hosts).forEach(function(hostId) {
            var host = structure.hosts[hostId];
            
            expect(host).to.be.an('object', 'The host ' + hostId + ' is not a hash.');
            
            expect(host, 'The host ' + host + ' does not include a hostname entry.').to.include.keys(['hostname']);
            expect(hostnames, 'The hostname ' + host.hostname + ' is used by more than one host.').to.not.include(host.hostname);
            
            if (host.groups) {
                expect(host.groups).to.be.an('array', 'The groups property of the host ' + hostId + ' is not a array.');

                host.groups.forEach(function(group) {
                    expect(group).to.be.a('string', 'The group ' + group + ' of the host ' + hostId + ' is not a string.');
                    expect(structure.groups).to.be.an('object', 'The `groups` property of the spec is not a hash.');
                    expect(structure.groups, 'The group ' + group + ' does not exist.').to.include.keys(group);
                    
                    structure.groups[group].hosts.push(host.hostname);
                });
            }
            
            hostnames.push(host.hostname);
            validateCommandLists(host, structure);
        });
        
        
    } catch (err) {
        return callback(err);
    }
    
    callback(null, new Spec(structure));
}

function parse(path, callback) {
    try {
        var structure = require(path);
    } catch (err) {
        return callback(err);
    }
    
    validate(structure, callback);
}

module.exports.parse = parse;
module.exports.validate = validate;