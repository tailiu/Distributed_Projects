var stencil = require('./stencil')
var fs = require('graceful-fs')
var crypto = require('crypto')

const clonedReposDir = 'cloned_repos'
const downloadedFilesDir = 'downloaded_files'
const postsMetaFile = 'posts_meta'
const postsFile = 'posts'
const masterView = 'master'

function getClonedReposDir(userID, ok) {
	return userID + '/' + clonedReposDir
}

function getFilePathInRepo(repoPath, relativeFilePathInRepo) {
	return repoPath + '/' + relativeFilePathInRepo
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

function getDownloadedFilePath(userID, fileName) {
	return userID + '/' + downloadedFilesDir + '/' + fileName
}

function getDownloadedPostsFileName(groupName, view) {
	return groupName + ':' + view + ':' + postsFile
}

function getClonedRepoPath(groupName, userID) {
	var clonedRepoDir = getClonedReposDir(userID)
	return clonedRepoDir + '/' + groupName
}


exports.masterView = masterView

exports.postsMetaFile = postsMetaFile

exports.getClonedReposDir = function(userID) {
	return getClonedReposDir(userID)
}

exports.getFilePathInRepo = function(repoPath, relativeFilePathInRepo) {
	return getFilePathInRepo(repoPath, relativeFilePathInRepo)
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

exports.downloadPosts = function(groupName, userID, view, callback) {
	var repoPath = getClonedRepoPath(groupName, userID)
	var postsMetaFilePath = getFilePathInRepo(repoPath, postsMetaFile)

	getJSONFileContentLocally(postsMetaFilePath, function(postsMetaContent) {
		var postsFileName = getDownloadedPostsFileName(groupName, view)
		var postsFilePath = getDownloadedFilePath(userID, postsFileName)
		stencil.getFileFromTorrent(postsMetaContent.seeds, postsFilePath, function() {

			getJSONFileContentLocally(postsFilePath, function(posts) {
				callback(posts)
			})
		})
	})
}