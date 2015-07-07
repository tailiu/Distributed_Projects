var http = require('http');
var url = require('url');
var querystring = require('querystring');

function createHttpServer(){

}

/**
 * Create Http server to handle get or post request
 * @param {number} port
 * @param {string} method: 'GET' or 'POST'
 * @param {function} generateRes: produce response to the request
 * @param {function} handleReq: deal with the request
 *
 *
 * todo: add handleReq part
 * todo: deal with too many requests in post 
 *
 */
createHttpServer.prototype.create = function(port, method, generateRes, handleReq){
  var server = http.createServer(function (req, res) {
    if (method == 'POST') {
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
      res.write(generateRes(handleReq(request)));
      res.end();
    }
    else if (method == 'GET') {
    /*
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
        res.end(sendHttpReq.sendHttpSyncRequest('POST', val[0], val[1], req, 2000, handleResponse))   
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
    
     */  
    }
    else{
      console.log('Plese input correct method: "GET" or "POST"');
    }
  }).listen(port);
}

module.exports = createHttpServer;


