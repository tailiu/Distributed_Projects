function renderGroups() {
	var groups = ''
    for (var i in meta.group) {
        groups += '<input type="radio" name="groupID" value=' + meta.group[i]._id + '>'+ meta.group[i].groupName +'<br>'
    }
    return groups
}
function renderSelectionForm() {
	if (meta.group.length == null) {
        document.getElementById("form").innerHTML = 'You are currently in no group'
    } else {
        var selectGroup = '<p>Please select:</p>'
        selectGroup += '<form method="post" id="selectGroupForm" action="http://localhost:3000/selectGroup">'
        selectGroup += '<input type="hidden" id="username" name="username" value='+ meta.name +'>'
        selectGroup += '<div id="groups">'
        selectGroup += renderGroups()
        selectGroup += '</div>'
        selectGroup += '<br>'
        selectGroup += "<input type='submit' name='post' value='Submit' class='postButtons' >"
        document.getElementById("form").innerHTML = selectGroup
    }
}
function start() {
    renderSelectionForm()
}
window.onload = start