/*
	Master coordinator is responsible for maintaining two Torrent clients for 
	all other bots. One for downloading and another one for uploading. 

	Master coordinator is also responsible for creating response bots initially. 
	It can also create sync bots and moderator bots on request by 
	response bots. Finally, Master coordinator can also create a new bot 
	once the previous one is dead because of some reasons.

*/

var cluster = require('cluster')
var stencil = require('WebStencil')
var util = require('./util')

const numResponseHandlers = 1

var responseHandlers = []
var moderatorBots = []
var syncBots = []

function startModeratorBot(arguments) {
	cluster.setupMaster({
		exec: 'moderator_bot.js',
		args: [ arguments.view, arguments.userID, arguments.groupName, arguments.filterKeyWords ],
		silent: true
	})
	var bot = cluster.fork()

	var moderatorBot = {}
	moderatorBot.pid = bot.process.pid
	moderatorBot.args = arguments
	moderatorBots.push(moderatorBot)
}

function startSyncBot(arguments) {
	cluster.setupMaster({
		exec: 'sync_bot.js',
		args: [ arguments.userID, arguments.groupName, arguments.view ],
		silent: true
	})
	var bot = cluster.fork()

	var syncBot = {}
	syncBot.pid = bot.process.pid
	syncBot.args = arguments
	syncBots.push(syncBot)
}

function upload(message, worker) {
	var groupName = message.groupName
	var userID = message.userID
	var posts = message.posts
	var view = message.view
	var uploadType = message.uploadType

	util.createOrUpdatePosts(groupName, userID, posts, uploadType, view, seedClient, function(err) {
		var response = {}
		response.type = 'Upload Succeeded'
		response.err = err
		response.id = message.id

		cluster.workers[worker.id].send(response)
	})
}

function download(message, worker) {
	var groupName = message.groupName
	var userID = message.userID
	var view = message.view

	util.downloadPosts(groupName, userID, view, downloadClient, function(posts) {
		var response = {}
		response.type = 'Download Succeeded'
		response.posts = posts
		response.id = message.id

		cluster.workers[worker.id].send(response)
	})
}

function messageHandlerInMaster(message, worker) {
	if (message == undefined || message == null) {
		console.log('Meaningless message: ' + message)
	} else if (message.type == 'createModeratorBot') {
		startModeratorBot(message)
	} else if (message.type == 'createSyncBot') {
		startSyncBot(message)
	} else if (message.type == 'upload') {
		upload(message, worker)
	} else if (message.type == 'download') {
		download(message, worker)
	} else {
		console.log(message)
	}
}

function startResponseHandler() {
	cluster.setupMaster({
		exec: 'response_handler.js'
	})
	var bot = cluster.fork()

	responseHandlers.push(bot.process.pid)
}

function restartWorker(workerPid) {
	var find = false

	for (var i in responseHandlers) {
		if (responseHandlers[i] == workerPid) {
			find = true
			console.log(JSON.stringify(responseHandlers[i]))
			responseHandlers.splice(i, 1)
			startResponseHandler()
			break
		}
	}

	if (!find) {
		for (var i in syncBots) {
			if (syncBots[i].pid == workerPid) {
				find = true
				console.log(JSON.stringify(syncBots[i]))
				startSyncBot(syncBots[i].args)
				syncBots.splice(i, 1)
				break
			}
		}
	}

	if (!find) {
		for (var i in moderatorBots) {
			if (moderatorBots[i].pid == workerPid) {
				find = true
				console.log(JSON.stringify(moderatorBots[i]))
				startModeratorBot(moderatorBots[i].args)
				moderatorBots.splice(i, 1)
				break
			}
		}
	}
}

var torrentClients = stencil.initStencil(2)

var seedClient = torrentClients[0]
var downloadClient = torrentClients[1]

for (var i = 0; i < numResponseHandlers; i++) {
    startResponseHandler()
}

cluster.on('message', function(worker, message){
	messageHandlerInMaster(message, worker)
})

cluster.on('exit', function (worker, code, signal) {
	console.log('worker %d died (%s). restarting...', worker.process.pid, signal || code)
	restartWorker(worker.process.pid)
})
