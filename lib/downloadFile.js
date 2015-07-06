var fs = require('fs');
var WebTorrent = require('webtorrent');

function downloadFile(){
}
/**
 * Download file via bittorrent
 * @param {string} path: the location to store the download file
 * @param {JSON} meta: the metadata of the file 
 *
 */ 
downloadFile.prototype.download = function (path, meta) {
  var client = new WebTorrent({ dht: false, tracker: false });
  var ws = fs.createWriteStream(path);
  var torrent = client.add(meta.infoHash);
  torrent.addPeer('127.0.0.1:' + meta.port);
  client.on('torrent', function (torrent) {
    torrent.files[0].createReadStream().pipe(ws);
  })
  torrent.on('done', function () {
    console.log('all done!');
  })
}

module.exports = downloadFile;

