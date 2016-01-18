function eachPost (post, index) {
    index++
    var section = "<div class='section'><h3>" + index + ": " + post.title + "</h3><p>" + post.content + "</p>" + "</div>" 
    return section
}
//render all the posts
function renderPosts(posts) {
    if (posts == null) {
        return "There is no post yet"
    } else {
        for (var i in posts) {
            document.getElementById("mainSection").innerHTML += eachPost(posts[i], i)
        }
    }
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
//send new post
function newPost() {
    var form
    form = '<form action="http://localhost:3000/homepage/newPost" method="post" id="newPost">'
    form += 'Title: <input type="text" name="title"><br>'
    form += '<input type="hidden" name="user" value='+ JSON.stringify(meta) +'>'
    form += 'Category:<br>'
    form += '<input type="checkbox" name="category" value="life"> Life <br>'
    form += '<input type="checkbox" name="category" value="study"> Study <br>'
    form += '<input type="checkbox" name="category" value="work"> Work <br>'
    form += '<textarea rows="6" cols="50" name="content" form="newPost"> </textarea>'
    form += '<button type="submit"> Submit </button> </form><br>'
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
    var arr = []
    arr[0] = meta
    var commentForm = "<div class='commentPostSection'><h3>" + post.title + "</h3><p>" +post.content + "</p>" + "</div> <br>" 
    commentForm += renderComments(post) + "<br>"
    commentForm += "<form action='http://localhost:3000/homepage/newComment' method='post' id='newComment'>"
    commentForm += "<input type='hidden' name='user' value=" + JSON.stringify(meta) + ">"
    commentForm += "<input type='hidden' name='postID' value=" + post._id + ">"
    commentForm += "<input type='hidden' id='reply' name='replyTo' value=''>"
    commentForm += "<textarea rows='6' cols='50' id='commentArea' name='comment' form='newComment'> </textarea><br>"
    commentForm += "<button type='submit'> Submit </button> </form>" 
    commentForm += "<form action='http://localhost:3000/homepage/all' method='get' >"
    commentForm += "<input type='hidden' name='user' value=" + JSON.stringify(arr) + ">"
    commentForm += "<button type='submit'> Cancel </button></form>"
    document.getElementById("mainSection").innerHTML = commentForm
})
//fire when reply button in the comment section is pressed
$(document).on('click', '.commentReplyButton', function() {
    var name = $(this).parent().text().split(" ")[0]
    document.getElementById('commentArea').value = ''
    document.getElementById('commentArea').placeholder = 'Reply to ' + name + ':'
    document.getElementById('reply').value = name
    console.log(document.getElementById('reply').value)
})
window.onload = renderPosts(posts)