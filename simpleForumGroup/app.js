var express = require('express')
var querystring = require('querystring')
var bodyParser = require('body-parser')
var stencil = require('./stencil')
var deasync = require('deasync')
var app = express()
var childProcess = require('child-proc')
var os = require('os')

var REORDER = 0
var ORDER = 1
var createdGroupsDir = 'created_groups'
var groupPath = '/homepage/group'

app.set('views', './views/jade')
app.set('view engine', 'jade')
app.use(bodyParser.json())       	// to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
	extended: true
}))

function getAccount() {
	var account = childProcess.execSync('whoami')
	account = (account + '').replace(/(\r\n|\n|\r)/gm,"")
	return account
}

function sortPosts(posts, sort) {
	if (sort == REORDER || sort == null) {
		posts.sort(function (a, b) {
			c = new Date(a.lastUpadateTs)
			d = new Date(b.lastUpadateTs)
			return d-c;
		})
	} else {
		posts.sort(function (a, b) {
			c = new Date(a.lastUpadateTs)
			d = new Date(b.lastUpadateTs)
			return c-d;
		})
	}
	return posts
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

//Send a dynamic page back
function sendPages(res, username, groupName, sort, tag, type, additionalInfo) {
	if (groupName == null) {
		groupName = 'null'
	}
	if (additionalInfo == null) {
		additionalInfo = 'null'
	} else {
		additionalInfo = JSON.stringify(additionalInfo)
	}
	if (groupName == 'null') {
		stencil.getUserInfo(username, function (usermeta) {
			res.render('homepage', {name: username, posts: JSON.stringify([]), usermeta: usermeta,
					page: JSON.stringify({path: type}), groupName: groupName,
					additionalInfo: additionalInfo
		 	 	})
		})
	} else {
		if (type == 'selectGroup') {
			res.render('selectGroup', {name: username, groups: JSON.stringify(groupName)})
		} else {
			var posts = []
			if (type.indexOf(groupPath) == -1){
				var done = false
				var fileNames = stencil.getFileNamesInGroup(groupName, username)
				for (var i = 0; i < fileNames.length; i++) {
					stencil.getFile(fileNames[i], groupName, username, function(val){
						var value = JSON.parse(val)
						posts[i] = {}
						posts[i].name = fileNames[i]
						posts[i].content = value.content
						posts[i].lastUpadateTs = value.lastUpadateTs
						posts[i].tags = value.contentType
						posts[i].comments = value.comments
					})
				}
				if (tag != null) {
					posts = filterPosts(posts, tag)
				}
				posts = sortPosts(posts, sort)
			}
			stencil.getUserInfo(username, function (usermeta) {
				res.render('homepage', {name: username, posts: JSON.stringify(posts), usermeta: usermeta,
						page: JSON.stringify({path: type}), groupName: groupName,
						additionalInfo: additionalInfo
			 	})
			})
		}
	}
}

//User register
app.post('/register', function(req, res) {
	var username = req.body.username
	var realName = req.body.realName
	var email = req.body.email
	var password = req.body.password
	stencil.createUser(username, realName, email, password, function() {
		sendPages(res, username, null, null, null, 'homepage/group', null)
	})
});

//Initial page
app.post('/initial-page', function(req, res) {
    var username = req.body.username
    var password = req.body.password
    var op = req.body.login
    if (op == undefined) {
    	res.render('register')
    } else {
    	stencil.getUserInfo(username, function (usermeta) {
    		if (usermeta == undefined) {
    			res.end("<html> <header> " + username + " does not exist! </header> </html>")
    		} else {
    			var groupName
	    		var groups = JSON.parse(usermeta).groups
	    		if (groups.length > 0) {
	    			groupName = []
	    			for (var i = 0; i < groups.length; i++) {
	    				groupName[i] = groups[i].groupName
	    			}
	    			sendPages(res, username, groupName, null, null, 'selectGroup', null)
	    		} else {
	    			sendPages(res, username, null, null, null, 'homepage/group', null)
	    		}
    		}
		})
    }
});

//Deal with select group
app.post('/selectGroup', function(req, res) {
    var username = req.body.username
    var groupName = req.body.groupName
    console.log(groupName)
    sendPages(res, username, groupName, null, null, 'homepage/tags', null)
});

//Show all the posts
app.get('/homepage/all', function(req, res) {
	var username = req.query.username
	var groupName = req.query.groupName
	sendPages(res, username, groupName, REORDER, null, 'homepage/tags', null)
});

//Show all the posts with tage life
app.get('/homepage/life', function(req, res) {
	var username = req.query.username
	var groupName = req.query.groupName
	sendPages(res, username, groupName, REORDER, 'life', 'homepage/tags', null)
});

//Show all the posts with tag study
app.get('/homepage/study', function(req, res) {
	var username = req.query.username
	var groupName = req.query.groupName
	sendPages(res, username, groupName, REORDER, 'study', 'homepage/tags', null)
});

//Show all the posts with tag work
app.get('/homepage/work', function(req, res) {
	var username = req.query.username
	var groupName = req.query.groupName
	sendPages(res, username, groupName, REORDER, 'work', 'homepage/tags', null)
	
});

//User logout
app.get('/homepage/logout', function(req, res) {
	var username = req.query.username
	res.end("<html> <header> BYE " + username + "! </header> </html>")
});

//New post
app.post('/homepage/newPost', function(req, res) {
	var fileName = req.body.title
	var tag = req.body.tag
	var content = req.body.content
	var username = req.body.username
	var groupName = req.body.groupName
	stencil.createFile(username, fileName, groupName, content, tag, function (){
		sendPages(res, username, groupName, REORDER, null, 'homepage/tags', null)
	})
});

//Add a new comment to a post
app.post('/homepage/newComment', function(req, res) {
	var username = req.body.username
	var replyTo = req.body.replyTo
	var comment = req.body.comment
	var postName = req.body.postName
	var groupName = req.body.groupName
	stencil.updateFile(username, postName, groupName, replyTo, comment, function (){
		sendPages(res, username, groupName, REORDER, null, 'homepage/tags', null)
	})
});

//Create a group
app.post('/homepage/group/createOneGroup', function(req, res) {
	var username = req.body.username
	var groupName = req.body.groupName
	var description = req.body.description
	var type = req.body.type
	var currentGroupName = req.body.currentGroupName
	stencil.getGroupInfo(groupName, function (group){
		if (group != undefined) {
			sendPages(res, username, groupName, null, null, 
					'homepage/group/createOneGroup/AlreadyExisted')
		} else {
			var networkInterfaces = os.networkInterfaces( )
			var account = getAccount()
			var location = account + '@' + networkInterfaces.eth0[0].address + ':' 
							+ __dirname + '/' + username +'/'+ createdGroupsDir +'/' + groupName
			stencil.createGroup(username, groupName, description, type, location, function (){
				sendPages(res, username, currentGroupName, null, null, 
					'homepage/group/createOneGroup/createGroupSuccessful')
			})
		}
	})
})

app.post('/homepage/group/joinOneGroupRes', function(req, res) {
	var username = req.body.username
	var pk = req.body.pk
	var joinGroupName = req.body.groupName
	var requestHashedHost = req.body.requestHashedHost
	var response = {}
	stencil.joinGroupRes(username, joinGroupName, pk, requestHashedHost, function (knownHostsKey, requestHashedHost) {
		response.resType = 'Accept'
		response.knownHostsKey = knownHostsKey
		response.requestHashedHost = requestHashedHost
		res.write(JSON.stringify(response))
		res.end()
	})
})

//Join a group
app.post('/homepage/group/joinOneGroupReq', function(req, res) {
	var username = req.body.username
	var currentGroupName = req.body.currentGroupName
	var joinGroupName = req.body.joinGroupName
	var joinGroup = true
	stencil.getGroupInfo(joinGroupName, function (value) {
		if (value == undefined) {
			sendPages(res, username, currentGroupName, null, null, 
					'homepage/group/joinOneGroup/GroupNotExisted')
		} else {
			stencil.getUserInfo(username, function (usermeta) {
				var groups = JSON.parse(usermeta).groups
				for (var i = 0; i < groups.length; i++) {
					if (joinGroupName == groups[i].groupName) {
						joinGroup = false
						sendPages(res, username, currentGroupName, null, null, 
							'homepage/group/joinOneGroup/AlreadyInGroup')
					}
				}
				if (joinGroup) {
					var groupMeta = JSON.parse(value)
					stencil.joinGroupReq(username, joinGroupName, groupMeta.location, function(result){
						if (result == 'Accept') {
							sendPages(res, username, currentGroupName, null, null, 
								'homepage/group/joinOneGroup/joinGroupSuccessfully')
						}
					})
				}
			})
		}
	})
})

//Get group Info
app.post('/homepage/group/getGroupsInfo', function(req, res) {
	var username = req.body.username
	var groupName = req.body.groupName
	stencil.getUserInfo(username, function (usermeta) {
		var groups = JSON.parse(usermeta).groups
		if (groups.length == null) {
			sendPages(res, username, groupName, null, null, 
					'homepage/group/getGroupsInfo', null)
		} else {
			var groupsMeta = []
			var done
			for (var i = 0; i < groups.length; i++) {
				done = false
				stencil.getGroupInfo(groups[i].groupName, function (groupMeta) {
					groupsMeta[i] = {}
					groupsMeta[i].name = groups[i].groupName
					groupsMeta[i].description = JSON.parse(groupMeta).description
					done = true
				})
				deasync.loopWhile(function(){return !done})
			}
			sendPages(res, username, groupName, null, null, 
						'homepage/group/getGroupsInfo', groupsMeta)
		}
		
	})
})

//Leave one Group
app.post('/homepage/group/leaveOneGroup', function(req, res) {
	var username = req.body.username
	var currentGroupName = req.body.currentGroupName
	var leaveGroupName = req.body.leaveGroupName
	var leaveGroup = true
	stencil.getGroupInfo(leaveGroupName, function (groupMeta) {
		if (groupMeta == undefined) {
			leaveGroup = false
			sendPages(res, username, currentGroupName, null, null, 
				'homepage/group/leaveOneGroup/GroupNotExisted')
		}
		if (leaveGroup) {
			stencil.getUserInfo(username, function (usermeta) {
				var groups = JSON.parse(usermeta).groups
				var inGroup = false
				for (var i = 0; i < groups.length; i++) {
					if (leaveGroupName == groups[i].groupName) {
						inGroup = true
						break
					}
				}
				if (inGroup) {
					stencil.leaveGroup(username, leaveGroupName, function () {
						if (leaveGroupName == currentGroupName) {
							groupName = null
						} else {
							groupName = currentGroupName
						}
						sendPages(res, username, groupName, null, null, 
							'homepage/group/leaveOneGroup/LeaveGroupSuccessfully')
					})
				} else {
					sendPages(res, username, currentGroupName, null, null, 
						'homepage/group/leaveOneGroup/NotInGroup')
				}
			})
		}
	})
})

//Change current group
app.post('/homepage/group/changeCurrentGroup', function(req, res){
	var currentGroupName = req.body.currentGroupName
	var username = req.body.username
	var selected_groupName = req.body.selected_groupName
	if (selected_groupName == currentGroupName) {
		sendPages(res, username, currentGroupName, null, null, 
				'homepage/group/changeCurrentGroup/NoNeedToChange')
	} else {
		sendPages(res, username, selected_groupName, null, null, 
				'homepage/group/changeCurrentGroup/ChangeGroupSuccessfully')
	}
})

//Create server listening on port 3000 at localhost
var server = app.listen(3000, function () {
	var host = server.address().address
	var port = server.address().port
	console.log('Example app listening at http://%s:%s', host, port)
});
