
// var RPCPORT = process.env.RPCPORT || 4010;
var HOST   = '127.0.0.1';

var net    = require('net');
var fs     = require('fs');
var rpc    = require('node-json-rpc');
var randstr= require('randomstring');
var async  = require('async');
var helper = require('./helper')
var paxosm = require('./paxos_methods');
var prompt = require('prompt');
var _      = require('underscore');
// var client = require('./cli-client');

var PORT = process.env.PORT || helper.randomPort;

var DROP_PROBABILITY = 0.0;
var DROPPED_ERROR    = "DROPPEDPACKET";
var TIMEOUT_ERROR    = "ETIMEDOUT";
var PEERS_DOWN       = {accepted: false, message: "PEERS ARE DOWN"};
var REQUEST_TIMEOUT  = 2000;
var NUM_PEERS        = 0;
var PEERS            = {};
var NO_VALUE         = "__0xDEADBEEF";
var TEST_VALUE       = "__0xBEEFDEAD";
var VALUE_NOT_FOUND  = "NO VALUE FOUND";
var LEARN_TIMEOUT    = 2000;

// const logFile = fs.createWriteStream("./logs/"+ new Date() + ' - cli - log.txt');

///************************* PAXOS **********************************///

// Paxos

// For each (name, instance) pair,
// store the latest proposal we've
// promised
var RECEIVED_PROPOSALS = {};

// For each (name, instance) pair,
// store the latest (proposal, value)
// we've accepted.
var RECEIVED_ACCEPTS = {};

// For each (name, instance) pair,
// store what value we have learnt
var FULLY_LEARNT_VALUES = {};

// For each (name, instance) pair,
// keep track of how many times we've
// learnt some value, so we know
// when a majority of acceptors
// has accepted a single value
var TENTATIVELY_FULLY_LEARNT_VALUES = {};

var FULLY_LEARNT_LISTENERS = {};

// For each name, store what instance
// number we think we're on
var CURRENT_INSTANCE = {};

// For each (name, instance) pair, track
// what proposal number we should use next
var PROPOSAL_COUNTER = {};

var handlePropose = function(name, instance, proposal) {
    helper.log("handlePropose", "cli.js", "Enter");
    if (RECEIVED_ACCEPTS[name].hasOwnProperty(instance)) {
        // We have already accepted something for this
        // instance
        var accepted = RECEIVED_ACCEPTS[name][instance];
        var acceptedProposal = accepted.proposal;
        var acceptedValue = accepted.value;

        // We also need to get our minimum promised proposal
        // number
        var promisedProposal = RECEIVED_PROPOSALS[name][instance].proposal;

        helper.log("handlePropose", "cli.js", "previously accepted:"+ JSON.stringify(promisedProposal)+ "--"+ acceptedValue);

        if (helper.greaterThan(proposal, promisedProposal)) {
            // The proposal is higher than our accepted proposal,
            // so we respond with the previously accepted proposal,
            // and the value

            // However, we also need to note this new proposal,
            // because we promised not to accept anything less than it
            RECEIVED_PROPOSALS[name][instance].proposal = proposal;

            helper.log("handlePropose", "cli.js", "promising (already accepted)"+ JSON.stringify(proposal)+ " -- "+ acceptedValue);
            return {
                name: name,
                peer: PORT,
                promise: true,
                highestProposal: promisedProposal,
                value: acceptedValue
            };
        }
        else {
            // This proposal number is less, so we reject it,
            // noting our current highest proposal number and the
            // value we already accepted

            helper.log("handlePropose", "cli.js", "rejecting (already accepted)"+ JSON.stringify(promisedProposal)+ " -- "+ acceptedValue);
            return {
                name: name,
                peer: PORT,
                promise: false,
                highestProposal: promisedProposal,
                value: acceptedValue
            };
        }
    }
    else if (RECEIVED_PROPOSALS[name].hasOwnProperty(instance)) {
        // We have received a previous proposal for this
        // instance, but we haven't accepted any value yet
        var promisedProposal = RECEIVED_PROPOSALS[name][instance].proposal;

        helper.log("handlePropose", "cli.js", "previously promised:", JSON.stringify(promisedProposal));
        if (helper.greaterThan(proposal, promisedProposal)) {
            // The proposal is igher than our previously
            // promised proposal, so we promise not to accept
            // anything higher than it
            RECEIVED_PROPOSALS[name][instance].proposal = proposal;

            helper.log("handlePropose", "cli.js", "promising:"+ proposal);
            return {
                name: name,
                peer: PORT,
                promise: true,
                highestProposal: proposal,
                value: NO_VALUE
            };
        }
        else {
            // This proposal number is less than the one
            // we promised, so we reject it, and return
            // the one we promised

            helper.log("handlePropose", "cli.js", "rejecting:", proposal);
            return {
                name: name,
                peer: PORT,
                promise: false,
                highestProposal: promisedProposal,
                value: NO_VALUE
            };
        }
    }
    else {
        // This is a brand new instance for us,
        // so we can do whatever we want

        // Store that this is the highest proposal number
        // we've seen
        RECEIVED_PROPOSALS[name][instance] = {
            proposal: proposal,
            value: NO_VALUE
        };

        helper.log("handlePropose", "cli.js", "first proposal, accepting",proposal);
        // And return a promise saying we accept it
        return {
            name: name,
            peer: PORT,
            promise: true,
            highestProposal: proposal,
            value: NO_VALUE
        };
    }
    helper.log("handlePropose", "cli.js", "Return");
};

var handleAccept = function(name, instance, proposal, value) {

    helper.log("handleAccept", "cli.js", "Enter");
    helper.log("handleAccept", "cli.js", "Handling Accept w Params", {name: name, instance: instance, proposal: proposal, value: value});
    helper.log("handleAccept", "cli.js", "Received Proposals", RECEIVED_PROPOSALS);
    helper.log("handleAccept", "cli.js", "Received Accepts", RECEIVED_ACCEPTS);

    var promisedProposal = RECEIVED_PROPOSALS[name][instance].proposal;
    if (helper.greaterThan(proposal, promisedProposal)) {
        // We haven't promised a higher proposal,
        // so we can still accept this request
        helper.log("handleAccept", "cli.js", "beginning to accept");

        if (RECEIVED_ACCEPTS[name].hasOwnProperty(instance)) {
            // We're checking to see if we already accepted
            // something previously. This is just for logging
            // purposes
            var acceptedProposal = RECEIVED_ACCEPTS[name][instance].proposal;
            var acceptedValue = RECEIVED_ACCEPTS[name][instance].value;

            helper.log("handleAccept", "cli.js", "previously accepted proposal:"+ acceptedProposal+" - value: "+ acceptedValue);
        }

        // Store the accepted proposal and value
        // in the accept store
        RECEIVED_ACCEPTS[name][instance] = {
            proposal: proposal,
            value: value
        };

        helper.log("handleAccept", "cli.js", "Storing The Proposal {1},{2} = {3}".replace("{1}", name).replace("{2}",instance).replace("{3}", value), RECEIVED_ACCEPTS);

        // Now we need to send out learn requests
        helper.log("handleAccept", "cli.js", "Sending Learn Requests");
        _.each(PEERS, function(peer) {

          var rpcClient = new rpc.Client({port: peer.port, host: peer.host});
          helper.log("handleAccept", "cli.js", "Requesting Learn To", peer);
          rpcClient.call(
            {
              "jsonrpc" : 2.0,
              "method"  : "learn",
              "params"  : {
                  name: name,
                  instance: instance,
                  value: value,
                  peer: PORT
              },
              "id"      : randstr.generate(),
            },
            function(req, res){
              helper.log("handleAccept > rpcClient", "cli.js", "Received Learn Response", {peer, req, res});
            }
          );
        });
        helper.log("handleAccept", "cli.js", "accepted", {proposal,value});
        return {
            accepted: true,
            peer: PORT
        };
    }
    else {
        // We've already promised to another higher
        // proposal, so we just do nothing
        helper.log("handleAccept", "cli.js", "rejected", promisedProposal);
        return {
            accepted: false,
            peer: PORT
        };
    }
    helper.log("handleAccept", "cli.js", "Return");
};

var handleLearn = function(name, instance, value, peer) {

    helper.log("handleLearn", "cli.js", "Enter");

    if (FULLY_LEARNT_VALUES[name].hasOwnProperty(instance)) {
        // We've already fully learned a value,
        // because we received a quorum for it
        helper.log("handleLearn", "cli.js", "ignoring, previously fully learned: "+ name + " : " + FULLY_LEARNT_VALUES[name][instance]);
        return;
    }

    // Track how many acceptors accepted
    // a particular value
    var numAcceptors = 0;

    // Get the learnt information for this particular instance (or initialize it)
    var learned = TENTATIVELY_FULLY_LEARNT_VALUES[name][instance] = (TENTATIVELY_FULLY_LEARNT_VALUES[name][instance] || {});
    if (learned.hasOwnProperty(value)) {
        // We've already seen this value for this instance, so
        // we just increment the value
        numAcceptors = (++learned[value]);
    }
    else {
        // First time we've seen this value, so we set it to 1
        numAcceptors = learned[value] = 1;
    }

    if (numAcceptors >= Math.floor((NUM_PEERS / 2) + 1)) {
        // More than half the acceptors have accepted
        // this particular value, so we have now fully
        // learnt it
        helper.log("handleLearn", "cli.js",  "fully learned: ("+ name+ ","+ instance+ ","+ value+ ")");
        FULLY_LEARNT_VALUES[name][instance] = value;

        if (instance >= CURRENT_INSTANCE[name]) {
            // The instance number is higher than the one
            // we have locally, which could happen if we got
            // out of sync. As such, we set our own instance
            // number to one higher.
            helper.log("handleLearn", "cli.js", "setting instance:"+ (instance + 1));
            CURRENT_INSTANCE[name] = instance + 1;
        }

        if (FULLY_LEARNT_LISTENERS[name][instance] !== null) {
            _.each(FULLY_LEARNT_LISTENERS[name][instance], function(listener) {
                helper.log("handleLearn", "cli.js",  "dispatching to listener");
                listener(value);
            });
            FULLY_LEARNT_LISTENERS[name][instance] = null;
        }
    }
    helper.log("handleLearn", "cli.js", "Return");
};

var initiateAccept = function(name, instance, proposal, value, originalValue, finalResponse) {

    helper.log("initiateAccept", "cli.js", "Enter");
    // Create a set of tasks, where each task is sending the ACCEPT
    // message to a specific peer
    var acceptTasks = {};
    _.each(PEERS, function(peer) {
        helper.log("initiateAccept", "cli.js", "SEND ACCEPT("+ name+ ","+ instance+ ","+ JSON.stringify(proposal)+ ","+ value, ")"+ "from "+ PORT+" to "+peer.port);
        acceptTasks[peer.port] = function(done) {

          var rpcClient = new rpc.Client({port: peer.port, host: HOST});

          rpcClient.call(
            {
              "jsonrpc" : 2.0,
              "method"  : "accept",
              "params"  : {
                  name: name,
                  instance: instance,
                  proposal: proposal,
                  value: value
              },
              "id"      : randstr.generate(),
            },function(err, response) {
                var received = null;
                if (err && err.code === TIMEOUT_ERROR) {
                    // If we received a timeout, then
                    // simply mark this, and keep going
                    helper.log("initiateAccept", "cli.js", "RECEIVED accept-response timeout from: "+ peer.port);
                    received = TIMEOUT_ERROR;
                }
                else if (response.error === DROPPED_ERROR) {
                    // If we received a drop message response,
                    // then simply mark this, and keep going
                    helper.log("initiateAccept", "cli.js", "RECEIVED accept-response drop from: "+ peer.port);
                    received = DROPPED_ERROR;
                }
                else {
                    // If we received an actual value, then
                    // simply mark this, and keep going
                    helper.log("initiateAccept", "cli.js", "RECEIVED accept-response from: "+ peer.port);
                    received = response;
                }
                helper.log("initiateAccept", "cli.js", "accept-response", received);
                done(null, received);
            });
        };
    });

    // Execute all the ACCEPT tasks
    async.parallel(acceptTasks, function(err, accepted) {
        // Note how many people promised
        var numAccepted = 0;
        var numPeersDown = 0;
        _.each(accepted, function(response) {
            if (response === TIMEOUT_ERROR || response === DROPPED_ERROR) {
                // Let's count how many people died on us, so we know
                // whether we should keep trying or if this is a catastrophic
                // failure
                numPeersDown++;
                return;
            }
            else if (response.result.accepted) {
                numAccepted++;
            }
        });

        // If less than a majority accepted,
        // then we start over
        if (numAccepted >= Math.floor(NUM_PEERS / 2 + 1)) {
            helper.log("handleLearn", "cli.js", "majority accepted", accepted);
            finalResponse(null, {accepted: true, instance: instance});
        }
        else if (numPeersDown >= Math.floor(NUM_PEERS / 2 + 1)) {
            // This is a catastrophic failure, let's cut our losses
            // More than half our peers seem to be down, so we just
            // respond to the client immediately
            finalResponse(PEERS_DOWN);
        }
        else {
            helper.log("handleLearn", "cli.js", "majority rejected", accepted);
            initiateProposal(name, instance, originalValue, finalResponse);
        }
    });
    helper.log("initiateAccept", "cli.js", "Return");
};

var initiateProposal = function(name, instance, originalValue, finalResponse) {

    helper.log("initiateProposal", "cli.js", "Enter");

    var value = originalValue;
    var number = PROPOSAL_COUNTER[instance] = (PROPOSAL_COUNTER[instance] || 0) + 1;
    var proposal = {
        peer: PORT,
        number: number
    };

    // Create a set of tasks, where each task is sending the PROPOSE
    // message to a specific peer
    var proposeTasks = {};
    helper.log("initiateProposal", "cli.js", "All peers: "+ JSON.stringify(PEERS));
    _.each(PEERS, function(peer) {
        helper.log("initiateProposal", "cli.js", "Current peer: "+ JSON.stringify(peer));
        proposeTasks[peer.port] = function(done) {
            helper.log("initiateProposal", "cli.js", "SEND PROPOSE("+ name+ ","+ instance+ ","+ JSON.stringify(proposal)+ ")"+ "from: "+ PORT + " to: " + peer.port);

            var rpcClient = new rpc.Client({port: peer.port, host: HOST});

            rpcClient.call(
              {
                "jsonrpc" : 2.0,
                "method"  : "propose",
                "params"  : {
                    name: name,
                    instance: instance,
                    proposal: proposal
                },
                "id"      : randstr.generate(),
              }, function(err, response) {
                  var received = null;
                  if (err && err.code === TIMEOUT_ERROR) {
                      // If we received a timeout, then
                      // simply mark this, and keep going
                      helper.log("initiateProposal", "cli.js", "RECEIVED propose-response timeout from "+ peer.port);
                      received = TIMEOUT_ERROR;
                  }
                  else if (response.error === DROPPED_ERROR) {
                      // If we received a drop message response,
                      // then simply mark this, and keep going
                      helper.log("initiateProposal", "cli.js", "RECEIVED propose-response drop from "+ peer.port);
                      received = DROPPED_ERROR;
                  }
                  else {
                      // If we received an actual value, then
                      // simply mark this, and keep going
                      helper.log("initiateProposal", "cli.js", "RECEIVED propose-response from "+ peer.port);
                      received = response;
                  }
                  helper.log("initiateProposal", "cli.js", "done args "+ JSON.stringify(received));
                  done(null, received);
              }
            );
        };
    });

    // Execute all the PROPOSE tasks
    async.parallel(proposeTasks, function(err, received) {

        // Keep track of the highest overall proposal
        var highestProposal = { number: -1, peer: -1};

        // Keep track of the highest proposal that had a value
        // attached, and the value
        var highestProposalWithValue = { number: -1, peer: -1};
        var newValue = null;

        // Note how many people promised
        var numPromised = 0;
        var numPeersDown = 0;
        _.each(received, function(response) {
          // response = response.result;
            helper.log("async.parallel(proposeTasks)", "cli.js", "response: "+ JSON.stringify(response));
            if (response === TIMEOUT_ERROR || response === DROPPED_ERROR) {
                // Let's count how many people died on us, so we know
                // whether we should keep trying or if this is a catastrophic
                // failure
                numPeersDown++;
                return;
            }
            else if (response.result.promise) {
                // OK, they promised to uphold our proposal
                numPromised++;

                if (response.result.value !== NO_VALUE) {
                    // This response had a value, so we see if it is greater than
                    // our previous proposal
                    if (helper.greaterThan(response.result.highestProposal, highestProposalWithValue)) {
                        highestProposalWithValue = response.result.highestProposal;
                        value = response.result.value;

                        helper.log("initiateProposal", "cli.js", "Switching to value "+ value+ " from: " + highestProposalWithValue.peer);
                    }
                }
            }
            else {
                // They rejected our proposal, and so we note what proposal
                // they return so we can set ours up
                helper.log("initiateProposal", "cli.js", "response: "+ JSON.stringify(response));
                helper.log("initiateProposal>async>proposeTasks", "cli.js", "highestProposal: "+ JSON.stringify(response.result.highestProposal));
                if (helper.greaterThan(response.result.highestProposal, highestProposal)) {
                    highestProposal = response.result.highestProposal;
                }
            }
        });

        if (numPromised >= Math.floor(NUM_PEERS / 2 + 1)) {
            // The proposal was accepted by a majority - hurrah!
            // We now send the ACCEPT requests to each acceptor.
            helper.log("initiateProposal", "cli.js", "Proposal accepted by majority");

            if (value !== originalValue && originalValue !== TEST_VALUE) {
                // If we changed values, we still need to try and store
                // the original value the user sent us,
                // so we simply go again
                initiateProposal(name, CURRENT_INSTANCE[name]++, originalValue, finalResponse);

                // We reset the final response in the case where the value changed,
                // so that we only respond for the original request coming in from the
                // client, not for this intermediate value we are storing
                finalResponse = function() {};
            }
            else if (value !== originalValue && originalValue === TEST_VALUE) {
                // If the original value is null and the proposal was promised,
                // then we don't want to initiate a new proposal for the TEST_VALUE value,
                // and we don't want to do anything for the new value, as we
                // will simply learn it
                finalResponse = function() {};
            }
            else if (originalValue === TEST_VALUE && value === TEST_VALUE) {
                // If this is a test value (because we're trying to force a learn cycle),
                // and our value was accepted just like that, then we simply
                // return that there is no value, and short circuit
                finalResponse(null, VALUE_NOT_FOUND);
                return;
            }

            // Initiate the ACCEPT phase, but if we changed
            initiateAccept(name, instance, proposal, value, originalValue, finalResponse);
        }
        else if (numPeersDown >= Math.floor(NUM_PEERS / 2 + 1)) {
            // This is a catastrophic failure, let's cut our losses
            // More than half our peers seem to be down, so we just
            // respond to the client immediately
            finalResponse(PEERS_DOWN);
        }
        else {
            // We failed to update because somebody beat us in terms
            // of proposal numbers, so we just try again with a higher
            // proposal number
            var newNumber = highestProposal.number + 1;

            helper.log("initiateProposal", "cli.js", "Proposal rejected, setting new proposal number:"+ newNumber);
            PROPOSAL_COUNTER[instance] = newNumber;

            initiateProposal(name, instance, originalValue, finalResponse);
        }
    });
    helper.log("initiateProposal", "cli.js", "Return");
};

var initializeStorageForName = function(name) {

    helper.log("initializeStorageForName", "cli.js", "Enter");

    // If we haven't seen this name before,
    // then we initialize all our storage for it
    if (!RECEIVED_PROPOSALS.hasOwnProperty(name)) {
        helper.log("initializeStorageForName", "cli.js", "INITIALIZED STORAGE FOR "+ name);
        RECEIVED_PROPOSALS[name] = {};
        RECEIVED_ACCEPTS[name] = {};
        FULLY_LEARNT_VALUES[name] = {};
        TENTATIVELY_FULLY_LEARNT_VALUES[name] = {};
        CURRENT_INSTANCE[name] = 1;
        FULLY_LEARNT_LISTENERS[name] = {};
    }

    helper.log("initializeStorageForName", "cli.js", "Return");
};


///************************* PAXOSEND *******************************///

var putVal = function(name, value) {

    helper.log("putVal", "cli.js", "Enter");
    helper.log("putVal", "cli.js", "Key: " + name + " Val:" + value);

    // Initialize our storage for this name
    initializeStorageForName(name);

    // Get the next proposal number and build the proposal
    var instance = CURRENT_INSTANCE[name]++;
    initiateProposal(name, instance, value, function(err, result) {
        if (err) {
            // If there was an error, let's make it as if this never
            // never happened
            CURRENT_INSTANCE[name]--;
            delete PROPOSAL_COUNTER[name];
            helper.log("putVal>initiateProposal", "cli.js", "Error");
            // res.json(err);
        }
        else {
            helper.log("putVal>initiateProposal", "cli.js", "Result",result);
            // res.json(result);
        }
    });

    helper.log("putVal", "cli.js", "Return");
}

var getVal = function(name, instance) {

  helper.log("getVal", "cli.js", "Enter");
  helper.log("getVal", "cli.js", "Key: " + name + " Inst:" + instance);
  helper.log("getVal", "cli.js", "Fully Learnt Values", FULLY_LEARNT_VALUES);

  // Initialize our storage for this name
  initializeStorageForName(name);

  if (FULLY_LEARNT_VALUES[name][instance] !== null && FULLY_LEARNT_VALUES[name][instance] !== undefined) {

      helper.log("getVal", "cli.js", "FETCH EARLY RESULT - " + FULLY_LEARNT_VALUES[name][instance]);
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
      helper.log("getVal", "cli.js", "FETCH FAILED - KEY DOESN'T EXIST");
      var listeners = FULLY_LEARNT_LISTENERS[name][instance] = (FULLY_LEARNT_LISTENERS[name][instance] || []);
      listeners.push(function(value) {
          helper.log("getVal", "cli.js", "FETCH listener invoked!");
          helper.log("getVal", "cli.js", JSON.stringify({
              found: true,
              name: name,
              instance: instance,
              value: value
          }));
          // if (res !== null) {
          //     helper.log("getVal", "cli.js", "FETCH listener invoked!");
          //     helper.log("getVal", "cli.js", JSON.stringify({
          //         found: true,
          //         name: name,
          //         instance: instance,
          //         value: value
          //     }));
          // }
          // else {
          //     helper.log("getVal", "cli.js", "FETCH listener invoked too late!")
          // }
      });

      // setTimeout(LEARN_TIMEOUT, function(req, res) {
      //     helper.log("getVal", "cli.js", "FETCH timeout!");
      //     helper.log("getVal", "cli.js", "Return with:", {
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
      initiateProposal(name, instance, TEST_VALUE, function(err, result) {
          if (err) {
              helper.log("getVal > initiateProposal", "cli.js", "Error", err);
              // res.json(err);
          }
          else {
              if (result === VALUE_NOT_FOUND) {
                  helper.log("getVal > initiateProposal", "cli.js", "Value Not Found");
                  // res.send({found: false}, 404)
              }
              else {
                  helper.log("getVal > initiateProposal", "cli.js", "Not Found. Returned:", result);
                  // res.send({found: false, message: "WTF: " + result}, 500);
              }
          }

          // res = null;
      });
  }
  helper.log("getVal", "cli.js", "Return");
}

var testFunction = function(args, callback){

  var error, result = 0;

  if( args.length === 2 ){
    result = args[0] + args[1];
  } else if(args.length > 2){
    args.forEach(function(value, index){
      result += value;
    });
  }else {
    error = {code : 402, message : "Something weird happened here. No here!"};
  }

  callback(error, result);
}

var addNode = function(args, callback) {

  helper.log("addNode", "cli.js", "Enter");
  helper.log("addNode", "cli.js", JSON.stringify(args));

    var peerPort    = args.node.port;
    var peerHost    = args.node.host;

    PEERS[peerPort] = {
        port: peerPort,
        host: peerHost,
        send: function(rpcName, content, callback) {

            var rpcOpt = {
              port : peerPort,
              host : host,
            }

            var rpcClient = rpc.Client(rpcOpt);

            rpcClient.call(
              {
                "jsonrpc" : 2.0,
                "method"  : path,
                "params"  : rpcName,
                "id"      : randstr.generate(),
              }, function(err, res){
                  callback = callback || function() {};
                  if (err) {
                    helper.log("addNode", "cli.js", "Error here");
                  } else{
                    helper.log("addNode > rpcClient", "cli.js", "No Error");
                  }
                  helper.log("addNode > rpcClient", "cli.js", JSON.stringify(res));
                  callback(err, response);
              }
            );
        }
    };

    helper.log("addNode", "cli.js", JSON.stringify(PEERS));
    helper.log("addNode", "cli.js", JSON.stringify(PEERS[peerPort]));

    NUM_PEERS += 1;

    callback(false, {message: "Node Added", "node": {port: PORT, host: HOST}});

    helper.log("addNode", "cli.js", "Return");
}

var connect = function(rport, rhost, port, host){

  helper.log("connect", "cli.js", "Enter");
  helper.log("connect", "cli.js", "Params - rport: {0}, rhost: {1}, port: {2}, host: {3}"
              .replace("{0}", rport).replace("{1}", rhost).replace("{2}", port).replace("{3}", host));

  var rpcClient = new rpc.Client({port: rport, host: rhost});

  rpcClient.call(
    {
      "jsonrpc" : 2.0,
      "method"  : "addNode",
      "params"  : {"node" : {port: port, host: host}},
      "id"      : 0,
    }, function(err, res){
      helper.log("rpcClient.call", "cli.js", JSON.stringify(res));
      if (err) {
        helper.log("rpcClient.call", "cli.js", "SOMETHING HAPPENED AT SERVER RPC!");
      }else{
        helper.log("rpcClient.call", "cli.js", "EXECUTED SUCCESFULLY!");
        addNode(res.result, function(){});
      }
    }
  );
}

var proposeVal = function(req, callback) {

    helper.log("proposeVal", "cli.js", "Enter");

    var name = req.name;
    var instance = req.instance;
    var proposal = req.proposal;

    helper.log("proposeVal", "cli.js", "RECEIVE PROPOSE("+ name+ ","+ instance+ ","+ JSON.stringify(proposal)+ ")");

    // Initialize our storage for this name
    initializeStorageForName(name);

    var result = handlePropose(name, instance, proposal);

    callback(false, result);

    helper.log("proposeVal", "cli.js", "Return");
}

var acceptVal = function(req, callback){

    helper.log("acceptVal", "cli.js", "Enter");

    var name = req.name;
    var instance = req.instance;
    var proposal = req.proposal;
    var value = req.value;

    helper.log("acceptVal", "cli.js", "RECEIVE ACCEPT("+ name+ ","+ instance+ ","+ JSON.stringify(proposal)+ ","+ JSON.stringify(value)+")");

    // Initialize our storage for this name
    initializeStorageForName(name);

    var result = handleAccept(name, instance, proposal, value);

    callback(false, result);

    helper.log("acceptVal", "cli.js", "Return");
}

var learnVal = function(req, callback){

    helper.log("learnVal", "cli.js", "Enter");

    var name = req.name;
    var instance = req.instance;
    var value = req.value;
    var peer = req.peer;

    helper.log("learnVal", "cli.js", "RECEIVE LEARN("+ name+ ","+ instance+ ","+ JSON.stringify(value)+ ","+ JSON.stringify(peer)+")");

    // Initialize our storage for this name
    initializeStorageForName(name);

    var result = handleLearn(name, instance, value, peer);

    helper.log("learnVal", "cli.js", "result", result);
    callback(false, result);

    helper.log("learnVal", "cli.js", "Return");
}

var rpcOpt = {
  port : PORT,
  host : HOST,
}

var rpcServer = new rpc.Server(rpcOpt);

rpcServer.addMethod('addNode', addNode);
// rpcServer.addMethod('put', putVal);
// rpcServer.addMethod('get', getVal);
rpcServer.addMethod('propose', proposeVal);
rpcServer.addMethod('accept', acceptVal);
rpcServer.addMethod('learn', learnVal);

rpcServer.start(function(error){
  if (error) helper.log("rpcServerStart", "cli.js", "** BOOTING: RPC SERVER ERROR!");
  else       helper.log("rpcServerStart", "cli.js", "** BOOTING: RPC SERVER UP ON PORT " + PORT);
  addNode({"node":{port:PORT,host:HOST}}, function(){});
  async.whilst(
    function(){
      return true;
    },
    function(next){
      prompt.start();
      prompt.get(['cmd'], function(err, res){
        helper.log("mainLoop", "cli.js", "CMD: " + res.cmd);
        if (res.cmd == "out")  return;
        switch (res.cmd) {
          case "out":
            return;
          case "exit":
            process.exit();
          case "peers":
            helper.log("mainLoop", "cli.js", "Peers", PEERS);
            break;
          case "values":
            helper.log("mainLoop", "cli.js", "Fully Learnt Values", FULLY_LEARNT_VALUES);
            break;
          default:{
            var args = res.cmd.split(":");
            if (args.length == 2 && args[0] == "port") {
              if (args[1] == PORT) {
                helper.log("mainLoop", "cli.js", "Self connection not allowed!");
              } else{
                connect(args[1], HOST, PORT, HOST);
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
      helper.log("rpcServerStart", "cli.js", "** WHILE: LOOP FINISHED W/ ERROR!");
    }
  );
});
