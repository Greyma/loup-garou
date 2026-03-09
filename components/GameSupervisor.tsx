"use client";
import React, { useState, useEffect, useCallback } from "react";
import { motion } from "framer-motion";
import { Socket } from "socket.io-client";
import VoiceChat from "./VoiceChat";
import SpectatorList from "./SpectatorList";

// Styles globaux pour les effets spéciaux
const globalStyles = `
  .halloween-bg-day {
    background-image:
      radial-gradient(circle at 100% 100%, rgba(255,0,0,0.1) 0%, rgba(0,0,0,0) 20%),
      linear-gradient(45deg, rgba(0,0,0,0.8), rgba(70,0,0,0.8)),
      url('background.avif');
    background-size: cover;
    background-blend-mode: multiply;
  }

  .halloween-bg-night {
    background-image:
      radial-gradient(circle at 100% 100%, rgba(0,0,100,0.2) 0%, rgba(0,0,0,0) 20%),
      linear-gradient(45deg, rgba(0,0,20,0.9), rgba(20,0,40,0.9)),
      url('background.avif');
    background-size: cover;
    background-blend-mode: multiply;
    filter: brightness(0.7);
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
  isAfk?: boolean;
}

interface VoteResults {
  counts: Record<string, number>;
  votes: Record<string, string>;
  eliminated: string | null;
  eliminatedOdUserId: string | null;
  isTie: boolean;
  totalVotes: number;
}

interface GameSupervisorProps {
  socket: Socket | null;
  gameCode: string;
}

const GameSupervisor: React.FC<GameSupervisorProps> = ({ socket, gameCode }) => {
  const [players, setPlayers] = useState<Player[]>([]);
  const [spectators, setSpectators] = useState<Player[]>([]);
  const [gameStatus, setGameStatus] = useState<"in_progress" | "waiting" | "finished">("waiting");
  const [isDay, setIsDay] = useState<boolean>(true);
  const [, setAudioByRole] = useState<Record<string, boolean>>({});
  const [isGameStarted, setIsGameStarted] = useState(false);
  const [activeNightRole, setActiveNightRole] = useState<string | null>(null);
  const [restartConfirm, setRestartConfirm] = useState(false);

  // Speaking state for all players (received from server broadcast)
  const [speakingPlayers, setSpeakingPlayers] = useState<Record<string, boolean>>({});
  const handleSpeakingChange = useCallback((peerId: string, isSpeaking: boolean) => {
    setSpeakingPlayers((prev) => {
      if (prev[peerId] === isSpeaking) return prev;
      return { ...prev, [peerId]: isSpeaking };
    });
  }, []);

  // Vote states
  const [voteActive, setVoteActive] = useState(false);
  const [voteDuration, setVoteDuration] = useState(60);
  const [voteDeadline, setVoteDeadline] = useState<number | null>(null);
  const [voteTimeLeft, setVoteTimeLeft] = useState(0);
  const [voteTotalCount, setVoteTotalCount] = useState(0);
  const [voteResults, setVoteResults] = useState<VoteResults | null>(null);

  useEffect(() => {
    if (!socket) return;

    // Récupérer les joueurs au chargement
    socket.emit("get_players", gameCode);
    socket.on("player_list", (playerList: Player[]) => {
      setPlayers(playerList.filter(p => p.role !== "spectator").map((p) => ({ ...p, canSpeak: p.canSpeak ?? false, isEliminated: p.isEliminated || false, isAfk: p.isAfk || false })));
      setSpectators(playerList.filter(p => p.role === "spectator").map((p) => ({ ...p, canSpeak: false, isEliminated: false })));
    });

    socket.on("voice_updated", ({ playerId, canSpeak }) => {
      setPlayers((prev) =>
        prev.map((p) => (p.id === playerId ? { ...p, canSpeak } : p))
      );
    });

    socket.on("audio_updated_by_role", ({ roleName, canListen }) => {
      setAudioByRole((prev) => ({ ...prev, [roleName]: canListen }));
    });

    socket.on("day_night_updated", ({ isDay: newIsDay, activeNightRole: serverActiveRole }) => {
      setIsDay(newIsDay);
      setSpeakingPlayers({});
      // Restaurer le rôle actif nocturne si le serveur l'envoie (reconnexion)
      if (serverActiveRole !== undefined) {
        setActiveNightRole(serverActiveRole);
      }
    });

    // Recevoir l'état de parole broadcasté par le serveur
    const speakingTimers: Record<string, NodeJS.Timeout> = {};
    socket.on("player_speaking", ({ gameSocketId, isSpeaking }: { gameSocketId: string; isSpeaking: boolean }) => {
      if (speakingTimers[gameSocketId]) {
        clearTimeout(speakingTimers[gameSocketId]);
        delete speakingTimers[gameSocketId];
      }

      setSpeakingPlayers((prev) => {
        if (prev[gameSocketId] === isSpeaking) return prev;
        return { ...prev, [gameSocketId]: isSpeaking };
      });

      if (isSpeaking) {
        speakingTimers[gameSocketId] = setTimeout(() => {
          setSpeakingPlayers((prev) => {
            if (!prev[gameSocketId]) return prev;
            return { ...prev, [gameSocketId]: false };
          });
          delete speakingTimers[gameSocketId];
        }, 3000);
      }
    });

    socket.on("vote_received", ({ totalVotes }: { voterId: string; voterName: string; totalVotes: number }) => {
      setVoteTotalCount(totalVotes);
    });

    socket.on("vote_started", ({ deadline }: { duration: number; deadline: number }) => {
      setVoteActive(true);
      setVoteDeadline(deadline);
      setVoteTotalCount(0);
      setVoteResults(null);
    });

    socket.on("vote_ended", (results: VoteResults) => {
      setVoteActive(false);
      setVoteDeadline(null);
      setVoteResults(results);
    });

    socket.on("votes_reset", () => {
      setVoteActive(false);
      setVoteDeadline(null);
      setVoteTotalCount(0);
      setVoteResults(null);
    });

    socket.on("game_started", () => {
      setIsGameStarted(true);
      setGameStatus("in_progress");
      // Rafraîchir la liste des joueurs
      socket.emit("refresh_players", { roomCode: gameCode });
    });

    // Synchroniser le statut du jeu avec le serveur (important après un refresh)
    socket.on("game_status", (status: "in_progress" | "paused" | "stopped") => {
      if (status === "in_progress") {
        setIsGameStarted(true);
        setGameStatus("in_progress");
      } else if (status === "paused") {
        setIsGameStarted(true);
        setGameStatus("waiting");
      } else if (status === "stopped") {
        setGameStatus("finished");
      }
    });

    socket.on("player_eliminated", ({ playerId }: { playerId: string }) => {
      setPlayers((prev) => prev.map((p) => (p.id === playerId ? { ...p, isEliminated: true } : p)));
    });

    socket.on("game_restarted", () => {
      setIsGameStarted(true);
      setGameStatus("in_progress");
      setIsDay(false);
      setActiveNightRole(null);
    });

    return () => {
      socket.off("player_list");
      socket.off("voice_updated");
      socket.off("audio_updated_by_role");
      socket.off("day_night_updated");
      socket.off("vote_received");
      socket.off("vote_started");
      socket.off("vote_ended");
      socket.off("votes_reset");
      socket.off("game_started");
      socket.off("game_status");
      socket.off("player_eliminated");
      socket.off("game_restarted");
    };
  }, [socket, gameCode]);

  // Timer du vote pour le narrateur
  useEffect(() => {
    if (!voteActive || !voteDeadline) return;
    const interval = setInterval(() => {
      const remaining = Math.max(0, Math.ceil((voteDeadline - Date.now()) / 1000));
      setVoteTimeLeft(remaining);
      if (remaining <= 0) clearInterval(interval);
    }, 250);
    return () => clearInterval(interval);
  }, [voteActive, voteDeadline]);

  // Resync quand le tab redevient visible (apres background)
  useEffect(() => {
    if (!socket || !gameCode) return;

    const handleVisibilityChange = () => {
      if (document.visibilityState === "visible") {
        // Resync le timer de vote
        if (voteDeadline) {
          const remaining = Math.max(0, Math.ceil((voteDeadline - Date.now()) / 1000));
          setVoteTimeLeft(remaining);
        }
        // Resync complet : joueurs, statut, jour/nuit
        socket.emit("get_game_state", { roomCode: gameCode });
      }
    };

    document.addEventListener("visibilitychange", handleVisibilityChange);
    return () => document.removeEventListener("visibilitychange", handleVisibilityChange);
  }, [socket, gameCode, voteDeadline]);

  // Forcer le rechargement des rôles assignés
  const forceReloadRoles = () => {
    if (socket) {
      socket.emit("force_reload_roles", { roomCode: gameCode });
    }
  };

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

  const updateGameStatus = (status: "waiting" | "in_progress" | "finished") => {
    if (socket) {
      const socketStatus = status === "finished" ? "stopped" : status === "waiting" ? "paused" : "in_progress";
      socket.emit("update_game_status", { roomCode: gameCode, status: socketStatus });
      setGameStatus(status);
    }
  };

  // Reprendre la partie (assigne les rôles aux joueurs qui n'en ont pas)
  const resumeGame = () => {
    if (socket) {
      socket.emit("resume_game", { roomCode: gameCode });
      setGameStatus("in_progress");
    }
  };

  // Redémarrer la partie (réassigne TOUS les rôles)
  const restartGame = () => {
    console.log("[NARRATOR] restartGame appelé, socket:", !!socket, "connected:", socket?.connected, "gameCode:", gameCode);
    if (socket) {
      socket.emit("restart_game", { roomCode: gameCode });
      setRestartConfirm(false);
      setIsDay(false);
    }
  };

  const toggleVoice = (playerId: string, canSpeak: boolean) => {
    if (socket) socket.emit("toggle_voice", { roomCode: gameCode, playerId, canSpeak });
  };

  const toggleAudioByRole = (roleName: string, canListen: boolean) => {
    if (socket) {
      // Si on active un rôle, désactiver les autres d'abord
      if (canListen) {
        // Désactiver le rôle précédent
        if (activeNightRole && activeNightRole !== roleName) {
          socket.emit("toggle_audio_by_role", { roomCode: gameCode, roleName: activeNightRole, canListen: false });
        }
        setActiveNightRole(roleName);
        setAudioByRole({ [roleName]: true });
      } else {
        setActiveNightRole(null);
        setAudioByRole({});
      }
      socket.emit("toggle_audio_by_role", { roomCode: gameCode, roleName, canListen });
    }
  };

  const setDayNight = (day: boolean) => {
    if (socket) socket.emit("set_day_night", { roomCode: gameCode, isDay: day });
    setIsDay(day);
    // Réinitialiser le rôle actif quand on change de phase
    setActiveNightRole(null);
    setAudioByRole({});
  };

  const eliminatePlayer = (playerId: string, odUserId?: string | null) => {
    if (socket) {
      socket.emit("eliminate_player", {
        roomCode: gameCode,
        playerId,
        odUserId: odUserId || null
      });
      setPlayers((prev) => prev.map((p) => (p.id === playerId ? { ...p, isEliminated: true, canSpeak: false } : p)));
    }
  };

  const kickPlayer = (playerId: string, odUserId?: string | null) => {
    if (socket) {
      socket.emit("kick_player", {
        roomCode: gameCode,
        playerId,
        odUserId: odUserId || null
      });
      setPlayers((prev) => prev.filter((p) => p.id !== playerId));
    }
  };

  // ── Vote actions ──
  const startVote = () => {
    if (socket) {
      socket.emit("start_vote", { roomCode: gameCode, duration: voteDuration });
    }
  };

  const stopVote = () => {
    if (socket) {
      socket.emit("stop_vote", { roomCode: gameCode });
    }
  };

  const resetVotes = () => {
    if (socket) {
      socket.emit("reset_votes", { roomCode: gameCode });
    }
  };

  const confirmVoteElimination = () => {
    if (socket && voteResults?.eliminated) {
      socket.emit("confirm_vote_elimination", {
        roomCode: gameCode,
        playerId: voteResults.eliminated,
        odUserId: voteResults.eliminatedOdUserId,
      });
      setPlayers(prev => prev.map(p =>
        p.id === voteResults.eliminated ? { ...p, isEliminated: true } : p
      ));
      setVoteResults(null);
    }
  };

  return (
    <>
      <style>{globalStyles}</style>
      <div className={`min-h-screen text-white p-3 md:p-4 transition-all duration-500 ${isDay ? "halloween-bg-day" : "halloween-bg-night"}`}>
        <motion.h2
          initial={{ opacity: 0, y: -20 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.5 }}
          className="text-2xl font-bold text-red-500 mb-3 text-center"
        >
          Supervision : {gameCode}
        </motion.h2>

        {/* Barre de contrôle compacte — tout en horizontal */}
        <div className="mb-3 flex flex-wrap items-center justify-center gap-2 bg-black/40 p-2 rounded-xl border border-gray-700/50">
          {/* Micro narrateur */}
          <div className="flex items-center gap-1 bg-black/50 px-2 py-1 rounded-lg border border-amber-600/50">
            <span className="text-amber-400 text-xs font-semibold">🎤</span>
            <VoiceChat
              gameCode={gameCode}
              showControls={true}
              onSpeakingChange={handleSpeakingChange}
              gameSocket={socket}
              isNarrator={true}
            />
          </div>

          {/* Séparateur */}
          <div className="w-px h-6 bg-gray-600" />

          {/* Statut */}
          <div className={`flex items-center gap-1 px-2 py-1 rounded-full border text-xs ${
            gameStatus === "in_progress"
              ? "bg-green-900/40 border-green-500/50"
              : gameStatus === "waiting"
              ? "bg-yellow-900/40 border-yellow-500/50"
              : "bg-red-900/40 border-red-500/50"
          }`}>
            <span className={`w-2 h-2 rounded-full ${
              gameStatus === "in_progress" ? "bg-green-500 animate-pulse"
                : gameStatus === "waiting" ? "bg-yellow-500" : "bg-red-500"
            }`} />
            <span className="text-white">
              {gameStatus === "in_progress" ? "En cours" : gameStatus === "waiting" ? "Attente" : "Finie"}
            </span>
          </div>

          {/* Jour / Nuit toggle */}
          <div className="flex items-center rounded-lg overflow-hidden border border-gray-600">
            <button
              onClick={() => setDayNight(true)}
              className={`px-3 py-1 text-xs font-semibold transition-all ${isDay ? "bg-amber-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
            >
              ☀️ Jour
            </button>
            <button
              onClick={() => setDayNight(false)}
              className={`px-3 py-1 text-xs font-semibold transition-all ${!isDay ? "bg-indigo-600 text-white" : "bg-gray-800 text-gray-400 hover:bg-gray-700"}`}
            >
              🌙 Nuit
            </button>
          </div>

          {/* Séparateur */}
          <div className="w-px h-6 bg-gray-600" />

          {/* Contrôles de jeu */}
          {gameStatus === "waiting" && !isGameStarted && (
            <motion.button onClick={startGame} variants={buttonVariants} whileHover="hover" whileTap="tap"
              className="bg-gradient-to-r from-green-600 to-emerald-600 text-white px-4 py-1.5 rounded-lg text-xs font-bold shadow-lg">
              🎮 Démarrer
            </motion.button>
          )}
          {isGameStarted && (
            <>
              {gameStatus !== "in_progress" && (
                <motion.button onClick={resumeGame} variants={buttonVariants} whileHover="hover" whileTap="tap"
                  className="bg-green-600/60 hover:bg-green-700/80 text-white px-2 py-1 rounded-lg text-xs">
                  ▶ Reprendre
                </motion.button>
              )}
              {gameStatus !== "waiting" && (
                <motion.button onClick={() => updateGameStatus("waiting")} variants={buttonVariants} whileHover="hover" whileTap="tap"
                  className="bg-yellow-600/60 hover:bg-yellow-700/80 text-white px-2 py-1 rounded-lg text-xs">
                  ⏸ Pause
                </motion.button>
              )}
              <motion.button onClick={() => updateGameStatus("finished")} variants={buttonVariants} whileHover="hover" whileTap="tap"
                className="bg-red-600/60 hover:bg-red-700/80 text-white px-2 py-1 rounded-lg text-xs">
                ⏹ Stop
              </motion.button>

              {/* Séparateur avant redémarrer */}
              <div className="w-px h-6 bg-gray-600" />

              {!restartConfirm ? (
                <motion.button onClick={() => setRestartConfirm(true)} variants={buttonVariants} whileHover="hover" whileTap="tap"
                  className="bg-orange-800/40 hover:bg-orange-700/60 text-orange-300 px-2 py-1 rounded-lg text-xs border border-orange-600/30">
                  🔁 Redémarrer
                </motion.button>
              ) : (
                <div className="flex items-center gap-1 bg-red-900/60 px-2 py-1 rounded-lg border border-red-500">
                  <span className="text-[10px] text-red-300">Confirmer ?</span>
                  <button onClick={restartGame}
                    className="bg-red-600 hover:bg-red-500 text-white px-2 py-0.5 rounded text-[10px] font-bold">
                    Oui
                  </button>
                  <button onClick={() => setRestartConfirm(false)}
                    className="bg-gray-600 hover:bg-gray-500 text-white px-2 py-0.5 rounded text-[10px]">
                    Non
                  </button>
                </div>
              )}
            </>
          )}
          {isGameStarted && (
            <motion.button onClick={forceReloadRoles} variants={buttonVariants} whileHover="hover" whileTap="tap"
              className="bg-amber-600/60 hover:bg-amber-700/80 text-white px-2 py-1 rounded-lg text-xs">
              🔄 Rôles
            </motion.button>
          )}
        </div>

        <div className="mb-3">
          <h3 className="text-lg font-bold text-red-500 mb-2">Joueurs :</h3>
          <table className="w-full bg-black/50 rounded-lg border-2 border-red-600">
            <thead>
              <tr className="bg-red-800/60">
                <th className="p-2 text-left text-sm">Nom</th>
                <th className="p-2 text-left text-sm">Rôle</th>
                <th className="p-2 text-left text-sm">Parole</th>
                <th className="p-2 text-left text-sm">Action</th>
              </tr>
            </thead>
            <tbody>
              {players.filter(p => p.role !== "spectator").map((player) => (
                <tr
                  key={player.id}
                  className={`border-t border-red-600/50 ${player.isEliminated ? "text-gray-500 line-through" : player.isAfk ? "text-yellow-700/70" : "text-red-200"}`}
                >
                  <td className="p-2 flex items-center gap-1">
                    {player.isAfk && <span className="text-yellow-500 text-xs" title="Déconnecté">💤</span>}
                    <span className="text-sm">{player.name}</span>
                    {speakingPlayers[player.id] && !player.isEliminated && !player.isAfk && (
                      <span className="inline-flex items-end gap-0.5 h-4">
                        <span className="w-0.5 bg-green-400 rounded-full animate-pulse" style={{ height: "6px", animationDelay: "0s" }} />
                        <span className="w-0.5 bg-green-400 rounded-full animate-pulse" style={{ height: "10px", animationDelay: "0.15s" }} />
                        <span className="w-0.5 bg-green-400 rounded-full animate-pulse" style={{ height: "14px", animationDelay: "0.3s" }} />
                        <span className="w-0.5 bg-green-400 rounded-full animate-pulse" style={{ height: "10px", animationDelay: "0.15s" }} />
                        <span className="w-0.5 bg-green-400 rounded-full animate-pulse" style={{ height: "6px", animationDelay: "0s" }} />
                      </span>
                    )}
                  </td>
                  <td className="p-2">
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
                  <td className="p-2">
                    <motion.button
                      onClick={() => {
                        // Si on veut couper la parole, demander confirmation via double-clic
                        if (player.canSpeak) {
                          // Premier clic = avertissement visuel, deuxième = couper
                          const key = `mute_confirm_${player.id}`;
                          if ((window as Record<string, unknown>)[key]) {
                            clearTimeout((window as Record<string, unknown>)[key] as ReturnType<typeof setTimeout>);
                            delete (window as Record<string, unknown>)[key];
                            toggleVoice(player.id, false);
                          } else {
                            (window as Record<string, unknown>)[key] = setTimeout(() => {
                              delete (window as Record<string, unknown>)[key];
                            }, 800);
                          }
                        } else {
                          toggleVoice(player.id, true);
                        }
                      }}
                      variants={buttonVariants}
                      whileHover="hover"
                      whileTap="tap"
                      className={`px-2 py-1 rounded-lg text-xs font-semibold ${player.canSpeak ? "bg-green-600/60 hover:bg-orange-600/80" : "bg-red-600/60 hover:bg-green-700/80"} transition-all`}
                      disabled={player.isEliminated}
                      title={player.canSpeak ? "Double-cliquez pour couper" : "Cliquez pour rétablir"}
                    >
                      {player.canSpeak ? "🎤" : "🔇"}
                    </motion.button>
                  </td>
                  <td className="p-2">
                    <div className="flex items-center gap-1">
                      {!player.isEliminated ? (
                        <motion.button
                          onClick={() => eliminatePlayer(player.id, player.odUserId)}
                          variants={buttonVariants}
                          whileHover="hover"
                          whileTap="tap"
                          className="bg-red-600/60 hover:bg-red-700/80 text-white px-2 py-1 rounded-lg transition-all text-xs"
                        >
                          ☠️ Éliminer
                        </motion.button>
                      ) : (
                        <span className="text-gray-500 text-xs">Éliminé</span>
                      )}
                      <motion.button
                        onClick={() => {
                          if (confirm(`Éjecter ${player.name} de la partie ?`)) {
                            kickPlayer(player.id, player.odUserId);
                          }
                        }}
                        variants={buttonVariants}
                        whileHover="hover"
                        whileTap="tap"
                        className="bg-orange-700/60 hover:bg-orange-800/80 text-white px-2 py-1 rounded-lg transition-all text-xs"
                        title="Éjecter de la partie"
                      >
                        🚪
                      </motion.button>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>

        {/* Liste des spectateurs */}
        {spectators.length > 0 && (
          <div className="mb-3">
            <SpectatorList spectators={spectators} />
          </div>
        )}

        {isGameStarted && (
          <div className="mb-3">
            <h3 className="text-lg font-bold text-red-500 mb-2">🔊 Communication vocale :</h3>

            {/* Indicateur de phase vocale */}
            <div className={`p-3 rounded-lg border mb-4 ${isDay ? "bg-amber-900/20 border-amber-600/40" : "bg-indigo-900/20 border-indigo-600/40"}`}>
              <div className="flex items-center gap-2 mb-1">
                <span className="text-lg">{isDay ? "☀️" : "🌙"}</span>
                <span className={`font-semibold ${isDay ? "text-amber-300" : "text-indigo-300"}`}>
                  {isDay ? "Jour — Communication libre" : "Nuit — Silence total"}
                </span>
              </div>
              <p className="text-sm text-gray-400">
                {isDay
                  ? "Tous les joueurs peuvent se parler et s\'entendre."
                  : activeNightRole
                    ? `Seuls les ${activeNightRole} peuvent communiquer entre eux. Les autres n'entendent rien.`
                    : "Personne ne peut communiquer. Sélectionnez un rôle pour activer la communication nocturne."}
              </p>
            </div>

            {/* Sélection du rôle actif la nuit */}
            {!isDay && (
              <div className="mb-4">
                <p className="text-sm text-gray-300 mb-2">🎭 Sélectionnez un rôle pour activer la communication :</p>
                <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                  {Array.from(new Set(players.filter(p => p.gameRole).map((p) => p.gameRole!))).map((gameRole) => {
                    const isActive = activeNightRole === gameRole;
                    return (
                      <motion.button
                        key={gameRole}
                        onClick={() => toggleAudioByRole(gameRole, !isActive)}
                        variants={buttonVariants}
                        whileHover="hover"
                        whileTap="tap"
                        className={`flex items-center justify-between gap-3 p-3 rounded-lg border transition-all ${
                          isActive
                            ? gameRole.toLowerCase().includes("loup")
                              ? "bg-red-800/60 border-red-400 shadow-lg shadow-red-900/30"
                              : "bg-purple-800/60 border-purple-400 shadow-lg shadow-purple-900/30"
                            : "bg-gray-800/40 border-gray-600 hover:border-gray-400"
                        }`}
                      >
                        <span className="text-white font-medium">
                          {gameRole.toLowerCase().includes("loup") ? "🐺" :
                           gameRole.toLowerCase().includes("sorcière") ? "🧙‍♀️" :
                           gameRole.toLowerCase().includes("voyante") ? "🔮" :
                           gameRole.toLowerCase().includes("chasseur") ? "🏹" :
                           gameRole.toLowerCase().includes("cupidon") ? "💘" :
                           "👤"}
                          {" "}{gameRole}
                        </span>
                        <span className={`px-2 py-0.5 rounded-full text-xs font-bold ${
                          isActive ? "bg-green-500/80 text-white" : "bg-gray-600/60 text-gray-400"
                        }`}>
                          {isActive ? "🔊 Actif" : "🔇 Muet"}
                        </span>
                      </motion.button>
                    );
                  })}
                </div>
                {activeNightRole && (
                  <div className="mt-3 flex justify-end">
                    <motion.button
                      onClick={() => toggleAudioByRole(activeNightRole, false)}
                      variants={buttonVariants}
                      whileHover="hover"
                      whileTap="tap"
                      className="bg-gray-600/60 hover:bg-gray-700/80 text-white px-4 py-2 rounded-lg transition-all text-sm"
                    >
                      🔇 Désactiver tout
                    </motion.button>
                  </div>
                )}
              </div>
            )}

            {/* Le jour : pas de sélection de rôle, tout est ouvert */}
            {isDay && (
              <div className="p-3 bg-green-900/20 border border-green-600/30 rounded-lg">
                <p className="text-green-300 text-sm flex items-center gap-2">
                  ✅ Tous les joueurs peuvent se parler librement.
                </p>
              </div>
            )}
          </div>
        )}

        <div>
          <h3 className="text-lg font-bold text-red-500 mb-2">🗳️ Système de vote :</h3>

          {/* Contrôles du vote */}
          {!voteActive && !voteResults && (
            <div className="flex flex-wrap items-center gap-3 mb-4 p-4 bg-black/40 rounded-lg border border-gray-700">
              <label className="text-gray-300 text-sm">Durée :</label>
              <select
                value={voteDuration}
                onChange={(e) => setVoteDuration(Number(e.target.value))}
                className="bg-gray-800 text-white px-3 py-2 rounded-lg border border-gray-600 text-sm"
              >
                <option value={30}>30s</option>
                <option value={60}>1 min</option>
                <option value={90}>1 min 30</option>
                <option value={120}>2 min</option>
                <option value={180}>3 min</option>
              </select>
              <motion.button
                onClick={startVote}
                variants={buttonVariants}
                whileHover="hover"
                whileTap="tap"
                className="bg-green-600/60 hover:bg-green-700/80 text-white px-6 py-2 rounded-lg transition-all font-semibold"
              >
                🗳️ Lancer le vote
              </motion.button>
            </div>
          )}

          {/* Vote en cours */}
          {voteActive && (
            <div className="p-4 bg-amber-900/20 rounded-lg border border-amber-600/40 mb-4">
              <div className="flex items-center justify-between mb-3">
                <span className="text-amber-400 font-bold flex items-center gap-2">
                  🗳️ Vote en cours...
                </span>
                <div className="flex items-center gap-3">
                  <span className="text-sm text-gray-400">{voteTotalCount} vote(s) reçu(s)</span>
                  <span className={`font-mono font-bold px-3 py-1 rounded-full text-sm ${
                    voteTimeLeft <= 10 ? "bg-red-900/60 text-red-300 animate-pulse" : "bg-gray-800 text-gray-300"
                  }`}>
                    ⏱ {voteTimeLeft}s
                  </span>
                </div>
              </div>
              <div className="flex gap-3">
                <motion.button
                  onClick={stopVote}
                  variants={buttonVariants}
                  whileHover="hover"
                  whileTap="tap"
                  className="bg-red-600/60 hover:bg-red-700/80 text-white px-4 py-2 rounded-lg transition-all text-sm"
                >
                  ⏹ Arrêter le vote
                </motion.button>
                <motion.button
                  onClick={resetVotes}
                  variants={buttonVariants}
                  whileHover="hover"
                  whileTap="tap"
                  className="bg-gray-600/60 hover:bg-gray-700/80 text-white px-4 py-2 rounded-lg transition-all text-sm"
                >
                  🔄 Annuler
                </motion.button>
              </div>
            </div>
          )}

          {/* Résultats du vote */}
          {voteResults && (
            <div className="p-4 bg-black/40 rounded-lg border border-red-600/40 mb-4">
              <h4 className="text-lg font-bold text-amber-400 mb-3">📊 Résultats du vote</h4>

              {voteResults.totalVotes === 0 ? (
                <p className="text-gray-500 text-center py-2">Aucun vote n&apos;a été enregistré.</p>
              ) : (
                <>
                  {/* Barres de résultats */}
                  <div className="space-y-2 mb-4">
                    {Object.entries(voteResults.counts)
                      .sort(([, a], [, b]) => b - a)
                      .map(([targetId, count]) => {
                        const maxCount = Math.max(...Object.values(voteResults.counts));
                        const pct = voteResults.totalVotes > 0 ? (count / voteResults.totalVotes) * 100 : 0;
                        const playerName = players.find(p => p.id === targetId)?.name || "???";
                        return (
                          <div key={targetId} className="flex items-center gap-2">
                            <span className="text-sm text-gray-300 w-28 truncate">{playerName}</span>
                            <div className="flex-1 h-6 bg-gray-800 rounded-full overflow-hidden">
                              <div
                                className={`h-full rounded-full flex items-center justify-end px-2 text-xs font-bold transition-all ${
                                  count === maxCount ? "bg-red-500 text-white" : "bg-gray-600 text-gray-300"
                                }`}
                                style={{ width: `${Math.max(pct, 8)}%` }}
                              >
                                {count}
                              </div>
                            </div>
                          </div>
                        );
                      })}
                  </div>

                  {/* Détail des votes */}
                  <details className="mb-4">
                    <summary className="text-sm text-gray-500 cursor-pointer hover:text-gray-300">
                      Voir le détail des votes ({voteResults.totalVotes})
                    </summary>
                    <div className="mt-2 space-y-1 pl-4">
                      {Object.entries(voteResults.votes).map(([voterId, targetId]) => (
                        <p key={voterId} className="text-sm text-gray-400">
                          {players.find(p => p.id === voterId)?.name || `Joueur ${voterId.slice(0, 4)}`}
                          {" → "}
                          <span className="text-red-300">{players.find(p => p.id === targetId)?.name || "???"}</span>
                        </p>
                      ))}
                    </div>
                  </details>

                  {/* Verdict */}
                  {voteResults.isTie ? (
                    <p className="text-yellow-400 font-semibold text-center py-2">⚖️ Égalité — Aucune élimination automatique</p>
                  ) : voteResults.eliminated ? (
                    <div className="flex items-center justify-between p-3 bg-red-900/30 rounded-lg border border-red-600/40">
                      <p className="text-red-300 font-semibold">
                        💀 {players.find(p => p.id === voteResults.eliminated)?.name} est désigné
                      </p>
                      <motion.button
                        onClick={confirmVoteElimination}
                        variants={buttonVariants}
                        whileHover="hover"
                        whileTap="tap"
                        className="bg-red-600 hover:bg-red-700 text-white px-4 py-2 rounded-lg transition-all font-bold text-sm"
                      >
                        ☠️ Confirmer l&apos;élimination
                      </motion.button>
                    </div>
                  ) : null}
                </>
              )}

              <div className="mt-3 flex justify-end">
                <motion.button
                  onClick={resetVotes}
                  variants={buttonVariants}
                  whileHover="hover"
                  whileTap="tap"
                  className="bg-gray-600/60 hover:bg-gray-700/80 text-white px-4 py-2 rounded-lg transition-all text-sm"
                >
                  🔄 Nouveau vote
                </motion.button>
              </div>
            </div>
          )}
        </div>
      </div>
    </>
  );
};

export default GameSupervisor;