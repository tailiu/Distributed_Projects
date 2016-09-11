var kad = require('kad')
var childProcess = require('child-proc')
var fs = require('graceful-fs')
var WebTorrent = require('webtorrent')
var os = require('os')
var lineByLine = require('n-readlines')
var mkdirp = require('mkdirp')
var _ = require('underscore')

const adminRepo = 'gitolite-admin'
const confDir = '/gitolite-admin/conf/'
const confFile = 'gitolite.conf'
const keyDir = '/gitolite-admin/keydir/'
const knownHostsPath = '/home/' + findCurrentAccount() + '/.ssh/known_hosts'
const SSHPkPath = '/home/' + findCurrentAccount() + '/.ssh/id_rsa.pub'
const SSHKeysDir = '/home/' + findCurrentAccount() + '/.ssh/'
const SSHConfig = '/home/' + findCurrentAccount() + '/.ssh/config'

exports.createDHTNode = function(nodeAddr, nodePort, db, callback) {
  var DHTNode = new kad.Node({
  transport: kad.transports.UDP(kad.contacts.AddressPortContact({
    address: nodeAddr,
    port: nodePort
    })),
    storage: kad.storage.FS(db)
  })
  callback(DHTNode)
}

exports.putValueOnDHT = function(DHTNode, DHTSeed, key, value, callback) {
  DHTNode.connect(DHTSeed, function(err) {
    DHTNode.put(key, value, function() {
        callback()
    })
  })
}

exports.getValueFromDHT = function(DHTNode, DHTSeed, key, callback) {
  DHTNode.connect(DHTSeed, function(err) {
    DHTNode.get(key, function(err, value) {
        callback(value)
    })
  })
}

//find current account on the machine
function findCurrentAccount() {
  var account = childProcess.execSync('whoami')
  account = (account + '').replace(/(\r\n|\n|\r)/gm,"")
  return account
}

function getLocalIpAddr() {
  var networkInterfaces = os.networkInterfaces( )
  return networkInterfaces.eth0[0].address
}

exports.syncRepo = function(repoPath, host) {
  var command = 'cd ' + repoPath + '\ngit pull ' + host + ' master\n'
  var result = childProcess.execSync(command)

  if (result.toString().indexOf('Already up-to-date') != -1) {
    return false
  } else {
    return true
  }
}

exports.getFileFromRepo = function (filePath) {
  var fileName = getFileNameFromFilePath(filePath)
  var fileDir = getFileDirFromFilePath(filePath, fileName)

  var command = 'cd ' + fileDir + '\ngit branch\n'
  var result = childProcess.execSync(command)
  if (result == '') {
    return undefined
  }

  var command1 = 'cd ' + fileDir + '\ngit pull origin master\n'
  childProcess.execSync(command1)

  if (!fs.existsSync(filePath)) {
    return undefined
  }

  return fs.readFileSync(filePath, 'utf8')
}

function getFileNameFromFilePath(path) {
  var parts = path.split('/')
  var fileName = parts[parts.length - 1]
  return fileName
}

function getFileDirFromFilePath(path, fileName) {
  return path.replace(fileName, '')
}

function pushToGitRepo(fileDir, fileName, comment, host, conflictsResolution, callback) {
  try {
    var command = 'cd '+ fileDir + '\ngit add ' +  fileName 
        + '\ngit commit -m "' + comment + '"\ngit push ' + host + ' master\n'
    childProcess.execSync(command)
    var retry = false
    callback(retry)
  } catch (err) {
    conflictsResolution(err, fileDir, fileName, host, callback)
  } 
}

exports.createOrUpdateFileInRepo = function(filePath, content, option, host, conflictsResolution, callback) {
  var fileName = getFileNameFromFilePath(filePath)
  var fileDir = getFileDirFromFilePath(filePath, fileName)
  
  mkdirp.sync(fileDir)

  fs.writeFile(filePath, content, function(err) {
    var comment = option + ' file ' + fileName
    pushToGitRepo(fileDir, fileName, comment, host, conflictsResolution, callback)
  })
}

exports.createFileInTorrent = function(filePath, callback) {
  var filemeta = {}
  var torrent = new WebTorrent({ dht: false, tracker: false })

  filemeta.createTs = new Date()
  
  torrent.seed(filePath , function (value) {
    filemeta.seeds = []
    filemeta.seeds[0] = {}
    filemeta.seeds[0].infoHash = value.infoHash
    filemeta.seeds[0].ipAddr = getLocalIpAddr()
    filemeta.seeds[0].torrentPort = torrent.torrentPort

    callback(filemeta)
  })
  
}

exports.getFileFromTorrent = function (torrentSeeds, downloadedFilePath, callback) {
  var fileName = getFileNameFromFilePath(downloadedFilePath)
  var fileDir = getFileDirFromFilePath(downloadedFilePath, fileName)

  mkdirp.sync(fileDir)

  var ws = fs.createWriteStream(downloadedFilePath)
  var torrent = new WebTorrent({ dht: false, tracker: false })
  var tor = torrent.add(torrentSeeds[0].infoHash)
  var rs

  tor.addPeer(torrentSeeds[0].ipAddr + ':' + torrentSeeds[0].torrentPort)
  torrent.on('torrent', function (value) {
    rs = value.files[0].createReadStream()
    rs.pipe(ws)
    tor.on('done', function () {
      rs.on('end', function () {
        callback()
      })
    })
  })
}


function getAdminRepoPath(adminRepoDir) {
  return adminRepoDir + '/' + adminRepo
}

function getConfFilePath(adminRepoDir) {
  return adminRepoDir + confDir + confFile
}

exports.createRepo = function(adminRepoDir, repoName, addedkeyName, host) {
  var adminRepoPath = getAdminRepoPath(adminRepoDir)
  var confFilePath = getConfFilePath(adminRepoDir)
  var data = 'repo ' + repoName + '\n' + 'RW+ = ' + addedkeyName + '\n'
  var command = 'cd ' + adminRepoPath + '\ngit add -A :/\ngit commit -m "' + 'add repo ' + repoName + '"\n'
        + 'git push ' + host + ' master\n'
  fs.appendFileSync(confFilePath, data)
  childProcess.execSync(command)
}

function addRemote(repoPath, keyName, repoName) {
  var command = 'cd ' + repoPath + '\ngit remote add ' + keyName + ' '  + keyName + ':' + repoName + '\n'
  childProcess.execSync(command)
}

function replaceKey(adminRepoDir, keyName) {
  var confPath = adminRepoDir + confDir + confFile
  var adminRepoKeyDir = adminRepoDir + keyDir
  var liner = new lineByLine(confPath)
  var line
  var content = ''
  var find = false
  while (line = liner.next()) {
    var str = line.toString('ascii')
    str = str.trim()
    if (find && str.indexOf(keyName) != -1) {
      return
    }
    if (!find) {
        content += line.toString('ascii') + '\n'
        str = str.replace(/\s\s+/g, ' ')
        str = str.split(' ')
        if (str[1] == 'gitolite-admin') {
        find = true
        }
    } else {
        str = str.split('=')
        content += str[0].trim() + ' = ' + keyName + '\n'
        find = false
    }
  }
  fs.writeFileSync(confPath, content)

  var files = fs.readdirSync(adminRepoKeyDir, 'utf8')
  var command = 'cp ' + SSHKeysDir + keyName + '.pub ' + adminRepoKeyDir +
      keyName + '.pub\ncd ' + adminRepoKeyDir + '\nrm ' + files[0]
      + '\ngit add -A :/\n' + 'git commit -m "change changePulicKeyFileName"\n'
      + 'git push origin master\n'
  childProcess.execSync(command)
}

function addEntryToConfig(remoteAdminRepoServer, keyName, host) {
  var command = 'touch ' + SSHConfig
  childProcess.execSync(command)

  if (getServerAddrFromConfig(host) == undefined) {
    var user = remoteAdminRepoServer.split('@')[0]
    var hostName = remoteAdminRepoServer.split('@')[1]
    var data = 'Host ' + host + '\nHostName ' + hostName + '\nUser ' + user + '\nIdentityFile ' 
                + SSHKeysDir + keyName + '.pub\nIdentitiesOnly yes\n'
    fs.appendFileSync(SSHConfig, data)
  }
}

function cloneRepo(remoteRepoLocation, localRepoDir, host, keyName, type) {
  mkdirp.sync(localRepoDir)

  addEntryToConfig(remoteRepoLocation.split(':')[0], keyName, host)

  var repoName = remoteRepoLocation.split(':')[1]
  if (type == 'host in config') {
    var command = 'cd ' + localRepoDir + '\ngit clone ' + host + ':' + repoName + '\n'
    childProcess.execSync(command)
  } else if (type == 'remote location') {
    var command = 'cd ' + localRepoDir + '\ngit clone ' + remoteRepoLocation + '\n'
    childProcess.execSync(command)
  }
  
  addRemote(localRepoDir + '/' + repoName, host, repoName)
}

exports.cloneRepo = function(remoteRepoLocation, localRepoDir, host, keyName) {
  cloneRepo(remoteRepoLocation, localRepoDir, host, keyName, 'host in config')
}

exports.setUpAdminRepoLocally = function(remoteAdminRepoServer, localAdminRepoDir, keyName, host) {
  var localAdminRepoPath = localAdminRepoDir + '/' + adminRepo
  var remoteAdminRepoPath = remoteAdminRepoServer + ':' + adminRepo

  if (!fs.existsSync(localAdminRepoPath)) {
    cloneRepo(remoteAdminRepoPath, localAdminRepoDir, host, keyName, 'remote location')
    replaceKey(localAdminRepoDir, keyName)
  }
}

function updateConfig(adminRepoDir, repoName, keyName, host) {
  var conFilePath = adminRepoDir + confDir + confFile
  var liner = new lineByLine(conFilePath)
  var find = false
  var content = ''

  while (line = liner.next()) {
    var str = line.toString('ascii')
    str = str.trim()
    if (!find) {
      var parts = str.split(' ')
      if (parts.length < 2) {
        continue
      }
      var repo = str.split(' ')[1]
      if (repo == repoName) {
        find = true
      }
      content += str + '\n'
    } else {
      content += str + ' ' + keyName + '\n'
      find = false
    }
  }
  fs.writeFileSync(conFilePath, content)
  var confDirPath = adminRepoDir + confDir
  var command = 'cd ' + confDirPath + '\n'
      + 'git add -A :/\n' + 'git commit -m "update config file"\n' 
      + 'git push ' + host + ' master\n'
  childProcess.execSync(command)
}

function addKey(adminRepoDir, key, keyName) {
  var keyFilePath = adminRepoDir + keyDir + keyName + '.pub'
  if (fs.existsSync(keyFilePath)) {
    return
  }
  fs.writeFileSync(keyFilePath, key)
}

exports.addKeyAndUpdateConfigFileInAdminRepo = function(adminRepoDir, SSHPublicKey, keyName, repoName, host) {
  addKey(adminRepoDir, SSHPublicKey, keyName)
  updateConfig(adminRepoDir, repoName, keyName, host)
}

function getServerAddrFromConfig(hostToFind) {
  var liner = new lineByLine(SSHConfig)
  var find = false
  var hostName
  var line

  while (line = liner.next()) {
    var str = line.toString('ascii')
    str = str.trim()
    if (!find) {
      var host = str.split(' ')[1]
      if (host == hostToFind) {
        find = true
      }
    } else {
      if (str.split(' ')[0] == 'HostName') {
        hostName = str.split(' ')[1]
      } else if (str.split(' ')[0] == 'User') {
        return str.split(' ')[1] + '@' + hostName
      }
    }
  }

  return undefined
}

exports.getServerAddr = function(repoPath) {
  var command = 'cd ' + repoPath + '\ngit config --get remote.origin.url\n'
  var remoteOriginUrl = childProcess.execSync(command)
  return getServerAddrFromConfig(remoteOriginUrl.toString().split(':')[0]) 
}

exports.getKnownHostKey = function(serverAddrWithoutUserAccount) {
  var command = 'ssh-keygen -F ' + serverAddrWithoutUserAccount + '\n'
  var value = childProcess.execSync(command)
  var key = value.toString().split('\n')[1]
  return key + '\n'
}

exports.checkAndAddKnownHostKey = function(serverAddrWithoutUserAccount, knownHostsKey) {
  if (fs.existsSync(knownHostsPath)) {
      var checkKnownHosts = 'ssh-keygen -F ' + serverAddrWithoutUserAccount
      var checkResult = childProcess.execSync(checkKnownHosts)
      if (checkResult.toString() == null) {
        fs.appendFileSync(knownHostsPath, knownHostsKey)
      }
  } else {
      childProcess.execSync('touch ' + knownHostsPath)
      fs.appendFileSync(knownHostsPath, knownHostsKey)
  }
}

function removeStarInBranchName(branches) {
  for (var i in branches) {
    if (branches[i].indexOf('*') != -1) {
      branches[i] = branches[i].replace('* ', '')
      return branches
    }
  }
}

exports.getAllBranches = function(repoPath) {
  var command = 'cd ' + repoPath + '\ngit branch\n'
  var branches = childProcess.execSync(command)

  var branchArray = branches.toString().split('\n')
  branchArray = branchArray.slice(0, branchArray.length - 1)
  branchArray = removeStarInBranchName(branchArray)

  return branchArray
}

exports.getCurrentBranch = function(repoPath) {
  try {
    var command = 'cd ' + repoPath + '\ngit rev-parse --abbrev-ref HEAD\n'
    var currentBranch = childProcess.execSync(command)
    currentBranch = currentBranch.toString().split('\n')
    return _.first(currentBranch)
  } catch(err) {
    return undefined
  }
}

exports.createBranch = function(repoPath, branchName) {
  try {
    var command = 'cd ' + repoPath + '\ngit branch ' + branchName + '\n'
    var currentBranch = childProcess.execSync(command)
    return null
  } catch(err) {
    return err.stdout.toString()
  }
}

exports.mergeBranch = function(repoPath, branchName) {

}
