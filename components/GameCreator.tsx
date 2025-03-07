import React from "react";
import { motion } from "framer-motion";
import { createGame, Role } from "@/pages/api/home";
import { Socket } from "socket.io-client";
import RoleManager from "./RoleManager";

const buttonVariants = {
  hover: { scale: 1.05, boxShadow: "0 0 10px rgba(255, 0, 0, 0.5)" },
  tap: { scale: 0.95 },
};

interface GameCreatorProps {
  socket: Socket | null;
  maxPlayers: number;
  setMaxPlayers: React.Dispatch<React.SetStateAction<number>>;
  roles: Role[];
  setRoles: React.Dispatch<React.SetStateAction<Role[]>>;
  setGameCode: React.Dispatch<React.SetStateAction<string>>;
}

const GameCreator: React.FC<GameCreatorProps> = ({
  socket,
  maxPlayers,
  setMaxPlayers,
  roles,
  setRoles,
  setGameCode,
}) => {
  const handleCreateGame = async () => {
    if (!socket) {
      alert("Connexion au serveur non établie.");
      return;
    }
    try {
      const code = await createGame();
      setGameCode(code);
      socket.emit("join_room", code);
      socket.emit("set_game_settings", { maxPlayers, roles });
    } catch (err: any) {
      console.error("Erreur création partie :", err);
      alert("Erreur : " + (err.message || "Impossible de créer la partie"));
    }
  };

  const totalRoles = roles.reduce((sum, role) => sum + (role.count || 0), 0);

  return (
    <motion.div
      initial={{ opacity: 0, y: 20 }}
      animate={{ opacity: 1, y: 0 }}
      transition={{ duration: 0.5 }}
      className="mirror-effect bg-black/80 p-8 rounded-xl border-2 border-red-600 backdrop-blur-sm mb-6"
    >
      <h2 className="text-3xl font-bold mb-6 text-red-500">Créer une partie</h2>
      <div className="mb-6">
        <label className="block mb-2 text-red-200">Nombre maximum de joueurs :</label>
        <input
          type="number"
          value={maxPlayers}
          onChange={(e) => setMaxPlayers(Math.max(1, parseInt(e.target.value) || 1))}
          className="w-full bg-black/50 text-red-200 px-4 py-3 rounded-lg border border-red-600/50 focus:outline-none focus:ring-2 focus:ring-red-500"
          min="1"
        />
      </div>
      <RoleManager roles={roles} setRoles={setRoles} />
      {totalRoles > maxPlayers && (
        <p className="text-red-400 mt-4">
          Attention : plus de rôles ({totalRoles}) que de joueurs maximum ({maxPlayers}) !
        </p>
      )}
      <motion.button
        onClick={handleCreateGame}
        variants={buttonVariants}
        whileHover="hover"
        whileTap="tap"
        className="w-full bg-red-800/60 hover:bg-red-700/80 text-red-100 py-3 rounded-lg transition-all"
      >
        Créer la partie
      </motion.button>
    </motion.div>
  );
};

export default GameCreator;