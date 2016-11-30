$(document).ready(function(){
    // hide .left-controlbar first
    $(".myButton").hide();
        // fade in #back-top
    $(function () {
        $(window).scroll(function () {
            if ($(this).scrollTop() > 250) {
                $('.myButton').fadeIn();
            } else {
                $('.myButton').fadeOut();
            }
        });
        // scroll body to 0px on click
        $('.myButton').click(function () {
            $('body,html').animate({
                scrollTop: 0
            }, 500);
            return false;
        });
    });
});
