/**
 * @module kad-traverse/strategies/turn
 */

'use strict';

var TURNSocket = require('turn-js');

/**
 * Uses TURN to setup message relay
 * @function
 * @param {Object} options
 */
module.exports = function TURNStrategy(options) {
  var server = options.server || {
    address: 'turn.counterpointhackers.org',
    port: 3478
  };

  return function turn(callback) {
    var self = this;
    var turnsock = TURNSocket(
      server.address,
      server.port,
      server.username,
      server.password
    );

    function onAllocateSuccess(result) {
      var reflexive = result.mappedAddress;
      var relayed = result.relayedAddress;

      self._log.info(
        'successfully allocated relay address via TURN: %j', relayed
      );

      self._contact.address = relayed.address;
      self._contact.port = relayed.port;
      self._socket = turnsock;

      // Remember this only works with the UDP transport for now
      self._socket.on('relayed-message', self._receive.bind(self));

      // Overwrite the transport._send method to use the relay
      // This is not a particularly sightly hack, but should work for now
      self._send = function(data, contact) {
        self._socket.createPermission(
          contact.address,
          999999, // lifetime
          function permissionSuccess() {
            self._log.info('successfully created relay permission for peer');
            self._socket.sendToRelay(
              data,
              contact.address,
              contact.port,
              function sendSuccess() {
                self._log.info('sending message to TURN relay');
              },
              function sendFailure(err) {
                self._log.warn(
                  'failed to send message to relay, reason: %s', err
                );
              }
            );
          },
          function permissionFailure(err) {
            self._log.error(
              'failed to create permission for contact, reason: %s', err.message
            );
          }
        );
      };

      callback(true);
    }

    function onAllocateFailure(err) {
      self._log.warn(
        'failed to traverse with via TURN, reason: %s', err
      );
      callback(false);
    }

    turnsock.allocate(onAllocateSuccess, onAllocateFailure);
  };
};
