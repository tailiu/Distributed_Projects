webrtc-browser-interactive
==========================

This example demonstrates using the WebRTC transport in the browser.
It is interactive, and requires multiple browser tabs.

A signal server is needed to perform a WebRTC handshake
and initiate the peer-to-peer connection.
This example demonstrates end-to-end connectivity with a signal server.

## Running the example

To start the signal server, do

    node examples/shared/server.js

Then, in your browser navigate to

    http://localhost:8080/examples/webrtc-browser-interactive/index.html

## Explanation

This will serve a webpage with a rudimentary interface.
The interface features 4 forms;

* Node launcher; Input node name and start the node.
* Connection; Input bootstrap node and connect to it.
* Get / Lookup; Lookup a key and return it's value.
* Put; Save a key to the DHT.

To utilize the interface;

* Launch atleast two nodes (with distinct IDs); by opening two browser tabs, 
    and launching.
* Connect the nodes; by inputting the ID of another node, and connecting.

At this point the network is setup, and you can do lookups / stores.
