var refreshCycle = 4000

function notInAnyGroup() {
    document.getElementById("tags").disabled = true
    document.getElementById("newPost").disabled = true
    document.getElementById("views").disabled = true
    renderGroupConfig()
    return '<p>Note: You are not in any group, you cannot do anything until you are in a group!</p>'
}

function eachPost(post, index) {
    index++
    var section = "<div class='section'><h3>" + index + ": " + post.title + "</h3><p>" + post.pContent + "</p>" + "</div>"
    return section
}
function renderPosts() {
    if (posts.length == 0) {
        document.getElementById("mainSection").innerHTML = '<p>There is no post yet</P>'
    } else {
        document.getElementById("mainSection").innerHTML = ''
        for (var i in posts) {
            document.getElementById("mainSection").innerHTML += eachPost(posts[i], i)
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
function groupAlreadyExists() {
    var groupAlreadyExists = ''
    groupAlreadyExists = '<h3>Create a Group</h3>'
    groupAlreadyExists += '<p>Failed to create the group, as the group already exists</p>'
    document.getElementById("mainSection").innerHTML += groupAlreadyExists
}
function viewAlreadyExists() {
    var viewAlreadyExists = ''
    viewAlreadyExists = '<h3>Create View</h3>'
    viewAlreadyExists += '<p>Failed to create the group, as the view already exists</p>'
    document.getElementById("mainSection").innerHTML += viewAlreadyExists
}
function createViewSuccessfully() {
    var createViewSuccessful = ''
    createViewSuccessful += '<h3>Create View</h3><br>'
    createViewSuccessful += '<p>Create View successfully</p>'
    document.getElementById("mainSection").innerHTML += createViewSuccessful
}



function renderTagfield() {
    var arguments = 'username=' + username + '&&groupName=' + groupName + '&&view=' + view + '&&hashedPublicKey=' + hashedPublicKey
    var tags = ''

    tags += '<a href="http://localhost:3000/renderPostsByTag?type=' + 'all&&'+ arguments + '\">All</a><br>'
    tags += '<a href="http://localhost:3000/renderPostsByTag?type=' + 'life&&'+ arguments + '\">Life</a><br>'
    tags += '<a href="http://localhost:3000/renderPostsByTag?type=' + 'study&&'+ arguments + '\">Study</a><br>'
    tags += '<a href="http://localhost:3000/renderPostsByTag?type=' + 'work&&'+ arguments + '\">Work</a>'
    document.getElementById("nav").innerHTML = tags
}

function renderViewsManagement() {
    var viewManagement = ''
    viewManagement += '<p id="views">Views</p>'
    viewManagement += '<p id="changeCurrrentView">Change Current View</p>'
    viewManagement += '<p id="createBranchView">Create Branch View</p>' 
    viewManagement += '<p id="deleteView">Delete View</p>'
    viewManagement += '<p id="manageView">Manage View</p>'
    document.getElementById("nav").innerHTML = viewManagement
}

function renderViews(views) {
    var views_info = ''
    views_info += '<h3>Change View</h3><br>'
    views_info += '<p>You are currently in view ' + view + '<p>'
    views_info += '<p>Please select:</p>'
    for (var i in views) {
        if (views[i] == view) {
            continue
        }
        views_info += '<input type="radio" name="chosenView" value=' + views[i] + '>'+ views[i] +'<br>';
    }
    return views_info
}

function showAllViews(views) {
    var showAllViews = '<form action="http://localhost:3000/changeCurrentView" method="post">'
    showAllViews += "<input type='hidden' name='groupName' value="+ groupName +">"
    showAllViews += "<input type='hidden' name='hashedPublicKey' value=" + hashedPublicKey + ">"
    showAllViews += "<input type='hidden' name='username' value=" + username + ">"
    showAllViews += "<input type='hidden' name='view' value=" + view + ">"
    showAllViews += renderViews(views)
    showAllViews += '<br>'
    showAllViews += "<input type='submit' name='post' value='Choose' ></form>"
    document.getElementById("mainSection").innerHTML = showAllViews
}

function findAndShowAllViews() {
    var req = {}
    req.groupName = groupName
    req.hashedPublicKey = hashedPublicKey

    $.post('http://localhost:3000/findAllViews', req, function(value) {
        value = removeHTMLTagsFrontAndEnd(value)

        var data = JSON.parse(value)
        showAllViews(data.views)
    }, 'html') 
}

$(document).on('click', '#changeCurrrentView', function() {
    findAndShowAllViews()
})

$(document).on('click', '#createBranchView', function() {
    var createViewForm = "<h3>Create View</h3><br>"
    createViewForm += "<form action='http://localhost:3000/createBranchView' method='post'>"
    createViewForm += "<input type='hidden' name='username' value=" + username + ">"
    createViewForm += "<input type='hidden' name='groupName' value="+ groupName +">"
    createViewForm += "<input type='hidden' name='hashedPublicKey' value=" + hashedPublicKey + ">"
    createViewForm += "<input type='hidden' name='currentView' value=" + view + ">"
    createViewForm += "View Name:<br>"
    createViewForm += "<input type='text' name='newView'><br><br>"
    createViewForm += "Rule 1: Filter Keywords:<br>"
    createViewForm += "<input type='text' name='filterKeyWords'><br><br><br>"
    createViewForm += "<input type='submit' name='createBranchView' value='Create'></form>"
    document.getElementById("mainSection").innerHTML = createViewForm
})

$(document).on('click', '#joinGroup', function() {
    var JoinGroupForm = "<div id='JoinGroupForm'><h3>Join a Group</h3><br>"
    JoinGroupForm += "<form action='http://localhost:3000/joinGroup' method='post'>"
    JoinGroupForm += "<input type='hidden' name='username' value=" + username + ">"
    JoinGroupForm += "<input type='hidden' name='currentGroupName' value="+ groupName +">"
    JoinGroupForm += "<input type='hidden' name='hashedPublicKey' value=" + hashedPublicKey + ">"
    JoinGroupForm += "<input type='hidden' name='view' value=" + view + ">"
    JoinGroupForm += "Group name:<br>"
    JoinGroupForm += "<input type='text' name='joinGroupName'><br><br>"
    JoinGroupForm += "<input type='submit' name='join' value='Join'></form></div>"
    document.getElementById("mainSection").innerHTML = JoinGroupForm
})

function newPost() {
    var newPostForm = '<form action="http://localhost:3000/newPost" method="post" id="nPost">'
    newPostForm += 'Title: <input type="text" name="title"><br>'
    newPostForm += '<input type="hidden" name="username" value="'+ username +'">'
    newPostForm += '<input type="hidden" name="groupName" value="'+ groupName +'">'
    newPostForm += "<input type='hidden' name='hashedPublicKey' value=" + hashedPublicKey + ">"
    newPostForm += "<input type='hidden' name='view' value=" + view + ">"
    newPostForm += 'Tags:<br>'
    newPostForm += '<input type="checkbox" name="tag" value="life"> Life <br>'
    newPostForm += '<input type="checkbox" name="tag" value="study"> Study <br>'
    newPostForm += '<input type="checkbox" name="tag" value="work"> Work <br>'
    newPostForm += '<textarea rows="6" cols="50" name="postContent" form="nPost"></textarea><br>'
    newPostForm += "<input type='submit' name='submit' value='Post' ></form>"
    document.getElementById("mainSection").innerHTML = newPostForm
}

function renderGroups(groups) {
    var groups_info = ''
    groups_info += '<h3>Change Group</h3><br>'
    if (groups.length == 0) {
        groups_info += notInAnyGroup()
        return groups_info
    }
    if (groupName == 'null') {
        groups_info += notInAnyGroup()
    } else {
        groups_info += '<p>You are currently in group ' + groupName + '<p>'
    }
    groups_info += '<p>Please select:</p>'
    for (var i in groups) {
        groups_info += '<input type="radio" name="chosenGroup" value=' + groups[i] + '>'+ groups[i] +'<br>';
    }
    return groups_info
}

function showAllGroups(groups) {
    var changeCurrentGroup = '<form action="http://localhost:3000/changeCurrentGroup" method="post">'
    changeCurrentGroup += "<input type='hidden' name='currentGroupName' value="+ groupName +">"
    changeCurrentGroup += "<input type='hidden' name='hashedPublicKey' value=" + hashedPublicKey + ">"
    changeCurrentGroup += "<input type='hidden' name='username' value=" + username + ">"
    changeCurrentGroup += "<input type='hidden' name='view' value=" + view + ">"
    changeCurrentGroup += renderGroups(groups)
    changeCurrentGroup += '<br>'
    changeCurrentGroup += "<input type='submit' name='post' value='Choose' ></form>"
    document.getElementById("mainSection").innerHTML = changeCurrentGroup
}

//remove the html tag at the front and the end
function removeHTMLTagsFrontAndEnd(value) {
    var len = value.length
    return value.substring(6, len - 7)
}

function findAndShowAllGroups() {
    var req = {}
    req.hashedPublicKey = hashedPublicKey

    $.post('http://localhost:3000/findAllGroups', req, function(value) {
        value = removeHTMLTagsFrontAndEnd(value)

        var data = JSON.parse(value)
        showAllGroups(data.groups)
    }, 'html') 
}

$(document).on('click', '#changeCurrentGroup', function() {
    findAndShowAllGroups()
})

$(document).on('click', '#createOneGroup', function() {
    var createGroupForm = "<div id='createGroupSection'><h3>Create a Group</h3>"
    createGroupForm += "<form action='http://localhost:3000/createGroup' method='post' id='newGroup'>"
    createGroupForm += "<input type='hidden' name='hashedPublicKey' value=" + hashedPublicKey + ">"
    createGroupForm += "<input type='hidden' name='username' value=" + username + ">"
    createGroupForm += "<input type='hidden' name='currentGroupName' value="+ groupName +">"
    createGroupForm += "<input type='hidden' name='view' value="+ view +">"
    createGroupForm += "Group name:<br>"
    createGroupForm += "<input type='text' name='groupName'><br><br>"
    createGroupForm += "Server address:<br>"
    createGroupForm += "<input type='text' name='serverAddr'><br><br>"
    createGroupForm += 'Description:<br>'
    createGroupForm += "<textarea rows='6' cols='50' name='description' form='newGroup'></textarea><br>"
    createGroupForm += "<input type='submit' name='create group' value='Create'></form></div>"
    document.getElementById("mainSection").innerHTML = createGroupForm
})

//remove the html tag at the front and the end
function removeHTMLTagsFrontAndEnd(value) {
    var len = value.length
    return value.substring(6, len - 7)
}

function postsEqual(A, B) {
    if (A.length != B.length) {
        return false
    } else {
        for (var i in A) {
            var find = false
            var postA = A[i]
            for (var j in B) {
                var postB = B[j]
                if (postA.creator == postB.creator && postA.ts == postB.ts) {
                    find = true
                    break
                }
            }
            if (!find) {
                return false
            }
        }
        return true
    }
}

function sendRefreshReq() {
    var req = {}
    req.hashedPublicKey = hashedPublicKey
    req.groupName = groupName
    req.view = view

    $.post('http://localhost:3000/refreshPosts', req, function(value) {
        value = removeHTMLTagsFrontAndEnd(value)

        var data = JSON.parse(value)

        if (!postsEqual(posts, data.posts)) {
            posts = data.posts
            renderPosts()
        }
    }, 'html') 
}

function changeViewSuccessfully() {
    var changeViewSuccessfully = ''
    changeViewSuccessfully += '<h3>Change View</h3><br>'
    changeViewSuccessfully += '<p>Change to View: ' + view + '</p>'
    document.getElementById("mainSection").innerHTML += changeViewSuccessfully
}

function refresh() {
    setInterval(function(){ sendRefreshReq() }, refreshCycle)
}

function start() {
    document.getElementById("mainSection").innerHTML = ''
    if (groupName == 'null') {
        document.getElementById("mainSection").innerHTML += notInAnyGroup()
    }
    if (page == 'homepage/group') {
        renderGroupConfig()
    }
    if (page == 'homepage/group/createOneGroup/AlreadyExisted') {
        renderGroupConfig()
        groupAlreadyExists()
    }
    if (page == 'homepage/group/createOneGroup/createGroupSuccessful') {
        renderGroupConfig()
        createGroupSuccessful()
    }
    if (page == 'homepage/group/changeCurrentGroup/NoNeedToChange') {
        renderGroupConfig()
        document.getElementById("mainSection").innerHTML = "You have already been in this group"
    }
    if (page == 'homepage/group/changeCurrentGroup/ChangeGroupSuccessfully') {
        renderGroupConfig()
        document.getElementById("mainSection").innerHTML = "Change group successfully"
    }
    if (page == 'homepage/posts') {
        renderPosts()
        renderTagfield()
        refresh()
    }
    if (page == 'homepage/group/joinOneGroup/GroupNotExisted') {
        renderGroupConfig()
        NoSuchGroup('join')
    }
    if (page == 'homepage/group/joinOneGroup/joinGroupSuccessfully') {
        renderGroupConfig()
        joinGroupSuccessfully()
    }
    if (page == 'homepage/views/createBranchView/viewAlreadyExisted') {
        renderViewsManagement()
        viewAlreadyExists()
    }
    if (page == 'homepage/views/createBranchView/createViewSuccessfully') {
        renderViewsManagement()
        createViewSuccessfully()
    }
    if (page == 'homepage/views/changeView') {
        renderViewsManagement()
        changeViewSuccessfully()
    }



    if (page.path == 'homepage/tags') {
        renderPosts()
        renderTagfield()
    }
    if (page.path == 'homepage/newComment') {
        renderPosts()
        renderTagfield()
        $(".section").trigger('click')
    }
    if (page.path == 'homepage/group/getGroupsInfo') {
        renderGroupConfig()
        renderMyGroups(additionalInfo)
    }
    if (page.path == 'homepage/group/leaveOneGroup/GroupNotExisted') {
        renderGroupConfig()
        NoSuchGroup('leave')
    }
    if (page.path == 'homepage/group/joinOneGroup/AlreadyInGroup') {
        renderGroupConfig()
        alreadyInGroup()
    }
    if (page.path == 'homepage/group/leaveOneGroup/NotInGroup') {
        renderGroupConfig()
        NotInGroup()
    }
    if (page.path == 'homepage/group/leaveOneGroup/LeaveGroupSuccessfully') {
        renderGroupConfig()
        leaveGroupSuccessfully()
    }
}
window.onload = start
