"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useParams } from "next/navigation";
import { io, Socket } from "socket.io-client";
import PlayerCircle from "@/components/PlayerCircle";
import SpectatorList from "@/components/SpectatorList";
import VoiceChat from "@/components/VoiceChat";
import VoiceChatManager from "@/components/VoiceChatManager";
import Chat from "@/components/Chat";

// Styles globaux pour les effets spéciaux
const globalStyles = `
  .halloween-bg-day {
    background-image:
      radial-gradient(circle at 100% 100%, rgba(255,0,0,0.1) 0%, rgba(0,0,0,0) 20%),
      linear-gradient(45deg, rgba(0,0,0,0.8), rgba(70,0,0,0.8)),
      url('/background.avif');
    background-size: cover;
    background-blend-mode: multiply;
  }

  .halloween-bg-night {
    background-image:
      radial-gradient(circle at 100% 100%, rgba(0,0,100,0.2) 0%, rgba(0,0,0,0) 20%),
      linear-gradient(45deg, rgba(0,0,20,0.9), rgba(20,0,40,0.9)),
      url('/background.avif');
    background-size: cover;
    background-blend-mode: multiply;
    filter: brightness(0.7);
  }

  .mirror-effect {
    transform: perspective(1000px) rotateX(5deg) scale(0.98);
    box-shadow: 0 0 30px rgba(255,0,0,0.3);
    position: relative;
    overflow: hidden;
  }

  .mirror-effect::after {
    content: '';
    position: absolute;
    top: 100%;
    left: 0;
    right: 0;
    height: 50%;
    background: linear-gradient(to bottom, rgba(255,255,255,0.05) 0%, rgba(0,0,0,0.3) 100%);
    transform: rotateX(180deg) translateY(100%);
    pointer-events: none;
  }

  @media (max-width: 1024px) {
    .responsive-flex {
      flex-direction: column;
      align-items: center;
    }
  }

  @keyframes fade-in {
    from { opacity: 0; transform: scale(0.9); }
    to { opacity: 1; transform: scale(1); }
  }

  .animate-fade-in {
    animation: fade-in 0.5s ease-out forwards;
  }
`;

interface Player {
  id: string;
  name: string;
  role?: string;
  canSpeak: boolean;
  isEliminated?: boolean;
}

const GamePage = () => {
  const params = useParams();
  const gameCode = Array.isArray(params?.id) ? params.id[0] : params?.id ?? "";
  const [socket, setSocket] = useState<Socket | null>(null);
  const [currentUserName, setCurrentUserName] = useState<string>("");
  const [isSpectator, setIsSpectator] = useState<boolean>(false);
  const [players, setPlayers] = useState<Player[]>([]);
  const [spectators, setSpectators] = useState<Player[]>([]);
  const [gameStatus, setGameStatus] = useState<"in_progress" | "paused" | "stopped">("in_progress");
  const [isDay, setIsDay] = useState<boolean>(true);
  const [speakingPlayers, setSpeakingPlayers] = useState<Record<string, boolean>>({});
  const [isMuted, setIsMuted] = useState(false);
  const [gameRole, setGameRole] = useState<string | null>(null);
  const [gameRoleDescription, setGameRoleDescription] = useState<string>("");
  const [showRoleReveal, setShowRoleReveal] = useState(false);

  // Callback pour mettre à jour l'état de parole
  const handleSpeakingChange = useCallback((peerId: string, isSpeaking: boolean) => {
    setSpeakingPlayers((prev) => {
      if (prev[peerId] === isSpeaking) return prev;
      return { ...prev, [peerId]: isSpeaking };
    });
  }, []);

  // Callback pour le changement de mute
  const handleMuteChange = useCallback((muted: boolean) => {
    setIsMuted(muted);
  }, []);

  useEffect(() => {
    const newSocket = io(process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5000");
    setSocket(newSocket);

    // Récupérer le rôle et le nom depuis localStorage
    const savedRole = localStorage.getItem("userRole");
    const savedName = localStorage.getItem("userName");

    if (savedRole) {
      setIsSpectator(savedRole === "spectator");
    }
    if (savedName) {
      setCurrentUserName(savedName);
    }

    // Récupérer le token et enregistrer l'utilisateur
    const token = localStorage.getItem("token");
    if (token) {
      try {
        const payload = JSON.parse(atob(token.split(".")[1]));
        if (payload.id || payload.userId) {
          newSocket.emit("register_user", {
            userId: payload.id || payload.userId,
            role: savedRole || "player"
          });
        }
      } catch {
        console.log("Token non-JWT, utilisation du socket.id");
      }
    }

    // Définir le rôle avant de rejoindre
    if (savedRole) {
      newSocket.emit("set_role", { role: savedRole });
    }

    if (gameCode) {
      newSocket.emit("join_room", gameCode);
    }

    newSocket.on("player_list", (playerList: Player[]) => {
      const playersList = playerList.filter((p) => p.role !== "spectator");
      const spectatorsList = playerList.filter((p) => p.role === "spectator");
      setPlayers(playersList);
      setSpectators(spectatorsList);

      // Déterminer si l'utilisateur actuel est un spectateur
      if (newSocket.id) {
        const isCurrentUserSpectator = spectatorsList.some((s) => s.id === newSocket.id);
        const currentPlayer = playersList.find((p) => p.id === newSocket.id);
        const currentSpectator = spectatorsList.find((s) => s.id === newSocket.id);

        setIsSpectator(isCurrentUserSpectator);
        setCurrentUserName(
          currentPlayer?.name || currentSpectator?.name || `Utilisateur ${newSocket.id.slice(0, 4)}`
        );
      }
    });

    newSocket.on("user_joined", ({ userId, role, name }: { userId: string; role?: string; name?: string }) => {
      const userName = name || `Joueur ${userId.slice(0, 4)}`;
      const newUser = { id: userId, name: userName, role, canSpeak: role !== "spectator" };

      if (role === "spectator") {
        setSpectators((prev) => (prev.some((s) => s.id === userId) ? prev : [...prev, newUser]));
      } else {
        setPlayers((prev) => (prev.some((p) => p.id === userId) ? prev : [...prev, newUser]));
      }

      // Vérifier si c'est l'utilisateur actuel
      if (userId === newSocket.id) {
        setIsSpectator(role === "spectator");
        setCurrentUserName(userName);
      }
    });

    newSocket.on("user_left", ({ userId }: { userId: string }) => {
      setPlayers((prev) => prev.filter((p) => p.id !== userId));
      setSpectators((prev) => prev.filter((s) => s.id !== userId));
      setSpeakingPlayers((prev) => {
        const newState = { ...prev };
        delete newState[userId];
        return newState;
      });
    });

    newSocket.on("game_status", (status: "in_progress" | "paused" | "stopped") => {
      setGameStatus(status);
    });

    newSocket.on("day_night_updated", ({ isDay }: { isDay: boolean }) => {
      setIsDay(isDay);
    });

    newSocket.on("voice_updated", ({ playerId, canSpeak }: { playerId: string; canSpeak: boolean }) => {
      setPlayers((prev) => prev.map((p) => (p.id === playerId ? { ...p, canSpeak } : p)));
    });

    newSocket.on("player_eliminated", ({ playerId }: { playerId: string }) => {
      setPlayers((prev) =>
        prev.map((p) => (p.id === playerId ? { ...p, isEliminated: true } : p))
      );
    });

    // Écouter l'assignation de rôle pour savoir si spectateur
    newSocket.on("role_assigned", ({ role }: { role: string }) => {
      setIsSpectator(role === "spectator");
    });

    // Écouter l'assignation du rôle de jeu (loup-garou, villageois, etc.)
    newSocket.on("game_role_assigned", ({ gameRole, roleDescription }: { gameRole: string; roleDescription: string }) => {
      console.log("Rôle de jeu reçu:", gameRole);
      setGameRole(gameRole);
      setGameRoleDescription(roleDescription || "");
      setShowRoleReveal(true);
      // Masquer l'animation après 5 secondes
      setTimeout(() => setShowRoleReveal(false), 5000);
    });

    // Écouter le démarrage de la partie
    newSocket.on("game_started", () => {
      setGameStatus("in_progress");
    });

    return () => {
      newSocket.disconnect();
    };
  }, [gameCode]);

  const themeClass = isDay ? "halloween-bg-day" : "halloween-bg-night";

  return (
    <>
      <style>{globalStyles}</style>

      {/* Animation de révélation du rôle */}
      {showRoleReveal && gameRole && (
        <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/90 backdrop-blur-sm animate-fade-in">
          <div className="text-center space-y-6 p-8">
            <div className="text-6xl animate-bounce">
              {gameRole.toLowerCase().includes("loup") ? "🐺" :
               gameRole.toLowerCase().includes("sorcière") ? "🧙‍♀️" :
               gameRole.toLowerCase().includes("voyante") ? "🔮" :
               gameRole.toLowerCase().includes("chasseur") ? "🏹" :
               gameRole.toLowerCase().includes("cupidon") ? "💘" :
               "👤"}
            </div>
            <h2 className="text-4xl font-bold text-white">Votre Rôle</h2>
            <div className={`text-5xl font-bold ${
              gameRole.toLowerCase().includes("loup")
                ? "text-red-500"
                : gameRole.toLowerCase().includes("sorcière") || gameRole.toLowerCase().includes("voyante")
                ? "text-purple-400"
                : "text-green-400"
            }`}>
              {gameRole}
            </div>
            {gameRoleDescription && (
              <p className="text-lg text-gray-300 max-w-md mx-auto">
                {gameRoleDescription}
              </p>
            )}
            <p className="text-sm text-gray-500 animate-pulse">
              Cette information disparaîtra dans quelques secondes...
            </p>
          </div>
        </div>
      )}

      <div className={`min-h-screen text-white p-4 md:p-6 transition-all duration-500 ${themeClass}`}>
        <div className="max-w-7xl mx-auto flex flex-col gap-6">
          {/* En-tête avec informations de la partie */}
          <div className="flex flex-wrap items-center justify-between gap-4">
            {/* Indicateur Jour/Nuit et Statut (LECTURE SEULE) */}
            <div className="flex items-center gap-4">
              {/* Phase Jour/Nuit */}
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${
                isDay
                  ? "bg-amber-900/40 border-amber-500/50"
                  : "bg-indigo-900/40 border-indigo-500/50"
              }`}>
                <span className="text-2xl">{isDay ? "☀️" : "🌙"}</span>
                <span className={isDay ? "text-amber-300" : "text-indigo-300"}>
                  {isDay ? "Jour" : "Nuit"}
                </span>
              </div>

              {/* Statut de la partie */}
              <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${
                gameStatus === "in_progress"
                  ? "bg-green-900/40 border-green-500/50"
                  : gameStatus === "paused"
                  ? "bg-yellow-900/40 border-yellow-500/50"
                  : "bg-red-900/40 border-red-500/50"
              }`}>
                <span className={`w-2 h-2 rounded-full ${
                  gameStatus === "in_progress"
                    ? "bg-green-500 animate-pulse"
                    : gameStatus === "paused"
                    ? "bg-yellow-500"
                    : "bg-red-500"
                }`} />
                <span className={
                  gameStatus === "in_progress"
                    ? "text-green-300"
                    : gameStatus === "paused"
                    ? "text-yellow-300"
                    : "text-red-300"
                }>
                  {gameStatus === "in_progress"
                    ? "En cours"
                    : gameStatus === "paused"
                    ? "En pause"
                    : "Arrêtée"}
                </span>
              </div>
            </div>

            {/* Indicateur de rôle */}
            <div className="flex items-center gap-3">
              <div className="flex items-center gap-2 bg-black/50 px-4 py-2 rounded-full border border-gray-700">
                <span
                  className={`w-3 h-3 rounded-full ${isSpectator ? "bg-purple-500" : "bg-green-500"}`}
                />
                <span className="text-sm">
                  {isSpectator ? "Spectateur" : "Joueur"} - {currentUserName}
                </span>
              </div>
              {/* Badge du rôle de jeu */}
              {gameRole && !isSpectator && (
                <div className={`px-4 py-2 rounded-full border-2 font-bold text-sm ${
                  gameRole.toLowerCase().includes("loup")
                    ? "bg-red-900/60 border-red-500 text-red-200"
                    : gameRole.toLowerCase().includes("sorcière") || gameRole.toLowerCase().includes("voyante")
                    ? "bg-purple-900/60 border-purple-500 text-purple-200"
                    : "bg-green-900/60 border-green-500 text-green-200"
                }`}>
                  🎭 {gameRole}
                </div>
              )}
            </div>

            {/* Contrôles audio - UNIQUEMENT pour les joueurs */}
            {!isSpectator && (
              <div className="flex items-center gap-3 bg-black/50 p-3 rounded-xl border border-gray-700">
                <VoiceChat
                  gameCode={gameCode}
                  showControls={true}
                  onSpeakingChange={handleSpeakingChange}
                  onMuteChange={handleMuteChange}
                />
              </div>
            )}
          </div>

          {/* Zone de jeu principale */}
          <div className="flex justify-center gap-6 responsive-flex">
            {/* Cercle des joueurs - PLEIN ÉCRAN pour les joueurs */}
            <div
              className={`mirror-effect bg-black/40 p-6 rounded-2xl border-2 border-red-600/50 backdrop-blur-sm ${
                !isSpectator ? "flex-1 max-w-4xl" : ""
              }`}
            >
              <div className="flex items-center justify-between mb-4">
                <h2 className="text-xl font-bold text-red-400">Table de jeu</h2>
                {/* Compteur spectateurs pour les joueurs */}
                {!isSpectator && spectators.length > 0 && (
                  <div className="flex items-center gap-2 bg-purple-900/30 px-3 py-1 rounded-full">
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      className="h-4 w-4 text-purple-400"
                      fill="none"
                      viewBox="0 0 24 24"
                      stroke="currentColor"
                    >
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M15 12a3 3 0 11-6 0 3 3 0 016 0z"
                      />
                      <path
                        strokeLinecap="round"
                        strokeLinejoin="round"
                        strokeWidth={2}
                        d="M2.458 12C3.732 7.943 7.523 5 12 5c4.478 0 8.268 2.943 9.542 7-1.274 4.057-5.064 7-9.542 7-4.477 0-8.268-2.943-9.542-7z"
                      />
                    </svg>
                    <span className="text-sm text-purple-300">
                      {spectators.length} spectateur{spectators.length > 1 ? "s" : ""}
                    </span>
                  </div>
                )}
              </div>
              <PlayerCircle
                isDay={isDay}
                players={players}
                speakingPlayers={speakingPlayers}
              />
            </div>

            {/* Colonne droite : UNIQUEMENT pour les spectateurs */}
            {isSpectator && (
              <div className="flex flex-col gap-4 w-80">
                {/* Liste des spectateurs */}
                <div className="mirror-effect bg-black/40 p-6 rounded-2xl border-2 border-purple-600/50 backdrop-blur-sm">
                  <SpectatorList spectators={spectators} />
                </div>

                {/* Chat pour les spectateurs */}
                {socket && (
                  <Chat
                    socket={socket}
                    gameCode={gameCode}
                    userName={currentUserName}
                  />
                )}
              </div>
            )}
          </div>

          {/* Gestionnaire de permissions voix (invisible) - UNIQUEMENT pour les joueurs */}
          {!isSpectator && (
            <VoiceChatManager
              socket={socket}
              gameCode={gameCode}
              players={players}
              gameStatus={gameStatus}
            />
          )}

          {/* Indicateur de statut en bas */}
          <div className="text-center text-sm text-gray-400">
            <span className="px-3 py-1 bg-black/50 rounded-full">
              Partie: <span className="text-red-400 font-mono">{gameCode}</span>
              {!isSpectator && (
                <>
                  {" | "}
                  Micro: <span className={isMuted ? "text-red-400" : "text-green-400"}>
                    {isMuted ? "Coupé" : "Actif"}
                  </span>
                </>
              )}
              {isSpectator && (
                <>
                  {" | "}
                  <span className="text-purple-400">Mode spectateur (chat uniquement)</span>
                </>
              )}
            </span>
          </div>
        </div>
      </div>
    </>
  );
};

export default GamePage;
