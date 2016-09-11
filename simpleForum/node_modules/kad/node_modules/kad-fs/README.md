Kad FS
======

A simple file based key/value store for [kad](https://gitlab.com/gordonhall/kad).

Usage
-----

```
npm install kad-fs --save
```

```js
var kad = require('kad');
var kadfs = require('kad-fs');

var dht = kad({
  // ...
  storage: kadfs('/path/to/datadir')
});
```
