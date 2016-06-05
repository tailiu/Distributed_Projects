var GameLoop = require('gameloop')

module.exports = function (options) {
  options || (options = {})
  var canvas

  if (!options.canvas) {
    canvas = document.createElement('canvas')
    canvas.id = 'game'
    document.body.appendChild(canvas)
  } else if (typeof options.canvas === 'string') {
    canvas = document.getElementById(options.canvas)
  } else if (typeof options.canvas === 'object' && options.canvas.tagName) {
    canvas = options.canvas
  }

  var game = new GameLoop({
    renderer: canvas.getContext('2d')
  })

  game.canvas = canvas
  game.width = canvas.width = options.width || 1024
  game.height = canvas.height = options.height || 480

  return game
}
