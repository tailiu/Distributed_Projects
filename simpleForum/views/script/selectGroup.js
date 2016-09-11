function renderGroups() {
	var groups = ''
    for (var i in groupNames) {
        groups += '<input type="radio" name="groupName" value="'+ groupNames[i] +'">'+ groupNames[i] + '<br>'
    }
    return groups
}
function renderSelectionForm() {
    var selectGroup = '<p>Please select:</p>'
    selectGroup += '<form method="post" action="http://localhost:3000/selectGroup">'
    selectGroup += '<input type="hidden" name="username" value='+ username +'>'
    selectGroup += '<div>'
    selectGroup += renderGroups()
    selectGroup += '</div>'
    selectGroup += '<br>'
    selectGroup += "<input type='submit' name='post' value='Select' class='postButtons' >"
    document.getElementById("form").innerHTML = selectGroup
}
function start() {
    renderSelectionForm()
}
window.onload = start