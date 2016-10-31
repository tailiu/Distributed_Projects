var kad = require('kad')
var childProcess = require('child-proc')
var fs = require('graceful-fs')
var WebTorrent = require('webtorrent')
var os = require('os')
var lineByLine = require('n-readlines')
var mkdirp = require('mkdirp')

const adminRepo = 'gitolite-admin'
const confDir = '/gitolite-admin/conf/'
const confFile = 'gitolite.conf'
const keyDir = '/gitolite-admin/keydir/'
const knownHostsPath = '/home/' + findCurrentAccount() + '/.ssh/known_hosts'
const SSHPkPath = '/home/'+ findCurrentAccount() + '/.ssh/id_rsa.pub'

exports.createDHTNode = function(nodeAddr, nodePort, db, callback) {
	var DHTNode = new kad.Node({
	transport: kad.transports.UDP(kad.contacts.AddressPortContact({
		address: nodeAddr,
		port: nodePort
	  })),
		storage: kad.storage.FS(db)
	})
	callback(DHTNode)
}

exports.putValueOnDHT = function(DHTNode, DHTSeed, key, value, callback) {
	DHTNode.connect(DHTSeed, function(err) {
		DHTNode.put(key, value, function() {
		  	callback()
		})
	})
}

exports.getValueFromDHT = function(DHTNode, DHTSeed, key, callback) {
	DHTNode.connect(DHTSeed, function(err) {
		DHTNode.get(key, function(err, value) {
		  	callback(value)
		})
	})
}

//find current account on the machine
function findCurrentAccount() {
  var account = childProcess.execSync('whoami')
  account = (account + '').replace(/(\r\n|\n|\r)/gm,"")
  return account
}

function getFilePath(fileDir, fileName) {
  return fileDir + '/' + fileName
}

function getLocalIpAddr() {
	var networkInterfaces = os.networkInterfaces( )
	return networkInterfaces.eth0[0].address
}

exports.syncRepo = function(repoPath, callback) {
	var command = 'cd ' + repoPath + '\ngit pull origin master\n'
	var result = childProcess.execSync(command)

	if (result.toString().indexOf('Already up-to-date') != -1) {
		callback(false)
	} else {
		callback(true)
	}
}

function changeKeyName (adminRepoDir, keyName) {
	var confPath = adminRepoDir + confDir + confFile
	var adminRepoKeyDir = adminRepoDir + keyDir
	var liner = new lineByLine(confPath)
	var line
	var content = ''
	var find = false
	while (line = liner.next()) {
		var str = line.toString('ascii')
		str = str.trim()
		if (find && str.indexOf(keyName) != -1) {
			return
		}
		if (!find) {
	  		content += line.toString('ascii') + '\n'
	  		str = str.replace(/\s\s+/g, ' ')
	  		str = str.split(' ')
	  		if (str[1] == 'gitolite-admin') {
				find = true
	  		}
		} else {
	  		str = str.split('=')
	  		content += str[0].trim() + ' = ' + keyName + '\n'
	  		find = false
		}
  	}
  	fs.writeFileSync(confPath, content)
  	var files = fs.readdirSync(adminRepoKeyDir, 'utf8')
  	var command = 'cd ' + adminRepoKeyDir + '\nmv ' + files[0] + ' ' + keyName + '.pub\n'
				+ 'git add -A :/\n' + 'git commit -m "change changePulicKeyFileName"\n' 
				+ 'git push origin master\n'
  	childProcess.execSync(command)
}

function getFileNameFromFilePath(path) {
	var parts = path.split('/')
	var fileName = parts[parts.length - 1]
	return fileName
}

function getFileDirFromFilePath(path, fileName) {
	return path.replace(fileName, '')
}

function resolveConflictsInOneFile(conflictsInfo, fileDir, fileName, callback) {
	try {

		var command = 'cd ' + fileDir + '\ngit pull origin master\n'
		childProcess.execSync(command)

	} catch(err) {

		var filePath = getFilePath(fileDir, fileName)
		var liner = new lineByLine(filePath)

		var line
		var content = ''
		var find = false

		while (line = liner.next()) {

			var str = line.toString('ascii')
			str = str.trim()

			if (str.indexOf('<<<<<<< HEAD') != -1 ) {
				find = true
				continue
			} else if (str.indexOf('=======') != -1 ) {
				find = false
				continue
			} else if (str.indexOf('>>>>>>>') != -1 ) {
				break 
			}

			if (!find) {
				content += str + '\n'
			}
			
		}

		fs.writeFile(filePath, content, function(err) {
			callback(true)
		})

	}
}

function conflictsResolution(conflictsInfo, fileDir, fileName, type, callback) {
	if (type == 'conflictsInOneFile') {
		resolveConflictsInOneFile(conflictsInfo, fileDir, fileName, callback)
	} 
}

function pushToGitRepo(fileDir, fileName, comment, callback) {
	try {

		var command = 'cd '+ fileDir + '\ngit add ' +  fileName 
				+ '\ngit commit -m "' + comment + '"\ngit push origin master\n'
		childProcess.execSync(command)
		var retry = false
		callback(retry)

	} catch (err) {

		conflictsResolution(err, fileDir, fileName, 'conflictsInOneFile', callback)

	} 
}

exports.getFileFromRepo = function (filePath) {
	var fileName = getFileNameFromFilePath(filePath)
	var fileDir = getFileDirFromFilePath(filePath, fileName)

	var command = 'cd ' + fileDir + '\ngit branch\n'
	var result = childProcess.execSync(command)
	if (result == '') {
		return undefined
	}

	var command1 = 'cd ' + fileDir + '\ngit pull origin master\n'
	childProcess.execSync(command1)

	if (!fs.existsSync(filePath)) {
		return undefined
	}

	return fs.readFileSync(filePath, 'utf8')
}

exports.createOrUpdateFileInRepo = function(filePath, content, option, callback) {
	var fileName = getFileNameFromFilePath(filePath)
	var fileDir = getFileDirFromFilePath(filePath, fileName)
	
	mkdirp.sync(fileDir)

	fs.writeFile(filePath, content, function(err) {
		var comment = option + ' file ' + fileName
		pushToGitRepo(fileDir, fileName, comment, callback)
	})
}

exports.createFileInTorrent = function(filePath, callback) {
	var filemeta = {}
	var torrent = new WebTorrent({ dht: false, tracker: false })

	filemeta.createTs = new Date()
  
	torrent.seed(filePath , function (value) {
		filemeta.seeds = []
		filemeta.seeds[0] = {}
		filemeta.seeds[0].infoHash = value.infoHash
		filemeta.seeds[0].ipAddr = getLocalIpAddr()
		filemeta.seeds[0].torrentPort = torrent.torrentPort

		callback(filemeta)
	})
	
}

exports.getFileFromTorrent = function (torrentSeeds, downloadedFilePath, callback) {
	var fileName = getFileNameFromFilePath(downloadedFilePath)
	var fileDir = getFileDirFromFilePath(downloadedFilePath, fileName)

	mkdirp.sync(fileDir)

	var ws = fs.createWriteStream(downloadedFilePath)
	var torrent = new WebTorrent({ dht: false, tracker: false })
	var tor = torrent.add(torrentSeeds[0].infoHash)
	var rs
	tor.addPeer(torrentSeeds[0].ipAddr + ':' + torrentSeeds[0].torrentPort)
	torrent.on('torrent', function (value) {
		rs = value.files[0].createReadStream()
		rs.pipe(ws)
		tor.on('done', function () {
			rs.on('end', function () {
				callback()
			})
		})
	})
}


function getAdminRepoPath(adminRepoDir) {
	return adminRepoDir + '/' + adminRepo
}

function getConfFilePath(adminRepoDir) {
	return adminRepoDir + confDir + confFile
}

exports.createRepo = function(adminRepoDir, repoName, keyName) {
	var adminRepoPath = getAdminRepoPath(adminRepoDir)
	var confFilePath = getConfFilePath(adminRepoDir)
	var data = 'repo ' + repoName + '\n' + 'RW+ = ' + keyName + '\n'
	var command = 'cd ' + adminRepoPath + '\ngit add -A :/\ngit commit -m "' + 'add repo ' + repoName + '"\n'
				+ 'git push origin master\n'
	fs.appendFileSync(confFilePath, data)
	childProcess.execSync(command)
}

function cloneRepo(remoteRepoLocation, localRepoDir) {
	var command = 'cd ' + localRepoDir + '\ngit clone ' + remoteRepoLocation + '\n'
	mkdirp.sync(localRepoDir)
	childProcess.execSync(command)
}

exports.cloneRepo = function(remoteRepoLocation, localRepoDir) {
	cloneRepo(remoteRepoLocation, localRepoDir)
}

exports.setUpAdminRepoLocally = function(remoteAdminRepoServer, localAdminRepoDir, keyName) {
	var localAdminRepoPath = localAdminRepoDir + '/' + adminRepo
	var remoteAdminRepoPath = remoteAdminRepoServer + ':' + adminRepo
	if (!fs.existsSync(localAdminRepoPath)) {
		cloneRepo(remoteAdminRepoPath, localAdminRepoDir)
		changeKeyName(localAdminRepoDir, keyName)
	}
}

function getServerAddr(serverRepoAddr) {
	return serverRepoAddr.split('@')[1]
}

function addKey(adminRepoDir, key, keyName) {
	var keyFilePath = adminRepoDir + keyDir + keyName + '.pub'

	if (fs.existsSync(keyFilePath)) {
		return
	}

	//This is just a temporary method for the test on the local machine
	//Try to avoid adding ssh public key to gitolite-admin keydir twice on the local machine
	
	var command = 'cat ' + SSHPkPath
	var SSHPublicKey = childProcess.execSync(command)
	if (SSHPublicKey == key) {
		return
	}

	fs.writeFileSync(keyFilePath, key)
}

function updateConfig(adminRepoDir, repoName, keyName) {
	var conFilePath = adminRepoDir + confDir + confFile
	var liner = new lineByLine(conFilePath)
	var find = false
	var content = ''

	while (line = liner.next()) {
		var str = line.toString('ascii')
		str = str.trim()
		if (!find) {
			var parts = str.split(' ')
			if (parts.length < 2) {
				continue
			}
			var repo = str.split(' ')[1]
			if (repo == repoName) {
				find = true
			}
			content += str + '\n'
		} else {
			content += str + ' ' + keyName + '\n'
			find = false
		}
	}
	fs.writeFileSync(conFilePath, content)
	var confDirPath = adminRepoDir + confDir
  	var command = 'cd ' + confDirPath + '\n'
				+ 'git add -A :/\n' + 'git commit -m "update config file"\n' 
				+ 'git push origin master\n'
  	childProcess.execSync(command)
}

exports.addKeyAndUpdateConfigFileInAdminRepo = function(adminRepoDir, SSHPublicKey, keyName, repoName) {
	addKey(adminRepoDir, SSHPublicKey, keyName)
	updateConfig(adminRepoDir, repoName, keyName)
}

exports.getServerAddr = function(repoPath) {
	var command = 'cd ' + repoPath + '\ngit config --get remote.origin.url\n'
	var remoteOriginUrl = childProcess.execSync(command)
	return remoteOriginUrl.toString().split(':')[0]
}

exports.getKnownHostKey = function(serverAddrWithoutUserAccount) {
	var command = 'ssh-keygen -F ' + serverAddrWithoutUserAccount + '\n'
	var value = childProcess.execSync(command)
	var key = value.toString().split('\n')[1]
	return key + '\n'
}

exports.checkAndAddKnownHostKey = function(serverAddrWithoutUserAccount, knownHostsKey) {
	if (fs.existsSync(knownHostsPath)) {
	  	var checkKnownHosts = 'ssh-keygen -F ' + serverAddrWithoutUserAccount
	  	var checkResult = childProcess.execSync(checkKnownHosts)
	  	if (checkResult.toString() == null) {
	    	fs.appendFileSync(knownHostsPath, knownHostsKey)
	  	}
	} else {
	  	childProcess.execSync('touch ' + knownHostsPath)
	  	fs.appendFileSync(knownHostsPath, knownHostsKey)
	}
}
