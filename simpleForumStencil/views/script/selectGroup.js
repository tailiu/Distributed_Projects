function getFromStencil(url, data, func) {
    $.ajax({
        url: url,
        dataType: "jsonp",
        data: data,
        jsonpCallback: "callback",
        success: func
    })
};
function renderGroups() {
	var groups = '';
    for (var i in meta.group) {
        groups += '<input type="radio" name="group" value=' + meta.group[i]._id + '>'+ meta.group[i].groupName +'<br>';
    }
    return groups;
};
function renderSelectionForm() {
	if (meta.group.length == null) {
        document.getElementById("form").innerHTML = 'You are currently in no group';
    } else {
    	var selectGroup = '<p>Please select:</p>';
        selectGroup += '<form method="get" id="selectGroupForm">';
	    selectGroup += '<input type="hidden" id="username" name="username" value='+ meta.name +'>';
	    selectGroup += '<div id="groups">';
	    selectGroup += renderGroups();
	    selectGroup += '</div>';
	    selectGroup += '<br>';
	    selectGroup += "<input type='submit' name='post' value='Submit' class='postButtons' >";
	    selectGroup += "<input type='submit' name='post' value='Cancel' class='postButtons' ></form>";
	    document.getElementById("form").innerHTML = selectGroup;
	    $(".postButtons").click(function(e1) {
            var b = $(this).attr("value").toLowerCase();
            if (b == 'submit') {
                $("#selectGroupForm").submit(function(e2) {
                    e2.preventDefault();
                    var url = "http://localhost:3000/file/getFiles";
                    var groupID = $('input[name="group"]:checked').val();
                    var data = {};
		            data.username = meta.name;   
		            data.groupID = groupID;
		            getFromStencil(url, data, function(response) {
	                    var url1 = "http://localhost:3000/renderWebPage";
	                    var data1 = {
	                        user:       JSON.stringify(meta),
	                        files: 		JSON.stringify(response.files),
	                        groupID: 		groupID,
	                        page:       'homepage.jade'
	                    };
	                    getFromStencil(url1, data1, function(response1) {
	                        document.open("text/html");
	                        document.write(response1.page);
	                        document.close();
	                    });
	                });
                });
            } else {
                e1.preventDefault();
                alert('cancel');
            }
    	});
    }
};
function start() {
    renderSelectionForm();
};
window.onload = start;