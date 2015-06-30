var Wire = require('bittorrent-protocol')

var HANDSHAKE_TIMEOUT = 25000

/**
 * WebRTC peer connections start out connected, because WebRTC peers require an
 * "introduction" (i.e. WebRTC signaling), and there's no equivalent to an IP address
 * that lets you refer to a WebRTC endpoint.
 */
exports.createWebRTCPeer = function (conn, swarm) {
  var peer = new Peer(conn.id)
  peer.conn = conn
  peer.swarm = swarm

  if (peer.conn.connected) {
    peer.onConnect()
  } else {
    peer.conn.once('connect', function () { peer.onConnect() })
    peer.conn.once('error', function () { peer.destroy() })
    peer.setTimeout()
  }

  return peer
}

/**
 * Incoming TCP peers start out connected, because the remote peer connected to the
 * listening port of the TCP server. Until the remote peer sends a handshake, we don't
 * know what swarm the connection is intended for.
 */
exports.createIncomingTCPPeer = function (conn, addr) {
  var peer = new Peer(addr)
  peer.conn = conn
  peer.addr = conn.remoteAddress + ':' + conn.remotePort

  peer.onConnect()

  return peer
}

/**
 * Outgoing TCP peers start out with just an IP address. At some point (when there is an
 * available connection), the client can attempt to connect to the address.
 */
exports.createOutgoingTCPPeer = function (addr, swarm) {
  var peer = new Peer(addr)
  peer.swarm = swarm
  peer.addr = addr

  return peer
}

/**
 * Peer. Represents a peer in the Swarm.
 *
 * @param {string|Peer|net.Socket} peer "ip:port" string or peer id (for WebRTC peers)
 */
function Peer (id) {
  var self = this
  self.id = id

  self.addr = null
  self.conn = null
  self.swarm = null
  self.wire = null

  self.destroyed = false
  self.timeout = null // handshake timeout
  self.retries = 0

  self.gotHandshake = false
  self.sentHandshake = false
}

/**
 * Called once the peer is connected (i.e. fired 'connect' event)
 * @param {Socket} conn
 */
Peer.prototype.onConnect = function () {
  var self = this

  function destroy () {
    self.destroy()
  }

  var conn = self.conn
  conn.once('end', destroy)
  conn.once('close', destroy)
  conn.once('finish', destroy)
  conn.once('error', destroy)

  var wire = self.wire = new Wire()
  wire.once('end', destroy)
  wire.once('finish', destroy)
  wire.once('error', destroy)

  wire.once('handshake', function (infoHash) { self.onHandshake(infoHash) })
  self.setTimeout()

  conn.pipe(wire).pipe(conn)
  if (self.swarm) self.handshake()
}

/**
 * Called when handshake is received from remote peer.
 * @param {string} infoHash
 */
Peer.prototype.onHandshake = function (infoHash) {
  var self = this
  if (!self.swarm) return // `self.swarm` not set yet, so do nothing

  if (self.swarm.destroyed || infoHash.toString('hex') !== self.swarm.infoHashHex) {
    self.destroy()
    return
  }

  self.clearTimeout()

  self.gotHandshake = true
  self.retries = 0

  self.wire.on('download', function (downloaded) {
    self.swarm.downloaded += downloaded
    self.swarm.downloadSpeed(downloaded)
    self.swarm.emit('download', downloaded)
  })

  self.wire.on('upload', function (uploaded) {
    self.swarm.uploaded += uploaded
    self.swarm.uploadSpeed(uploaded)
    self.swarm.emit('upload', uploaded)
  })

  if (!self.sentHandshake) self.handshake()

  self.swarm.wires.push(self.wire)

  var addr = self.addr
  if (!addr && self.conn.remoteAddress) {
    addr = self.conn.remoteAddress + ':' + self.conn.remotePort
  }
  self.swarm.emit('wire', self.wire, addr)
}

Peer.prototype.handshake = function () {
  var self = this
  self.wire.handshake(self.swarm.infoHash, self.swarm.peerId, self.swarm.handshakeOpts)
  self.sentHandshake = true
}

Peer.prototype.setTimeout = function () {
  var self = this
  if (self.timeout) clearTimeout(self.timeout)
  self.timeout = setTimeout(function () {
    self.destroy()
  }, HANDSHAKE_TIMEOUT)
  if (self.timeout.unref) self.timeout.unref()
}

Peer.prototype.clearTimeout = function () {
  var self = this
  if (self.timeout) clearTimeout(self.timeout)
  self.timeout = null
}

Peer.prototype.destroy = function () {
  var self = this
  if (self.destroyed) return
  self.destroyed = true

  if (self.conn) self.conn.destroy()

  self.swarm.wires.splice(self.swarm.wires.indexOf(self.wire), 1)

  if (self.wire) self.wire.destroy()

  // If swarm was at capacity before, try to open a new connection now
  if (self.swarm) {
    self.swarm._removePeer(self.id)
    self.swarm._drain()
  }

  if (self.timeout) clearTimeout(self.timeout)
  self.timeout = null

  self.conn = null
  self.swarm = null
  self.wire = null
}
