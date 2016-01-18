var mongoose = require('mongoose')
var crypto = require('crypto')
var _ = require('underscore')

var Schema = mongoose.Schema
//db address before conversion
var dbAddr = 'mongodb://localhost/simpleForum'
var conn1 = mongoose.createConnection(dbAddr)

//db address after conversion
var dbGroupAddr = 'mongodb://localhost/simpleForumGroup'
var conn2 = mongoose.createConnection(dbGroupAddr)

//The schemas and models of users and posts before conversion
var userIdSchema = new Schema({
	_id: 	  	String, 
	name: 	  	String,
	email:    	String,
	password: 	String
})
var userIds = conn1.model('userIds', userIdSchema)
var commentSchema = new Schema({
	creator: 	Schema.Types.Mixed,
	ts: 		{ type: Date, default: new Date() },
	content: 	String,
	replyTo: 	String
})
var postsSchema = new Schema({
	ts: 	  	{ type: Date, default: new Date() },
	creator:    Schema.Types.Mixed,
	category: 	[],
	_id: 		String,
	content:	String,
	title:      String,
	comments: 	[commentSchema]
})
var posts = conn1.model('posts', postsSchema)

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
var userGIds = conn2.model('userGIds', userIdGSchema)
var postsG = conn2.model('postsG', postsGSchema)
var group = conn2.model('group', groupSchema)

function createRandom() {
	var current_date = (new Date()).valueOf().toString()
	var random = Math.random().toString()
	return crypto.createHash('sha1').update(current_date + random).digest('hex')
}

function convertGroups() {
}

//check the duplicated users and convert those that are not duplicated
function convertUsers(groupId, groupName, users) {
	var idsToFind = {}
	var ids = []
	for (var i in users) {
		ids[i] = users[i]._id
    }
    idsToFind = {$in: ids}
    userGIds.find({'_id': idsToFind}, function (err, data) {
		if (err) console.log(err)
		usersToBeCreated = _.difference(users, data)
		//convert unduplicated user accounts, after conversion, all the unduplicated 
		//user accounts belong to the Stencil group
		var usersArr = []
		for (var i in usersToBeCreated) {
			var user = {
				_id: 	  	usersToBeCreated[i]._id, 
				name: 	  	usersToBeCreated[i].name,
				email:    	usersToBeCreated[i].email,
				password: 	usersToBeCreated[i].password,
				group: 		[]
			}
			var userGroup = {}
			userGroup._id = groupId
			userGroup.groupName = groupName
			if (usersToBeCreated[i].ts != undefined) {
				user.ts = usersToBeCreated[i].ts
			}
			user.group[0] = userGroup 
			usersArr[i] = user
		}
		userGIds.collection.insert(usersArr, function(err, result) {
			if (err) console.log(err)
			convertPosts(groupId, groupName)
		})
	})
}

//convert posts, after conversion, all the posts and 
//the corresponding comments belong to the Stencil Group
function convertPosts(groupId, groupName) {
	posts.find({}, function(err, data) {
		if (err) console.log(err)
		var postsArr = []
		for (var i in data) {
			var post = {
				ts: 		data[i].ts,
				creator:    data[i].creator,
				category: 	data[i].category,
				_id: 		data[i]._id,
				content:	data[i].content,
				title:      data[i].title,
				comments: 	[],
				group: 		[]
			}
			var postGroup = {}
			postGroup._id = groupId
			postGroup.groupName = groupName
			post.group[0] = postGroup 
			var comments = []
			for (var j in data[i].comments) {
				var comment = {
					creator: 	data[i].comments[j].creator,
					ts: 		data[i].comments[j].ts,
					content: 	data[i].comments[j].content,
					replyTo: 	data[i].comments[j].replyTo,
					_id: 		data[i].comments[j]._id,
					group: 		[]
				}
				var postCommentGroup = {}
				postCommentGroup._id = groupId
				postCommentGroup.groupName = groupName
				comment.group[0] = postCommentGroup
				comments[j] = comment
			}
			post.comments = comments
			postsArr[i] = post
		}
		postsG.collection.insert(postsArr, function(err, data) {
			if (err) console.log(err)
			console.log('converted')
			mongoose.disconnect()
		})
	})
}

//create a global group called Stencil including all the original users
//this group is for testing
function createGroup () {
	userIds.find({}, function (err, users) {
		if (err) return handleError(err);
		var groupId = createRandom()
		var groupName = "Stencil Group"
		var StencilGroup = new group ({
			_id: 			groupId,
			name: 			groupName,
			type: 			['public'],
			description: 	'A group includes all the users except the duplicated ones',
			GroupMems: 		[]
		})
		for (var i in users) {
			var groupMem = {}
			groupMem._id = users[i]._id
			groupMem.userName = users[i].name
			groupMem.role = ['Group Member']
			StencilGroup.GroupMems.push(groupMem)
		}
		StencilGroup.save(function (err) {
			if (err) console.log(err)
			convertUsers(groupId, groupName, users)
		})
	})
}


function convert() {
	//As the previous simple forum does not involve group
	//So conversion starts from creating a global group
	//and it does not involve convertGroups()
	createGroup()
}

convert()