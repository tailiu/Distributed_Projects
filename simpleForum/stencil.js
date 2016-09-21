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

exports.syncLocalAndRemoteBranches = function(repoPath, host, branch, callback) {
  try {
    var command = 'cd ' + repoPath + '\ngit pull ' + host + ' ' + branch + '\n'
    var result = childProcess.execSync(command)
    callback(null, result.toString())
  } catch (err) {
    callback(handleErr(err), null)
  }
}

exports.getFileFromRepo = function (filePath, host, view) {
  var fileName = getFileNameFromFilePath(filePath)
  var fileDir = getFileDirFromFilePath(filePath, fileName)

  var command = 'cd ' + fileDir + '\ngit branch\n'
  var result = childProcess.execSync(command)
  if (result == '') {
    return undefined
  }

  var command1 = 'cd ' + fileDir + '\ngit pull ' + host + ' ' + view + '\n'
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

function pushToGitRepo(fileDir, fileName, comment, host, branch, callback) {
  try {
    var command = 'cd '+ fileDir + '\ngit add ' +  fileName 
        + '\ngit commit -m "' + comment + '"\ngit push ' + host + ' ' + branch + '\n'
    childProcess.execSync(command)
    callback(null)
  } catch (err) {
    callback(handleErr(err))
  } 
}

exports.createOrUpdateFileInRepo = function(filePath, content, option, host, branch, callback) {
  var fileName = getFileNameFromFilePath(filePath)
  var fileDir = getFileDirFromFilePath(filePath, fileName)
  
  mkdirp.sync(fileDir)

  fs.writeFile(filePath, content, function(err) {
    var comment = option + ' file ' + fileName
    pushToGitRepo(fileDir, fileName, comment, host, branch, callback)
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

function downloadFile(torrentSeeds, downloadedFilePath, callback) {
  var ws = fs.createWriteStream(downloadedFilePath)
  var client = new WebTorrent({ dht: false, tracker: false })
  var torrent = client.add(torrentSeeds[0].infoHash)
  var rs

  torrent.addPeer(torrentSeeds[0].ipAddr + ':' + torrentSeeds[0].torrentPort)

  client.on('torrent', function (value) {
    rs = value.files[0].createReadStream()
    rs.pipe(ws)
    torrent.on('done', function () {
      rs.on('end', function () {
        callback()
      })
    })
  })
}

exports.getFileFromTorrent = function(torrentSeeds, downloadedFilePath, callback) {
  var fileName = getFileNameFromFilePath(downloadedFilePath)
  var fileDir = getFileDirFromFilePath(downloadedFilePath, fileName)

  mkdirp.sync(fileDir)

  fs.exists(downloadedFilePath, function(exists) {
    if (!exists) {
      fs.writeFile(downloadedFilePath, '[]', function(err) {
        downloadFile(torrentSeeds, downloadedFilePath, callback)
      })
    } else {
      downloadFile(torrentSeeds, downloadedFilePath, callback)
    }
  })
  
}

function handleErr(err) {
  if (err.stderr == undefined && err.stdout == undefined) {
    return 'both undefined:' + err.toString()

  }
  else if (err.stderr == undefined) {
    return err.stdout.toString()

  } else if (err.stdout == undefined) {
    return err.stderr.toString()

  } else if (err.stderr.toString() === '') {
    return err.stdout.toString()

  } else {
    return err.stderr.toString()

  }
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

function addRemote(repoPath, host, repoName) {
  var command = 'cd ' + repoPath + '\ngit remote add ' + host + ' '  + host + ':' + repoName + '\n'
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

function cloneRepoWithSpecificBranch(remoteRepoLocation, localRepoDir, host, keyName, branch, type) {
  mkdirp.sync(localRepoDir)

  addEntryToConfig(remoteRepoLocation.split(':')[0], keyName, host)

  var repoName = remoteRepoLocation.split(':')[1]

  var command = ''
  if (type == 'host in config') {
    if (branch == 'all') {
      command = 'cd ' + localRepoDir + '\ngit clone ' + host + ':' + repoName + '\n'
    } else {
      command = 'cd ' + localRepoDir + '\ngit clone -b ' + branch + ' --single-branch ' + host + ':' + repoName + '\n'
    }
    childProcess.execSync(command)
  } else if (type == 'remote location') {
    if (branch == 'all') {
      command = 'cd ' + localRepoDir + '\ngit clone ' + remoteRepoLocation + '\n'
    } else {
      command = 'cd ' + localRepoDir + '\ngit clone -b ' + branch + ' --single-branch ' + remoteRepoLocation + '\n'
    }
    console.log(command)
    childProcess.execSync(command)
  }
  
  addRemote(localRepoDir + '/' + repoName, host, repoName)
}

exports.cloneRepoWithSpecificBranch = function(remoteRepoLocation, localRepoDir, host, keyName, branch) {
  cloneRepoWithSpecificBranch(remoteRepoLocation, localRepoDir, host, keyName, branch, 'host in config')
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

exports.setUpAdminRepoLocally = function(remoteAdminRepoServer, localAdminRepoDir, keyName, host) {
  var localAdminRepoPath = localAdminRepoDir + '/' + adminRepo
  var remoteAdminRepoPath = remoteAdminRepoServer + ':' + adminRepo

  if (!fs.existsSync(localAdminRepoPath)) {
    cloneRepoWithSpecificBranch(remoteAdminRepoPath, localAdminRepoDir, host, keyName, 'all', 'remote location')
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

function getRemoteOriginBranches(arr1) {
  var branchArr = []
  for (var i in arr1) {
    var arr2 = arr1[i].split('/')
    if (arr2.length < 3) {
      continue
    }
    if (arr2[0].trim() == 'remotes' && arr2[1].trim() == 'origin' && arr2[2].trim().indexOf('->') == -1) {
      branchArr.push(arr2[2])
    }
  }
  return branchArr
}

exports.getAllRemoteBranches = function(repoPath) {
  var command = 'cd ' + repoPath + '\ngit fetch --all\ngit branch -a\n'
  var result = childProcess.execSync(command)

  return getRemoteOriginBranches(result.toString().split('\n'))
}

exports.createBranch = function(repoPath, branchName, callback) {
  try {
    var command = 'cd ' + repoPath + '\ngit branch ' + branchName + '\n'
    childProcess.execSync(command)
    callback(null)
  } catch(err) {
    callback(handleErr(err))
  }
}

exports.changeBranch = function(repoPath, branchName, callback) {
  try {
    var command = 'cd ' + repoPath + '\ngit checkout ' +  branchName + '\n'
    childProcess.execSync(command)
    callback(null)
  } catch (err) {
    callback(handleErr(err))
  }
}

exports.mergeBranch = function(repoPath, branchName, callback) {
  try {
    var command = 'cd ' + repoPath + '\ngit merge ' + branchName + '\n'
    var result = childProcess.execSync(command)
    callback(null, result.toString())
  } catch(err) {
    callback(handleErr(err), null)
  }
}

exports.getCurrentBranch = function(repoPath) {
  var command = 'cd ' + repoPath + '\ngit branch\n'
  var result = childProcess.execSync(command)
  return result
}

exports.checkoutToBranchFirstTime = function(repoPath, remote, localBranch, remoteBranch, callback) {
  try {
    var command = 'cd ' + repoPath + '\n'
    command += 'git fetch --all\n'
    command += 'git checkout -b ' + localBranch + ' --track ' + remote + '/' + remoteBranch + '\n'
    childProcess.execSync(command)
    callback(null)
  } catch (err) {
    callback(handleErr(err))
  }
}
