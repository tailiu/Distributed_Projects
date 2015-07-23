var kademlia = require('kad');
var levelup = require('level');
var http = require('http');
var url = require('url');
var querystring = require('querystring');
var childProcess = require('child-proc');
var BuildGitRepo = require('../../../lib/buildGitRepo');
var CreateHttpServer = require('../../../lib/createHttpServer');

var dht = kademlia({
  address: '127.0.0.1',
  port: 65501,
  seeds: [
    { address: 'localhost', port: 65503 },
    { address: 'localhost', port: 65504 }
  ],
  storage: levelup('db')
});

var buildGitRepo = new BuildGitRepo('./instru');
var createHttpServer = new CreateHttpServer();
var data = {gitrepo:"liutai@localhost:/home/liutai/project/test/test_example1/client1/git_repo/"};
var header = {
              'statusCode': 200, 
              'statusMessage': 'Return successfully',
               remainingParts: {
              'Content-Type': 'text/plain',
              }};
               
function handleReq(){
}

function generateRes(){
  return querystring.stringify(data);
}

dht.once('connect', function(){
  dht.put('groupName', 'localhost:6666', function(err){});
});

buildGitRepo.build();
createHttpServer.create(6666, 'POST', handleReq, generateRes, header);



