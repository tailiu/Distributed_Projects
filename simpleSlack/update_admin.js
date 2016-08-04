var lineByLine = require('n-readlines')
var childProcess = require('child-proc')
var fs = require('graceful-fs')


var command1 = 'cd gitolite-admin/\ngit pull origin master\n'
childProcess.execSync(command1)

var confPath = 'gitolite-admin/conf/gitolite.conf'
var liner = new lineByLine(confPath)
var line
var content = ''
var i = 0
var key
while (line = liner.next()) {
	var str = line.toString('ascii')
	str = str.trim()
	if (i == 1) {
		key = str.split('=')[1].trim()
	}
	if (i < 2) {
		content += line.toString('ascii') + '\n'
		i++
	} else {
		break
	}
}
fs.writeFileSync(confPath, content)
var command = 'cd gitolite-admin/\n'
		+ 'git add -A :/\n' + 'git commit -m "change changePulicKeyFileName"\n' 
		+ 'git push origin master\n'
childProcess.execSync(command)

var dirFiles = fs.readdirSync('./')

for (var i in dirFiles) {
	if (dirFiles[i].length > 50) {
		var command = 'rm -r -f ' + dirFiles[i] + '\n'
		childProcess.execSync(command)
	}
}
