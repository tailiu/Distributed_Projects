function notInAnyGroup() {
    document.getElementById("tags").disabled = true
    document.getElementById("newPost").disabled = true
    renderGroupConfig()
    return '<p>Note: You are not in any group, you cannot post anything until you are in a group!</p>'
}

function eachPost (post, index) {
    index++
    var section = "<div class='section'><h3>" + index + ": " + post.name + "</h3><p>" + post.content + "</p>" + "</div>"
    return section
}
function renderPosts(posts) {
    if (posts.length == 0) {
        document.getElementById("mainSection").innerHTML += '<p>There is no post yet</P>'
    } else {
        document.getElementById("mainSection").innerHTML += ''
        for (var i in posts) {
            document.getElementById("mainSection").innerHTML += eachPost(posts[i], i)
        }
    }
}
function renderTagfield() {
    var tags = ''
    tags += '<a href="http://localhost:3000/homepage/all?username=' + username + '&&groupName=' + groupName + '\">All</a><br>'
    tags += '<a href="http://localhost:3000/homepage/life?username=' + username + '&&groupName=' + groupName + '\">life</a><br>'
    tags += '<a href="http://localhost:3000/homepage/study?username=' + username + '&&groupName=' + groupName + '\">study</a><br>'
    tags += '<a href="http://localhost:3000/homepage/work?username=' + username + '&&groupName=' + groupName + '\">work</a>'
    document.getElementById("nav").innerHTML = tags
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

function newPost() {
    var newPostForm = '<form action="http://localhost:3000/homepage/newPost" method="post" id="nPost">'
    newPostForm += 'Title: <input type="text" name="title"><br>'
    newPostForm += '<input type="hidden" name="username" value="'+ username +'">'
    newPostForm += '<input type="hidden" name="groupName" value="'+ groupName +'">'
    newPostForm += 'Tags:<br>'
    newPostForm += '<input type="checkbox" name="tag" value="life"> Life <br>'
    newPostForm += '<input type="checkbox" name="tag" value="study"> Study <br>'
    newPostForm += '<input type="checkbox" name="tag" value="work"> Work <br>'
    newPostForm += '<textarea rows="6" cols="50" name="content" form="nPost"></textarea><br>'
    newPostForm += "<input type='submit' name='post' value='Submit' class='postButtons' ></form>"
    document.getElementById("mainSection").innerHTML = newPostForm
}
function logout() {
    if (confirm("Are you sure to leave?") == true) {
        window.location.href = "http://localhost:3000/homepage/logout?username=" + username
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
    document.getElementById("mainSection").innerHTML += searchNoResult
}
function alreadyInGroup() {
    var alreadyInGroup = ''
    alreadyInGroup = '<h3>Join a Group</h3><br>'
    alreadyInGroup += '<p>You have already been in this group</p>'
    document.getElementById("mainSection").innerHTML += alreadyInGroup
}
function NotInGroup() {
    var NotInGroup = ''
    NotInGroup = '<h3>Leave a Group</h3><br>'
    NotInGroup += '<p>You are not in this group</p>'
    document.getElementById("mainSection").innerHTML += NotInGroup
}
function groupAlreadyExists() {
    var groupAlreadyExists = ''
    groupAlreadyExists = '<h3>Create a Group</h3><br>'
    groupAlreadyExists += '<p>Sorry, group already exists</p>'
    document.getElementById("mainSection").innerHTML += groupAlreadyExists
}
function createGroupSuccessful() {
    var createGroupSuccessful = ''
    createGroupSuccessful += '<h3>Create a Group</h3><br>'
    createGroupSuccessful += '<p>Create group successfully</p>'
    document.getElementById("mainSection").innerHTML += createGroupSuccessful
}
function renderMyGroups(groups) {
    var myGroups = ''
    var index = 0
    myGroups += '<h3>My Groups</h3><br>'
    if (groups.length == 0) {
        myGroups += '<p>None</p>'
        document.getElementById("mainSection").innerHTML += myGroups
        return
    }
    for (var i in groups) {
        index++
        myGroups += "<div class='MyGroupSection'><h3>" + index + ": " + groups[i].name + "</h3><p>" + groups[i].description + "</p>" + "</div>"
    }
    document.getElementById("mainSection").innerHTML += myGroups
}
function joinGroupSuccessfully() {
    var joinGroupSuccessfully = ''
    joinGroupSuccessfully += '<h3>Join a Group</h3><br>'
    joinGroupSuccessfully += '<p>Join group successfully</p>'
    document.getElementById("mainSection").innerHTML += joinGroupSuccessfully
}
function leaveGroupSuccessfully() {
    var leaveGroupSuccessfully = ''
    leaveGroupSuccessfully += '<h3>Leave a Group</h3><br>'
    leaveGroupSuccessfully += '<p>Leave group successfully</p>'
    document.getElementById("mainSection").innerHTML += leaveGroupSuccessfully
}
function renderGroupConfig() {
    var groupConfig = ''
    groupConfig += '<p id="getGroupsInfo">My Groups</p>'
    groupConfig += '<p id="changeCurrentGroup">Change Current Group</p>'
    groupConfig += '<p id="joinGroup" >Join a Group</p>'
    groupConfig += '<p id="createOneGroup" >Create a Group</p>' 
    groupConfig += '<p id="leaveOneGroup" >Leave a Group</p>'
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

$(document).on('click', '#joinGroup', function() {
    var JoinGroupForm = "<div id='JoinGroupForm'><h3>Join a Group</h3><br>"
    JoinGroupForm += "<form action='http://localhost:3000/homepage/group/joinOneGroupReq' method='post'>"
    JoinGroupForm += "<input type='hidden' name='username' value=" + username + ">"
    JoinGroupForm += "<input type='hidden' name='currentGroupName' value="+ groupName +">"
    JoinGroupForm += "Group name:<br>"
    JoinGroupForm += "<input type='text' name='joinGroupName'><br><br>"
    JoinGroupForm += "<input type='submit' name='join' value='Join' class='searchGroup' ></form></div>"
    document.getElementById("mainSection").innerHTML = JoinGroupForm
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

function start() {
    document.getElementById("mainSection").innerHTML = ''
    if (groupName == null) {
        document.getElementById("mainSection").innerHTML += notInAnyGroup()
    }
    if (page.path == 'homepage/tags') {
        renderPosts(posts)
        renderTagfield()
    }
    if (page.path == 'homepage/newComment') {
        renderPosts(posts)
        renderTagfield()
        $(".section").trigger('click')
    }
    if (page.path == 'homepage/group') {
        renderGroupConfig()
    }
    if (page.path == 'homepage/group/createOneGroup/AlreadyExisted') {
        renderGroupConfig()
        groupAlreadyExists()
    }
    if (page.path == 'homepage/group/createOneGroup/createGroupSuccessful') {
        renderGroupConfig()
        createGroupSuccessful()
    }
    if (page.path == 'homepage/group/getGroupsInfo') {
        renderGroupConfig()
        renderMyGroups(additionalInfo)
    }
    if (page.path == 'homepage/group/joinOneGroup/GroupNotExisted') {
        renderGroupConfig()
        NoSuchGroup('join')
    }
    if (page.path == 'homepage/group/joinOneGroup/AlreadyInGroup') {
        renderGroupConfig()
        alreadyInGroup()
    }
    if (page.path == 'homepage/group/joinOneGroup/joinGroupSuccessfully') {
        renderGroupConfig()
        joinGroupSuccessfully()
    }
    if (page.path == 'homepage/group/leaveOneGroup/GroupNotExisted') {
        renderGroupConfig()
        NoSuchGroup('leave')
    }
    if (page.path == 'homepage/group/leaveOneGroup/NotInGroup') {
        renderGroupConfig()
        NotInGroup()
    }
    if (page.path == 'homepage/group/leaveOneGroup/LeaveGroupSuccessfully') {
        renderGroupConfig()
        leaveGroupSuccessfully()
    }
    if (page.path == 'homepage/group/changeCurrentGroup/NoNeedToChange') {
        renderGroupConfig()
        document.getElementById("mainSection").innerHTML += "You have already been in this group"
    }
    if (page.path == 'homepage/group/changeCurrentGroup/ChangeGroupSuccessfully') {
        renderGroupConfig()
        document.getElementById("mainSection").innerHTML += "Change group successfully"
    }
}
window.onload = start
