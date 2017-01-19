'use strict';

var constants = require('./constants');
var hat = require('hat');
var merge = require('merge');

/**
 * Represents a [JSON-RPC 2.0](http://www.jsonrpc.org/specification) request or
 * response; used by {@link RPC#send}.
 *
 * Note that the value of the contact property will be replaced by the
 * {@link Contact} your implementation uses.
 *
 * The decision to use JSON-RPC as the message format was made to allow for
 * other language implementations and services to easily communicate with the
 * network, using a widely recognized and used format.
 * @constructor
 * @param {Object} spec
 * @param {String} spec.id - Message ID
 * @param {String} spec.method - Method name to include in request message
 * @param {Object} spec.params - Named parameters for request message
 * @param {Object} spec.result - Result data for response message
 * @param {Error} spec.error - Error object to convert to message
 */
function Message(spec) {
  if (!(this instanceof Message)) {
    return new Message(spec);
  }

  this.jsonrpc = '2.0';

  if (Message.isRequest(spec)) {
    this.id = spec.id || Message.createID();
    this.method = spec.method;
    this.params = spec.params;
  } else if (Message.isResponse(spec)) {
    this.id = spec.id;
    this.result = merge({}, spec.result);
    if (spec.error) {
      this.error = {
        code: -32603,
        message: spec.error.message
      };
    }
  } else {
    throw new Error('Invalid message specification');
  }
}

/**
 * Serialize message to a Buffer
 * @returns {Buffer}
 */
Message.prototype.serialize = function() {
  return new Buffer(JSON.stringify(this), 'utf8');
};

/**
 * Returns a boolean indicating if this message is a request
 * @param {Message} message - Message instance to inspect
 * @returns {Boolean}
 */
Message.isRequest = function(parsed) {
  return !!(parsed.method && parsed.params);
};

/**
 * Returns a boolean indicating if this message is a response
 * @param {Message} message - Message instance to inspect
 * @returns {Boolean}
 */
Message.isResponse = function(parsed) {
  return !!(parsed.id && (parsed.result || parsed.error));
};

/**
 * Create a Message instance from a buffer
 * @param {Buffer} buffer - Binary blob to convert to message object
 * @returns {Message}
 */
Message.fromBuffer = function(buffer) {
  function _convertByteArrays(key, value) {
    return value && value.type === 'Buffer' ? new Buffer(value.data) : value;
  }

  var parsed = JSON.parse(buffer.toString('utf8'), _convertByteArrays);
  var message = new Message(parsed);

  return message;
};

/**
 * Returns a message id
 * @returns {String}
 */
Message.createID = function() {
  return hat.rack(constants.B)();
};

module.exports = Message;
