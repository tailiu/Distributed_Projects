var kad = require('kad');
var stencil = require('./stencil')

const DHTSeed = {
 	address: '127.0.0.1',
	port: 8200
}

stencil.createDHTNode(DHTSeed.address, DHTSeed.port, 'db1', function() {})
