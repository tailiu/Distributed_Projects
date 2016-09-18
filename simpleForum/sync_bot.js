const stencil = require('./stencil')
const util = require('./util')

const syncCycle = 3000

var userID = process.argv[2]
var groupName = process.argv[3]
var view = process.argv[4]

var host = util.getHost(userID, groupName)
var repoPath = util.getClonedRepoPath(groupName, userID)
var postsFileName = util.getDownloadedPostsFileName(groupName, view)
var postsFilePath = util.getDownloadedFilePath(userID, postsFileName)
var branchLockFilePath = util.getBranchLockFilePath(userID, groupName)

function lockAndUpdateFile() {

	util.lock(branchLockFilePath, function(releaseBranchLock) {

		stencil.changeBranch(repoPath, view, function(err) {
			if (err == null) {
				stencil.syncLocalAndRemoteBranches(repoPath, host, view, function(err, result) {
					if (err == null) {
						//If new changes are fetched, update the downloaded posts
						if (result.indexOf('Already up-to-date') == -1) {
							util.lock(postsFilePath, function(releasePostFileLock) {
								util.downloadPosts(groupName, userID, view, function() {
									releaseBranchLock()
									releasePostFileLock()
								})
							})
						} 
						else {
							releaseBranchLock()
						}
					} 
					//Git pull host branch might fail because of unmerged files
					else {
						releaseBranchLock()
					}
				})
			} 
			//Change branch might fail because of unmerged files
			else {
				releaseBranchLock()
			}
		})
	})	
}


setInterval(function () {
	lockAndUpdateFile()
}, syncCycle)
