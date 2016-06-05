# cell-range #

Takes a "hi" and "lo" pair of vectors and returns all of the possible (integer)
vector values between them - handling an arbitrary number of dimensions.
It's essentially a more general purpose version of
[moore](http://github.com/hughsk/moore).

## Installation ##

``` bash
npm install cell-range
```

## Usage ##

### `require('cell-range')(hi, lo)` ###

Takes two position arrays, returning an array of points between:

``` javascript
var range = require('cell-range')
var cells = range(
  [-1, -1, -1],
  [+1, +1, +1]
)

for (var i = 0; i < cells.length; i += 1) {
  console.log(cells[i])
}

// [-1,-1]
// [-1, 0]
// [-1, 1]
// [ 0,-1]
// [ 0, 0]
// [ 0, 1]
// [ 1,-1]
// [ 1, 0]
// [ 1, 1]
```
