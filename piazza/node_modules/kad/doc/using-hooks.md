The `kademlia.RPC` class exposes a hooks interface for
processing messages and implementing custom behaviors.

Hooks are executed in the order they are registered. Calling `next(err)` will
exit the middleware stack and prevent Kad from handling the message. *You
should always define an `error` handler, otherwise `RPC` will throw*.

### Events

The `kademlia.RPC` class triggers hooks for the following events:

* `serialize`
  * `before` handler receives `(message, next)`
  * `after` handler receives nothing
* `deserialize`
  * `before` handler receives `(buffer, next)`
  * `after` handler receives nothing
* `send`
  * `before` handler receives `(buffer, contact, next)`
  * `after` handler receives nothing
* `receive`
  * `before` handler receives `(message, contact, next)`
  * `after` handler receives nothing
* `open`
  * `before` handler receives `(next)`
  * `after` handler receives nothing
* `close`
  * `before` handler receives `(next)`
  * `after` handler receives nothing

### Example: Simple Blacklist Hook

```
// array of blacklisted nodeID's
var blacklist = [];
// use a logger to print when a blacklisted node talks
var logger = kademlia.Logger(3);
// the transport adapter we will pass to our `Node`
var transport = kademlia.transports.UDP(contact, options);

// register a middleware function to check blacklist
transport.before('receive', function(message, contact, next) {
  // exit middleware stack if contact is blacklisted
  if (blacklist.indexOf(contact.nodeID) !== -1) {
    return next(new Error('Message dropped from blacklisted contact'));
  }
  // otherwise pass on
  next();
});

// handle errors from RPC
transport.on('error', function(err) {
  logger.warn('RPC error raised, reason: %s', err.message);
});
```

### Request/Response Handling

The middleware stack gets applied to both requests **and** responses. If you
need your middleware to only apply to one or the other, use the
{@link Message} module to check the type of message:

```
var Message = kademlia.Message;

// only apply this middleware to requests
transport.before('receive', function(message, contact, next) {
  // return early and move to next middleware if this is not a request
  if (!Message.isRequest(message)) {
    return next();
  }
  // otherwise do fancy middleware stuff ...
});
```
