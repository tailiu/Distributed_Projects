var kademlia = require('kad');
var levelup = require('level');
var http = require('http');
var url = require('url');
var querystring = require('querystring');
var childProcess = require('child-proc');
var BuildGitRep = require('../lib/buildGitRepo');
var CreateHttpServer = require('../lib/createHttpServer');

var dht = kademlia({
  address: '127.0.0.1',
  port: 65501,
  seeds: [
    { address: 'localhost', port: 65503 }
  ],
  storage: levelup('db')
});

dht.on('connect', function(){
  dht.put('groupName', 'localhost:6666', function(err){});
});

var buildGitRepo = new BuildGitRep('./instru');
var createHttpServer =new CreateHttpServer();
var data = {gitrepo:"liutai@localhost:/home/liutai/project/client1/git_repo/"};

function handleReq(){
}

function generateRes(){
  return querystring.stringify(data);
}

buildGitRepo.build();
createHttpServer.create(6666, 'POST', generateRes, handleReq);


