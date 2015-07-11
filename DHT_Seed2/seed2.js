/**
 * This is one of the DHT bootstrap seed operating on port 65503 (todo: the port may
 * be randomrized or passed as an argument when implementing application API).
 *
 * @param {string} m: the message passed by the father process folking this process
 * @return 1)case: start dht: {string} 
 *         2)case: stop dht : {number} process.pid: current process id
 *
 */

var kademlia = require('kad');
var levelup = require('level');

process.on('message', function(m) {
  if(m=='start dht'){
    var dht = kademlia({
      address: '127.0.0.1',
      port: 65504,
      storage: levelup('DHT_Seed2/db')
    });
    process.send('> Bootstrap seed2 is up');
  }
  if(m=='stop dht'){
    process.send(process.pid);
  }
});


