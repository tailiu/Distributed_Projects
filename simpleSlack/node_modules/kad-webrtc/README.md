Kad WebRTC Transport
====================

A WebRTC transport adapter for [Kad](https://github.com/gordonwritescode/kad).

Setup
-----

```
npm install kad kad-webrtc
```

Usage
-----

```js
var Node = require('kad').Node;
var WebRTC = require('kad-webrtc');

var dht = new Node({
  // ...
  transport: WebRTC(WebRTC.Contact({ nick: 'mynickname' }), {
    signaller: SignalServer // see examples
  })
});

dht.connect({ nick: 'somebody' }, function(err) {
  console.log('party!');
});
```

Usage from Node
---------------

If you want to use this package from Node,
or if you want to run the tests in this package,
you will need to manually install the `wrtc` dependency.

You can do this by running:

    npm install wrtc@0.0.59

The reason for this is that the `wrtc` dependency doesn't install correctly
on many platforms.
So we leave it up to the user whether they want to include it or not.

Additionally, you will need to pass a reference to `wrtc` to the transport:

```js
var Node = require('kad').Node;
var WebRTC = require('kad-webrtc');
var wrtc = require('wrtc');

var dht = new Node({
  // ...
  transport: WebRTC(WebRTC.Contact({ nick: 'mynickname' }), {
    wrtc: wrtc,
    signaller: SignalServer // see examples
  })
});

dht.connect({ nick: 'somebody' }, function(err) {
  console.log('party!');
});
```

Examples
--------

To build the examples, run `npm run build-examples`.

After that, look at the READMEs in each example directory
to see how to run them.
