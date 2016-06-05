# continuous-observer #

Take a [continuous ndarray](http://github.com/hughsk/ndarray-continuous) and, given a
set of "observable" positions, automatically add and remove chunks as required.

Use this for painless chunk management with one or more visible perspectives.

## Installation ##

``` bash
npm install continuous-observer
```

## Usage ##

### `observe = require('continuous-observer')(field[, range[, linger]])` ###

Returns a function that can be used to update the chunks in use, given a
continuous ndarray (`field`). Optionally:

* `range` is the amount of surrounding chunks to include. Defaults to 1.
* `linger` is the amount of surrounding chunks to not remove when cleaning up.
  Defaults to `range`, and cannot be set to below `range`.

### `observe(points)` ###

`points` is an array of arrays, with each array representing an observer's
position. Can also handle a single array as well, if you're only using one
observer.

``` javascript
// Create a continuous ndarray with 32x32 chunks
var field = require('ndarray-continuous')({ shape: [32, 32] })
// Create the observer
var moveTo = require('continuous-observer')(field, 1, 2)

// "Move" the observer to the origin
moveTo([0, 0])

// Ahead one chunk
moveTo([32, 32])

// Ahead another chunk - this will remove
// some of the older chunks.
moveTo([32, 32])

// Including another observer just involves
// adding another position to the array.
moveTo([[32, 32], [0, 0]])
```
