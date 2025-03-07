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
  name: string;
  role: string;
  canSpeak: boolean;
  isEliminated: boolean;
}

interface GameSupervisorProps {
  socket: Socket | null;
  gameCode: string;
}

const GameSupervisor: React.FC<GameSupervisorProps> = ({ socket, gameCode }) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [gameStatus, setGameStatus] = useState<"in_progress" | "waiting" | "finished">("in_progress");
  const [isDay, setIsDay] = useState<boolean>(true);
  const [votes, setVotes] = useState<Record<string, string>>({});
  const [audioByRole, setAudioByRole] = useState<Record<string, boolean>>({});

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

    return () => {
      socket.off("player_list");
      socket.off("voice_updated");
      socket.off("audio_updated_by_role");
      socket.off("day_night_updated");
      socket.off("vote_received");
    };
  }, [socket, gameCode]);

  const updateGameStatus = async (status: "waiting" | "in_progress" | "finished") => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/game/${gameCode}/status`, {
        method: "PUT",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ status }),
      });
      if (!res.ok) throw new Error("Erreur lors de la mise à jour du statut");
      setGameStatus(status);
    } catch (err: any) {
      alert("Erreur : " + err.message);
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

  const eliminatePlayer = async (playerId: string) => {
    try {
      const res = await fetch(`${process.env.NEXT_PUBLIC_BACKEND_URL}/api/game/${gameCode}/eliminate/${playerId}`, {
        method: "POST",
      });
      if (!res.ok) throw new Error("Erreur lors de l’élimination");
      setPlayers((prev) => prev.map((p) => (p.id === playerId ? { ...p, isEliminated: true } : p)));
    } catch (err: any) {
      alert("Erreur : " + err.message);
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
    if (eliminatedId) eliminatePlayer(eliminatedId);
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

        <div className="mb-6 flex gap-4 justify-center">
          <motion.button
            onClick={() => updateGameStatus("in_progress")}
            variants={buttonVariants}
            whileHover="hover"
            whileTap="tap"
            className="bg-green-600/60 hover:bg-green-700/80 text-white p-2 rounded-lg transition-all"
          >
            Lancer/Reprendre
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
              {players.map((player) => (
                <tr
                  key={player.id}
                  className={`border-t border-red-600/50 ${player.isEliminated ? "text-gray-500" : "text-red-200"}`}
                >
                  <td className="p-3">{player.name}</td>
                  <td className="p-3">{player.role}</td>
                  <td className="p-3">
                    <motion.button
                      onClick={() => toggleVoice(player.id, !player.canSpeak)}
                      variants={buttonVariants}
                      whileHover="hover"
                      whileTap="tap"
                      className={`p-2 rounded-lg ${player.canSpeak ? "bg-green-600/60" : "bg-red-600/60"} hover:bg-green-700/80 transition-all`}
                      disabled={player.isEliminated}
                    >
                      {player.canSpeak ? "Oui" : "Non"}
                    </motion.button>
                  </td>
                  <td className="p-3">
                    <motion.button
                      onClick={() => eliminatePlayer(player.id)}
                      variants={buttonVariants}
                      whileHover="hover"
                      whileTap="tap"
                      className="bg-red-600/60 hover:bg-red-700/80 text-white p-2 rounded-lg transition-all"
                      disabled={player.isEliminated}
                    >
                      Éliminer
                    </motion.button>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        <div className="mb-6">
          <h3 className="text-2xl font-bold text-red-500 mb-4">Audio par rôle :</h3>
          {Array.from(new Set(players.map((p) => p.role))).map((role) => (
            <div key={role} className="flex items-center gap-4 mb-2">
              <span className="text-red-200">{role}</span>
              <motion.button
                onClick={() => toggleAudioByRole(role, !audioByRole[role])}
                variants={buttonVariants}
                whileHover="hover"
                whileTap="tap"
                className={`p-2 rounded-lg ${audioByRole[role] ? "bg-green-600/60" : "bg-red-600/60"} hover:bg-green-700/80 transition-all`}
              >
                {audioByRole[role] ? "Activé" : "Désactivé"}
              </motion.button>
            </div>
          ))}
        </div>

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