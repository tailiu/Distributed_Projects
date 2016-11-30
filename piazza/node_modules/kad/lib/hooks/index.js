/**
 * @module kad/hooks
 */

'use strict';

module.exports = {
  /**
   * Creates a blacklist filter for rejecting messages from defined nodeIDs
   * @function
   * @param {Array} nodeIDs - List of nodeIDs to blacklist
   * @returns {Function}
   */
  blacklist: require('./blacklist'),
  /**
   * Creates a whitelist filter for accepting messages from defined nodeIDs
   * @function
   * @param {Array} nodeIDs - List of nodeIDs to whitelist
   * @returns {Function}
   */
  whitelist: require('./whitelist'),
  /**
   * Allows the definition of method handlers not defined by kademlia
   * @function
   * @param {Object} protocol - Hash map of <method_name>:<handler_function>
   * @returns {Function}
   */
  protocol: require('./protocol')
};
