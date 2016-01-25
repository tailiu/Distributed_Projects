function getFromStencil(url, data, func) {
	$.ajax({
    	url: url,
    	dataType: "jsonp",
    	data: data,
	    jsonpCallback: "callback",
	    success: func
	});
};

$(".submitB").click(function(e1) {
    var b = $(this).attr("value").toLowerCase();
    if (b == "submit") {
        $("#signupForm").submit(function(event) {
            event.preventDefault();
            var url = "http://localhost:3000/user/createUser";
            var data = {};
            data.username = $("#username").val();
            data.email = $("#email").val();
            data.password = $("#password").val();
            getFromStencil(url, data, function(response) {
                var url1 ="http://localhost:3000/renderWebPage";
                var data1 = {
                    user:       JSON.stringify(response.user),
                    page:       'registerSuccessfully' 
                };
                getFromStencil(url1, data1, function(response2) {
                    document.open("text/html");
                    document.write(response2.page);
                    document.close();
                })
            })
        });
    }
});