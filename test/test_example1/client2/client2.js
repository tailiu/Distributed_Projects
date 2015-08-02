var kademlia = require('kad');
var levelup = require('level');
var querystring=require('querystring');
var childProcess = require('child-proc');
var fs = require('fs');
var httpSync = require('http-sync');
var WebTorrent = require('webtorrent');
var Fiber = require('fibers');
var DownloadFile = require('../../../lib/downloadFile');
var SendHttpReq = require('../../../lib/sendHttpReq');
var CreateHttpServer = require('../../../lib/createHttpServer');

process.on('message', function(m) {
var dht = kademlia({
  address: '127.0.0.1',
  port: 65502,
  seeds: [
    { address: 'localhost', port: 65503 },
    { address: 'localhost', port: 65504 }
  ],
  storage: levelup('client2/db')
});

function readFile(){
  return fs.readFileSync('client2/git_repo/files.html', 'utf-8');
}

function gitCommand(gitAddress){
  var command = "cd client2\n" + "git clone " + gitAddress;
  childProcess.execSync(command, {encoding: 'utf8'});
  console.log("Cloning is done");
}

function gitRepoExists(gitRepo){
  var gitRepoElements = gitRepo.split('/');
  return fs.existsSync(process.cwd() + '/client2/'+ gitRepoElements[gitRepoElements.length-2]);
}

function handleHttpSyncResponse(response){
  var gitRepo = querystring.parse(response.body.toString()).gitrepo;
  var exist = gitRepoExists(gitRepo);
  if (!exist)
    gitCommand(gitRepo);
  return readFile();
}

function handleReq(urlObj) {
  var path = urlObj.pathname.substring(1);
  var parts = path.split(':');
  var sendHttpReq = new SendHttpReq();
  var req = {
             name:'TL',
             email:'tl67@nyu.edu',
             option: 'Add group && Git clone'
            };
  if(parts[0] === 'group'){
      var fiber = Fiber.current;
      dht.get(parts[1], function(err, value) {
        var val = value.split(':'); 
        fiber.run(sendHttpReq.sendHttpSyncRequest('POST', 'localhost', '6666', req, 2000, handleHttpSyncResponse));
      });
      return Fiber.yield();
  }
  if(parts[0] === 'file'){
      dht.get(parts[1], function(err, value) {
        var meta = querystring.parse(value);
        console.log(meta);
        var downloadFile = new DownloadFile();
        downloadFile.download('/home/liutai/project/test/test_example1/Downloaded_Files/File1.flv', meta);   
      });
      var str = 'Downloading '+ parts[1]+'...';
      return str;   
  } 
}

function generateRes(request){
   return request;
}

dht.once('connect', function() {
  var createHttpServer = new CreateHttpServer();
  var header = {
                'statusCode': 200, 
                'statusMessage': 'Return successfully',
                remainingParts:{
                'Content-Type': 'text/html',
                }};
  createHttpServer.create(8080, 'GET', handleReq, generateRes, header);
})

});

