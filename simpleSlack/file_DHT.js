var kad = require('kad');

var dht = new kad.Node({
  transport: kad.transports.UDP(kad.contacts.AddressPortContact({
    address: '127.0.0.1',
    port: 8300
  })),
  storage: kad.storage.FS('db5')
});
