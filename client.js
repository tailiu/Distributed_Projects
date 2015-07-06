var kademlia = require('kad');
var levelup = require('level');
var http = require('http');
var url = require('url');
var process = require('process')
var querystring = require('querystring');
var childProcess = require('child-proc');
var prompt = require('prompt');

DHT_BOOTSRAP_IP = '127.0.0.1'
DHT_BOOTSRAP_PORT = 65503

MY_DHT_PORT = Math.floor(Math.random() * 200) + 20000


var dht = kademlia({
  address: DHT_BOOTSRAP_IP,
  port: MY_DHT_PORT,
  seeds: [
    { address: DHT_BOOTSRAP_IP, port: DHT_BOOTSRAP_PORT }
  ],
  storage: levelup(process.argv[2])
});


function getDHT(str){
	dht.get(str, function(err, value) {return value;});	
}


function putDHT(str, value){
	 dht.put(str,value, function(err){});
}


function downloadFile(filename , meta){

  var client = new WebTorrent({ dht: false, tracker: false });
  var ws = fs.createWriteStream(filename);
  var torrent = client.add(meta.infoHash);

  torrent.addPeer('127.0.0.1:' + meta.port);
  client.on('torrent', function (torrent) {torrent.files[0].createReadStream().pipe(ws);})
  torrent.on('done', function () {console.log('downloaded!');})

}


function gitCommand(gitAddress){
  var command = "git clone " + gitAddress;
  childProcess.execSync(command, {encoding: 'utf8'});
  console.log("Group meta data copied!");
}

function getMetaData(){
  return fs.readFileSync('git_repo/files.html', 'utf-8');
}


function startHTTPserver(ipaddress, port, gitRepo){

  var server = http.createServer(function (req, res) {
    var data = {gitrepo:gitRepo};
    res.writeHead(200,{'Content-Type':'text/plain'});
    res.write(querystring.stringify(data));
    res.end();
  });
  server.listen(port);
}

function buildGitRepo(){

  var ls = childProcess.execFile('./instru', function (error, stdout, stderr) {
    if (error) {
     console.log(error.stack);
     console.log('Error code: '+stderr);
    }
    console.log(stdout);
  });
  return 'https://'+process.cwd()+'git_repo'
}


function startGroup(groupName, ipaddress, port){
  //creat git repo 
  gitrepo = buildGitRepo();
  // start HTTP server 
  group_port = Math.floor(Math.random() * 200) + 20000;

  startHTTPserver('127.0.0.1', group_port, gitrepo);
  
  //put group name in DHT
  putDHT(groupName, '127.0.0.1:'+group_port);
}

GUI()

function GUI(){


}




/*THIS STARTS A DHT*/



