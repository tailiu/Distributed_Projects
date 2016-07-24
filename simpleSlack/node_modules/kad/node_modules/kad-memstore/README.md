Kad MemStore
============

In-memory [Kad](https://github.com/gordonwritescode/kad) storage adapter for
testing and simulation.

Usage
-----

```bash
npm install kad-memstore --save
```

```js
var kad = require('kad');
var MemStore = require('kad-memstore');

var dht = new kad.Node({
  // ...
  storage: MemStore()
});
```
