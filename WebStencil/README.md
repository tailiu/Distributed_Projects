WebStencil is a distributed storage system that is intended to be used in the web browser

#Installation
```
npm install WebStencil --save
```

#API

###DHT
```
createDHTNode(nodeAddr, nodePort, db, callback)
putValueOnDHT(DHTNode, DHTSeed, key, value, callback)
getValueFromDHT(DHTNode, DHTSeed, key, callback)
```

###Torrent
```
createTorrentClient()
getFileFromTorrent(torrentSeeds, downloadedFilePath, client, callback)
createFileInTorrent(filePath, client, callback)
```

###Git
#####Repo Related
```
createRepo(adminRepoDir, repoName, addedkeyName, host)
getFileFromRepo(filePath, host, view)
createOrUpdateFileInRepo(filePath, content, option, host, branch, callback)
setUpAdminRepoLocally(remoteAdminRepoServer, localAdminRepoDir, keyName, host)
```

#####Branch Related
```
cloneRepoWithSpecificBranch(remoteRepoLocation, localRepoDir, host, keyName, branch)
getAllRemoteBranches(repoPath)
createBranch(repoPath, branchName, callback)
changeBranch(repoPath, branchName, callback)
mergeBranch(repoPath, branchName, callback)
getCurrentBranch(repoPath)
checkoutToBranchFirstTime(repoPath, remote, localBranch, remoteBranch, callback)
```

###Key
```
addKeyAndUpdateConfigFileInAdminRepo(adminRepoDir, SSHPublicKey, keyName, repoName, host)
getKnownHostKey(serverAddrWithoutUserAccount)
checkAndAddKnownHostKey(serverAddrWithoutUserAccount, knownHostsKey)
```