'use strict';

var kademlia = require('kad');
var WebRTC = require('../..');
var webSocket = require('../shared/web-socket');
var SignalClient = require('../shared/signal-client');
var EventEmitter = require('events').EventEmitter;
var signalClient1 = new SignalClient('node1');
var signalClient2 = new SignalClient('node2');

webSocket.on('open', function() {

  // Create our first node
  var node1 = new kademlia.Node({
    transport: new WebRTC(new WebRTC.Contact({
      nick: 'node1'
    }), { signaller: signalClient1 }),
    storage: new kademlia.storage.LocalStorage('node1')
  });

  // Create a second node
  var node2 = new kademlia.Node({
    transport: new WebRTC(new WebRTC.Contact({
      nick: 'node2'
    }), { signaller: signalClient2 }),
    storage: new kademlia.storage.LocalStorage('node2')
  });

  node2.on('connect', onConnect);

  node2.connect({ nick: 'node1' });

  function onConnect() {
    node1.put('beep', 'boop', onPut);
  }

  function onPut(err) {
    node2.get('beep', onGet);
  }

  function onGet(err, value) {
    alert(value); // 'boop'
  }

});
