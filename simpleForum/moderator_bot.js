const stencil = require('WebStencil')
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

/*
	pushToRemoteLogic:
	lock the posts file for the view -> send request to master bot to ask it
	to upload the filtered posts 
		-> if no upload err, update the posts file. Done
		-> if upload errs, it means there is some other guy who pushes before me,
		just keep his version and give up mine. Done

*/

function pushToRemoteBranch(posts, callback) {

	util.lock(viewPostsFilePath, function(releaseViewPostsFileLock){

		var downloadReqID = util.createRandom()
		var uploadReqID = util.createRandom()

		var req = {}
		req.type = 'upload'
		req.groupName = groupName
		req.userID = userID
		req.posts = posts
		req.view = view
		req.uploadType = 'update'
		req.id = uploadReqID

		process.send(req)

		process.on('message', function(msg) {
			if (msg.type == 'Upload Succeeded' && msg.id == uploadReqID) {
				var err = msg.err

				if (err == null) {
					util.createJSONFileLocally(viewPostsFilePath, posts, function(){
						releaseViewPostsFileLock()
						callback()
					})
				} else {
					//If there is some other guy who pushes before me, just keep his version...
					stencil.syncBranch(repoPath, host, view, function(err, result) {
						util.keepNewCommitAndRemoveOldOne(postsMetaFilePath, function() {

							var req = {}
							req.type = 'download'
							req.groupName = groupName
							req.userID = userID
							req.view = view
							req.id = downloadReqID

							process.send(req)
						})
					})
				}
			} else if (msg.type == 'Download Succeeded' && msg.id == downloadReqID) {
				releaseViewPostsFileLock()
				callback()
			}
		})
	})
}

/*
	Moderator bot logic:
	lock branch -> change branch -> merge current branch with master branch
	-> lock master branch posts file(outside repo) -> get posts of master branch
	-> filter the posts based on the rule-> call pushToRemoteBranch() to push 
	filterd results to remote branch 
	

	The reason why I maintain a file containing posts for each branch outside the repo
	is that when, periodically, web page needs to be refreshed, just read this file to get
	the posts. So no need to download the post file each time, since repo only stores metadata.
	You can also use other methods, for example, use a file to store the change status 
	rather than the posts. Those methods all have their own pros and cons.

*/

function lockAndMergeFile() {
	process.send(process.pid + ' moderator bot, tries to lock branch ' + branchLockFilePath)
	util.lock(branchLockFilePath, function(releaseBranchLock) {

		stencil.changeBranch(repoPath, view, function(err) {
			if (err == null) {
				stencil.mergeBranch(repoPath, masterView, function(err, result) {
					//If master branch has new commits, these commits cause unmerged errors.
					if (err != null) {
						//Download the lastest posts from master branch
						process.send(process.pid + ' moderator bot, tries to lock ' + masterViewPostsFilePath)
						util.lock(masterViewPostsFilePath, function(releaseMasterViewPostsLock) {
							util.getJSONFileContentLocally(masterViewPostsFilePath, function(masterViewPosts) {
								process.send('finish first' + process.pid + ' moderator bot, unlock ' + masterViewPostsFilePath)
								releaseMasterViewPostsLock()

								var filteredPosts = util.filterPosts(masterViewPosts, filterKeyWords)

								//Push the filtered results to the remote branch
								pushToRemoteBranch(filteredPosts, function(){
									process.send('finish second' + process.pid + ' moderator bot, unlock branch ' + branchLockFilePath)
									releaseBranchLock()
								})
							})
						})
					}
					//Master branch might also have some commits, but these commits do not cause errors.
					//For example, add member to the member list. Merge can be made by the 'recursive' strategy automatically
					else {
						process.send('finish ' + process.pid + ' moderator bot, unlock branch ' + branchLockFilePath)
						releaseBranchLock()
					}
				})
			} else {
				process.send('finish ' + process.pid + ' moderator bot, unlock branch ' + branchLockFilePath)
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


process.once('SIGINT', function(){
	process.exit(1)
})
process.once('SIGTERM', function(){
	process.exit(1)
})
