bit-interleave
==============
[Interleaves](https://en.wikipedia.org/wiki/Z-order_%28curve%29) the bits of up to 32 32-bit integers.

## Example

```javascript
var interleave = require("bit-interleave")

//Create two integers
var a = 0xffffffff
var b = 0x00000000

var c = interleave(a, b)

//Now:
//  c = 0b0101010101010101
```

## Install

    npm install bit-interleave
    
## API

```javascript
var interleave = require("bit-interleave")
```

### `interleave(x0,x1,...)`
Interleaves the lower order bits of x0 through x1 uniformly. 

* `x0, x1, ...` A list of up to 32 integers

**Returns** A single 32 bit integer representing the interleaved bits of x0...x1

To avoid the dynamic look up, you can directly call any of the following methods if you know the number of arguments you are using beforehand:

* `interleave[0]()`
* `interleave[1](x0)`
* `interleave[2](x0,x1)`
* `interleave[3](x0,x1,x2)`
* ...
* `interleave[32](...)`

## Credits
(c) 2013 Mikola Lysenko. MIT License