var refreshInterval = 2000

function notInAnyGroup() {
    document.getElementById("tags").disabled = true
    document.getElementById("newPost").disabled = true
    renderTeamConfig()
    return '<p>Note: You are not in any group, you cannot post anything until you are in a group!</p>'
}

function eachPost (post, index) {
    index++
    var section = "<div class='section'><h3>" + index + ": " + post.name + "</h3><p>" + post.content + "</p>" + "</div>"
    return section
}
function renderPosts(posts) {
    if (posts.length == 0) {
        document.getElementById("mainSection").innerHTML = '<p>There is no post yet</P>'
    } else {
        document.getElementById("mainSection").innerHTML = ''
        for (var i in posts) {
            document.getElementById("mainSection").innerHTML = eachPost(posts[i], i)
        }
    }
}

function renderComments(post) {
    var comments = post.comments;
    if (comments.length == 0) {
        return "<p> There is no comment yet </p>"
    } else {
        var commentSection = "<p>Comments:</p><br>"
        for (var i in comments) {
            var yourComment = false
            if (comments[i].creator == username) {
                yourComment = true
            }
            if (yourComment) {
                commentSection += "<div class='commentSection'><p>You"
            } else {
                commentSection += "<div class='commentSection'><p>" + comments[i].creator
            }
            commentSection += " on "+ comments[i].ts.toString()
            if (comments[i].replyTo.length != 0) {
                commentSection += " replied to " + comments[i].replyTo +": </p>"
            } else {
                commentSection += " commented: </p>"
            }
            commentSection += "<p>" + comments[i].content + "</p> "
            if (!yourComment) {
                commentSection += "<button type='button' class='commentReplyButton'>Reply</button>"
            }
            commentSection += "</div>"
        }
        return commentSection
    }
}

function NoSuchGroup(option) {
    var searchNoResult = ''
    if (option == 'join') {
        searchNoResult += '<h3>Join a Group</h3><br>'
    } else if (option == 'leave') {
        searchNoResult += '<h3>Leave a Group</h3><br>'
    }
    searchNoResult += '<p>There is no such a group</p>'
    document.getElementById("mainSection").innerHTML = searchNoResult
}
function alreadyInTeam() {
    var alreadyIn = ''
    alreadyIn += '<h3>Invite Others to Team</h3><br>'
    alreadyIn += '<p>The user has already been in this team</p>'
    document.getElementById("mainSection").innerHTML = alreadyIn
}
function NotInGroup() {
    var NotInGroup = ''
    NotInGroup = '<h3>Leave a Group</h3><br>'
    NotInGroup += '<p>You are not in this group</p>'
    document.getElementById("mainSection").innerHTML = NotInGroup
}
function groupAlreadyExists() {
    var groupAlreadyExists = ''
    groupAlreadyExists = '<h3>Create a Group</h3><br>'
    groupAlreadyExists += '<p>Sorry, group already exists</p>'
    document.getElementById("mainSection").innerHTML = groupAlreadyExists
}
function createGroupSuccessful() {
    var createGroupSuccessful = ''
    createGroupSuccessful += '<h3>Create a Group</h3><br>'
    createGroupSuccessful += '<p>Create group successfully</p>'
    document.getElementById("mainSection").innerHTML = createGroupSuccessful
}
function sentInvitationEmail() {
    var sentEmail = ''
    sentEmail += '<h3>Invite Others to Team</h3><br>'
    sentEmail += '<p>Invitation email has been sent</p>'
    document.getElementById("mainSection").innerHTML = sentEmail
}
function renderMyGroups(groups) {
    var myGroups = ''
    var index = 0
    myGroups += '<h3>My Groups</h3><br>'
    if (groups.length == 0) {
        myGroups += '<p>None</p>'
        document.getElementById("mainSection").innerHTML = myGroups
        return
    }
    for (var i in groups) {
        index++
        myGroups += "<div class='MyGroupSection'><h3>" + index + ": " + groups[i].name + "</h3><p>" + groups[i].description + "</p>" + "</div>"
    }
    document.getElementById("mainSection").innerHTML = myGroups
}
function joinGroupSuccessfully() {
    var joinGroupSuccessfully = ''
    joinGroupSuccessfully += '<h3>Join a Group</h3><br>'
    joinGroupSuccessfully += '<p>Join group successfully</p>'
    document.getElementById("mainSection").innerHTML = joinGroupSuccessfully
}
function leaveGroupSuccessfully() {
    var leaveGroupSuccessfully = ''
    leaveGroupSuccessfully += '<h3>Leave a Group</h3><br>'
    leaveGroupSuccessfully += '<p>Leave group successfully</p>'
    document.getElementById("mainSection").innerHTML = leaveGroupSuccessfully
}
function renderTeamConfig() {
    var groupConfig = ''
    groupConfig += '<p id="getGroupsInfo">My Teams</p>'
    groupConfig += '<p id="changeCurrentGroup">Change Current Team</p>'
    groupConfig += '<p id="inviteOthers" >Invite Others to Current Team</p>'
    groupConfig += '<p id="createOneGroup" >Create a Team</p>' 
    groupConfig += '<p id="leaveOneGroup" >Leave a Team</p>'
    document.getElementById("nav").innerHTML = groupConfig
}

function renderGroups() {
    var groups = ''
    if (usermeta.groups.length == 0) {
        groups += notInAnyGroup()
        return groups
    }
    if (groupName == null) {
        groups += notInAnyGroup()
    } else {
        groups += '<p>You are currently in group ' + groupName + '<p>'
    }
    groups += '<p>Please select:</p>'
    for (var i in usermeta.groups) {
        groups += '<input type="radio" name="selected_groupName" value=' + usermeta.groups[i].groupName + '>'+ usermeta.groups[i].groupName +'<br>';
    }
    return groups
}

$(document).on('click', '#changeCurrentGroup', function() {
    var changeCurrentGroup = '<form action="http://localhost:3000/homepage/group/changeCurrentGroup" method="post">'
    changeCurrentGroup += "<input type='hidden' name='currentGroupName' value="+ groupName +">"
    changeCurrentGroup += "<input type='hidden' name='username' value=" + username + ">"
    changeCurrentGroup += '<div>'
    changeCurrentGroup += renderGroups()
    changeCurrentGroup += '</div>'
    changeCurrentGroup += '<br>'
    changeCurrentGroup += "<input type='submit' name='post' value='Submit' id='changeGroupButton' ></form>"
    document.getElementById("mainSection").innerHTML = changeCurrentGroup
    if (usermeta.groups.length == 0) {
        document.getElementById("changeGroupButton").disabled = true
    }
})

$(document).on('click', '#leaveOneGroup', function() {
    var leaveGroupForm = "<div id='leaveGroupForm'><h3>Leave a Group</h3><br>"
    leaveGroupForm += "<form action='http://localhost:3000/homepage/group/leaveOneGroup' method='post' >"
    leaveGroupForm += "<input type='hidden' name='username' value=" + username + ">"
    leaveGroupForm += "<input type='hidden' name='currentGroupName' value="+ groupName +">"
    leaveGroupForm += "Group name:<br>"
    leaveGroupForm += "<input type='text' name='leaveGroupName'><br><br>"
    leaveGroupForm += "<input type='submit' name='comment' value='Submit' class='searchGroup' ></form></div>"
    document.getElementById("mainSection").innerHTML = leaveGroupForm
})

$(document).on('click', '#getGroupsInfo', function() {
    var getGroupInfo = "<div id='getGroupInfoForm'><br>"
    getGroupInfo += "<form action='http://localhost:3000/homepage/group/getGroupsInfo' method='post' >"
    getGroupInfo += "<input type='hidden' id='username' name='username' value=" + username + ">"
    getGroupInfo += "<input type='hidden' id='groupName' name='groupName' value="+ groupName +">"
    getGroupInfo += "<input type='submit' style='display: none' id='getG' name='getInfo' value='Submit' ></form></div>"
    document.getElementById("mainSection").innerHTML = getGroupInfo
    $("#getG").trigger('click')
})

$(document).on('click', '#createOneGroup', function() {
    var createGroupForm = "<div id='createGroupSection'><h3>Create a Group</h3><br>"
    createGroupForm += "<form action='http://localhost:3000/homepage/group/createOneGroup' method='post' id='newGroup'>"
    createGroupForm += "<input type='hidden' name='username' value=" + username + ">"
    createGroupForm += "<input type='hidden' name='currentGroupName' value="+ groupName +">"
    createGroupForm += "Group name:<br>"
    createGroupForm += "<input type='text' name='groupName'><br><br>"
    createGroupForm += 'Group Type:<br>'
    createGroupForm += '<div id="cb">'
    createGroupForm += '<input type="checkbox" name="type" value="public"> Public <br>'
    createGroupForm += '<input type="checkbox" name="type" value="private"> Private <br>'
    createGroupForm += '<input type="checkbox" name="type" value="protected"> Protected <br><br></div>'
    createGroupForm += 'Description:<br>'
    createGroupForm += "<textarea rows='6' cols='50' name='description' form='newGroup'></textarea><br>"
    createGroupForm += "<input type='submit' name='comment' value='Submit' class='createOneGroup' ></form></div>"
    document.getElementById("mainSection").innerHTML = createGroupForm
})
$(document).on('click', '.commentReplyButton', function() {
    var name = $(this).parent().text().split(" ")[0]
    document.getElementById('commentArea').value = ''
    document.getElementById('commentArea').placeholder = 'Reply to ' + name + ':'
    document.getElementById('replyTo').value = name
})
$(document).on('click', '.section', function() {
    var index = parseInt($(this).text().split(":")[0], 10)
    index--
    var post = posts[index]
    var commentForm = "<div class='commentPostSection'><h3>" + post.name + "</h3><p>" + post.content + "</p>" + "</div> <br>";
    commentForm += renderComments(post) + "<br>";
    commentForm += "<form action='http://localhost:3000/homepage/newComment' method='post' id='nComment'>"
    commentForm += "<input type='hidden' name='username' value=" + username + ">"
    commentForm += "<input type='hidden' name='postName' value=" + post.name + ">"
    commentForm += "<input type='hidden' id='replyTo' name='replyTo' value=''>"
    commentForm += '<input type="hidden" name="groupName" value='+ groupName +'>'
    commentForm += "<textarea rows='6' cols='50' id='commentArea' name='comment' form='nComment'></textarea><br>"
    commentForm += "<input type='submit' name='commentButton' value='Submit' class='commentButtons' ></form></div>"
    document.getElementById("mainSection").innerHTML = commentForm
})





function logout() {
    if (confirm("Are you sure to leave?") == true) {
        window.location.href = "http://localhost:3000/logout?username=" + username
    }
}

function getChannels() {
    var getChannelsForm = '<form action="http://localhost:3000/getChannels" method="post">'
    getChannelsForm += '<input type="hidden" name="username" value="'+ username +'">'
    getChannelsForm += '<input type="hidden" name="hashedPublicKey" value="'+ hashedPublicKey +'">'
    getChannelsForm += '<input type="hidden" name="flatTeamName" value="'+ flatTeamName +'">'
    getChannelsForm += '<input type="hidden" name="readableTeamName" value="'+ readableTeamName +'">'
    getChannelsForm += '<input type="submit" name="submit" value="submit" style="display:none" id="getChannelsButton"></form>'
    document.getElementById("mainSection").innerHTML = getChannelsForm
    $("#getChannelsButton").trigger('click')
}

function newPrivateChannel() {
    var newChannelForm = '<form action="http://localhost:3000/newChannel" method="post" id="newChannel">'
    newChannelForm += 'Name: <input type="text" name="channelName"><br><br>'
    newChannelForm += "<input type='hidden' name='hashedPublicKey' value=" + hashedPublicKey + ">"
    newChannelForm += "<input type='hidden' name='flatTeamName' value="+ flatTeamName +">"
    newChannelForm += "<input type='hidden' name='readableTeamName' value="+ readableTeamName +">"
    newChannelForm += "<input type='hidden' name='username' value="+ username +">"
    newChannelForm += "<input type='hidden' name='type' value='private channel'>"
    newChannelForm += 'Server to put the repo:<br>'
    newChannelForm += '<input type="text" name="serverAddr" placeholder="git@localhost"><br><br>'
    newChannelForm += 'Purpose:<br>'
    newChannelForm += '<textarea rows="6" cols="50" name="purpose" form="newChannel"></textarea><br>'
    newChannelForm += "<input type='submit' name='createChannelButton' value='Create Channel' ></form>"
    document.getElementById("mainSection").innerHTML = newChannelForm
}

function newPublicChannel() {
    var newChannelForm = '<form action="http://localhost:3000/newChannel" method="post" id="newChannel">'
    newChannelForm += 'Name: <input type="text" name="channelName"><br><br>'
    newChannelForm += "<input type='hidden' name='hashedPublicKey' value=" + hashedPublicKey + ">"
    newChannelForm += "<input type='hidden' name='flatTeamName' value="+ flatTeamName +">"
    newChannelForm += "<input type='hidden' name='readableTeamName' value="+ readableTeamName +">"
    newChannelForm += "<input type='hidden' name='username' value="+ username +">"
    newChannelForm += "<input type='hidden' name='type' value='public channel'>"
    newChannelForm += 'Purpose:<br>'
    newChannelForm += '<textarea rows="6" cols="50" name="purpose" form="newChannel"></textarea><br>'
    newChannelForm += "<input type='submit' name='createChannelButton' value='Create Channel' ></form>"
    document.getElementById("mainSection").innerHTML = newChannelForm
}

$(document).on('click', '#inviteOthers', function() {
    var invitationForm = "<h3>Invite Others to Team</h3><br>"
    invitationForm += "<form action='http://localhost:3000/inviteToTeam' method='post'>"
    invitationForm += "<input type='hidden' name='hashedPublicKey' value=" + hashedPublicKey + ">"
    invitationForm += "<input type='hidden' name='flatTeamName' value="+ flatTeamName +">"
    invitationForm += "<input type='hidden' name='readableTeamName' value="+ readableTeamName +">"
    invitationForm += "<input type='hidden' name='username' value="+ username +">"
    invitationForm += "Invitee Email Address:<br>"
    invitationForm += "<input type='text' name='inviteeEmail'><br><br>"
    invitationForm += "<input type='submit' name='inviteButton' value='invite' ></form>"
    document.getElementById("mainSection").innerHTML = invitationForm
})
function renderChannels() {
    var ch = ''
    var para = 'hashedPublicKey=' + hashedPublicKey + '&&username=' + username + '&&readableTeamName=' + readableTeamName + '&&flatTeamName=' + flatTeamName
    for (var i in channels) {
        if (channels[i].status == 'in') {
             ch += '<a href="http://localhost:3000/renderChannel?' + para + '&&flatCName=' + channels[i].flatName + '\">' + channels[i].readableName + '</a><br>'
        }
    }
    document.getElementById("nav").innerHTML = ch
}

function renderAllChannels() {
    var notIn = false
    var ch = ''
    ch += '<p><b>Channels you belong to</b><p>'
    for (var i in channels) {
        if (channels[i].status == 'in') {
             ch +=  channels[i].readableName + '  (' + channels[i].type + ')<br>'
        } else {
            notIn = true
        }
    }
    if (notIn) {
        ch += '<br>'
        ch += '<p><b>Channels you can join</b><p>'
        for (var i in channels) {
            if (channels[i].status == 'out') {
                 ch +=  channels[i].readableName + '  (' + channels[i].type + ')<br>'
            }
        }
    }
    document.getElementById("mainSection").innerHTML = ch
}

function autoScrolling() {
    var chatemt = document.getElementById("chatbox");
    var scrollHeight = chatemt.scrollHeight                     //Scroll height after the request
    $("#chatbox").animate({ scrollTop: scrollHeight }, 0.01)    //Autoscroll to bottom of chatbox

}

function renderChatMsgs() {
    var chatMsgs = ''
    for (var i in msgs) {
        chatMsgs +=  '<p>' + msgs[i].creator + ' on ' + msgs[i].ts + ' wrote:</p>'
        chatMsgs +=  '  <p>' + msgs[i].msg + '</p><br>'
    }
    document.getElementById("chatbox").innerHTML = chatMsgs
    
    autoScrolling()
}

function renderChannelInviteeList(inviteeList) {
    var list = ""
    list += "<h3>Invite Others to Channel</h3>"
    list += "<form action='http://localhost:3000/inviteToChannel' method='post'>"
    list += "<input type='hidden' name='hashedPublicKey' value=" + hashedPublicKey + ">"
    list += "<input type='hidden' name='flatTeamName' value="+ flatTeamName +">"
    list += "<input type='hidden' name='readableTeamName' value="+ readableTeamName +">"
    list += "<input type='hidden' name='username' value="+ username +">"
    list += "<input type='hidden' name='chosenChannel' value="+ chosenChannel +">"
    for (var i in inviteeList) {
        list += "<input type='checkbox' name='inviteeList' value='" + inviteeList[i].hashedPublicKey + "'>" + inviteeList[i].username + "<br>"
    }
    list += "<br><input type='submit' name='inviteButton' value='invite' ></form>"
    document.getElementById("mainSection").innerHTML = list
}

function inviteToChannel() {
    var req = {}
    req.hashedPublicKey = hashedPublicKey
    req.flatTeamName = flatTeamName
    req.chosenChannel = chosenChannel

    $.post('http://localhost:3000/getChannelInviteeList', req, function(value) {
        value = removeHTMLTagsFrontAndEnd(value)
        var data = JSON.parse(value)
        
        if (data.inviteeListEmpty) {
            document.getElementById("mainSection").innerHTML = 'No user should be invited'
        } else {
            renderChannelInviteeList(data.inviteeList)
        }
    }, 'html') 
}

function renderChatbox() {
    var chatbox = ''

    chatbox += '<div id="wrapper">'

    chatbox +=      '<div id="menu">'
    chatbox +=          '<p id="channelInvitation">'
    chatbox +=              '<button type="button" onclick="inviteToChannel()"><b>Invite others to this channel</b></button>'
    chatbox +=          '</p>'
    chatbox +=          '<div style="clear:both"></div>'
    chatbox +=      '</div>'

    chatbox +=      '<div id="chatbox"></div>'

    chatbox +=      '<form action="http://localhost:3000/userMsg" method="post" >'
    chatbox +=          '<input type="hidden" name="hashedPublicKey" value=' + hashedPublicKey + '>'
    chatbox +=          '<input type="hidden" name="flatTeamName" value='+ flatTeamName + '>'
    chatbox +=          '<input type="hidden" name="readableTeamName" value='+ readableTeamName +'>'
    chatbox +=          '<input type="hidden" name="username" value='+ username +'>'
    chatbox +=          '<input type="hidden" name="flatCName" value='+ chosenChannel +'>'
    chatbox +=          '<input name="message" type="text" id="userMsg">'
    chatbox +=          '<input name="submitmsg" type="submit" value="Send">'
    chatbox +=      '</form>'

    chatbox += '</div>'

    document.getElementById("mainSection").innerHTML = chatbox
    renderChatMsgs()
}

//remove the html tag at the front and the end
function removeHTMLTagsFrontAndEnd(value) {
    var len = value.length
    return value.substring(6, len - 7)
}

function sendRefreshReq() {
    var req = {}
    req.hashedPublicKey = hashedPublicKey
    req.flatTeamName = flatTeamName
    req.chosenChannel = chosenChannel

    $.post('http://localhost:3000/refreshChannelMsgs', req, function(value) {
        value = removeHTMLTagsFrontAndEnd(value)

        var data = JSON.parse(value)
        if (data.updated) {
            msgs = data.msgs
            renderChatMsgs()
        } 
    }, 'html') 
}

function refresh() {
    setInterval(function(){ sendRefreshReq() }, refreshInterval)
}

function browseAllChannels() {
    var form = '<form action="http://localhost:3000/browseAllChannels" method="post">'
    form += '<input type="hidden" name="username" value="'+ username +'">'
    form += '<input type="hidden" name="hashedPublicKey" value="'+ hashedPublicKey +'">'
    form += '<input type="hidden" name="flatTeamName" value="'+ flatTeamName +'">'
    form += '<input type="hidden" name="readableTeamName" value="'+ readableTeamName +'">'
    form += '<input type="submit" name="submit" value="submit" style="display:none" id="browseAllChannelsButton"></form>'
    document.getElementById("mainSection").innerHTML = form
    $("#browseAllChannelsButton").trigger('click')
}

function start() {
    if (page == '/homepage/channels/getChannels') {
        renderChannels()
        document.getElementById("mainSection").innerHTML = 'Slack: Be less busy'
    }
    if (page == '/homepage/team/inviteToTeam/alreadyInTeam') {
        renderTeamConfig()
        alreadyInTeam()
    }
    if (page == '/homepage/team/inviteToTeam/sentEmail') {
        renderTeamConfig()
        sentInvitationEmail()
    }
    if (page == '/homepage/channels/renderChannel') {
        renderChannels()
        renderChatbox()
        refresh()
    }
    if (page == '/homepage/channels/browseAllChannels') {
        renderChannels()
        renderAllChannels()
    }



    if (page.path == 'homepage/newComment') {
        renderPosts(posts)
        renderChannels()
        $(".section").trigger('click')
    }
    if (page.path == 'homepage/group') {
        renderTeamConfig()
    }
    if (page.path == 'homepage/group/createOneGroup/AlreadyExisted') {
        renderTeamConfig()
        groupAlreadyExists()
    }
    if (page.path == 'homepage/group/createOneGroup/createGroupSuccessful') {
        renderTeamConfig()
        createGroupSuccessful()
    }
    if (page.path == 'homepage/group/getGroupsInfo') {
        renderTeamConfig()
        renderMyGroups(additionalInfo)
    }
    if (page.path == 'homepage/group/joinOneGroup/GroupNotExisted') {
        renderTeamConfig()
        NoSuchGroup('join')
    }
    
    if (page.path == 'homepage/group/joinOneGroup/joinGroupSuccessfully') {
        renderTeamConfig()
        joinGroupSuccessfully()
    }
    if (page.path == 'homepage/group/leaveOneGroup/GroupNotExisted') {
        renderTeamConfig()
        NoSuchGroup('leave')
    }
    if (page.path == 'homepage/group/leaveOneGroup/NotInGroup') {
        renderTeamConfig()
        NotInGroup()
    }
    if (page.path == 'homepage/group/leaveOneGroup/LeaveGroupSuccessfully') {
        renderTeamConfig()
        leaveGroupSuccessfully()
    }
    if (page.path == 'homepage/group/changeCurrentGroup/NoNeedToChange') {
        renderTeamConfig()
        document.getElementById("mainSection").innerHTML = "You have already been in this group"
    }
    if (page.path == 'homepage/group/changeCurrentGroup/ChangeGroupSuccessfully') {
        renderTeamConfig()
        document.getElementById("mainSection").innerHTML = "Change group successfully"
    }
}
window.onload = start
