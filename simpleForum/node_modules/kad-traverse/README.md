Kad Traverse
============

NAT traversal extension for [Kad](https://github.com/gordonwritescode/kad).

Usage
-----

Install with NPM.

```bash
npm install kad kad-traverse
```

Simply decorate your transport adapter. (Currently only
`kademlia.transports.UDP` is supported).

```js
// Import required packages
var kademlia = require('kad');
var traverse = require('kad-traverse');

// Create your contact
var contact = kademlia.contacts.AddressPortContact({
  address: '127.0.0.0',
  port: 1337
});

// Decorate your transport
var NatTransport = traverse.UDPTransportDecorator(kademlia.transports.UDP);

// Create your transport with options
var transport = new NatTransport(contact, {
  traverse: {
    upnp: { /* options */ },
    stun: { /* options */ },
    turn: { /* options */ }
  }
});
```

Options
-------

The `traverse(options)` function accepts a dictionary containing optional
parameters to pass to each traversal strategy.

* **upnp**
  * forward - `Number`; the port to forward
  * ttl - `Number`; the time to keep port forwarded (0 for indefinite)
* **stun**
  * server - `Object`
    * address - `String`; the address of the STUN server (default: 'stun.services.mozilla.com')
    * port - `Number`; the port of the STUN server (default: 3478)
* **turn**
  * server - `Object`
    * address - `String`; the address of the TURN server (default: 'turn.counterpointhackers.org')
    * port - `Number`; the port of the TURN server (default: 3478)

> Passing `false` for a given strategy will skip it.

Strategies
----------

Kad Traverse decorates your transport adapter to make sure that your node can
be reached behind a NAT. It does this by attempting 4 strategies in sequence:

### None

The first strategy is to simply detect whether or not the address to which your
node is bound is already a public address. If it is not, then try the next
strategy.

### UPnP

Next, we will try to use UPnP to instruct the NAT device to forward a port. If
the NAT device does not support UPnP, then this strategy will fail.

### STUN

Now we want to contact a STUN server and ask it to inform us of our "server
reflexive address and port". Once we know this information we can attempt to
send a request to our public address. This does not work on symmetric NATs.

### TURN

The last strategy is to open a connection with a TURN server and use it as a
relay for sending and receiving messages.
