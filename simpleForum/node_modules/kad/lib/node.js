'use strict';

var merge = require('merge');
var assert = require('assert');
var async = require('async');
var inherits = require('util').inherits;
var events = require('events');
var constants = require('./constants');
var Router = require('./router');
var Message = require('./message');
var Item = require('./item');
var Logger = require('./logger');

/**
 * Represents a Kademlia node
 * @constructor
 * @param {Object} options
 * @param {Router} options.router - Custom router instance to use
 * @param {RPC} options.transport - Transport (RPC) adapter to use
 * @param {Object} options.storage - Storage adapter to use
 * @param {Logger} options.logger - Logger instance to use
 * @param {Node~validator} options.validator - Key-Value validation function
 * @emits Node#join
 * @emits Node#leave
 * @emits Node#connect
 * @emits Node#disconnect
 * @emits Node#error
 */
function Node(options) {
  options = merge(Object.create(Node.DEFAULTS), options);

  if (!(this instanceof Node)) {
    return new Node(options);
  }

  events.EventEmitter.call(this);
  this._setStorageAdapter(options.storage);

  this._log = options.logger;
  this._rpc = options.transport;
  this._self = this._rpc._contact;
  this._validator = options.validator;

  this._router = options.router || new Router({
    logger: this._log,
    transport: this._rpc,
    validator: this._validateKeyValuePair.bind(this)
  });

  this._bindRouterEventHandlers();
  this._bindRPCMessageHandlers();
  this._startReplicationInterval();
  this._startExpirationInterval();
  this._log.info('node created with nodeID %s', this._self.nodeID);
}
/**
 * Called when a value is retrieved or stored to validate the pair
 * @callback Node~validator
 * @param {String} key - The key at which the value is or should be stored
 * @param {String} value - The returned or stored value
 * @param {Function} callback - Called with boolean indicating validity
 */

/**
 * Join event is triggered when the routing table is no longer empty
 * @event Node#join
 */

/**
 * Leave event is triggered when the routing table becomes empty
 * @event Node#leave
 */

/**
 * Aliases {@link Node#event:join} for backwards compatibility; use one or the
 * other, but not both
 * @deprecated since version 1.4.0, use {@link Node#event:join} instead
 * @event Node#connect
 */

/**
 * Aliases {@link Node#event:leave} for backwards compatibility; use one or the
 * other, but not both
 * @deprecated since version 1.4.0, use {@link Node#event:leave} instead
 * @event Node#disconnect
 */

/**
 * Error event fires when a critical failure has occurred; if no handler is
 * specified, then it will throw
 * @event Node#error
 * @type {Error}
 */

inherits(Node, events.EventEmitter);

Node.DEFAULTS = {
  logger: new Logger(4)
};

/**
 * Connects to the overlay network
 * @param {Contact} contact - Contact object to use for entering network
 * @param {Node~connectCallback} callback - Optional callback on connect
 * @returns {Node}
 */
Node.prototype.connect = function(contact, callback) {
  var self = this;
  var seed = this._rpc._createContact(contact);
  var done = callback || function() {};

  this._log.debug('entering overlay network via %j', seed);

  async.waterfall([
    this._ensureTransportState.bind(this),
    function(next) {
      self._router.updateContact(seed, function() {
        next();
      });
    },
    this._router.findNode.bind(this._router, this._self.nodeID, {
      aggressiveLookup: true,
      aggressiveCache: true
    }),
    this._router.refreshBucketsBeyondClosest.bind(this._router)
  ], function(err) {
    if (err) {
      return done(err);
    }

    done.call(self, null, contact);
  });

  return this;
};
/**
 * This callback is called upon completion of {@link Node#connect}
 * @callback Node~connectCallback
 * @param {Error|null} err - The error object, if any
 * @param {Contact} contact - The {@link Contact} passed to {@link Node#connect}
 */

/**
 * Disconnects from the overlay by closing the transport and emptying the
 * routing table
 * @param {Node~disconnectCallback} callback - Optional callback on disconnect
 */
Node.prototype.disconnect = function(callback) {
  var self = this;
  var done = callback || function() {};

  if (this._rpc.readyState === 0) {
    return done();
  }

  this._rpc.close(function() {
    self._router.empty();
    self.emit('leave');
    done();
  });
};
/**
 * This callback is called upon completion of {@link Node#disconnect}
 * @callback Node~disconnectCallback
 */

/**
 * Set a key/value pair in the DHT
 * @param {String} key - Lookup key for the value to store
 * @param {String} value - Data to store in the DHT
 * @param {Node~putCallback} callback - Executed upon completion
 */
Node.prototype.put = function(key, value, callback) {
  var node = this;

  this._log.debug('attempting to set value for key %s', key);

  this._validateKeyValuePair(key, value, function(valid) {
    if (!valid) {
      node._log.warn('failed to validate key/value pair for %s', key);
      return callback(new Error('Failed to validate key/value pair'));
    }

    node._putValidatedKeyValue(Item(key, value, node._self.nodeID), callback);
  });
};
/**
 * This callback is called upon completion of {@link Node#put}
 * @callback Node~putCallback
 * @param {Error|null} err - The error object, if any
 */

/**
 * Get a value by it's key from the DHT
 * @param {String} key - Lookup key for the stored value
 * @param {Function} callback
 */
Node.prototype.get = function(key, callback) {
  var self = this;

  this._log.debug('attempting to get value for key %s', key);

  self._router.findValue(key, function(err, value) {
    if (err) {
      self._log.warn('failed to get value from peers, reason: %s', err.message);
      self._log.info('checking local storage for items at key %s', key);

      return self._storage.get(key, function(err, item) {
        if (!err && item) {
          callback(null, JSON.parse(item).value);
        } else {
          callback(err);
        }
      });
    }

    callback(null, value);
  });
};
/**
 * This callback is called upon completion of {@link Node#get}
 * @callback Node~getCallback
 * @param {Error|null} err - The error object, if any
 * @param {String} value - The value retrieved from the DHT
 */

/**
 * Set a validated key/value pair in the DHT
 * @private
 * @param {Item} item
 * @param {Function} callback
 */
Node.prototype._putValidatedKeyValue = function(item, callback) {
  var node = this;

  this._router.findNode(item.key, function(err, contacts) {
    if (err) {
      node._log.warn('failed to find nodes, reason: %s', err.message);
      node._log.info('saving item to local storage');
      return node._storage.put(item.key, JSON.stringify(item), callback);
    }

    if (contacts.length === 0) {
      node._log.warn('no contacts returned, checking local table...');
      contacts = node._router.getNearestContacts(
        item.key,
        constants.K,
        node._self.nodeID
      );
    }

    node._log.debug('found %d contacts for STORE operation', contacts.length);

    async.each(contacts, function(contact, done) {
      var message = new Message({
        method: 'STORE',
        params: { item: item, contact: node._self }
      });
      node._log.debug('sending STORE message to %j', contact);
      node._rpc.send(contact, message, done);
    }, function(err) {
      if (err) {
        node._log.error(
          'Failed to store value at one or more nodes, reason:',
          err.message
        );
      }

      // NB: Always store a local copy so we can republish later
      node._storage.put(item.key, JSON.stringify(item), callback);
    });
  });
};

/**
 * Validate a key/value pair (defaults to always valid).
 * @private
 * @param {String} key
 * @param {String} value
 * @param {Function} callback
 */
Node.prototype._validateKeyValuePair = function(key, value, callback) {
  if (typeof this._validator === 'function') {
    return this._validator.apply(this, arguments);
  }

  callback(true);
};

/**
 * Setup event listeners from the router for determining status of the node
 * in the overlay network
 * @private
 */
Node.prototype._bindRouterEventHandlers = function() {
  var self = this;

  this.connected = false;

  this.on('join', function() {
    this.connected = true;
  });

  this.on('leave', function() {
    this.connected = false;
  });

  function checkRouterStatus(contact) {
    if (self._router.length) {
      self.emit('join', contact);
      self.emit('connect', contact);
    } else {
      self.emit('leave', contact);
      self.emit('disconnect', contact);
    }
  }

  this._router.on('add', checkRouterStatus);
  this._router.on('remove', checkRouterStatus);
};

/**
 * Ensures that the transport adapter is in an open state
 * @private
 * @param {Function} callback
 */
Node.prototype._ensureTransportState = function(callback) {
  if (this._rpc.readyState === 2) {
    return callback();
  }

  if (this._rpc.readyState === 1) {
    return this._rpc.on('ready', callback);
  }

  this._rpc.open(callback);
};

/**
 * Setup event listeners for rpc messages
 * @private
 */
Node.prototype._bindRPCMessageHandlers = function() {
  var self = this;

  this._rpc.on('PING', this._handlePing.bind(this));
  this._rpc.on('STORE', this._handleStore.bind(this));
  this._rpc.on('FIND_NODE', this._handleFindNode.bind(this));
  this._rpc.on('FIND_VALUE', this._handleFindValue.bind(this));
  this._rpc.on('CONTACT_SEEN', this._router.updateContact.bind(this._router));
  this._rpc.on('TIMEOUT', this._router.removeContact.bind(this._router));

  this._rpc.on('ready', function() {
    self._log.debug('node listening on %j', self._self.toString());
  });
};

/**
 * Replicate local storage every T_REPLICATE
 * @private
 */
Node.prototype._startReplicationInterval = function() {
  setInterval(this._replicate.bind(this), constants.T_REPLICATE);
};

/**
 * Replicate local storage
 * @private
 */
Node.prototype._replicate = function() {
  var self = this;
  var stream = this._storage.createReadStream();

  this._log.info('starting local database replication');

  stream.on('data', function(data) {
    var item = null;
    var parsed = null;

    try {
      parsed = JSON.parse(data.value);
      item = Item(data.key, parsed.value, parsed.publisher, parsed.timestamp);
    } catch(err) {
      return self._log.error('failed to parse value from %s', data.value);
    }

    /* istanbul ignore else */
    // if we are not the publisher, then replicate every T_REPLICATE
    if (item.publisher !== self._self.nodeID) {
      self._putValidatedKeyValue(item, function(err) {
        if (err) {
          self._log.error('failed to replicate item at key %s', data.key);
        }
      });
    // if we are the publisher, then only replicate every T_REPUBLISH
    } else if (Date.now() >= item.timestamp + constants.T_REPUBLISH) {
      self.put(item.key, item.value, function(err) {
        if (err) {
          self._log.error('failed to republish item at key %s', data.key);
        }
      });
    }
  });

  stream.on('error', function(err) {
    self._log.error('error while replicating: %s', err.message);
  });

  stream.on('end', function() {
    self._log.info('database replication complete');
  });
};

/**
 * Expire entries older than T_EXPIRE
 * @private
 */
Node.prototype._startExpirationInterval = function() {
  setInterval(this._expire.bind(this), constants.T_EXPIRE);
};

/**
 * Expire entries older than T_EXPIRE
 * @private
 */
Node.prototype._expire = function() {
  var self = this;
  var stream = this._storage.createReadStream();

  this._log.info('starting local database expiration');

  stream.on('data', function(data) {
    var item = null;
    var parsed = null;

    try {
      parsed = JSON.parse(data.value);
      item = Item(data.key, parsed.value, parsed.publisher, parsed.timestamp);
    } catch(err) {
      return self._log.error('failed to parse value from %s', data.value);
    }

    if (Date.now() >= item.timestamp + constants.T_EXPIRE) {
      self._storage.del(data.key, function(err) {
        /* istanbul ignore next */
        if (err) {
          self._log.error('failed to expire item at key %s', data.key);
        }
      });
    }
  });

  stream.on('error', function(err) {
    self._log.error('error while expiring: %s', err.message);
  });

  stream.on('end', function() {
    self._log.info('database expiration complete');
  });
};

/**
 * Handle PING RPC message
 * @private
 * @param {Message} incomingMsg
 */
Node.prototype._handlePing = function(incomingMsg) {
  var contact = this._rpc._createContact(incomingMsg.params.contact);
  var message = new Message({
    id: incomingMsg.id,
    result: { contact: this._self }
  });

  this._log.info(
    'received PING from %s, sending PONG',
    incomingMsg.params.contact.nodeID
  );
  this._rpc.send(contact, message);
};

/**
 * Handle STORE RPC message
 * @private
 * @param {Message} incomingMsg
 */
Node.prototype._handleStore = function(incomingMsg) {
  var node = this;
  var params = incomingMsg.params;
  var item = params.item;

  try {
    item = new Item(item.key, item.value, item.publisher);
  } catch(err) {
    return this._log.error(
      'failed to store item at key %s, reason: %s',
      item.key,
      err.message
    );
  }

  this._log.info('received valid STORE from %s', params.contact.nodeID);

  this._validateKeyValuePair(item.key, item.value, function(valid) {
    if (!valid) {
      node._log.warn('failed to validate key/value pair for %s', item.key);
      return;
    }

    node._storeValidatedKeyValue(item, incomingMsg);
  });
};

/**
 * Add the validated key/value to storage
 * @private
 * @param {Item} item
 * @param {Message} incomingMsg
 */
Node.prototype._storeValidatedKeyValue = function(item, incomingMsg) {
  var node = this;
  var params = incomingMsg.params;

  this._storage.put(item.key, JSON.stringify(item), function(err) {
    var contact = node._rpc._createContact(incomingMsg.params.contact);
    var message = new Message({
      error: err,
      result: { contact: node._self },
      id: incomingMsg.id
    });

    if (err) {
      node._log.warn('store failed, notifying %s', params.contact.nodeID);
    } else {
      node._log.debug('successful store, notifying %s', params.contact.nodeID);
    }

    node._rpc.send(contact, message);
  });
};

/**
 * Handle FIND_NODE RPC message
 * @private
 * @param {Message} incomingMsg
 */
Node.prototype._handleFindNode = function(incomingMsg) {
  this._log.info('received FIND_NODE from %j', incomingMsg.params.contact);

  var node = this;
  var params = incomingMsg.params;
  var contact = this._rpc._createContact(params.contact);

  var near = this._router.getNearestContacts(
    params.key,
    constants.K,
    params.contact.nodeID
  );

  var message = new Message({
    id: incomingMsg.id,
    result: { nodes: near, contact: node._self }
  });

  this._log.debug(
    'sending %s nearest %d contacts',
    params.contact.nodeID,
    near.length
  );
  this._rpc.send(contact, message);
};

/**
 * Handle FIND_VALUE RPC message
 * @private
 * @param {Message} incomingMsg
 */
Node.prototype._handleFindValue = function(incomingMsg) {
  var node = this;
  var params = incomingMsg.params;
  var contact = this._rpc._createContact(params.contact);
  var limit = constants.K;

  this._log.info('received valid FIND_VALUE from %s', params.contact.nodeID);
  this._storage.get(params.key, function(err, value) {
    if (err || !value) {
      node._log.debug(
        'value not found, sending contacts to %s',
        params.contact.nodeID
      );

      var notFoundMessage = new Message({
        id: incomingMsg.id,
        result: {
          nodes: node._router.getNearestContacts(
            params.key,
            limit,
            params.contact.nodeID
          ),
          contact: node._self
        }
      });

      return node._rpc.send(contact, notFoundMessage);
    }

    var parsed = JSON.parse(value);
    var item = new Item(
      parsed.key,
      parsed.value,
      parsed.publisher,
      parsed.timestamp
    );

    node._log.debug('found value, sending to %s', params.contact.nodeID);

    var foundMessage = new Message({
      id: incomingMsg.id,
      result: { item: item, contact: node._self }
    });

    node._rpc.send(contact, foundMessage);
  });
};

/**
 * Validates the set storage adapter
 * @private
 * @param {Object} storage
 */
Node.prototype._setStorageAdapter = function(storage) {
  assert(typeof storage === 'object', 'No storage adapter supplied');
  assert(typeof storage.get === 'function', 'Store has no get method');
  assert(typeof storage.put === 'function', 'Store has no put method');
  assert(typeof storage.del === 'function', 'Store has no del method');
  assert(
    typeof storage.createReadStream === 'function',
    'Store has no createReadStream method'
  );

  this._storage = storage;
};

module.exports = Node;
