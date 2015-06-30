module.exports = TCPPool

var dezalgo = require('dezalgo')
var net = require('net') // browser exclude
var Peer = require('./peer')

/**
 * Shared TCP pools; shared among all swarms
 * @type {Object} port: number -> pool: TCPPool
 */
var tcpPools = {}

/**
 * TCPPool
 *
 * A "TCP pool" allows multiple swarms to listen on the same TCP port and determines
 * which swarm incoming connections are intended for by inspecting the bittorrent
 * handshake that the remote peer sends.
 *
 * @param {number} port
 */
function TCPPool (port) {
  var self = this

  self.port = port
  self.listening = false
  self.swarms = {} // infoHash (hex) -> Swarm

  // Save incoming conns so they can be destroyed if server is closed before the conn is
  // passed off to a Swarm.
  self.pendingConns = []

  self.server = net.createServer()
  self.server.on('connection', function (conn) { self._onConnection(conn) })
  self.server.on('error', function (err) { self._onError(err) })
  self.server.on('listening', function () { self._onListening() })
  self.server.listen(self.port)
}

/**
 * STATIC METHOD
 * Add a swarm to a pool, creating a new pool if necessary.
 * @param {Swarm} swarm
 */
TCPPool.addSwarm = function (swarm) {
  var pool = tcpPools[swarm._port]
  if (!pool) pool = tcpPools[swarm._port] = new TCPPool(swarm._port)
  pool.addSwarm(swarm)
  return pool
}

/**
 * STATIC METHOD
 * Remove a swarm from its pool.
 * @param {Swarm} swarm
 */
TCPPool.removeSwarm = function (swarm) {
  var pool = tcpPools[swarm._port]
  if (!pool) return
  pool.removeSwarm(swarm)

  var numSwarms = 0
  for (var infoHashHex in pool.swarms) {
    var s = pool.swarms[infoHashHex]
    if (s) numSwarms += 1
  }
  if (numSwarms === 0) pool.destroy()
}

/**
 * STATIC METHOD
 * When `Swarm.prototype.listen` is called without specifying a port, a reasonable
 * default port must be chosen. If there already exists an active TCP pool, then return
 * that pool's port so that TCP server can be re-used. Otherwise, return 0 so node will
 * pick a free port.
 *
 * @return {number} port
 */
TCPPool.getDefaultListenPort = function (infoHashHex) {
  for (var port in tcpPools) {
    var pool = tcpPools[port]
    if (pool && !pool.swarms[infoHashHex]) return pool.port
  }
  return 0
}

/**
 * Add a swarm to this TCP pool.
 * @param {Swarm} swarm
 */
TCPPool.prototype.addSwarm = function (swarm) {
  var self = this
  if (self.listening) {
    process.nextTick(function () {
      swarm._onListening(self.port)
    })
  }

  if (self.swarms[swarm.infoHashHex]) {
    process.nextTick(function () {
      swarm._onError(new Error(
        'There is already a swarm with info hash ' + swarm.infoHashHex + ' ' +
        'listening on port ' + swarm._port
      ))
    })
    return
  }

  self.swarms[swarm.infoHashHex] = swarm
}

/**
 * Remove a swarm from this TCP pool.
 * @param  {Swarm} swarm
 */
TCPPool.prototype.removeSwarm = function (swarm) {
  var self = this
  self.swarms[swarm.infoHashHex] = null
}

/**
 * Destroy this TCP pool.
 * @param  {function} cb
 */
TCPPool.prototype.destroy = function (cb) {
  var self = this
  if (cb) cb = dezalgo(cb)

  self.listening = false

  // Destroy all open connection objects so server can close gracefully without waiting
  // for connection timeout or remote peer to disconnect.
  self.pendingConns.forEach(function (conn) {
    conn.destroy()
  })

  tcpPools[self.port] = null

  try {
    self.server.close(cb)
  } catch (err) {
    if (cb) cb(null)
  }
}

TCPPool.prototype._onListening = function () {
  var self = this
  var port = self.server.address().port

  if (port !== self.port) {
    // `port` was 0 when `listen` was called; update to the port that node selected
    tcpPools[self.port] = null
    self.port = port
    tcpPools[self.port] = self
  }

  self.listening = true

  for (var infoHashHex in self.swarms) {
    var swarm = self.swarms[infoHashHex]
    if (swarm) swarm._onListening(self.port)
  }
}

/**
 * On incoming connections, we expect the remote peer to send a handshake first. Based
 * on the infoHash in that handshake, route the peer to the right swarm.
 */
TCPPool.prototype._onConnection = function (conn) {
  var self = this

  self.pendingConns.push(conn)
  conn.once('close', removePendingConn)

  function removePendingConn () {
    self.pendingConns.splice(self.pendingConns.indexOf(conn))
  }

  var peer = Peer.createIncomingTCPPeer(conn)

  peer.wire.once('handshake', function (infoHash) {
    removePendingConn()
    conn.removeListener('close', removePendingConn)

    var swarm = self.swarms[infoHash.toString('hex')]
    if (swarm) {
      peer.swarm = swarm
      swarm._addIncomingPeer(peer)
      peer.onHandshake(infoHash)
    } else {
      // Unexpected info hash, so destroy peer
      peer.destroy()
    }
  })
}

TCPPool.prototype._onError = function (err) {
  var self = this
  self.destroy()
  for (var infoHashHex in self.swarms) {
    var swarm = self.swarms[infoHashHex]
    if (swarm) {
      self.removeSwarm(swarm)
      swarm._onError(err)
    }
  }
}
