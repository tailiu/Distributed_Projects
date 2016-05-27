function eachPost (post, index) {
    index++;
    var section = "<div class='section'><h3>" + index + ": " + post.name + "</h3><p>" + post.content[1].content + "</p>" + "</div>";
    return section;
};
function renderPosts(posts) {
    if (posts.length == 0) {
        document.getElementById("mainSection").innerHTML = '<p>There is no post yet</P>';
        if (groupID.groupID == undefined) {
            document.getElementById("mainSection").innerHTML += '<p>Note: You are not in any group, you cannot post anything!</P>';
        }
    } else {
        document.getElementById("mainSection").innerHTML = '';
        for (var i in posts) {
            document.getElementById("mainSection").innerHTML += eachPost(posts[i], i);
        }
    }
};
function renderTagfield() {
    var tags = ''
    tags += '<a href="http://localhost:3000/homepage/all?userName=' + meta.name + '&&groupID=' + groupID.groupID + '\">All</a><br>'
    tags += '<a href="http://localhost:3000/homepage/life?userName=' + meta.name + '&&groupID=' + groupID.groupID + '\">life</a><br>'
    tags += '<a href="http://localhost:3000/homepage/study?userName=' + meta.name + '&&groupID=' + groupID.groupID + '\">study</a><br>'
    tags += '<a href="http://localhost:3000/homepage/work?userName=' + meta.name + '&&groupID=' + groupID.groupID + '\">work</a>'
    document.getElementById("nav").innerHTML = tags
}
function renderComments(post) {
    var comments = post.content.slice(2, post.content.length);
    if (comments.length == 0) {
        return "<p> There is no comment yet </p>";
    } else {
        var commentSection = "<p>Comments:</p><br>";
        for (var i in comments) {
            var yourComment = false;
            if (comments[i].creator.name == meta.name) {
                yourComment = true;
            }
            if (yourComment) {
                commentSection += "<div class='commentSection'><p>You";
            } else {
                commentSection += "<div class='commentSection'><p>" + comments[i].creator.name; 
            }
            commentSection += " on "+ comments[i].ts.toString();
            if (comments[i].replyTo.length != 0) {
                commentSection += " replied to " + comments[i].replyTo +": </p>";
            } else {
                commentSection += " commented: </p>";
            }
            commentSection += "<p>" + comments[i].content + "</p> ";
            if (!yourComment) {
                commentSection += "<button type='button' class='commentReplyButton'>Reply</button>";
            }
            commentSection += "</div>";
        }
        return commentSection;
    }
};
function newPost() {
    var newPostForm = '<form action="http://localhost:3000/homepage/newPost" method="post" id="newPost">'
    newPostForm += 'Title: <input type="text" id="title" name="title"><br>'
    newPostForm += '<input type="hidden" id="username" name="username" value='+ meta.name +'>'
    newPostForm += '<input type="hidden" id="groupID" name="groupID" value='+ groupID.groupID +'>'
    newPostForm += 'Tags:<br>'
    newPostForm += '<div id="cb">'
    newPostForm += '<input type="checkbox" name="tag" value="life"> Life <br>'
    newPostForm += '<input type="checkbox" name="tag" value="study"> Study <br>'
    newPostForm += '<input type="checkbox" name="tag" value="work"> Work <br></div>'
    newPostForm += '<textarea rows="6" cols="50" id="content" name="content" form="newPost"> </textarea><br>'
    newPostForm += "<input type='submit' name='post' value='Submit' class='postButtons' ></form></div>"
    document.getElementById("mainSection").innerHTML = newPostForm;
}
function logout() {
    if (confirm("Are you sure to leave?") == true) {
        window.location.href = "http://localhost:3000/homepage/logout?user=" + meta.name
    }
}
function NoSuchGroup(option) {
    var searchNoResult = '';
    if (option == 'join') {
        searchNoResult += '<h3>Join a Group</h3><br>';
    } else if (option == 'leave') {
        searchNoResult += '<h3>Leave a Group</h3><br>';
    }
    searchNoResult += '<p>There is no such a group</p>';
    document.getElementById("mainSection").innerHTML = searchNoResult;
}
function alreadyInGroup() {
    var alreadyInGroup = '';
    alreadyInGroup = '<h3>Join a Group</h3><br>';
    alreadyInGroup += '<p>You have already been in this group</p>';
    document.getElementById("mainSection").innerHTML = alreadyInGroup;
}
function NotInGroup() {
    var NotInGroup = '';
    NotInGroup = '<h3>Leave a Group</h3><br>';
    NotInGroup += '<p>You are not in this group</p>';
    document.getElementById("mainSection").innerHTML = NotInGroup;
}
function groupAlreadyExists() {
    var groupAlreadyExists = '';
    groupAlreadyExists = '<h3>Create a Group</h3><br>';
    groupAlreadyExists += '<p>Sorry, group already exists</p>';
    document.getElementById("mainSection").innerHTML = groupAlreadyExists;
}
function createGroupSuccessful() {
    var createGroupSuccessful = '';
    createGroupSuccessful += '<h3>Create a Group</h3><br>';
    createGroupSuccessful += '<p>Create group successfully</p>';
    document.getElementById("mainSection").innerHTML = createGroupSuccessful;
}
function renderMyGroups(groups) {
    var myGroups = '';
    var index = 0;
    myGroups += '<h3>My Groups</h3><br>';
    for (var i in groups) {
        index++;
        myGroups += "<div class='MyGroupSection'><h3>" + index + ": " + groups[i].name + "</h3><p>" + groups[i].description + "</p>" + "</div>";
    }
    document.getElementById("mainSection").innerHTML = myGroups;
}
function joinGroupSuccessfully() {
    var joinGroupSuccessfully = '';
    joinGroupSuccessfully += '<h3>Join a Group</h3><br>';
    joinGroupSuccessfully += '<p>Join the group successfully</p>';
    document.getElementById("mainSection").innerHTML = joinGroupSuccessfully;
}
function leaveGroupSuccessfully() {
    var leaveGroupSuccessfully = '';
    leaveGroupSuccessfully += '<h3>Leave a Group</h3><br>';
    leaveGroupSuccessfully += '<p>Leave group successfully</p>';
    document.getElementById("mainSection").innerHTML = leaveGroupSuccessfully;
}
function renderGroupConfig() {
    var groupConfig = '';
    groupConfig += '<p id="getGroupsInfo">My Groups</p>';
    groupConfig += '<p id="changeCurrentGroup">Change Current Group</p>';
    groupConfig += '<p id="joinGroup" >Join a Group</p>'; 
    groupConfig += '<p id="createOneGroup" >Create a Group</p>'; 
    groupConfig += '<p id="leaveOneGroup" >Leave a Group</p>';
    document.getElementById("nav").innerHTML = groupConfig;
}
function renderGroups() {
    var groups = '';
    for (var i in meta.group) {
        groups += '<input type="radio" name="selected_groupID" value=' + meta.group[i]._id + '>'+ meta.group[i].groupName +'<br>';
    }
    return groups;
}
$(document).on('click', '#changeCurrentGroup', function() {
    var changeCurrentGroup = '<p>Please select:</p>'
    changeCurrentGroup += '<form action="http://localhost:3000/homepage/group/changeCurrentGroup" method="post" id="leaveGroup">'
    changeCurrentGroup += "<input type='hidden' id='groupID' name='groupID' value="+ groupID.groupID +">"
    changeCurrentGroup += "<input type='hidden' id='username' name='username' value=" + meta.name + ">"
    changeCurrentGroup += '<div id="groups">'
    changeCurrentGroup += renderGroups()
    changeCurrentGroup += '</div>'
    changeCurrentGroup += '<br>'
    changeCurrentGroup += "<input type='submit' name='post' value='Submit' class='postButtons' ></form>"
    document.getElementById("mainSection").innerHTML = changeCurrentGroup
});
$(document).on('click', '#leaveOneGroup', function() {
    var leaveGroupForm = "<div id='leaveGroupForm'><h3>Leave a Group</h3><br>"
    leaveGroupForm += "<form action='http://localhost:3000/homepage/group/leaveOneGroup' method='post' id='leaveGroup'>"
    leaveGroupForm += "<input type='hidden' id='username' name='username' value=" + meta.name + ">"
    leaveGroupForm += "<input type='hidden' id='groupID' name='groupID' value="+ groupID.groupID +">"
    leaveGroupForm += "Group name:<br>"
    leaveGroupForm += "<input type='text' id='groupName' name='groupName'><br><br>"
    leaveGroupForm += "<input type='submit' name='comment' value='Submit' class='searchGroup' ></form></div>"
    document.getElementById("mainSection").innerHTML = leaveGroupForm
});
$(document).on('click', '#getGroupsInfo', function() {
    var getGroupInfo = "<div id='getGroupInfoForm'><br>"
    getGroupInfo += "<form action='http://localhost:3000/homepage/group/getGroupsInfo' method='post' >"
    getGroupInfo += "<input type='hidden' id='username' name='username' value=" + meta.name + ">"
    getGroupInfo += "<input type='hidden' id='groupID' name='groupID' value="+ groupID.groupID +">"
    getGroupInfo += "<input type='submit' style='display: none' id='getG' name='getInfo' value='Submit' ></form></div>"
    document.getElementById("mainSection").innerHTML = getGroupInfo
    $("#getG").trigger('click');
});
$(document).on('click', '#createOneGroup', function() {
    var createGroupForm = "<div id='createGroupSection'><h3>Create a Group</h3><br>"
    createGroupForm += "<form action='http://localhost:3000/homepage/group/createOneGroup' method='post' id='newGroup'>"
    createGroupForm += "<input type='hidden' id='username' name='username' value=" + meta.name + ">"
    createGroupForm += "<input type='hidden' id='groupID' name='groupID' value="+ groupID.groupID +">"
    createGroupForm += "Group name:<br>"
    createGroupForm += "<input type='text' id='groupName' name='groupName'><br><br>"
    createGroupForm += 'Group Type:<br>'
    createGroupForm += '<div id="cb">'
    createGroupForm += '<input type="checkbox" name="type" value="public"> Public <br>'
    createGroupForm += '<input type="checkbox" name="type" value="private"> Private <br>'
    createGroupForm += '<input type="checkbox" name="type" value="protected"> Protected <br><br></div>'
    createGroupForm += 'Description:<br>'
    createGroupForm += "<textarea rows='6' cols='50' id='description' name='description' form='newGroup'> </textarea><br>"
    createGroupForm += "<input type='submit' name='comment' value='Submit' class='createOneGroup' ></form></div>"
    document.getElementById("mainSection").innerHTML = createGroupForm
});

$(document).on('click', '#joinGroup', function() {
    var JoinGroupForm = "<div id='JoinGroupForm'><h3>Join a Group</h3><br>";
    JoinGroupForm += "<form action='http://localhost:3000/homepage/group/joinOneGroup' method='post' id='newGroup'>"
    JoinGroupForm += "<input type='hidden' id='username' name='username' value=" + meta.name + ">";
    JoinGroupForm += "<input type='hidden' id='groupID' name='groupID' value="+ groupID.groupID +">"
    JoinGroupForm += "Group name:<br>";
    JoinGroupForm += "<input type='text' id='groupName' name='groupName'><br><br>";
    JoinGroupForm += "<input type='submit' name='join' value='Join' class='searchGroup' ></form></div>";
    document.getElementById("mainSection").innerHTML = JoinGroupForm;
});
$(document).on('click', '.commentReplyButton', function() {
    var name = $(this).parent().text().split(" ")[0];
    document.getElementById('commentArea').value = '';
    document.getElementById('commentArea').placeholder = 'Reply to ' + name + ':';
    document.getElementById('replyTo').value = name;
});
$(document).on('click', '.section', function() {
    var index = parseInt($(this).text().split(":")[0], 10);
    index--;
    var post = posts[index];
    var commentForm = "<div class='commentPostSection'><h3>" + post.name + "</h3><p>" + post.content[1].content + "</p>" + "</div> <br>";
    commentForm += renderComments(post) + "<br>";
    commentForm += "<form action='http://localhost:3000/homepage/newComment' method='post' id='newComment'>"
    commentForm += "<input type='hidden' id='username' name='username' value=" + meta.name + ">"
    commentForm += "<input type='hidden' id='postID' name='postID' value=" + post._id + ">"
    commentForm += "<input type='hidden' id='replyTo' name='replyTo' value=''>"
    commentForm += '<input type="hidden" id="groupID" name="groupID" value='+ groupID.groupID +'>'
    commentForm += "<textarea rows='6' cols='50' id='commentArea' name='comment' form='newComment'> </textarea><br>"
    commentForm += "<input type='submit' name='commentButton' value='Submit' class='commentButtons' ></form></div>"
    document.getElementById("mainSection").innerHTML = commentForm
});
function start() {
    if (page.path == 'homepage/tags') {
        renderPosts(posts)
        renderTagfield()
    }
    if (page.path == 'homepage/newComment') {
        renderPosts(posts)
        renderTagfield()
        $(".section").trigger('click')
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
    if (page.path == 'homepage/group/joinOneGroup/JoinGroupSuccessfully') {
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
        document.getElementById("mainSection").innerHTML = "You have already been in this group"
    }
    if (page.path == 'homepage/group/changeCurrentGroup/ChangeGroupSuccessfully') {
        renderGroupConfig()
        document.getElementById("mainSection").innerHTML = "Change group successfully"
    }
};
window.onload = start;
