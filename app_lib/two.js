var Group = require('./group');
var group = new Group();

group.joinGroup('groupName', '127.0.0.1', 'hehe/db', [
    { address: 'localhost', port: 49151 }
  ]);

