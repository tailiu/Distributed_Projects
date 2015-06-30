var WebTorrent = require('webtorrent')
var kademlia = require('kad');
var levelup = require('level');
var querystring = require('querystring');

var dht = kademlia({
  address: '127.0.0.1',
  port: 65505,
  seeds: [
    { address: 'localhost', port: 65503 }
  ],
  storage: levelup('db')
});

var client = new WebTorrent({ dht: false, tracker: false })

dht.on('connect', function() {  
  client.seed('File1.flv', function (torrent) {
    var meta = {infoHash:torrent.infoHash, port:client.torrentPort};
    dht.put('File1.flv', querystring.stringify(meta), function(err){});
    console.log(torrent.infoHash) // get info hash
    console.log(client.torrentPort) // get torrent port
  })
})

