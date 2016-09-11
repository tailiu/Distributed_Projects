var childProcess = require('child-proc')
var fs = require('graceful-fs')

function removeFiles(dir) {
	var dirFiles = fs.readdirSync(dir)

	for (var i in dirFiles) {
		if (dirFiles[i].length > 30) {
			var command = 'rm -r -f ' + dir + dirFiles[i] + '\n'
			childProcess.execSync(command)
		}
	}
}

removeFiles('./')

removeFiles('/home/tailiu/.ssh/')


