var stencil = require('./stencil')
var util = require('./util')

var view = process.argv[2]
var userID = process.argv[3]
var groupName = process.argv[4]
var host = process.argv[5]
var filterKeyWords = process.argv[6]

var repoPath = util.getClonedRepoPath(groupName, userID)

stencil.mergeBranch()
