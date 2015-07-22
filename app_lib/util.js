var fs = require('fs');
var kademlia = require('kad');
var levelup = require('level');

function util(){
}

function cb(err, message){
  if (err) 
    throw err;
  else
    console.log(message); 
}

util.prototype.addOneToJSONFile = function(addr, delimiter, obj, string){
  var options = { flags: 'a' };  
  var readable = fs.createWriteStream(addr, options);
  readable.end(JSON.stringify(obj) + delimiter, cb(null, string));
}

util.prototype.getOneFromJSONFile = function (addr, delimiter, key, value){
  var data = fs.readFileSync(addr, 'utf8');
  var items = data.split(delimiter);   
  for (var i = 0; i < items.length - 1; i++){
    var item = JSON.parse(items[i]);
    if (item[key] == value){
      return item;
    }
  }
}

util.prototype.updateOneFromJSONFile = function (addr, delimiter, key, originalValue, updatedValue){
  var data = fs.readFileSync(addr, 'utf8');
  var items = data.split(delimiter);
  var options = { flag: 'a' };
  fs.unlinkSync(addr);
  for (var i = 0; i < items.length - 1; i++){
    var item = JSON.parse(items[i]);
    if (item[key] == originalValue){
      item[key] = updatedValue;
    }
    fs.writeFileSync(addr, JSON.stringify(item) + ';', options);
  }
}

util.prototype.deleteOneFromJSONFile = function (addr, delimiter, key, value){
  var data = fs.readFileSync(addr, 'utf8');
  var items = data.split(delimiter);
  var options = { flag: 'a' };
  fs.unlinkSync(addr);
  for (var i = 0; i < items.length - 1; i++){
    var item = JSON.parse(items[i]);
    if (item[key] == value){
      continue;
    }
    fs.writeFileSync(addr, JSON.stringify(item) + ';', options);
  }
}

util.prototype.randomInt = function (low, high) {
    return Math.floor(Math.random() * (high - low) + low);
}

util.prototype.createDHTSeed = function (addr, port, db) {
  var dht = kademlia({
    address: addr,
    port: port,
    storage: levelup(db)
  });
}

module.exports = util;



