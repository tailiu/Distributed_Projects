// This function will be executed when the user scrolls the page.
$(window).scroll(function(e) {
    // Get the position of the location where the scroller starts.
    var nav_anchor = $("#navArchor").offset().top;
     
    // Check if the user has scrolled and the current position is after the scroller start location and if its not already fixed at the top 
    if ($(this).scrollTop() >= nav_anchor && $('#nav').css('position') != 'fixed') 
    {    // Change the CSS of the scroller to hilight it and fix it at the top of the screen.
        $('#nav').css({
            'position': 'fixed',
            'top': '0px'
        });
        // Changing the height of the scroller anchor to that of scroller so that there is no change in the overall height of the page.
        $('#navArchor').css('height', '10%');
    } 
    else if ($(this).scrollTop() < nav_anchor && $('#nav').css('position') != 'relative') 
    {    // If the user has scrolled back to the location above the scroller anchor place it back into the content.
         
        // Change the height of the scroller anchor to 0 and now we will be adding the scroller back to the content.
        $('#navArchor').css('height', '0px');
         
        // Change the CSS and put it back to its original position.
        $('#nav').css({
            'position': 'relative',
            'top': '2px',
        });
    }
});