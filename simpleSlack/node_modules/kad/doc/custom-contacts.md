Creating a custom contact is very simple. You need only to:

1. Define a constructor function that accepts a dictionary
2. Inherit from {@link Contact}
3. Implement {@link Contact#\_createNodeID}
4. Call super class at bottom of your constructor

### Example: Address/Port Contact

```
var kademlia = require('kad');
var inherits = require('util').inherits;
var utils = require('../utils');

// Define you constructor function
function AddressPortContact(options) {
  // Make sure the `new` keyword is not required
  if (!(this instanceof AddressPortContact)) {
    return new AddressPortContact(options);
  }

  // Store relevant contact information
  this.address = options.address;
  this.port = options.port;

  // Call super class to setup bindings
  kademlia.Contact.call(this, options);
}

// Inherit from `kademlia.Contact`
inherits(AddressPortContact, kademlia.Contact);

// Implement `_createNodeID` for super class to use
AddressPortContact.prototype._createNodeID = function() {
  return utils.createID(this.address + ':' + this.port);
};
```
