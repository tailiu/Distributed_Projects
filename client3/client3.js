var kademlia = require('kad');
var levelup = require('level');

process.on('message', function(m) {
  if(m=='start dht'){
    var dht = kademlia({
      address: '127.0.0.1',
      port: 65503,
      storage: levelup('client3/db')
    });
    process.send('> Bootstrap dht node is up');
  }
  if(m=='stop dht'){
    process.send(process.pid);
  }
});
