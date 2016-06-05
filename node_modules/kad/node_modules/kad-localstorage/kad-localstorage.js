#!/usr/bin/env node

'use strict'

module.exports = KadLocalStorage

var EventEmitter = require('events').EventEmitter

function KadLocalStorage(namespace) {
  if(namespace.indexOf('_') >= 0) throw new Error('invalid namespace')
  this._prefix = namespace + '_'
}

KadLocalStorage.prototype.get = function(key, cb) {
  var val = localStorage.getItem(this._prefix + key)
  if(!val) return cb(new Error('not found'))
  cb(null, val)
}

KadLocalStorage.prototype.put = function(key, val, cb) {
  key = this._prefix + key
  localStorage.setItem(key, val)
  cb(null, localStorage[key])
}

KadLocalStorage.prototype.del = function(key, cb) {
  key = this._prefix + key
  localStorage.removeItem(key)
  cb(null)
}

KadLocalStorage.prototype.createReadStream = function() {
  var storage = this
  var stream = new EventEmitter()
  setTimeout(function() {
    var len = localStorage.length
    for(var i = 0; i < len; i++) {
      var unprefixedKey = localStorage.key(i)
      var isOwnKey = unprefixedKey.indexOf(storage._prefix) === 0
      if(!isOwnKey) continue
      var key = unprefixedKey.substring(storage._prefix.length)
      storage.get(key, onGet.bind(null, key))
    }
    stream.emit('end')
  })
  return stream

  function onGet(key, err, val) {
    stream.emit('data', { key: key, value: val })
  }
}
