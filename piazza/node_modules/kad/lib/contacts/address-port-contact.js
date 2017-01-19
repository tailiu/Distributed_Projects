'use strict';

var assert = require('assert');
var Contact = require('../contact');
var inherits = require('util').inherits;
var utils = require('../utils');

/**
 * Represent a contact (or peer)
 * @constructor
 * @extends {Contact}
 * @param {Object} options
 * @param {String} options.address - IP or hostname
 * @param {Number} options.port - Listening port
 */
function AddressPortContact(options) {
  if (!(this instanceof AddressPortContact)) {
    return new AddressPortContact(options);
  }

  assert(typeof options === 'object', 'Invalid options were supplied');
  assert(typeof options.address === 'string', 'Invalid address was supplied');
  assert(typeof options.port === 'number', 'Invalid port was supplied');

  this.address = options.address;
  this.port = options.port;

  Contact.call(this, options);
}

inherits(AddressPortContact, Contact);

/**
 * Generate a NodeID by taking the SHA1 hash of the address and port
 * @private
 */
AddressPortContact.prototype._createNodeID = function() {
  return utils.createID(this.toString());
};

/**
 * Ensures that the address and port are valid
 * @returns {Boolean}
 */
AddressPortContact.prototype.valid = function() {
  return this.port > 0 && this.port < 65536;
};

/**
 * Generate a user-friendly string for the contact
 */
AddressPortContact.prototype.toString = function() {
  return this.address + ':' + this.port;
};

module.exports = AddressPortContact;
