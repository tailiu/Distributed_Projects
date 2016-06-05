module.exports = loop

function loop(value, divisor) {
  if (value > 0) return value % divisor
  value += (~~(value / divisor) + 1) * divisor
  return value % divisor
}
