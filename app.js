var express = require('express'),
    app = express(),
    server = require('http').createServer(app), //Create server object
    io = require('socket.io').listen(server), //Socket functionality which listens to the http server object
    mongoose = require('mongoose'),
// Keeping track of nicknames as objects, as well as being able to reference the single socket object so we can send to specific user sockets.
// Nickname will be the key to the users object and the values will be the sockets
    users = {};

// Listen to port 3000
server.listen(3000);

//Database connect
mongoose.connect('mongodb://localhost/nodeChat', function (err) {
    if (err) {
        console.log("MongoDB: " + err);
    } else {
        console.log('DB connection successfull');
    }
});

// Creating a schema
var chatSchema = mongoose.Schema({
    nick: String,
    msg: String,
    msgTo: Number,
    msgFrom: Number,
    unread: Number,
    created: {type: Date, default: Date.now}
});

var userSchema = mongoose.Schema({
    userid: Number,
    username: String,
    password: String,
    online: Number,
    newMsgCount: Number,
    created: {type: Date, default: Date.now}
});


// Create model
// Keep name singular -> it will be turned prural
// 1. parameter name of collection/model
// 2. parameter is the schema of the collection
var Chat = mongoose.model('Message', chatSchema);
var User = mongoose.model('User', userSchema);


// Create route with express
app.get('/', function (req, res) {
    res.sendFile(__dirname + '/index.html');
});

// Receive event (server-side)
// Like document ready function
// Every user has it's own socket -> (function(socket)).
io.sockets.on('connection', function (socket) {

    //Listening for new user event
    //Callback parameter to send valid state data back to client
    //Sent back to function(data) in new user eventlistener
    socket.on('new user', function (data, callback) {

        //Check if user is in database
        //This is a login without password for
        //simulating real users
        var userIsInDB = User.find({});

        userIsInDB.update({username: data}, {$set: {online: 1}}, function (err, data) {
            if (err) return console.error(err);

            updateNicknames();
        });

        userIsInDB.findOne({username: data}, function (err, user) {
            if (err) return console.error(err);

            //If user is in database
            if (user != null) {

                callback(true);
                socket.userID = user['userid']; //Saving the id to the socket it self -> now it is a property of the socket
                socket.nickname = user['username']; //Saving the nickname to the socket it self -> now it is a property of the socket

                /*socket.userID = cryptoID;*/
                users[socket.nickname] = socket;
                updateNicknames(); // Sending updated array with nicknames to all sockets
                updateUnread();

            } else {
                callback(false);
            }
        });

    });


    //Listening for send message event
    socket.on('send message', function (data, callback) {
        // Private message "listener".

        var msg = data['newMessage'].trim(); // trimming if user has put white space as first characters

        if (msg.substr(0, 3) === '/w ') {
            msg = msg.substr(3); // We need the next letters
            var ind = msg.indexOf(' ');
            if (ind !== -1) {
                var name = msg.substring(0, ind); // Looking for first white space as after that the name should be finished
                var msg = msg.substring(ind + 1);
                if (name in users) {
                    //emit using the socket we are sending the message to
                    users[name].emit('whisper', {msg: msg, nick: socket.nickname});
                    // If user has entered /w then it is a private message
                    // this will later be changed to better listener
                    console.log('message sent is: ' + msg);
                    console.log('Whisper!');
                } else {
                    //Handling data from send message
                    //We are sending it to all users here
                    callback('Error!  Enter a valid user.');
                }
            } else {
                callback('Error!  Please enter a message for your whisper.');
            }
        } else {


            // Create new document
            // Have set date to default now so we do not need to mention that
            var newMsg = new Chat({msg: msg, nick: socket.nickname, msgFrom: socket.userID, msgTo: data['toUser'], unread: 1});
            //Callback function for error
            newMsg.save(function (err) {
                if (err) {
                    throw err;
                }
            });
            io.sockets.emit('new message', {msg: msg, nick: socket.nickname});

        }
    });

    // Listening for selected user to message/chat with
    socket.on('choose chatter', function (data) {

        var conversation = Chat.find({});

        // Find specific conversation between user id's
        //query.sort('-created').limit(8).exec(function(err, docs){
        conversation.find({ $or: [
            {'$and': [
                { msgTo: data },
                { msgFrom: socket.userID }
            ]},
            {'$and': [
                { msgTo: socket.userID },
                { msgFrom: data }
            ]}
        ]}).sort('-created').limit(8).exec(function (err, conv) {

                if (err) return console.error(err);
                socket.emit('load old message', conv);

            });
    });

    // Listen for if new message is received
    socket.on('sent msg', function (data) {
        console.log("Sent msg");
        console.dir(data);
    });

    // On update read
    socket.on('update unread', function (data) {

        // To disconnect them if they wisit the site, but do not enter anything we want to disconnect them from the socket.
        if (!socket.nickname) return;
        delete users[socket.nickname];

        var userInChat = User.find({});


        userInChat.update({username: socket.nickname}, {$set: {online: 0}}, function (err, data) {
            if (err) return console.error(err);

            updateNicknames();
        });

    });


    socket.on('updateUnread', function (data, callback) {

        console.log(data);

        if (data != '') {
            var unReadMsg = Chat.aggregate([
                { $match: { msgTo: socket.userID } },
                { $group: { _id: "$msgFrom", messages: { $sum: "$unread" } }}
            ], function (err, result) {
                if (err) return console.error(err);

                //users[socket.nickname].emit('unreadMsg', {messages: result});
                callback(result);
            });
        }

    });


    // When a user disconnects
    socket.on('disconnect', function (data) {

        // To disconnect them if they wisit the site, but do not enter anything we want to disconnect them from the socket.
        if (!socket.nickname) return;
        delete users[socket.nickname];

        var userInChat = User.find({});


        userInChat.update({username: socket.nickname}, {$set: {online: 0}}, function (err, data) {
            if (err) return console.error(err);

            updateNicknames();
        });

    });

    /*
     // Socket Functions
     */
    function updateNicknames() {

        //Grabb users to display
        var userQuery = User.find({});

        userQuery.find({}, function (err, users) {
            if (err) return console.error(err);
            io.sockets.emit('usernames', users); // Sending object keys to the client instead of sending the whole socket object
        });
    }

    function updateUnread() {

        // Update unread message
        // We search DB for unread msg
        var unReadMsg = Chat.aggregate([
            { $match: { msgTo: socket.userID } },
            { $group: { _id: "$msgFrom", messages: { $sum: "$unread" } }}
        ], function (err, result) {
            if (err) return console.error(err);

            users[socket.nickname].emit('unreadMsg', {messages: result});

        });

    }
});