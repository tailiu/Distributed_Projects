function getFromStencil(url, data, func) {
	$.ajax({
    	url: url,
    	dataType: "jsonp",
    	data: data,
	    jsonpCallback: "callback",
	    success: func
	})
}

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
	    //console.log(response.files[1].name)
    	var url1 = "http://localhost:3000/user/getUserInfo"
    	getFromStencil(url1, data, function(response1) {
    		//console.log(response1)
    		var url2 ="http://localhost:3000/renderWebPage"
    		var data1 = {
    			files: 		JSON.stringify(response),
    			user: 		JSON.stringify(response1),
    			page:  
    		}
    		getFromStencil(u)
    	})
	})
})
