"use client";
import React, { useState } from 'react';
import { motion } from 'framer-motion';

const Home: React.FC = () => {
  const [isNameModalOpen, setNameModalOpen] = useState(false);
  const [isRoleModalOpen, setRoleModalOpen] = useState(false);
  const [name, setName] = useState('');
  const [role, setRole] = useState<'player' | 'spectator' | null>(null);
  const [activeVisitors, setActiveVisitors] = useState(0);
  const [players, setPlayers] = useState<{ name: string; role: 'player' | 'spectator' }[]>([]);

  const handleNameSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setNameModalOpen(false);
    setRoleModalOpen(true);
  };

  const handleRoleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setRoleModalOpen(false);
    setActiveVisitors((prev) => prev + 1);
    if (role === 'player') {
      setPlayers([...players, { name, role }]);
    }
  };

  // Animation pour les cartes de joueurs
  const playerCardVariants = {
    hidden: { opacity: 0, scale: 0.8, rotate: -10 },
    visible: { opacity: 1, scale: 1, rotate: 0, transition: { type: 'spring', stiffness: 100 } },
  };

  // Animation pour le bouton "Rejoindre la partie"
  const buttonVariants = {
    hover: { scale: 1.05, backgroundColor: '#ff00ff', transition: { duration: 0.3 } },
    tap: { scale: 0.95 },
  };

  return (
    <div className="min-h-screen bg-gradient-to-br from-indigo-900 via-purple-900 to-pink-900 text-white">
      {/* Modal pour le nom */}
      {isNameModalOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        >
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-white p-6 rounded-lg shadow-lg text-black"
          >
            <h2 className="text-xl font-bold mb-4">Entrez votre nom</h2>
            <form onSubmit={handleNameSubmit}>
              <input
                type="text"
                value={name}
                onChange={(e) => setName(e.target.value)}
                className="w-full p-2 border rounded mb-4"
                placeholder="Votre nom"
                required
              />
              <button type="submit" className="w-full bg-pink-600 text-white p-2 rounded hover:bg-pink-700">
                Suivant
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}

      {/* Modal pour le rôle */}
      {isRoleModalOpen && (
        <motion.div
          initial={{ opacity: 0 }}
          animate={{ opacity: 1 }}
          exit={{ opacity: 0 }}
          className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50"
        >
          <motion.div
            initial={{ y: -50, opacity: 0 }}
            animate={{ y: 0, opacity: 1 }}
            className="bg-white p-6 rounded-lg shadow-lg text-black"
          >
            <h2 className="text-xl font-bold mb-4">Choisissez votre rôle</h2>
            <form onSubmit={handleRoleSubmit}>
              <div className="mb-4">
                <label className="block mb-2">
                  <input
                    type="radio"
                    value="player"
                    checked={role === 'player'}
                    onChange={() => setRole('player')}
                  />
                  <span className="ml-2">Joueur</span>
                </label>
                <label className="block mb-2">
                  <input
                    type="radio"
                    value="spectator"
                    checked={role === 'spectator'}
                    onChange={() => setRole('spectator')}
                  />
                  <span className="ml-2">Spectateur</span>
                </label>
              </div>
              <button type="submit" className="w-full bg-pink-600 text-white p-2 rounded hover:bg-pink-700">
                Confirmer
              </button>
            </form>
          </motion.div>
        </motion.div>
      )}

      {/* Contenu principal */}
      <div className="container mx-auto p-4">
        {/* Animation du titre */}
        <motion.h1
          initial={{ y: -50, opacity: 0, rotate: -5 }}
          animate={{ y: 0, opacity: 1, rotate: 0 }}
          transition={{ type: 'spring', stiffness: 120, delay: 0.2 }}
          className="text-6xl font-bold text-center mb-4 bg-gradient-to-r from-pink-500 to-purple-500 bg-clip-text text-transparent"
        >
          Loup-Garou
        </motion.h1>

        {/* Animation du sous-titre */}
        <motion.p
          initial={{ y: -50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.4 }}
          className="text-xl text-center mb-8 text-pink-200"
        >
          Rejoins une partie !
        </motion.p>

        {/* Animation du salon d'attente */}
        <motion.div
          initial={{ y: 50, opacity: 0 }}
          animate={{ y: 0, opacity: 1 }}
          transition={{ delay: 0.6 }}
          className="bg-white bg-opacity-10 p-6 rounded-lg shadow-lg backdrop-blur-sm"
        >
          <h2 className="text-2xl font-bold mb-4 text-pink-200">Salon d'attente</h2>
          <p className="mb-4 text-pink-200">Visiteurs actifs: {activeVisitors}</p>

          {/* Animation des cartes de joueurs */}
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {players.map((player, index) => (
              <motion.div
                key={index}
                variants={playerCardVariants}
                initial="hidden"
                animate="visible"
                className="bg-gradient-to-r from-pink-600 to-purple-600 p-4 rounded-lg flex items-center shadow-lg"
              >
                <span className="text-2xl mr-2">👤</span>
                <span className="text-white">{player.name}</span>
              </motion.div>
            ))}
          </div>

          {/* Animation du bouton "Rejoindre la partie" */}
          <motion.button
            onClick={() => setNameModalOpen(true)}
            variants={buttonVariants}
            whileHover="hover"
            whileTap="tap"
            className="mt-6 w-full bg-gradient-to-r from-pink-500 to-purple-500 text-white p-3 rounded-lg shadow-lg hover:from-pink-600 hover:to-purple-600 transition-all"
          >
            Rejoindre la partie
          </motion.button>
        </motion.div>
      </div>
    </div>
  );
};

export default Home;