'use strict';

var assert = require('assert');

/**
 * Factory for whitelist middleware
 * @function
 * @param {Array} whitelist - list of nodeID's to allow
 * @returns {Function}
 */
module.exports = function WhitelistFactory(whitelist) {
  assert(Array.isArray(whitelist), 'Invalid whitelist supplied');

  return function whitelister(message, contact, next) {
    if (whitelist.indexOf(contact.nodeID) === -1) {
      return next(new Error('Contact is not in the whitelist'));
    }

    next();
  };
};
