import React, { useEffect, useRef, useState, useCallback } from "react";
import io, { Socket } from "socket.io-client";
import SimplePeer from "simple-peer";

interface VoiceChatProps {
  gameCode: string;
  showControls?: boolean;
  onSpeakingChange?: (peerId: string, isSpeaking: boolean) => void;
  onMuteChange?: (isMuted: boolean) => void;
}

interface PeerData {
  peer: SimplePeer.Instance;
  stream?: MediaStream;
  analyser?: AnalyserNode;
}

// Configuration des serveurs ICE (STUN/TURN) pour la connectivité WebRTC
const ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun1.l.google.com:19302" },
  { urls: "stun:stun2.l.google.com:19302" },
  { urls: "stun:stun3.l.google.com:19302" },
  { urls: "stun:stun4.l.google.com:19302" },
];

const VoiceChat: React.FC<VoiceChatProps> = ({
  gameCode,
  showControls = true,
  onSpeakingChange,
  onMuteChange,
}) => {
  const socketRef = useRef<Socket | null>(null);
  const userAudioRef = useRef<HTMLAudioElement>(null);
  const peersRef = useRef<Record<string, SimplePeer.Instance>>({});
  const [peers, setPeers] = useState<Record<string, PeerData>>({});
  const [isMuted, setIsMuted] = useState(false);
  const [isConnected, setIsConnected] = useState(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const localAnalyserRef = useRef<AnalyserNode | null>(null);
  const speakingCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  // Seuil de détection de voix (ajustable)
  const SPEAKING_THRESHOLD = 25;

  // Vérifier si un flux audio est actif (joueur parle)
  const checkAudioLevel = useCallback(
    (analyser: AnalyserNode, peerId: string) => {
      const dataArray = new Uint8Array(analyser.frequencyBinCount);
      analyser.getByteFrequencyData(dataArray);
      const average = dataArray.reduce((a, b) => a + b, 0) / dataArray.length;
      const isSpeaking = average > SPEAKING_THRESHOLD;
      onSpeakingChange?.(peerId, isSpeaking);
    },
    [onSpeakingChange]
  );

  // Configurer l'analyseur audio pour un flux
  const setupAudioAnalyser = useCallback(
    (stream: MediaStream): AnalyserNode | undefined => {
      if (!audioContextRef.current) {
        audioContextRef.current = new (window.AudioContext ||
          (window as typeof window & { webkitAudioContext: typeof AudioContext }).webkitAudioContext)();
      }

      try {
        const analyser = audioContextRef.current.createAnalyser();
        const source = audioContextRef.current.createMediaStreamSource(stream);
        source.connect(analyser);
        analyser.fftSize = 256;
        return analyser;
      } catch (err) {
        console.error("Erreur création analyseur audio:", err);
        return undefined;
      }
    },
    []
  );

  // Toggle mute du micro local
  const toggleMute = useCallback(() => {
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        onMuteChange?.(!audioTrack.enabled);
      }
    }
  }, [onMuteChange]);

  // Effet principal pour la configuration WebRTC (ne dépend que de gameCode)
  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      console.error("getUserMedia non supporté par ce navigateur");
      return;
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";
    console.log("[VoiceChat] Connexion au namespace /voice-chat sur", backendUrl);
    const socket = io(`${backendUrl}/voice-chat`, {
      transports: ["polling", "websocket"],
      upgrade: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
      forceNew: true,
    });
    socketRef.current = socket;

    socket.on("connect", () => {
      console.log("[VoiceChat] Socket connecté, id:", socket.id);
    });

    socket.on("connect_error", (err) => {
      console.error("[VoiceChat] Erreur de connexion:", err.message);
    });

    let localStream: MediaStream | null = null;

    const setupMedia = async () => {
      try {
        localStream = await navigator.mediaDevices.getUserMedia({
          audio: {
            echoCancellation: true,
            noiseSuppression: true,
            autoGainControl: true,
          },
        });
        localStreamRef.current = localStream;
        console.log("Accès au microphone obtenu");

        if (userAudioRef.current) {
          userAudioRef.current.srcObject = localStream;
        }

        // Configurer l'analyseur pour le micro local
        const localAnalyser = setupAudioAnalyser(localStream);
        localAnalyserRef.current = localAnalyser || null;

        setIsConnected(true);

        // Créer un peer pour un utilisateur
        const createPeerConnection = (
          userId: string,
          initiator: boolean
        ): SimplePeer.Instance => {
          console.log(`[VoiceChat] Création peer pour ${userId}, initiator: ${initiator}`);
          const peer = new SimplePeer({
            initiator,
            trickle: true,
            stream: localStream!,
            config: { iceServers: ICE_SERVERS },
          });

          peer.on("signal", (signal) => {
            console.log(`[VoiceChat] Signal émis vers ${userId}, type: ${(signal as Record<string, unknown>).type || "candidate"}`);
            socket.emit("signal", {
              target: userId,
              signal,
              sender: socket.id,
            });
          });

          peer.on("stream", (remoteStream) => {
            console.log(`[VoiceChat] ✅ Flux audio reçu de ${userId}, tracks: ${remoteStream.getAudioTracks().length}`);
            const analyser = setupAudioAnalyser(remoteStream);
            setPeers((prev) => ({
              ...prev,
              [userId]: { peer, stream: remoteStream, analyser },
            }));
          });

          peer.on("connect", () => {
            console.log(`[VoiceChat] ✅ Connexion peer établie avec ${userId}`);
          });

          peer.on("error", (err) => {
            console.error(`[VoiceChat] ❌ Erreur Peer ${userId}:`, err.message);
          });

          peer.on("close", () => {
            console.log(`[VoiceChat] Peer ${userId} fermé`);
          });

          return peer;
        };

        // Recevoir la liste des utilisateurs existants dans la room
        // Le NOUVEAU venu reçoit cette liste et INITIE les connexions (initiator: true)
        socket.on("existing_users", (userIds: string[]) => {
          console.log("[VoiceChat] Utilisateurs existants:", userIds);
          userIds.forEach((userId) => {
            if (userId !== socket.id && !peersRef.current[userId]) {
              console.log(`[VoiceChat] Initiation peer vers utilisateur existant ${userId}`);
              const peer = createPeerConnection(userId, true);
              peersRef.current[userId] = peer;
            }
          });
        });

        // Nouvel utilisateur connecté — l'utilisateur EXISTANT crée un peer
        // non-initiateur pour être prêt à répondre au signal du nouveau venu
        socket.on("user_connected", (userId: string) => {
          if (userId !== socket.id && !peersRef.current[userId]) {
            console.log(`[VoiceChat] Nouvel utilisateur ${userId}, création peer non-initiateur`);
            const peer = createPeerConnection(userId, false);
            peersRef.current[userId] = peer;
          }
        });

        // Recevoir un signal WebRTC
        socket.on(
          "signal",
          (data: {
            sender: string;
            signal: SimplePeer.SignalData;
            target: string;
          }) => {
            const { sender, signal } = data;
            if (sender === socket.id) return;

            console.log(`[VoiceChat] Signal reçu de ${sender}, type: ${(signal as Record<string, unknown>).type || "candidate"}`);

            const existingPeer = peersRef.current[sender];

            if (existingPeer) {
              if (existingPeer.destroyed) {
                console.warn(`[VoiceChat] Peer ${sender} détruit, re-création...`);
                delete peersRef.current[sender];
                setPeers((prev) => {
                  const newPeers = { ...prev };
                  delete newPeers[sender];
                  return newPeers;
                });
                const peer = createPeerConnection(sender, false);
                peersRef.current[sender] = peer;
                try { peer.signal(signal); } catch (e) { console.error("[VoiceChat] Erreur signal:", e); }
              } else {
                try {
                  peersRef.current[sender].signal(signal);
                } catch (err) {
                  console.error(`[VoiceChat] Erreur signalisation ${sender}:`, err);
                  existingPeer.destroy();
                  delete peersRef.current[sender];
                  setPeers((prev) => {
                    const newPeers = { ...prev };
                    delete newPeers[sender];
                    return newPeers;
                  });
                  const peer = createPeerConnection(sender, false);
                  peersRef.current[sender] = peer;
                  try { peer.signal(signal); } catch (e) { console.error("[VoiceChat] Erreur signal après recréation:", e); }
                }
              }
            } else {
              // Pas de peer existant — créer un non-initiateur et appliquer le signal
              console.log(`[VoiceChat] Pas de peer pour ${sender}, création non-initiateur`);
              const peer = createPeerConnection(sender, false);
              peersRef.current[sender] = peer;
              try { peer.signal(signal); } catch (e) { console.error("[VoiceChat] Erreur signal nouveau peer:", e); }
            }
          }
        );

        // Utilisateur déconnecté
        socket.on("user_disconnected", (userId: string) => {
          console.log(`Utilisateur déconnecté: ${userId}`);
          if (peersRef.current[userId]) {
            peersRef.current[userId].destroy();
            delete peersRef.current[userId];
            setPeers((prev) => {
              const newPeers = { ...prev };
              delete newPeers[userId];
              return newPeers;
            });
            onSpeakingChange?.(userId, false);
          }
        });

        // Rejoindre la room
        socket.emit("join_room", gameCode);
      } catch (err) {
        console.error("Erreur getUserMedia:", err);
      }
    };

    setupMedia();

    return () => {
      socket.disconnect();
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      Object.values(peersRef.current).forEach((peer) => peer.destroy());
      peersRef.current = {};
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameCode]);

  // Effet séparé pour la vérification des niveaux audio
  useEffect(() => {
    speakingCheckIntervalRef.current = setInterval(() => {
      // Vérifier le micro local
      if (localAnalyserRef.current && !isMuted) {
        checkAudioLevel(localAnalyserRef.current, "local");
      }
      // Vérifier les peers distants
      Object.entries(peers).forEach(([peerId, peerData]) => {
        if (peerData.analyser) {
          checkAudioLevel(peerData.analyser, peerId);
        }
      });
    }, 100);

    return () => {
      if (speakingCheckIntervalRef.current) {
        clearInterval(speakingCheckIntervalRef.current);
      }
    };
  }, [peers, isMuted, checkAudioLevel]);

  return (
    <div className="voice-chat-container">
      {/* Audio elements cachés */}
      <audio ref={userAudioRef} autoPlay muted />
      {Object.entries(peers).map(
        ([userId, { stream }]) =>
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
      )}

      {/* Contrôles micro (optionnel) */}
      {showControls && (
        <div className="flex items-center gap-2">
          <button
            onClick={toggleMute}
            className={`mic-button p-3 rounded-full transition-all ${
              isMuted
                ? "bg-red-600 hover:bg-red-700"
                : "bg-green-600 hover:bg-green-700"
            }`}
            title={isMuted ? "Activer le micro" : "Couper le micro"}
          >
            {isMuted ? (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z"
                />
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2"
                />
              </svg>
            ) : (
              <svg
                xmlns="http://www.w3.org/2000/svg"
                className="h-6 w-6 text-white"
                fill="none"
                viewBox="0 0 24 24"
                stroke="currentColor"
              >
                <path
                  strokeLinecap="round"
                  strokeLinejoin="round"
                  strokeWidth={2}
                  d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z"
                />
              </svg>
            )}
          </button>
          <span className="text-sm text-gray-300">
            {isConnected
              ? isMuted
                ? "Micro coupé"
                : "Micro actif"
              : "Connexion..."}
          </span>
        </div>
      )}
    </div>
  );
};

export default VoiceChat;
