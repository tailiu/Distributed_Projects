var Util = require('./util');
var kademlia = require('kad');
var levelup = require('level');

const portLowestLimit = 1024;
const publicPort = 49000;

function group(){
  this.util = new Util(); 
}

group.prototype.createGroup = function (type, addr, db, seeds, groupName){
  if(type == 'public' || type == 'protected' || type == 'partly-private'){
    var dht = kademlia({
      address: addr,
      port: publicPort,
      storage: levelup(db),
      seeds: seeds
    });
    dht.once('connect', function(){
      dht.put(groupName, 'localhost:' + publicPort, function(err){
        console.log('Put is done');
      });
    });
  }
  else if (type == 'private'){
    var port = this.util.randomInt(portLowestLimit, publicPort);
    var dht = kademlia({
      address: ipAddr,
      port: port,
      storage: levelup(db),
    });
    dht.once('connect', function(){
      dht.put(groupName, 'localhost:' + port, function(err){
        console.log('Put is done');
      });
    });
  }
  else 
    console.log('Enter again');
}

group.prototype.joinGroup = function (groupName, addr, db, seeds){
  var dht = kademlia({
    address: addr,
    port: publicPort - 1,
    seeds: seeds,
    storage: levelup(db)
  });
  dht.once('connect', function(){
    dht.get('groupName', function(err, value) {
      console.log(value);
    });
  })
}

module.exports = group;



