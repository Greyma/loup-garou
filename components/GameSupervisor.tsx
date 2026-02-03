"use client";
import React, { useState, useEffect } from "react";
import { motion } from "framer-motion";
import { Socket } from "socket.io-client";

// Styles globaux pour les effets spéciaux
const globalStyles = `
  .halloween-bg {
    background-image: 
      radial-gradient(circle at 100% 100%, rgba(255,0,0,0.1) 0%, rgba(0,0,0,0) 20%),
      linear-gradient(45deg, rgba(0,0,0,0.8), rgba(70,0,0,0.8)),
      url('background.avif'); /* Remplacez par votre image */
    background-size: cover;
    background-blend-mode: multiply;
  }

  .mirror-effect {
    transform: perspective(1000px) rotateX(10deg) scale(0.95);
    box-shadow: 0 0 20px rgba(255,0,0,0.4);
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
    background: linear-gradient(to bottom, rgba(255,255,255,0.1) 0%, rgba(0,0,0,0.5) 100%);
    transform: rotateX(180deg) translateY(100%);
    pointer-events: none; /* Empêche les interactions */
  }
`;

const buttonVariants = {
  hover: { scale: 1.05, boxShadow: "0 0 10px rgba(255, 0, 0, 0.5)" },
  tap: { scale: 0.95 },
};

interface Player {
  id: string;
  odUserId?: string | null;
  name: string;
  role: string;
  gameRole?: string | null;
  canSpeak: boolean;
  isEliminated: boolean;
}

interface GameSupervisorProps {
  socket: Socket | null;
  gameCode: string;
}

const GameSupervisor: React.FC<GameSupervisorProps> = ({ socket, gameCode }) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameStatus, setGameStatus] = useState<"in_progress" | "waiting" | "finished">("waiting");
  const [isDay, setIsDay] = useState<boolean>(true);
  const [votes, setVotes] = useState<Record<string, string>>({});
  const [audioByRole, setAudioByRole] = useState<Record<string, boolean>>({});
  const [isGameStarted, setIsGameStarted] = useState(false);

  useEffect(() => {
    if (!socket) return;

    // Récupérer les joueurs au chargement
    socket.emit("get_players", gameCode);
    socket.on("player_list", (playerList: Player[]) => {
      setPlayers(playerList.map((p) => ({ ...p, canSpeak: false, isEliminated: p.isEliminated || false })));
    });

    socket.on("voice_updated", ({ playerId, canSpeak }) => {
      setPlayers((prev) =>
        prev.map((p) => (p.id === playerId ? { ...p, canSpeak } : p))
      );
    });

    socket.on("audio_updated_by_role", ({ roleName, canListen }) => {
      setAudioByRole((prev) => ({ ...prev, [roleName]: canListen }));
    });

    socket.on("day_night_updated", ({ isDay: newIsDay }) => {
      setIsDay(newIsDay);
    });

    socket.on("vote_received", ({ voterId, targetId }) => {
      setVotes((prev) => ({ ...prev, [voterId]: targetId }));
    });

    socket.on("game_started", () => {
      setIsGameStarted(true);
      setGameStatus("in_progress");
      // Rafraîchir la liste des joueurs
      socket.emit("refresh_players", { roomCode: gameCode });
    });

    socket.on("player_eliminated", ({ playerId }: { playerId: string }) => {
      setPlayers((prev) => prev.map((p) => (p.id === playerId ? { ...p, isEliminated: true } : p)));
    });

    return () => {
      socket.off("player_list");
      socket.off("voice_updated");
      socket.off("audio_updated_by_role");
      socket.off("day_night_updated");
      socket.off("vote_received");
      socket.off("game_started");
      socket.off("player_eliminated");
    };
  }, [socket, gameCode]);

  // Démarrer la partie et distribuer les rôles
  const startGame = () => {
    if (socket) {
      socket.emit("start_game", { roomCode: gameCode });
      setIsGameStarted(true);
      setGameStatus("in_progress");
      // Rafraîchir la liste des joueurs après le démarrage
      setTimeout(() => {
        socket.emit("refresh_players", { roomCode: gameCode });
      }, 500);
    }
  };

  const updateGameStatus = async (status: "waiting" | "in_progress" | "finished") => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/game/${gameCode}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Erreur lors de la mise à jour du statut");
      setGameStatus(status);
      // Synchroniser le statut via socket
      if (socket) {
        const socketStatus = status === "finished" ? "stopped" : status === "waiting" ? "paused" : "in_progress";
        socket.emit("update_game_status", { roomCode: gameCode, status: socketStatus });
      }
    } catch (err) {
      if (err instanceof Error) {
        alert("Erreur : " + err.message);
      } else {
        alert("Erreur inconnue");
      }
    }
  };

  const toggleVoice = (playerId: string, canSpeak: boolean) => {
    if (socket) socket.emit("toggle_voice", { roomCode: gameCode, playerId, canSpeak });
  };

  const toggleAudioByRole = (roleName: string, canListen: boolean) => {
    if (socket) socket.emit("toggle_audio_by_role", { roomCode: gameCode, roleName, canListen });
    setAudioByRole((prev) => ({ ...prev, [roleName]: canListen }));
  };

  const setDayNight = (isDay: boolean) => {
    if (socket) socket.emit("set_day_night", { roomCode: gameCode, isDay });
    setIsDay(isDay);
  };

  const eliminatePlayer = (playerId: string, odUserId?: string | null) => {
    if (socket) {
      // Envoyer l'élimination via socket avec odUserId (MongoDB _id)
      socket.emit("eliminate_player", {
        roomCode: gameCode,
        playerId,
        odUserId: odUserId || null
      });
      // Mise à jour locale immédiate
      setPlayers((prev) => prev.map((p) => (p.id === playerId ? { ...p, isEliminated: true } : p)));
    }
  };

  const eliminateByVote = () => {
    const voteCounts = players.reduce((acc, player) => {
      acc[player.id] = Object.values(votes).filter((targetId) => targetId === player.id).length;
      return acc;
    }, {} as Record<string, number>);
    const eliminatedId = Object.entries(voteCounts).reduce((max, [id, count]) =>
      count > (voteCounts[max.id] || 0) ? { id, count } : max, { id: "", count: 0 }
    ).id;
    if (eliminatedId) {
      const eliminatedPlayer = players.find(p => p.id === eliminatedId);
      eliminatePlayer(eliminatedId, eliminatedPlayer?.odUserId);
    }
  };

  return (
    <>
      <style>{globalStyles}</style>
      <div className="min-h-screen halloween-bg text-white p-6">
        <motion.h2
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-3xl font-bold text-red-500 mb-6 text-center"
        >
          Supervision de la partie : {gameCode}
        </motion.h2>

        {/* Indicateur de statut */}
        <div className="mb-4 flex items-center justify-center gap-4">
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${
            gameStatus === "in_progress"
              ? "bg-green-900/40 border-green-500/50"
              : gameStatus === "waiting"
              ? "bg-yellow-900/40 border-yellow-500/50"
              : "bg-red-900/40 border-red-500/50"
          }`}>
            <span className={`w-3 h-3 rounded-full ${
              gameStatus === "in_progress"
                ? "bg-green-500 animate-pulse"
                : gameStatus === "waiting"
                ? "bg-yellow-500"
                : "bg-red-500"
            }`} />
            <span className="text-white">
              {gameStatus === "in_progress"
                ? "En cours"
                : gameStatus === "waiting"
                ? "En attente"
                : "Terminée"}
            </span>
          </div>
          <div className={`flex items-center gap-2 px-4 py-2 rounded-full border ${
            isDay ? "bg-amber-900/40 border-amber-500/50" : "bg-indigo-900/40 border-indigo-500/50"
          }`}>
            <span className="text-2xl">{isDay ? "☀️" : "🌙"}</span>
            <span className={isDay ? "text-amber-300" : "text-indigo-300"}>
              {isDay ? "Jour" : "Nuit"}
            </span>
          </div>
        </div>

        {/* Bouton Démarrer la partie - visible uniquement si pas encore démarrée */}
        {!isGameStarted && (
          <div className="mb-6 flex justify-center">
            <motion.button
              onClick={startGame}
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
              className="bg-gradient-to-r from-green-600 to-emerald-600 hover:from-green-500 hover:to-emerald-500 text-white px-8 py-4 rounded-xl text-xl font-bold shadow-lg transition-all"
            >
              🎮 Démarrer la Partie
            </motion.button>
          </div>
        )}

        {/* Contrôles de jeu - visible uniquement si partie démarrée */}
        {isGameStarted && (
          <div className="mb-6 flex gap-4 justify-center">
            <motion.button
              onClick={() => updateGameStatus("in_progress")}
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
              className="bg-green-600/60 hover:bg-green-700/80 text-white p-2 rounded-lg transition-all"
            >
              Reprendre
            </motion.button>
            <motion.button
              onClick={() => updateGameStatus("waiting")}
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
              className="bg-yellow-600/60 hover:bg-yellow-700/80 text-white p-2 rounded-lg transition-all"
            >
              Pause
            </motion.button>
            <motion.button
              onClick={() => updateGameStatus("finished")}
              variants={buttonVariants}
              whileHover="hover"
              whileTap="tap"
              className="bg-red-600/60 hover:bg-red-700/80 text-white p-2 rounded-lg transition-all"
            >
              Arrêter
            </motion.button>
          </div>
        )}

        <div className="mb-6 text-center">
          <motion.button
            onClick={() => setDayNight(true)}
            variants={buttonVariants}
            whileHover="hover"
            whileTap="tap"
            className={`p-2 rounded-lg ${isDay ? "bg-blue-600/60" : "bg-gray-600/60"} hover:bg-blue-700/80 transition-all`}
          >
            Jour
          </motion.button>
          <motion.button
            onClick={() => setDayNight(false)}
            variants={buttonVariants}
            whileHover="hover"
            whileTap="tap"
            className={`p-2 rounded-lg ml-4 ${!isDay ? "bg-gray-900/60" : "bg-gray-600/60"} hover:bg-gray-700/80 transition-all`}
          >
            Nuit
          </motion.button>
        </div>

        <div className="mb-6">
          <h3 className="text-2xl font-bold text-red-500 mb-4">Joueurs :</h3>
          <table className="w-full bg-black/50 rounded-lg border-2 border-red-600">
            <thead>
              <tr className="bg-red-800/60">
                <th className="p-3 text-left">Nom</th>
                <th className="p-3 text-left">Rôle</th>
                <th className="p-3 text-left">Parler</th>
                <th className="p-3 text-left">Éliminer</th>
              </tr>
            </thead>
            <tbody>
              {players.filter(p => p.role !== "spectator").map((player) => (
                <tr
                  key={player.id}
                  className={`border-t border-red-600/50 ${player.isEliminated ? "text-gray-500 line-through" : "text-red-200"}`}
                >
                  <td className="p-3">{player.name}</td>
                  <td className="p-3">
                    {player.gameRole ? (
                      <span className={`px-2 py-1 rounded-full text-sm font-bold ${
                        player.gameRole.toLowerCase().includes("loup")
                          ? "bg-red-900/60 text-red-200 border border-red-500"
                          : player.gameRole.toLowerCase().includes("sorcière") || player.gameRole.toLowerCase().includes("voyante")
                          ? "bg-purple-900/60 text-purple-200 border border-purple-500"
                          : "bg-green-900/60 text-green-200 border border-green-500"
                      }`}>
                        {player.gameRole}
                      </span>
                    ) : (
                      <span className="text-gray-500 italic">Non assigné</span>
                    )}
                  </td>
                  <td className="p-3">
                    <motion.button
                      onClick={() => toggleVoice(player.id, !player.canSpeak)}
                      variants={buttonVariants}
                      whileHover="hover"
                      whileTap="tap"
                      className={`p-2 rounded-lg ${player.canSpeak ? "bg-green-600/60" : "bg-red-600/60"} hover:bg-green-700/80 transition-all`}
                      disabled={player.isEliminated}
                    >
                      {player.canSpeak ? "🎤 Oui" : "🔇 Non"}
                    </motion.button>
                  </td>
                  <td className="p-3">
                    {!player.isEliminated ? (
                      <motion.button
                        onClick={() => eliminatePlayer(player.id, player.odUserId)}
                        variants={buttonVariants}
                        whileHover="hover"
                        whileTap="tap"
                        className="bg-red-600/60 hover:bg-red-700/80 text-white p-2 rounded-lg transition-all"
                      >
                        ☠️ Éliminer
                      </motion.button>
                    ) : (
                      <span className="text-gray-500">Éliminé</span>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {isGameStarted && (
          <div className="mb-6">
            <h3 className="text-2xl font-bold text-red-500 mb-4">🔊 Audio par rôle :</h3>
            <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
              {Array.from(new Set(players.filter(p => p.gameRole).map((p) => p.gameRole!))).map((gameRole) => (
                <div key={gameRole} className={`flex items-center justify-between gap-4 p-3 rounded-lg border ${
                  gameRole.toLowerCase().includes("loup")
                    ? "bg-red-900/30 border-red-600/50"
                    : gameRole.toLowerCase().includes("sorcière") || gameRole.toLowerCase().includes("voyante")
                    ? "bg-purple-900/30 border-purple-600/50"
                    : "bg-green-900/30 border-green-600/50"
                }`}>
                  <span className="text-white font-medium">{gameRole}</span>
                  <motion.button
                    onClick={() => toggleAudioByRole(gameRole, !audioByRole[gameRole])}
                    variants={buttonVariants}
                    whileHover="hover"
                    whileTap="tap"
                    className={`px-3 py-1 rounded-lg text-sm ${audioByRole[gameRole] ? "bg-green-600/60" : "bg-red-600/60"} transition-all`}
                  >
                    {audioByRole[gameRole] ? "🔊 On" : "🔇 Off"}
                  </motion.button>
                </div>
              ))}
            </div>
          </div>
        )}

        <div>
          <h3 className="text-2xl font-bold text-red-500 mb-4">Votes :</h3>
          {Object.entries(votes).map(([voterId, targetId]) => (
            <p key={voterId} className="text-red-200">
              {players.find((p) => p.id === voterId)?.name} vote pour{" "}
              {players.find((p) => p.id === targetId)?.name}
            </p>
          ))}
          <motion.button
            onClick={eliminateByVote}
            variants={buttonVariants}
            whileHover="hover"
            whileTap="tap"
            className="mt-4 bg-red-600/60 hover:bg-red-700/80 text-white p-2 rounded-lg transition-all"
          >
            Éliminer par vote
          </motion.button>
        </div>
      </div>
    </>
  );
};

export default GameSupervisor;