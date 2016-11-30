$("#addNewSchoolForm :checkbox").click(function(event) {
    if ($(this).is(":checked"))
    	$("#emailDomain").hide()
    else
    	$("#emailDomain").show()
})