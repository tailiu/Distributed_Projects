#!/usr/bin/env node

'use strict';

var kademlia = require('kad');
var EventEmitter = require('events').EventEmitter;
var wrtc = require('wrtc');
var WebRTC = require('../..');

// The two nodes share a signaller
var signaller = new EventEmitter();

// Create our first node
var node1 = new kademlia.Node({
  transport: WebRTC(new WebRTC.Contact({
    nick: 'node1'
  }), {
    signaller: signaller,
    wrtc: wrtc // When running in Node, we have to pass the wrtc package
  }),
  storage: new kademlia.storage.MemStore()
});

// Create a second node
var node2 = new kademlia.Node({
  transport: WebRTC(new WebRTC.Contact({
    nick: 'node2'
  }), {
    signaller: signaller,
    wrtc: wrtc // When running in Node, we have to pass the wrtc package
  }),
  storage: new kademlia.storage.MemStore(),
  seeds: [{ nick: 'node1' }] // Connect to the first node
});

node2.on('connect', onNode2Ready);

node2.connect({ nick: 'node1' });

function onNode2Ready() {
  node1.put('beep', 'boop', onPut);
}

function onPut(err) {
  node2.get('beep', onGet);
}

function onGet(err, value) {
  console.log(value); // 'boop'
  process.exit();
}
