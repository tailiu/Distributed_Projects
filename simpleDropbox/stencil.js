var kad = require('kad')
var childProcess = require('child-proc')
var fs = require('fs')
var crypto = require('crypto')
var deasync = require('deasync')
var WebTorrent = require('webtorrent')
var os = require('os')
var request = require('request')

const listeningPort = 8000
const userDHTSeedPort = 8100
const userDHTPort = 7100
const groupDHTSeedPort = 8200
const groupDHTPort = 7200

var createdGroupsDir = 'created_groups'
var joinedGroupsDir = 'joined_groups'
var knownHostsPath = '/home/' + findCurrentAccount() 
            + '/.ssh/known_hosts'
var authorizedKeysPath = '/home/'+ findCurrentAccount() 
            + '/.ssh/authorized_keys'
var SSHPkPath = '/home/'+ findCurrentAccount() 
            + '/.ssh/id_rsa.pub'
var downloadedFilesDir = 'downloaded_files'

//public user DHT
var userDHTSeed = {
  address: '127.0.0.1',
  port: userDHTSeedPort
}

//public group DHT
var groupDHTSeed = {
  address: '127.0.0.1',
  port: groupDHTSeedPort
}

//create local user DHT node
var userDHT = new kad.Node({
  transport: kad.transports.UDP(kad.contacts.AddressPortContact({
    address: '127.0.0.1',
    port: userDHTPort
  })),
  storage: kad.storage.FS('db2')
})

//create local group DHT node
var groupDHT = new kad.Node({
  transport: kad.transports.UDP(kad.contacts.AddressPortContact({
    address: '127.0.0.1',
    port: groupDHTPort
  })),
  storage: kad.storage.FS('db4')
})

//find current account on the machine
function findCurrentAccount() {
  var account = childProcess.execSync('whoami')
  account = (account + '').replace(/(\r\n|\n|\r)/gm,"")
  return account
}

function handleError(error) {
  console.log(error)
  process.exit(0)
}

//Create unique _id
function createRandom() {
  var current_date = (new Date()).valueOf().toString();
  var random = Math.random().toString();
  return crypto.createHash('sha1').update(current_date + random).digest('hex');
}

//remove \n
function removeCR(str) {
  return (str + '').replace(/(\r\n|\n|\r)/gm,"")
}

function createRepo(dir, groupName) {
  var createRepoCommand = 'cd '+ dir + '\n' + 'mkdir ' + groupName + '\n' 
              + 'cd ' + groupName + '\n' + 'git --bare init'
  childProcess.execSync(createRepoCommand)
}

//get IP address from location 
function getIpAddrFromLocation(location) {
  var parts = location.split('@')
  var parts1 = parts[1].split(':')
  return parts1[0]
} 

function addGroupToUsermeta(usermeta, groupName, groupmeta) {
  if (usermeta.group == null) {
    usermeta.group = []
    usermeta.group[0] = {}
    usermeta.group[0].groupName = groupName
    usermeta.group[0]._id = groupmeta._id
  } else {
    var n = usermeta.group.length
    usermeta.group[n] = {}
    usermeta.group[n].groupName = groupName
    usermeta.group[n]._id = groupmeta._id
  }
  return usermeta
}

function cloneRepo(username, location) {
  var dir = username + '/' + joinedGroupsDir
  if (!fs.existsSync(username)) {
    childProcess.execSync('mkdir ' + username)
  }
  if (!fs.existsSync(dir)) {
    childProcess.execSync('cd ' + username + '\n'+ 'mkdir ' + joinedGroupsDir + '\n')
  }
  var command = 'cd ' + username + '\ncd ' + joinedGroupsDir + '\ngit clone ' + location
  childProcess.execSync(command)
}

//add key to known_hosts file in .ssh dir
function addKeyToKnownHosts(key) {
  fs.appendFileSync(knownHostsPath, key)
}

//add key to authorized_keys file in .ssh dir
function addKeyToAuthorizedFile(pk) {
  if (!fs.existsSync(authorizedKeysPath)) {
    childProcess.execSync('touch ' + authorizedKeysPath)
  }
  var content = fs.readFileSync(authorizedKeysPath, 'utf8')
  if (content.indexOf(pk) < 0) {
    fs.appendFileSync(authorizedKeysPath, pk)
  }
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

//get SSH public key
function getSSHPk() {
  return fs.readFileSync(SSHPkPath)
}

function pushToGitRepo(filemetaDir, fileName, comment) {
  var command = 'cd '+ filemetaDir + '\ngit add ' +  fileName 
          + '\ngit commit -m "' + comment + '"\ngit push origin master\n'
  childProcess.execSync(command)
}

function getFilemetaDir(username, groupName) {
  return username + '/' + joinedGroupsDir + '/' + groupName
}

function getFilemetaPath(filemetaDir, fileName) {
  return filemetaDir + '/' + fileName
}

function getLocalIpAddr() {
  var networkInterfaces = os.networkInterfaces( )
  return networkInterfaces.eth0[0].address
}

function createFile(username, contentType, filePath, groupName, fileName, parentDir) {
  var filemeta = {}
  var torrent = new WebTorrent({ dht: false, tracker: false })
  filemeta.ts = new Date()
  filemeta._id = createRandom()
  filemeta.creator = username
  filemeta.type = []
  filemeta.readlist = []
  filemeta.writelist = []
  filemeta.group = groupName
  filemeta.content = {}
  filemeta.content.type = contentType
  if (contentType == 'dir') {
    filemeta.content.files = []
    filemeta.content.parentDir = parentDir
  } else {
    var done1 = false
    torrent.seed(filePath , function (value) {
      filemeta.content.seeds = []
      filemeta.content.seeds[0] = {}
      filemeta.content.seeds[0].infoHash = value.infoHash
      filemeta.content.seeds[0].ipAddr = getLocalIpAddr()
      filemeta.content.seeds[0].torrentPort = torrent.torrentPort
      done1 = true
    })
    deasync.loopWhile(function(){return !done1})
  }
  var filemetaDir = getFilemetaDir(username, groupName)
  var filemetaPath = getFilemetaPath(filemetaDir, fileName)
  console.log(filemetaPath)
  childProcess.execSync('touch ' + filemetaPath)
  fs.writeFileSync(filemetaPath, JSON.stringify(filemeta))
  var comment = 'add file ' + fileName
  pushToGitRepo(filemetaDir, fileName, comment)
}

exports.createUser = function (username, realName, email, password, callback) {
  var usermeta = {}
  usermeta.ts = new Date()
  usermeta._id = createRandom()
  usermeta.realName = realName
  usermeta.email = email
  usermeta.password = password
  usermeta.ipAddr = getLocalIpAddr()
  usermeta.group = null 
  userDHT.connect(userDHTSeed, function(err) {
    userDHT.put(username, JSON.stringify(usermeta), function() {
      callback()
    })
  })
}

exports.getUserInfo = function (username, callback) {
  userDHT.connect(userDHTSeed, function(err) {
    userDHT.get(username, function(err, value){
      callback(value)
    })
  })
}

exports.updateUserInfo = function (username, usermeta, callback) {
  userDHT.put(username, JSON.stringify(usermeta), function() {
    callback()
  })
}

exports.createFile = function(username, contentType, filePath, groupName, fileName, parentDir, callback) {
  createFile(username, contentType, filePath, groupName, fileName, parentDir)
  callback()
}

exports.updateFile = function(username, groupName, dir, fileName, updateType, callback) {
  if (updateType == 'dir') {
    var dirMetaDir = getFilemetaDir(username, groupName)
    var dirMetaPath = getFilemetaPath(dirMetaDir, dir)
    var dirMeta = JSON.parse(fs.readFileSync(dirMetaPath, 'utf8'))
    var n = dirMeta.content.files.length
    dirMeta.content.files[n] = fileName
    fs.writeFileSync(dirMetaPath, JSON.stringify(dirMeta))
    var comment = 'update file ' + fileName
    pushToGitRepo(dirMetaDir, dir, comment)
    callback()
  }
}

exports.getFile = function (fileName, groupName, username, callback) {
  var filemetaDir = getFilemetaDir(username, groupName)
  var filemetaPath = getFilemetaPath(filemetaDir, fileName)
  var downloadedDir = username + '/' + downloadedFilesDir
  var filemeta = JSON.parse(fs.readFileSync(filemetaPath))
  if (!fs.existsSync(downloadedDir)) {
    childProcess.execSync('cd ' + username + '\n'+ 'mkdir ' + downloadedFilesDir + '\n')
  } 
  var ws = fs.createWriteStream(downloadedDir + '/' + fileName);
  var torrent = new WebTorrent({ dht: false, tracker: false });
  var tor = torrent.add(filemeta.content.seeds[0].infoHash);
  tor.addPeer(filemeta.content.seeds[0].ipAddr + ':' + filemeta.content.seeds[0].torrentPort);
  torrent.on('torrent', function (value) {
    value.files[0].createReadStream().pipe(ws);
  })
  tor.on('done', function () {
    callback()
  })
}

exports.getFilemeta = function (fileName, groupName, username) {
  var filemetaDir = getFilemetaDir(username, groupName)
  var filemetaPath = getFilemetaPath(filemetaDir, fileName)
  return fs.readFileSync(filemetaPath, 'utf8')
} 

exports.syncFileMeta = function(groupName, username, callback) {
  var done = false
  groupDHT.connect(groupDHTSeed, function(err) {
    userDHT.connect(userDHTSeed, function(err) {
      groupDHT.get(groupName, function(err, value){
        var groupmeta = JSON.parse(value)
        var groupMemNames = []
        if (groupmeta.groupMems.length > 1) {
          for (var i = 0; i < groupmeta.groupMems.length; i++) {
            groupMemNames[i] = groupmeta.groupMems[i].username
          }
          for (i = 0; i < groupMemNames.length; i++) {
            if (groupMemNames[i] == username) {
              continue
            }
            userDHT.get(groupMemNames[i], function(err, value1) {
              var usermeta = JSON.parse(value1)
              var data = 
                {
                  type: 'sync file meta',
                  groupName: groupName,
                  repoAddr: groupmeta.location,
                  username: groupMemNames[i]
                }
              console.log(usermeta.ipAddr)
              var userAddr = 'http://' + usermeta.ipAddr + ':' + listeningPort
              request.post(userAddr, {form: data}, function (error, response, body) {
                if (!error && response.statusCode == 200) {
                  callback()
                }
                done = true
              })
            })
            deasync.loopWhile(function(){return !done})
          }
        } else {
          callback()
        }
      })
    })
  })
}

exports.handleSyncFileMeta = function(groupName, repoAddr, username, callback) {
  var command = 'cd ' + username + '\ncd ' + joinedGroupsDir + '\n' + 'rm -r -f ' + groupName + '\n' 
           + 'git clone ' + repoAddr + '\n'
  childProcess.execSync(command)
  callback()
}

exports.createGroup = function (username, groupName, description, location, callback) {
  var groupmeta = {}
  var dir = username + '/' + createdGroupsDir 
  groupmeta.description = description
  groupmeta.location = location
  groupmeta._id = createRandom()
  groupmeta.type = 'public'
  groupmeta.ts = new Date()
  if (!fs.existsSync(username)) {
    childProcess.execSync('mkdir ' + username)
  }
  if (!fs.existsSync(dir)) {
    childProcess.execSync('cd ' + username + '\n'+ 'mkdir ' + createdGroupsDir + '\n')
  }
  createRepo(dir, groupName)
  userDHT.connect(userDHTSeed, function(err) {
    userDHT.get(username, function(err, value) {
      var usermeta = JSON.parse(value)
      usermeta = addGroupToUsermeta(usermeta, groupName, groupmeta)
      userDHT.put(username, JSON.stringify(usermeta), function() {
        groupDHT.connect(groupDHTSeed, function(err) {
          groupmeta.groupMems = []
          groupmeta.groupMems[0] = {}
          groupmeta.groupMems[0].username = username
          groupmeta.groupMems[0]._id = usermeta._id
          groupmeta.groupMems[0].role = []
          groupDHT.put(groupName, JSON.stringify(groupmeta), function(){
            var knownHostKey = genKnownHostsKey(getIpAddrFromLocation(groupmeta.location))
            addKeyToKnownHosts(knownHostKey)
            addKeyToAuthorizedFile(getSSHPk())
            cloneRepo(username, groupmeta.location)
            createFile(username, 'dir', '', groupName, 'root', null)
            callback()
          })
        })
      })
    })
  })
}

exports.getGroupInfo = function (groupName, callback) {
  groupDHT.connect(groupDHTSeed, function(err) {
    groupDHT.get(groupName, function(err, value){
      callback(value)
    })
  })
}

//send join group request
exports.joinGroupReq = function (username, groupName, pk, location, callback) {
  var requestHashedHost = false
  var parts = location.split('@')
  var parts1 = parts[1].split(':')
  var addr = 'http://' + parts1[0] + ':' + listeningPort
  var done = false
  if (fs.existsSync(knownHostsPath)) {
    var checkKnownHosts = 'ssh-keygen -F ' + parts1[0]
    var checkResult = childProcess.execSync(checkKnownHosts)
    if (checkResult.toString() == null) {
      requestHashedHost = true
    }
  } else {
    childProcess.execSync('touch ' + knownHostsPath)
    requestHashedHost = true
  }
  var data = 
      {
        type: 'join group from remote client',
        username: username,
        pk: pk,
        groupName: groupName,
        requestHashedHost: requestHashedHost
      }
  request.post(addr, {form: data}, function (error, reply, body) {
      if (!error && reply.statusCode == 200) {
        var resFromRemoteServer = JSON.parse(body)
        if (resFromRemoteServer.resType == 'Accept') {
          if (resFromRemoteServer.requestHashedHost == 'true') {
            addKeyToKnownHosts(resFromRemoteServer.knownHostsKey)
          } 
          cloneRepo(username, location)
          groupDHT.connect(groupDHTSeed, function(err) {
            groupDHT.get(groupName, function(err, value){
              userDHT.connect(userDHTSeed, function(err) {
                userDHT.get(username, function(err, value1){
                  var groupmeta = JSON.parse(value)
                  var usermeta = JSON.parse(value1)
                  usermeta = addGroupToUsermeta(usermeta, groupName, groupmeta)
                  userDHT.put(username, JSON.stringify(usermeta), function(){
                //          var filemetaDir = getFilemetaDir(username, groupName)
                      // var command = 'cd ' + filemetaDir + '\nls' + '\n'
                      // var filelist = childProcess.execSync(command)
                      // filelist = filelist.toString()
                      // filelist = filelist.replace('\n', ' ')
                      // filelist = filelist.trim()
                      // var files = filelist.split(' ')
                      // if (files.length != 1) {
                      //  var torrent = []
                      //  for (var i = 0; i < files.length; i++) {
                      //    var done1 = false
                      //    var fileName = files[i]
                      //    var filemetaPath = getFilemetaPath(filemetaDir, fileName)
                      //    var filemeta = JSON.parse(fs.readFileSync(filemetaPath, 'utf8'))
                      //    if (filemeta.content.type == 'file') {
                      //      torrent[i] = new WebTorrent({ dht: false, tracker: false })
                   //             torrent[i].seed(filemetaPath , function (value) {
                   //               var comment = 'add a seed'
                   //               var length = filemeta.content.length
                      //        filemeta.content[length] = {}
                      //        filemeta.content[length].infoHash = value.infoHash
                      //        filemeta.content[length].ipAddr = getLocalIpAddr()
                      //        filemeta.content[length].torrentPort = torrent[i].torrentPort
                      //        fs.writeFileSync(filemetaPath, JSON.stringify(filemeta))
                      //        pushToGitRepo(filemetaDir, fileName, comment)
                      //        done1 = true
                      //      })
                      //      deasync.loopWhile(function(){return !done1})
                      //      syncFileMeta(groupName, username)
                      //    }
                      //  }
                      // } 
                    callback(resFromRemoteServer.resType)
                  })
                })
              })
            })
          })
        } else {
          callback('failed')
        }
        done = true
      } else {
        handleError(error)
      }     
  })
  deasync.loopWhile(function(){return !done})
}

//send join group response
exports.joinGroupRes = function (username, groupName, pk, requestHashedHost, callback) {
  groupDHT.connect(groupDHTSeed, function(err) {
    groupDHT.get(groupName, function(err, value){
      var groupmeta = JSON.parse(value)
      var knownHostsKey = null
      if (requestHashedHost) {
        var ipAddr = getIpAddrFromLocation(groupmeta.location)
        var knownHostsKey = genKnownHostsKey(ipAddr)
      }
      addKeyToAuthorizedFile(pk)
      userDHT.connect(userDHTSeed, function(err) {
        userDHT.get(username, function(err, value){
          groupDHT.connect(groupDHTSeed, function(err) {
            groupDHT.get(groupName, function(err, value1){
              var usermeta = JSON.parse(value)
              var groupmeta = JSON.parse(value1)
              var n = groupmeta.groupMems.length
              groupmeta.groupMems[n] = {}
              groupmeta.groupMems[n].username = username
              groupmeta.groupMems[n]._id = usermeta._id
              groupmeta.groupMems[n].role = []
              groupDHT.put(groupName, JSON.stringify(groupmeta), function(){
                callback(knownHostsKey, requestHashedHost)
              })
            })
          })
        })
      })
    })
  })
}

