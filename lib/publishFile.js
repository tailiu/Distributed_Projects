var WebTorrent = require('webtorrent')
var kademlia = require('kad');
var levelup = require('level');
var querystring = require('querystring');

function publishFile(){
}

/**
 * Put file and file name on torrent and on DHT responsively.
 * @param {string} ipAddr: 'POST' or 'GET'
 * @param {number} port: local DHT works on
 * @param {string} db: database address
 * @param {array} nodes: each element of the array represents one seed
 * @param {string} path: the path of the uploaded file, including the file name
 * @param {string} file: file name
 *
 */
publishFile.prototype.publish = function (ipAddr, portNum, db, nodes, path, file){
  var dht = kademlia({
      address: ipAddr,
      port: portNum,
      storage: levelup(db),
      seeds: nodes
  });
  var client = new WebTorrent({ dht: false, tracker: false });
  dht.once('connect', function() {  
    client.seed(path , function (torrent) {
      var meta = {infoHash:torrent.infoHash, port:client.torrentPort};
      dht.put(file, querystring.stringify(meta), function(err){});
      console.log('Publish file successfully');
      console.log('torrent.infoHash:'+torrent.infoHash + '\nport:'+ client.torrentPort);
    })
  })
}

module.exports = publishFile;

