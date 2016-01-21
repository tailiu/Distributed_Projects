var express = require('express');
var querystring = require('querystring');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var crypto = require('crypto');
var app = express();
var Schema = mongoose.Schema;

//db address
var dbAddr = 'mongodb://localhost/simpleForumStencil'

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
	creator: 		String,
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

//Send posts back
function sendFiles(whetherConnect, res, ufilters, gfilters, fsort) {
	if (!whetherConnect) {
		mongoose.connect(dbAddr)
	}
	console.log(ufilters.username)
	userStencil.findOne({name: ufilters.username}, function (err, data1) {
		if (err) console.log(err)
		var ids = []
		for (var i =0; i< data1.group.length; i++) {
			ids[i] = data1.group[i]._id
	    }
	    console.log(ids)
		fileStencil.find(gfilters).sort(fsort).exec(function (err, data) {
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
	    	//console.log(posts)
			mongoose.disconnect()
			// console.log(data)
			response = "callback({'files':" + JSON.stringify(data) + "})"
			res.end(response)
			// res.render('homepage', {name: data1.name, meta: JSON.stringify(data1), posts: JSON.stringify(posts), 
			// 			page: JSON.stringify({path: 'postPage'}), group: ''})
		})
	})
}

app.set('views', './views/jade')
app.set('view engine', 'jade')
app.use(bodyParser.json())       	// to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
	extended: true
}))

app.get('/user/getUserInfo', function(req, res) {
	var username = req.query.username
	mongoose.connect(dbAddr)
	userStencil.findOne({name: username}, function (err, userInfo) {
		if (err) console.log(err)
		console.log(userInfo)
		mongoose.disconnect()
		response = "callback({'user':" + JSON.stringify(userInfo) + "})"
		res.end(response)
	})
})

app.get('/file/getFiles', function(req, res) {
	var username = req.query.username
    var ufilters = {}
    var gfilters = {}
    var fsort = '-ts'
    ufilters.username = username
	sendFiles(false, res, ufilters, gfilters, fsort)
})

app.get('/renderWebPage', function(req, res) {

})







/*
//Deal with register and then store new user info in the DB
app.post('/register', function(req, res) {
    mongoose.connect(dbAddr);  
    var user = {
    	_id:      createRandom(),
		name:     req.body.username,
		email:    req.body.email,
		password: req.body.password
    }
    var userGId = new userGIds({
    	ts: 	  new Date(),
    	_id:      user._id,
		name: 	  user.name,
		email:    user.email,
		password: user.password,
		group: 	  []
	})
	userGId.save(function (err) {
		if (err) console.log(err)
		//console.log("saved")
		sendPosts(true, res, dbAddr, {}, '-ts', {'name': user.name})
	}) 
});

//Return to the homepage
app.get('/homepage/home', function(req, res) {
	var name = req.query.userName
	sendPosts(false, res, dbAddr, {}, '-ts', {'name': name})
});

//Show all the posts
app.get('/homepage/all', function(req, res) {
	var name = req.query.userName
	sendPosts(false, res, dbAddr, {}, '-ts', {'name': name})
});

//Show all the posts with category life
app.get('/homepage/life', function(req, res) {
	var name = req.query.userName
	sendPosts(false, res, dbAddr, {'category': 'life'}, '-ts', {'name': name})
});

//Show all the posts with category study
app.get('/homepage/study', function(req, res) {
	var name = req.query.userName
	sendPosts(false, res, dbAddr, {'category': 'study'}, '-ts', {'name': name})
});

//Show all the posts with category work
app.get('/homepage/work', function(req, res) {
	var name = req.query.userName
	sendPosts(false, res, dbAddr, {'category': 'work'}, '-ts', {'name': name})
});

//Deal with user logout
app.get('/homepage/logout', function(req, res) {
	var user = JSON.parse(req.query.user)
	res.end("<html> <header> BYE " + user.name + "! </header> </html>")
});

//Deal with new post
app.post('/homepage/newPost', function(req, res) {
	var creatorID = req.body.userID
	var category = req.body.category
	var content = req.body.content
	var title = req.body.title
	var groupIDs = req.body.groupIDs
	var groupsToFind = []
	if (typeof(groupIDs) == 'string') {
		groupsToFind[0] = groupIDs
	} else {
		idsToFind = groupIDs
	}
	mongoose.connect(dbAddr);
	idsToFind = {$in: groupsToFind}
	group.find({'_id': idsToFind}, function (err, data) {
		if (err) console.log(err)
		var groups = []
		for (var i in data){
			var groupMem = {}
			groupMem._id = data[i]._id
			groupMem.groupName = data[i].name
			groups[i] = groupMem
		}
		userGIds.findOne({'_id': creatorID}, function (err, user) {
			if (err) console.log(err)
			var postG = new postsG({
				creator:    user,
				category: 	category,
				_id: 		createRandom(),
				content:	content,
				title:      title,
				comments:   [],
				group: 		[]
			})
			for (var i in groups) {
				postG.group.push(groups[i])
			}
			postG.save(function (err, data) {
				if (err) console.log(err)
				//console.log(data)
				sendPosts(true, res, dbAddr, {}, '-ts', {'name': user.name})
			})
		})
	})
});

//Add a new comment to a post
app.post('/homepage/newComment', function(req, res) {
	var postID = req.body.postID
	var userID = req.body.userID
	var comment = req.body.comment
	var replyTo = req.body.replyTo
	mongoose.connect(dbAddr)
	userGIds.findOne({'_id': userID}, function (err, user) {
		if (err) console.log(err)
		postsG.findOne({'_id': postID}, function (err, postG) {
	  		if (err) console.log(err)
	  		//use user's groups as the comment's group
	  		var c1 = {creator: user, ts: Date(), content: comment, replyTo: replyTo, group: user.group}
			postG.comments.push(c1)
			postG.save(function (err) {
				if (err) console.log(err)
				//console.log('Success!');
				sendPosts(true, res, dbAddr, {}, '-ts', {'name': user.name});
			})
		})
	})	
});

//Create a group
app.post('/homepage/group/createOneGroup', function(req, res) {
	var groupName = req.body.groupName
	var userID = req.body.userID
	var groupType = req.body.type
	var description = req.body.description
	mongoose.connect(dbAddr)
	userGIds.findOne({'_id': userID}, function (err, user) {
		if (err) console.log(err)
		var oneGroup = {}
		var groupMem = {}
		var groupId = createRandom()
		var newGroup = new group ({
			ts: 			new Date(),
			_id: 			groupId,
			name: 			groupName,
			type: 			groupType,
			description: 	description,
			GroupMems: 		[]
		})
		//add the creator as the owner to the group member list
		groupMem._id = user._id
		groupMem.userName = user.name
		groupMem.role = ['owner']
		newGroup.GroupMems.push(groupMem)
		//add a new group to the creator meta
		oneGroup._id = newGroup._id
		oneGroup.groupName = newGroup.name
		user.group.push(oneGroup)
		user.save(function (err, data) {
			if (err) console.log(err)
			// console.log(data)
			newGroup.save(function (err, data1) {
				if (err) console.log(err)			
				sendPosts(true, res, dbAddr, {}, '-ts', {'name': user.name})
				// console.log(data1)
			})	
		})
	})
})

//Search a group
app.post('/homepage/group/joinOneGroup/searchGroupByName', function(req, res) {
	var groupName = req.body.groupName
	var userID = req.body.userID
	mongoose.connect(dbAddr)
	group.findOne({'name': groupName}, function (err,group){
		//console.log(group)
		userGIds.findOne({'_id': userID}, function (err, user) {
			//console.log(user)
			mongoose.disconnect()
			if (group == null) {
				res.render('homepage', {name: user.name, meta: JSON.stringify(user), 
							page: JSON.stringify({path: 'group/joinOneGroup/afterSearch/noResult'}), 
							group: '', posts: ''})
			} else if (group.GroupMems.id(user._id) != null) {
				res.render('homepage', {name: user.name, meta: JSON.stringify(user), 
							page: JSON.stringify({path: 'group/joinOneGroup/afterSearch/alreadyIn'}), 
							group: JSON.stringify(group), posts: ''})
			} else {
				res.render('homepage', {name: user.name, meta: JSON.stringify(user), 
						page: JSON.stringify({path: 'group/joinOneGroup/afterSearch/whetherToJoin'}), 
						group: JSON.stringify(group), posts: ''})
			}
		})
	})
})

app.post('/homepage/group/joinOneGroup/join', function(req, res) {
	var groupID = req.body.groupID
	var userName = req.body.userName
	mongoose.connect(dbAddr)
	group.findOne({'_id': groupID}, function (err, group){
		//console.log(group)
		userGIds.findOne({'name': userName}, function (err, user) {
			//console.log(user)
			//add the user as a normal group member to the group member list
			var groupMem = {}
			groupMem._id = user._id
			groupMem.userName = user.name
			groupMem.role = ['Group Member']
			group.GroupMems.push(groupMem)
			group.save(function (err) {
				if (err) console.log(err)
				//add a new group to the creator meta
				var oneGroup = {}
				oneGroup._id = group._id
				oneGroup.groupName = group.name
				user.group.push(oneGroup)
				user.save(function (err) {
					if (err) console.log(err)
					mongoose.disconnect()
					res.render('homepage', {name: user.name, meta: JSON.stringify(user), 
								page: JSON.stringify({path: 'group/joinOneGroup/joinSuc'}), 
								group: JSON.stringify(group), posts: ''})
				})
			})
		})
	})
})
app.get('/homepage/ok', function(req, res) {
	res.end('hhhhhhhhhhhhhhhhhh')
})

app.get('/homepage/group/getGroupsInfo', function(req, res) {
	console.log(req.query.q)
	// var userName = req.query.userName
	// mongoose.connect(dbAddr)
	// userGIds.findOne({'name': userName}, function (err, user) {
	// 	groupIDs = []
	// 	for (var i = 0; i < user.group.length; i++) {
	// 		groupIDs[i] = user.group[i]._id
	// 	}	
	// })
	ok = "localJsonpCallback({'iterm':'ok'})"
	res.end(ok)
})
//Create server listening on port 3000 at localhost
var server = app.listen(3000, function () {
	var host = server.address().address
	var port = server.address().port
	console.log('Example app listening at http://%s:%s', host, port)
});
*/