function eachPost (post, index) {
    index++
    var section = "<div class='section'><h3>" + index + ": " + post.title + "</h3><p>" + post.content + "</p>" + "</div>" 
    return section
}
//render all the posts
function renderPosts(posts) {
    console.log(meta)
    if (posts == null) {
        return "There is no post yet"
    } else {
        document.getElementById("mainSection").innerHTML = ''
        for (var i in posts) {
            document.getElementById("mainSection").innerHTML += eachPost(posts[i], i)
        }
    }
}
//render Life, Work and Study categories in the nav part
function renderCategoryfield() {
    var categories = ''
    categories += '<a href="http://localhost:3000/homepage/all?userName=' + meta.name + '\">All</a><br>'
    categories += '<a href="http://localhost:3000/homepage/life?userName=' + meta.name + '\">life</a><br>'
    categories += '<a href="http://localhost:3000/homepage/study?userName=' + meta.name + '\">study</a><br>'
    categories += '<a href="http://localhost:3000/homepage/work?userName=' + meta.name + '\">work</a>'
    document.getElementById("nav").innerHTML = categories
}
//render all the comments belonging to a post
function renderComments(post) {
    var comments = post.comments
    if (comments.length == 0) {
        return "<p> There is no comment yet </p>"
    } else {
        var commentSection = "<p>Comments:</p><br>"
        for (var i in comments) {
            var yourComment = false
            if (comments[i].creator.name == meta.name) {
                yourComment = true
            }
            if (yourComment) {
                commentSection += "<div class='commentSection'><p>You"
            } else {
                commentSection += "<div class='commentSection'><p>" + comments[i].creator.name 
            }
            commentSection += " on "+ comments[i].ts.toString() 
            console.log(comments[i])
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
//render all the groups the user is in
function renderGroups() {
    var groups = 'Groups:<br>'
    for (var i in meta.group) {
        console.log(meta.group[0])
        groups += '<input type="checkbox" name="groupIDs" value=' + meta.group[i]._id + '>'+ meta.group[i].groupName +'<br>'
    }
    return groups
}
//create a cancel button
function cancelButton(address, method) {
    button = ""
    button += "<form action=" + address + " method=" + method + " >"
    button += "<input type='hidden' name='userName' value=" + meta.name + ">"
    button += "<button type='submit'> Cancel </button></form>"
    return button
}
//render all the group meta returned
function renderGroupMeta() {
    var groupMeta = ''
    groupMeta += "<h4>"+ group.name + "</h4>"
    groupMeta += "<p>Created on " + group.ts + "</p>"
    groupMeta +="<p>Type: "
    for (var i in group.type) {
        groupMeta += group.type[i] + " "
    }
    groupMeta += "</p>"
    groupMeta += "<p>" + group.description + "</p>"
    return groupMeta
}
//render join group form
function joinGroup() {
    var joinGroupForm = ''
    joinGroupForm += "<div id='joinGroupSection'><h3>Join a Group</h3><br>"
    joinGroupForm += renderGroupMeta()
    joinGroupForm += "<br><p>Are you sure to join the group?</p>"
    joinGroupForm += "<form action='http://localhost:3000/homepage/group/joinOneGroup/join' method='post'>"
    joinGroupForm += "<input type='hidden' name='groupID' value=" + group._id + ">"
    joinGroupForm += "<input type='hidden' name='userName' value=" + meta.name + ">"
    joinGroupForm += "<button type='submit'> Yes </button></form>"
    document.getElementById("mainSection").innerHTML = joinGroupForm
}
//send new post
function newPost() {
    var form
    form = '<form action="http://localhost:3000/homepage/newPost" method="post" id="newPost">'
    form += 'Title: <input type="text" name="title"><br>'
    form += '<input type="hidden" name="userID" value='+ meta._id +'>'
    form += 'Category:<br>'
    form += '<input type="checkbox" name="category" value="life"> Life <br>'
    form += '<input type="checkbox" name="category" value="study"> Study <br>'
    form += '<input type="checkbox" name="category" value="work"> Work <br>'
    form += renderGroups()
    form += '<textarea rows="6" cols="50" name="content" form="newPost"> </textarea><br>'
    form += '<button type="submit"> Submit </button> </form>'
    form += cancelButton('http://localhost:3000/homepage/home', 'get')
    document.getElementById("mainSection").innerHTML = form
}
//deal with logout event
function logout() {
    if (confirm("Are you sure to leave?") == true) {
        window.location.href = "http://localhost:3000/homepage/logout?user=" + JSON.stringify(meta)
    }
}
//fire when one post section is clicked
$(document).on('click', '.section', function() {
    var index = parseInt($(this).text().split(":")[0], 10)
    index--
    var post = posts[index]
    var commentForm = "<div class='commentPostSection'><h3>" + post.title + "</h3><p>" +post.content + "</p>" + "</div> <br>" 
    commentForm += renderComments(post) + "<br>"
    commentForm += "<form action='http://localhost:3000/homepage/newComment' method='post' id='newComment'>"
    commentForm += "<input type='hidden' name='userID' value=" + meta._id + ">"
    commentForm += "<input type='hidden' name='postID' value=" + post._id + ">"
    commentForm += "<input type='hidden' id='reply' name='replyTo' value=''>"
    commentForm += "<textarea rows='6' cols='50' id='commentArea' name='comment' form='newComment'> </textarea><br>"
    commentForm += "<button type='submit'> Submit </button> </form>" 
    commentForm += cancelButton('http://localhost:3000/homepage/home', 'get')
    document.getElementById("mainSection").innerHTML = commentForm
})
//fire when one reply button in the comment section is pressed
$(document).on('click', '.commentReplyButton', function() {
    var name = $(this).parent().text().split(" ")[0]
    document.getElementById('commentArea').value = ''
    document.getElementById('commentArea').placeholder = 'Reply to ' + name + ':'
    document.getElementById('reply').value = name
})
//fire when join a group is clicked
$(document).on('click', '#joinOneGroup', function() {
    var preJoinGroupForm = "<div id='preJoinGroupSection'><h3>Join a Group</h3><br>"
    preJoinGroupForm += "<form action='http://localhost:3000/homepage/group/joinOneGroup/searchGroupByName' method='post' id='newGroup'>"
    preJoinGroupForm += "<input type='hidden' name='userID' value=" + meta._id + ">"
    preJoinGroupForm += "Group name:<br>"
    preJoinGroupForm += "<input type='text' name='groupName'><br><br>"
    preJoinGroupForm += "<button type='submit'> Search </button> </form>" 
    preJoinGroupForm += cancelButton('http://localhost:3000/homepage/home', 'get')
    document.getElementById("mainSection").innerHTML = preJoinGroupForm
})
//fire when create a group is clicked
$(document).on('click', '#createOneGroup', function() {
    var createGroupForm = "<div id='createGroupSection'><h3>Create a Group</h3><br>"
    createGroupForm += "<form action='http://localhost:3000/homepage/group/createOneGroup' method='post' id='newGroup'>"
    createGroupForm += "<input type='hidden' name='userID' value=" + meta._id + ">"
    createGroupForm += "Group name:<br>"
    createGroupForm += "<input type='text' name='groupName'><br><br>"
    createGroupForm += 'Group Type:<br>'
    createGroupForm += '<input type="checkbox" name="type" value="public"> Public <br>'
    createGroupForm += '<input type="checkbox" name="type" value="private"> Private <br>'
    createGroupForm += '<input type="checkbox" name="type" value="protected"> Protected <br><br>'
    createGroupForm += 'Description:<br>'
    createGroupForm += "<textarea rows='6' cols='50' name='description' form='newGroup'> </textarea><br>"
    createGroupForm += "<button type='submit'> Submit </button> </form>" 
    createGroupForm += cancelButton('http://localhost:3000/homepage/home', 'get')
    document.getElementById("mainSection").innerHTML = createGroupForm
})
//fire when leave a group is clicked
$(document).on('click', '#leaveOneGroup', function() {
    
})
//fire when my groups is clicked
$(document).on('click', '#groupInfo', function() {
    // var groupInfoForm = ""
    // groupInfoForm += "<form action='http://localhost:3000/homepage/group/getGroupsInfor' method='post' id='getGroupsInfor'>"
    // groupInfoForm += "<input type='hidden' name='userID' value=" + meta._id + "></form>"
    // document.getElementById("mainSection").innerHTML = groupInfoForm
    // document.getElementById('getGroupsInfor').submit()
})
//render group configuration in the nav part
function renderGroupConfig() {
    var groupConfig = ''
    groupConfig += '<a href="http://localhost:3000/homepage/group/getGroupsInfo?userName=' + meta.name + '\">My Groups</a><br>'
    groupConfig += '<p id="joinOneGroup" >Join a Group</p>' 
    groupConfig += '<p id="createOneGroup" >Create a Group</p>' 
    groupConfig += '<p id="leaveOneGroup" >Leave a Group</p>' 
    document.getElementById("nav").innerHTML = groupConfig
}
function alreadyInGroup() {
    var alreadyInGroup = ''
    alreadyInGroup = '<h3>Join a Group</h3><br>'
    alreadyInGroup += '<p>There is no need to join, you have already been in '+ group.name + '</p>'
    document.getElementById("mainSection").innerHTML = alreadyInGroup
}
function searchNoResult() {
    var searchNoResult = ''
    searchNoResult = '<h3>Join a Group</h3><br>'
    searchNoResult += '<p>There is no such a group</p>'
    document.getElementById("mainSection").innerHTML = searchNoResult
}
function joinSuc() {
    var joinSuc = ''
    joinSuc = '<h3>Join a Group</h3><br>'
    joinSuc += '<p>Join ' + group.name + ' successfully</p>'
    document.getElementById("mainSection").innerHTML = joinSuc
}
function start() {
    if (page.path == 'group/joinOneGroup/joinSuc') {
        renderGroupConfig()
        joinSuc()
    }
    if (page.path == 'group/joinOneGroup/afterSearch/noResult') {
        renderGroupConfig()
        searchNoResult()
    }
    if (page.path == 'group/joinOneGroup/afterSearch/alreadyIn') {
        renderGroupConfig()
        alreadyInGroup()
    }
    if (page.path == 'group/joinOneGroup/afterSearch/whetherToJoin') {
        renderGroupConfig()
        joinGroup()
    }
    if (page.path == 'postPage') {
        renderPosts(posts)
        renderCategoryfield()
    }
}
window.onload = start
