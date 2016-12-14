/**
 * @module kad-traverse/transport-decorator
 */

'use strict';

var async = require('async');
var assert = require('assert');
var strategies = require('./strategies');
var inherits = require('util').inherits;

/**
 * Returns a decorated transport adapter that can traverse NATs
 * @constructor
 * @param {kad.RPC} Transport
 */
function TransportDecorator(Transport) {

  function NatTransport(contact, options) {
    if (!(this instanceof NatTransport)) {
      return new NatTransport(contact, options);
    }

    this._natopts = options.traverse || {};

    Transport.call(this, contact, options);
  }

  inherits(NatTransport, Transport);

  /**
   * Wraps calls to _open with NAT traversal logic
   * #_open
   * @param {Function} callback
   */
  NatTransport.prototype._open = function(callback) {
    var self = this;

    self._traverseNAT(function(err, strategy) {
      if (err || strategy === 'upnp' || strategy === 'none') {
        return Transport.prototype._open.call(self, callback);
      }

      callback();
    });
  };

  /**
   * Wraps calls to _send with NAT traversal logic
   * #_send
   * @param {Buffer} data
   * @param {kad.Contact} contact
   */
  NatTransport.prototype._send = function(data, contact) {
    var self = this;

    Transport.prototype._send.call(self, data, contact);
  };

  /**
   * Returns the initialized strategies for this transport
   * #_getStrategies
   */
  NatTransport.prototype._getStrategies = function() {
    var self = this;

    return Object.keys(strategies).filter(function(name) {
      return self._natopts[name] !== false;
    }).map(function(name) {
      return strategies[name](self._natopts[name] || {});
    });
  };

  /**
   * Executes the traversal strategies
   * #_traverseNAT
   * @param {Function} callback
   */
  NatTransport.prototype._traverseNAT = function(callback) {
    var self = this;
    var strategies = this._getStrategies();

    async.detectSeries(strategies, function(strategy, next) {
      strategy.call(self, next);
    }, function(result) {
      if (!result) {
        self._log.error(
          'all traversal strategies failed, you are not addressable'
        );
        return callback(new Error('NAT traversal failed'));
      }

      callback(null, result.name);
    });
  };

  return NatTransport;
}

module.exports = TransportDecorator;
