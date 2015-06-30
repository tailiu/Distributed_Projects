var kademlia = require('kad');
var levelup = require('level');
var http = require('http');
var url = require('url');
var querystring=require('querystring');
var childProcess = require('child-proc');
var fs = require('fs');
var httpSync = require('http-sync');
var WebTorrent = require('webtorrent');

var dht = kademlia({
  address: '127.0.0.1',
  port: 65502,
  seeds: [
    { address: 'localhost', port: 65503 }
  ],
  storage: levelup('db')
});

function readFile(){
  return fs.readFileSync('git_repo/files.html', 'utf-8');
}

function gitCommand(gitAddress){
  var command = "git clone " + gitAddress;
  childProcess.execSync(command, {encoding: 'utf8'});
  console.log("Cloning is done");
}

function sendHttpSyncRequest(ipAddress, port, file){
  var contents=querystring.stringify({
    name:'TL',
    email:'tl67@nyu.edu',
    option: 'Add group && Git clone',
    fileName: file
  });
  var request = httpSync.request({
    method: 'POST',
    headers: {},
    body: contents,
    protocol: 'http',
    host: ipAddress,
    port: port
  });
  var timedout = false;
  request.setTimeout(1000, function() {
    console.log("Request Timedout!");
    timedout = true;
  });
  var response = request.end();
  if (!timedout) {
    gitCommand(querystring.parse(response.body.toString()).gitrepo);
    return readFile();
  }
}

function downloadFile(meta){
  var client = new WebTorrent({ dht: false, tracker: false });
  var ws = fs.createWriteStream('File1.flv');
  var torrent = client.add(meta.infoHash);
  torrent.addPeer('127.0.0.1:' + meta.port);
  client.on('torrent', function (torrent) {
    torrent.files[0].createReadStream().pipe(ws);
  })
  torrent.on('done', function () {
    console.log('all done!');
  })
}

dht.on('connect', function() {
  var server = http.createServer(function (req, res) {
    var urlObj = url.parse(req.url,true,true);
    var path = urlObj.pathname.substring(1);
    var parts = path.split(':');
    if(parts[0] === 'group'){
      dht.get(parts[1], function(err, value) {
        var val = value.split(':'); 
        res.end(sendHttpSyncRequest(val[0], val[1]));
      });
    }
    if(parts[0] === 'file'){
      dht.get(parts[1], function(err, value) {
        var meta = querystring.parse(value);
        console.log(meta);
        downloadFile(meta);
        res.writeHead(200,{'Content-Type':'text/plain'});
        res.write('Downloading '+ parts[1]+'...');
        res.end();      
      });
    } 
  });
  server.listen(8080);
})

