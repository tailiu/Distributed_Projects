        var posts = !{posts}
        function eachPost (post) {
            console.log("jhhhh")
            return "<div class='section'>" + "<p>" + post + "</p>" + "</div>"
        }
        function renderPosts(posts) {
            if (posts == null) {
                return "There is no post yet"
            } else {
                for (var i in posts) {
                    document.getElementById("mainSection").innerHTML += eachPost(posts[i].content)
                }
            }
        }
        function newPost() {
            var form
            form = '<form action="http://localhost:3000/homepage/newPost" method="post" id="newPost">'
            form += 'Title: <input type="text" name="title"><br>'
            form += '<input type="hidden" name="user" value='+ JSON.stringify(!{meta}) +'>'
            form += 'Category:<br>'
            form += '<input type="checkbox" name="category" value="life"> Life <br>'
            form += '<input type="checkbox" name="category" value="study"> Study <br>'
            form += '<input type="checkbox" name="category" value="work"> Work <br>'
            form += '<textarea rows="6" cols="50" name="content" form="newPost"> </textarea>'
            form += '<button type="submit"> Submit </button> </form><br>'
            document.getElementById("mainSection").innerHTML = form
        }
        function logout() {
            if (confirm("Are you sure to leave?") == true) {
                
            }
        }
        renderPosts(posts)