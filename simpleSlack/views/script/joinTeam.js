function start() {
	var joinTeamForm = ''
	joinTeamForm += '<form method="get" action="http://localhost:3000/acceptInvitation">'
	joinTeamForm += '<input type="hidden" name="invitationID" value="' + invitationID + '">'
	joinTeamForm += '<input type="hidden" name="team" value="' + flatTeamName + '">'
	joinTeamForm += '<input type="hidden" name="inviterHashedPublicKey" value="' + inviterHashedPublicKey + '">'
	joinTeamForm += '<input type="hidden" name="inviteeEmail" value="' + inviteeEmail + '">'
	joinTeamForm += '<input type="hidden" name="encodedGroupPublicKey" value="' + encodedGroupPublicKey + '">'
	joinTeamForm += '<input type="hidden" name="dataCompleted" value="true">'
	joinTeamForm += '<p><input type="text" name="username" value="" placeholder="username"></p>'
	joinTeamForm += '<p><input type="submit" name="submitButton" value="Join Team" ></p>'
	joinTeamForm += '</form>'
	document.getElementById("mainSection").innerHTML = joinTeamForm
}

window.onload = start