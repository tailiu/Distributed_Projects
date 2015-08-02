var cp = require('child_process');
var dhtSeed1 = cp.fork('DHT_Seed1/seed1.js');
var dhtSeed2 = cp.fork('DHT_Seed2/seed2.js');
var publishFile = cp.fork('publish/publish.js');
var client1 = cp.fork('client1/client1.js');
var client2 = cp.fork('client2/client2.js');
var prompt = require('prompt');

var options = ['start dht', 'stop dht', 'publish file', 'start client1', 'start client2'];
var helpInfo = 'Distributed Project\n';

process.stdout.write('*****************************\n');
process.stdout.write(helpInfo);
process.stdout.write('*****************************\n\n\n\n');

process.stdin.setEncoding('utf8');
process.stdin.on('readable', function() {
  var chunk = process.stdin.read();  
  if(chunk != null){
    if(chunk == options[0] + '\n'){
      dhtSeed1.on('message', function(m) {
        console.log(m);
      });
      dhtSeed2.on('message', function(m) {
        console.log(m);
      });
      dhtSeed1.send(options[0]);
      dhtSeed2.send(options[0]);
    }
    else if(chunk == options[1] + '\n'){
      dhtSeed1.on('message', function(m) {
        process.kill(m, 'SIGHUP');    
      });       
      dhtSeed2.on('message', function(m) {
        process.kill(m, 'SIGHUP');    
      });       
      dhtSeed1.send(options[1]);
      dhtSeed2.send(options[1]);  
    }
    else if(chunk.slice(0, 12) == options[2]){
      var filePath = chunk.slice(13, -1);
      publishFile.on('message', function(m){
        console.log(m);
      })
      publishFile.send(filePath);
    }
    else if(chunk == options[3] + '\n'){
      client1.send(options[3]);
    }
    else if(chunk == options[4] + '\n'){
      client2.send(options[4]);
    }
    else
      console.log('>Unknown command');
  }
});


