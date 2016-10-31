'use strict';

var AddressPortContact = require('../contacts/address-port-contact');
var inherits = require('util').inherits;
var assert = require('assert');
var dgram = require('dgram');
var RPC = require('../rpc');

/**
 * Transport adapter that sends and receives message over UDP
 * @constructor
 * @extends {RPC}
 * @param {Contact} contact - Your node's {@link Contact} instance
 */
function UDPTransport(contact, options) {
  if (!(this instanceof UDPTransport)) {
    return new UDPTransport(contact, options);
  }

  assert(contact instanceof AddressPortContact, 'Invalid contact supplied');
  RPC.call(this, contact, options);
}

inherits(UDPTransport, RPC);

UDPTransport.MAX_MESSAGE_SIZE = 512; // bytes

/**
 * Create a UDP socket
 * @private
 * @param {function} done
 */
UDPTransport.prototype._open = function(done) {
  var self = this;

  function createSocket(port) {
    self._socket = dgram.createSocket(
      { type: 'udp4', reuseAddr: false },
      self.receive.bind(self)
    );

    self._socket.on('listening', done);

    self._socket.on('error', function(err) {
      self.emit('error', err);
    });

    self._socket.bind(port);
  }

  createSocket(self._contact.port);
};

/**
 * Send a RPC to the given contact (encode with msgpack before sending)
 * @private
 * @param {Buffer} data
 * @param {Contact} contact
 */
UDPTransport.prototype._send = function(data, contact) {
  if (data.length > UDPTransport.MAX_MESSAGE_SIZE) {
    this._log.warn(
      'outbound message greater than %sb (%sb) and risks fragmentation',
      UDPTransport.MAX_MESSAGE_SIZE,
      data.length
    );
  }

  this._socket.send(data, 0, data.length, contact.port, contact.address);
};

/**
 * Close the underlying socket
 * @private
 */
UDPTransport.prototype._close = function() {
  this._socket.close();
};

module.exports = UDPTransport;
