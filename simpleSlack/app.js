var express = require('express')
var querystring = require('querystring')
var bodyParser = require('body-parser')
var stencil = require('./stencil')
var deasync = require('deasync')
var app = express()
var childProcess = require('child-proc')
var os = require('os')
var NodeRSA = require('node-rsa')
var crypto = require('crypto')
var nodemailer = require('nodemailer')
var _ = require('underscore')
var request = require('request')
var fs = require('graceful-fs')
var http = require('http')
var https = require('https')
var mkdirp = require('mkdirp')

//email address used to send invitation email
const slackEmailDomain = 'stencil.slack@gmail.com'

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

//slack public key in pem format
const slackPublicKey = 
'-----BEGIN PUBLIC KEY-----\n' + 
'MIIBIjANBgkqhkiG9w0BAQEFAAOCAQ8AMIIBCgKCAQEAtAhwPknxlrfvqBkVcudV\n' + 
'oidQqEKo51AZxg1IWUJlBuhfBE9aNJMVz92YLIW8xPY70N9ZhsBAj9mGjdSQPekS\n' + 
'4iVcWd4MJ4K1MKXmDm3fU4kdbBbQAJYC469G8qj6vs9LAlNd9h1n0lXlNhQC/xAW\n' + 
'6GQiQ9DvO2o2Nrf9wlREWbBmAcLhI+O3YkwFw+72d57m2SKCk7t3ISmnccwhcwUa\n' + 
'diPL9EBpwEHkcvYqeOTbc+k8vRbVvuuV831oa2JqqrYUjd1F36eTAfGTloR8113Q\n' + 
'DvWgBpWe7xaIy6ShVHgMYD7mvuvKpUjrsmuwstnLIW3v56RnB5TdI7uJNKWLKFBk\n' + 
'6wIDAQAB\n' + 
'-----END PUBLIC KEY-----'

const hashedStencilPublicKey = calculateHash(stencilPublicKey)
const hashedSlackPublicKey = calculateHash(slackPublicKey)

const localDHTNodeAddr = 'localhost'
const localDHTNodePort = 7200
const localDHTNodeDB = 'db2'

const DHTSeed = {
 	address: '127.0.0.1',
	port: 8200
}

const adminReposDir = 'admin_repos'
const adminFile = 'gitolite-admin'
const clonedReposDir = 'cloned_repos'
const uploadedFilesDir = 'uploaded_files'
const messageLogMeta = 'message_log_meta'
const channelMetaFile = 'channel_meta'
const teamMetaFile = 'team_meta'
const downloadedFilesDir = 'downloaded_files'
const invitationMetaFile = 'invitation_meta'
const publicKeyFile = 'public_key'
const memListFile = 'member_list'
const metaFile = 'meta'
const reposFile = 'repos'
const usermetaFile = 'user_meta'
const publicChannelsFile = 'public_channels'
const SSHKeysDir = '/home/'+ findCurrentAccount() + '/.ssh'
const SSHPkFilePath = SSHKeysDir + '/id_rsa.pub'
const knownHostsPath = '/home/' + findCurrentAccount() + '/.ssh/known_hosts'

// create reusable transporter object using the default SMTP transport
var transporter = nodemailer.createTransport(smtpConfig);
var smtpConfig = {
    host: 'smtp.gmail.com',
    port: 465,
    secure: true, // use SSL
    auth: {
        user: slackEmailDomain
    }
}

var localDHTNode

app.set('views', './views/jade')
app.set('view engine', 'jade')
app.use(bodyParser.json())       	// to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
	extended: true
}))

// send mail with defined transport object
function sendEmail(mailOptions, callback) {
	transporter.sendMail(mailOptions, function(error, info){
		callback()
	})
}

function createRandom() {
  var current_date = (new Date()).valueOf().toString();
  var random = Math.random().toString();
  return crypto.createHash('sha1').update(current_date + random).digest('hex');
}

function getLocalIpAddr() {
  var networkInterfaces = os.networkInterfaces( )
  return networkInterfaces.eth0[0].address
}

//find current account on the machine
function findCurrentAccount() {
  var account = childProcess.execSync('whoami')
  account = (account + '').replace(/(\r\n|\n|\r)/gm,"")
  return account
}

function getJSONFileContentLocally(filePath, callback) {
	if (!fs.existsSync(filePath)) {
		callback(undefined)
	}
	fs.readFile(filePath, 'utf8', function(err, unprocessedFileContent) {
		if (unprocessedFileContent == undefined) {
			callback(undefined)
		} else {
			callback(JSON.parse(unprocessedFileContent))
		}
	})
}

function getMessageLogContent(repoPath, userID, callback) {
	var messageLogMetaPath = getFilePathInRepo(repoPath, messageLogMeta)
	getJSONFileContentLocally(messageLogMetaPath, function(messageLogMetaContent) {
		var messageLogFileName = createRandom()
		var messageLogFilePath = getDownloadedFilesPath(userID, messageLogFileName)
		stencil.getFileFromTorrent(messageLogMetaContent.seeds, messageLogFilePath, function() {
			getJSONFileContentLocally(messageLogFilePath, function(messageLogContent) {
				callback(messageLogContent)
			})
		})
	})
}

function replaceHashedPublicKeyWithUserName(messageLogContent, userID, teamName) {
	var memList = getMemList(userID, teamName)
	
	for (var i in messageLogContent) {
		for (var j in memList) {
			if (messageLogContent[i].creator == memList[j].hashedPublicKey) {
				messageLogContent[i].creator = memList[j].username
				break
			}
		}
	}
	return messageLogContent
}

function createOrUpdateMesageLogContent(userID, content, repoPath, option, callback) {
	var fileDir = getUploadedFilesDir(userID)
	createTmpFile(fileDir, JSON.stringify(content), function(filePath) {
		stencil.createFileInTorrent(filePath, function(filemeta) {
			var messageLogMetaPath = getFilePathInRepo(repoPath, messageLogMeta)
			stencil.createOrUpdateFileInRepo(messageLogMetaPath, JSON.stringify(filemeta), option, function(retry) {
				callback(retry)
			})
		})
	})
}

function updateMsg(userID, flatCName, message, callback) {
	var channelRepoPath = getClonedRepoPath(flatCName, userID)
	getMessageLogContent(channelRepoPath, userID, function(messageLogContent) {

		var newMsg = {}
		newMsg.msg = message
		newMsg.creator = userID
		newMsg.ts = new Date()
		messageLogContent.push(newMsg)

		createOrUpdateMesageLogContent(userID, messageLogContent, channelRepoPath, 'update', function(retry) {
			if (!retry) {
				callback(messageLogContent)
			} else {
				updateMsg(userID, flatCName, message, callback)
			}
		})					
	})
}

//Store the public key to 'email-public.pem' and the private to 'email-private.pem'
//This is just a temporary method, because in the development, I need to test 
//using different users on the same machine(stale, I have improved it in the simple 
//forum)
function createPublicKeyPair(keyPath) {
	var command = 'openssl genrsa -out ' + keyPath + '-private.pem 2048\n'
	command += 'openssl rsa -in ' + keyPath + '-private.pem -pubout > ' + keyPath + '-public.pem\n'

	childProcess.execSync(command)
}

function createCertificate(path) {
	command = 'openssl req -new -sha256 -key ' + path + '-private.pem -out ' + path + '-csr.pem '
	command += '-subj "/C=US/ST=NY/L=NY/O=NYU/CN=192.168.0.1"\n'
	command += 'openssl x509 -req -in ' + path + '-csr.pem -signkey '  + path + '-private.pem -out ' + path + '-cert.pem\n'

	childProcess.execSync(command)
}

function createUser(keyPath, callback) {
	createPublicKeyPair(keyPath)
	createCertificate(keyPath)

	var publicKey = getPublicKeyLocally(keyPath)
	var	privateKey = getPrivateKeyLocally(keyPath)

	var localUserMeta = {}
	localUserMeta.ts = new Date()

	var hashedPublicKey = calculateHash(publicKey)
	mkdirp.sync(hashedPublicKey)

	fs.writeFile(hashedPublicKey + '/' + usermetaFile, JSON.stringify(localUserMeta), function(err) {
		callback(publicKey, privateKey)
	})
}

function calculateHash(value) {
	var hash = crypto.createHash('sha256')
	hash.update(value)
	return hash.digest('hex')
}

function getPrivateKeyLocally(keyPath) {
	return fs.readFileSync(keyPath + '-private.pem', 'utf8')
}

function getPublicKeyLocally(keyPath) {
	var publicKey
	try {
		publicKey = fs.readFileSync(keyPath + '-public.pem', 'utf8')
	} catch (err) {
		publicKey = undefined
	}
	return publicKey
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

function whetherCanCreatePublicChannel(userID, teamName) {
	var memList = getMemList(userID, teamName)
	var memberInfo = findMemberInfoFromMemList(memList, userID)
	var role = memberInfo.role
	if (_.indexOf(role, 'primary owner') != -1) {
		return true
	} 
	return false
}

function createChannelAndAddUser(teamName, creatorID, moderatorID) {
	var label = createRandom()
	var repoName = label

	var repoPath = getClonedRepoPath(teamName, moderatorID)
	var serverAddr = stencil.getServerAddr(repoPath)
	var adminRepoDir = getAdminReposDir(moderatorID, serverAddr)

	stencil.createRepo(adminRepoDir, repoName, creatorID)

	var channelName = hashedStencilPublicKey + ':' + hashedSlackPublicKey + ':' + label
	return channelName
}

app.post('/publicChannelCreation', function(req, res) {
	var creatorID = req.body.creatorID
	var	flatTeamName = req.body.flatTeamName
	var	moderatorID = req.body.moderatorID

	var channelName = createChannelAndAddUser(flatTeamName, creatorID, moderatorID)
	
	var response = {}
	response.type = 'OK'
	response.channelName = channelName
	res.write(JSON.stringify(response))
	res.end()
})

function reqToCreatePublicChannel(moderatorInfo, creatorID, purpose, readableName, flatTeamName, callback) {
	var url = 'http://' + moderatorInfo.address + ':' + httpListeningPort + '/publicChannelCreation'

	var data = {
		creatorID: creatorID,
		flatTeamName: flatTeamName,
		moderatorID: moderatorInfo.hashedPublicKey    //This para is just for testing where mulitple users on the same machine
	}

	request({
    	url: url, 
    	method: 'POST',
    	form: data
	}, function (err, reply, body) {
		if (!err && reply.statusCode == 200) {
			var res = JSON.parse(body)
			if (res.type == 'OK') {
				var channelName = res.channelName
				prepareAndThenCreateChannel(creatorID, purpose, readableName, undefined, flatTeamName, 'public channel', channelName, function(){
					callback()
				})
			}
		}
		//The moderator might not be online
		else if (err != null) {
			callback(err)
		}
	})
}

function prepareAndThenCreateChannel(userID, description, readableName, serverAddr, teamName, channelType, channelName, callback) {
	if (channelType == 'public channel') {
		var repoPath = getClonedRepoPath(teamName, userID)
		serverAddr = stencil.getServerAddr(repoPath)
	}

	createTeamOrChannel(userID, serverAddr, undefined, description, readableName, undefined, teamName, channelType, channelName, function() {
		callback()
	})
}

function createTeamOrChannel(userID, serverAddr, email, description, readableName, username, teamName, option, name, callback) {
	var needToCreateRepo = false

	if (name == undefined) {
		var label = createRandom()
		name = hashedStencilPublicKey + ':' + hashedSlackPublicKey + ':' + label
		var repoName = label

		var adminRepoDir = getAdminReposDir(userID, serverAddr)

		needToCreateRepo = true
	}
	var repoPath = getClonedRepoPath(name, userID)

	var metaPath
	var metaPutInInRepo = {}
	metaPutInInRepo.description = description			
	metaPutInInRepo.ts = new Date()

	if (option == 'team') {
		metaPutInInRepo.name = readableName
		metaPath = getFilePathInRepo(repoPath, teamMetaFile)
		stencil.setUpAdminRepoLocally(serverAddr, adminRepoDir, userID)
	} else if (option == 'private channel') {
		metaPutInInRepo.name = readableName
		metaPutInInRepo.teamName = teamName
		metaPath = getFilePathInRepo(repoPath, channelMetaFile)
		stencil.setUpAdminRepoLocally(serverAddr, adminRepoDir, userID)
	} else {
		metaPath = getFilePathInRepo(repoPath, channelMetaFile)
	}

	if (needToCreateRepo) {
		stencil.createRepo(adminRepoDir, repoName, userID)
	}

	//It will lead to the error that it cannot clone the directory, 
	//when the invited user tries to create a public channel
	//because I am testing on the same machine, different SSH key names with same SSH key value, but
	//there is only one that can work.....
	cloneRepo(userID, name, serverAddr)
	
	stencil.createOrUpdateFileInRepo(metaPath, JSON.stringify(metaPutInInRepo), 'create', function() {

		var memListInRepo = []
		memListInRepo[0] = {}
		if (option == 'team') {
			memListInRepo[0].email = email
			memListInRepo[0].role = []
			memListInRepo[0].role[0] = 'primary owner'
			memListInRepo[0].username = username
		} else if (option == 'private channel') {
			memListInRepo[0].role = []
			memListInRepo[0].role[0] = 'primary owner'
		}
		memListInRepo[0].hashedPublicKey = userID
		
		var memListPath = getFilePathInRepo(repoPath, memListFile)

		stencil.createOrUpdateFileInRepo(memListPath, JSON.stringify(memListInRepo), 'create', function() {

			var reposFilePath = getFilePathInUserIDDir(userID, reposFile)

			addContentToJSONFileLocally(reposFilePath, name, function() {

				if (option == 'public channel') {
					var channelInfo = {}
					channelInfo.readableName = readableName
					channelInfo.flatName = name

					var teamRepoPath = getClonedRepoPath(teamName, userID)
					var publicChannelsFilePath = getFilePathInRepo(teamRepoPath, publicChannelsFile)

					addContentToJSONFileInRepo(publicChannelsFilePath, channelInfo, function() {

						createOrUpdateMesageLogContent(userID, [], repoPath, 'create', function() {
							callback()
						})

					})
				} else {
					createPublicKeyPair(name)
					var publicKey = getPublicKeyLocally(name)
					var privateKey = getPrivateKeyLocally(name)

					var publicKeyPath = getFilePathInRepo(repoPath, publicKeyFile)

					var metaPutOnDHT = {}
					metaPutOnDHT.members = []
					metaPutOnDHT.members[0] = {}
					metaPutOnDHT.members[0].hashedPublicKey = userID
					metaPutOnDHT.members[0].address = getLocalIpAddr()
					metaPutOnDHT.signature = getSignature(JSON.stringify(metaPutOnDHT), privateKey)

					stencil.putValueOnDHT(localDHTNode, DHTSeed, name, metaPutOnDHT, function() {

						stencil.createOrUpdateFileInRepo(publicKeyPath, publicKey, 'create', function() {
							if (option == 'private channel') {
								createOrUpdateMesageLogContent(userID, [], repoPath, 'create', function() {
									callback()
								})
							} else {
								callback(name)
							}
						})
					})
				}
			})
		})
	})
}

function getPublicKeyInRepo(userID, teamName) {
	var repoPath = getClonedRepoPath(teamName, userID)
	var publicKeyFilePath = getFilePathInRepo(repoPath, publicKeyFile)
	return stencil.getFileFromRepo(publicKeyFilePath)
}

app.post('/newChannel', function(req, res) {
    var readableName = req.body.channelName
    var hashedPublicKey = req.body.hashedPublicKey
	var username = req.body.username
	var readableTeamName = req.body.readableTeamName
	var flatTeamName = req.body.flatTeamName
	var channelType = req.body.type
	var serverAddr = req.body.serverAddr
	var purpose = req.body.purpose

	var data = {}
	data.flatTeamName = flatTeamName
	data.readableTeamName = readableTeamName
	data.username = username
	data.hashedPublicKey = hashedPublicKey

	if (channelType == 'public channel') {
		var ableToCreatePublicChannel = whetherCanCreatePublicChannel(hashedPublicKey, flatTeamName)
		if (!ableToCreatePublicChannel) {
			var teamPublicKey = getPublicKeyInRepo(hashedPublicKey, flatTeamName)

			getTeamOrChannelInfoOnDHT(flatTeamName, teamPublicKey, function(err, teamMetaOnDHT) {
				if (err != null) {
					res.end(err)
				} else {
					var moderators = teamMetaOnDHT.members
					reqToCreatePublicChannel(moderators[0], hashedPublicKey, purpose, readableName, flatTeamName, function(){
						sendPages(res, data, '/homepage/channels/getChannels')
					})
				}
			})
		} else {
			prepareAndThenCreateChannel(hashedPublicKey, purpose, readableName, undefined, flatTeamName, channelType, undefined, function(){
				sendPages(res, data, '/homepage/channels/getChannels')
			})
		}
	} else {
		prepareAndThenCreateChannel(hashedPublicKey, purpose, readableName, serverAddr, flatTeamName, channelType, undefined, function(){
			sendPages(res, data, '/homepage/channels/getChannels')
		})
	}

})

function getMemList(userID, teamNameOrChannelName) {
	var repoPath = getClonedRepoPath(teamNameOrChannelName, userID)
	var memListPath = getFilePathInRepo(repoPath, memListFile)
	var memList = JSON.parse(stencil.getFileFromRepo(memListPath))
	return memList
}

function getMemberListDifference(listOne, listTwo) {
	var difference = []
	for (var i = 0; i < listOne.length; i++) {
		var find = false
		for (var j = 0; j < listTwo.length; j++) {
			if (listOne[i].hashedPublicKey == listTwo[j].hashedPublicKey) {
				find = true
				break
			}
		}
		if (!find) {
			difference.push(listOne[i])
		}
	}
	return difference
}

app.post('/getChannelInviteeList', function(req, res) {
	var hashedPublicKey = req.body.hashedPublicKey
    var flatTeamName = req.body.flatTeamName
    var chosenChannel = req.body.chosenChannel  

    var teamMems = getMemList(hashedPublicKey, flatTeamName)	
    var channelMems = getMemList(hashedPublicKey, chosenChannel)
    	
    var data = {}

    var inviteeList = getMemberListDifference(teamMems, channelMems)
	if (inviteeList.length == 0) {
		data.inviteeListEmpty = true
	} else {
		data.inviteeListEmpty = false
	}
	data.inviteeList = inviteeList

	var result = '<html>' + JSON.stringify(data) + '</html>'
	res.end(result)
	 
})

function getSignature(value, privateKey) {
	var sign = crypto.createSign('SHA256')
	sign.update(value)
	sign.end()
	return sign.sign(privateKey, 'hex')
}

function getClonedReposDir(userID) {
	return userID + '/' + clonedReposDir
}

function getFilePathInRepo(repoPath, relativeFilePathInRepo) {
	return repoPath + '/' + relativeFilePathInRepo
}

function getAdminReposDir(userID, serverAddr) {
	return 	userID + '/' + adminReposDir + '/' + serverAddr
}

function getRemoteRepoLocation(remoteRepoName, serverAddr) {
	return serverAddr + ':' + remoteRepoName
}

function getFilePathInUserIDDir(userID, relativeFilePathInUserIDDir) {
	return userID + '/' + relativeFilePathInUserIDDir
}

function getUploadedFilesDir(userID) {
	return userID + '/' + uploadedFilesDir
}

function getDownloadedFilesPath(userID, fileName) {
	return userID + '/' + downloadedFilesDir + '/' + fileName
}

function getRepoNameFromTeamOrChannelName(teamNameOrChannelName) {
	return teamNameOrChannelName.split(':')[2]
}

function getClonedRepoPath(teamOrChannelName, userID) {
	var teamOrChannelRepoName = getRepoNameFromTeamOrChannelName(teamOrChannelName)
	var clonedRepoDir = getClonedReposDir(userID)
	return clonedRepoDir + '/' + teamOrChannelRepoName
}

function addContentToJSONFileInRepo(filePath, addedContent, callback) {
	var unprocessedFileContent = stencil.getFileFromRepo(filePath)
	var option
	var content

	if (unprocessedFileContent == undefined) {
		content = []
		content.push(addedContent)
		option = 'create'
	} else {
		content = JSON.parse(unprocessedFileContent)
		content.push(addedContent)
		option = 'update'
	}

	stencil.createOrUpdateFileInRepo(filePath, JSON.stringify(content), 'create', function() {
		callback()
	})
}

function createTmpFile(fileDir, content, callback) {
	var fileName = createRandom()
	if (!fs.existsSync(fileDir)) {
		mkdirp.sync(fileDir)
	} 
	filePath = fileDir + '/' + fileName
	fs.writeFile(filePath, content, function(err) {
		callback(filePath)
	})
}

function cloneRepo(userID, teamOrChannelName, serverAddr) {
	var clonedRepoDir = getClonedReposDir(userID)
	var repoName = getRepoNameFromTeamOrChannelName(teamOrChannelName)
	var remoteTeamRepoLocation = getRemoteRepoLocation(repoName, serverAddr)
	stencil.cloneRepo(remoteTeamRepoLocation, clonedRepoDir) 
}

function sendInvitationEmail(flatTeamNameOrChannelName, readableTeamOrChannelName, hashedPublicKey, username, inviteeEmails, additionalInfo, callback) {
	var publicKeyRepoPath
	if (additionalInfo.option == 'team' || additionalInfo.option == 'private') {
		publicKeyRepoPath = getClonedRepoPath(flatTeamNameOrChannelName, hashedPublicKey)
	} else {
		publicKeyRepoPath = getClonedRepoPath(additionalInfo.flatTeamName, hashedPublicKey)
	}
	var publicKeyFilePath = getFilePathInRepo(publicKeyRepoPath, publicKeyFile)
	var teamOrPrivateChannelPublicKey = stencil.getFileFromRepo(publicKeyFilePath)
	var encodedPublicKey = encodeURIComponent(teamOrPrivateChannelPublicKey)

	var invitationID = createRandom()

	var inviteeEmail = inviteeEmails[0]
	inviteeEmails = _.rest(inviteeEmails)

	if (additionalInfo.option == 'team') {
		var url = 'http://localhost:' + httpListeningPort + '/acceptInvitationToTeam'
		url += '?team=' + flatTeamNameOrChannelName + '&&invitationID=' +  invitationID
		url += '&&inviteeEmail=' + inviteeEmail + '&&encodedPublicKey=' + encodedPublicKey
		var subject = username + ' invited you to team ' + readableTeamOrChannelName + ' on Stencil Slack'
		var body = '<p>' + username + ' uses Stencil Slack, a P2P messaging app using Stencil Storage API'
		body += ' for teams, and has invited you to join the team ' + readableTeamOrChannelName + '</p><br><br>'
		body += '<a href="'+ url +'"><b><i>Join Team</b></i></a>'
		 
	} else {
		var url = 'http://localhost:' + httpListeningPort + '/acceptInvitationToChannel'
		url += '?channel=' + flatTeamNameOrChannelName + '&&invitationID=' +  invitationID + '&&team=' + additionalInfo.flatTeamName
		url += '&&encodedPublicKey=' + encodedPublicKey
		var subject = username + ' invited you to channel ' + readableTeamOrChannelName + ' of team ' + additionalInfo.readableTeamName + ' on Stencil Slack'
		var body = '<a href="'+ url +'"><b><i>Join Channel</b></i></a>'
	}

	// setup e-mail data with unicode symbols
	var mailOptions = {
	    from: '"Stencil Slack" <stencil.slack@gmail.com>', 	// sender address
	    to: inviteeEmail, 									// list of receivers
	    subject: subject, 									// Subject line
	    html: body 											// html body
	}

	var newInvitation = {}
	newInvitation.hashedInviterPublicKey = hashedPublicKey
	newInvitation.inviteeEmail = inviteeEmail
	newInvitation.inviteTs = new Date()
	newInvitation.status = 'pending'
	newInvitation.invitationID = invitationID

	var invitationMetaFileRepoPath = getClonedRepoPath(flatTeamNameOrChannelName, hashedPublicKey)
	var invitationMetaFilePath = getFilePathInRepo(invitationMetaFileRepoPath, invitationMetaFile)

	addContentToJSONFileInRepo(invitationMetaFilePath, newInvitation, function() {
		sendEmail(mailOptions, function () {
			if (inviteeEmails.length == 0) {
				callback()
			} else {
				sendInvitationEmail(flatTeamNameOrChannelName, readableTeamOrChannelName, hashedPublicKey, username, inviteeEmails, additionalInfo, callback)
			}
		})
	})
}

function checkAlreadyInTeam(email, teamName, userID) {
	var memList = getMemList(userID, teamName)
	for (var i in memList) {
		if(memList[i].email == email) {
			return true
		}
	}
	return false
}

function getUserEamil(teamName, userID) {
	var members = getMemList(userID, teamName)
	for (var i in members) {
		if (members[i].hashedPublicKey == userID) {
			return members[i].email
		}
	}
	return undefined
}

function verifySignature(value, publicKey, signature) {
	var verify = crypto.createVerify('SHA256')
	verify.update(value)
	verify.end()
	return verify.verify(publicKey, signature, 'hex')
}

function verifyValue(publicKey, value) {
	var checkedValue = _.clone(value)
	delete checkedValue['signature']
	var result = verifySignature(JSON.stringify(checkedValue), publicKey, value.signature)
	return result
}

function getTeamOrChannelInfoOnDHT(teamNameOrChannelName, publicKey, callback) {
	stencil.getValueFromDHT(localDHTNode, DHTSeed, teamNameOrChannelName, function(metaOnDHT) {
		var result = verifyValue(publicKey, metaOnDHT)
		if (result) {
			callback(null, metaOnDHT)
		} else {
			var err = 'ERROR: TAMPERED_GROUPMETA'
			callback(err, null)
		}
	})
}

function getTeamOrPrivateChannelInfoOnDHT(teamName, privateChannelName, publicKey, callback) {
	getTeamOrChannelInfoOnDHT(teamName, publicKey, function(err, metaOnDHT) {
		if (err != null) {
			getTeamOrChannelInfoOnDHT(privateChannelName, publicKey, function(err, metaOnDHT) {
				if (err != null) {
					callback(err, null)
				} else {
					callback(null, metaOnDHT)
				}
			})
		} else {
			callback(null, metaOnDHT)
		}
	})
}

function acceptInvitation(hashedInviteePublicKey, encodedPublicKey, username, flatTeamNameOrChannelName, invitationID, flatTeamName, inviteeEmail, callback) {
	var publicKey = decodeURIComponent(encodedPublicKey)
	var data = {}

	getTeamOrPrivateChannelInfoOnDHT(flatTeamName, flatTeamNameOrChannelName, publicKey, function(err, metaOnDHT) {
		if (err != null) {
			res.end(err)
		} else {
			//For now I only find one creator or moderator to allow the new user to join
			//But actually, it should be some or all moderators and creator
			var members = metaOnDHT.members
			var moderatorHashedPublicKey = members[0].hashedPublicKey
			var moderatorAddr = members[0].address

			reqToJoin(username, flatTeamNameOrChannelName, moderatorHashedPublicKey, moderatorAddr, invitationID, hashedInviteePublicKey, flatTeamName, inviteeEmail, function (err) {
				if (err != null) {
					res.end(err)
				} else {
					var teamRepoPath = getClonedRepoPath(flatTeamName, hashedInviteePublicKey)
					var teamMetaFilePath = getFilePathInRepo(teamRepoPath, teamMetaFile)
					var teamMeta = JSON.parse(stencil.getFileFromRepo(teamMetaFilePath))

					callback(teamMeta.name)
				}
			})	
		}
	})
}

function reqToJoin(username, flatName, moderatorHashedPublicKey, moderatorAddr, invitationID, hashedInviteePublicKey, flatTeamName, inviteeEmail, callback) {
	var url = 'http://' + moderatorAddr + ':' + httpListeningPort + '/processAndResToJoinReq'

	if (!fs.existsSync(SSHKeysDir) || !fs.existsSync(SSHPkFilePath)) {
		console.log('Please use command \'ssh-keygen -t rsa -C "your_email@example.com"\' to generate ssh key pairs')
	}

	var SSHPublicKey = fs.readFileSync(SSHPkFilePath)

	var data = {
		username: username,
		SSHPublicKey: SSHPublicKey,
		flatName: flatName,
		invitationID: invitationID,
		moderatorHashedPublicKey: moderatorHashedPublicKey,    //This para is just for testing where mulitple users on the same machine
		hashedInviteePublicKey: hashedInviteePublicKey,
		flatTeamName: flatTeamName, 							//This para is just for joining channel
		inviteeEmail: inviteeEmail  							//This para is just for joining team
	}

	request({
    	url: url, 
    	method: 'POST',
    	form: data
    	//rejectUnauthorized: false,
	    // agentOptions: {
	    // 	cert: fs.readFileSync('client-cert.pem'),
		   //  key: fs.readFileSync('client.pem')
	    // }
	}, function (err, reply, body) {
		if (!err && reply.statusCode == 200) {
			var res = JSON.parse(body)

			//The request might have been processed, so the type might be AlreadyProcessed
			//For now, in order to make it simple, I send request to one creator or one moderator
			//so type can only be 'Accept'
			if (res.type == 'Accept') {

				var knownHostKey = res.knownHostKey
				var serverAddr = res.serverAddr

				var serverAddrWithoutUserAccount = getServerAddrWithoutUserAccount(serverAddr)
				stencil.checkAndAddKnownHostKey(serverAddrWithoutUserAccount, knownHostKey)

				var reposFilePath = getFilePathInUserIDDir(hashedInviteePublicKey, reposFile)
				if (res.generalChannel != undefined) {
					var generalChannel = res.generalChannel
					
					addContentToJSONFileLocally(reposFilePath, flatName, function() {

						addContentToJSONFileLocally(reposFilePath, generalChannel, function() {
							cloneRepo(hashedInviteePublicKey, flatName, serverAddr)
							cloneRepo(hashedInviteePublicKey, generalChannel, serverAddr)

							callback(null)
						})

					})

				} else {
					
					addContentToJSONFileLocally(reposFilePath, flatName, function() {
						cloneRepo(hashedInviteePublicKey, flatName, serverAddr)

						callback(null)
					})
					
				}
			}
			else {
				var errMsg = res.type
				callback(errMsg)
			}
		
		} 

		//The moderator might not be online
		else if (err != null) {
			callback(err)
		}
	})
}

function findMemberInfoFromMemList(memList, hashedInviteePublicKey) {
	var memberInfo = undefined
	for (var i in memList) {
		if (memList[i].hashedPublicKey == hashedInviteePublicKey) {
			memberInfo  = memList[i]
			break
		}
	}
	return memberInfo
}

function processJoinChannelReq(hashedInviteePublicKey, SSHPublicKey, flatChannelName, moderatorHashedPublicKey, flatTeamName, callback) {	
	var memList = getMemList(moderatorHashedPublicKey, flatChannelName)
	var newMem = {}
	newMem.hashedPublicKey = hashedInviteePublicKey
	if (memList[0].role != undefined) {
		newMem.role = []
		newMem.role.push('normal')
	}

	addMember(flatChannelName, moderatorHashedPublicKey, newMem, SSHPublicKey, hashedInviteePublicKey, function(serverAddr, knownHostKey) {
		
		callback(null, serverAddr, knownHostKey)
	})
}

function appendToMemList(teamNameOrChannelName, userID, newMem, callback) {
	var repoPath = getClonedRepoPath(teamNameOrChannelName, userID)
	var memListPath = getFilePathInRepo(repoPath, memListFile)
	var content = stencil.getFileFromRepo(memListPath)

	if (content == undefined) {
		var members = []
		members.push(newMem)
		stencil.createOrUpdateFileInRepo(memListPath, JSON.stringify(members), 'create', function() {
			callback()
		})
	} else {
		var members = JSON.parse(content)
		members.push(newMem)
		stencil.createOrUpdateFileInRepo(memListPath, JSON.stringify(members), 'update', function() {
			callback()
		})
	}

}

function getServerAddrWithoutUserAccount(serverAddr) {
	return serverAddr.split('@')[1]
}

function addMember(name, moderatorHashedPublicKey, newMem, SSHPublicKey, newMemHashedPublicKey, callback) {
	appendToMemList(name, moderatorHashedPublicKey, newMem, function() {
		var repoPath = getClonedRepoPath(name, moderatorHashedPublicKey)
		var serverAddr = stencil.getServerAddr(repoPath)

		var adminRepoDir = getAdminReposDir(moderatorHashedPublicKey, serverAddr)
		var repoName = getRepoNameFromTeamOrChannelName(name)
		stencil.addKeyAndUpdateConfigFileInAdminRepo(adminRepoDir, SSHPublicKey, newMemHashedPublicKey, repoName)
		
		var serverAddrWithoutUserAccount = getServerAddrWithoutUserAccount(serverAddr)
		var knownHostKey = stencil.getKnownHostKey(serverAddrWithoutUserAccount)

		callback(serverAddr, knownHostKey)
	})
}

function processJoinTeamReq(username, hashedInviteePublicKey, SSHPublicKey, flatTeamName, moderatorHashedPublicKey, inviteeEmail, callback) {
	var newMemAddedToTeamRepo = {}
	newMemAddedToTeamRepo.username = username
	newMemAddedToTeamRepo.hashedPublicKey = hashedInviteePublicKey
	newMemAddedToTeamRepo.email = inviteeEmail
	newMemAddedToTeamRepo.role = []
	newMemAddedToTeamRepo.role.push('normal')

	addMember(flatTeamName, moderatorHashedPublicKey, newMemAddedToTeamRepo, SSHPublicKey, hashedInviteePublicKey, function() {
		var generalChannelFlatName		
		findChannelsUserIn(moderatorHashedPublicKey, flatTeamName, function(channelsUserIn) {

			for (var i in channelsUserIn) {
				if (channelsUserIn[i].readableName == 'general') {
					generalChannelFlatName = channelsUserIn[i].flatName
					break
				}
			}
			var newMemAddedToGeneralRepo = {}
			newMemAddedToGeneralRepo.hashedPublicKey = hashedInviteePublicKey

			addMember(generalChannelFlatName, moderatorHashedPublicKey, newMemAddedToGeneralRepo, SSHPublicKey, hashedInviteePublicKey, function(serverAddr, knownHostKey) {

				callback(null, serverAddr, knownHostKey, generalChannelFlatName)

			})
		})
	})
}

function difference(allTeamPublicChannels, allChannelsAndTeams) {
	var publicChannelsUserNotIn = []
	for (var i in allTeamPublicChannels) {
		var find = false
		for (var j in allChannelsAndTeams) {
			if (allTeamPublicChannels[i].flatName == allChannelsAndTeams[j]) {
				find = true
			}
		}
		if (!find) {
			publicChannelsUserNotIn.push(allTeamPublicChannels[i])
		} 
	}
	return publicChannelsUserNotIn
} 

function findPublicChannelsUserNotIn(userID, flatTeamName, callback) {
	var resultChannels = []

	var reposFilePath = getFilePathInUserIDDir(userID, reposFile)
	getJSONFileContentLocally(reposFilePath, function(allChannelsAndTeams) {
		var teamRepoPath = getClonedRepoPath(flatTeamName, userID)
		var publicChannelsFilePath = getFilePathInRepo(teamRepoPath, publicChannelsFile)

		var allTeamPublicChannels = JSON.parse(stencil.getFileFromRepo(publicChannelsFilePath))
		var publicChannelsUserNotIn = difference(allTeamPublicChannels, allChannelsAndTeams)

		for (var i in publicChannelsUserNotIn) {
			var channelMeta = {}
			channelMeta.flatName = publicChannelsUserNotIn[i].flatName
			channelMeta.readableName = publicChannelsUserNotIn[i].readableName
			channelMeta.status = 'out'
			channelMeta.type = 'public'
			resultChannels.push(channelMeta)

		}
		callback(resultChannels)

	})

}

function findAllChannels(userID, flatTeamName, callback) {
	findChannelsUserIn(userID, flatTeamName, function(channelsUserIn) {		
		findPublicChannelsUserNotIn(userID, flatTeamName, function(publicChannelsUserNotIn) {
			callback(_.union(channelsUserIn, publicChannelsUserNotIn))
		})
	})
}

function intersection(allGroupsUserIn, allTeamPublicChannels) {
	var publicChannelsUserIn = []
	for (var i in allTeamPublicChannels) {
		for (var j in allGroupsUserIn) {
			if (allTeamPublicChannels[i].flatName == allGroupsUserIn[j]) {
				var channel = {}
				channel.readableName = allTeamPublicChannels[i].readableName
				channel.flatName = allTeamPublicChannels[i].flatName
				publicChannelsUserIn.push(channel)
				break
			}
		}
	}
	return publicChannelsUserIn
}

//find all the channels user is in
function findChannelsUserIn(userID, flatTeamName, callback) {
	var channelsUserIn = []

	var reposFilePath = getFilePathInUserIDDir(userID, reposFile)

	getJSONFileContentLocally(reposFilePath, function(allChannelsAndTeams) {
		var teamRepoPath = getClonedRepoPath(flatTeamName, userID)
		var publicChannelsFilePath = getFilePathInRepo(teamRepoPath, publicChannelsFile)

		var allTeamPublicChannels = JSON.parse(stencil.getFileFromRepo(publicChannelsFilePath))
		var publicChannelsUserIn = intersection(allChannelsAndTeams, allTeamPublicChannels)

		for (var i in publicChannelsUserIn) {
			var channelMeta = {}
			channelMeta.flatName = publicChannelsUserIn[i].flatName
			channelMeta.readableName = publicChannelsUserIn[i].readableName
			channelMeta.status = 'in'
			channelMeta.type = 'public'
			channelsUserIn.push(channelMeta)
		}

		for (var i in allChannelsAndTeams) {
			var repoPath = getClonedRepoPath(allChannelsAndTeams[i], userID)
			var channelMetaFilePath = getFilePathInRepo(repoPath, channelMetaFile)
			var unprocessedFileContent = stencil.getFileFromRepo(channelMetaFilePath)
			if (unprocessedFileContent == undefined) {
				continue
			}

			var channelMeta = JSON.parse(unprocessedFileContent)
			var privateChannelMeta = {}

			if (channelMeta.teamName == flatTeamName) {
				privateChannelMeta.flatName = allChannelsAndTeams[i]
				privateChannelMeta.readableName = channelMeta.name
				privateChannelMeta.status = 'in'
				privateChannelMeta.type = 'private'
				channelsUserIn.push(privateChannelMeta)
			}
		}

		callback(channelsUserIn)
	})
			
}

//Send a dynamic page back
function sendPages(res, data, type) {
	var homepageTeam = '/homepage/team/'
	var homepageChannels = '/homepage/channels/'

	var hashedPublicKey

	if (data.publicKey != undefined) {
		hashedPublicKey = calculateHash(data.publicKey)
	} else {
		hashedPublicKey = data.hashedPublicKey
	}
	
	if (type.indexOf(homepageChannels) != -1 ) {
		if (type.indexOf('renderChannel') == -1) {
			data.msgs = []
			data.flatCName = 'null'
		}
		if (type.indexOf('browseAllChannels') != -1) {
			res.render('homepage', { username: JSON.stringify(data.username), hashedPublicKey: JSON.stringify(hashedPublicKey), 
									readableTeamName: JSON.stringify(data.readableTeamName), flatTeamName: JSON.stringify(data.flatTeamName),
									channels: JSON.stringify(data.allChannels), page: JSON.stringify(type),
									msgs: JSON.stringify(data.msgs), chosenChannel: JSON.stringify(data.flatCName)
			})
		} else {
			findChannelsUserIn(hashedPublicKey, data.flatTeamName, function(channelsUserIn) {				
				res.render('homepage', { username: JSON.stringify(data.username), hashedPublicKey: JSON.stringify(hashedPublicKey), 
								readableTeamName: JSON.stringify(data.readableTeamName), flatTeamName: JSON.stringify(data.flatTeamName),
								channels: JSON.stringify(channelsUserIn), page: JSON.stringify(type),
								msgs: JSON.stringify(data.msgs), chosenChannel: JSON.stringify(data.flatCName)
				})
			})
		}
	} else if (type.indexOf(homepageTeam) != -1) {
		res.render('homepage', { username: JSON.stringify(data.username), hashedPublicKey: JSON.stringify(hashedPublicKey), 
							readableTeamName: JSON.stringify(data.readableTeamName), flatTeamName: JSON.stringify(data.flatTeamName),
							channels: JSON.stringify([]), page: JSON.stringify(type), msgs: JSON.stringify([]),
							chosenChannel: JSON.stringify('null')
		})
	} else if (type == 'joinTeam') {
		res.render('joinTeam', { flatTeamName: JSON.stringify(data.flatTeamName), invitationID: JSON.stringify(data.invitationID),
								 inviteeEmail: JSON.stringify(data.inviteeEmail),
								 encodedPublicKey: JSON.stringify(data.encodedPublicKey)
		})
	}
}

//View all the pubic channels in a team and the private channels the user is in
app.post('/browseAllChannels', function(req, res) {
	var username = req.body.username
	var hashedPublicKey = req.body.hashedPublicKey
	var flatTeamName = req.body.flatTeamName
	var readableTeamName = req.body.readableTeamName

	findAllChannels(hashedPublicKey, flatTeamName, function(allChannels) {
		var data = {}
		data.username = req.body.username
		data.hashedPublicKey = req.body.hashedPublicKey
		data.flatTeamName = req.body.flatTeamName
		data.readableTeamName = req.body.readableTeamName
		data.allChannels = allChannels

		sendPages(res, data, '/homepage/channels/browseAllChannels')
	})
})

//Initial page
app.post('/initial-page', function(req, res) {
    if (req.body.createNewTeam != undefined) {
    	res.render('createTeam')
    }
})

//User logout
app.get('/logout', function(req, res) {
	var username = req.query.username
	res.end("<html> <header> BYE " + username + "! </header> </html>")
})

//Process join team or join channel request
app.post('/processAndResToJoinReq', function(req, res) {
	var username = req.body.username
	var SSHPublicKey = req.body.SSHPublicKey
	var flatName = req.body.flatName
	var invitationID = req.body.invitationID
	var moderatorHashedPublicKey = req.body.moderatorHashedPublicKey
	var hashedInviteePublicKey = req.body.hashedInviteePublicKey
	var flatTeamName = req.body.flatTeamName
	var inviteeEmail = req.body.inviteeEmail

	//Actually, moderatorHashedPublicKey is not needed, because the moderator can calculate
	//from its public key. But as I test multiple users on the same machine, I need it for now
	var repoPath = getClonedRepoPath(flatName, moderatorHashedPublicKey)
	var invitationMetaFilePath = getFilePathInRepo(repoPath, invitationMetaFile)
	var fileContent = JSON.parse(stencil.getFileFromRepo(invitationMetaFilePath))

	var found = false
	for (var i in fileContent) {
		if (fileContent[i].invitationID == invitationID && fileContent[i].status == 'pending') {
			fileContent[i].joinTeamTs = new Date()
			fileContent[i].hashedInviteePublicKey = hashedInviteePublicKey
			fileContent[i].status = 'accepted'
			found = true
			break
		}
	}

	if (found) {
		stencil.createOrUpdateFileInRepo(invitationMetaFilePath, JSON.stringify(fileContent), 'update', function() {
			if (username != undefined) {
				processJoinTeamReq(username, hashedInviteePublicKey, SSHPublicKey, flatName, moderatorHashedPublicKey, inviteeEmail, function(err, serverAddr, knownHostKey, generalChannelFlatName) {
					if (err != null) {
						res.end(err)
					} else {
						var response = {}
						response.type = 'Accept'
						response.generalChannel = generalChannelFlatName
						response.knownHostKey = knownHostKey
						response.serverAddr = serverAddr
						res.write(JSON.stringify(response))
						
						res.end()
					}
				})
			} else {
				processJoinChannelReq(hashedInviteePublicKey, SSHPublicKey, flatName, moderatorHashedPublicKey, flatTeamName, function(err, serverAddr, knownHostKey, channelType) {
					if (err != null) {
						res.end(err)
					} else {
						var response = {}
						response.type = 'Accept'
						response.knownHostKey = knownHostKey
						response.serverAddr = serverAddr
						res.write(JSON.stringify(response))
						res.end()
					}
				})
			}

		})
	} else {

		var response = {}
		response.type = 'No Such Invitation or the Invitation Has been resolved'
		res.write(JSON.stringify(response))
		res.end()

	}
})

app.get('/acceptInvitationToChannel', function(req, res) {
	var flatChannelName = req.query.channel
	var invitationID = req.query.invitationID
	var encodedPublicKey = req.query.encodedPublicKey
	var flatTeamName = req.query.team

	//get the local public key, for now, I just hardcode it
	inviteePublicKey = getPublicKeyLocally('tl67@nyu.edu')
	
	var hashedInviteePublicKey = calculateHash(inviteePublicKey)

	acceptInvitation(hashedInviteePublicKey, encodedPublicKey, undefined, flatChannelName, invitationID, flatTeamName, undefined, function(readableTeamName) {
		var data = {}
		data.hashedPublicKey = hashedInviteePublicKey
		data.readableTeamName = readableTeamName
		data.flatTeamName = flatTeamName
		data.flatCName = flatChannelName

		var memList = getMemList(hashedInviteePublicKey, flatTeamName)
		var memberInfo = findMemberInfoFromMemList(memList, hashedInviteePublicKey)
		data.username = memberInfo.username

		var channelRepoPath = getClonedRepoPath(flatChannelName, hashedInviteePublicKey)
		stencil.syncRepo(channelRepoPath, function() {
			getMessageLogContent(channelRepoPath, hashedInviteePublicKey, function(messageLogContent) {
				data.msgs = replaceHashedPublicKeyWithUserName(messageLogContent, hashedInviteePublicKey, flatTeamName)
				sendPages(res, data, '/homepage/channels/renderChannel')
			})
		})
	})
})

app.get('/acceptInvitationToTeam', function(req, res) {
	var flatTeamName = req.query.team
	var invitationID = req.query.invitationID
	var inviteeEmail = req.query.inviteeEmail
	var encodedPublicKey = req.query.encodedPublicKey
	var dataCompleted = req.query.dataCompleted

	var data = {}

	if (dataCompleted == undefined) {

		data.flatTeamName = flatTeamName
		data.invitationID = invitationID
		data.inviteeEmail = inviteeEmail
		data.encodedPublicKey = encodedPublicKey

		sendPages(res, data, 'joinTeam')

	} else {
		var username = req.query.username

		var done = false
		var inviteePublicKey
		var inviteePrivateKey

		//This is based on two assumptions: 
		//first, we store public key in the email-public.pem 
		//for testing multiple users on the same machine
		//Second, users don't migrate between different machines,
		//so users' public key must be in a fixed place, if user has an account
		if (!fs.existsSync(inviteeEmail + '-public.pem')) {
			createUser(inviteeEmail, function(pubKey, priKey) {
				inviteePublicKey = pubKey
				done = true
			})
		} else {
			inviteePublicKey = getPublicKeyLocally(inviteeEmail)
			done = true
		}
		deasync.loopWhile(function(){return !done})

		var hashedInviteePublicKey = calculateHash(inviteePublicKey)

		acceptInvitation(hashedInviteePublicKey, encodedPublicKey, username, flatTeamName, invitationID, flatTeamName, inviteeEmail, function(readableTeamName){
			var data1 = {}
			data1.readableTeamName = readableTeamName
			data1.flatTeamName = flatTeamName 
			data1.username = username
			data1.hashedPublicKey = hashedInviteePublicKey

			sendPages(res, data1, '/homepage/channels/getChannels')
		})
	}
})

//invite a team member to a particular channel
app.post('/inviteToChannel', function(req, res) {
	var list = req.body.inviteeList
	var hashedPublicKey = req.body.hashedPublicKey
    var flatTeamName = req.body.flatTeamName
    var chosenChannel = req.body.chosenChannel  
    var username = req.body.username
    var readableTeamName = req.body.readableTeamName

    var additionalInfo = {}
	additionalInfo.readableTeamName = readableTeamName
	additionalInfo.flatTeamName = flatTeamName

	var inviteeList
	if (_.isArray(list)){
		inviteeList = list
	} else {
		inviteeList = []
		inviteeList.push(list)
	}

	var inviteeEmails = []
	for (var i in inviteeList) {
		var email = getUserEamil(flatTeamName, inviteeList[i])
		inviteeEmails.push(email)
	}

	findChannelsUserIn(hashedPublicKey, flatTeamName, function(channelsUserIn) {
		for (var i in channelsUserIn) {
			if (channelsUserIn[i].flatName == chosenChannel) {
				var readableName = channelsUserIn[i].readableName
				additionalInfo.option = channelsUserIn[i].type
				break
			}
		}

		sendInvitationEmail(chosenChannel, readableName, hashedPublicKey, username, inviteeEmails, additionalInfo, function() {

			var data = {}
			data.hashedPublicKey = hashedPublicKey
			data.username = username
			data.readableTeamName = readableTeamName
			data.flatTeamName = flatTeamName
			data.flatCName = chosenChannel

			var channelRepoPath = getClonedRepoPath(chosenChannel, hashedPublicKey)
			stencil.syncRepo(channelRepoPath, function() {
				getMessageLogContent(channelRepoPath, hashedPublicKey, function(messageLogContent) {
					data.msgs = replaceHashedPublicKeyWithUserName(messageLogContent, hashedPublicKey, flatTeamName)
					sendPages(res, data, '/homepage/channels/renderChannel')
				})
			})
		})
	})
})


//invite a user to this team
app.post('/inviteToTeam', function(req, res) {
	var hashedPublicKey = req.body.hashedPublicKey
	var flatTeamName = req.body.flatTeamName
	var inviteeEmail = req.body.inviteeEmail
	var readableTeamName = req.body.readableTeamName
	var username = req.body.username

	var data = {}
	data.flatTeamName = flatTeamName
	data.readableTeamName = readableTeamName
	data.username = username
	data.hashedPublicKey = hashedPublicKey

	var alreadyInTeam = checkAlreadyInTeam(inviteeEmail, flatTeamName, hashedPublicKey)

	if (alreadyInTeam) {
		sendPages(res, data, '/homepage/team/inviteToTeam/alreadyInTeam')
	} else {
		var additionalInfo = {}
		additionalInfo.option = 'team'

		var inviteeEmails = []
		inviteeEmails.push(inviteeEmail)

		sendInvitationEmail(flatTeamName, readableTeamName, hashedPublicKey, username, inviteeEmails, additionalInfo, function() {
			sendPages(res, data, '/homepage/team/inviteToTeam/sentEmail')
		})
	}
})

app.get('/renderChannel', function(req, res) {
	var hashedPublicKey = req.query.hashedPublicKey
	var username = req.query.username
	var readableTeamName = req.query.readableTeamName
	var flatTeamName = req.query.flatTeamName
	var flatCName = req.query.flatCName

	var data = {}
	data.hashedPublicKey = hashedPublicKey
	data.username = username
	data.readableTeamName = readableTeamName
	data.flatTeamName = flatTeamName
	data.flatCName = flatCName

	var channelRepoPath = getClonedRepoPath(flatCName, hashedPublicKey)
	stencil.syncRepo(channelRepoPath, function() {
		getMessageLogContent(channelRepoPath, hashedPublicKey, function(messageLogContent) {
			data.msgs = replaceHashedPublicKeyWithUserName(messageLogContent, hashedPublicKey, flatTeamName)
			sendPages(res, data, '/homepage/channels/renderChannel')
		})
	})
})

//Deal with refresh request from browser periodically
app.post('/refreshChannelMsgs', function(req, res) {
    var hashedPublicKey = req.body.hashedPublicKey
    var flatTeamName = req.body.flatTeamName
    var chosenChannel = req.body.chosenChannel

    var data = {}

    var channelRepoPath = getClonedRepoPath(chosenChannel, hashedPublicKey)
	stencil.syncRepo(channelRepoPath, function(updated) {
		data.updated = updated
		if (updated) {
			getMessageLogContent(channelRepoPath, hashedPublicKey, function(messageLogContent) {
    			data.msgs = replaceHashedPublicKeyWithUserName(messageLogContent, hashedPublicKey, flatTeamName)
				var result = '<html>' + JSON.stringify(data) + '</html>'
				res.end(result)
			})
		} else {
			var result = '<html>' + JSON.stringify(data) + '</html>'
			res.end(result)
		}
	})    

})


//Cope with user message
app.post('/userMsg', function(req, res) {
	var hashedPublicKey = req.body.hashedPublicKey
	var username = req.body.username
	var readableTeamName = req.body.readableTeamName
	var flatTeamName = req.body.flatTeamName 
	var flatCName = req.body.flatCName
	var message = req.body.message

	var data = {}
	data.hashedPublicKey = hashedPublicKey
	data.username = username
	data.readableTeamName = readableTeamName
	data.flatTeamName = flatTeamName
	data.flatCName = flatCName

	updateMsg(hashedPublicKey, flatCName, message, function(messageLogContent) {
		data.msgs = replaceHashedPublicKeyWithUserName(messageLogContent, hashedPublicKey, flatTeamName)
		sendPages(res, data, '/homepage/channels/renderChannel')
	})
})

app.post('/getChannels', function(req, res) {
	var data = {}
	data.username = req.body.username
	data.hashedPublicKey = req.body.hashedPublicKey
	data.flatTeamName = req.body.flatTeamName
	data.readableTeamName = req.body.readableTeamName

	sendPages(res, data, '/homepage/channels/getChannels')
})


//Create a team
app.post('/createTeam', function(req, res) {
	var email = req.body.email
	var username = req.body.username
	var readableTeamName = req.body.teamName
	var serverAddr = req.body.remote
	var description = req.body.description

	var done = false
	var creatorPublicKey

	//store public key and private key in email-public.pem and email-private.pem respectively.
	//This is an expedient method to distinguish different users on the local machine for testing use.
	//In the future, the key should be stored locally in a well-known place
	creatorPublicKey = getPublicKeyLocally(email)
	if (creatorPublicKey == undefined) {
		createUser(email, function(pubKey, priKey) {
			creatorPublicKey = pubKey
			done = true
		})
	} else {
		done = true
	}
	deasync.loopWhile(function(){return !done})

	var userID = calculateHash(creatorPublicKey)

	createTeamOrChannel(userID, serverAddr, email, description, readableTeamName, username, null, 'team', undefined, function(teamName) {

		var generalChannelDescription = 'team wide communication and announcement'
		var generalChannelReadableName = 'general'
		createTeamOrChannel(userID, serverAddr, email, generalChannelDescription, generalChannelReadableName, username, teamName, 'public channel', undefined, function() {

			var data = {}
			data.flatTeamName = teamName
			data.readableTeamName = readableTeamName
			data.username = username
			data.hashedPublicKey = userID
			sendPages(res, data, '/homepage/channels/getChannels')

		})

	})

})

var httpServer = http.createServer(app)

//Create DHT node locally
stencil.createDHTNode(localDHTNodeAddr, localDHTNodePort, localDHTNodeDB, function(node) {
	localDHTNode = node
	httpServer.listen(httpListeningPort)
})

console.log('App is listening at port %d', httpListeningPort)
