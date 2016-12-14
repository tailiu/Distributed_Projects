/**
 * @module kad-traverse/strategies/upnp
 */

'use strict';

var natupnp = require('nat-upnp').createClient();

/**
 * Uses UPnP to forward a port
 * @function
 * @param {Object} options
 * @param {Number} options.forward - port to forward
 * @param {Number} options.ttl - time to live
 */
module.exports = function UPnPStrategy(options) {
  return function upnp(callback) {
    var self = this;
    var port = options.forward || this._contact.port;

    natupnp.portMapping({
      public: port,
      private: this._contact.port,
      ttl: options.ttl || 0
    }, function(err) {
      if (err) {
        self._log.warn('could not connect to NAT device via UPnP');
        return callback(false);
      }

      natupnp.externalIp(function(err, ip) {
        if (err) {
          self._log.warn('could not obtain public IP address');
          return callback(false);
        }

        self._contact.address = ip;
        self._contact.port = port;

        self._log.info('successfully traversed NAT via UPnP');
        callback(true);
      });
    });
  };
};
