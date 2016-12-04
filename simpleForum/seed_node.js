var kad = require('kad');
var stencil = require('WebStencil')

const DHTSeed = {
 	address: '127.0.0.1',
	port: 8200
}

stencil.initStencilHandler(DHTSeed.address, DHTSeed.port, 'db1')
