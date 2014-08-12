var express = require('express'),
    app = express(),
    server = require('http').createServer(app), //Create server object
    io = require('socket.io').listen(server), //Socket functionality which listens to the http server object
    mongoose = require('mongoose'),
    crypto = require('crypto'),
    // Keeping track of nicknames as objects, as well as being able to reference the single socket object so we can send to specific user sockets.
    // Nickname will be the key to the users object and the values will be the sockets
    users = {};

// Listen to port 3000
server.listen(3000);

//Database connect
mongoose.connect('mongodb://localhost/nodeChat', function(err){
    if(err){
        console.log("MongoDB: " + err);
    } else {
        console.log('DB connection successfull');
    }
});

// Creating a schema
var chatSchema = mongoose.Schema({
    nick: String,
    msg: String,
    created: {type: Date, default: Date.now}
});

// Create model
// Keep name singular -> it will be turned prural
// 1. parameter name of collection/model
// 2. parameter is the schema of the collection
var Chat = mongoose.model('Message', chatSchema);



// Create route with express
app.get('/', function(req, res){
    res.sendFile(__dirname + '/index.html');
});

// Receive event (server-side)
// Like document ready function
// Every user has it's own socket -> (function(socket)).
io.sockets.on('connection', function(socket){
    //Create a random id for socket
    var cryptoID = crypto.randomBytes(20).toString('hex');
    console.log(cryptoID);

    //Grabb earlier messages when logged on
    query = Chat.find({});
    query.sort('-created').limit(8).exec(function(err, docs){
        if(err){
            throw err;
        } else {
            console.log('Sending old messages');
            socket.emit('load old message', docs);
        }
    });

    //Listening for new user event
    //Callback parameter to send valid state data back to client
    //Sent back to function(data) in new user eventlistener
    socket.on('new user', function(data, callback){

        //If nickname is available
        if (data in users){
            callback(false);
        } else{
            callback(true);
            socket.nickname = data; //Saving the nickname to the socket it self -> now it is a property of the socket
            socket.userID = cryptoID;
            users[socket.nickname] = socket;
            updateNicknames(); // Sending updated array with nicknames to all sockets
        }
    });

    function updateNicknames(){

        // Creating an object with name and userID/cryptoID, instead of sending the whole socket object.
        var usersInfo = {};
        for (var key in users) {
            var tempKey = key;
            usersInfo[tempKey] = users[key].userID;
        }

        io.sockets.emit('usernames', usersInfo); // Sending object keys to the client instead of sending the whole socket object
    }

    //Listening for send message event
    socket.on('send message', function(data, callback){
        // Private message "listener".
        var msg = data.trim(); // trimming if user has put white space as first characters
        console.log('after trimming message is: ' + msg);
        if(msg.substr(0,3) === '/w '){
            msg = msg.substr(3); // We need the next letters
            var ind = msg.indexOf(' ');
            if(ind !== -1){
                var name = msg.substring(0, ind); // Looking for first white space as after that the name should be finished
                var msg = msg.substring(ind + 1);
                if(name in users){
                    //emit using the socket we are sending the message to
                    users[name].emit('whisper', {msg: msg, nick: socket.nickname});
                    // If user has entered /w then it is a private message
                    // this will later be changed to better listener
                    console.log('message sent is: ' + msg);
                    console.log('Whisper!');
                } else{
                    //Handling data from send message
                    //We are sending it to all users here
                    callback('Error!  Enter a valid user.');
                }
            } else{
                callback('Error!  Please enter a message for your whisper.');
            }
        } else{
            // Create new document
            // Have set date to default now so we do not need to mention that
            var newMsg = new Chat({msg: msg, nick: socket.nickname});
            //Callback function for error
            newMsg.save(function(err){
                if(err){
                    throw err;
                }
            });
            io.sockets.emit('new message', {msg: msg, nick: socket.nickname});
        }
    });

    //When a user disconnects
    socket.on('disconnect', function(data){
        //To disconnect them if they wisit the site, but do not enter anything we want to disconnect them from the socket.
        if(!socket.nickname) return;
        delete users[socket.nickname];
        updateNicknames(); // Send the new list to all sockets so get the new list of users
    });
});