function start() {
	document.getElementById("loginOrSignUpForm").elements["schoolName"].value = schoolName

	document.getElementById("schoolName").innerHTML = schoolName
	document.getElementById("titleMsg").innerHTML = 'Before creating a new class in ' + schoolName + ', please let us know more about you!'	
}

window.onload = start

