var express = require('express');
var querystring = require('querystring');
var bodyParser = require('body-parser')
var mongoose = require('mongoose');
var crypto = require('crypto');
var app = express();
var Schema = mongoose.Schema;
var userIdSchema = new Schema({
	_id: 	  	String, 
	name: 	  	String,
	email:    	String,
	password: 	String
})
var userIds = mongoose.model('userIds', userIdSchema);
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
var posts = mongoose.model('posts', postsSchema);
var dbAddr = 'mongodb://localhost/simpleForum'

//Create unique _id
function createRandom() {
	var current_date = (new Date()).valueOf().toString();
	var random = Math.random().toString();
	return crypto.createHash('sha1').update(current_date + random).digest('hex');
}
//Send posts back
function sendPosts(whetherConnect, res, dbAddr, pFilter, pSort, uFilter) {
	if (!whetherConnect) {
		mongoose.connect(dbAddr);
	}
	posts.find(pFilter).sort(pSort).exec(function (err, data) {
		if (err) return handleError(err);
		console.log(data)
		userIds.find(uFilter, function (err, data1) {
			if (err) return handleError(err);
			console.log(data1)
			mongoose.disconnect();
			res.render('homepage', {name: data1[0].name, meta: data1, posts: JSON.stringify(data)});
		})
	});
}

app.set('views', './views/jade')
app.set('view engine', 'jade')
app.use(bodyParser.json());       // to support JSON-encoded bodies
app.use(bodyParser.urlencoded({     // to support URL-encoded bodies
	extended: true
})); 

//Deal with the initial page
app.post('/initial-page', function(req, res) {
    var username = req.body.username;
    var password = req.body.password;
    var op = req.body.login
    if (op == undefined) {
    	res.render('register');
    } else {
		sendPosts(false, res, dbAddr, {}, '-ts', {'name': username});
    }
});

//Deal with register and then store new user info in the DB
app.post('/register', function(req, res) {
    mongoose.connect('mongodb://localhost/simpleForum');  
    var user = {
    	_id:      createRandom(),
		name:     req.body.username,
		email:    req.body.email,
		password: req.body.password
    }
    var userId = new userIds({
    	_id:      user._id,
		name: 	  user.name,
		email:    user.email,
		password: user.password
	})
	var userArr = []
	userArr[0] = user
	userId.save(function (err) {
		if (err) return handleError(err);
		//console.log("saved")
		posts.find({}).sort('-ts').exec(function (err, data) {
			if (err) return handleError(err);
			mongoose.disconnect();
			res.render('homepage', {name: user.name, meta: userArr, posts: JSON.stringify(data)});
		})
	}) 
});

//Show all the posts
app.get('/homepage/all', function(req, res) {
	var user = JSON.parse(req.query.user)[0];
	sendPosts(false, res, dbAddr, {}, '-ts', {'name': user.name});
});

//Show all the posts with category life
app.get('/homepage/life', function(req, res) {
	var user = JSON.parse(req.query.user)[0];
	sendPosts(false, res, dbAddr, {'category': 'life'}, '-ts', {'name': user.name});
});

//Show all the posts with category study
app.get('/homepage/study', function(req, res) {
	var user = JSON.parse(req.query.user)[0];
	sendPosts(false, res, dbAddr, {'category': 'study'}, '-ts', {'name': user.name});
});

//Show all the posts with category work
app.get('/homepage/work', function(req, res) {
	var user = JSON.parse(req.query.user)[0];
	sendPosts(false, res, dbAddr, {'category': 'work'}, '-ts', {'name': user.name});
});

//Deal with user logout
app.get('/homepage/logout', function(req, res) {
	var user = JSON.parse(req.query.user);
	res.end("<html> <header> BYE " + user.name + "! </header> </html>")
});

//Deal with new post
app.post('/homepage/newPost', function(req, res) {
	var creator = JSON.parse(req.body.user);
	var category = req.body.category;
	var content = req.body.content;
	var title = req.body.title;
	var post = new posts({
		creator:    creator,
		category: 	category,
		_id: 		createRandom(),
		content:	content,
		title:      title,
		comments:   []
	})
	mongoose.connect('mongodb://localhost/simpleForum');
	post.save(function (err) {
		if (err) return handleError(err);
		sendPosts(true, res, dbAddr, {}, '-ts', {'name': creator.name});
	})
});

//Add new comment to a post
app.post('/homepage/newComment', function(req, res) {
	var postID = req.body.postID
	var user = JSON.parse(req.body.user);
	var comment = req.body.comment
	var replyTo = req.body.replyTo
	var c1 = {creator: user, ts: Date(), content: comment, replyTo: replyTo}
	//console.log(c1.ts)
	mongoose.connect('mongodb://localhost/simpleForum');
	posts.findOne({'_id': postID}, function (err, post) {
  		if (err) return handleError(err);
		post.comments.push(c1)
		//console.log(post)
		post.save(function (err) {
			if (err) return handleError(err)
			//console.log('Success!');
			sendPosts(true, res, dbAddr, {}, '-ts', {'name': user.name});
		});
	})
});

//Create server listening on port 3000 at localhost
var server = app.listen(3000, function () {
	var host = server.address().address;
	var port = server.address().port;
	console.log('Example app listening at http://%s:%s', host, port);
});