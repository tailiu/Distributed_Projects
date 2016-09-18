const stencil = require('./stencil')
const util = require('./util')

const syncCycle = 3000

var view = process.argv[2]
var userID = process.argv[3]
var groupName = process.argv[4]
var filterKeyWords = process.argv[5]

var host = util.getHost(userID, groupName)
var masterView = util.masterView
var repoPath = util.getClonedRepoPath(groupName, userID)
var masterViewPostsFileName = util.getDownloadedPostsFileName(groupName, masterView)
var masterViewPostsFilePath = util.getDownloadedFilePath(userID, masterViewPostsFileName)
var viewPostsFileName = util.getDownloadedPostsFileName(groupName, view)
var viewPostsFilePath = util.getDownloadedFilePath(userID, viewPostsFileName)
var branchLockFilePath = util.getBranchLockFilePath(userID, groupName)
var postsMetaFilePath = util.getFilePathInRepo(repoPath, util.postsMetaFile)


function pushToRemoteBranch(posts, callback) {
	util.createOrUpdatePosts(groupName, userID, posts, 'update', view, function(err) {

		util.lock(viewPostsFilePath, function(releaseViewPostsFileLock){
			
			if (err == null) {
				util.createJSONFileLocally(viewPostsFilePath, posts, function(){
					releaseViewPostsFileLock()
					callback()
				})
			} else {
				//If there is some other guy who pushes before me, just keep his version...
				stencil.syncLocalAndRemoteBranches(repoPath, host, view, function(err, result) {
					util.keepNewCommitAndRemoveOldOne(postsMetaFilePath, function(){
						util.downloadPosts(groupName, userID, view, function() {
							releaseViewPostsFileLock()
							callback()
						})
					})
				})
			}
		})
	})
}

function lockAndMergeFile() {
	util.lock(branchLockFilePath, function(releaseBranchLock) {

		stencil.changeBranch(repoPath, view, function(err) {
			if (err == null) {
				stencil.mergeBranch(repoPath, masterView, function(err, result) {
					//If master branch has new commits
					if (err != null) {
						//Download the lastest posts from master branch
						util.lock(masterViewPostsFilePath, function(releaseMasterViewPostsLock) {
							util.getJSONFileContentLocally(masterViewPostsFilePath, function(masterViewPosts) {
								releaseMasterViewPostsLock()

								var filteredPosts = util.filterPosts(masterViewPosts, filterKeyWords)

								//Push the filtered results to the remote branch
								pushToRemoteBranch(filteredPosts, function(){
									releaseBranchLock()
								})
							})
						})
					} else {
						releaseBranchLock()
					}
				})
			} else {
				releaseBranchLock()
			}
		})
	})
}

setInterval(function () {
	lockAndMergeFile()
}, syncCycle)

process.on('message', function (msg) {
    if (msg === 'shutdown') {
    	exit(0)
    }
})
