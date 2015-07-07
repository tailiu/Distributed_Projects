var kademlia = require('kad');
var levelup = require('level');
var http = require('http');
var url = require('url');
var querystring=require('querystring');
var childProcess = require('child-proc');
var fs = require('fs');
var httpSync = require('http-sync');
var WebTorrent = require('webtorrent');
var DownloadFile = require('../lib/downloadFile');
var SendHttpReq = require('../lib/sendHttpReq');

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

function handleResponse(response){
  var gitRepo = querystring.parse(response.body.toString()).gitrepo;
  console.log(gitRepo);
  gitCommand(gitRepo);
  return readFile();
}

dht.on('connect', function() {
  var server = http.createServer(function (req, res) {
    var urlObj = url.parse(req.url,true,true);
    var path = urlObj.pathname.substring(1);
    var parts = path.split(':');
    var sendHttpReq = new SendHttpReq();
    var req = {
               name:'TL',
               email:'tl67@nyu.edu',
               option: 'Add group && Git clone',
              }
    if(parts[0] === 'group'){
      dht.get(parts[1], function(err, value) {
        var val = value.split(':');       
        res.end(sendHttpReq.sendHttpSyncRequest('POST', val[0], val[1], req, 1000, handleResponse))   
      });
    }
    if(parts[0] === 'file'){
      dht.get(parts[1], function(err, value) {
        var meta = querystring.parse(value);
        console.log(meta);
        var downloadFile = new DownloadFile();
        downloadFile.download('/home/liutai/project/Downloaded Files/File1.flv', meta);
        res.writeHead(200,{'Content-Type':'text/plain'});
        res.write('Downloading '+ parts[1]+'...');
        res.end();      
      });
    } 
  });
  server.listen(8080);
})

