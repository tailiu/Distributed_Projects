/*
	A response handler is responsible for reponsing to all kinds of requests 
	and asking the master coordinator to create a sync bot or a moderator bot as necessary.

*/

var express = require('express')
var querystring = require('querystring')
var bodyParser = require('body-parser')
var stencil = require('WebStencil')
var childProcess = require('child-proc')
var os = require('os')
var mkdirp = require('mkdirp')
var crypto = require('crypto')
var http = require('http')
var https = require('https')
var fs = require('graceful-fs')
var _ = require('underscore')
var request = require('request')
var util = require('./util')

const userKeysDir = 'user_keys/'
const userMetaFile = 'user_meta'
const adminReposDir = 'admin_repos'
const classMetaFile = 'class_meta'
const memListFile = 'member_list'
const uploadedFilesDir = 'uploaded_files'
const defaultSSHKeysDir = '/home/'+ findCurrentAccount() + '/.ssh'
const knownHostsPath = '/home/' + findCurrentAccount() + '/.ssh/known_hosts'
const numResponseBots = 1
const largestPortNum = 65536

const localDHTNodeAddr = 'localhost'
const localDHTNodeDBFilePart = 'db-p'
const baseLocalDHTNodePort = 1025
const DHTSeed = {
 	address: '127.0.0.1',
	port: 8200
}

const httpListeningPort = 3000

//stencil public key in pem format
const stencilPublicKey = 
'-----BEGIN PUBLIC KEY-----\n' + 
'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAoczHXSbaxMWFFIfWtdTj\n' + 
'X1o7EgGVJGzQxkuz1QIqYUnfBG/VQLdjS9yeNAtqTWHYi5QihGGvADZYOxhwCtME\n' + 
'msqGRo++WrS4CJR13D+OxsupSed2nt8LvBH1dmiEC3FhrFsGbjIsjhqpzgTfgn11\n' + 
'BCSsvnuca4HIZMeHUeubj/zkl/ki0a6RTMYv41QdGEZY6VaGjaDQdPz8xL57cG+x\n' + 
'RxRag9JVsH0XXE1fi9N4C4+kcR7EQNdUJmIsYS44Bk/lbFGw4FES8sIHBONevANU\n' + 
'9zV4V89OKHjgehrZ0WVDmW6/wF0RTHYTpDGryrVusMC82vnUqWrbwOF6Hnqx1dK+\n' + 
'EQIDAQAB\n' + 
'-----END PUBLIC KEY-----'

const forumPublicKey = 
'-----BEGIN PUBLIC KEY-----\n' + 
'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAxD8g4vKqHB8/lyRXZTeE\n' + 
'Yi2K0n+dLQxUsMabva/LXHBPq2KGY9GdFepq5KQ4vGJ17dk4S7DcoyAWNNLYqa1b\n' + 
'9KV2mOiCiRlg3W+7hu8rCzXKVny5I6dGMqL8++Ut/EK0y24/2eXbpHSjUs3xryPj\n' + 
'arDqswoCFtWTkw6v0nFYVkfmQLMg4VlzRBbVnVywI+4cR5Cw+Hm9l3XFscoYN31t\n' + 
'YYxcyNScNnN/qd89T419jceO2scNHCEZ38fgtFObsmYbzi34A0DFOf6KpQCvwprb\n' + 
'JYo7QB0Qh6cqqKfRpvYM39DJvFfBTOMFGqbIfY2M9tfgw+CZ8atGw+u9nUU09fsc\n' + 
'RQIDAQAB\n' + 
'-----END PUBLIC KEY-----'

var app = express()

app.set('views', './views/jade')
app.set('view engine', 'jade')
app.use(bodyParser.json())       	// to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
	extended: true
}))

var localDHTNode
var downloadedFilesDirLock = util.dirLock
var dataBranch = util.dataBranch
var dataStructureBranch = util.dataStructureBranch

//find current account on the machine
function findCurrentAccount() {
	var account = childProcess.execSync('whoami')
	account = (account + '').replace(/(\r\n|\n|\r)/gm,"")
	return account
}

function filterPosts(posts, tag) {
	var filteredPosts = []
	for (var i = 0; i < posts.length; i++) {
		if (posts[i].tags.constructor === Array) {
			var arr = posts[i].tags
			if (arr.indexOf(tag) != -1) {
				filteredPosts.push(posts[i])
			}
		} else {
			if (posts[i].tags == tag) {
				filteredPosts.push(posts[i])
			}
		}
	}
	return filteredPosts
}


function calculateHash(value) {
	var hash = crypto.createHash('sha256')
	hash.update(value)
	return hash.digest('hex')
}

function getPublicKeyLocally(keyPath) {
	var publicKey
	try {
		publicKey = fs.readFileSync(keyPath + 'public.pem', 'utf8')
	} catch (err) {
		publicKey = undefined
	}
	return publicKey
}

function getPrivateKeyLocally(keyPath) {
	return fs.readFileSync(keyPath + 'private.pem', 'utf8')
}

function createPublicKeyPair(keyPath) {
	var command = 'openssl genrsa -out ' + keyPath + 'private.pem 2048\n'
	command += 'openssl rsa -in ' + keyPath + 'private.pem -pubout > ' + keyPath + 'public.pem\n'

	childProcess.execSync(command)
}

function createCertificate(keyPath) {
	var command = 'openssl req -new -sha256 -key ' + keyPath + 'private.pem -out ' + keyPath + 'csr.pem '
	command += '-subj "/C=US/ST=NY/L=NY/O=NYU/CN=192.168.0.1"\n'
	command += 'openssl x509 -req -in ' + keyPath + 'csr.pem -signkey '  + keyPath + 'private.pem -out ' + keyPath + 'cert.pem\n'

	childProcess.execSync(command)
}

function createSSHKeyPair(keyName) {
	var command = 'ssh-keygen -f ' +  getSSHKeyName(keyName) + ' -t rsa -N \'\'\n'

	childProcess.execSync(command)
}

function createUser(email, username, callback) {
	mkdirp(userKeysDir)

	createPublicKeyPair(userKeysDir)
	createCertificate(userKeysDir)

	var publicKey = getPublicKeyLocally(userKeysDir)
	var hashedPublicKey = calculateHash(publicKey)
	mkdirp.sync(hashedPublicKey)

	createSSHKeyPair(hashedPublicKey)

	var keysDir = getUserKeysDir(hashedPublicKey)
	mkdirp.sync(keysDir)
	
	var command = 'mv -if ' + userKeysDir + '/* ' + keysDir + '/\nrm -r ' + userKeysDir + '\n'
	childProcess.execSync(command)

	var localUserMeta = {}
	localUserMeta.ts = new Date()
	localUserMeta.username = username
	localUserMeta.email = email

	var userMetaFilePath =  getUserMetaFilePath(hashedPublicKey)

	fs.writeFile(userMetaFilePath, JSON.stringify(localUserMeta), function(err) {
		callback(hashedPublicKey)
	})
}

//User logout
app.get('/homepage/logout', function(req, res) {
	var username = req.query.username
	res.end("<html> <header> BYE " + username + "! </header> </html>")
})

function getUserMetaFilePath(userID) {
	return userID + '/' + userMetaFile
}

function getSSHPubKeyFilePath(userID) {
	return defaultSSHKeysDir + '/' + userID + '.pub'
}

function getSSHKeyName(keyName) {
	return defaultSSHKeysDir + '/' + keyName
}

function getUserKeysDir(userID) {
	return userID + '/' + userKeysDir
}

function getLocalIpAddr() {
  var networkInterfaces = os.networkInterfaces( )
  return networkInterfaces.eth0[0].address
}

function getAdminReposDir(userID, serverAddr) {
	return 	userID + '/' + adminReposDir + '/' + serverAddr
}

function getRemoteRepoLocation(remoteRepoName, serverAddr) {
	return serverAddr + ':' + remoteRepoName
}

function getServerAddrWithoutUserAccount(serverAddr) {
	return serverAddr.split('@')[1]
}

function getWorkerLocalDHTNodeDB(pid) {
	return localDHTNodeDBFilePart + pid
}

function getWorkerLocalDHTPort(pid) {
	var portNum = pid % largestPortNum
	if (portNum < baseLocalDHTNodePort) {
		portNum += baseLocalDHTNodePort
	} 
	return portNum
}

function cloneRepo(userID, groupName, serverAddr, branch) {
	var host = util.getHost(userID, groupName)
	var clonedRepoDir = util.getClonedReposDir(userID)
	var remoteRepoLocation = getRemoteRepoLocation(groupName, serverAddr)

	stencil.cloneRepo(remoteRepoLocation, clonedRepoDir, host, userID, branch) 
}

function getSignature(value, privateKey) {
	var sign = crypto.createSign('SHA256')
	sign.update(value)
	sign.end()
	return sign.sign(privateKey, 'hex')
}

function addContentToJSONFileLocally(filePath, addedContent, callback) {
	fs.readFile(filePath, 'utf8', function(err, unprocessedFileContent) {

		var content
		if (unprocessedFileContent == undefined) {
			content = []
			content.push(addedContent)
		} else {
			content = JSON.parse(unprocessedFileContent)
			content.push(addedContent)
		}

		fs.writeFile(filePath, JSON.stringify(content), function(err) {
			callback()
		})
	})
}

//Notice: I have not added verification of data on the DHT!!!!!!!!
function getGroupInfoOnDHT(groupName, callback) {
	stencil.retrieveGroupInfo(localDHTNode, DHTSeed, groupName, function(metaOnDHT) {
		callback(metaOnDHT)
	})
}

function checkGroupExists(groupName, callback) {
	getGroupInfoOnDHT(groupName, function(groupMetaOnDHT){
		if (groupMetaOnDHT == undefined) {
			callback(false)
		} else {
			callback(true)
		}
	})
}

function getAllGroupsUserIn(userID, callback) {
	var reposDir = util.getClonedReposDir(userID)
	fs.readdir(reposDir, function(err, groups){
		callback(groups)
	})
}

function appendToMemList(groupName, userID, newMem, view, callback) {
	var host = util.getHost(userID, groupName)

	var repoPath = util.getClonedRepoPath(groupName, userID)
	var memListPath = util.getFilePathInRepo(repoPath, memListFile)
	var content = stencil.getFileFromRepo(memListPath, host, view)
	
	if (content == undefined) {
		var members = []
		members.push(newMem)
		stencil.writeFileToRepo(memListPath, JSON.stringify(members), 'create', host, masterView, function() {
			callback()
		})
	} else {
		var members = JSON.parse(content)
		members.push(newMem)
		stencil.writeFileToRepo(memListPath, JSON.stringify(members), 'update', host, masterView, function() {
			callback()
		})
	}

}

function addMember(groupName, newMem, SSHPublicKey, newMemHashedPublicKey, moderatorID, callback) {
	appendToMemList(groupName, moderatorID, newMem, masterView, function() {
		var repoPath = util.getClonedRepoPath(groupName, moderatorID)
		var serverAddr = stencil.getServerAddr(repoPath)
		var adminRepoDir = getAdminReposDir(moderatorID, serverAddr)
		var host = util.getHost(moderatorID, groupName)

		stencil.addKeyToRepo(adminRepoDir, SSHPublicKey, newMemHashedPublicKey, groupName, host)

		var serverAddrWithoutUserAccount = getServerAddrWithoutUserAccount(serverAddr)
		var knownHostKey = stencil.getKnownHostKey(serverAddrWithoutUserAccount)

		callback(serverAddr, knownHostKey)
	})
}

function processReq(username, hashedPublicKey, SSHPublicKey, groupName, moderatorID, callback) {
	var newMem = {}
	newMem.username = username
	newMem.hashedPublicKey = hashedPublicKey
	newMem.role = []
	newMem.role.push('normal')

	addMember(groupName, newMem, SSHPublicKey, hashedPublicKey, moderatorID, function(serverAddr, knownHostKey) {
		callback(serverAddr, knownHostKey)
	})
}

function joinGroupReq(data, moderatorAddr, callback) {
	var url = 'http://' + moderatorAddr + ':' + httpListeningPort + '/joinGroupRes'

	request({
    	url: url, 
    	method: 'POST',
    	form: data
	}, function (err, reply, body) {
		if (!err && reply.statusCode == 200) {
			var res = JSON.parse(body)
			if (res.type == 'Accept') {
				callback(false, res.knownHostKey, res.serverAddr)
			}
		} else {
			callback(true)
		}
	})
}

function joinGroup(username, hashedPublicKey, groupName, members, callback) {
	var member = members[0]
	members = _.rest(members)

	var SSHPkFilePath = getSSHPubKeyFilePath(hashedPublicKey)

	var SSHPublicKey = fs.readFileSync(SSHPkFilePath)

	var data = {
		username: username,
		groupName: groupName,
		hashedPublicKey: hashedPublicKey,
		SSHPublicKey: SSHPublicKey,
		moderatorID: member.hashedPublicKey
	}

	//currently, use the serial requests to privileged members
	joinGroupReq(data, member.address, function(retry, knownHostKey, serverAddr) {
		if (retry) {
			if (members.length != 0) {
				joinGroup(username, hashedPublicKey, groupName, members, callback)
			} else {
				callback('Cannot join for now!')
			}
		} else {
			var serverAddrWithoutUserAccount = getServerAddrWithoutUserAccount(serverAddr)
			stencil.checkAndAddKnownHostKey(serverAddrWithoutUserAccount, knownHostKey)

			cloneRepo(hashedPublicKey, groupName, serverAddr, 'all')

			var downloadReqID = util.createRandom()

			var req = {}
			req.type = 'download'
			req.groupName = groupName
			req.userID = hashedPublicKey
			req.view = masterView
			req.id = downloadReqID

			process.send(req)

			process.on('message', function(msg) {
				if (msg.type == 'Download Succeeded' && msg.id == downloadReqID) {
					var branchLockFilePath = util.getBranchLockFilePath(hashedPublicKey, groupName)
					util.createJSONFileLocally(branchLockFilePath, [], function() {

						createBotReq(hashedPublicKey, groupName, masterView, undefined, 'sync', function() {

							callback(null)
						})
					})
				}	
			})
		}
	})
}

//Send a dynamic page back
function sendPages(res, data, type) {
	var homepageGroup = 'homepage/group'
	var homepagePosts = 'homepage/posts'
	var homepageViews = 'homepage/views'

	if (type.indexOf(homepageGroup) != -1) {
		res.render('homepage', {username: JSON.stringify(data.username), posts: JSON.stringify([]),
					hashedPublicKey: JSON.stringify(data.hashedPublicKey), page: JSON.stringify(type),
					groupName: JSON.stringify(data.groupName), view: JSON.stringify(data.view)
		 	 	})
	} else if (type.indexOf(homepagePosts) != -1) {
		res.render('homepage', {username: JSON.stringify(data.username), posts: JSON.stringify(data.posts),
					hashedPublicKey: JSON.stringify(data.hashedPublicKey), page: JSON.stringify(type),
					groupName: JSON.stringify(data.groupName), view: JSON.stringify(data.view)
				})
	} else if (type.indexOf(homepageViews) != -1) {
		res.render('homepage', {username: JSON.stringify(data.username), posts: JSON.stringify([]),
					hashedPublicKey: JSON.stringify(data.hashedPublicKey), page: JSON.stringify(type),
					groupName: JSON.stringify(data.groupName), view: JSON.stringify(data.view)
				})
	}
}

function createGroup(groupName, description, userID, serverAddr, username, callback) {
	var host = util.getHost(userID, groupName)

	var adminRepoDir = getAdminReposDir(userID, serverAddr)
	stencil.createRepo(adminRepoDir, undefined, userID, host, serverAddr)

	stencil.createRepo(adminRepoDir, groupName, userID, host)

	cloneRepo(userID, groupName, serverAddr, 'all')

	var repoPath = util.getClonedRepoPath(groupName, userID)

	var metaPutInRepo = {}
	metaPutInRepo.ts = new Date()
	
	var metaPath = util.getFilePathInRepo(repoPath, groupMetaFile)

	stencil.writeFileToRepo(metaPath, JSON.stringify(metaPutInRepo), 'create', host, masterView, function() {
		var memListInRepo = []
		memListInRepo[0] = {}
		memListInRepo[0].role = []
		memListInRepo[0].role[0] = 'primary owner'
		memListInRepo[0].username = username
		memListInRepo[0].hashedPublicKey = userID
		
		var memListPath = util.getFilePathInRepo(repoPath, memListFile)

		stencil.writeFileToRepo(memListPath, JSON.stringify(memListInRepo), 'create', host, masterView, function() {

			var metaPutOnDHT = {}
			metaPutOnDHT.description = description
			metaPutOnDHT.members = []
			metaPutOnDHT.members[0] = {}
			metaPutOnDHT.members[0].hashedPublicKey = userID
			metaPutOnDHT.members[0].address = getLocalIpAddr()

			var keysDir = getUserKeysDir(userID)
			var privateKey = getPrivateKeyLocally(keysDir)
			metaPutOnDHT.signature = getSignature(JSON.stringify(metaPutOnDHT), privateKey)			

			var uploadReqID = util.createRandom()
			var req = {}
			req.type = 'upload'
			req.groupName = groupName
			req.userID = userID
			req.posts = []
			req.view = masterView
			req.uploadType = 'create'
			req.id = uploadReqID

			process.send(req)

			process.on('message', function(msg) {
				if (msg.type == 'Upload Succeeded' && msg.id == uploadReqID) {
					var postsFileName = util.getDownloadedPostsFileName(groupName, masterView)
					var postsFilePath = util.getDownloadedFilePath(userID, postsFileName)
					util.createJSONFileLocally(postsFilePath, [], function() {

						createBotReq(userID, groupName, masterView, undefined, 'sync', function() {

							var branchLockFilePath = util.getBranchLockFilePath(userID, groupName)
							util.createJSONFileLocally(branchLockFilePath, [], function(){

								stencil.storeGroupInfo(localDHTNode, DHTSeed, groupName, metaPutOnDHT, function() {
									callback()
								})
							})
						})
					})
				} 
			})
		})
	})
}

function getPosts(groupName, userID, view, callback) {
	var postsFileName = util.getDownloadedPostsFileName(groupName, view)
	var postsFilePath = util.getDownloadedFilePath(userID, postsFileName)
	var repoPath = util.getClonedRepoPath(groupName, userID)

	console.log('Get posts, ' + process.pid + ' tries to lock ' + postsFilePath)
	util.lock(postsFilePath, function (release) {
		util.getJSONFileContentLocally(postsFilePath, function(posts) {
			console.log('After getting posts, ' + process.pid + ' unlocks ' + postsFilePath)
			release()
			callback(posts)
		})
	})
}

function createBranchView(userID, groupName, view, filterKeyWords, callback) {
	var viewPostsFileName = util.getDownloadedPostsFileName(groupName, view)
	var viewPostsFilePath = util.getDownloadedFilePath(userID, viewPostsFileName)
	var masterViewPostsFileName = util.getDownloadedPostsFileName(groupName, masterView)
	var masterViewPostsFilePath = util.getDownloadedFilePath(userID, masterViewPostsFileName)
	var repoPath = util.getClonedRepoPath(groupName, userID)
	var branchLockFilePath = util.getBranchLockFilePath(userID, groupName)
	var rulesFilePath = util.getRulesFilePath(userID, groupName)
	var host = util.getHost(userID, groupName)

	console.log('Create Branch view, ' + process.pid + ' response bot tries to lock branch')
	util.lock(branchLockFilePath, function(releaseBranchLock) {

		stencil.createBranch(repoPath, view, function(err){
			if (err != null) {
				releaseBranchLock()
				callback(err)
			} else {
				console.log('Create Branch view, ' + process.pid + ' response bot tries to lock ' + masterViewPostsFilePath)
				util.lock(masterViewPostsFilePath, function(releaseMasterViewPostsLock) {

					util.getJSONFileContentLocally(masterViewPostsFilePath, function(masterViewPosts) {
						console.log('create branch view, first, ' + process.pid + ' unlock ' + masterViewPostsFilePath)
						releaseMasterViewPostsLock()
						var filteredPosts = util.filterPosts(masterViewPosts, filterKeyWords)
					
						stencil.changeBranch(repoPath, view, undefined, function(err) {
							var uploadReqID = util.createRandom()

							var req = {}
							req.type = 'upload'
							req.groupName = groupName
							req.userID = userID
							req.posts = filteredPosts
							req.view = view
							req.uploadType = 'update'
							req.id = uploadReqID

							process.send(req)

							process.on('message', function(msg) {
								if (msg.type == 'Upload Succeeded' && msg.id == uploadReqID) {
									var filter = {}
									filter.filterKeyWords = filterKeyWords

									stencil.writeFileToRepo(rulesFilePath, JSON.stringify(filter), 'create', host, view, function() {
										console.log('create branch view, second, ' + process.pid + ' unlock branch')
										releaseBranchLock()

										util.createJSONFileLocally(viewPostsFilePath, filteredPosts, function(){
											
											createBotReq(userID, groupName, view, filterKeyWords, 'moderator', function(err){
												callback(null)
											})
										})
									})
								}
							})
						})
					})
				})
			}
		})
	})
}

function createBotReq(userID, groupName, view, filterKeyWords, type, callback) {
	if (type == 'sync') {
		var message = {}
		message.type = 'createSyncBot'
		message.userID = userID
		message.groupName = groupName
		message.view = view

		process.send(message)

		callback(null)
	} else if (type == 'moderator') {
		var message = {}
		message.type = 'createModeratorBot'
		message.view = view
		message.userID = userID
		message.groupName = groupName
		message.filterKeyWords = filterKeyWords

		process.send(message)

		callback(null)
	}
}

function getAllViews(groupName, userID) {
	var repoPath = util.getClonedRepoPath(groupName, userID)
	return stencil.getBranchNames(repoPath)
}

function changeCurrentView(userID, groupName, chosenView, callback) {
	var repoPath = util.getClonedRepoPath(groupName, userID)
	var host = util.getHost(userID, groupName)
	var branchLockFilePath = util.getBranchLockFilePath(userID, groupName)

	console.log('change view ' + process.pid + ' response bot locks branch')
	util.lock(branchLockFilePath, function(releaseBranchLock) {
		stencil.changeBranch(repoPath, chosenView, host, function(err) {
			if (err == null) {
				console.log('response bot ' + process.pid + 'not change to branch first time, release branch lock')
				releaseBranchLock()
				callback()
			} else if (err.indexOf('did not match any file(s) known to git') != -1) {
				var downloadReqID = util.createRandom()

				var req = {}
				req.type = 'download'
				req.groupName = groupName
				req.userID = userID
				req.view = chosenView
				req.id = downloadReqID

				process.send(req)

				process.on('message', function(msg) {

					if (msg.type == 'Download Succeeded' && msg.id == downloadReqID) {
						createBotReq(userID, groupName, chosenView, undefined, 'sync', function(err) {
							console.log('response bot ' + process.pid + 'change to branch first time, release branch lock')
							releaseBranchLock()
							callback()
						})
					}
				})

			} else {
				console.log('response bot ' + process.pid + ' not change to branch first time nor change to branch first time, release branch lock')
				releaseBranchLock()
				callback()
			}
		})
	})

}



app.post('/changeCurrentView', function(req, res) {
	var groupName = req.body.groupName
	var hashedPublicKey = req.body.hashedPublicKey
	var username = req.body.username
	var view = req.body.view
	var chosenView = req.body.chosenView

	var data = {}
	data.username = username
	data.groupName = groupName
	data.hashedPublicKey = hashedPublicKey
	data.view = chosenView

	changeCurrentView(hashedPublicKey, groupName, chosenView, function() {
		sendPages(res, data, 'homepage/views/changeView')
	})

})

app.post('/findAllViews', function(req, res) {
	var groupName = req.body.groupName
	var userID = req.body.hashedPublicKey

	var data = {}
	data.views = getAllViews(groupName, userID)

	var result = '<html>' + JSON.stringify(data) + '</html>'
	res.end(result)
})

app.post('/createBranchView', function(req, res) {
	var username = req.body.username
	var groupName = req.body.groupName
	var hashedPublicKey = req.body.hashedPublicKey
	var newView = req.body.newView
	var filterKeyWords = req.body.filterKeyWords
	var currentView = req.body.currentView

	createBranchView(hashedPublicKey, groupName, newView, filterKeyWords, function(err) {
		var data = {}
		data.username = username
		data.groupName = groupName
		data.hashedPublicKey = hashedPublicKey
		data.view = currentView

		if (err != null) {
			sendPages(res, data, 'homepage/views/createBranchView/viewAlreadyExisted')
		} else {
			sendPages(res, data, 'homepage/views/createBranchView/createViewSuccessfully')
		}
	})
})

app.post('/refreshPosts', function(req, res) {
	var hashedPublicKey = req.body.hashedPublicKey
    var groupName = req.body.groupName
    var view = req.body.view

    var repoPath = util.getClonedRepoPath(groupName, hashedPublicKey)

    getPosts(groupName, hashedPublicKey, view, function(posts) {
    	var data = {}
		data.posts = posts

		var result = '<html>' + JSON.stringify(data) + '</html>'
		res.end(result)
    })
})

//Create a group
app.post('/createGroup', function(req, res) {
	var username = req.body.username
	var groupName = req.body.groupName
	var description = req.body.description
	var currentGroupName = req.body.currentGroupName
	var hashedPublicKey = req.body.hashedPublicKey
	var serverAddr = req.body.serverAddr
	var view = req.body.view

	var data = {}
	data.groupName = currentGroupName
	data.username = username
	data.hashedPublicKey = hashedPublicKey
	data.view = view

	checkGroupExists(groupName, function(exist) {
		if (exist) {
			sendPages(res, data, 'homepage/group/createOneGroup/AlreadyExisted')
		} else {
			createGroup(groupName, description, hashedPublicKey, serverAddr, username, function(){
				sendPages(res, data, 'homepage/group/createOneGroup/createGroupSuccessful')
			})
		}
	})
})


//Join a group
app.post('/joinGroup', function(req, res) {
	var username = req.body.username
	var currentGroupName = req.body.currentGroupName
	var joinGroupName = req.body.joinGroupName
	var hashedPublicKey = req.body.hashedPublicKey
	var view = req.body.view

	var data = {}
	data.username = username
	data.groupName = currentGroupName
	data.hashedPublicKey = hashedPublicKey
	data.view = view

	getGroupInfoOnDHT(joinGroupName, function(groupMetaOnDHT) {
		if (groupMetaOnDHT == undefined || groupMetaOnDHT == null) {
			sendPages(res, data, 'homepage/group/joinOneGroup/GroupNotExisted')
		} else {
			var members = groupMetaOnDHT.members
			joinGroup(username, hashedPublicKey, joinGroupName, members, function(err){
				if (err != null) {
					res.end(err)
				} else {
					sendPages(res, data, 'homepage/group/joinOneGroup/joinGroupSuccessfully')
				}
			})
		}
	})
})

app.post('/joinGroupRes', function(req, res) {
	var username = req.body.username
	var hashedPublicKey = req.body.hashedPublicKey
	var groupName = req.body.groupName
	var SSHPublicKey = req.body.SSHPublicKey
	var moderatorID = req.body.moderatorID

	processReq(username, hashedPublicKey, SSHPublicKey, groupName, moderatorID, function(serverAddr, knownHostKey){
		var response = {}
		response.type = 'Accept'
		response.knownHostKey = knownHostKey
		response.serverAddr = serverAddr

		res.write(JSON.stringify(response))
		res.end()
	})
})

app.post('/findAllGroups', function(req, res) {
	var hashedPublicKey = req.body.hashedPublicKey

	getAllGroupsUserIn(hashedPublicKey, function(groups) {
		var data = {}
		data.groups = groups
		var result = '<html>' + JSON.stringify(data) + '</html>'
		res.end(result)
	})
})

//Change current group
app.post('/changeCurrentGroup', function(req, res){
	var currentGroupName = req.body.currentGroupName
	var username = req.body.username
	var chosenGroup = req.body.chosenGroup
	var hashedPublicKey = req.body.hashedPublicKey
	var view = req.body.view

	var data = {}
	data.groupName = chosenGroup
	data.username = username
	data.hashedPublicKey = hashedPublicKey

	if (currentGroupName == chosenGroup) {
		data.view = view
		sendPages(res, data, 'homepage/group/changeCurrentGroup/NoNeedToChange')
	} else {
		data.view = masterView
		sendPages(res, data, 'homepage/group/changeCurrentGroup/ChangeGroupSuccessfully')
	}
})

//Show all the posts
app.get('/renderPostsByTag', function(req, res) {
	var username = req.query.username
	var groupName = req.query.groupName
	var hashedPublicKey = req.query.hashedPublicKey
	var view = req.query.view
	var type = req.query.type

	var data = {}
	data.groupName = groupName
	data.username = username
	data.hashedPublicKey = hashedPublicKey
	data.view = view

	getPosts(groupName, hashedPublicKey, view, function(posts) {
		if (type == 'all') {
			data.posts = posts
		}
		sendPages(res, data, 'homepage/posts')
	})
})





//Initial page
app.post('/initial-page', function(req, res) {
    res.render('addOrSelectSchool')
})

//Search school
app.post('/searchSchool', function(req, res) {
    res.render('selectSchool')
})

//Add school
app.post('/addSchool', function(req, res) {
	res.render('addNewSchool')
})

app.get('/changeSchool', function(req, res) {
	res.render('addOrSelectSchool')
})

function createNewSchool(schoolName, emailDomain, callback) {
	var newSchool = {}
	newSchool.emailDomain = 'ANY'
	newSchool.ts = new Date()

	stencil.storeGroupInfo(localDHTNode, DHTSeed, schoolName, newSchool, function() {
		callback()
	})
}

app.post('/addNewSchool', function(req, res) {
	var schoolName = req.body.schoolName
	var emailDomain = req.body.emailDomain
	var haveEmailDomain = req.body.haveEmailDomain

	var data = {}
	data.schoolName = schoolName

	if (haveEmailDomain == 'f') {
		createNewSchool(schoolName, 'ANY', function(){
			sendPages(res, data, 'loginOrSignUp')
		})
	} else {
		createNewSchool(schoolName, emailDomain, function(){
			sendPages(res, data, 'loginOrSignUp')
		})
	}
})

app.post('/loginOrSignUp', function(req, res) {
	var schoolName = req.body.schoolName
	var login = req.body.login
	var signUp = req.body.signUp
	
	var data = {}
	data.schoolName = schoolName

	if (login == undefined) {
		sendPages(res, data, 'signUp')
	} else {

	}
})

app.post('/signUp', function(req, res) {
	var schoolName = req.body.schoolName
	var emailDomain = req.body.emailDomain
	var email = req.body.email
	var username = req.body.username

	createUser(email, username, function(hashedPublicKey) {
		var data = {}
		data.schoolName = schoolName
		data.username = username
		data.hashedPublicKey = hashedPublicKey

		sendPages(res, data, 'addNewClass')
	})
})

app.post('/addNewClass', function(req, res) {
	var className = req.body.className
	var classNumber = req.body.classNumber
	var term = req.body.term
	var schoolName = req.body.schoolName
	var username = req.body.username
	var hashedPublicKey = req.body.hashedPublicKey
	var role = req.body.role
	var serverAddr = req.body.serverAddr

	var data = {}
	data.username = username
	data.className = className
	data.schoolName = schoolName
	data.classNumber = classNumber
	data.term = term
	data.hashedPublicKey = hashedPublicKey
	data.role = role

	checkClassExists(schoolName, term, classNumber, function(exist){
		if (!exist) {
			addNewClass(schoolName, className, term, classNumber, hashedPublicKey, role, serverAddr, username, function(){
				sendPages(res, data, 'homepage')
			})
		} else {

		}
	})

})

function getClassKey(schoolName, term, classNumber) {
	return schoolName + ':' + term + ':' + classNumber
}

function checkClassExists(schoolName, term, classNumber, callback) {
	var key = getClassKey(schoolName, term, classNumber)

	getGroupInfoOnDHT(key, function(classMeta) {
		if (classMeta == undefined) {
			callback(false)
		} else {
			callback(true)
		}
	})
}

function addNewClassToUserMeta(userID, schoolName, className, classNumber, term, role, callback) {
	var userMetaFilePath = getUserMetaFilePath(userID)

	var newClass = {}
	newClass.schoolName = schoolName
	newClass.className = className
	newClass.classNumber = classNumber
	newClass.term = term
	newClass.role = role

	util.getJSONFileContentLocally(userMetaFilePath, function(userMeta) {
		if (userMeta.classes == undefined) {
			userMeta.classes = []
			userMeta.classes[0] = newClass
		} else {
			userMeta.classes[userMeta.classes.length] = newClass
		}

		fs.writeFile(userMetaFilePath, JSON.stringify(userMeta), function(err) {
			callback()
		})
	})
}

function addNewClass(schoolName, className, term, classNumber, userID, role, serverAddr, username, callback) {
	var classKey = getClassKey(schoolName, term, classNumber)
	var classID = calculateHash(classKey)

	var userDataFileName = util.getUserDataFileName(userID)

	var host = util.getHost(userID, classID)

	var adminRepoDir = getAdminReposDir(userID, serverAddr)
	stencil.createRepo(adminRepoDir, undefined, userID, host, serverAddr)

	stencil.createRepo(adminRepoDir, classID, userID, host)

	cloneRepo(userID, classID, serverAddr, 'all')

	addNewClassToUserMeta(userID, schoolName, className, classNumber, term, role, function() {

		var repoPath = util.getClonedRepoPath(classID, userID)

		var metaPutInRepo = {}
		metaPutInRepo.ts = new Date()
		metaPutInRepo.school = schoolName
		metaPutInRepo.term = term
		metaPutInRepo.classNumber = classNumber
		metaPutInRepo.className = className
		
		var metaPath = util.getFilePathInRepo(repoPath, classMetaFile)

		stencil.writeFileToRepo(metaPath, JSON.stringify(metaPutInRepo), 'create', host, dataBranch, function() {
			var memListInRepo = []
			memListInRepo[0] = {}
			memListInRepo[0].role = role
			memListInRepo[0].username = username
			memListInRepo[0].hashedPublicKey = userID
			
			var memListPath = util.getFilePathInRepo(repoPath, memListFile)

			stencil.writeFileToRepo(memListPath, JSON.stringify(memListInRepo), 'create', host, dataBranch, function() {		

				var newClassObj = {}
				newClassObj[className] = classNumber

				getGroupInfoOnDHT(schoolName, function(schoolMeta){
					
					var classesArr = schoolMeta[term]
					if (classesArr == undefined) {
						classesArr = []
						classesArr[0] = newClassObj
					} else {
						classesArr[classesArr.length] = newClassObj
					}

					schoolMeta[term] = classesArr

					stencil.storeGroupInfo(localDHTNode, DHTSeed, schoolName, schoolMeta, function() {
						var addr = getLocalIpAddr()
						var keysDir = getUserKeysDir(userID)
						var privateKey = getPrivateKeyLocally(keysDir)
						var publickey = getPublicKeyLocally(keysDir)

						var classMeta = {}
						classMeta.ts = new Date()
						classMeta.signerPublicKey = publickey
						classMeta.members = []
						classMeta.members[0] = {}
						classMeta.members[0].addr = addr
						classMeta.members[0].userID = userID
						classMeta.signature = getSignature(JSON.stringify(classMeta), privateKey)

						stencil.storeGroupInfo(localDHTNode, DHTSeed, classKey, classMeta, function() {

							repeatedUpload(userID, classID, [], dataBranch, 'create', userDataFileName, undefined, function() {

								var downloadedUserDataFileName = util.getDownloadedFileName(dataBranch, userDataFileName)
								var downloadedUserDataFilePath = util.getDownloadedFilePath(userID, downloadedUserDataFileName, classID)
								util.createJSONFileLocally(downloadedUserDataFilePath, [], function() {

									var branchLockFilePath = util.getBranchLockFilePath(userID, classID)
									util.createJSONFileLocally(branchLockFilePath, [], function() {
										
										var downloadedFilesDirLockPath = util.getDownloadedFilesDirLockPath(userID, classID)
										util.createJSONFileLocally(downloadedFilesDirLockPath, [], function() {

											stencil.createBranch(repoPath, dataStructureBranch, function() {
												// createBotReq(userID, groupName, masterView, undefined, 'sync', function() {

													callback()
												// })
											})
										})	
									})
								})
							})
						})
					})
				})
			})
		})
	})
}

// function newPost(title, groupName, hashedPublicKey, tag, postContent, view, callback) {
// 	var masterViewPostsFileName = util.getDownloadedPostsFileName(groupName, masterView)
// 	var masterViewPostsFilePath = util.getDownloadedFilePath(hashedPublicKey, masterViewPostsFileName)
// 	var viewPostsFileName = util.getDownloadedPostsFileName(groupName, view)
// 	var viewPostsFilePath = util.getDownloadedFilePath(hashedPublicKey, viewPostsFileName)
// 	var repoPath = util.getClonedRepoPath(groupName, hashedPublicKey)
// 	var branchLockFilePath = util.getBranchLockFilePath(hashedPublicKey, groupName)
// 	var rulesFilePath = util.getRulesFilePath(hashedPublicKey, groupName)

// 	console.log('Post new messages to ' + view + ', ' + process.pid + ' response bot tries to lock ' + branchLockFilePath)
// 	util.lock(branchLockFilePath, function(releaseBranchLock) {
// 		console.log('Post new messages, ' + process.pid + ' response bot tries to lock ' + masterViewPostsFilePath)
// 		util.lock(masterViewPostsFilePath, function(releaseMasterFileLock) {
// 			stencil.changeBranch(repoPath, masterView, undefined, function(err) {
// 				var newOne = {}
// 				newOne.creator = hashedPublicKey
// 				newOne.ts = new Date()
// 				newOne.pContent = postContent
// 				newOne.title = title
// 				newOne.comments = []
// 				newOne.tag = tag

// 		    	addNewPost(newOne, masterViewPostsFilePath, groupName, hashedPublicKey, masterView, function(masterViewPosts){
// 		    		console.log('Post messages, first, ' + process.pid + ' response bot unlocks ' + masterViewPostsFilePath)
// 		    		releaseMasterFileLock()

// 		    		if (view != masterView) {
// 		    			stencil.changeBranch(repoPath, view, undefined, function(err) {
// 		    				if (err != null) {
// 		    					console.log('para:' + repoPath + ":" + view + '.')
// 		    					console.log('change branch err ' + err)
// 		    				}
// 		    				console.log('Current branch ' + stencil.getCurrentBranchName(repoPath))
// 			    			util.getJSONFileContentLocally(rulesFilePath, function(rules) {
// 			    				var filteredPosts = util.filterPosts(masterViewPosts, rules.filterKeyWords)

// 			    				console.log('Post new messages, ' + process.pid + ' response bot tries to lock ' + viewPostsFilePath)
// 			    				util.lock(viewPostsFilePath, function(releaseViewFileLock){	
// 					    			util.createJSONFileLocally(viewPostsFilePath, filteredPosts, function() {
// 					    				console.log('(not master)post new messages, second, ' + process.pid + ' response bot unlocks branch lock and ' + viewPostsFilePath)
// 					    				releaseViewFileLock()
// 					    				releaseBranchLock()
// 					    				callback(filteredPosts)
// 					    			})
// 			    				})
				    			
// 			    			})
			    			
// 			    		})
// 		    		} else {
// 		    			console.log('(master)post messages, second, ' + process.pid + ' response bot unlocks branch lock')
// 		    			releaseBranchLock()
// 		    			callback(masterViewPosts)
// 		    		}
		    		
// 		    	})	
// 			})
// 		})
// 	})
// }

// //New post
// app.post('/newPost', function(req, res) {
// 	var title = req.body.title
// 	var username = req.body.username
// 	var groupName = req.body.groupName
// 	var hashedPublicKey = req.body.hashedPublicKey
// 	var tag = req.body.tag
// 	var postContent = req.body.postContent
// 	var view = req.body.view
	
// 	newPost(title, groupName, hashedPublicKey, tag, postContent, view, function(posts) {
// 		var data = {}
// 		data.groupName = groupName
// 		data.username = username
// 		data.hashedPublicKey = hashedPublicKey
// 		data.posts = posts
// 		data.view = view

// 		sendPages(res, data, 'homepage/posts')
// 	})
// })


//Send a dynamic page back
function sendPages(res, data, type) {
	if (type.indexOf('loginOrSignUp') != -1) {
		res.render('loginOrSignUp', {
			schoolName: JSON.stringify(data.schoolName)
		})
	} else if (type.indexOf('signUp') != -1) {
		res.render('signUp', {
			schoolName: JSON.stringify(data.schoolName)
		})
	} else if (type.indexOf('addNewClass') != -1) {
		res.render('addNewClass', {
			schoolName: JSON.stringify(data.schoolName), username: JSON.stringify(data.username), 
			hashedPublicKey: JSON.stringify(data.hashedPublicKey)
		})
	} else if (type.indexOf('homepage') != -1) {
		if (data.posts == undefined) {
			data.posts = []
		}
		res.render('homepage', {
			schoolName: JSON.stringify(data.schoolName), username: JSON.stringify(data.username), 
			hashedPublicKey: JSON.stringify(data.hashedPublicKey), classNumber: JSON.stringify(data.classNumber),
			className: JSON.stringify(data.className), term: JSON.stringify(data.term),
			role: JSON.stringify(data.role), posts: JSON.stringify(data.posts)
		})
	}
}

app.post('/newPost', function(req, res) {
	var username = req.body.username
	var className = req.body.className
	var schoolName = req.body.schoolName
	var classNumber = req.body.classNumber
	var term = req.body.term
	var hashedPublicKey = req.body.hashedPublicKey
	var postType = req.body.postType
	var postTo = req.body.postTo
	var tags = req.body.tags
	var summary = req.body.summary
	var postContent = req.body.postContent
	var showMyNameAs = req.body.showMyNameAs
	var role = req.body.role

	newPost(hashedPublicKey, schoolName, term, classNumber, postType, tags, summary, postContent, function(newPost){
		var data = {}
		data.username = username
		data.posts = newPost
		data.className = className
		data.schoolName = schoolName
		data.classNumber = classNumber
		data.term = term
		data.hashedPublicKey = hashedPublicKey

		sendPages(res, data, 'homepage')
	})

})

function newPost(userID, schoolName, term, classNumber, postType, tags, summary, postContent, callback) {
	var classKey = getClassKey(schoolName, term, classNumber)
	var classID = calculateHash(classKey)
	var postID = util.createRandom()
	var messageID = util.createRandom()
	var branchLockFilePath = util.getBranchLockFilePath(userID, classID)
	var repoPath = util.getClonedRepoPath(classID, userID)
	var downloadedFilesDirLockPath = util.getDownloadedFilesDirLockPath(userID, classID)
	var userDataFileName = util.getUserDataFileName(userID)
	var userDataFilePath = util.getFilePathInRepo(repoPath, userDataFileName)
	var downloadedUserDataFileName = util.getDownloadedFileName(dataBranch, userDataFileName)
	var downloadedUserDataFilePath = util.getDownloadedFilePath(userID, downloadedUserDataFileName, classID)
	var postStructureFilePath = util.getFilePathInRepo(repoPath, postID)

	var newPost = {}
	newPost.postID = postID
	newPost.messageID = messageID
	newPost.postType = postType
	newPost.tags = tags
	newPost.summary = summary
	newPost.postContent = postContent

	util.lock(branchLockFilePath, function(releaseBranchLock) {
		util.lock(downloadedFilesDirLockPath, function(releaseDownloadedFilesDirLock) {
			
			stencil.changeBranch(repoPath, dataBranch, undefined, function(err) {

				addContentToJSONFileLocally(downloadedUserDataFilePath, newPost, function(userData) {
					
					repeatedUpload(userID, classID, userData, dataBranch, 'update', userDataFileName, userDataFilePath, function() {

						stencil.changeBranch(repoPath, dataStructureBranch, undefined, function(err) {
							var postStructure = []
							postStructure[0] = {}
							postStructure[0].messageID = messageID

							repeatedUpload(userID, classID, postStructure, dataStructureBranch, 'create', postID, postStructureFilePath, function() {
								var post = []
								newPost.date = new Date()
								post[0] = newPost

								var downloadedPostPath = util.getDownloadedFilePath(userID, postID, classID)
								addContentToJSONFileLocally(downloadedPostPath, post, function(err) {
									
									releaseBranchLock()
									releaseDownloadedFilesDirLock()

									callback(newPost)
								})
							})
						})
					})
				})
			})
		})
	})
}

function repeatedUpload(userID, classID, data, branch, uploadType, fileName, filePath, callback) {
	var uploadReqID = util.createRandom()
	var repoPath = util.getClonedRepoPath(classID, userID)
	var host = util.getHost(userID, classID)

	var req = {}
	req.type = 'upload'
	req.classID = classID
	req.userID = userID
	req.data = data
	req.branch = branch
	req.uploadType = uploadType
	req.fileName = fileName
	req.id = uploadReqID

	process.send(req)

	process.on('message', function(msg) {
		if (msg.type == 'upload' && msg.id == uploadReqID) {

			var err = msg.err

			if (!err) {

				callback(null)

			} else {
				stencil.syncBranch(repoPath, host, branch, function(err, result){

					util.keepNewCommitAndRemoveOldOne(filePath, function(){

						repeatedUpload(userID, classID, data, branch, uploadType, fileName, filePath, callback)

					})				
				})
			}
		}
	})
}

function addNewPost(newOne, downloadedFilePath, classID, userID, branch, callback) {
	var host = util.getHost(userID, classID)
	var repoPath = util.getClonedRepoPath(classID, userID)
	var userDataFileName = util.getUserDataFileName(userID)
	var userDataFilePath = util.getFilePathInRepo(repoPath, userDataFileName)
	var posts

	var uploadReqID = util.createRandom()

	var req = {}
	req.type = 'download'
	req.classID = classID
	req.userID = userID
	req.branch = branch
	req.id = downloadReqID

	process.send(req)

	process.on('message', function(msg) {

		if (msg.type == 'Download Succeeded' && msg.id == downloadReqID) {
			posts = msg.posts
			posts.push(newOne)

			var req = {}
			req.type = 'upload'
			req.classID = classID
			req.userID = userID
			req.posts = posts
			req.branch = branch
			req.uploadType = 'update'
			req.id = uploadReqID

			process.send(req)

		} else if (msg.type == 'upload' && msg.id == uploadReqID) {
			var err = msg.err

			if (!err) {
				util.createJSONFileLocally(downloadedFilePath, posts, function(){
					callback(posts)
				})
			} else {
				stencil.syncBranch(repoPath, host, branch, function(err, result){

					util.keepNewCommitAndRemoveOldOne(userDataFilePath, function(){

						addNewPost(newOne, downloadedFilePath, classID, userID, branch, callback)

					})				
				})
			}
		}
	})
}










process.once('SIGINT', function(){
	process.exit(1)
})

process.once('SIGTERM', function(){
	process.exit(1)
})

var httpServer = http.createServer(app)
httpServer.listen(httpListeningPort)
console.log(process.pid + ' is listening at port %d', httpListeningPort)

localDHTNode = stencil.initStencilHandler(localDHTNodeAddr, getWorkerLocalDHTPort(process.pid), getWorkerLocalDHTNodeDB(process.pid))
