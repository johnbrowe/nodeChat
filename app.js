var express = require('express'),
    app = express(),
    server = require('http').createServer(app), //Create server object
    io = require('socket.io').listen(server), //Socket functionality which listens to the http server object
    nicknames = []; // Keeping track of nicknames

//Listen to port 3000
server.listen(3000);

// Create route with express
app.get('/', function(req, res){
    res.sendFile(__dirname + '/index.html');
});


// Receive event (server-side)
// Like document ready function
io.sockets.on('connection', function(socket){

    //Listening for new user event
    //Callback parameter to send valid state data back to client
    //Sent back to function(data) in new user eventlistener
    socket.on('new user', function(data, callback){

        //If nickname is not
        if(nicknames.indexOf(data) != -1){
            callback(false);
        } else {
            callback(true);
            socket.nickname = data; //Saving the nickname to the socket it self -> now it is a property of the socket
            nicknames.push(socket.nickname); //Inserting nickname to array
            io.sockets.emit('usernames', nicknames); // Sending array with nicknames to all sockets

        }
    });

    //Listening for send message event
    socket.on('send message', function(data){
        //Handling data from send message
        //We are sending it to all users here
        io.sockets.emit('new message', data);
    });
});
