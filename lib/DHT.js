var kademlia = require('kad');
var levelup = require('level');

function DHT (ipAddr, portNum, db, nodes){
  this.dht = kademlia({
    address: ipAddr,
    port: portNum,
    storage: levelup(db),
    seeds: nodes
  });
}

DHT.prototype.put = function(key, value) {
  var self = this;
  this.dht.on('connect', function() {
    self.dht.put(key, value, function(err) {
      console.log('done');
   });
  })
}

DHT.prototype.get = function (file){
  var self = this;
  this.dht.on('connect', function() {
   self.dht.get(file, function(err, value) {
      console.log(value);
      return value;
   });
  })
}

module.exports = DHT;

