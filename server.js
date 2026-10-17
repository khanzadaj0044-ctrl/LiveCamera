
const express = require("express");
const http = require("http");
const { Server } = require("socket.io");
const path = require("path");

const app = express();
const server = http.createServer(app);
const io = new Server(server);

app.use(express.static(__dirname));

io.on("connection", (socket) => {
    console.log("Connected:", socket.id);

    socket.on("join-room", (roomId) => {
        const room = io.sockets.adapter.rooms.get(roomId);

        if (room && room.size >= 2) {
            socket.emit("room-full");
            return;
        }

        socket.join(roomId);
        socket.emit("joined-room", roomId);

        socket.to(roomId).emit("peer-joined");
    });

    socket.on("signal", ({ roomId, data }) => {
        socket.to(roomId).emit("signal", data);
    });

    socket.on("disconnect", () => {
        console.log("Disconnected:", socket.id);
    });
});

server.listen(3000, () => {
    console.log("Server running at http://localhost:3000");
});
