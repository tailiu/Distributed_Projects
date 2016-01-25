var express = require('express');
var querystring = require('querystring');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var crypto = require('crypto');
var app = express();
var Schema = mongoose.Schema;
var jade = require('jade')

//db address
var dbAddr = 'mongodb://localhost:27017/simpleForumStencil'

var userGroupSchema = new Schema({
	groupName: 	String,
	_id: 		String
})
var userStencilSchema = new Schema({
	ts: 	  	{ type: Date, default: new Date() },
	_id: 	  	String, 
	name: 	  	String,
	email:    	String,
	password: 	String,
	group: 		[userGroupSchema]
})
var groupMemberSchema = new Schema({
	userName: 	String,
	_id: 		String,
	role: 		[]
})
var groupStencilSchema = new Schema({
	ts: 	  		{ type: Date, default: new Date() },
	_id: 			String,
	name: 			String,
	type: 			[],
	description: 	String,
	groupMems: 		[groupMemberSchema]
})
var fileUserAccessList = new Schema({
	userName: 	String,
	_id: 		String
})
var fileGroupSchema = new Schema({
	groupName: 	String,
	_id: 		String
})
var fileStencilSchema = new Schema({
	ts: 			{ type: Date, default: new Date() },
	_id: 			String,
	name: 			String,
	creator: 		Schema.Types.Mixed,
	type: 			[],
	readList: 		[fileUserAccessList],
	writeList: 		[fileUserAccessList],
	appSpecFileMeta: 	[],
	content: 		String,
	group: 			[fileGroupSchema]
})
var userStencil = mongoose.model('userStencil', userStencilSchema)
var fileStencil = mongoose.model('fileStencil', fileStencilSchema)
var groupStencil = mongoose.model('groupStencil', groupStencilSchema)

//Create unique _id
function createRandom() {
	var current_date = (new Date()).valueOf().toString();
	var random = Math.random().toString();
	return crypto.createHash('sha1').update(current_date + random).digest('hex');
}

//Send filtered files back
function sendFiles(whetherConnect, res, ufilters, ffilters, fsort) {
	if (!whetherConnect) {
		mongoose.connect(dbAddr)
	}
	userStencil.findOne({name: ufilters.username}, function (err, data1) {
		if (err) console.log(err)
		var ids = []
		for (var i =0; i< data1.group.length; i++) {
			ids[i] = data1.group[i]._id
	    }
	    idsToFind = {$in: ids}
	    if (ffilters.category == 'all') {
	    	fileStencil.find({'group._id':idsToFind}).sort(fsort).exec(function (err, data) {
	    		if (err) console.log(err)
	    		mongoose.disconnect()
				response = "callback({'files':" + JSON.stringify(data) + "})"
				res.end(response)
			})
	    } else {
			fileStencil.find({'appSpecFileMeta.categories': ffilters.category, 'group._id':idsToFind}).sort(fsort).exec(function (err, data) {
				if (err) console.log(err)
				// var posts = []
				// //filter the posts by the user's groups
				// for (var i in data) {
				// 	for (var j in ids) {
				// 		if (data[i].group.id(ids[j])!= null) {
				// 			//filter the comments by the user's groups
				// 			comments1 = []
				// 			postComments = data[i].comments
				// 			var findComments = false
				// 			for (var m in postComments) {
				// 				for (var n in ids) {
				// 					for (var p in postComments[m].group){
				// 						if (postComments[m].group[p].id != null && postComments[m].replyTo != undefined) {
				// 							comments1.push(postComments[m])
				// 							findComments = true
				// 							break
				// 						}
				// 					}
				// 					if (findComments) {
				// 						break
				// 					}
				// 				}
				// 				findComments = false
				// 			}
				// 			//console.log(comments1)
				// 			data[i].comments = comments1
				// 			posts.push(data[i])
				// 		}
				// 	}
				// }
				mongoose.disconnect()
				response = "callback({'files':" + JSON.stringify(data) + "})"
				res.end(response)
			})
		}
	})
}

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
	mongoose.connect(dbAddr)
	var newUser = new userStencil({
		ts: 	  	new Date(),
		_id: 	  	createRandom(), 
		name: 	  	username,
		email:    	email,
		password: 	password,
		group: 		[]
	})
	newUser.save(function (err, data) {
		if (err) console.log(err)
		mongoose.disconnect()
		response = "callback({'user':" + JSON.stringify(data) + ", 'result':'successful'})"
		res.end(response)
	})
})

app.get('/user/getUserInfo', function(req, res) {
	var username = req.query.username
	mongoose.connect(dbAddr)
	userStencil.findOne({name: username}, function (err, user) {
		if (err) console.log(err)
		//console.log(user)
		mongoose.disconnect()
		response = "callback({'user':" + JSON.stringify(user) + "})"
		res.end(response)
	})
})

app.get('/user/updateUserInfo', function(req, res) {
	var username = req.query.username
	var groupName = req.query.groupName
	var option = req.query.option
	//console.log(username, groupName)
	mongoose.connect(dbAddr)
	if (option == 'addOneGroup') {
		groupStencil.findOne({name: groupName}, function(err, group){
			if (err) console.log(err)
			var newGroup = {}
			newGroup._id = group._id
			newGroup.groupName = group.name
			userStencil.findOneAndUpdate({'name': username}, 
										{$push: {"group": newGroup}}, {new: true}, function(err, user){
				if(err){
			        console.log("Something wrong when updating data!");
			    }
			    mongoose.disconnect()
				response = "callback({'updatedUser':" + JSON.stringify(user) + ", 'result':'successful'})"
				res.end(response)
			})
		})
	} else if (option == 'deleteOneGroup') {
		groupStencil.findOne({name: groupName}, function (err, group) { 
			userStencil.findOne({name: username}, function(err, user){
				user.group.id(group._id).remove();
				user.save(function (err, data) {
					if (err) console.log(err)
					mongoose.disconnect()
					response = "callback({'updatedUser':" + JSON.stringify(data) + ", 'result':'successful'})"
					res.end(response)
				})
			})
		})
	}
})

app.get('/file/getFiles', function(req, res) {
	var username = req.query.username
	var category = req.query.category
    var ufilters = {}
    var ffilters = {}
    var fsort = '-ts'
    if (category == 'all' || category == undefined) {
    	ffilters.category = 'all'
    } else {
    	ffilters.category = category
    }
    ufilters.username = username
	sendFiles(false, res, ufilters, ffilters, fsort)
})

app.get('/file/updateFiles', function(req, res) {
	var username = req.query.username
	var replyTo = req.query.replyTo
	var comment = req.query.comment
	var postID = req.query.postID
	mongoose.connect(dbAddr)
	userStencil.findOne({name: username}, function (err, user) {
		if (err) console.log(err)
		var newComment = {
			creator: 	user,
			ts: 		Date(),
			content: 	comment,
			replyTo: 	replyTo,
			_id: 		createRandom(),
			group: 		[] //user commenter's groups as the groups of the new comment
		}
		for (var i=0; i<user.group.length; i++) {
			var group = {}
			group._id = user.group[i]._id
			group.groupName = user.group[i].groupName
			newComment.group.push(group)
		}
		fileStencil.findOneAndUpdate({'_id': postID}, 
									{$push: {"appSpecFileMeta": newComment}}, {new: true}, function(err, post){
		    if(err){
		        console.log("Something wrong when updating data!");
		    }
		    mongoose.disconnect()
			response = "callback({'updatedFile':" + JSON.stringify(post) + "})"
			res.end(response)
		})
	})
})

app.get('/file/createFiles', function(req, res) {
	var name = req.query.title
	var category = req.query.category
	var content = req.query.content
	var username = req.query.username
	var groups = req.query.groups
	mongoose.connect(dbAddr)
	userStencil.findOne({name: username}, function (err, user) {
		var idsToFind = {}
		var ids = []
		for (var i in groups) {
			ids[i] = groups[i]
	    }
		idsToFind = {$in: ids}
		groupStencil.find({'_id': idsToFind}, function(err, groups){
			if (err) console.log(err)
			var newFile = new fileStencil({
				_id: 			createRandom(),
				ts: 			new Date(),
				name: 			name,
				creator: 		user,
				type: 			['public'],
				readList: 		[],
				writeList: 		[],
				appSpecFileMeta: 	[],
				content: 		content,
				group: 			[]
			})
			var cat = {}
			cat.categories = category
			newFile.appSpecFileMeta.push(cat)
			for (var i=0; i < groups.length; i++) {
				var groupMem = {}
				groupMem._id = groups[i]._id
				groupMem.groupName = groups[i].name
				newFile.group.push(groupMem)
			}
			newFile.save(function (err, data) {
				if (err) console.log(err)
				mongoose.disconnect()
				response = "callback({'result':'successful'})"
				res.end(response)
			})
		})
	})
})

app.get('/group/leaveOneGroup', function(req, res) {
	var username = req.query.username
	var groupName = req.query.groupName
	mongoose.connect(dbAddr)
	userStencil.findOne({name: username}, function (err, user) { 
		// console.log(user)
		groupStencil.findOne({name: groupName}, function(err, group){
			group.groupMems.id(user._id).remove();
			group.save(function (err, data) {
				if (err) console.log(err)
				mongoose.disconnect()
				// console.log(data)
				response = "callback({'result':'successful'})"
				res.end(response)
			})
		})
	})
})

app.get('/group/joinOneGroup', function(req, res) {
	var username = req.query.username
	var groupName = req.query.groupName
	mongoose.connect(dbAddr)
	userStencil.findOne({name: username}, function (err, user) {
		if (err) console.log(err)
		var newGroupMember = {
				userName: 	username,
				_id: 		user._id,
				role: 		['Group Member']
		}
		groupStencil.findOneAndUpdate({'name': groupName}, 
									{$push: {"groupMems": newGroupMember}}, {new: true}, function(err, post){
			if (err) console.log(err)
		    mongoose.disconnect()
			response = "callback({'result':'successful'})"
			res.end(response)
		})
	})
})

app.get('/group/createOneGroup', function(req, res) {
	var username = req.query.username
	var groupName = req.query.groupName
	var description = req.query.description
	var type = req.query.type
	mongoose.connect(dbAddr)
	userStencil.findOne({name: username}, function (err, user) {
		var newGroup = new groupStencil({
			_id: 		createRandom(),
			ts: 		new Date(),
			name: 		groupName,
			type: 		type,
			description: 	description,
			groupMems: 	[]
		})
		var mem = {}
		mem._id = user._id
		mem.userName = user.name
		mem.role = ['Owner']
		newGroup.groupMems.push(mem)
		newGroup.save(function (err, data) {
			if (err) console.log(err)
			mongoose.disconnect()
			response = "callback({'result':'successful'})"
			res.end(response)
		})
	})
})

app.get('/group/getGroupInfoAssociatedWithOneUser', function(req, res) {
	var username = req.query.username
	mongoose.connect(dbAddr)
	userStencil.findOne({name: username}, function (err, user) {
		var idsToFind = {}
		var ids = []
		for (var i=0; i<user.group.length; i++) {
			ids[i] = user.group[i]._id    
		}
		idsToFind = {$in: ids}
		groupStencil.find({'_id': idsToFind}, function(err, groups){
			if (err) console.log(err)
			mongoose.disconnect()
			//console.log(groups)
			response = "callback({'groups':" + JSON.stringify(groups) + "})"
			res.end(response)
		})
	})
})

app.get('/group/getGroupInfoByGroupName', function(req, res) {
	var groupName = req.query.groupName
	mongoose.connect(dbAddr)
	groupStencil.findOne({name: groupName}, function(err, group){
		if (err) console.log(err)
		mongoose.disconnect()
		response = "callback({'group':" + JSON.stringify(group) + "})"
		res.end(response)
	})
})

app.get('/renderWebPage', function(req, res) {
	var page = req.query.page
	var pageName = page.split("/")
	var filePath = './views/jade/' + pageName[0]
	if (pageName[0] == 'homepage.jade') {
		var user = JSON.parse(req.query.user)
		var files = JSON.parse(req.query.files)
		var webpage = jade.renderFile(filePath, {name: user.name, meta: JSON.stringify(user), files: JSON.stringify(files), 
							page: JSON.stringify({path: page}), group: ''})
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
