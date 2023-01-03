const createPeerServerListener = (peerServer) => {
  peerServer.on("connection", (client) => {
    console.log("successfully connected to peerjs server", client.id);
  });
};

module.exports = { createPeerServerListener };
