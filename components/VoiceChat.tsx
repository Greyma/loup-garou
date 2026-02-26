import React, { useEffect, useRef, useState, useCallback } from "react";
import io, { Socket } from "socket.io-client";
import SimplePeer from "simple-peer";

interface VoiceChatProps {
  gameCode: string;
  showControls?: boolean;
  onSpeakingChange?: (peerId: string, isSpeaking: boolean) => void;
  onMuteChange?: (isMuted: boolean) => void;
  gameSocket?: Socket | null; // Socket du jeu pour recevoir les permissions vocales
  isNarrator?: boolean;
}

interface PeerData {
  peer: SimplePeer.Instance;
  stream?: MediaStream;
  analyser?: AnalyserNode;
}

// Configuration de base STUN (les serveurs TURN sont chargés dynamiquement)
const FALLBACK_ICE_SERVERS: RTCIceServer[] = [
  { urls: "stun:stun.l.google.com:19302" },
  { urls: "stun:stun.relay.metered.ca:80" },
];

// Contraintes audio optimisées pour la voix (basse latence, faible bande passante)
const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  // Mono, 16kHz suffisant pour la voix humaine
  channelCount: 1,
  sampleRate: 16000,
  sampleSize: 16,
};

// Transforme le SDP pour forcer Opus mono à faible bitrate (économise ~70% de bande passante)
function optimizeSdpForVoice(sdp: string): string {
  return sdp.replace(
    /a=fmtp:111 /g,
    "a=fmtp:111 maxaveragebitrate=24000;stereo=0;sprop-stereo=0;usedtx=1;useinbandfec=1;"
  );
}

// Récupère les credentials TURN depuis le backend
async function fetchTurnCredentials(): Promise<RTCIceServer[]> {
  try {
    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";
    const res = await fetch(`${backendUrl}/api/turn-credentials`);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    const data = await res.json();
    return data.iceServers;
  } catch (err) {
    console.error("[VoiceChat] Impossible de récupérer les TURN credentials, fallback STUN only:", err);
    return FALLBACK_ICE_SERVERS;
  }
}

const VoiceChat: React.FC<VoiceChatProps> = ({
  gameCode,
  showControls = true,
  onSpeakingChange,
  onMuteChange,
  gameSocket,
  isNarrator = false,
}) => {
  const socketRef = useRef<Socket | null>(null);
  const userAudioRef = useRef<HTMLAudioElement>(null);
  const peersRef = useRef<Record<string, SimplePeer.Instance>>({});
  const [peers, setPeers] = useState<Record<string, PeerData>>({});
  const [isMuted, setIsMuted] = useState(true); // Push-to-talk: micro coupé par défaut
  const [isPTTActive, setIsPTTActive] = useState(false); // État du push-to-talk
  const [isConnected, setIsConnected] = useState(false);
  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const localAnalyserRef = useRef<AnalyserNode | null>(null);
  const speakingCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);
  const [voicePermissions, setVoicePermissions] = useState<{ canSpeak: boolean; canHearIds?: string[] | null; narratorVoiceId?: string | null } | null>(null);
  const audioElementsRef = useRef<Record<string, HTMLAudioElement>>({});
  const voicePermissionsRef = useRef(voicePermissions);
  // Ref pour accéder au gameSocket depuis les closures (éviter stale closure)
  const gameSocketRef = useRef<Socket | null>(gameSocket ?? null);

  // Garder les refs sync avec le state/props
  useEffect(() => {
    voicePermissionsRef.current = voicePermissions;
  }, [voicePermissions]);
  useEffect(() => {
    gameSocketRef.current = gameSocket ?? null;
  }, [gameSocket]);

  // Seuil de détection de voix
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
        analyser.fftSize = 128;
        return analyser;
      } catch (err) {
        console.error("Erreur création analyseur audio:", err);
        return undefined;
      }
    },
    []
  );

  // Push-to-talk: activer le micro (appui)
  const startPTT = useCallback(() => {
    if (!localStreamRef.current) return;
    // Le narrateur utilise un toggle classique, pas PTT
    if (isNarrator) return;
    // Vérifier que le joueur a la permission de parler (null = pas de permission)
    const perms = voicePermissionsRef.current;
    if (!perms || !perms.canSpeak) return;

    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = true;
      setIsMuted(false);
      setIsPTTActive(true);
      onMuteChange?.(false);
    }
  }, [isNarrator, onMuteChange]);

  // Push-to-talk: couper le micro (relâchement)
  const stopPTT = useCallback(() => {
    if (!localStreamRef.current) return;
    if (isNarrator) return;

    const audioTrack = localStreamRef.current.getAudioTracks()[0];
    if (audioTrack) {
      audioTrack.enabled = false;
      setIsMuted(true);
      setIsPTTActive(false);
      onMuteChange?.(true);
    }
  }, [isNarrator, onMuteChange]);

  // Toggle mute pour le narrateur (comportement classique)
  const toggleMute = useCallback(() => {
    if (!isNarrator) return; // Les joueurs utilisent PTT
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        onMuteChange?.(!audioTrack.enabled);
      }
    }
  }, [isNarrator, onMuteChange]);

  // Écouter la touche Espace pour PTT (uniquement pour les joueurs)
  useEffect(() => {
    if (isNarrator) return;

    const handleKeyDown = (e: KeyboardEvent) => {
      if (e.code === "Space" && !e.repeat && e.target === document.body) {
        e.preventDefault();
        startPTT();
      }
    };

    const handleKeyUp = (e: KeyboardEvent) => {
      if (e.code === "Space") {
        e.preventDefault();
        stopPTT();
      }
    };

    window.addEventListener("keydown", handleKeyDown);
    window.addEventListener("keyup", handleKeyUp);

    return () => {
      window.removeEventListener("keydown", handleKeyDown);
      window.removeEventListener("keyup", handleKeyUp);
    };
  }, [isNarrator, startPTT, stopPTT]);

  // Effet principal pour la configuration WebRTC (ne dépend que de gameCode)
  useEffect(() => {
    if (!navigator.mediaDevices?.getUserMedia) {
      console.error("getUserMedia non supporté par ce navigateur");
      return;
    }

    const backendUrl = process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001";
    const socket = io(`${backendUrl}/voice-chat`, {
      transports: ["polling", "websocket"],
      upgrade: true,
      reconnectionAttempts: 5,
      reconnectionDelay: 1000,
      timeout: 20000,
      forceNew: true,
    });
    socketRef.current = socket;

    socket.on("connect_error", (err) => {
      console.error("[VoiceChat] Erreur de connexion:", err.message);
    });

    // Enregistrer le voice-chat socket ID auprès du game socket dès que le
    // voice socket se connecte. Doit être enregistré AVANT setupMedia (qui await
    // getUserMedia), sinon l'événement connect peut être raté.
    socket.on("connect", () => {
      // Retry mechanism: gameSocket may not be connected yet when voice socket connects.
      // Poll every 500ms up to 20 times (10s max) until gameSocket.id is available.
      const tryRegister = (attempts = 0) => {
        const gs = gameSocketRef.current;
        if (gs?.id) {
          console.log(`[VoiceChat] voice connect: register_voice_socket + identify_game_socket (voiceId=${socket.id}, gameId=${gs.id}, attempt=${attempts})`);
          gs.emit("register_voice_socket", { voiceSocketId: socket.id });
          socket.emit("identify_game_socket", { gameSocketId: gs.id, roomCode: gameCode });
        } else if (attempts < 20) {
          console.log(`[VoiceChat] gameSocket pas encore dispo, retry ${attempts + 1}/20...`);
          setTimeout(() => tryRegister(attempts + 1), 500);
        } else {
          console.warn(`[VoiceChat] gameSocket toujours indisponible après 20 tentatives`);
        }
      };
      tryRegister();
    });

    let localStream: MediaStream | null = null;

    const setupMedia = async () => {
      try {
        const iceServers = await fetchTurnCredentials();

        localStream = await navigator.mediaDevices.getUserMedia({
          audio: AUDIO_CONSTRAINTS,
          video: false,
        });
        localStreamRef.current = localStream;

        // Push-to-talk: micro coupé par défaut pour les joueurs
        if (!isNarrator) {
          const audioTrack = localStream.getAudioTracks()[0];
          if (audioTrack) {
            audioTrack.enabled = false;
          }
        }

        if (userAudioRef.current) {
          userAudioRef.current.srcObject = localStream;
        }

        const localAnalyser = setupAudioAnalyser(localStream);
        localAnalyserRef.current = localAnalyser || null;

        setIsConnected(true);

        const createPeerConnection = (
          userId: string,
          initiator: boolean
        ): SimplePeer.Instance => {
          const peer = new SimplePeer({
            initiator,
            trickle: true,
            stream: localStream!,
            config: {
              iceServers: iceServers,
              iceCandidatePoolSize: 10,
              bundlePolicy: "max-bundle" as RTCBundlePolicy,
            },
            sdpTransform: optimizeSdpForVoice,
          });

          let iceRestartTimeout: ReturnType<typeof setTimeout> | null = null;
          peer.on("iceStateChange", (iceConnectionState: string) => {
            if (iceConnectionState === "disconnected") {
              iceRestartTimeout = setTimeout(() => {
                if (!peer.destroyed) {
                  try {
                    (peer as unknown as { _pc: RTCPeerConnection })._pc?.restartIce?.();
                  } catch (e) {
                    console.error(`[VoiceChat] Erreur ICE restart:`, e);
                  }
                }
              }, 3000);
            }
            if (iceConnectionState === "connected" || iceConnectionState === "completed") {
              if (iceRestartTimeout) { clearTimeout(iceRestartTimeout); iceRestartTimeout = null; }
            }
            if (iceConnectionState === "failed") {
              if (iceRestartTimeout) { clearTimeout(iceRestartTimeout); iceRestartTimeout = null; }
            }
          });

          peer.on("signal", (signal) => {
            socket.emit("signal", {
              target: userId,
              signal,
              sender: socket.id,
            });
          });

          peer.on("stream", (remoteStream) => {
            const analyser = setupAudioAnalyser(remoteStream);
            setPeers((prev) => ({
              ...prev,
              [userId]: { peer, stream: remoteStream, analyser },
            }));
          });

          peer.on("error", (err) => {
            // Ignorer les erreurs de fermeture intentionnelle (cleanup/disconnect)
            if (err.message?.includes("Close called") || err.message?.includes("User-Initiated Abort")) return;
            console.error(`[VoiceChat] Erreur Peer ${userId}:`, err.message);
          });

          peer.on("close", () => {});

          return peer;
        };

        socket.on("existing_users", (userIds: string[]) => {
          userIds.forEach((userId) => {
            if (userId !== socket.id && !peersRef.current[userId]) {
              const peer = createPeerConnection(userId, true);
              peersRef.current[userId] = peer;
            }
          });
        });

        socket.on("user_connected", (userId: string) => {
          if (userId !== socket.id && !peersRef.current[userId]) {
            const peer = createPeerConnection(userId, false);
            peersRef.current[userId] = peer;
          }
        });

        socket.on(
          "signal",
          (data: {
            sender: string;
            signal: SimplePeer.SignalData;
            target: string;
          }) => {
            const { sender, signal } = data;
            if (sender === socket.id) return;

            const existingPeer = peersRef.current[sender];

            if (existingPeer) {
              if (existingPeer.destroyed) {
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
              const peer = createPeerConnection(sender, false);
              peersRef.current[sender] = peer;
              try { peer.signal(signal); } catch (e) { console.error("[VoiceChat] Erreur signal nouveau peer:", e); }
            }
          }
        );

        socket.on("user_disconnected", (userId: string) => {
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

        socket.emit("join_room", gameCode);

        // Identifier ce voice socket auprès du serveur /voice-chat
        // Le connect handler gère déjà le retry, mais on tente aussi ici au cas où
        const gs = gameSocketRef.current;
        if (gs?.id) {
          socket.emit("identify_game_socket", { gameSocketId: gs.id, roomCode: gameCode });
          gs.emit("register_voice_socket", { voiceSocketId: socket.id });
          console.log(`[VoiceChat] identify_game_socket émis post-setupMedia: voiceId=${socket.id}, gameSocketId=${gs.id}`);
        }
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

  // Fallback: quand gameSocket arrive après que le voice socket soit déjà connecté,
  // envoyer identify_game_socket via le voice socket ET register_voice_socket via le game socket.
  useEffect(() => {
    if (!gameSocket) return;
    const voiceSocket = socketRef.current;
    if (!voiceSocket || !voiceSocket.connected) return;

    // Enregistrement via game socket (ancienne méthode, conservée)
    console.log(`[VoiceChat] register_voice_socket émis depuis useEffect fallback (voiceId=${voiceSocket.id})`);
    gameSocket.emit("register_voice_socket", { voiceSocketId: voiceSocket.id });

    // Enregistrement via voice socket (nouvelle méthode fiable)
    voiceSocket.emit("identify_game_socket", { gameSocketId: gameSocket.id, roomCode: gameCode });
    console.log(`[VoiceChat] identify_game_socket émis depuis fallback: gameSocketId=${gameSocket.id}`);

    // Ré-enregistrer quand le game socket se reconnecte
    const handleGameReconnect = () => {
      const vs = socketRef.current;
      if (vs?.connected && gameSocket.id) {
        console.log(`[VoiceChat] re-identification depuis game reconnect (voiceId=${vs.id}, gameId=${gameSocket.id})`);
        gameSocket.emit("register_voice_socket", { voiceSocketId: vs.id });
        vs.emit("identify_game_socket", { gameSocketId: gameSocket.id, roomCode: gameCode });
      }
    };
    gameSocket.on("connect", handleGameReconnect);

    return () => {
      gameSocket.off("connect", handleGameReconnect);
    };
  }, [gameSocket, isConnected, gameCode]);

  // Écouter la demande du backend de ré-enregistrer le voice socket
  // (déclenché quand emitVoicePermissions ne trouve pas le narratorVoiceId)
  useEffect(() => {
    if (!gameSocket) return;

    const handleReregister = () => {
      const voiceSocket = socketRef.current;
      if (voiceSocket?.connected && gameSocket.id) {
        console.log(`[VoiceChat] request_voice_reregister reçu, ré-envoi (voiceId=${voiceSocket.id}, gameId=${gameSocket.id})`);
        gameSocket.emit("register_voice_socket", { voiceSocketId: voiceSocket.id });
        voiceSocket.emit("identify_game_socket", { gameSocketId: gameSocket.id, roomCode: gameCode });
      } else {
        console.log(`[VoiceChat] request_voice_reregister reçu mais voice socket non connecté`);
      }
    };

    gameSocket.on("request_voice_reregister", handleReregister);
    return () => {
      gameSocket.off("request_voice_reregister", handleReregister);
    };
  }, [gameSocket, gameCode]);

  // Reprendre l'AudioContext et l'audio quand le tab redevient visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Reprendre l'AudioContext si suspendu par le navigateur
        if (audioContextRef.current?.state === "suspended") {
          audioContextRef.current.resume();
        }
        // Reprendre la lecture de tous les elements audio des peers
        Object.values(audioElementsRef.current).forEach((el) => {
          if (el.paused) {
            el.play().catch(() => {});
          }
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Effet séparé pour la vérification des niveaux audio (optimisé: 300ms au lieu de 200ms)
  useEffect(() => {
    speakingCheckIntervalRef.current = setInterval(() => {
      if (localAnalyserRef.current && !isMuted) {
        checkAudioLevel(localAnalyserRef.current, "local");
      }
      Object.entries(peers).forEach(([peerId, peerData]) => {
        if (peerData.analyser) {
          checkAudioLevel(peerData.analyser, peerId);
        }
      });
    }, 300);

    return () => {
      if (speakingCheckIntervalRef.current) {
        clearInterval(speakingCheckIntervalRef.current);
      }
    };
  }, [peers, isMuted, checkAudioLevel]);

  // Écouter les permissions vocales depuis le socket de jeu
  useEffect(() => {
    if (!gameSocket) return;

    const handlePermissions = (perms: { canSpeak: boolean; canHearIds?: string[] | null; narratorVoiceId?: string | null }) => {
      console.log(`[VoiceChat] voice_permissions reçu:`, {
        canSpeak: perms.canSpeak,
        canHearIds: perms.canHearIds === null ? 'ALL' : perms.canHearIds,
        narratorVoiceId: perms.narratorVoiceId || 'NOT SET',
        audioElementsCount: Object.keys(audioElementsRef.current).length,
        audioElementsPeerIds: Object.keys(audioElementsRef.current),
      });
      setVoicePermissions(perms);


      // Couper/activer le micro local selon canSpeak
      if (localStreamRef.current) {
        const audioTrack = localStreamRef.current.getAudioTracks()[0];
        if (audioTrack) {
          if (isNarrator) {
            // Le narrateur peut toujours parler (toggle classique)
            audioTrack.enabled = !isMuted;
          } else {
            // Joueur en PTT: le micro est coupe sauf si PTT est actif ET permission accordee
            audioTrack.enabled = perms.canSpeak && isPTTActive;
          }
        }
      }

      // Muter/demuter les peers selon canHearIds (whitelist)
      Object.entries(audioElementsRef.current).forEach(([peerId, audioEl]) => {
        let shouldBeMuted = true;
        if (isNarrator) {
          shouldBeMuted = false;
        } else if (perms.canHearIds === null || perms.canHearIds === undefined) {
          shouldBeMuted = false;
        } else {
          shouldBeMuted = !perms.canHearIds.includes(peerId);
        }
        audioEl.muted = shouldBeMuted;
        audioEl.volume = shouldBeMuted ? 0 : 1.0;
        // Si on démute, s'assurer que l'audio joue (autoplay peut avoir été bloqué)
        if (!shouldBeMuted && audioEl.paused) {
          audioEl.play().catch(() => {});
        }
      });
    };

    gameSocket.on("voice_permissions", handlePermissions);
    return () => {
      gameSocket.off("voice_permissions", handlePermissions);
    };
  }, [gameSocket, isNarrator, isMuted, isPTTActive]);

  // Déterminer le texte de statut
  const getStatusText = () => {
    if (!isConnected) return "Connexion...";
    if (isNarrator) {
      return isMuted ? "Micro coupé" : "Micro actif";
    }
    // Joueur PTT
    if (!voicePermissions || !voicePermissions.canSpeak) {
      return "Parole desactivee";
    }
    if (isPTTActive) return "Vous parlez...";
    return "Maintenez pour parler";
  };

  return (
    <div className="voice-chat-container">
      {/* Audio elements cachés */}
      <audio ref={userAudioRef} autoPlay muted playsInline />
      {Object.entries(peers).map(
        ([userId, { stream }]) =>
          stream && (
            <audio
              key={userId}
              ref={(el) => {
                if (el) {
                  // TOUJOURS mettre à jour la ref
                  audioElementsRef.current[userId] = el;

                  // 1. D'abord appliquer les permissions (muted/volume)
                  let shouldBeMuted = true;
                  if (isNarrator) {
                    shouldBeMuted = false;
                  } else if (voicePermissions) {
                    if (voicePermissions.canHearIds === null || voicePermissions.canHearIds === undefined) {
                      shouldBeMuted = false;
                    } else {
                      shouldBeMuted = !voicePermissions.canHearIds.includes(userId);
                    }
                  }
                  el.muted = shouldBeMuted;
                  el.volume = shouldBeMuted ? 0 : 1.0;

                  // 2. Assigner le stream si nouveau
                  if (el.srcObject !== stream) {
                    el.srcObject = stream;
                  }

                  // 3. Toujours tenter play() (muted autoplay est autorisé par Chrome)
                  if (el.paused) {
                    el.play().catch((e) => {
                      console.warn(`[VoiceChat] Autoplay bloqué pour ${userId}, retry sur interaction:`, e);
                      const resume = () => { el.play().catch(() => {}); document.removeEventListener("click", resume); };
                      document.addEventListener("click", resume, { once: true });
                    });
                  }
                } else if (audioElementsRef.current[userId]) {
                  delete audioElementsRef.current[userId];
                }
              }}
              autoPlay
              playsInline
            />
          )
      )}

      {/* Contrôles micro */}
      {showControls && (
        <div className="flex items-center gap-2">
          {isNarrator ? (
            /* Narrateur: Toggle classique */
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
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              )}
            </button>
          ) : (
            /* Joueur: Push-to-Talk */
            <button
              onMouseDown={startPTT}
              onMouseUp={stopPTT}
              onMouseLeave={stopPTT}
              onTouchStart={startPTT}
              onTouchEnd={stopPTT}
              disabled={!voicePermissions || !voicePermissions.canSpeak}
              className={`mic-button p-3 rounded-full transition-all select-none ${
                !voicePermissions || !voicePermissions.canSpeak
                  ? "bg-gray-600 cursor-not-allowed opacity-50"
                  : isPTTActive
                    ? "bg-green-500 shadow-lg shadow-green-500/50 scale-110"
                    : "bg-red-600 hover:bg-red-700"
              }`}
              title="Maintenez pour parler (ou appuyez sur Espace)"
            >
              {isPTTActive ? (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white animate-pulse" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M19 11a7 7 0 01-7 7m0 0a7 7 0 01-7-7m7 7v4m0 0H8m4 0h4m-4-8a3 3 0 01-3-3V5a3 3 0 116 0v6a3 3 0 01-3 3z" />
                </svg>
              ) : (
                <svg xmlns="http://www.w3.org/2000/svg" className="h-6 w-6 text-white" fill="none" viewBox="0 0 24 24" stroke="currentColor">
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5.586 15H4a1 1 0 01-1-1v-4a1 1 0 011-1h1.586l4.707-4.707C10.923 3.663 12 4.109 12 5v14c0 .891-1.077 1.337-1.707.707L5.586 15z" />
                  <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M17 14l2-2m0 0l2-2m-2 2l-2-2m2 2l2 2" />
                </svg>
              )}
            </button>
          )}
          <span className="text-sm text-gray-300">
            {getStatusText()}
          </span>
        </div>
      )}
    </div>
  );
};

export default VoiceChat;
