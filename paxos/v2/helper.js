
var prompt = require('prompt');

var pad = function(number, length) {
    var str = '' + number;
    while (str.length < length) {
        str = '0' + str;
    }
    return str;
}

var getTimestamp = function(){
  return "[$]".replace('$',(new Date()).toISOString());
}

var dispPrompt = function(peers){
  prompt.start();
  prompt.get(['cmd'], function(err, res){
    console.log(getTimestamp() + JSON.stringify(peers));
  });
}

var log = function(fn, file, message, data){
  if(data)
    console.log(getTimestamp() + " | " + PORT + " | " + file + " | " + fn + " | " + message + "  " + JSON.stringify(data));
  else {
    console.log(getTimestamp() + " | " + PORT + " | "+ file + " | " + fn + " | " + message);
  }
}

var greaterThan = function(left, right) {

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

var prepRPCArgs = function(error, message, data){
  return [{error: error, message: message, data: data}];
}

module.exports = {
  "dispPrompt" : dispPrompt,
  "getTimestamp" : getTimestamp,
  "log" : log,
  "randomPort" : Math.floor(1000 + (9999 - 1000) * Math.random()),
  "pad" : pad,
  "greaterThan" : greaterThan,
  "prepRPCArgs" : prepRPCArgs,
}
