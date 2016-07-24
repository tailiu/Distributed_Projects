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
var fs = require('fs')

const slackEmailDomain = 'stencil.slack@gmail.com'

const listeningPort = 3000

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

//Deal with select group
app.post('/selectGroup', function(req, res) {
    var username = req.body.username
    var groupName = req.body.groupName
    sendPages(res, username, groupName, null, null, 'homepage/tags', null)
})

//User logout
app.get('/homepage/logout', function(req, res) {
	var username = req.query.username
	res.end("<html> <header> BYE " + username + "! </header> </html>")
})

//Send a dynamic page back
function sendPages(res, data, type) {
	var homepageTeam = '/homepage/team/'
	var homepageChannels = '/homepage/channels/'
	if (type.indexOf(homepageChannels) != -1 ) {
		stencil.getUserInfo(data.email, function(usermeta){
			var displayedChannels = []
			for (var i in usermeta.groups) {
				if (usermeta.groups[i].status == 'in') {
					var done = false
					var groupName = usermeta.groups[i].groupName
					var channelMeta = {}
					stencil.getGroupInfo(groupName, function(groupMeta) {
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
			res.render('homepage', { username: JSON.stringify(data.username), email: JSON.stringify(data.email), 
							readableTeamName: JSON.stringify(data.readableTeamName), flatTeamName: JSON.stringify(data.flatTeamName),
							channels: JSON.stringify(displayedChannels), page: JSON.stringify(type),
							msgs: JSON.stringify(data.msgs), chosenChannel: JSON.stringify(data.flatCName)
			})
		})
	} else if (type.indexOf(homepageTeam) != -1) {
		res.render('homepage', { username: JSON.stringify(data.username), email: JSON.stringify(data.email), 
							readableTeamName: JSON.stringify(data.readableTeamName), flatTeamName: JSON.stringify(data.flatTeamName),
							channels: JSON.stringify([]), page: JSON.stringify(type), msgs: JSON.stringify([]),
							chosenChannel: JSON.stringify('null')
		})
	} else if (type == 'joinTeam') {
		res.render('joinTeam', { flatTeamName: JSON.stringify(data.flatTeamName), invitationID: JSON.stringify(data.invitationID),
								 inviterEmail: JSON.stringify(data.inviterEmail)
		})
	}
}

app.get('/renderChannel', function(req, res) {
	var email = req.query.email
	var username = req.query.username
	var readableTeamName = req.query.readableTeamName
	var flatTeamName = req.query.flatTeamName 

	var flatCName = req.query.flatCName

	var data = {}
	data.email = email
	data.username = username
	data.readableTeamName = readableTeamName
	data.flatTeamName = flatTeamName
	data.flatCName = flatCName

	stencil.getFile(userMsgLogs, flatCName, email, function(value) {
		data.msgs = value

		sendPages(res, data, '/homepage/channels/renderChannel')
	})

})

function checkUpdateNewMsgCheckMeta(email, flatTeamName, chosenChannel, callback) {
	var fileName = getUniqueLabelFromCNameOrTName(chosenChannel) + ':' + userMsgLogs

    var newMsgNotificationsFilePath = email + '/' + newMsgNotificationsFile

    stencil.getFromFileDHT(fileName, function(value){

    	stencil.getFile(newMsgNotificationsFilePath, flatTeamName, email, function(fileContent){

    		var updated = false

    		for (var i in fileContent) {
    			if (fileContent[i].fileName == fileName) {
    				if (value != fileContent[i].value) {

    					stencil.syncFile(email, flatTeamName, function() {

								updated = true
								callback(updated)

    					})

						break

    				} else {
    					callback(updated)
    				}
    			} 

    		}
    	})

    })

}

app.post('/refreshChannelMsgs', function(req, res) {
    var email = req.body.email
    var flatTeamName = req.body.flatTeamName
    var chosenChannel = req.body.chosenChannel

    var data = {}

	checkUpdateNewMsgCheckMeta(email, flatTeamName, chosenChannel, function(updated) {

		data.updated = updated

		if (updated) {
			stencil.syncFile(email, chosenChannel, function() {

				stencil.getFile(userMsgLogs, chosenChannel, email, function(msgs) {

	    			data.msgs = msgs

					var result = '<html>' + JSON.stringify(data) + '</html>'
					res.end(result)
					
				})

			})
		} else {

			var result = '<html>' + JSON.stringify(data) + '</html>'
			res.end(result)
		}
		
	})    

})

function updateMsg(email, flatTeamName, flatCName, message, callback) {

	stencil.getFile(userMsgLogs, flatCName, email, function(msgs) {

		var newMsg = {}
		newMsg.msg = message
		newMsg.creator = email
		newMsg.ts = new Date()

		msgs.push(newMsg)

		stencil.createOrUpdateFile(email, userMsgLogs, flatCName, msgs, 'update', function(retry) {

			if (!retry) {
				console.log(retry + '**********************************************')
				createOrUpdateNewMsgCheckMeta(email, userMsgLogs, flatCName, flatTeamName, function() {

					callback(msgs)

				})

			} else {
				console.log(retry + '***************')
				updateMsg(email, flatTeamName, flatCName, message, callback)

			}

		})
	})
}

app.post('/userMsg', function(req, res) {
	var email = req.body.email
	var username = req.body.username
	var readableTeamName = req.body.readableTeamName
	var flatTeamName = req.body.flatTeamName 
	var flatCName = req.body.flatCName
	var message = req.body.message

	var data = {}
	data.email = email
	data.username = username
	data.readableTeamName = readableTeamName
	data.flatTeamName = flatTeamName
	data.flatCName = flatCName

	updateMsg(email, flatTeamName, flatCName, message, function(msgs) {

		data.msgs = msgs
		sendPages(res, data, '/homepage/channels/renderChannel')

	})
	
	
})

app.post('/getChannels', function(req, res) {
	var data = {}
	data.username = req.body.username
	data.email = req.body.email
	data.flatTeamName = req.body.flatTeamName
	data.readableTeamName = req.body.readableTeamName

	sendPages(res, data, '/homepage/channels/getChannels')
})

//Create a team
app.post('/createTeam', function(req, res) {
	var email = req.body.email

	var done = false

	var teamMeta = {}
	teamMeta.username = req.body.username
	teamMeta.password = req.body.password
	teamMeta.description = req.body.description
	teamMeta.groupType = req.body.groupType
	teamMeta.serverAddr = req.body.serverAddr
	teamMeta.type = 't'
	teamMeta.name = req.body.teamName
	teamMeta.email = email

	stencil.getUserInfo(email, function(usermeta) {
		if (usermeta == undefined) {
			var key = new NodeRSA({b:2048})
			var publicKey = key.exportKey('pkcs1-public-pem')
			var privateKey = key.exportKey('pkcs1-pem')
			var ipAddr = getLocalIpAddr()
			stencil.createUser(email, ipAddr, publicKey, function(){
				done = true
			})
		} else {
			var publicKey = usermeta.publicKey
			done = true
		}
		deasync.loopWhile(function(){return !done})
		var hash = crypto.createHash('sha256')
		hash.update(stencilPublicKey)
		var hashedStencilPublicKey = hash.digest('hex')
		var hash = crypto.createHash('sha256')
		hash.update(slackPublicKey)
		var hashedSlackPublicKey = hash.digest('hex')
		var label = createRandom()
		teamMeta.groupName = hashedStencilPublicKey + ':' + hashedSlackPublicKey + ':' + label
		teamMeta.teamName = teamMeta.groupName

		stencil.createGroup(teamMeta, function () {

			var channelMeta = {}
			label = createRandom()
			channelMeta.email = email
			channelMeta.username = req.body.username
			channelMeta.password = req.body.password
			channelMeta.description = 'team wide communication and announcement'
			channelMeta.groupType = req.body.groupType
			channelMeta.teamName = teamMeta.groupName
			channelMeta.name = 'general'
			channelMeta.serverAddr = req.body.serverAddr
			channelMeta.type = 'c'
			channelMeta.groupName = hashedStencilPublicKey + ':' + hashedSlackPublicKey + ':' + label

			stencil.createGroup(channelMeta, function () {

				stencil.createOrUpdateFile(email, userMsgLogs, channelMeta.groupName, [], 'create', function() {

					createOrUpdateNewMsgCheckMeta(email, userMsgLogs, channelMeta.groupName, teamMeta.groupName, function() {

						var data = {}
						data.flatTeamName = teamMeta.groupName
						data.readableTeamName = teamMeta.name
						data.username = teamMeta.username
						data.email = teamMeta.email

						sendPages(res, data, '/homepage/channels/getChannels')
					})

				})
				
			})
		})
	})
})

function getUniqueLabelFromCNameOrTName(name) {
	return name.split(':')[2]
}

function createOrUpdateNewMsgCheckMeta(email, fileName, channelName, teamName, callback) {
	var newMsgNotificationsFilePath = email + '/' + newMsgNotificationsFile

	stencil.getFile(newMsgNotificationsFilePath, teamName, email, function(notifyMeta) {

		var CLabel = getUniqueLabelFromCNameOrTName(channelName)
		var key = CLabel + ':' + fileName
		var randomValue = createRandom()

		var option
		if (notifyMeta == undefined) {
			option = 'create'

			notifyMeta = {}
			notifyMeta = []
			notifyMeta[0] = {}
			notifyMeta[0].fileName = key
			notifyMeta[0].value = randomValue

		} else {
			option = 'update'

			var find = false
			for (var i in notifyMeta) {
				if (notifyMeta[i].fileName == key) {
					notifyMeta[i].value = randomValue
					find = true
				}
			}

			if (!find) {
				var len = notifyMeta.length
				notifyMeta[len] = {}
				notifyMeta[len].fileName = key
				notifyMeta[len].value = randomValue
			}
			
		}

		stencil.syncFile(email, teamName, function() {
			
			stencil.createOrUpdateFile(email, newMsgNotificationsFilePath, teamName, notifyMeta, option, function(){

				stencil.putOnFileDHT(key, randomValue, function() {
					callback()
				})

			})
		})
		
	})

}

app.post('/invite', function(req, res) {
	var inviterEmail = req.body.inviterEmail
	var flatTeamName = req.body.flatTeamName
	var inviteeEmail = req.body.inviteeEmail
	var readableTeamName = req.body.readableTeamName
	var username = req.body.username

	var alreadyInGroup = false

	var data = {}
	data.flatTeamName = flatTeamName
	data.readableTeamName = readableTeamName
	data.username = username
	data.email = inviterEmail

	stencil.getUserInfo(inviteeEmail, function(usermeta) {
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
			var subject = inviterEmail + ' invited you to ' + readableTeamName + ' on Stencil Slack'
			var invitationID = createRandom()
			var url = 'http://localhost:' + listeningPort + '/acceptInvitation?team=' + flatTeamName
			url += '&&invitationID=' +  invitationID + '&&inviterEmail=' + inviterEmail
			var body = '<p>' + inviterEmail + ' uses Stencil Slack, a P2P messaging app using Stencil Storage API'
			body += ' for teams, and has invited you to join the team ' + readableTeamName + '</p><br><br>'
			body += '<a href="'+ url +'"><b><i>Join Team</b></i></a>'

			// setup e-mail data with unicode symbols
			var mailOptions = {
			    from: '"Stencil Slack" <stencil.slack@gmail.com>', 	// sender address
			    to: inviteeEmail, 									// list of receivers
			    subject: subject, 									// Subject line
			    html: body 											// html body
			}

			var filemetaPath = inviterEmail + '/' + invitationHistoryFile

			var filemeta = stencil.getFilemeta(filemetaPath, flatTeamName, inviterEmail)

			var content = []
			content[0] = {}
			content[0].inviterEmail = inviterEmail
			content[0].inviteeEmail = inviteeEmail
			content[0].ts = new Date()
			content[0].status = 'pending'
			content[0].invitationID = invitationID

			if (filemeta == undefined) {
				stencil.createOrUpdateFile(inviterEmail, filemetaPath, flatTeamName, content, 'create', function() {
					sendEmail(mailOptions, function () {
						sendPages(res, data, '/homepage/team/invite/sentEmail')
					})
				})
			} else {
				stencil.updateFile()
			}
		}
	})
})

app.get('/acceptInvitation', function(req, res) {
	var flatTeamName = req.query.team
	var invitationID = req.query.invitationID
	var inviterEmail = req.query.inviterEmail
	var dataCompleted = req.query.dataCompleted

	var data = {}

	if (dataCompleted == undefined) {

		data.flatTeamName = flatTeamName
		data.invitationID = invitationID
		data.inviterEmail = inviterEmail
		sendPages(res, data, 'joinTeam')

	} else {

		var username = req.query.username
		var password = req.query.password

		stencil.getGroupInfo(flatTeamName, function(groupMeta) {

			var groupMems = groupMeta.groupMems
			var moderatorEmail
			for (var i in groupMems) {
				var roles = groupMems[i].role
				if (_.indexOf(roles, 'creator') != -1 || _.indexOf(roles, 'moderator') != -1) {
					moderatorEmail = groupMems[i].email
					break
				}
			}

			data.readableTeamName = groupMeta.content.name

			stencil.getUserInfo(moderatorEmail, function(usermeta) {
				var moderatorAddr = usermeta.location
				joinTeamReq(inviterEmail, username, flatTeamName, moderatorEmail, moderatorAddr, invitationID, function (email) {

					data.flatTeamName = flatTeamName 
					data.username = username
					data.email = email
					sendPages(res, data, '/homepage/channels/getChannels')

				})
			})

		})
	}
})

//send join group request
function joinTeamReq(inviterEmail, username, teamName, moderatorEmail, moderatorAddr, invitationID, callback) {
	var addr = 'http://' + moderatorAddr + ':' + listeningPort + '/joinTeamRes'

	if (!fs.existsSync(SSHKeysDir) || !fs.existsSync(SSHPkFilePath)) {
		console.log('Please use command \'ssh-keygen -t rsa -C "your_email@example.com"\' to generate ssh key pairs')
	}

	var SSHPublicKey = fs.readFileSync(SSHPkFilePath)

	var data = {
				username: username,
				SSHPublicKey: SSHPublicKey,
				teamName: teamName,
				invitationID: invitationID,
				moderatorEmail: moderatorEmail,
				inviterEmail: inviterEmail
	}

	request.post(addr, {form: data}, function (error, reply, body) {
		if (!error && reply.statusCode == 200) {
			var res = JSON.parse(body)
			if (res.type == 'Accept') {

				var generalChannel = res.generalChannel
				var knownHostsKey = res.knownHostsKey
				var serverPath = res.serverPath 
				var inviteeEmail = res.inviteeEmail

				var moderatorAddr = serverPath.split('@')[1]
				checkAndAddKnownHostKey(moderatorAddr, knownHostsKey)

				stencil.getUserInfo(inviteeEmail, function(usermeta) {
					var done = false
					if (usermeta == undefined) {
						var key = new NodeRSA({b:2048})
						var publicKey = key.exportKey('pkcs1-public-pem')
						var privateKey = key.exportKey('pkcs1-pem')
						var ipAddr = getLocalIpAddr()
						stencil.createUser(inviteeEmail, ipAddr, publicKey, function(newUsermeta){
							usermeta = newUsermeta
							done = true
						})
					} else {
						done = true
					}
					deasync.loopWhile(function(){return !done})

					var team = {}
					team.groupName = teamName
					team.status = 'in'
					stencil.updateUserInfo(inviteeEmail, usermeta, team, 'add group', function() {

						var gChannel = {}
						gChannel.groupName = generalChannel
						gChannel.status = 'in'
						stencil.updateUserInfo(inviteeEmail, usermeta, gChannel, 'add group', function() {
							
							stencil.cloneGroupRepo(inviteeEmail, serverPath, teamName, function() {

								stencil.cloneGroupRepo(inviteeEmail, serverPath, generalChannel, function() {

									createOrUpdateNewMsgCheckMeta(inviteeEmail, userMsgLogs, generalChannel, teamName, function() {

										callback(inviteeEmail)

									})
									
								})

							})

						})

					})

				})
				
				
			}
		}
	})
}

app.post('/joinTeamRes', function(req, res) {
	var username = req.body.username
	var SSHPublicKey = req.body.SSHPublicKey
	var teamName = req.body.teamName
	var invitationID = req.body.invitationID
	var moderatorEmail = req.body.moderatorEmail
	var inviterEmail = req.body.inviterEmail

	var filemetaPath = inviterEmail + '/' + invitationHistoryFile
	stencil.getFile(filemetaPath, teamName, moderatorEmail, function(fileContent) {

		var found = false
		for (var i in fileContent) {
			if (fileContent[i].invitationID == invitationID && fileContent[i].status == 'pending') {
				var inviteeEmail = fileContent[i].inviteeEmail
				fileContent[i].status = 'accepted'
				found = true
				break
			}
		}
		stencil.createOrUpdateFile(moderatorEmail, filemetaPath, teamName, fileContent, 'update', function() {

			var newMem = {}
			newMem.username = username
			newMem.email = inviteeEmail
			newMem.role = 'normal'
			stencil.updateGroupInfo(moderatorEmail, teamName, newMem, SSHPublicKey, 'add', function() {

				var generalChannelFlatName
				var find = false
				stencil.getUserInfo(moderatorEmail, function(usermeta){
					for (var i in usermeta.groups) {
						if (usermeta.groups[i].status == 'in') {
							var done = false
							var groupName = usermeta.groups[i].groupName
							stencil.getGroupInfo(groupName, function(groupMeta) {
								if (groupMeta.content.name == 'general' && groupMeta.content.teamName == teamName) {
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
					stencil.updateGroupInfo(moderatorEmail, generalChannelFlatName, newMem, SSHPublicKey, 'add', function(serverPath, knownHostsKey) {
						
						var response = {}
						response.type = 'Accept'
						response.generalChannel = generalChannelFlatName
						response.knownHostsKey = knownHostsKey
						response.serverPath = serverPath
						response.inviteeEmail = inviteeEmail
						res.write(JSON.stringify(response))
						res.end()

					})

				})

			})
		})
	})
})




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

//Create server listening on port 3000 at localhost
var server = app.listen(listeningPort, function () {
	console.log('App is listening at port %d', listeningPort)
})
