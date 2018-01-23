'use strict';

const rpc  = require("jsonrpc-node");
var helper = require('./helper');
const async = require('async');
const _ = require("underscore");

var DROP_PROBABILITY = 0.0;
var REQUEST_TIMEOUT  = 2000;
var LEARN_TIMEOUT    = 2000;
var DROPPED_ERROR    = "DROPPEDPACKET";
var TIMEOUT_ERROR    = "ETIMEDOUT";
var VALUE_NOT_FOUND  = "NO VALUE FOUND";
var NO_VALUE         = "__0xDEADBEEF";
var TEST_VALUE       = "__0xBEEFDEAD";
var PEERS_DOWN       = {accepted: false, message: "PEERS ARE DOWN"};

var reqNewConnection = function(px, port, host){

  helper.log("reqNewConnection", "paxos.js", "params", {port, host});
  helper.log("reqNewConnection", "paxos.js", "px params", {port: px.port, host:px.host});
  // return;
  var rpcClient = new rpc.Client();
  rpcClient.connect(port, host);

  rpcClient.call(
    "handleJoin",
    helper.prepRPCArgs(false, "Add Me.", {node: {port:px.port, host:px.host}, direct: true}),
    function(err, res){
        helper.log("reqNewConnection", "paxos.js", JSON.stringify(res));
        if (err) {
          helper.log("reqNewConnection", "paxos.js", "SOMETHING HAPPENED AT SERVER RPC!");
        }else{
          helper.log("reqNewConnection", "paxos.js", "EXECUTED SUCCESFULLY!");
          // handleJoin(res, function(){});
        }
      }
    );
}

var initiateProposal = function(px, name, instance, originalValue, finalResponse) {

    helper.log("initiateProposal", "paxos.js", "Enter", {name, instance, originalValue, finalResponse});

    var total_peers = px.getTotalPeers();

    helper.log("initiateProposal", "paxos.js", "gettotal", total_peers);

    var value = originalValue;
    var number = px.PROPOSAL_COUNTER[instance] = (px.PROPOSAL_COUNTER[instance] || 0) + 1;
    var proposal = {
        peer: px.port,
        number: number
    };

    // Create a set of tasks, where each task is sending the PROPOSE
    // message to a specific peer
    var proposeTasks = {};

    px.listPeers();
    _.each(px.peers, function(peer) {
        helper.log("initiateProposal", "paxos.js", "Current peer: ", peer.port);
        proposeTasks[peer.port] = function(done) {
            helper.log("initiateProposal", "paxos.js", "SEND PROPOSE ", { name: name,instance: instance,proposal: proposal, oport: px.port, rport: peer.port });
            // try {
              peer.socket.call(
                "propose",
                [{
                  name: name,
                  instance: instance,
                  proposal: proposal
                }],
                function(err, response) {
                    helper.log("initiateProposal", "paxos.js", "Callback here", {err: err, res: response});

                    response = response[0];
                    var received = null;
                    if (err && err.code === TIMEOUT_ERROR) {
                        // If we received a timeout, then
                        // simply mark this, and keep going
                        helper.log("initiateProposal", "paxos.js", "RECEIVED propose-response timeout from ", {port: peer.port});
                        received = TIMEOUT_ERROR;
                    }
                    else if (response.error === DROPPED_ERROR) {
                        // If we received a drop message response,
                        // then simply mark this, and keep going
                        helper.log("initiateProposal", "paxos.js", "RECEIVED propose-response drop from ", {port: peer.port});
                        received = DROPPED_ERROR;
                    }
                    else {
                        // If we received an actual value, then
                        // simply mark this, and keep going
                        helper.log("initiateProposal", "paxos.js", "RECEIVED propose-response from ", {port: peer.port});
                        received = response.data;
                    }
                    helper.log("initiateProposal", "paxos.js", "done args: ", received);
                    done(null, received);
                }
              );
            // } catch (e) {
            //   helper.log("initiateProposal", "paxos.js", "Crashed w/ error", e);
            //   helper.log("initiateProposal", "paxos.js", "Can't connect. NODE DOWN!", peer);
            //   delete PEERS[peer.port];
            // } finally {
            //
            // }

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
            helper.log("async.parallel(proposeTasks)", "paxos.js", "response: ",response);
            if (response === TIMEOUT_ERROR || response === DROPPED_ERROR) {
              helper.log("initiateProposal", "paxos.js", "Let's count how many people died on us, so we know");
                // Let's count how many people died on us, so we know
                // whether we should keep trying or if this is a catastrophic
                // failure
                numPeersDown++;
                return;
            }
            else if (response["promise"]) {
                // OK, they promised to uphold our proposal
                helper.log("initiateProposal", "paxos.js", "OK, they promised to uphold our proposal");
                numPromised++;

                if (response["value"] !== NO_VALUE) {
                    // This response had a value, so we see if it is greater than
                    // our previous proposal
                    if (helper.greaterThan(response["highestProposal"], highestProposalWithValue)) {
                        highestProposalWithValue = response["highestProposal"];
                        value = response["value"];

                        helper.log("initiateProposal", "paxos.js", "Switching to value "+ value+ " from: " + highestProposalWithValue.peer);
                    }
                }
            }
            else {
                // They rejected our proposal, and so we note what proposal
                // they return so we can set ours up
                helper.log("initiateProposal", "paxos.js", "response: ",response);
                helper.log("initiateProposal>async>proposeTasks", "paxos.js", "highestProposal: ", {proposal: response["highestProposal"]});
                if (helper.greaterThan(response["highestProposal"], highestProposal)) {
                    highestProposal = response["highestProposal"];
                }
            }
        });

        // helper.log("initiateProposal", "paxos.js", "Checkin half condition");
        helper.log("initiateProposal", "paxos.js", "gettotal", "this.getTotalPeers()");
        helper.log("initiateProposal", "paxos.js", "gettotal", total_peers);

        if (numPromised >= Math.floor(total_peers / 2 + 1)) {
            // The proposal was accepted by a majority - hurrah!
            // We now send the ACCEPT requests to each acceptor.
            helper.log("initiateProposal", "paxos.js", "Proposal accepted by majority");

            if (value !== originalValue && originalValue !== TEST_VALUE) {
                helper.log("initiateProposal", "paxos.js", "If we changed values, we still need to try and store");
                // If we changed values, we still need to try and store
                // the original value the user sent us,
                // so we simply go again
                this.initiateProposal(px, name, px.CURRENT_INSTANCE[name]++, originalValue, finalResponse);

                // We reset the final response in the case where the value changed,
                // so that we only respond for the original request coming in from the
                // client, not for this intermediate value we are storing
                finalResponse = function() {};
            }
            else if (value !== originalValue && originalValue === TEST_VALUE) {
                helper.log("initiateProposal", "paxos.js", "If the original value is null and the proposal was promised,");
                // If the original value is null and the proposal was promised,
                // then we don't want to initiate a new proposal for the TEST_VALUE value,
                // and we don't want to do anything for the new value, as we
                // will simply learn it
                finalResponse = function() {};
            }
            else if (originalValue === TEST_VALUE && value === TEST_VALUE) {
              helper.log("initiateProposal", "paxos.js", "If this is a test value (because we're trying to force a learn cycle),");
                // If this is a test value (because we're trying to force a learn cycle),
                // and our value was accepted just like that, then we simply
                // return that there is no value, and short circuit
                finalResponse(null, VALUE_NOT_FOUND);
                return;
            }
            helper.log("initiateProposal", "paxos.js", "Initiate the ACCEPT phase, but if we changed");
            helper.log("initiateProposal", "paxos.js", "ACCEPT PHASE PARAMS", {name, instance, proposal, value, originalValue, finalResponse});
            // Initiate the ACCEPT phase, but if we changed
            // finalResponse(null, "InitAccept");
            initiateAccept(px, name, instance, proposal, value, originalValue, finalResponse);
            // this.acceptv();
        }
        else if (numPeersDown >= Math.floor(total_peers / 2 + 1)) {
          helper.log("initiateProposal", "paxos.js", "This is a catastrophic failure, let's cut our losses");
            // This is a catastrophic failure, let's cut our losses
            // More than half our peers seem to be down, so we just
            // respond to the client immediately
            finalResponse(PEERS_DOWN);
        }
        else {
            helper.log("initiateProposal", "paxos.js", "We failed to update because somebody beat us in terms");
            // We failed to update because somebody beat us in terms
            // of proposal numbers, so we just try again with a higher
            // proposal number
            var newNumber = highestProposal.number + 1;

            helper.log("initiateProposal", "paxos.js", "Proposal rejected, setting new proposal number:"+ newNumber);
            px.PROPOSAL_COUNTER[instance] = newNumber;

            initiateProposal(px, name, instance, originalValue, finalResponse);
        }
    });
    helper.log("initiateProposal", "paxos.js", "Return");
};

var initiateAccept = function(px, name, instance, proposal, value, originalValue, finalResponse) {

    helper.log("initiateAccept", "paxos.js", "Enter", {name, instance, proposal, value, originalValue, finalResponse});
    // Create a set of tasks, where each task is sending the ACCEPT
    // message to a specific peer
    var total_peers = px.getTotalPeers();

    var acceptTasks = {};
    _.each(px.peers, function(peer) {
        helper.log("initiateAccept", "paxos.js", "SEND ACCEPT", { name: name,instance: instance,proposal: proposal, oport: px.port, rport: peer.port, value: value });
        acceptTasks[peer.port] = function(done) {
          // try{
            peer.socket.call(
              "accept",
              [{
                  name: name,
                  instance: instance,
                  proposal: proposal,
                  value: value
              }],
              function(err, response) {
                  helper.log("initiateAccept", "paxos.js", "1response", {err, response});
                  var received = null;
                  response = response[0];
                  if (err && err.code === TIMEOUT_ERROR) {
                      // If we received a timeout, then
                      // simply mark this, and keep going
                      helper.log("initiateAccept", "paxos.js", "RECEIVED accept-response timeout from: "+ peer.port);
                      received = TIMEOUT_ERROR;
                  }
                  else if (response.error === DROPPED_ERROR) {
                      // If we received a drop message response,
                      // then simply mark this, and keep going
                      helper.log("initiateAccept", "paxos.js", "RECEIVED accept-response drop from: "+ peer.port);
                      received = DROPPED_ERROR;
                  }
                  else {
                      // If we received an actual value, then
                      // simply mark this, and keep going
                      helper.log("initiateAccept", "paxos.js", "RECEIVED accept-response from: "+ peer.port);
                      received = response.data;
                  }
                  helper.log("initiateAccept", "paxos.js", "accept-response", received);
                  done(null, received);
              }
            );
            // } catch (e) {
            //   helper.log("initiateAccept", "paxos.js", "Crashed w/ error", e);
            //   helper.log("initiateAccept", "paxos.js", "Can't connect. NODE DOWN!", peer.port);
            //   delete PEERS[peer.port];
            // } finally {
            //
            // }
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
            else if (response.accepted) {
                numAccepted++;
            }
        });

        // If less than a majority accepted,
        // then we start over
        if (numAccepted >= Math.floor(total_peers / 2 + 1)) {
            helper.log("handleLearn", "paxos.js", "majority accepted", accepted);
            finalResponse(null, {accepted: true, instance: instance});
        }
        else if (numPeersDown >= Math.floor(total_peers / 2 + 1)) {
            // This is a catastrophic failure, let's cut our losses
            // More than half our peers seem to be down, so we just
            // respond to the client immediately
            finalResponse(PEERS_DOWN);
        }
        else {
            helper.log("handleLearn", "paxos.js", "majority rejected", accepted);
            initiateProposal(px, name, instance, originalValue, finalResponse);
        }
    });
    helper.log("initiateAccept", "paxos.js", "Return");
}

var handleAccept = function(px, name, instance, proposal, value){

  helper.log("handleAccept", "paxos.js", "Enter w/ Params", {name: name, instance: instance, proposal: proposal, value: value});
  helper.log("handleAccept", "paxos.js", "Received Proposals", px.RECEIVED_PROPOSALS);
  helper.log("handleAccept", "paxos.js", "Received Accepts", px.RECEIVED_ACCEPTS);

  var promisedProposal = px.RECEIVED_PROPOSALS[name][instance].proposal;
  if (helper.greaterThan(proposal, promisedProposal)) {
      // We haven't promised a higher proposal,
      // so we can still accept this request
      helper.log("handleAccept", "paxos.js", "beginning to accept");

      if (px.RECEIVED_ACCEPTS[name].hasOwnProperty(instance)) {
          // We're checking to see if we already accepted
          // something previously. This is just for logging
          // purposes
          var acceptedProposal = px.RECEIVED_ACCEPTS[name][instance].proposal;
          var acceptedValue = px.RECEIVED_ACCEPTS[name][instance].value;

          helper.log("handleAccept", "paxos.js", "previously accepted", {acceptedProposal, acceptedValue});
      }

      // Store the accepted proposal and value
      // in the accept store
      px.RECEIVED_ACCEPTS[name][instance] = {
          proposal: proposal,
          value: value
      };

      helper.log("handleAccept", "paxos.js", "Storing The Proposal {1},{2} = {3}".replace("{1}", name).replace("{2}",instance).replace("{3}", value), px.RECEIVED_ACCEPTS);

      // Now we need to send out learn requests
      helper.log("handleAccept", "paxos.js", "Sending Learn Requests");
      _.each(px.peers, function(peer) {

        // try{
          var rpcClient = new rpc.Client();
          rpcClient.connect(peer.port, peer.host);

          helper.log("handleAccept", "paxos.js", "Requesting Learn To", peer.port);

          peer.socket.call(
            "learn",
            [{
              name: name,
              instance: instance,
              value: value,
              peer: PORT
            }],
            function(err, res){
              helper.log("handleAccept", "paxos.js", "1response", {err, res});
              if (err) {
                  helper.log("handleAccept > rpcClient", "paxos.js", "Error!", err);
              }else{
                // helper.log("handleAccept > rpcClient", "paxos.js", "Am I Here?");
                helper.log("handleAccept > rpcClient", "paxos.js", "Received Learn Response", {"peer": peer.port, "res": res});
                res = res[0];
                if (res["error"]) {

                }else {
                  helper.log("handleAccept > rpcClient", "paxos.js", "Gonna Handle Learn!", {name: res["data"]["name"], inst: res["data"]["instance"], val: res["data"]["value"], port: peer.port});
                  handleLearn(px, res["data"]["name"], res["data"]["instance"],res["data"]["value"], peer.port);
                }


                // if(res){
                //   if(res.result){
                //     if (res.result.name.indexOf("#join") > -1) {
                //       helper.log("handleAccept > rpcClient", "paxos.js", "Initiating connection", res.result.value);
                //       var node = JSON.parse(res.result.value);
                //       proceedWithJoin(node, PEERS);
                //       // connect(node.port, node.host, PORT, HOST);
                //     }
                //   }
                // }
              }
            }
          );
        // } catch (e) {
        //   helper.log("handleAccept > rpcClient", "paxos.js", "Crashed w/ error", e);
        //   helper.log("handleAccept > rpcClient", "paxos.js", "Can't connect. NODE DOWN!", peer.port);
        //   // delete this.PEERS[peer.port];
        // } finally {
        //
        // }
      });
      helper.log("handleAccept", "paxos.js", "accepted", {proposal,value});
      return {
          accepted: true,
          peer: px.port
      };
  }
  else {
      // We've already promised to another higher
      // proposal, so we just do nothing
      helper.log("handleAccept", "paxos.js", "rejected", promisedProposal);
      return {
          accepted: false,
          peer: px.port
      };
  }
  helper.log("handleAccept", "paxos.js", "Return");

}

var handleLearn = function(px, name, instance, value, peer){

  var what_did_i_learn = null;

  var total_peers = px.getTotalPeers();

  helper.log("handleLearn", "paxos.js", "Enter", {name: name, in: instance, v: value, port: peer.port});

  if (px.FULLY_LEARNT_VALUES[name].hasOwnProperty(instance)) {
      // We've already fully learned a value,
      // because we received a quorum for it
      helper.log("handleLearn", "paxos.js", "ignoring, previously fully learned ", {name: name, val: px.FULLY_LEARNT_VALUES[name][instance]});
      what_did_i_learn = {name: name, instance: instance, value: value};
      helper.log("handleLearn", "paxos.js", "Return with:", what_did_i_learn);
      return what_did_i_learn;
  }

  // Track how many acceptors accepted
  // a particular value
  var numAcceptors = 0;

  // Get the learnt information for this particular instance (or initialize it)
  px.TENTATIVELY_FULLY_LEARNT_VALUES[name][instance] = (px.TENTATIVELY_FULLY_LEARNT_VALUES[name][instance] || {});

  helper.log("handleLearn", "paxos.js", "TENTATIVELY_FULLY_LEARNT_VALUES", px.TENTATIVELY_FULLY_LEARNT_VALUES);

  if (px.TENTATIVELY_FULLY_LEARNT_VALUES[name][instance].hasOwnProperty(value)) {
      // We've already seen this value for this instance, so
      // we just increment the value
      helper.log("handleLearn", "paxos.js", "We've already seen this value for this instance", px.TENTATIVELY_FULLY_LEARNT_VALUES[name][instance][value]);
      numAcceptors = (++px.TENTATIVELY_FULLY_LEARNT_VALUES[name][instance][value]);
  }
  else {
      // First time we've seen this value, so we set it to 1
      numAcceptors = px.TENTATIVELY_FULLY_LEARNT_VALUES[name][instance][value] = 1;
  }

  if (numAcceptors >= Math.floor((total_peers / 2) + 1)) {
      // More than half the acceptors have accepted
      // this particular value, so we have now fully
      // learnt it
      helper.log("handleLearn", "paxos.js",  "fully learned", {name,instance,value});
      px.FULLY_LEARNT_VALUES[name][instance] = value;
      what_did_i_learn = {name: name, instance: instance, value: value};

      if (instance >= px.CURRENT_INSTANCE[name]) {
          // The instance number is higher than the one
          // we have locally, which could happen if we got
          // out of sync. As such, we set our own instance
          // number to one higher.
          helper.log("handleLearn", "paxos.js", "setting instance ", (instance + 1));
          px.CURRENT_INSTANCE[name] = instance + 1;
      }

      if (px.FULLY_LEARNT_LISTENERS[name][instance] !== null) {
          _.each(px.FULLY_LEARNT_LISTENERS[name][instance], function(listener) {
              helper.log("handleLearn", "paxos.js",  "dispatching to listener", listener);
              listener(value);
          });
          px.FULLY_LEARNT_LISTENERS[name][instance] = null;
      }

      helper.log("handleLearn", "paxos.js",  "Is it a join request?");
      if(name.indexOf("#join") > -1) {
        helper.log("handleLearn", "paxos.js",  "It's a join request!");
        var node_params = JSON.parse(value);
        helper.log("handleLearn", "paxos.js",  "Node params", node_params);
        px.addNode(node_params.port, node_params.host);
        reqNewConnection(px, node_params.port, node_params.host);
      }
  }
  helper.log("handleLearn", "paxos.js", "Return (end) with:", what_did_i_learn);
  return what_did_i_learn;
}

class Paxos {

    constructor (port, host) {
        helper.log("PAXOS", "paxos.js", "Constructor", {port, host});
        this.port = port;
        this.host = host;
        this.peers = {};
        this.RECEIVED_PROPOSALS = {};
        this.RECEIVED_ACCEPTS = {};
        this.FULLY_LEARNT_VALUES = {};
        this.TENTATIVELY_FULLY_LEARNT_VALUES = {};
        this.FULLY_LEARNT_LISTENERS = {};
        this.CURRENT_INSTANCE = {};
        this.PROPOSAL_COUNTER = {};
        this.JOINLIST = {};
    }

    addNode(port, host){
      helper.log("addNode", "paxos.js", "params", {port, host});
      var client = new rpc.Client();
      client.connect(port, host);
      this.peers[port] = {
        port: port,
        host: host,
        socket: client
      };
    }

    newConnection(port, host){
      if(port in this.peers){
        var client = new rpc.Client();
        client.connect(port, host);
        this.peers[port].socket = client;
      }
    }

    getPeers(){
      return this.peers;
    }

    listPeers(){
      _.each(this.peers, function(peer) {
          console.log("++ " + peer.port);
      });
    }

    getTotalPeers(){
      return _.size(this.peers);
    }

    getValueByInstance(name, instance){
      return this.FULLY_LEARNT_VALUES[name][instance];
    }

    setValueByInstance(name, instance, value){
      this.FULLY_LEARNT_VALUES[name][instance] = value;
      return this.FULLY_LEARNT_VALUES[name][instance];
    }

    incInstance(name){
      return this.CURRENT_INSTANCE[name]++;
    }

    decInstance(){
      return this.CURRENT_INSTANCE[name]--;
    }

    deleteProposalCounter(name){
      delete this.PROPOSAL_COUNTER[name];
    }

    getValues(){
      return this.FULLY_LEARNT_VALUES;
    }

    initializeStorageForName(name) {

        helper.log("initializeStorageForName", "paxos.js", "Enter");

        // If we haven't seen this name before,
        // then we initialize all our storage for it
        if (!this.RECEIVED_PROPOSALS.hasOwnProperty(name)) {
            helper.log("initializeStorageForName", "paxos.js", "INITIALIZED STORAGE FOR ", name);
            this.RECEIVED_PROPOSALS[name] = {};
            this.RECEIVED_ACCEPTS[name] = {};
            this.FULLY_LEARNT_VALUES[name] = {};
            this.TENTATIVELY_FULLY_LEARNT_VALUES[name] = {};
            this.CURRENT_INSTANCE[name] = 1;
            this.FULLY_LEARNT_LISTENERS[name] = {};
        }

        helper.log("initializeStorageForName", "paxos.js", "Return");
    };

    propose(){

    }

    handlePropose(name, instance, proposal){

      helper.log("handlePropose", "paxos.js", "Enter", {name, instance, proposal});

      if (this.RECEIVED_ACCEPTS[name].hasOwnProperty(instance)) {
          // We have already accepted something for this
          // instance
          var accepted = this.RECEIVED_ACCEPTS[name][instance];
          var acceptedProposal = accepted.proposal;
          var acceptedValue = accepted.value;

          // We also need to get our minimum promised proposal
          // number
          var promisedProposal = this.RECEIVED_PROPOSALS[name][instance].proposal;

          helper.log("handlePropose", "paxos.js", "previously accepted", {promisedProposal, acceptedValue});

          if (helper.greaterThan(proposal, promisedProposal)) {
              // The proposal is higher than our accepted proposal,
              // so we respond with the previously accepted proposal,
              // and the value

              // However, we also need to note this new proposal,
              // because we promised not to accept anything less than it
              this.RECEIVED_PROPOSALS[name][instance].proposal = proposal;

              helper.log("handlePropose", "paxos.js", "promising (already accepted)", {proposal, acceptedValue});

              return {
                  name: name,
                  peer: this.port,
                  promise: true,
                  highestProposal: promisedProposal,
                  value: acceptedValue
              };
          }
          else {
              // This proposal number is less, so we reject it,
              // noting our current highest proposal number and the
              // value we already accepted

              helper.log("handlePropose", "paxos.js", "rejecting (already accepted)"+ {promisedProposal, acceptedValue});
              return {
                  name: name,
                  peer: this.port,
                  promise: false,
                  highestProposal: promisedProposal,
                  value: acceptedValue
              };
          }
      }
      else if (this.RECEIVED_PROPOSALS[name].hasOwnProperty(instance)) {
          // We have received a previous proposal for this
          // instance, but we haven't accepted any value yet
          var promisedProposal = this.RECEIVED_PROPOSALS[name][instance].proposal;

          helper.log("handlePropose", "paxos.js", "previously promised:", promisedProposal);

          if (helper.greaterThan(proposal, promisedProposal)) {
              // The proposal is igher than our previously
              // promised proposal, so we promise not to accept
              // anything higher than it
              this.RECEIVED_PROPOSALS[name][instance].proposal = proposal;

              helper.log("handlePropose", "paxos.js", "promising", proposal);

              return {
                  name: name,
                  peer: this.port,
                  promise: true,
                  highestProposal: proposal,
                  value: NO_VALUE
              };
          }
          else {
              // This proposal number is less than the one
              // we promised, so we reject it, and return
              // the one we promised

              helper.log("handlePropose", "paxos.js", "rejecting", proposal);
              return {
                  name: name,
                  peer: this.port,
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
          this.RECEIVED_PROPOSALS[name][instance] = {
              proposal: proposal,
              value: NO_VALUE
          };

          helper.log("handlePropose", "paxos.js", "first proposal, accepting",proposal);
          // And return a promise saying we accept it
          return {
              name: name,
              peer: this.port,
              promise: true,
              highestProposal: proposal,
              value: NO_VALUE
          };
      }
      helper.log("handlePropose", "paxos.js", "Return");
    }

    // initiateProposal(name, instance, originalValue, finalResponse) {
    //
    //     helper.log("initiateProposal", "paxos.js", "Enter", {name, instance, originalValue, finalResponse});
    //
    //     var total_peers = this.getTotalPeers();
    //
    //     helper.log("initiateProposal", "paxos.js", "gettotal", total_peers);
    //
    //     var value = originalValue;
    //     var number = this.PROPOSAL_COUNTER[instance] = (this.PROPOSAL_COUNTER[instance] || 0) + 1;
    //     var proposal = {
    //         peer: this.port,
    //         number: number
    //     };
    //
    //     // Create a set of tasks, where each task is sending the PROPOSE
    //     // message to a specific peer
    //     var proposeTasks = {};
    //
    //     this.listPeers();
    //     _.each(this.peers, function(peer) {
    //         helper.log("initiateProposal", "paxos.js", "Current peer: ", peer.port);
    //         proposeTasks[peer.port] = function(done) {
    //             helper.log("initiateProposal", "paxos.js", "SEND PROPOSE ", { name: name,instance: instance,proposal: proposal, oport: this.port, rport: peer.port });
    //             // try {
    //               peer.socket.call(
    //                 "propose",
    //                 [{
    //                   name: name,
    //                   instance: instance,
    //                   proposal: proposal
    //                 }],
    //                 function(err, response) {
    //                     helper.log("initiateProposal", "paxos.js", "Callback here", {err: err, res: response});
    //
    //                     response = response[0];
    //                     var received = null;
    //                     if (err && err.code === TIMEOUT_ERROR) {
    //                         // If we received a timeout, then
    //                         // simply mark this, and keep going
    //                         helper.log("initiateProposal", "paxos.js", "RECEIVED propose-response timeout from ", {port: peer.port});
    //                         received = TIMEOUT_ERROR;
    //                     }
    //                     else if (response.error === DROPPED_ERROR) {
    //                         // If we received a drop message response,
    //                         // then simply mark this, and keep going
    //                         helper.log("initiateProposal", "paxos.js", "RECEIVED propose-response drop from ", {port: peer.port});
    //                         received = DROPPED_ERROR;
    //                     }
    //                     else {
    //                         // If we received an actual value, then
    //                         // simply mark this, and keep going
    //                         helper.log("initiateProposal", "paxos.js", "RECEIVED propose-response from ", {port: peer.port});
    //                         received = response.data;
    //                     }
    //                     helper.log("initiateProposal", "paxos.js", "done args: ", received);
    //                     done(null, received);
    //                 }
    //               );
    //             // } catch (e) {
    //             //   helper.log("initiateProposal", "paxos.js", "Crashed w/ error", e);
    //             //   helper.log("initiateProposal", "paxos.js", "Can't connect. NODE DOWN!", peer);
    //             //   delete PEERS[peer.port];
    //             // } finally {
    //             //
    //             // }
    //
    //         };
    //     });
    //
    //     // Execute all the PROPOSE tasks
    //     async.parallel(proposeTasks, function(err, received) {
    //
    //         // Keep track of the highest overall proposal
    //         var highestProposal = { number: -1, peer: -1};
    //
    //         // Keep track of the highest proposal that had a value
    //         // attached, and the value
    //         var highestProposalWithValue = { number: -1, peer: -1};
    //         var newValue = null;
    //
    //         // Note how many people promised
    //         var numPromised = 0;
    //         var numPeersDown = 0;
    //
    //         _.each(received, function(response) {
    //           // response = response.result;
    //             helper.log("async.parallel(proposeTasks)", "paxos.js", "response: ",response);
    //             if (response === TIMEOUT_ERROR || response === DROPPED_ERROR) {
    //               helper.log("initiateProposal", "paxos.js", "Let's count how many people died on us, so we know");
    //                 // Let's count how many people died on us, so we know
    //                 // whether we should keep trying or if this is a catastrophic
    //                 // failure
    //                 numPeersDown++;
    //                 return;
    //             }
    //             else if (response["promise"]) {
    //                 // OK, they promised to uphold our proposal
    //                 helper.log("initiateProposal", "paxos.js", "OK, they promised to uphold our proposal");
    //                 numPromised++;
    //
    //                 if (response["value"] !== NO_VALUE) {
    //                     // This response had a value, so we see if it is greater than
    //                     // our previous proposal
    //                     if (helper.greaterThan(response["highestProposal"], highestProposalWithValue)) {
    //                         highestProposalWithValue = response["highestProposal"];
    //                         value = response["value"];
    //
    //                         helper.log("initiateProposal", "paxos.js", "Switching to value "+ value+ " from: " + highestProposalWithValue.peer);
    //                     }
    //                 }
    //             }
    //             else {
    //                 // They rejected our proposal, and so we note what proposal
    //                 // they return so we can set ours up
    //                 helper.log("initiateProposal", "paxos.js", "response: ",response);
    //                 helper.log("initiateProposal>async>proposeTasks", "paxos.js", "highestProposal: ", {proposal: response["highestProposal"]});
    //                 if (helper.greaterThan(response["highestProposal"], highestProposal)) {
    //                     highestProposal = response["highestProposal"];
    //                 }
    //             }
    //         });
    //
    //         // helper.log("initiateProposal", "paxos.js", "Checkin half condition");
    //         helper.log("initiateProposal", "paxos.js", "gettotal", "this.getTotalPeers()");
    //         helper.log("initiateProposal", "paxos.js", "gettotal", total_peers);
    //
    //         if (numPromised >= Math.floor(total_peers / 2 + 1)) {
    //             // The proposal was accepted by a majority - hurrah!
    //             // We now send the ACCEPT requests to each acceptor.
    //             helper.log("initiateProposal", "paxos.js", "Proposal accepted by majority");
    //
    //             if (value !== originalValue && originalValue !== TEST_VALUE) {
    //                 helper.log("initiateProposal", "paxos.js", "If we changed values, we still need to try and store");
    //                 // If we changed values, we still need to try and store
    //                 // the original value the user sent us,
    //                 // so we simply go again
    //                 this.initiateProposal(name, this.CURRENT_INSTANCE[name]++, originalValue, finalResponse);
    //
    //                 // We reset the final response in the case where the value changed,
    //                 // so that we only respond for the original request coming in from the
    //                 // client, not for this intermediate value we are storing
    //                 finalResponse = function() {};
    //             }
    //             else if (value !== originalValue && originalValue === TEST_VALUE) {
    //                 helper.log("initiateProposal", "paxos.js", "If the original value is null and the proposal was promised,");
    //                 // If the original value is null and the proposal was promised,
    //                 // then we don't want to initiate a new proposal for the TEST_VALUE value,
    //                 // and we don't want to do anything for the new value, as we
    //                 // will simply learn it
    //                 finalResponse = function() {};
    //             }
    //             else if (originalValue === TEST_VALUE && value === TEST_VALUE) {
    //               helper.log("initiateProposal", "paxos.js", "If this is a test value (because we're trying to force a learn cycle),");
    //                 // If this is a test value (because we're trying to force a learn cycle),
    //                 // and our value was accepted just like that, then we simply
    //                 // return that there is no value, and short circuit
    //                 finalResponse(null, VALUE_NOT_FOUND);
    //                 return;
    //             }
    //             helper.log("initiateProposal", "paxos.js", "Initiate the ACCEPT phase, but if we changed");
    //             // Initiate the ACCEPT phase, but if we changed
    //             // finalResponse(null, "InitAccept");
    //             this.initiateAccept(name, instance, proposal, value, originalValue, finalResponse);
    //             // this.acceptv();
    //         }
    //         else if (numPeersDown >= Math.floor(total_peers / 2 + 1)) {
    //           helper.log("initiateProposal", "paxos.js", "This is a catastrophic failure, let's cut our losses");
    //             // This is a catastrophic failure, let's cut our losses
    //             // More than half our peers seem to be down, so we just
    //             // respond to the client immediately
    //             finalResponse(PEERS_DOWN);
    //         }
    //         else {
    //             helper.log("initiateProposal", "paxos.js", "We failed to update because somebody beat us in terms");
    //             // We failed to update because somebody beat us in terms
    //             // of proposal numbers, so we just try again with a higher
    //             // proposal number
    //             var newNumber = highestProposal.number + 1;
    //
    //             helper.log("initiateProposal", "paxos.js", "Proposal rejected, setting new proposal number:"+ newNumber);
    //             this.PROPOSAL_COUNTER[instance] = newNumber;
    //
    //             this.initiateProposal(name, instance, originalValue, finalResponse);
    //         }
    //     });
    //     helper.log("initiateProposal", "paxos.js", "Return");
    // };

    acceptv(){
      console.log("Asdfasdfsa");
    }

    // initiateAccept(name, instance, proposal, value, originalValue, finalResponse) {
    //
    //     helper.log("initiateAccept", "paxos.js", "Enter", {name, instance, proposal, value, originalValue, finalResponse});
    //     // Create a set of tasks, where each task is sending the ACCEPT
    //     // message to a specific peer
    //     var total_peers = this.getTotalPeers();
    //
    //     var acceptTasks = {};
    //     _.each(this.peers, function(peer) {
    //         helper.log("initiateAccept", "paxos.js", "SEND ACCEPT", { name: name,instance: instance,proposal: proposal, oport: this.port, rport: peer.port, value: value });
    //         acceptTasks[peer.port] = function(done) {
    //           // try{
    //             peer.socket.call(
    //               "accept",
    //               [{
    //                   name: name,
    //                   instance: instance,
    //                   proposal: proposal,
    //                   value: value
    //               }],
    //               function(err, response) {
    //                   var received = null;
    //                   response = response[0];
    //                   if (err && err.code === TIMEOUT_ERROR) {
    //                       // If we received a timeout, then
    //                       // simply mark this, and keep going
    //                       helper.log("initiateAccept", "paxos.js", "RECEIVED accept-response timeout from: "+ peer.port);
    //                       received = TIMEOUT_ERROR;
    //                   }
    //                   else if (response.error === DROPPED_ERROR) {
    //                       // If we received a drop message response,
    //                       // then simply mark this, and keep going
    //                       helper.log("initiateAccept", "paxos.js", "RECEIVED accept-response drop from: "+ peer.port);
    //                       received = DROPPED_ERROR;
    //                   }
    //                   else {
    //                       // If we received an actual value, then
    //                       // simply mark this, and keep going
    //                       helper.log("initiateAccept", "paxos.js", "RECEIVED accept-response from: "+ peer.port);
    //                       received = response.data;
    //                   }
    //                   helper.log("initiateAccept", "paxos.js", "accept-response", received);
    //                   done(null, received);
    //               }
    //             );
    //             // } catch (e) {
    //             //   helper.log("initiateAccept", "paxos.js", "Crashed w/ error", e);
    //             //   helper.log("initiateAccept", "paxos.js", "Can't connect. NODE DOWN!", peer.port);
    //             //   delete PEERS[peer.port];
    //             // } finally {
    //             //
    //             // }
    //         };
    //     });
    //
    //     // Execute all the ACCEPT tasks
    //     async.parallel(acceptTasks, function(err, accepted) {
    //         // Note how many people promised
    //         var numAccepted = 0;
    //         var numPeersDown = 0;
    //         _.each(accepted, function(response) {
    //             if (response === TIMEOUT_ERROR || response === DROPPED_ERROR) {
    //                 // Let's count how many people died on us, so we know
    //                 // whether we should keep trying or if this is a catastrophic
    //                 // failure
    //                 numPeersDown++;
    //                 return;
    //             }
    //             else if (response.accepted) {
    //                 numAccepted++;
    //             }
    //         });
    //
    //         // If less than a majority accepted,
    //         // then we start over
    //         if (numAccepted >= Math.floor(total_peers / 2 + 1)) {
    //             helper.log("handleLearn", "paxos.js", "majority accepted", accepted);
    //             finalResponse(null, {accepted: true, instance: instance});
    //         }
    //         else if (numPeersDown >= Math.floor(total_peers / 2 + 1)) {
    //             // This is a catastrophic failure, let's cut our losses
    //             // More than half our peers seem to be down, so we just
    //             // respond to the client immediately
    //             finalResponse(PEERS_DOWN);
    //         }
    //         else {
    //             helper.log("handleLearn", "paxos.js", "majority rejected", accepted);
    //             this.initiateProposal(name, instance, originalValue, finalResponse);
    //         }
    //     });
    //     helper.log("initiateAccept", "paxos.js", "Return");
    // }

}

module.exports.Paxos = Paxos;
module.exports.initiateProposal = initiateProposal;
module.exports.initiateAccept = initiateAccept;
module.exports.handleLearn = handleLearn;
module.exports.handleAccept = handleAccept;
