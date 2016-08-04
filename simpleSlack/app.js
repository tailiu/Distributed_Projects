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
var newMsgNotificationsFile = 'new_message_notifications'

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
		getUserInfo(hashedPublicKey, function(err, usermeta) {
			if (err != null) {
				res.end(err)
			} else {
				var displayedChannels = []
				for (var i in usermeta.groups) {
					if (usermeta.groups[i].status == 'in') {
						var done = false
						var groupName = usermeta.groups[i].groupName
						var channelMeta = {}

						var groupPublicKey = stencil.getFileInRepo(publicKeyFile, groupName, hashedPublicKey)

						getGroupInfo(groupName, groupPublicKey, function(err1, groupMeta) {
							if (err1 != null) {
								res.end(err1)
								done = true
							}
							if (groupMeta.content.type == 'c' && groupMeta.content.teamName == data.flatTeamName) {
								channelMeta.flatName = groupName
								channelMeta.readableName = groupMeta.content.name
								channelMeta.description = groupMeta.description
								displayedChannels.push(channelMeta)
							}
							done = true
						})
						deasync.loopWhile(function(){return !done})
					}
				}
				if (type.indexOf('renderChannel') == -1) {
					data.msgs = []
					data.flatCName = 'null'
				}
				res.render('homepage', { username: JSON.stringify(data.username), hashedPublicKey: JSON.stringify(hashedPublicKey), 
								readableTeamName: JSON.stringify(data.readableTeamName), flatTeamName: JSON.stringify(data.flatTeamName),
								channels: JSON.stringify(displayedChannels), page: JSON.stringify(type),
								msgs: JSON.stringify(data.msgs), chosenChannel: JSON.stringify(data.flatCName)
				})
			}
		})
	} else if (type.indexOf(homepageTeam) != -1) {
		res.render('homepage', { username: JSON.stringify(data.username), hashedPublicKey: JSON.stringify(hashedPublicKey), 
							readableTeamName: JSON.stringify(data.readableTeamName), flatTeamName: JSON.stringify(data.flatTeamName),
							channels: JSON.stringify([]), page: JSON.stringify(type), msgs: JSON.stringify([]),
							chosenChannel: JSON.stringify('null')
		})
	} else if (type == 'joinTeam') {
		res.render('joinTeam', { flatTeamName: JSON.stringify(data.flatTeamName), invitationID: JSON.stringify(data.invitationID),
								 inviteeEmail: JSON.stringify(data.inviteeEmail), inviterHashedPublicKey: JSON.stringify(data.inviterHashedPublicKey),
								 encodedGroupPublicKey: JSON.stringify(data.encodedGroupPublicKey)
		})
	}
}

app.post('/newChannel', function(req, res) {
    
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
	stencil.createUser(hashedPublicKey, privateKey, publicKey, function() {
		callback(publicKey, privateKey)
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

//Create a team
app.post('/createTeam', function(req, res) {
	var email = req.body.email

	var done = false
	var publicKey
	var privateKey

	var teamMeta = {}
	teamMeta.username = req.body.username
	teamMeta.password = req.body.password
	teamMeta.description = req.body.description
	teamMeta.groupType = req.body.groupType
	teamMeta.serverAddr = req.body.serverAddr
	teamMeta.type = 't'
	teamMeta.name = req.body.teamName

	//we need to map email to public key so that we know whether there is a userID this email
	//corresponds to exists or not. Right now this is just a temporary method 
	publicKey = getPublicKey(email)
	if (publicKey == undefined) {
		createUser(email, function(pubKey, priKey) {
			publicKey = pubKey
			privateKey = priKey
			done = true
		})
	} else {
		done = true
	}
	deasync.loopWhile(function(){return !done})

	var userID = calculateHash(publicKey)
	teamMeta.creatorPrivateKey = privateKey
	teamMeta.creatorPublicKey = publicKey

	var hashedStencilPublicKey = calculateHash(stencilPublicKey)
	var hashedSlackPublicKey = calculateHash(slackPublicKey)
	var label = createRandom()
	teamMeta.groupName = hashedStencilPublicKey + ':' + hashedSlackPublicKey + ':' + label
	teamMeta.teamName = teamMeta.groupName

	createPublicKeyPair(teamMeta.teamName)
	var teamPublicKey = getPublicKey(teamMeta.teamName)
	var teamPrivateKey = getPrivateKey(teamMeta.teamName)
	teamMeta.privateKey = teamPrivateKey

	stencil.createGroup(teamMeta, function (err) {
		if (err != null) {
			res.end(err)
		} else {
			stencil.createOrUpdateFileInRepo(userID, publicKeyFile, teamMeta.teamName, teamPublicKey, 'create', function() {

				var channelMeta = {}
				label = createRandom()
				channelMeta.creatorPublicKey = publicKey
				channelMeta.creatorPrivateKey = privateKey
				channelMeta.username = req.body.username
				channelMeta.password = req.body.password
				channelMeta.description = 'team wide communication and announcement'
				channelMeta.groupType = req.body.groupType
				channelMeta.teamName = teamMeta.groupName
				channelMeta.name = 'general'
				channelMeta.serverAddr = req.body.serverAddr
				channelMeta.type = 'c'
				channelMeta.groupName = hashedStencilPublicKey + ':' + hashedSlackPublicKey + ':' + label

				createPublicKeyPair(channelMeta.groupName)
				var channelPublicKey = getPublicKey(channelMeta.groupName)
				var channelPrivateKey = getPrivateKey(channelMeta.groupName)
				channelMeta.privateKey = channelPrivateKey

				stencil.createGroup(channelMeta, function (err) {
					if (err != null) {
						res.end(err)
					} else {
						stencil.createOrUpdateFileInRepo(userID, publicKeyFile, channelMeta.groupName, channelPublicKey, 'create', function() {

							stencil.createOrUpdateFileInTorrent(userID, userMsgLogs, channelMeta.groupName, [], 'create', function() {
								var data = {}
								data.flatTeamName = teamMeta.groupName
								data.readableTeamName = teamMeta.name
								data.username = teamMeta.username
								data.publicKey = publicKey

								sendPages(res, data, '/homepage/channels/getChannels')
							})
						})
					}
				})
				
			})
		}
	})
})

app.post('/invite', function(req, res) {
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
					if (usermeta.groups[i].groupName == flatTeamName) {
						alreadyInGroup = true
						break
					}
				}
			}
			if (alreadyInGroup) {
				sendPages(res, data, '/homepage/team/invite/alreadyInTeam')
			} else {
				var groupPublicKey = stencil.getFileInRepo(publicKeyFile, flatTeamName, hashedPublicKey)
				var encodedGroupPublicKey = encodeURIComponent(groupPublicKey)

				var subject = username + ' invited you to ' + readableTeamName + ' on Stencil Slack'
				var invitationID = createRandom()
				var url = 'http://localhost:' + httpListeningPort + '/acceptInvitation?team=' + flatTeamName
				url += '&&invitationID=' +  invitationID + '&&inviterHashedPublicKey=' + hashedPublicKey 
				url += '&&inviteeEmail=' + inviteeEmail + '&&encodedGroupPublicKey=' + encodedGroupPublicKey
				var body = '<p>' + username + ' uses Stencil Slack, a P2P messaging app using Stencil Storage API'
				body += ' for teams, and has invited you to join the team ' + readableTeamName + '</p><br><br>'
				body += '<a href="'+ url +'"><b><i>Join Team</b></i></a>'

				// setup e-mail data with unicode symbols
				var mailOptions = {
				    from: '"Stencil Slack" <stencil.slack@gmail.com>', 	// sender address
				    to: inviteeEmail, 									// list of receivers
				    subject: subject, 									// Subject line
				    html: body 											// html body
				}

				var filemetaPath = hashedPublicKey + '/' + invitationHistoryFile

				var filemeta = stencil.getFileInRepo(filemetaPath, flatTeamName, hashedPublicKey)

				var content = []
				content[0] = {}
				content[0].hashedPublicKey = hashedPublicKey
				content[0].inviteeEmail = inviteeEmail
				content[0].ts = new Date()
				content[0].status = 'pending'
				content[0].invitationID = invitationID

				if (filemeta == undefined) {
					stencil.createOrUpdateFileInTorrent(hashedPublicKey, filemetaPath, flatTeamName, content, 'create', function() {
						sendEmail(mailOptions, function () {
							sendPages(res, data, '/homepage/team/invite/sentEmail')
						})
					})
				} else {
					stencil.updateFile()
				}
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

function getGroupInfo(groupName, groupPublicKey, callback) {
	stencil.getGroupInfo(groupName, function(groupMeta) {
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

app.get('/acceptInvitation', function(req, res) {
	var flatTeamName = req.query.team
	var invitationID = req.query.invitationID
	var inviterHashedPublicKey = req.query.inviterHashedPublicKey
	var inviteeEmail = req.query.inviteeEmail
	var encodedGroupPublicKey = req.query.encodedGroupPublicKey
	var dataCompleted = req.query.dataCompleted

	var data = {}

	if (dataCompleted == undefined) {

		data.flatTeamName = flatTeamName
		data.invitationID = invitationID
		data.inviterHashedPublicKey = inviterHashedPublicKey
		data.inviteeEmail = inviteeEmail
		data.encodedGroupPublicKey = encodedGroupPublicKey

		sendPages(res, data, 'joinTeam')

	} else {

		var username = req.query.username
		var groupPublicKey = decodeURIComponent(encodedGroupPublicKey)

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

		getGroupInfo(flatTeamName, groupPublicKey, function(err, groupMeta) {
			if (err != null) {
				res.end(err)
			} else {
				//For now I only try to find one creator or moderator to allow the new user to join
				//But actually, it should be some or all moderators and creator
				var groupMems = groupMeta.groupMems
				var moderatorHashedPublicKey
				for (var i in groupMems) {
					var roles = groupMems[i].role
					if (_.indexOf(roles, 'creator') != -1 || _.indexOf(roles, 'moderator') != -1) {
						moderatorHashedPublicKey = groupMems[i].hashedPublicKey
						break
					}
				}

				data.readableTeamName = groupMeta.content.name

				getUserInfo(moderatorHashedPublicKey, function(err1, usermeta) {
					if (err1 != null) {
						res.end(err1)
					} else {
						//hardcode the address of the moderator for now, as we don't have mapping from userID to location
						var moderatorAddr = 'localhost'

						joinTeamReq(inviterHashedPublicKey, username, flatTeamName, moderatorHashedPublicKey, moderatorAddr, invitationID, hashedInviteePublicKey, inviteePrivateKey, function (err1) {
							if (err1 != null) {
								res.end(err1)
							} else {
								data.flatTeamName = flatTeamName 
								data.username = username
								data.hashedPublicKey = hashedInviteePublicKey
								sendPages(res, data, '/homepage/channels/getChannels')
							}
						})	
					}
					
				})
			}
		})
	}
})

//send join team request
function joinTeamReq(inviterhashedPublicKey, username, teamName, moderatorHashedPublicKey, moderatorAddr, invitationID, hashedInviteePublicKey, inviteePrivateKey, callback) {
	var url = 'http://' + moderatorAddr + ':' + httpListeningPort + '/joinTeamRes'

	if (!fs.existsSync(SSHKeysDir) || !fs.existsSync(SSHPkFilePath)) {
		console.log('Please use command \'ssh-keygen -t rsa -C "your_email@example.com"\' to generate ssh key pairs')
	}

	var SSHPublicKey = fs.readFileSync(SSHPkFilePath)

	var data = {
		username: username,
		SSHPublicKey: SSHPublicKey,
		teamName: teamName,
		invitationID: invitationID,
		moderatorHashedPublicKey: moderatorHashedPublicKey,
		inviterhashedPublicKey: inviterhashedPublicKey,
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

				var generalChannel = res.generalChannel
				var knownHostsKey = res.knownHostsKey
				var serverPath = res.serverPath

				var moderatorAddr = serverPath.split('@')[1]
				checkAndAddKnownHostKey(moderatorAddr, knownHostsKey)

				var team = {}
				team.groupName = teamName
				team.status = 'in'

				getUserInfo(hashedInviteePublicKey, function(err1, usermeta) {
					if (err1 != null) {
						callback(err1)
					} else {
						stencil.updateUserInfo(hashedInviteePublicKey, usermeta, team, 'add group', inviteePrivateKey, function() {

							var gChannel = {}
							gChannel.groupName = generalChannel
							gChannel.status = 'in'
							stencil.updateUserInfo(hashedInviteePublicKey, usermeta, gChannel, 'add group', inviteePrivateKey, function() {
								
								stencil.cloneGroupRepo(hashedInviteePublicKey, serverPath, teamName, function() {

									stencil.cloneGroupRepo(hashedInviteePublicKey, serverPath, generalChannel, function() {

										callback(null)
										
									})

								})

							})

						})
					}
				})
				
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

app.post('/joinTeamRes', function(req, res) {
	var username = req.body.username
	var SSHPublicKey = req.body.SSHPublicKey
	var teamName = req.body.teamName
	var invitationID = req.body.invitationID
	var moderatorHashedPublicKey = req.body.moderatorHashedPublicKey
	var inviterhashedPublicKey = req.body.inviterhashedPublicKey
	var hashedInviteePublicKey = req.body.hashedInviteePublicKey

	var filemetaPath = inviterhashedPublicKey + '/' + invitationHistoryFile
	stencil.getFileFromTorrent(filemetaPath, teamName, moderatorHashedPublicKey, function(fileContent) {

		var found = false
		for (var i in fileContent) {
			if (fileContent[i].invitationID == invitationID && fileContent[i].status == 'pending') {
				var inviteeEmail = fileContent[i].inviteeEmail
				fileContent[i].joinTeamTs = new Date()
				fileContent[i].hashedInviteePublicKey = hashedInviteePublicKey
				fileContent[i].status = 'accepted'
				found = true
				break
			}
		}
		if (found) {

			stencil.createOrUpdateFileInTorrent(moderatorHashedPublicKey, filemetaPath, teamName, fileContent, 'update', function() {

				var groupPublicKey = stencil.getFileInRepo(publicKeyFile, teamName, moderatorHashedPublicKey)

				getGroupInfo(teamName, groupPublicKey, function(err1, groupMeta) {
					if (err1 != null) {
						res.end(err1)
					} else {
						var changedContent = {}
						var newMem = {}
						newMem.username = username
						newMem.hashedPublicKey = hashedInviteePublicKey
						newMem.role = []
						newMem.role[0] = 'normal'
						changedContent.hashedPublicKey = hashedInviteePublicKey
						changedContent.SSHPublicKey = SSHPublicKey

						groupMeta.groupMems.push(newMem)
						delete groupMeta['signature']
						var privateKey = getPrivateKey(teamName)
						groupMeta.signature = getSignature(JSON.stringify(groupMeta), privateKey)

						stencil.updateGroupInfo(moderatorHashedPublicKey, teamName, changedContent, 'add user', groupMeta, function() {

							var generalChannelFlatName
							var generalChannelGroupMeta
							var find = false
							getUserInfo(moderatorHashedPublicKey, function(err, usermeta){
								if (err != null) {

									var response = {}
									response.type = err
									res.write(JSON.stringify(response))
									res.end()

								} else {
									for (var i in usermeta.groups) {
										if (usermeta.groups[i].status == 'in') {
											var done = false
											var groupName = usermeta.groups[i].groupName

											var groupPublicKey = stencil.getFileInRepo(publicKeyFile, groupName, moderatorHashedPublicKey)

											getGroupInfo(groupName, groupPublicKey, function(err2, groupMeta) {
												if (err2 != null) {
													done = true
													res.end(err2)
												}
												if (groupMeta.content.name == 'general' && groupMeta.content.teamName == teamName) {
													generalChannelGroupMeta = groupMeta
													generalChannelFlatName = groupName
													find = true
												}
												done = true
											})
											deasync.loopWhile(function(){return !done})
											if (find) {
												break
											}
										}
									}

									generalChannelGroupMeta.groupMems.push(newMem)
									delete generalChannelGroupMeta['signature']
									var privateKey = getPrivateKey(generalChannelFlatName)
									generalChannelGroupMeta.signature = getSignature(JSON.stringify(generalChannelGroupMeta), privateKey)

									stencil.updateGroupInfo(moderatorHashedPublicKey, generalChannelFlatName, changedContent, 'add user', generalChannelGroupMeta, function(serverPath, knownHostsKey) {
										
										var response = {}
										response.type = 'Accept'
										response.generalChannel = generalChannelFlatName
										response.knownHostsKey = knownHostsKey
										response.serverPath = serverPath
										res.write(JSON.stringify(response))
										res.end()

									})
								}

							})

						})
					}

				})

			})
		} else {

			var response = {}
			response.type = 'No Such Invitation'
			res.write(JSON.stringify(response))
			res.end()

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
