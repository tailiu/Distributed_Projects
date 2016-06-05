'use strict';

var assert = require('assert');
var inherits = require('util').inherits;
var clarinet = require('clarinet');
var net = require('net');
var AddressPortContact = require('../contacts/address-port-contact');
var RPC = require('../rpc');

/**
 * Transport adapter that sends and receives messages over a TCP socket
 * @constructor
 * @extends {RPC}
 * @param {AddressPortContact} contact - Your node's {@link Contact} instance
 */
function TCPTransport(contact, options) {
  if (!(this instanceof TCPTransport)) {
    return new TCPTransport(contact, options);
  }

  assert(contact instanceof AddressPortContact, 'Invalid contact supplied');
  RPC.call(this, contact, options);
}

inherits(TCPTransport, RPC);

/**
 * Create a TCP socket and listen for messages
 * @private
 * @param {Function} done
 */
TCPTransport.prototype._open = function(done) {
  var self = this;

  this._socket = net.createServer(this._handleConnection.bind(this));
  this._queuedResponses = {};

  this._socket.on('error', function(err) {
    self._log.error('rpc encountered and error: %s', err.message);
  });

  this._socket.on('listening', done);
  this._socket.listen(this._contact.port);
};

/**
 * Send a RPC to the given contact
 * @private
 * @param {Buffer} data
 * @param {Contact} contact
 */
TCPTransport.prototype._send = function(data, contact) {
  var self = this;
  var parsed = JSON.parse(data.toString());

  if (this._queuedResponses[parsed.id]) {
    this._queuedResponses[parsed.id].end(data);
    delete this._queuedResponses[parsed.id];
    return;
  }

  if (!contact.valid()) {
    this._log.warn('Refusing to send message to invalid contact');
    return this.receive(null);
  }

  var sock = net.createConnection(contact.port, contact.address);

  sock.on('error', function(err) {
    self._log.error('error connecting to peer', err);
  });

  this._queuedResponses[parsed.id] = sock;

  this._handleConnection(sock);
  sock.write(data);
};

/**
 * Close the underlying socket
 * @private
 */
TCPTransport.prototype._close = function() {
  this._socket.close();
};

/**
 * Handle incoming connection
 * @private
 * @param {Object} connection
 */
TCPTransport.prototype._handleConnection = function(connection) {
  var self = this;
  var parser = clarinet.createStream();
  var buffer = '';
  var opened = 0;
  var closed = 0;

  parser.on('openobject', function() {
    opened++;
  });

  parser.on('closeobject', function() {
    closed++;

    if (opened === closed) {
      try {
        var parsed = JSON.parse(buffer);

        if (parsed.id && !self._queuedResponses[parsed.id]) {
          self._queuedResponses[parsed.id] = connection;
        }
      } catch(err) {
        // noop
      }

      self.receive(new Buffer(buffer));

      buffer = '';
      opened = 0;
      closed = 0;
    }
  });

  parser.on('error', function(err) {
    self._log.error(err.message);
    self._log.warn('failed to parse incoming message');
    connection.end();
  });

  connection.on('error', function(err) {
    self._log.error(err.message);
    self._log.warn('error communicating with peer');
  });

  connection.on('data', function(data) {
    buffer += data.toString('utf8');
    parser.write(data.toString('utf8'));
  });
};

module.exports = TCPTransport;
