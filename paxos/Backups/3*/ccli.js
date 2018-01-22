
var rpc    = require('node-json-rpc');
var helper = require('./helper');

var connect = function(rport, rhost, port, host){

  helper.log("connect", "cli-client.js", "Enter");
  helper.log("connect", "cli-client.js", "Params - rport: {0}, rhost: {1}, port: {2}, host: {3}"
              .replace("{0}", rport).replace("{1}", rhost).replace("{2}", port).replace("{3}", host));

  var rpcClient = new rpc.Client({port: rport, host: rhost});

  rpcClient.call(
    {
      "jsonrpc" : 2.0,
      "method"  : "addNode",
      "params"  : {"node" : {port: port, host: host}},
      "id"      : 0,
    }, function(err, res){
      if (err) {
        helper.log("rpcClient.call", "cli-client.js", "SOMETHING HAPPENED AT SERVER RPC!");
      }else{
        helper.log("rpcClient.call", "cli-client.js", "EXECUTED SUCCESFULLY!");
      }
      helper.log("rpcClient.call", "cli-client.js", JSON.stringify(res));
    }
  );
}

module.exports = {
  "connect" : connect
}
