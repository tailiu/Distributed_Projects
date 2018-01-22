
var prompt = require('prompt');

var getTimestamp = function(){
  return "[$]".replace('$',new Date());
}

var dispPrompt = function(peers){
  prompt.start();
  prompt.get(['cmd'], function(err, res){
    // console.log(getTimestamp() + "$$ CMD: " + res.cmd);
    console.log(getTimestamp() + JSON.stringify(peers));
    // dispPrompt();
  });
}

var log = function(fn, file, message, data){
  if(data)
    console.log(getTimestamp() + " | " + file + " | " + fn + " | " + message + "  " + JSON.stringify(data));
  else {
    console.log(getTimestamp() + " | " + file + " | " + fn + " | " + message);
  }
}

var pad = function(number, length) {
    var str = '' + number;
    while (str.length < length) {
        str = '0' + str;
    }

    return str;
}


var shouldDrop = function() {
  return false;
    var random = Math.random();
    // return DROP_PROBABILITY >= random;
}

// Packet dropping middleware
function dropPacket(req, res, next) {
    if (shouldDrop()) {
        log("Dropping packet on purpose");
        next(DROPPED_ERROR);
    }
    else {
        next();
    }
}

// Figure out if a proposal is greater than another
var greaterThan = function(left, right) {
    // A proposal is greater than or equal to another if:
    // 1. it is the same (both the number and peer index are equal)
    // 2. The number is higher
    // 3. The number is the same but the peer is higher

    // console.log("left:"+left, "right:"+right);
    // console.log("left:"+JSON.stringify(left), "right:"+JSON.stringify(right));

    if (left.number > right.number) {
        return true;
    }
    else if (left.number === right.number && left.peer > right.peer) {
        return true;
    }
    else if (left.number === right.number && left.peer === right.peer) {
        return true;
    }
    else {
        return false;
    }
};

module.exports = {
  "dispPrompt" : dispPrompt,
  "getTimestamp" : getTimestamp,
  "log" : log,
  "randomPort" : Math.floor(1000 + (9999 - 1000) * Math.random()),
  "pad" : pad,
  "shouldDrop" : shouldDrop,
  "dropPacket" : dropPacket,
  "greaterThan" : greaterThan,
}
