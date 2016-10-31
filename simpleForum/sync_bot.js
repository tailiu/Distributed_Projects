const stencil = require('WebStencil')
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


/*
	Sync bot logic:
	lock branch -> change to view -> sync the local view with remote view 
	-> if not already up-to-date locally, update locally
*/

function lockAndUpdateFile() {
	process.send(process.pid + ' sync bot, tries to lock branch ' + branchLockFilePath)
	util.lock(branchLockFilePath, function(releaseBranchLock) {

		stencil.changeBranch(repoPath, view, function(err) {
			if (err == null) {
				stencil.syncLocalAndRemoteBranches(repoPath, host, view, function(err, result) {
					if (err == null) {
						//If new changes are fetched, update the downloaded posts
						if (result.indexOf('Already up-to-date') == -1) {
							process.send(process.pid + ' sync bot, tries to lock ' + postsFilePath)
							util.lock(postsFilePath, function(releasePostFileLock) {
								process.send(process.pid + ' prior to downloading')

								var downloadReqID = util.createRandom()

								var req = {}
								req.type = 'download'
								req.groupName = groupName
								req.userID = userID
								req.view = view
								req.id = downloadReqID

								process.send(req)

								process.on('message', function(msg) {
									if (msg.type == 'Download Succeeded' && msg.id == downloadReqID) {
										process.send(process.pid + ' finish downloading')
										process.send('finish ' + process.pid + ' sync bot, unlock branch ' + branchLockFilePath)
										releaseBranchLock()
										process.send('finish ' + process.pid + ' sync bot, unlock ' + postsFilePath)
										releasePostFileLock()
									}
								})
							})
						} 
						else {
							process.send('finish ' + process.pid + ' sync bot, unlock branch ' + branchLockFilePath)
							releaseBranchLock()
						}
					} 
					//Git pull host branch might fail because of unmerged files
					else {
						process.send('finish ' + process.pid + ' sync bot, unlock branch ' + branchLockFilePath)
						releaseBranchLock()
					}
				})
			} 
			//Change branch might fail because of unmerged files
			else {
				process.send('finish ' + process.pid + ' sync bot, unlock branch ' + branchLockFilePath)
				releaseBranchLock()
			}
		})
	})	
}


setInterval(function () {
	lockAndUpdateFile()
}, syncCycle)


process.once('SIGINT', function(){
	process.exit(1)
})
process.once('SIGTERM', function(){
	process.exit(1)
})