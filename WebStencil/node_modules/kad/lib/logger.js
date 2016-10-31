'use strict';

var colors = require('colors/safe');

/**
* Kad, by default, prints log messages to the console using pretty-printed
* status messages. There are different types of messages indicating the nature
* or severity, `error`, `warn`, `info`, `debug`. You can tell Kad which of these
* messages types you want to see by passing a {@link Logger} with option from
* 0 - 4.
* @constructor
* @param {Number} level - Log verbosity (0-4)
* @param {String} prefix - Optional prefix for log output
*/
function Logger(level, prefix) {
  if (!(this instanceof Logger)) {
    return new Logger(level, prefix);
  }

  this.prefix = colors.bold(' :'  + (prefix || 'kad') + ': ');
  this.level = level || 0;
  this.types = {
    debug: {
      level: 4,
      color: colors.magenta
    },
    info: {
      level: 3,
      color: colors.blue
    },
    warn: {
      level: 2,
      color: colors.yellow
    },
    error: {
      level: 1,
      color: colors.red
    }
  };

  this._bindLogTypes();
}

/**
* Sets up log types as instance methods
* @private
*/
Logger.prototype._bindLogTypes = function() {
  var self = this;

  Object.keys(this.types).forEach(function(type) {
    self[type] = function() {
      if (self.level >= self.types[type].level) {
        var prefix = self.prefix + self.types[type].color('{' + type + '}');
        var args = Array.prototype.slice.call(arguments);

        args[0] = prefix + ' ' + args[0];

        console.log.apply(console, args);
      }
    };
  });
};

module.exports = Logger;
