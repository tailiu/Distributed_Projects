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
var postsSchema = new Schema({
		ts: 	  	{ type: Date, default: new Date() },
		creator:    Schema.Types.Mixed,
		category: 	[],
		_id: 		String,
		content:	String,
		title:      String
	})
var posts = mongoose.model('posts', postsSchema);

//Create unique _id
function createRandom() {
	var current_date = (new Date()).valueOf().toString();
	var random = Math.random().toString();
	return crypto.createHash('sha1').update(current_date + random).digest('hex');
}
//Send posts back
function sendPosts() {

}

app.set('views', './views')
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
    	mongoose.connect('mongodb://localhost/simpleForum');	
		posts.find({}).sort('-ts').exec(function (err, data) {
			if (err) return handleError(err);
			//console.log(data)
			userIds.find({'name': username}, function (err, data1) {
				if (err) return handleError(err);
				mongoose.disconnect();
				res.render('homepage', {name: data1[0].name, meta: data1, posts: JSON.stringify(data)});
			})
		})
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

app.get('/homepage/all', function(req, res) {
	var user = JSON.parse(req.query.user)[0];
	console.log(user);
	mongoose.connect('mongodb://localhost/simpleForum');	
	posts.find({}).sort('-ts').exec(function (err, data) {
		if (err) return handleError(err);
		//console.log(data)
		userIds.find({'name': user.name}, function (err, data1) {
			if (err) return handleError(err);
			mongoose.disconnect();
			//console.log(data1[0].name)
			res.render('homepage', {name: data1[0].name, meta: data1, posts: JSON.stringify(data)});
		})
	})
});

app.get('/homepage/life', function(req, res) {
	var user = JSON.parse(req.query.user)[0];
	//console.log(user);
	mongoose.connect('mongodb://localhost/simpleForum');	
	posts.find({'category': 'life'}).sort('-ts').exec(function (err, data) {
		if (err) return handleError(err);
		//console.log(data)
		userIds.find({'name': user.name}, function (err, data1) {
			if (err) return handleError(err);
			mongoose.disconnect();
			//console.log(data1[0].name)
			res.render('homepage', {name: data1[0].name, meta: data1, posts: JSON.stringify(data)});
		})
	})
});

app.get('/homepage/study', function(req, res) {
	var user = JSON.parse(req.query.user)[0];
	//console.log(user);
	mongoose.connect('mongodb://localhost/simpleForum');	
	posts.find({'category': 'study'}).sort('-ts').exec(function (err, data) {
		if (err) return handleError(err);
		//console.log(data)
		userIds.find({'name': user.name}, function (err, data1) {
			if (err) return handleError(err);
			mongoose.disconnect();
			//console.log(data1[0].name)
			res.render('homepage', {name: data1[0].name, meta: data1, posts: JSON.stringify(data)});
		})
	})
});

app.get('/homepage/work', function(req, res) {
	var user = JSON.parse(req.query.user)[0];
	//console.log(user);
	mongoose.connect('mongodb://localhost/simpleForum');	
	posts.find({'category': 'work'}).sort('-ts').exec(function (err, data) {
		if (err) return handleError(err);
		//console.log(data)
		userIds.find({'name': user.name}, function (err, data1) {
			if (err) return handleError(err);
			mongoose.disconnect();
			//console.log(data1[0].name)
			res.render('homepage', {name: data1[0].name, meta: data1, posts: JSON.stringify(data)});
		})
	})
});

app.get('/homepage/logout', function(req, res) {
	var user = JSON.parse(req.query.user);
	//console.log(user)
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
		title:      title
	})
	mongoose.connect('mongodb://localhost/simpleForum');
	post.save(function (err) {
	  if (err) return handleError(err);
	  posts.find({}).sort('-ts').exec(function (err, data) {
			if (err) return handleError(err);
			//console.log(data)
			userIds.find({'name': creator.name}, function (err, data1) {
				if (err) return handleError(err);
				mongoose.disconnect();
				res.render('homepage', {name: data1[0].name, meta: data1, posts: JSON.stringify(data)});
			})
		})
	})
});

//Create server listening on port 3000 at localhost
var server = app.listen(3000, function () {
	var host = server.address().address;
	var port = server.address().port;
	console.log('Example app listening at http://%s:%s', host, port);
});