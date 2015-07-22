var NodeRSA = require('node-rsa');
var fs = require('fs');
var Util = require('./util');

function identity(){
  this.util = new Util();
}

function identityExists(self, addr, ID){
  if(self.util.getOneFromJSONFile(addr, ';', 'humanReadableID', ID))
    return true;
  else
    return false;
}

identity.prototype.createID = function (addr, ID, description, pw){
  var self = this;
  if(fs.existsSync(addr)){
    if(identityExists(self, addr, ID)){
      console.log('ID already exists');
      return;
    }
  }
  var key = new NodeRSA();
  key.generateKeyPair(512);
  var newUser = {
    humanReadableID: ID,
    description: description,
    password: pw,
    groupsCreated: '',
    groupsJoined: '',
    publicKey: key.exportKey('pkcs8-public'),
    privateKey: key.exportKey('pkcs1-private')
  };
  this.util.addOneToJSONFile(addr, ';', newUser, 'Create Identity successfully');
}

identity.prototype.getID = function (addr, ID){
  return this.util.getOneFromJSONFile(addr, ';', 'humanReadableID', ID);
}

identity.prototype.authenticate = function (addr, ID, password){
  var identity = this.util.getOneFromJSONFile(addr, ';', 'humanReadableID', ID);
  if(identity != null && identity.password == password)
    return true;
  else
    return false;
}

identity.prototype.modify = function (addr, key, originalValue, updatedValue){
  this.util.updateOneFromJSONFile(addr, ';', key, originalValue, updatedValue);
  console.log('Modify successfully');
}

identity.prototype.del = function (addr, key, value){
  this.util.deleteOneFromJSONFile(addr, ';' , key, value);
  console.log('Delete successfully');
}

module.exports = identity;


