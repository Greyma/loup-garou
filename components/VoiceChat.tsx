import React, { useEffect, useRef, useState } from "react";
import io, { Socket } from "socket.io-client";
import SimplePeer from "simple-peer";

interface VoiceChatProps {
  gameCode: string;
}

const VoiceChat: React.FC<VoiceChatProps> = ({ gameCode }) => {
  const socketRef = useRef<Socket | null>(null);
  const userAudioRef = useRef<HTMLAudioElement>(null);
  const peersRef = useRef<Record<string, SimplePeer.Instance>>({});
  const [peers, setPeers] = useState<Record<string, { peer: SimplePeer.Instance; stream?: MediaStream }>>({});
  const canvasRef = useRef<HTMLCanvasElement>(null);

  // Créer un peer pour un nouvel utilisateur
  const createPeer = (userId: string, callerId: string, stream: MediaStream): SimplePeer.Instance => {
    const peer = new SimplePeer({
      initiator: true,
      trickle: false,
      stream,
    });

    peer.on("signal", (signal) => {
      socketRef.current?.emit("signal", { target: userId, signal, sender: callerId });
    });

    peer.on("stream", (remoteStream) => {
      console.log(`Flux audio reçu de ${userId}`);
      setPeers((prev) => ({ ...prev, [userId]: { peer, stream: remoteStream } }));
      setupAudioVisualizer(remoteStream); // Ajouter la visualisation pour ce flux
    });

    peer.on("error", (err) => console.error(`Erreur Peer ${userId} :`, err));

    return peer;
  };

  // Ajouter un peer pour un utilisateur existant
  const addPeer = (incomingUserId: string, callerId: string, stream: MediaStream): SimplePeer.Instance => {
    const peer = new SimplePeer({
      initiator: false,
      trickle: false,
      stream,
    });

    peer.on("signal", (signal) => {
      socketRef.current?.emit("signal", { target: incomingUserId, signal, sender: callerId });
    });

    peer.on("stream", (remoteStream) => {
      console.log(`Flux audio reçu de ${incomingUserId}`);
      setPeers((prev) => ({ ...prev, [incomingUserId]: { peer, stream: remoteStream } }));
      setupAudioVisualizer(remoteStream); // Ajouter la visualisation pour ce flux
    });

    peer.on("error", (err) => console.error(`Erreur Peer ${incomingUserId} :`, err));

    return peer;
  };

  // Configurer la visualisation audio
  const setupAudioVisualizer = (stream: MediaStream) => {
    const audioContext = new (window.AudioContext || window.AudioContext)();
    const analyser = audioContext.createAnalyser();
    const source = audioContext.createMediaStreamSource(stream);
    source.connect(analyser);
    analyser.fftSize = 256;

    const bufferLength = analyser.frequencyBinCount;
    const dataArray = new Uint8Array(bufferLength);

    const canvas = canvasRef.current!;
    const canvasCtx = canvas.getContext("2d")!;
    const WIDTH = canvas.width;
    const HEIGHT = canvas.height;

    const draw = () => {
      requestAnimationFrame(draw);
      analyser.getByteFrequencyData(dataArray);

      canvasCtx.fillStyle = "rgba(0, 0, 0, 0.1)";
      canvasCtx.fillRect(0, 0, WIDTH, HEIGHT);

      const barWidth = (WIDTH / bufferLength) * 2.5;
      let x = 0;

      for (let i = 0; i < bufferLength; i++) {
        const barHeight = (dataArray[i] / 255) * HEIGHT;
        canvasCtx.fillStyle = `rgba(${Math.random() * 255}, ${Math.random() * 255}, ${Math.random() * 255}, 0.8)`;
        canvasCtx.fillRect(x, HEIGHT - barHeight, barWidth, barHeight);
        x += barWidth + 1;
      }
    };

    draw();
  };

  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      console.error("getUserMedia non supporté par ce navigateur");
      return;
    }

    socketRef.current = io(`${process.env.NEXT_PUBLIC_BACKEND_URL}/voice-chat`, {
      transports: ["websocket"],
    });

    let localStream: MediaStream;

    const setupMedia = async () => {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({ audio: true });
        console.log("Accès au microphone obtenu");
        if (userAudioRef.current) {
          userAudioRef.current.srcObject = localStream;
        }

        // Configurer la visualisation pour le flux local
        setupAudioVisualizer(localStream);

        socketRef.current?.on("user_connected", (userId: string) => {
          if (userId !== socketRef.current?.id && !peersRef.current[userId]) {
            console.log(`Création d’un peer pour ${userId}`);
            if (socketRef.current?.id) {
              const peer = createPeer(userId, socketRef.current.id, localStream);
              peersRef.current[userId] = peer;
            }
          }
        });

        socketRef.current?.on("signal", (data: { sender: string; signal: any; target: string }) => {
          const { sender, signal } = data;
          if (sender === socketRef.current?.id) return;

          if (!peersRef.current[sender]) {
            console.log(`Ajout d’un peer pour ${sender}`);
            if (socketRef.current?.id) {
              const peer = addPeer(sender, socketRef.current.id, localStream);
              peersRef.current[sender] = peer;
              peer.signal(signal);
            }
          } else {
            console.log(`Signalisation pour ${sender}`);
            peersRef.current[sender].signal(signal);
          }
        });

        socketRef.current?.on("user_disconnected", (userId: string) => {
          if (peersRef.current[userId]) {
            peersRef.current[userId].destroy();
            delete peersRef.current[userId];
            setPeers((prev) => {
              const newPeers = { ...prev };
              delete newPeers[userId];
              return newPeers;
            });
          }
        });

        socketRef.current?.emit("join_room", gameCode);
      } catch (err) {
        console.error("Erreur getUserMedia :", err);
      }
    };

    setupMedia();

    return () => {
      socketRef.current?.disconnect();
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      Object.values(peersRef.current).forEach((peer) => peer.destroy());
      peersRef.current = {};
    };
  }, [gameCode]);

  return (
    <div>
      <audio ref={userAudioRef} autoPlay muted />
      {Object.entries(peers).map(([userId, { stream }]) => (
        stream && (
          <audio
            key={userId}
            ref={(el) => {
              if (el) {
                el.srcObject = stream;
              }
            }}
            autoPlay
          />
        )
      ))}
      <canvas ref={canvasRef} width={800} height={200} />
    </div>
  );
};

export default VoiceChat;