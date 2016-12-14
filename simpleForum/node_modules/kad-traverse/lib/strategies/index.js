/**
 * @module kad-traverse/strategies
 */

'use strict';

module.exports = {
  none: require('./none'),
  upnp: require('./upnp'),
  stun: require('./stun'),
  turn: require('./turn')
};
