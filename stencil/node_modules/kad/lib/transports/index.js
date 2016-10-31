/**
 * @module kad/transports
 */

'use strict';

module.exports = {
  /** {@link TCPTransport} */
  TCP: require('./tcp'),
  /** {@link UDPTransport} */
  UDP: require('./udp'),
  /** {@link HTTPTransport} */
  HTTP: require('./http')
};
