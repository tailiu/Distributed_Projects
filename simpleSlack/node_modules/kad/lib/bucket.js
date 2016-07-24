'use strict';

var _ = require('lodash');
var assert = require('assert');
var constants = require('./constants');
var Contact = require('./contact');

/**
* A bucket is a "column" of the routing table. It is an array-like object that
* holds {@link Contact}s.
* @constructor
*/
function Bucket() {
  if (!(this instanceof Bucket)) {
    return new Bucket();
  }

  this._contacts = [];
}

/**
 * Return the number of contacts in this bucket
 * @returns {Number}
 */
Bucket.prototype.getSize = function() {
  return this._contacts.length;
};

/**
 * Return the list of contacts in this bucket
 * @returns {Array}
 */
Bucket.prototype.getContactList = function() {
  return _.clone(this._contacts);
};

/**
 * Return the contact at the given index
 * @param {Number} index - Index of contact in bucket
 * @returns {Contact|null}
 */
Bucket.prototype.getContact = function(index) {
  assert(index >= 0, 'Contact index cannot be negative');

  return this._contacts[index] || null;
};

/**
 * Adds the contact to the bucket
 * @param {Contact} contact - Contact instance to add to bucket
 * @returns {Boolean} added - Indicates whether or not the contact was added
 */
Bucket.prototype.addContact = function(contact) {
  assert(contact instanceof Contact, 'Invalid contact supplied');

  if (this.getSize() === constants.K) {
    return false;
  }

  if (!this.hasContact(contact.nodeID)) {
    var index = _.sortedIndex(this._contacts, contact, function(contact) {
      return contact.lastSeen;
    });

    this._contacts.splice(index, 0, contact);
  }

  return true;
};

/**
 * Removes the contact from the bucket
 * @param {Contact} contact - Contact instance to remove from bucket
 * @returns {Boolean} removed - Indicates whether or not the contact was removed
 */
Bucket.prototype.removeContact = function(contact) {
  var index = this.indexOf(contact);

  if (index >= 0) {
    this._contacts.splice(index, 1);
    return true;
  }

  return false;
};

/**
 * Returns boolean indicating that the nodeID is contained in the bucket
 * @param {String} nodeID - 160 bit node ID
 * @returns {Boolean}
 */
Bucket.prototype.hasContact = function(nodeID) {
  for (var i = 0; i < this.getSize(); i++) {
    if (this._contacts[i].nodeID === nodeID) {
      return true;
    }
  }

  return false;
};

/**
 * Returns the index of the given contact
 * @param {Contact} contact - Contact instance for index check
 * @returns {Number}
 */
Bucket.prototype.indexOf = function(contact) {
  assert(contact instanceof Contact, 'Invalid contact supplied');

  for (var i = 0; i < this.getSize(); i++) {
    if (this.getContact(i).nodeID === contact.nodeID) {
      return i;
    }
  }

  return -1;
};

module.exports = Bucket;
