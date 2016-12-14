var kad = require('kad')
var childProcess = require('child-proc')
var fs = require('graceful-fs')
var WebTorrent = require('webtorrent')
var os = require('os')
var lineByLine = require('n-readlines')
var mkdirp = require('mkdirp')
var _ = require('underscore')
var crypto = require('crypto')

const SSHDirPath = getSSHDirBaseAddr() + findCurrentAccount()
const adminRepo = 'gitolite-admin'
const confDir = '/gitolite-admin/conf/'
const confFile = 'gitolite.conf'
const keyDir = '/gitolite-admin/keydir/'
const knownHostsPath = SSHDirPath + '/.ssh/known_hosts'
const SSHPkPath = SSHDirPath + '/.ssh/id_rsa.pub'
const SSHKeysDir = SSHDirPath + '/.ssh/'
const SSHConfig = SSHDirPath + '/.ssh/config'
const defaultSSHKeysDir = SSHDirPath + '/.ssh'

exports.defaultSSHKeysDir = defaultSSHKeysDir

function getSSHDirBaseAddr() {
  var platform = process.platform

  if (platform == 'linux') {
    return '/home/'
  } else if (platform == 'darwin') {
    return '/Users/'
  }
}

exports.initStencil = function(numOfTorrentClient) {
  var torrentClient = []
  
  for (i = 0; i < numOfTorrentClient; i++) { 
    torrentClient[i] = createTorrentClient()
  }
  
  return torrentClient
}

exports.initStencilHandler = function(nodeAddr, nodePort, db) {
  return createDHTNode(nodeAddr, nodePort, db)
}

function createTorrentClient() {
  return new WebTorrent({ dht: false, tracker: false })
}

function createDHTNode(nodeAddr, nodePort, db) {
  var DHTNode = new kad.Node({
  transport: kad.transports.UDP(kad.contacts.AddressPortContact({
    address: nodeAddr,
    port: nodePort
    })),
    storage: kad.storage.FS(db)
  })
  return DHTNode
}

exports.storeGroupInfo = function(DHTNode, DHTSeed, key, value, callback) {
  DHTNode.connect(DHTSeed, function(err) {
    DHTNode.put(key, value, function() {
        callback()
    })
  })
}

exports.retrieveGroupInfo = function(DHTNode, DHTSeed, key, callback) {
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
  var interfaces = os.networkInterfaces()

  for (var k1 in interfaces) {
      for (var k2 in interfaces[k1]) {
          var address = interfaces[k1][k2];
          if (address.family === 'IPv4' && !address.internal) {
              return address.address
          }
      }
  }
}

exports.syncBranch = function(repoPath, host, branch, callback) {
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

exports.writeFileToRepo = function(filePath, content, option, host, branch, callback) {
  var fileName = getFileNameFromFilePath(filePath)
  var fileDir = getFileDirFromFilePath(filePath, fileName)
  
  mkdirp.sync(fileDir)

  fs.writeFile(filePath, content, function(err) {
    var comment = option + ' file ' + fileName
    pushToGitRepo(fileDir, fileName, comment, host, branch, callback)
  })
}

exports.createFileInTorrent = function(filePath, client, callback) {
  var filemeta = {}

  client = new WebTorrent({ dht: false, tracker: false })

  filemeta.createTs = new Date()
  
  client.seed(filePath , function (torrent) {
    filemeta.seeds = []
    filemeta.seeds[0] = {}
    filemeta.seeds[0].infoHash = torrent.infoHash
    filemeta.seeds[0].ipAddr = getLocalIpAddr()
    filemeta.seeds[0].torrentPort = client.torrentPort

    callback(filemeta)
  })
  
}

function downloadFile(torrentSeeds, downloadedFilePath, client, callback) {
  var ws = fs.createWriteStream(downloadedFilePath)
  var rs
  var torrent
  var timeout = false
  var notTimeout = false

  torrent = client.add(torrentSeeds[0].infoHash)
  torrent.addPeer(torrentSeeds[0].ipAddr + ':' + torrentSeeds[0].torrentPort)

  torrent.on('done', function() {
    if (!timeout) {
      notTimeout = true
      torrent.files.forEach(function(file){
        rs = file.createReadStream()
        rs.pipe(ws)
        rs.on('end', function(){
          client.remove(torrentSeeds[0].infoHash, function() {
            callback()
          })
        })
      })
    }
  })

  setTimeout(function(){
    if (!notTimeout) {
      timeout = true
      console.log('timeout')
      client.remove(torrentSeeds[0].infoHash, function() {
        downloadFile(torrentSeeds, downloadedFilePath, client, callback)
      })
    }
  }, 2000)
}

exports.getFileFromTorrent = function(torrentSeeds, downloadedFilePath, client, callback) {
  var fileName = getFileNameFromFilePath(downloadedFilePath)
  var fileDir = getFileDirFromFilePath(downloadedFilePath, fileName)

  mkdirp.sync(fileDir)

  downloadFile(torrentSeeds, downloadedFilePath, client, callback)
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

function cloneRepo(remoteRepoLocation, localRepoDir, host, keyName, branch, type) {
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

exports.cloneRepo = function(remoteRepoLocation, localRepoDir, host, keyName, branch) {
  cloneRepo(remoteRepoLocation, localRepoDir, host, keyName, branch, 'host in config')
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

function getLocalAdminRepoPath(adminRepoDir) {
  return adminRepoDir + '/' + adminRepo
}

function getConfFilePath(adminRepoDir) {
  return adminRepoDir + confDir + confFile
}

function getRemoteAdminRepoPath(adminRepoDir) {
  return adminRepoDir + ':' + adminRepo
}

exports.addKeyToSSHAgent = function(keyName) {
  var command = 'ssh-add ' + SSHKeysDir + keyName + '\n'
  childProcess.execSync(command)
}

function setUpAdminRepoLocally(remoteAdminRepoServer, localAdminRepoDir, keyName, host) {
  var localAdminRepoPath = getLocalAdminRepoPath(localAdminRepoDir)
  var remoteAdminRepoPath = getRemoteAdminRepoPath(remoteAdminRepoServer)

  if (!fs.existsSync(localAdminRepoPath)) {
    cloneRepo(remoteAdminRepoPath, localAdminRepoDir, host, keyName, 'all', 'remote location')
    replaceKey(localAdminRepoDir, keyName)
  }
}

exports.createRepo = function(localAdminRepoDir, repoName, keyName, host, remoteAdminRepoServer) {
  if (remoteAdminRepoServer == undefined) {
    var adminRepoPath = getLocalAdminRepoPath(localAdminRepoDir)
    var confFilePath = getConfFilePath(localAdminRepoDir)
    var data = 'repo ' + repoName + '\n' + 'RW+ = ' + keyName + '\n'
    var command = 'cd ' + adminRepoPath + '\ngit add -A :/\ngit commit -m "' + 'add repo ' + repoName + '"\n'
          + 'git push ' + host + ' master\n'
    fs.appendFileSync(confFilePath, data)
    childProcess.execSync(command)
  } else {
    setUpAdminRepoLocally(remoteAdminRepoServer, localAdminRepoDir, keyName, host)
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

exports.addKeyToRepo = function(adminRepoDir, SSHPublicKey, keyName, repoName, host) {
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

//generate key to be put to the known_hosts file in the .ssh dir
function genKnownHostsKey(ipaddr) {
  var knownHostsKey
  var command
  var serverPk = childProcess.execSync('cat /etc/ssh/ssh_host_ecdsa_key.pub')
  var buffer = crypto.randomBytes(20)
  var token = buffer.toString('base64');
  command = 'key=`echo ' + token + ' | base64 -d | xxd -p`\n'
  command += 'echo -n \"' + ipaddr + '\" | openssl sha1 -mac HMAC -macopt hexkey:$key|awk \'{print $2}\' | xxd -r -p|base64\n'
  var hashedVal = childProcess.execSync(command)
  hashedVal = (hashedVal + '').replace(/(\r\n|\n|\r)/gm,"")
  knownHostsKey = '|1|' + token + '|' + hashedVal + ' ' + serverPk
  return knownHostsKey
}

exports.getKnownHostKey = function(serverAddrWithoutUserAccount) {
  try {
    var command = 'ssh-keygen -F ' + serverAddrWithoutUserAccount + '\n'
    var value = childProcess.execSync(command)
    if (value.toString() == '') {
      return genKnownHostsKey(serverAddrWithoutUserAccount)
    }
    var key = value.toString().split('\n')[1]
    return key + '\n'
  } catch (err) {
    return genKnownHostsKey(serverAddrWithoutUserAccount)
  }
}

exports.checkAndAddKnownHostKey = function(serverAddrWithoutUserAccount, knownHostsKey) {
  if (fs.existsSync(knownHostsPath)) {
      try {
        var checkKnownHosts = 'ssh-keygen -F ' + serverAddrWithoutUserAccount
        var checkResult = childProcess.execSync(checkKnownHosts)
        if (checkResult.toString() == '') {
          fs.appendFileSync(knownHostsPath, knownHostsKey)
        }
      } catch (err) {
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

exports.getBranchNames = function(repoPath) {
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

exports.mergeBranch = function(repoPath, branchName, callback) {
  try {
    var command = 'cd ' + repoPath + '\ngit merge ' + branchName + '\n'
    var result = childProcess.execSync(command)
    callback(null, result.toString())
  } catch(err) {
    callback(handleErr(err), null)
  }
}

exports.getCurrentBranchName = function(repoPath) {
  var command = 'cd ' + repoPath + '\ngit rev-parse --abbrev-ref HEAD\n'
  var result = childProcess.execSync(command)
  return result
}

exports.changeBranch = function(repoPath, branchName, remote, callback) {
  try {
    var command = 'cd ' + repoPath + '\ngit checkout ' +  branchName + '\n'
    childProcess.execSync(command)
    callback(null)
  } catch (err) {
    var errMsg = handleErr(err)
    if (errMsg.indexOf('did not match any file(s) known to git') != -1) {
      checkoutToBranchFirstTime(repoPath, remote, branchName, branchName)
    }
    callback(errMsg)
  }
}

function checkoutToBranchFirstTime(repoPath, remote, localBranch, remoteBranch) {
  var command = 'cd ' + repoPath + '\n'
  command += 'git fetch --all\n'
  command += 'git checkout -b ' + localBranch + ' --track ' + remote + '/' + remoteBranch + '\n'
  childProcess.execSync(command)
}
