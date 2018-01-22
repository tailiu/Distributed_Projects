
module.exports.store = function(args, callback){

  var name = args.name;
  var value = args.value;

  log("Received STORE(", name, ",", value, ")");

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

          res.json(err);
      }
      else {
          res.json(result);
      }
  });
}

module.exports.fetch = function(args, callback){
  var data = req.body;
  var name = data.name;
  var instance = data.instance;

  log("Received FETCH(", name, ",", instance, ")");

  // Initialize our storage for this name
  initializeStorageForName(name);

  if (FULLY_LEARNT_VALUES[name][instance] !== null && FULLY_LEARNT_VALUES[name][instance] !== undefined) {
      log("FETCH SHORTCIRCUIT - " + FULLY_LEARNT_VALUES[name][instance])
      // If we have a fully learnt value, we don't need to
      // do a paxos round
      res.json({
          name: name,
          instance: instance,
          value: FULLY_LEARNT_VALUES[name][instance]
      });
  }
  else {
      // We need to queue up a listener when we've fully learnt the
      // value
      log("FETCH FAILED - KEY DOESN'T EXIST")
      var listeners = FULLY_LEARNT_LISTENERS[name][instance] = (FULLY_LEARNT_LISTENERS[name][instance] || []);
      listeners.push(function(value) {
          if (res !== null) {
              log("FETCH listener invoked!");
              res.json({
                  found: true,
                  name: name,
                  instance: instance,
                  value: value
              });
          }
          else {
              log("FETCH listener invoked too late!")
          }
      });

      setTimeout(LEARN_TIMEOUT, function() {
          log("FETCH timeout!");
          res.json({
              found: false,
              name: name,
              instance: instance,
              message: "Timeout"
          });

          res = null;
      });

      // OK, we don't have a value, so we initiate a round for this
      // (name, instance) pair.
      initiateProposal(name, instance, TEST_VALUE, function(err, result) {
          if (err) {
              res.json(err);
          }
          else {
              if (result === VALUE_NOT_FOUND) {
                  res.send({found: false}, 404)
              }
              else {
                  res.send({found: false, message: "WTF: " + result}, 500);
              }
          }

          res = null;
      });
  }
}

module.exports.propose = function(args, callback){
  var data = req.body;
  var name = data.name;
  var instance = data.instance;
  var proposal = data.proposal;

  log("RECEIVE PROPOSE(", name, ",", instance, ",", proposal, ")");

  // Initialize our storage for this name
  initializeStorageForName(name);

  var result = handlePropose(name, instance, proposal);

  res.json(result);
  log("END PROPOSE");
}

module.exports.accept = function(args, callback){

    var data = req.body;
    var name = data.name;
    var instance = data.instance;
    var proposal = data.proposal;
    var value = data.value;

    log("RECEIVE ACCEPT(", name, ",", instance, ",", proposal, ",", value, ")");

    // Initialize our storage for this name
    initializeStorageForName(name);

    var result = handleAccept(name, instance, proposal, value);

    res.json(result);

    log("END ACCEPT");
}

module.exports.learn = function(args, callback){

  var data = req.body;
  var name = data.name;
  var instance = data.instance;
  var value = data.value;
  var peer = data.peer;

  log("RECEIVE LEARN(", name, ",", instance, ",", value, ",", peer, ")");

  // Initialize our storage for this name
  initializeStorageForName(name);

  var result = handleLearn(name, instance, value, peer);

  res.json(result);

  log("END LEARN");

}
