var PublishFile = require('../../../lib/publishFile');

process.on('message', function(m) {
  var paths = m.split('/');
  var publishFile = new PublishFile();
  publishFile.publish('127.0.0.1', 65505, 'publish/db', [
                       { address: 'localhost', port: 65503 },
                       { address: 'localhost', port: 65504 }
                       ], m , paths[paths.length-1]);
})

