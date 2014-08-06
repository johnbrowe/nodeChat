var express = require('express'),
    app = express(),
    server = require('http').createServer(app), //Create server object
    io = require('socket.io').listen(server), //Socket functionality which listens to the http server object
    // Keeping track of nicknames as objects, as well as being able to reference the single socket object so we can send to specific user sockets.
    // Nickname will be the key to the users object and the values will be the sockets
    users = {};


// Listen to port 3000
server.listen(3000);

// Create route with express
app.get('/', function(req, res){
    res.sendFile(__dirname + '/index.html');
});


// Receive event (server-side)
// Like document ready function
// Every user has it's own socket -> (function(socket)).
io.sockets.on('connection', function(socket){

    //Listening for new user event
    //Callback parameter to send valid state data back to client
    //Sent back to function(data) in new user eventlistener
    socket.on('new user', function(data, callback){

        //If nickname is available
        if(data in users){
            callback(false);
        } else {
            callback(true);
            socket.nickname = data; //Saving the nickname to the socket it self -> now it is a property of the socket
            users[socket.nickname] = socket;
            updateNicknames(); // Sending updated array with nicknames to all sockets

            console.dir(users);
        }
    });

    function updateNicknames(){
        io.sockets.emit('usernames', Object.keys(users)); // Sending object keys to the client instead of sending the whole socket object
    }

    //Listening for send message event
    socket.on('send message', function(data, callback){
        // Private message "listener".
        var msg = data.trim(); // trimming if user has put white space as first characters
        if(msg.substr(0,3) === '/w '){
            msg = msg.substr(3); // We need the next letters
            var ind = msg.indexOf(' ');
            if(ind !== -1){
                var name = msg.substring(0, ind); // Looking for first white space as after that the name should be finished
                var msg = msg.substring(ind + 1);

                if(name in users){
                    //emit using the socket we are sending the message to
                    users[name].emit('whisper', {msg: msg, nick: socket.nickname})
                    // If user has entered /w then it is a private message
                    // this will later be changed to better listener
                    console.log("Whisper to: " );
                } else {
                    callback('Enter a valid user')
                }

            } else {
                callback('Error! Please enter a message for you whisper')
            }

        } else {
            //Handling data from send message
            //We are sending it to all users here
            io.sockets.emit('new message', {msg: msg, nick: socket.nickname});
        }

    });


    //When a user disconnects
    socket.on('disconnect', function(data){
        //To disconnect them if they wisit the site, but do not enter anything we want to disconnect them from the socket.
        console.log(socket.nickname + ": User disconnected");
        if(!socket.nickname) return;
        delete users[socket.nickname];
        console.log("On disconnect: " + users);
        updateNicknames(); // Send the new list to all sockets so get the new list of users
    });
});
