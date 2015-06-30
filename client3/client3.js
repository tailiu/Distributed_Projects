var kademlia = require('kad');
var levelup = require('level');

var dht = kademlia({
  address: '127.0.0.1',
  port: 65503,
  storage: levelup('db')
});

