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
    if (RECEIVED_ACCEPTS[name].hasOwnProperty(instance)) {
        // We have already accepted something for this
        // instance
        var accepted = RECEIVED_ACCEPTS[name][instance];
        var acceptedProposal = accepted.proposal;
        var acceptedValue = accepted.value;

        // We also need to get our minimum promised proposal
        // number
        var promisedProposal = RECEIVED_PROPOSALS[name][instance].proposal;

        log("  ", "previously accepted:", promisedProposal, "--", acceptedValue);

        if (greaterThan(proposal, promisedProposal)) {
            // The proposal is higher than our accepted proposal,
            // so we respond with the previously accepted proposal,
            // and the value

            // However, we also need to note this new proposal,
            // because we promised not to accept anything less than it
            RECEIVED_PROPOSALS[name][instance].proposal = proposal;

            log("    ", "promising (already accepted)", proposal, " -- ", acceptedValue);
            return {
                name: name,
                peer: port,
                promise: true,
                highestProposal: promisedProposal,
                value: acceptedValue
            };
        }
        else {
            // This proposal number is less, so we reject it,
            // noting our current highest proposal number and the
            // value we already accepted

            log("    ", "rejecting (already accepted)", promisedProposal, " -- ", acceptedValue);
            return {
                name: name,
                peer: port,
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

        log("  ", "previously promised:", promisedProposal);
        if (greaterThan(proposal, promisedProposal)) {
            // The proposal is igher than our previously
            // promised proposal, so we promise not to accept
            // anything higher than it
            RECEIVED_PROPOSALS[name][instance].proposal = proposal;

            log("    ", "promising", proposal);
            return {
                name: name,
                peer: port,
                promise: true,
                highestProposal: proposal,
                value: NO_VALUE
            };
        }
        else {
            // This proposal number is less than the one
            // we promised, so we reject it, and return
            // the one we promised

            log("    ", "rejecting", proposal);
            return {
                name: name,
                peer: port,
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

        log("  ", "first proposal, accepting", proposal);
        // And return a promise saying we accept it
        return {
            name: name,
            peer: port,
            promise: true,
            highestProposal: proposal,
            value: NO_VALUE
        };
    }
};

var handleAccept = function(name, instance, proposal, value) {
    var promisedProposal = RECEIVED_PROPOSALS[name][instance].proposal;
    if (greaterThan(proposal, promisedProposal)) {
        // We haven't promised a higher proposal,
        // so we can still accept this request
        log("  ", "beginning to accept");

        if (RECEIVED_ACCEPTS[name].hasOwnProperty(instance)) {
            // We're checking to see if we already accepted
            // something previously. This is just for logging
            // purposes
            var acceptedProposal = RECEIVED_ACCEPTS[name][instance].proposal;
            var acceptedValue = RECEIVED_ACCEPTS[name][instance].value;

            log("  ", "previously accepted:", acceptedProposal, acceptedValue);
        }

        // Store the accepted proposal and value
        // in the accept store
        RECEIVED_ACCEPTS[name][instance] = {
            proposal: proposal,
            value: value
        };

        // Now we need to send out learn requests
        _.each(PEERS, function(peer) {
            peer.send(
                "/learn",
                {
                    name: name,
                    instance: instance,
                    value: value,
                    peer: port
                }
            )
        });
        return {
            accepted: true,
            peer: port
        };

        log("  ", "accepted:", proposal, value);
    }
    else {
        // We've already promised to another higher
        // proposal, so we just do nothing
        log("  ", "rejected:", promisedProposal);
        return {
            accepted: false,
            peer: port
        };
    }

};

var handleLearn = function(name, instance, value, peer) {
    if (FULLY_LEARNT_VALUES[name].hasOwnProperty(instance)) {
        // We've already fully learned a value,
        // because we received a quorum for it
        log("  ", "ignoring, previously fully learned:", name, FULLY_LEARNT_VALUES[name][instance]);
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
        log("  ", "fully learned: (", name, ",", instance, ",", value, ")");
        FULLY_LEARNT_VALUES[name][instance] = value;

        if (instance >= CURRENT_INSTANCE[name]) {
            // The instance number is higher than the one
            // we have locally, which could happen if we got
            // out of sync. As such, we set our own instance
            // number to one higher.
            log("  ", "setting instance:", instance + 1);
            CURRENT_INSTANCE[name] = instance + 1;
        }

        if (FULLY_LEARNT_LISTENERS[name][instance] !== null) {
            _.each(FULLY_LEARNT_LISTENERS[name][instance], function(listener) {
                log("  ", "dispatching to listener");
                listener(value);
            });
            FULLY_LEARNT_LISTENERS[name][instance] = null;
        }
    }
};

var initiateAccept = function(name, instance, proposal, value, originalValue, finalResponse) {
    // Create a set of tasks, where each task is sending the ACCEPT
    // message to a specific peer
    var acceptTasks = {};
    _.each(PEERS, function(peer) {
        log("SEND ACCEPT(", name, ",", instance, ",", proposal, ",", value, ")", "from", port);
        acceptTasks[peer.port] = function(done) {
            peer.send(
                "/accept",
                {
                    name: name,
                    instance: instance,
                    proposal: proposal,
                    value: value
                },
                function(err, response) {
                    var received = null;
                    if (err && err.code === TIMEOUT_ERROR) {
                        // If we received a timeout, then
                        // simply mark this, and keep going
                        log("RECEIVED accept-response timeout from", peer.port);
                        received = TIMEOUT_ERROR;
                    }
                    else if (response.body.error === DROPPED_ERROR) {
                        // If we received a drop message response,
                        // then simply mark this, and keep going
                        log("RECEIVED accept-response drop from", peer.port);
                        received = DROPPED_ERROR;
                    }
                    else {
                        // If we received an actual value, then
                        // simply mark this, and keep going
                        log("RECEIVED accept-response from", peer.port);
                        received = response.body;
                    }

                    done(null, received);
                }
            );
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
        if (numAccepted >= Math.floor(NUM_PEERS / 2 + 1)) {
            log("majority accepted", accepted);
            finalResponse(null, {accepted: true, instance: instance});
        }
        else if (numPeersDown >= Math.floor(NUM_PEERS / 2 + 1)) {
            // This is a catastrophic failure, let's cut our losses
            // More than half our peers seem to be down, so we just
            // respond to the client immediately
            finalResponse(PEERS_DOWN);
        }
        else {
            log("majority rejected", accepted);
            initiateProposal(name, instance, originalValue, finalResponse);
        }
    });
};

var initiateProposal = function(name, instance, originalValue, finalResponse) {
    var value = originalValue;
    var number = PROPOSAL_COUNTER[instance] = (PROPOSAL_COUNTER[instance] || 0) + 1;
    var proposal = {
        peer: port,
        number: number
    };

    // Create a set of tasks, where each task is sending the PROPOSE
    // message to a specific peer
    var proposeTasks = {};
    _.each(PEERS, function(peer) {
        proposeTasks[peer.port] = function(done) {
            log("SEND PROPOSE(", name, ",", instance, ",", proposal, ")", "from", port);
            peer.send(
                "/propose",
                {
                    name: name,
                    instance: instance,
                    proposal: proposal
                },
                function(err, response) {
                    var received = null;
                    if (err && err.code === TIMEOUT_ERROR) {
                        // If we received a timeout, then
                        // simply mark this, and keep going
                        log("RECEIVED propose-response timeout from", peer.port);
                        received = TIMEOUT_ERROR;
                    }
                    else if (response.body.error === DROPPED_ERROR) {
                        // If we received a drop message response,
                        // then simply mark this, and keep going
                        log("RECEIVED propose-response drop from", peer.port);
                        received = DROPPED_ERROR;
                    }
                    else {
                        // If we received an actual value, then
                        // simply mark this, and keep going
                        log("RECEIVED propose-response from", peer.port);
                        received = response.body;
                    }

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
            if (response === TIMEOUT_ERROR || response === DROPPED_ERROR) {
                // Let's count how many people died on us, so we know
                // whether we should keep trying or if this is a catastrophic
                // failure
                numPeersDown++;
                return;
            }
            else if (response.promise) {
                // OK, they promised to uphold our proposal
                numPromised++;

                if (response.value !== NO_VALUE) {
                    // This response had a value, so we see if it is greater than
                    // our previous proposal
                    if (greaterThan(response.highestProposal, highestProposalWithValue)) {
                        highestProposalWithValue = response.highestProposal;
                        value = response.value;

                        log("Switching to value", value, "from", highestProposalWithValue.peer);
                    }
                }
            }
            else {
                // They rejected our proposal, and so we note what proposal
                // they return so we can set ours up
                console.log(response);
                if (greaterThan(response.highestProposal, highestProposal)) {
                    highestProposal = response.highestProposal;
                }
            }
        });

        if (numPromised >= Math.floor(NUM_PEERS / 2 + 1)) {
            // The proposal was accepted by a majority - hurrah!
            // We now send the ACCEPT requests to each acceptor.
            log("Proposal accepted by majority");

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

            log("Proposal rejected, setting new proposal number:", newNumber);
            PROPOSAL_COUNTER[instance] = newNumber;

            initiateProposal(name, instance, originalValue, finalResponse);
        }
    });
};

var initializeStorageForName = function(name) {
    // If we haven't seen this name before,
    // then we initialize all our storage for it
    if (!RECEIVED_PROPOSALS.hasOwnProperty(name)) {
        log("INITIALIZED STORAGE FOR", name);
        RECEIVED_PROPOSALS[name] = {};
        RECEIVED_ACCEPTS[name] = {};
        FULLY_LEARNT_VALUES[name] = {};
        TENTATIVELY_FULLY_LEARNT_VALUES[name] = {};
        CURRENT_INSTANCE[name] = 1;
        FULLY_LEARNT_LISTENERS[name] = {};
    }
};
