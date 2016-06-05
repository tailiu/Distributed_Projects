# mod-loop #

JavaScript's modulo operator (`%`) doesn't handle negative numbers nicely -
here's something general to work around the issue.

## Installation ##

``` bash
npm install mod-loop
```

## Usage ##

### `require('mod-loop')(x, y)` ###

Returns `x % y`, for both positive and negative and negative numbers.

``` javascript
var mod = require('mod-loop')

mod(+100, 10) // 0
mod(-100, 10) // 0
mod(-105, 10) // 5
mod(-102, 10) // 8
```
