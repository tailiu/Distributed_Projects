var proxy = require('ndarray-proxy')
var mod = require('mod-loop')
var floor = Math.floor

module.exports = group

function group(dims, arrays) {
  var dimCount = dims.length
  var setoffset = []
  var getoffset = []
  var shape = []
  var single = []
  var size = 1
  var offsets = []

  for (var i = 0; i < dimCount; i += 1) {
    single[i] = arrays[0].shape[i]
    shape[i] = single[i] * dims[i]
    offsets[i] = size
    size *= dims[i]
  }

  if (size !== arrays.length) throw new Error(
    'You need to supply a list of ndarrays ' + size + ' elements long'
  )

  var array = proxy(shape, getter, setter)
  array.children = arrays
  return array

  function getter() {
    var idx = 0

    for (var i = 0; i < dimCount; i += 1) {
      getoffset[i] = mod(arguments[i], single[i])
      idx += floor(arguments[i] / single[i]) * offsets[i]
    }

    var array = arrays[idx]

    if (!array) throw new Error(
        'Position '
      + [].slice.call(arguments).join(',')
      + ' (array ' + (idx + 1) + '/' + arrays.length
      + ') is out of bounds'
    )

    return array.get.apply(array, getoffset)
  }

  function setter() {
    var idx = 0

    for (var i = 0; i < dimCount; i += 1) {
      setoffset[i] = mod(arguments[i], single[i])
      idx += floor(arguments[i] / single[i]) * offsets[i]
    }

    var array = arrays[idx]
    setoffset[dimCount] = arguments[dimCount]

    return array.set.apply(array, setoffset)
  }
}
