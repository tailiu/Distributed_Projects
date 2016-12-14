const stencil = require('WebStencil')
const fs = require('graceful-fs')
const crypto = require('crypto')
const mkdirp = require('mkdirp')
const lineByLine = require('n-readlines') 
const lockfile = require('proper-lockfile') 
const _ = require('underscore')
const childProcess = require('child-proc')

const clonedReposDir = 'cloned_repos'
const downloadedFilesDir = 'downloaded_files'
const postsMetaFile = 'posts_meta'
const postsFile = 'posts'
const masterView = 'master'
const uploadedFilesDir = 'uploaded_files'
const branchLocksDir = 'branch_locks'
const rulesFile = 'rules'

function getClonedReposDir(userID, ok) {
	return userID + '/' + clonedReposDir
}

function getFilePathInRepo(repoPath, relativeFilePathInRepo) {
	return repoPath + '/' + relativeFilePathInRepo
}

function getHost(userID, groupName) {
	return userID + '-' + groupName
}

function getDownloadedFilePath(userID, fileName) {
	return userID + '/' + downloadedFilesDir + '/' + fileName
}

function getUploadedFilesDir(userID) {
	return userID + '/' + uploadedFilesDir
}

function getDownloadedPostsFileName(groupName, view) {
	return groupName + ':' + view + ':' + postsFile
}

function getClonedRepoPath(groupName, userID) {
	var clonedRepoDir = getClonedReposDir(userID)
	return clonedRepoDir + '/' + groupName
}

function createTmpFile(fileDir, content, callback) {
	crypto.randomBytes(32, function(err, buf) {
		var fileName = buf.toString('hex')

		if (!fs.existsSync(fileDir)) {
			mkdirp.sync(fileDir)
		} 
		filePath = fileDir + '/' + fileName
		fs.writeFile(filePath, content, function(err) {
			callback(filePath)
		})
	})
}

function getJSONFileContentLocally(filePath, callback) {
	if (!fs.existsSync(filePath)) {
		callback(undefined)
	}
	fs.readFile(filePath, 'utf8', function(err, unprocessedFileContent) {
		if (unprocessedFileContent == undefined) {
			callback(undefined)
		} else {
			callback(JSON.parse(unprocessedFileContent))
		}
	})
}

function lock(filePath, callback) {
	var backoffTime = _.random(0, 1000)

	lockfile.lock(filePath, function(err, release) {
		if (err) {
			console.log(process.pid + ' failed to lock ' + filePath + ' ' + err.toString())
			setTimeout(function(){
	    		lock(filePath, callback)
	    	}, backoffTime)
		} else {
			console.log(process.pid + ' locks ' + filePath)
			callback(release)
		}
	})
}

function getFileNameFromFilePath(path) {
	var parts = path.split('/')
	var fileName = parts[parts.length - 1]
	return fileName
}

function getFileDirFromFilePath(path, fileName) {
	return path.replace(fileName, '')
}

//master view name
exports.masterView = masterView

exports.postsMetaFile = postsMetaFile

exports.getRandomByRange = function(min, max) {
	return _.random(min, max)
}

exports.getRulesFilePath = function(userID, groupName) {
	var clonedRepoPath = getClonedRepoPath(groupName, userID)
	return clonedRepoPath + '/' + rulesFile
}

exports.getHost = function(userID, groupName) {
	return getHost(userID, groupName)
}

exports.getClonedReposDir = function(userID) {
	return getClonedReposDir(userID)
}

exports.getFilePathInRepo = function(repoPath, relativeFilePathInRepo) {
	return getFilePathInRepo(repoPath, relativeFilePathInRepo)
}

exports.getBranchLockFilePath = function(userID, groupName) {
	return userID + '/' + branchLocksDir + '/' + groupName
}

exports.getClonedRepoPath = function(groupName, userID) {
	return getClonedRepoPath(groupName, userID)
}

exports.getDownloadedPostsFileName = function(groupName, view) {
	return getDownloadedPostsFileName(groupName, view)
}

exports.getDownloadedFilePath = function(userID, fileName) {
	return getDownloadedFilePath(userID, fileName)
}

exports.getJSONFileContentLocally = function(filePath, callback) {
	getJSONFileContentLocally(filePath, callback)
}

exports.downloadPosts = function(groupName, userID, view, downloadClient, callback) {
	var repoPath = getClonedRepoPath(groupName, userID)
	var postsMetaFilePath = getFilePathInRepo(repoPath, postsMetaFile)

	getJSONFileContentLocally(postsMetaFilePath, function(postsMetaContent) {
		var postsFileName = getDownloadedPostsFileName(groupName, view)
		var postsFilePath = getDownloadedFilePath(userID, postsFileName)
		stencil.getFileFromTorrent(postsMetaContent.seeds, postsFilePath, downloadClient, function() {

			getJSONFileContentLocally(postsFilePath, function(posts) {
				callback(posts)
			})
		})
	})
}

exports.keepNewCommitAndRemoveOldOne = function(filePath, callback) {
	var liner = new lineByLine(filePath)

	var line
	var content = ''
	var find = false

	while (line = liner.next()) {
		var str = line.toString('ascii')
		str = str.trim()
		if (str.indexOf('<<<<<<< HEAD') != -1 ) {
			find = true
			continue
		} else if (str.indexOf('=======') != -1 ) {
			find = false
			continue
		} else if (str.indexOf('>>>>>>>') != -1 ) {
			break 
		}
		if (!find) {
			content += str + '\n'
		}
	}

	fs.writeFile(filePath, content, function(err) {
		callback()
	})
}

exports.createOrUpdatePosts = function(groupName, userID, content, option, view, seedClient, callback) {
	var fileDir = getUploadedFilesDir(userID)
	var host = getHost(userID, groupName)
	var repoPath = getClonedRepoPath(groupName, userID)

	createTmpFile(fileDir, JSON.stringify(content), function(filePath) {
		stencil.createFileInTorrent(filePath, seedClient, function(filemeta) {
			var postsMetaFilePath = getFilePathInRepo(repoPath, postsMetaFile)
			stencil.writeFileToRepo(postsMetaFilePath, JSON.stringify(filemeta), option, host, view, function(err) {
				callback(err)
			})
		})
	})
}

exports.lock = function(filePath, callback) {
	lock(filePath, callback)
}

exports.createJSONFileLocally = function(filePath, content, callback) {
	var fileName = getFileNameFromFilePath(filePath)
	var fileDir = getFileDirFromFilePath(filePath, fileName)

	mkdirp.sync(fileDir)

	fs.writeFile(filePath, JSON.stringify(content), function(err){
		callback()
	})
}

exports.filterPosts = function(posts, filterKeyWords) {
	var removeValFromIndex = []
	for (var i in posts) {
		if (posts[i].title.indexOf(filterKeyWords) != -1 || posts[i].pContent.indexOf(filterKeyWords) != -1) {
			removeValFromIndex.push(i)
		}
	}
	for (var i = removeValFromIndex.length - 1; i >= 0; i--) {
		posts.splice(removeValFromIndex[i], 1)
	}
	return posts
}

exports.createRandom = function() {
	var current_date = (new Date()).valueOf().toString()
	var random = Math.random().toString()
	return crypto.createHash('sha1').update(current_date + random).digest('hex')
}
