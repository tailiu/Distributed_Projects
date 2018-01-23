
var net     = require('net');
var fs      = require('fs');
var rpc     = require("jsonrpc-node");
var randstr = require('randomstring');
var async   = require('async');
var helper  = require('./helper');
var prompt  = require('prompt');
var _       = require('underscore');
var paxosm  = require('./paxos');
var PAXOS   = paxosm.Paxos;

global.PORT = process.env.PORT || helper.randomPort;
global.HOST = process.env.HOST ||'127.0.0.1';

var paxos     = new PAXOS(PORT, HOST);
var rpcServer = new rpc.Server();

var handleJoin = function(args, callback){

  helper.log("handleJoin", "app.js", "args", args);

  if (!args) {
    callback(helper.prepRPCArgs(false, "No Arguments?", args));
    return;
  }

  args = args[0];

  var port = args.data.node.port;
  var host = args.data.node.host;

  if (paxos.getTotalPeers() <= 0 || args.data.direct) {
    helper.log("handleJoin", "app.js", "Join1");
    paxos.addNode(port, host);
    callback(helper.prepRPCArgs(false, "Node added. Over to you.", {node: {port:PORT, host:HOST}, direct: true}), null);
  }else{
    helper.log("handleJoin", "app.js", "Join2");
    helper.log("handleJoin", "app.js", "TotalPeers : " + paxos.getTotalPeers(), args.data.direct);
    putVal("#join:"+port, JSON.stringify({port:port, host:host}));
  }
  helper.log("handleJoin", "app.js", "End");
}

var initJoinRPC = function(port, host, direct){

  direct = direct || false;

  var rpcClient = new rpc.Client();
  rpcClient.connect(port, host);

  rpcClient.call(
    "handleJoin",
    helper.prepRPCArgs(false, "Add Me.", {node: {port:PORT, host:HOST}, direct: direct}),
    function(err, res){
        helper.log("initJoinRPC", "app.js", JSON.stringify(res));
        if (err) {
          helper.log("initJoinRPC", "app.js", "SOMETHING HAPPENED AT SERVER RPC!");
        }else{
          helper.log("initJoinRPC", "app.js", "EXECUTED SUCCESFULLY!");
          handleJoin(res, function(){});
        }
      }
    );
    helper.log("initJoinRPC", "app.js", "End");
}

var proposeVal = function(req, callback) {

    helper.log("proposeVal", "app.js", "Enter", req);

    req = req[0];

    var name = req.name;
    var instance = req.instance;
    var proposal = req.proposal;

    helper.log("proposeVal", "app.js", "RECEIVE PROPOSE("+ name+ ","+ instance+ ","+ JSON.stringify(proposal)+ ")");

    // Initialize our storage for this name
    paxos.initializeStorageForName(name);

    var result = paxos.handlePropose(name, instance, proposal);

    helper.log("proposeVal", "app.js", "Received result:", result);

    callback(helper.prepRPCArgs(false, "Proposal result.", result ));

    helper.log("proposeVal", "app.js", "Return");
}

var acceptVal = function(req, callback){

    helper.log("acceptVal", "app.js", "Enter", req);

    req = req[0];

    var name = req.name;
    var instance = req.instance;
    var proposal = req.proposal;
    var value = req.value;

    helper.log("acceptVal", "app.js", "RECEIVE ACCEPT("+ name+ ","+ instance+ ","+ JSON.stringify(proposal)+ ","+ JSON.stringify(value)+")");

    // Initialize our storage for this name
    paxos.initializeStorageForName(name);

    var result = paxosm.handleAccept(paxos, name, instance, proposal, value);

    callback(helper.prepRPCArgs(false, "Accept result.", result ));

    helper.log("acceptVal", "app.js", "Return");
}

var learnVal = function(req, callback){

    helper.log("learnVal", "app.js", "Enter", req);

    req = req[0];

    var name = req.name;
    var instance = req.instance;
    var value = req.value;
    var peer = req.peer;

    helper.log("learnVal", "app.js", "RECEIVE LEARN("+ name+ ","+ instance+ ","+ JSON.stringify(value)+ ","+ JSON.stringify(peer)+")");

    // Initialize our storage for this name
    paxos.initializeStorageForName(name);

    var result = paxosm.handleLearn(paxos, name, instance, value, peer);

    helper.log("learnVal", "app.js", "result", result);
    callback(helper.prepRPCArgs(false, "Learn result.", result ));

    helper.log("learnVal", "app.js", "Return");
}

var putVal = function(name, value) {

    helper.log("putVal", "app.js", "Enter");
    helper.log("putVal", "app.js", "Key: " + name + " Val:" + value);

    // Initialize our storage for this name
    paxos.initializeStorageForName(name);

    // Get the next proposal number and build the proposal
    var instance = paxos.incInstance(name);
    paxosm.initiateProposal(paxos, name, instance, value, function(err, result) {
        if (err) {
            // If there was an error, let's make it as if this never
            // never happened
            paxos.decInstance();
            paxos.deleteProposalCounter(name);
            helper.log("putVal>initiateProposal", "app.js", "Error", err);
            // res.json(err);
        }
        else {
            helper.log("putVal>initiateProposal", "app.js", "Result",result);
            // res.json(result);
        }
    });

    helper.log("putVal", "app.js", "Return");
}

var getVal = function(name, instance) {

  helper.log("getVal", "app.js", "Enter");
  helper.log("getVal", "app.js", "Key: " + name + " Inst:" + instance);
  helper.log("getVal", "app.js", "Fully Learnt Values", paxos.getValues());

  // Initialize our storage for this name
  paxos.initializeStorageForName(name);

  var val = paxos.getValueByInstance(name, instance);

  if (val !== null && val !== undefined) {

      helper.log("getVal", "app.js", "QUICK FETCH", val);
      // If we have a fully learnt value, we don't need to
      // do a paxos round
      // res.json({
      //     name: name,
      //     instance: instance,
      //     value: FULLY_LEARNT_VALUES[name][instance]
      // });
  }
  else {
      // We need to queue up a listener when we've fully learnt the
      // value
      helper.log("getVal", "app.js", "FETCH FAILED - KEY DOESN'T EXIST");
      var listeners = paxos.setValueByInstance(name, instance, paxos.getValueByInstance(name, instance) || []);
      listeners.push(function(value) {
          helper.log("getVal", "app.js", "FETCH listener invoked!");
          helper.log("getVal", "app.js", JSON.stringify({
              found: true,
              name: name,
              instance: instance,
              value: value
          }));
          // if (res !== null) {
          //     helper.log("getVal", "app.js", "FETCH listener invoked!");
          //     helper.log("getVal", "app.js", JSON.stringify({
          //         found: true,
          //         name: name,
          //         instance: instance,
          //         value: value
          //     }));
          // }
          // else {
          //     helper.log("getVal", "app.js", "FETCH listener invoked too late!")
          // }
      });

      // setTimeout(LEARN_TIMEOUT, function(req, res) {
      //     helper.log("getVal", "app.js", "FETCH timeout!");
      //     helper.log("getVal", "app.js", "Return with:", {
      //         found: false,
      //         name: name,
      //         instance: instance,
      //         message: "Timeout"
      //     });
      //     // res.json({
      //     //     found: false,
      //     //     name: name,
      //     //     instance: instance,
      //     //     message: "Timeout"
      //     // });
      //     //
      //     // res = null;
      // });

      // OK, we don't have a value, so we initiate a round for this
      // (name, instance) pair.
      paxosm.initiateProposal(paxos, name, instance, paxos.TEST_VALUE, function(err, result) {
          helper.log("getVal > initiateProposal", "app.js", "Callback Here", {err, result});
          if (err) {
              helper.log("getVal > initiateProposal", "app.js", "Error", err);
              // res.json(err);
          }
          else {
              if (result === paxos.VALUE_NOT_FOUND) {
                  helper.log("getVal > initiateProposal", "app.js", "Value Not Found");
                  // res.send({found: false}, 404)
              }
              else {
                  helper.log("getVal > initiateProposal", "app.js", "Not Found. Returned:", result);
                  // res.send({found: false, message: "WTF: " + result}, 500);
              }
          }

          // res = null;
      });
  }
  helper.log("getVal", "app.js", "Return");
}


rpcServer.register('handleJoin', handleJoin);
rpcServer.register('propose', proposeVal);
rpcServer.register('accept', acceptVal);
rpcServer.register('learn', learnVal);
// rpcServer.register('reqConnRPC', newConnInit);
rpcServer.register('initJoinRPC', initJoinRPC);

rpcServer.listen(PORT, function(error){

  if (error) helper.log("rpcServerStart", "app.js", "** BOOTING: RPC SERVER ERROR!");
  else       helper.log("rpcServerStart", "app.js", "** BOOTING: RPC SERVER UP ON PORT " + PORT);

  async.whilst(
    function(){
      return true;
    },
    function(next){
      prompt.start();
      prompt.get(['cmd'], function(err, res){
        helper.log("mainLoop", "app.js", "CMD: " + res.cmd);
        if (res.cmd == "out")  return;
        switch (res.cmd) {
          case "out":
            return;
          case "exit":
            process.exit();
          case "peers":
            helper.log("mainLoop", "app.js", "Peers", paxos.listPeers());
            break;
          case "values":
            helper.log("mainLoop", "app.js", "Fully Learnt Values", paxos.getValues());
            break;
          case "total":
              helper.log("mainLoop", "app.js", "Total Peers", paxos.getTotalPeers());
              break;
          default:{
            var args = res.cmd.split(":");
            if (args.length == 2 && args[0] == "join") {
              if (args[1] == PORT) {
                helper.log("mainLoop", "app.js", "Self connection not allowed!");
              } else{
                initJoinRPC(args[1], HOST);
              }
            }else if (args.length == 2 && args[0] == "djoin") {
              if (args[1] == PORT) {
                helper.log("mainLoop", "app.js", "Self connection not allowed!");
              } else{
                initJoinRPC(args[1], HOST, true);
              }
            } else if (args.length == 2 && args[0] == "put") {
              var key = args[1].split(",")[0];
              var val = args[1].split(",")[1];
              putVal(key, val);
            } else if (args.length == 2 && args[0] == "get") {
              var key = args[1].split(",")[0];
              var inst= args[1].split(",")[1];
              getVal(key, inst);
            }
          }
        }
        next();
      });
    },
    function(err){
      helper.log("rpcServerStart", "app.js", "** WHILE: LOOP FINISHED W/ ERROR!");
    }
  );
});
