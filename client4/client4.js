var WebTorrent = require('webtorrent')
var kademlia = require('kad');
var levelup = require('level');
var querystring = require('querystring');

process.on('message', function(m) {
  var dht = kademlia({
    address: '127.0.0.1',
    port: 65505,
    seeds: [
      { address: 'localhost', port: 65503 }
    ],
    storage: levelup('client4/db')
  });

  var client = new WebTorrent({ dht: false, tracker: false });

  dht.on('connect', function() {  
    client.seed(m , function (torrent) {
      var meta = {infoHash:torrent.infoHash, port:client.torrentPort};
      var paths = m.split('/');
      dht.put(paths[paths.length-1], querystring.stringify(meta), function(err){});
      console.log('>Publish file successfully');
      process.send('>torrent.infoHash:'+torrent.infoHash + '\n>port:'+ client.torrentPort);
    })
  })
})

