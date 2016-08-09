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

const slackEmailDomain = 'stencil.slack@gmail.com'

const httpListeningPort = 3000
const httpsListeningPort = 3443

//stencil public key in pem format
const stencilPublicKey = 
'-----BEGIN RSA PUBLIC KEY-----\n' + 
'MIIBCgKCAQEAj5Xs9wrANKOgrrwnisI11K6Q0frtRS9zD0LsAY0QHC5Om0ewso6f\n' + 
'laSyjfsRwxsupVRN/881Dxz4adtrZk3jYZ6wzg2zU1F8XIkSyj/cCeKherOtmjCW\n'+ 
'cAZmhYZsguBQqznrRc7wWannxvFPjvGqNnQnUoKeqbdzjooD0+bzBoKrROwDdDEh\n' + 
'83ID76CagN3BtjZ49kBRfjqXjYBgCBLS6644dousLdBBjNoHj8uveyavAxLar+4w\n' + 
'4i16uVBnUlhLYCuflEiXoFkSHuA2IMb3SCUSZKDRQQ9TyTiAbMNNYLUSdkC3NF5+\n' +  
'JAPr9UUyUbaorLEHNzhRqFLK2MCBdLZ9KQIDAQAB\n' + 
'-----END RSA PUBLIC KEY-----'

//slack public key in pem format
const slackPublicKey = 
'-----BEGIN RSA PUBLIC KEY-----\n' + 
'MIIBCgKCAQEA1xAEIRvuuiRJupUZnzq8MF1GtKjuPckTKJ8bW7RdrOK4pETZlUSq\n' +  
'TRsnrqMzgdEHmqZqQyDEY61uvRMg3ZlLQ9KZEVZfSEpZ1mkcXMji//Pl0AZaQVN+\n' + 
'POmEc0eVVRGOEnBAh9aexQXDLi3LLPb3PGS/juqZ1ft/G884w+wd3yBz9rDkGu+8\n' + 
'ZcxHMRvuCQWOlF6L14f4RQL9VrMxLqTw7Exv4IT2ZjYaMJ/Qoj9CXBTs8jXKQ4W5\n' + 
'bXlNjnjiXv1u/nx/hf+ZSU5KX07YLE1JrDEqJgvsZ/vj5MZDYvwOzkx4q04rw9F6\n' + 
'BYFS1EgW5jtJ1Rm4QW6x91m0f8XDkFuE7QIDAQAB\n' + 
'-----END RSA PUBLIC KEY-----'

const hashedStencilPublicKey = calculateHash(stencilPublicKey)
const hashedSlackPublicKey = calculateHash(slackPublicKey)

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

var SSHKeysDir = '/home/'+ findCurrentAccount() + '/.ssh'
var SSHPkFilePath = SSHKeysDir + '/id_rsa.pub'
var knownHostsPath = '/home/' + findCurrentAccount() + '/.ssh/known_hosts'
var userMsgLogs = 'message_log'
var publicKeyFile = 'group_public_key'
var invitationHistoryFile = 'invitation_history'
var memListFile = 'member_list'
var groupMetaFile = 'group_meta'
var privateChannelsFile = 'private_channels'
var teamAndNameFile = 'team_and_name'
var usermetaFile = 'user_meta'

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

function checkAndAddKnownHostKey(moderatorAddr, knownHostsKey) {
	if (fs.existsSync(knownHostsPath)) {
	  	var checkKnownHosts = 'ssh-keygen -F ' + moderatorAddr
	  	var checkResult = childProcess.execSync(checkKnownHosts)
	  	if (checkResult.toString() == null) {
	    	fs.appendFileSync(knownHostsPath, knownHostsKey)
	  	}
	} else {
	  	childProcess.execSync('touch ' + knownHostsPath)
	  	fs.appendFileSync(knownHostsPath, knownHostsKey)
	}
}

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

	stencil.getFileFromTorrent(userMsgLogs, flatCName, hashedPublicKey, function(value) {
		data.msgs = value

		sendPages(res, data, '/homepage/channels/renderChannel')
	})

})

app.post('/refreshChannelMsgs', function(req, res) {
    var hashedPublicKey = req.body.hashedPublicKey
    var flatTeamName = req.body.flatTeamName
    var chosenChannel = req.body.chosenChannel

    var data = {}

	stencil.syncFile(hashedPublicKey, chosenChannel, function(updated) {
		data.updated = updated
		if (updated) {
			stencil.getFileFromTorrent(userMsgLogs, chosenChannel, hashedPublicKey, function(msgs) {
    			data.msgs = msgs
				var result = '<html>' + JSON.stringify(data) + '</html>'
				res.end(result)
			})
		} else {
			var result = '<html>' + JSON.stringify(data) + '</html>'
			res.end(result)
		}
	})    

})

function updateMsg(hashedPublicKey, flatTeamName, flatCName, message, callback) {
	stencil.getFileFromTorrent(userMsgLogs, flatCName, hashedPublicKey, function(msgs) {

		var newMsg = {}
		newMsg.msg = message
		newMsg.creator = hashedPublicKey
		newMsg.ts = new Date()
		msgs.push(newMsg)

		stencil.createOrUpdateFileInTorrent(hashedPublicKey, userMsgLogs, flatCName, msgs, 'update', function(retry) {
			if (!retry) {
				callback(msgs)
			} else {
				updateMsg(hashedPublicKey, flatTeamName, flatCName, message, callback)
			}
		})
	})
}

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

	updateMsg(hashedPublicKey, flatTeamName, flatCName, message, function(msgs) {

		data.msgs = msgs
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

//Store the public key to 'email-public.pem' and the private to 'email-private.pem'
//This is just a temporary method, because in the development, I need to test 
//using different users on the same machine 
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

function getPrivateKey(keyPath) {
	return fs.readFileSync(keyPath + '-private.pem', 'utf8')
}

function createUser(keyPath, callback) {
	createPublicKeyPair(keyPath)
	createCertificate(keyPath)

	var publicKey = getPublicKey(keyPath)
	var hashedPublicKey = calculateHash(publicKey)
	var	privateKey = getPrivateKey(keyPath)

	var localUserMeta = {}
	localUserMeta.ts = new Date()

	mkdirp(hashedPublicKey)

	fs.writeFile(hashedPublicKey + '/' + usermetaFile, JSON.stringify(localUserMeta), function(err) {

		stencil.createUser(hashedPublicKey, privateKey, publicKey, function() {
			callback(publicKey, privateKey)
		})

	})
}

function calculateHash(value) {
	var hash = crypto.createHash('sha256')
	hash.update(value)
	return hash.digest('hex')
}

function getPublicKey(keyPath) {
	var publicKey
	try {
		publicKey = fs.readFileSync(keyPath + '-public.pem', 'utf8')
	} catch (err) {
		publicKey = undefined
	}
	return publicKey
}

function addContentToJSONFileInRepo(filePath, groupName, hashedPublicKey, addedContent, callback) {
	var unprocessedFileContent = stencil.getFileInRepo(filePath, groupName, hashedPublicKey)
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

	stencil.createOrUpdateFileInRepo(hashedPublicKey, filePath, groupName, JSON.stringify(content), option, function() {
		callback()
	})
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

app.post('/newChannel', function(req, res) {
    var readableName = req.body.channelName
    var hashedPublicKey = req.body.hashedPublicKey
	var username = req.body.username
	var readableTeamName = req.body.readableTeamName
	var flatTeamName = req.body.flatTeamName
	var channelType = req.body.type
	var remote = req.body.remote
	var purpose = req.body.purpose

	//Here is just an expedient measure, because of testing multiple users on the same machine
	//In the future, I can directly find the private key in some fixed place locally
	var creatorPublicKey = getPublicKey('tl1821@nyu.edu')
	var creatorPrivateKey = getPrivateKey('tl1821@nyu.edu')
	var userID = calculateHash(creatorPublicKey)
	if (userID != hashedPublicKey) {
		creatorPublicKey = getPublicKey('tl67@nyu.edu')
		creatorPrivateKey = getPrivateKey('tl67@nyu.edu')
	}

	var channelMetaPutOnDHT = {}
	channelMetaPutOnDHT.creatorPublicKey = creatorPublicKey
	channelMetaPutOnDHT.creatorPrivateKey = creatorPrivateKey
	channelMetaPutOnDHT.remote = remote

	if (channelType == 'public') {
		channelMetaPutOnDHT.teamName = flatTeamName
		channelMetaPutOnDHT.readableName = readableName
	}

	var label = createRandom()
	var channelName = hashedStencilPublicKey + ':' + hashedSlackPublicKey + ':' + label
	channelMetaPutOnDHT.groupName = channelName

	createPublicKeyPair(channelName)
	var channelPublicKey = getPublicKey(channelName)
	var channelPrivateKey = getPrivateKey(channelName)
	channelMetaPutOnDHT.privateKey = channelPrivateKey
	channelMetaPutOnDHT.publicKey = channelPublicKey
	channelMetaPutOnDHT.groupType = channelType

	stencil.putOnGroupDHT(channelMetaPutOnDHT, function (err) {
		if (err != null) {
			res.end(err)
		} else {

			var channelMetaPutInGroupMetaInRepo = {}
			channelMetaPutInGroupMetaInRepo.description = purpose
			channelMetaPutInGroupMetaInRepo.ts = new Date()

			stencil.createOrUpdateFileInRepo(hashedPublicKey, groupMetaFile, channelName, JSON.stringify(channelMetaPutInGroupMetaInRepo), 'create', function() {

				var channelMetaPutInMemListInRepo = []
				channelMetaPutInMemListInRepo[0] = {}
				channelMetaPutInMemListInRepo[0].username = username
				channelMetaPutInMemListInRepo[0].hashedPublicKey = hashedPublicKey
				channelMetaPutInMemListInRepo[0].role = []
				channelMetaPutInMemListInRepo[0].role[0] = 'creator'

				stencil.createOrUpdateFileInRepo(hashedPublicKey, memListFile, channelName, JSON.stringify(channelMetaPutInMemListInRepo), 'create', function() {

					stencil.createOrUpdateFileInRepo(hashedPublicKey, publicKeyFile, channelName, channelPublicKey, 'create', function() {

						stencil.createOrUpdateFileInTorrent(hashedPublicKey, userMsgLogs, channelName, [], 'create', function() {

							if (channelType == 'public') {
								getUserInfo(hashedPublicKey, function(err, usermeta) {
									if (err != null) {
										res.end(err)
									} else {
										stencil.updateUserInfo(hashedPublicKey, usermeta, channelName, 'add group', creatorPrivateKey, function() {

											var data = {}
											data.flatTeamName = flatTeamName
											data.readableTeamName = readableTeamName
											data.username = username
											data.hashedPublicKey = hashedPublicKey

											sendPages(res, data, '/homepage/channels/getChannels')

										})
									}
								})
							} else {
								var teamAndReadableName = {}
								teamAndReadableName.teamName = flatTeamName
								teamAndReadableName.name = readableName

								addContentToJSONFileInRepo(teamAndNameFile, channelName, hashedPublicKey, teamAndReadableName, function() {

									addContentToJSONFileLocally(hashedPublicKey + '/' + privateChannelsFile, channelName, function(err) {
										
										var data = {}
										data.flatTeamName = flatTeamName
										data.readableTeamName = readableTeamName
										data.username = username
										data.hashedPublicKey = hashedPublicKey

										sendPages(res, data, '/homepage/channels/getChannels')

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

function getMembListDifference(listOne, listTwo) {
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

    var data = {}

    var teamMems = findAllGroupMems(flatTeamName, hashedPublicKey)	
    var channelMems = findAllGroupMems(chosenChannel, hashedPublicKey)
    
    var inviteeList = getMembListDifference(teamMems, channelMems)
	if (inviteeList.length == 0) {
		data.inviteeListEmpty = true
	} else {
		data.inviteeListEmpty = false
	}
	
	data.inviteeList = inviteeList
	var result = '<html>' + JSON.stringify(data) + '</html>'
	res.end(result)
	 
})

//Create a team
app.post('/createTeam', function(req, res) {
	var email = req.body.email
	var username = req.body.username
	var readableTeamName = req.body.teamName
	var remote = req.body.remote

	var done = false
	var creatorPublicKey
	var creatorPrivateKey

	var teamMetaPutOnDHT = {}
	teamMetaPutOnDHT.remote = remote

	//we need to map email to public key so that we know whether there is a userID this email
	//corresponds to exists or not. Right now this is just a temporary method 
	creatorPublicKey = getPublicKey(email)
	if (creatorPublicKey == undefined) {
		createUser(email, function(pubKey, priKey) {
			creatorPublicKey = pubKey
			creatorPrivateKey = priKey
			done = true
		})
	} else {
		done = true
	}
	deasync.loopWhile(function(){return !done})

	var userID = calculateHash(creatorPublicKey)
	teamMetaPutOnDHT.creatorPublicKey = creatorPublicKey

	var label = createRandom()
	teamName = hashedStencilPublicKey + ':' + hashedSlackPublicKey + ':' + label
	teamMetaPutOnDHT.groupName = teamName
	teamMetaPutOnDHT.teamName = teamName
	teamMetaPutOnDHT.readableName = readableTeamName

	createPublicKeyPair(teamMetaPutOnDHT.teamName)
	var teamPublicKey = getPublicKey(teamMetaPutOnDHT.teamName)
	var teamPrivateKey = getPrivateKey(teamMetaPutOnDHT.teamName)
	teamMetaPutOnDHT.privateKey = teamPrivateKey

	teamMetaPutOnDHT.groupType = 'public'

	stencil.putOnGroupDHT(teamMetaPutOnDHT, function () {
	
		var teamMetaPutInGroupMetaInRepo = {}
		teamMetaPutInGroupMetaInRepo.description = req.body.description			
		teamMetaPutInGroupMetaInRepo.ts = new Date()

		stencil.createOrUpdateFileInRepo(userID, groupMetaFile, teamName, JSON.stringify(teamMetaPutInGroupMetaInRepo), 'create', function() {

			var teamMetaPutInMemListInRepo = []
			teamMetaPutInMemListInRepo[0] = {}
			teamMetaPutInMemListInRepo[0].username = username
			teamMetaPutInMemListInRepo[0].hashedPublicKey = userID
			teamMetaPutInMemListInRepo[0].role = []
			teamMetaPutInMemListInRepo[0].role[0] = 'creator'

			stencil.createOrUpdateFileInRepo(userID, memListFile, teamName, JSON.stringify(teamMetaPutInMemListInRepo), 'create', function() {

				stencil.createOrUpdateFileInRepo(userID, publicKeyFile, teamName, teamPublicKey, 'create', function() {

					getUserInfo(userID, function(err, usermeta) {
						if (err != null) {
							res.end(err)
						} else {
							stencil.updateUserInfo(userID, usermeta, teamName, 'add group', creatorPrivateKey, function() {




								var channelMetaPutOnDHT = {}
								label = createRandom()
								channelMetaPutOnDHT.creatorPublicKey = creatorPublicKey
								channelMetaPutOnDHT.teamName = teamName
								channelMetaPutOnDHT.remote = remote
								channelMetaPutOnDHT.groupType = 'public'
								channelMetaPutOnDHT.readableName = 'general'

								var channelName = hashedStencilPublicKey + ':' + hashedSlackPublicKey + ':' + label
								channelMetaPutOnDHT.groupName = channelName

								createPublicKeyPair(channelName)
								var channelPublicKey = getPublicKey(channelName)
								var channelPrivateKey = getPrivateKey(channelName)
								channelMetaPutOnDHT.privateKey = channelPrivateKey

								stencil.putOnGroupDHT(channelMetaPutOnDHT, function () {
									
									var channelMetaPutInGroupMetaInRepo = {}
									channelMetaPutInGroupMetaInRepo.description = 'team wide communication and announcement'
									channelMetaPutInGroupMetaInRepo.ts = new Date()

									stencil.createOrUpdateFileInRepo(userID, groupMetaFile, channelName, JSON.stringify(channelMetaPutInGroupMetaInRepo), 'create', function() {

										var channelMetaPutInMemListInRepo = []
										channelMetaPutInMemListInRepo[0] = {}
										channelMetaPutInMemListInRepo[0].username = username
										channelMetaPutInMemListInRepo[0].hashedPublicKey = userID
										channelMetaPutInMemListInRepo[0].role = []
										channelMetaPutInMemListInRepo[0].role[0] = 'creator'

										stencil.createOrUpdateFileInRepo(userID, memListFile, channelName, JSON.stringify(channelMetaPutInMemListInRepo), 'create', function() {

											stencil.createOrUpdateFileInRepo(userID, publicKeyFile, channelName, channelPublicKey, 'create', function() {

												stencil.createOrUpdateFileInTorrent(userID, userMsgLogs, channelName, [], 'create', function() {

													getUserInfo(userID, function(err, usermeta) {
														if (err != null) {
															res.end(err)
														} else {
															stencil.updateUserInfo(userID, usermeta, channelName, 'add group', creatorPrivateKey, function() {


																var data = {}
																data.flatTeamName = teamName
																data.readableTeamName = readableTeamName
																data.username = username
																data.hashedPublicKey = userID

																sendPages(res, data, '/homepage/channels/getChannels')

															})
														}
													})
												})
											})
										})
									})
									
								})

							})

						}

					})
				})
			})
		})
	})
})

function sendInvitationEmail(flatGroupName, readableGroupName, hashedPublicKey, username, inviteeEmails, additionalInfo, callback) {
	var groupPublicKey = stencil.getFileInRepo(publicKeyFile, flatGroupName, hashedPublicKey)
	var encodedGroupPublicKey = encodeURIComponent(groupPublicKey)

	var invitationID = createRandom()

	var inviteeEmail = inviteeEmails[0]
	inviteeEmails = _.rest(inviteeEmails)

	if (additionalInfo.option == 'team') {
		var url = 'http://localhost:' + httpListeningPort + '/acceptInvitationToTeam'
		url += '?team=' + flatGroupName + '&&invitationID=' +  invitationID
		url += '&&inviteeEmail=' + inviteeEmail + '&&encodedGroupPublicKey=' + encodedGroupPublicKey
		var subject = username + ' invited you to team ' + readableGroupName + ' on Stencil Slack'
		var body = '<p>' + username + ' uses Stencil Slack, a P2P messaging app using Stencil Storage API'
		body += ' for teams, and has invited you to join the team ' + readableGroupName + '</p><br><br>'
		body += '<a href="'+ url +'"><b><i>Join Team</b></i></a>'
		 
	} else {
		var url = 'http://localhost:' + httpListeningPort + '/acceptInvitationToChannel'
		url += '?channel=' + flatGroupName + '&&invitationID=' +  invitationID
		url += '&&encodedGroupPublicKey=' + encodedGroupPublicKey
		var subject = username + ' invited you to channel ' + readableGroupName + ' of team ' + additionalInfo.readableTeamName + ' on Stencil Slack'
		var body = '<a href="'+ url +'"><b><i>Join Channel</b></i></a>'
	}

	// setup e-mail data with unicode symbols
	var mailOptions = {
	    from: '"Stencil Slack" <stencil.slack@gmail.com>', 	// sender address
	    to: inviteeEmail, 									// list of receivers
	    subject: subject, 									// Subject line
	    html: body 											// html body
	}

	var newItem = {}
	newItem.hashedInviterPublicKey = hashedPublicKey
	newItem.inviteeEmail = inviteeEmail
	newItem.inviteTs = new Date()
	newItem.status = 'pending'
	newItem.invitationID = invitationID

	addContentToJSONFileInRepo(invitationHistoryFile, flatGroupName, hashedPublicKey, newItem, function() {
		sendEmail(mailOptions, function () {
			if (inviteeEmails.length == 0) {
				callback()
			} else {
				sendInvitationEmail(flatGroupName, readableGroupName, hashedPublicKey, username, inviteeEmails, additionalInfo, callback)
			}
		})
	})
}

app.post('/inviteToChannel', function(req, res) {
	var inviteeList = req.body.inviteeList
	var hashedPublicKey = req.body.hashedPublicKey
    var flatTeamName = req.body.flatTeamName
    var chosenChannel = req.body.chosenChannel  
    var username = req.body.username
    var readableTeamName = req.body.readableTeamName

    var additionalInfo = {}

    var channelPublicKey = stencil.getFileInRepo(publicKeyFile, chosenChannel, hashedPublicKey)
    getGroupInfoOnDHT(chosenChannel, channelPublicKey, function(err, channelMeta) {

    	if (channelMeta.content == undefined) {
    		channelMeta.content = JSON.parse(stencil.getFileInRepo(teamAndNameFile, chosenChannel, hashedPublicKey))[0]
    	}

    	additionalInfo.option = 'channel'
    	additionalInfo.readableTeamName = readableTeamName

    	//There should be a mapping from hashedPublicKey in inviteeList to corresponding email,
    	//here is an expedient method for now, as I hardcode the inviteeEmail.
    	var inviteeEmails = []
    	inviteeEmails[0] = 'tl67@nyu.edu'

		sendInvitationEmail(chosenChannel, channelMeta.content.name, hashedPublicKey, username, inviteeEmails, additionalInfo, function() {

			var data = {}
			data.hashedPublicKey = hashedPublicKey
			data.username = username
			data.readableTeamName = readableTeamName
			data.flatTeamName = flatTeamName
			data.flatCName = chosenChannel

			stencil.getFileFromTorrent(userMsgLogs, chosenChannel, hashedPublicKey, function(value) {
				data.msgs = value
				sendPages(res, data, '/homepage/channels/renderChannel')
			})
		})
    })

})

app.post('/inviteToTeam', function(req, res) {
	var hashedPublicKey = req.body.hashedPublicKey
	var flatTeamName = req.body.flatTeamName
	var inviteeEmail = req.body.inviteeEmail
	var readableTeamName = req.body.readableTeamName
	var username = req.body.username

	var alreadyInGroup = false

	var data = {}
	data.flatTeamName = flatTeamName
	data.readableTeamName = readableTeamName
	data.username = username
	data.hashedPublicKey = hashedPublicKey

	//we need to use inviteeEmail to find userID(hashedPublicKey).
	//After finding userID, then we can find whether this guy has 
	//already been in this team.
	//The following is just a temporary method for now. 
	getUserInfo(inviteeEmail, function(err, usermeta) {
		if (err != null) {
			res.end(err)
		} else {
			if (usermeta != undefined) {
				for (var i in usermeta.groups) {
					if (usermeta.groups[i] == flatTeamName) {
						alreadyInGroup = true
						break
					}
				}
			}
			if (alreadyInGroup) {
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
		}
	})
})

function verifySignature(value, publicKey, signature) {
	var verify = crypto.createVerify('SHA256')
	verify.update(value)
	verify.end()
	return verify.verify(publicKey, signature, 'hex')
}

function verifyGroupMeta(groupPublicKey, groupMeta) {
	var checkedValue = _.clone(groupMeta)
	delete checkedValue['signature']
	var result = verifySignature(JSON.stringify(checkedValue), groupPublicKey, groupMeta.signature)
	return result
}

function getGroupInfoOnDHT(groupName, groupPublicKey, callback) {
	stencil.getGroupInfoOnDHT(groupName, function(groupMeta) {
		var result = verifyGroupMeta(groupPublicKey, groupMeta)
		if (result) {
			callback(null, groupMeta)
		} else {
			var err = 'ERROR: TAMPERED_GROUPMETA'
			callback(err, null)
		}
	})
}

function verifyHash(hashedValue, value) {
	if (calculateHash(value) == hashedValue) {
		return true
	} 
	return false
}

function getUserInfo(userID, callback) {
	stencil.getUserInfo(userID, function (value) {
		var err
		var usermeta
		if (value != undefined) {
			var checkedValue = _.clone(value)
			delete checkedValue['signature']
			var result = verifySignature(JSON.stringify(checkedValue), checkedValue.publicKey, value.signature)
			var result1 = verifyHash(userID, checkedValue.publicKey)
			if (!result || !result1) {
				err = 'ERROR: TAMPERED_USER_META'
				usermeta = null
			} else {
				err = null
				usermeta = value
			}
		} else {
			err = null
			usermeta = undefined
		}
		callback(err, usermeta)
	})
}

app.get('/acceptInvitationToChannel', function(req, res) {
	var flatChannelName = req.query.channel
	var invitationID = req.query.invitationID
	var encodedGroupPublicKey = req.query.encodedGroupPublicKey

	//get the local public and private keys
	//for now, I just hardcode it
	inviteePublicKey = getPublicKey('tl67@nyu.edu')
	inviteePrivateKey = getPrivateKey('tl67@nyu.edu')

	var hashedInviteePublicKey = calculateHash(inviteePublicKey)

	acceptInvitation(hashedInviteePublicKey, encodedGroupPublicKey, undefined, flatChannelName, invitationID, inviteePrivateKey, function(readableTeamName, flatTeamName) {

		var memList = JSON.parse(stencil.getFileInRepo(memListFile, flatChannelName, hashedInviteePublicKey))

		var data = {}
		data.hashedPublicKey = hashedInviteePublicKey
		data.username = findUsernameFromMemList(memList, hashedInviteePublicKey)
		data.readableTeamName = readableTeamName
		data.flatTeamName = flatTeamName
		data.flatCName = flatChannelName

		stencil.getFileFromTorrent(userMsgLogs, flatChannelName, hashedInviteePublicKey, function(value) {
			data.msgs = value
			sendPages(res, data, '/homepage/channels/renderChannel')
		})
	})
})

app.get('/acceptInvitationToTeam', function(req, res) {
	var flatTeamName = req.query.team
	var invitationID = req.query.invitationID
	var inviteeEmail = req.query.inviteeEmail
	var encodedGroupPublicKey = req.query.encodedGroupPublicKey
	var dataCompleted = req.query.dataCompleted

	var data = {}

	if (dataCompleted == undefined) {

		data.flatTeamName = flatTeamName
		data.invitationID = invitationID
		data.inviteeEmail = inviteeEmail
		data.encodedGroupPublicKey = encodedGroupPublicKey

		sendPages(res, data, 'joinTeam')

	} else {
		var username = req.query.username

		var done = false
		var inviteePublicKey
		var inviteePrivateKey
		//Check whether the user has already existed. This is just a temporary method,
		//as right now we don't have a mapping method from email to userID(public key).
		//This is based on another temporary way about how to store the key pairs locally.
		if (!fs.existsSync(inviteeEmail + '.public')) {
			createUser(inviteeEmail, function(pubKey, priKey) {
				inviteePublicKey = pubKey
				inviteePrivateKey = priKey
				done = true
			})
		} else {
			inviteePublicKey = getPublicKey(inviteeEmail)
			inviteePrivateKey = getPrivateKey(inviteeEmail)
			done = true
		}
		deasync.loopWhile(function(){return !done})

		var hashedInviteePublicKey = calculateHash(inviteePublicKey)

		acceptInvitation(hashedInviteePublicKey, encodedGroupPublicKey, username, flatTeamName, invitationID, inviteePrivateKey, function(readableTeamName){
			var data1 = {}
			data1.readableTeamName = readableTeamName
			data1.flatTeamName = flatTeamName 
			data1.username = username
			data1.hashedPublicKey = hashedInviteePublicKey

			sendPages(res, data1, '/homepage/channels/getChannels')
		})
	}
})

function acceptInvitation(hashedInviteePublicKey, encodedGroupPublicKey, username, flatGroupName, invitationID, inviteePrivateKey, callback) {
	var groupPublicKey = decodeURIComponent(encodedGroupPublicKey)
	var data = {}

	getGroupInfoOnDHT(flatGroupName, groupPublicKey, function(err, groupMeta) {
		if (err != null) {
			res.end(err)
		} else {
			//For now I only try to find one creator or moderator to allow the new user to join
			//But actually, it should be some or all moderators and creator
			var groupMems = groupMeta.groupMems
			var moderatorHashedPublicKey = groupMems[0].hashedPublicKey

			//hardcode the address of the moderator for now, as we don't have mapping from userID to location
			var moderatorAddr = 'localhost'

			joinGroupReq(username, flatGroupName, moderatorHashedPublicKey, moderatorAddr, invitationID, hashedInviteePublicKey, inviteePrivateKey, function (err) {
				if (err != null) {
					res.end(err)
				} else {
					if (groupMeta.content == undefined) {
						groupMeta.content = JSON.parse(stencil.getFileInRepo(teamAndNameFile, flatGroupName, hashedInviteePublicKey))[0]
					}
					callback(groupMeta.content.name, groupMeta.content.teamName)
				}
			})	
		}
	})
}

//send join team request
function joinGroupReq(username, flatGroupName, moderatorHashedPublicKey, moderatorAddr, invitationID, hashedInviteePublicKey, inviteePrivateKey, callback) {
	var url = 'http://' + moderatorAddr + ':' + httpListeningPort + '/joinGroupRes'

	if (!fs.existsSync(SSHKeysDir) || !fs.existsSync(SSHPkFilePath)) {
		console.log('Please use command \'ssh-keygen -t rsa -C "your_email@example.com"\' to generate ssh key pairs')
	}

	var SSHPublicKey = fs.readFileSync(SSHPkFilePath)

	var data = {
		username: username,
		SSHPublicKey: SSHPublicKey,
		flatGroupName: flatGroupName,
		invitationID: invitationID,
		moderatorHashedPublicKey: moderatorHashedPublicKey,
		hashedInviteePublicKey: hashedInviteePublicKey
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
			//For now, in order to make it simple, I send request to one creator or moderator
			//so type can only be 'Accept'
			if (res.type == 'Accept') {

				var knownHostsKey = res.knownHostsKey
				var serverPath = res.serverPath

				var moderatorAddr = serverPath.split('@')[1]
				checkAndAddKnownHostKey(moderatorAddr, knownHostsKey)

				if (res.generalChannel != undefined) {
					var generalChannel = res.generalChannel

					getUserInfo(hashedInviteePublicKey, function(err1, usermeta) {
						if (err1 != null) {
							callback(err1)
						} else {
							stencil.updateUserInfo(hashedInviteePublicKey, usermeta, flatGroupName, 'add group', inviteePrivateKey, function() {

								stencil.updateUserInfo(hashedInviteePublicKey, usermeta, generalChannel, 'add group', inviteePrivateKey, function() {

									stencil.cloneGroupRepo(hashedInviteePublicKey, serverPath, flatGroupName, function() {

										stencil.cloneGroupRepo(hashedInviteePublicKey, serverPath, generalChannel, function() {

											callback(null)
											
										})

									})

								})

							})
						}
					})
				} else {
					var channelType = res.channelType

					if (channelType == 'public') {
						getUserInfo(hashedInviteePublicKey, function(err1, usermeta) {
							if (err1 != null) {
								callback(err1)
							} else {
								stencil.updateUserInfo(hashedInviteePublicKey, usermeta, flatGroupName, 'add group', inviteePrivateKey, function() {

									stencil.cloneGroupRepo(hashedInviteePublicKey, serverPath, flatGroupName, function() {

										callback(null)
											
									})

								})
							}
						})
					} else {

						addContentToJSONFileLocally(hashedInviteePublicKey + '/' + privateChannelsFile, flatGroupName, function(err) {
							
							stencil.cloneGroupRepo(hashedInviteePublicKey, serverPath, flatGroupName, function() {

								callback(null)
									
							})

						})
					}
					
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

function getSignature(value, privateKey) {
	var sign = crypto.createSign('SHA256')
	sign.update(value)
	sign.end()
	return sign.sign(privateKey, 'hex')
}

function findUsernameFromMemList(memList, hashedInviteePublicKey) {
	for (var i in memList) {
		if (memList[i].hashedPublicKey == hashedInviteePublicKey) {
			return memList[i].username
		}
	}
	return undefined
}

function findUsernameStartingFromChannel(hashedPublicKey, flatChannelName, hashedPublicKeyToBeCompared, callback) {
	var channelPublicKey = stencil.getFileInRepo(publicKeyFile, flatChannelName, hashedPublicKey)
	var channelType
	getGroupInfoOnDHT(flatChannelName, channelPublicKey, function(err, channelMeta) {
		if (err != null) {
			callback(err)
		} else {
			if (channelMeta.content == undefined) {
				channelMeta.content = JSON.parse(stencil.getFileInRepo(teamAndNameFile, flatChannelName, hashedPublicKey))[0]
				channelType = 'private'
			} else {
				channelType = 'public'
			}
			var teamName = channelMeta.content.teamName
			var memList = JSON.parse(stencil.getFileInRepo(memListFile, teamName, hashedPublicKey))
			var username = findUsernameFromMemList(memList, hashedPublicKeyToBeCompared)
			callback(null, username, channelType)
		}
	})
}

function joinChannelRes(hashedInviteePublicKey, SSHPublicKey, flatChannelName, moderatorHashedPublicKey, callback) {	
	findUsernameStartingFromChannel(moderatorHashedPublicKey, flatChannelName, hashedInviteePublicKey, function(err, username, channelType) {
		if (err != null) {
			callback(err)
		} else {
			var newMem = {}
			newMem.username = username
			newMem.hashedPublicKey = hashedInviteePublicKey

			addNormalMemToGroup(flatChannelName, moderatorHashedPublicKey, newMem, SSHPublicKey, hashedInviteePublicKey, function(serverPath, knownHostsKey) {
				
				callback(null, serverPath, knownHostsKey, channelType)
			})
		}
	})
}

function appendToNormalMemList(groupName, hashedPublicKey, newNormalMem, callback) {
	var content = stencil.getFileInRepo(memListFile, groupName, hashedPublicKey)

	if (content == undefined) {
		var normalMems = []
		normalMems.push(newNormalMem)
		stencil.createOrUpdateFileInRepo(hashedPublicKey, memListFile, groupName, JSON.stringify(normalMems), 'create', function() {
			callback()
		})
	} else {
		var normalMems = JSON.parse(content)
		normalMems.push(newNormalMem)
		stencil.createOrUpdateFileInRepo(hashedPublicKey, memListFile, groupName, JSON.stringify(normalMems), 'update', function() {
			callback()
		})
	}

}

function addNormalMemToGroup(groupName, moderatorHashedPublicKey, newNormalMem, SSHPublicKey, newMemHashedPublicKey, callback) {
	appendToNormalMemList(groupName, moderatorHashedPublicKey, newNormalMem, function() {
		stencil.addKeyAndUpdateConfigFileInAdminRepo(moderatorHashedPublicKey, groupName, SSHPublicKey, newMemHashedPublicKey, function(serverPath, knownHostsKey){
			callback(serverPath, knownHostsKey)
		})
	})
}

function joinTeamRes(username, hashedInviteePublicKey, SSHPublicKey, flatTeamName, moderatorHashedPublicKey, callback) {
	var newMem = {}
	newMem.username = username
	newMem.hashedPublicKey = hashedInviteePublicKey
	newMem.role = []
	newMem.role.push('normal')

	addNormalMemToGroup(flatTeamName, moderatorHashedPublicKey, newMem, SSHPublicKey, hashedInviteePublicKey, function() {

		var generalChannelFlatName
		var channelsUserIn = []
		getUserInfo(moderatorHashedPublicKey, function(err, usermeta) {
			if (err != null) {
				callback(err)
			} else {
				findChannelsUserIn(moderatorHashedPublicKey, flatTeamName, usermeta.groups, channelsUserIn, function(err, channelsUserIn) {

					for (var i in channelsUserIn) {
						if (channelsUserIn[i].readableName == 'general') {
							generalChannelFlatName = channelsUserIn[i].flatName
						}
					}

					addNormalMemToGroup(generalChannelFlatName, moderatorHashedPublicKey, newMem, SSHPublicKey, hashedInviteePublicKey, function(serverPath, knownHostsKey) {

						callback(null, serverPath, knownHostsKey, generalChannelFlatName)

					})
				})

			}
		})

	})
}

app.post('/joinGroupRes', function(req, res) {
	var username = req.body.username
	var SSHPublicKey = req.body.SSHPublicKey
	var flatGroupName = req.body.flatGroupName
	var invitationID = req.body.invitationID
	var moderatorHashedPublicKey = req.body.moderatorHashedPublicKey
	var hashedInviteePublicKey = req.body.hashedInviteePublicKey

	var filePath = invitationHistoryFile
	var fileContent = JSON.parse(stencil.getFileInRepo(filePath, flatGroupName, moderatorHashedPublicKey))

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

		stencil.createOrUpdateFileInRepo(moderatorHashedPublicKey, filePath, flatGroupName, JSON.stringify(fileContent), 'update', function() {

			if (username != undefined) {
				joinTeamRes(username, hashedInviteePublicKey, SSHPublicKey, flatGroupName, moderatorHashedPublicKey, function(err, serverPath, knownHostsKey, generalChannelFlatName) {
					if (err != null) {
						res.end(err)
					} else {
						var response = {}
						response.type = 'Accept'
						response.generalChannel = generalChannelFlatName
						response.knownHostsKey = knownHostsKey
						response.serverPath = serverPath
						res.write(JSON.stringify(response))
						
						res.end()
					}
				})
			} else {
				joinChannelRes(hashedInviteePublicKey, SSHPublicKey, flatGroupName, moderatorHashedPublicKey, function(err, serverPath, knownHostsKey, channelType) {
					
					if (err != null) {
						res.end(err)
					} else {
						var response = {}
						response.type = 'Accept'
						response.channelType = channelType
						response.knownHostsKey = knownHostsKey
						response.serverPath = serverPath
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

function findAllGroupMems(flatGroupName, hashedPublicKey) {
	return JSON.parse(stencil.getFileInRepo(memListFile, flatGroupName, hashedPublicKey))
	
}

function getDifferenceOfChannels(channelsUserOneIn, channelsUserTwoIn) {
	var result = [] 
	for (var i in channelsUserTwoIn) {
		var find = false
		for (var j in channelsUserOneIn) {
			if (channelsUserTwoIn[i].flatName == channelsUserOneIn[j].flatName) {
				find = true 
				break
			}
		}
		if (!find) {
			channelsUserTwoIn[i].status = 'out'
			result.push(channelsUserTwoIn[i])
		}
	}
	return result
}

function findPublicChannelsUserNotIn(hashedPublicKey, flatTeamName, publicChannelsUserNotIn, channelsUserIn, groupMems, callback) {
	var groupMem = groupMems[0]
	var channelsOneUserIn = []

	getUserInfo(groupMem.hashedPublicKey, function(err, usermeta) {
		if (err != null) {
			callback(err)
		} else {

			findChannelsUserIn(hashedPublicKey, flatTeamName, usermeta.groups, channelsOneUserIn, function(err, channelsOneUserIn) {
				if (err != null) {
					callback(err)
				} else {
					publicChannelsUserNotIn = _.union(publicChannelsUserNotIn, getDifferenceOfChannels(channelsUserIn, channelsOneUserIn))
					groupMems = _.rest(groupMems)
					if (groupMems.length != 0) {
						findPublicChannelsUserNotIn(hashedPublicKey, flatTeamName, publicChannelsUserNotIn, channelsUserIn, groupMems, callback)
					} else {
						callback(null, publicChannelsUserNotIn)
					}
				}
			})
		}
	})
	
}

function findChannelsUserIn(hashedPublicKey, flatTeamName, groups, channelsUserIn, callback) {
	var groupName = groups[0]
	var channelMeta = {}

	var groupPublicKey = stencil.getFileInRepo(publicKeyFile, groupName, hashedPublicKey)

	getGroupInfoOnDHT(groupName, groupPublicKey, function(err, groupMeta) {
		if (err != null) {
			callback(err)
		} else {
			if (groupMeta.content == undefined) {
				groupMeta.content = JSON.parse(stencil.getFileInRepo(teamAndNameFile, groupName, hashedPublicKey))[0]
				channelMeta.type = 'private'
			} else {
				channelMeta.type = 'public'
			}

			if (groupMeta.content.teamName == flatTeamName && groupName != flatTeamName) {
				channelMeta.flatName = groupName
				channelMeta.readableName = groupMeta.content.name
				channelMeta.status = 'in'
				channelsUserIn.push(channelMeta)
			}
			groups = _.rest(groups)
			if (groups.length != 0) {
				findChannelsUserIn(hashedPublicKey, flatTeamName, groups, channelsUserIn, callback)
			} else {
				callback(null, channelsUserIn)
			}

		}
	})
}

function findAllChannels(hashedPublicKey, flatTeamName, callback) {
	var channelsUserIn = []
	var publicChannelsUserNotIn = []
	getUserInfo(hashedPublicKey, function(err, usermeta) {
		if (err != null) {
			callback(err)
		} else {

			findAllPrivateChannels(hashedPublicKey + '/' + privateChannelsFile, function(allPrivateChannels) {

				findChannelsUserIn(hashedPublicKey, flatTeamName, _.union(usermeta.groups, allPrivateChannels), channelsUserIn, function(err, channelsUserIn) {

					if (err != null) {
						callback(err)
					} else {
						var groupMems = findAllGroupMems(flatTeamName, hashedPublicKey) 
							
						findPublicChannelsUserNotIn(hashedPublicKey, flatTeamName, publicChannelsUserNotIn, channelsUserIn, groupMems, function(err, publicChannelsUserNotIn) {
							if (err != null) {
								callback(err)
							} else {
								callback(null, _.union(channelsUserIn, publicChannelsUserNotIn))
							}
						})
			
					}
				})
			})
		}
	})
}

function findAllPrivateChannels(filePath, callback) {
	fs.readFile(filePath, 'utf8', function(err, unprocessedFileContent) {
		if (unprocessedFileContent == undefined) {
			callback([])
		} else {
			callback(JSON.parse(unprocessedFileContent))
		}
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
			getUserInfo(hashedPublicKey, function(err, usermeta) {
				if (err != null) {
					res.end(err)
				} else {
					var displayedChannels = []

					findAllPrivateChannels(hashedPublicKey + '/' + privateChannelsFile, function(allPrivateChannels) {

						findChannelsUserIn(hashedPublicKey, data.flatTeamName, _.union(usermeta.groups, allPrivateChannels), displayedChannels, function(err, displayedChannels) {
							if (err != null) {
								callback(err)
							} else {
								res.render('homepage', { username: JSON.stringify(data.username), hashedPublicKey: JSON.stringify(hashedPublicKey), 
												readableTeamName: JSON.stringify(data.readableTeamName), flatTeamName: JSON.stringify(data.flatTeamName),
												channels: JSON.stringify(displayedChannels), page: JSON.stringify(type),
												msgs: JSON.stringify(data.msgs), chosenChannel: JSON.stringify(data.flatCName)
								})
							}
						})
					})
				}
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
								 encodedGroupPublicKey: JSON.stringify(data.encodedGroupPublicKey)
		})
	}
}

app.post('/browseAllChannels', function(req, res) {
	var username = req.body.username
	var hashedPublicKey = req.body.hashedPublicKey
	var flatTeamName = req.body.flatTeamName
	var readableTeamName = req.body.readableTeamName

	findAllChannels(hashedPublicKey, flatTeamName, function(err, allChannels) {
		if (err != null) {
			res.end(err)
		} else {
			var data = {}
			data.username = req.body.username
			data.hashedPublicKey = req.body.hashedPublicKey
			data.flatTeamName = req.body.flatTeamName
			data.readableTeamName = req.body.readableTeamName
			data.allChannels = allChannels

			sendPages(res, data, '/homepage/channels/browseAllChannels')

		}
	})
})

// //Deal with select group
// app.post('/selectGroup', function(req, res) {
//     var username = req.body.username
//     var groupName = req.body.groupName
//     sendPages(res, username, groupName, null, null, 'homepage/tags', null)
// })

// //Get group Info
// app.post('/homepage/group/getGroupsInfo', function(req, res) {
// 	var username = req.body.username
// 	var groupName = req.body.groupName
// 	stencil.getUserInfo(username, function (usermeta) {
// 		var groups = JSON.parse(usermeta).groups
// 		if (groups.length == null) {
// 			sendPages(res, username, groupName, null, null, 
// 					'homepage/group/getGroupsInfo', null)
// 		} else {
// 			var groupsMeta = []
// 			var done
// 			for (var i = 0; i < groups.length; i++) {
// 				done = false
// 				stencil.getGroupInfo(groups[i].groupName, function (groupMeta) {
// 					groupsMeta[i] = {}
// 					groupsMeta[i].name = groups[i].groupName
// 					groupsMeta[i].description = JSON.parse(groupMeta).description
// 					done = true
// 				})
// 				deasync.loopWhile(function(){return !done})
// 			}
// 			sendPages(res, username, groupName, null, null, 
// 						'homepage/group/getGroupsInfo', groupsMeta)
// 		}
		
// 	})
// })

// //Leave one Group
// app.post('/homepage/group/leaveOneGroup', function(req, res) {
// 	var username = req.body.username
// 	var currentGroupName = req.body.currentGroupName
// 	var leaveGroupName = req.body.leaveGroupName
// 	var leaveGroup = true
// 	stencil.getGroupInfo(leaveGroupName, function (groupMeta) {
// 		if (groupMeta == undefined) {
// 			leaveGroup = false
// 			sendPages(res, username, currentGroupName, null, null, 
// 				'homepage/group/leaveOneGroup/GroupNotExisted')
// 		}
// 		if (leaveGroup) {
// 			stencil.getUserInfo(username, function (usermeta) {
// 				var groups = JSON.parse(usermeta).groups
// 				var inGroup = false
// 				for (var i = 0; i < groups.length; i++) {
// 					if (leaveGroupName == groups[i].groupName) {
// 						inGroup = true
// 						break
// 					}
// 				}
// 				if (inGroup) {
// 					stencil.leaveGroup(username, leaveGroupName, function () {
// 						if (leaveGroupName == currentGroupName) {
// 							groupName = null
// 						} else {
// 							groupName = currentGroupName
// 						}
// 						sendPages(res, username, groupName, null, null, 
// 							'homepage/group/leaveOneGroup/LeaveGroupSuccessfully')
// 					})
// 				} else {
// 					sendPages(res, username, currentGroupName, null, null, 
// 						'homepage/group/leaveOneGroup/NotInGroup')
// 				}
// 			})
// 		}
// 	})
// })

// //Change current group
// app.post('/homepage/group/changeCurrentGroup', function(req, res){
// 	var currentGroupName = req.body.currentGroupName
// 	var username = req.body.username
// 	var selected_groupName = req.body.selected_groupName
// 	if (selected_groupName == currentGroupName) {
// 		sendPages(res, username, currentGroupName, null, null, 
// 				'homepage/group/changeCurrentGroup/NoNeedToChange')
// 	} else {
// 		sendPages(res, username, selected_groupName, null, null, 
// 				'homepage/group/changeCurrentGroup/ChangeGroupSuccessfully')
// 	}
// })


var httpServer = http.createServer(app)
//var httpsServer = https.createServer(credentials, app)

httpServer.listen(httpListeningPort)
//httpsServer.listen(httpsListeningPort)

console.log('App is listening at port %d and %d', httpListeningPort, httpsListeningPort)
