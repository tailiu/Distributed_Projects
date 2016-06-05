"use strict"

var bits = require("bit-twiddle")

function generateInterleave(n) {
  var args = new Array(n)
  var code = ["'use strict'"]
  var bits_per_arg = Math.floor(32 / n)|0
  var remainder = (32 - bits_per_arg*n)|0
  var mask = (1<<bits_per_arg)-1
  var hmask = (1<<(bits_per_arg+1))-1

  //Generate masks and shifts
  var shifts = []
  var masks = []
  
  for(var s=bits.nextPow2(bits_per_arg+1)>>1; s>0; s>>=1) {
    var m = (1<<s)-1
    var v = 0
    for(var j=0; j<32; j+=n * s) {
      v |= (m<<j)
    }
    masks.push(v>>>0)
    shifts.push(s*(n-1))
  }
  
  var skip_first = bits.nextPow2(bits_per_arg+1) === bits.nextPow2(bits_per_arg) ? 0 : 1
  
  //Generate code
  for(var i=0; i<n; ++i) {
    args[i] = "x" + i
    if(remainder > 0) {
      code.push(["x", i, "&=", hmask].join(""))
      for(var j=0; j<shifts.length; ++j) {
        code.push(["x", i, "=(x",i, "|(x", i, "<<", shifts[j], "))&", masks[j]].join(""))
      }
      --remainder
    } else {
      code.push(["x", i, "&=", mask].join(""))
      for(var j=skip_first; j<shifts.length; ++j) {
        code.push(["x", i, "=(x",i, "|(x", i, "<<", shifts[j], "))&", masks[j]].join(""))
      }
    }
  }
  
  //Return value
  var ret = [ "x0" ]
  for(var i=1; i<n; ++i) {
    ret.push(["(x", i, "<<", i,")"].join(""))
  }
  code.push("return " + ret.join("+"))
  
  args.push(code.join("\n"))
  return Function.apply(undefined, args)
}

function genModuleExports(table) {
  var args = []
  var nargs = []
  var code = ["'use strict'"]
  var ncode = ["switch(arguments.length){"]
  for(var i=0; i<=32; ++i) {
    args.push("interleave"+i)
    ncode.push(["case ", i, ": return interleave", i, "(", nargs.join(","), ")" ].join(""))
    if(i < 32) {
      nargs.push("x"+i)
    }
  }
  ncode.push("default: return 0 }")
  code.push(["return function interleaven(", nargs.join(","), "){", ncode.join("\n"), "}"].join(""))
  args.push(code.join("\n"))

  var proc = Function.apply(undefined, args)
  return proc.apply(undefined, table)
}

//Fill in table
;(function(){
  var table = new Array(33)
  table[0] = function() {}
  table[1] = function(x) { return x }
  for(var i=2; i<33; ++i) {
    table[i] = generateInterleave(i)
  }
  module.exports = genModuleExports(table)
  for(var i=0; i<=32; ++i) {
    module.exports[i] = table[i]
  }
})();
