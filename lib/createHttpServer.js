var http = require('http');
var url = require('url');
var querystring = require('querystring');

function createHttpServer(){

}

/**
 * Create Http server to handle get or post request
 * @param {number} port
 * @param {string} method: 'GET' or 'POST'
 * @param {JSON value or some strings} response
 * @param {function} handleRequest: use the request to this server to do some work
 *
 *
 * todo: add handleRequest part
 *
 */
createHttpServer.prototype.create = function(port, method, response, handleRequest){
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
    res.write(querystring.stringify(response));
    res.end();
  }).listen(port);
}

module.exports = createHttpServer;


