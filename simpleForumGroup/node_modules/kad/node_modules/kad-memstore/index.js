/**
 * @module kad-memstore
 */

'use strict';

var ReadableStream = require('readable-stream');

/**
 * Creates an in-memory kad storage adapter
 * @constructor
 */
function KadMemStore() {
  if (!(this instanceof KadMemStore)) {
    return new KadMemStore();
  }

  this._store = {};
}

/**
 * Gets an item from the store
 * #get
 * @param {string} key
 * @param {function} callback
 */
KadMemStore.prototype.get = function(key, callback) {
  var self = this;

  setImmediate(function getItem() {
    callback(null, self._store[key] || null);
  });
};

/**
 * Puts an item into the store
 * #put
 * @param {string} key
 * @param {string} value
 * @param {function} callback
 */
KadMemStore.prototype.put = function(key, value, callback) {
  this._store[key] = value;

  setImmediate(callback);
};

/**
 * Deletes an item from the store
 * #del
 * @param {string} key
 * @param {function} callback
 */
KadMemStore.prototype.del = function(key, callback) {
  delete this._store[key];

  setImmediate(callback);
};

/**
 * Returns a readable stream of items
 * #createReadStream
 */
KadMemStore.prototype.createReadStream = function() {
  var adapter = this;
  var items = Object.keys(this._store);
  var current = 0;

  return new ReadableStream({
    objectMode: true,
    read: function() {
      var stream = this;
      var key = items[current];

      if (!key) {
        return stream.push(null);
      }

      setImmediate(function pushItem() {
        current++;
        stream.push({ key: key, value: adapter._store[key] });
      });
    }
  });
};

module.exports = KadMemStore;
