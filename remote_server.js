var http = require('http');
var url = require('url');
var querystring=require('querystring');

var server = http.createServer(function (req, res) {
  if (req.url === '/favicon.ico') {
    res.writeHead(200, {'Content-Type': 'image/x-icon'});
    res.end();
    return;
  }
  console.log("Remote server listening on port 8000");
  res.writeHead(200,{'Content-Type':'text/plain'});
  res.end("Get Some JSON values");
  console.log("Send some JSON values");
});

server.listen(8000);
