module.exports = cells

function cells(hi, lo) {
  if (hi.length !== lo.length) throw new Error(
    'Both arguments must be arrays of equal length'
  )

  var dims = hi.length
  var lod = lo[lo.length - 1]

  return recurse([], [], 0)

  function recurse(array, temp, d) {
    if (d === dims - 1) {
      for (var i = hi[d]; i <= lo[d]; i += 1) {
        if (i === lo[d]) {
          temp.push(i)
          array.push(temp)
        } else {
          array.push(temp.concat(i))
        }
      }
    } else {
      for (var i = hi[d]; i <= lo[d]; i += 1) {
        if (i == lo[d]) {
          temp.push(i)
          recurse(array, temp, d + 1)
        } else {
          recurse(array, temp.concat(i), d + 1)
        }
      }
    }
    return array
  }
}
