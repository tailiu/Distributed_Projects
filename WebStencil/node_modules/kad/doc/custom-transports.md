The primary focus for Kad's design was to create a simple, sane, minimally
configured setup while allowing for maximum flexibility when it comes to
building applications on or around it. This is why all of the communication
logic is abstracted. Kad does not care how your nodes talk to one another, you
simply provide it with the information that *your* transport adapter needs to
communicate with peers and it will handle the rest.

When building a custom transport, there are a few simple steps:

1. Implement a custom {@link Contact}
3. Inherit your transport from {@link RPC}
4. Implement `_open`, `_send`, and `_close` methods

A `Contact` contains the information your transport adapter needs to talk to
other peers. A `Transport` defines how those peers communicate.

### Example: Simple UDP Transport

```
var kademlia = require('kademlia');
var inherits = require('util').inherits;
var dgram = require('dgram');

// Define your Transport as a constructor function
function UDPTransport(contact, options) {
  var self = this;

  // Make sure that it can be instantiated without the `new` keyword
  if (!(this instanceof UDPTransport)) {
    return new UDPTransport(contact, options);
  }

  // Call `kademlia.RPC` to setup bindings
  kademlia.RPC.call(this, contact, options);
}

// Inherit for `kademlia.RPC`
inherits(UDPTransport, kademlia.RPC);

// Implement `_open` method to start server
UDPTransport.prototype._open = function(ready) {
  // Create a UDP socket object
  this._socket = dgram.createSocket({
    type: 'udp4',
    reuseAddr: true
  }, function(messageBuffer) {
    // Call RPC.receive when ready for Kad to handle message
    self.receive(messageBuffer);
  });

  // Start listening for UDP messages on the supplied address and port
  this._socket.bind(contact.port, contact.address, ready);
};

// Implement `_send` method to deliver a message
UDPTransport.prototype._send = function(data, contact) {
  this._socket.send(data, 0, data.length, contact.port, contact.address);
};

// Implement `_close` method to cleanup
UDPTransport.prototype._close = function() {
  this._socket.close();
};
```
