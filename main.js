var cp = require('child_process');
var dhtBoot = cp.fork('client3/client3.js');
var publishFile = cp.fork('client4/client4.js');

var options = ['start dht', 'stop dht', 'publish file'];
var helpInfo = 'Distributed Project\n';

process.stdout.write('*****************************\n');
process.stdout.write(helpInfo);
process.stdout.write('*****************************\n\n\n\n');

process.stdin.setEncoding('utf8');
process.stdin.on('readable', function() {
  var chunk = process.stdin.read();  
  if(chunk != null){
    if(chunk == options[0] + '\n'){
      dhtBoot.on('message', function(m) {
        console.log(m);
      });
      dhtBoot.send(options[0]);
    }
    else if(chunk == options[1] + '\n'){
      dhtBoot.on('message', function(m) {
        process.kill(m, 'SIGHUP');    
      });       
      dhtBoot.send(options[1]);  
    }
    else if(chunk.slice(0, 12) == options[2]){
      var filePath = chunk.slice(13, -1);
      publishFile.on('message', function(m){
        console.log(m);
      })
      publishFile.send(filePath);
    }
    else
      console.log('>Unknown command');
  }
});


