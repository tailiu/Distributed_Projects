function start() {
	var joinTeamForm = ''
	joinTeamForm += '<form method="get" action="http://localhost:3000/acceptInvitationToTeam">'
	joinTeamForm += '<input type="hidden" name="invitationID" value="' + invitationID + '">'
	joinTeamForm += '<input type="hidden" name="team" value="' + flatTeamName + '">'
	joinTeamForm += '<input type="hidden" name="inviteeEmail" value="' + inviteeEmail + '">'
	joinTeamForm += '<input type="hidden" name="encodedPublicKey" value="' + encodedPublicKey + '">'
	joinTeamForm += '<input type="hidden" name="dataCompleted" value="true">'
	joinTeamForm += '<p><input type="text" name="username" value="" placeholder="username"></p>'
	joinTeamForm += '<p><input type="submit" name="submitButton" value="Join Team" ></p>'
	joinTeamForm += '</form>'
	document.getElementById("mainSection").innerHTML = joinTeamForm
}

window.onload = start