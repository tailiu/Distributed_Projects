'use strict';

var kademlia = require('kad');
var EventEmitter = require('events').EventEmitter;
var WebRTC = require('../..');

var node;

document.querySelector('#node').addEventListener('submit', function (e) {
  // Prevent page refresh
  e.preventDefault();

  var element = document.querySelector('#node input[name=id]');
  var id_string = element.value;

  var webSocket = require('../shared/web-socket');
  var SignalClient = require('../shared/signal-client');
  var signaller = new SignalClient(id_string);

  webSocket.on('open', function() {
    node = new kademlia.Node({
      transport: new WebRTC(new WebRTC.Contact({
        nick: id_string
      }), { signaller: signaller }),
      storage: new kademlia.storage.LocalStorage(id_string)
    });

    function onConnect() {
      console.log("Connection established!");
    }

    node.on('connect', onConnect);
  });
});

document.querySelector('#connect').addEventListener('submit', function (e) {
  // Prevent page refresh
  e.preventDefault();

  var element = document.querySelector('#connect input[name=id]');
  var id_string = element.value;

  console.log("Connect ID: " + id_string);

  node.connect({ nick: id_string }, function(err) {
    if(err) {
      alert(err);
      return;
    }
    alert("Connected!");
  });
});

document.querySelector('#get').addEventListener('submit', function (e) {
  // Prevent page refresh
  e.preventDefault();

  var element = document.querySelector('#get input[name=key]');
  var key_string = element.value;

  console.log("Lookup key: " + key_string);

  node.get(key_string, function(err, value) {
    if(err) {
      alert(err);
      return;
    }
    alert(value);
  });
});

document.querySelector('#put').addEventListener('submit', function (e) {
  // Prevent page refresh
  e.preventDefault();

  var element;

  element = document.querySelector('#put input[name=key]');
  var key_string = element.value;

  element = document.querySelector('#put input[name=value]');
  var value_string = element.value;

  console.log("Save key: " + key_string);
  console.log("Save value: " + value_string);

  node.put(key_string, value_string, function(err) {
    if(err) {
      alert(err);
      return;
    }
    alert("Stored!");
  });
});

