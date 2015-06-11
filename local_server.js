var DHT = require('bittorrent-dht')
var magnet = require('magnet-uri')
var http = require('http');
var url = require('url');
var util = require('util');
var querystring=require('querystring');
var childProcess = require('child-proc');
var fs = require('fs');

var server = http.createServer(function (req, res) {
  if (req.url === '/favicon.ico') {
    res.writeHead(200, {'Content-Type': 'image/x-icon'});
    res.end();
    return;
  }
  console.log("Local server listening on port 8080");
  var urlObj = url.parse(req.url,true,true);
  var href = urlObj.href.substr(1);
  dht(href);
  sendHttpRequest('localhost', '8000');
  gitClone();
  fs.readFile('file', 'utf-8', function (err,data) {
    if (err) {
      console.log(err);
    } 
    res.writeHead(200,{'Content-Type':'text/plain'});
    res.end(data);
  });
});

server.listen(8080);

function dht(uri){
  var parsed = magnet(uri);
  console.log(parsed.infoHash);
  var dht = new DHT();
  dht.listen(20000, function () {
    console.log('Trying to get peer lists');
  })
  dht.on('ready', function () {
    dht.lookup(parsed.infoHash);
  })
  dht.on('peer', function (addr, hash, from) {
    console.log('found potential peer ' + addr + ' through ' + from);
  })
}

function sendHttpRequest(ipAddress, port){
  var contents=querystring.stringify({
	name:'TOM_SON',
	email:'gxhacx@gmail.com',
	address:'Changshu Dalian Load'
  });
  var options={
	host:ipAddress,
	port:port,
	method:'post',
	headers:{
			'Content-Type':'application/x-www-form-urlencoded',
			'Content-Length':contents.length
	}
  };
  var req=http.request(options,function(res){
	res.setEncoding('utf-8');
	res.on('data',function(data){
		console.log(data);
	});
  });
  req.write(contents);
  req.end();
}

function gitClone(){
  var ls = childProcess.exec('git clone git@github.com:tailiu/DHT_TEST', function (error, stdout, stderr) {
     if (error) {
       console.log(error.stack);
       console.log('Error code: '+error.code);
     }
     console.log('Child Process STDOUT: '+stdout);
  });
}

