"use client";
import React, { useState, useEffect, useCallback } from "react";
import { useParams, useRouter } from "next/navigation";
import { io, Socket } from "socket.io-client";
import PlayerCircle from "@/components/PlayerCircle";
import SpectatorList from "@/components/SpectatorList";
import VoiceChat from "@/components/VoiceChat";
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
    transform: perspective(1000px) rotateX(3deg) scale(0.99);
    box-shadow: 0 0 30px rgba(255,0,0,0.3);
    position: relative;
    overflow: visible;
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

interface VoteResults {
  counts: Record<string, number>;
  votes: Record<string, string>;
  eliminated: string | null;
  eliminatedOdUserId: string | null;
  isTie: boolean;
  totalVotes: number;
}

const GamePage = () => {
  const params = useParams();
  const router = useRouter();
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

  // Vote states
  const [voteActive, setVoteActive] = useState(false);
  const [voteDeadline, setVoteDeadline] = useState<number | null>(null);
  const [voteTimeLeft, setVoteTimeLeft] = useState(0);
  const [myVote, setMyVote] = useState<string | null>(null);
  const [voteTotalCount, setVoteTotalCount] = useState(0);
  const [voteResults, setVoteResults] = useState<VoteResults | null>(null);
  const [showVoteResults, setShowVoteResults] = useState(false);

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
    const newSocket = io(process.env.NEXT_PUBLIC_BACKEND_URL || "http://localhost:5001");
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

    // Fonction pour (re)initialiser le socket auprès du serveur
    // Appelée à la première connexion ET à chaque reconnexion
    const setupSocket = () => {
      const role = localStorage.getItem("userRole");
      const name = localStorage.getItem("userName");

      if (role) {
        newSocket.emit("set_role", { role });
      }

      const tkn = localStorage.getItem("token");
      if (tkn) {
        try {
          const payload = JSON.parse(atob(tkn.split(".")[1]));
          if (payload.id || payload.userId) {
            newSocket.emit("register_user", {
              userId: payload.id || payload.userId,
              role: role || "player",
              name: name || undefined,
            });
          }
        } catch {
          // Token non-JWT
        }
      }

      if (gameCode) {
        // Petit délai pour que register_user soit traité avant join_room
        setTimeout(() => newSocket.emit("join_room", gameCode), 50);
      }
    };

    // Se reconnecter automatiquement quand le socket (re)connecte
    newSocket.on("connect", () => {
      console.log("[GAME] Socket connecté/reconnecté:", newSocket.id);
      setupSocket();
    });

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

    // ── Vote events ──
    newSocket.on("vote_started", ({ deadline }: { duration: number; deadline: number }) => {
      setVoteActive(true);
      setVoteDeadline(deadline);
      setMyVote(null);
      setVoteTotalCount(0);
      setVoteResults(null);
      setShowVoteResults(false);
    });

    newSocket.on("vote_received", ({ totalVotes }: { voterId: string; voterName: string; totalVotes: number }) => {
      setVoteTotalCount(totalVotes);
    });

    newSocket.on("vote_ended", (results: VoteResults) => {
      setVoteActive(false);
      setVoteDeadline(null);
      setVoteResults(results);
      setShowVoteResults(true);
    });

    newSocket.on("votes_reset", () => {
      setVoteActive(false);
      setVoteDeadline(null);
      setMyVote(null);
      setVoteTotalCount(0);
      setVoteResults(null);
      setShowVoteResults(false);
    });

    // Rediriger vers l'accueil quand la partie est terminée
    newSocket.on("game_ended", () => {
      router.push("/");
    });

    return () => {
      newSocket.off("connect");
      newSocket.disconnect();
    };
  }, [gameCode, router]);

  // Timer du vote
  useEffect(() => {
    if (!voteActive || !voteDeadline) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((voteDeadline - Date.now()) / 1000));
      setVoteTimeLeft(remaining);
      if (remaining <= 0) {
        clearInterval(interval);
      }
    }, 250);
    return () => clearInterval(interval);
  }, [voteActive, voteDeadline]);

  // Resync quand le tab redevient visible (apres background)
  useEffect(() => {
    if (!socket || !gameCode) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Resync le timer de vote immediatement
        if (voteDeadline) {
          const remaining = Math.max(0, Math.ceil((voteDeadline - Date.now()) / 1000));
          setVoteTimeLeft(remaining);
        }
        // Redemander la liste des joueurs pour resync l'etat
        socket.emit("join_room", gameCode);
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [socket, gameCode, voteDeadline]);

  // Soumettre un vote
  const submitVote = (targetId: string) => {
    if (!socket || !voteActive || myVote) return;
    socket.emit("submit_vote", { roomCode: gameCode, targetId });
    setMyVote(targetId);
  };

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
                  gameSocket={socket}
                />
              </div>
            )}
          </div>

          {/* Zone de jeu principale */}
          <div className="flex justify-center gap-6 responsive-flex">
            {/* Cercle des joueurs - PLEIN ÉCRAN pour les joueurs */}
            <div
              className={`mirror-effect bg-black/40 p-4 md:p-6 rounded-2xl border-2 border-red-600/50 backdrop-blur-sm ${
                !isSpectator ? "flex-1 max-w-4xl w-full" : "w-full max-w-3xl"
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
                currentSocketId={socket?.id}
              />

              {/* ── Panel de vote pour les joueurs (pas les éliminés ni les spectateurs) ── */}
              {!isSpectator && !players.find(p => p.id === socket?.id)?.isEliminated && (voteActive || showVoteResults) && (
                <div className="mt-4 p-4 rounded-xl bg-black/60 border border-amber-600/40 backdrop-blur-sm">
                  {/* Vote en cours */}
                  {voteActive && (
                    <>
                      <div className="flex items-center justify-between mb-3">
                        <h3 className="text-lg font-bold text-amber-400 flex items-center gap-2">
                          🗳️ Vote en cours
                        </h3>
                        <div className="flex items-center gap-3">
                          <span className="text-sm text-gray-400">{voteTotalCount} vote(s)</span>
                          <span className={`text-sm font-mono font-bold px-3 py-1 rounded-full ${
                            voteTimeLeft <= 10 ? "bg-red-900/60 text-red-300 animate-pulse" : "bg-gray-800 text-gray-300"
                          }`}>
                            ⏱ {voteTimeLeft}s
                          </span>
                        </div>
                      </div>
                      {myVote ? (
                        <div className="text-center py-4">
                          <p className="text-green-400 font-semibold">✅ Votre vote a été enregistré</p>
                          <p className="text-gray-500 text-sm mt-1">
                            Vous avez voté pour {players.find(p => p.id === myVote)?.name || "???"}
                          </p>
                        </div>
                      ) : (
                        <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-2">
                          {players
                            .filter(p => !p.isEliminated && p.id !== socket?.id)
                            .map(player => (
                              <button
                                key={player.id}
                                onClick={() => submitVote(player.id)}
                                className="flex items-center gap-2 p-3 rounded-lg bg-gray-800/80 border border-gray-600 hover:border-red-500 hover:bg-red-900/30 transition-all text-left group"
                              >
                                <span className="w-8 h-8 rounded-full bg-gradient-to-br from-red-500 to-orange-600 flex items-center justify-center text-white text-xs font-bold flex-shrink-0">
                                  {player.name.slice(0, 2).toUpperCase()}
                                </span>
                                <span className="text-sm text-gray-200 truncate group-hover:text-red-300">
                                  {player.name}
                                </span>
                              </button>
                            ))}
                        </div>
                      )}
                    </>
                  )}

                  {/* Résultats du vote */}
                  {showVoteResults && voteResults && (
                    <div>
                      <h3 className="text-lg font-bold text-amber-400 mb-3 flex items-center gap-2">
                        📊 Résultats du vote
                      </h3>
                      {voteResults.isTie ? (
                        <p className="text-yellow-400 text-center py-2 font-semibold">⚖️ Égalité ! Le narrateur décidera.</p>
                      ) : voteResults.eliminated ? (
                        <p className="text-red-400 text-center py-2 font-semibold">
                          💀 {players.find(p => p.id === voteResults.eliminated)?.name || "???"} est désigné pour l&apos;élimination
                        </p>
                      ) : (
                        <p className="text-gray-400 text-center py-2">Aucun vote enregistré.</p>
                      )}
                      <div className="mt-2 space-y-1">
                        {Object.entries(voteResults.counts)
                          .sort(([, a], [, b]) => b - a)
                          .map(([targetId, count]) => {
                            const maxCount = Math.max(...Object.values(voteResults.counts));
                            const pct = maxCount > 0 ? (count / voteResults.totalVotes) * 100 : 0;
                            return (
                              <div key={targetId} className="flex items-center gap-2">
                                <span className="text-sm text-gray-300 w-24 truncate">
                                  {players.find(p => p.id === targetId)?.name || "???"}
                                </span>
                                <div className="flex-1 h-5 bg-gray-800 rounded-full overflow-hidden">
                                  <div
                                    className={`h-full rounded-full transition-all ${
                                      count === maxCount ? "bg-red-500" : "bg-gray-600"
                                    }`}
                                    style={{ width: `${pct}%` }}
                                  />
                                </div>
                                <span className="text-sm text-gray-400 w-8 text-right">{count}</span>
                              </div>
                            );
                          })}
                      </div>
                    </div>
                  )}
                </div>
              )}
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
