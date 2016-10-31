/**
 * @module kad/storage
 */

'use strict';

module.exports = {

  /**
   * @external kad-fs
   * @see {@link https://github.com/kadtools/kad-fs}
   */
  /**
   * Stores {@link Item} as file in the specified directory
   * @constructor
   * @param {String} datadir - Directory to store items
   */
  FS: require('kad-fs'),

  /**
   * @external kad-localstorage
   * @see {@link https://github.com/kadtools/kad-localstorage}
   */
  /**
   * Stores {@link Item} in browser localStorage using the given namespace
   * @constructor
   * @param {String} namespace - Prefix for keys in localStorage
   */
  LocalStorage: require('kad-localstorage'),

  /**
   * @external kad-memstore
   * @see {@link https://github.com/kadtools/kad-memstore}
   */
  /**
   * Stores {@link Item} in memory for testing
   * @constructor
   */
  MemStore: require('kad-memstore')

};
