const roomInput = document.getElementById("roomCode");
const connectButton = document.getElementById("connectViewer");
const remoteCamera = document.getElementById("remoteCamera");
const status = document.getElementById("status");

let socket = null;
let peerConnection = null;
let pendingCandidates = [];

const rtcConfig = {
    iceServers: [
        {
            urls: "stun:stun.l.google.com:19302"
        }
    ]
};

function createPeerConnection(roomCode) {
    peerConnection = new RTCPeerConnection(rtcConfig);

    peerConnection.ontrack = event => {
        remoteCamera.srcObject = event.streams[0];
        status.textContent = "Live camera connected!";
    };

    peerConnection.onicecandidate = event => {
        if (event.candidate) {
            socket.emit("signal", {
                roomId: roomCode,
                data: {
                    type: "candidate",
                    candidate: event.candidate
                }
            });
        }
    };

    peerConnection.onconnectionstatechange = () => {
        status.textContent =
            "Connection: " + peerConnection.connectionState;
    };
}

connectButton.addEventListener("click", () => {
    const roomCode = roomInput.value.trim();

    if (!roomCode) {
        status.textContent = "Please enter a room code.";
        return;
    }

    socket?.disconnect();
    peerConnection?.close();

    pendingCandidates = [];
    remoteCamera.srcObject = null;

    socket = io();

    socket.on("connect", () => {
        socket.emit("join-room", roomCode);
    });

    socket.on("joined-room", () => {
        status.textContent = "Joined room. Waiting for camera...";
        connectButton.disabled = true;
        roomInput.disabled = true;
    });

    socket.on("peer-joined", () => {
        status.textContent = "Camera device joined. Waiting for video...";
    });

    socket.on("signal", async data => {
        try {
            if (data.type === "offer") {
                if (!peerConnection) {
                    createPeerConnection(roomCode);
                }

                await peerConnection.setRemoteDescription(data.sdp);

                for (const candidate of pendingCandidates) {
                    await peerConnection.addIceCandidate(candidate);
                }

                pendingCandidates = [];

                const answer = await peerConnection.createAnswer();
                await peerConnection.setLocalDescription(answer);

                socket.emit("signal", {
                    roomId: roomCode,
                    data: {
                        type: "answer",
                        sdp: peerConnection.localDescription
                    }
                });
            }

            if (data.type === "candidate" && peerConnection) {
                if (peerConnection.remoteDescription) {
                    await peerConnection.addIceCandidate(data.candidate);
                } else {
                    pendingCandidates.push(data.candidate);
                }
            }
        } catch (error) {
            console.error(error);
            status.textContent = "Connection failed. Check the console.";
        }
    });

    socket.on("room-full", () => {
        status.textContent = "This room is full. Try another room.";
        connectButton.disabled = false;
        roomInput.disabled = false;
    });
});