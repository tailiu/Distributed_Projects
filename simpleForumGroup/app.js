var express = require('express')
var querystring = require('querystring')
var bodyParser = require('body-parser')
var stencil = require('./stencil')
var async = require('async')
var deasync = require('deasync')
var app = express()

app.set('views', './views/jade')
app.set('view engine', 'jade')
app.use(bodyParser.json())       	// to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
	extended: true
}))

//Send a dynamic page back
function sendPages(res, pFilter, pSort, uFilter, type, additionalInfo) {
	var ffilters = {}
	if (type == 'selectGroup') {
		var done = false
		var result
		stencil.getUserInfo(uFilter.name, function (response){
			result = response
			done = true
		})
		deasync.loopWhile(function(){return !done})
		res.render('selectGroup', {meta: JSON.stringify(result)})
	} else {
		var done1 = false
		var done2 = false
		var posts, usermeta
		if (pFilter.tags == 'all' || pFilter.tags == undefined) {
	    	ffilters.tags = 'all'
	    } else {
	    	ffilters.tags = pFilter.tags
	    }
		stencil.getFiles(uFilter.name, uFilter.groupID, ffilters, pSort, function (response){
			posts = response
			done1 = true
		})
		deasync.loopWhile(function(){return !done1})
		stencil.getUserInfo(uFilter.name, function (response){
			usermeta = response
			done2 = true
		})
		deasync.loopWhile(function(){return !done2})
		if (type == 'homepage/group/getGroupsInfo') {
			res.render('homepage', {name: uFilter.name, files: JSON.stringify(posts), meta: JSON.stringify(usermeta),
						page: JSON.stringify({path: type}), groupID: JSON.stringify({groupID: uFilter.groupID}),
						additionalInfo: JSON.stringify(additionalInfo)
			  		})
			return
		}
		res.render('homepage', {name: uFilter.name, files: JSON.stringify(posts), meta: JSON.stringify(usermeta),
						page: JSON.stringify({path: type}), groupID: JSON.stringify({groupID: uFilter.groupID}),
						additionalInfo: 'null'
			  })
	}
}

//Initial page
app.post('/initial-page', function(req, res) {
    var username = req.body.username
    var password = req.body.password
    var op = req.body.login
    if (op == undefined) {
    	res.render('register')
    } else {
		sendPages(res, {}, '-ts', {'name': username}, 'selectGroup')
    }
});

//User register
app.post('/register', function(req, res) {
	var result
	var done = false
	var username = req.body.username
	var email = req.body.email
	var password = req.body.password
	stencil.createUser(username, email, password, function (response){
		result = response
		done = true
	})
	deasync.loopWhile(function(){return !done})
	sendPages(res, {}, '-ts', {'name': username, 'groupID': undefined}, 'homepage/tags')
});

//Show all the posts
app.get('/homepage/all', function(req, res) {
	var name = req.query.userName
	var groupID = req.query.groupID
	sendPages(res, {}, '-ts', {'name': name, 'groupID': groupID}, 'homepage/tags')
});

//Show all the posts with tage life
app.get('/homepage/life', function(req, res) {
	var name = req.query.userName
	var groupID = req.query.groupID
	sendPages(res, {'tags': 'life'}, '-ts', {'name': name, 'groupID': groupID}, 'homepage/tags')
});

//Show all the posts with tag study
app.get('/homepage/study', function(req, res) {
	var name = req.query.userName
	var groupID = req.query.groupID
	sendPages(res, {'tags': 'study'}, '-ts', {'name': name, 'groupID': groupID}, 'homepage/tags')
});

//Show all the posts with tag work
app.get('/homepage/work', function(req, res) {
	var name = req.query.userName
	var groupID = req.query.groupID
	sendPages(res, {'tags': 'work'}, '-ts', {'name': name, 'groupID': groupID}, 'homepage/tags')
});

//User logout
app.get('/homepage/logout', function(req, res) {
	var userName = req.query.user
	res.end("<html> <header> BYE " + userName + "! </header> </html>")
});

//New post
app.post('/homepage/newPost', function(req, res) {
	var result
	var done = false
	var name = req.body.title
	var tag = req.body.tag
	var content = req.body.content
	var username = req.body.username
	var groupID = req.body.groupID
	console.log(groupID)
	stencil.createFiles(name, tag, content, username, groupID, function (response){
		result = response
		done = true
	})
	deasync.loopWhile(function(){return !done})
	sendPages(res, {}, '-ts', {'name': username, 'groupID': groupID}, 'homepage/tags')
});

//Add a new comment to a post
app.post('/homepage/newComment', function(req, res) {
	var result
	var done = false
	var username = req.body.username
	var replyTo = req.body.replyTo
	var comment = req.body.comment
	var postID = req.body.postID
	var groupID = req.body.groupID
	stencil.updateFiles(username, replyTo, comment, postID, groupID, function (response){
		result = response
		done = true
	})
	deasync.loopWhile(function(){return !done})
	sendPages(res, {}, '-ts', {'name': username, 'groupID': groupID}, 'homepage/tags')
});

//Create a group
app.post('/homepage/group/createOneGroup', function(req, res) {
	var username = req.body.username
	var groupName = req.body.groupName
	var description = req.body.description
	var type = req.body.type
	var groupID = req.body.groupID
	var done1 = false
	var done2 = false
	var done3 = false
	var group
	stencil.getGroupInfoByGroupName(groupName, function (response){
		group = response
		done1 = true
	})
	deasync.loopWhile(function(){return !done1})
	if (group != null) {
		sendPages(res, {}, '-ts', {'name': username, 'groupID': groupID}, 
				'homepage/group/createOneGroup/AlreadyExisted')
		return
	}
	stencil.createOneGroup(username, groupName, description, type, function (response){
		result = response
		done2 = true
	})
	deasync.loopWhile(function(){return !done2})
	stencil.updateUserInfo(username, groupName, 'addOneGroup', function (response){
		result = response
		done3 = true
	})
	deasync.loopWhile(function(){return !done3})
	sendPages(res, {}, '-ts', {'name': username, 'groupID': groupID}, 
				'homepage/group/createOneGroup/createGroupSuccessful')
})
//Join a group
app.post('/homepage/group/joinOneGroup', function(req, res) {
	var group
	var userGroups
	var done1 = false
	var done2 = false
	var done3 = false
	var done4 = false
	var username = req.body.username
	var groupName = req.body.groupName
	var groupID = req.body.groupID
	stencil.getGroupInfoByGroupName(groupName, function (response){
		group = response
		done1 = true
	})
	deasync.loopWhile(function(){return !done1})
	if (group == null) {
		sendPages(res, {}, '-ts', {'name': username, 'groupID': groupID}, 
				'homepage/group/joinOneGroup/GroupNotExisted')
		return
	}
	stencil.getGroupInfoAssociatedWithOneUser(username, function (response){
		userGroups = response
		done2 = true
	})
	deasync.loopWhile(function(){return !done2})
	for (var i=0; i<userGroups.length; i++) {
        if (userGroups[i].name == groupName) {
            sendPages(res, {}, '-ts', {'name': username, 'groupID': groupID}, 
				'homepage/group/joinOneGroup/AlreadyInGroup')
			return
        }
    }
	stencil.joinGroup(username, groupName, function (response){
		result = response
		done3 = true
	})
	deasync.loopWhile(function(){return !done3})
	stencil.updateUserInfo(username, groupName, 'addOneGroup', function (response){
		result = response
		done4 = true
	})
	deasync.loopWhile(function(){return !done4})
	sendPages(res, {}, '-ts', {'name': username, 'groupID': groupID}, 
				'homepage/group/joinOneGroup/JoinGroupSuccessfully')
})
//Get group Info
app.post('/homepage/group/getGroupsInfo', function(req, res) {
	var result
	var username = req.body.username
	var groupID = req.body.groupID
	var done = false
	stencil.getGroupInfoAssociatedWithOneUser(username, function (response){
		result = response
		done = true
	})
	deasync.loopWhile(function(){return !done})
	sendPages(res, {}, '-ts', {'name': username, 'groupID': groupID}, 
				'homepage/group/getGroupsInfo', result)
})
//Leave one Group
app.post('/homepage/group/leaveOneGroup', function(req, res) {
	var group
	var userGroups
	var done1 = false
	var done2 = false
	var done3 = false
	var done4 = false
	var inGroup = false
	var username = req.body.username
	var groupName = req.body.groupName
	var groupID = req.body.groupID
	stencil.getGroupInfoByGroupName(groupName, function (response){
		group = response
		done1 = true
	})
	deasync.loopWhile(function(){return !done1})
	if (group == null) {
		sendPages(res, {}, '-ts', {'name': username, 'groupID': groupID}, 
				'homepage/group/leaveOneGroup/GroupNotExisted')
		return
	}
	stencil.getGroupInfoAssociatedWithOneUser(username, function (response){
		userGroups = response
		done2 = true
	})
	deasync.loopWhile(function(){return !done2})
	for (var i=0; i<userGroups.length; i++) {
        if (userGroups[i].name == groupName) {
            inGroup = true
        }
    }
    if (!inGroup) {
    	sendPages(res, {}, '-ts', {'name': username, 'groupID': groupID}, 
				'homepage/group/leaveOneGroup/NotInGroup')
			return
    }
	stencil.leaveOneGroup(username, groupName, function (response){
		result = response
		done3 = true
	})
	deasync.loopWhile(function(){return !done3})
	stencil.updateUserInfo(username, groupName, 'deleteOneGroup', function (response){
		result = response
		done4 = true
	})
	deasync.loopWhile(function(){return !done4})
	sendPages(res, {}, '-ts', {'name': username, 'groupID': groupID}, 
				'homepage/group/leaveOneGroup/LeaveGroupSuccessfully')
})
//Change current group
app.post('/homepage/group/changeCurrentGroup', function(req, res){
	var groupID = req.body.groupID
	var username = req.body.username
	var selected_groupID = req.body.selected_groupID
	if (selected_groupID == groupID) {
		sendPages(res, {}, '-ts', {'name': username, 'groupID': groupID}, 
				'homepage/group/changeCurrentGroup/NoNeedToChange')
		return
	}
	sendPages(res, {}, '-ts', {'name': username, 'groupID': selected_groupID}, 
				'homepage/group/changeCurrentGroup/ChangeGroupSuccessfully')
})

//Create server listening on port 3000 at localhost
var server = app.listen(3000, function () {
	var host = server.address().address
	var port = server.address().port
	console.log('Example app listening at http://%s:%s', host, port)
});