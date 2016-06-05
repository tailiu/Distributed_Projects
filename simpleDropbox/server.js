var http = require('http')
var url = require('url')
var querystring = require('querystring')
var kad = require('kad')
var childProcess = require('child-proc')
var fs = require('fs')
var crypto = require('crypto')
var request = require('request')
var deasync = require('deasync')
var WebTorrent = require('webtorrent')
var os = require('os')
var stencil = require('./stencil')

const listeningPort = 8000

var done = false
var traverseResult = []

var header = {
            'statusCode': 200, 
            'statusMessage': 'OK',
            'contentType': 'text/html',
            }

var joinedGroupsDir = 'joined_groups'

function handleError(error) {
	console.log(error)
	process.exit(0)
}

function getLocalIpAddr() {
  var networkInterfaces = os.networkInterfaces( )
  return networkInterfaces.eth0[0].address
}

function getFilemetaDir(username, groupName) {
  return username + '/' + joinedGroupsDir + '/' + groupName
}

function getFilemetaPath(filemetaDir, fileName) {
  return filemetaDir + '/' + fileName
}

//check whether this name belongs to dir or file
function dirOrFile(username, groupName, fileName) {
	var filemeta = JSON.parse(stencil.getFilemeta(fileName, groupName, username))
	if (filemeta.content.type == 'dir') {
		return 'dir'
	} else {
		return 'file'
	}
}

//check whether file in the dir
function checkFileInDir(username, groupName, dir, fileName) {
	var dirMeta = JSON.parse(stencil.getFilemeta(dir, groupName, username))
	var n = dirMeta.content.files.length
	for (var i = 0; i < n; i++) {
		if(dirMeta.content.files[i] == fileName) {
			return true
		}
	}
	return false
}

function login(req, res) {
	var response = {}
	stencil.getUserInfo(req.username, function (value){
		if (value == undefined || value == null) {
			response.resType = 'User Not Existed'
			response.content = null
			res.write(JSON.stringify(response))
			res.end()
			return
		} else {
			var usermeta = JSON.parse(value)
			usermeta.ipAddr = getLocalIpAddr()
			console.log(getLocalIpAddr())
			stencil.updateUserInfo(req.username, usermeta, function() {
				response.resType = 'successful'
				res.write(JSON.stringify(response))
				res.end()
			})
		}
	})
}

function register(req, res) {
	var partMeta = JSON.parse(req.usermeta)
	var username = partMeta.username
	var response = {}
	stencil.createUser(username, partMeta.realName, partMeta.email, partMeta.password, function() {
		response.resType = 'successful'
		response.content = 'register successfully'
		res.write(JSON.stringify(response))
		res.end()
	})
}

function createGroup(req, res) {
	var partGroupmeta = JSON.parse(req.groupmeta)
	var groupName = partGroupmeta.groupName
	var username = req.username
	var response = {}
	stencil.createGroup(username, groupName, partGroupmeta.description, partGroupmeta.location, function() {
		response.resType = 'successful'
        response.content = 'create group ' + groupName + ' successfully'
        res.write(JSON.stringify(response))
        res.end()
	})
}

function joinGroupFromLocalClient(req, res) {
	var username = req.username
	var groupName = req.groupName
	var pk = req.pk
	var response = {}
	stencil.getGroupInfo(groupName, function(value) {
		if (value == undefined) {
			response.resType = 'No Such Group'
			response.content = 'Sorry, there is no such group'
			res.write(JSON.stringify(response))
			res.end()
			return
		}
		var groupmeta = JSON.parse(value)
		var location = groupmeta.location
		for (var i = 0; i < groupmeta.groupMems.length; i++) {
		    if (groupmeta.groupMems[i].username == username ) {
		    	response.resType = 'Already In the group'
				response.content = 'You have already been in the group'
				res.write(JSON.stringify(response))
				res.end()
				return
		    }
		}
		stencil.joinGroupReq(username, groupName, pk, location, function (result) {
			if (result == 'Accept') {
				response.resType = 'successful'
				response.content = 'join group ' + groupName + ' successfully'
				res.write(JSON.stringify(response))
				res.end()
			} else {
				response.resType = 'failed'
		        response.content = 'fail to join ' + groupName
		        res.write(JSON.stringify(response))
		        res.end()
		    }
		})
	})
}

function joinGroupFromRemoteClient(req, res) {
	var username = req.username
	var groupName = req.groupName
	var pk = req.pk
	var requestHashedHost = req.requestHashedHost
	var response = {}
	stencil.joinGroupRes(username, groupName, pk, requestHashedHost, function (knownHostsKey, requestHashedHost) {
		response.resType = 'Accept'
		response.knownHostsKey = knownHostsKey
		response.requestHashedHost = requestHashedHost
		response.content = 'join group ' + groupName + ' successfully'
		res.write(JSON.stringify(response))
		res.end()
	})
}

function getMyGroups(req, res) {
	var username = req.username
	var response = {}
	stencil.getUserInfo(username, function(value) {
		var usermeta = JSON.parse(value)
		response.resType = 'Groups'
		response.groups = usermeta.group
		res.write(JSON.stringify(response))
		res.end()
	})
}


function handleSyncFileMeta(req, res) {
	var groupName = req.groupName
	var repoAddr = req.repoAddr
	var username = req.username
	var response = {}
	stencil.handleSyncFileMeta(groupName, repoAddr, username, function(){
		response.resType = 'Sync Completed'
		res.write(JSON.stringify(response))
		res.end()
	})
}

function uploadFile(req, res) {
	var fileName = req.fileName
	var groupName = req.groupName
	var username = req.username
	var filePath = req.filePath
	var dir = req.dir
	var response = {}
	stencil.createFile(username, 'file', filePath, groupName, fileName, '', function(){
		stencil.updateFile(username, groupName, dir, fileName, 'dir', function(){
			stencil.syncFileMeta(groupName, username, function(){
				response.resType = 'Upload Successfully'
				response.content = 'Upload file ' + fileName + ' to group ' + groupName + ' successfully'
				res.write(JSON.stringify(response))
				res.end()
			})
		})
	})
}

function makeDir(req, res) {
	var username = req.username
	var groupName = req.groupName
	var dirName = req.dirName
	var dir = req.dir
	var response = {}
	stencil.createFile(username, 'dir', '', groupName, dirName, dir, function(){
		stencil.updateFile(username, groupName, dir, dirName, 'dir', function(){
			stencil.syncFileMeta(groupName, username, function(){
				response.resType = 'Make Dir Successfully'
				response.content = 'Make dir ' + dirName + ' successfully'
				res.write(JSON.stringify(response))
				res.end()
			})
		})

	})
}

function downloadFile(req, res) {
	var fileName = req.fileName
	var groupName = req.groupName
	var username = req.username
	var dir = req.dir
	var response = {}
	if (!checkFileInDir(username, groupName, dir, fileName)) {
	    response.type = 'Fail'
	    response.content = 'Failed to download ' + fileName
	    res.write(JSON.stringify(response))
	    res.end()
	    return
	} 
	stencil.getFile(fileName, groupName, username, function(){
		response.resType = 'Download Successfully'
	    response.content = 'Download file ' + fileName + ' successfully'
	    res.write(JSON.stringify(response))
	    res.end()
	})
}

function checkWhetherInGroup(req, res) {
	var username = req.username
	var groupName = req.groupName
	var response = {}
	stencil.getUserInfo(username, function(value) {
		var usermeta = JSON.parse(value)
		var found = false
		for (var i = 0; i < usermeta.group.length; i++) {
			if (usermeta.group[i].groupName == groupName) {
				found = true
			}
		}
		if (found) {
			response.resType = 'Found'
			res.write(JSON.stringify(response))
			res.end()
		} else {
			response.resType = 'Not Found'
			res.write(JSON.stringify(response))
			res.end()
		}
	})
}

function list(req, res) {
	var groupName = req.groupName
	var username = req.username
	var dir = req.dir
	var response = {}
	var dirMeta = JSON.parse(stencil.getFilemeta(dir, groupName, username))
	response.content = []
	var n = dirMeta.content.files.length
	for(var i = 0; i < n; i++) {
		response.content[i] = {}
		var filemetaDir = getFilemetaDir(username, groupName)
		var filemetaPath = getFilemetaPath(filemetaDir, dirMeta.content.files[i])
		var filemeta = JSON.parse(fs.readFileSync(filemetaPath, 'utf8'))
		response.content[i].type = filemeta.content.type
		response.content[i].name = dirMeta.content.files[i]
	}
	response.resType = 'Return List'
	res.write(JSON.stringify(response))
	res.end()
}

function getParentDir(req, res) {
	var username = req.username
	var groupName = req.groupName
	var dir = req.dir
	var dirMeta = JSON.parse(stencil.getFilemeta(dir, groupName, username))
	var response = {}
	response.resType = 'Return Parent Dir'
	response.content = dirMeta.content.parentDir
	res.write(JSON.stringify(response))
	res.end()
}

function process(fileName, filemeta, type) {
	var n = traverseResult.length
	traverseResult[n] = {}
	if (type == 'file') {
		traverseResult[n].name = fileName
		traverseResult[n].type = type
		traverseResult[n].seeds = filemeta.content.seeds
	} else {
		traverseResult[n].name = fileName
		traverseResult[n].type = type
		traverseResult[n].files = filemeta.content.files
	}
}

function traverse(dirMeta, groupName, username, func) {
	var files = dirMeta.content.files
    for (var i in files) {
        var filemeta = JSON.parse(stencil.getFilemeta(files[i], groupName, username))
        var type = filemeta.content.type
        func.apply(this, [files[i], filemeta, type])
        if (type == 'dir') {
            traverse(filemeta, groupName, username, func)
        }
    }
}

function getSeedList(req, res) {
	var groupName = req.groupName
	var username = req.username
	var fileName = req.fileName
	var dir = req.dir
	var response = {}
	// if (!checkFileInDir(username, groupName, dir, fileName)) {
	// 	response.resType = 'Get Seed List Failed'
	// 	response.content = 'No such file'
	// 	res.write(JSON.stringify(response))
	// 	res.end()
	// 	return
	// } 
	var type = dirOrFile(username, groupName, fileName) 
	if (type == 'file') {
		var filemeta = JSON.parse(stencil.getFilemeta(fileName, groupName, username))
		response.resType = 'Get Seed List of File Successfully'
		response.content = filemeta.content.seeds
	} else {
		var dirMeta = JSON.parse(stencil.getFilemeta(fileName, groupName, username))
		process(fileName, dirMeta, 'dir')
		traverse(dirMeta, groupName, username, process);
		response.content = traverseResult
		traverseResult = []
		response.resType = 'Get Seed List of Dir Successfully'
	}
	res.write(JSON.stringify(response))
	res.end()
}

function handleReqGenRes(req, res) {
	var resType
	var reqType = req.type
	res.statusMessage = header.statusMessage
	res.writeHead(header.statusCode, header.contentType)
	if (reqType == 'login') {
		login(req, res)
	} else if (reqType == 'create group') {
		createGroup(req, res)
	} else if (reqType == 'register') {
		register(req, res)
	} else if (reqType == 'my groups') {
		getMyGroups(req, res)
	} else if (reqType == 'join group from local client') {
		joinGroupFromLocalClient(req, res)
	} else if (reqType == 'join group from remote client') {
		joinGroupFromRemoteClient(req, res)
	} else if (reqType == 'upload file') {
		uploadFile(req, res)
	} else if (reqType == 'download file') {
		downloadFile(req, res)
	} else if (reqType == 'sync file meta') {
		handleSyncFileMeta(req, res)
	} else if (reqType == 'get seed list') {
		getSeedList(req, res)
	} else if (reqType == 'check whether in group') {
		checkWhetherInGroup(req, res)
	} else if (reqType == 'list') {
		list(req, res)
	} else if (reqType == 'make dir') {
		makeDir(req, res)
	} else if (reqType == 'get parent dir') {
		getParentDir(req, res)
	}
}

var server = http.createServer(function (req, res) {
	console.log('OK')
	var request = ''
	req.on('data',function(chunk){  
		request += chunk
	})
	req.on('end',function(){
		request = querystring.parse(request)
		handleReqGenRes(request, res)
	})
}).listen(listeningPort)

