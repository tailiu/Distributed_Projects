var kad = require('kad')
var childProcess = require('child-proc')
var fs = require('graceful-fs')
var crypto = require('crypto')
var deasync = require('deasync')
var WebTorrent = require('webtorrent')
var os = require('os')
var request = require('request')
var lineByLine = require('n-readlines')
var mkdirp = require('mkdirp')

const listeningPort = 3000
const userDHTSeedPort = 8100
const userDHTPort = 7100
const groupDHTSeedPort = 8200
const groupDHTPort = 7200
const fileDHTSeedPort = 8300
const fileDHTPort = 7300

var adminFile = 'gitolite-admin'
var confDir = '/gitolite-admin/conf/'
var confFile = 'gitolite.conf'
var joinGroupReqAddr = '/homepage/group/joinOneGroupRes'
var createdGroupsDir = 'created_groups'
var moderatedGroupsDir = 'moderated_groups'
var joinedGroupsDir = 'joined_groups'
var knownHostsPath = '/home/' + findCurrentAccount() 
			+ '/.ssh/known_hosts'
var authorizedKeysPath = '/home/'+ findCurrentAccount() 
			+ '/.ssh/authorized_keys'
var SSHPkPath = '/home/'+ findCurrentAccount() 
			+ '/.ssh/id_rsa.pub'
var uploadedFilesDir = 'uploaded_files'
var downloadedFilesDir = 'downloaded_files'
var SSHKeysDir = '/home/'+ findCurrentAccount() + '/.ssh'

//public user DHT
var userDHTSeed = {
	address: '127.0.0.1',
	port: userDHTSeedPort
}

//public group DHT
var groupDHTSeed = {
 	address: '127.0.0.1',
	port: groupDHTSeedPort
}

var fileDHTSeed = {
	address: '127.0.0.1',
	port: fileDHTSeedPort
}

//create local user DHT node
var userDHT = new kad.Node({
  transport: kad.transports.UDP(kad.contacts.AddressPortContact({
	address: '127.0.0.1',
	port: userDHTPort
  })),
  storage: kad.storage.FS('db2')
})

//create local group DHT node
var groupDHT = new kad.Node({
  transport: kad.transports.UDP(kad.contacts.AddressPortContact({
	address: '127.0.0.1',
	port: groupDHTPort
  })),
  storage: kad.storage.FS('db4')
})

var fileDHT = new kad.Node({
  transport: kad.transports.UDP(kad.contacts.AddressPortContact({
	address: '127.0.0.1',
	port: fileDHTPort
  })),
  storage: kad.storage.FS('db6')
})

//find current account on the machine
function findCurrentAccount() {
  var account = childProcess.execSync('whoami')
  account = (account + '').replace(/(\r\n|\n|\r)/gm,"")
  return account
}

//Create unique _id
function createRandom() {
  var current_date = (new Date()).valueOf().toString();
  var random = Math.random().toString();
  return crypto.createHash('sha1').update(current_date + random).digest('hex');
}

//remove \n
function removeCR(str) {
  return (str + '').replace(/(\r\n|\n|\r)/gm,"")
}

function createRepo(dir, groupName) {
  var createRepoCommand = 'cd '+ dir + '\n' + 'mkdir ' + groupName + '\n' 
			  + 'cd ' + groupName + '\n' + 'git --bare init'
  childProcess.execSync(createRepoCommand)
}

//get IP address from location 
function getIpAddrFromLocation(location) {
  var parts = location.split('@')
  var parts1 = parts[1].split(':')
  return parts1[0]
} 



//add key to known_hosts file in .ssh dir
function addKeyToKnownHosts(key) {
  fs.appendFileSync(knownHostsPath, key)
}

//add key to authorized_keys file in .ssh dir
function addKeyToAuthorizedFile(pk) {
  if (!fs.existsSync(authorizedKeysPath)) {
	childProcess.execSync('touch ' + authorizedKeysPath)
  }
  var content = fs.readFileSync(authorizedKeysPath, 'utf8')
  if (content.indexOf(pk) < 0) {
	fs.appendFileSync(authorizedKeysPath, pk)
  }
}

//generate key to be put to the known_hosts file in the .ssh dir
function genKnownHostsKey(ipaddr) {
  var knownHostsKey
  var command
  var serverPk = childProcess.execSync('cat /etc/ssh/ssh_host_ecdsa_key.pub')
  var buffer = crypto.randomBytes(20)
  var token = buffer.toString('base64');
  command = 'key=`echo ' + token + ' | base64 -d | xxd -p`\n'
  command += 'echo -n \"' + ipaddr + '\" | openssl sha1 -mac HMAC -macopt hexkey:$key|awk \'{print $2}\' | xxd -r -p|base64\n'
  var hashedVal = childProcess.execSync(command)
  hashedVal = (hashedVal + '').replace(/(\r\n|\n|\r)/gm,"")
  knownHostsKey = '|1|' + token + '|' + hashedVal + ' ' + serverPk
  return knownHostsKey
}

//get SSH public key
function getSSHPk() {
  return fs.readFileSync(SSHPkPath)
}

function getFilemetaDir(username, groupName) {
  return username + '/' + joinedGroupsDir + '/' + groupName
}

function getFilemetaPath(filemetaDir, fileName) {
  return filemetaDir + '/' + fileName
}

function getLocalIpAddr() {
	var networkInterfaces = os.networkInterfaces( )
	return networkInterfaces.eth0[0].address
}

exports.createUser = function (userID, location, publicKey, callback) {
	var usermeta = {}
	usermeta.ts = new Date()
	usermeta.location = location
	usermeta.publicKey = publicKey
	usermeta.groups = [] 
	userDHT.connect(userDHTSeed, function(err) {
		userDHT.put(userID, usermeta, function() {
		  	callback(usermeta)
		})
	})
}

exports.getUserInfo = function (userID, callback) {
	userDHT.connect(userDHTSeed, function(err) {
		userDHT.get(userID, function(err, value){
			callback(value)
		})
	})
}

exports.updateUserInfo = function (userID, usermeta, changedContent, option, callback) {
	if (option == 'add group') {
		usermeta.groups.push(changedContent)
	}
	userDHT.put(userID, usermeta, function() {
		callback()
	})
}

exports.getFilemeta = function (fileName, groupName, userID) {
	var repoName = getRepoNameFromGroupName(groupName)
	var filemetaDir = getFilemetaDir(userID, repoName)
	var command = 'cd ' + filemetaDir + '\ngit branch\n'
	var result = childProcess.execSync(command)
	if (result == '') {
		return undefined
	}
	var command1 = 'cd ' + filemetaDir + '\ngit pull origin master\n'
	childProcess.execSync(command1)
	var filemetaPath = getFilemetaPath(filemetaDir, fileName)
	if (!fs.existsSync(filemetaPath)) {
		return undefined
	}
	return fs.readFileSync(filemetaPath, 'utf8')
}



exports.putOnFileDHT = function(fileID, content, callback) {
	fileDHT.connect(fileDHTSeed, function(err) {
		fileDHT.put(fileID, content, function() {
		  	callback()
		})
	})
}

exports.getFromFileDHT = function(fileID, callback) {
	fileDHT.connect(fileDHTSeed, function(err) {
		fileDHT.get(fileID, function(err, value){
			callback(value)
		})
	})
}

exports.syncFile = function(userID, groupName, callback) {
	try {

		var repoName = getRepoNameFromGroupName(groupName)
		var filemetaDir = getFilemetaDir(userID, repoName)
		var command = 'cd ' + filemetaDir + '\ngit pull origin master\n'
		childProcess.execSync(command)

		callback()

	} catch(err) {

		var errMsg = err.stderr.toString()

		if (errMsg.indexOf("Couldn't find remote ref master") != -1 ) {
			callback()
		} else {
			conflictsResolution(err, filemetaDir, '', 'additionalFilesAddedToRepoOrFallBehind', callback)
		}
		
	} 
	
}

function changePulicKeyFileName(path, name) {
	var confPath = path + confDir + confFile
	var keyDir = path + '/gitolite-admin/keydir/'
	var liner = new lineByLine(confPath)
	var line
	var content = ''
	var find = false
	while (line = liner.next()) {
		var str = line.toString('ascii')
		str = str.trim()
		if (find && str.indexOf(name) != -1) {
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
	  		content += str[0].trim() + ' = ' + name + '\n'
	  		find = false
		}
  	}
  	fs.writeFileSync(confPath, content)
  	var files = fs.readdirSync(keyDir, 'utf8')
  	var command = 'cd ' + keyDir + '\nmv ' + files[0] + ' ' + name + '.pub\n'
				+ 'git add -A :/\n' + 'git commit -m "change changePulicKeyFileName"\n' 
				+ 'git push origin master\n'
  	childProcess.execSync(command)
}

function getFileNameFromFilemetaPath(path) {
	var parts = path.split('/')
	var fileName = parts[parts.length - 1]
	return fileName
}

function getFilemetaDirFromFilemetaPath(path, fileName) {
	return path.replace(fileName, '')
}

function resolveConflictsInOneFile(conflictsInfo, filemetaDir, fileName, callback) {

	try {

		var command = 'cd ' + filemetaDir + '\ngit pull origin master\n'
		childProcess.execSync(command)

	} catch(err) {

		var filePath = getFilemetaPath(filemetaDir, fileName)
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

function conflictsResolution(conflictsInfo, filemetaDir, fileName, type, callback) {
	if (type == 'conflictsInOneFile') {

		resolveConflictsInOneFile(conflictsInfo, filemetaDir, fileName, callback)

	} else if (type == 'additionalFilesAddedToRepoOrFallBehind') {

		var command = 'cd '+ filemetaDir + '\ngit pull origin master\ngit push origin master\n'
		childProcess.execSync(command)

		callback()
	}
}

function pushToGitRepo(filemetaDir, fileName, comment, callback) {
	try {

		var command = 'cd '+ filemetaDir + '\ngit add ' +  fileName 
				+ '\ngit commit -m "' + comment + '"\ngit push origin master\n'
		childProcess.execSync(command)

		var retry = false

		callback(retry)

	} catch (err) {

		conflictsResolution(err, filemetaDir, fileName, 'conflictsInOneFile', callback)

	} 
}

function createTmpFile(userID, content) {
	var file = {}
	var uploadedDir = userID + '/' + uploadedFilesDir
	var fileName = createRandom()
	file.content = content
	if (!fs.existsSync(uploadedDir)) {
		childProcess.execSync('cd ' + userID + '\n'+ 'mkdir ' + uploadedFilesDir + '\n')
	} 
	filePath = uploadedDir + '/' + fileName
	childProcess.execSync('touch ' + filePath)
	fs.writeFileSync(filePath, JSON.stringify(file))
	return filePath
}

exports.createOrUpdateFile = function(userID, relativeFilemetaPath, groupName, content, option, callback) {
	var filemeta = {}
	var filePath
	var torrent = new WebTorrent({ dht: false, tracker: false })

	filemeta.lastUpadateTs = new Date()
	if (option == 'create') {
		filemeta.createTs = filemeta.lastUpadateTs
	}
	filePath = createTmpFile(userID, content)
  
	torrent.seed(filePath , function (value) {
		filemeta.seeds = []
		filemeta.seeds[0] = {}
		filemeta.seeds[0].infoHash = value.infoHash
		filemeta.seeds[0].ipAddr = getLocalIpAddr()
		filemeta.seeds[0].torrentPort = torrent.torrentPort

		var fileName = getFileNameFromFilemetaPath(relativeFilemetaPath)
		var relativeFilemetaDir = getFilemetaDirFromFilemetaPath(relativeFilemetaPath, fileName)
		
		var repoName = getRepoNameFromGroupName(groupName)
		var filemetaDir = getFilemetaDir(userID, repoName + '/' + relativeFilemetaDir)
		var filemetaPath = getFilemetaPath(filemetaDir, fileName)
		
		mkdirp.sync(filemetaDir)
		childProcess.execSync('touch ' + filemetaPath)

		fs.writeFile(filemetaPath, JSON.stringify(filemeta), function(err) {
			var comment = option + ' file ' + fileName
			pushToGitRepo(filemetaDir, fileName, comment, callback)
		})
	})
	
}

exports.getFile = function (relativeFilemetaPath, groupName, userID, callback) {
	var fileName = getFileNameFromFilemetaPath(relativeFilemetaPath)
	var relativeFilemetaDir = getFilemetaDirFromFilemetaPath(relativeFilemetaPath, fileName)

	var repoName = getRepoNameFromGroupName(groupName)
	var filemetaDir = getFilemetaDir(userID, repoName + '/' + relativeFilemetaDir)
	var filemetaPath = getFilemetaPath(filemetaDir, fileName)

	if (!fs.existsSync(filemetaPath)) {
		callback(undefined)
		return
	}

	var downloadedDir = userID + '/' + downloadedFilesDir
	var filemeta = JSON.parse(fs.readFileSync(filemetaPath))
	if (!fs.existsSync(downloadedDir)) {
		childProcess.execSync('cd ' + userID + '\n'+ 'mkdir ' + downloadedFilesDir + '\n')
	}

	var downloadedFileName = createRandom()
	var ws = fs.createWriteStream(downloadedDir + '/' + downloadedFileName)
	var torrent = new WebTorrent({ dht: false, tracker: false })
	var tor = torrent.add(filemeta.seeds[0].infoHash)
	var rs
	tor.addPeer(filemeta.seeds[0].ipAddr + ':' + filemeta.seeds[0].torrentPort)
	torrent.on('torrent', function (value) {
		rs = value.files[0].createReadStream()
		rs.pipe(ws)
		tor.on('done', function () {
			rs.on('end', function () {
				fs.readFile(downloadedDir + '/' + downloadedFileName, 'utf8', function(err, value1) {
					var meta = JSON.parse(value1)
					callback(meta.content)
				})
			})
		})
	})
	
}

function addRepo(name, filePath, userID, dir) {
	var data = 'repo ' + name + '\n' + 'RW+ = ' + userID + '\n'
	var command = 'cd ' + dir + '\ngit add ' + confFile + '\ngit commit -m "' + 'add repo ' + name + '"\n'
				+ 'git push origin master\n'
	fs.appendFileSync(filePath, data)
	childProcess.execSync(command)
}

function cloneRepo(repoLocation, dir) {
	var command = 'cd ' + dir + '\ngit clone ' + repoLocation
	childProcess.execSync(command)
}

function addGroupToUsermeta(usermeta, groupName, status) {
	var n = usermeta.groups.length
	usermeta.groups[n] = {}
	usermeta.groups[n].groupName = groupName
	usermeta.groups[n].status = status
	return usermeta
}

//use the unique label in the group name as the repo name
function getRepoNameFromGroupName(groupName) {
	return groupName.split(':')[2]
}

exports.createGroup = function (meta, callback) {
	var email = meta.email
	var groupName = meta.groupName
	var serverAddr = meta.serverAddr
	var dir = email + '/' + createdGroupsDir + '/' + serverAddr
	var adminLocation = serverAddr + ':' + adminFile
	var adminFilePath = dir + '/' + adminFile

	if (!fs.existsSync(email)) {
		childProcess.execSync('mkdir ' + email)
	}
	if (!fs.existsSync(email + '/' + createdGroupsDir)) {
		childProcess.execSync('cd ' + email + '\nmkdir ' + createdGroupsDir + '\n')
	}
	if (!fs.existsSync(dir)) {
		childProcess.execSync('cd ' + email + '\ncd ' + createdGroupsDir + '\nmkdir ' + serverAddr + '\n')
	}
	if (!fs.existsSync(adminFilePath)) {
		cloneRepo(adminLocation, dir)
	}
	userDHT.connect(userDHTSeed, function(err) {
		userDHT.get(email, function(err, usermeta) {
			usermeta = addGroupToUsermeta(usermeta, groupName, 'in')
			userDHT.put(email, usermeta, function() {
				groupDHT.connect(groupDHTSeed, function(err) {
					var groupMeta = {}
					var repoName = getRepoNameFromGroupName(groupName)
					var dir1 = email + '/' + joinedGroupsDir + '/'
					var repoLocation = serverAddr + ':' + repoName
					groupMeta.groupMems = []
					groupMeta.groupMems[0] = {}
					groupMeta.groupMems[0].username = meta.username
					groupMeta.groupMems[0].email = meta.email
					groupMeta.groupMems[0].role = []
					groupMeta.groupMems[0].role[0] = 'creator'
					groupMeta.description = meta.description
					groupMeta.groupType = meta.groupType
					groupMeta.ts = new Date()
					groupMeta.content = {}
					groupMeta.content.type = meta.type
					groupMeta.content.teamName = meta.teamName
					groupMeta.content.name = meta.name
					if (!fs.existsSync(email + '/' + joinedGroupsDir)) {
						childProcess.execSync('cd ' + email + '\nmkdir ' + joinedGroupsDir + '\n')
					}
					changePulicKeyFileName(dir, email)
					addRepo(repoName, dir + confDir + confFile, email, dir + confDir)
					cloneRepo(repoLocation, dir1)
					groupDHT.put(groupName, groupMeta, function(){
						callback()
					})
				})
			})
		})
	})
}

exports.cloneGroupRepo = function(userID, serverPath, teamName, callback) {
	var joinedGroupDir = userID + '/' + joinedGroupsDir
	var repoName = getRepoNameFromGroupName(teamName)
	var serverRepoPath =  serverPath + ':' + repoName

	if (!fs.existsSync(userID)) {
		childProcess.execSync('mkdir ' + userID)
	}
	if (!fs.existsSync(joinedGroupDir)) {
		childProcess.execSync('cd ' + userID + '\nmkdir ' + joinedGroupsDir + '\n')
	}
	
	var command = 'cd ' + joinedGroupDir + '\ngit clone ' + serverRepoPath + '\n'
	childProcess.execSync(command)
	
	callback()
}

exports.getGroupInfo = function (groupName, callback) {
	groupDHT.connect(groupDHTSeed, function(err) {
		groupDHT.get(groupName, function(err, value){
			callback(value)
		})
	})
}

function addKey(path, key, userID) {
	var keyFilePath = path + '/gitolite-admin/keydir/' + userID + '.pub'
	if (fs.existsSync(keyFilePath)) {
		return
	}
	fs.writeFileSync(keyFilePath, key)
}

function updateConfig(path, repoName, userID) {
	var configFilePath = path + '/gitolite-admin/conf/gitolite.conf'
	var liner = new lineByLine(configFilePath)
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
			content += str + ' ' + userID + '\n'
			find = false
		}
	}

	fs.writeFileSync(configFilePath, content)
	var commitPath = path + '/gitolite-admin/'
  	var command = 'cd ' + commitPath + '\n'
				+ 'git add -A :/\n' + 'git commit -m "update config file"\n' 
				+ 'git push origin master\n'
  	childProcess.execSync(command)
}

function getKnownHostKey(serverAddr) {
	var command = 'ssh-keygen -F ' + serverAddr + '\n'
	var value = childProcess.execSync(command)
	var key = value.toString().split('\n')[1]
	return key + '\n'
}

function getServerRepoAddr(userID, repoName) {
	var joinedGroupPath = userID + '/' + joinedGroupsDir + '/' + repoName
	var command = 'cd ' + joinedGroupPath + '\ngit config --get remote.origin.url\n'
	var remoteOriginUrl = childProcess.execSync(command)
	return remoteOriginUrl.toString().split(':')[0]
}

function getServerAddr(serverRepoAddr) {
	return serverRepoAddr.split('@')[1]
}

function getLocalServerDir(userID, serverRepoAddr) {
	var createdGroupPath = userID + '/' + createdGroupsDir + '/' + serverRepoAddr
	var moderatedGroupPath = userID + '/' + moderatedGroupsDir + '/' + serverRepoAddr
	var path
	if (fs.existsSync(createdGroupPath)) {
		path = createdGroupPath
	}
	if (fs.existsSync(moderatedGroupPath)) {
		path = moderatedGroupPath
	}
	return path
}

exports.updateGroupInfo = function (userID, groupName, changedContent, key, option, callback) {
	if (option == 'add') {
		groupDHT.connect(groupDHTSeed, function(err) {
			groupDHT.get(groupName, function(err, groupmeta){
				groupmeta.groupMems.push(changedContent)
				groupDHT.put(groupName, groupmeta, function() {

					var repoName = getRepoNameFromGroupName(groupName)
					var path = getServerRepoAddr(userID, repoName)
					var localServerDir = getLocalServerDir(userID, path)

					addKey(localServerDir, key, changedContent.email)
					updateConfig(localServerDir, repoName, changedContent.email)

					var serverAddr = getServerAddr(path)
					var knownHostKey = getKnownHostKey(serverAddr)

					callback(path, knownHostKey)

				})
			})
		})
	}
}

exports.leaveGroup = function (username, groupName, callback) {
  var dir = username + '/' + joinedGroupsDir 
  var rmRepoCommand = 'cd '+ dir + '\n'  + 'rm -f -r ' + groupName + '\n'
  childProcess.execSync(rmRepoCommand)
  groupDHT.connect(groupDHTSeed, function(err) {
	groupDHT.get(groupName, function(err, value) {
	  var groupmeta = JSON.parse(value)
	  var groupMems = groupmeta.groupMems
	  for (var i = 0; i < groupMems.length; i++) {
		if (groupMems[i].username == username) {
		  groupMems.splice(i, 1)
		}
	  }
	  groupmeta.groupMems = groupMems
	  groupDHT.put(groupName, JSON.stringify(groupmeta), function() {
		userDHT.connect(userDHTSeed, function(err) {
		  userDHT.get(username, function(err, value1){
			var usermeta = JSON.parse(value1)
			var groups = usermeta.groups
			for (var j = 0; j < groups.length; j++) {
			  if (groups[j].groupName == groupName) {
				groups.splice(j, 1)
			  }
			}
			usermeta.groups = groups
			userDHT.put(username, JSON.stringify(usermeta), function() {
			  callback()
			})
		  })
		})
	  })
	})
  })
}
