"use client";
import React from "react";
import { useParams } from "next/navigation";
import { motion } from "framer-motion";
import Chat from "@/components/Chat";
import VoiceChat from "@/components/VoiceChat";

const GamePage: React.FC = () => {
  const params = useParams();
  const id = params?.id as string | undefined;

  // Données fictives pour les joueurs et les rôles
  const players = [
    { id: 1, name: "Joueur 1", role: "Loup-Garou" },
    { id: 2, name: "Joueur 2", role: "Villageois" },
    { id: 3, name: "Joueur 3", role: "Voyante" },
  ];

  const remainingRoles = ["Loup-Garou", "Villageois", "Sorcière", "Chasseur"];

  return (
    <div className="min-h-screen bg-gradient-to-br from-purple-900 to-indigo-800 text-white p-4">
      <div className="flex justify-around gap-4">
        {/* Section Joueurs */}
        <motion.div
          initial={{ opacity: 0, x: -50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="border-2 border-purple-500 rounded-lg p-4 w-1/3 bg-white bg-opacity-10 backdrop-blur-sm"
        >
          <h2 className="text-xl font-bold text-center mb-4">Joueurs</h2>
          <div className="space-y-2">
            {players.map((player) => (
              <div
                key={player.id}
                className="flex items-center justify-between p-2 border border-purple-500 rounded-lg"
              >
                <span>{player.name}</span>
                <span className="text-sm text-purple-300">{player.role}</span>
              </div>
            ))}
          </div>
        </motion.div>

        {/* Cercle du jeu et Rôles restants */}
        <div className="flex flex-col items-center w-1/3">
          {/* Cercle du jeu */}
          <motion.div
            initial={{ scale: 0 }}
            animate={{ scale: 1 }}
            transition={{ duration: 0.5, delay: 0.2 }}
            className="w-48 h-48 border-2 border-purple-500 rounded-full flex justify-center items-center relative mb-8"
          >
            <span className="text-lg font-bold">Cercle du jeu</span>
            <motion.div
              initial={{ scale: 0 }}
              animate={{ scale: 1 }}
              transition={{ duration: 0.5, delay: 0.4 }}
              className="w-12 h-12 border-2 border-purple-500 rounded-full absolute -top-6 -left-6 flex justify-center items-center bg-purple-700"
            >
              N
            </motion.div>
          </motion.div>

          {/* Rôles restants */}
          <motion.div
            initial={{ opacity: 0, y: 50 }}
            animate={{ opacity: 1, y: 0 }}
            transition={{ duration: 0.5, delay: 0.6 }}
            className="border-2 border-purple-500 rounded-lg p-4 w-full bg-white bg-opacity-10 backdrop-blur-sm"
          >
            <h2 className="text-xl font-bold text-center mb-4">Rôles restants</h2>
            <div className="flex flex-wrap gap-2">
              {remainingRoles.map((role, index) => (
                <div
                  key={index}
                  className="px-3 py-1 border border-purple-500 rounded-full text-sm"
                >
                  {role}
                </div>
              ))}
            </div>
          </motion.div>
        </div>

        {/* Section Chat et Voice Chat */}
        <motion.div
          initial={{ opacity: 0, x: 50 }}
          animate={{ opacity: 1, x: 0 }}
          transition={{ duration: 0.5 }}
          className="border-2 border-purple-500 rounded-lg p-4 w-1/3 bg-white bg-opacity-10 backdrop-blur-sm"
        >
          <h2 className="text-xl font-bold text-center mb-4">Chat</h2>
          <div className="mb-4">
            <Chat gameId={id as string} />
          </div>
          <div>
            <VoiceChat gameId={id as string} playerId={""} />
          </div>
        </motion.div>
      </div>
    </div>
  );
};

export default GamePage;