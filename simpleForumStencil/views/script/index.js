function getFromStencil(url, data, func) {
	$.ajax({
    	url: url,
    	dataType: "jsonp",
    	data: data,
	    jsonpCallback: "callback",
	    success: func
	})
}

$(".submitB").click(function(e1) {
    var b = $(this).attr("value").toLowerCase();
    if (b == "sign-in") {
        $("#loginForm").submit(function(event) {
            // Stop form from submitting normally
            event.preventDefault()
            var url = "http://localhost:3000/file/getFiles"
            var values = $(this).serialize();
            var username = values.split("&")[0].split("=")[1]
            var password = values.split("&")[1].split("=")[1]
            var data = {}
            data.username = username
            data.password = password    
            getFromStencil(url, data, function(response) {
                var url1 = "http://localhost:3000/user/getUserInfo"
                getFromStencil(url1, data, function(response1) {
                    console.log(response1)
                    var url2 ="http://localhost:3000/renderWebPage"
                    var data1 = {
                        files:      JSON.stringify(response.files),
                        user:       JSON.stringify(response1.user),
                        page:       'homepage.jade' 
                    }
                    getFromStencil(url2, data1, function(response2) {
                        document.open("text/html");
                        document.write(response2.page);
                        document.close();
                    })
                })
            })
        })
    } else {
        $("#loginForm").submit(function(event) {
            event.preventDefault()
            var url = "http://localhost:3000/renderWebPage"
            var data = {}
            data.page = 'register.jade'
            getFromStencil(url, data, function(response) {
                document.open("text/html");
                document.write(response.page);
                document.close();
            })
        })
    }
})