$(document).ready(function () {
  $(".video__btn-play").on("click", function (e) {
    e.preventDefault();
    $('body').addClass('overlay-active');
    $(".video-container, .video-wrapper, .pop-up__video-close , .video-popup").css('display','flex');
    var srchref = "",
        autoplay = "",
        id = $(this).data("id");
    if ($(this).data("type") == "vimeo")
      var srchref = "//player.vimeo.com/video/";
    else if ($(this).data("type") == "youtube")
      var srchref = "https://www.youtube.com/embed/";
    if ($(this).data("autoplay") == true) autoplay = "?autoplay=1";
    $("#video-popup-iframe").attr("src", srchref + id + autoplay);
    $("#video-popup-iframe").on("load", function () {
      $(".video-wrapper").show();
    });
  });

  $(".pop-up__video-close").on("click", function (e) {
     $('body').removeClass('overlay-active');
    $(".video-container, .video-wrapper, .pop-up__video-close , .video-popup").css('display','none');
    $("#video-popup-iframe").attr("src", "");
  });
});


// $(function () {
//   $('#vidBox').VideoPopUp({ 
//    	backgroundColor: "#17212a",
//    	opener: "video1",
//     maxweight: "500",
//     idvideo: "dt_modalPopUp"
//   });
//   $("#video1").on("click", function (e) {
//       $('body').addClass('overlay-active');
//   });  
//   $("#closer_videopopup").on("click", function (e) {
//       $('body').removeClass('overlay-active');
//   });    
//  });