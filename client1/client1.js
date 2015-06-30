var kademlia = require('kad');
var levelup = require('level');
var http = require('http');
var url = require('url');
var querystring = require('querystring');
var childProcess = require('child-proc');

var dht = kademlia({
  address: '127.0.0.1',
  port: 65501,
  seeds: [
    { address: 'localhost', port: 65503 }
  ],
  storage: levelup('db')
});

dht.on('connect', function(){
  dht.put('groupName', 'localhost:6666', function(err){});
});

function buildGitRepo(){
  var ls = childProcess.execFile('./instru', function (error, stdout, stderr) {
     if (error) {
       console.log(error.stack);
       console.log('Error code: '+stderr);
     } 
     console.log(stdout);
  });
}

buildGitRepo();

var server = http.createServer(function (req, res) {
  var post = '';
  var data = {gitrepo:"liutai@localhost:/home/liutai/project/client1/git_repo/"};
  if (req.url === '/favicon.ico') {
    res.writeHead(200, {'Content-Type': 'image/x-icon'});
    res.end();
    return;
  }
  req.on('data',function(chunk){  
    post += chunk;
  });   
  req.on('end',function(){  
    post = querystring.parse(post);
  });
  res.writeHead(200,{'Content-Type':'text/plain'});
  res.write(querystring.stringify(data));
  res.end();
});

server.listen(6666);


