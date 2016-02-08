var express = require('express');
var bodyParser = require('body-parser');
var app = express();
var jade = require('jade')
var stencil = require('./stencil')

app.set('views', './views/jade')
app.set('view engine', 'jade')
app.use(bodyParser.json())       	// to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
	extended: true
}))

app.get('/user/createUser', function(req, res) {
	var username = req.query.username
	var email = req.query.email
	var password = req.query.password
	stencil.createUser(username, email, password, res)
})

app.get('/user/getUserInfo', function(req, res) {
	var username = req.query.username
	stencil.getUserInfo(username, res)
})

app.get('/user/updateUserInfo', function(req, res) {
	var username = req.query.username
	var groupName = req.query.groupName
	var option = req.query.option
	stencil.updateUserInfo(username, groupName, option, res)
})

app.get('/file/getFiles', function(req, res) {
	var username = req.query.username
	var groupID = req.query.groupID
	var tags = req.query.tag
    stencil.getFiles(username, groupID, tags, res)
})

app.get('/file/updateFiles', function(req, res) {
	var username = req.query.username
	var replyTo = req.query.replyTo
	var comment = req.query.comment
	var postID = req.query.postID
	var groupID = req.query.groupID
	stencil.updateFiles(username, replyTo, comment, postID, groupID, res)
})

app.get('/file/createFiles', function(req, res) {
	var name = req.query.title
	var tag = req.query.tag
	var content = req.query.content
	var username = req.query.username
	var groupID = req.query.groupID
	stencil.createFiles(name, tag, content, username, groupID, res)
})

app.get('/group/leaveOneGroup', function(req, res) {
	var username = req.query.username
	var groupName = req.query.groupName
	stencil.leaveOneGroup(username, groupName, res)
})

app.get('/group/joinGroup', function(req, res) {
	var username = req.query.username
	var groupName = req.query.groupName
	stencil.joinGroup(username, groupName, res)
})

app.get('/group/createOneGroup', function(req, res) {
	var username = req.query.username
	var groupName = req.query.groupName
	var description = req.query.description
	var type = req.query.type
	stencil.createOneGroup(username, groupName, description, type, res)
})

app.get('/group/getGroupInfoAssociatedWithOneUser', function(req, res) {
	var username = req.query.username
	stencil.getGroupInfoAssociatedWithOneUser(username, res)
})

app.get('/group/getGroupInfoByGroupName', function(req, res) {
	var groupName = req.query.groupName
	stencil.getGroupInfoByGroupName(groupName, res)
})

app.get('/renderWebPage', function(req, res) {
	var page = req.query.page
	var pageName = page.split("/")
	var filePath = './views/jade/' + pageName[0]
	if (pageName[0] == 'homepage.jade') {
		var user = JSON.parse(req.query.user)
		var files = JSON.parse(req.query.files)
		var groupID = req.query.groupID
		var webpage = jade.renderFile(filePath, {name: user.name, meta: JSON.stringify(user), files: JSON.stringify(files), 
							page: JSON.stringify({path: page}), groupID: JSON.stringify({groupID: groupID})})
	} else if (pageName[0] == 'selectGroup.jade') {
		var user = JSON.parse(req.query.user)
		var webpage = jade.renderFile(filePath, {meta: JSON.stringify(user)})
	} else if (pageName[0] == 'register.jade') {
		var webpage = jade.renderFile(filePath)
	} else if (pageName[0] == 'registerSuccessfully') {
		var user = JSON.parse(req.query.user)
		var webpage = "<html><h1>" + user.name + " registers successfully</h1></html>"
		webpage = "\'" + webpage + "\'"
		response = "callback({'page':" + webpage + "})"
		res.end(response)
		return
	} else if (pageName[0] == 'logout') {
		var username = req.query.username
		var webpage = "<html><h1>Good Bye " + username + " </h1></html>"
		webpage = "\'" + webpage + "\'"
		response = "callback({'page':" + webpage + "})"
		res.end(response)
		return 
	}
	var page = webpage + ""
	page = page.replace(/(\r\n|\n|\r)/gm, "")
	page = page.replace(/'/g, "\\'")
	page = "\'" + page + "\'"
	//console.log(page)
	response = "callback({'page':" + page + "})"
	res.end(response)
})

//Create server listening on port 3000 at localhost
var server = app.listen(3000, function () {
	var host = server.address().address
	var port = server.address().port
	console.log('Example app listening at http://%s:%s', host, port)
});
