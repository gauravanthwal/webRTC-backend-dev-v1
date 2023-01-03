const express = require("express");
const socket = require("socket.io");
const {ExpressPeerServer} = require('peer');
const groupCallHandler = require('./groupCallHandler');
const {v4: uuidv4} = require('uuid');

const PORT = process.env.PORT || 5000;

const app = express();

const server = app.listen(PORT, () =>
  console.log("server is running on port ", PORT)
);

const peerServer = ExpressPeerServer(server,{
  debug: true
})

app.use('/peerjs', peerServer);

groupCallHandler.createPeerServerListener(peerServer);

const io = socket(server, {
  cors: {
    origin: "*",
    methods: ["GET", "POST"],
  },
});

app.use('/', (req, res)=>{
  res.send('connect your client to webSocket events.')
})

let peers = [];
let groupCallRooms = [];

const broadcastEventTypes = {
  ACTIVE_USERS: "ACTIVE_USERS",
  GROUP_CALL_ROOMS: "GROUP_CALL_ROOMS",
};

io.on("connection", (socket) => {
  socket.emit("connection", null);
  console.log("new user connected", socket.id);

  // Register a New User
  socket.on("register-new-user", (data) => {
    peers.push({
      username: data.username,
      socketId: data.socketId,
    });
    console.log("registered a new user ", peers);

    io.sockets.emit("broadcast", {
      event: broadcastEventTypes.ACTIVE_USERS,
      activeUsers: peers,
    });

    io.sockets.emit('broadcast', {
      event: broadcastEventTypes.GROUP_CALL_ROOMS,
      groupCallRooms
    })
  });

  // Remove User on Disconnect
  socket.on("disconnect", () => {
    console.log("user disconnected");
    peers = peers.filter((peer) => peer.socketId !== socket.id);
    io.sockets.emit("broadcast", {
      event: broadcastEventTypes.ACTIVE_USERS,
      activeUsers: peers,
    });
  });

  // listener related with direct call
  socket.on("pre-offer", (data) => {
    console.log("pre-offer handled");

    io.to(data.callee.socketId).emit("pre-offer", {
      callerUsername: data.caller.username,
      callerSocketId: socket.id,
    });
  });

  socket.on("pre-offer-answer", (data) => {
    console.log("handling pre offer answer");
    io.to(data.callerSocketId).emit("pre-offer-answer", {
      answer: data.answer,
    });
  });

  socket.on("webRTC-offer", (data) => {
    console.log("handling webRTC offer");
    io.to(data.callerSocketId).emit("webRTC-offer", {
      offer: data.offer,
    });
  });

  socket.on("webRTC-answer", (data) => {
    io.to(data.callerSocketId).emit("webRTC-answer", {
      answer: data.answer,
    });
  });

  socket.on("webRTC-candidate", (data) => {
    io.to(data.connectedUserSocketId).emit("webRTC-candidate", {
      candidate: data.candidate,
    });
  });

  socket.on('user-hanged-up', (data)=>{
    console.log('handling user hang up');
    io.to(data.connectedUserSocketId).emit('user-hanged-up');
  })

  // listener related to group calls
  socket.on('group-call-register', (data)=>{
    const roomId = uuidv4();
    socket.join(roomId);

    const newGroupCallRoom = {
      peerId: data.peerId,
      hostName: data.username,
      socketId: socket.id,
      roomId: roomId
    }

    groupCallRooms.push(newGroupCallRoom);
    io.sockets.emit('broadcast', {
      event: broadcastEventTypes.GROUP_CALL_ROOMS,
      groupCallRooms
    })
  })
});
