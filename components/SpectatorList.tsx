import React from "react";
import { motion } from "framer-motion";

interface Spectator {
  id: string;
  name: string;
  role?: string;
  canSpeak: boolean;
}

interface SpectatorListProps {
  spectators: Spectator[];
}

const SpectatorList: React.FC<SpectatorListProps> = ({ spectators }) => {
  const spectatorVariants = {
    hidden: { opacity: 0, y: 20 },
    visible: { opacity: 1, y: 0, transition: { duration: 0.3 } },
  };

  return (
    <motion.div
      initial={{ opacity: 0, x: 50 }}
      animate={{ opacity: 1, x: 0 }}
      transition={{ duration: 0.5 }}
      className="w-1/4 bg-white bg-opacity-10 backdrop-blur-md rounded-xl p-5 shadow-lg border border-purple-400"
    >
      <h2 className="text-2xl font-bold text-center mb-4 text-purple-200">Spectateurs</h2>
      <div className="space-y-3 max-h-96 overflow-y-auto">
        {spectators.length === 0 ? (
          <p className="text-center text-gray-400">Aucun spectateur...</p>
        ) : (
          spectators.map((spectator) => (
            <motion.div
              key={spectator.id}
              variants={spectatorVariants}
              initial="hidden"
              animate="visible"
              className="p-3 bg-purple-700 bg-opacity-50 rounded-lg border border-purple-500"
            >
              {spectator.name}
            </motion.div>
          ))
        )}
      </div>
    </motion.div>
  );
};

export default SpectatorList;