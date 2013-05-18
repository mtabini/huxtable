var expect = require('chai').expect;
var path = require('path');
var fs = require('fs');

var parser = require('../lib/parser');

describe('The default parser', function() {
   
    it('should properly parse valid input', function(done) {
        parser.parse(path.join(__dirname, '/fixtures/default-01.yaml'), function(err, spec) {
            if (err) console.log(err);
            expect(err).to.equal(null);
            
            expect(spec).to.be.an('object');
            
            expect(spec.default).to.be.an('object');
            expect(spec.default.before).to.be.an('array');
            expect(spec.default.before).to.include('command-before');
            expect(spec.default.commands).to.be.an('array');
            expect(spec.default.commands).to.include('command-during');
            expect(spec.default.after).to.be.an('array');
            expect(spec.default.after).to.include('command-after');
            expect(spec.default.error).to.be.an('array');
            expect(spec.default.error).to.include('command-error');
            
            expect(spec.groups).to.be.an('object');
            expect(spec.groups).to.include.keys('group1');
            expect(spec.groups.group1).to.be.an('object');
            expect(spec.groups.group1.commands).to.be.an('array');
            expect(spec.groups.group1.commands).to.have.length(1);
            expect(spec.groups.group1.commands[0]).to.be.an('object');
            expect(spec.groups.group1.commands[0]).to.include.keys('command', 'at');
            expect(spec.groups.group1.commands[0].command).to.equal('group1-command @');
            expect(spec.groups.group1.commands[0].at).to.be.an('object');
            expect(spec.groups.group1.commands[0].at).to.include.keys('host');
            expect(spec.groups.group1.commands[0].at.host).to.equal('host1');
            
            expect(spec.hosts).to.be.an('object');
            expect(spec.hosts).to.include.keys('host1','host2','host3','host4');
            
            expect(spec.hosts.host1).to.be.an('object');
            expect(spec.hosts.host1).to.include.keys('hostname');
            expect(spec.hosts.host1.hostname).to.equal('127.0.0.2');
            
            expect(spec.hosts.host2).to.be.an('object');
            expect(spec.hosts.host2).to.include.keys('hostname');
            expect(spec.hosts.host2.hostname).to.equal('127.0.0.3');
            expect(spec.hosts.host2.groups).to.be.an('array');
            expect(spec.hosts.host2.groups).to.include('group1');
            
            expect(spec.hosts.host3).to.be.an('object');
            expect(spec.hosts.host3).to.include.keys('hostname');
            expect(spec.hosts.host3.hostname).to.equal('127.0.0.4');
            expect(spec.hosts.host3.groups).to.be.an('array');
            expect(spec.hosts.host3.groups).to.include('group1');            
            
            expect(spec.hosts.host4).to.be.an('object');
            expect(spec.hosts.host4).to.include.keys('hostname','commands');
            expect(spec.hosts.host4.hostname).to.equal('127.0.0.5');
            expect(spec.hosts.host4.commands).to.be.an('array');
            expect(spec.hosts.host4.commands).to.have.length(1);
            expect(spec.hosts.host4.commands[0]).to.be.an('object');
            expect(spec.hosts.host4.commands[0]).to.include.keys('command', 'at');
            expect(spec.hosts.host4.commands[0].command).to.equal('host4-command @');
            expect(spec.hosts.host4.commands[0].at).to.be.an('object');
            expect(spec.hosts.host4.commands[0].at).to.include.keys('group');
            expect(spec.hosts.host4.commands[0].at.group).to.equal('group1');
            
            done();
        });
    });
    
    it('should catch incorrect values', function(done) {
        function parseAndExpectFailure(fileName, expectedMessage) {
            parser.parse(path.join(__dirname, '/fixtures/' + fileName + '.yaml'), function(err, result) {
                expect(err).to.be.an('object', 'No error returned. Expected “' + expectedMessage + '”');
                expect(err.message).to.equal(expectedMessage);
            });
        }
        
        parseAndExpectFailure('default-02', "A command hash must include both a `command` and an `at` property.: expected { wrong: \'command-before\' } to contain keys \'command\', and \'at\'");
        parseAndExpectFailure('default-03', "The hostname 127.0.0.2 is used by more than one host.: expected [ '127.0.0.2' ] to not include '127.0.0.2'");
        parseAndExpectFailure('default-04', "The host host112 does not exist.: expected { Object (host1, host2, ...) } to contain key 'host112'");
        parseAndExpectFailure('default-05', "The group group2 does not exist.: expected { Object (group1) } to contain key 'group2'");
        
        done();
    });
    
    it('should properly render a complete spec', function(done) {
        parser.parse(path.join(__dirname, '/fixtures/default-10.yaml'), function(err, result) {
            expect(err).to.equal(null);
            expect(result).to.be.an('object');
            
            expect(result.compile().toString()).to.equal(fs.readFileSync(path.join(__dirname, 'fixtures/default-10-output.txt')).toString());
            
            done();
        });
    });
    
});