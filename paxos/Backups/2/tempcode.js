
// pserver.js

// Create a local version of a peer,
// setting up an easy way to send it data
// with a default timeout
// var createPeer = function(port) {
//     var host = "http://localhost:" + port;
//     return {
//         send: function(path, content, callback) {
//             request.post(
//                 {
//                     url: host + path,
//                     json: content,
//                     timeout: REQUEST_TIMEOUT
//                 },
//                 function(err, response) {
//                     callback = callback || function() {};
//                     if(shouldDrop()) {
//                         log("Dropping packet on purpose");
//                         callback(null, {body: {error: DROPPED_ERROR}});
//                     }
//                     else {
//                         callback(err, response);
//                     }
//                 }
//             );
//         },
//         port: port
//     };
// }

// cli-client.js


// var client = new net.Socket();
//
// client.connect(PORT, HOST, function() {
// 	console.log(helper.getTimestamp(),'Server Connected: '+PORT);
// 	client.write('Hello, server! Love, Client.');
// });
//
// client.on('data', function(data) {
// 	console.log(helper.getTimestamp(),'Received: <$>'.replace('$',data));
//   client.pipe(helper.getTimestamp() + logFile);
// 	// client.destroy(); // kill client after server's response
// });
//
// client.on('close', function() {
// 	console.log(helper.getTimestamp(),'Connection closed!');
// });



// cli.js

// var server = net.createServer(function(socket) {
//   console.log(helper.getTimestamp(), 'CONNECTED: ' + socket.remotePort);
//
//   socket.write('Hi from server\r\n');
//
//   socket.on('data', function(data) {
//       console.log(helper.getTimestamp(),'DATA ' + socket.remotePort + ': ' + data);
//       socket.write('Server says it received: "' + data + '"');
//   });
//
//   socket.on('close', function(data) {
//       console.log(helper.getTimestamp(),'CLOSED: ' + socket.remotePort);
//   });
// 	socket.pipe(helper.getTimestamp() + logFile);
// });
//
// server.listen(PORT, '127.0.0.1');
// console.log(helper.getTimestamp(), "Started listening on port: " + PORT);
