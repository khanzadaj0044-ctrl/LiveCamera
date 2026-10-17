const camera = document.getElementById("camera");
const startButton = document.getElementById("startCamera");
const stopButton = document.getElementById("stopCamera");
const roomInput = document.getElementById("roomCode");
const message = document.getElementById("message");

let cameraStream = null;
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

    cameraStream.getTracks().forEach(track => {
        peerConnection.addTrack(track, cameraStream);
    });

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
        message.textContent =
            "Connection: " + peerConnection.connectionState;
    };
}

async function startConnection(roomCode) {
    if (!peerConnection) {
        createPeerConnection(roomCode);
    }

    const offer = await peerConnection.createOffer();

    await peerConnection.setLocalDescription(offer);

    socket.emit("signal", {
        roomId: roomCode,
        data: {
            type: "offer",
            sdp: peerConnection.localDescription
        }
    });

    message.textContent = "Waiting for viewer to connect...";
}

startButton.addEventListener("click", async () => {
    const roomCode = roomInput.value.trim();

    if (!roomCode) {
        message.textContent = "Please enter a room code.";
        return;
    }

    if (!navigator.mediaDevices?.getUserMedia) {
        message.textContent = "Camera requires HTTPS or localhost.";
        return;
    }

    startButton.disabled = true;
    message.textContent = "Requesting camera permission...";

    try {
        cameraStream = await navigator.mediaDevices.getUserMedia({
            video: { facingMode: "user" },
            audio: false
        });

        camera.srcObject = cameraStream;

        socket = io();

        socket.on("connect", () => {
            socket.emit("join-room", roomCode);
        });

        socket.on("joined-room", () => {
            message.textContent =
                "Camera ready. Waiting for viewer...";
            startButton.hidden = true;
            stopButton.hidden = false;
            roomInput.disabled = true;
        });

        socket.on("peer-joined", async () => {
            try {
                if (!peerConnection) {
                    await startConnection(roomCode);
                }
            } catch (error) {
                message.textContent = "Could not create camera connection.";
                console.error(error);
            }
        });

        socket.on("signal", async data => {
            try {
                if (data.type === "answer" && peerConnection) {
                    await peerConnection.setRemoteDescription(data.sdp);

                    for (const candidate of pendingCandidates) {
                        await peerConnection.addIceCandidate(candidate);
                    }

                    pendingCandidates = [];
                    message.textContent = "Viewer connected!";
                }

                if (data.type === "candidate" && peerConnection) {
                    if (peerConnection.remoteDescription) {
                        await peerConnection.addIceCandidate(data.candidate);
                    } else {
                        pendingCandidates.push(data.candidate);
                    }
                }
            } catch (error) {
                console.error("Connection signal error:", error);
            }
        });

        socket.on("room-full", () => {
            message.textContent = "This room is full. Try another room.";
            stopSharing();
        });

    } catch (error) {
        console.error(error);
        message.textContent =
            "Camera could not start. Check permission and connection.";
        startButton.disabled = false;
    }
});

function stopSharing() {
    cameraStream?.getTracks().forEach(track => track.stop());
    cameraStream = null;
    camera.srcObject = null;

    peerConnection?.close();
    peerConnection = null;
    pendingCandidates = [];

    socket?.disconnect();
    socket = null;

    startButton.hidden = false;
    startButton.disabled = false;
    stopButton.hidden = true;
    roomInput.disabled = false;
}

stopButton.addEventListener("click", () => {
    stopSharing();
    message.textContent = "Camera sharing stopped.";
});