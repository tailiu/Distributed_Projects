var http = require('http');
var url = require('url');
var querystring = require('querystring');

function createHttpServer(){
}

createHttpServer.prototype.create = function(port, method, response){
  var server = http.createServer(function (req, res) {
    var request = '';
    if (req.url === '/favicon.ico') {
      res.writeHead(200, {'Content-Type': 'image/x-icon'});
      res.end();
      return;
    }
    req.on('data',function(chunk){  
      request += chunk;
    });   
    req.on('end',function(){  
      request = querystring.parse(request);
    });
    res.writeHead(200,{'Content-Type':'text/plain'});
    console.log(port);
    console.log(method);
    console.log(response.gitrepo);
    res.write(querystring.stringify(response));
    res.end();
  }).listen(port);
}

module.exports = createHttpServer;


