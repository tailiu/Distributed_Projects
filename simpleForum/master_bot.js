const stencil = require('./stencil')
const util = require('./util')
const lockfile = require('proper-lockfile')

const syncCycle = 3000

var userID = process.argv[2]
var groupName = process.argv[3]
var host = process.argv[4]

var masterView = util.masterView
var repoPath = util.getClonedRepoPath(groupName, userID)
var postsFileName = util.getDownloadedPostsFileName(groupName, masterView)
var postsFilePath = util.getDownloadedFilePath(userID, postsFileName)

var done = true

function lockAndUpdateFile() {
	lockfile.lock(postsFilePath, function(err, release) {
		if (err) {
			setTimeout(function(){
	    		lockAndUpdateFile()
	    	}, backoffTime)
		} else {
			var updated = stencil.syncRepo(repoPath, host)
			if (updated) {
				util.downloadPosts(groupName, userID, masterView, function() {
					release()
				})
			} else {
				release()
			}
		}
	})
}

setInterval(function () {
	lockAndUpdateFile()
}, syncCycle)