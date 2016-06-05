# ndarray-group #

Wraps a group of [ndarrays](http://github.com/mikolalysenko/ndarray) to return
a single virtual ndarray using
[ndarray-proxy](http://github.com/mikolalysenko/ndarray-proxy).

This should make it easy when dealing with chunked grids or voxel volumes to
compare neighboring chunks.

*Note however there is a performance hit in getting/setting values with this
module*. This could hopefully become less significant with code generation,
but I'd like to wait until it's necessary before trying it.

## Installation ##

``` bash
npm install ndarray-group
```

## Usage ##

### `group(dims, arrays)` ###

`dims` specifies the dimensions of the group (by array as opposed to elements),
so:

* `[2, 2]`: Takes four ndarrays and returns a wrapper twice as high and wide
  as each child.
* `[3, 3, 3]`: Takes 27 ndarrays, this time thrice as large.
* `[2, 1, 1]`: Takes 2 ndarrays, twice as large on the X axis but otherwise
  the same.

`arrays` is a list of ndarrays. Each array must be the same shape, and the
list must be the correct length to fill the proxy ndarray.

Arrays should be sorted in ascending order by axis, e.g.
`[-1,-1]`, `[0,-1]`, `[1,-1]`, `[-1,0]`, `[0,0]`, `[1,0]`...

``` javascript
var group = require('ndarray-group')
var fill = require('ndarray-fill')
var chunks = []

for (var z = 0; z < 3; z += 1)
for (var y = 0; y < 3; y += 1)
for (var x = 0; x < 3; x += 1) {
  chunks.push(zeros([50, 50]))
}

var grouped = group([3, 3, 3], chunks)

fill(grouped, function(x, y, z) {
  return grouped.get(x, y, z) + 1
})
```
