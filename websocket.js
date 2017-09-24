$(function(){
    var ws = new WebSocket('ws://localhost:8888/');
    var term = {};
    term.write = function (str) {
        ws.send(str);
    };
    var transmitter = new Transmitter(term);

    $(document).keydown(function (e) {
        if (transmitter.typeIn(e))
            e.preventDefault();
        console.log(e);
    });

    ws.onmessage = function(event){
        var message_li = $('<span>').text(event.data);
        $("#msg-area").append(message_li);
    };
});
