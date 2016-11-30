'use strict';

var AddressPortContact = require('../contacts/address-port-contact');
var Message = require('../message');
var assert = require('assert');
var inherits = require('util').inherits;
var http = require('http');
var https = require('https');
var RPC = require('../rpc');

// create agents to enable http persistent connections:
var httpagent = new http.Agent({keepAlive: true});
var httpsagent = new https.Agent({keepAlive: true});

/**
 * Transport adapter that sends and receives messages over HTTP
 * @constructor
 * @extends {RPC}
 * @param {AddressPortContact} contact - Your node's {@link Contact} instance
 * @param {Object} options
 * @param {Boolean} options.cors - Allow cross origin resource sharing
 * @param {Object} options.ssl - Options to pass to https.createServer()
 */
function HTTPTransport(contact, options) {
  if (!(this instanceof HTTPTransport)) {
    return new HTTPTransport(contact, options);
  }

  this._queuedResponses = {};
  this._cors = options && !!options.cors;
  this._sslopts = options && options.ssl;
  this._protocol = this._sslopts ? https : http;
  // assign the correct agent based on the protocol:
  this._agent = this._sslopts ? httpsagent : httpagent;

  assert(contact instanceof AddressPortContact, 'Invalid contact supplied');
  RPC.call(this, contact, options);
  this.on('MESSAGE_DROP', this._handleDroppedMessage.bind(this));
}

inherits(HTTPTransport, RPC);

/**
 * Opens the HTTP server and handles incoming messages
 * @private
 * @param {Function} done
 */
HTTPTransport.prototype._open = function(done) {
  var self = this;

  function createServer(handler) {
    return self._sslopts ?
           self._protocol.createServer(self._sslopts, handler) :
           self._protocol.createServer(handler);
  }

  this._server = createServer(function(req, res) {
    var payload = '';
    var message = null;

    if (self._cors) {
      self._addCrossOriginHeaders(req, res);
    }

    if (req.method === 'OPTIONS') {
      return res.end();
    }

    req.on('error', function(err) {
      self._log.warn('remote client terminated early: %s', err.message);
      self.receive(null);
    });

    req.on('data', function(chunk) {
      payload += chunk.toString();
    });

    req.on('end', function() {
      var buffer = new Buffer(payload);

      try {
        message = Message.fromBuffer(buffer);
      } catch(err) {
        return self.receive(null);
      }

      if (Message.isRequest(message)) {
        self._queuedResponses[message.id] = res;
      }

      self.receive(buffer, {});
    });
  });

  // we should disable nagling as all of our response gets sent in one go:
  this._server.on('connection', function(socket) {
    // disable the tcp nagle algorithm on the newly accepted socket:
    socket.setNoDelay(true);
  });

  this._server.listen(this._contact.port, done);
};

/**
 * Sends a RPC to the given contact
 * @private
 * @param {Buffer} data
 * @param {Contact} contact
 */
HTTPTransport.prototype._send = function(data, contact) {
  var self = this;
  var parsed = JSON.parse(data.toString());

  function handleResponse(res) {
    var payload = '';

    res.on('data', function(chunk) {
      payload += chunk.toString();
    });

    res.on('error', function(err) {
      self._log.error(err.message, 'No data received after request.');
      self.receive(null);
    });

    res.on('end', function() {
      self.receive(new Buffer(payload), {});
    });
  }

  if (this._queuedResponses[parsed.id]) {
    this._queuedResponses[parsed.id].end(data);
    delete this._queuedResponses[parsed.id];
    return;
  }

  if (!contact.valid()) {
    this._log.warn('Refusing to send message to invalid contact');
    return this.receive(null);
  }

  var req = self._protocol.request({
    hostname: contact.address,
    port: contact.port,
    method: 'POST',
    agent: self._agent
  }, handleResponse);

  req.setNoDelay(true); // disable the tcp nagle algorithm

  req.on('error', function() {
    self.receive(null);
  });

  req.end(data);
};

/**
 * Close the underlying socket
 * @private
 */
HTTPTransport.prototype._close = function() {
  this._server.close();
};

/**
 * Adds CORS headers to the given response object
 * @private
 * @param {http.IncomingMessage} res
 */
HTTPTransport.prototype._addCrossOriginHeaders = function(req, res) {
  res.setHeader('Access-Control-Allow-Origin', req.headers.origin || '*');
  res.setHeader('Access-Control-Allow-Methods', '*');
  res.setHeader('Access-Control-Allow-Headers', '*');
  res.setHeader('Access-Control-Allow-Credentials', 'true');
};

/**
 * Listen for dropped messages and make sure we clean up references
 * @private
 */
HTTPTransport.prototype._handleDroppedMessage = function(buffer) {
  var message;

  try {
    message = Message.fromBuffer(buffer);
  } catch (err) {
    return false;
  }

  if (this._queuedResponses[message.id]) {
    this._queuedResponses[message.id].end();
    delete this._queuedResponses[message.id];
  }

  return true;
};

module.exports = HTTPTransport;
