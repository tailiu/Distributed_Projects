'use strict';

var assert = require('assert');
var utils = require('./utils');

/**
 * The base class from which custom contacts inherit; used by the included
 * {@link AddressPortContact}. Nodes provide each other with contact
 * information which indicates how others should communicate with them.
 * @constructor
 * @param {Object} options
 * @param {String} options.nodeID - Optional known 160 bit node ID
 */
function Contact(options) {
  if (!(this instanceof Contact)) {
    return new Contact(options);
  }

  assert(options instanceof Object, 'Invalid options were supplied');

  Object.defineProperty(this, 'nodeID', {
    value: options.nodeID || this._createNodeID(),
    configurable: false,
    enumerable: true
  });

  assert(utils.isValidKey(this.nodeID), 'Invalid nodeID was supplied');

  this.seen();
}

/**
 * Updates the lastSeen property to right now
 */
Contact.prototype.seen = function() {
  this.lastSeen = Date.now();
};

/**
 * Validator function for determining if contact is okay
 * @abstract
 * @returns {Boolean}
 */
Contact.prototype.valid = function() {
  return true;
};

/**
 * Unimplemented stub, called when no nodeID is passed to constructor.
 * @private
 * @abstract
 */
Contact.prototype._createNodeID = function() {
  throw new Error('Method not implemented');
};

module.exports = Contact;
