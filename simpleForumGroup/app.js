var express = require('express');
var querystring = require('querystring');
var bodyParser = require('body-parser');
var mongoose = require('mongoose');
var crypto = require('crypto');
var app = express();
var Schema = mongoose.Schema;

//db address
var dbAddr = 'mongodb://localhost/simpleForumGroup'

//The schemas and models of users, posts, groups after conversion
var userPostGSchema = new Schema({
	groupName: 	String,
	_id: 		String
})
var userIdGSchema = new Schema({
	ts: 	  	{ type: Date, default: new Date() },
	_id: 	  	String, 
	name: 	  	String,
	email:    	String,
	password: 	String,
	group: 		[userPostGSchema]
})
var GroupUSchema = new Schema({
	userName: 	String,
	_id: 		String,
	role: 		[]
})
var groupSchema = new Schema({
	ts: 	  		{ type: Date, default: new Date() },
	_id: 			String,
	name: 			String,
	type: 			[],
	description: 	String,
	GroupMems: 		[GroupUSchema]
})
var commentGSchema = new Schema({
	creator: 	Schema.Types.Mixed,
	ts: 		{ type: Date, default: new Date() },
	content: 	String,
	replyTo: 	String,
	_id: 		String,
	group: 		[userPostGSchema]
})
var postsGSchema = new Schema({
	ts: 	  	{ type: Date, default: new Date() },
	creator:    Schema.Types.Mixed,
	category: 	[],
	_id: 		String,
	content:	String,
	title:      String,
	comments: 	[commentGSchema],
	group: 		[userPostGSchema]
})
var userGIds = mongoose.model('userGIds', userIdGSchema)
var postsG = mongoose.model('postsG', postsGSchema)
var group = mongoose.model('group', groupSchema)

//Create unique _id
function createRandom() {
	var current_date = (new Date()).valueOf().toString();
	var random = Math.random().toString();
	return crypto.createHash('sha1').update(current_date + random).digest('hex');
}
//Send posts back
function sendPosts(whetherConnect, res, dbAddr, pFilter, pSort, uFilter) {
	if (!whetherConnect) {
		mongoose.connect(dbAddr)
	}
	userGIds.findOne(uFilter, function (err, data1) {
		if (err) console.log(err)
		var ids = []
		for (var i in data1.group) {
			ids[i] = data1.group[i]._id
	    }
	    // console.log(data1)
		postsG.find(pFilter).sort(pSort).exec(function (err, data) {
			if (err) console.log(err)
			var posts = []
			//filter the posts by the user's groups
			for (var i in data) {
				for (var j in ids) {
					if (data[i].group.id(ids[j])!= null) {
						//filter the comments by the user's groups
						comments1 = []
						postComments = data[i].comments
						var findComments = false
						for (var m in postComments) {
							for (var n in ids) {
								for (var p in postComments[m].group){
									if (postComments[m].group[p].id != null && postComments[m].replyTo != undefined) {
										comments1.push(postComments[m])
										findComments = true
										break
									}
								}
								if (findComments) {
									break
								}
							}
							findComments = false
						}
						//console.log(comments1)
						data[i].comments = comments1
						posts.push(data[i])
					}
				}
			}
	    	//console.log(posts)
			mongoose.disconnect()
			res.render('homepage', {name: data1.name, meta: JSON.stringify(data1), posts: JSON.stringify(posts), 
						page: JSON.stringify({path: 'postPage'}), group: ''})
		})
	})
}

app.set('views', './views/jade')
app.set('view engine', 'jade')
app.use(bodyParser.json())       	// to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
	extended: true
}))

//Deal with the initial page
app.post('/initial-page', function(req, res) {
    var username = req.body.username
    var password = req.body.password
    var op = req.body.login
    if (op == undefined) {
    	res.render('register')
    } else {
		sendPosts(false, res, dbAddr, {}, '-ts', {'name': username})
    }
});

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

app.get('/homepage/group/getGroupsInfo', function(req, res) {
	var userName = req.query.userName
	console.log(userName)
	res.end('hhhh')
})
//Create server listening on port 3000 at localhost
var server = app.listen(3000, function () {
	var host = server.address().address
	var port = server.address().port
	console.log('Example app listening at http://%s:%s', host, port)
});