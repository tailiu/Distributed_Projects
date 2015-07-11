var http = require('http');
var httpSync = require('http-sync');
var querystring=require('querystring');

function sendHttpReq(){

}

/**
 * Create Http server to handle get or post request synchronously
 * @param {string} type: 'POST' or 'GET'
 * @param {string} ipAddress
 * @param {string} port
 * @param {JSON} req: request
 * @param {number} timeout
 * @param {function} handleResponse: use the response to this 
 *                                   HTTP request to do some work 
 * @return: after handling the response to the request, return the results. Type and value 
 *          are up to the user
 *
 *
 * todo:'GET' part and sendHttpAsyncRequest()
 */
sendHttpReq.prototype.sendHttpSyncRequest = function(type, ipAddress, port, req, timeout, handleResponse){
  var contents=querystring.stringify(req);
  var request = httpSync.request({
    method: type,
    headers: {},
    body: contents,
    protocol: 'http',
    host: ipAddress,
    port: port
  });
  var timedout = false;
  request.setTimeout(timeout, function() {
    console.log("Request Timedout!");
    timedout = true;
  });
  var response = request.end();
  if (!timedout) {
    return handleResponse(response);
  }
}

module.exports = sendHttpReq;


