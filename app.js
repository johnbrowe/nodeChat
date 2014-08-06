var express = require('express'),
    app = express(),
    server = require('http').createServer(app), //Create server object
    io = require('socket.io').listen(server), //Socket functionality which listens to the http server object
    nicknames = [];

//Listen to port 3000
server.listen(3000);

// Create route with express
app.get('/', function(req, res){
    res.sendFile(__dirname + '/index.html');
});


// Receive event (server-side)
// Like document ready function
io.sockets.on('connection', function(socket){
    socket.on('send message', function(data){

        //Handling data from send message
        //We are sending it to all users here
        io.sockets.emit('new message', data);

    });
});
