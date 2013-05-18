# Huxtable: hierarchical remote command execution via SSH

Huxtable is a simple mechanism for executing commands on clusters of servers organized in an arbitrary hierarchical fashion. It was originally developed to simplify managing complex firewall setups on a cluster, but it can be used to run just about any kind of command.

Huxtable can work many servers at the same time, and allows you to group machines logically so that you can execute the same command against multiple hosts just by adding or removing them to the appropriate group.

## Usage

Huxtable is designed to run from the command line; you can install it with `npm`:

    npm install -g huxtable
    
The executable can be invoked by name; you can pass `--help` to discover the options it offers—they're fairly self-explanatory.

## Specs

Huxtable is controlled by means of _specfiles._ A specfile (or spec for short) is a YAML file that describes your targets and the commands you want to run against them; since JSON is a subset of YAML, you can also write your specs in JSON, or even in “relaxed” JSON without quotation marks around property names.

A spec is divided in three sections:

- `default` defines properties that apply to every host.
- `groups` defines properties that apply to specific named groups of hosts.
- `hosts` defines properties that apply to a specific machine, and describes the membership of individual hosts into zero or more groups.

### Common properties

Each of the three main sections contains four subsections:

- `before` defines a group of commands that are executed as soon as a connection is established with the remote host
- `commands` defines a group of commands that are executed right after `before`
- `after` defines a group of commands that are executed right after `commands`
- `error` defines a group of commands that are executed if any of the other commands returns a non-zero exit code

Why this arrangement? At runtime, Huxtable computes the properties that apply to each host using this algorithm:

1. Take the default properties
2. Add the properties that belong to each group of which the host is a member
3. Add the properties for the host

By dividing commands in three phases, you can control the flow of execution and still break up your commands in a convenient way.

### Connection properties

Huxtable supports three properties to provide connection details; they can be specified at either the default, group, or host level (with each overwriting the one before):

- `username` The username to be used when connecting.
- `password` The password to be used when connecting.
- `privateKey` The private key to be used for key-based authentication.

In addition, every host must have a `hostname` property that provides either its FQN or IP address.

### Group membership

Each host can—but doesn't have to—be a member of one or more groups. Simply provide the name of each group in the `groups` property. For example:

    hosts:
        web-1:
            hostname: 192.168.0.2
            groups: [ 'web' , 'mysql' ]
            
Note that group membership is not recursive; a group cannot be a member of another group, and `groups` properties in a group will be ignored.

### Issuing commands

Commands are specified as a list of either strings or hashes. In the case of a string, the command is executed as-is; if, instead, you pass a hash, Huxtable looks for a `template` property, which provides a template for the command, and an `at` property, that provides a template for substitutions of the `@` character inside the template.

The `at` property, in turn, should be a hash that can contain one of two properties: `host`, with a value that references a specific host, and `group`, with a value that references a group. At runtime, the template is compiled by either replacing the `@` character with either the hostname of the host or by creating a separate copy of the command for each host that is part of a group.

For example:

    groups:
        web-workers:
        
        mysql-hosts:
            commands:
                - template: iptables -I INPUT -s @ -j ACCEPT
                  at: { group : 'web-workers' }
        
    hosts:
        web-1:
            hostname: 192.168.1.1
            groups: [ 'web-workers' ]
            
        web-2:
            hostname: 192.168.1.2
            groups: [ 'web-workers' ]
            
        mysql-1:
            hostname: 192.168.1.3
            groups: [ 'mysql-hosts' ]
            
In output, this spec for the mysql-1 host will yield the following:

    iptables -I INPUT -s 192.168.1.1 -j ACCEPT
    iptables -I INPUT -s 192.168.1.2 -j ACCEPT
    
## Example

As an example, consider setting up iptable rules for a cluster that contains the following:

- A cluster of five machines running [Riak](http://basho.com/riak/) (`riak-1` through `riak-5`)
- A web proxy (`web-proxy`) that load-balances a cluster of three web workers (`web-1` through `web-3`)

Generally speaking, we want:

- All machines to refuse connections by default unless otherwise specified or established/related
- All machines to allows SSH connections
- The web proxy to allow incoming http and https connections, and allow outgoing connections to the workers on port 8000
- The workers to allow incoming connections on port 8000 from the proxy, and outgoing connections to the Riak cluster on port 8198
- The Riak machines to be able to speak to each other, and allow incoming connections from the web workers on port 8198
- On success, use `iptables-save` to save the rules to `/etc/iptables.conf`
- On error, use `iptables-restore` to avoid leaving the firewall in an incorrect state

This could be done with a spec that looks like this:

    default:

        username: root
        privateKey: /home/me/.ssh/id_rsa
    
        before:
            - iptables -P INPUT ACCEPT
            - iptables -P OUTPUT ACCEPT
            - iptables -P FORWARD ACCEPT
            - iptables -F
        
        commands:
            - iptables -A INPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
            - iptables -A INPUT -p tcp --dport ssh -j ACCEPT
            - iptables -A OUTPUT -m conntrack --ctstate INVALID -j DROP
            - iptables -A OUTPUT -m conntrack --ctstate ESTABLISHED,RELATED -j ACCEPT
        
        after:
            - iptables -P INPUT DROP
            - iptables -P FORWARD DROP
            - iptables -P OUTPUT DROP
            - iptables-save > /etc/iptables.conf
        
        error:
            - iptables-restore /etc/iptables.conf
        
    groups:
    
        web-workers:
        
            commands:
            
                - template: iptables -A INPUT -p tcp --dport 8000 -s @ -j ACCEPT
                  at: { host : 'web-proxy' }
            
                - template: iptables -A OUTPUT -p tcp --dport 8098 -d @ -j ACCEPT
                  at: { group : 'riak-nodex' }
            
            
        riak-nodes:
        
            commands:
            
                - template : iptables -A INPUT -p tcp -s @ -j ACCEPT
                  at : { group : 'riak-nodes' }

                - template : iptables -A INPUT -p tcp --dport 8098 -s @ -j ACCEPT
                  at : { group : 'web-workers' }
              
    hosts:
    
        web-proxy:
        
            hostname: 192.168.1.1
            commands:
                - iptables -A INPUT -p tcp --dport http -j ACCEPT
                - iptables -A INPUT -p tcp --dport https -j ACCEPT
                - template : iptables -A OUTPUT -p tcp --dport 8000 -d @ -j ACCEPT
                  at : { group : webWorkers }

        web-1:

            hostname: 192.168.1.2
            groups: [ 'webWorkers' ]

        web-2:

            hostname: 192.168.1.3
            groups: [ 'webWorkers' ]

        web-3:

            hostname: 192.168.1.4
            groups: [ 'webWorkers' ]
        
        riak-1:
        
            hostname: 192.168.1.5
            groups: [ 'riakNodes' ]

        riak-2:
        
            hostname: 192.168.1.6
            groups: [ 'riakNodes' ]

        riak-3:
        
            hostname: 192.168.1.7
            groups: [ 'riakNodes' ]

        riak-4:
        
            hostname: 192.168.1.8
            groups: [ 'riakNodes' ]

        riak-5:
        
            hostname: 192.168.1.9
            groups: [ 'riakNodes' ]
            
With this arrangement, you can now easily add or remove machines from the various clusters, or change the way they are supposed to communicate without any duplication in your commands.


