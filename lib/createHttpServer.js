var http = require('http');
var url = require('url');
var querystring = require('querystring');
var Fiber = require('fibers');

function createHttpServer(){
   
}

/**
 * Create Http server to handle get or post request
 * @param {number} port
 * @param {string} method: 'GET' or 'POST'
 * @param {function} generateRes: produce response to the request
 * @param {function} handleReq: deal with the request
 * @param {JSON} header: the header part of the response, includes
 *                       statusCode, statusMessage and remainingPars, which includes
 *                       Content-Type and so on
 *
 * todo: deal with too many requests in post 
 * todo: think about why this kind of Fiber works
 *
 */
createHttpServer.prototype.create = function(port, method, handleReq, generateRes, header){
  var server = http.createServer(function (req, res) {
    if (method == 'POST') {
      var request = '';
      req.on('data',function(chunk){  
        request += chunk;
      });   
      req.on('end',function(){  
        request = querystring.parse(request);
      });
      res.statusMessage = header.statusMessage;
      res.writeHead(header.statusCode, header.remainingParts);
      res.write(generateRes(handleReq(request)));
      res.end();
    }
    else if (method == 'GET') {
      Fiber (function() {
        res.statusMessage = header.statusMessage;
        res.writeHead(header.statusCode, header.remainingParts);
        res.write(generateRes(handleReq(url.parse(req.url,true,true))));
        res.end();
      }).run();
    }
  }).listen(port);
}

module.exports = createHttpServer;


