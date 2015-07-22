var Identity = require('./identity');
var Util = require('./util');
var Group = require('./group');

var identity = new Identity();
var util = new Util();
var group = new Group();

//console.log(identity.authenticate('../ID_infor/ID1.json', '123456', '123456'));

//identity.getID('../ID_infor/ID1.json', '123').password;

//identity.createID('../ID_infor/ID1.json', '543210', 'It is for play', '123456');

//identity.modify('../ID_infor/ID1.json', 'humanReadableID', 'hehe', 'hehehe');

//identity.del('../ID_infor/ID1.json', 'humanReadableID', 'hehehe');

//util.startNodeInDHT('127.0.0.1', 49151, '../test/public_db/db');

//console.log(util.randomInt(1024, 49142));

group.createGroup('public', '127.0.0.1', 'he/db', [
    { address: '127.0.0.1', port: 49151 }
  ], 'groupName');
