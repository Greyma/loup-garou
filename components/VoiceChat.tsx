import React, { useEffect, useRef, useState, useCallback } from "react";
import io, { Socket } from "socket.io-client";
import { Device, types as mediasoupTypes } from "mediasoup-client";

interface VoiceChatProps {
  gameCode: string;
  showControls?: boolean;
  onSpeakingChange?: (peerId: string, isSpeaking: boolean) => void;
  onMuteChange?: (isMuted: boolean) => void;
  gameSocket?: Socket | null;
  isNarrator?: boolean;
}

// Contraintes audio optimisées pour la voix (basse latence, faible bande passante)
const AUDIO_CONSTRAINTS: MediaTrackConstraints = {
  echoCancellation: true,
  noiseSuppression: true,
  autoGainControl: true,
  channelCount: 1,
  sampleRate: 16000,
  sampleSize: 16,
};

const VoiceChat: React.FC<VoiceChatProps> = ({
  gameCode,
  showControls = true,
  onSpeakingChange,
  onMuteChange,
  gameSocket,
  isNarrator = false,
}) => {
  const socketRef = useRef<Socket | null>(null);
  const deviceRef = useRef<Device | null>(null);
  const sendTransportRef = useRef<mediasoupTypes.Transport | null>(null);
  const recvTransportRef = useRef<mediasoupTypes.Transport | null>(null);
  const producerRef = useRef<mediasoupTypes.Producer | null>(null);
  const consumersRef = useRef<Map<string, mediasoupTypes.Consumer>>(new Map());

  const [remoteStreams, setRemoteStreams] = useState<Record<string, MediaStream>>({});
  const [isMuted, setIsMuted] = useState(true);
  const [isPTTActive, setIsPTTActive] = useState(false);
  const [isConnected, setIsConnected] = useState(false);

  const localStreamRef = useRef<MediaStream | null>(null);
  const audioContextRef = useRef<AudioContext | null>(null);
  const localAnalyserRef = useRef<AnalyserNode | null>(null);
  const speakingCheckIntervalRef = useRef<NodeJS.Timeout | null>(null);

  const [voicePermissions, setVoicePermissions] = useState<{
    canSpeak: boolean;
    canHearIds?: string[] | null;
    narratorVoiceId?: string | null;
  } | null>(null);

  const audioElementsRef = useRef<Record<string, HTMLAudioElement>>({});
  const remoteAnalysersRef = useRef<Record<string, AnalyserNode>>({});
  const voicePermissionsRef = useRef(voicePermissions);
  const gameSocketRef = useRef<Socket | null>(gameSocket ?? null);

  useEffect(() => {
    voicePermissionsRef.current = voicePermissions;
  }, [voicePermissions]);
  useEffect(() => {
    gameSocketRef.current = gameSocket ?? null;
  }, [gameSocket]);

  const SPEAKING_THRESHOLD = 25;

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
    if (isNarrator) return;
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

  // Toggle mute pour le narrateur
  const toggleMute = useCallback(() => {
    if (!isNarrator) return;
    if (localStreamRef.current) {
      const audioTrack = localStreamRef.current.getAudioTracks()[0];
      if (audioTrack) {
        audioTrack.enabled = !audioTrack.enabled;
        setIsMuted(!audioTrack.enabled);
        onMuteChange?.(!audioTrack.enabled);
      }
    }
  }, [isNarrator, onMuteChange]);

  // Écouter la touche Espace pour PTT
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

  // Effet principal : connexion mediasoup
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

    // Identification game socket dès la connexion voice
    socket.on("connect", () => {
      const tryRegister = (attempts = 0) => {
        const gs = gameSocketRef.current;
        if (gs?.id) {
          console.log(`[VoiceChat] voice connect: register + identify (voiceId=${socket.id}, gameId=${gs.id})`);
          gs.emit("register_voice_socket", { voiceSocketId: socket.id });
          socket.emit("identify_game_socket", { gameSocketId: gs.id, roomCode: gameCode });
        } else if (attempts < 20) {
          setTimeout(() => tryRegister(attempts + 1), 500);
        } else {
          console.warn(`[VoiceChat] gameSocket toujours indisponible après 20 tentatives`);
        }
      };
      tryRegister();
    });

    let localStream: MediaStream | null = null;

    const setupMediasoup = async () => {
      try {
        // 1. Obtenir le micro
        localStream = await navigator.mediaDevices.getUserMedia({
          audio: AUDIO_CONSTRAINTS,
          video: false,
        });
        localStreamRef.current = localStream;

        // PTT: micro coupé par défaut pour les joueurs
        if (!isNarrator) {
          const audioTrack = localStream.getAudioTracks()[0];
          if (audioTrack) audioTrack.enabled = false;
        }

        const localAnalyser = setupAudioAnalyser(localStream);
        localAnalyserRef.current = localAnalyser || null;

        // 2. Rejoindre la room et obtenir les capabilities du Router
        const routerRtpCapabilities = await new Promise<mediasoupTypes.RtpCapabilities>((resolve) => {
          socket.emit("join_room", gameCode);
          socket.once("room_joined", (data: { routerRtpCapabilities: mediasoupTypes.RtpCapabilities }) => {
            resolve(data.routerRtpCapabilities);
          });
        });

        // 3. Créer le Device mediasoup et charger les capabilities
        const device = new Device();
        await device.load({ routerRtpCapabilities });
        deviceRef.current = device;

        // Envoyer nos rtpCapabilities au serveur (nécessaire pour créer des consumers)
        socket.emit("set_rtp_capabilities", {
          roomCode: gameCode,
          rtpCapabilities: device.rtpCapabilities,
        });

        // 4. Créer le Send Transport
        const sendTransportParams = await new Promise<{
          id: string;
          iceParameters: mediasoupTypes.IceParameters;
          iceCandidates: mediasoupTypes.IceCandidate[];
          dtlsParameters: mediasoupTypes.DtlsParameters;
        }>((resolve) => {
          socket.emit("create_send_transport", { roomCode: gameCode });
          socket.once("send_transport_created", resolve);
        });

        const sendTransport = device.createSendTransport({
          id: sendTransportParams.id,
          iceParameters: sendTransportParams.iceParameters,
          iceCandidates: sendTransportParams.iceCandidates,
          dtlsParameters: sendTransportParams.dtlsParameters,
        });
        sendTransportRef.current = sendTransport;

        sendTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
          socket.emit("connect_transport", {
            roomCode: gameCode,
            dtlsParameters,
            direction: "send",
          });
          socket.once("transport_connected", () => callback());
          socket.once("voice_error", (err) => errback(new Error(err.message)));
        });

        sendTransport.on("produce", ({ kind, rtpParameters }, callback, errback) => {
          socket.emit("produce", {
            roomCode: gameCode,
            kind,
            rtpParameters,
          });
          socket.once("produced", ({ producerId }: { producerId: string }) => callback({ id: producerId }));
          socket.once("voice_error", (err) => errback(new Error(err.message)));
        });

        // 5. Produire l'audio local
        const audioTrack = localStream.getAudioTracks()[0];
        const producer = await sendTransport.produce({ track: audioTrack });
        producerRef.current = producer;

        // 6. Créer le Recv Transport
        const recvTransportParams = await new Promise<{
          id: string;
          iceParameters: mediasoupTypes.IceParameters;
          iceCandidates: mediasoupTypes.IceCandidate[];
          dtlsParameters: mediasoupTypes.DtlsParameters;
        }>((resolve) => {
          socket.emit("create_recv_transport", { roomCode: gameCode });
          socket.once("recv_transport_created", resolve);
        });

        const recvTransport = device.createRecvTransport({
          id: recvTransportParams.id,
          iceParameters: recvTransportParams.iceParameters,
          iceCandidates: recvTransportParams.iceCandidates,
          dtlsParameters: recvTransportParams.dtlsParameters,
        });
        recvTransportRef.current = recvTransport;

        recvTransport.on("connect", ({ dtlsParameters }, callback, errback) => {
          socket.emit("connect_transport", {
            roomCode: gameCode,
            dtlsParameters,
            direction: "recv",
          });
          socket.once("transport_connected", () => callback());
          socket.once("voice_error", (err) => errback(new Error(err.message)));
        });

        // 7. Fonction pour consommer un producer distant
        const consumeProducer = async (producerVoiceSocketId: string) => {
          return new Promise<void>((resolve) => {
            socket.emit("consume", { roomCode: gameCode, producerVoiceSocketId });

            // Le consumer arrive via new_consumer (géré dans le handler global ci-dessous)
            // On resolve immédiatement car le handler new_consumer est global
            resolve();
          });
        };

        // 8. Handler pour les nouveaux consumers (reçus du serveur)
        socket.on("new_consumer", async (data: {
          consumerId: string;
          producerId: string;
          producerVoiceSocketId: string;
          kind: mediasoupTypes.MediaKind;
          rtpParameters: mediasoupTypes.RtpParameters;
        }) => {
          try {
            const consumer = await recvTransport.consume({
              id: data.consumerId,
              producerId: data.producerId,
              kind: data.kind,
              rtpParameters: data.rtpParameters,
            });

            consumersRef.current.set(data.producerVoiceSocketId, consumer);

            // Créer un MediaStream pour cet audio
            const stream = new MediaStream([consumer.track]);

            setRemoteStreams((prev) => ({
              ...prev,
              [data.producerVoiceSocketId]: stream,
            }));

            // Resume le consumer côté serveur
            socket.emit("consumer_resume", {
              roomCode: gameCode,
              consumerId: data.consumerId,
            });

            console.log(`[VoiceChat] Consumer créé pour ${data.producerVoiceSocketId}`);
          } catch (err) {
            console.error(`[VoiceChat] Erreur création consumer:`, err);
          }
        });

        // 9. Quand un nouveau producer apparaît, demander à le consommer
        socket.on("new_producer", ({ producerVoiceSocketId }: { producerVoiceSocketId: string }) => {
          console.log(`[VoiceChat] Nouveau producer: ${producerVoiceSocketId}`);
          consumeProducer(producerVoiceSocketId);
        });

        // 10. Quand un producer est fermé (déconnexion)
        socket.on("producer_closed", ({ producerVoiceSocketId }: { producerVoiceSocketId: string }) => {
          const consumer = consumersRef.current.get(producerVoiceSocketId);
          if (consumer) {
            consumer.close();
            consumersRef.current.delete(producerVoiceSocketId);
          }
          setRemoteStreams((prev) => {
            const next = { ...prev };
            delete next[producerVoiceSocketId];
            return next;
          });
          onSpeakingChange?.(producerVoiceSocketId, false);
        });

        // 11. Consumer pausé/resumé par le serveur (permissions)
        socket.on("consumer_paused", ({ consumerId }: { consumerId: string }) => {
          for (const [, consumer] of consumersRef.current) {
            if (consumer.id === consumerId) {
              consumer.pause();
              break;
            }
          }
        });

        socket.on("consumer_resumed", ({ consumerId }: { consumerId: string }) => {
          for (const [, consumer] of consumersRef.current) {
            if (consumer.id === consumerId) {
              consumer.resume();
              break;
            }
          }
        });

        // 12. Demander les producers existants
        socket.emit("get_producers", { roomCode: gameCode });
        socket.on("existing_producers", (producerIds: string[]) => {
          for (const id of producerIds) {
            consumeProducer(id);
          }
        });

        setIsConnected(true);

        // Identification post-setup (même logique que l'ancien code)
        const gs = gameSocketRef.current;
        if (gs?.id) {
          socket.emit("identify_game_socket", { gameSocketId: gs.id, roomCode: gameCode });
          gs.emit("register_voice_socket", { voiceSocketId: socket.id });
        }
      } catch (err) {
        console.error("[VoiceChat] Erreur setup mediasoup:", err);
      }
    };

    setupMediasoup();

    return () => {
      // Cleanup
      producerRef.current?.close();
      for (const [, consumer] of consumersRef.current) {
        consumer.close();
      }
      consumersRef.current.clear();
      sendTransportRef.current?.close();
      recvTransportRef.current?.close();
      socket.disconnect();
      if (localStream) {
        localStream.getTracks().forEach((track) => track.stop());
      }
      if (audioContextRef.current) {
        audioContextRef.current.close();
        audioContextRef.current = null;
      }
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [gameCode]);

  // Fallback: quand gameSocket arrive après la connexion voice
  useEffect(() => {
    if (!gameSocket) return;
    const voiceSocket = socketRef.current;
    if (!voiceSocket || !voiceSocket.connected) return;

    gameSocket.emit("register_voice_socket", { voiceSocketId: voiceSocket.id });
    voiceSocket.emit("identify_game_socket", { gameSocketId: gameSocket.id, roomCode: gameCode });

    const handleGameReconnect = () => {
      const vs = socketRef.current;
      if (vs?.connected && gameSocket.id) {
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
  useEffect(() => {
    if (!gameSocket) return;

    const handleReregister = () => {
      const voiceSocket = socketRef.current;
      if (voiceSocket?.connected && gameSocket.id) {
        gameSocket.emit("register_voice_socket", { voiceSocketId: voiceSocket.id });
        voiceSocket.emit("identify_game_socket", { gameSocketId: gameSocket.id, roomCode: gameCode });
      }
    };

    gameSocket.on("request_voice_reregister", handleReregister);
    return () => {
      gameSocket.off("request_voice_reregister", handleReregister);
    };
  }, [gameSocket, gameCode]);

  // Reprendre l'AudioContext quand le tab redevient visible
  useEffect(() => {
    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        if (audioContextRef.current?.state === "suspended") {
          audioContextRef.current.resume();
        }
        Object.values(audioElementsRef.current).forEach((el) => {
          if (el.paused) el.play().catch(() => {});
        });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, []);

  // Créer des analyseurs pour les nouveaux streams distants
  useEffect(() => {
    Object.entries(remoteStreams).forEach(([peerId, stream]) => {
      if (stream && !remoteAnalysersRef.current[peerId]) {
        const analyser = setupAudioAnalyser(stream);
        if (analyser) {
          remoteAnalysersRef.current[peerId] = analyser;
        }
      }
    });
    // Nettoyer les analyseurs pour les streams supprimés
    for (const peerId of Object.keys(remoteAnalysersRef.current)) {
      if (!remoteStreams[peerId]) {
        delete remoteAnalysersRef.current[peerId];
      }
    }
  }, [remoteStreams, setupAudioAnalyser]);

  // Vérification des niveaux audio (détection de parole)
  useEffect(() => {
    speakingCheckIntervalRef.current = setInterval(() => {
      if (localAnalyserRef.current && !isMuted) {
        checkAudioLevel(localAnalyserRef.current, "local");
      }
      Object.entries(remoteAnalysersRef.current).forEach(([peerId, analyser]) => {
        checkAudioLevel(analyser, peerId);
      });
    }, 300);

    return () => {
      if (speakingCheckIntervalRef.current) {
        clearInterval(speakingCheckIntervalRef.current);
      }
    };
  }, [isMuted, checkAudioLevel]);

  // Écouter les permissions vocales depuis le socket de jeu
  useEffect(() => {
    if (!gameSocket) return;

    const handlePermissions = (perms: {
      canSpeak: boolean;
      canHearIds?: string[] | null;
      narratorVoiceId?: string | null;
    }) => {
      console.log(`[VoiceChat] voice_permissions reçu:`, {
        canSpeak: perms.canSpeak,
        canHearIds: perms.canHearIds === null ? "ALL" : perms.canHearIds,
        narratorVoiceId: perms.narratorVoiceId || "NOT SET",
      });
      setVoicePermissions(perms);

      // Contrôle local du micro (le serveur enforce aussi via producer pause/resume)
      if (localStreamRef.current) {
        const audioTrack = localStreamRef.current.getAudioTracks()[0];
        if (audioTrack) {
          if (isNarrator) {
            audioTrack.enabled = !isMuted;
          } else {
            audioTrack.enabled = perms.canSpeak && isPTTActive;
          }
        }
      }

      // Muter/demuter côté client en backup (le serveur gère les consumers)
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

  const getStatusText = () => {
    if (!isConnected) return "Connexion...";
    if (isNarrator) {
      return isMuted ? "Micro coupé" : "Micro actif";
    }
    if (!voicePermissions || !voicePermissions.canSpeak) {
      return "Parole desactivee";
    }
    if (isPTTActive) return "Vous parlez...";
    return "Maintenez pour parler";
  };

  return (
    <div className="voice-chat-container">
      {/* Audio elements cachés pour les streams distants */}
      {Object.entries(remoteStreams).map(
        ([producerVoiceSocketId, stream]) =>
          stream && (
            <audio
              key={producerVoiceSocketId}
              ref={(el) => {
                if (el) {
                  audioElementsRef.current[producerVoiceSocketId] = el;

                  // Appliquer les permissions
                  let shouldBeMuted = true;
                  if (isNarrator) {
                    shouldBeMuted = false;
                  } else if (voicePermissions) {
                    if (
                      voicePermissions.canHearIds === null ||
                      voicePermissions.canHearIds === undefined
                    ) {
                      shouldBeMuted = false;
                    } else {
                      shouldBeMuted = !voicePermissions.canHearIds.includes(producerVoiceSocketId);
                    }
                  }
                  el.muted = shouldBeMuted;
                  el.volume = shouldBeMuted ? 0 : 1.0;

                  if (el.srcObject !== stream) {
                    el.srcObject = stream;
                  }

                  if (el.paused) {
                    el.play().catch((e) => {
                      console.warn(`[VoiceChat] Autoplay bloqué pour ${producerVoiceSocketId}:`, e);
                      const resume = () => {
                        el.play().catch(() => {});
                        document.removeEventListener("click", resume);
                      };
                      document.addEventListener("click", resume, { once: true });
                    });
                  }
                } else if (audioElementsRef.current[producerVoiceSocketId]) {
                  delete audioElementsRef.current[producerVoiceSocketId];
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
          <span className="text-sm text-gray-300">{getStatusText()}</span>
        </div>
      )}
    </div>
  );
};

export default VoiceChat;
