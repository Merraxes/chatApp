var uuid = require('node-uuid');
var express = require('express');
var http = require('http');
var sockjs = require('sockjs');

var app = express();
var httpServer = http.createServer(app);
var sockServer = sockjs.createServer();

sockServer.installHandlers(httpServer,{prefix:'/chat'});
httpServer.listen(8181,'0.0.0.0');

var clients = [];

var CONNECTING = 0;
var OPEN = 1;
var CLOSING = 2;
var CLOSED = 3;

function wsSend(type, client_uuid, nickname, message){
    for(var i=0; i<clients.length; i++){
        var clientSocket = clients[i].connection;
        if(clientSocket.readyState===OPEN){
            clientSocket.write(JSON.stringify({
                              "type": type,
                              "id": client_uuid,
                              "nickname": nickname,
                              "message": message
                              }));
        }
    }
}

var clientIndex = 1;

sockServer.on('connection', function(conn){
    
    var client_uuid = uuid.v4();
    var nickname = "AnnymouseUser"+clientIndex;
    clientIndex+=1;
    clients.push({"id": client_uuid,"connection": conn, "nickname": nickname});
    console.log("client[%s] connected",client_uuid);
    
    var connect_message = nickname + " has connected";
    wsSend("notification", client_uuid, nickname, connect_message);

    conn.on('data', function(message){
        if(message.indexOf('/nick')===0){
            var nickname_array = message.split(' ');
            if(nickname_array.length>=2){
                var old_nickname = nickname;
                nickname = nickname_array[1];
                var nickname_message = "Client " + old_nickname + " changed to " + nickname;
                wsSend("nick_update", client_uuid, nickname, nickname_message)
            }
        }else if(message.length>0){
           wsSend("data", client_uuid, nickname, message);
        }
    });
    
    var closeSocket = function(customMessage){
        for(var i=0; i<clients.length;i++){
            if(clients[i].id==client_uuid){
                var disconnect_message;
                if(customMessage){
                    disconnect_message=disconnect_message;
                }
                else{
                    disconnect_message = nickname+" has disconnected";
                }
                wsSend("notification", client_uuid, nickname, disconnect_message);
                clients.splice(i,1);
            }
        }
    }

    conn.on('close',function(){
        closeSocket();
    });

    process.on('SIGINT', function(){
        console.log("Closing on");
        closeSocket('Server was disconnected');
        process.exit();
    });
});