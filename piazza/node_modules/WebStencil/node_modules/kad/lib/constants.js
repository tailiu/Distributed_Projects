/**
 * @module kad/constants
 */

'use strict';

var ms = require('ms');

module.exports = {

  /** @constant {Number} ALPHA - Degree of parallelism */
  ALPHA: 3,

  /** @constant {Number} B - Number of bits for nodeID creation */
  B: 160,

  /** @constant {Number} K - Number of contacts held in a bucket */
  K: 20,

  /** @constant {Number} T_REFRESH - Interval for performing router refresh */
  T_REFRESH: ms('3600s'),

  /** @constant {Number} T_REPLICATE - Interval for replicating local data */
  T_REPLICATE: ms('3600s'),

  /** @constant {Number} T_REPUBLISH - Interval for republishing data */
  T_REPUBLISH: ms('86400s'),

  /** @constant {Number} T_EXPIRE - Interval for expiring local data entries */
  T_EXPIRE: ms('86405s'),

  /** @constant {Number} T_RESPONSETIMEOUT - Time to wait for RPC response */
  T_RESPONSETIMEOUT: ms('5s'),

  /** @constant {Array} MESSAGE_TYPES - Allowed RPC methods */
  MESSAGE_TYPES: [
    'PING',
    'STORE',
    'FIND_NODE',
    'FIND_VALUE'
  ]

};
