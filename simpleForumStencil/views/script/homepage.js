function getFromStencil(url, data, func) {
    $.ajax({
        url: url,
        dataType: "jsonp",
        data: data,
        jsonpCallback: "callback",
        success: func
    })
};
function eachPost (post, index) {
    index++;
    var section = "<div class='section'><h3>" + index + ": " + post.name + "</h3><p>" + post.content + "</p>" + "</div>";
    return section;
};
function renderPosts(posts) {
    if (posts == null) {
        return "There is no post yet";
    } else {
        document.getElementById("mainSection").innerHTML = '';
        for (var i in posts) {
            document.getElementById("mainSection").innerHTML += eachPost(posts[i], i);
        }
    }
};
function renderCategoryfield() {
    var categories = '';
    categories += '<form method="get" id="categoryForm">';
    categories += '<input type="hidden" name="username" value=' + meta.name + '>';
    categories += '<input type="submit" name="category" value="All" class="catlinks" ><br>';
    categories += '<input type="submit" name="category" value="Life" class="catlinks" ><br>';
    categories += '<input type="submit" name="category" value="Study" class="catlinks" ><br>';
    categories += '<input type="submit" name="category" value="Work" class="catlinks" ></form>';
    document.getElementById("nav").innerHTML = categories;
    $(".catlinks").click(function(e1) {
        var category = $(this).attr("value").toLowerCase();
        $("#categoryForm").submit(function(e2) {
            e2.preventDefault();
            var url = "http://localhost:3000/file/getFiles";
            var data = {};
            var values = $(this).serialize();
            data.username = values.split("=")[1];
            data.category = category;
            getFromStencil(url, data, function(response) {
                var url1 = "http://localhost:3000/renderWebPage";
                var data1 = {
                    files:      JSON.stringify(response.files),
                    user:       JSON.stringify(meta),
                    page:       'homepage.jade' 
                };
                getFromStencil(url1, data1, function(response1) {
                    document.open("text/html");
                    document.write(response1.page);
                    document.close();
                });
            });
        });
    });
};
function renderComments(post) {
    var comments = post.appSpecFileMeta.slice(1, post.appSpecFileMeta.length);
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
function renderGroups() {
    var groups = 'Groups:<br>';
    for (var i in meta.group) {
        groups += '<input type="checkbox" name="groupIDs" value=' + meta.group[i]._id + '>'+ meta.group[i].groupName +'<br>';
    }
    return groups;
}
function newPost() {
    var newPostForm = '<form method="get" id="newPost">';
    newPostForm += 'Title: <input type="text" id="title" name="title"><br>';
    newPostForm += '<input type="hidden" id="username" name="username" value='+ meta.name +'>';
    newPostForm += 'Category:<br>';
    newPostForm += '<div id="cb">';
    newPostForm += '<input type="checkbox" name="category" value="life"> Life <br>';
    newPostForm += '<input type="checkbox" name="category" value="study"> Study <br>';
    newPostForm += '<input type="checkbox" name="category" value="work"> Work <br></div>';
    newPostForm += '<div id="groups">';
    newPostForm += renderGroups();
    newPostForm += '</div>';
    newPostForm += '<textarea rows="6" cols="50" id="content" name="content" form="newPost"> </textarea><br>';
    newPostForm += "<input type='submit' name='post' value='Submit' class='postButtons' >";
    newPostForm += "<input type='submit' name='post' value='Cancel' class='postButtons' ></form>";
    document.getElementById("mainSection").innerHTML = newPostForm;
        $(".postButtons").click(function(e1) {
            var b = $(this).attr("value").toLowerCase();
            if (b == 'submit') {
                $("#newPost").submit(function(e2) {
                    e2.preventDefault();
                    var url = "http://localhost:3000/file/createFiles";
                    var data = {};
                    var cbVals = [];
                    var groups = [];
                    data.title = $("#title").val();
                    data.username = $("#username").val();            
                    $('#cb :checked').each(function() {
                        cbVals.push($(this).val());
                    });
                    $('#groups :checked').each(function() {
                        groups.push($(this).val());
                    });
                    data.groups = groups;
                    data.category = cbVals;
                    data.content = $("#content").val();
                    getFromStencil(url, data, function(response) {
                        if (response.result == "successful") {
                            var url = "http://localhost:3000/file/getFiles";
                            var data = {};
                            data.username = meta.name;
                            getFromStencil(url, data, function(response1) {
                                var url1 = "http://localhost:3000/renderWebPage";
                                var data1 = {
                                    files:      JSON.stringify(response1.files),
                                    user:       JSON.stringify(meta),
                                    page:       'homepage.jade' 
                                };
                                getFromStencil(url1, data1, function(response2) {
                                    document.open("text/html");
                                    document.write(response2.page);
                                    document.close();
                                });
                            });
                        }
                    });
                });
            } else {
                e1.preventDefault();
                alert('cancel');
            }
    });
}
function logout() {
    if (confirm("Are you sure to leave?") == true) {
        var logoutForm = "<div id='logout'><br>";
        logoutForm += "<form method='get'>";
        logoutForm += "<input type='hidden' id='username' name='username' value="+ meta.name +">";
        logoutForm += "<input type='submit' name='button' value='Submit' id='logoutButton' ></form><div>";
        document.getElementById("mainSection").innerHTML = logoutForm;
        $("#logoutButton").click(function(e1) {
            $("#logout").submit(function(e2) {
                e2.preventDefault();
                var url = "http://localhost:3000/renderWebPage";
                var data = {};
                data.username = $("#username").val();  
                data.page = 'logout';
                getFromStencil(url, data, function(response) {
                    document.open("text/html");
                    document.write(response.page);
                    document.close();
                })
            })
        });
        $("#logoutButton").trigger('click');
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
function alreadyInGroup(group) {
    var alreadyInGroup = '';
    alreadyInGroup = '<h3>Join a Group</h3><br>';
    alreadyInGroup += '<p>You have already been in '+ group.name + '</p>';
    document.getElementById("mainSection").innerHTML = alreadyInGroup;
}
function NotInGroup(group) {
    var NotInGroup = '';
    NotInGroup = '<h3>Leave a Group</h3><br>';
    NotInGroup += '<p>You are not in '+ group.name + '</p>';
    document.getElementById("mainSection").innerHTML = NotInGroup;
}
function whetherInGroup(group) {
    for (var i=0; i<meta.group.length; i++) {
        if (meta.group[i].groupName == group.name) {
            return true;
        }
    }
    return false;
}
function groupAlreadyExists(group) {
    var groupAlreadyExists = '';
    groupAlreadyExists = '<h3>Create a Group</h3><br>';
    groupAlreadyExists += '<p>'+ group.name + ' already exists</p>';
    document.getElementById("mainSection").innerHTML = groupAlreadyExists;
}
function createGroupSuccessful(groupName) {
    var createGroupSuccessful = '';
    createGroupSuccessful += '<h3>Create a Group</h3><br>';
    createGroupSuccessful += '<p>Create '+ groupName + ' successfully</p>';
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
function joinGroupSuccessfully(groupName) {
    var joinGroupSuccessfully = '';
    joinGroupSuccessfully += '<h3>Join a Group</h3><br>';
    joinGroupSuccessfully += '<p>Join '+ groupName + ' successfully</p>';
    document.getElementById("mainSection").innerHTML = joinGroupSuccessfully;
}
function leaveGroupSuccessfully(groupName) {
    var leaveGroupSuccessfully = '';
    leaveGroupSuccessfully += '<h3>Leave a Group</h3><br>';
    leaveGroupSuccessfully += '<p>Leave '+ groupName + ' successfully</p>';
    document.getElementById("mainSection").innerHTML = leaveGroupSuccessfully;
}
function renderGroupConfig() {
    var groupConfig = '';
    groupConfig += '<p id="getGroupsInfo">My Groups</p>';
    groupConfig += '<p id="joinOneGroup" >Join a Group</p>'; 
    groupConfig += '<p id="createOneGroup" >Create a Group</p>'; 
    groupConfig += '<p id="leaveOneGroup" >Leave a Group</p>';
    document.getElementById("nav").innerHTML = groupConfig;
};
$(document).on('click', '#leaveOneGroup', function() {
    var preLeaveGroupForm = "<div id='preLeaveGroupSection'><h3>Leave a Group</h3><br>";
    preLeaveGroupForm += "<form method='get' id='leaveGroup'>";
    preLeaveGroupForm += "<input type='hidden' id='username' name='username' value=" + meta.name + ">";
    preLeaveGroupForm += "Group name:<br>";
    preLeaveGroupForm += "<input type='text' id='groupName' name='groupName'><br><br>";
    preLeaveGroupForm += "<input type='submit' name='comment' value='Submit' class='searchGroup' >";
    preLeaveGroupForm += "<input type='submit' name='comment' value='Cancel' class='searchGroup' ></form></div>";
    document.getElementById("mainSection").innerHTML = preLeaveGroupForm;
    $(".searchGroup").click(function(e1) {
        var b = $(this).attr("value").toLowerCase();
        if (b == 'submit') {
            $("#preLeaveGroupSection").submit(function(e2) {
                e2.preventDefault();
                var url = "http://localhost:3000/group/getGroupInfoByGroupName";
                var data = {};
                data.groupName = $("#groupName").val();
                getFromStencil(url, data, function(response) {
                    if (response.group == null) {
                        NoSuchGroup('leave');
                    } else {
                        if (!whetherInGroup(response.group)) {
                            NotInGroup(response.group);
                        } else {
                            var url1 = "http://localhost:3000/group/leaveOneGroup";
                            var data1 = {};
                            data1.groupName = response.group.name;
                            data1.username = $("#username").val();
                            console.log(data1, url1);
                            getFromStencil(url1, data1, function(response1) {
                                if (response1.result == 'successful') {
                                    var url2 = "http://localhost:3000/user/updateUserInfo";
                                    var data2 = {};
                                    data2.groupName = response.group.name;
                                    data2.username = $("#username").val();
                                    data2.option = 'deleteOneGroup';
                                    getFromStencil(url2, data2, function(response2) {
                                        if (response2.result == 'successful') {
                                            meta = response2.updatedUser;
                                            leaveGroupSuccessfully(data2.groupName);
                                        } else {
                                            alert("Partly Successful");
                                        }
                                    })
                                } else {
                                    alert('Leave Group failed');
                                }
                            })
                        }
                    }
                })
            })
        }
    })
});
$(document).on('click', '#getGroupsInfo', function() {
    var getGroupInfo = "<div id='getGroupInfoForm'><br>";
    getGroupInfo += "<form method='get' id='groupInfo'>";
    getGroupInfo += "<input type='hidden' id='username' name='username' value=" + meta.name + ">";
    getGroupInfo += "<input type='submit' id='getG' name='getG' value='Submit' ></form></div>";
    document.getElementById("mainSection").innerHTML = getGroupInfo;
    $("#getG").click(function(e1) {
        $("#getGroupInfoForm").submit(function(e2) {
            e2.preventDefault();
            var url = "http://localhost:3000/group/getGroupInfoAssociatedWithOneUser";
            var data = {};
            data.username = $("#username").val();
            getFromStencil(url, data, function(response) {
                renderMyGroups(response.groups);
            })
        })
    });
    $("#getG").trigger('click');
});
$(document).on('click', '#createOneGroup', function() {
    var createGroupForm = "<div id='createGroupSection'><h3>Create a Group</h3><br>";
    createGroupForm += "<form method='get' id='newGroup'>";
    createGroupForm += "<input type='hidden' id='username' name='username' value=" + meta.name + ">";
    createGroupForm += "Group name:<br>";
    createGroupForm += "<input type='text' id='groupName' name='groupName'><br><br>";
    createGroupForm += 'Group Type:<br>';
    createGroupForm += '<div id="cb">';
    createGroupForm += '<input type="checkbox" name="type" value="public"> Public <br>';
    createGroupForm += '<input type="checkbox" name="type" value="private"> Private <br>';
    createGroupForm += '<input type="checkbox" name="type" value="protected"> Protected <br><br></div>';
    createGroupForm += 'Description:<br>';
    createGroupForm += "<textarea rows='6' cols='50' id='description' name='description' form='newGroup'> </textarea><br>";
    createGroupForm += "<input type='submit' name='comment' value='Submit' class='createOneGroup' >";
    createGroupForm += "<input type='submit' name='comment' value='Cancel' class='createOneGroup' ></form></div>";
    document.getElementById("mainSection").innerHTML = createGroupForm;
    $(".createOneGroup").click(function(e1) {
        var b = $(this).attr("value").toLowerCase();
        if (b == 'submit') {
            $("#createGroupSection").submit(function(e2) {
                e2.preventDefault();
                var url = "http://localhost:3000/group/getGroupInfoByGroupName";
                var data = {};
                data.groupName = $("#groupName").val();
                getFromStencil(url, data, function(response) {
                    if (response.group != null) {
                        groupAlreadyExists(response.group);
                    } else {
                        var url1 = "http://localhost:3000/group/createOneGroup";
                        var data1 = {};
                        var cbVals = [];
                        $('#cb :checked').each(function() {
                            cbVals.push($(this).val());
                        });
                        data1.type = cbVals;
                        data1.username = $("#username").val();
                        data1.groupName = $("#groupName").val();
                        data1.description = $("#description").val();
                        getFromStencil(url1, data1, function(response1) {
                            /* Note: this is not atomic */
                            console.log(response1.result);
                            if (response1.result == "successful" ) {
                                var url2 = "http://localhost:3000/user/updateUserInfo";
                                var data2 = {};
                                data2.username = $("#username").val();
                                data2.groupName = $("#groupName").val();
                                data2.option = "addOneGroup";
                                getFromStencil(url2, data2, function(response2) {
                                    if (response2.result == 'successful') {
                                        meta = response2.updatedUser;
                                        createGroupSuccessful(data2.groupName);
                                    } else {
                                        alert("Partly Successful");
                                    }
                                })
                            } else {
                                alert('Create Group failed');
                            }
                        })
                    }
                })
            })
        }
    })
});
$(document).on('click', '#joinOneGroup', function() {
    var preJoinGroupForm = "<div id='preJoinGroupSection'><h3>Join a Group</h3><br>";
    preJoinGroupForm += "<form method='get' id='newGroup'>";
    preJoinGroupForm += "<input type='hidden' id='username' name='username' value=" + meta.name + ">";
    preJoinGroupForm += "Group name:<br>";
    preJoinGroupForm += "<input type='text' id='groupName' name='groupName'><br><br>";
    preJoinGroupForm += "<input type='submit' name='comment' value='Submit' class='searchGroup' >";
    preJoinGroupForm += "<input type='submit' name='comment' value='Cancel' class='searchGroup' ></form></div>";
    document.getElementById("mainSection").innerHTML = preJoinGroupForm;
    $(".searchGroup").click(function(e1) {
        var b = $(this).attr("value").toLowerCase();
        if (b == 'submit') {
            $("#preJoinGroupSection").submit(function(e2) {
                e2.preventDefault();
                var url = "http://localhost:3000/group/getGroupInfoByGroupName";
                var data = {};
                data.groupName = $("#groupName").val();
                getFromStencil(url, data, function(response) {
                    if (response.group == null) {
                        NoSuchGroup('join');
                    } else {
                        if (whetherInGroup(response.group)) {
                            alreadyInGroup(response.group);
                        } else {
                            var url1 = "http://localhost:3000/group/joinOneGroup";
                            var data1 = {};
                            data1.groupName = response.group.name;
                            data1.username = $("#username").val();
                            getFromStencil(url1, data1, function(response1) {
                                if (response1.result == "successful") {
                                    var url2 = "http://localhost:3000/user/updateUserInfo";
                                    var data2 = {};
                                    data2.groupName = response.group.name;
                                    data2.username = $("#username").val();
                                    data2.option = "addOneGroup";
                                    getFromStencil(url2, data2, function(response2) {
                                        if (response2.result == 'successful') {
                                            meta = response2.updatedUser;
                                            joinGroupSuccessfully(data2.groupName);
                                        } else {
                                            alert("Partly Successful");
                                        }
                                    })
                                } else {
                                    alert('Create Group failed');
                                }
                            })
                        }
                    }
                })
            })
        }
    })
});
$(document).on('click', '.commentReplyButton', function() {
    var name = $(this).parent().text().split(" ")[0];
    document.getElementById('commentArea').value = '';
    document.getElementById('commentArea').placeholder = 'Reply to ' + name + ':';
    document.getElementById('reply').value = name;
});
$(document).on('click', '.section', function() {
    var index = parseInt($(this).text().split(":")[0], 10);
    index--;
    var post = posts[index];
    var commentForm = "<div class='commentPostSection'><h3>" + post.name + "</h3><p>" + post.content + "</p>" + "</div> <br>";
    commentForm += renderComments(post) + "<br>";
    commentForm += "<form method='get' id='newCommentForm'>";
    commentForm += "<input type='hidden' id='username' name='username' value=" + meta.name + ">";
    commentForm += "<input type='hidden' id='postID' name='postID' value=" + post._id + ">";
    commentForm += "<input type='hidden' id='replyTo' name='replyTo' value=''>";
    commentForm += "<textarea rows='6' cols='50' id='commentArea' name='comment' form='newCommentForm'> </textarea><br>";
    commentForm += "<input type='submit' name='comment' value='Submit' class='commentButtons' >";
    commentForm += "<input type='submit' name='comment' value='Cancel' class='commentButtons' ></form></div>";
    document.getElementById("mainSection").innerHTML = commentForm;
    $(".commentButtons").click(function(e1) {
        var b = $(this).attr("value").toLowerCase();
        if (b == 'submit') {
            $("#newCommentForm").submit(function(e2) {
                e2.preventDefault();
                var url = "http://localhost:3000/file/updateFiles";
                var data = {};
                data.replyTo = $("#replyTo").val();
                data.username = $("#username").val();
                data.comment = $("#commentArea").val();
                data.postID = $("#postID").val();
                getFromStencil(url, data, function(response) {
                    var url1 = "http://localhost:3000/renderWebPage";
                    var arr = [];
                    arr.push(response.updatedFile);
                    var data1 = {
                        files:      JSON.stringify(arr),
                        user:       JSON.stringify(meta),
                        page:       'homepage.jade/newComment'
                    };
                    getFromStencil(url1, data1, function(response2) {
                        document.open("text/html");
                        document.write(response2.page);
                        document.close();
                    });
                });
            });
        } else {
            e1.preventDefault();
            alert('cancel');
        }
    });
});
function start() {
    if (page.path == 'homepage.jade') {
        renderPosts(posts);
        renderCategoryfield();
    }
    if (page.path == 'homepage.jade/newComment') {
        renderPosts(posts);
        renderCategoryfield();
        $(".section").trigger('click');
    }
};
window.onload = start;
