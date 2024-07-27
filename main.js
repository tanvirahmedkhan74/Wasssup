let APP_ID = "d66ddff4436747ab94e51a9193268593";
let token = null;

let uid = String(Math.floor(Math.random() * 10000));

let client;
let channel;

let queryParams = window.location.search;
let urlParams = new URLSearchParams(queryParams);
let roomId = urlParams.get('room');

if(!roomId){
    window.location = 'lobby.html';
}

let localStream;
let remoteStream;
let peerConnection;

let servers = {
    iceServers: [
        {
            urls: ['stun:stun.l.google.com:19302', 'stun:stun3.l.google.com:19302']
        }
    ]
}

let constraints = {
    video:{
        width:{min:640, ideal:1920, max:1920},
        height:{min:480, ideal:1080, max:1080},
    },
    audio:true
}

let init = async () => {
    client = new AgoraRTM.createInstance(APP_ID);
    await client.login({uid, token});

    channel = client.createChannel(roomId);
    await channel.join();

    channel.on('MemberJoined', handleJoinedUser);
    client.on('MessageFromPeer', handleMessageFromPeer);
    channel.on('MemberLeft', handleUserLeft);

    localStream = await navigator.mediaDevices.getUserMedia(constraints);
    document.getElementById('user-1').srcObject = localStream;
}

let handleMessageFromPeer = async (message, MemberId) => {
    message = JSON.parse(message.text);

    switch(message.type) {
        case 'offer':
            await createAnswer(MemberId, message.offer);
            break;
        case 'answer':
            await addAnswer(message.answer);
            break;
        case 'candidate':
            if (peerConnection) {
                await peerConnection.addIceCandidate(new RTCIceCandidate(message.candidate));
            }
            break;
    }
}

let handleJoinedUser = async (MemberId) => {
    console.log('New Member Appeared', MemberId);
    await createOffer(MemberId);
}

let handleUserLeft = async (MemberId) => {
    document.getElementById('user-2').style.display = 'none';
    document.getElementById('user-1').classList.remove('smallFrame');

}

let createPeerConnection = async (MemberId) => {
    peerConnection = new RTCPeerConnection(servers);
    remoteStream = new MediaStream();

    document.getElementById('user-2').srcObject = remoteStream;
    document.getElementById('user-2').style.display = 'block';
    document.getElementById('user-1').classList.add('smallFrame');

    if(!localStream){
        localStream = await navigator.mediaDevices.getUserMedia({video: true, audio: true});
        document.getElementById('user-1').srcObject = localStream;
    }

    localStream.getTracks().forEach((track) => {
        peerConnection.addTrack(track, localStream);
    });

    peerConnection.ontrack = (event) => {
        event.streams[0].getTracks().forEach((track) => {
            remoteStream.addTrack(track);
        });
    }

    peerConnection.onicecandidate = async (event) => {
        if(event.candidate){
            await client.sendMessageToPeer({text: JSON.stringify({'type': 'candidate', 'candidate': event.candidate})}, MemberId);
        }
    }
}

let createOffer = async (MemberId) => {
    // Host End
    await createPeerConnection(MemberId);
    let offer = await peerConnection.createOffer();
    await peerConnection.setLocalDescription(offer);

    await client.sendMessageToPeer({text: JSON.stringify({'type': 'offer', 'offer': offer})}, MemberId);
}

let createAnswer = async (MemberId, offer) => {
    // Receiving End
    await createPeerConnection(MemberId);
    await peerConnection.setRemoteDescription(new RTCSessionDescription(offer));

    let answer = await peerConnection.createAnswer();
    await peerConnection.setLocalDescription(answer);

    await client.sendMessageToPeer({text: JSON.stringify({'type': 'answer', 'answer': answer})}, MemberId);
}

let addAnswer = async (answer) => {
    if(!peerConnection.currentRemoteDescription){
        await peerConnection.setRemoteDescription(new RTCSessionDescription(answer));
    }
}

let leaveChannel = async () => {
    await channel.leave();
    await client.logout();
}

let toggleCamera = async () => {
    let videoTrack = localStream.getTracks().find(track => track.kind === 'video');

    if(videoTrack.enabled){
        videoTrack.enabled = false;
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(255, 80, 80)';
    }else{
        videoTrack.enabled = true;
        document.getElementById('camera-btn').style.backgroundColor = 'rgb(31, 6, 46, 0.9)';
    }
}

let toggleAudio = async () => {
    let audioTrack = localStream.getTracks().find(track => track.kind === 'audio');

    if(audioTrack.enabled){
        audioTrack.enabled = false;
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(255, 80, 80)';
    }else{
        audioTrack.enabled = true;
        document.getElementById('mic-btn').style.backgroundColor = 'rgb(31, 6, 46, 0.9)';
    }
}

window.addEventListener('beforeunload', leaveChannel);

document.getElementById('camera-btn').addEventListener('click', toggleCamera);
document.getElementById('mic-btn').addEventListener('click', toggleAudio);


init();
