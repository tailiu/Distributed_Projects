var request = require('request')
var fs = require('fs')
var readline = require('readline')
var deasync = require('deasync')
var childProcess = require('child-proc')
var os = require('os')

//server address
var addr = 'http://localhost:8000'

var rl = readline.createInterface(process.stdin, process.stdout)
var createdGroupsDir = 'created_groups'
var done = false
var login = false
var register = false
var logging = false
var creatingGroup = false
var registerStep = 0
var username
var usermeta = {}
var groupmeta = {}
var createGroupStep = 0
var currentGroup = null
var currentDir = null

function handleError(error) {
	console.log(error)
	process.exit(0)
}

//check whether user is in a group
function checkInGroup() {
	if (currentGroup == null) {
		console.log('Please switch to one group first')
		return false
	} 
	return true
}

function userRegister(line) {
	switch (registerStep) {
		case 1:
			usermeta.username = line
			rl.setPrompt('>email: ')
			registerStep = 2
			break
		case 2:
			usermeta.email = line
			rl.setPrompt('>password: ')
			registerStep = 3
			break
		case 3:
			usermeta.password = line
			rl.setPrompt('>realName: ')
			registerStep = 4
			break
		case 4:
			usermeta.realName = line
			rl.setPrompt('>login or register: ')
			registerStep = 0
			register = false
			var data = 
			{
				type: 'register',
				usermeta: JSON.stringify(usermeta)
			}
			request.post(addr, {form: data}, function (error, response, body) {
			    if (!error && response.statusCode == 200) {
			    	var res = JSON.parse(body)
			    	console.log(res.content)
			        done = true
			        usermeta = {}
			    } else {
			    	usermeta = {}
			    	handleError(error)
			    }	    
			})
			deasync.loopWhile(function(){return !done})
			done = false
			break
	}
}

function userLogin(line) {
	var data = 
	{
		type: 'login',
		username: line
	}
	request.post(addr, {form: data}, function (error, response, body) {
	    if (!error && response.statusCode == 200) {
	    	var res = JSON.parse(body)
	        if (res.resType != 'User Not Existed') {
	        	username = line
	        	usermeta = res.content
				rl.setPrompt('>')
				login = true
				console.log('Welcome ' + username)
	        } else {
	        	console.log('User Not Existed')
	        }
	        done = true
	    } else {
	    	handleError(error)
	    }	    
	})
	deasync.loopWhile(function(){return !done})
	done = false
}

function createGroup(line) {
	switch(createGroupStep) {
		case 1:
			groupmeta.groupName = line
			createGroupStep = 2
			rl.setPrompt('>description: ')
			break
		case 2:
			groupmeta.description = line
			rl.setPrompt('>')
			createGroupStep = 0
			creatingGroup = false
			var account = childProcess.execSync('whoami')
			account = (account + '').replace(/(\r\n|\n|\r)/gm,"")
			var networkInterfaces = os.networkInterfaces( )
			var location = account + '@' + networkInterfaces.eth0[0].address + ':' 
							+ __dirname + '/' + username +'/'+ createdGroupsDir +'/' + groupmeta.groupName
			groupmeta.location = location
			var data = 
						{ 
						  type: 'create group',
						  username: username,
						  groupmeta: JSON.stringify(groupmeta)
						}
			request.post(addr, {form: data}, function (error, response, body) {
				if (!error && response.statusCode == 200) {
					groupmeta = {}
					var res = JSON.parse(body)
					console.log(res.content)
					done = true
				} else {
					groupmeta = {}
					handleError(error)
				}
			})
			deasync.loopWhile(function(){return !done})
			done = false
			break
	}
}

function myGroups() {
	var data = 
		{
		  type: 'my groups',
		  username: username
		}
	request.post(addr, {form: data}, function (error, response, body) {
		if (!error && response.statusCode == 200) {
			var res = JSON.parse(body)
			if (res.groups == null) {
				console.log('You have not joined any group')
			} else {
				for (var i = 0; i < res.groups.length; i++) {
					console.log(res.groups[i].groupName)
				}
			}
			done = true
		} else {
			handleError(error)
		}
	})
	deasync.loopWhile(function(){return !done})
	done = false
}

function commandNotFound(line) {
	console.log(line + ' command not found');
}

function joinGroup(groupName) {
	var account = childProcess.execSync('whoami')
	account = (account + '').replace(/(\r\n|\n|\r)/gm,"")
	var SSHKeysDir = '/home/'+ account + '/.ssh'
	var pkFile = SSHKeysDir + '/id_rsa.pub'
	if (!fs.existsSync(SSHKeysDir) || !fs.existsSync(pkFile)) {
		console.log('Please use command \'ssh-keygen -t rsa -C "your_email@example.com"\' to generate ssh key firsts')
	}
	var data = 
		{
		  type: 'join group from local client',
		  username: username,
		  groupName: groupName,
		  pk: fs.readFileSync(pkFile),
		}
	request.post(addr, {form: data}, function (error, response, body) {
		if (!error && response.statusCode == 200) {
			var res = JSON.parse(body)
			console.log(res.content)
			done = true
		} else {
			handleError(error)
		}
	})
	deasync.loopWhile(function(){return !done})
	done = false
}

function downloadFileFromGroup(fileName) {
	if(!checkInGroup()) return
	var data = 
		{
		  type: 'download file',
		  username: username,
		  groupName: currentGroup,
		  fileName: fileName,
		  dir: currentDir
		}
	request.post(addr, {form: data}, function (error, response, body) {
		if (!error && response.statusCode == 200) {
			var res = JSON.parse(body)
			console.log(res.content)
			done = true
		} else {
			handleError(error)
		}
	})
	deasync.loopWhile(function(){return !done})
	done = false
}

function getSeedList(fileName) {
	if(!checkInGroup()) return
	var data = 
		{
		  type: 'get seed list',
		  username: username,
		  groupName: currentGroup,
		  fileName: fileName,
		  dir: currentDir
		}
	request.post(addr, {form: data}, function (error, response, body) {
		if (!error && response.statusCode == 200) {
			var res = JSON.parse(body)
			if (res.resType == 'Get Seed List of Dir Successfully') {
				var content = res.content
				for (var i in content) {
					if (content[i].type == 'dir') {
						console.log(JSON.stringify(content[i]))
					} else {
						console.log('{ name: \'' + content[i].name + '\', type: \'' + content[i].type + '\'' + ' seeds:')
						for (var j in content[i].seeds) {
							if (j == (content[i].seeds.length - 1)) {
								console.log(JSON.stringify(content[i].seeds[j]) + '}')
								break
							}
							console.log(JSON.stringify(content[i].seeds[j]))
						}
					}
				}
			} else {
				var content = res.content
				console.log(content)
			}
			done = true
		} else {
			handleError(error)
		}
	})
	deasync.loopWhile(function(){return !done})
	done = false
}

function switchGroup(groupName) {
	var data = 
		{
		  type: 'check whether in group',
		  username: username,
		  groupName: groupName
		}
	request.post(addr, {form: data}, function (error, response, body) {
		if (!error && response.statusCode == 200) {
			var res = JSON.parse(body)
			if (res.resType == 'Found') {
				currentGroup = groupName
				currentDir = 'root'
				console.log('Switch to ' + groupName)
			} else {
				console.log('Fail to switch')
			}
			done = true
		} else {
			handleError(error)
		}
	})
	deasync.loopWhile(function(){return !done})
	done = false
}

function getFilesInDir() {
	var fileList
	var data = 
		{
		  type: 'list',
		  username: username,
		  groupName: currentGroup,
		  dir: currentDir
		}
	request.post(addr, {form: data}, function (error, response, body) {
		if (!error && response.statusCode == 200) {
			var res = JSON.parse(body)
			fileList = res.content
			done = true
		} else {
			handleError(error)
		}
	})
	deasync.loopWhile(function(){return !done})
	done = false
	return fileList
}

function list() {
	if(!checkInGroup()) return
	var fileList = getFilesInDir()
	var n = fileList.length
	for (var i = 0; i < n; i++) {
		console.log(fileList[i].type + ':' + fileList[i].name)
	}
}

function uploadFileToGroup(filePath) {
	if(!checkInGroup()) return
	if (currentGroup == null) {
		console.log('Please switch to one group first')
		return
	}
	if (!fs.existsSync(filePath)){
		console.log('File path does not exist')
		return
	}
	var parts = filePath.split('/')
	var data = 
		{
		  type: 'upload file',
		  username: username,
		  groupName: currentGroup,
		  fileName: parts[parts.length - 1],
		  filePath: filePath,
		  dir: currentDir
		}
	request.post(addr, {form: data}, function (error, response, body) {
		if (!error && response.statusCode == 200) {
			var res = JSON.parse(body)
			console.log(res.content)
			done = true
		} else {
			handleError(error)
		}
	})
	deasync.loopWhile(function(){return !done})
	done = false
}

function createDir(dir) {
	if(!checkInGroup()) return
	if (dir == undefined) {
		console.log('usage: mkdir <dirName>')
		return
	}
	var data = 
		{
		  type: 'make dir',
		  username: username,
		  groupName: currentGroup,
		  dirName: dir,
		  dir: currentDir
		}
	request.post(addr, {form: data}, function (error, response, body) {
		if (!error && response.statusCode == 200) {
			var res = JSON.parse(body)
			console.log(res.content)
			done = true
		} else {
			handleError(error)
		}
	})
	deasync.loopWhile(function(){return !done})
	done = false
}

function getParentDir() {
	var parentDir 
	var data = 
		{
		  type: 'get parent dir',
		  username: username,
		  groupName: currentGroup,
		  dir: currentDir
		}
	request.post(addr, {form: data}, function (error, response, body) {
		if (!error && response.statusCode == 200) {
			var res = JSON.parse(body)
			parentDir = res.content
			done = true
		} else {
			handleError(error)
		}
	})
	deasync.loopWhile(function(){return !done})
	done = false
	return parentDir
}

function changeDir(dir) {
	if (!checkInGroup()) return
	if (dir == '.') {
		console.log('No change')
	} else if (dir == '..') {
		if (currentDir == 'root') {
			console.log('You have already been in the root dir')
			return
		}
		var parentDir = getParentDir()
		currentDir = parentDir
		console.log('Change to ' + parentDir)
	} else {
		var fileList = getFilesInDir()
		var n = fileList.length
		var found = false
		for (var i = 0; i < n; i++) {
			if (fileList[i].name == dir && fileList[i].type == 'dir') {
				currentDir = dir
				console.log('Change to ' + dir)
				return
			}
		}
		console.log('Cannot change to ' + dir)
	}
}

function printWorkingDir() {
	console.log(currentDir)
}

function printWorkingGroup() {
	console.log(currentGroup)
}

function handleCommand(line) {
	if (register) {
		userRegister(line)
		return
	}
	if (!login) {
		if (line == 'login') {
			rl.setPrompt('>username: ')
			logging = true
		} else if (line == 'register') {
			register = true
			rl.setPrompt('>username: ')
			registerStep = 1
		} else if (logging) {
			userLogin(line)
		} else {
			commandNotFound(line)
		}
	} else {	
		if (creatingGroup) {
			createGroup(line)
			return
		}
		parts = line.split(' ')
		if (parts[0] == 'create' && parts[1] == 'group') {
			creatingGroup = true
			rl.setPrompt('>groupName: ')
			createGroupStep = 1
		} else if (parts[0] == 'my' && parts[1] == 'groups') {
			myGroups()
		} else if (parts[0] == 'join' && parts[1] == 'group') {
			joinGroup(parts[2])
		} else if (parts[0] == 'upload' && parts[1] == 'file') {
			uploadFileToGroup(parts[2])
		} else if (parts[0] == 'download' && parts[1] == 'file') {
			downloadFileFromGroup(parts[2])
		} else if (parts[0] == 'get' && parts[1] == 'seeds') {
			getSeedList(parts[2])
		} else if (parts[0] == 'switch' && parts[1] == 'to') {
			switchGroup(parts[2])
		} else if (parts[0] == 'ls') {
			list()
		} else if (parts[0] == 'pwd') {
			printWorkingDir()
		} else if (parts[0] == 'pwg') {
			printWorkingGroup()
		} else if (parts[0] == 'mkdir') {
			createDir(parts[1])
		} else if (parts[0] == 'cd') {
			changeDir(parts[1])
		} else {
			commandNotFound(line)
		}
	}
}

function logout() {
	if (username == undefined) {
		console.log('Good Bye!')
	} else {
		console.log('Good Bye! ' + username)
	}
	process.exit(0)
}

var commandList = 'login\n' +
				  'create group\n' +
				  'register\n' +
				  'my groups\n' +
				  'join group <groupName>\n' +
				  'upload file <fileName>\n' +
				  'download file <fileName>\n' +
				  'get seeds <fileName> or <dirName>\n' +
				  'switch to <groupName>\n' +
				  'ls\n' +
				  'pwd(print working dir)\n' +
				  'cd\n' +
				  'mkdir <dirName>\n' +
				  'pwg(print working group)'

console.log('****************************************')
console.log('Available Commands:')
console.log(commandList)
console.log('****************************************')

rl.setPrompt('>login or register: ')
rl.prompt()

rl.on('line', function (line) {
	handleCommand(line.trim())
	rl.prompt()
}).on('close', function () {
	logout()
});