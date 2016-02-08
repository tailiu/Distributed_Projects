var mongoose = require('mongoose');
var Schema = mongoose.Schema;
var crypto = require('crypto');

//db address
var dbAddr = 'mongodb://localhost:27017/simpleForumStencil'

var userGroupSchema =  new Schema({
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
	content: 		[],
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

exports.createUser = function (username, email, password, res) {
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
}

exports.getUserInfo = function (username, res) {
	mongoose.connect(dbAddr)
	userStencil.findOne({name: username}, function (err, user) {
		if (err) console.log(err)
		//console.log(user)
		mongoose.disconnect()
		response = "callback({'user':" + JSON.stringify(user) + "})"
		res.end(response)
	})
}

exports.updateUserInfo = function (username, groupName, option, res) {
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
}

//Send filtered files back
function sendFiles(whetherConnect, res, ufilters, ffilters, fsort) {
	if (!whetherConnect) {
		mongoose.connect(dbAddr)
	}
    if (ffilters.tags == 'all') {
    	fileStencil.find({'group._id':ffilters.groupID}).sort(fsort).exec(function (err, data) {
    		if (err) console.log(err)
    		mongoose.disconnect()
			response = "callback({'files':" + JSON.stringify(data) + "})"
			res.end(response)
		})
    } else {
		fileStencil.find({'content.tags': ffilters.tags, 'group._id':ffilters.groupID}).sort(fsort).exec(function (err, data) {
			if (err) console.log(err)
			mongoose.disconnect()
			response = "callback({'files':" + JSON.stringify(data) + "})"
			res.end(response)
		})
	}
}

exports.getFiles = function (username, groupID, tags, res) {
	var ufilters = {}
    var ffilters = {}
    var fsort = '-ts'
    if (tags == 'all' || tags == undefined) {
    	ffilters.tags = 'all'
    } else {
    	ffilters.tags = tags
    }
    ffilters.groupID = groupID
    ufilters.username = username
	sendFiles(false, res, ufilters, ffilters, fsort)
}

exports.updateFiles = function (username, replyTo, comment, postID, groupID, res) {
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
			if (user.group[i]._id == groupID) {
				var g = {}
				g._id = user.group[i]._id
				g.groupName = user.group[i].groupName
			}
		}
		newComment.group.push(g)
		fileStencil.findOneAndUpdate({'_id': postID}, 
									{$push: {"content": newComment}}, {new: true}, function(err, post){
		    if(err){
		        console.log("Something wrong when updating data!");
		    }
		    mongoose.disconnect()
			response = "callback({'updatedFile':" + JSON.stringify(post) + "})"
			res.end(response)
		})
	})
}

exports.createFiles = function (name, tag, content, username, groupID, res) {
	mongoose.connect(dbAddr)
	userStencil.findOne({name: username}, function (err, user) {
		groupStencil.findOne({'_id': groupID}, function(err, group){
			if (err) console.log(err)
			var newFile = new fileStencil({
				_id: 			createRandom(),
				ts: 			new Date(),
				name: 			name,
				creator: 		user,
				type: 			['public'],
				readList: 		[],
				writeList: 		[],
				content: 		[],
				group: 			[]
			})
			var t = {}
			var c = {}
			t.tags = tag
			c.content = content
			newFile.content.push(t)
			newFile.content.push(c)
			var groupMem = {}
			groupMem._id = group._id
			groupMem.groupName = group.name
			newFile.group.push(groupMem)
			newFile.save(function (err, data) {
				if (err) console.log(err)
				mongoose.disconnect()
				response = "callback({'result':'successful'})"
				res.end(response)
			})
		})
	})
}

exports.leaveOneGroup = function (username, groupName, res) {
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
}

exports.joinGroup = function (username, groupName, res) {
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
}

exports.createOneGroup = function (username, groupName, description, type, res) {
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
}

exports.getGroupInfoAssociatedWithOneUser = function (username, res) {
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
			response = "callback({'groups':" + JSON.stringify(groups) + "})"
			res.end(response)
		})
	})
}

exports.getGroupInfoByGroupName = function (groupName, res) {
	mongoose.connect(dbAddr)
	groupStencil.findOne({name: groupName}, function(err, group){
		if (err) console.log(err)
		mongoose.disconnect()
		response = "callback({'group':" + JSON.stringify(group) + "})"
		res.end(response)
	})
}