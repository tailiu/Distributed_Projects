var mongoose = require('mongoose')
var crypto = require('crypto')
var _ = require('underscore')

var Schema = mongoose.Schema

//db address before conversion
var dbAddr = 'mongodb://localhost/simpleForumGroup'
var conn1 = mongoose.createConnection(dbAddr)

//db address after conversion
var dbStencilAddr = 'mongodb://localhost/simpleForumStencil'
var conn2 = mongoose.createConnection(dbStencilAddr)

//The schemas and models of users, posts, groups before conversion
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
var userGIds = conn1.model('userGIds', userIdGSchema)
var postsG = conn1.model('postsG', postsGSchema)
var group = conn1.model('group', groupSchema)

//The schemas and models of users, groups and files after conversion
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
var userStencil = conn2.model('userStencil', userStencilSchema)
var fileStencil = conn2.model('fileStencil', fileStencilSchema)
var groupStencil = conn2.model('groupStencil', groupStencilSchema)

//convert files
function convertToStencilFiles() {
	postsG.find({}, function (err, data) {
		var fileArr = []
		for (var i in data) {
			var oneFile = new fileStencil ({
				ts: 		data[i].ts,
				_id: 		data[i]._id,
				name: 		data[i].title,
				creator: 	data[i].creator,
				type: 		['public'],
				readList: 	[],
				writeList: 	[],
				content: 	data[i].content,
				appSpecFileMeta: [],
				group: 		[]
			})
			oneFile.appSpecFileMeta.push({
				categories: 	data[i].category
			})
			for (var j=0; j < data[i].comments.length; j++) {
				oneFile.appSpecFileMeta.push(data[i].comments[j])
			}
			for (var j=0; j < data[i].group.length; j++) {
				oneFile.group.push({
					groupName: 	data[i].group[j].groupName, 
					_id: 		data[i].group[j]._id
				})
			}
			fileArr[i] = oneFile.toObject()
		}
		fileStencil.collection.insert(fileArr, function(err, result) {
			if (err) console.log(err)
			console.log('converted')
			mongoose.disconnect()
		})
	})
}

//convert users
function convertToStencilUsers() {
	userGIds.find({}, function (err, data) {
		if (err) console.log(err)
		var userArr = []
		for (var i in data) {
			var oneUser = new userStencil ({
				ts: 		data[i].ts,
				_id: 		data[i]._id,
				name: 		data[i].name,
				email: 		data[i].email,
				password: 	data[i].password,
				group: 		[]
			})
			oneUser.group = _.map(data[i].group, _.clone)
			userArr[i] = oneUser.toObject()
		}
		userStencil.collection.insert(userArr, function(err, result) {
			if (err) console.log(err)
			convertToStencilFiles()
		})
	})
}

//convert groups
function convertToStencilGroups() {
	group.find({}, function (err, data) {
		if (err) console.log(err)
		var groupArr = []
		for (var i in data) {
			var oneGroup = new groupStencil ({
				ts: 		data[i].ts,
				_id: 	  	data[i]._id, 
				name: 	  	data[i].name,
				type:    	data[i].type,
				description: 	data[i].description,
				groupMems: 	[]
			})
			oneGroup.groupMems = _.map(data[i].GroupMems, _.clone)
			groupArr[i] = oneGroup.toObject()
		}
		groupStencil.collection.insert(groupArr, function(err, result) {
			if (err) console.log(err)
			convertToStencilUsers()
		})
	})
}

function convert() {
	convertToStencilGroups()
}

convert()