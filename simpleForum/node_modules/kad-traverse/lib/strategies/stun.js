/**
 * @module kad-traverse/strategies/stun
 */

'use strict';

var dgram = require('dgram');
var hat = require('hat');
var STUNSocket = require('stun-js');

/**
 * Uses STUN to perform UDP hole punch
 * @function
 * @param {Object} options
 */
module.exports = function STUNStrategy(options) {
  var server = options.server || {
    address: 'stun.services.mozilla.com',
    port: 3478
  };

  return function stun(callback) {
    var self = this;
    var client = STUNSocket(server.address, server.port);
    var token = new Buffer(hat());

    function onBindSuccess(reflexive) {
      var tmpsock = dgram.createSocket('udp4');

      self._log.info('obtained server reflexive address: %j', reflexive);
      client.on('message', checkReflexiveConnection);
      tmpsock.send(token, 0, token.length, reflexive.port, reflexive.address);

      setTimeout(function() {
        self._log.warn(
          'failed to traverse NAT via UDP hole punching, ' +
          'symmetric or port-restricted NAT'
        );
        client.close();
        tmpsock.close();
        callback(false);
      }, 2000);
    }

    function onBindError(error) {
      self._log.warn(
        'failed to obtain server reflexive address, reason: %s', error
      );
      callback(false);
    }

    function checkReflexiveConnection(buffer, info) {
      if (buffer.toString() === token.toString()) {
        self._log.info('successfully traversed NAT via UDP hole punching');
        self._socket = client;
        callback(true);
      }
    }

    client.bind(onBindSuccess, onBindError);
  };
};
